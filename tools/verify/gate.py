"""Collect a run folder into summary.json, apply the regression gate, append the ledger line.

Compares every metric with the last green run on the same backend (doc 08 section 4.3): a gated
accuracy metric that gets worse beyond its noise band fails even if the absolute gate passes,
unless verify/exceptions.yaml accepts it. Usage: python -m tools.verify.gate RUN_DIR BACKEND KIND
"""
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from pipeline.config import ROOT
from pipeline.validate.truth import truth_hash

RESULTS = ROOT / "bench" / "results" / "verify"
LEDGER = ROOT / "VERIFY-LEDGER.md"
THRESHOLDS = json.loads((ROOT / "verify" / "thresholds.json").read_text())


def manifest_hash():
    import hashlib
    return hashlib.sha256((ROOT / "pipeline" / "manifest.json").read_bytes()).hexdigest()[:16]


def last_green(backend, exclude):
    """Last all-green run on this backend; while none exists yet, the last run on this backend."""
    runs = [json.loads(p.read_text()) for p in sorted(RESULTS.glob("*/summary.json")) if p.parent != exclude]
    same = [s for s in runs if s.get("backend") == backend]
    green = [s for s in same if s.get("all_pass")]
    return (green or same or [None])[-1]


def exceptions():
    p = ROOT / "verify" / "exceptions.yaml"
    data = yaml.safe_load(p.read_text()) if p.exists() else None
    return {e["metric"] for e in (data or [])}


def spec_of(name, group):
    """Threshold spec by metric name; files like palette.json carry metrics of the style group."""
    if name in THRESHOLDS.get(group, {}):
        return THRESHOLDS[group][name], group
    for g, specs in THRESHOLDS.items():
        if isinstance(specs, dict) and name in specs:
            return specs[name], g
    return {}, group


def worse(name, group, new, old):
    spec, group = spec_of(name, group)
    better, band = spec.get("better", "none"), spec.get("band", 0)
    if not isinstance(new, (int, float)) or not isinstance(old, (int, float)) or better == "none":
        return False
    if group == "flythrough" and name == "frame_ms_p95":
        return new > old * (1 + band)
    new, old = round(new, 6), round(old, 6)  # float32 decode noise is not a regression
    return (new < old - band) if better == "higher" else (new > old + band)


def main():
    run = Path(sys.argv[1])
    backend, kind = sys.argv[2], sys.argv[3]
    metrics = {}
    for f in sorted(run.glob("*.json")):
        if f.name in ("summary.json", "looks.json", "looks_check.json", "visual_info.json"):
            continue
        group = f.stem
        for k, r in json.loads(f.read_text()).get("metrics", {}).items():
            metrics[f"{group}.{k}"] = r
    prev = last_green(backend, run)
    ok_exc = exceptions()
    regressions = []
    if prev:
        for key, r in metrics.items():
            old = prev["metrics"].get(key, {}).get("value")
            g, name = key.split(".", 1)
            if r.get("pass") is not None and not r.get("report_only") and worse(name, g, r["value"], old) \
                    and key not in ok_exc:
                regressions.append({"metric": key, "old": old, "new": r["value"]})
    gated = [r for r in metrics.values() if r.get("pass") is not None and not r.get("report_only")]
    passed = sum(1 for r in gated if r["pass"])
    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    summary = {
        "run": run.name, "kind": kind, "sha": sha, "backend": backend,
        "time": datetime.now(ZoneInfo("America/Toronto")).isoformat(timespec="minutes"),
        "ground_truth_hash": truth_hash(), "manifest_hash": manifest_hash(),
        "gates_passed": passed, "gates_total": len(gated), "regressions": regressions,
        "all_pass": passed == len(gated) and not regressions,
        "compared_with": prev["run"] if prev else None, "metrics": metrics,
    }
    (run / "summary.json").write_text(json.dumps(summary, indent=1))
    v = lambda k, f="{:.3f}": f.format(metrics[k]["value"]) if k in metrics and isinstance(metrics[k]["value"], (int, float)) else "n/a"
    looks = run / "looks_check.json"
    looks_mean = "n/a"
    if looks.exists() and json.loads(looks.read_text()).get("mean") is not None:
        lc = json.loads(looks.read_text())
        looks_mean = f"{lc['mean']:.2f} (dis {lc['mean_disagreement']:.2f})"
    line = (f"| {summary['time'][:16].replace('T', ' ')} | {sha} | {backend} | {kind} | {passed}/{len(gated)} | "
            f"{v('geometry.iou_city_median')} | {v('heights.height_rmse_dev_m', '{:.2f}')} / "
            f"{v('heights.height_rmse_holdout_m', '{:.2f}')} | {v('geometry.distance_median_err_m', '{:.2f}')} | "
            f"{v('style.val_std')} | {looks_mean} | {len(regressions)} | bench/results/verify/{run.name} |")
    if not LEDGER.exists():
        LEDGER.write_text("# Verify ledger\n\nOne line per run, appended by `tools/verify/gate.py`; old lines are never edited.\n\n"
                          "| time (Toronto) | sha | backend | kind | gates | IoU median | height RMSE dev / holdout m | "
                          "distance median err m | style std V | looks mean | regressions | run folder |\n"
                          "|---|---|---|---|---|---|---|---|---|---|---|---|\n")
    with open(LEDGER, "a") as f:
        f.write(line + "\n")
    print(f"{passed}/{len(gated)} gates, {len(regressions)} regressions -> {run / 'summary.json'}")
    for r in regressions:
        print(f"  REGRESSION {r['metric']}: {r['old']} -> {r['new']}")
    sys.exit(0 if not regressions else 1)


if __name__ == "__main__":
    main()
