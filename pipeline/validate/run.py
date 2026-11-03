"""Run validator groups on the packed world and write results.

Usage: python -m pipeline.validate.run OUT_DIR [geometry heights terrain network]
Writes OUT_DIR/<group>.json with metrics, gates, pass flags and details.
"""
import json
import sys
import time
from pathlib import Path

from ..config import ROOT
from . import geometry, heights, network, terrain
from .truth import check_hashes
from .world import World

GROUPS = {"geometry": geometry, "heights": heights, "terrain": terrain, "network": network}
THRESHOLDS = json.loads((ROOT / "verify" / "thresholds.json").read_text())


def passes(value, spec):
    op, g = spec["op"], spec.get("gate")
    if op == "record" or value is None:
        return None
    return {"<": value < g, "<=": value <= g, ">": value > g, ">=": value >= g, "==": value == g,
            "between": g[0] <= value <= g[1] if isinstance(g, list) else False}[op]


def evaluate(group, metrics):
    out = {}
    for k, v in metrics.items():
        spec = THRESHOLDS[group].get(k)
        out[k] = {"value": v, "gate": spec and spec.get("gate"), "op": spec and spec["op"],
                  "pass": passes(v, spec) if spec else None,
                  "report_only": bool(spec and spec.get("report_only"))}
    return out


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    groups = sys.argv[2:] or list(GROUPS)
    bad = check_hashes()
    if bad:
        print(f"ground truth hash mismatch: {bad}")
        sys.exit(2)
    w = World.load()
    failed = 0
    for g in groups:
        t0 = time.time()
        metrics, detail = GROUPS[g].run(w)
        res = evaluate(g, metrics)
        (out / f"{g}.json").write_text(json.dumps({"metrics": res, "detail": detail,
                                                   "seconds": round(time.time() - t0, 1)}, indent=1, default=str))
        for k, r in res.items():
            flag = "PASS" if r["pass"] else ("----" if r["pass"] is None or r["report_only"] else "FAIL")
            if r["pass"] is False and not r["report_only"]:
                failed += 1
            v = r["value"]
            print(f"{flag} {g}.{k} = {v:.4g} (gate {r['op']} {r['gate']})" if isinstance(v, float)
                  else f"{flag} {g}.{k} = {v} (gate {r['op']} {r['gate']})")
    print(f"{failed} failing gates")


if __name__ == "__main__":
    main()
