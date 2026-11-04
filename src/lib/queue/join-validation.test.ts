import { describe, expect, it } from "vitest";
import { summarize, validateJoin } from "./join-validation";
import type { JoinInput, PublicService } from "./types";

const services: PublicService[] = [
  { id: "cut", name: "قصة شعر", category: "men", kind: "main", price_egp: 100, minutes: 20 },
  { id: "towel", name: "فوطة سخنة", category: "men", kind: "extra", price_egp: 30, minutes: 10 },
  { id: "mask", name: "ماسك وش", category: "men", kind: "extra", price_egp: null, minutes: 15 },
  { id: "tea", name: "شاي", category: "men", kind: "hospitality", price_egp: 0, minutes: 0 },
];
const ok: JoinInput = { name: "أحمد", phone: "٠١٠٩٩٩٩٨٨٨٧", code: "٤٨٢٧", barberId: null, serviceIds: ["cut"], wantsAlert: false };

describe("validateJoin", () => {
  it("accepts a valid form, including Arabic digits", () => {
    expect(validateJoin(ok, services)).toEqual({});
  });
  it("flags each field with the database's error key", () => {
    expect(validateJoin({ ...ok, name: "  ", phone: "123", code: "12", serviceIds: [] }, services)).toEqual({
      name: "invalid_name",
      phone: "invalid_phone",
      code: "bad_code",
      services: "service_required",
    });
  });
  it("requires a main service, not only extras or tea", () => {
    expect(validateJoin({ ...ok, serviceIds: ["towel"] }, services).services).toBe("main_service_required");
    expect(validateJoin({ ...ok, serviceIds: ["tea"] }, services).services).toBe("main_service_required");
    expect(validateJoin({ ...ok, serviceIds: ["cut", "tea"] }, services)).toEqual({});
  });
  it("skips the code when the shop switched it off", () => {
    expect(validateJoin({ ...ok, code: "" }, services, false)).toEqual({});
    expect(validateJoin({ ...ok, code: "" }, services, true).code).toBe("bad_code");
  });
});

describe("summarize", () => {
  it("adds minutes and prices", () => {
    expect(summarize(["cut", "towel"], services)).toEqual({ minutes: 30, price: 130, count: 2 });
  });
  it("hides the total when any price is not set", () => {
    expect(summarize(["cut", "mask"], services).price).toBeNull();
  });
});
