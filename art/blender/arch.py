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
            name = c.split("+")[0].strip() if isinstance(c, str) else c
            try:
                col = lib.swatch(name, "world")
            except KeyError:
                # a spec colour the palette does not have yet: neutral, and say so
                print(f"[art] {self.name}: unknown colour {c!r}, drawn as concrete")
                col = lib.swatch("concrete", "world")
            lib.paint(ob, col, idx)
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


def _clip(a, b, s0, s1, z0, z1):
    """Liang-Barsky clip of segment a-b (2D) to [s0, s1] x [z0, z1]."""
    t0, t1 = 0.0, 1.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - s0), (dx, s1 - a[0]), (-dy, a[1] - z0), (dy, z1 - a[1])):
        if abs(p) < 1e-12:
            if q < 0:
                return None
        else:
            r = q / p
            if p < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
    if t0 > t1:
        return None
    return (a[0] + dx * t0, a[1] + dy * t0), (a[0] + dx * t1, a[1] + dy * t1)


def _strip(kit, P, n, a, b, half, depth, colour):
    """A flat bar from a to b (wall coords s, z), half-width `half`, standing `depth` proud of the wall."""
    a, b = Vector((a[0], a[1])), Vector((b[0], b[1]))
    d = b - a
    if d.length < 1e-4:
        return
    side = Vector((-d.y, d.x)).normalized() * half
    q = [P(*(a + side)), P(*(b + side)), P(*(b - side)), P(*(a - side))]
    o = n * depth
    kit.quad(q[3] + o, q[2] + o, q[1] + o, q[0] + o, colour)
    for i in range(4):
        kit.quad(q[i], q[(i + 1) % 4], q[(i + 1) % 4] + o, q[i] + o, colour)


def honeycomb(kit, p, q, z0, z1, glass, frame, cell_w=5.8, cell_h=8.0, chev=1.6, bar=0.28, depth=0.55, phase=0.0, mullion=None):
    """Glass wall with a proud hexagonal frame (QNC's cube): tall hex cells, rows offset half a cell."""
    p3, q3 = Vector((p[0], p[1], 0)), Vector((q[0], q[1], 0))
    L = (q3 - p3).length
    t = (q3 - p3) / L
    n = Vector((t.y, -t.x, 0))
    P = lambda s, z: p3 + t * s + Vector((0, 0, z))
    if mullion:
        kit.curtain(p, q, z0, z1, glass, mullion, bay=1.45, row=z1 - z0, strip=0.06)
    else:
        kit.quad(P(0, z0), P(L, z0), P(L, z1), P(0, z1), glass)
    w2, h2 = cell_w / 2, cell_h / 2
    rows = int((z1 - z0) / (cell_h - chev)) + 2
    cols = int(L / cell_w) + 3
    for r in range(-1, rows):
        cz = z0 + r * (cell_h - chev)
        off = (w2 if r % 2 else 0.0) + phase
        for c in range(-1, cols):
            cs = c * cell_w + off
            hexv = [(cs - w2, cz - h2 + chev), (cs, cz - h2), (cs + w2, cz - h2 + chev),
                    (cs + w2, cz + h2 - chev), (cs, cz + h2), (cs - w2, cz + h2 - chev)]
            for k in range(6):
                seg = _clip(hexv[k], hexv[(k + 1) % 6], 0, L, z0, z1)
                if seg:
                    _strip(kit, P, n, seg[0], seg[1], bar, depth, frame)
    # frame border along the wall edges
    for a, b in (((0, z0), (L, z0)), ((0, z1), (L, z1)), ((0, z0), (0, z1)), ((L, z0), (L, z1))):
        _strip(kit, P, n, a, b, bar, depth, frame)


def fins(kit, p, q, z0, z1, glass, fin, pitch=1.2, depth=0.6, thick=0.12, spandrel=None, storey=None):
    """Curtain wall with deep vertical fins (QNC's bar, Dana Porter's precast fins)."""
    p3, q3 = Vector((p[0], p[1], 0)), Vector((q[0], q[1], 0))
    L = (q3 - p3).length
    if L < 0.5:
        return
    t = (q3 - p3) / L
    n = Vector((t.y, -t.x, 0))
    P = lambda s, z: p3 + t * s + Vector((0, 0, z))
    if spandrel and storey:
        z = z0
        while z < z1 - 1e-6:
            zt = min(z + storey, z1)
            kit.quad(P(0, z), P(L, z), P(L, z + 0.9 if z + 0.9 < zt else zt), P(0, z + 0.9 if z + 0.9 < zt else zt), spandrel)
            if z + 0.9 < zt:
                kit.quad(P(0, z + 0.9), P(L, z + 0.9), P(L, zt), P(0, zt), glass)
            z = zt
    else:
        kit.quad(P(0, z0), P(L, z0), P(L, z1), P(0, z1), glass)
    nf = max(1, round(L / pitch))
    for k in range(nf + 1):
        s = min(L, k * L / nf)
        _strip(kit, P, n, (s, z0), (s, z1), thick, depth, fin)


