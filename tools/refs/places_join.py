"""Attach Google Maps places to buildings: python -m tools.refs.places_join

Each place in docs/refs/places/google_places.json (tools/refs/maps_places.mjs) goes to the footprint that
contains it (or lies within 6 m); places outside the boundary are dropped. Writes
docs/refs/places/places_by_building.json {building id: [{name, category, lat, lng}]} for the model plan,
the signage of storefronts and the minimap.
"""
import json
import pickle
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

from pipeline.coords import lonlat_to_utm
from tools.refs.catalog import BOUNDARY_UTM

ROOT = Path(__file__).resolve().parents[2]


def main():
    places = json.loads((ROOT / "docs/refs/places/google_places.json").read_text())
    cat = json.loads((ROOT / "docs/refs/catalog.json").read_text())
    bl = pickle.load(open(ROOT / "data/build/buildings.pkl", "rb"))
    fps = {(b["objectid"], b["part_index"]): b["footprint"] for b in bl}
    items = [it for it in cat["items"] if it["kind"] == "building"]
    geoms = [fps[(it["objectid"], it["part_index"])] for it in items]
    tree = STRtree(geoms)
    B = Polygon(BOUNDARY_UTM)
    out, outside, unmatched = {}, 0, []
    for p in places:
        pt = Point(*lonlat_to_utm(p["lng"], p["lat"]))
        if not B.contains(pt):
            outside += 1
            continue
        best = None
        for k in tree.query(pt.buffer(6)):
            d = geoms[k].distance(pt)
            if d < 6 and (best is None or d < best[0]):
                best = (d, items[k]["id"])
        parts = p["card"].split(" | ")
        rec = {"name": p["name"], "card": " | ".join(parts[1:4])[:120], "lat": p["lat"], "lng": p["lng"]}
        if best:
            out.setdefault(best[1], []).append(rec)
        else:
            unmatched.append(rec)
    (ROOT / "docs/refs/places/places_by_building.json").write_text(json.dumps({"buildings": out, "unmatched": unmatched}, indent=1))
    print(f"{sum(len(v) for v in out.values())} places on {len(out)} buildings; {len(unmatched)} inside the boundary but off any footprint; {outside} outside")


if __name__ == "__main__":
    main()
