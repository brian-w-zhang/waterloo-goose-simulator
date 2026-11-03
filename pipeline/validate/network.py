"""Lengths, water areas, widths, walk-network reachability and length (doc 08 section 2.1)."""
import math
from collections import defaultdict

import numpy as np
from shapely import STRtree
from shapely.geometry import LineString, Point

from ..build import osm
from ..build.buildings import osm_to_city
from .geometry import core_box
from .truth import load

WALK = {"footway", "path", "pedestrian", "steps", "cycleway", "service", "living_street", "unclassified",
        "tertiary", "secondary", "residential", "corridor", "primary", "track"}
INDOOR_KINDS = {"corridor"}


def measure_width(world, cls_names, line, at_point, span=40.0):
    """Width of the packed ground class union along the perpendicular to `line` at `at_point`."""
    d = line.project(at_point)
    a = line.interpolate(max(d - 1, 0))
    b = line.interpolate(min(d + 1, line.length))
    dx, dy = b.x - a.x, b.y - a.y
    L = math.hypot(dx, dy) or 1.0
    px, py = -dy / L, dx / L
    c = line.interpolate(d)
    seg = LineString([(c.x - px * span / 2, c.y - py * span / 2), (c.x + px * span / 2, c.y + py * span / 2)])
    bounds = seg.buffer(2).bounds
    polys = [world.ground_class_polys(k, bounds) for k in cls_names]
    from shapely import union_all
    u = union_all(polys)
    hit = seg.intersection(u)
    pieces = [hit] if hit.geom_type == "LineString" else list(getattr(hit, "geoms", []))
    for p in pieces:
        if p.distance(c) < 0.3:
            return p.length
    return 0.0


def run(world):
    gt = load()
    m, detail = {}, {}
    L = {x["id"]: x["value_m"] for x in gt["lengths"]}
    net = world.network
    rr = sum(w["line"].length for w in net["ways"] if w["name"] == "Ring Road" and w["line"] is not None
             and w["kind"] not in ("light_rail",))
    m["ring_road_osm_rel_err"] = abs(rr - L["ring_road_osm"]) / L["ring_road_osm"]
    m["ring_road_city_rel_err"] = abs(rr - L["ring_road_city"]) / L["ring_road_city"]
    core = core_box()
    creek = sum(ln["line"].intersection(core).length for ln in net["city_lines"]
                if ln["source"] == "city_creeks" and ln["label"] == "Laurel Creek")
    trail = sum(ln["line"].intersection(core).length for ln in net["city_lines"]
                if ln["source"] == "city_trails" and "Laurel Trail" in ln["name"])
    m["laurel_creek_rel_err"] = abs(creek - L["laurel_creek_core_bbox"]) / L["laurel_creek_core_bbox"]
    m["laurel_trail_rel_err"] = abs(trail - L["laurel_trail_core_bbox_city"]) / L["laurel_trail_core_bbox_city"]
    detail["lengths_m"] = {"ring_road": round(rr, 1), "laurel_creek": round(creek, 1), "laurel_trail": round(trail, 1)}

    water = {w["id"]: w["area_m2_computed"] for w in gt["waterbodies"]}
    areas = {name: p.area for name, p in world.lakes.values()}
    m["columbia_lake_area_rel_err"] = abs(areas.get("Columbia Lake", 0) - water["columbia_lake"]) / water["columbia_lake"]
    m["laurel_lake_area_rel_err"] = abs(areas.get("Laurel Lake", 0) - water["laurel_lake"]) / water["laurel_lake"]
    detail["lake_areas_m2"] = {k: round(v) for k, v in areas.items()}

    ways = {w["id"]: w for w in net["ways"]}
    wfails, wrows = [], []
    for s in gt["widths_ortho_visual"]:
        w = ways.get(s["osm_way"])
        truth = s.get("curb_to_curb_m", s.get("paved_m"))
        if w is None:
            wfails.append(s["id"])
            continue
        cls = ["road"] if w["kind"] not in ("footway", "path", "cycleway", "pedestrian", "steps") else ["path", "paving"]
        got = measure_width(world, cls, w["line"], Point(*s["utm"]))
        ok = abs(got - truth) <= s["tol_m"]
        wrows.append({"site": s["id"], "got": round(got, 2), "truth": truth, "ok": ok})
        if not ok:
            wfails.append(s["id"])
    m["width_ortho_fail_count"] = len(wfails)
    tfails, trows = [], []
    for w in net["ways"]:
        if w["indoor"] or w["line"] is None or w["kind"] in ("light_rail",):
            continue
        tags = osm.load()["ways"][w["id"]][1]
        tag = tags.get("width")
        # crossings and traffic islands sit on the carriageway, which is drawn as road
        if not tag or "crossing" in tags or tags.get("footway") in ("crossing", "traffic_island") \
                or tags.get("cycleway") == "crossing":
            continue
        try:
            want = float(tag.replace("m", "").strip())
        except ValueError:
            continue
        cls = ["road"] if w["kind"] not in ("footway", "path", "cycleway", "pedestrian", "steps", "platform", "track") \
            else ["path", "paving"]
        got = float(np.median([measure_width(world, cls, w["line"], w["line"].interpolate(f, normalized=True))
                               for f in (0.2, 0.35, 0.5, 0.65, 0.8)]))
        ok = abs(got - want) <= 0.25
        trows.append({"way": w["id"], "kind": w["kind"], "tag": want, "got": round(got, 2), "ok": ok})
        if not ok:
            tfails.append(w["id"])
    m["width_tag_fail_count"] = len(tfails)
    detail["widths"] = {"ortho": wrows, "tagged_fail": len(tfails), "tagged_n": len(trows),
                        "tagged_worst": sorted(trows, key=lambda r: -abs(r["got"] - r["tag"]))[:8]}

    # walk graph from the packed network
    adj = defaultdict(set)
    walk = [w for w in net["ways"] if w["kind"] in WALK and w["access"] not in ("private", "no")]
    for w in walk:
        for a, b in zip(w["nodes"], w["nodes"][1:]):
            adj[a].add(b)
            adj[b].add(a)
    comp, sizes = {}, []
    for n0 in adj:
        if n0 in comp:
            continue
        st, k = [n0], 0
        comp[n0] = len(sizes)
        while st:
            x = st.pop()
            k += 1
            for y in adj[x]:
                if y not in comp:
                    comp[y] = len(sizes)
                    st.append(y)
        sizes.append(k)
    big = int(np.argmax(sizes))
    m["largest_component_share"] = sizes[big] / sum(sizes)
    lines = [w["line"] for w in walk if comp.get(w["nodes"][0]) == big and w["line"] is not None]
    tree = STRtree(lines)
    ents = [e for e in net["entrances"] if core.contains(Point(*e["utm"]))]
    dists = [lines[tree.nearest(Point(*e["utm"]))].distance(Point(*e["utm"])) for e in ents]
    m["entrance_reach_15m"] = sum(d <= 15 for d in dists) / max(len(dists), 1)
    detail["network"] = {"nodes": len(adj), "components": len(sizes), "entrances": len(ents)}
    # packed network length vs the source OSM ways
    src = 0.0
    for wid, tags in osm.ways_where(lambda t: t.get("highway") in WALK):
        pts = osm.way_coords(wid)
        if pts and len(pts) > 1:
            src += LineString([osm_to_city(*p) for p in pts]).length
    packed = sum(w["line"].length for w in net["ways"] if w["kind"] in WALK and w["line"] is not None)
    m["network_length_rel_err"] = abs(packed - src) / src
    return m, detail
