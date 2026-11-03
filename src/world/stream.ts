import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { decodeChunk, sampleHeight } from "./decode";
import { buildChunk, type BuiltChunk } from "./chunkMesh";
import type { Materials } from "./materials";
import { pavingClass } from "@/render/materials";
import { disposeSigns } from "./signs";

export interface WorldIndex {
  chunk_size: number; cols: number; rows: number; grid_origin_e: number; grid_origin_n: number;
  ground_classes: string[]; prop_kinds: string[]; barrier_kinds: string[];
  chunks: { i: number; j: number; file: string; buildings: number; trees: number; props: number; bytes: number }[];
}

const ORIGIN = campus.origin;

/** Fetch a chunk file and gunzip it in the browser when it is gzip-compressed (pipeline/chunkio.py). */
export async function fetchChunk(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 8) throw new Error(`${url}: only ${buf.byteLength} bytes`);
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

/** Fetch JSON, naming the file and status when it fails (a 404 page is not JSON). */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** A chunk that failed to load is retried after this long (doubling per failure, up to 30 s). */
const RETRY_MS = 2000;

/** Streams 256 m chunks around a focus point: full detail within `radius` chunks. */
export class WorldStream {
  readonly root = new THREE.Group();
  index!: WorldIndex;
  private loaded = new Map<string, BuiltChunk>();
  private pending = new Map<string, Promise<void>>();
  /** failed chunk keys: when to retry and how many times it has failed */
  readonly failed = new Map<string, { at: number; n: number; error: string }>();
  loadsTotal = 0;
  evictionsTotal = 0;
  everLoaded = new Set<string>();
  onLoad?: (key: string, c: BuiltChunk) => void;
  onEvict?: (key: string) => void;

  constructor(private mats: Materials, private radius = campus.stream.full_radius_chunks) {
    this.root.name = "world";
  }

  async init() {
    this.index = await fetchJson<WorldIndex>("/world/index.json");
    pavingClass.value = this.index.ground_classes.indexOf("paving");
    if (pavingClass.value < 0) console.warn("[world] index.json has no paving ground class");
  }

  /** Chunk (i, j) containing world (x, z); j counts northward from the grid origin. */
  chunkOf(x: number, z: number): [number, number] {
    const e = x + ORIGIN.e, n = ORIGIN.n - z;
    return [Math.floor((e - this.index.grid_origin_e) / this.index.chunk_size),
      Math.floor((n - this.index.grid_origin_n) / this.index.chunk_size)];
  }

  /** Ground height at world (x, z) from loaded chunks, or NaN if not loaded. */
  heightAt(x: number, z: number): number {
    const [i, j] = this.chunkOf(x, z);
    const c = this.loaded.get(`${i}_${j}`);
    if (!c) return NaN;
    const lx = x - c.group.position.x, lz = z - c.group.position.z;
    const n = Math.round(Math.sqrt(c.heights.length));
    return sampleHeight(c.heights, n, this.index.chunk_size / (n - 1), lx, lz);
  }

  /** Lake surface height at world (x, z) if the point is in water (terrain is lowered there), else null. */
  waterLevelAt(x: number, z: number): number | null {
    const [i, j] = this.chunkOf(x, z);
    const c = this.loaded.get(`${i}_${j}`);
    if (!c || !c.lakeLevels.length) return null;
    const h = this.heightAt(x, z);
    for (const y of c.lakeLevels) if (h < y - 0.1 && h > y - 3) return y;
    return null;
  }

