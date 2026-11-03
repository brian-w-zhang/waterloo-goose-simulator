import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { click, honk as honkSound } from "@/audio/honk";
import type { Physics } from "@/physics/physics";
import { DecisionClient } from "@/ai/decide";
import { Sim, type SimEvent, type V2 } from "@/sim/sim";
import { animatePerson, itemGeometry, makePerson, type PersonRig } from "./actors";
import { HOTSPOTS, LOOKS, populate } from "./hotspot";

const EYE_M = 1.6;
// props are drawn larger than life so they read from the diorama camera (the map itself stays to scale)
const ITEM_SCALE = 1.5;

export interface Task { id: string; hotspot: string; text: string; gate?: number; done: boolean; test: (e: SimEvent, sim: Sim) => boolean }

/** The hotspot's simulation plus its people, items, tasks and sounds. */
export class HotspotRuntime {
  readonly sim: Sim;
  readonly root = new THREE.Group();
  private people = new Map<string, PersonRig>();
  private items = new Map<string, THREE.Mesh>();
  private lastPos = new Map<string, V2>();
  private seen = 0;
  readonly tasks: Task[] = HOTSPOTS.flatMap((h) => h.tasks.map((t) => ({ ...t, hotspot: h.id, done: false })));
  onTask?: (t: Task) => void;
  /** Optional decision layer (?jev=1): consulted when someone gives up; the sim never waits for it. */
  decisions: DecisionClient | null = null;
  private lastWanted = new Map<string, string | null>();

  constructor(private physics: Physics, private heightAt: (x: number, z: number) => number,
    personMat: THREE.Material, markMat: THREE.Material, itemMat: THREE.Material, seed: number) {
    this.root.name = "hotspot";
    this.sim = new Sim({ seed, lineOfSight: (a, b) => this.lineOfSight(a, b) });
    populate(this.sim);
    for (const [id, look] of LOOKS) {
      const p = makePerson(look, personMat, markMat);
      this.people.set(id, p);
      this.root.add(p.root);
    }
    for (const it of this.sim.items.values()) {
      const m = new THREE.Mesh(itemGeometry(it.id.split("_")[0]), itemMat);
      m.scale.setScalar(ITEM_SCALE);
      m.castShadow = true;
      m.receiveShadow = true;
      this.items.set(it.id, m);
      this.root.add(m);
    }
  }

  private ground(x: number, z: number) {
    const y = this.heightAt(x, z);
    return Number.isFinite(y) ? y : 0;
  }

  /** NPC eye to goose: blocked if a building or the terrain is hit before reaching the goose. */
  lineOfSight(a: V2, b: V2): boolean {
    const R = this.physics.R;
    const o = new THREE.Vector3(a.x, this.ground(a.x, a.z) + EYE_M, a.z);
    const t = new THREE.Vector3(b.x, this.ground(b.x, b.z) + 0.5, b.z);
    const d = t.clone().sub(o);
    const L = d.length();
    if (L < 0.5) return true;
    d.divideScalar(L);
    const hit = this.physics.world.castRay(new R.Ray(o, d), L, true, undefined, undefined, undefined, undefined,
      (c) => c.parent() === null);
    return !hit || hit.timeOfImpact > L - 0.4;
  }

  honk() {
    honkSound(0.95 + this.sim.rng() * 0.1);
    this.sim.honk();
  }

  grabOrDrop(): string | null {
    if (this.sim.goose.holding) { this.sim.gooseRelease(); click(600); return null; }
    const id = this.sim.gooseGrab();
    if (id) click(1000);
    return id;
  }

