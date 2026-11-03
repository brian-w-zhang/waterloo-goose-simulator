"""Compare roof-height estimators against lidar p90 truth (doc 06 section 5 baseline).

Estimators: our packed world (lidar tiers), OSM building:levels x 3.5 m, OSM levels x 3.62 m
(the doc 01 best fit), City FIRE_STOREYS x 3.5 m. Truth: frozen ground-truth p90 for the 20 key
buildings and recomputed p90 for every pre-2018 UW footprint with a lidar height.
Run: .venv/bin/python -m bench.heights_baseline
"""
import json
import subprocess
from datetime import datetime, timezone

import numpy as np

from pipeline.build import lidar
from pipeline.config import ROOT
from pipeline.validate.heights import _window, eroded_mask, packed_p90
from pipeline.validate.truth import load
from pipeline.validate.world import World


def main():
    gt = load()
    w = World.load()
    nd = lidar.ndsm()
    import pickle
    pipe = {b["objectid"]: b for b in pickle.load(open(ROOT / "data" / "build" / "buildings.pkl", "rb"))}
    rows = []
    for b in w.buildings:
        if b.owner != "UNIVERSITY OF WATERLOO" or b.post2018 or b.footprint.area < 100:
            continue
        sl, tr = _window(b.footprint)
        win = nd[sl]
        mk = eroded_mask(b.footprint, win.shape, tr)
        truth = float(np.percentile(win[mk], 90))
        tags = pipe[b.objectid]["osm_tags"]
        try:
            levels = float(tags.get("building:levels")) if tags.get("building:levels") else None
        except ValueError:
            levels = None
        rows.append({"objectid": b.objectid, "abbrev": b.abbrev, "truth": truth, "ours": packed_p90(b, (sl, tr)),
                     "osm_levels_3p5": levels * 3.5 if levels else None, "osm_levels_3p62": levels * 3.62 if levels else None})
    city = {f["properties"]["OBJECTID"]: f["properties"].get("FIRE_STOREYS")
            for f in json.loads((ROOT / "data" / "raw" / "city" / "city_footprints.geojson").read_text())["features"]}
    for r in rows:
        fs = city.get(r["objectid"])
        r["fire_storeys_3p5"] = float(fs) * 3.5 if fs else None

    def stats(key):
        e = np.array([r[key] - r["truth"] for r in rows if r[key] is not None])
        return {"n": int(e.size), "rmse_m": round(float(np.sqrt(np.mean(e ** 2))), 2), "mae_m": round(float(np.mean(np.abs(e))), 2),
                "median_abs_m": round(float(np.median(np.abs(e))), 2)}

    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    out = {"sha": sha, "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "population": "pre-2018 UW-owned footprints over 100 m2 with lidar; truth = nDSM p90 inside the footprint eroded 1 m",
           "estimators": {k: stats(k) for k in ("ours", "osm_levels_3p5", "osm_levels_3p62", "fire_storeys_3p5")}}
    path = ROOT / "bench" / "results" / f"heights-baseline-{datetime.now().strftime('%Y-%m-%d')}-{sha}.json"
    path.write_text(json.dumps(out, indent=1))
    print(path)
    print(json.dumps(out["estimators"]))


if __name__ == "__main__":
    main()
