/**
 * Deterministic game simulation (doc 05): items with owners and home positions, smart NPCs with a
 * hierarchical state machine, perception (vision cone, peripheral, hearing) and memory. Pure
 * TypeScript on 2D ground positions (x, z): no rendering and no network, so it runs headless in tests.
 */

export type V2 = { x: number; z: number };
const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, z: a.z - b.z });
const len = (a: V2) => Math.hypot(a.x, a.z);
const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Seeded PRNG stream (mulberry32). */
export function rngStream(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Item schema (doc 03 R-I1). */
export interface Item {
  id: string;
  name: string;
  kind: "take" | "push" | "interact";
  weight: "carry" | "drag";
  owner: string | null;
  homePos: V2;
  zone: string;
  flags: { noisy?: boolean; wearable?: boolean; breakable?: boolean; respawn?: boolean; hidingSpot?: boolean };
  pos: V2;
  heldBy: string | null;   // "goose", an NPC id, or null
}

export type Archetype = "normal" | "chaser" | "scaredy" | "tidy";

export type State = "routine" | "react" | "investigate" | "chase" | "shoo" | "search" | "retrieve"
  | "return" | "flee" | "giveup";

export interface Npc {
  id: string;
  name: string;
  archetype: Archetype;
  pos: V2;
  facing: number;           // radians, 0 = +x, counter-clockwise toward +z
  home: V2;
  routine: V2[];            // patrol loop
  routineIdx: number;
  state: State;
  stateTime: number;
  mark: "" | "?" | "!" | "swirl";
  markTime: number;
  holding: string | null;
  target: V2 | null;
  wantItem: string | null;  // thought bubble
  memory: { gooseSeen: V2 | null; gooseSeenAt: number; itemSeen: Record<string, V2>; honks: number[] };
  speedWalk: number;
  speedRun: number;
  line: string;
  lineTime: number;
  grip: number;             // seconds spent within reach of the goose while chasing
}

export interface GooseState { pos: V2; speed: number; holding: string | null; crouched: boolean }

export type SimEvent =
  | { t: number; type: "honk"; pos: V2 }
  | { t: number; type: "noticed"; npc: string; what: string }
  | { t: number; type: "drop"; npc: string; item: string }
  | { t: number; type: "chase"; npc: string }
  | { t: number; type: "giveup"; npc: string }
  | { t: number; type: "shoo"; npc: string }
  | { t: number; type: "snatched"; npc: string; item: string }
  | { t: number; type: "returned"; npc: string; item: string }
  | { t: number; type: "grab"; who: string; item: string }
  | { t: number; type: "release"; who: string; item: string };

export const LINES = {
  shock: ["Hey!", "Whoa!", "Not again!", "Goose!"],
  stolen: ["My stuff!", "Give that back!", "Hey, that's mine!", "Come back here!"],
  shoo: ["Shoo! Go away!", "Off you go!", "Not on my watch!", "Out of here, goose!"],
  giveup: ["Huh.", "Where did it go?", "Forget it.", "Unbelievable."],
  wonder: ["What was that?", "Hm?", "Was that a goose?"],
};

export const PERCEPTION = {
  coneDeg: 110, coneRange: 18, periphRange: 4, honkRange: 25, closeHonk: 4,
  itemCheckRange: 8, reactTime: 0.6, chaseGiveUpS: 12, chaseLeashM: 40, gooseMemoryS: 30,
  repeatedHonks: 3, repeatedWindowS: 6, fleeS: 3, grabReach: 0.9, gripS: 0.5,
};

export interface SimOptions {
  /** Line of sight between two ground points (eye height implied); default: always clear. */
  lineOfSight?: (a: V2, b: V2) => boolean;
  seed?: number;
}

export class Sim {
  t = 0;
  items = new Map<string, Item>();
  npcs = new Map<string, Npc>();
  goose: GooseState = { pos: { x: 0, z: 0 }, speed: 0, holding: null, crouched: false };
  events: SimEvent[] = [];
  private los: (a: V2, b: V2) => boolean;
  readonly rng: () => number;

  constructor(opts: SimOptions = {}) {
    this.los = opts.lineOfSight ?? (() => true);
    this.rng = rngStream(opts.seed ?? 1);
  }

  addItem(i: Omit<Item, "pos" | "heldBy"> & { pos?: V2 }) {
    this.items.set(i.id, { ...i, pos: i.pos ?? { ...i.homePos }, heldBy: null });
  }

  addNpc(n: Pick<Npc, "id" | "name" | "archetype" | "home"> & Partial<Npc>) {
    this.npcs.set(n.id, {
      pos: { ...n.home }, facing: 0, routine: [{ ...n.home }], routineIdx: 0, state: "routine", stateTime: 0,
      mark: "", markTime: 0, holding: null, target: null, wantItem: null,
      memory: { gooseSeen: null, gooseSeenAt: -1e9, itemSeen: {}, honks: [] },
      speedWalk: 1.3, speedRun: 4.4, line: "", lineTime: -1e9, grip: 0, ...n,
    });
  }

  private emit(e: SimEvent) { this.events.push(e); }

  /** Goose honks at its position: hearing and close-honk shock are resolved immediately. */
  honk() {
    const p = this.goose.pos;
    this.emit({ t: this.t, type: "honk", pos: { ...p } });
    for (const n of this.npcs.values()) {
      const d = dist(n.pos, p);
      if (d > PERCEPTION.honkRange) continue;
      n.memory.honks = n.memory.honks.filter((h) => this.t - h < PERCEPTION.repeatedWindowS).concat(this.t);
      if (d <= PERCEPTION.closeHonk) {
        this.setMark(n, "!");
        this.say(n, "shock");
        if (n.holding) this.npcDrop(n);
        if (n.archetype === "scaredy" && n.memory.honks.length >= 2) { this.go(n, "flee"); continue; }
        if (n.memory.honks.length >= PERCEPTION.repeatedHonks && n.archetype === "chaser") { this.go(n, "shoo"); continue; }
        this.go(n, "react");
      } else if (["routine", "giveup", "search"].includes(n.state)) {
        this.setMark(n, "?");
        if (this.rng() < 0.5) this.say(n, "wonder");
        n.target = { ...p };
        this.emit({ t: this.t, type: "noticed", npc: n.id, what: "honk" });
        this.go(n, "react", "investigate");
      }
    }
  }

  /** Goose grabs the nearest item within reach (or takes it from an NPC's hands after a shock). */
  gooseGrab(): string | null {
    if (this.goose.holding) return null;
    let best: Item | null = null, bd = PERCEPTION.grabReach;
    for (const it of this.items.values()) {
      if (it.kind !== "take" || it.heldBy) continue;
      const d = dist(it.pos, this.goose.pos);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return null;
    best.heldBy = "goose";
    this.goose.holding = best.id;
    this.emit({ t: this.t, type: "grab", who: "goose", item: best.id });
    return best.id;
  }

  gooseRelease() {
    const id = this.goose.holding;
    if (!id) return;
    const it = this.items.get(id)!;
    it.heldBy = null;
    it.pos = { ...this.goose.pos };
    this.goose.holding = null;
    this.emit({ t: this.t, type: "release", who: "goose", item: id });
  }

  private npcDrop(n: Npc) {
    const it = this.items.get(n.holding!)!;
    it.heldBy = null;
    it.pos = { x: n.pos.x + Math.cos(n.facing) * 0.5, z: n.pos.z + Math.sin(n.facing) * 0.5 };
    this.emit({ t: this.t, type: "drop", npc: n.id, item: it.id });
    n.holding = null;
  }

  private setMark(n: Npc, m: Npc["mark"]) { n.mark = m; n.markTime = this.t; }

  /** Short text lines per situation (doc 05 section 5), picked deterministically from the sim stream. */
  private say(n: Npc, kind: keyof typeof LINES) {
    const opts = LINES[kind];
    n.line = opts[Math.floor(this.rng() * opts.length)];
    n.lineTime = this.t;
  }

  private next = new Map<string, State>();

  private go(n: Npc, s: State, after?: State) {
    if (s === "giveup" && n.state !== "giveup") this.emit({ t: this.t, type: "giveup", npc: n.id });
    if (s === "shoo" && n.state !== "shoo") this.emit({ t: this.t, type: "shoo", npc: n.id });
    n.state = s;
    n.stateTime = 0;
    if (after) this.next.set(n.id, after); else this.next.delete(n.id);
  }

  /** Can this NPC see the goose (vision cone with line of sight, or peripheral range)? */
  sees(n: Npc): boolean {
    const g = this.goose.pos;
    const d = dist(n.pos, g);
    if (d <= PERCEPTION.periphRange) return true;
    const range = PERCEPTION.coneRange * (this.goose.crouched ? 0.6 : 1);
    if (d > range) return false;
    const v = sub(g, n.pos);
    let a = Math.atan2(v.z, v.x) - n.facing;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > (PERCEPTION.coneDeg / 2) * (Math.PI / 180)) return false;
    return this.los(n.pos, g);
  }

  private moveToward(n: Npc, target: V2, speed: number, dt: number): boolean {
    const v = sub(target, n.pos);
    const d = len(v);
    if (d < 0.05) return true;
    const stepLen = Math.min(d, speed * dt);
    n.pos = { x: n.pos.x + (v.x / d) * stepLen, z: n.pos.z + (v.z / d) * stepLen };
    n.facing = Math.atan2(v.z, v.x);
    return d - stepLen < 0.3;
  }

  private ownedMissing(n: Npc): Item | null {
    for (const it of this.items.values()) {
      if (it.owner !== n.id || it.heldBy === n.id) continue;
      if (dist(it.pos, it.homePos) > 1.0 && dist(n.pos, it.homePos) < PERCEPTION.itemCheckRange) return it;
    }
    return null;
  }

  /**
   * Apply an optional decision-layer answer (doc 05 section 9): only from routine, only for allowed
   * choices, and only if it still makes sense (the wanted item must still be away from home).
   */
  applyDecision(npcId: string, choice: string, itemId: string | null): boolean {
    const n = this.npcs.get(npcId);
    if (!n || n.state !== "routine") return false;
    if (choice === "search_again" && itemId) {
      const it = this.items.get(itemId);
      if (!it || it.heldBy || dist(it.pos, it.homePos) < 1) return false;
      n.wantItem = itemId;
      this.setMark(n, "?");
      this.go(n, "search");
      return true;
    }
    if (choice === "shoo" && n.archetype !== "scaredy") { this.go(n, "shoo"); return true; }
    return choice === "routine";
  }

  step(dt: number) {
    this.t += dt;
    for (const it of this.items.values()) {
      if (it.heldBy === "goose") it.pos = { ...this.goose.pos };
      else if (it.heldBy && this.npcs.has(it.heldBy)) it.pos = { ...this.npcs.get(it.heldBy)!.pos };
    }
    for (const n of this.npcs.values()) this.think(n, dt);
  }

  private think(n: Npc, dt: number) {
    n.stateTime += dt;
    if (n.mark && this.t - n.markTime > 1.5) n.mark = "";
    const seesGoose = this.sees(n);
    if (seesGoose) { n.memory.gooseSeen = { ...this.goose.pos }; n.memory.gooseSeenAt = this.t; }
    const gooseHasMine = this.goose.holding !== null && this.items.get(this.goose.holding)!.owner === n.id;
    // highest-priority interrupts (doc 05: Flee > Chase > Retrieve > Shoo > Investigate > Routine)
    if (n.state !== "flee" && n.state !== "react" && gooseHasMine && seesGoose && n.state !== "chase") {
      this.setMark(n, "!");
      this.say(n, "stolen");
      n.wantItem = this.goose.holding;
      this.emit({ t: this.t, type: "noticed", npc: n.id, what: "item_stolen" });
      this.go(n, "react", "chase");
      return;
    }
    switch (n.state) {
      case "react":
        if (n.stateTime >= PERCEPTION.reactTime) this.go(n, this.next.get(n.id) ?? "routine");
        return;
      case "routine": {
        const missing = this.ownedMissing(n);
        if (missing) {
          this.setMark(n, "?");
          n.wantItem = missing.id;
          this.emit({ t: this.t, type: "noticed", npc: n.id, what: "item_missing" });
          this.go(n, "react", missing.heldBy ? "chase" : "search");
          return;
        }
        if (n.archetype === "chaser" && seesGoose && dist(this.goose.pos, n.home) < 10) { this.setMark(n, "!"); this.go(n, "shoo"); return; }
        const wp = n.routine[n.routineIdx];
        if (this.moveToward(n, wp, n.speedWalk, dt) && n.stateTime > 2) {
          n.routineIdx = (n.routineIdx + 1) % n.routine.length;
          n.stateTime = 0;
        }
        return;
      }
      case "investigate":
        if (!n.target || this.moveToward(n, n.target, n.speedWalk * 1.2, dt) || n.stateTime > 15) {
          this.go(n, "giveup");
        }
        return;
      case "chase": {
        const id = n.wantItem;
        const it = id ? this.items.get(id) : undefined;
        if (!it) { this.go(n, "giveup"); return; }
        if (it.heldBy !== "goose") { this.go(n, "retrieve"); return; }
        const tooLong = n.stateTime > PERCEPTION.chaseGiveUpS;
        const tooFar = dist(n.pos, n.home) > PERCEPTION.chaseLeashM;
        const lost = this.t - n.memory.gooseSeenAt > 4;
        if (tooLong || tooFar || lost) { this.go(n, "giveup"); return; }
        if (n.stateTime < dt * 1.5) this.emit({ t: this.t, type: "chase", npc: n.id });
        const chaseSpeed = Math.max(n.speedRun, this.goose.speed * 1.05);
        this.moveToward(n, n.memory.gooseSeen ?? this.goose.pos, chaseSpeed, dt);
        // staying within reach for a moment snatches the item back
        n.grip = dist(n.pos, this.goose.pos) < 0.8 ? n.grip + dt : 0;
        if (n.grip >= PERCEPTION.gripS) {
          n.grip = 0;
          this.emit({ t: this.t, type: "snatched", npc: n.id, item: it.id });
          this.goose.holding = null;
          it.heldBy = n.id;
          n.holding = it.id;
          this.go(n, "return");
        }
        return;
      }
      case "search":
      case "retrieve": {
        const it = n.wantItem ? this.items.get(n.wantItem) : undefined;
        if (!it) { this.go(n, "giveup"); return; }
        if (it.heldBy === "goose") { this.go(n, "chase"); return; }
        if (n.stateTime > 20) { this.go(n, "giveup"); return; }
        if (this.moveToward(n, it.pos, n.speedWalk * 1.4, dt)) {
          it.heldBy = n.id;
          n.holding = it.id;
          this.go(n, "return");
        }
        return;
      }
      case "return": {
        const it = n.holding ? this.items.get(n.holding) : undefined;
        if (!it) { this.go(n, "routine"); return; }
        if (this.moveToward(n, it.homePos, n.speedWalk, dt)) {
          it.heldBy = null;
          it.pos = { ...it.homePos };
          n.holding = null;
          n.wantItem = null;
          this.emit({ t: this.t, type: "returned", npc: n.id, item: it.id });
          this.go(n, "routine");
        }
        return;
      }
      case "shoo":
        if (n.stateTime < dt * 1.5) this.say(n, "shoo");
        if (!seesGoose || n.stateTime > 6 || dist(this.goose.pos, n.home) > 14) { this.go(n, "routine"); return; }
        if (dist(n.pos, this.goose.pos) > 1.6) this.moveToward(n, this.goose.pos, n.speedWalk * 1.6, dt);
        return;
      case "flee": {
        const away = sub(n.pos, this.goose.pos);
        const d = len(away) || 1;
        this.moveToward(n, { x: n.pos.x + (away.x / d) * 5, z: n.pos.z + (away.z / d) * 5 }, n.speedRun, dt);
        if (n.stateTime > PERCEPTION.fleeS) this.go(n, "giveup");
        return;
      }
      case "giveup":
        if (n.stateTime < dt * 1.5) { this.setMark(n, "swirl"); this.say(n, "giveup"); }
        if (n.stateTime > 1.5) { n.wantItem = null; this.go(n, "routine"); }
        return;
    }
  }
}
