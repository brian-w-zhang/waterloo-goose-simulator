"""Reference catalogue: python -m tools.refs.catalog

Boundary (docs/refs/boundary.geojson) follows the UW campus map the user chose (Nov 3, 2026):
Westmount Road North on the west and south-west, University Avenue and Seagram Drive (with UW Place)
on the south-east, the east side of Lester Street (Phillip Street, ICON, the student towers and
University Shops Plaza inside), and the north campus and research park up to Wes Graham Way.

Writes docs/refs/catalog.json and one folder per item:
  buildings/<id>/   every footprint inside the boundary (UW abbreviation, else OSM name/address, else City OBJECTID)
  streets/<slug>/   named OSM roads and paths, split into ~150 m pieces
  zones/<cell>/     100 m grid cells (every square metre lies in exactly one cell)
Each folder gets private/ (screenshots from Google, Bing and other sites; git-ignored) and NOTES.md.
"""
import json
import pickle
import re
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box, mapping
from shapely.ops import substring

from pipeline.build import osm
from pipeline.build.buildings import osm_to_city
from pipeline.coords import utm_to_lonlat

ROOT = Path(__file__).resolve().parents[2]
REFS = ROOT / "docs" / "refs"
CELL = 100
PIECE = 150

BOUNDARY_UTM = [
    (535400, 4814200), (536700, 4814250), (537000, 4814250), (537330, 4814230), (537440, 4814030),
    (537920, 4813230), (537990, 4813190), (537960, 4812990), (537720, 4812930), (537280, 4812940),
    (537130, 4812700), (536940, 4812400), (536590, 4812760), (536250, 4813000), (535900, 4813010),
    (535700, 4813180), (535430, 4813450), (535380, 4814000),
]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:48]


def ll(e, n):
    lon, lat = utm_to_lonlat(e, n)
    return [round(lon, 7), round(lat, 7)]


def main():
    B = Polygon(BOUNDARY_UTM)
    (REFS / "boundary.geojson").write_text(json.dumps({"type": "Feature", "properties": {
        "note": "UW campus map extent, Westmount Rd N to Lester St; UTM 17N vertices in tools/refs/catalog.py"},
        "geometry": {"type": "Polygon", "coordinates": [[ll(*p) for p in BOUNDARY_UTM + [BOUNDARY_UTM[0]]]]}}))
    bl = pickle.load(open(ROOT / "data" / "build" / "buildings.pkl", "rb"))
    # OSM names and addresses for buildings the City data leaves unnamed (off-campus)
    named = []
    for wid, t in osm.ways_where(lambda t: "building" in t and ("name" in t or "addr:housenumber" in t)):
        pts = osm.way_coords(wid)
        if pts and len(pts) > 3:
            try:
                named.append((Polygon([osm_to_city(*p) for p in pts]).buffer(0), t))
            except Exception:
                pass
    items = []
    used = set()
    for b in sorted(bl, key=lambda b: -b["footprint"].area):
        fp = b["footprint"]
        if not B.intersects(fp):
            continue
        ab = (b["abbrev"] or "").strip()
        uw = "WATERLOO" in (b["owner"] or "").upper()
        label, name = None, b["name"] or ""
        if uw and ab and ab.isprintable() and not ab.isspace():
            label = ab
        else:
            best = max(named, key=lambda nt: nt[0].intersection(fp).area if nt[0].intersects(fp) else 0, default=None)
            if best and best[0].intersects(fp) and best[0].intersection(fp).area > 0.3 * fp.area:
                t = best[1]
                name = t.get("name") or f"{t.get('addr:housenumber', '')} {t.get('addr:street', '')}".strip()
                label = name
        if not label:
            label = f"oid{b['objectid']}"
        bid = slug(label) if not (uw and ab) else slug(ab)
        if bid in used:
            bid = f"{bid}-{b['objectid']}-{b['part_index']}"
        used.add(bid)
        c = fp.centroid
        items.append({"kind": "building", "id": bid, "label": label, "name": name, "uw": uw,
                      "objectid": int(b["objectid"]), "part_index": int(b["part_index"]),
                      "centre_ll": ll(c.x, c.y), "centre_utm": [round(c.x, 1), round(c.y, 1)],
                      "bbox_utm": [round(v, 1) for v in fp.bounds], "area_m2": round(fp.area),
                      "height_m": round(b["p90"], 1), "priority": 1 if uw else 2})
    # streets and paths: named ways, merged by name, cut into ~150 m pieces
    by_name = {}
    for wid, t in osm.ways_where(lambda t: "highway" in t and "name" in t and t.get("area") != "yes"):
        pts = osm.way_coords(wid)
        if pts and len(pts) > 1:
            ln = LineString([osm_to_city(*p) for p in pts]).intersection(B)
            if not ln.is_empty and ln.length > 10:
                by_name.setdefault(t["name"], []).append(ln)
    for nm, lines in sorted(by_name.items()):
        parts = []
        for g in lines:
            parts += list(getattr(g, "geoms", [g]))
        k = 0
        for ln in sorted(parts, key=lambda g: -g.length):
            for s in np.arange(0, ln.length, PIECE):
                piece = substring(ln, s, min(s + PIECE, ln.length))
                if piece.length < 15:
                    continue
                coords = list(piece.coords)
                items.append({"kind": "street", "id": f"{slug(nm)}-{k:02d}", "label": f"{nm} ({k + 1})", "name": nm,
                              "line_ll": [ll(*p) for p in coords], "length_m": round(piece.length), "priority": 2})
                k += 1
    # zones: 100 m cells covering the boundary
    x0, y0, x1, y1 = B.bounds
    for i, x in enumerate(np.arange(np.floor(x0 / CELL) * CELL, x1, CELL)):
        for j, y in enumerate(np.arange(np.floor(y0 / CELL) * CELL, y1, CELL)):
            cell = box(x, y, x + CELL, y + CELL)
            if not cell.intersects(B) or cell.intersection(B).area < 500:
                continue
            cid = f"z{int(x) // CELL % 1000:03d}_{int(y) // CELL % 1000:03d}"
            items.append({"kind": "zone", "id": cid, "label": cid, "sw_utm": [int(x), int(y)],
                          "centre_ll": ll(x + CELL / 2, y + CELL / 2), "inside_m2": round(cell.intersection(B).area),
                          "priority": 2})
    for it in items:
        d = REFS / {"building": "buildings", "street": "streets", "zone": "zones"}[it["kind"]] / it["id"]
        (d / "private").mkdir(parents=True, exist_ok=True)
        it["dir"] = str(d.relative_to(ROOT))
        notes = d / "NOTES.md"
        if not notes.exists():
            notes.write_text(f"# {it['label']}\n\nStatus: not started\n")
    (REFS / "catalog.json").write_text(json.dumps({"boundary": "docs/refs/boundary.geojson", "items": items}, indent=1))
    kinds = {}
    for it in items:
        kinds[it["kind"]] = kinds.get(it["kind"], 0) + 1
    print(kinds, "UW buildings", sum(1 for it in items if it["kind"] == "building" and it["uw"]))


if __name__ == "__main__":
    main()
