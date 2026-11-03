import { describe, expect, it } from "vitest";
import { MENACE_BASE, Menace } from "../../src/sim/menace";

describe("Menace combo maths (doc 04 section 4)", () => {
  it("reproduces the doc 04 example combo: 2,100 points", () => {
    const m = new Menace();
    m.add("scatter", 0, null, 4);           // 240
    m.add("steal_hand", 1, "guide");        // 75
    m.add("drag_10m", 2, null, 3);          // 15
    m.add("into_water", 3, null);           // 120
    m.add("lose_chaser", 4, "guide");       // 150
    expect(m.multiplier).toBe(3.5);
    expect(m.pending).toBe(2100);
  });

  it("repeats of the same event decay by 0.6^(n-1)", () => {
    const m = new Menace();
    m.add("honk_drop", 0, "a"); m.add("honk_drop", 1, "b"); m.add("honk_drop", 2, "c");
    expect(m.combo.map((c) => c.points)).toEqual([50, 30, 50 * 0.36]);
    expect(m.multiplier).toBe(1.5);
  });

  it("caps one target at 3 scoring events per combo", () => {
    const m = new Menace();
    m.add("honk_wonder", 0, "a"); m.add("honk_drop", 1, "a"); m.add("chase_10s", 2, "a");
    expect(m.add("slapstick", 3, "a")).toBe(0);
    expect(m.combo).toHaveLength(3);
  });

  it("banks after the 4 s window and when a task completes; a bail loses pending points", () => {
    const m = new Menace();
    m.add("honk_drop", 0, "a");
    m.tick(4.5);
    expect(m.banked).toBe(75);
    m.add("steal_hand", 10, "b");
    m.bail();
    expect(m.banked).toBe(75);
    expect(m.lastBail).toBe(Math.round(MENACE_BASE.steal_hand * 1.5));
    m.add("honk_drop", 20, "c");
    m.add("task", 21);
    expect(m.banked).toBe(75 + Math.round((50 + 500) * 2));
  });
});
