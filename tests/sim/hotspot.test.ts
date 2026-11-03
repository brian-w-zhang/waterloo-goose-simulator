import { describe, expect, it } from "vitest";
import { Sim, type SimEvent } from "../../src/sim/sim";
import { HOTSPOTS, populate } from "../../src/game/hotspot";

const DT = 1 / 30;

/** Headless task check (doc 03 R-T2): every hotspot task completes along at least one scripted path. */
function play(script: (s: Sim, step: (sec: number) => void) => void) {
  const s = new Sim({ seed: 3 });
  populate(s);
  const step = (sec: number) => { for (let k = 0; k < sec / DT; k++) s.step(DT); };
  script(s, step);
  return s;
}

const done = (s: Sim, hotspot: string, id: string) => {
  const t = HOTSPOTS.find((h) => h.id === hotspot)!.tasks.find((x) => x.id === id)!;
  return s.events.some((e: SimEvent) => t.test(e, s));
};

const at = (s: Sim, npc: string) => ({ ...s.npcs.get(npc)!.pos });

describe("hotspot tasks", () => {
  it("has 30 or more interactables on the green and owned items everywhere", () => {
    const s = new Sim();
    populate(s);
    const green = [...s.items.values()].filter((i) => i.zone === "green");
    expect(green.length).toBeGreaterThanOrEqual(30);
    expect([...s.items.values()].every((i) => i.owner && s.npcs.has(i.owner))).toBe(true);
  });

  it("honk-drop-grab steals the professor's coffee and gets the goose chased", () => {
    const s = play((s, step) => {
      const p = at(s, "green:prof");
      s.goose.pos = { x: p.x + 1.5, z: p.z };
      s.honk();
      step(0.2);
      const c = [...s.items.values()].find((i) => i.name === "the professor's coffee")!;
      s.goose.pos = { ...c.pos };
      s.gooseGrab();
      for (let k = 0; k < 60; k++) { s.goose.pos = { x: s.goose.pos.x + 0.08, z: s.goose.pos.z }; s.goose.speed = 2.4; step(DT); }
    });
    expect(done(s, "green", "drop")).toBe(true);
    expect(done(s, "green", "coffee")).toBe(true);
    expect(done(s, "green", "chase")).toBe(true);
  });

  it("carrying the iron ring box away and dropping it completes the hide task", () => {
    const s = play((s, step) => {
      const box = [...s.items.values()].find((i) => i.name === "an iron ring box")!;
      s.goose.pos = { ...box.pos };
      s.gooseGrab();
      s.goose.pos = { x: box.homePos.x + 40, z: box.homePos.z + 30 };
      step(DT);
      s.gooseRelease();
    });
    expect(done(s, "green", "ring")).toBe(true);
  });

  it("the plaza vendor shoos a goose that hangs around", () => {
    const s = play((s, step) => {
      const v = s.npcs.get("plaza:vendor")!;
      v.facing = 0;
      s.goose.pos = { x: v.home.x + 3, z: v.home.z };
      step(1.5);
    });
    expect(done(s, "plaza", "shoo")).toBe(true);
  });
});