  /** Shrub centres within r of (x, z) across loaded chunks. */
  shrubsNear(x: number, z: number, r: number): [number, number][] {
    const out: [number, number][] = [];
    for (const c of this.loaded.values()) for (const p of c.shrubs) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < r * r) out.push(p);
    return out;
  }

  /** World-space ground (2 m grid) and building wall triangles within a square of half-size r. */
  geometryNear(x: number, z: number, r: number): { positions: Float32Array; indices: Uint32Array } {
    const pos: number[] = [], idx: number[] = [];
    const step = 2;
    const n = Math.floor((2 * r) / step) + 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const px = x - r + j * step, pz = z - r + i * step, h = this.heightAt(px, pz);
      pos.push(px, Number.isFinite(h) ? h : -50, pz);
    }
    for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < n; j++) {
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    for (const ch of this.loaded.values()) {
      if (!ch.walls) continue;
      const ox = ch.group.position.x, oz = ch.group.position.z, w = ch.walls;
      for (let k = 0; k < w.length; k += 9) {
        const cx = (w[k] + w[k + 3] + w[k + 6]) / 3 + ox, cz = (w[k + 2] + w[k + 5] + w[k + 8]) / 3 + oz;
        if (Math.abs(cx - x) > r || Math.abs(cz - z) > r) continue;
        const base = pos.length / 3;
        for (let v = 0; v < 3; v++) pos.push(w[k + v * 3] + ox, w[k + v * 3 + 1], w[k + v * 3 + 2] + oz);
        idx.push(base, base + 1, base + 2);
      }
    }
    return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
  }

  buildingMeshes(): THREE.Mesh[] {
    return [...this.loaded.values()].flatMap((c) => c.buildingMeshes);
  }

  loadedKeys(): string[] { return [...this.loaded.keys()]; }

  isLoaded(i: number, j: number) { return this.loaded.has(`${i}_${j}`); }

  buildingCount(key: string): number { return this.loaded.get(key)?.buildingCount ?? -1; }

  private async load(i: number, j: number) {
    const key = `${i}_${j}`;
    const entry = this.index.chunks.find((c) => c.i === i && c.j === j);
    if (!entry) throw new Error(`chunk ${key} is not in index.json`);
    const buf = await fetchChunk(`/world/${entry.file}`);
    const chunk = decodeChunk(buf, `chunk ${key} (${entry.file})`);
    const built = buildChunk(chunk, this.mats, this.index.ground_classes, this.index.prop_kinds, this.index.barrier_kinds);
    this.loaded.set(key, built);
    this.root.add(built.group);
    this.onLoad?.(key, built);
    this.loadsTotal++;
    this.everLoaded.add(key);
  }

  /** Load the square of chunks around (x, z) and evict the rest; resolves when all are loaded. */
  async update(x: number, z: number, radius = this.radius) {
    const [ci, cj] = this.chunkOf(x, z);
    const want = new Set<string>();
    const jobs: Promise<void>[] = [];
    for (let dj = -radius; dj <= radius; dj++) {
      for (let di = -radius; di <= radius; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= this.index.cols || j >= this.index.rows) continue;
        const key = `${i}_${j}`;
        want.add(key);
        if (this.loaded.has(key)) continue;
        let p = this.pending.get(key);
        const f = this.failed.get(key);
        if (!p && f && performance.now() < f.at) continue;   // backing off after a failure
        if (!p) {
          // a failed chunk is logged and retried with backoff; it never rejects the whole update
          p = this.load(i, j).then(() => { this.failed.delete(key); }, (e: Error) => {
            const n = (f?.n ?? 0) + 1;
            this.failed.set(key, { at: performance.now() + Math.min(RETRY_MS * 2 ** (n - 1), 30000), n, error: e.message });
            console.error(`[world] chunk ${key} failed (attempt ${n}): ${e.message}`);
          }).finally(() => this.pending.delete(key));
          this.pending.set(key, p);
        }
        jobs.push(p);
      }
    }
    for (const [key, c] of this.loaded) {
      if (want.has(key)) continue;
      this.root.remove(c.group);
      // instanced tree and prop geometries are shared between chunks, so only per-chunk meshes are disposed
      c.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.Mesh).geometry.dispose(); });
      const signs = c.group.getObjectByName("signs");
      if (signs) disposeSigns(signs);
      this.loaded.delete(key);
      this.onEvict?.(key);
      this.evictionsTotal++;
    }
    await Promise.all(jobs);
  }
}
