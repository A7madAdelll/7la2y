// Joining is server-only and rate limited in the database.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, joinRaw, user } from "./db";

describe.skipIf(!hasDb)("abuse protection", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  it("the public key and logged-in users cannot call join_queue directly", async () => {
    const s = await db.createShop();
    const args = ["ip", s.slug, await s.code(), "x", "01012345678", null, [s.service("قصة شعر")], false];
    const sql = "select public.join_queue($1, $2, $3, $4, $5, $6, $7, $8)";
    expect(await errorOf(db.as(anon, (c) => c.query(sql, args)))).toMatch(/permission denied/);
    expect(await errorOf(db.as(user(s.owner), (c) => c.query(sql, args)))).toMatch(/permission denied/);
  });

  it("blocks code guessing after 10 wrong codes, even when the 11th guess is right", async () => {
    const s = await db.createShop();
    const real = await s.code();
    const wrong = (i: number) => {
      let c = String((Number(real) + 100 + i * 7) % 10000).padStart(4, "0");
      if (c === real) c = String((Number(c) + 1) % 10000).padStart(4, "0");
      return c;
    };
    for (let i = 0; i < 10; i++) {
      expect((await joinRaw(db, s, { clientKey: "attacker", code: wrong(i) })).error).toBe("bad_code");
    }
    expect((await joinRaw(db, s, { clientKey: "attacker", code: real })).error).toBe("rate_limited");
    // Another customer (different IP) in the same shop is unaffected.
    expect((await joinRaw(db, s, { clientKey: "customer", code: real })).error).toBeUndefined();
  });

  it("counts wrong codes per shop: a block at shop A does not block shop B", async () => {
    const a = await db.createShop();
    const b = await db.createShop();
    for (let i = 0; i < 10; i++) await joinRaw(db, a, { clientKey: "ip-1", code: "0000" === (await a.code()) ? "1111" : "0000" });
    expect((await joinRaw(db, a, { clientKey: "ip-1" })).error).toBe("rate_limited");
    expect((await joinRaw(db, b, { clientKey: "ip-1" })).error).toBeUndefined();
  });

  it("caps join attempts per client at 30 per 10 minutes", async () => {
    const s = await db.createShop();
    const results = [];
    for (let i = 0; i < 31; i++) results.push((await joinRaw(db, s, { clientKey: "busy-wifi" })).error);
    expect(results.slice(0, 30).every((e) => e === undefined)).toBe(true);
    expect(results[30]).toBe("rate_limited");
  });

  it("rejects a missing client key (server bug, not user input)", async () => {
    const s = await db.createShop();
    expect(await errorOf(joinRaw(db, s, { clientKey: "  " }))).toBe("invalid_client");
  });
});
