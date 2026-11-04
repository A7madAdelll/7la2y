import "server-only";
import { headers } from "next/headers";

/**
 * Public origin for links printed in QR codes. NEXT_PUBLIC_SITE_URL wins (set it once the domain
 * exists, so printed posters never point at a preview URL); otherwise the current request's host.
 */
export async function siteOrigin(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
