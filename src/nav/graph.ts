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

  /** A* shortest path between node ids (binary-heap open set); returns waypoints or null. */
  route(from: number, to: number): [number, number][] | null {
    const goal = this.pos.get(to);
    if (!goal || !this.pos.has(from)) return null;
    const h = (id: number) => { const p = this.pos.get(id)!; return Math.hypot(p[0] - goal[0], p[1] - goal[1]); };
    const g = new Map<number, number>([[from, 0]]);
    const came = new Map<number, number>();
    const heap: [number, number][] = [[h(from), from]];
    const push = (f: number, id: number) => {
      heap.push([f, id]);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const closed = new Set<number>();
    while (heap.length) {
      const [, cur] = pop();
      if (closed.has(cur)) continue;
      if (cur === to) {
        const out: [number, number][] = [this.pos.get(cur)!];
        let c = cur;
        while (came.has(c)) { c = came.get(c)!; out.push(this.pos.get(c)!); }
        return out.reverse();
      }
      closed.add(cur);
      for (const { to: nb, w } of this.adj.get(cur) ?? []) {
        if (closed.has(nb)) continue;
        const ng = g.get(cur)! + w;
        if (ng < (g.get(nb) ?? Infinity)) {
          g.set(nb, ng);
          came.set(nb, cur);
          push(ng + h(nb), nb);
        }
      }
    }
    return null;
  }

  /** Node ids within `r` metres of (x, z). */
  near(x: number, z: number, r: number): number[] {
    const out: number[] = [];
    for (const [id, [px, pz]] of this.pos) if (this.adj.has(id) && (px - x) ** 2 + (pz - z) ** 2 < r * r) out.push(id);
    return out;
  }
}
