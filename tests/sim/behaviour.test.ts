import { describe, expect, it } from "vitest";
import { Sim } from "../../src/sim/sim";

const DT = 1 / 30;

function world() {
  const s = new Sim({ seed: 7 });
  s.addNpc({ id: "prof", name: "Prof", archetype: "normal", home: { x: 0, z: 0 } });
  s.addItem({ id: "coffee", name: "coffee cup", kind: "take", weight: "carry", owner: "prof", homePos: { x: 1, z: 0 }, zone: "green", flags: {} });
  return s;
}

const run = (s: Sim, seconds: number, each?: () => void) => {
  for (let k = 0; k < seconds / DT; k++) { each?.(); s.step(DT); }
};

describe("smart NPC behaviour (doc 06 M2)", () => {
  it("notices the goose with its item inside the vision cone, not behind its back", () => {
    const s = world();
    const prof = s.npcs.get("prof")!;
    prof.facing = 0;                       // looking along +x
    // home the cup beyond the 8 m item check so only vision can trigger the notice
    s.items.get("coffee")!.homePos = { x: 30, z: 0 };
    s.items.get("coffee")!.pos = { x: 30, z: 0 };
    s.goose.pos = { x: 30, z: 0 };
    s.gooseGrab();
    s.goose.pos = { x: -10, z: 0 };        // behind, beyond peripheral range
    run(s, 0.5);
    expect(s.events.some((e) => e.type === "noticed" && e.what === "item_stolen")).toBe(false);
    s.goose.pos = { x: 10, z: 1 };         // in front, inside the 110 degree cone and 18 m
    prof.facing = 0;
    run(s, 0.2);
    expect(s.events.some((e) => e.type === "noticed" && e.what === "item_stolen")).toBe(true);
  });

  it("investigates a honk heard from afar", () => {
    const s = world();
    s.goose.pos = { x: 15, z: 5 };
    s.honk();
    expect(s.npcs.get("prof")!.mark).toBe("?");
    run(s, 4);
    const p = s.npcs.get("prof")!;
    expect(["investigate", "giveup", "routine"]).toContain(p.state);
    expect(Math.hypot(p.pos.x, p.pos.z)).toBeGreaterThan(2);  // walked toward the honk
  });

  it("drops the held item when honked at up close", () => {
    const s = world();
    const p = s.npcs.get("prof")!;
    s.items.get("coffee")!.heldBy = "prof";
    p.holding = "coffee";
    s.goose.pos = { x: 2, z: 0 };
    s.honk();
    expect(p.holding).toBeNull();
    expect(p.mark).toBe("!");
    expect(s.events.some((e) => e.type === "drop" && e.item === "coffee")).toBe(true);
  });

  it("chases the goose that holds its item", () => {
    const s = world();
    s.goose.pos = { x: 1, z: 0 };
    s.gooseGrab();
    s.goose.pos = { x: 6, z: 0 };
    s.goose.speed = 3;
    run(s, 1.5);
    expect(s.npcs.get("prof")!.state).toBe("chase");
    expect(s.events.some((e) => e.type === "chase")).toBe(true);
  });

  it("gives up the chase after the timeout", () => {
    const s = world();
    s.goose.pos = { x: 1, z: 0 };
    s.gooseGrab();
    const p = s.npcs.get("prof")!;
    p.speedRun = 1;                         // slower than the fleeing goose
    run(s, 20, () => { s.goose.pos = { x: p.pos.x + 6, z: 0 }; s.goose.speed = 1; });
    expect(s.events.some((e) => e.type === "giveup" && e.npc === "prof")).toBe(true);
  });

  it("finds a dropped item and returns it to its home position", () => {
    const s = world();
    s.goose.pos = { x: 1, z: 0 };
    s.gooseGrab();
    s.goose.pos = { x: 5, z: 3 };
    s.step(DT);
    s.gooseRelease();                       // item left 5 m from home
    s.goose.pos = { x: 60, z: 60 };         // goose leaves
    run(s, 25);
    expect(s.events.some((e) => e.type === "returned" && e.item === "coffee")).toBe(true);
    const c = s.items.get("coffee")!;
    expect(Math.hypot(c.pos.x - 1, c.pos.z)).toBeLessThan(0.01);
  });

  it("is deterministic for a seed and an input log", () => {
    const play = () => {
      const s = world();
      s.goose.pos = { x: 1, z: 0 };
      s.gooseGrab();
      run(s, 5, () => { s.goose.pos = { x: s.goose.pos.x + 0.05, z: 0.5 }; s.goose.speed = 1.5; });
      return JSON.stringify([...s.npcs.values()].map((n) => [n.pos, n.state]));
    };
    expect(play()).toBe(play());
  });
});