def dome(kit, centre, r, z, colour, segs=12, rings=5):
    """A hemisphere (observatory domes, skylight domes)."""
    cx, cy = centre
    pts = [(r * math.cos((math.pi / 2) * i / rings), z + r * math.sin((math.pi / 2) * i / rings)) for i in range(rings + 1)]
    for i in range(rings):
        (r0, z0), (r1, z1) = pts[i], pts[i + 1]
        for j in range(segs):
            t0, t1 = 2 * math.pi * j / segs, 2 * math.pi * (j + 1) / segs
            a = Vector((cx + r0 * math.cos(t0), cy + r0 * math.sin(t0), z0))
            b = Vector((cx + r0 * math.cos(t1), cy + r0 * math.sin(t1), z0))
            c = Vector((cx + r1 * math.cos(t1), cy + r1 * math.sin(t1), z1))
            d = Vector((cx + r1 * math.cos(t0), cy + r1 * math.sin(t0), z1))
            if i == rings - 1:
                kit.face([a, b, c], colour)
            else:
                kit.quad(a, b, c, d, colour)


# -- authored facades ------------------------------------------------------------------------------

def facade(kit, a, b, z0, spec, full=None, s_off=0.0, z_top=None, z_from=None):
    """One wall drawn from an authored spec (read off that wall's Street View and Earth photos).

    spec = {
      "rows": [(height, "row kind"), ...]            bottom to top; kinds are keys of "cells"
      "bays": "PWWWDWWWP" or [(width, "bay kind"), ...] (a string uses "bay_w" for every bay and
                                                       stretches the wall evenly)
      "bay_w": 3.0,
      "cells": {("row kind", "bay kind"): cell, ...,  cell = None (plain wall), or a dict:
                 "*": default per row kind}            {"type": "window"|"door"|"glass"|"panel"|"louvre"|"blank",
                                                        "w": frac or m, "h", "sill", "depth", "colour", "frame",
                                                        "mullions": n vertical, "transoms": n horizontal}
      "wall": colour, "bands": [(z_from, z_to, colour, projection)], "piers": [(s, width, colour, projection)],
      "coping": (height, colour, projection)
    }
    Coordinates along the wall run from a to b (outside on the right, as in Kit.wall); z0 is the
    building's ground. Returns the top height.
    full, s_off: draw only part of a documented wall: the spec's bays are laid out over the wall's
    full length `full`, and this segment a-b covers [s_off, s_off + |ab|] of it (a lidar tier edge
    that is part of a longer facade). z_top clips the rows (a lower tier on the same facade).
    """
    p3, q3 = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
    L = (q3 - p3).length
    if L < 0.3:
        return z0
    t = (q3 - p3) / L
    n = Vector((t.y, -t.x, 0))
    P = lambda s, z: p3 + t * s + Vector((0, 0, z))
    wall = spec.get("wall", "concrete")
    # bays
    FL = full or L
    bays = spec["bays"]
    if isinstance(bays, str):
        bw = spec.get("bay_w", 3.0)
        n_rep = max(1, round(FL / (bw * len(bays)))) if spec.get("repeat") else 1
        seq = bays * n_rep
        w = FL / len(seq)
        bays = [(w, ch) for ch in seq]
    else:
        tot = sum(w for w, _ in bays)
        bays = [(w * FL / tot, k) for w, k in bays]
    rows, z = [], z0
    for hgt, kind in spec["rows"]:
        if z_top is not None and z >= z_top - 1e-3:
            break
        zb = z + hgt if z_top is None else min(z + hgt, z_top)
        if z_from is None or zb > z_from + 1e-3:
            rows.append((max(z, z_from) if z_from is not None else z, zb, kind))
        z = zb
    top = z
    cells = spec.get("cells", {})
    # flush bands (projection 0) recolour the wall of the rows they cover instead of covering windows
    flush = [(z0 + zf, z0 + zt, col) for zf, zt, col, proj in spec.get("bands", []) if not proj]
    def row_wall(za, zb):
        for fa, fb, col in flush:
            if min(zb, fb) - max(za, fa) > 0.5 * (zb - za):
                return col
        return wall
    s = 0.0
    for bw, bk in bays:
        # the part of this bay on the segment, in segment coordinates
        a0, a1 = max(s, s_off) - s_off, min(s + bw, s_off + L) - s_off
        if a1 - a0 > 1e-3:
            whole = abs((a1 - a0) - bw) < 1e-3
            for za, zb, rk in rows:
                # most specific first: row/bay, row/*, */bay, */*; an explicit null means plain wall
                cell = next((cells[k_] for k_ in ((rk, bk), (rk, "*"), ("*", bk), ("*", "*")) if k_ in cells), None)
                # a bay cut by the segment end keeps its wall colour only (no half windows)
                rw = row_wall(za, zb)
                _cell(kit, P, n, a0, a1, za, zb, cell if whole else ({"type": "blank", "colour": cell.get("colour", rw)} if cell else None), rw)
        s += bw
    rib = spec.get("ribbed")
    if rib:
        # corrugated metal rows: thin horizontal ridges a little proud of the wall
        for za, zb, rk in rows:
            if rk in rib["rows"]:
                z = za + rib["pitch"] / 2
                while z < zb - rib["pitch"] / 4:
                    _band(kit, P, n, 0, L, z, z + rib["pitch"] * 0.35, rib["colour"], 0.03)
                    z += rib["pitch"]
    for zf, zt, col, proj in spec.get("bands", []):
        if not proj or (z_from is not None and z0 + zt <= z_from):
            continue
        if z_top is None or z0 + zf < z_top:
            _band(kit, P, n, 0, L, z0 + zf, min(z0 + zt, z_top or 1e9), col, proj)
    for sp, pw, col, proj in spec.get("piers", []):
        sp = sp * L if 0 <= sp <= 1 and isinstance(sp, float) and spec.get("pier_frac") else sp
        _band(kit, P, n, sp - pw / 2, sp + pw / 2, z0, top, col, proj)
    for sg in spec.get("signs", []):
        ss = float(sg["s"]) - s_off
        zz = float(sg.get("z", 3.0))
        if -sg["w"] < ss < L and (z_top is None or z0 + zz < z_top):
            col = sg.get("colour", "panel_white")
            col = col if isinstance(col, str) and not col.startswith("#") else "panel_white"
            _band(kit, P, n, max(0.0, ss - sg["w"] / 2), min(L, ss + sg["w"] / 2), z0 + zz, z0 + zz + sg["h"], col, 0.08)
            if sg.get("text"):
                tc = sg.get("text_colour") or "panel_white"
                tc = tc if isinstance(tc, str) and not tc.startswith("#") else "panel_white"
                sign_text(kit, P, n, ss, z0 + zz + sg["h"] / 2, sg["w"] * 0.9, sg["h"] * 0.62, str(sg["text"]), tc)
    if spec.get("coping"):
        ch, col, proj = spec["coping"]
        _band(kit, P, n, 0, L, top, top + ch, col, proj)
        top += ch
    return top


