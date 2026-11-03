"""Minimap layers: public/world/minimap.json.

Simplified ground classes and building footprints in world x, z (x east, z south), plus a list of
named places (UW buildings by abbreviation, named lakes) the HUD can teleport to.
"""
import json
import re

from ..config import WORLD
from ..coords import ORIGIN_E, ORIGIN_N
from . import ground

LAYERS = ["water", "wood", "pitch", "parking", "road", "paving", "path", "rail"]
SIMPLIFY_M = 0.8
ALIAS = {"PSE - E7": "E7"}
VILLAGE = re.compile(r"^V[ENSW]\d$")


def _rings(geom):
    """Polygons as lists of exterior rings (holes dropped: the map paints layers in order)."""
    out = []
    for p in ground.polygons(geom.simplify(SIMPLIFY_M)):
        if p.area < 4:
            continue
        c = list(p.exterior.coords)[:-1]
        out.append([v for e, n in c for v in (round(e - ORIGIN_E, 1), round(ORIGIN_N - n, 1))])
    return out


def build(gcls, bl, lakes):
    layers = {k: _rings(gcls[k]) for k in LAYERS if k in gcls}
    blds, places = [], {}
    for b in bl:
        uw = "WATERLOO" in (b.get("owner") or "").upper()
        rings = _rings(b["footprint"])
        if not rings:
            continue
        blds.append({"r": rings, "uw": uw, "s": b["style"]})
        ab = ALIAS.get((b.get("abbrev") or "").strip(), (b.get("abbrev") or "").strip())
        # village houses (VE1, VS3, ...) are listed once as V1's neighbours, not one entry each
        if uw and ab and len(ab) <= 8 and ab.isprintable() and not ab.isspace() and not VILLAGE.match(ab):
            p = b["footprint"].representative_point()
            a = b["footprint"].area
            if ab not in places or places[ab]["area"] < a:
                places[ab] = {"id": ab, "name": b.get("name") or ab, "x": round(p.x - ORIGIN_E, 1),
                              "z": round(ORIGIN_N - p.y, 1), "area": a, "kind": "building"}
    for lk in lakes:
        if "lake" in lk["name"].lower() and lk["geom"].area > 5000:
            p = lk["geom"].representative_point()
            places[lk["name"]] = {"id": lk["name"], "name": lk["name"].strip(), "x": round(p.x - ORIGIN_E, 1),
                                  "z": round(ORIGIN_N - p.y, 1), "area": lk["geom"].area, "kind": "water"}
    out = {"layers": layers, "buildings": blds,
           "places": sorted(({k: v for k, v in p.items() if k != "area"} for p in places.values()),
                            key=lambda p: p["id"])}
    (WORLD / "minimap.json").write_text(json.dumps(out, separators=(",", ":")))
    return len(out["places"])
