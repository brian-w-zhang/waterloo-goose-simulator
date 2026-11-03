"""Ground classes: disjoint polygons for water, roads, paths, parking, pitches, rail and woods."""
import json
import math

from shapely import union_all
from shapely.affinity import rotate
from shapely.geometry import LineString, MultiPolygon, Polygon, box, shape
from shapely.ops import polygonize, substring

from ..config import CAMPUS, RAW
from . import osm
from .buildings import osm_to_city

W = CAMPUS["path_widths_m"]
ROADS = {"service", "residential", "tertiary", "secondary", "primary", "unclassified",
         "living_street", "secondary_link", "tertiary_link", "primary_link"}
PATHS = {"footway", "path", "cycleway", "pedestrian", "steps", "platform", "track"}
# Draw order: earlier classes win where polygons overlap.
CLASSES = ["water", "rail", "road", "paving", "path", "parking", "pitch", "wood", "marking"]
MARKED_ROADS = {"secondary", "tertiary", "primary", "unclassified", "residential", "secondary_link", "tertiary_link"}
DASH_M, GAP_M, LINE_W_M = 3.0, 4.0, 0.18
ZEBRA_W_M, ZEBRA_GAP_M = 0.5, 0.55
CREEK_HALF_WIDTH_M = 2.0
RAIL_HALF_WIDTH_M = 1.8


def _width(tags):
    w = tags.get("width", "").replace("m", "").strip()
    try:
        return float(w)
    except ValueError:
        pass
    if tags.get("name") == "Ring Road":
        return CAMPUS["ring_road_width_m"]
    return W.get(tags.get("highway"), 2.0)


def _line(wid):
    pts = osm.way_coords(wid)
    if not pts or len(pts) < 2:
        return None
    return LineString([osm_to_city(e, n) for e, n in pts])


def _area_polys(pred):
    """Closed OSM ways and multipolygon relations matching pred, as polygons in the City frame."""
    d = osm.load()
    out = []
    for wid, tags in osm.ways_where(pred):
        pts = osm.way_coords(wid)
        if pts and len(pts) >= 4 and pts[0] == pts[-1]:
            p = Polygon([osm_to_city(e, n) for e, n in pts])
            out.append(p if p.is_valid else p.buffer(0))
    for rid, (members, tags) in d["rels"].items():
        if tags.get("type") != "multipolygon" or not pred(tags):
            continue
        outer = [_line(r) for t, r, role in members if t == "way" and role == "outer" and r in d["ways"]]
        inner = [_line(r) for t, r, role in members if t == "way" and role == "inner" and r in d["ways"]]
        outer = [g for g in outer if g is not None]
        inner = [g for g in inner if g is not None]
        if not outer:
            continue
        shell = union_all(list(polygonize(outer)))
        if inner:
            shell = shell.difference(union_all(list(polygonize(inner))))
        out.append(shell)
    return [p for p in out if not p.is_empty]


def highway_lines(kind_set):
    out = []
    for wid, tags in osm.ways_where(lambda t: t.get("highway") in kind_set):
        if tags.get("indoor") == "yes" or tags.get("tunnel") in ("yes", "building_passage") \
                or tags.get("level", "0") not in ("0", ""):
            continue
        if tags.get("area") == "yes":
            continue
        ln = _line(wid)
        if ln is not None:
            out.append((wid, tags, ln))
    return out


def dashes(line):
    """Centre-line dashes along a road line as thin polygons."""
    out, d = [], GAP_M / 2
    while d + DASH_M < line.length:
        out.append(substring(line, d, d + DASH_M).buffer(LINE_W_M / 2, cap_style="flat"))
        d += DASH_M + GAP_M
    return out


