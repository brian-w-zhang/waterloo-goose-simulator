import { describe, expect, it } from "vitest";
import { Sim } from "../../src/sim/sim";

const DT = 1 / 30;
const run = (s: Sim, sec: number, each?: () => void) => { for (let k = 0; k < sec / DT; k++) { each?.(); s.step(DT); } };

function world() {
  const s = new Sim({ seed: 5 });
  s.addNpc({ id: "a", name: "A", archetype: "normal", home: { x: 0, z: 0 } });
  s.addItem({ id: "broom_0", name: "a broom", kind: "take", weight: "carry", owner: "a", homePos: { x: 0, z: 0 }, zone: "z", flags: {} });
  s.items.get("broom_0")!.heldBy = "a";
  s.npcs.get("a")!.holding = "broom_0";
  return s;
}

describe("tug-of-war, hiding, falls (goose mechanics spec)", () => {
  it("pulling away while tugging wins the item and topples the owner", () => {
    const s = world();
    s.goose.pos = { x: 1, z: 0 };
    s.gooseGrab();
    expect(s.tug).not.toBeNull();
    run(s, 1.5, () => { s.goose.pos = { x: s.goose.pos.x + 0.02, z: 0 }; });
    expect(s.goose.holding).toBe("broom_0");
    expect(s.npcs.get("a")!.state).toBe("fallen");
    expect(s.events.some((e) => e.type === "tug" && e.won)).toBe(true);
  });

  it("not pulling loses the tug and the owner keeps the item", () => {
    const s = world();
    s.goose.pos = { x: 1, z: 0 };
    s.gooseGrab();
    run(s, 3);
    expect(s.goose.holding).toBeNull();
    expect(s.npcs.get("a")!.holding).toBe("broom_0");
    expect(s.events.some((e) => e.type === "tug" && !e.won)).toBe(true);
  });

  it("a goose hiding in a bush is not seen from beyond arm's length", () => {
    const s = world();
    const n = s.npcs.get("a")!;
    n.facing = 0;
    s.goose.pos = { x: 6, z: 0 };
    s.step(DT);
    expect(s.sees(n)).toBe(true);
    s.hideSpots = [{ pos: { x: 6, z: 0 }, r: 0.9 }];
    s.step(DT);
    expect(s.goose.hidden).toBe(true);
    expect(s.sees(n)).toBe(false);
  });

  it("a fallen character gets back up after a moment", () => {
    const s = world();
    s.goose.pos = { x: 1, z: 0 };
    s.gooseGrab();
    run(s, 1.5, () => { s.goose.pos = { x: s.goose.pos.x + 0.02, z: 0 }; });
    s.goose.pos = { x: 40, z: 40 };
    run(s, 3);
    expect(s.npcs.get("a")!.state).not.toBe("fallen");
  });
});
