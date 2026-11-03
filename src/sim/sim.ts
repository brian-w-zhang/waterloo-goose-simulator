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

/** heldBy value for an item the goose is wearing */
export const WORN = "goose:worn";

export type Archetype = "normal" | "chaser" | "scaredy" | "tidy";

export type State = "routine" | "react" | "investigate" | "chase" | "shoo" | "search" | "retrieve"
  | "return" | "flee" | "giveup" | "tug" | "fallen";

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
  gesture: "" | "shake" | "clap" | "dress";
  gestureTime: number;
  /** speed and vision multiplier after escalation (spec V-ANIM-8) */
  alert: number;
  path: V2[];
  pathGoal: V2 | null;
  pathTime: number;
}

export interface GooseState {
  pos: V2; speed: number; holding: string | null; crouched: boolean; hidden: boolean;
  /** a wearable someone put on the goose (spec I-17) */
  wearing: string | null;
}

export type SimEvent =
  | { t: number; type: "honk"; pos: V2 }
  | { t: number; type: "noticed"; npc: string; what: string }
  | { t: number; type: "drop"; npc: string; item: string }
  | { t: number; type: "chase"; npc: string }
  | { t: number; type: "giveup"; npc: string }
  | { t: number; type: "shoo"; npc: string }
  | { t: number; type: "snatched"; npc: string; item: string }
  | { t: number; type: "tug"; npc: string; item: string; won: boolean }
  | { t: number; type: "fall"; npc: string }
  | { t: number; type: "returned"; npc: string; item: string }
  | { t: number; type: "grab"; who: string; item: string }
  | { t: number; type: "release"; who: string; item: string }
  | { t: number; type: "worn"; npc: string; item: string };

export const LINES = {
  shock: ["Hey!", "Whoa!", "Not again!", "Goose!"],
  stolen: ["My stuff!", "Give that back!", "Hey, that's mine!", "Come back here!"],
  shoo: ["Shoo! Go away!", "Off you go!", "Not on my watch!", "Out of here, goose!"],
  giveup: ["Huh.", "Where did it go?", "Forget it.", "Unbelievable."],
  wonder: ["What was that?", "Hm?", "Was that a goose?"],
  dress: ["Aww, there you go.", "Safety first, buddy.", "Looking sharp!"],
};

export const PERCEPTION = {
  coneDeg: 110, coneRange: 18, periphRange: 4, honkRange: 25, closeHonk: 4,
  itemCheckRange: 8, reactTime: 0.6, chaseGiveUpS: 12, chaseLeashM: 40, gooseMemoryS: 30,
  repeatedHonks: 3, repeatedWindowS: 6, fleeS: 3, grabReach: 0.9, gripS: 0.5,
  tugWinS: 1.1, tugLoseS: 2.4, tugPullM: 0.6, fallS: 2.2, hideSeeM: 1.2, tripChance: 0.5,
};

export interface SimOptions {
  /** Line of sight between two ground points (eye height implied); default: always clear. */
  lineOfSight?: (a: V2, b: V2) => boolean;
  /** Ground path planner (navmesh); default: straight line. */
  planner?: (a: V2, b: V2) => V2[];
  seed?: number;
}

export class Sim {
  t = 0;
  items = new Map<string, Item>();
  npcs = new Map<string, Npc>();
  goose: GooseState = { pos: { x: 0, z: 0 }, speed: 0, holding: null, crouched: false, hidden: false, wearing: null };
  /** seconds the goose has been bowing with a wearable in front of someone calm */
  private bowT = 0;
  /** Bushes the goose can hide in (spec I-14), as ground positions with a radius. */
  hideSpots: { pos: V2; r: number }[] = [];
  /** Current tug-of-war (spec I-20). */
  tug: { npc: string; item: string; t: number; start: V2 } | null = null;
  events: SimEvent[] = [];
  private los: (a: V2, b: V2) => boolean;
  planner: ((a: V2, b: V2) => V2[]) | null;
  readonly rng: () => number;

