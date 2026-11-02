import { describe, expect, it } from "vitest";
import { demoReducer } from "./demo-store";
import { sampleCounter } from "./sample";

describe("demo counter reducer (mirrors the DB rules)", () => {
  it("next: finishes current, takes the first waiting customer this barber can serve", () => {
    const s0 = sampleCounter(); // q13 anyone, q14 wants Karim (b2)
    const s1 = demoReducer(s0, { type: "next", barberId: "b1", expectedCurrent: "q12" });
    expect(s1.barbers[0].serving?.id).toBe("q13");
    const s2 = demoReducer(s1, { type: "next", barberId: "b1", expectedCurrent: "q13" });
    expect(s2.barbers[0].serving?.id).toBe("q15"); // skips q14, who asked for Karim
  });
  it("next: ignores a stale double tap", () => {
    const s0 = sampleCounter();
    const s1 = demoReducer(s0, { type: "next", barberId: "b1", expectedCurrent: "q12" });
    expect(demoReducer(s1, { type: "next", barberId: "b1", expectedCurrent: "q12" })).toBe(s1);
  });
  it("move and walk-in", () => {
    const s0 = sampleCounter();
    const moved = demoReducer(s0, { type: "move", entryId: "q14", delta: -1 });
    expect(moved.waiting.map((e) => e.id).slice(0, 2)).toEqual(["q14", "q13"]);
    const w = demoReducer(s0, { type: "walk_in", name: "زبون", service: "قصة شعر" });
    expect(w.waiting.at(-1)?.ticket_no).toBe(18);
  });
});

import { tvFromCounter } from "./tv-from-counter";

describe("tvFromCounter (mirrors tv_board)", () => {
  it("shows chairs and the next 5 ticket numbers, never names", () => {
    const tv = tvFromCounter(sampleCounter());
    expect(tv.barbers).toEqual([{ name: "محمد", serving_ticket: 12 }, { name: "كريم", serving_ticket: 11 }]);
    expect(tv.next).toEqual([13, 14, 15, 16, 17]);
    expect(JSON.stringify(tv)).not.toMatch(/أحمد|مصطفى|حسن/);
  });
});
