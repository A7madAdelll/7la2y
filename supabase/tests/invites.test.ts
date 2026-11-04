// Cashier invites: owner-only, email-bound, one use, expiring.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, user } from "./db";

describe.skipIf(!hasDb)("cashier invites", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  it("invited email accepts once and becomes a cashier; others cannot use the link", async () => {
    const s = await db.createShop();
    const token = await db.rpc<string>(user(s.owner), "create_invite", [s.shopId, " Cashier@Example.com "]);
    const stranger = await db.createUser();
    expect(await errorOf(db.rpc(user(stranger, "other@example.com"), "accept_invite", [token]))).toBe("invite_email_mismatch");

    const cashier = await db.createUser();
    expect(await db.rpc(user(cashier, "cashier@example.com"), "accept_invite", [token])).toBe(s.shopId);
    expect(await errorOf(db.rpc(user(cashier, "cashier@example.com"), "accept_invite", [token]))).toBe("invite_invalid");

    // The new cashier can run the counter but not the owner screens.
    await db.rpc(user(cashier), "counter_state", [s.shopId]);
    expect(await errorOf(db.rpc(user(cashier), "create_invite", [s.shopId, "x@example.com"]))).toBe("forbidden");

    const staff = await db.as(user(s.owner), (c) => c.query("select email, role, is_me from public.shop_staff($1)", [s.shopId]));
    expect(staff.rows.map((r) => r.role).sort()).toEqual(["cashier", "owner"]);
    expect(staff.rows.find((r) => r.role === "cashier").email).toBeNull(); // test users have no email row
  });

  it("expired invites fail; owners remove cashiers but never owners", async () => {
    const s = await db.createShop();
    const token = await db.rpc<string>(user(s.owner), "create_invite", [s.shopId, "late@example.com"]);
    await db.pool.query("update public.shop_invites set expires_at = now() - interval '1 minute' where shop_id = $1", [s.shopId]);
    const late = await db.createUser();
    expect(await errorOf(db.rpc(user(late, "late@example.com"), "accept_invite", [token]))).toBe("invite_invalid");

    const cashier = await db.createUser();
    await db.pool.query("insert into public.shop_members (shop_id, user_id, role) values ($1, $2, 'cashier')", [s.shopId, cashier]);
    await db.rpc(user(s.owner), "remove_cashier", [s.shopId, cashier]);
    await db.rpc(user(s.owner), "remove_cashier", [s.shopId, s.owner]); // no-op for owners
    const left = await db.pool.query("select role from public.shop_members where shop_id = $1", [s.shopId]);
    expect(left.rows).toEqual([{ role: "owner" }]);
  });

  it("invites are unreadable from the API, bad emails rejected, other shops forbidden", async () => {
    const a = await db.createShop();
    const b = await db.createShop();
    expect(await errorOf(db.rpc(user(a.owner), "create_invite", [a.shopId, "not-an-email"]))).toBe("invalid_email");
    expect(await errorOf(db.rpc(user(a.owner), "create_invite", [b.shopId, "x@example.com"]))).toBe("forbidden");
    expect(await errorOf(db.as(user(a.owner), (c) => c.query("select * from public.shop_invites")))).toMatch(/permission denied/);
    expect(await errorOf(db.as(anon, (c) => c.query("select public.accept_invite('x')")))).toMatch(/permission denied/);
  });

  it("tv_board now carries the shop link for the QR code", async () => {
    const s = await db.createShop();
    const token = await db.rpc<string>(user(s.owner), "rotate_tv_link", [s.shopId]);
    expect((await db.rpc<{ slug: string }>(anon, "tv_board", [token])).slug).toBe(s.slug);
  });
});
