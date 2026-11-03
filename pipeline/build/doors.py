"""Doors: OSM entrance nodes snapped onto the nearest footprint wall (within 3 m), facing outward."""
import math

from shapely import STRtree
from shapely.geometry import LineString, Point

from . import osm
from .buildings import osm_to_city

SNAP_M = 3.0


def build(buildings):
    """[(e, n, outward angle radians in the east-north frame, building index)]."""
    fps = [b["footprint"] for b in buildings]
    tree = STRtree(fps)
    out = []
    for e, n, tags in osm.node_points(lambda t: "entrance" in t):
        p = Point(*osm_to_city(e, n))
        best = None
        for i in tree.query(p.buffer(SNAP_M)):
            ring = fps[i].exterior
            d = ring.distance(p)
            if d <= SNAP_M and (best is None or d < best[0]):
                best = (d, i, ring)
        if best is None:
            continue
        _, i, ring = best
        s = ring.project(p)
        q = ring.interpolate(s)
        a, b = ring.interpolate(max(s - 0.5, 0)), ring.interpolate(min(s + 0.5, ring.length))
        tx, ty = b.x - a.x, b.y - a.y
        # rings are counter-clockwise (shapely orient), so outward is to the right of travel
        out.append((q.x, q.y, math.atan2(-tx, ty), i))
    return out
