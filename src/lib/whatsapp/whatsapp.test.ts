import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseStatuses, sendTemplate, toInternational, verifyMetaSignature } from "./meta";
import { runOutbox } from "./outbox";

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

describe("runOutbox", () => {
  it("sends each claimed alert with shop name and ticket, and reports every result", async () => {
    const complete = vi.fn(async () => {});
    const send = vi.fn(async (to: string) => (to === "01000000000" ? { ok: false as const, retry: true, error: "503" } : { ok: true as const, id: "w" }));
    const r = await runOutbox({
      claim: async () => [
        { id: "a", phone: "01012345678", shop_name: "صالون", ticket_no: 14 },
        { id: "b", phone: "01000000000", shop_name: "صالون", ticket_no: 15 },
      ],
      send,
      complete,
    });
    expect(r).toEqual({ claimed: 2, sent: 1, failed: 1 });
    expect(send).toHaveBeenCalledWith("01012345678", ["صالون", "14"]);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
