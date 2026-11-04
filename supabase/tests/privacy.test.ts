// PDPL: erase on request, erase after the retention period, keep anonymous statistics.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, server, user } from "./db";

describe.skipIf(!hasDb)("privacy", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  const personal = async (shopId: string) =>
    (await db.pool.query(
      `select (select count(*)::int from public.customers where shop_id = $1) as customers,
              (select count(*)::int from public.queue_entries where shop_id = $1) as visits,
              (select count(*)::int from public.queue_entries where shop_id = $1 and customer_name <> '—') as named,
              (select count(*)::int from public.message_log where shop_id = $1 and phone is not null) as phones`,
      [shopId],
    )).rows[0];

  it("forget_me erases name and phone, leaves the queue, keeps an anonymous visit", async () => {
    const s = await db.createShop();
    for (let i = 0; i < 2; i++) await join(db, s);
    const me = await join(db, s, { name: "منى", phone: "01277778888", alert: true });
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]); // 1 ahead... alert queued
    expect(await db.rpc(anon, "forget_me", [me.token])).toBe(true);

    const st = await db.rpc<{ status: string }>(anon, "entry_status", [me.token]);
    expect(st.status).toBe("left");
    const rows = (await db.pool.query("select customer_name, customer_id from public.queue_entries where id = $1", [me.entry_id])).rows[0];
    expect(rows).toEqual({ customer_name: "—", customer_id: null });
    expect((await db.pool.query("select count(*)::int as n from public.customers where phone = '01277778888'")).rows[0].n).toBe(0);
    expect((await db.pool.query("select phone from public.message_log where entry_id = $1", [me.entry_id])).rows.every((r) => r.phone === null)).toBe(true);
    expect(await db.rpc(anon, "forget_me", ["nope"])).toBe(false);
  });

  it("purge erases customers not seen for 90 days, never active ones", async () => {
    const s = await db.createShop();
    const old = await join(db, s, { phone: "01011112222" });
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], old.entry_id]); // done
    const active = await join(db, s, { phone: "01033334444" });
    await db.pool.query("update public.customers set last_seen_at = now() - interval '100 days' where shop_id = $1", [s.shopId]);

    const r = await db.rpc<{ customers_erased: number }>(server, "purge_personal_data", [90]);
    expect(r.customers_erased).toBeGreaterThanOrEqual(1);
    const left = (await db.pool.query("select phone from public.customers where shop_id = $1", [s.shopId])).rows.map((x) => x.phone);
    expect(left).toEqual(["01033334444"]); // still waiting: kept
    expect((await personal(s.shopId)).visits).toBe(2); // statistics kept
    expect(active.ticket_no).toBe(2);
  });

  it("a returning customer is 'seen' again; purge is server-only and refuses short periods", async () => {
    const s = await db.createShop();
    await join(db, s, { phone: "01055556666" });
    await db.pool.query("update public.customers set last_seen_at = now() - interval '100 days' where phone = '01055556666'");
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
    const e = (await db.pool.query("select id from public.queue_entries where shop_id = $1", [s.shopId])).rows[0].id;
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], e]);
    await join(db, s, { phone: "01055556666" }); // comes back
    const seen = (await db.pool.query("select last_seen_at > now() - interval '1 minute' as fresh from public.customers where phone = '01055556666'")).rows[0];
    expect(seen.fresh).toBe(true);

    expect(await errorOf(db.rpc(server, "purge_personal_data", [7]))).toBe("invalid_retention");
    expect(await errorOf(db.rpc(user(s.owner), "purge_personal_data", [90]))).toMatch(/permission denied/);
  });
});
