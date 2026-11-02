import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, nextPhone, user, type Shop } from "./db";

type Status = {
  status: string;
  ticket_no: number;
  ahead: number | null;
  estimated_minutes: number | null;
  services: { name: string; price_egp: number | null; minutes: number }[];
};

describe.skipIf(!hasDb)("queue rules", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  const status = (token: string) => db.rpc<Status>(anon, "entry_status", [token]);
  const next = (s: Shop, barber: string, expected: string | null) =>
    db.rpc<{ result: string; current_entry_id: string | null }>(user(s.owner), "queue_next", [
      barber,
      expected,
    ]);

  it("shows the public shop page without secrets", async () => {
    const s = await db.createShop();
    const page = await db.rpc<Record<string, unknown>>(anon, "shop_public", [s.slug]);
    expect(page.queue_open).toBe(true);
    expect((page.barbers as unknown[]).length).toBe(1);
    expect((page.services as { name: string }[]).map((x) => x.name)).toContain("فوطة سخنة");
    // kinds = men + kids: no women's services seeded
    expect((page.services as { name: string }[]).map((x) => x.name)).not.toContain("سشوار");
    expect(JSON.stringify(page)).not.toMatch(/secret|phone/);
  });

  it("joins with the presence code and reports position, wait and services", async () => {
    const s = await db.createShop();
    const a = await join(db, s, { services: [s.service("قصة + دقن"), s.service("فوطة سخنة")] });
    const b = await join(db, s);
    expect([a.ticket_no, b.ticket_no]).toEqual([1, 2]);

    const sb = await status(b.token);
    expect(sb.status).toBe("waiting");
    expect(sb.ahead).toBe(1);
    expect(sb.estimated_minutes).toBe(40); // 30 + 10 ahead, one barber
    const sa = await status(a.token);
    expect(sa.services.map((x) => x.name).sort()).toEqual(["فوطة سخنة", "قصة + دقن"].sort());
  });

  it("rejects bad input with stable error keys", async () => {
    const s = await db.createShop();
    const other = await db.createShop();
    const real = await s.code();
    const wrong = String((Number(real) + 5000) % 10000).padStart(4, "0");
    expect(await errorOf(join(db, s, { code: wrong }))).toBe("bad_code");
    expect(await errorOf(join(db, s, { phone: "0201234567" }))).toBe("invalid_phone");
    expect(await errorOf(join(db, s, { name: "   " }))).toBe("invalid_name");
    expect(await errorOf(join(db, s, { services: [] }))).toBe("service_required");
    expect(await errorOf(join(db, s, { services: [s.service("فوطة سخنة")] }))).toBe(
      "main_service_required",
    );
    expect(await errorOf(join(db, s, { services: [other.service("قصة شعر")] }))).toBe(
      "invalid_service",
    );
    expect(await errorOf(join(db, s, { barberId: other.barberIds[0] }))).toBe("invalid_barber");

    await db.rpc(user(s.owner), "set_queue_open", [s.shopId, false]);
    expect(await errorOf(join(db, s))).toBe("queue_closed");
  });

  it("normalises Arabic-Indic digits and +20, and allows one active entry per phone", async () => {
    const s = await db.createShop();
    await join(db, s, { phone: "٠١٠٩٩٩٩٨٨٨٧" });
    expect(await errorOf(join(db, s, { phone: "+20 109 999 8887" }))).toBe("already_in_queue");
    const r = await db.pool.query("select phone from public.customers where shop_id = $1", [
      s.shopId,
    ]);
    expect(r.rows).toEqual([{ phone: "01099998887" }]);
  });

  it("serves in order, honours the requested barber, and finishes the previous customer", async () => {
    const s = await db.createShop({ barbers: ["محمد", "كريم"] });
    const [m, k] = s.barberIds;
    const forKarim = await join(db, s, { barberId: k });
    const anyone = await join(db, s);

    const r1 = await next(s, m, null);
    expect(r1.current_entry_id).toBe(anyone.entry_id); // Mohamed skips Karim's customer
    const r2 = await next(s, k, null);
    expect(r2.current_entry_id).toBe(forKarim.entry_id);

    const r3 = await next(s, m, anyone.entry_id);
    expect(r3.current_entry_id).toBeNull();
    expect((await status(anyone.token)).status).toBe("done");
  });

  it("ignores a stale or double 'next' press", async () => {
    const s = await db.createShop();
    const b = s.barberIds[0];
    const e1 = await join(db, s);
    const e2 = await join(db, s);
    await next(s, b, null); // e1 in the chair
    const stale = await next(s, b, null); // second tap with the old screen state
    expect(stale.result).toBe("stale");
    expect((await status(e1.token)).status).toBe("serving");
    expect((await status(e2.token)).status).toBe("waiting");
  });

  it("marks no-shows, lets the customer leave once, and blocks invalid transitions", async () => {
    const s = await db.createShop();
    const e1 = await join(db, s);
    const e2 = await join(db, s);
    await db.rpc(user(s.owner), "queue_no_show", [e1.entry_id]);
    expect((await status(e1.token)).status).toBe("no_show");
    expect(await db.rpc(anon, "leave_queue", [e2.token])).toBe(true);
    expect(await db.rpc(anon, "leave_queue", [e2.token])).toBe(false);
    expect(await db.rpc(anon, "entry_status", ["not-a-token"])).toBeNull();

    const err = await errorOf(
      db.pool.query("update public.queue_entries set status = 'waiting' where id = $1", [
        e1.entry_id,
      ]),
    );
    expect(err).toBe("invalid_transition");
  });

  it("reorders with one row update, and renumbers when the gap runs out", async () => {
    const s = await db.createShop();
    const es = [];
    for (let i = 0; i < 4; i++) es.push(await join(db, s));
    const order = async () =>
      (
        await db.pool.query(
          "select id from public.queue_entries where shop_id = $1 and status = 'waiting' order by position",
          [s.shopId],
        )
      ).rows.map((r) => r.id);

    await db.rpc(user(s.owner), "queue_reorder", [es[3].entry_id, es[0].entry_id]);
    expect(await order()).toEqual([es[3], es[0], es[1], es[2]].map((e) => e.entry_id));

    // Repeatedly squeeze between the same two entries until the gap is exhausted (> 10 halvings).
    for (let i = 0; i < 14; i++) {
      const cur = await order();
      await db.rpc(user(s.owner), "queue_reorder", [cur[cur.length - 1], cur[1]]);
    }
    expect(new Set(await order()).size).toBe(4);

    await db.rpc(user(s.owner), "queue_reorder", [es[3].entry_id, null]);
    expect((await order()).at(-1)).toBe(es[3].entry_id);
  });

  it("restarts ticket numbers on a new local day", async () => {
    const s = await db.createShop();
    await join(db, s);
    // Pretend everything so far happened yesterday.
    await db.pool.query("update public.shops set ticket_day = ticket_day - 1 where id = $1", [
      s.shopId,
    ]);
    await db.pool.query(
      "update public.queue_entries set ticket_day = ticket_day - 1 where shop_id = $1",
      [s.shopId],
    );
    expect((await join(db, s)).ticket_no).toBe(1);
  });

  it("walk-ins get a ticket but no phone and no alert", async () => {
    const s = await db.createShop();
    const id = await db.rpc<string>(user(s.owner), "staff_add_walk_in", [
      s.shopId,
      "زبون",
      null,
      [s.service("قصة أطفال")],
    ]);
    const r = await db.pool.query(
      "select source, customer_id, wants_alert from public.queue_entries where id = $1",
      [id],
    );
    expect(r.rows[0]).toEqual({ source: "walk_in", customer_id: null, wants_alert: false });
  });

  describe("WhatsApp outbox", () => {
    const alerts = async (shopId: string) =>
      (
        await db.pool.query("select entry_id from public.message_log where shop_id = $1", [shopId])
      ).rows.map((r) => r.entry_id);

    it("queues exactly one alert when 2 are ahead, and never a second", async () => {
      const s = await db.createShop();
      const b = s.barberIds[0];
      for (let i = 0; i < 4; i++) await join(db, s);
      const me = await join(db, s, { alert: true, phone: nextPhone() });
      expect(me.wants_alert).toBe(true);
      expect(await alerts(s.shopId)).toEqual([]);

      let current: string | null = null;
      current = (await next(s, b, current)).current_entry_id; // 3 ahead
      expect(await alerts(s.shopId)).toEqual([]);
      current = (await next(s, b, current)).current_entry_id; // 2 ahead -> alert
      expect(await alerts(s.shopId)).toEqual([me.entry_id]);
      current = (await next(s, b, current)).current_entry_id; // 1 ahead
      await next(s, b, current);
      expect(await alerts(s.shopId)).toEqual([me.entry_id]);
    });

    it("does not opt in someone who is already near the front", async () => {
      const s = await db.createShop();
      await join(db, s);
      const me = await join(db, s, { alert: true });
      expect(me.wants_alert).toBe(false);
    });
  });
});
