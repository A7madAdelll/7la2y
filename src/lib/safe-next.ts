/** Only same-site relative paths, so a crafted login link cannot redirect to another site. */
export function safeNext(next: string | null | undefined, fallback = "/counter"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
