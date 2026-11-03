"""Camera poses for every catalogue item: python -m tools.refs.poses  ->  docs/refs/poses_earth.json

Google Earth Web URLs (@lat,lng,ALTa,DISTd,FOVy,HEADINGh,TILTt,0r): the camera looks at (lat, lng, ALT)
from DIST metres away, heading clockwise from north, tilt from straight down.
  building: 8 orbit views (tilt 60), 4 square-on facade views (tilt 62, one per side of the minimum
            rotated rectangle), 1 top-down; UW buildings add 3 close detail views per side (tilt 70);
            distances from the footprint size and lidar height
  zone:     4 orbit views (tilt 50) and 1 top-down of the 100 m cell
  street:   2 views along each ~150 m piece, one from each end (tilt 72)
Shots are ordered UW buildings first, then zones, streets and the other buildings.
"""
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon

from pipeline.build import terrain
from pipeline.coords import lonlat_to_utm, utm_to_lonlat

ROOT = Path(__file__).resolve().parents[2]
REFS = ROOT / "docs" / "refs"
HF = np.load(ROOT / "data" / "build" / "heightfield.npy")


def ground(e, n):
    return float(terrain.sample(HF, e, n))


def url(e, n, alt, dist, heading, tilt, fov=35):
    lon, lat = utm_to_lonlat(e, n)
    return (f"https://earth.google.com/web/@{lat:.7f},{lon:.7f},{alt:.1f}a,{dist:.0f}d,{fov}y,"
            f"{heading % 360:.0f}h,{tilt:.0f}t,0r")


def building_shots(it):
    x0, y0, x1, y1 = it["bbox_utm"]
    e, n = it["centre_utm"]
    diag = math.hypot(x1 - x0, y1 - y0)
    h = it["height_m"]
    g = ground(e, n)
    d = float(np.clip(0.85 * diag + 1.5 * h, 55, 300))
    alt = g + 0.4 * h
    out = [(f"orbit_{hd:03d}", url(e, n, alt, d, hd, 60)) for hd in range(0, 360, 45)]
    rect = Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    fp = it.get("_fp")
    if fp is not None:
        rect = fp.minimum_rotated_rectangle
    pts = list(rect.exterior.coords)[:4]
    for k in range(4):
        (ax, ay), (bx, by) = pts[k], pts[(k + 1) % 4]
        mx, my = (ax + bx) / 2, (ay + by) / 2
        # look at the side's midpoint from outside the building, square on
        nx, ny = mx - e, my - n
        hd = math.degrees(math.atan2(nx, ny)) + 180      # camera on the outside looking back at the wall
        L = math.hypot(bx - ax, by - ay)
        # tilt 62: high enough to see over the neighbours and street trees, low enough to read the wall
        out.append((f"facade_{k}", url(mx, my, ground(mx, my) + 0.45 * h, float(np.clip(0.8 * L + 2.0 * h, 40, 260)), hd, 62)))
        if it["uw"]:
            # close detail: the left, middle and right thirds of the side (windows, entrances, materials)
            for t, tag in ((1 / 6, "a"), (0.5, "b"), (5 / 6, "c")):
                px, py = ax + (bx - ax) * t, ay + (by - ay) * t
                out.append((f"detail_{k}{tag}", url(px, py, ground(px, py) + 0.4 * h,
                                                    float(np.clip(0.3 * L + 1.6 * h, 28, 110)), hd, 70)))
    out.append(("top", url(e, n, g + h, float(np.clip(2.2 * diag, 90, 600)), 0, 0)))
    return out


def zone_shots(it):
    e, n = it["sw_utm"][0] + 50, it["sw_utm"][1] + 50
    g = ground(e, n)
    out = [(f"orbit_{hd:03d}", url(e, n, g, 230, hd, 50)) for hd in (0, 90, 180, 270)]
    out.append(("top", url(e, n, g, 200, 0, 0)))
    return out


def street_shots(it):
    pts = [lonlat_to_utm(*p) for p in it["line_ll"]]
    ln = LineString(pts)
    mid = ln.interpolate(0.5, normalized=True)
    a, b = pts[0], pts[-1]
    hd = math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))
    g = ground(mid.x, mid.y)
    return [("along_fwd", url(mid.x, mid.y, g, 110, hd, 72)), ("along_back", url(mid.x, mid.y, g, 110, hd + 180, 72))]


def main():
    cat = json.loads((REFS / "catalog.json").read_text())
    import pickle
    bl = pickle.load(open(ROOT / "data" / "build" / "buildings.pkl", "rb"))
    fps = {(b["objectid"], b["part_index"]): b["footprint"] for b in bl}
    shots = []
    for it in cat["items"]:
        if it["kind"] == "building":
            it["_fp"] = fps.get((it["objectid"], it["part_index"]))
            s = building_shots(it)
            rank = 0 if it["uw"] else 3
        elif it["kind"] == "zone":
            s, rank = zone_shots(it), 1
        else:
            s, rank = street_shots(it), 2
        for name, u in s:
            shots.append({"rank": rank, "item": it["id"], "dir": it["dir"], "file": f"{it['dir']}/private/earth_{name}.jpg", "url": u})
    shots.sort(key=lambda s: s["rank"])
    (REFS / "poses_earth.json").write_text(json.dumps(shots, indent=0))
    print(len(shots), "shots")


if __name__ == "__main__":
    main()
