"""Native EPSG:26917 centroids for the ground-truth buildings (doc 08 section 5, Datum).

The frozen ground_truth.json centroids went City (NAD83 UTM) -> WGS84 export -> pyproj null shift
-> UTM, which leaves a constant offset of about +0.31 m E, -0.94 m N against the native layer.
This file recomputes the same OBJECTID unions from the native layer; it adds truth, never replaces it.
Run: .venv/bin/python -m tools.verify.native_truth
"""
import json
from datetime import datetime, timezone

from shapely.geometry import shape
from shapely.ops import unary_union

from pipeline.config import RAW, ROOT
from pipeline.validate.truth import load

OUT = ROOT / "verify" / "truth-native" / "landmarks_native.json"


def main():
    gt = load()
    manifest = json.loads((ROOT / "pipeline" / "manifest.json").read_text())["inputs"]["city_footprints"]
    feats = {f["properties"]["OBJECTID"]: f for f in
             json.loads((RAW / "city" / "city_footprints.geojson").read_text())["features"]}
    out = {}
    for b in gt["buildings"]:
        geoms = [shape(feats[o]["geometry"]) for o in b["city_objectids"] if o in feats]
        u = unary_union(geoms)
        out[b["id"]] = {"utm_e": round(u.centroid.x, 3), "utm_n": round(u.centroid.y, 3),
                        "area_m2": round(u.area, 1), "objectids": b["city_objectids"],
                        "missing": [o for o in b["city_objectids"] if o not in feats]}
    OUT.write_text(json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": manifest["url"], "source_sha256": manifest["sha256"], "fetched_at": manifest["fetched_at"],
        "method": "Union of the ground-truth OBJECTIDs from the native EPSG:26917 City layer (outSR=26917); centroid of the union.",
        "buildings": out}, indent=1) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
