"""Street furniture from OSM nodes, rotated to face the nearest path."""
import numpy as np
from shapely import STRtree
from shapely.geometry import Point

from . import osm
from .buildings import osm_to_city

KINDS = ["bench", "waste_basket", "bicycle_parking", "street_lamp", "picnic_table",
         "bus_stop", "fire_hydrant",
         # stop signs, the blue-light emergency phones, recycling, post boxes, notice boards, bollards
         "stop", "phone", "recycling", "post_box", "information", "bollard"]


STOP_VERGE_M = 0.7    # a stop sign stands this far beyond the drawn road edge
ROAD_KINDS = {"primary", "secondary", "tertiary", "residential", "service", "unclassified"}


def kind_of(tags):
    for k in ("amenity", "highway", "leisure", "emergency", "tourism", "barrier"):
        if tags.get(k) in KINDS:
            return KINDS.index(tags[k])
    return None


def build(path_lines):
    lines = [ln for _, _, ln in path_lines]
    tree = STRtree(lines)
    from .ground import _line, _width   # the same widths the ground pieces are drawn with
    roads = [(ln, _width(t) / 2) for wid, t in osm.ways_where(lambda t: t.get("highway") in ROAD_KINDS)
             if (ln := _line(wid)) is not None]
    road_tree = STRtree([ln for ln, _ in roads]) if roads else None
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
        if KINDS[k] == "stop" and roads:
            # OSM puts stop nodes on the road centreline: stand the sign just off the drawn road, on the
            # right of travel ("direction=backward" means traffic runs against the way)
            i = road_tree.nearest(Point(e, n))
            ln, half = roads[i]
            d = ln.project(Point(e, n))
            a, b = ln.interpolate(max(d - 1, 0)), ln.interpolate(min(d + 1, ln.length))
            rot = float(np.arctan2(b.y - a.y, b.x - a.x))
            side = 1.0 if tags.get("direction") == "backward" else -1.0
            off = half + STOP_VERGE_M
            e, n = e + side * -np.sin(rot) * off, n + side * np.cos(rot) * off
        out.append((e, n, k, rot))
    return np.array(out) if out else np.zeros((0, 4))
