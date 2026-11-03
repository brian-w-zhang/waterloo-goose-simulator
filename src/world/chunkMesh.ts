import * as THREE from "three/webgpu";
import { campus, swatch } from "@/config";
import { type Chunk, sampleHeight, terrainHeights } from "./decode";
import type { Materials } from "./materials";

const SKIRT_M = campus.buildings.skirt_m;
const PIECE_LIFT_M = 0.04;
const Q = 256 / 65535;

// Ground class -> palette swatch (classes listed in public/world/index.json, pipeline/build/ground.py).
const CLASS_SWATCH: Record<string, string> = {
  water: "water_edge", rail: "rail", road: "asphalt", paving: "paving", path: "path",
  parking: "parking", pitch: "pitch", wood: "grass_shadow",
};

export interface BuiltChunk {
  group: THREE.Group;
  heights: Float32Array;
  buildingMeshes: THREE.Mesh[];
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
  const colors = classes.map((k) => swatch(CLASS_SWATCH[k] ?? "path"));
  for (let v = 0; v < nv; v++) {
    const x = xz[v * 2] * Q, z = xz[v * 2 + 1] * Q;
    pos[v * 3] = x;
    pos[v * 3 + 1] = sampleHeight(h, n, cell, x, z) + PIECE_LIFT_M;
    pos[v * 3 + 2] = z;
    const cc = colors[cls[v]];
    col[v * 3] = cc.r; col[v * 3 + 1] = cc.g; col[v * 3 + 2] = cc.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
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
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** Extrude every building part: flat-shaded walls (outward normals) plus a roof cap. */
function buildingGeometries(c: Chunk): Map<string, THREE.BufferGeometry> {
  const rx = c.arrays.ring_xz as Float32Array | undefined;
  const out = new Map<string, THREE.BufferGeometry>();
  if (!rx) return out;
  const rc = c.arrays.ring_count as Uint32Array;
  const ringStart = new Uint32Array(rc.length + 1);
  for (let k = 0; k < rc.length; k++) ringStart[k + 1] = ringStart[k] + rc[k];
  const acc = new Map<string, { pos: number[]; nrm: number[]; seed: number[]; ha: number[] }>();
  const ring = (k: number) => {
    const pts: THREE.Vector2[] = [];
    for (let v = ringStart[k]; v < ringStart[k + 1]; v++) pts.push(new THREE.Vector2(rx[v * 2], rx[v * 2 + 1]));
    return pts;
  };
  for (const b of c.header.buildings) {
    let a = acc.get(b.style);
    if (!a) { a = { pos: [], nrm: [], seed: [], ha: [] }; acc.set(b.style, a); }
    const y0 = b.ground_y - SKIRT_M;
    for (const part of b.parts) {
      const y1 = b.ground_y + part.h;
      const rings = [];
      for (let k = part.ring_first; k < part.ring_first + part.ring_n; k++) rings.push(ring(k));
      for (const pts of rings) {
        for (let v = 0; v < pts.length; v++) {
          const p = pts[v], q = pts[(v + 1) % pts.length];
          const dx = q.x - p.x, dz = q.y - p.y;
          const len = Math.hypot(dx, dz);
          if (len < 1e-4) continue;
          const nx = -dz / len, nz = dx / len;
          const quad = [[p.x, y0, p.y], [q.x, y0, q.y], [q.x, y1, q.y], [p.x, y0, p.y], [q.x, y1, q.y], [p.x, y1, p.y]];
          for (const [x, y, z] of quad) {
            a.pos.push(x, y, z); a.nrm.push(nx, 0, nz); a.seed.push(b.id); a.ha.push(y - b.ground_y);
          }
        }
      }
      const tris = THREE.ShapeUtils.triangulateShape(rings[0], rings.slice(1));
      const flat = rings.flat();
      for (const t of tris) {
        const [p0, p1, p2] = [flat[t[0]], flat[t[1]], flat[t[2]]];
        const ny = (p1.y - p0.y) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.y - p0.y);
        const order = ny >= 0 ? [p0, p1, p2] : [p0, p2, p1];
        for (const p of order) { a.pos.push(p.x, y1, p.y); a.nrm.push(0, 1, 0); a.seed.push(b.id); a.ha.push(part.h); }
      }
    }
  }
  for (const [style, a] of acc) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nrm, 3));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(a.seed, 1));
    g.setAttribute("hAbove", new THREE.Float32BufferAttribute(a.ha, 1));
    out.set(style, g);
  }
  return out;
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

export function buildChunk(c: Chunk, mats: Materials, classes: string[], propKinds: string[]): BuiltChunk {
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
    const mesh = new THREE.Mesh(geom, mats.facade(style));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `buildings_${style}`;
    buildingMeshes.push(mesh);
    g.add(mesh);
  }
  for (const o of treeMeshes(c, mats, mats.geo)) g.add(o);
  for (const o of propMeshes(c, mats, propKinds)) g.add(o);
  return { group: g, heights: h, buildingMeshes };
}
