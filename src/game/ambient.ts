import * as THREE from "three/webgpu";
import {
  attribute, cos, float, floor, Fn, int, ivec2, max, mix, mod, normalize, normalLocal, pow, select, sin,
  textureLoad, varying, vec3, vec4,
} from "three/tsl";
import type { WalkGraph } from "@/nav/graph";
import { palette } from "@/config";
import { rngStream } from "@/sim/sim";
import { type Body, type HairStyle, type HatKind, personModel, RUN_STRIDE, SLOT, WALK_STRIDE } from "./actors";

/**
 * Tier B ambient students (doc 05 section 3.2): walk A* routes on the OSM pedestrian graph around
 * the goose; a close honk startles them (70% flee for 4 s, 30% stop and film it on a phone); the
 * goose within 2 m makes them sidestep.
 *
 * They are the same Blender people as the hotspot characters, drawn cheaply: each crowd type (body,
 * hair, hat) is one instanced mesh per LOD whose vertices read their pose from a baked vertex
 * animation texture (walk, run, idle and phone cycles sampled from the skinned clips at load), so a
 * few hundred people cost a couple of dozen draw calls and no CPU skinning. The walk cycle advances
 * with the distance walked (stride from the clip), so feet stay planted; every instance has its own
 * clothing colours (per-slot swatches decoded in the shader) and a little height variation.
 */
const TYPES: { body: Body; hair: HairStyle; hat?: HatKind }[] = [
  { body: "hoodie", hair: "short" }, { body: "hoodie", hair: "ponytail" }, { body: "backpack", hair: "curly" },
  { body: "backpack", hair: "short" }, { body: "backpack", hair: "long" }, { body: "dress", hair: "long" },
  { body: "dress", hair: "bun" }, { body: "puffer", hair: "buzz", hat: "toque" }, { body: "puffer", hair: "long" },
  { body: "tee", hair: "short", hat: "cap" }, { body: "tee", hair: "ponytail" }, { body: "coat", hair: "bald" },
];
// palette choices per slot (Waterloo in term: hoodies and puffers in every colour, lots of denim)
const SKINS = ["skin_a", "skin_b", "skin_c", "skin_d", "skin_e", "skin_f"];
const HAIRS = ["hair_dark", "hair_dark", "hair_black", "hair_black", "hair_brown", "hair_brown", "hair_blond", "hair_auburn", "hair_grey"];
const TOPS = ["cloth_gold", "cloth_navy", "cloth_red", "cloth_green", "cloth_grey", "cloth_cream", "cloth_black", "cloth_purple",
  "cloth_maroon", "cloth_teal", "cloth_olive", "cloth_pink", "cloth_white", "cloth_khaki"];
const BOTTOMS = ["denim", "denim", "denim", "cloth_black", "cloth_black", "cloth_grey", "cloth_navy", "cloth_khaki"];
const ACCS = ["bag_black", "bag_black", "cloth_navy", "cloth_red", "cloth_green", "cloth_purple", "cloth_gold", "cloth_grey"];
const HATS = ["cloth_red", "cloth_maroon", "cloth_navy", "cloth_gold", "cloth_purple", "cloth_green", "cloth_black"];

/** VAT rows: each clip sampled at a few poses (positions are interpolated between them) */
const CLIPS: { name: string; samples: number }[] = [{ name: "walk", samples: 12 }, { name: "run", samples: 10 },
  { name: "idle", samples: 12 }, { name: "phone", samples: 1 }];
const LOD_NEAR_M = 22;

const SPAWN_R = 110;
const STARTLE_R = 6;
const SEPARATION_M = 0.55;
const SIDESTEP_R = 2;
const FLOATS = 16;   // per instance: pos+yaw, anim, colours 0-3, colours 4-7

interface Walker { route: [number, number][]; idx: number; x: number; z: number; speed: number; type: number;
  phase: number; mode: "walk" | "flee" | "film"; modeT: number; fx: number; fz: number; facing: number; lane: number;
  scale: number; cols: Colourway; sp: number }

/** packed slot swatches: [skin, hair, top, bottom], [over, shoes, acc, hat] */
type Colourway = [number[], number[]];

