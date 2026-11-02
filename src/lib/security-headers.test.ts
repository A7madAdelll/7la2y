import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const csp = (h: { key: string; value: string }[]) => h.find((x) => x.key === "Content-Security-Policy")!.value;

describe("securityHeaders", () => {
  it("allows only our Supabase project (https + realtime wss) and Turnstile", () => {
    const c = csp(securityHeaders({ supabaseUrl: "https://abc.supabase.co", dev: false }));
    expect(c).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co https://challenges.cloudflare.com");
    expect(c).toContain("frame-ancestors 'none'");
    expect(c).toContain("object-src 'none'");
    expect(c).not.toContain("unsafe-eval");
  });
  it("falls back to any Supabase project when the URL is not known at build time", () => {
    expect(csp(securityHeaders({ dev: false }))).toContain("wss://*.supabase.co");
  });
  it("sends HSTS", () => {
    expect(securityHeaders({ dev: false }).some((h) => h.key === "Strict-Transport-Security")).toBe(true);
  });
});
