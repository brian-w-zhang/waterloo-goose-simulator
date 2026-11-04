"""Walls of one building and the camera poses to photograph each: python -m tools.refs.around ABBREV|ID

Writes docs/refs/buildings/<id>/walls.json (committed: the facade list every model script works from)
and <dir>/private/around_poses.json for tools/refs/around.mjs.

walls: the union of the building's footprint parts, simplified (0.8 m) with collinear runs merged;
every edge of 4 m or more is a wall W0, W1, ... (counter-clockwise from the most northern corner),
with its ends (art and lat/lng), length, outward normal and compass facing.
Earth: per wall, one square-on view of the whole wall (tilt 78, a little above eye level) and, for
walls over 30 m, close views of its left, middle and right thirds; plus a view of each corner.
Street View: probe points 14 m out from every wall every 12 m and 18 m out from each corner; the
capture step re-aims every panorama at the wall it was taken for.
"""
import json
import math
import pickle
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from pipeline.build import terrain
from pipeline.coords import ORIGIN_E, ORIGIN_N, utm_to_lonlat

ROOT = Path(__file__).resolve().parents[2]
HF = np.load(ROOT / "data/build/heightfield.npy")


def ll(e, n):
    lon, lat = utm_to_lonlat(e, n)
    return round(lat, 7), round(lon, 7)


def earth_url(e, n, alt, dist, heading, tilt, fov=35):
    lat, lon = ll(e, n)
    return f"https://earth.google.com/web/@{lat},{lon},{alt:.1f}a,{dist:.0f}d,{fov}y,{heading % 360:.0f}h,{tilt:.0f}t,0r"


