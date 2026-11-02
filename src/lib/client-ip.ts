/**
 * Client IP for rate limiting. On Vercel, x-real-ip / x-forwarded-for are set by the platform's
 * edge, not by the client (re-verify after the first deploy). Falls back to "unknown" so a
 * missing header is limited as one shared bucket rather than skipped.
 */
export function clientIpFrom(h: Pick<Headers, "get">): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 100);
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 100);
  return "unknown";
}
