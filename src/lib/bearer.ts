import { timingSafeEqual } from "node:crypto";

/** Constant-time check of "Authorization: Bearer <secret>". Missing secret = always false. */
export function hasBearer(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
