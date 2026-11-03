"""Landmark decals (config/overrides/landmarks.json): a ray from a reference camera along its
heading is intersected with the building's footprint; the first wall hit holds the decal."""
import json
import math

from shapely.geometry import LineString, Point

from ..config import ROOT
from ..coords import lonlat_to_utm, utm_to_lonlat
from pyproj import Geod

_GEOD = Geod(ellps="GRS80")
SPEC = json.loads((ROOT / "config" / "overrides" / "landmarks.json").read_text())


def build(buildings):
    """[(e, n, outward angle, building index, decal dict)]."""
    out = []
    for d in SPEC["decals"]:
        lon, lat = d["ray_from"]["lon"], d["ray_from"]["lat"]
        lon2, lat2, _ = _GEOD.fwd(lon, lat, d["heading_true_deg"], 300)
        a, b = Point(*lonlat_to_utm(lon, lat)), Point(*lonlat_to_utm(lon2, lat2))
        ray = LineString([a, b])
        best = None
        for bi, bld in enumerate(buildings):
            if bld["abbrev"] != d["abbrev"]:
                continue
            hit = ray.intersection(bld["footprint"].exterior)
            pts = [hit] if hit.geom_type == "Point" else list(getattr(hit, "geoms", []))
            for p in pts:
                dist = a.distance(p)
                if best is None or dist < best[0]:
                    best = (dist, bi, p)
        if best is None:
            continue
        _, bi, p = best
        ring = buildings[bi]["footprint"].exterior
        s = ring.project(p)
        q1, q2 = ring.interpolate(max(s - 0.5, 0)), ring.interpolate(min(s + 0.5, ring.length))
        ang = math.atan2(-(q2.x - q1.x), q2.y - q1.y)
        out.append((p.x + math.cos(ang) * 0.1, p.y + math.sin(ang) * 0.1, ang, bi, d))
    return out
