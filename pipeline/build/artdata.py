"""Inputs for the Blender art scripts (art/blender/data.py): data/build/art/.

buildings.json: every building keyed by its build id (a City OBJECTID can have several parts) with its footprint and lidar tiers in art
coordinates (x east, y north, metres from the campus origin; z up = elevation - base), the ground and
wall-bottom heights the game uses (ground_y, base_y; tier tops are ground_y + h) and vaulted roofs.
terrain.json: how to sample data/build/heightfield.npy (the 2 m node grid the game's terrain uses).
"""
import json

from ..config import BUILD
from ..coords import BASE_ELEV, ORIGIN_E, ORIGIN_N
from . import lidar, terrain


def _ring(r):
    return [[round(e - ORIGIN_E, 3), round(n - ORIGIN_N, 3)] for e, n in list(r.coords)[:-1]]


def _poly(p):
    return {"outer": _ring(p.exterior), "holes": [_ring(h) for h in p.interiors]}


def build(bl):
    out = BUILD / "art"
    out.mkdir(parents=True, exist_ok=True)
    blds = {}
    for b in bl:
        blds[str(b["id"])] = {
            "id": int(b["id"]), "objectid": int(b["objectid"]), "part_index": int(b.get("part_index", 0)), "abbrev": b["abbrev"], "name": b["name"], "owner": b["owner"],
            "style": b["style"], "ground_y": round(b["ground"] - BASE_ELEV, 3), "base_y": round(b["base"] - BASE_ELEV, 3),
            "footprint": _poly(b["footprint"]),
            "parts": [{"h": round(float(h), 3), **_poly(p)} for p, h in b["parts"]],
            "roofs": [{"cx": round(r["cx"] - ORIGIN_E, 3), "cy": round(r["cy"] - ORIGIN_N, 3), "ux": r["ux"], "uy": r["uy"],
                       "hu": r["hu"], "hv": r["hv"], "eave": r["eave"], "rise": r["rise"]} for r in b.get("roofs", [])],
            "osm_tags": b.get("osm_tags", {}),
        }
    (out / "buildings.json").write_text(json.dumps(blds))
    (out / "terrain.json").write_text(json.dumps({
        "heightfield": str(BUILD / "heightfield.npy"), "e0": lidar.E0, "n1": lidar.N1, "cell": terrain.CELL,
        "origin_e": ORIGIN_E, "origin_n": ORIGIN_N, "base_elevation": BASE_ELEV}, indent=1))
    return len(blds)
