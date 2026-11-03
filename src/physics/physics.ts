import RAPIER from "@dimforge/rapier3d-compat";

export type Rapier = typeof RAPIER;

let ready: Promise<Rapier> | null = null;

/** Initialise the Rapier WASM module once. */
export function loadRapier(): Promise<Rapier> {
  if (!ready) ready = RAPIER.init().then(() => RAPIER);
  return ready;
}

/**
 * Collision groups (upper 16 bits membership, lower 16 filter). The world's static colliders keep
 * the default (all). Dragged items collide with the world and each other but not the goose, whose
 * capsule would otherwise shove the item it holds.
 */
export const GROUP_GOOSE = (0x0002 << 16) | 0xfffb;
export const GROUP_ITEM = (0x0004 << 16) | 0x0005;

/** Physics world: a terrain heightfield and a building trimesh per loaded chunk. */
export class Physics {
  readonly world: RAPIER.World;
  private chunkColliders = new Map<string, RAPIER.Collider[]>();

  constructor(readonly R: Rapier) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
  }

  /** heights: row-major, row 0 at the chunk's north edge (local z = 0); x0, z0: chunk world origin. */
  addChunk(key: string, heights: Float32Array, n: number, size: number, x0: number, z0: number,
    walls: Float32Array | null) {
    const R = this.R;
    const cm = new Float32Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cm[c * n + r] = heights[r * n + c];
    const hf = R.ColliderDesc.heightfield(n - 1, n - 1, cm, { x: size, y: 1, z: size })
      .setTranslation(x0 + size / 2, 0, z0 + size / 2);
    const list = [this.world.createCollider(hf)];
    if (walls && walls.length >= 9) {
      const idx = new Uint32Array(walls.length / 3);
      for (let k = 0; k < idx.length; k++) idx[k] = k;
      const tm = R.ColliderDesc.trimesh(walls, idx).setTranslation(x0, 0, z0);
      list.push(this.world.createCollider(tm));
    }
    this.chunkColliders.set(key, list);
  }

  removeChunk(key: string) {
    for (const c of this.chunkColliders.get(key) ?? []) this.world.removeCollider(c, false);
    this.chunkColliders.delete(key);
  }

  hasChunk(key: string) { return this.chunkColliders.has(key); }
}
