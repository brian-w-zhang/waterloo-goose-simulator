"""Architecture kit for building scripts: walls built as real geometry (recessed windows, reveals,
mullion strips), prisms from footprints, profiles extruded along an axis, tubes for ducts and steel.

Everything goes into one bmesh with a per-face colour name (Kit.face_colour); Kit.finish() makes the
object and paints the palette colours. Coordinates are art metres: x east, y north, z up (game y).
Each building script picks its own numbers (bay, storey, window sizes) from its references; the kit
only does the geometry.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import lib


class Kit:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.faces.layers.int.new("col")
        self.names = []

    def cid(self, colour):
        if colour not in self.names:
            self.names.append(colour)
        return self.names.index(colour)

    def face(self, verts, colour):
        f = self.bm.faces.new([self.bm.verts.new(v) for v in verts])
        f[self.col] = self.cid(colour)
        return f

    def quad(self, a, b, c, d, colour):
        return self.face((a, b, c, d), colour)

    def finish(self, smooth=False):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts[:], dist=1e-4)
        faces = [(f.index, self.names[f[self.col]]) for f in self.bm.faces]
        ob = lib.mesh_object(self.name, self.bm)
        by = {}
        for i, c in faces:
            by.setdefault(c, []).append(i)
        for c, idx in by.items():
            group = "world"
            lib.paint(ob, lib.swatch(c, group), idx)
        if not smooth:
            for p in ob.data.polygons:
                p.use_smooth = False
        return ob

    # -- walls -----------------------------------------------------------------------------------

    def wall(self, p, q, z0, z1, colour, windows=None, outward=None):
        """A vertical wall from p to q (2D, counter-clockwise footprint order: outside on the right).

        windows: dict with storey (m), bay (m), w, h (window size), sill (above storey floor),
        depth (recess), first (lowest storey floor above z0, default 0), top_margin (no windows
        within this of z1), glass (colour), frame (colour of reveals), skip(storey, bay) -> bool,
        lintel (colour band over each window, optional), ledge = (height, projection, colour): a
        hood projecting along the wall over each window row.
        """
        p, q = Vector((p[0], p[1], 0)), Vector((q[0], q[1], 0))
        L = (q - p).length
        if L < 1e-3:
            return
        t = (q - p) / L
        n = Vector((t.y, -t.x, 0)) if outward is None else Vector(outward)   # outside normal
        P = lambda s, z: p + t * s + Vector((0, 0, z))
        if not windows or L < windows["bay"] * 0.8:
            self.quad(P(0, z0), P(L, z0), P(L, z1), P(0, z1), colour)
            return
        W = windows
        bays = max(1, round(L / W["bay"]))
        bw = L / bays
        first = W.get("first", 0.0)
        tops = []
        z = z0 + first
        while z + W["sill"] + W["h"] <= z1 - W.get("top_margin", 0.6) + 1e-6:
            tops.append(z)
            z += W["storey"]
        # horizontal cut levels and vertical cut positions make a grid; window cells are recessed
        zs = sorted({z0, z1, *[s + W["sill"] for s in tops], *[s + W["sill"] + W["h"] for s in tops]})
        ss = sorted({0.0, L, *[b * bw + (bw - W["w"]) / 2 for b in range(bays)], *[b * bw + (bw + W["w"]) / 2 for b in range(bays)]})
        d = W.get("depth", 0.15)
        if W.get("ledge"):
            # a projecting hood along the whole wall over every window row (MC-style bands)
            lh, pr, lc = W["ledge"]
            for s_ in tops:
                za, zb = s_ + W["sill"] + W["h"], s_ + W["sill"] + W["h"] + lh
                o = n * pr
                self.quad(P(0, za) + o, P(L, za) + o, P(L, zb) + o, P(0, zb) + o, lc)        # front
                self.quad(P(0, zb), P(0, zb) + o, P(L, zb) + o, P(L, zb), lc)                # top
                self.quad(P(0, za), P(L, za), P(L, za) + o, P(0, za) + o, W.get("frame", lc))  # soffit
                self.quad(P(0, za), P(0, za) + o, P(0, zb) + o, P(0, zb), lc)
                self.quad(P(L, za), P(L, zb), P(L, zb) + o, P(L, za) + o, lc)
        for i in range(len(ss) - 1):
            for j in range(len(zs) - 1):
                sa, sb, za, zb = ss[i], ss[i + 1], zs[j], zs[j + 1]
                sm, zm = (sa + sb) / 2, (za + zb) / 2
                b = int(sm // bw)
                inx = abs(sm - (b * bw + bw / 2)) < W["w"] / 2
                st = next((k for k, s in enumerate(tops) if s + W["sill"] <= zm <= s + W["sill"] + W["h"]), None)
                if inx and st is not None and not (W.get("skip") and W["skip"](st, b)):
                    # recessed pane plus four reveal faces
                    a0, a1, a2, a3 = P(sa, za), P(sb, za), P(sb, zb), P(sa, zb)
                    off = -n * d
                    self.quad(a0 + off, a1 + off, a2 + off, a3 + off, W.get("glass", "window_dark"))
                    fr = W.get("frame", colour)
                    self.quad(a0, a1, a1 + off, a0 + off, fr)           # sill
                    self.quad(a3 + off, a2 + off, a2, a3, fr)           # head
                    self.quad(a0, a0 + off, a3 + off, a3, fr)           # jamb
                    self.quad(a1 + off, a1, a2, a2 + off, fr)           # jamb
                else:
                    c = colour
                    if W.get("lintel") and st is None and any(abs(za - (s + W["sill"] + W["h"])) < 1e-6 for s in tops) and zb - za < 0.8:
                        c = W["lintel"]
                    self.quad(P(sa, za), P(sb, za), P(sb, zb), P(sa, zb), c)

    def curtain(self, p, q, z0, z1, glass, mullion, bay=1.5, row=1.8, strip=0.1, spandrel=None, every=None):
        """Flush curtain wall: glass panes with mullion strips (coplanar, no depth)."""
        p, q = Vector((p[0], p[1], 0)), Vector((q[0], q[1], 0))
        L = (q - p).length
        t = (q - p) / L
        nb, nr = max(1, round(L / bay)), max(1, round((z1 - z0) / row))
        P = lambda s, z: p + t * s + Vector((0, 0, z))
        cols = []
        for b in range(nb):
            s0, s1 = b * L / nb, (b + 1) * L / nb
            cols += [(s0, s0 + strip, mullion), (s0 + strip, s1, None)]
        rows = []
        for r in range(nr):
            a, c = z0 + r * (z1 - z0) / nr, z0 + (r + 1) * (z1 - z0) / nr
            rows += [(a, a + strip, mullion), (a + strip, c, None)]
        for sa, sb, cm in cols:
            for za, zb, rm in rows:
                c = cm or rm or glass
                if c == glass and spandrel and every and int(round((za - z0) / ((z1 - z0) / nr))) % every == every - 1:
                    c = spandrel
                self.quad(P(sa, za), P(sb, za), P(sb, zb), P(sa, zb), c)
        self.quad(P(L - strip, z0), P(L, z0), P(L, z1), P(L - strip, z1), mullion)

    def roof(self, ring, z, colour):
        """Flat cap over a footprint ring (triangulated, concave rings are fine)."""
        bm = bmesh.new()
        vs = [bm.verts.new((x, y, z)) for x, y in ring]
        f = bm.faces.new(vs)
        if f.normal.z < 0:
            f.normal_flip()
        tris = bmesh.ops.triangulate(bm, faces=[f])["faces"]
        for tf in tris:
            self.face([v.co.copy() for v in tf.verts], colour)
        bm.free()

    def tier(self, tier, z0, z1, wall_colour, roof_colour, windows=None):
        """A lidar tier from data.lidar_massing: outer and hole walls, roof from its triangles."""
        for ring in [tier["rings"][0]] + tier.get("holes", []):
            for k in range(len(ring)):
                self.wall(ring[k], ring[(k + 1) % len(ring)], z0, z1, wall_colour, windows)
        for t in tier["tris"]:
            a, b, c = (Vector((x, y, z1)) for x, y in t)
            if (b - a).cross(c - a).z < 0:
                b, c = c, b
            self.face([a, b, c], roof_colour)

    def prism(self, ring, z0, z1, wall_colour, roof_colour, windows=None, parapet=None, coping=None):
        """Extruded footprint: walls (with windows) and a flat roof; optional parapet with coping."""
        ring = ccw(ring)
        for k in range(len(ring)):
            self.wall(ring[k], ring[(k + 1) % len(ring)], z0, z1, wall_colour, windows)
        if parapet:
            self.roof(inset(ring, parapet[0]), z1 - parapet[1], roof_colour)
            for k in range(len(ring)):
                a, b = Vector((*ring[k], z1)), Vector((*ring[(k + 1) % len(ring)], z1))
                ia, ib = inset(ring, parapet[0])[k], inset(ring, parapet[0])[(k + 1) % len(ring)]
                ia, ib = Vector((*ia, z1)), Vector((*ib, z1))
                self.quad(a, b, ib, ia, coping or wall_colour)
                self.quad(ib - Vector((0, 0, parapet[1])), ia - Vector((0, 0, parapet[1])), ia, ib, wall_colour)
        else:
            self.roof(ring, z1, roof_colour)

    # -- profiles and tubes ------------------------------------------------------------------------

    def extrude_profile(self, profile, colours, origin, u, s0, s1, caps=None, ribs=None, rows=None):
        """Extrude a closed (t, z) profile along axis u from s0 to s1 (t runs along u rotated +90 deg).

        colours[k] colours the face swept by profile edge k; caps (colour) closes both ends;
        ribs = (spacing, strip, colour) splits the sweep into bays with strips of another colour
        (mullions on curved glass); rows = (spacing, strip, colour) adds transom strips across the
        glazed edges (the colours listed after ribs[2]).
        """
        o = Vector((origin[0], origin[1], 0))
        u = Vector((u[0], u[1], 0)).normalized()
        v = Vector((-u.y, u.x, 0))
        X = lambda s, t, z: o + u * s + v * t + Vector((0, 0, z))
        if rows:
            # split the glazed profile edges into panes with transom strips (horizontal rails)
            sp, st, rc = rows
            P2, C2 = [], []
            for k in range(len(profile)):
                a, b = Vector(profile[k]), Vector(profile[(k + 1) % len(profile)])
                c = colours[k]
                L = (b - a).length
                if ribs and c in ribs[3:] and L > sp * 0.6:
                    n = max(1, round(L / sp))
                    for j in range(n):
                        p0 = a + (b - a) * (j / n)
                        p1 = a + (b - a) * (j / n) + (b - a).normalized() * st
                        P2 += [tuple(p0), tuple(p1)]
                        C2 += [rc, c]
                else:
                    P2.append(tuple(a))
                    C2.append(c)
            profile, colours = P2, C2
        ct = sum(t for t, _ in profile) / len(profile)
        cz = sum(z for _, z in profile) / len(profile)
        cuts = [s0, s1]
        if ribs:
            sp, st = ribs[0], ribs[1]
            n = max(1, round((s1 - s0) / sp))
            cuts = sorted({s0, s1, *[s0 + k * (s1 - s0) / n for k in range(n)], *[s0 + k * (s1 - s0) / n + st for k in range(n)]})
        for i in range(len(cuts) - 1):
            sa, sb = cuts[i], cuts[i + 1]
            is_rib = ribs and any(abs(sa - (s0 + k * (s1 - s0) / max(1, round((s1 - s0) / ribs[0])))) < 1e-6
                                  for k in range(max(1, round((s1 - s0) / ribs[0]))))
            for k in range(len(profile)):
                (ta, za), (tb, zb) = profile[k], profile[(k + 1) % len(profile)]
                c = colours[k]
                if is_rib and c in ribs[3:]:
                    c = ribs[2]
                if c is None:
                    continue
                q = [X(sa, ta, za), X(sa, tb, zb), X(sb, tb, zb), X(sb, ta, za)]
                # outward: away from the profile's centroid (the profiles used are convex enough)
                nrm = (q[1] - q[0]).cross(q[3] - q[0])
                mid = (q[0] + q[2]) / 2
                if nrm.dot(mid - X((sa + sb) / 2, ct, cz)) < 0:
                    q = [q[0], q[3], q[2], q[1]]
                self.quad(*q, c)
        if caps:
            for s, flip in ((s0, True), (s1, False)):
                pts = [X(s, t, z) for t, z in profile]
                bm = bmesh.new()
                f = bm.faces.new([bm.verts.new(p) for p in (reversed(pts) if flip else pts)])
                for tf in bmesh.ops.triangulate(bm, faces=[f])["faces"]:
                    self.face([vv.co.copy() for vv in tf.verts], caps)
                bm.free()

    def tube(self, path, r, colour, sides=10):
        """A round tube through 3D points (ducts, steel columns, rails); ends capped."""
        path = [Vector(p) for p in path]
        rings = []
        for k, p in enumerate(path):
            a, b = path[max(k - 1, 0)], path[min(k + 1, len(path) - 1)]
            t = (b - a).normalized()
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            x = t.cross(ref).normalized()
            y = t.cross(x).normalized()
            rings.append([p + (x * math.cos(2 * math.pi * j / sides) + y * math.sin(2 * math.pi * j / sides)) * r for j in range(sides)])
        for k in range(len(rings) - 1):
            for j in range(sides):
                q = [rings[k][j], rings[k][(j + 1) % sides], rings[k + 1][(j + 1) % sides], rings[k + 1][j]]
                if (q[1] - q[0]).cross(q[3] - q[0]).dot((q[0] + q[2]) / 2 - (path[k] + path[k + 1]) / 2) < 0:
                    q = [q[0], q[3], q[2], q[1]]
                self.quad(*q, colour)
        for ring, p, nb in ((rings[0], path[0], path[1]), (rings[-1], path[-1], path[-2])):
            f = list(ring)
            if (f[1] - f[0]).cross(f[2] - f[0]).dot(p - nb) < 0:
                f.reverse()
            self.face(f, colour)

    def box(self, centre, size, colour, rot=0.0):
        cx, cy, cz = centre
        sx, sy, sz = (s / 2 for s in size)
        R = Matrix.Rotation(rot, 3, "Z")
        c = Vector(centre)
        V = [c + R @ Vector((x, y, z)) for z in (-sz, sz) for y in (-sy, sy) for x in (-sx, sx)]
        for idx in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
            self.face([V[i] for i in idx], colour)


def ccw(ring):
    a = sum(ring[k][0] * ring[(k + 1) % len(ring)][1] - ring[(k + 1) % len(ring)][0] * ring[k][1] for k in range(len(ring)))
    return list(ring) if a > 0 else list(reversed(ring))


def inset(ring, d):
    """Offset a ccw ring inward by d (miter joins; fine for the small parapet insets used here)."""
    out = []
    n = len(ring)
    for k in range(n):
        p0, p1, p2 = Vector(ring[k - 1]), Vector(ring[k]), Vector(ring[(k + 1) % n])
        e0, e1 = (p1 - p0).normalized(), (p2 - p1).normalized()
        n0, n1 = Vector((-e0.y, e0.x)), Vector((-e1.y, e1.x))
        m = (n0 + n1)
        if m.length < 1e-6:
            m = n0
        m.normalize()
        s = d / max(m.dot(n1), 0.3)
        out.append(tuple(p1 + m * s))
    return out
