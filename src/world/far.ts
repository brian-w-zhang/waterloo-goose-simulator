import * as THREE from "three/webgpu";
import { campus, styleRules, swatch } from "@/config";
import { decodeChunk } from "./decode";

type Style = { wall: string; roof: string };

const CLASS_SWATCH: Record<string, string> = {
  water: "water", rail: "rail", road: "asphalt", paving: "paving", path: "path",
  parking: "parking", pitch: "pitch", wood: "grass_shadow",
};

const FAR_DROP_M = 0.05;   // far terrain sits a hair lower so near-chunk edges win
const APRON_M = 4000;

/** Low-detail stand-ins for every chunk plus a grass apron beyond the data, so views never show holes. */
export class FarWorld {
  readonly root = new THREE.Group();
  private byKey = new Map<string, THREE.Mesh>();

  constructor(private material: THREE.Material) {
    this.root.name = "far";
  }

  async load() {
    const c = decodeChunk(await (await fetch("/world/far.wgc")).arrayBuffer());
    const h = c.header as unknown as { n: number; size: number; classes: string[];
      chunks: { i: number; j: number; e0: number; n1: number; buildings: [number, number, number, string][] }[] };
    const fh = c.arrays.far_h as Float32Array, fc = c.arrays.far_cls as Uint8Array;
    const rx = c.arrays.ring_xz as Float32Array, rcount = c.arrays.ring_count as Uint32Array;
    const n = h.n, cell = h.size / (n - 1);
    const grass = swatch("grass");
    const clsCol = h.classes.map((k) => swatch(CLASS_SWATCH[k] ?? "path"));
    let ring = 0, rv = 0;
    let minEdge = Infinity;
    for (let k = 0; k < fh.length; k++) minEdge = Math.min(minEdge, fh[k]);
    const apronY = minEdge - 0.5;
    const C = campus.chunk;
    h.chunks.forEach((ch, ci) => {
      const pos: number[] = [], col: number[] = [], nrm: number[] = [];
      const off = ci * n * n;
      const at = (r: number, q: number) => fh[off + r * n + q] - FAR_DROP_M;
      const push = (x: number, y: number, z: number, c: THREE.Color, nx: number, ny: number, nz: number) => {
        pos.push(x, y, z); col.push(c.r, c.g, c.b); nrm.push(nx, ny, nz);
      };
      for (let r = 0; r < n - 1; r++) {
        for (let q = 0; q < n - 1; q++) {
          const quad: [number, number][] = [[r, q], [r + 1, q], [r, q + 1], [r, q + 1], [r + 1, q], [r + 1, q + 1]];
          for (const [rr, qq] of quad) {
            const k = fc[off + rr * n + qq];
            push(qq * cell, at(rr, qq), rr * cell, k === 255 ? grass : clsCol[k], 0, 1, 0);
          }
        }
      }
      // skirts on the outer edges of the data rectangle, down to the apron
      const skirt = (pts: [number, number, number][], nx: number, nz: number) => {
        for (let k = 0; k + 1 < pts.length; k++) {
          const [ax, ay, az] = pts[k], [bx, by, bz] = pts[k + 1];
          for (const [x, y, z] of [[ax, apronY, az], [bx, apronY, bz], [bx, by, bz], [ax, apronY, az], [bx, by, bz], [ax, ay, az]]) {
            push(x, y, z, grass, nx, 0, nz);
          }
        }
      };
      const line = (f: (k: number) => [number, number]) => Array.from({ length: n }, (_, k) => {
        const [r, q] = f(k);
        return [q * cell, at(r, q), r * cell] as [number, number, number];
      });
      if (ch.i === 0) skirt(line((k) => [n - 1 - k, 0]), -1, 0);
      if (ch.i === C.cols - 1) skirt(line((k) => [k, n - 1]), 1, 0);
      if (ch.j === C.rows - 1) skirt(line((k) => [0, k]), 0, -1);
      if (ch.j === 0) skirt(line((k) => [n - 1, n - 1 - k]), 0, 1);
      for (const [base, , top, style] of ch.buildings) {
        const s = (styleRules.styles as Record<string, Style>)[style];
        const wall = swatch(s.wall), roof = swatch(s.roof);
        const pts: THREE.Vector2[] = [];
        for (let v = 0; v < rcount[ring]; v++) pts.push(new THREE.Vector2(rx[(rv + v) * 2], rx[(rv + v) * 2 + 1]));
        rv += rcount[ring];
        ring++;
        for (let v = 0; v < pts.length; v++) {
          const p = pts[v], q = pts[(v + 1) % pts.length];
          const dx = q.x - p.x, dz = q.y - p.y, len = Math.hypot(dx, dz) || 1;
          const nx = -dz / len, nz = dx / len;
          for (const [x, y, z] of [[p.x, base, p.y], [q.x, base, q.y], [q.x, top, q.y], [p.x, base, p.y], [q.x, top, q.y], [p.x, top, p.y]]) {
            push(x, y, z, wall, nx, 0, nz);
          }
        }
        for (const t of THREE.ShapeUtils.triangulateShape(pts, [])) {
          const [a, b, d] = t.map((k) => pts[k]);
          const up = (b.y - a.y) * (d.x - a.x) - (b.x - a.x) * (d.y - a.y) >= 0;
          for (const p of up ? [a, b, d] : [a, d, b]) push(p.x, top, p.y, roof, 0, 1, 0);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      const mesh = new THREE.Mesh(g, this.material);
      mesh.position.set(ch.e0 - campus.origin.e, 0, -(ch.n1 - campus.origin.n));
      mesh.name = `far_${ch.i}_${ch.j}`;
      mesh.receiveShadow = true;
      this.byKey.set(`${ch.i}_${ch.j}`, mesh);
      this.root.add(mesh);
    });
    // grass apron around the data rectangle just below its lowest point
    const x0 = C.grid_origin_e - campus.origin.e, x1 = x0 + C.cols * C.size_m;
    const z1 = -(C.grid_origin_n - campus.origin.n), z0 = z1 - C.rows * C.size_m;
    // shape in (x, -z) so that rotating by -90 degrees about x lands it in (x, z) facing +y
    const v = (x: number, z: number) => new THREE.Vector2(x, -z);
    const shape = new THREE.Shape([v(x0 - APRON_M, z1 + APRON_M), v(x1 + APRON_M, z1 + APRON_M),
      v(x1 + APRON_M, z0 - APRON_M), v(x0 - APRON_M, z0 - APRON_M)]);
    shape.holes.push(new THREE.Path([v(x0, z1), v(x0, z0), v(x1, z0), v(x1, z1)]));
    const ag = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    ag.deleteAttribute("uv");
    const ac = new Float32Array(ag.getAttribute("position").count * 3);
    for (let k = 0; k < ac.length; k += 3) { ac[k] = grass.r; ac[k + 1] = grass.g; ac[k + 2] = grass.b; }
    ag.setAttribute("color", new THREE.BufferAttribute(ac, 3));
    ag.computeVertexNormals();
    const apron = new THREE.Mesh(ag, this.material);
    apron.position.y = apronY;
    apron.name = "apron";
    this.root.add(apron);
  }

  setNear(key: string, near: boolean) {
    const m = this.byKey.get(key);
    if (m) m.visible = !near;
  }
}
