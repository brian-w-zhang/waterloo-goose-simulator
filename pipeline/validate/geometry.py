"""Coverage, built area, IoU (City and OSM), key-building dimensions and bearings, positions,
distances and azimuths, all measured on the packed world (doc 08 section 2.1)."""
import json
import math

import numpy as np
from pyproj import Geod
from shapely import STRtree
from shapely.geometry import Polygon, box, shape
from shapely.ops import transform, unary_union

from ..build import osm
from ..config import CAMPUS, RAW, ROOT
from ..coords import lonlat_to_utm, true_azimuth_deg, utm_to_lonlat
from .truth import load

GEOD = Geod(ellps="GRS80")
UW = "UNIVERSITY OF WATERLOO"


def core_box():
    b = CAMPUS["core_bbox_wgs84"]
    return transform(lambda x, y, z=None: lonlat_to_utm(x, y), box(b["w"], b["s"], b["e"], b["n"]))


def oriented_dims(g):
    rect = g.minimum_rotated_rectangle
    c = list(rect.exterior.coords)[:4]
    e = [(c[i], c[(i + 1) % 4]) for i in range(4)]
    lens = [math.dist(a, b) for a, b in e]
    i = max(range(4), key=lambda k: lens[k])
    (x1, y1), (x2, y2) = e[i]
    lo1, la1 = utm_to_lonlat(x1, y1)
    lo2, la2 = utm_to_lonlat(x2, y2)
    return max(lens), min(lens), GEOD.inv(lo1, la1, lo2, la2)[0] % 180.0


def iou(a, b):
    u = a.union(b).area
    return a.intersection(b).area / u if u > 0 else 0.0


