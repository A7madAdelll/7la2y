// Outbox worker: claim once, retry safely, never send stale alerts, receipts only move forward.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, server, user, type Shop } from "./db";

type Claimed = { id: string; phone: string; shop_name: string; ticket_no: number; attempts: number };

describe.skipIf(!hasDb)("whatsapp outbox", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  const claim = (limit = 20) =>
    db.as(server, async (c) => (await c.query("select * from public.claim_messages($1)", [limit])).rows as Claimed[]);
  const statusOf = async (id: string) =>
    (await db.pool.query("select status, last_error, attempts from public.message_log where id = $1", [id])).rows[0];

  /** A shop with one opted-in customer who now has 2 ahead (alert queued). */
  async function alerted(): Promise<{ s: Shop; entryId: string }> {
    const s = await db.createShop();
    for (let i = 0; i < 3; i++) await join(db, s);
    const me = await join(db, s, { alert: true, phone: "01155556666" });
    await db.rpc(user(s.owner), "queue_next", [s.barberIds[0], null]);
    return { s, entryId: me.entry_id };
  }

  it("claims each alert once, even with two workers at the same time", async () => {
    await alerted();
    await alerted();
    const [a, b] = await Promise.all([claim(), claim()]);
    const ids = [...a, ...b].map((m) => m.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.concat(b).every((m) => m.phone === "01155556666" && m.shop_name && m.ticket_no === 4)).toBe(true);
    for (const id of ids) await db.rpc(server, "complete_message", [id, true, `wamid.${id}`, null, false]);
  });

  it("retries a transient failure, and gives up after 5 attempts", async () => {
    await alerted();
    const [m] = await claim(1);
    await db.rpc(server, "complete_message", [m.id, false, null, "timeout", true]);
    expect((await statusOf(m.id)).status).toBe("pending");
    await db.pool.query("update public.message_log set attempts = 5, status = 'sending', updated_at = now() - interval '10 minutes' where id = $1", [m.id]);
    await claim();
    expect(await statusOf(m.id)).toMatchObject({ status: "failed" });
  });

  it("does not send if the customer is no longer waiting, or the alert is too old", async () => {
    const { s, entryId } = await alerted();
    await db.rpc(user(s.owner), "queue_cancel", [entryId]);
    const { entryId: old } = await alerted();
    await db.pool.query("update public.message_log set created_at = now() - interval '31 minutes' where entry_id = $1", [old]);
    const claimed = await claim(100);
    const rows = (await db.pool.query("select entry_id, status, last_error from public.message_log where entry_id = any($1)", [[entryId, old]])).rows;
    expect(rows.every((r) => r.status === "failed" && r.last_error === "stale")).toBe(true);
    expect(claimed.map((c) => c.id)).not.toContain(rows[0].id);
  });

  it("delivery receipts only move forward", async () => {
    await alerted();
    const [m] = await claim(1);
    await db.rpc(server, "complete_message", [m.id, true, "wamid.fwd", null, false]);
    await db.rpc(server, "record_message_status", ["wamid.fwd", "read", null]);
    await db.rpc(server, "record_message_status", ["wamid.fwd", "delivered", null]); // late, out of order
    expect((await statusOf(m.id)).status).toBe("read");
  });

  it("worker functions are server-only; monthly counts are owner-only", async () => {
    const { s } = await alerted();
    expect(await errorOf(db.as(anon, (c) => c.query("select * from public.claim_messages(1)")))).toMatch(/permission denied/);
    expect(await errorOf(db.as(user(s.owner), (c) => c.query("select * from public.claim_messages(1)")))).toMatch(/permission denied/);
    const rows = await db.as(user(s.owner), (c) => c.query("select * from public.alerts_per_month($1)", [s.shopId]));
    expect(rows.rows.length).toBe(1);
    const other = await db.createShop();
    expect(await errorOf(db.as(user(other.owner), (c) => c.query("select * from public.alerts_per_month($1)", [s.shopId])))).toBe("forbidden");
  });
});