def zebra(line):
    """Crosswalk stripes: bars parallel to the road (across the crossing line), spaced along it."""
    out = []
    n = int(line.length // (ZEBRA_W_M + ZEBRA_GAP_M))
    for k in range(n):
        p = line.interpolate((k + 0.5) * (ZEBRA_W_M + ZEBRA_GAP_M))
        q = line.interpolate(min((k + 0.5) * (ZEBRA_W_M + ZEBRA_GAP_M) + 0.1, line.length))
        ang = math.degrees(math.atan2(q.y - p.y, q.x - p.x))
        bar = box(p.x - ZEBRA_W_M / 2, p.y - 1.4, p.x + ZEBRA_W_M / 2, p.y + 1.4)
        out.append(rotate(bar, ang, origin=(p.x, p.y)))
    return out


STALL_W_M, STALL_D_M, AISLE_M, LINE_M = 2.7, 5.5, 7.0, 0.14


def stall_lines(lot):
    """Painted stall separators for a parking lot polygon: rows of 5.5 m stalls along the lot's long
    axis with 7 m aisles between double rows (procedural from the OSM outline, not surveyed)."""
    r = lot.minimum_rotated_rectangle
    c = list(r.exterior.coords)[:4]
    e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
    e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    L1, L2 = math.hypot(*e1), math.hypot(*e2)
    (ux, uy), Lu, (vx, vy), Lv = ((e1[0] / L1, e1[1] / L1), L1, (e2[0] / L2, e2[1] / L2), L2) if L1 >= L2 \
        else ((e2[0] / L2, e2[1] / L2), L2, (e1[0] / L1, e1[1] / L1), L1)
    o = c[0] if L1 >= L2 else c[1]
    lines = []
    module = 2 * STALL_D_M + AISLE_M
    v = 0.6
    while v + STALL_D_M <= Lv:
        for row_start in (v, v + STALL_D_M + AISLE_M):
            if row_start + STALL_D_M > Lv:
                break
            u = 1.0
            while u <= Lu - 1.0:
                a = (o[0] + ux * u + vx * row_start, o[1] + uy * u + vy * row_start)
                b = (a[0] + vx * STALL_D_M, a[1] + vy * STALL_D_M)
                lines.append(LineString([a, b]).buffer(LINE_M / 2, cap_style="flat"))
                u += STALL_W_M
        v += module
    if not lines:
        return Polygon()
    return union_all(lines).intersection(lot.buffer(-0.8))


def classes(lakes, buildings):
    """Dict of class name to a (Multi)Polygon in the City frame, made disjoint by CLASSES order."""
    creeks = json.loads((RAW / "city" / "city_creeks.geojson").read_text())["features"]
    creek_poly = union_all([shape(f["geometry"]).buffer(CREEK_HALF_WIDTH_M) for f in creeks])
    raw = {
        "water": union_all([lk["geom"] for lk in lakes] + [creek_poly]),
        "rail": union_all([_line(w).buffer(RAIL_HALF_WIDTH_M) for w, t in osm.ways_where(
            lambda t: t.get("railway") in ("light_rail", "rail")) if _line(w) is not None]),
        "road": union_all([ln.buffer(_width(t) / 2) for _, t, ln in highway_lines(ROADS)]
                          + _area_polys(lambda t: t.get("area:highway") in ROADS)),
        "paving": union_all([ln.buffer(_width(t) / 2) for _, t, ln in highway_lines(PATHS)
                             if t.get("surface") in ("paving_stones", "sett", "brick")]
                            + _area_polys(lambda t: t.get("highway") == "pedestrian")),
        "path": union_all([ln.buffer(_width(t) / 2) for _, t, ln in highway_lines(PATHS)]
                          + _area_polys(lambda t: t.get("highway") == "footway" and t.get("area") == "yes")),
        "parking": union_all(_area_polys(lambda t: t.get("amenity") == "parking")),
        "pitch": union_all(_area_polys(lambda t: t.get("leisure") == "pitch")),
        "wood": union_all(_area_polys(lambda t: t.get("natural") == "wood" or t.get("landuse") == "forest")),
    }
    # painted markings sit on the road surface: dashed centre lines on public roads, zebras on crossings
    marks = [d for _, t, ln in highway_lines(ROADS) if t.get("highway") in MARKED_ROADS or t.get("name") == "Ring Road"
             for d in dashes(ln)]
    marks += [z for _, t, ln in highway_lines(PATHS) if t.get("footway") == "crossing" or t.get("crossing") in ("zebra", "marked", "traffic_signals")
              for z in zebra(ln)]
    raw["marking"] = union_all(marks).intersection(raw["road"]) if marks else Polygon()
    raw["road"] = raw["road"].difference(raw["marking"])
    lots = [p for p in _area_polys(lambda t: t.get("amenity") == "parking" and t.get("parking", "surface") == "surface")
            for p in polygons(p) if p.area > 300]
    stalls = union_all([stall_lines(p) for p in lots]) if lots else Polygon()
    raw["marking"] = union_all([raw["marking"], stalls])
    raw["parking"] = raw["parking"].difference(stalls)
    # paths with an explicit width tag (not crossings) are surveyed data: they cut into road surfaces
    tagged = union_all([ln.buffer(_width(t) / 2) for _, t, ln in highway_lines(PATHS)
                        if t.get("width") and "crossing" not in t and t.get("footway") not in ("crossing", "traffic_island")
                        and t.get("cycleway") != "crossing"])
    if not tagged.is_empty:
        raw["road"] = raw["road"].difference(tagged)
    taken = union_all([b["footprint"] for b in buildings])
    out = {}
    order = ["marking"] + [c for c in CLASSES if c != "marking"]
    for name in order:
        g = raw[name]
        if g.is_empty:
            continue
        g = g.difference(taken).buffer(0)
        out[name] = g
        taken = union_all([taken, g])
    return out


def polygons(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]
