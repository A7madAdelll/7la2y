import { describe, expect, it } from "vitest";
import { amountDue, PRICE_PER_HAIRCUT_EGP } from "./billing";

describe("billing", () => {
  it("charges the per-haircut price for finished haircuts", () => {
    expect(PRICE_PER_HAIRCUT_EGP).toBe(1);
    expect(amountDue(371)).toBe(371);
    expect(amountDue(0)).toBe(0);
    expect(amountDue(-3)).toBe(0);
  });
});