interface Vat { pos: THREE.DataTexture; nrm: THREE.DataTexture; bodyVerts: number; rows: Map<string, [number, number]> }
interface CrowdMesh { mesh: THREE.Mesh; data: Float32Array; buf: THREE.InstancedInterleavedBuffer; geo: THREE.InstancedBufferGeometry }

/** sRGB 8-bit triple packed into one float (exact below 2^24); the shader unpacks and linearises */
function packSwatch(name: string): number {
  const hex = (palette.people as Record<string, string>)[name];
  if (!hex) throw new Error(`palette has no people.${name}`);
  return parseInt(hex.slice(1), 16);
}

/**
 * Bake one body (one LOD) into vertex animation textures: every clip sample's skinned vertex
 * positions and normals, plus the head bone's motion (three texels per row) for the rigid hair and
 * hat. Returns the textures and, per type, a merged geometry of body + hair + hat.
 */
function bake(body: Body, lod: 0 | 1, parts: string[][]): { vat: Vat; geos: THREE.BufferGeometry[] } | null {
  const pm = personModel(body);
  if (!pm) return null;
  // the loaded scene itself is posed for the bake and put back in its bind pose afterwards (the
  // hotspot characters are SkeletonUtils clones with their own bones)
  const root = pm.gltf.scene;
  const suffix = lod ? "_lod1" : "";
  const meshes = new Map<string, THREE.SkinnedMesh>();
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.set(o.name, o as THREE.SkinnedMesh); });
  const bodyMesh = meshes.get(`body${suffix}`)!;
  const head = root.getObjectByName("head")!;
  const mixer = new THREE.AnimationMixer(root);
  const nV = bodyMesh.geometry.getAttribute("position").count;
  const W = nV + 3, H = CLIPS.reduce((s, c) => s + c.samples, 0);
  const pos = new Float32Array(W * H * 4), nrm = new Float32Array(W * H * 4);
  const rows = new Map<string, [number, number]>();
  const skin = new Float32Array(17 * 16 * 2);
  const m4 = new THREE.Matrix4(), headRestInv = new THREE.Matrix4();
  // skinning matrices for one mesh: meshWorld * bindInv * boneWorld * boneInv * bind (column-major)
  const skinMats = (mesh: THREE.SkinnedMesh) => {
    const bones = mesh.skeleton.bones, inv = mesh.skeleton.boneInverses;
    for (let j = 0; j < bones.length; j++) {
      m4.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse).multiply(bones[j].matrixWorld).multiply(inv[j]).multiply(mesh.bindMatrix);
      m4.toArray(skin, j * 16);
    }
  };
  const skinVertex = (g: THREE.BufferGeometry, i: number, out: Float32Array, o: number, normal: Float32Array, no: number) => {
    const P = g.getAttribute("position"), N = g.getAttribute("normal");
    const si = g.getAttribute("skinIndex"), sw = g.getAttribute("skinWeight");
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
    for (let c = 0; c < 4; c++) {
      const w = sw.getComponent(i, c);
      if (!w) continue;
      const b = si.getComponent(i, c) * 16;
      const e = skin;
      px += w * (e[b] * x + e[b + 4] * y + e[b + 8] * z + e[b + 12]);
      py += w * (e[b + 1] * x + e[b + 5] * y + e[b + 9] * z + e[b + 13]);
      pz += w * (e[b + 2] * x + e[b + 6] * y + e[b + 10] * z + e[b + 14]);
      qx += w * (e[b] * nx + e[b + 4] * ny + e[b + 8] * nz);
      qy += w * (e[b + 1] * nx + e[b + 5] * ny + e[b + 9] * nz);
      qz += w * (e[b + 2] * nx + e[b + 6] * ny + e[b + 10] * nz);
    }
    const l = Math.hypot(qx, qy, qz) || 1;
    out[o] = px; out[o + 1] = py; out[o + 2] = pz; out[o + 3] = 1;
    normal[no] = qx / l; normal[no + 1] = qy / l; normal[no + 2] = qz / l; normal[no + 3] = 0;
  };
  // rest pose: the bones as loaded (Skeleton.pose() must not be used: with quantised meshes every
  // mesh's inverse bind matrices carry its own dequantisation scale, so it would scale the bones)
  const saved: [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3][] = [];
  root.traverse((o) => { if ((o as THREE.Bone).isBone) saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  const restore = () => { for (const [o, p, q, sc] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); } };
  root.updateMatrixWorld(true);
  headRestInv.copy(head.matrixWorld).invert();
  const rigid = (name: string) => {
    const mesh = meshes.get(name)!;
    mesh.updateMatrixWorld(true);
    skinMats(mesh);
    const g = mesh.geometry, n = g.getAttribute("position").count;
    const p = new Float32Array(n * 4), q = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) skinVertex(g, i, p, i * 4, q, i * 4);
    return { g, p, q, n };
  };
  const rigidCache = new Map<string, ReturnType<typeof rigid>>();
  for (const names of parts) for (const nm of names.slice(1)) if (!rigidCache.has(nm)) rigidCache.set(nm, rigid(nm));
  // the clip samples
  let row = 0;
  for (const c of CLIPS) {
    const clip = pm.full.get(c.name)!;
    rows.set(c.name, [row, c.samples]);
    const action = mixer.clipAction(clip);
    action.play();
    for (let s = 0; s < c.samples; s++, row++) {
      action.time = (s / c.samples) * clip.duration;
      mixer.update(0);
      root.updateMatrixWorld(true);
      skinMats(bodyMesh);
      const g = bodyMesh.geometry;
      for (let i = 0; i < nV; i++) skinVertex(g, i, pos, (row * W + i) * 4, nrm, (row * W + i) * 4);
      m4.multiplyMatrices(head.matrixWorld, headRestInv);
      const e = m4.elements;
      for (let r = 0; r < 3; r++) pos.set([e[r], e[r + 4], e[r + 8], e[r + 12]], (row * W + nV + r) * 4);
    }
    action.stop();
  }
  mixer.uncacheRoot(root);
  restore();
  root.updateMatrixWorld(true);
  const tex = (a: Float32Array) => {
    const half = new Uint16Array(a.length);
    for (let i = 0; i < a.length; i++) half[i] = THREE.DataUtils.toHalfFloat(a[i]);
    const t = new THREE.DataTexture(half, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const vat: Vat = { pos: tex(pos), nrm: tex(nrm), bodyVerts: nV, rows };
  // per type: body (VAT columns) + rigid parts (rest positions, head motion)
  const geos = parts.map((names) => {
    const pieces: { g: THREE.BufferGeometry; p: Float32Array; q: Float32Array; n: number; col: boolean }[] = [];
    const bg = bodyMesh.geometry;
    pieces.push({ g: bg, p: pos.subarray(0, nV * 4), q: nrm.subarray(0, nV * 4), n: nV, col: true });
    for (const nm of names.slice(1)) { const r = rigidCache.get(nm)!; pieces.push({ ...r, col: false }); }
    const total = pieces.reduce((s, x) => s + x.n, 0);
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 4);
    const S = new Float32Array(total), VC = new Float32Array(total);
    const index: number[] = [];
    let base = 0;
    for (const pc of pieces) {
      const uv = pc.g.getAttribute("uv"), col = pc.g.getAttribute("color");
      for (let i = 0; i < pc.n; i++) {
        const k = base + i;
        P.set([pc.p[i * 4], pc.p[i * 4 + 1], pc.p[i * 4 + 2]], k * 3);
        N.set([pc.q[i * 4], pc.q[i * 4 + 1], pc.q[i * 4 + 2]], k * 3);
        C.set([col.getX(i), col.getY(i), col.getZ(i), 1], k * 4);
        S[k] = Math.floor(uv.getX(i) * 16);
        VC[k] = pc.col ? i : -1;
      }
      const idx = pc.g.getIndex()!;
      for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + base);
      base += pc.n;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    g.setAttribute("color", new THREE.BufferAttribute(C, 4));
    g.setAttribute("slot", new THREE.BufferAttribute(S, 1));
    g.setAttribute("vcol", new THREE.BufferAttribute(VC, 1));
    g.setIndex(index);
    return g;
  });
  return { vat, geos };
}

