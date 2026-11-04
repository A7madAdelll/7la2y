// Counter state in one call, and the TV link.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, user } from "./db";

type Counter = {
  shop: { id: string; queue_open: boolean };
  presence: { code: string };
  barbers: { id: string; name: string; serving: { ticket_no: number; services: string[]; called_at: string } | null }[];
  waiting: { ticket_no: number; customer_name: string; services: string[]; is_walk_in: boolean }[];
  default_service_id: string;
};

describe.skipIf(!hasDb)("staff screens", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  it("counter_state returns chairs, waiting list in queue order, services and the code", async () => {
    const s = await db.createShop({ barbers: ["محمد", "كريم"] });
    await join(db, s, { services: [s.service("قصة + دقن"), s.service("فوطة سخنة")] });
    const second = await join(db, s, { name: "مصطفى" });
    await db.rpc(user(s.owner), "staff_add_walk_in", [s.shopId, "زبون", null, [s.service("حلاقة دقن")]]);
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
    await db.rpc(user(s.owner), "queue_reorder", [second.entry_id, null]); // to the end

    const c = await db.rpc<Counter>(user(s.owner), "counter_state", [s.shopId]);
    expect(c.presence.code).toBe(await s.code());
    const chair = c.barbers.find((b) => b.id === s.barberIds[0])!;
    expect(chair.serving?.ticket_no).toBe(1);
    expect(chair.serving?.services.sort()).toEqual(["فوطة سخنة", "قصة + دقن"].sort());
    expect(chair.serving?.called_at).toBeTruthy();
    expect(c.waiting.map((w) => w.customer_name)).toEqual(["زبون", "مصطفى"]);
    expect(c.waiting[0].is_walk_in).toBe(true);
    expect(c.default_service_id).toBeTruthy();
  });

  it("counter_state is staff-only and per shop", async () => {
    const a = await db.createShop();
    const b = await db.createShop();
    expect(await errorOf(db.rpc(user(a.owner), "counter_state", [b.shopId]))).toBe("forbidden");
    expect(await errorOf(db.rpc(anon, "counter_state", [a.shopId]))).toMatch(/permission denied/);
  });

  it("TV link: owner rotates it; the TV sees numbers and code but no names or phones", async () => {
    const s = await db.createShop();
    await join(db, s, { name: "سري جداً", phone: "01099990000" });
    await join(db, s);
    expect(await db.rpc(anon, "tv_board", ["nothing-yet"])).toBeNull();

    const token = await db.rpc<string>(user(s.owner), "rotate_tv_link", [s.shopId]);
    const tv = await db.rpc<{ code: string; next: number[] }>(anon, "tv_board", [token]);
    expect(tv.code).toBe(await s.code());
    expect(tv.next).toEqual([1, 2]);
    expect(JSON.stringify(tv)).not.toMatch(/سري جداً|01099990000/);

    const newer = await db.rpc<string>(user(s.owner), "rotate_tv_link", [s.shopId]);
    expect(await db.rpc(anon, "tv_board", [token])).toBeNull(); // old link stops working
    expect(await db.rpc(anon, "tv_board", [newer])).not.toBeNull();
  });

  it("only the owner can rotate the TV link", async () => {
    const s = await db.createShop();
    const cashier = await db.createUser();
    await db.pool.query("insert into public.shop_members (shop_id, user_id, role) values ($1, $2, 'cashier')", [s.shopId, cashier]);
    expect(await errorOf(db.rpc(user(cashier), "rotate_tv_link", [s.shopId]))).toBe("forbidden");
  });
});
