/** Outdoor walk graph from public/world/network.json with A* routing (NPCs, tests, the walk gate). */

export interface NetWay { id: number; kind: string; name: string; width: number; indoor: boolean; access: string; nodes: number[]; pts: [number, number][] }
export interface Network { inside: number[]; ways: NetWay[]; entrances: { id: number; x: number; z: number }[]; stations: { name: string; pos: [number, number] }[] }

const WALK = new Set(["footway", "path", "pedestrian", "steps", "cycleway", "service", "living_street",
  "unclassified", "tertiary", "secondary", "residential", "primary", "track"]);

export class WalkGraph {
  readonly pos = new Map<number, [number, number]>();
  readonly adj = new Map<number, { to: number; w: number }[]>();

  constructor(net: Network) {
    const inside = new Set(net.inside);
    for (const w of net.ways) {
      if (!WALK.has(w.kind) || w.indoor || w.access === "private" || w.access === "no") continue;
      w.nodes.forEach((id, k) => this.pos.set(id, w.pts[k]));
      for (let k = 0; k + 1 < w.nodes.length; k++) {
        const a = w.nodes[k], b = w.nodes[k + 1];
        if (inside.has(a) || inside.has(b)) continue;  // passages through buildings are not walkable outdoors
        const [ax, az] = w.pts[k], [bx, bz] = w.pts[k + 1];
        const d = Math.hypot(bx - ax, bz - az);
        if (!this.adj.has(a)) this.adj.set(a, []);
        if (!this.adj.has(b)) this.adj.set(b, []);
        this.adj.get(a)!.push({ to: b, w: d });
        this.adj.get(b)!.push({ to: a, w: d });
      }
    }
  }

  nearest(x: number, z: number): number {
    let best = -1, bd = Infinity;
    for (const [id, [px, pz]] of this.pos) {
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd && this.adj.has(id)) { bd = d; best = id; }
    }
    return best;
  }

  /** A* shortest path between node ids; returns waypoints or null. */
  route(from: number, to: number): [number, number][] | null {
    const goal = this.pos.get(to)!;
    const h = (id: number) => { const p = this.pos.get(id)!; return Math.hypot(p[0] - goal[0], p[1] - goal[1]); };
    const g = new Map<number, number>([[from, 0]]);
    const came = new Map<number, number>();
    const open = new Map<number, number>([[from, h(from)]]);
    const closed = new Set<number>();
    while (open.size) {
      let cur = -1, cf = Infinity;
      for (const [id, f] of open) if (f < cf) { cf = f; cur = id; }
      if (cur === to) {
        const out: [number, number][] = [this.pos.get(cur)!];
        while (came.has(cur)) { cur = came.get(cur)!; out.push(this.pos.get(cur)!); }
        return out.reverse();
      }
      open.delete(cur);
      closed.add(cur);
      for (const { to: nb, w } of this.adj.get(cur) ?? []) {
        if (closed.has(nb)) continue;
        const ng = g.get(cur)! + w;
        if (ng < (g.get(nb) ?? Infinity)) {
          g.set(nb, ng);
          came.set(nb, cur);
          open.set(nb, ng + h(nb));
        }
      }
    }
    return null;
  }
}
