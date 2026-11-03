import * as THREE from "three/webgpu";
import type { WalkGraph } from "@/nav/graph";
import { rngStream } from "@/sim/sim";
import { type PersonLook, personGeometry } from "./actors";

/**
 * Tier B ambient students (doc 05 section 3.2): walk A* routes on the OSM pedestrian graph around
 * the goose; a close honk startles them (70% flee for 4 s, 30% stop and film it on a phone); the
 * goose within 2 m makes them sidestep. Drawn as instanced static figures with a walking bob.
 */
const LOOKS: PersonLook[] = [
  { skin: "skin_a", hair: "hair_brown", top: "cloth_gold", bottom: "denim", style: "long" },
  { skin: "skin_b", hair: "hair_dark", top: "cloth_navy", bottom: "cloth_black" },
  { skin: "skin_c", hair: "hair_dark", top: "cloth_red", bottom: "cloth_grey", style: "bun", build: "slim" },
  { skin: "skin_d", hair: "hair_blond", top: "cloth_green", bottom: "denim", over: "cloth_cream" },
  { skin: "skin_a", hair: "hair_dark", top: "cloth_cream", bottom: "cloth_navy", style: "long", build: "slim" },
  { skin: "skin_b", hair: "hair_brown", top: "cloth_grey", bottom: "denim", over: "cloth_gold", build: "stout" },
  { skin: "skin_c", hair: "hair_grey", top: "cloth_navy", bottom: "cloth_grey", style: "bald", over: "cloth_cream" },
  { skin: "skin_d", hair: "hair_brown", top: "cloth_red", bottom: "denim", style: "short" },
];
const SPAWN_R = 110;
const STARTLE_R = 6;
const SIDESTEP_R = 2;

interface Walker { route: [number, number][]; idx: number; x: number; z: number; speed: number; look: number;
  phase: number; mode: "walk" | "flee" | "film"; modeT: number; fx: number; fz: number; facing: number; lane: number }

export class AmbientCrowd {
  readonly root = new THREE.Group();
  private meshes: THREE.InstancedMesh[];
  private walkers: Walker[] = [];
  private rng: () => number;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private cap: number;

  constructor(private graph: WalkGraph, private heightAt: (x: number, z: number) => number,
    material: THREE.Material, private count: number, seed: number) {
    this.rng = rngStream(seed);
    this.cap = Math.ceil((count / LOOKS.length) * 1.6);
    this.root.name = "ambient";
    this.meshes = LOOKS.map((look) => {
      // full capacity from the start (the WebGPU backend sizes instance buffers on first use);
      // unused slots get a zero-scale matrix
      const im = new THREE.InstancedMesh(personGeometry(look), material, this.cap);
      im.castShadow = true;
      im.frustumCulled = false;
      this.root.add(im);
      return im;
    });
  }

  private spawn(cx: number, cz: number): Walker | null {
    const starts = this.graph.near(cx, cz, SPAWN_R);
    for (let tries = 0; tries < 6 && starts.length; tries++) {
      const a = starts[Math.floor(this.rng() * starts.length)];
      const [ax, az] = this.graph.pos.get(a)!;
      const ends = this.graph.near(ax, az, 220).filter((id) => {
        const [bx, bz] = this.graph.pos.get(id)!;
        return Math.hypot(bx - ax, bz - az) > 60;
      });
      if (!ends.length) continue;
      const route = this.graph.route(a, ends[Math.floor(this.rng() * ends.length)]);
      if (!route || route.length < 2) continue;
      // start part-way along so the crowd does not pop in at nodes all at once
      const idx = Math.floor(this.rng() * (route.length - 1));
      return { route, idx: idx + 1, x: route[idx][0], z: route[idx][1], speed: 1.1 + this.rng() * 0.5,
        look: Math.floor(this.rng() * LOOKS.length), phase: this.rng() * 10, mode: "walk", modeT: 0, fx: 0, fz: 0, facing: 0,
        lane: (this.rng() - 0.5) * 1.6 };
    }
    return null;
  }

  get size() { return this.walkers.length; }

  honkAt(x: number, z: number) {
    for (const w of this.walkers) {
      const d = Math.hypot(w.x - x, w.z - z);
      if (d > STARTLE_R) continue;
      const flee = this.rng() < 0.7;
      w.mode = flee ? "flee" : "film";
      w.modeT = flee ? 4 : 3;
      w.fx = (w.x - x) / (d || 1);
      w.fz = (w.z - z) / (d || 1);
    }
  }

  update(dt: number, gx: number, gz: number) {
    while (this.walkers.length < this.count) {
      const w = this.spawn(gx, gz);
      if (!w) break;
      this.walkers.push(w);
    }
    for (let k = this.walkers.length - 1; k >= 0; k--) {
      const w = this.walkers[k];
      if (Math.hypot(w.x - gx, w.z - gz) > SPAWN_R * 1.4) { this.walkers.splice(k, 1); continue; }
      let vx = 0, vz = 0;
      if (w.mode === "flee") {
        vx = w.fx * 3.6; vz = w.fz * 3.6;
      } else if (w.mode === "film") {
        w.facing = Math.atan2(gx - w.x, gz - w.z);
      } else {
        // walk a personal lane beside the centreline so people pass side by side instead of in file
        const [rx, rz] = w.route[w.idx], [px, pz] = w.route[w.idx - 1] ?? w.route[w.idx];
        const sl = Math.hypot(rx - px, rz - pz) || 1;
        const tx = rx + (-(rz - pz) / sl) * w.lane, tz = rz + ((rx - px) / sl) * w.lane;
        const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
        if (d < 0.4) {
          w.idx++;
          if (w.idx >= w.route.length) { this.walkers.splice(k, 1); continue; }
        } else { vx = (dx / d) * w.speed; vz = (dz / d) * w.speed; }
        const gd = Math.hypot(w.x - gx, w.z - gz);
        if (gd < SIDESTEP_R) { vx += ((w.x - gx) / gd) * 1.5; vz += ((w.z - gz) / gd) * 1.5; }
      }
      if (w.mode !== "walk" && (w.modeT -= dt) <= 0) w.mode = "walk";
      w.x += vx * dt;
      w.z += vz * dt;
      const sp = Math.hypot(vx, vz);
      if (sp > 0.05) w.facing = Math.atan2(vx, vz);
      w.phase += dt * sp * 3.5;
    }
    const counts = new Array(LOOKS.length).fill(0);
    for (const w of this.walkers) {
      if (counts[w.look] >= this.cap) continue;
      const im = this.meshes[w.look];
      const y = this.heightAt(w.x, w.z);
      this.q.setFromAxisAngle(this.up, w.facing);
      const bob = Math.abs(Math.sin(w.phase)) * 0.05;
      this.m.compose(new THREE.Vector3(w.x, (Number.isFinite(y) ? y : 0) + bob, w.z), this.q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(counts[w.look]++, this.m);
    }
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    this.meshes.forEach((im, k) => {
      for (let i = counts[k]; i < this.cap; i++) im.setMatrixAt(i, hidden);
      im.instanceMatrix.needsUpdate = true;
    });
  }
}
