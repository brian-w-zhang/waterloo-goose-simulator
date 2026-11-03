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

describe("navmesh planner", () => {
  it("characters follow planner waypoints around an obstacle instead of a straight line", () => {
    // a wall along x = 5 from z = -10 to 10: the planner routes via (5, 12)
    const s = new Sim({ seed: 2, planner: (a, b) => (a.x < 5 && b.x > 5 ? [{ x: 5, z: 12 }, b] : [b]) });
    s.addNpc({ id: "w", name: "W", archetype: "normal", home: { x: 0, z: 0 }, routine: [{ x: 10, z: 0 }] });
    let maxZ = 0;
    run(s, 25, () => { maxZ = Math.max(maxZ, s.npcs.get("w")!.pos.z); });
    expect(maxZ).toBeGreaterThan(10);
    expect(Math.hypot(s.npcs.get("w")!.pos.x - 10, s.npcs.get("w")!.pos.z)).toBeLessThan(1);
  });
});

describe("wearables", () => {
  it("bowing with a hard hat in front of a calm person gets it put on the goose", () => {
    const s = new Sim({ seed: 3 });
    s.addNpc({ id: "k", name: "K", archetype: "normal", home: { x: 0, z: 0 } });
    s.addItem({ id: "hardhat_0", name: "a hard hat", kind: "take", weight: "carry", owner: null, homePos: { x: 0.5, z: 1 },
      zone: "z", flags: { wearable: true } });
    s.goose.pos = { x: 0.5, z: 1 };
    expect(s.gooseGrab()).toBe("hardhat_0");
    s.goose.crouched = true;
    run(s, 2);
    expect(s.goose.wearing).toBe("hardhat_0");
    expect(s.goose.holding).toBeNull();
    expect(s.events.some((e) => e.type === "worn")).toBe(true);
    // grab with nothing in reach shakes it off
    s.goose.crouched = false;
    s.goose.pos = { x: 6, z: 6 };
    run(s, 0.1);
    expect(s.gooseGrab()).toBeNull();
    expect(s.goose.wearing).toBeNull();
  });
});
