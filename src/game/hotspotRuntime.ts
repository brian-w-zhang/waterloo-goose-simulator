import * as THREE from "three/webgpu";
import { campus, swatch, swatchHex } from "@/config";
import { click, honk as honkSound, smash } from "@/audio/honk";
import type RAPIER from "@dimforge/rapier3d-compat";
import { GROUP_ITEM, type Physics } from "@/physics/physics";
import { DecisionClient } from "@/ai/decide";
import { Menace } from "@/sim/menace";
import { BROKEN, Sim, type SimEvent, type V2, WORN } from "@/sim/sim";
import { animatePerson, itemGeometry, makePerson, type PersonRig } from "./actors";
import { HOTSPOTS, LOOKS, populate } from "./hotspot";

const EYE_M = 1.6;
const ARCHETYPE_WORDS = { normal: "calm", chaser: "territorial, easily annoyed", scaredy: "nervous, easily startled", tidy: "fussy, tidy" };
// props are drawn larger than life so they read from the diorama camera (the map itself stays to scale)
const ITEM_SCALE = 1.5;
/** half extents (m, after ITEM_SCALE) of the physics box for items the goose drags */
const DRAG_BOX: Record<string, [number, number, number]> = { cone: [0.26, 0.4, 0.26], backpack: [0.24, 0.27, 0.16], basket: [0.3, 0.2, 0.22] };
/** one shared shard shape for every shatter (never disposed: it lives as long as the page) */
const SHARD = new THREE.TetrahedronGeometry(0.05);
/** item kinds that roll */
const ROUND = new Set(["apple", "ball"]);

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
  onSnatched?: () => void;
  readonly menace = new Menace();
  /** Set by the game: is (x, z) open water? Used for the "into water" score. */
  isWater: (x: number, z: number) => boolean = () => false;
  /** the goose head group: worn items are parented to it */
  gooseHeadGroup: THREE.Object3D | null = null;
  private chaseScored = new Set<string>();
  private escalated = new Set<string>();
  private dragM = 0;
  private dragLast: V2 | null = null;
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
    const ga = this.heightAt(a.x, a.z), gb = this.heightAt(b.x, b.z);
    // no loaded ground (and so no colliders) at either end: nobody sees through a missing chunk
    if (!Number.isFinite(ga) || !Number.isFinite(gb)) return false;
    const o = new THREE.Vector3(a.x, ga + EYE_M, a.z);
    const t = new THREE.Vector3(b.x, gb + 0.5, b.z);
    const d = t.clone().sub(o);
    const L = d.length();
    if (L < 0.5) return true;
    d.divideScalar(L);
    const hit = this.physics.world.castRay(new R.Ray(o, d), L, true, undefined, undefined, undefined, undefined,
      (c) => c.parent() === null);
    return !hit || hit.timeOfImpact > L - 0.4;
  }

  honk() {
    const held = this.sim.goose.holding?.split("_")[0];
    honkSound(0.95 + this.sim.rng() * 0.1, held === "cone" ? "cone" : held === "coffee" ? "muffled" : "none");
    this.sim.honk();
  }

  grabOrDrop(): string | null {
    if (this.sim.goose.holding) { this.sim.gooseRelease(); click(600); return null; }
    // where it lay: sim.step moves a held item to the goose, but a dragged body must start here
    const before = new Map([...this.sim.items.values()].map((it) => [it.id, { ...it.pos }]));
    const id = this.sim.gooseGrab();
    if (id) { click(1000); this.grabbedAt.set(id, before.get(id)!); }
    return id;
  }

  /** One fixed step; gooseHead is the bill position used to carry items. */
  step(dt: number, goosePos: THREE.Vector3, gooseSpeed: number, crouched: boolean) {
    this.sim.goose.pos = { x: goosePos.x, z: goosePos.z };
    this.sim.goose.bill = { x: this.gooseHead.x, z: this.gooseHead.z };
    this.sim.goose.speed = gooseSpeed;
    this.sim.goose.crouched = crouched;
    for (const n of this.sim.npcs.values()) this.lastPos.set(n.id, { ...n.pos });
    this.sim.step(dt);
    for (const n of this.sim.npcs.values()) {
      if (n.wantItem) this.lastWanted.set(n.id, n.wantItem);
      if (n.state === "chase" && n.stateTime > 10 && !this.chaseScored.has(n.id)) {
        this.chaseScored.add(n.id);
        this.menace.add("chase_10s", this.sim.t, n.id);
      }
      if (n.state !== "chase") this.chaseScored.delete(n.id);
    }
    // dragging heavy things: 5 points per 10 m beyond the first 20 m
    const held = this.sim.goose.holding ? this.sim.items.get(this.sim.goose.holding)! : null;
    if (held && held.weight === "drag") {
      const p = this.sim.goose.pos;
      if (this.dragLast) this.dragM += Math.hypot(p.x - this.dragLast.x, p.z - this.dragLast.z);
      this.dragLast = { ...p };
      if (this.dragM >= 30) { this.dragM -= 10; this.menace.add("drag_10m", this.sim.t); }
    } else { this.dragM = 0; this.dragLast = null; }
    this.dragPhysics(dt);
    this.itemPhysics(dt, goosePos, gooseSpeed);
    this.menace.tick(this.sim.t);
    for (; this.seen < this.sim.events.length; this.seen++) {
      const e = this.sim.events[this.seen];
      if (e.type === "snatched") this.onSnatched?.();
      if (e.type === "broke") this.shatter(e.item);
      this.score(e);
      if (e.type === "giveup" && this.decisions) {
        const n = this.sim.npcs.get(e.npc)!;
        const item = this.lastWanted.get(n.id) ?? null;
        const what = item ? this.sim.items.get(item)!.name : "something";
        void this.decisions.decide({ npc: n.id, state: "giveup", options: ["routine", "search_again", "shoo"],
          labels: { routine: "Gives up and goes back to what they were doing", search_again: "Goes back to look for the missing thing",
            shoo: "Turns on the goose, waving and shouting to drive it away" },
          situation: `${n.name}, a ${ARCHETYPE_WORDS[n.archetype]} person on the University of Waterloo campus, just gave up chasing a Canada goose that ran off with ${what}.` })
          .then((a) => { if (a && this.sim.applyDecision(n.id, a.choice, item)) this.decisions!.stats.applied++; })
          .catch((e) => console.error("[jev] applying a decision failed", e));
      }
      for (const t of this.tasks) {
        if (!t.done && this.unlocked(t) && t.test(e, this.sim)) {
          t.done = true;
          this.menace.add("task", this.sim.t);
          this.onTask?.(t);
          const same = this.tasks.filter((o) => o.hotspot === t.hotspot);
          if (same.filter((o) => o.done).length >= Math.min(4, same.length - 1) && !this.escalated.has(t.hotspot)) {
            this.escalated.add(t.hotspot);
            this.sim.escalate(`${t.hotspot}:`);
            this.root.add(noGeeseSign(HOTSPOTS.find((h) => h.id === t.hotspot)!.anchor, this.heightAt));
          }
        }
      }
    }
  }

  /**
   * Dragged items (goal P2 item 1): a Rapier dynamic body hung by a spherical joint from a kinematic
   * anchor at the bill, so heavy things trail, swing and catch on walls. After release the body
   * keeps going until it sleeps (or 4 s), then hands its resting place back to the simulation.
   */
  private drag = new Map<string, { body: RAPIER.RigidBody; joint: RAPIER.ImpulseJoint | null; hy: number; freeT: number }>();
  private anchor: RAPIER.RigidBody | null = null;
  /** ground position of each item when it was grabbed (consumed when its drag body is made) */
  private grabbedAt = new Map<string, V2>();

  private dragPhysics(dt: number) {
    const R = this.physics.R, w = this.physics.world;
    const id = this.sim.goose.holding;
    const it = id ? this.sim.items.get(id)! : null;
    this.anchor ??= w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.gooseHead.x, this.gooseHead.y, this.gooseHead.z));
    this.anchor.setNextKinematicTranslation({ x: this.gooseHead.x, y: this.gooseHead.y, z: this.gooseHead.z });
    if (it && it.weight === "drag" && !this.drag.get(it.id)?.joint) {
      let d = this.drag.get(it.id);
      const [hx, hy, hz] = DRAG_BOX[it.id.split("_")[0]] ?? [0.25, 0.25, 0.25];
      if (!d) {
        const at = this.grabbedAt.get(it.id) ?? it.pos;
        const g = this.heightAt(at.x, at.z);
        if (!Number.isFinite(g)) return;   // no collider under it yet: drag it once the chunk is in
        this.grabbedAt.delete(it.id);
        const y = g + hy + 0.02;
        const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(at.x, y, at.z)
          .setLinearDamping(1.2).setAngularDamping(1.5).setCanSleep(true));
        w.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setDensity(25).setFriction(0.8).setCollisionGroups(GROUP_ITEM), body);
        d = { body, joint: null, hy, freeT: 0 };
        this.drag.set(it.id, d);
      }
      d.body.wakeUp();
      d.joint = w.createImpulseJoint(R.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: hy * 0.6, z: 0 }), this.anchor, d.body, true);
      d.freeT = 0;
    }
    for (const [iid, d] of this.drag) {
      const item = this.sim.items.get(iid)!;
      if (d.joint && item.heldBy !== "goose") { w.removeImpulseJoint(d.joint, true); d.joint = null; }
      const p = d.body.translation();
      if (!item.heldBy || item.heldBy === "goose") item.pos = { x: p.x, z: p.z };
      if (!d.joint) d.freeT += dt;
      // someone else picked it up, or it has come to rest: back to the simulation
      if (!d.joint && ((item.heldBy && item.heldBy !== "goose") || d.body.isSleeping() || d.freeT > 4)) {
        w.removeRigidBody(d.body);
        this.drag.delete(iid);
      }
    }
  }

  // loose-item velocities (spec I-7 pushable physics objects, I-8 items float)
  private itemVel = new Map<string, V2>();
  private lastGoose: V2 | null = null;

  private itemPhysics(dt: number, goosePos: THREE.Vector3, gooseSpeed: number) {
    const g = { x: goosePos.x, z: goosePos.z };
    const gv = this.lastGoose ? { x: (g.x - this.lastGoose.x) / dt, z: (g.z - this.lastGoose.z) / dt } : { x: 0, z: 0 };
    this.lastGoose = g;
    for (const it of this.sim.items.values()) {
      if (it.heldBy || this.drag.has(it.id)) { this.itemVel.delete(it.id); continue; }
      const v = this.itemVel.get(it.id) ?? { x: 0, z: 0 };
      const kind = it.id.split("_")[0];
      // the goose body (radius 0.35 m) shoves what it walks into, along its own motion; only round
      // things roll away at a walk, so walking up to an item to grab it never pushes it out of reach
      const round = ROUND.has(kind);
      const dx = it.pos.x - g.x, dz = it.pos.z - g.z, d = Math.hypot(dx, dz);
      if (d < 0.45 && gooseSpeed > (round ? 0.3 : 3) && it.weight === "carry") {
        const k = round ? 1.4 : 0.8;
        v.x += (gv.x * k + (dx / (d || 1)) * 0.6 - v.x) * 0.5;
        v.z += (gv.z * k + (dz / (d || 1)) * 0.6 - v.z) * 0.5;
      }
      const wet = this.isWater(it.pos.x, it.pos.z);
      if (round && !wet) {
        // rolls down the local slope
        const h = 0.5, sx = (this.heightAt(it.pos.x + h, it.pos.z) - this.heightAt(it.pos.x - h, it.pos.z)) / (2 * h);
        const sz = (this.heightAt(it.pos.x, it.pos.z + h) - this.heightAt(it.pos.x, it.pos.z - h)) / (2 * h);
        if (Number.isFinite(sx) && Number.isFinite(sz)) { v.x -= sx * 6 * dt; v.z -= sz * 6 * dt; }
      }
      if (wet) { v.x += (0.18 - v.x) * dt * 0.5; v.z += (0.08 - v.z) * dt * 0.5; }   // a slow drift on the water
      const friction = wet ? 0.4 : round ? 1.2 : 5;
      const f = Math.exp(-friction * dt);
      v.x *= f; v.z *= f;
      const sp = Math.hypot(v.x, v.z);
      if (sp < 0.02 && !wet) { this.itemVel.delete(it.id); continue; }
      const nx = it.pos.x + v.x * dt, nz = it.pos.z + v.z * dt;
      // stop against walls
      if (this.lineOfSight(it.pos, { x: nx + Math.sign(v.x) * 0.2, z: nz + Math.sign(v.z) * 0.2 })) { it.pos.x = nx; it.pos.z = nz; }
      else { v.x *= -0.3; v.z *= -0.3; }
      this.itemVel.set(it.id, v);
    }
  }

  /** Shards for a shattered item: a few pieces that hop out and fade in about a second. */
  private shards: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  private shatter(id: string) {
    smash();
    const at = this.items.get(id)!.position.clone();
    const geo = SHARD;
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(geo, this.items.get(id)!.material as THREE.Material);
      m.position.copy(at).setY(at.y + 0.1);
      const a = (k / 7) * Math.PI * 2;
      this.root.add(m);
      this.shards.push({ m, v: new THREE.Vector3(Math.cos(a) * 1.4, 2.2 + (k % 3) * 0.4, Math.sin(a) * 1.4), t: 0 });
    }
  }

  private updateShards(dt: number) {
    for (let k = this.shards.length - 1; k >= 0; k--) {
      const s = this.shards[k];
      s.t += dt;
      s.v.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.v, dt);
      const floor = this.ground(s.m.position.x, s.m.position.z) + 0.03;
      if (s.m.position.y < floor) { s.m.position.y = floor; s.v.multiplyScalar(0.3); }
      s.m.rotation.x += dt * 9;
      if (s.t > 1.2) { this.root.remove(s.m); this.shards.splice(k, 1); }
    }
  }

  /** Sync meshes to the simulation (call once per rendered frame). */
  private gooseHead = new THREE.Vector3();
  // carried-item pendulum (spec I-6): swing angle and velocity about two axes, driven by bill acceleration
  private swing = { ax: 0, az: 0, vx: 0, vz: 0, last: new THREE.Vector3(), vel: new THREE.Vector3() };

  sync(dt: number, t: number, camera: THREE.Camera, gooseBill: THREE.Vector3) {
    this.gooseHead.copy(gooseBill);
    this.updateShards(dt);
    for (const n of this.sim.npcs.values()) {
      const r = this.people.get(n.id)!;
      const prev = this.lastPos.get(n.id) ?? n.pos;
      const speed = Math.hypot(n.pos.x - prev.x, n.pos.z - prev.z) / (1 / 60);
      // where the chunk is not loaded there is no ground to stand on: hide the person rather than sink them to y = 0
      r.root.visible = Number.isFinite(this.heightAt(n.pos.x, n.pos.z));
      r.root.position.set(n.pos.x, this.ground(n.pos.x, n.pos.z), n.pos.z);
      // sim facing is counter-clockwise from +x toward +z; people face +z locally
      r.root.rotation.y = Math.PI / 2 - n.facing;
      animatePerson(r, n, speed, dt, t, camera, this.gooseHead);
    }
    const hand = new THREE.Vector3();
    for (const it of this.sim.items.values()) {
      const m = this.items.get(it.id)!;
      if (it.heldBy === BROKEN) { m.visible = false; continue; }
      m.visible = true;
      if (it.heldBy === WORN && this.gooseHeadGroup) {
        if (m.parent !== this.gooseHeadGroup) {
          this.gooseHeadGroup.add(m);
          m.position.set(0, 0.045, 0.01);
          m.rotation.set(-0.15, 0, 0);
          m.scale.setScalar(0.55);
        }
        continue;
      }
      if (m.parent !== this.root) { this.root.add(m); m.scale.setScalar(ITEM_SCALE); }
      const d = this.drag.get(it.id);
      if (d) {
        // the mesh origin is at its base: offset down from the body centre along the body's up
        const p = d.body.translation(), q = d.body.rotation();
        m.quaternion.set(q.x, q.y, q.z, q.w);
        m.position.set(p.x, p.y, p.z).add(new THREE.Vector3(0, -d.hy, 0).applyQuaternion(m.quaternion));
        continue;
      }
      if (it.heldBy === "goose") {
        m.position.copy(gooseBill).add(new THREE.Vector3(0, -0.06, 0));
        const sw = this.swing;
        const v = gooseBill.clone().sub(sw.last).divideScalar(Math.max(dt, 1e-3));
        const acc = v.clone().sub(sw.vel).divideScalar(Math.max(dt, 1e-3));
        sw.last.copy(gooseBill); sw.vel.copy(v);
        // damped spring pendulum: acceleration kicks it, gravity pulls it back
        sw.vx += (-acc.z * 0.02 - sw.ax * 40 - sw.vx * 4) * dt;
        sw.vz += (acc.x * 0.02 - sw.az * 40 - sw.vz * 4) * dt;
        sw.ax = THREE.MathUtils.clamp(sw.ax + sw.vx * dt, -0.9, 0.9);
        sw.az = THREE.MathUtils.clamp(sw.az + sw.vz * dt, -0.9, 0.9);
        m.rotation.set(sw.ax, m.rotation.y, sw.az);
        if (it.weight === "drag") { m.position.y = this.ground(it.pos.x, it.pos.z); m.rotation.set(0, m.rotation.y, 0); }
      } else if (it.heldBy) {
        this.people.get(it.heldBy)!.hand.getWorldPosition(hand);
        m.position.copy(hand);
      } else {
        const v = this.itemVel.get(it.id);
        if (v && ROUND.has(it.id.split("_")[0])) m.rotation.x += Math.hypot(v.x, v.z) * dt / 0.05;   // rolling
        else m.rotation.set(0, m.rotation.y, 0);
        m.visible = Number.isFinite(this.heightAt(it.pos.x, it.pos.z));
        const y = this.ground(it.pos.x, it.pos.z);
        const bob = this.isWater(it.pos.x, it.pos.z) ? Math.sin(t * 2 + it.pos.x) * 0.03 : 0;
        m.position.set(it.pos.x, y + bob, it.pos.z);
      }
    }
  }

  unlocked(t: Task) {
    return !t.gate || this.tasks.filter((o) => o.hotspot === t.hotspot && o !== t && o.done).length >= t.gate;
  }

  private score(e: SimEvent) {
    const m = this.menace, t = this.sim.t;
    switch (e.type) {
      case "noticed": if (e.what === "honk") m.add("honk_wonder", t, e.npc); break;
      case "drop": m.add("honk_drop", t, e.npc); break;
      case "tug": if (e.won) m.add("steal_hand", t, e.npc); break;
      case "fall": m.add("slapstick", t, e.npc); break;
      case "broke": m.add("smash", t); break;
      case "snatched": m.bail(); break;
      case "giveup": if (this.sim.goose.hidden) m.add("lose_chaser", t, e.npc); break;
      case "release": {
        const it = this.sim.items.get(e.item)!;
        if (this.isWater(it.pos.x, it.pos.z)) m.add("into_water", t);
        break;
      }
    }
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

  /** Attention target for the goose head: a free item within 1.3 m, else the nearest person within 8 m. */
  attention(gx: number, gz: number): { point: THREE.Vector3; kind: "item" | "person" } | null {
    const bill = this.sim.goose.bill ?? { x: gx, z: gz };
    let best: { point: THREE.Vector3; kind: "item" | "person" } | null = null, bd = 1.3;
    if (!this.sim.goose.holding) {
      for (const it of this.sim.items.values()) {
        if (it.heldBy) continue;
        // items are judged from the bill, like the grab itself; people from the body
        const d = Math.hypot(it.pos.x - bill.x, it.pos.z - bill.z);
        if (d < bd) { bd = d; best = { point: this.items.get(it.id)!.position.clone(), kind: "item" }; }
      }
    }
    if (best) return best;
    bd = 8;
    for (const n of this.sim.npcs.values()) {
      const d = Math.hypot(n.pos.x - gx, n.pos.z - gz);
      if (d < bd) { bd = d; const r = this.people.get(n.id)!; best = { point: r.root.position.clone().setY(r.root.position.y + 1.6), kind: "person" }; }
    }
    return best;
  }

  heldWeight(): "carry" | "drag" | null {
    const id = this.sim.goose.holding;
    return id ? this.sim.items.get(id)!.weight : null;
  }

  /** Nearest takeable item within reach of the goose (for the grab prompt). */
  nearestItem(): string | null {
    let best: string | null = null, bd = 0.9;
    for (const it of this.sim.items.values()) {
      if (it.heldBy) continue;
      const from = this.sim.goose.bill ?? this.sim.goose.pos;
      const d = Math.hypot(it.pos.x - from.x, it.pos.z - from.z);
      if (d < bd) { bd = d; best = it.name; }
    }
    return best;
  }
}

