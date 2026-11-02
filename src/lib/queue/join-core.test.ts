import { describe, expect, it, vi } from "vitest";
import { performJoin, type JoinDeps } from "./join-core";
import type { JoinInput } from "./types";

const SVC = "11111111-1111-4111-8111-111111111111";
const input: JoinInput = { name: "أحمد", phone: "01012345678", code: "٤٨٢٧", barberId: null, serviceIds: [SVC], wantsAlert: true };

const deps = (over: Partial<JoinDeps> = {}): JoinDeps => ({
  verifyBot: vi.fn(async () => true),
  callJoin: vi.fn(async () => ({ token: "tok", ticket_no: 7 })),
  ...over,
});

describe("performJoin", () => {
  it("verifies the bot token, then calls join_queue with the client IP and normalised code", async () => {
    const d = deps();
    const r = await performJoin({ slug: "salon-1", input, botToken: "t", ip: "1.2.3.4" }, d);
    expect(r).toEqual({ ok: true, token: "tok", ticketNo: 7 });
    expect(d.verifyBot).toHaveBeenCalledWith("t", "1.2.3.4");
    expect(d.callJoin).toHaveBeenCalledWith(expect.objectContaining({ p_client_key: "1.2.3.4", p_code: "4827", p_slug: "salon-1" }));
  });

  it("stops before the database when the bot check fails", async () => {
    const d = deps({ verifyBot: vi.fn(async () => false) });
    expect(await performJoin({ slug: "salon-1", input, botToken: "", ip: "x" }, d)).toEqual({ ok: false, error: "bot_check_failed" });
    expect(d.callJoin).not.toHaveBeenCalled();
  });

  it("rejects malformed requests (tampered browser) before anything else", async () => {
    const d = deps();
    for (const bad of [
      { ...input, serviceIds: ["'; drop table x; --"] },
      { ...input, barberId: "not-a-uuid" },
      { ...input, serviceIds: Array(11).fill(SVC) },
      { ...input, name: 5 as unknown as string },
    ]) {
      expect(await performJoin({ slug: "salon-1", input: bad, botToken: "t", ip: "x" }, d)).toEqual({ ok: false, error: "invalid_request" });
    }
    expect(await performJoin({ slug: "../etc", input, botToken: "t", ip: "x" }, d)).toEqual({ ok: false, error: "invalid_request" });
    expect(d.verifyBot).not.toHaveBeenCalled();
  });

  it("passes soft DB errors through and hides unexpected ones", async () => {
    const soft = deps({ callJoin: vi.fn(async () => ({ error: "bad_code" })) });
    expect(await performJoin({ slug: "salon-1", input, botToken: "t", ip: "x" }, soft)).toEqual({ ok: false, error: "bad_code" });
    const known = deps({ callJoin: vi.fn(async () => { throw new Error("already_in_queue"); }) });
    expect(await performJoin({ slug: "salon-1", input, botToken: "t", ip: "x" }, known)).toEqual({ ok: false, error: "already_in_queue" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const leak = deps({ callJoin: vi.fn(async () => { throw new Error('relation "public.secret" does not exist'); }) });
    expect(await performJoin({ slug: "salon-1", input, botToken: "t", ip: "x" }, leak)).toEqual({ ok: false, error: "unknown" });
    spy.mockRestore();
  });
});
