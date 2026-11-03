"""File Street View captures under the catalogue items they show: python -m tools.refs.link_sv

For every captured panorama (docs/refs/sv_dates.jsonl, images in docs/refs/streetview/private/):
  buildings: panoramas within 90 m of the footprint; a heading is kept when the footprint's nearest
             point lies within 55 degrees of the view direction (the 90-100 degree field of view)
  streets:   panoramas within 20 m of the street piece (all headings)
  zones:     panoramas inside the 100 m cell (all headings)
Each item gets <dir>/streetview.json (file, heading, distance, date, source) and symlinks in
<dir>/private/sv/ so the folder holds its own pictures.
"""
import json
import math
import os
import pickle
from pathlib import Path

from shapely.geometry import LineString, Point, box
from shapely.ops import nearest_points
from shapely.strtree import STRtree

from pipeline.coords import lonlat_to_utm

ROOT = Path(__file__).resolve().parents[2]
REFS = ROOT / "docs" / "refs"
SV = REFS / "streetview" / "private"


def main():
    panos = {}
    for line in (REFS / "sv_dates.jsonl").read_text().splitlines():
        r = json.loads(line)
        e, n = lonlat_to_utm(r["lng"], r["lat"])
        r["pt"] = Point(e, n)
        r["files"] = sorted(SV.glob(f"{r['id']}_*.jpg"))
        if r["files"]:
            panos[r["id"]] = r
    cat = json.loads((REFS / "catalog.json").read_text())
    bl = pickle.load(open(ROOT / "data" / "build" / "buildings.pkl", "rb"))
    fps = {(b["objectid"], b["part_index"]): b["footprint"] for b in bl}
    plist = list(panos.values())
    tree = STRtree([p["pt"] for p in plist])
    counts = {}
    for it in cat["items"]:
        links = []
        if it["kind"] == "building":
            fp = fps.get((it["objectid"], it["part_index"]))
            if fp is None:
                continue
            for k in tree.query(fp.buffer(90)):
                p = plist[k]
                if fp.contains(p["pt"]):
                    continue          # an indoor photo inside this building
                q = nearest_points(p["pt"], fp)[1]
                d = p["pt"].distance(q)
                bearing = math.degrees(math.atan2(q.x - p["pt"].x, q.y - p["pt"].y)) % 360
                for f in p["files"]:
                    h = int(f.stem.rsplit("_", 1)[1])
                    if abs((h - bearing + 180) % 360 - 180) <= 55:
                        links.append((f, h, d, p))
        elif it["kind"] == "street":
            ln = LineString([lonlat_to_utm(*c) for c in it["line_ll"]])
            for k in tree.query(ln.buffer(20)):
                p = plist[k]
                links += [(f, int(f.stem.rsplit("_", 1)[1]), p["pt"].distance(ln), p) for f in p["files"]]
        else:
            e, n = it["sw_utm"]
            cell = box(e, n, e + 100, n + 100)
            for k in tree.query(cell):
                p = plist[k]
                if cell.contains(p["pt"]):
                    links += [(f, int(f.stem.rsplit("_", 1)[1]), 0.0, p) for f in p["files"]]
        d = ROOT / it["dir"]
        sv = d / "private" / "sv"
        sv.mkdir(parents=True, exist_ok=True)
        for old in sv.iterdir():
            if old.is_symlink():
                old.unlink()
        for f, *_ in links:
            os.symlink(os.path.relpath(f, sv), sv / f.name)
        (d / "streetview.json").write_text(json.dumps([{"file": f.name, "heading": h, "dist_m": round(dd, 1),
            "date": p["date"], "source": p["src"]} for f, h, dd, p in sorted(links, key=lambda t: t[2])], indent=0))
        counts[it["kind"]] = counts.get(it["kind"], 0) + (1 if links else 0)
    print("items with Street View:", counts, "panoramas:", len(panos))


if __name__ == "__main__":
    main()
