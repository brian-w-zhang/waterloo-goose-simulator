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
    # old SLC from the lidar, outside the expansion's footprint
    for tier in data.lidar_massing("SLC", source="ndsm", open=5, skip_objectids=[19801], exclude=[exp["footprint"]["outer"]],
                                   simplify=0.8, merge_dh=1.2, min_area=10, min_width=2.0, axis=list(AXIS), max_h=15):
        gy, h = tier["ground_y"], tier["h"]
        z0, z1 = gy - 1.5, gy + h
        ring = tier["rings"][0]
        hall = math.dist(centroid(ring), HALL) < 9 and 6 < h < 11
        if hall:
            k.tier(tier, gy + 4.0, z1 - 1.0, "brick_brown", "roof_gravel")
            for i in range(len(ring)):
                a, b = ring[i], ring[(i + 1) % len(ring)]
                k.wall(a, b, z0, gy + 4.0, "brick_brown",
                       windows={"storey": 5.5, "bay": 1.4, "w": 0.9, "h": 3.2, "sill": 0.4, "depth": 0.25, "glass": "window_dark", "frame": "brick_dark"})
                k.wall(a, b, z1 - 1.0, z1, "panel_white")
            hall_roof(k, ring, z1)
        else:
            k.tier(tier, z0, z1, "brick_brown", "roof_gravel", windows=BRICK if h > 3 else None)
    # the expansion: the courtyard semicircle (one storey, green roof with a pond, white coping) and
    # the two-storey link north to PAC; the arc runs from vertex 10 to vertex 23 of the footprint
    gy = exp["ground_y"]
    ring = exp["footprint"]["outer"]
    semi = ring[10:24]
    link = ring[0:11] + ring[23:]
    for poly, H, roof in ((semi, 4.6, "grass_shadow"), (link, 8.6, "roof_gravel")):
        poly = arch.ccw(poly)
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if math.dist(mid, ARC_C) < 15 or roof == "grass_shadow":
                arch.fins(k, a, b, gy - 1.5, gy + H, "glass_teal", "metal_silver", pitch=1.6, depth=0.25, spandrel="window_band", storey=4.3)
            else:
                k.wall(a, b, gy - 1.5, gy + H, "brick_brown", windows={**BRICK, "w": 2.2, "glass": "glass_teal", "frame": "metal_silver"})
            k.wall(a, b, gy + H, gy + H + 0.6, "panel_white")
        k.roof(poly, gy + H, roof)
    # the pond on the garden roof
    c = Vector(ARC_C) + Vector((-4.0, 2.0))
    k.tube([(c.x, c.y, gy + 4.62), (c.x, c.y, gy + 4.7)], 3.2, "water", sides=14)
    return [k.finish()]
