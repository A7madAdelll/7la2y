// Live-update pings: one per statement per shop, public topic, no customer data.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, hasDb, join, user } from "./db";

describe.skipIf(!hasDb)("live updates", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  const pings = async (shopId: string) =>
    (await db.pool.query("select event, payload, private from realtime.test_messages where topic = $1 order by id", [`shop:${shopId}`])).rows;

  it("sends a data-free ping on join, next, open/close and barber duty changes", async () => {
    const s = await db.createShop();
    const before = (await pings(s.shopId)).length;
    await join(db, s);
    expect((await pings(s.shopId)).length).toBe(before + 1); // exactly one: the ticket counter bump sends none

    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
    await db.rpc(user(s.owner), "set_queue_open", [s.shopId, false]);
    await db.rpc(user(s.owner), "set_barber_on_duty", [s.barberIds[0], false]);
    const all = await pings(s.shopId);
    expect(all.length).toBeGreaterThanOrEqual(before + 4);
    for (const p of all) {
      expect(p.event).toBe("changed");
      expect(p.private).toBe(false);
      expect(Object.keys(p.payload)).toEqual(["at"]); // no names, phones or tickets
    }
  });

  it("a failing broadcast never fails the queue action", async () => {
    const s = await db.createShop();
    await db.pool.query("alter function realtime.send(jsonb, text, text, boolean) rename to send_off");
    try {
      const r = await join(db, s);
      expect(r.ticket_no).toBe(1);
    } finally {
      await db.pool.query("alter function realtime.send_off(jsonb, text, text, boolean) rename to send");
    }
  });

  it("entry_status tells the customer page which shop topic to follow", async () => {
    const s = await db.createShop();
    const e = await join(db, s);
    const st = await db.rpc<{ shop_id: string }>(anon, "entry_status", [e.token]);
    expect(st.shop_id).toBe(s.shopId);
  });

  it("app paths cannot be taken as shop links", async () => {
    const owner = await db.createUser();
    for (const slug of ["login", "demo", "admin"]) {
      await expect(db.rpc(user(owner), "create_shop", [slug, "محل", ["men"]])).rejects.toThrow("invalid_shop");
    }
  });
});