  /** One fixed step; gooseHead is the bill position used to carry items. */
  step(dt: number, goosePos: THREE.Vector3, gooseSpeed: number, crouched: boolean) {
    this.sim.goose.pos = { x: goosePos.x, z: goosePos.z };
    this.sim.goose.speed = gooseSpeed;
    this.sim.goose.crouched = crouched;
    for (const n of this.sim.npcs.values()) this.lastPos.set(n.id, { ...n.pos });
    this.sim.step(dt);
    for (const n of this.sim.npcs.values()) if (n.wantItem) this.lastWanted.set(n.id, n.wantItem);
    for (; this.seen < this.sim.events.length; this.seen++) {
      const e = this.sim.events[this.seen];
      if (e.type === "giveup" && this.decisions) {
        const n = this.sim.npcs.get(e.npc)!;
        const item = this.lastWanted.get(n.id) ?? null;
        const what = item ? this.sim.items.get(item)!.name : "something";
        void this.decisions.decide({ npc: n.id, state: "giveup", options: ["routine", "search_again", "shoo"],
          situation: `${n.name} (${n.archetype}) just gave up chasing a Canada goose that took ${what}.` })
          .then((a) => { if (a && this.sim.applyDecision(n.id, a.choice, item)) this.decisions!.stats.applied++; });
      }
      for (const t of this.tasks) {
        if (!t.done && this.unlocked(t) && t.test(e, this.sim)) { t.done = true; this.onTask?.(t); }
      }
    }
  }

  /** Sync meshes to the simulation (call once per rendered frame). */
  sync(dt: number, t: number, camera: THREE.Camera, gooseBill: THREE.Vector3) {
    for (const n of this.sim.npcs.values()) {
      const r = this.people.get(n.id)!;
      const prev = this.lastPos.get(n.id) ?? n.pos;
      const speed = Math.hypot(n.pos.x - prev.x, n.pos.z - prev.z) / (1 / 60);
      r.root.position.set(n.pos.x, this.ground(n.pos.x, n.pos.z), n.pos.z);
      // sim facing is counter-clockwise from +x toward +z; people face +z locally
      r.root.rotation.y = Math.PI / 2 - n.facing;
      animatePerson(r, n, speed, dt, t, camera);
    }
    const hand = new THREE.Vector3();
    for (const it of this.sim.items.values()) {
      const m = this.items.get(it.id)!;
      if (it.heldBy === "goose") {
        m.position.copy(gooseBill).add(new THREE.Vector3(0, -0.06, 0));
        if (it.weight === "drag") m.position.y = this.ground(it.pos.x, it.pos.z);
      } else if (it.heldBy) {
        this.people.get(it.heldBy)!.hand.getWorldPosition(hand);
        m.position.copy(hand);
      } else {
        m.position.set(it.pos.x, this.ground(it.pos.x, it.pos.z), it.pos.z);
      }
    }
  }

  unlocked(t: Task) {
    return !t.gate || this.tasks.filter((o) => o.hotspot === t.hotspot && o !== t && o.done).length >= t.gate;
  }

  /** Current speech lines (shown for 2.2 s) with each speaker's head position. */
  speech(): { text: string; pos: THREE.Vector3 }[] {
    const out: { text: string; pos: THREE.Vector3 }[] = [];
    for (const n of this.sim.npcs.values()) {
      if (!n.line || this.sim.t - n.lineTime > 2.2) continue;
      const r = this.people.get(n.id)!;
      out.push({ text: n.line, pos: r.root.position.clone().setY(r.root.position.y + 2.9) });
    }
    return out;
  }

  /** The hotspot closest to (x, z): its name and tasks drive the HUD. */
  nearestHotspot(x: number, z: number) {
    let best = HOTSPOTS[0], bd = Infinity;
    for (const h of HOTSPOTS) {
      const d = Math.hypot(h.anchor.x - x, h.anchor.z - z);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  /** Nearest takeable item within reach of the goose (for the grab prompt). */
  nearestItem(): string | null {
    let best: string | null = null, bd = 0.9;
    for (const it of this.sim.items.values()) {
      if (it.heldBy) continue;
      const d = Math.hypot(it.pos.x - this.sim.goose.pos.x, it.pos.z - this.sim.goose.pos.z);
      if (d < bd) { bd = d; best = it.name; }
    }
    return best;
  }
}

export const HOTSPOT_SEED = campus.seeds.sim;