def _band(kit, P, n, s0, s1, z0, z1, col, proj):
    """A strip on the wall face from s0 to s1, z0 to z1, standing `proj` proud (0: flush colour)."""
    o = n * (proj or 0.005)
    a, b, c, d = P(s0, z0), P(s1, z0), P(s1, z1), P(s0, z1)
    kit.quad(a + o, b + o, c + o, d + o, col)
    if proj and proj > 0.01:
        kit.quad(d, c, c + o, d + o, col)        # top
        kit.quad(a, a + o, b + o, b, col)        # underside
        kit.quad(a, d, d + o, a + o, col)
        kit.quad(b, b + o, c + o, c, col)


def _cell(kit, P, n, s0, s1, z0, z1, cell, wall):
    t = (cell or {}).get("type")
    if t == "stripes":
        # alternating light and dark glass strips across the cell, narrow windows in the dark ones
        m = cell.get("module", 1.9)
        lw, lc = cell.get("light", [1.05, "glass_podium"])
        dc = cell.get("dark", [0.85, "stripe_dark"])[1]
        x = s0
        while x < s1 - 1e-3:
            xa, xb = x, min(x + lw, s1)
            kit.quad(P(xa, z0), P(xb, z0), P(xb, z1), P(xa, z1), lc)
            if xb < s1:
                xc = min(x + m, s1)
                kit.quad(P(xb, z0), P(xc, z0), P(xc, z1), P(xb, z1), dc)
                _band(kit, P, n, xb - 0.04, xb + 0.04, z0, z1, "metal_silver", 0.12)
            x += m
        return
    if t == "honeycomb":
        hc = cell.get("_spec", {})
        a2, b2 = P(s0, 0), P(s1, 0)
        honeycomb(kit, (a2.x, a2.y), (b2.x, b2.y), z0, z1, hc.get("glass", "glass_blue"), hc.get("frame", "metal_silver"),
                  cell_w=hc.get("mid_w", 6.2), cell_h=hc.get("hex_h", 9.4), chev=(hc.get("hex_h", 9.4) - hc.get("edge_w", 4.0)) / 2,
                  bar=hc.get("member", 0.35) / 2, depth=hc.get("standoff", 0.8), mullion="mullion")
        return
    if t in ("curtain", "stair_tower"):
        cell = {**cell, "type": "glass", "w": s1 - s0 - 0.02, "h": "full", "mullion_pitch": cell.get("pitch", 1.5),
                "glass": cell.get("glass", "window_glass"), "depth": cell.get("recess", 0.05)}
        t = "glass"
    if t in ("solid", "pier", "mixed", "penthouse", "ribbed", "railing"):
        cell = {"type": "blank", "colour": cell.get("colour", cell.get("glass", wall)) if t != "penthouse" else "penthouse_metal"}
        t = "blank"
    if t == "panel" and cell.get("colour") and not cell.get("depth"):
        cell = {"type": "blank", "colour": cell["colour"]}
        t = "blank"
    if t == "void":
        return                                   # open: nothing drawn (passages under bridges)
    if t == "panel" and cell.get("glass") and cell.get("depth"):
        cell = {**cell, "type": "window", "w": cell.get("w", 1.0), "h": cell.get("h", 1.0), "sill": cell.get("sill", 0.0)}
        t = "window"                          # a recessed infill panel (MC's brick behind the piers)
    if not cell or t in ("blank", "panel", "solid_to"):
        kit.quad(P(s0, z0), P(s1, z0), P(s1, z1), P(s0, z1), (cell or {}).get("colour", wall))
        return
    cell = dict(cell)
    # specs sometimes give a list (one value per window) or text: use the first number
    for key in ("w", "h", "sill", "depth", "offset", "recess", "strip"):
        v = cell.get(key)
        if isinstance(v, list):
            v = next((x for x in v if isinstance(x, (int, float))), None)
        if isinstance(v, str) and v != "full":
            try:
                v = float(v)
            except ValueError:
                v = None
        if v is None:
            cell.pop(key, None)
        else:
            cell[key] = v
    if t == "glass_gable":
        cell["type"] = "glass"
    W, H = s1 - s0, z1 - z0
    frac = lambda v, full: v * full if v <= 1.0 else v
    if cell.get("h") == "full":
        cell["h"] = H - 0.08
        cell.setdefault("sill", 0.04)
    if cell["type"] == "glass" and "w" not in cell:
        cell["w"] = W - 0.1                      # ribbon or curtain glass runs the whole bay
    if "recess" in cell:
        cell["depth"] = cell["recess"]
    if "leaves" in cell:
        cell.setdefault("mullions", max(0, cell["leaves"] - 1))
    ww = min(W - 0.05, frac(cell.get("w", 0.6), W))
    hh = min(H - 0.05, frac(cell.get("h", 0.55), H))
    if cell.get("mullion_pitch"):
        cell["mullions"] = max(0, round(ww / cell["mullion_pitch"]) - 1)
    if cell.get("transom_pitch"):
        cell["transoms"] = max(0, round(hh / cell["transom_pitch"]) - 1)
    sill = cell.get("sill", 0.0 if cell["type"] in ("door", "glass") else (H - hh) * 0.55)
    sill = min(sill, H - hh)
    x0 = s0 + (W - ww) / 2 + cell.get("offset", 0.0)
    x1 = x0 + ww
    y0, y1 = z0 + sill, z0 + sill + hh
    col = cell.get("colour", wall)
    # wall around the opening
    for (sa, sb, za, zb) in ((s0, x0, z0, z1), (x1, s1, z0, z1), (x0, x1, z0, y0), (x0, x1, y1, z1)):
        if sb - sa > 1e-4 and zb - za > 1e-4:
            kit.quad(P(sa, za), P(sb, za), P(sb, zb), P(sa, zb), col)
    d = cell.get("depth", 0.15 if cell["type"] != "panel" else 0.0)
    off = -n * d
    glass = cell.get("glass", {"door": "window_dark", "glass": "window_glass", "panel": "metal_shade", "louvre": "metal_shade"}.get(cell["type"], "window_dark"))
    frame = cell.get("frame", col)
    a0, a1, a2, a3 = P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)
    if d > 0:
        kit.quad(a0, a1, a1 + off, a0 + off, cell.get("sill_colour", frame))
        kit.quad(a3 + off, a2 + off, a2, a3, frame)
        kit.quad(a0, a0 + off, a3 + off, a3, frame)
        kit.quad(a1 + off, a1, a2, a2 + off, frame)
    # the pane, split by mullions and transoms (flush strips in the frame colour)
    nm, nt = cell.get("mullions", 0), cell.get("transoms", 0)
    # specs sometimes list transom heights instead of a count
    nm = len(nm) if isinstance(nm, list) else int(nm or 0)
    nt = len(nt) if isinstance(nt, list) else int(nt or 0)
    strip = cell.get("strip", 0.07)
    xs = [x0 + (x1 - x0) * i / (nm + 1) for i in range(nm + 2)]
    ys = [y0 + (y1 - y0) * j / (nt + 1) for j in range(nt + 2)]
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            xa, xb, ya, yb = xs[i], xs[i + 1], ys[j], ys[j + 1]
            kit.quad(P(xa, ya) + off, P(xb, ya) + off, P(xb, yb) + off, P(xa, yb) + off, glass)
    mc = cell.get("mullion_colour", frame)
    for xm in xs[1:-1]:
        kit.quad(P(xm - strip / 2, y0) + off * 0.6, P(xm + strip / 2, y0) + off * 0.6, P(xm + strip / 2, y1) + off * 0.6, P(xm - strip / 2, y1) + off * 0.6, mc)
    for ym in ys[1:-1]:
        kit.quad(P(x0, ym - strip / 2) + off * 0.6, P(x1, ym - strip / 2) + off * 0.6, P(x1, ym + strip / 2) + off * 0.6, P(x0, ym + strip / 2) + off * 0.6, mc)
    if cell["type"] == "louvre":
        for j in range(1, int((y1 - y0) / 0.25)):
            yy = y0 + j * 0.25
            kit.quad(P(x0, yy) + off * 0.3, P(x1, yy) + off * 0.3, P(x1, yy + 0.06) + off * 0.3, P(x0, yy + 0.06) + off * 0.3, frame)
    if cell.get("hood"):
        # a projecting window box (MC): fins either side, a head on top and a soffit sloping back
        # from the sill line down to the wall face
        hd = cell["hood"]
        pr, fw = hd.get("projection", 0.6), hd.get("fin_w", 0.4)
        fc = hd.get("fin_colour", frame)
        sc = hd.get("soffit_colour", fc)
        o = n * pr
        for xa, xb in ((x0 - fw, x0), (x1, x1 + fw)):
            xa, xb = max(xa, s0), min(xb, s1)
            if xb - xa > 0.02:
                _band(kit, P, n, xa, xb, y0 - 0.1, y1 + hd.get("head", 0.2), fc, pr)
        _band(kit, P, n, max(x0 - fw, s0), min(x1 + fw, s1), y1, y1 + hd.get("head", 0.2), fc, pr)
        drop = min(1.1, y0 - z0)
        kit.quad(P(x0, y0) + o, P(x1, y0) + o, P(x1, y0 - drop), P(x0, y0 - drop), sc)
    if cell["type"] == "door" and cell.get("canopy"):
        cd, cc = cell["canopy"]
        _band(kit, P, n, x0 - 0.4, x1 + 0.4, y1 + 0.15, y1 + 0.35, cc, cd)


def sign_text(kit, P, n, s_mid, z_mid, max_w, max_h, text, colour):
    """Letters on a sign board: Blender text converted to mesh, fitted inside max_w x max_h,
    standing 0.12 m proud of the wall (the board is 0.08)."""
    import bpy
    text = " ".join(text.split())[:60]
    if not text:
        return
    cu = bpy.data.curves.new("sign_text", "FONT")
    cu.body = text
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.extrude = 0.02
    ob = bpy.data.objects.new("sign_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    xs = [v.co.x for v in me.vertices] or [0.0]
    ys = [v.co.y for v in me.vertices] or [0.0]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = min(max_w / max(w, 1e-3), max_h / max(h, 1e-3))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    base = n * 0.12
    for poly in me.polygons:
        pts = []
        for vi in poly.vertices:
            co = me.vertices[vi].co
            p = P(s_mid + (co.x - cx) * k, z_mid + (co.y - cy) * k) + base + n * co.z * k
            pts.append(p)
        if len(pts) >= 3:
            kit.face(pts, colour)
    ob.evaluated_get(dg).to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
