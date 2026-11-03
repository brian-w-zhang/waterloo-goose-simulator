"""Street furniture from OSM nodes, rotated to face the nearest path."""
import numpy as np
from shapely import STRtree
from shapely.geometry import Point

from . import osm
from .buildings import osm_to_city

KINDS = ["bench", "waste_basket", "bicycle_parking", "street_lamp", "picnic_table",
         "bus_stop", "fire_hydrant"]


def kind_of(tags):
    for k in ("amenity", "highway", "leisure", "emergency"):
        if tags.get(k) in KINDS:
            return KINDS.index(tags[k])
    return None


def build(path_lines):
    lines = [ln for _, _, ln in path_lines]
    tree = STRtree(lines)
    out = []  # e, n, kind, rot (radians, yaw about +y in world)
    for e, n, tags in osm.node_points(lambda t: kind_of(t) is not None):
        e, n = osm_to_city(e, n)
        k = kind_of(tags)
        rot = 0.0
        if lines:
            ln = lines[tree.nearest(Point(e, n))]
            d = ln.project(Point(e, n))
            a, b = ln.interpolate(max(d - 1, 0)), ln.interpolate(min(d + 1, ln.length))
            rot = float(np.arctan2(b.y - a.y, b.x - a.x))  # direction of the path, east-north frame
        out.append((e, n, k, rot))
    return np.array(out) if out else np.zeros((0, 4))
