"""Massing helper for art scripts: python -m tools.art.massing SPEC.json OUT.json

SPEC: {"abbrev": "DC", "exclude": [[[x, y], ...], ...], "simplify": 0.6, "merge_dh": 0.9, "min_area": 6}
Reads data/build/art/buildings.json (lidar tiers per footprint part), removes the excluded polygons
(the parts a script models by hand), merges neighbouring tiers whose heights differ by less than
merge_dh, simplifies outlines and writes [{"h": tier height above ground, "ground_y": .., "rings": [...]}].
"""
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]


def main(spec_path, out_path):
    spec = json.loads(Path(spec_path).read_text())
    blds = json.loads((ROOT / "data" / "build" / "art" / "buildings.json").read_text())
    parts = [b for b in blds.values() if (b["abbrev"] or "").strip() == spec["abbrev"]]
    excl = unary_union([Polygon(r) for r in spec.get("exclude", [])]) if spec.get("exclude") else None
    tiers = []
    for b in parts:
        for p in b["parts"]:
            g = Polygon(p["outer"], p["holes"]).buffer(0)
            if excl is not None:
                g = g.difference(excl)
            if g.area > 0.5:
                tiers.append([g, p["h"], b["ground_y"]])
    # merge by height: sort, then union each tier into an earlier one of similar height it touches
    tiers.sort(key=lambda t: t[1])
    merged = []
    for g, h, gy in tiers:
        for m in merged:
            if abs(m[1] - h) < spec.get("merge_dh", 0.9) and m[0].buffer(0.3).intersects(g):
                a0, a1 = m[0].area, g.area
                m[0] = unary_union([m[0], g]).buffer(0.25).buffer(-0.25)
                m[1] = (m[1] * a0 + h * a1) / (a0 + a1)
                break
        else:
            merged.append([g, h, gy])
    out = []
    for g, h, gy in merged:
        g = g.simplify(spec.get("simplify", 0.6))
        for poly in getattr(g, "geoms", [g]):
            # slivers left by the exclusion (thin wedges) are dropped
            if poly.geom_type == "Polygon" and poly.area >= spec.get("min_area", 6) \
                    and not poly.buffer(-spec.get("min_width", 0) / 2).is_empty:
                out.append({"h": round(h, 2), "ground_y": gy, "rings": [list(map(list, poly.exterior.coords))[:-1]],
                            "holes": [list(map(list, r.coords))[:-1] for r in poly.interiors]})
    Path(out_path).write_text(json.dumps(out))
    print(len(out), "tiers")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
