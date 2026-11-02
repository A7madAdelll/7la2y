// Races that happen in real shops: double taps, two cashiers, a crowd scanning the QR at once.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, errorOf, hasDb, join, nextPhone, user } from "./db";

describe.skipIf(!hasDb)("concurrency", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  it("20 simultaneous 'next' presses for one barber move the queue exactly once", async () => {
    const s = await db.createShop();
    for (let i = 0; i < 5; i++) await join(db, s);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.rpc<{ result: string }>(user(s.owner), "queue_next", [s.barberIds[0], null]),
      ),
    );
    expect(results.filter((r) => r.result === "ok")).toHaveLength(1);
    const r = await db.pool.query(
      "select status, count(*)::int as n from public.queue_entries where shop_id = $1 group by status",
      [s.shopId],
    );
    expect(Object.fromEntries(r.rows.map((x) => [x.status, x.n]))).toEqual({ serving: 1, waiting: 4 });
  });

  it("two barbers pressing at once never take the same customer", async () => {
    const barbers = ["a", "b", "c", "d", "e", "f"];
    const s = await db.createShop({ barbers });
    for (let i = 0; i < barbers.length; i++) await join(db, s);
    const results = await Promise.all(
      s.barberIds.map((b) =>
        db.rpc<{ current_entry_id: string }>(user(s.owner), "queue_next", [b, null]),
      ),
    );
    const served = results.map((r) => r.current_entry_id);
    expect(served.every(Boolean)).toBe(true);
    expect(new Set(served).size).toBe(barbers.length);
  });

  it("50 customers joining at once get unique, gap-free tickets", async () => {
    const s = await db.createShop();
    const code = await s.code();
    const joins = await Promise.all(Array.from({ length: 50 }, () => join(db, s, { code })));
    const tickets = joins.map((j) => j.ticket_no).sort((a, b) => a - b);
    expect(tickets).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    const r = await db.pool.query(
      "select count(distinct position)::int as n from public.queue_entries where shop_id = $1",
      [s.shopId],
    );
    expect(r.rows[0].n).toBe(50);
  });

  it("the same phone submitted 10 times at once creates one entry", async () => {
    const s = await db.createShop();
    const code = await s.code();
    const phone = nextPhone();
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => errorOf(join(db, s, { code, phone }))),
    );
    expect(outcomes.filter((o) => o === "NO_ERROR")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "already_in_queue")).toHaveLength(9);
  });

  it("joins, nexts, no-shows and reorders interleaved leave a consistent queue", async () => {
    const s = await db.createShop({ barbers: ["a", "b"] });
    const code = await s.code();
    await Promise.all(Array.from({ length: 10 }, () => join(db, s, { code, alert: true })));
    // Concurrent joins finish in any order, so read the real queue order. The two barbers only
    // reach the first two, so entries from index 5 on stay waiting for the reorder/no-show below.
    const ordered = (
      await db.pool.query(
        "select id from public.queue_entries where shop_id = $1 and status = 'waiting' order by position",
        [s.shopId],
      )
    ).rows.map((r) => r.id as string);
    await Promise.all([
      ...Array.from({ length: 10 }, () => join(db, s, { code, alert: true })),
      ...s.barberIds.map((b) => db.rpc(user(s.owner), "queue_next", [b, null])),
      db.rpc(user(s.owner), "queue_no_show", [ordered[9]]),
      db.rpc(user(s.owner), "queue_reorder", [ordered[8], ordered[5]]),
    ]);
    const r = await db.pool.query(
      `select
         (select count(*)::int from public.queue_entries where shop_id = $1 and status = 'serving') as serving,
         (select count(*)::int from public.queue_entries where shop_id = $1) as total,
         (select count(*)::int from public.message_log where shop_id = $1) as alerts,
         (select count(distinct entry_id)::int from public.message_log where shop_id = $1) as alert_entries`,
      [s.shopId],
    );
    const row = r.rows[0];
    expect(row.serving).toBe(2);
    expect(row.total).toBe(20);
    expect(row.alerts).toBe(row.alert_entries); // never two alerts for one entry
  });
});
