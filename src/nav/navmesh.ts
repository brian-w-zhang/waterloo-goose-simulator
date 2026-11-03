import { init, NavMeshQuery } from "recast-navigation";
import { generateSoloNavMesh } from "recast-navigation/generators";
import type { V2 } from "@/sim/sim";

/**
 * Recast navmesh for a hotspot (doc 05 section 7): baked in the browser from the loaded terrain
 * triangles plus building walls within a square around the hotspot, so characters path around
 * buildings instead of walking straight lines. Agent radius 0.35 m, height 1.8 m.
 */
let ready: Promise<void> | null = null;
export const loadRecast = () => (ready ??= init());

export interface NavBake { query: NavMeshQuery; ms: number; triangles: number }

export const NAV_CONFIG = {
  cs: 0.3, ch: 0.2, walkableSlopeAngle: 35, walkableHeight: 9, walkableClimb: 2, walkableRadius: 2,
  maxEdgeLen: 40, maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20, maxVertsPerPoly: 6,
  detailSampleDist: 6, detailSampleMaxError: 1,
};

/**
 * positions/indices: world-space walkable ground and obstacle triangles. Returns null if the bake failed.
 */
export async function bakeNavMesh(positions: Float32Array, indices: Uint32Array): Promise<NavBake | null> {
  await loadRecast();
  const t0 = performance.now();
  const { success, navMesh } = generateSoloNavMesh(positions, indices, NAV_CONFIG);
  if (!success || !navMesh) return null;
  const query = new NavMeshQuery(navMesh);
  return { query, ms: performance.now() - t0, triangles: indices.length / 3 };
}

/** A planner for the simulation: ground path from a to b on the navmesh, or a straight line. */
export function planner(bake: NavBake, heightAt: (x: number, z: number) => number) {
  return (a: V2, b: V2): V2[] => {
    const ya = heightAt(a.x, a.z), yb = heightAt(b.x, b.z);
    const res = bake.query.computePath({ x: a.x, y: Number.isFinite(ya) ? ya : 0, z: a.z },
      { x: b.x, y: Number.isFinite(yb) ? yb : 0, z: b.z }, { halfExtents: { x: 3, y: 4, z: 3 } });
    if (!res.success || res.path.length < 2) return [b];
    return res.path.slice(1).map((p) => ({ x: p.x, z: p.z }));
  };
}
