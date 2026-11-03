"""Organic shapes for art scripts: lofts along a spine (one continuous surface, no stacked primitives).

A loft takes cross-sections along a smooth spine: each section is a superellipse (half-width w along
the side axis, half-height h in the spine's plane) whose centre sits on the spine. The side axis is
fixed (symmetric animals: x), so sections never twist. Ends are closed with a fan to a tip vertex.
"""
import math

import bmesh
from mathutils import Vector


def catmull(pts, n):
    """n points along a centripetal-ish Catmull-Rom through pts (Vectors); values interpolate too."""
    out = []
    P = [pts[0]] + list(pts) + [pts[-1]]
    segs = len(pts) - 1
    for k in range(n):
        t = k / (n - 1) * segs
        i = min(int(t), segs - 1)
        u = t - i
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u))
    return out


def lerp_table(table, n):
    """Resample [(centre Vector, w, h, e), ...] to n smooth sections."""
    cs = catmull([t[0] for t in table], n)
    vals = [catmull([Vector((t[1], t[2], t[3])) for t in table], n)]
    return [(cs[k], max(vals[0][k].x, 1e-4), max(vals[0][k].y, 1e-4), max(vals[0][k].z, 1.2)) for k in range(n)]


def loft(bm, table, n_sections=32, ring=14, side=Vector((1, 0, 0)), cap_start=True, cap_end=True,
         drop=None):
    """Add a lofted tube to bm; returns the list of rings (lists of BMVerts).

    table: [(centre, half_width, half_height, exponent)], centre in metres. drop(k, a) can push a
    section point (k = section index, a = angle) for asymmetric profiles such as a flatter belly.
    """
    secs = lerp_table(table, n_sections)
    rings = []
    for k, (c, w, h, e) in enumerate(secs):
        a_ = secs[max(k - 1, 0)][0]
        b_ = secs[min(k + 1, len(secs) - 1)][0]
        tan = (b_ - a_).normalized()
        up = tan.cross(side).normalized()        # in the spine plane, perpendicular to the spine
        sx = side - tan * side.dot(tan)
        sx.normalize()
        r = []
        for j in range(ring):
            a = 2 * math.pi * j / ring
            ca, sa = math.cos(a), math.sin(a)
            x = w * math.copysign(abs(ca) ** (2 / e), ca)
            y = h * math.copysign(abs(sa) ** (2 / e), sa)
            p = c + sx * x + up * y
            if drop:
                p = drop(k, a, p, up)
            r.append(bm.verts.new(p))
        rings.append(r)
    for k in range(len(rings) - 1):
        for j in range(ring):
            a, b = rings[k][j], rings[k][(j + 1) % ring]
            c, d = rings[k + 1][(j + 1) % ring], rings[k + 1][j]
            bm.faces.new((a, b, c, d))
    if cap_start:
        tip = bm.verts.new(secs[0][0])
        for j in range(ring):
            bm.faces.new((rings[0][(j + 1) % ring], rings[0][j], tip))
    if cap_end:
        tip = bm.verts.new(secs[-1][0])
        for j in range(ring):
            bm.faces.new((rings[-1][j], rings[-1][(j + 1) % ring], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return rings