def compass(dx, dy):
    a = math.degrees(math.atan2(dx, dy)) % 360
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int((a + 22.5) // 45) % 8]


def lidar_shift(fp):
    """Translation (dx, dy) that best lays the footprint on the lidar roof: the City outlines were
    traced from air photos where tall roofs lean, the lidar is a true vertical view. Only flat roof
    pixels count (trees are rough); the search is +-4 m in 0.5 m steps."""
    import rasterio.features
    from affine import Affine
    from scipy import ndimage
    from pipeline.build import lidar
    dsm = np.load(ROOT / "data/build/dsm_0p5.npy", mmap_mode="r")
    dtm = np.load(ROOT / "data/build/dtm_0p5.npy", mmap_mode="r")
    x0, y0, x1, y1 = fp.bounds
    m = 8
    c0, r0 = int((x0 - m - lidar.E0) / 0.5), int((lidar.N1 - (y1 + m)) / 0.5)
    W, H = int((x1 - x0 + 2 * m) / 0.5), int((y1 - y0 + 2 * m) / 0.5)
    h = np.array(dsm[r0:r0 + H, c0:c0 + W]) - np.array(dtm[r0:r0 + H, c0:c0 + W])
    rough = ndimage.generic_filter(h, np.std, size=3)
    roof = (h > 2.5) & (rough < 0.35)
    best = (-1, 0.0, 0.0)
    for dx in np.arange(-4, 4.01, 0.5):
        for dy in np.arange(-4, 4.01, 0.5):
            T = Affine(0.5, 0, lidar.E0 + c0 * 0.5 - dx, 0, -0.5, lidar.N1 - r0 * 0.5 - dy)
            mask = rasterio.features.geometry_mask([fp], out_shape=h.shape, transform=T, invert=True)
            iou = (mask & roof).sum() / max((mask | roof).sum(), 1)
            if iou > best[0] + 1e-9 or (abs(iou - best[0]) < 1e-9 and abs(dx) + abs(dy) < abs(best[1]) + abs(best[2])):
                best = (iou, float(dx), float(dy))
    return best


def walls_of(fp, min_len=4.0):
    g = orient(fp.simplify(0.8), 1.0)
    pts = list(g.exterior.coords)[:-1]
    # merge nearly collinear neighbours (bends under 12 degrees)
    changed = True
    while changed and len(pts) > 3:
        changed = False
        for i in range(len(pts)):
            a, b, c = np.array(pts[i - 1]), np.array(pts[i]), np.array(pts[(i + 1) % len(pts)])
            u, v = b - a, c - b
            if np.linalg.norm(u) < 1e-6 or np.linalg.norm(v) < 1e-6:
                pts.pop(i); changed = True; break
            ang = math.degrees(math.acos(np.clip(u.dot(v) / np.linalg.norm(u) / np.linalg.norm(v), -1, 1)))
            if ang < 12:
                pts.pop(i); changed = True; break
    start = max(range(len(pts)), key=lambda i: pts[i][1])
    pts = pts[start:] + pts[:start]
    walls = []
    for i in range(len(pts)):
        a, b = np.array(pts[i]), np.array(pts[(i + 1) % len(pts)])
        L = float(np.linalg.norm(b - a))
        if L < min_len:
            continue
        t = (b - a) / L
        n = np.array([t[1], -t[0]])          # outward for a ccw ring
        walls.append({"id": f"W{len(walls)}", "a": a.tolist(), "b": b.tolist(), "length_m": round(L, 1),
                      "normal": n.round(4).tolist(), "faces": compass(*n)})
    return walls


def main(key):
    cat = json.loads((ROOT / "docs/refs/catalog.json").read_text())
    items = [it for it in cat["items"] if it["kind"] == "building" and (it["label"] == key or it["id"] == key)]
    if not items:
        sys.exit(f"no building {key}")
    it = max(items, key=lambda i: i["area_m2"])
    bl = pickle.load(open(ROOT / "data/build/buildings.pkl", "rb"))
    oids = {i["objectid"] for i in items}
    parts = [b for b in bl if b["objectid"] in oids]
    fp = unary_union([b["footprint"] for b in parts]).buffer(0.3).buffer(-0.3)
    if fp.geom_type != "Polygon":
        fp = max(fp.geoms, key=lambda g: g.area)
    h = max(b["p90"] for b in parts)
    iou, dx, dy = lidar_shift(fp)
    from shapely import affinity
    fp = affinity.translate(fp, dx, dy)          # walls follow the lidar (where the model is)
    walls = walls_of(fp)
    earth, sv = [], []
    for w in walls:
        a, b, n = np.array(w["a"]), np.array(w["b"]), np.array(w["normal"])
        L = w["length_m"]
        m = (a + b) / 2
        g = float(terrain.sample(HF, m[0], m[1]))
        hd = math.degrees(math.atan2(-n[0], -n[1]))             # camera outside, looking back at the wall
        # tilt 70 and at least 45 m back: lower cameras end up under Google's 3D ground near walls
        earth.append({"name": f"{w['id']}_whole", "wall": w["id"], "url": earth_url(m[0], m[1], g + h * 0.5, max(45, min(L * 1.05 + 15, 160)), hd, 70)})
        if L > 30:
            for f, tag in ((1 / 6, "l"), (0.5, "m"), (5 / 6, "r")):
                p = a + (b - a) * f
                earth.append({"name": f"{w['id']}_{tag}", "wall": w["id"], "url": earth_url(p[0], p[1], g + h * 0.5, max(40, min(L / 3 + 20, 80)), hd, 70)})
        w["lat_lng"] = [ll(*a), ll(*b)]
        w["art"] = [[round(a[0] - ORIGIN_E, 2), round(a[1] - ORIGIN_N, 2)], [round(b[0] - ORIGIN_E, 2), round(b[1] - ORIGIN_N, 2)]]
        for s in np.arange(min(6.0, L / 2), L, 12.0):
            p = a + (b - a) * (s / L) + n * 14
            sv.append({"wall": w["id"], "lat_lng": ll(*p)})
    ring = list(orient(fp.simplify(0.8), 1.0).exterior.coords)[:-1]
    c = np.array(fp.centroid.coords[0])
    for k, p in enumerate(ring):
        p = np.array(p)
        d = (p - c) / max(np.linalg.norm(p - c), 1e-6)
        q = p + d * 18
        g = float(terrain.sample(HF, p[0], p[1]))
        earth.append({"name": f"corner_{k}", "wall": None, "url": earth_url(p[0], p[1], g + h * 0.4, max(45, h * 2.2), math.degrees(math.atan2(-d[0], -d[1])), 72)})
        sv.append({"wall": None, "corner": k, "lat_lng": ll(*q), "aim": ll(*p)})
    d = ROOT / it["dir"]
    (d / "walls.json").write_text(json.dumps({"building": it["label"], "height_m": round(h, 1),
        "lidar_shift_m": [dx, dy], "lidar_roof_iou": round(iou, 3), "walls": walls}, indent=1))
    (d / "private").mkdir(parents=True, exist_ok=True)
    (d / "private/around_poses.json").write_text(json.dumps({"dir": it["dir"], "walls": walls, "earth": earth, "sv": sv}, indent=1))
    print(it["dir"], len(walls), "walls,", len(earth), "earth views,", len(sv), "street view probes")


if __name__ == "__main__":
    main(sys.argv[1])
