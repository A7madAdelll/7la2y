// Platform admin: only platform_admins rows; sees every shop; records manual payments.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, user } from "./db";

describe.skipIf(!hasDb)("platform admin", () => {
  let db: TestDb;
  let admin: string;
  beforeAll(async () => {
    db = await TestDb.create();
    admin = await db.createUser();
    await db.pool.query("insert into public.platform_admins (user_id) values ($1)", [admin]);
  });
  afterAll(async () => {
    await db?.drop();
  });

  const shops = (who: string) =>
    db.as(user(who), async (c) => (await c.query("select * from public.admin_shops()")).rows);

  it("shop owners are not admins", async () => {
    const s = await db.createShop();
    expect(await errorOf(shops(s.owner))).toBe("forbidden");
    expect(await errorOf(db.rpc(user(s.owner), "admin_record_payment", [s.shopId, "basic", 300, "instapay", "2026-11-01", "2026-11-30", null]))).toBe("forbidden");
    expect(await db.rpc(user(s.owner), "is_platform_admin")).toBe(false);
  });

  it("admin sees every shop with usage this month, and records a payment", async () => {
    const a = await db.createShop();
    const b = await db.createShop();
    await join(db, a);
    await join(db, a);
    const rows = await shops(admin);
    const ra = rows.find((r) => r.id === a.shopId);
    expect(rows.some((r) => r.id === b.shopId)).toBe(true);
    expect(Number(ra.visits_this_month)).toBe(2);
    expect(ra.sub_status).toBeNull();

    await db.rpc(user(admin), "admin_record_payment", [a.shopId, "basic", 300, "vodafone_cash", "2026-11-01", "2026-11-30", "أول شهر"]);
    const after = (await shops(admin)).find((r) => r.id === a.shopId);
    expect(after.sub_status).toBe("active");
    expect(after.paid_until).toBeTruthy();
    // The owner sees their own subscription through RLS.
    const own = await db.as(user(a.owner), (c) => c.query("select status, amount_egp from public.subscriptions"));
    expect(own.rows).toEqual([{ status: "active", amount_egp: "300.00" }]);
  });

  it("rejects bad payments", async () => {
    const s = await db.createShop();
    expect(await errorOf(db.rpc(user(admin), "admin_record_payment", [s.shopId, "basic", -1, "instapay", "2026-11-01", "2026-11-30", null]))).toBe("invalid_payment");
    expect(await errorOf(db.rpc(user(admin), "admin_record_payment", [s.shopId, "basic", 300, "bitcoin", "2026-11-01", "2026-11-30", null]))).toBe("invalid_payment");
    expect(await errorOf(db.rpc(user(admin), "admin_record_payment", [s.shopId, "basic", 300, "cash", "2026-11-30", "2026-11-01", null]))).toBe("invalid_payment");
  });

  it("admin switches a shop's service off and on; off blocks new joins and walk-ins only", async () => {
    const s = await db.createShop();
    const waiting = await join(db, s);
    expect(await errorOf(db.rpc(user(s.owner), "admin_set_service", [s.shopId, false]))).toBe("forbidden");
    await db.rpc(user(admin), "admin_set_service", [s.shopId, false]);
    expect((await shops(admin)).find((r) => r.id === s.shopId).service_on).toBe(false);
    expect(await errorOf(join(db, s))).toBe("service_suspended");
    expect(await errorOf(db.rpc(user(s.owner), "staff_add_walk_in", [s.shopId, "زبون", null, [s.service("قصة شعر")]]))).toBe("service_suspended");
    // Already waiting: still served.
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
    expect(waiting.entry_id).toBeTruthy();
    await db.rpc(user(admin), "admin_set_service", [s.shopId, true]);
    expect((await shops(admin)).find((r) => r.id === s.shopId).service_on).toBe(true);
    expect((await join(db, s)).entry_id).toBeTruthy();
    expect(await errorOf(db.rpc(user(admin), "admin_set_service", ["00000000-0000-0000-0000-000000000000", false]))).toBe("shop_not_found");
  });

  it("bills only finished haircuts this month (not no-shows or people who left)", async () => {
    const s = await db.createShop();
    const a = await join(db, s);
    const b = await join(db, s);
    const c = await join(db, s);
    const barber = s.barberIds[0];
    await db.rpc(user(s.owner), "queue_next", [barber, null]); // a in chair
    await db.rpc(user(s.owner), "queue_next", [barber, a.entry_id]); // a done, b in chair
    await db.rpc(user(s.owner), "queue_no_show", [b.entry_id]); // b no-show
    await db.rpc(anon, "leave_queue", [c.token]); // c left
    const row = (await shops(admin)).find((r) => r.id === s.shopId);
    expect(Number(row.haircuts_this_month)).toBe(1);
    expect(Number(row.visits_this_month)).toBe(3);
  });
});
