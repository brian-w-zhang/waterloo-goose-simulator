"""Student Life Centre (SLC), 1968 with additions; the 2021 SLC/PAC expansion.

References (docs/refs/buildings/slc/): Earth views (2024), 2023 7 cm orthophoto, lidar (2018, during
construction: a crane boom crosses the scan, removed with a grey opening), Commons and web photos.

  - the old SLC (City OBJECTID 3111): red-brown brick boxes one to three storeys from the lidar,
    windows in bands; the great hall is a square block with a flat roof carrying white diagonal ribs
    and a 4 x 4 grid of round skylights, a white fascia and tall ground-floor windows
  - the expansion (19801, after the lidar, so heights are from the Earth views): a two-storey
    crescent wing whose inner arc faces the courtyard garden with a ribbon of glass, white coping,
    and the link north to PAC
"""
import math

from mathutils import Vector

import arch
import data
import spec as fspec

META = {"world": True, "replaces": []}
AXIS = (0.2355, 0.9719)
HALL = (778.0, 287.0)
ARC_C = (799.5, 321.0)       # centre of the courtyard arc (fitted to the footprint's arc vertices)
BRICK = {"storey": 3.6, "bay": 2.6, "w": 1.9, "h": 1.5, "sill": 1.0, "depth": 0.2, "top_margin": 0.8,
         "glass": "window_dark", "frame": "brick_dark"}


def centroid(ring):
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))


def hall_roof(k, ring, z):
    """Flat roof with white ribs corner to corner and a 4 x 4 grid of round skylights."""
    c = Vector(centroid(ring))
    for p in ring:
        a, b = Vector((p[0], p[1], z + 0.05)), Vector((c.x, c.y, z + 0.05))
        k.tube([a, b], 0.18, "panel_white", sides=4)
    u = Vector(AXIS)
    v = Vector((-u.y, u.x))
    for i in range(4):
        for j in range(4):
            q = c + u * (i - 1.5) * 1.9 + v * (j - 1.5) * 1.9
            k.tube([(q.x, q.y, z), (q.x, q.y, z + 0.45)], 0.8, "panel_white", sides=10)


def build():
    parts = data.building_parts("SLC")
    old = [p for p in parts if p["objectid"] != 19801]
    exp = [p for p in parts if p["objectid"] == 19801][0]
    META["replaces"] = sorted({p["objectid"] for p in parts})
    k = arch.Kit("bld_slc")
    fac, walls = data.facades("docs/refs/buildings/slc")
    specs = {wid: fspec.to_facade(w) for wid, w in fac["walls"].items()}
    # the 1968 brick: mid red-brown, a little grey (facades.json colours.old_brick, lifted from the
    # under-exposed Street View); brick_brown renders orange in the game light
    for sp in specs.values():
        if sp and sp["wall"] == "brick_brown":
            sp["wall"] = "brick_slc"
    brick = {"rows": [(1.0, "s"), (2.6, "w"), (20, "x")], "bays": "pw", "bay_w": 2.6, "repeat": True, "wall": "brick_slc",
             "cells": {("w", "w"): {"type": "window", "w": 1.9, "h": 1.5, "depth": 0.2, "glass": "window_dark", "frame": "panel_white"}}}
    # old SLC from the 2018 lidar (crane boom removed), walls from the photo-read spec
    for tier in data.lidar_massing("SLC", source="ndsm", open=5, skip_objectids=[19801], exclude=[exp["footprint"]["outer"]],
                                   simplify=0.8, merge_dh=1.2, min_area=10, min_width=2.0, axis=list(AXIS), max_h=15):
        gy, h = tier["ground_y"], tier["h"]
        z1 = gy + h
        ring = tier["rings"][0]
        hall = math.dist(centroid(ring), HALL) < 9 and 6 < h < 11
        for r in [ring] + tier.get("holes", []):
            fspec.draw_outline(k, r, gy, z1, walls, specs, brick)
        roof = "roof_gravel"
        for t in tier["tris"]:
            A, B, C = (Vector((x, y, z1)) for x, y in t)
            if (B - A).cross(C - A).z < 0:
                B, C = C, B
            k.face([A, B, C], roof)
        if hall:
            # clerestory of tall narrow windows between white fins under a white fascia, ribbed roof
            for i in range(len(ring)):
                a, b = ring[i], ring[(i + 1) % len(ring)]
                arch.fins(k, a, b, z1 - 3.5, z1 - 1.2, "window_dark", "panel_white", pitch=1.8, depth=0.25)
                k.wall(a, b, z1 - 1.2, z1, "panel_white")
            hall_roof(k, ring, z1)
    # the 2021 expansion (after the lidar; heights from its spec): the courtyard drum with the
    # one-storey colonnade arm (W37), the 14 m bar on its colonnade (W38) and the 17 m climbing-wall
    # pavilion at the north end (W39)
    gy = exp["ground_y"]
    ring = exp["footprint"]["outer"]
    semi = arch.ccw(ring[10:24])
    link = arch.ccw(ring[0:11] + ring[23:])
    fspec.draw_outline(k, semi, gy, gy + 5.4, walls, specs, specs["W37"])
    k.roof(semi, gy + 5.4, "grass_dark")
    c = Vector(ARC_C) + Vector((-4.0, 2.0))
    k.tube([(c.x, c.y, gy + 5.42), (c.x, c.y, gy + 5.5)], 3.2, "water", sides=14)
    fspec.draw_outline(k, link, gy, gy + 14.0, walls, specs, specs["W38"])
    k.roof(link, gy + 14.0, "roof_membrane")
    pav = arch.ccw([(760.98, 412.79), (754.52, 425.3), (750.15, 423.12), (746.6, 410.6)])
    fspec.draw_outline(k, pav, gy, gy + 17.0, walls, specs, specs["W39"])
    k.roof(pav, gy + 17.0, "roof_membrane")
    return [k.finish()]
