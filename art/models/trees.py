"""Campus trees, one low-poly model per kind and variant: npm run art -- trees  (or trees:tree_maple_0).

Each GLB holds two meshes, size-normalised so the game can fit every tree to its lidar crown
(src/world/chunkMesh.ts treeMeshes):
- "crown": x and y (Blender; game x and z) in [-1, 1] (crown radius 1), z in [0, 1] (crown base to top);
- "trunk": z in [0, 1] from the ground to the middle of the crown, x and y in crown-radius units (so the
  limbs splay into the crown lobes whatever the tree's size).
Crowns are clusters of lobes (not one ball): light swatch on faces looking up, the darker one below.
Species silhouettes follow docs/research/modelling-guide.md section 5 and docs/refs/grounds/trees/NOTES.md.
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector

import lib

KINDS = ["maple", "oak", "locust", "linden", "spruce", "pine", "cedar", "willow", "ornamental", "shrub"]
VARIANTS = {k: 3 for k in KINDS}
VARIANTS["shrub"] = 2
MODELS = {f"tree_{k}_{v}": (k, v) for k in KINDS for v in range(VARIANTS[k])}
META = {m: {"world": False} for m in MODELS}


class Mesh:
    """A bmesh with a palette name per face."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.faces.layers.int.new("col")
        self.names = []

    def _cid(self, c):
        if c not in self.names:
            self.names.append(c)
        return self.names.index(c)

    def ico(self, centre, radii, dark, light, subdiv=1, jitter=0.0, rnd=None, up=0.25):
        """An ellipsoid lobe; faces looking up get the light swatch."""
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=1.0)
        vs = r["verts"]
        for v in vs:
            j = 1 + (rnd.uniform(-jitter, jitter) if rnd else 0)
            v.co = Vector((v.co.x * radii[0] * j + centre[0], v.co.y * radii[1] * j + centre[1], v.co.z * radii[2] * j + centre[2]))
        self._paint_up({f for v in vs for f in v.link_faces}, dark, light, up)

    def cone(self, z0, z1, r, dark, light, sides=9, rnd=None, droop=0.0, lean=(0, 0)):
        """An open-bottomed cone tier (bottom cap closed), rim pulled down by droop."""
        rim = []
        ph = rnd.uniform(0, 6.28) if rnd else 0
        for i in range(sides):
            a = ph + 2 * math.pi * i / sides
            rr = r * (1 + (rnd.uniform(-0.12, 0.12) if rnd else 0))
            rim.append(self.bm.verts.new((rr * math.cos(a) + lean[0], rr * math.sin(a) + lean[1], z0 - droop * (rnd.uniform(0.5, 1) if rnd else 1))))
        mid = [self.bm.verts.new((0.55 * v.co.x, 0.55 * v.co.y, z0 + 0.45 * (z1 - z0) - droop * 0.2)) for v in rim]
        tip = self.bm.verts.new((lean[0] * 1.2, lean[1] * 1.2, z1))
        faces = []
        for i in range(sides):
            j = (i + 1) % sides
            faces.append(self.bm.faces.new((rim[i], rim[j], mid[j], mid[i])))
            faces.append(self.bm.faces.new((mid[i], mid[j], tip)))
        faces.append(self.bm.faces.new(list(reversed(rim))))
        self._paint_up(faces, dark, light, 0.45)

    def tube(self, pts, radii, colour, sides=6):
        """A tapered tube through pts (closed at the ends)."""
        rings = []
        for k, (p, r) in enumerate(zip(pts, radii)):
            p = Vector(p)
            d = (Vector(pts[min(k + 1, len(pts) - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
            a = d.orthogonal().normalized()
            b = d.cross(a)
            rings.append([self.bm.verts.new(p + r * (math.cos(2 * math.pi * i / sides) * a + math.sin(2 * math.pi * i / sides) * b))
                          for i in range(sides)])
        faces = []
        for r0, r1 in zip(rings, rings[1:]):
            for i in range(sides):
                j = (i + 1) % sides
                faces.append(self.bm.faces.new((r0[i], r0[j], r1[j], r1[i])))
        faces.append(self.bm.faces.new(list(reversed(rings[0]))))
        faces.append(self.bm.faces.new(rings[-1]))
        for f in faces:
            f[self.col] = self._cid(colour)

    def _paint_up(self, faces, dark, light, up):
        self.bm.normal_update()
        for f in faces:
            f[self.col] = self._cid(light if f.normal.z > up else dark)

    def finish(self, name, normalise=None, smooth=True):
        bm = self.bm
        if normalise:
            xs = [v.co for v in bm.verts]
            lo = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
            hi = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
            cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
            sx = 2 / max(hi.x - lo.x, 1e-6)
            sy = 2 / max(hi.y - lo.y, 1e-6)
            s = min(sx, sy) if normalise == "uniform_xy" else None
            for v in bm.verts:
                v.co = Vector(((v.co.x - cx) * (s or sx), (v.co.y - cy) * (s or sy), (v.co.z - lo.z) / max(hi.z - lo.z, 1e-6)))
        faces = [(f.index, self.names[f[self.col]]) for f in bm.faces]
        ob = lib.mesh_object(name, bm)
        by = {}
        for i, c in faces:
            by.setdefault(c, []).append(i)
        for c, idx in by.items():
            lib.paint(ob, lib.swatch(c), idx)
        for p in ob.data.polygons:
            p.use_smooth = smooth
        return ob


def trunk(rnd, kind, limbs, fork, spread, r0=0.075, bark="bark"):
    """Trunk to `fork` (0-1 of the trunk mesh height), then limbs out to the crown middle (z 1)."""
    m = Mesh()
    lean = (rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03))
    m.tube([(0, 0, -0.05), (lean[0] * 0.5, lean[1] * 0.5, fork * 0.5), (lean[0], lean[1], fork)], [r0 * 1.15, r0, r0 * 0.85], bark)
    a0 = rnd.uniform(0, 6.28)
    for i in range(limbs):
        a = a0 + 2 * math.pi * i / limbs + rnd.uniform(-0.4, 0.4)
        d = spread * rnd.uniform(0.7, 1.0)
        end = (lean[0] + d * math.cos(a), lean[1] + d * math.sin(a), rnd.uniform(0.92, 1.05))
        mid = (lean[0] + d * 0.45 * math.cos(a), lean[1] + d * 0.45 * math.sin(a), fork + (end[2] - fork) * 0.55)
        m.tube([(lean[0], lean[1], fork - 0.02), mid, end], [r0 * 0.7, r0 * 0.5, r0 * 0.25], bark, sides=5)
    return m


def lobes(m, rnd, spots, dark, light, subdiv=1, jitter=0.08):
    for (x, y, z, r, flat) in spots:
        m.ico((x, y, z), (r, r, r * flat), dark, light, subdiv=subdiv, jitter=jitter, rnd=rnd)


def ring_spots(rnd, n, rad, z, r, flat, zj=0.08, rj=0.15):
    a0 = rnd.uniform(0, 6.28)
    out = []
    for i in range(n):
        a = a0 + 2 * math.pi * i / n + rnd.uniform(-0.35, 0.35)
        rr = rad * rnd.uniform(0.85, 1.1)
        out.append((rr * math.cos(a), rr * math.sin(a), z + rnd.uniform(-zj, zj), r * rnd.uniform(1 - rj, 1 + rj), flat))
    return out


def crown(kind, rnd):
    m = Mesh()
    d, l = f"tree_{kind}", f"tree_{kind}_light"
    if kind == "maple":      # dense round-oval: a ring of lobes, a core and a top
        lobes(m, rnd, [(0, 0, 0.5, 0.62, 0.9)] + ring_spots(rnd, 5, 0.5, 0.45, 0.45, 0.85) + ring_spots(rnd, 2, 0.22, 0.8, 0.4, 0.8), d, l)
    elif kind == "oak":      # broad, spreading, irregular lumps, flatter
        lobes(m, rnd, [(0, 0, 0.55, 0.55, 0.75)] + ring_spots(rnd, 6, 0.62, 0.45, 0.4, 0.7, zj=0.12, rj=0.25)
              + ring_spots(rnd, 2, 0.25, 0.75, 0.38, 0.7), d, l)
    elif kind == "locust":   # airy: small separate flattened lobes with gaps
        lobes(m, rnd, ring_spots(rnd, 5, 0.6, 0.5, 0.3, 0.55, zj=0.15, rj=0.25) + ring_spots(rnd, 2, 0.2, 0.75, 0.3, 0.55), d, l, jitter=0.15)
    elif kind == "linden":   # upright oval to pyramidal: stacked lobes narrowing to the top
        spots = [(0, 0, 0.3, 0.6, 0.6), (0, 0, 0.62, 0.48, 0.55), (0, 0, 0.88, 0.28, 0.5)]
        spots += ring_spots(rnd, 3, 0.45, 0.3, 0.38, 0.6) + ring_spots(rnd, 3, 0.32, 0.6, 0.32, 0.6)
        lobes(m, rnd, spots, d, l)
    elif kind == "spruce":   # dense cone: drooping tiers
        tiers = 5
        for i in range(tiers):
            z0 = i / tiers * 0.82
            r = 1.0 - 0.8 * i / tiers
            m.cone(z0 + 0.06, min(z0 + 0.42, 1.0), r, d, l, sides=8, rnd=rnd, droop=0.06)
        m.cone(0.8, 1.0, 0.22, d, l, sides=6, rnd=rnd)
    elif kind == "pine":     # irregular flat-topped tufts at different heights
        spots = [(rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), 0.8, 0.5, 0.45)]
        spots += ring_spots(rnd, 4, 0.55, 0.55, 0.38, 0.42, zj=0.2, rj=0.25)
        spots += ring_spots(rnd, 2, 0.6, 0.2, 0.3, 0.42, zj=0.08)
        lobes(m, rnd, spots, d, l, jitter=0.12)
    elif kind == "cedar":    # narrow column with a rounded point
        lobes(m, rnd, [(0, 0, 0.25, 0.95, 0.35), (0, 0, 0.55, 0.8, 0.32), (0, 0, 0.8, 0.55, 0.25)], d, l, jitter=0.06)
        m.cone(0.85, 1.0, 0.35, d, l, sides=6, rnd=rnd)
    elif kind == "willow":   # dome with hanging curtains down to the crown base
        lobes(m, rnd, [(0, 0, 0.75, 0.75, 0.35)] + ring_spots(rnd, 4, 0.45, 0.72, 0.4, 0.3), d, l)
        n = 10
        a0 = rnd.uniform(0, 6.28)
        for i in range(n):
            a = a0 + 2 * math.pi * i / n
            rr = rnd.uniform(0.75, 0.95)
            z0 = rnd.uniform(0.0, 0.15)
            # a flattened lobe hanging at the rim: a curtain strip
            m.ico((rr * math.cos(a), rr * math.sin(a), (z0 + 0.7) / 2), (0.2, 0.2, (0.7 - z0) / 2), d, l, subdiv=1, jitter=0.05, rnd=rnd, up=0.6)
    elif kind == "ornamental":   # small round, a few lobes
        lobes(m, rnd, [(0, 0, 0.5, 0.6, 0.85)] + ring_spots(rnd, 3, 0.45, 0.5, 0.45, 0.8), d, l)
    elif kind == "shrub":    # low mound
        lobes(m, rnd, [(0, 0, 0.35, 0.65, 0.6)] + ring_spots(rnd, 3, 0.45, 0.3, 0.45, 0.6), d, l)
    return m


def trunk_for(kind, rnd):
    if kind in ("spruce", "cedar"):
        return trunk(rnd, kind, 0, 1.0, 0, r0=0.06, bark="bark_dark")
    if kind == "pine":
        return trunk(rnd, kind, 3, 0.75, 0.4, r0=0.07, bark="bark_dark")
    if kind == "locust":
        return trunk(rnd, kind, 4, 0.45, 0.55, r0=0.06)
    if kind == "oak":
        return trunk(rnd, kind, 4, 0.55, 0.5, r0=0.08, bark="bark_dark")
    if kind == "willow":
        return trunk(rnd, kind, 3, 0.5, 0.4, r0=0.09)
    if kind == "shrub":
        return trunk(rnd, kind, 3, 0.2, 0.3, r0=0.05)
    if kind == "linden":
        return trunk(rnd, kind, 3, 0.65, 0.3, r0=0.07)
    return trunk(rnd, kind, 3, 0.6, 0.4, r0=0.07)


def build(model):
    kind, v = MODELS[model]
    rnd = random.Random(f"{kind}{v}")
    c = crown(kind, rnd).finish("crown", normalise="xy")
    t = trunk_for(kind, rnd).finish("trunk", smooth=False)
    tris = sum(len(p.vertices) - 2 for o in (c, t) for p in o.data.polygons)
    print(f"[art] {model}: {tris} triangles")
    return [c, t]
