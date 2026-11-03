"""Signs: a monument sign at each named building's main entrance, and a fascia sign on the wall
nearest each named business (OSM amenity or shop), facing outward.

Building names come from the City layer (BLDG_ABBREV, BLDG_NAME) or OSM `name`; business names
from OSM nodes and ways. Positions are snapped to real geometry; nothing is invented.
"""
import math

from shapely import STRtree
from shapely.geometry import Point, Polygon

from . import osm
from .buildings import osm_to_city

MONUMENT_OFFSET_M = 3.2       # sign stands this far in front of the wall
FASCIA_SNAP_M = 25.0          # a business must be within this distance of a footprint wall
FASCIA_HEIGHT_M = 3.4
SHOP_KEYS = ("amenity", "shop", "leisure", "tourism", "office")
SKIP_AMENITY = {"bench", "waste_basket", "bicycle_parking", "parking", "parking_space", "toilets", "atm",
                "vending_machine", "recycling", "drinking_water", "charging_station", "telephone",
                "post_box", "shelter", "fountain", "parking_entrance", "bicycle_repair_station",
                "loading_dock", "reception_desk", "car_sharing", "ticket_validator", "clock"}
SKIP_KIND = {"artwork", "information", "outdoor_seating", "picnic_table", "playground", "pitch", "park",
             "garden", "viewpoint", "attraction", "track", "swimming_pool", "fitness_station"}


def wall_frame(fp, p):
    """Nearest point on a footprint's exterior to p, and the outward normal angle (east-north frame)."""
    ring = fp.exterior
    s = ring.project(p)
    q = ring.interpolate(s)
    a, b = ring.interpolate(max(s - 0.6, 0)), ring.interpolate(min(s + 0.6, ring.length))
    tx, ty = b.x - a.x, b.y - a.y
    ang = math.atan2(-tx, ty)            # footprints are counter-clockwise: outward is to the right
    return q, ang


def kind_of(tags):
    for k in SHOP_KEYS:
        if k in tags:
            return tags[k]
    return None


def build(buildings, doors, path_tree, path_lines):
    """[(e, n, angle, text, subtext, style, ground_index)]: style is "uw" (monument) or "shop" (fascia)."""
    fps = [b["footprint"] for b in buildings]
    tree = STRtree(fps)
    out = []
    # monument signs for named buildings: at the door nearest a path, else the wall point nearest a path
    by_building = {}
    for e, n, ang, bi in doors:
        by_building.setdefault(bi, []).append((e, n, ang))
    signed = set()
    for bi in sorted(range(len(buildings)), key=lambda k: -buildings[k]["footprint"].area):
        b = buildings[bi]
        code = b["abbrev"]
        name = (b["name"] or "").strip()
        if not (code or (name and b["footprint"].area > 400)) or (code or name) in signed:
            continue
        signed.add(code or name)
        if code and len(code) > 12:          # composite City codes ("South & East Hall") read as names
            name, code = code, ""
        cands = sorted(by_building.get(bi, []),
                       key=lambda c: path_lines[path_tree.nearest(Point(c[0], c[1]))].distance(Point(c[0], c[1])))
        c = b["footprint"].centroid
        near = path_lines[path_tree.nearest(c)]
        q, ang0 = wall_frame(b["footprint"], near.interpolate(near.project(c)))
        cands.append((q.x, q.y, ang0))
        placed = None
        for e0, n0, ang in cands:
            for off in (MONUMENT_OFFSET_M, 2.2, 1.5):
                e, n = e0 + math.cos(ang) * off, n0 + math.sin(ang) * off
                if not any(fps[i].contains(Point(e, n)) for i in tree.query(Point(e, n).buffer(0.8))):
                    placed = (e, n, ang, "uw")
                    break
            if placed:
                break
        if placed is None:   # no free ground in front of any door: a plaque on the wall instead
            e0, n0, ang = cands[0]
            placed = (e0 + math.cos(ang) * 0.12, n0 + math.sin(ang) * 0.12, ang, "uw_plaque")
        e, n, ang, style = placed
        out.append((e, n, ang, code or name, name if code else "", style, bi))
    # fascia signs for businesses
    seen = set()
    pois = [(osm_to_city(e, n), t) for e, n, t in osm.node_points(lambda t: t.get("name") and kind_of(t))]
    d = osm.load()
    for wid, (refs, t) in d["ways"].items():
        if t.get("name") and kind_of(t) and "building" not in t:
            pts = osm.way_coords(wid)
            if pts and len(pts) >= 4:
                c = Polygon(pts).centroid
                pois.append((osm_to_city(c.x, c.y), t))
    for (e, n), t in pois:
        if t.get("amenity") in SKIP_AMENITY or kind_of(t) in SKIP_KIND or (t["name"], round(e), round(n)) in seen:
            continue
        seen.add((t["name"], round(e), round(n)))
        p = Point(e, n)
        cand = [i for i in tree.query(p.buffer(FASCIA_SNAP_M))]
        if not cand:
            continue
        i = min(cand, key=lambda k: fps[k].exterior.distance(p))
        if fps[i].exterior.distance(p) > FASCIA_SNAP_M:
            continue
        # campus cafes inside UW buildings are not storefronts: only off-campus businesses get fascias
        if buildings[i]["owner"] in ("UNIVERSITY OF WATERLOO", "OTHER UW") and fps[i].contains(p):
            continue
        # face the street: the wall point nearest the business, pushed toward the nearest path
        near = path_lines[path_tree.nearest(p)]
        target = near.interpolate(near.project(p)) if fps[i].contains(p) else p
        q, ang = wall_frame(fps[i], target)
        out.append((q.x + math.cos(ang) * 0.12, q.y + math.sin(ang) * 0.12, ang, t["name"], kind_of(t).replace("_", " "), "shop", i))
    return out
