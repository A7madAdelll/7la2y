/** Same rule as the shops.slug check: 3–40 chars, a–z 0–9 and "-", not starting/ending with "-". */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Turns what an owner types ("Salon El Nil 2") into a valid link ("salon-el-nil-2"). */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** While typing: same cleanup but keeps a trailing "-" so words can still be separated. */
export function toSlugTyping(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/g, "").slice(0, 40);
}
