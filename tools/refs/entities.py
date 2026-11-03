"""World entity register: python -m tools.refs.entities  ->  docs/refs/entities.json

One entry per real object on the ground (bench, picnic table, bin, bike rack, lamp, sign, bollard,
planter, artwork, bus stop, fire pit, tree), merged from every source by position so an object seen
in several datasets (and later in several photos) is one entry. Positions are art coordinates (x east,
y north, metres from the campus origin). Sources, in order of trust for position:
  UW ArcGIS (bike racks, fire pits), City of Waterloo (street trees, bicycle parking, public art),
  OpenStreetMap (benches, tables, bins, lamps, signs, bollards, trees, art), GRT stops.
Street View sightings and photo-read facade specs (facades.json site.entities) add entries or
confirm existing ones (python -m tools.refs.entities --add-sightings).
Each entry: id, type, kind (model variant), x, y, rot (deg, if known), sources [...], attrs {...}.
"""
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

from pipeline.coords import ORIGIN_E, ORIGIN_N, lonlat_to_utm
from tools.refs.catalog import BOUNDARY_UTM

ROOT = Path(__file__).resolve().parents[2]
G = ROOT / "docs/refs/grounds"
MERGE_M = {"tree": 2.0, "lamp": 1.5, "bench": 1.2, "picnic_table": 1.5, "bin": 1.0, "bike_rack": 2.5, "sign": 1.5,
           "bollard": 0.6, "planter": 1.5, "artwork": 3.0, "bus_stop": 6.0, "fire_pit": 3.0, "post_box": 1.0}


def osm_type(p):
    a, h, m, b, t, l = p.get("amenity"), p.get("highway"), p.get("man_made"), p.get("barrier"), p.get("tourism"), p.get("leisure")
    if a == "bench": return "bench", "backrest" if p.get("backrest") == "yes" else "plain"
    if a == "waste_basket": return "bin", p.get("recycling_type") or "waste"
    if a == "recycling": return "bin", "recycling"
    if a == "bicycle_parking": return "bike_rack", p.get("bicycle_parking", "stands")
    if a == "post_box": return "post_box", ""
    if l == "picnic_table" or a == "picnic_table": return "picnic_table", ""
    if h == "street_lamp": return "lamp", p.get("lamp_mount", "")
    if b == "bollard": return "bollard", p.get("bollard", "")
    if t == "artwork": return "artwork", p.get("name", "")
    if t == "information" or p.get("information"): return "sign", p.get("information", "")
    if p.get("natural") == "tree": return "tree", p.get("species") or p.get("genus") or p.get("leaf_type", "")
    if p.get("amenity") == "fountain": return "artwork", "fountain"
    if p.get("man_made") == "planter" or p.get("barrier") == "planter": return "planter", ""
    if h == "bus_stop": return "bus_stop", p.get("name", "")
    return None, None


def load(path):
    try:
        return [f for f in json.loads(Path(path).read_text())["features"] if f.get("geometry")]
    except FileNotFoundError:
        print("missing", path)
        return []


def main():
    B = Polygon(BOUNDARY_UTM)
    cands = []

    def add(lon, lat, typ, kind, src, attrs=None, rot=None):
        e, n = lonlat_to_utm(lon, lat)
        if B.contains(Point(e, n)):
            cands.append({"type": typ, "kind": kind or "", "x": round(e - ORIGIN_E, 2), "y": round(n - ORIGIN_N, 2),
                          "rot": rot, "sources": [src], "attrs": attrs or {}})

    for f in load(G / "bike-racks/private/data/uw_bike_racks_v2.geojson"):
        c = shape(f["geometry"]).centroid
        add(c.x, c.y, "bike_rack", str(f["properties"].get("RackType") or f["properties"].get("TYPE") or ""), "uw",
            {k: v for k, v in f["properties"].items() if v not in (None, "")})
    for f in load(G / "maps/private/data/uw_firepits.geojson"):
        c = shape(f["geometry"]).centroid
        add(c.x, c.y, "fire_pit", "", "uw")
    for f in load(G / "trees/private/data/city_street_trees_campus_bbox.geojson"):
        p = f["properties"]
        if p.get("STATUS") and str(p["STATUS"]).lower() not in ("active", "existing", "1"):
            continue
        c = shape(f["geometry"]).centroid
        add(c.x, c.y, "tree", p.get("COM_NAME") or "", "city", {"latin": p.get("LATIN_NAME"), "dbh_cm": p.get("DBH_CM")})
    for f in load(G / "public-art/private/data/city_public_art_bbox.geojson"):
        c = shape(f["geometry"]).centroid
        add(c.x, c.y, "artwork", str(f["properties"].get("TITLE") or f["properties"].get("NAME") or ""), "city", f["properties"])
    for f in load(G / "bus-stops-and-shelters/private/data/grt_stops_campus_bbox.geojson"):
        c = shape(f["geometry"]).centroid
        add(c.x, c.y, "bus_stop", str(f["properties"].get("StopName") or f["properties"].get("stop_name") or ""), "grt", f["properties"])
    for folder in ("benches-tables", "bins", "lamps", "wayfinding-signs", "bollards-fences-railings", "trees", "public-art",
                   "planters-and-gardens", "bike-racks", "bus-stops-and-shelters"):
        for f in load(G / folder / "private/data/osm_in_boundary.geojson"):
            if f["geometry"]["type"] != "Point":
                continue
            typ, kind = osm_type(f["properties"])
            if typ:
                lon, lat = f["geometry"]["coordinates"]
                add(lon, lat, typ, kind, "osm", {k: v for k, v in f["properties"].items() if k not in ("osm_id",)} | {"osm_id": f["properties"].get("osm_id")})
    # merge by type and distance (the earlier, more trusted source keeps its position)
    out = []
    for c in cands:
        r = MERGE_M.get(c["type"], 1.5)
        hit = next((o for o in out if o["type"] == c["type"] and math.hypot(o["x"] - c["x"], o["y"] - c["y"]) < r), None)
        if hit:
            hit["sources"] = sorted(set(hit["sources"] + c["sources"]))
            hit["attrs"] = {**c["attrs"], **hit["attrs"]}
            hit["kind"] = hit["kind"] or c["kind"]
        else:
            out.append(c)
    for k, o in enumerate(out):
        o["id"] = f"{o['type']}_{k:05d}"
    counts = {}
    for o in out:
        counts[o["type"]] = counts.get(o["type"], 0) + 1
    (ROOT / "docs/refs/entities.json").write_text(json.dumps({"note": __doc__.strip().splitlines()[0], "counts": counts, "entities": out}, indent=0))
    print(counts)


if __name__ == "__main__":
    main()
