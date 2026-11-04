import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseInbound, parseStatuses, sendTemplate, sendText, toInternational, verifyMetaSignature } from "./meta";
import { confirmText, publicOrigin, runOutbox } from "./outbox";

const cfg = { token: "t", phoneNumberId: "123", template: "queue_near_turn", language: "ar" };
const res = (status: number, body: unknown) => vi.fn(async () => ({ ok: status < 300, status, json: async () => body }) as Response);

describe("sendTemplate", () => {
  it("sends the template to the international number with body parameters", async () => {
    const f = res(200, { messages: [{ id: "wamid.1" }] });
    expect(await sendTemplate(cfg, "01012345678", ["صالون", "14"], f)).toEqual({ ok: true, id: "wamid.1" });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.to).toBe("201012345678");
    expect(body.template.components[0].parameters).toEqual([{ type: "text", text: "صالون" }, { type: "text", text: "14" }]);
  });
  it("retries rate limits and server errors, not bad requests", async () => {
    expect(await sendTemplate(cfg, "01012345678", [], res(429, {}))).toMatchObject({ ok: false, retry: true });
    expect(await sendTemplate(cfg, "01012345678", [], res(503, {}))).toMatchObject({ ok: false, retry: true });
    expect(await sendTemplate(cfg, "01012345678", [], res(400, { error: { code: 131026, message: "undeliverable" } }))).toMatchObject({ ok: false, retry: false });
    expect(await sendTemplate(cfg, "01012345678", [], vi.fn(async () => { throw new TypeError("fetch failed"); }))).toMatchObject({ ok: false, retry: true });
    expect(await sendTemplate(cfg, "123", [], res(200, {}))).toEqual({ ok: false, retry: false, error: "invalid_phone" });
  });
  it("only accepts Egyptian mobiles", () => {
    expect(toInternational("01512345678")).toBe("201512345678");
    expect(() => toInternational("+201012345678")).toThrow();
  });
});

describe("webhook", () => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [
    { id: "wamid.1", status: "delivered" }, { id: "wamid.2", status: "read" },
    { id: "wamid.3", status: "failed", errors: [{ title: "Number not on WhatsApp" }] }, { id: "wamid.4", status: "sent" },
  ] } }] }] });
  const sig = "sha256=" + createHmac("sha256", "app-secret").update(body).digest("hex");

  it("accepts only bodies signed with the app secret", () => {
    expect(verifyMetaSignature(body, sig, "app-secret")).toBe(true);
    expect(verifyMetaSignature(body + " ", sig, "app-secret")).toBe(false);
    expect(verifyMetaSignature(body, sig, "other-secret")).toBe(false);
    expect(verifyMetaSignature(body, null, "app-secret")).toBe(false);
    expect(verifyMetaSignature(body, "sha256=zz", "app-secret")).toBe(false);
  });
  it("extracts delivered / read / failed updates and ignores the rest", () => {
    expect(parseStatuses(JSON.parse(body))).toEqual([
      { id: "wamid.1", status: "delivered", error: undefined },
      { id: "wamid.2", status: "read", error: undefined },
      { id: "wamid.3", status: "failed", error: "Number not on WhatsApp" },
    ]);
    expect(parseStatuses({ junk: true })).toEqual([]);
  });
});

describe("inbound messages and text replies", () => {
  it("reads customers' text messages and ignores everything else", () => {
    const body = { entry: [{ changes: [{ value: { messages: [
      { from: "201012345678", type: "text", text: { body: "تأكيد دوري في صالون: K7Q2M9" } },
      { from: "201012345678", type: "image", image: {} },
      { from: "not-a-number", type: "text", text: { body: "x" } },
    ], statuses: [{ id: "w", status: "read" }] } }] }] };
    expect(parseInbound(body)).toEqual([{ from: "201012345678", text: "تأكيد دوري في صالون: K7Q2M9" }]);
    expect(parseInbound(null)).toEqual([]);
  });
  it("sends a free-form text with link preview", async () => {
    const f = res(200, { messages: [{ id: "wamid.t" }] });
    expect(await sendText(cfg, "01012345678", "hi", f)).toEqual({ ok: true, id: "wamid.t" });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ to: "201012345678", type: "text", text: { body: "hi", preview_url: true } });
  });
});

describe("runOutbox", () => {
  const base = { id: "a", phone: "01012345678", shop_name: "صالون", ticket_no: 14, payload: null, services: [] as string[] };
  const deps = (over = {}) => ({
    claim: async () => [] as never[],
    sendTemplate: vi.fn(async () => ({ ok: true as const, id: "t" })),
    sendText: vi.fn(async () => ({ ok: true as const, id: "x" })),
    complete: vi.fn(async () => {}),
    origin: "https://7la2y.example",
    ...over,
  });

  it("near-turn alerts use the template with shop and ticket", async () => {
    const d = deps({ claim: async () => [{ ...base, kind: "near_turn" as const }] });
    expect(await runOutbox(d)).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(d.sendTemplate).toHaveBeenCalledWith("01012345678", ["صالون", "14"]);
    expect(d.sendText).not.toHaveBeenCalled();
  });

  it("confirm replies are free-form text with ticket, order and the queue link", async () => {
    const d = deps({ claim: async () => [{ ...base, kind: "confirm" as const, payload: { token: "abc" }, services: ["قصة شعر", "شاي"] }] });
    await runOutbox(d);
    const [to, text] = (d.sendText.mock.calls[0] as unknown as [string, string]);
    expect(to).toBe("01012345678");
    expect(text).toBe("تم تأكيد رقمك في صالون.\nرقمك في الدور: 14\nطلبك: قصة شعر + شاي\nتابع دورك من هنا: https://7la2y.example/t/abc");
  });

  it("without a public site URL the confirm reply is not sent (no broken link)", async () => {
    const d = deps({ origin: null, claim: async () => [{ ...base, kind: "confirm" as const, payload: { token: "abc" } }] });
    expect(await runOutbox(d)).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(d.complete).toHaveBeenCalledWith("a", { ok: false, retry: false, error: "no_site_url" });
  });

  it("links point at the fixed site URL, else Vercel's production domain", () => {
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: "https://7la2y.com/" })).toBe("https://7la2y.com");
    expect(publicOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "7la2y.vercel.app" })).toBe("https://7la2y.vercel.app");
    expect(publicOrigin({})).toBeNull();
    expect(confirmText({ shop_name: "س", ticket_no: 1, services: [] }, "L")).not.toContain("طلبك");
  });
});
