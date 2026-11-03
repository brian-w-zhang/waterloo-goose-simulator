/** WGC1 chunk decoder: the same bytes the Python validators read (pipeline/chunkio.py). */

export interface ArrayEntry { offset: number; dtype: "f4" | "u1" | "u2" | "u4" | "i1" | "i4"; count: number }

export interface BuildingPart { h: number; ring_first: number; ring_n: number }
export interface BuildingInfo {
  id: number; objectid: number; abbrev: string; name: string; owner: string | null; style: string;
  ground_y: number; base_y: number; p90: number; post2018: boolean; height_source: string;
  footprint: { ring_first: number; ring_n: number }; parts: BuildingPart[];
}
export interface LakePiece { name: string; objectid: number; y: number; first: number; count: number }

export interface PlatformInfo { ring_first: number; ring_n: number; ground_y: number; deck: number; canopy: boolean; kind: string }

export interface ChunkHeader {
  version: number;
  chunk: { i: number; j: number; e0: number; n1: number; size: number; x0: number; z0: number };
  terrain: { n: number; cell: number; hmin: number; hscale: number };
  lakes: LakePiece[];
  buildings: BuildingInfo[];
  platforms?: PlatformInfo[];
  arrays: Record<string, ArrayEntry>;
}

type Typed = Float32Array | Uint8Array | Uint16Array | Uint32Array | Int8Array | Int32Array;

export interface Chunk { header: ChunkHeader; arrays: Record<string, Typed> }

const CTOR = { f4: Float32Array, u1: Uint8Array, u2: Uint16Array, u4: Uint32Array, i1: Int8Array, i4: Int32Array };

export function decodeChunk(buf: ArrayBuffer): Chunk {
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== "WGC1") throw new Error(`bad chunk magic ${magic}`);
  const headerLen = new DataView(buf).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, headerLen))) as ChunkHeader;
  const base = 8 + headerLen;
  const arrays: Record<string, Typed> = {};
  for (const [name, e] of Object.entries(header.arrays)) {
    arrays[name] = new CTOR[e.dtype](buf, base + e.offset, e.count);
  }
  return { header, arrays };
}

/** Terrain heights (y relative to base elevation) as floats, row 0 at the chunk's north edge. */
export function terrainHeights(c: Chunk): Float32Array {
  const q = c.arrays.terrain_h as Uint16Array;
  const { hmin, hscale } = c.header.terrain;
  const out = new Float32Array(q.length);
  for (let k = 0; k < q.length; k++) out[k] = hmin + q[k] * hscale;
  return out;
}

/** Bilinear terrain height at local (x, z) in metres. */
export function sampleHeight(h: Float32Array, n: number, cell: number, x: number, z: number): number {
  const fx = Math.min(Math.max(x / cell, 0), n - 1.0001);
  const fz = Math.min(Math.max(z / cell, 0), n - 1.0001);
  const c0 = Math.floor(fx), r0 = Math.floor(fz);
  const tx = fx - c0, tz = fz - r0;
  const a = h[r0 * n + c0], b = h[r0 * n + c0 + 1], c = h[(r0 + 1) * n + c0], d = h[(r0 + 1) * n + c0 + 1];
  return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
}