  constructor(opts: SimOptions = {}) {
    this.los = opts.lineOfSight ?? (() => true);
    this.planner = opts.planner ?? null;
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
      speedWalk: 1.3, speedRun: 4.4, line: "", lineTime: -1e9, grip: 0, gesture: "", gestureTime: -1e9, alert: 1,
      path: [], pathGoal: null, pathTime: -1e9, ...n,
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
      } else if (n.state === "routine" && d < 10 && this.sees(n)) {
        n.gesture = "shake";
        n.gestureTime = this.t;
        n.facing = Math.atan2(p.z - n.pos.z, p.x - n.pos.x);
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
    if (this.goose.holding || this.tug) return null;
    // an item in someone's hands within reach starts a tug-of-war instead (spec I-20)
    for (const it of this.items.values()) {
      if (!it.heldBy || it.heldBy === "goose" || !this.npcs.has(it.heldBy)) continue;
      const n = this.npcs.get(it.heldBy)!;
      if (dist(n.pos, this.goose.pos) < PERCEPTION.grabReach + 0.5 && n.state !== "fallen") {
        this.tug = { npc: n.id, item: it.id, t: 0, start: { ...this.goose.pos } };
        this.setMark(n, "!");
        this.say(n, "stolen");
        this.go(n, "tug");
        return null;
      }
    }
    let best: Item | null = null, bd = PERCEPTION.grabReach;
    for (const it of this.items.values()) {
      if (it.kind !== "take" || it.heldBy) continue;
      const d = dist(it.pos, this.goose.pos);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) {
      // nothing to pick up: shake off whatever the goose is wearing
      if (this.goose.wearing) {
        const w = this.items.get(this.goose.wearing)!;
        w.heldBy = null; w.pos = { ...this.goose.pos }; this.goose.wearing = null;
        this.emit({ t: this.t, type: "release", who: "goose", item: w.id });
      }
      return null;
    }
    best.heldBy = "goose";
    this.goose.holding = best.id;
    this.emit({ t: this.t, type: "grab", who: "goose", item: best.id });
    return best.id;
  }

  gooseRelease() {
    if (this.tug) { this.endTug(false); return; }
    const id = this.goose.holding;
    if (!id) return;
    const it = this.items.get(id)!;
    it.heldBy = null;
    it.pos = { ...this.goose.pos };
    this.goose.holding = null;
    this.emit({ t: this.t, type: "release", who: "goose", item: id });
  }

  private endTug(won: boolean) {
    const tg = this.tug!;
    const n = this.npcs.get(tg.npc)!;
    const it = this.items.get(tg.item)!;
    this.tug = null;
    this.emit({ t: this.t, type: "tug", npc: n.id, item: it.id, won });
    if (won) {
      // the goose yanks it free: the owner topples over (slapstick, never hurt) and the goose has it
      n.holding = null;
      it.heldBy = "goose";
      this.goose.holding = it.id;
      this.emit({ t: this.t, type: "grab", who: "goose", item: it.id });
      this.fall(n);
    } else {
      this.go(n, "routine");
    }
  }