export const HOTSPOT_SEED = campus.seeds.sim;

/** "No Geese" sign that the area's characters put up after escalation (doc 03 R-N6, spec V-ANIM-8). */
function noGeeseSign(anchor: V2, heightAt: (x: number, z: number) => number): THREE.Object3D {
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = swatchHex("mark_bg", "items"); ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = swatchHex("shop_a", "signs"); ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(128, 110, 80, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = swatchHex("mark", "items");
  ctx.beginPath(); ctx.ellipse(118, 125, 34, 20, 0, 0, Math.PI * 2); ctx.fill();       // goose body
  ctx.fillRect(140, 70, 9, 50); ctx.beginPath(); ctx.arc(146, 68, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = swatchHex("shop_a", "signs"); ctx.beginPath(); ctx.moveTo(72, 54); ctx.lineTo(184, 166); ctx.stroke();
  ctx.fillStyle = swatchHex("mark", "items"); ctx.font = "800 38px ui-rounded, Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("NO GEESE", 128, 238);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshToonNodeMaterial();
  face.map = tex;
  const post = new THREE.MeshToonNodeMaterial();
  post.color = swatch("prop_metal");
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8).translate(0, 0.8, 0), post));
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8).translate(0, 1.75, 0.05), face));
  g.position.set(anchor.x + 2, heightAt(anchor.x + 2, anchor.z + 2) || 0, anchor.z + 2);
  g.name = "no_geese_sign";
  return g;
}
