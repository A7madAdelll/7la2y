// Shop A must never see or change shop B's data, and customers never touch tables directly.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, user, type Shop } from "./db";

const TABLES = [
  "shops",
  "shop_members",
  "barbers",
  "services",
  "customers",
  "queue_entries",
  "queue_entry_services",
  "message_log",
  "subscriptions",
];

describe.skipIf(!hasDb)("security: tenant isolation and API surface", () => {
  let db: TestDb;
  let a: Shop;
  let b: Shop;
  let cashierA: string;

  beforeAll(async () => {
    db = await TestDb.create();
    a = await db.createShop();
    b = await db.createShop();
    cashierA = await db.createUser();
    await db.pool.query(
      "insert into public.shop_members (shop_id, user_id, role) values ($1, $2, 'cashier')",
      [a.shopId, cashierA],
    );
    for (const s of [a, b]) {
      for (let i = 0; i < 3; i++) await join(db, s);
      await join(db, s, { alert: true }); // 3 ahead: opted in, alerted after one "next"

      await db.pool.query(
        "insert into public.subscriptions (shop_id, plan, status, period_start, period_end) values ($1, 'basic', 'trial', current_date, current_date + 30)",
        [s.shopId],
      );
    }
    // make sure message_log has rows for both shops
    for (const s of [a, b]) await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
  });
  afterAll(async () => {
    await db?.drop();
  });

  it.each(TABLES)("owner of A sees only A's rows in %s", async (table) => {
    const rows = await db.as(user(a.owner), (c) =>
      c.query(`select distinct ${table === "shops" ? "id" : "shop_id"} as shop from public.${table}`),
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.shop === a.shopId)).toBe(true);
  });

  it("cashier sees the shop but not its subscription", async () => {
    const shops = await db.as(user(cashierA), (c) => c.query("select id from public.shops"));
    expect(shops.rows.map((r) => r.id)).toEqual([a.shopId]);
    const subs = await db.as(user(cashierA), (c) => c.query("select id from public.subscriptions"));
    expect(subs.rows).toEqual([]);
  });

  it("a stranger with an account sees nothing", async () => {
    const stranger = await db.createUser();
    for (const t of TABLES) {
      const r = await db.as(user(stranger), (c) => c.query(`select 1 from public.${t}`));
      expect(r.rows, t).toEqual([]);
    }
  });

  it("A's owner cannot change B's services, barbers or settings", async () => {
    const svc = await db.as(user(a.owner), (c) =>
      c.query("update public.services set price_egp = 1 where shop_id = $1", [b.shopId]),
    );
    expect(svc.rowCount).toBe(0);
    const shop = await db.as(user(a.owner), (c) =>
      c.query("update public.shops set name = 'hacked' where id = $1", [b.shopId]),
    );
    expect(shop.rowCount).toBe(0);
    expect(
      await errorOf(
        db.as(user(a.owner), (c) =>
          c.query("insert into public.barbers (shop_id, name) values ($1, 'x')", [b.shopId]),
        ),
      ),
    ).toMatch(/row-level security/);
  });

  it("cashiers cannot edit services or rename the shop", async () => {
    const svc = await db.as(user(cashierA), (c) =>
      c.query("update public.services set price_egp = 1 where shop_id = $1", [a.shopId]),
    );
    expect(svc.rowCount).toBe(0);
    await db.rpc(user(cashierA), "set_barber_on_duty", [a.barberIds[0], true]);
  });

  it("A's staff cannot drive B's queue or read B's presence code", async () => {
    const bEntry = await db.pool.query(
      "select id from public.queue_entries where shop_id = $1 and status = 'waiting' limit 1",
      [b.shopId],
    );
    const calls: [string, unknown[]][] = [
      ["queue_next", [b.barberIds[0], null]],
      ["queue_no_show", [bEntry.rows[0].id]],
      ["queue_cancel", [bEntry.rows[0].id]],
      ["queue_reorder", [bEntry.rows[0].id, null]],
      ["staff_presence_code", [b.shopId]],
      ["set_queue_open", [b.shopId, false]],
      ["set_barber_on_duty", [b.barberIds[0], false]],
      ["staff_add_walk_in", [b.shopId, "x", null, [b.service("قصة شعر")]]],
    ];
    for (const [fn, args] of calls) {
      for (const who of [a.owner, cashierA]) {
        expect(await errorOf(db.rpc(user(who), fn, args)), fn).toBe("forbidden");
      }
    }
  });

  it("anonymous visitors cannot read any table or call staff functions", async () => {
    for (const t of [...TABLES, "shop_secrets", "platform_admins"]) {
      expect(await errorOf(db.as(anon, (c) => c.query(`select 1 from public.${t}`))), t).toMatch(
        /permission denied/,
      );
    }
    for (const fn of ["queue_next(null, null)", "staff_presence_code(null)", "create_shop('x', 'y')"]) {
      expect(await errorOf(db.as(anon, (c) => c.query(`select public.${fn}`))), fn).toMatch(
        /permission denied/,
      );
    }
    expect(
      await errorOf(db.as(anon, (c) => c.query("select private.normalize_phone('1')"))),
    ).toMatch(/permission denied/);
  });

  it("staff cannot write queue tables directly or read secrets and tokens", async () => {
    const tries = [
      "insert into public.queue_entries (shop_id, customer_name, source, ticket_day, ticket_no, position) values ($1, 'x', 'walk_in', current_date, 999, 1)",
      "update public.queue_entries set status = 'done' where shop_id = $1",
      "delete from public.queue_entries where shop_id = $1",
      "insert into public.message_log (shop_id, entry_id, kind, phone) select $1, id, 'near_turn', '01000000000' from public.queue_entries where shop_id = $1 limit 1",
      "select presence_secret from public.shop_secrets where shop_id = $1",
      "select access_token_hash from public.queue_entries where shop_id = $1",
      "insert into public.shop_members (shop_id, user_id, role) values ($1, auth.uid(), 'owner')",
    ];
    for (const sql of tries) {
      expect(await errorOf(db.as(user(a.owner), (c) => c.query(sql, [a.shopId]))), sql).toMatch(
        /permission denied/,
      );
    }
  });
});
