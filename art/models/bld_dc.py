"""William G. Davis Computer Research Centre (DC), 1988.

References (docs/refs/buildings/dc/): Google Earth 3D views (private/earth_*), City 7 cm orthophoto
2023 (private/ortho_2023aug.jpg), lidar nDSM cross-sections (measured 2026-11-03), Commons photos
(commons/, NOTES.md).

Form, from the lidar cross-sections across the OSM roof:shape=round rectangle (axis bearing ~153 deg):
  - two glass "bars" along the long sides, each ~12 m wide: the outer face is a quarter-round of
    glass curving from the wing roofs (11.8 m) up to a 6 m flat strip at 16.5 m; the inner face
    drops to the central block (11.2 m) as a dark clerestory band
  - a central block 19 m wide at 11.2 m, with a higher cross section (15.7 m) 10-24 m north of centre
  - teal duct elbows over the glass at the same stations on both sides (s = -57, -32, -2.5, 17.5,
    37.5, 55.5 m from the centre; south positive) plus one at the cross section, each ending in a
    white housing on the 16.5 m strip
  - two sawtooth skylight blocks (west and north-east, 4-7 m): four cyan glass slopes between red
    steel beams, ridges parallel to the main axis
  - everything else follows the lidar tiers: beige precast wings with small punched windows
"""
import json
import math
import subprocess
import sys
from pathlib import Path

from mathutils import Vector

import arch
import data
import lib

META = {"world": True, "replaces": [21642, 33305]}

ROOF = {"cx": 1032.351, "cy": 404.622, "ux": 0.45413750554872395, "uy": -0.8909316057105522, "hu": 60.385, "hv": 21.157}
HALF_W = 21.2          # outer face of the glass bars from the axis
BAR_TOP = 16.5         # flat strip on top of each bar
BAR_IN = 9.5           # inner face of the bars (the central block lies within)
CURVE_LOW = 11.8       # where the glass curve starts on the outer face
CURVE_T = 15.5         # where the curve meets the top strip
CORE_H = 11.2
CROSS = (-24.0, -10.0, 15.7)
DUCTS = [-57.0, -32.0, -2.5, 17.5, 37.5, 55.5]

WING = {"storey": 2.85, "bay": 3.0, "w": 1.5, "h": 1.25, "sill": 0.8, "depth": 0.22, "first": 0.2,
        "top_margin": 1.0, "glass": "window_dark", "frame": "cream_panel"}


def frame():
    o = Vector((ROOF["cx"], ROOF["cy"]))
    u = Vector((ROOF["ux"], ROOF["uy"])).normalized()
    v = Vector((-u.y, u.x))
    return o, u, v


def to_xy(s, t):
    o, u, v = frame()
    p = o + u * s + v * t
    return (p.x, p.y)


def bar_profile(side):
    """(t, z) of one glass bar, closed; side = -1 (west) or +1 (east). Edge order: outer wall,
    curve segments, top strip, inner face, bottom."""
    pts = [(side * HALF_W, 0.0), (side * HALF_W, CURVE_LOW)]
    a, b = HALF_W - CURVE_T, BAR_TOP - CURVE_LOW
    for k in range(1, 9):
        ang = math.pi / 2 * k / 8
        pts.append((side * (CURVE_T + a * math.cos(ang)), CURVE_LOW + b * math.sin(ang)))
    pts += [(side * BAR_IN, BAR_TOP), (side * BAR_IN, 0.0)]
    if side > 0:
        pts.reverse()
    return pts


def massing(ground):
    """Lidar tiers outside the hand-built spine (tools.art.massing)."""
    spine = [to_xy(s, t) for s, t in ((-ROOF["hu"], -HALF_W), (ROOF["hu"], -HALF_W), (ROOF["hu"], HALF_W), (-ROOF["hu"], HALF_W))]
    tmp = Path(lib.ROOT) / "data" / "build" / "art"
    spec = tmp / "dc_massing_spec.json"
    out = tmp / "dc_massing.json"
    spec.write_text(json.dumps({"abbrev": "DC", "exclude": [spine], "simplify": 0.7, "merge_dh": 1.2, "min_area": 30, "min_width": 2.5}))
    subprocess.run([str(lib.ROOT / ".venv" / "bin" / "python"), "-m", "tools.art.massing", str(spec), str(out)],
                   cwd=lib.ROOT, check=True)
    return json.loads(out.read_text())


