import * as THREE from "three/webgpu";
import { campus } from "@/config";
import { decodeChunk, sampleHeight } from "./decode";
import { buildChunk, type BuiltChunk } from "./chunkMesh";
import type { Materials } from "./materials";

export interface WorldIndex {
  chunk_size: number; cols: number; rows: number; grid_origin_e: number; grid_origin_n: number;
  ground_classes: string[]; prop_kinds: string[];
  chunks: { i: number; j: number; file: string; buildings: number; trees: number; props: number; bytes: number }[];
}

const ORIGIN = campus.origin;

/** Streams 256 m chunks around a focus point: full detail within `radius` chunks. */
export class WorldStream {
  readonly root = new THREE.Group();
  index!: WorldIndex;
  private loaded = new Map<string, BuiltChunk>();
  private pending = new Map<string, Promise<void>>();
  loadsTotal = 0;
  evictionsTotal = 0;
  everLoaded = new Set<string>();
  onLoad?: (key: string, c: BuiltChunk) => void;
  onEvict?: (key: string) => void;

  constructor(private mats: Materials, private radius = campus.stream.full_radius_chunks) {
    this.root.name = "world";
  }

  async init() {
    this.index = await (await fetch("/world/index.json")).json();
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

  buildingMeshes(): THREE.Mesh[] {
    return [...this.loaded.values()].flatMap((c) => c.buildingMeshes);
  }

  loadedKeys(): string[] { return [...this.loaded.keys()]; }

  isLoaded(i: number, j: number) { return this.loaded.has(`${i}_${j}`); }

  buildingCount(key: string): number { return this.loaded.get(key)?.buildingCount ?? -1; }

  private async load(i: number, j: number) {
    const key = `${i}_${j}`;
    const entry = this.index.chunks.find((c) => c.i === i && c.j === j);
    if (!entry) return;
    const buf = await (await fetch(`/world/${entry.file}`)).arrayBuffer();
    const chunk = decodeChunk(buf);
    const built = buildChunk(chunk, this.mats, this.index.ground_classes, this.index.prop_kinds);
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
        if (!p) {
          p = this.load(i, j).finally(() => this.pending.delete(key));
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
      this.loaded.delete(key);
      this.onEvict?.(key);
      this.evictionsTotal++;
    }
    await Promise.all(jobs);
  }
}
