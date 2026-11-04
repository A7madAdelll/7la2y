import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEnvelope, parseDsn, redactPath, reportError } from "./error-report";

describe("error reporting", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("parses a Sentry DSN into the envelope endpoint", () => {
    expect(parseDsn("https://abc123@o1.ingest.de.sentry.io/4507")).toEqual({
      endpoint: "https://o1.ingest.de.sentry.io/api/4507/envelope/",
      publicKey: "abc123",
    });
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o1.ingest.sentry.io/4507")).toBeNull(); // no key
  });

  it("masks ticket, TV and invite tokens and login codes", () => {
    const t = "a".repeat(48);
    expect(redactPath(`/t/${t}`)).toBe("/t/[token]");
    expect(redactPath(`/tv/${t}?x=1`)).toBe("/tv/[token]?x=1");
    expect(redactPath(`/invite/${t}`)).toBe("/invite/[token]");
    expect(redactPath("/auth/callback?code=secret123&next=/counter")).toBe("/auth/callback?code=[redacted]&next=/counter");
    expect(redactPath("/salon-el-nil")).toBe("/salon-el-nil");
  });

  it("builds an envelope with the error and redacted path, never headers", () => {
    const err = Object.assign(new Error(`boom at /t/${"b".repeat(48)}`), { digest: "123" });
    const env = buildEnvelope(err, { method: "GET", path: `/t/${"b".repeat(48)}`, routePath: "/t/[token]", routeType: "render" }, {});
    const [header, item, event] = env.trim().split("\n").map((l) => JSON.parse(l));
    expect(item).toEqual({ type: "event" });
    expect(header.event_id).toBe(event.event_id);
    expect(event.exception.values[0]).toEqual({ type: "Error", value: "boom at /t/[token]" });
    expect(event.request).toEqual({ method: "GET", url: "/t/[token]" });
    expect(event.tags).toMatchObject({ route: "/t/[token]", route_type: "render", digest: "123" });
    expect(env).not.toMatch(/b{48}|cookie|authorization/i);
  });

  it("does nothing without a DSN, and never throws when sending fails", async () => {
    const f = vi.fn(async () => { throw new Error("offline"); });
    expect(await reportError(new Error("x"), {}, f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    vi.stubEnv("SENTRY_DSN", "https://k@o1.ingest.sentry.io/1");
    expect(await reportError(new Error("x"), {}, f)).toBe(false);
    const ok = vi.fn(async () => ({ ok: true }) as Response);
    expect(await reportError(new Error("x"), {}, ok)).toBe(true);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://o1.ingest.sentry.io/api/1/envelope/");
    expect((init.headers as Record<string, string>)["X-Sentry-Auth"]).toContain("sentry_key=k");
  });
});