def sawtooth(k, ring, z0, h, ground):
    """Low block with a sawtooth glass roof: ridges parallel to the main axis, red beams between."""
    o, u, v = frame()
    ts = [(Vector(p) - o).dot(v) for p in ring]
    ss = [(Vector(p) - o).dot(u) for p in ring]
    t0, t1, s0, s1 = min(ts), max(ts), min(ss), max(ss)
    lo = z0 + max(h - 3.4, 3.0)
    # pale fluted metal walls up to the eaves
    k.prism([to_xy(s, t) for s, t in ((s0, t0), (s1, t0), (s1, t1), (s0, t1))], z0, lo, "metal_silver", "roof_metal")
    n = 4
    for i in range(n):
        ta, tb = t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n
        A = lambda s, t, z: Vector((*to_xy(s, t), z))
        # bays step up toward the main building (the lidar rises ~0.6 m per bay)
        far, near = (ta, tb) if abs(ta) > abs(tb) else (tb, ta)
        rank = (abs(far) - min(abs(t0), abs(t1))) / max(abs(t1 - t0), 1e-3)
        top = lo + 1.6 + 1.8 * (1 - rank)
        k.quad(A(s0, far, lo), A(s1, far, lo), A(s1, near, top), A(s0, near, top), "glass_teal")
        k.quad(A(s0, near, top), A(s1, near, top), A(s1, near, lo), A(s0, near, lo), "metal_silver")
        k.tube([A(s0, near, top + 0.15), A(s1, near, top + 0.15)], 0.22, "steel_red", sides=6)
        for s in (s0, s1):
            k.face([A(s, far, lo), A(s, near, top), A(s, near, lo)], "metal_silver")


def build():
    parts = data.building_parts("DC")
    ground = max(p["ground_y"] for p in parts)
    k = arch.Kit("bld_dc")
    o, u, v = frame()
    hu = ROOF["hu"]
    # glass bars: curve and outer wall in teal glass with mullion ribs, top strip roof, inner band dark
    for side in (-1, 1):
        prof = [(t, ground + z) for t, z in bar_profile(side)]
        nseg = len(prof)
        cols = ["glass_teal"] * nseg
        cols[-1] = None                                     # bottom: not drawn
        idx_top = 9 if side < 0 else None
        # find edges by geometry: horizontal at BAR_TOP -> roof; vertical at BAR_IN -> clerestory
        for e in range(nseg):
            (ta, za), (tb, zb) = prof[e], prof[(e + 1) % nseg]
            if abs(za - zb) < 1e-6 and abs(za - (ground + BAR_TOP)) < 1e-6:
                cols[e] = "roof_metal"
            elif abs(ta - tb) < 1e-6 and abs(abs(ta) - BAR_IN) < 1e-6:
                cols[e] = "window_dark"
            elif abs(za - zb) < 1e-6 and za <= ground + 0.01:
                cols[e] = None
        k.extrude_profile(prof, cols, (o.x, o.y), (u.x, u.y), -hu, hu, caps="glass_teal",
                          ribs=(2.4, 0.18, "mullion", "glass_teal"), rows=(1.5, 0.14, "mullion"))
    # central block and its higher cross section
    core = [to_xy(s, t) for s, t in ((-hu, -BAR_IN), (hu, -BAR_IN), (hu, BAR_IN), (-hu, BAR_IN))]
    k.prism(core, ground - 2, ground + CORE_H, "cream_panel", "roof_gravel", windows=WING)
    s0, s1, hc = CROSS
    k.prism([to_xy(s, t) for s, t in ((s0, -BAR_IN), (s1, -BAR_IN), (s1, BAR_IN), (s0, BAR_IN))],
            ground + CORE_H - 0.1, ground + hc, "window_dark", "roof_metal")
    # ducts: up the outer wall, over the curve, onto the top strip, into a white housing
    for side in (-1, 1):
        for s in DUCTS + [(s0 + s1) / 2]:
            off = 1.1
            path = [(side * (HALF_W + off), ground + CORE_H - 0.2), (side * (HALF_W + off), ground + CURVE_LOW)]
            a, b = HALF_W - CURVE_T + off, BAR_TOP - CURVE_LOW + off
            for q in range(1, 7):
                ang = math.pi / 2 * q / 6
                path.append((side * (CURVE_T + a * math.cos(ang)), ground + CURVE_LOW + b * math.sin(ang)))
            path.append((side * (CURVE_T - 2.5), ground + BAR_TOP + off))
            k.tube([(*to_xy(s, t), z) for t, z in path], 0.75, "duct_teal", sides=10)
            # red collar two thirds up the vertical run
            k.tube([(*to_xy(s, side * (HALF_W + off)), ground + CORE_H + 0.2), (*to_xy(s, side * (HALF_W + off)), ground + CORE_H + 0.6)],
                   0.85, "steel_red", sides=10)
            hx, hy = to_xy(s, side * (CURVE_T - 3.8))
            k.box((hx, hy, ground + BAR_TOP + 0.9), (2.2, 3.2, 1.8), "metal_silver", rot=math.atan2(u.y, u.x))
    # the rest: lidar tiers (wings, the north-west arm, the south-east annex); low ones are sawtooths
    for tier in massing(ground):
        ring = tier["rings"][0]
        gy, h = tier["ground_y"], tier["h"]
        area = abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2
        if h < 8 and area > 250:
            sawtooth(k, ring, gy - 1.5, h, ground)
        else:
            k.prism(ring, gy - 1.5, gy + h, "cream_panel", "roof_gravel", windows=WING if h > 6 else None,
                    parapet=(0.35, 0.6), coping="metal_silver")
    return [k.finish()]
