import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { swatch } from "@/config";
import { type Chunk, sampleHeight, terrainHeights } from "./decode";
import type { Materials } from "./materials";
import { buildSigns } from "./signs";
import { facadeStyle } from "@/render/facade";

const PIECE_LIFT_M = 0.04;
const Q = 256 / 65535;

// Ground class -> palette swatch (classes listed in public/world/index.json, pipeline/build/ground.py).
const CLASS_SWATCH: Record<string, string> = {
  water: "water_edge", rail: "rail", road: "asphalt", paving: "paving", path: "path",
  parking: "parking", pitch: "pitch", wood: "grass_shadow", marking: "asphalt_line", stall: "asphalt_line",
};

export interface BuiltChunk {
  group: THREE.Group;
  heights: Float32Array;
  buildingMeshes: THREE.Mesh[];
  /** Building triangles in chunk-local coordinates for the physics trimesh. */
  walls: Float32Array | null;
  buildingCount: number;
  lakeLevels: number[];
  /** shrub centres in world x, z (hide spots for the goose) */
  shrubs: [number, number][];
}

function terrainGeometry(h: Float32Array, n: number, cell: number): THREE.BufferGeometry {
  const pos = new Float32Array(n * n * 3);
  const nrm = new Float32Array(n * n * 3);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = r * n + c;
      pos[k * 3] = c * cell;
      pos[k * 3 + 1] = h[k];
      pos[k * 3 + 2] = r * cell;
      const hl = h[r * n + Math.max(c - 1, 0)], hr = h[r * n + Math.min(c + 1, n - 1)];
      const hu = h[Math.max(r - 1, 0) * n + c], hd = h[Math.min(r + 1, n - 1) * n + c];
      const dx = (hr - hl) / ((Math.min(c + 1, n - 1) - Math.max(c - 1, 0)) * cell);
      const dz = (hd - hu) / ((Math.min(r + 1, n - 1) - Math.max(r - 1, 0)) * cell);
      const len = Math.hypot(dx, 1, dz);
      nrm[k * 3] = -dx / len;
      nrm[k * 3 + 1] = 1 / len;
      nrm[k * 3 + 2] = -dz / len;
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
      idx.set([a, d, b, b, d, e], p);
      p += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function pieceGeometry(c: Chunk, h: Float32Array, classes: string[]): THREE.BufferGeometry | null {
  const xz = c.arrays.ground_xz as Uint16Array | undefined;
  if (!xz) return null;
  const cls = c.arrays.ground_cls as Uint8Array;
  const { n, cell } = c.header.terrain;
  const nv = cls.length;
  const pos = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const clsAttr = new Float32Array(nv);
  const colors = classes.map((k) => swatch(CLASS_SWATCH[k] ?? "path"));
  for (let v = 0; v < nv; v++) {
    const x = xz[v * 2] * Q, z = xz[v * 2 + 1] * Q;
    pos[v * 3] = x;
    pos[v * 3 + 1] = sampleHeight(h, n, cell, x, z) + PIECE_LIFT_M;
    pos[v * 3 + 2] = z;
    clsAttr[v] = cls[v];
    const cc = colors[cls[v]];
    col[v * 3] = cc.r; col[v * 3 + 1] = cc.g; col[v * 3 + 2] = cc.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("cls", new THREE.BufferAttribute(clsAttr, 1));
  g.setIndex(new THREE.BufferAttribute(c.arrays.ground_idx as Uint32Array, 1));
  g.computeVertexNormals();
  return g;
}

function lakeGeometry(c: Chunk): THREE.BufferGeometry | null {
  const xz = c.arrays.lake_xz as Float32Array | undefined;
  if (!xz || c.header.lakes.length === 0) return null;
  const nv = xz.length / 2;
  const pos = new Float32Array(nv * 3);
  const idx = c.arrays.lake_idx as Uint32Array;
  const yOf = new Float32Array(nv);
  for (const lk of c.header.lakes) {
    for (let t = lk.first; t < lk.first + lk.count; t++) yOf[idx[t]] = lk.y;
  }
  for (let v = 0; v < nv; v++) {
    pos[v * 3] = xz[v * 2];
    pos[v * 3 + 1] = yOf[v];
    pos[v * 3 + 2] = xz[v * 2 + 1];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  // distance to shore in metres (pipeline stores decimetres as u8) for the lighter edge band
  const d = c.arrays.lake_d as Uint8Array | undefined;
  const shore = new Float32Array(nv);
  for (let v = 0; v < nv; v++) shore[v] = d ? d[v] / 10 : 10;
  g.setAttribute("shore", new THREE.BufferAttribute(shore, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

const PARAPET_M = 0.45;
const VAULT_GLASS = 1000;
const PLANT_M2_PER_UNIT = 220;   // one rooftop plant box per this much flat roof (doc 02 section 3 step 6)
const PLANT_MIN_ROOF_M2 = 250;
const GABLE_MIN_FILL = 0.9;

const PLANT_KEY = "rooftop_plant";

/** An axis-free box (four corners in xz) from y0 to y1, vertex-coloured. */
function plantBox(acc: { pos: number[]; nrm: number[]; col: number[] }, corners: number[][], y0: number, y1: number, color: string) {
  const c = swatch(color);
  const emit = (p: number[][], n: number[]) => { for (const v of p) { acc.pos.push(...v); acc.nrm.push(...n); acc.col.push(c.r, c.g, c.b); } };
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const n = [-dz / len, 0, dx / len];
    const q = [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]];
    const e1 = [q[1][0] - q[0][0], 0, q[1][2] - q[0][2]], e2 = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const out = cx * n[0] + cz * n[2] >= 0;
    emit(out ? [q[0], q[1], q[2], q[0], q[2], q[3]] : [q[0], q[2], q[1], q[0], q[3], q[2]], out ? n : n.map((v) => -v));
  }
  const top = corners.map(([x, z]) => [x, y1, z]);
  const ny = (top[1][2] - top[0][2]) * (top[2][0] - top[0][0]) - (top[1][0] - top[0][0]) * (top[2][2] - top[0][2]);
  emit(ny >= 0 ? [top[0], top[1], top[2], top[0], top[2], top[3]] : [top[0], top[2], top[1], top[0], top[3], top[2]], [0, 1, 0]);
}

function pointInRings(x: number, z: number, rings: THREE.Vector2[][]) {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i].y > z) !== (r[j].y > z) && x < ((r[j].x - r[i].x) * (z - r[i].y)) / (r[j].y - r[i].y) + r[i].x) inside = !inside;
    }
  }
  return inside;
}