/** The crowd material: VAT pose, per-instance placement and clothing colours. */
// TSL graphs are built from loosely typed nodes here (the typings cannot follow the swizzles)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;
function crowdMaterial(vat: Vat): THREE.MeshToonNodeMaterial {
  const m = new THREE.MeshToonNodeMaterial();
  const iPos: N = attribute("iPos", "vec4"), iAnim: N = attribute("iAnim", "vec4");
  const iCol0: N = attribute("iCol0", "vec4"), iCol1: N = attribute("iCol1", "vec4");
  const sample = (tex: THREE.DataTexture, col: N, row: N): N => (textureLoad as N)(tex, ivec2(int(col), int(row)));
  m.positionNode = (Fn as N)(() => {
    const f: N = iAnim.z.mul(iAnim.y);
    const f0: N = floor(f), fr: N = f.sub(f0);
    const r0: N = iAnim.x.add(f0), r1: N = iAnim.x.add(mod(f0.add(1), iAnim.y));
    const vc: N = attribute("vcol", "float");
    const ci: N = max(vc, float(0));
    const bodyP: N = mix(sample(vat.pos, ci, r0).xyz, sample(vat.pos, ci, r1).xyz, fr);
    const bodyN: N = mix(sample(vat.nrm, ci, r0).xyz, sample(vat.nrm, ci, r1).xyz, fr);
    // rigid hair and hat: rest position moved with the head (three texels: rows of a 3x4 matrix)
    const hc: N = float(vat.bodyVerts);
    const rest: N = vec4(attribute("position", "vec3"), 1), restN: N = vec4(attribute("normal", "vec3"), 0);
    const rig = (row: N, v: N): N => vec3(sample(vat.pos, hc, row).dot(v), sample(vat.pos, hc.add(1), row).dot(v),
      sample(vat.pos, hc.add(2), row).dot(v));
    const rigidP: N = mix(rig(r0, rest), rig(r1, rest), fr);
    const rigidN: N = mix(rig(r0, restN), rig(r1, restN), fr);
    const isRigid: N = vc.lessThan(0);
    const p: N = (select as N)(isRigid, rigidP, bodyP).mul(iAnim.w);
    const n: N = normalize((select as N)(isRigid, rigidN, bodyN));
    const c: N = cos(iPos.w), s: N = sin(iPos.w);
    normalLocal.assign(vec3(n.x.mul(c).add(n.z.mul(s)), n.y, n.z.mul(c).sub(n.x.mul(s))));
    return vec3(p.x.mul(c).add(p.z.mul(s)), p.y, p.z.mul(c).sub(p.x.mul(s))).add(iPos.xyz);
  })();
  // slot colours: sRGB bytes packed in floats, decoded per vertex and linearised
  const unpack = (v: N): N => pow(vec3(floor(v.div(65536)), mod(floor(v.div(256)), 256), mod(v, 256)).div(255), vec3(2.2));
  const slot: N = attribute("slot", "float");
  const fixed: N = attribute("color", "vec4").xyz;
  const pick = (k: number, a: N, b: N): N => (select as N)(slot.equal(k), a, b);
  const colour: N = pick(SLOT.skin, unpack(iCol0.x), pick(SLOT.hair, unpack(iCol0.y), pick(SLOT.top, unpack(iCol0.z),
    pick(SLOT.bottom, unpack(iCol0.w), pick(SLOT.over, unpack(iCol1.x), pick(SLOT.shoes, unpack(iCol1.y),
      pick(SLOT.acc, unpack(iCol1.z), pick(SLOT.hat, unpack(iCol1.w), fixed))))))));
  m.colorNode = (varying as N)(colour);
  return m;
}

