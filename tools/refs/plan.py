"""What gets a hand-built model, and in what order: python -m tools.refs.plan

Writes config/model_plan.json and docs/refs/MODEL-PLAN.md.
  tier 1 core:     UW buildings inside or touching Ring Road
  tier 2 campus:   the other UW buildings (residences, north and east campus) and the colleges
  tier 3 edge:     named off-campus complexes next to campus (ICON, the Phillip Square towers sold as
                   Rez One, WCRI, Sage, the Lester towers over 12 m, University Shops Plaza and its pads,
                   the research park)
  tier 4 background: houses and sheds on side streets (keep the procedural shapes; no model)
Order: within the first three tiers, buildings are grouped into clusters of neighbours (footprints
within 25 m chain together) and clusters are taken nearest-first from the core (MC/DC/QNC/SLC), so
stopping at any point leaves a contiguous, finished area.
"""
import json
import pickle
from pathlib import Path

from shapely.geometry import Point
from shapely.ops import polygonize, unary_union
from shapely.geometry import LineString

from pipeline.build import osm
from pipeline.build.buildings import osm_to_city

ROOT = Path(__file__).resolve().parents[2]
CORE = Point(536880, 4813300)
COLLEGES = ("Renison", "St. Jerome", "Conrad Grebel", "United College", "Resurrection", "St. Paul")
EDGE_NAMES = ("Icon", "Blair House", "Elora House", "Fergus House", "Hespeler House", "WCRI", "Sage", "V.I.P", "Society 145",
              "Molly Bloom", "Rooster", "Waterloo Central Supermarket", "Accelerator", "innoTECH", "Cora", "OpenText", "Lakes Software",
              "FleetComplete", "RIM 21", "A1", "A2", "A3", "A4", "Beckett", "KW Granite", "Waterloo Tennis")
PLAZA_OIDS = {388, 10769, 17445, 15635, 34262, 31641}     # University Shops Plaza strips and pads (agent notes)
DONE = {"dc", "mc", "qnc", "slc"}


def ring_road():
    lines = []
    for wid, t in osm.ways_where(lambda t: t.get("name") == "Ring Road" and "highway" in t):
        pts = osm.way_coords(wid)
        if pts:
            lines.append(LineString([osm_to_city(*p) for p in pts]))
    polys = list(polygonize(unary_union(lines)))
    return max(polys, key=lambda p: p.area) if polys else None


COMPLEX = ("Rez-One", "ICON", "Icon", "Sage", "WCRI", "Linden Square", "myREZ", "Student Housing", "University Shops Plaza",
           "Phillip Square", "Condos", "UW Place", "Village 1")


def google_names(pid, places):
    """(display name, tenants) from the Google Maps places on this footprint (tools/refs/places_join.py)."""
    ps = places.get(pid, [])
    names = [p["name"] for p in ps]
    # the complex's own name beats a business that mentions it ("KEN Sushi House Phillip Square")
    display = next((n for c in COMPLEX for n in names if c.lower() in n.lower()), None)
    tenants = sorted({n for n in names if n != display and not n[0].isdigit() and "Unit" not in n})
    return display, tenants


def main():
    cat = json.loads((ROOT / "docs/refs/catalog.json").read_text())
    try:
        places = json.loads((ROOT / "docs/refs/places/places_by_building.json").read_text())["buildings"]
    except FileNotFoundError:
        places = {}
    bl = pickle.load(open(ROOT / "data/build/buildings.pkl", "rb"))
    fps = {(b["objectid"], b["part_index"]): b for b in bl}
    ring = ring_road()
    rows = []
    for it in cat["items"]:
        if it["kind"] != "building":
            continue
        b = fps[(it["objectid"], it["part_index"])]
        fp = b["footprint"]
        name = it["name"] or it["label"]
        if it["uw"]:
            tier = 1 if ring is not None and fp.distance(ring) < 20 else 2
        elif any(c in name for c in COLLEGES):
            tier = 2
        elif it["objectid"] in PLAZA_OIDS or any(n.lower() in name.lower() for n in EDGE_NAMES) \
                or ("Lester" in name and b["p90"] > 12) or name.startswith(("170 University", "160 University", "280 Lester")):
            tier = 3
        else:
            tier = 4
        gname, tenants = google_names(it["id"], places)
        if tier == 4 and (tenants or gname):
            tier = 3          # restaurants, shops and named residences next to campus
        if "SHED" in name.upper() or (not it["uw"] and (b["p90"] < 2.5 or fp.area < 25)):
            tier = 4          # sheds, kiosks and lidar noise
        rows.append({"id": it["id"], "label": it["label"], "name": name, "google_name": gname, "tenants": tenants, "tier": tier, "objectid": it["objectid"],
                     "area_m2": round(fp.area), "height_m": round(b["p90"], 1), "fp": fp,
                     "dist_core_m": round(fp.distance(CORE)), "done": it["id"] in DONE})
    # clusters of neighbours among tiers 1-3, nearest cluster first
    model = [r for r in rows if r["tier"] <= 3]
    cid = list(range(len(model)))
    def find(i):
        while cid[i] != i:
            cid[i] = cid[cid[i]]
            i = cid[i]
        return i
    for i in range(len(model)):
        for j in range(i + 1, len(model)):
            if model[i]["fp"].distance(model[j]["fp"]) < 25:
                cid[find(i)] = find(j)
    clusters = {}
    for i, r in enumerate(model):
        clusters.setdefault(find(i), []).append(r)
    order = sorted(clusters.values(), key=lambda c: (min(r["tier"] for r in c), min(r["dist_core_m"] for r in c)))
    rank = 0
    for k, c in enumerate(order):
        for r in sorted(c, key=lambda r: (r["tier"], r["dist_core_m"])):
            rank += 1
            r["order"], r["cluster"] = rank, k + 1
    for r in rows:
        r.pop("fp")
    rows.sort(key=lambda r: (r.get("order", 10 ** 6), r["tier"], r["dist_core_m"]))
    (ROOT / "config/model_plan.json").write_text(json.dumps({"note": __doc__.strip().splitlines()[0], "buildings": rows}, indent=1))
    lines = ["# Model plan", "", "Generated by `python -m tools.refs.plan` (see its docstring for the rules). Tier 4 keeps the procedural shapes.", ""]
    names = {1: "core (Ring Road)", 2: "campus", 3: "edge (off-campus named)", 4: "background (no model)"}
    for t in (1, 2, 3, 4):
        sel = [r for r in rows if r["tier"] == t]
        lines += [f"## Tier {t}: {names[t]} ({len(sel)})", ""]
        if t < 4:
            lines += ["| order | cluster | id | name (Google Maps) | height | businesses inside | done |", "|---|---|---|---|---|---|---|"]
            lines += [f"| {r['order']} | {r['cluster']} | {r['id']} | {r['google_name'] or r['name']} | {r['height_m']} m | "
                      f"{', '.join(r['tenants'][:8])}{' …' if len(r['tenants']) > 8 else ''} | {'yes' if r['done'] else ''} |" for r in sel]
        else:
            lines += [", ".join(sorted(r["name"] for r in sel))]
        lines.append("")
    (ROOT / "docs/refs/MODEL-PLAN.md").write_text("\n".join(lines))
    print({t: sum(1 for r in rows if r["tier"] == t) for t in (1, 2, 3, 4)}, "clusters", len(order))


if __name__ == "__main__":
    main()