def run(world):
    gt = load()
    native = json.loads((ROOT / "verify" / "truth-native" / "landmarks_native.json").read_text())["buildings"]
    m, detail = {}, {}
    core = core_box()
    bl = world.buildings
    truth_ids = json.loads((ROOT / "verify" / "truth-native" / "core_objectids.json").read_text())
    packed_oids = {b.objectid for b in bl}
    m["coverage_uw_core"] = len(set(truth_ids["uw"]) & packed_oids)
    m["coverage_all_core"] = len(set(truth_ids["all"]) & packed_oids)
    core_set = set(truth_ids["all"])
    in_core = [b for b in bl if b.objectid in core_set]
    area_uw = sum(b.footprint.area for b in in_core if b.owner == UW)
    area_all = sum(b.footprint.area for b in in_core)
    m["built_area_uw_rel_err"] = abs(area_uw - gt["coverage"]["uw_owned_area_m2"]) / gt["coverage"]["uw_owned_area_m2"]
    m["built_area_all_rel_err"] = abs(area_all - gt["coverage"]["all_area_m2"]) / gt["coverage"]["all_area_m2"]
    detail["coverage"] = {"uw_area_m2": round(area_uw), "all_area_m2": round(area_all),
                          "truth_uw": gt["coverage"]["uw_owned_footprints"], "truth_all": gt["coverage"]["all_footprints_core_bbox"]}

    # IoU against the City layer (by OBJECTID) and OSM (best match, report only)
    raw = {f["properties"]["OBJECTID"]: shape(f["geometry"]).buffer(0)
           for f in json.loads((RAW / "city" / "city_footprints.geojson").read_text())["features"]}
    by_oid = {}
    for b in bl:
        by_oid.setdefault(b.objectid, []).append(b.footprint)
    ious = {}
    for oid, polys in by_oid.items():
        g = raw.get(oid)
        if g is None or g.area <= 50:
            continue
        ious[oid] = iou(unary_union(polys), g)
    v = np.array(list(ious.values()))
    m["iou_city_median"] = float(np.median(v))
    m["iou_city_p10"] = float(np.percentile(v, 10))
    from ..build.buildings import osm_to_city
    osm_polys = []
    for wid, tags in osm.ways_where(lambda t: "building" in t):
        pts = osm.way_coords(wid)
        if pts and len(pts) >= 4 and pts[0] == pts[-1]:
            p = Polygon([osm_to_city(e, n) for e, n in pts])
            if p.is_valid and p.area > 50:
                osm_polys.append(p)
    tree = STRtree(osm_polys)
    oi = []
    for oid, polys in by_oid.items():
        g = unary_union(polys)
        best = max((iou(g, osm_polys[i]) for i in tree.query(g)), default=0.0)
        if best > 0:
            oi.append(best)
    m["iou_osm_median_report"] = float(np.median(oi)) if oi else 0.0
    detail["iou"] = {"n_city": len(v), "n_osm_matched": len(oi),
                     "worst_city": sorted(((round(x, 3), o) for o, x in ious.items()))[:10]}

    # key buildings
    key, centroids = {}, {}
    area_errs, side_fails, bearing_errs, pos_native, pos_gt = [], [], [], [], []
    for t in gt["buildings"]:
        polys = [p for o in t["city_objectids"] for p in by_oid.get(o, [])]
        if not polys:
            key[t["id"]] = {"missing": True}
            continue
        g = unary_union(polys)
        L, W, az = oriented_dims(g)
        truth_g = unary_union([raw[o] for o in t["city_objectids"] if o in raw])
        k_iou = iou(g, truth_g)
        a_err = abs(g.area - t["footprint_area_m2"]) / t["footprint_area_m2"]
        side_ok = (abs(L - t["obb_long_m"]) <= max(1.0, 0.02 * t["obb_long_m"])
                   and abs(W - t["obb_short_m"]) <= max(1.0, 0.02 * t["obb_short_m"]))
        b_err = None
        if t["bearing_reliable"]:
            b_err = abs((az - t["long_axis_bearing_true_deg"] + 90) % 180 - 90)
            bearing_errs.append(b_err)
        nat = native[t["id"]]
        dn = math.dist((g.centroid.x, g.centroid.y), (nat["utm_e"], nat["utm_n"]))
        dg = math.dist((g.centroid.x, g.centroid.y), (t["centroid"]["utm_e"], t["centroid"]["utm_n"]))
        pos_native.append(dn)
        pos_gt.append(dg)
        area_errs.append(a_err)
        side_fails += [] if side_ok else [t["id"]]
        centroids[t["id"]] = (g.centroid.x, g.centroid.y)
        key[t["id"]] = {"iou_city": round(k_iou, 4), "area_rel_err": round(a_err, 4), "obb": [round(L, 1), round(W, 1)],
                        "bearing_err": None if b_err is None else round(b_err, 2),
                        "pos_err_native_m": round(dn, 3), "pos_err_frozen_truth_m": round(dg, 3)}
    m["iou_city_key_min"] = min(k["iou_city"] for k in key.values() if "iou_city" in k)
    m["key_area_max_rel_err"] = float(max(area_errs))
    m["key_obb_side_fail_count"] = len(side_fails)
    m["key_bearing_max_err_deg"] = float(max(bearing_errs))

    # stations and lakes from the packed world
    st = {s["osm_id"]: s["utm"] for s in world.network["stations"]}
    centroids["ION_UW"] = st.get(4211159080)
    centroids["ION_LAURIER"] = st.get(4211146895)
    for oid, (name, poly) in world.lakes.items():
        if name in ("Columbia Lake", "Laurel Lake"):
            centroids[name.replace(" ", "_").upper()] = (poly.centroid.x, poly.centroid.y)
    for sid in ("ION_UW", "ION_LAURIER"):
        lm = gt["landmarks"].get(sid)
        if lm and centroids.get(sid):
            e, n = lonlat_to_utm(lm["lon"], lm["lat"])
            d = math.dist(centroids[sid], (e, n))
            pos_native.append(d)
            pos_gt.append(d)
            key[sid] = {"pos_err_m": round(d, 3)}
    m["landmark_pos_median_m"] = float(np.median(pos_native))
    m["landmark_pos_max_m"] = float(max(pos_native))
    detail["landmark_pos_vs_frozen_truth"] = {"median_m": round(float(np.median(pos_gt)), 3),
                                              "max_m": round(float(max(pos_gt)), 3),
                                              "note": "frozen centroids carry the WGS84 export offset; see NOTES.md"}

    # distances and azimuths
    derrs, aerrs, fails, pairs = [], [], [], []
    for p in gt["distances"]:
        a, b = centroids.get(p["a"]), centroids.get(p["b"])
        if a is None or b is None:
            fails.append(f"{p['a']}-{p['b']} missing")
            continue
        d = math.dist(a, b)
        az = true_azimuth_deg(a[0], a[1], b[0], b[1])
        de = abs(d - p["utm_grid_m"])
        ae = abs((az - p["azimuth_true_deg"] + 180) % 360 - 180)
        derrs.append(de)
        aerrs.append(ae)
        if de > max(1.0, 0.005 * p["utm_grid_m"]):
            fails.append(f"{p['a']}-{p['b']}")
        pairs.append({"pair": f"{p['a']}-{p['b']}", "split": p["split"], "d": round(d, 2), "truth": p["utm_grid_m"],
                      "err_m": round(de, 2), "az_err": round(ae, 2)})
    m["distance_fail_count"] = len(fails)
    m["distance_median_err_m"] = float(np.median(derrs))
    m["azimuth_max_err_deg"] = float(max(aerrs))
    detail["distances"] = {"fails": fails, "max_err_m": round(float(max(derrs)), 3), "pairs": pairs}
    detail["key_buildings"] = key
    return m, detail
