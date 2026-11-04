"""Mike & Ophelia Lazaridis Quantum-Nano Centre (QNC), 2012 (Kuwabara Payne McKenna Blumberg).

References (docs/refs/buildings/qnc/): Earth views, 2023 7 cm orthophoto, lidar (tools.art.study
QNC), web photos (private/web: ArchDaily, McLD, Flickr), Commons photos and NOTES.md.

Form from the lidar and orthophoto (axis bearing ~63 deg, s along it from the footprint centre):
  - the bar (west, s < 8 m): 26 m, silver glass with deep vertical fins; a lower 19 m strip on its
    north side
  - the cube (east, s > 8 m): 34 m (taller than the bar), glass wrapped in a proud hexagonal frame (tall cells two storeys
    high, rows offset half a cell), roof plant yard inside a white parapet
  - the podium on the south side: 11 m, green roof
  - the low west wing: 5 m, green roof and terrace
  - a charcoal brick base two storeys high under a white band, all round
"""
import arch
import data
import spec as fspec
from mathutils import Vector

META = {"world": True, "replaces": []}
AXIS = (0.889, 0.4578)
CENTRE = (865.8, 236.2)
S_CUT = 8.0
BASE_H = 4.2


def side_s(ring):
    o, u = Vector(CENTRE), Vector(AXIS)
    return sum((Vector(p) - o).dot(u) for p in ring) / len(ring)


def walls(k, tier, z0, z1, kind):
    for ring in [tier["rings"][0]] + tier.get("holes", []):
        for i in range(len(ring)):
            a, b = ring[i], ring[(i + 1) % len(ring)]
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            # base: charcoal brick with a white band above it
            k.wall(a, b, z0, z0 + 1.5 + BASE_H, "brick_charcoal")
            k.wall(a, b, z0 + 1.5 + BASE_H, z0 + 1.5 + BASE_H + 0.6, "panel_white")
            lo = z0 + 1.5 + BASE_H + 0.6
            if z1 - lo < 1:
                continue
            if kind == "cube":
                arch.honeycomb(k, a, b, lo, z1, "glass_podium", "metal_silver", mullion="mullion")
            elif kind in ("bar", "cube"):
                arch.fins(k, a, b, lo, z1, "glass_blue", "metal_silver", pitch=1.25, depth=0.55, spandrel="window_band", storey=4.0)
            else:
                k.wall(a, b, lo, z1, "brick_charcoal",
                       windows={"storey": 4.0, "bay": 3.0, "w": 2.6, "h": 2.4, "sill": 0.6, "depth": 0.2, "glass": "glass_podium"})


def half_plane(east):
    """A big polygon covering one side of the bar/cube line (s = S_CUT along the axis)."""
    o, u = Vector(CENTRE), Vector(AXIS)
    v = Vector((-u.y, u.x))
    c = o + u * S_CUT
    far = 200
    sgn = 1 if east else -1
    pts = [c + v * far, c + v * far + u * far * sgn, c - v * far + u * far * sgn, c - v * far]
    return [[p.x, p.y] for p in pts]


def area(ring):
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2


def build():
    import math
    parts = data.building_parts("QNC")
    META["replaces"] = sorted({p["objectid"] for p in parts})
    k = arch.Kit("bld_qnc")
    fac, walls = data.facades("docs/refs/buildings/qnc")
    # the cube glass photographs dark blue-grey behind the silver frame (Street View 2025, ArchDaily)
    shared = {"honeycomb": {**fac["walls"]["W12"].get("honeycomb", {}), "glass": "stripe_dark"}}
    specs = {wid: fspec.to_facade(w, shared=shared) for wid, w in fac["walls"].items()}
    # upper faces (U0-U6) are walls too, with their own ends (facades.json, from lidar and the ortho)
    for wid, w in fac["walls"].items():
        if w.get("upper"):
            walls.append({"id": wid, "art": [w["a"], w["b"]], "length_m": w["length_m"]})
    cube = specs["W12"]
    bar = specs["U0"]
    podium = specs.get("W5") or specs["W4"]
    for tier in data.lidar_massing("QNC", source="ndsm", simplify=0.8, merge_dh=1.3, min_area=10, min_width=2.0, axis=list(AXIS)):
        gy, h = tier["ground_y"], tier["h"]
        z1 = gy + h
        ring = tier["rings"][0]
        plant = (h > 36) or (h > 23 and area(ring) < 150)
        default = cube if h > 30 else bar if h > 15 else podium
        for r in [ring] + tier.get("holes", []):
            if plant:
                k.prism(r, gy - 1.5, z1, "metal_silver", "metal_silver")
            else:
                fspec.draw_outline(k, r, gy, z1, walls, specs, default, tol=3.0)
        if plant:
            continue
        roof = "panel_white" if h > 30 else "roof_gravel" if h > 15 else "grass_shadow"
        for t in tier["tris"]:
            A, B, C = (Vector((x, y, z1)) for x, y in t)
            if (B - A).cross(C - A).z < 0:
                B, C = C, B
            k.face([A, B, C], roof)
        for i in range(len(ring)):
            k.wall(ring[i], ring[(i + 1) % len(ring)], z1, z1 + 0.5, "panel_white" if h > 15 else "metal_silver")
    # the cube's roof: a screened plant yard with white exhaust stacks (facades.json roof)
    o, u = Vector(CENTRE), Vector(AXIS)
    v = Vector((-u.y, u.x))
    gy = max(p["ground_y"] for p in parts)
    for ds in (14, 22, 30, 38):
        for dt in (-12, -4):
            c = o + u * ds + v * dt
            k.tube([(c.x, c.y, gy + 34.2), (c.x, c.y, gy + 38.5)], 0.55, "panel_white", sides=8)
    return [k.finish()]