  private fall(n: Npc) {
    this.emit({ t: this.t, type: "fall", npc: n.id });
    this.setMark(n, "swirl");
    if (n.holding) this.npcDrop(n);
    this.go(n, "fallen");
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
    if (this.goose.hidden && d > PERCEPTION.hideSeeM) return false;
    if (d <= PERCEPTION.periphRange) return true;
    const range = PERCEPTION.coneRange * (this.goose.crouched ? 0.6 : 1) * n.alert;
    if (d > range) return false;
    const v = sub(g, n.pos);
    let a = Math.atan2(v.z, v.x) - n.facing;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > (PERCEPTION.coneDeg / 2) * (Math.PI / 180)) return false;
    return this.los(n.pos, g);
  }

  private moveToward(n: Npc, target: V2, speed: number, dt: number): boolean {
    if (this.planner) {
      // replan when the goal moved or the plan is old (moving targets like the goose)
      if (!n.pathGoal || dist(n.pathGoal, target) > 1.5 || this.t - n.pathTime > 1.5 || !n.path.length) {
        n.path = this.planner(n.pos, target);
        n.pathGoal = { ...target };
        n.pathTime = this.t;
      }
      while (n.path.length > 1 && dist(n.path[0], n.pos) < 0.5) n.path.shift();
      const wp = n.path.length > 1 ? n.path[0] : target;
      if (wp !== target) { this.stepToward(n, wp, speed, dt); return false; }
    }
    return this.stepToward(n, target, speed, dt);
  }

  private stepToward(n: Npc, target: V2, speed: number, dt: number): boolean {
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

  /** Escalation after most of an area's tasks are done: faster chases, wider eyes (spec V-ANIM-8). */
  escalate(zonePrefix: string) {
    for (const n of this.npcs.values()) if (n.id.startsWith(zonePrefix)) n.alert = 1.15;
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
    this.goose.hidden = this.hideSpots.some((h) => dist(h.pos, this.goose.pos) < h.r);
    if (this.tug) {
      const tg = this.tug;
      tg.t += dt;
      const n = this.npcs.get(tg.npc)!;
      // pulling means backing away from the owner while holding on
      const pulled = dist(this.goose.pos, n.pos) - dist(tg.start, n.pos) > PERCEPTION.tugPullM;
      if (tg.t > PERCEPTION.tugWinS && pulled) this.endTug(true);
      else if (tg.t > PERCEPTION.tugLoseS) this.endTug(false);
    }
    this.dressing(dt);
    for (const it of this.items.values()) {
      if (it.heldBy === "goose" || it.heldBy === WORN) it.pos = { ...this.goose.pos };
      else if (it.heldBy && this.npcs.has(it.heldBy)) it.pos = { ...this.npcs.get(it.heldBy)!.pos };
    }
    for (const n of this.npcs.values()) this.think(n, dt);
  }

  /**
   * Wearables (spec I-17): the goose cannot dress itself, but if it bows (crouches) holding a
   * wearable in front of someone calm for 1.2 s, they put it on the goose's head.
   */
  private dressing(dt: number) {
    const id = this.goose.holding;
    const it = id ? this.items.get(id)! : null;
    const helper = it?.flags.wearable && this.goose.crouched && !this.goose.wearing
      ? [...this.npcs.values()].find((n) => n.state === "routine" && dist(n.pos, this.goose.pos) < 1.8) : undefined;
    if (!helper || !it) { this.bowT = 0; return; }
    this.bowT += dt;
    helper.facing = Math.atan2(this.goose.pos.z - helper.pos.z, this.goose.pos.x - helper.pos.x);
    if (this.bowT < 1.2) return;
    this.bowT = 0;
    it.heldBy = WORN;
    this.goose.holding = null;
    this.goose.wearing = it.id;
    helper.gesture = "dress"; helper.gestureTime = this.t;
    this.say(helper, "dress");
    this.emit({ t: this.t, type: "worn", npc: helper.id, item: it.id });
  }

  private think(n: Npc, dt: number) {
    n.stateTime += dt;
    if (n.gesture && this.t - n.gestureTime > 1.6) n.gesture = "";
    if (n.state === "tug") return;
    if (n.state === "fallen") {
      if (n.stateTime > PERCEPTION.fallS) { this.say(n, "giveup"); this.go(n, n.wantItem ? "search" : "routine"); }
      return;
    }
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
        // slapstick: running over a ball or frisbee on the ground can trip the chaser (spec V-ANIM-7)
        for (const o of this.items.values()) {
          if (o.heldBy || !/^(ball|frisbee)/.test(o.id) || dist(o.pos, n.pos) > 0.45) continue;
          if (this.rng() < PERCEPTION.tripChance * dt * 10) { this.fall(n); return; }
        }
        const chaseSpeed = Math.max(n.speedRun, this.goose.speed * 1.05) * n.alert;
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
          n.gesture = "clap";
          n.gestureTime = this.t;
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
