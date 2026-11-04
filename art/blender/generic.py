"""Building from its own lidar and its own style: the starting point for every building that has no
hand-written script yet (art/models/bld_campus.py), refined per building through overrides.

massing: the building's 0.5 m lidar traced into height levels (data.lidar_massing, source "ndsm"),
squared to the footprint's long axis. facades: the style in config/style-rules.json chosen for this
building (wall, window, roof colours and the window pattern), turned into geometry: recessed punched
windows, ribbon bands with mullion piers, slot windows, or curtain walls; a base storey when the
style has one. overrides (per building): any of storey, bay, w, h, sill, depth, wall, glass, roof,
pattern, base, base_m, max_h, open, axis, skip (wall kinds), plus extra(k, tiers) for one-off parts.
"""
import json
import math

import arch
import data
import lib

STYLES = json.loads((lib.ROOT / "config" / "style-rules.json").read_text())["styles"]


def axis_of(parts):
    """Long axis of the largest footprint part (minimum-area rectangle by brute force over edges)."""
    ring = max((p["footprint"]["outer"] for p in parts), key=len)
    best = None
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1:
            continue
        ux, uy = dx / L, dy / L
        us = [p[0] * ux + p[1] * uy for p in ring]
        vs = [-p[0] * uy + p[1] * ux for p in ring]
        area = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or area < best[0]:
            best = (area, (ux, uy) if (max(us) - min(us)) >= (max(vs) - min(vs)) else (-uy, ux))
    return best[1] if best else (1.0, 0.0)


def windows_for(st, o):
    storey = o.get("storey", st.get("storey_m", 3.6))
    bay = o.get("bay", st.get("bay_m", 2.6))
    pat = o.get("pattern", st.get("pattern", "punched"))
    lo, hi = st.get("w_lo") or 0.3, st.get("w_hi") or 0.75
    blo, bhi = st.get("b_lo") or 0.3, st.get("b_hi") or 0.7
    glass = o.get("glass", st.get("window", "window_dark"))
    if glass in ("mullion", "metal_silver", "utility", "path"):
        glass = "window_dark"
    w = {"storey": storey, "bay": bay, "sill": o.get("sill", storey * lo), "h": o.get("h", storey * (hi - lo)),
         "depth": o.get("depth", 0.2), "top_margin": 0.7, "glass": glass, "frame": o.get("frame", st.get("accent", st["wall"]))}
    if pat == "ribbon":
        w["w"] = o.get("w", bay * 0.86)
    elif pat == "slot":
        w["w"] = o.get("w", bay * (bhi - blo))
        w["sill"], w["h"] = o.get("sill", 0.3), o.get("h", storey - 0.6)
    else:
        w["w"] = o.get("w", bay * (bhi - blo))
    if o.get("ledge"):
        w["ledge"] = o["ledge"]
    return pat, w


def build_generic(k, abbrev, style=None, **o):
    parts = data.building_parts(abbrev)
    style = style or parts[0]["style"]
    st = dict(STYLES.get(style, STYLES["limestone"]))
    wall = o.get("wall", st["wall"])
    roof = o.get("roof", st.get("roof", "roof_gravel"))
    if roof in ("roof",):
        roof = "roof_gravel"
    pat, win = windows_for(st, o)
    base = o.get("base", st.get("base"))
    base_m = o.get("base_m", st.get("base_m", 4.0))
    axis = o.get("axis") or axis_of(parts)
    opts = {"source": "ndsm", "simplify": 0.8, "merge_dh": 1.2, "min_area": 10, "min_width": 2.0}
    if not o.get("round"):
        opts["axis"] = list(axis)       # round buildings (RCH) keep their traced curves
    for key in ("max_h", "open", "exclude", "skip_objectids", "merge_dh", "simplify", "min_area"):
        if key in o:
            opts[key] = o[key]
    tiers = data.lidar_massing(abbrev, **opts)
    # a photo-read facade spec, when the building has one, draws every documented wall
    import re
    import spec as fspec
    bdir = "docs/refs/buildings/" + re.sub(r"[^a-z0-9]+", "-", abbrev.lower()).strip("-")
    fac, walls = data.facades(bdir)
    if fac:
        specs = {wid: fspec.to_facade(w) for wid, w in fac["walls"].items()}
        for wid, w in fac["walls"].items():
            if w.get("upper") and w.get("a"):
                walls.append({"id": wid, "art": [w["a"], w["b"]], "length_m": w["length_m"]})
        main = max((sp for sp in specs.values() if sp), key=lambda sp: sum(r[0] for r in sp["rows"]))
        for tier in tiers:
            gy, h = tier["ground_y"], tier["h"]
            z1 = gy + h
            for r in [tier["rings"][0]] + tier.get("holes", []):
                fspec.draw_outline(k, r, gy, z1, walls, specs, main, tol=2.5)
            for t in tier["tris"]:
                from mathutils import Vector
                A, B, C = (Vector((x, y, z1)) for x, y in t)
                if (B - A).cross(C - A).z < 0:
                    B, C = C, B
                k.face([A, B, C], o.get("roof_high", (1e9, roof))[1] if h >= o.get("roof_high", (1e9,))[0] else roof)
        if o.get("extra"):
            o["extra"](k, tiers)
        return sorted({p["objectid"] for p in parts})
    for tier in tiers:
        gy, h = tier["ground_y"], tier["h"]
        z0, z1 = gy - 1.5, gy + h
        small = h < 4 or o.get("blank", False)
        for ring in [tier["rings"][0]] + tier.get("holes", []):
            for i in range(len(ring)):
                a, b = ring[i], ring[(i + 1) % len(ring)]
                lo = z0
                if base and h > base_m + 2:
                    k.wall(a, b, z0, gy + base_m, base, None if small else {**win, "storey": base_m, "sill": 0.6, "h": base_m - 1.4, "first": 1.5})
                    lo = gy + base_m
                if small:
                    k.wall(a, b, lo, z1, wall)
                elif pat == "curtain":
                    k.curtain(a, b, lo, z1, wall, "mullion", bay=win["bay"], row=win["storey"], strip=0.1)
                elif pat == "none":
                    k.wall(a, b, lo, z1, wall)
                else:
                    k.wall(a, b, lo, z1, wall, {**win, "first": 1.5 if lo == z0 else 0.0})
                # parapet coping
                k.wall(a, b, z1, z1 + 0.4, o.get("coping", st.get("accent", wall)))
        for t in tier["tris"]:
            from mathutils import Vector
            A, B, C = (Vector((x, y, z1)) for x, y in t)
            if (B - A).cross(C - A).z < 0:
                B, C = C, B
            rc = roof
            if o.get("roof_high") and h >= o["roof_high"][0]:
                rc = o["roof_high"][1]
            k.face([A, B, C], rc)
    if o.get("extra"):
        o["extra"](k, tiers)
    return sorted({p["objectid"] for p in parts})
