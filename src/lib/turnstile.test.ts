import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe("verifyTurnstile", () => {
  it("passes only on an explicit success from Cloudflare", async () => {
    expect(await verifyTurnstile("tok", "secret", "1.1.1.1", reply({ success: true }))).toBe(true);
    expect(await verifyTurnstile("tok", "secret", "1.1.1.1", reply({ success: false }))).toBe(false);
    expect(await verifyTurnstile("tok", "secret", "1.1.1.1", reply({}, false))).toBe(false);
  });
  it("fails closed on empty tokens and network errors", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile("", "secret", "x", f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(await verifyTurnstile("tok", "secret", "x", vi.fn(async () => { throw new Error("offline"); }))).toBe(false);
  });
});