export class AmbientCrowd {
  readonly root = new THREE.Group();
  /** [type][lod] */
  private meshes: CrowdMesh[][] = [];
  private vats = new Map<string, Vat>();
  private grid = new Map<number, Walker[]>();
  private walkers: Walker[] = [];
  private rng: () => number;
  private cap: number;
  private cols: Colourway[][] = [];

  constructor(private graph: WalkGraph, private heightAt: (x: number, z: number) => number,
    _material: THREE.Material, public count: number, seed: number) {
    this.rng = rngStream(seed);
    this.cap = Math.ceil((count * 1.5 / TYPES.length) * 1.8);   // room for class-change surges
    this.root.name = "ambient";
    const t0 = performance.now();
    for (const lod of [0, 1] as const) {
      const byBody = new Map<Body, number[]>();
      TYPES.forEach((t, k) => byBody.set(t.body, [...(byBody.get(t.body) ?? []), k]));
      for (const [body, ks] of byBody) {
        const sfx = lod ? "_lod1" : "";
        const parts = ks.map((k) => [`body${sfx}`, `hair_${TYPES[k].hair}${sfx}`, ...(TYPES[k].hat ? [`hat_${TYPES[k].hat}${sfx}`] : [])]);
        let baked: ReturnType<typeof bake> = null;
        try { baked = bake(body, lod, parts); } catch (e) { console.warn(`[wgs] crowd ${body} could not be baked: ${(e as Error).message}`); }
        if (!baked) continue;   // no model: that crowd type is left out
        const { vat, geos } = baked;
        this.vats.set(`${body}${lod}`, vat);
        const mat = crowdMaterial(vat);
        ks.forEach((k, j) => {
          const geo = new THREE.InstancedBufferGeometry();
          const src = geos[j];
          for (const [name, a] of Object.entries(src.attributes)) geo.setAttribute(name, a);
          geo.setIndex(src.getIndex());
          // full capacity from the start (the WebGPU backend sizes instance buffers on first use)
          const data = new Float32Array(this.cap * FLOATS);
          const buf = new THREE.InstancedInterleavedBuffer(data, FLOATS, 1);
          buf.setUsage(THREE.DynamicDrawUsage);
          geo.setAttribute("iPos", new THREE.InterleavedBufferAttribute(buf, 4, 0));
          geo.setAttribute("iAnim", new THREE.InterleavedBufferAttribute(buf, 4, 4));
          geo.setAttribute("iCol0", new THREE.InterleavedBufferAttribute(buf, 4, 8));
          geo.setAttribute("iCol1", new THREE.InterleavedBufferAttribute(buf, 4, 12));
          geo.instanceCount = 0;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = `crowd_${TYPES[k].body}_${TYPES[k].hair}_lod${lod}`;
          this.root.add(mesh);
          (this.meshes[k] ??= [])[lod] = { mesh, data, buf, geo };
        });
      }
    }
    // a pool of colourways per type
    TYPES.forEach((t, k) => {
      const pickOf = (a: string[]) => a[Math.floor(this.rng() * a.length)];
      this.cols[k] = Array.from({ length: 24 }, () => {
        const top = pickOf(TOPS);
        const jacket = t.body === "backpack" || t.body === "coat";
        const over = jacket ? pickOf(TOPS.filter((c) => c !== top)) : t.body === "hoodie" ? top : pickOf(TOPS);
        const c0 = [pickOf(SKINS), pickOf(HAIRS), top, t.body === "dress" && this.rng() < 0.4 ? pickOf(SKINS) : pickOf(BOTTOMS)].map(packSwatch);
        const c1 = [over, "shoes", pickOf(ACCS), pickOf(HATS)].map(packSwatch);
        return [c0, c1] as Colourway;
      });
    });
    (globalThis as { __crowd?: unknown }).__crowd = this;   // debug handle
    console.log(`[wgs] crowd baked in ${(performance.now() - t0).toFixed(0)} ms`);
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
      const avail = this.available;
      if (!avail.length) return null;
      const type = avail[Math.floor(this.rng() * avail.length)];
      return { route, idx: idx + 1, x: route[idx][0], z: route[idx][1], speed: 1.1 + this.rng() * 0.5,
        type, phase: this.rng(), mode: "walk", modeT: 0, fx: 0, fz: 0, facing: 0,
        lane: (this.rng() - 0.5) * 1.6, scale: 0.92 + this.rng() * 0.16,
        cols: this.cols[type][Math.floor(this.rng() * 24)], sp: 0 };
    }
    return null;
  }

  get size() { return this.walkers.length; }

  /** crowd types whose meshes were baked (all of them unless a model failed to load) */
  private get available() { return TYPES.map((_, k) => k).filter((k) => this.meshes[k]?.[0] && this.meshes[k]?.[1]); }

  /** Startle walkers near a honk; returns how many fled. */
  honkAt(x: number, z: number): number {
    let fled = 0;
    for (const w of this.walkers) {
      const d = Math.hypot(w.x - x, w.z - z);
      if (d > STARTLE_R) continue;
      const flee = this.rng() < 0.7;
      if (flee) fled++;
      w.mode = flee ? "flee" : "film";
      w.modeT = flee ? 4 : 3;
      w.fx = (w.x - x) / (d || 1);
      w.fz = (w.z - z) / (d || 1);
    }
    return fled;
  }

  update(dt: number, gx: number, gz: number) {
    // walkers beyond the current target finish their routes and are not replaced
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
      w.sp = sp;
      if (sp > 0.05) {
        // turn toward the heading over a few frames instead of snapping
        const want = Math.atan2(vx, vz);
        let dA = want - w.facing;
        dA = Math.atan2(Math.sin(dA), Math.cos(dA));
        w.facing += dA * Math.min(1, dt * 10);
      }
      // the cycle advances with the ground covered: feet stay planted
      const stride = (sp > 2.4 ? RUN_STRIDE : WALK_STRIDE) * w.scale;
      w.phase = (w.phase + (sp > 0.05 ? dt * sp / stride : dt * 0.4)) % 1;
    }
    this.separate();
    this.draw(gx, gz);
  }

  private draw(gx: number, gz: number) {
    const counts = TYPES.map(() => [0, 0]);
    for (const w of this.walkers) {
      const lod = Math.hypot(w.x - gx, w.z - gz) < LOD_NEAR_M ? 0 : 1;
      const cm = this.meshes[w.type][lod];
      const n = counts[w.type][lod];
      if (n >= this.cap) continue;
      counts[w.type][lod]++;
      const vat = this.vats.get(`${TYPES[w.type].body}${lod}`)!;
      const clip = w.mode === "film" ? "phone" : w.sp > 2.4 ? "run" : w.sp > 0.05 ? "walk" : "idle";
      const [row, frames] = vat.rows.get(clip)!;
      const y = this.heightAt(w.x, w.z);
      const o = n * FLOATS, d = cm.data;
      d[o] = w.x; d[o + 1] = Number.isFinite(y) ? y : -1e4; d[o + 2] = w.z; d[o + 3] = w.facing;
      d[o + 4] = row; d[o + 5] = frames; d[o + 6] = w.phase; d[o + 7] = w.scale;
      const [c0, c1] = w.cols;
      d.set(c0, o + 8);
      d.set(c1, o + 12);
    }
    this.meshes.forEach((byLod, k) => byLod.forEach((cm, lod) => {
      cm.geo.instanceCount = counts[k][lod];
      cm.mesh.visible = counts[k][lod] > 0;
      cm.buf.needsUpdate = true;
    }));
  }

  /** Keep walkers at least SEPARATION_M apart (a 1 m spatial hash, so it stays linear in the crowd). */
  private separate() {
    const g = this.grid;
    g.clear();
    const key = (cx: number, cz: number) => cx * 73856093 ^ cz * 19349663;
    for (const w of this.walkers) {
      const k = key(Math.floor(w.x), Math.floor(w.z));
      const cell = g.get(k);
      if (cell) cell.push(w); else g.set(k, [w]);
    }
    for (const w of this.walkers) {
      const cx = Math.floor(w.x), cz = Math.floor(w.z);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const o of g.get(key(cx + i, cz + j)) ?? []) {
          if (o === w) continue;
          const dx = w.x - o.x, dz = w.z - o.z, d = Math.hypot(dx, dz);
          if (d >= SEPARATION_M || d < 1e-4) continue;
          const push = (SEPARATION_M - d) / 2;
          w.x += (dx / d) * push; w.z += (dz / d) * push;
          o.x -= (dx / d) * push; o.z -= (dz / d) * push;
        }
      }
    }
  }
}