function edgeDist(x: number, z: number, rings: THREE.Vector2[][]) {
  let best = Infinity;
  for (const r of rings) {
    for (let k = 0; k < r.length; k++) {
      const a = r[k], b = r[(k + 1) % r.length];
      const dx = b.x - a.x, dz = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - (a.x + t * dx), z - (a.y + t * dz)));
    }
  }
  return best;
}

/** Minimum-area bounding rectangle of a ring (edge-aligned), as centre, unit axis, half sizes. */
function minRect(pts: THREE.Vector2[]) {
  let best = { area: Infinity, cx: 0, cz: 0, ux: 1, uz: 0, hu: 0, hv: 0 };
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], q = pts[(k + 1) % pts.length];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < 0.5) continue;
    const ux = (q.x - p.x) / len, uz = (q.y - p.y) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const r of pts) {
      const u = r.x * ux + r.y * uz, v = -r.x * uz + r.y * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = { area, cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2 };
    }
  }
  if (best.hv > best.hu) {  // make u the long axis
    best = { ...best, ux: -best.uz, uz: best.ux, hu: best.hv, hv: best.hu };
  }
  return best;
}

function ringArea(pts: THREE.Vector2[]) {
  let a = 0;
  for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

/** Extrude every building part: flat-shaded walls with parapets, roof caps, gabled roofs on houses. */
function buildingGeometries(c: Chunk): Map<string, THREE.BufferGeometry> {
  const rx = c.arrays.ring_xz as Float32Array | undefined;
  const out = new Map<string, THREE.BufferGeometry>();
  if (!rx) return out;
  const rc = c.arrays.ring_count as Uint32Array;
  const ringStart = new Uint32Array(rc.length + 1);
  for (let k = 0; k < rc.length; k++) ringStart[k + 1] = ringStart[k] + rc[k];
  const acc = new Map<string, { pos: number[]; nrm: number[]; seed: number[]; ha: number[]; ht: number[]; wf: number[] }>();
  const plant = { pos: [] as number[], nrm: [] as number[], col: [] as number[] };
  const ring = (k: number) => {
    const pts: THREE.Vector2[] = [];
    for (let v = ringStart[k]; v < ringStart[k + 1]; v++) pts.push(new THREE.Vector2(rx[v * 2], rx[v * 2 + 1]));
    return pts;
  };
  for (const b of c.header.buildings) {
    let a = acc.get(b.style);
    if (!a) { a = { pos: [], nrm: [], seed: [], ha: [], ht: [], wf: [] }; acc.set(b.style, a); }
    const A = a;
    // wf: signed metres from the middle of the wall segment (for centre bays); 1e4 off walls
    const tri = (p: number[][], n: number[][], top: number, wf = [1e4, 1e4, 1e4]) => {
      for (let k = 0; k < 3; k++) {
        A.pos.push(...p[k]); A.nrm.push(...n[k]); A.seed.push(b.id); A.ha.push(p[k][1] - b.ground_y); A.ht.push(top); A.wf.push(wf[k]);
      }
    };
    const quad = (p0: number[], p1: number[], p2: number[], p3: number[], n: number[], top: number, wf?: number[]) => {
      tri([p0, p1, p2], [n, n, n], top, wf && [wf[0], wf[1], wf[2]]);
      tri([p0, p2, p3], [n, n, n], top, wf && [wf[0], wf[2], wf[3]]);
    };
    const y0 = b.base_y;
    // footprint centre, for centre bays measured along each wall from the middle of the building
    const fpPts = ring(b.footprint.ring_first);
    const cen = fpPts.reduce((s, p) => s.add(p), new THREE.Vector2()).divideScalar(Math.max(1, fpPts.length));
    const wall = (pts: THREE.Vector2[], yb: number, yt: number, top: number, inward = false) => {
      for (let v = 0; v < pts.length; v++) {
        const p = pts[v], q = pts[(v + 1) % pts.length];
        const dx = q.x - p.x, dz = q.y - p.y;
        const len = Math.hypot(dx, dz);
        if (len < 1e-4) continue;
        const nx = -dz / len, nz = dx / len;
        // signed distance along the wall from the footprint centre's projection
        const tx = dx / len, tz = dz / len;
        const fp = (p.x - cen.x) * tx + (p.y - cen.y) * tz, fq = (q.x - cen.x) * tx + (q.y - cen.y) * tz;
        if (!inward) quad([p.x, yb, p.y], [q.x, yb, q.y], [q.x, yt, q.y], [p.x, yt, p.y], [nx, 0, nz], top, [fp, fq, fq, fp]);
        else quad([q.x, yb, q.y], [p.x, yb, p.y], [p.x, yt, p.y], [q.x, yt, q.y], [-nx, 0, -nz], top, [fq, fp, fp, fq]);
      }
    };
    for (const rf of b.roofs ?? []) {
      // barrel vault: half-ellipse cross-section across the short axis, glass on the slopes
      const vx = -rf.uz, vz = rf.ux;
      const nu = Math.max(2, Math.ceil((2 * rf.hu) / 3)), nv = 14;
      const P = (s: number, t: number) => {
        const y = b.ground_y + rf.eave + rf.rise * Math.sqrt(Math.max(0, 1 - t * t));
        return [rf.cx + rf.ux * s * rf.hu + vx * t * rf.hv, y, rf.cz + rf.uz * s * rf.hu + vz * t * rf.hv];
      };
      const top = VAULT_GLASS;   // sentinel: the facade shader paints this surface as glass, not roof
      const nrm = (a: number[], bb: number[], c: number[]) => {
        const n = new THREE.Vector3(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]).cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize();
        return n;
      };
      for (let i = 0; i < nu; i++) {
        for (let k = 0; k < nv; k++) {
          const s0 = -1 + (2 * i) / nu, s1 = -1 + (2 * (i + 1)) / nu, t0 = -1 + (2 * k) / nv, t1 = -1 + (2 * (k + 1)) / nv;
          let q = [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)];
          let n = nrm(q[0], q[1], q[2]);
          if (n.y < 0) { q = [q[0], q[3], q[2], q[1]]; n.negate(); }
          quad(q[0], q[1], q[2], q[3], n.toArray(), top);
        }
      }
      // gable ends: fans from the eave line up to the arch
      for (const s of [-1, 1]) {
        const n = [rf.ux * s, 0, rf.uz * s];
        for (let k = 0; k < nv; k++) {
          const t0 = -1 + (2 * k) / nv, t1 = -1 + (2 * (k + 1)) / nv;
          const a = P(s, t0), c = P(s, t1);
          const a0 = [a[0], b.ground_y + rf.eave, a[2]], c0 = [c[0], b.ground_y + rf.eave, c[2]];
          const tri1 = [a0, c0, c], tri2 = [a0, c, a];
          for (const tr of [tri1, tri2]) {
            const nn = nrm(tr[0], tr[1], tr[2]);
            const ord = nn.x * n[0] + nn.z * n[2] >= 0 ? tr : [tr[0], tr[2], tr[1]];
            tri(ord, [n, n, n], top);
          }
        }
      }
      // teal ducts looping over the vault near each end (the DC landmark detail)
      for (const s of [-0.82, 0.82]) {
        for (let k = 0; k < nv; k++) {
          const t0 = -1 + (2 * k) / nv, t1 = -1 + (2 * (k + 1)) / nv;
          const lift = (p: number[]) => [p[0], p[1] + 0.55, p[2]];
          const a = lift(P(s, t0)), c = lift(P(s, t1));
          const du = [rf.ux * 0.6, 0, rf.uz * 0.6];
          const w = (p: number[], d: number) => [p[0] + du[0] * d, p[1], p[2] + du[2] * d];
          plantBox(plant, [[w(a, -1)[0], w(a, -1)[2]], [w(a, 1)[0], w(a, 1)[2]], [w(c, 1)[0], w(c, 1)[2]], [w(c, -1)[0], w(c, -1)[2]]],
            Math.min(a[1], c[1]) - 0.45, Math.max(a[1], c[1]) + 0.05, "duct_teal");
        }
      }
    }
    const fpRing = ring(b.footprint.ring_first);
    const house = b.style === "house" && b.parts.length === 1;
    const rect = house ? minRect(fpRing) : null;
    if (house && rect && ringArea(fpRing) / (4 * rect.hu * rect.hv) >= GABLE_MIN_FILL) {
      // gabled roof along the long axis; lidar part height is roughly mid-roof, so ridge sits above it
      const h = b.parts[0].h;
      const rise = Math.min(0.55 * rect.hv, 3.2, Math.max(h - 2.6, 0.8));
      const eave = b.ground_y + Math.max(h - rise * 0.5, 2.6);
      const ridge = eave + rise;
      wall(fpRing, y0, eave, eave - b.ground_y + 1);
      const { cx, cz, ux, uz, hu, hv } = rect;
      const P = (su: number, sv: number, y: number) => [cx + ux * su * hu - uz * sv * hv, y, cz + uz * su * hu + ux * sv * hv];
      const top = ridge - b.ground_y;
      // the two roof planes, each wound so its normal points up (and away from the ridge)
      for (const q of [[P(-1, -1, eave), P(1, -1, eave), P(1, 0, ridge), P(-1, 0, ridge)],
        [P(1, 1, eave), P(-1, 1, eave), P(-1, 0, ridge), P(1, 0, ridge)]]) {
        const e1 = new THREE.Vector3(q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]);
        const e2 = new THREE.Vector3(q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]);
        const nrm = e1.clone().cross(e2).normalize();
        const w = nrm.y >= 0 ? q : [q[3], q[2], q[1], q[0]];
        if (nrm.y < 0) nrm.negate();
        quad(w[0], w[1], w[2], w[3], nrm.toArray(), top + 10);
      }
      // gable ends: triangles from the eave line to the ridge
      for (const su of [-1, 1]) {
        const g = [P(su, -1, eave), P(su, 1, eave), P(su, 0, ridge)];
        const n = new THREE.Vector3(ux * su, 0, uz * su);
        const e1 = new THREE.Vector3(...(g[1].map((x, i) => x - g[0][i]) as [number, number, number]));
        const e2 = new THREE.Vector3(...(g[2].map((x, i) => x - g[0][i]) as [number, number, number]));
        const ord = e1.cross(e2).dot(n) >= 0 ? g : [g[0], g[2], g[1]];
        tri(ord, [n.toArray(), n.toArray(), n.toArray()], top + 10);
      }
      continue;
    }
    const hipStyle = facadeStyle(b.style).mansard && b.parts.length <= 3;
    for (const part of b.parts) {
      const y1 = b.ground_y + part.h;
      const rings: THREE.Vector2[][] = [];
      for (let k = part.ring_first; k < part.ring_first + part.ring_n; k++) rings.push(ring(k));
      if (hipStyle && rings.length === 1) {
        // hipped (mansard-style) shingle roof over the part's bounding rectangle
        const r = minRect(rings[0]);
        if (ringArea(rings[0]) / (4 * r.hu * r.hv) > 0.75) {
          wall(rings[0], y0, y1, part.h + 1);
          const rise = Math.min(0.45 * r.hv, 2.6);
          const P = (su: number, sv: number, y: number) => [r.cx + r.ux * su - r.uz * sv, y, r.cz + r.uz * su + r.ux * sv];
          const ridge = Math.max(r.hu - r.hv, 0.1);
          const faces = [
            [P(-r.hu, -r.hv, y1), P(r.hu, -r.hv, y1), P(ridge, 0, y1 + rise), P(-ridge, 0, y1 + rise)],
            [P(r.hu, r.hv, y1), P(-r.hu, r.hv, y1), P(-ridge, 0, y1 + rise), P(ridge, 0, y1 + rise)],
          ];
          for (let q of faces) {
            const n = new THREE.Vector3(q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2])
              .cross(new THREE.Vector3(q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2])).normalize();
            if (n.y < 0) { q = [q[3], q[2], q[1], q[0]]; n.negate(); }
            quad(q[0], q[1], q[2], q[3], n.toArray(), part.h + rise + 10);
          }
          for (const [a, bb, c] of [[P(-r.hu, r.hv, y1), P(-r.hu, -r.hv, y1), P(-ridge, 0, y1 + rise)], [P(r.hu, -r.hv, y1), P(r.hu, r.hv, y1), P(ridge, 0, y1 + rise)]]) {
            let tr = [a, bb, c];
            const n = new THREE.Vector3(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]).cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize();
            if (n.y < 0) { tr = [a, c, bb]; n.negate(); }
            tri(tr, [n.toArray(), n.toArray(), n.toArray()], part.h + rise + 10);
          }
          continue;
        }
      }
      const top = part.h + PARAPET_M;
      for (const pts of rings) {
        wall(pts, y0, y1 + PARAPET_M, top);
        wall(pts, y1, y1 + PARAPET_M, top, true);
      }
      const tris = THREE.ShapeUtils.triangulateShape(rings[0], rings.slice(1));
      const flat = rings.flat();
      let roofArea = 0;
      for (const t of tris) {
        const [p0, p1, p2] = [flat[t[0]], flat[t[1]], flat[t[2]]];
        const ny = (p1.y - p0.y) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.y - p0.y);
        roofArea += Math.abs(ny) / 2;
        const order = ny >= 0 ? [p0, p1, p2] : [p0, p2, p1];
        tri(order.map((p) => [p.x, y1, p.y]), [[0, 1, 0], [0, 1, 0], [0, 1, 0]], top + 10);
      }
      // rooftop plant: seeded boxes inside the roof outline so big flat roofs do not read as blank slabs
      if (roofArea >= PLANT_MIN_ROOF_M2 && b.style !== "house") {
        const rnd = (k: number) => { const x = Math.sin(b.id * 91.7 + part.ring_first * 13.1 + k * 7.3) * 43758.5453; return x - Math.floor(x); };
        const n = Math.min(16, Math.floor(roofArea / PLANT_M2_PER_UNIT));
        const xs = flat.map((p) => p.x), zs = flat.map((p) => p.y);
        const [mnx, mxx, mnz, mxz] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
        let placed = 0;
        for (let k = 0; k < n * 6 && placed < n; k++) {
          const cx = mnx + rnd(k * 3) * (mxx - mnx), cz = mnz + rnd(k * 3 + 1) * (mxz - mnz);
          const w = 2 + rnd(k * 3 + 2) * 3, d = 1.5 + rnd(k * 5) * 2.5, h = 1 + rnd(k * 7) * 1.4;
          const corners = [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
          if (!corners.every(([x, z]) => pointInRings(x, z, rings) && edgeDist(x, z, rings) > 1.2)) continue;
          plantBox(plant, corners, y1, y1 + h, rnd(k * 11) < 0.5 ? "roof_metal" : "concrete_shadow");
          placed++;
        }
      }
    }
  }
  if (plant.pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(plant.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(plant.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(plant.col, 3));
    out.set(PLANT_KEY, g);
  }
  for (const [style, a] of acc) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nrm, 3));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(a.seed, 1));
    g.setAttribute("hAbove", new THREE.Float32BufferAttribute(a.ha, 1));
    g.setAttribute("hTop", new THREE.Float32BufferAttribute(a.ht, 1));
    g.setAttribute("wallF", new THREE.Float32BufferAttribute(a.wf, 1));
    out.set(style, g);
  }
  return out;
}

