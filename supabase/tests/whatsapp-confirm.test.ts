// "Confirm on WhatsApp": the sender's own number proves ownership; one reply with the link.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, anon, errorOf, hasDb, join, server, user } from "./db";

type Claimed = { id: string; kind: string; phone: string; ticket_no: number; payload: { token?: string } | null; services: string[] };

describe.skipIf(!hasDb)("whatsapp confirm", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  const claim = () => db.as(server, async (c) => (await c.query("select * from public.claim_messages(50)")).rows as Claimed[]);
  const confirm = (from: string, text: string) => db.rpc<{ result: string }>(server, "confirm_whatsapp", [from, text]);

  it("customer sends the code from their own number: confirmed, one reply with link and order queued", async () => {
    const s = await db.createShop();
    const me = await join(db, s, { phone: "01012340001", services: [s.service("قصة شعر"), s.service("فوطة سخنة")] });
    const { code } = await db.rpc<{ code: string }>(anon, "request_whatsapp_confirm", [me.token]);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    expect((await confirm("201012340001", `تأكيد دوري في صالون تجربة: ${code}`)).result).toBe("ok");
    expect((await db.rpc<{ whatsapp_confirmed: boolean }>(anon, "entry_status", [me.token])).whatsapp_confirmed).toBe(true);

    const msgs = (await claim()).filter((m) => m.kind === "confirm" && m.phone === "01012340001");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].payload?.token).toBe(me.token); // link back to the same ticket
    expect(msgs[0].services.sort()).toEqual(["فوطة سخنة", "قصة شعر"].sort());

    // Sending is done: the link token is erased everywhere.
    await db.rpc(server, "complete_message", [msgs[0].id, true, "wamid.c1", null, false]);
    const left = await db.pool.query(
      `select (select payload from public.message_log where id = $1) as payload,
              (select link_token from public.whatsapp_confirmations where entry_id = $2) as link`, [msgs[0].id, me.entry_id]);
    expect(left.rows[0]).toEqual({ payload: null, link: null });

    // Sending the same code again does nothing more.
    expect((await confirm("201012340001", code)).result).toBe("unknown_code");
    expect(await db.rpc(anon, "request_whatsapp_confirm", [me.token])).toEqual({ already: true });
  });

  it("someone else's code from another number is ignored", async () => {
    const s = await db.createShop();
    const victim = await join(db, s, { phone: "01012340002" });
    const { code } = await db.rpc<{ code: string }>(anon, "request_whatsapp_confirm", [victim.token]);
    expect((await confirm("201099999999", code)).result).toBe("phone_mismatch");
    expect((await db.rpc<{ whatsapp_confirmed: boolean }>(anon, "entry_status", [victim.token])).whatsapp_confirmed).toBe(false);
    // the real owner can still confirm afterwards
    expect((await confirm("201012340002", code)).result).toBe("ok");
  });

  it("expired codes, messages without a code, and finished visits do not confirm", async () => {
    const s = await db.createShop();
    const a = await join(db, s, { phone: "01012340003" });
    const { code } = await db.rpc<{ code: string }>(anon, "request_whatsapp_confirm", [a.token]);
    await db.pool.query("update public.whatsapp_confirmations set expires_at = now() - interval '1 minute' where entry_id = $1", [a.entry_id]);
    expect((await confirm("201012340003", code)).result).toBe("unknown_code");
    expect((await confirm("201012340003", "السلام عليكم")).result).toBe("no_code");
    // asking again gives a fresh code that works
    const again = await db.rpc<{ code: string }>(anon, "request_whatsapp_confirm", [a.token]);
    expect(again.code).toBeTruthy();

    await db.rpc(anon, "leave_queue", [a.token]);
    expect(await errorOf(db.rpc(anon, "request_whatsapp_confirm", [a.token]))).toBe("not_active");
    expect((await confirm("201012340003", again.code)).result).toBe("not_active");
  });

  it("walk-ins have no phone to confirm; the webhook function is server-only", async () => {
    const s = await db.createShop();
    expect(await errorOf(db.as(anon, (c) => c.query("select public.confirm_whatsapp('2010', 'X')")))).toMatch(/permission denied/);
    expect(await errorOf(db.as(user(s.owner), (c) => c.query("select public.confirm_whatsapp('2010', 'X')")))).toMatch(/permission denied/);
    expect(await errorOf(db.as(anon, (c) => c.query("select * from public.whatsapp_confirmations")))).toMatch(/permission denied/);
  });
});
