"""Mathematics & Computer (MC), 1968, brutalist board-formed concrete.

References (docs/refs/buildings/mc/): Earth views, 2023 7 cm orthophoto, lidar (tools.art.study MC),
Commons photos (commons/NOTES.md: window-hood bands, fluted stair towers, piers at ground floor,
the pink tie on the west stair tower).

Form from the lidar: a 93 x 68 m block on a square grid (axis bearing ~339 deg), main roof 21.5 m
(ground floor plus five office floors), a sunken court at 14 m and a skylit court at 18-19 m, a
ring of square stair and plant towers to 25.8-26.3 m, and a row of slot skylights near the south.
Facades: every office floor is a band of tall narrow windows between deep concrete fins under a
projecting hood; the towers are blank with vertical flutes.
"""
from mathutils import Vector

import arch
import data
import spec as fspec

META = {"world": True, "replaces": []}
AXIS = (-0.3503, 0.9366)

HOODS = {"storey": 3.55, "bay": 1.2, "w": 0.9, "h": 2.55, "sill": 0.35, "depth": 0.7, "first": 0.0,
         "top_margin": 1.0, "glass": "window_dark", "frame": "concrete_deep", "ledge": (0.45, 0.45, "concrete_cool")}
GROUND = {"storey": 3.6, "bay": 4.8, "w": 3.8, "h": 3.0, "sill": 0.1, "depth": 1.4, "first": 0.0,
          "top_margin": 0.3, "glass": "window_dark", "frame": "concrete_deep"}


FLUTES = {"storey": 40, "bay": 0.9, "w": 0.4, "h": 39.0, "sill": 0.2, "depth": 0.12, "first": 0.0,
          "top_margin": 0.0, "glass": "concrete_cool", "frame": "concrete_deep"}


def build():
    parts = data.building_parts("MC")
    META["replaces"] = sorted({p["objectid"] for p in parts})
    k = arch.Kit("bld_mc")
    # walls from the photo-read spec (docs/refs/buildings/mc/facades.json); courts and setbacks
    # that no photo shows take the west face's hood rows
    fac, walls = data.facades("docs/refs/buildings/mc")
    specs = {wid: fspec.to_facade(w) for wid, w in fac["walls"].items()}
    # the photos' concrete reads cool grey; concrete_raw renders beige under the game's warm sun
    for sp in specs.values():
        if sp and sp["wall"] == "concrete_raw":
            sp["wall"] = "concrete_cool"
    default = specs["W3"]
    tower = {"rows": [(40.0, "t")], "bays": "f", "bay_w": 0.9, "repeat": True, "wall": "concrete_cool",
             "cells": {("t", "f"): {"type": "window", "w": 0.4, "h": "full", "depth": 0.12, "glass": "concrete_cool", "frame": "concrete_deep"}}}
    for tier in data.lidar_massing("MC", source="ndsm", simplify=0.8, merge_dh=1.0, min_area=10, min_width=2.0, axis=list(AXIS)):
        gy, h = tier["ground_y"], tier["h"]
        z1 = gy + h
        for r in [tier["rings"][0]] + tier.get("holes", []):
            if h > 23.5:
                fspec.draw_outline(k, r, gy, z1, [], {}, tower)          # fluted stair and plant towers
            elif h > 12:
                fspec.draw_outline(k, r, gy, z1, walls, specs, default)
            else:
                fspec.draw_outline(k, r, gy, z1, [], {}, {"rows": [(h, "x")], "bays": "x", "wall": "concrete_raw", "cells": {}})
        for t in tier["tris"]:
            A, B, C = (Vector((x, y, z1)) for x, y in t)
            if (B - A).cross(C - A).z < 0:
                B, C = C, B
            k.face([A, B, C], "roof_light")
    return [k.finish()]