const CANOPY_UNDERSIDE_M = 3.0;
const CANOPY_THICK_M = 0.25;
const POST_SPACING_M = 6;

/** Transit platform decks with canopies on posts where OSM says the platform is sheltered. */
function platformGeometry(c: Chunk): THREE.BufferGeometry | null {
  const plats = c.header.platforms ?? [];
  const px = c.arrays.plat_xz as Float32Array | undefined;
  if (!plats.length || !px) return null;
  const pc = c.arrays.plat_count as Uint32Array;
  const starts = new Uint32Array(pc.length + 1);
  for (let k = 0; k < pc.length; k++) starts[k + 1] = starts[k] + pc[k];
  const pos: number[] = [], nrm: number[] = [], col: number[] = [];
  const emit = (p: number[][], n: number[], cname: string) => {
    const cc = swatch(cname);
    for (const v of p) { pos.push(...v); nrm.push(...n); col.push(cc.r, cc.g, cc.b); }
  };
  const prism = (pts: THREE.Vector2[], y0: number, y1: number, side: string, top: string, bottom: string | null) => {
    for (let v = 0; v < pts.length; v++) {
      const a = pts[v], b = pts[(v + 1) % pts.length];
      const dx = b.x - a.x, dz = b.y - a.y, len = Math.hypot(dx, dz) || 1;
      const n = [-dz / len, 0, dx / len];
      emit([[a.x, y0, a.y], [b.x, y0, b.y], [b.x, y1, b.y]], n, side);
      emit([[a.x, y0, a.y], [b.x, y1, b.y], [a.x, y1, a.y]], n, side);
    }
    for (const t of THREE.ShapeUtils.triangulateShape(pts, [])) {
      const [p0, p1, p2] = t.map((k) => pts[k]);
      const up = (p1.y - p0.y) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.y - p0.y) >= 0;
      const tri = up ? [p0, p1, p2] : [p0, p2, p1];
      emit(tri.map((p) => [p.x, y1, p.y]), [0, 1, 0], top);
      if (bottom) emit([...tri].reverse().map((p) => [p.x, y0, p.y]), [0, -1, 0], bottom);
    }
  };
  for (const pl of plats) {
    const pts: THREE.Vector2[] = [];
    for (let v = starts[pl.ring_first]; v < starts[pl.ring_first + 1]; v++) pts.push(new THREE.Vector2(px[v * 2], px[v * 2 + 1]));
    const deck = pl.ground_y + pl.deck;
    prism(pts, pl.ground_y - 0.3, deck, "paving", "path", null);
    if (!pl.canopy) continue;
    const r = minRect(pts);
    const hu = Math.max(r.hu - 0.3, 0.5), hv = Math.max(r.hv - 0.2, 0.6);
    const corner = (su: number, sv: number) => new THREE.Vector2(r.cx + r.ux * su * hu - r.uz * sv * hv, r.cz + r.uz * su * hu + r.ux * sv * hv);
    const roof = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    const y0 = deck + CANOPY_UNDERSIDE_M;
    prism(roof, y0, y0 + CANOPY_THICK_M, "roof_light", "roof_light", "flower_yellow");
    const n = Math.max(1, Math.round((2 * hu) / POST_SPACING_M));
    for (let k = 0; k <= n; k++) {
      const su = -1 + (2 * k) / n;
      const p = corner(su * 0.95, 0);
      const s = 0.09;
      prism([new THREE.Vector2(p.x - s, p.y - s), new THREE.Vector2(p.x + s, p.y - s), new THREE.Vector2(p.x + s, p.y + s),
        new THREE.Vector2(p.x - s, p.y + s)], deck, y0, "prop_metal", "prop_metal", null);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function treeMeshes(c: Chunk, mats: Materials, geo: Materials["geo"]): THREE.Object3D[] {
  const xyz = c.arrays.tree_xyz as Float32Array | undefined;
  if (!xyz) return [];
  const hr = c.arrays.tree_hr as Float32Array;
  const kind = c.arrays.tree_kind as Uint8Array;
  const n = kind.length;
  const counts = [0, 0];
  for (let k = 0; k < n; k++) counts[kind[k]]++;
  const out: THREE.Object3D[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const tint = new THREE.Color();
  const canopy = [new THREE.InstancedMesh(geo.blob, mats.canopy, counts[0]), new THREE.InstancedMesh(geo.cone, mats.conifer, counts[1])];
  const trunks = new THREE.InstancedMesh(geo.trunk, mats.trunk, n);
  const fill = [0, 0];
  for (let k = 0; k < n; k++) {
    const x = xyz[k * 3], y = xyz[k * 3 + 1], z = xyz[k * 3 + 2];
    const h = hr[k * 2], r = hr[k * 2 + 1];
    const kd = kind[k];
    const yaw = (Math.sin(k * 12.9898 + x) * 43758.5453) % (Math.PI * 2);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const crownH = kd === 1 ? h * 0.85 : Math.max(h * 0.62, r * 1.4);
    const crownBase = h - crownH;
    s.set(r, crownH, r);
    p.set(x, y + crownBase, z);
    m.compose(p, q, s);
    canopy[kd].setMatrixAt(fill[kd], m);
    const v = 0.92 + 0.16 * (((Math.sin(k * 78.233) * 43758.5453) % 1 + 1) % 1);
    tint.setRGB(v, v, v);
    canopy[kd].setColorAt(fill[kd], tint);
    fill[kd]++;
    s.set(Math.max(r * 0.09, 0.18), crownBase + crownH * 0.3, Math.max(r * 0.09, 0.18));
    p.set(x, y, z);
    m.compose(p, q, s);
    trunks.setMatrixAt(k, m);
  }
  for (const im of [...canopy, trunks]) {
    if (im.count === 0) continue;
    im.castShadow = true;
    im.receiveShadow = true;
    out.push(im);
  }
  return out;
}

function shrubCentres(c: Chunk): [number, number][] {
  const xz = c.arrays.tuft_xz as Uint16Array | undefined;
  if (!xz) return [];
  const kind = c.arrays.tuft_kind as Uint8Array;
  const out: [number, number][] = [];
  for (let v = 0; v < kind.length; v++) if (kind[v] >= 3) out.push([xz[v * 2] * Q + c.header.chunk.x0, xz[v * 2 + 1] * Q + c.header.chunk.z0]);
  return out;
}

function tuftMeshes(c: Chunk, h: Float32Array, mats: Materials): THREE.Object3D[] {
  const xz = c.arrays.tuft_xz as Uint16Array | undefined;
  if (!xz) return [];
  const kind = c.arrays.tuft_kind as Uint8Array;
  const { n, cell } = c.header.terrain;
  const out: THREE.Object3D[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  mats.geo.tufts.forEach((geom, k) => {
    const ids: number[] = [];
    for (let v = 0; v < kind.length; v++) if (kind[v] === k) ids.push(v);
    if (!ids.length) return;
    const im = new THREE.InstancedMesh(geom, mats.vertexColor, ids.length);
    ids.forEach((v, t) => {
      const x = xz[v * 2] * Q, z = xz[v * 2 + 1] * Q;
      const r = Math.abs(Math.sin(v * 12.9898 + x * 78.233) * 43758.5453) % 1;
      q.setFromAxisAngle(up, r * Math.PI * 2);
      const sc = 0.8 + 0.6 * r;
      s.set(sc, sc * (0.85 + 0.3 * ((r * 7) % 1)), sc);
      p.set(x, sampleHeight(h, n, cell, x, z), z);
      m.compose(p, q, s);
      im.setMatrixAt(t, m);
    });
    im.receiveShadow = true;
    if (k >= 3) im.castShadow = true;
    im.name = k === 0 ? "tufts" : k < 3 ? "flowers" : "shrubs";
    out.push(im);
  });
  return out;
}

function doorMesh(c: Chunk, mats: Materials): THREE.Object3D | null {
  const xyz = c.arrays.door_xyz as Float32Array | undefined;
  if (!xyz) return null;
  const rot = c.arrays.door_rot as Float32Array;
  const im = new THREE.InstancedMesh(mats.door, mats.vertexColor, rot.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < rot.length; k++) {
    // door_rot is the outward wall normal angle in the east-north frame; local +z must face it
    q.setFromAxisAngle(up, rot[k] + Math.PI / 2);
    m.compose(new THREE.Vector3(xyz[k * 3], xyz[k * 3 + 1], xyz[k * 3 + 2]), q, one);
    im.setMatrixAt(k, m);
  }
  im.receiveShadow = true;
  im.name = "doors";
  return im;
}

const BARRIER_STYLE: Record<string, { color: string; h: number; w: number }> = {
  hedge: { color: "hedge", h: 1.2, w: 0.9 }, wall: { color: "concrete", h: 1.2, w: 0.3 },
  retaining_wall: { color: "concrete_shadow", h: 0.8, w: 0.4 }, fence: { color: "prop_wood", h: 1.1, w: 0.06 },
};

/** OSM fences, hedges and walls: boxes along each segment, fences as posts and two rails. */
function barrierGeometry(c: Chunk, kinds: string[]): THREE.BufferGeometry | null {
  const seg = c.arrays.bar_seg as Float32Array | undefined;
  if (!seg) return null;
  const kind = c.arrays.bar_kind as Uint8Array;
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const add = (color: string, cx: number, cy: number, cz: number, yaw: number, sx: number, sy: number, sz: number) => {
    const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    g.deleteAttribute("uv");
    q.setFromAxisAngle(up, yaw);
    g.applyMatrix4(m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(sx, sy, sz)));
    const col = swatch(color), n = g.getAttribute("position").count, arr = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) arr.set([col.r, col.g, col.b], k * 3);
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  };
  for (let k = 0; k < kind.length; k++) {
    const [x1, y1, z1, x2, y2, z2] = seg.slice(k * 6, k * 6 + 6);
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.2) continue;
    const yaw = Math.atan2(x2 - x1, z2 - z1);
    const st = BARRIER_STYLE[kinds[kind[k]]];
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, my = Math.min(y1, y2);
    if (kinds[kind[k]] !== "fence") { add(st.color, mx, my + st.h / 2 - 0.2, mz, yaw, st.w, st.h + 0.4, len + st.w); continue; }
    for (const h of [0.45, 0.95]) add(st.color, mx, my + h, mz, yaw, 0.05, 0.07, len);
    const n = Math.max(1, Math.round(len / 2.4));
    for (let p = 0; p <= n; p++) {
      const t = p / n;
      add(st.color, x1 + (x2 - x1) * t, (y1 + (y2 - y1) * t) + st.h / 2 - 0.1, z1 + (z2 - z1) * t, yaw, 0.09, st.h + 0.2, 0.09);
    }
  }
  return parts.length ? mergeGeometries(parts) : null;
}

/** Landmark decals: the MC pink tie, a flat knot-and-blade shape on the wall (config/overrides). */
function decalMesh(d: NonNullable<Chunk["header"]["decals"]>[number], mats: Materials): THREE.Object3D {
  const H = d.top - d.bottom, W = H * 0.32;
  const blade = new THREE.Shape();
  blade.moveTo(0, -H * 0.5);
  blade.lineTo(W * 0.5, -H * 0.33); blade.lineTo(W * 0.32, H * 0.34); blade.lineTo(-W * 0.32, H * 0.34); blade.lineTo(-W * 0.5, -H * 0.33);
  blade.lineTo(0, -H * 0.5);
  const knot = new THREE.Shape();
  knot.moveTo(-W * 0.34, H * 0.36); knot.lineTo(W * 0.34, H * 0.36); knot.lineTo(W * 0.42, H * 0.5); knot.lineTo(-W * 0.42, H * 0.5);
  knot.lineTo(-W * 0.34, H * 0.36);
  const paintShape = (s: THREE.Shape, color: string) => {
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
    const c = swatch(color), n = geo.getAttribute("position").count, a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) a.set([c.r, c.g, c.b], k * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
    geo.deleteAttribute("uv");
    return geo;
  };
  const m = new THREE.Mesh(mergeGeometries([paintShape(blade, "tie_pink"), paintShape(knot, "tie_knot")]), mats.vertexColor);
  m.position.set(d.x, d.y + d.bottom + H / 2, d.z);
  m.rotation.y = d.rot + Math.PI / 2;
  m.castShadow = true;
  m.name = `decal_${d.kind}`;
  return m;
}

function propMeshes(c: Chunk, mats: Materials, kinds: string[]): THREE.Object3D[] {
  const xyz = c.arrays.prop_xyz as Float32Array | undefined;
  if (!xyz) return [];
  const rot = c.arrays.prop_rot as Float32Array;
  const kind = c.arrays.prop_kind as Uint8Array;
  const out: THREE.Object3D[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  kinds.forEach((name, k) => {
    const geom = mats.props[name];
    if (!geom) return;
    const ids: number[] = [];
    for (let v = 0; v < kind.length; v++) if (kind[v] === k) ids.push(v);
    if (!ids.length) return;
    const im = new THREE.InstancedMesh(geom, mats.vertexColor, ids.length);
    ids.forEach((v, t) => {
      // prop_rot is the path direction in the east-north frame; world yaw about +y is the same angle
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot[v]);
      p.set(xyz[v * 3], xyz[v * 3 + 1], xyz[v * 3 + 2]);
      m.compose(p, q, one);
      im.setMatrixAt(t, m);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    out.push(im);
  });
  return out;
}

export function buildChunk(c: Chunk, mats: Materials, classes: string[], propKinds: string[], barrierKinds: string[]): BuiltChunk {
  const g = new THREE.Group();
  const { x0, z0 } = c.header.chunk;
  g.position.set(x0, 0, z0);
  g.name = `chunk_${c.header.chunk.i}_${c.header.chunk.j}`;
  const h = terrainHeights(c);
  const { n, cell } = c.header.terrain;
  const terrain = new THREE.Mesh(terrainGeometry(h, n, cell), mats.ground);
  terrain.receiveShadow = true;
  terrain.name = "terrain";
  g.add(terrain);
  const pg = pieceGeometry(c, h, classes);
  if (pg) {
    const pieces = new THREE.Mesh(pg, mats.pieces);
    pieces.receiveShadow = true;
    pieces.name = "ground_pieces";
    g.add(pieces);
  }
  const lg = lakeGeometry(c);
  if (lg) {
    const lake = new THREE.Mesh(lg, mats.water);
    lake.receiveShadow = true;
    lake.name = "lakes";
    g.add(lake);
  }
  const buildingMeshes: THREE.Mesh[] = [];
  for (const [style, geom] of buildingGeometries(c)) {
    const mesh = new THREE.Mesh(geom, style === PLANT_KEY ? mats.vertexColor : mats.facade(style));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = style === PLANT_KEY ? PLANT_KEY : `buildings_${style}`;
    buildingMeshes.push(mesh);
    g.add(mesh);
  }
  const plat = platformGeometry(c);
  if (plat) {
    const m = new THREE.Mesh(plat, mats.vertexColor);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = "platforms";
    g.add(m);
  }
  for (const o of treeMeshes(c, mats, mats.geo)) g.add(o);
  for (const o of tuftMeshes(c, h, mats)) g.add(o);
  for (const o of propMeshes(c, mats, propKinds)) g.add(o);
  if (c.header.signs?.length) g.add(buildSigns(c.header.signs));
  for (const d of c.header.decals ?? []) g.add(decalMesh(d, mats));
  const doors = doorMesh(c, mats);
  if (doors) g.add(doors);
  const bars = barrierGeometry(c, barrierKinds);
  if (bars) {
    const bm = new THREE.Mesh(bars, mats.vertexColor);
    bm.castShadow = true;
    bm.receiveShadow = true;
    bm.name = "barriers";
    g.add(bm);
  }
  const parts = buildingMeshes.map((m) => m.geometry.getAttribute("position").array as Float32Array);
  const total = parts.reduce((a, p) => a + p.length, 0);
  const walls = total ? new Float32Array(total) : null;
  let off = 0;
  for (const p of parts) { walls!.set(p, off); off += p.length; }
  return { group: g, heights: h, buildingMeshes, walls, buildingCount: c.header.buildings.length,
    shrubs: shrubCentres(c),
    lakeLevels: [...new Set(c.header.lakes.map((l) => l.y))] };
}
