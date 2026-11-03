"""Points to probe for Street View: python -m tools.refs.sv_points  ->  docs/refs/sv_points.json

Every 25 m along every OSM highway (roads, service roads, footways, paths) inside the boundary, plus
points 12 m outside every UW building every 30 m around its footprint (campus 360 photos sit on
paths and plazas next to buildings). Google returns the nearest panorama to each point; the
capture step keeps the ones within 40 m and drops duplicates.
"""
import json
import pickle
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon

from pipeline.build import osm
from pipeline.build.buildings import osm_to_city
from pipeline.coords import utm_to_lonlat
from tools.refs.catalog import BOUNDARY_UTM

ROOT = Path(__file__).resolve().parents[2]
STEP = 25


def main():
    B = Polygon(BOUNDARY_UTM)
    pts = []
    for wid, t in osm.ways_where(lambda t: "highway" in t and t.get("area") != "yes" and t.get("indoor") != "yes"):
        c = osm.way_coords(wid)
        if not c or len(c) < 2:
            continue
        ln = LineString([osm_to_city(*p) for p in c]).intersection(B)
        for g in getattr(ln, "geoms", [ln]):
            if g.is_empty or g.geom_type != "LineString":
                continue
            for s in np.arange(0, g.length + 1e-6, STEP):
                p = g.interpolate(s)
                pts.append(("way", p.x, p.y))
    bl = pickle.load(open(ROOT / "data" / "build" / "buildings.pkl", "rb"))
    for b in bl:
        if "WATERLOO" not in (b["owner"] or "").upper() or not B.intersects(b["footprint"]):
            continue
        ring = b["footprint"].buffer(12).exterior
        for s in np.arange(0, ring.length, 30):
            p = ring.interpolate(s)
            pts.append(("bld", p.x, p.y))
    # thin: one point per 10 m cell
    seen, out = set(), []
    for kind, x, y in pts:
        k = (round(x / 10), round(y / 10))
        if k in seen:
            continue
        seen.add(k)
        lon, lat = utm_to_lonlat(x, y)
        out.append({"k": kind, "lat": round(lat, 7), "lng": round(lon, 7), "e": round(x, 1), "n": round(y, 1)})
    (ROOT / "docs" / "refs" / "sv_points.json").write_text(json.dumps(out))
    print(len(out), "points")


if __name__ == "__main__":
    main()
