import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { swatch } from "@/config";
import type { Network } from "@/nav/graph";

/**
 * The ION light-rail train (doc 02 section 3): a three-car rounded vehicle shuttling along the OSM
 * light_rail line through the University of Waterloo station, pausing at the station. Decorative only.
 */
const CAR_M = 9.5;
const GAP_M = 0.6;
const SPEED = 9;          // m/s
const DWELL_S = 12;

function colored(g: THREE.BufferGeometry, color: string) {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  const c = swatch(color), n = ng.getAttribute("position").count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) a.set([c.r, c.g, c.b], k * 3);
  ng.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return ng;
}

function carGeometry() {
  const body = new THREE.CapsuleGeometry(1.35, CAR_M - 2.7, 4, 10).rotateX(Math.PI / 2).scale(1, 1.15, 1).translate(0, 1.9, 0);
  const band = new THREE.BoxGeometry(2.75, 0.9, CAR_M - 0.8).translate(0, 2.25, 0);
  const stripe = new THREE.BoxGeometry(2.76, 0.18, CAR_M - 0.6).translate(0, 1.35, 0);
  const bogie = (z: number) => new THREE.BoxGeometry(2.0, 0.5, 2.0).translate(0, 0.35, z);
  return mergeGeometries([colored(body, "ion_train"), colored(band, "window_dark"), colored(stripe, "ion_accent"),
    colored(bogie(-CAR_M * 0.3), "prop_metal"), colored(bogie(CAR_M * 0.3), "prop_metal")]);
}

export class IonTrain {
  readonly root = new THREE.Group();
  private line: THREE.Vector2[] = [];
  private cum: number[] = [];
  private s = 0;
  private dir = 1;
  private wait = 0;
  private stationS = 0;
  private cars: THREE.Mesh[] = [];

  constructor(net: Network, material: THREE.Material, private heightAt: (x: number, z: number) => number) {
    this.root.name = "ion_train";
    // chain the light_rail ways end to end, starting from the line's northern end
    const ways = net.ways.filter((w) => w.kind === "light_rail" && w.pts.length > 1).map((w) => w.pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const key = (p: THREE.Vector2) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const ends = new Map<string, number>();
    ways.forEach((w) => { for (const p of [w[0], w[w.length - 1]]) ends.set(key(p), (ends.get(key(p)) ?? 0) + 1); });
    let cur = ways.find((w) => ends.get(key(w[0])) === 1 || ends.get(key(w[w.length - 1])) === 1);
    const used = new Set<THREE.Vector2[]>();
    if (cur && ends.get(key(cur[0])) !== 1) cur = [...cur].reverse();
    while (cur) {
      used.add(cur);
      for (const p of cur) if (!this.line.length || this.line[this.line.length - 1].distanceTo(p) > 0.01) this.line.push(p);
      const tail = key(this.line[this.line.length - 1]);
      const next = ways.find((w) => !used.has(w) && (key(w[0]) === tail || key(w[w.length - 1]) === tail));
      cur = next ? (key(next[0]) === tail ? next : [...next].reverse()) : undefined;
      if (next) used.add(next);
    }
    this.cum = [0];
    for (let k = 1; k < this.line.length; k++) this.cum.push(this.cum[k - 1] + this.line[k].distanceTo(this.line[k - 1]));
    const st = net.stations.find((s) => s.name === "University of Waterloo");
    if (st && this.line.length) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < this.line.length; k++) {
        const d = this.line[k].distanceTo(new THREE.Vector2(st.pos[0], st.pos[1]));
        if (d < bd) { bd = d; best = k; }
      }
      this.stationS = this.cum[best];
      this.s = this.stationS;
    }
    const geo = carGeometry();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true;
      m.receiveShadow = true;
      this.cars.push(m);
      this.root.add(m);
    }
  }

  private at(s: number) {
    const L = this.cum[this.cum.length - 1];
    const t = Math.min(Math.max(s, 0), L);
    let k = 1;
    while (k < this.cum.length - 1 && this.cum[k] < t) k++;
    const a = this.line[k - 1], b = this.line[k];
    const f = (t - this.cum[k - 1]) / Math.max(this.cum[k] - this.cum[k - 1], 1e-6);
    return { p: a.clone().lerp(b, f), heading: Math.atan2(b.x - a.x, b.y - a.y) };
  }

  update(dt: number) {
    if (this.line.length < 2) return;
    const L = this.cum[this.cum.length - 1];
    if (this.wait > 0) this.wait -= dt;
    else {
      const before = this.s;
      this.s += this.dir * SPEED * dt;
      const crossed = (before - this.stationS) * (this.s - this.stationS) <= 0 && before !== this.stationS;
      if (crossed) { this.s = this.stationS; this.wait = DWELL_S; }
      const span = 3 * (CAR_M + GAP_M);
      if (this.s > L - span || this.s < span) { this.dir *= -1; this.s = THREE.MathUtils.clamp(this.s, span, L - span); }
    }
    this.cars.forEach((car, k) => {
      const { p, heading } = this.at(this.s - this.dir * k * (CAR_M + GAP_M));
      const y = this.heightAt(p.x, p.y);
      car.visible = Number.isFinite(y);
      car.position.set(p.x, Number.isFinite(y) ? y + 0.3 : 0, p.y);
      car.rotation.y = heading;
    });
  }
}
