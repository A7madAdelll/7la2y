// Owner settings go straight to tables through RLS; check what owners and cashiers can change.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, errorOf, hasDb, user } from "./db";

describe.skipIf(!hasDb)("onboarding and owner settings", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  it("an account can create up to 3 shops", async () => {
    const owner = await db.createUser();
    for (let i = 1; i <= 3; i++) await db.rpc(user(owner), "create_shop", [`chain-${i}-${owner.slice(0, 6)}`, `فرع ${i}`, ["men"]]);
    expect(await errorOf(db.rpc(user(owner), "create_shop", [`chain-4-${owner.slice(0, 6)}`, "فرع 4", ["men"]]))).toBe("too_many_shops");
  });

  it("duplicate links and bad names are rejected with clear keys", async () => {
    const owner = await db.createUser();
    const s = await db.createShop();
    expect(await errorOf(db.rpc(user(owner), "create_shop", [s.slug, "محل", ["men"]]))).toBe("slug_taken");
    expect(await errorOf(db.rpc(user(owner), "create_shop", ["ok-link-x", "x", ["men"]]))).toBe("invalid_shop");
  });

  it("owner sets prices, adds barbers and hides services; constraints still apply", async () => {
    const s = await db.createShop();
    const svc = s.service("قصة شعر");
    const upd = await db.as(user(s.owner), (c) => c.query("update public.services set price_egp = 120, minutes = 25 where id = $1", [svc]));
    expect(upd.rowCount).toBe(1);
    await db.as(user(s.owner), (c) => c.query("insert into public.barbers (shop_id, name) values ($1, 'سيد')", [s.shopId]));
    await db.as(user(s.owner), (c) => c.query("update public.services set active = false where id = $1", [s.service("فوطة سخنة")]));
    expect(await errorOf(db.as(user(s.owner), (c) => c.query("update public.services set price_egp = -5 where id = $1", [svc])))).toMatch(/check constraint/);
    const page = await db.rpc<{ services: { name: string; price_egp: number }[]; barbers: unknown[] }>(user(s.owner), "shop_public", [s.slug]);
    expect(page.services.find((x) => x.name === "قصة شعر")?.price_egp).toBe(120);
    expect(page.services.map((x) => x.name)).not.toContain("فوطة سخنة");
    expect(page.barbers.length).toBe(2);
  });

  it("owners cannot touch columns outside the settings form", async () => {
    const s = await db.createShop();
    expect(await errorOf(db.as(user(s.owner), (c) => c.query("update public.services set shop_id = gen_random_uuid() where shop_id = $1", [s.shopId])))).toMatch(/permission denied/);
    expect(await errorOf(db.as(user(s.owner), (c) => c.query("update public.shops set ticket_seq = 0 where id = $1", [s.shopId])))).toMatch(/permission denied/);
  });
});
