import { describe, expect, it } from "vitest";
import { SLUG_RE, toSlug, toSlugTyping } from "./slug";

describe("toSlug", () => {
  it("makes a valid shop link from what owners type", () => {
    expect(toSlug("Salon El Nil 2")).toBe("salon-el-nil-2");
    expect(toSlug("  --Ahmed's   Barber--  ")).toBe("ahmed-s-barber");
    expect(SLUG_RE.test(toSlug("Salon El Nil 2"))).toBe(true);
  });
  it("drops Arabic letters (links are latin only), leaving the rest", () => {
    expect(toSlug("صالون nile")).toBe("nile");
    expect(toSlug("صالون")).toBe("");
  });
});

describe("toSlugTyping", () => {
  it("lets owners type word by word", () => {
    let v = "";
    for (const ch of "Salon El Nil") v = toSlugTyping(v + ch);
    expect(v).toBe("salon-el-nil");
    expect(toSlugTyping("salon ")).toBe("salon-");
  });
});
