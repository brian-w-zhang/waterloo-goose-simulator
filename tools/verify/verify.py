"""Verification entry point: python -m tools.verify.verify [fast|full]

fast: ground-truth hash, geometry validators on the packed world, static colour and banned-effect
checks, camera config; then the regression gate and the ledger line. full adds the Playwright suites
(top-down, fly-through, viewpoints, style scene), style statistics, palette check, looks validation
and the contact sheet, which need a running production server (npm run build && npm start).
"""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from pipeline.config import CAMPUS, ROOT

RESULTS = ROOT / "bench" / "results" / "verify"


def sh(*cmd, check=True):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:])
        raise SystemExit(f"failed: {' '.join(cmd)}")
    return r


def static_checks(run: Path):
    out = {}
    for script in ("check_colours.ts", "check_banned.ts"):
        r = sh("npx", "tsx", f"tools/verify/{script}")
        out.update(json.loads(r.stdout.strip().splitlines()[-1]))
    c = CAMPUS["camera"]
    cam_ok = int(20 <= c["style_vfov_deg"] <= 30 and 45 <= c["style_pitch_deg"] <= 55
                 and 20 <= c["play_vfov_deg"] <= 30 and 45 <= c["play_pitch_deg"] <= 55)
    from pipeline.validate.run import evaluate
    metrics = {"static_colour_violations": out["static_colour_violations"],
               "static_banned_violations": out["static_banned_violations"], "camera_config_ok": cam_ok}
    (run / "static.json").write_text(json.dumps({"metrics": evaluate("style", metrics),
                                                 "detail": {"colour_hits": out["hits"] if "hits" in out else []}},
                                                indent=1))


def code_checks(run: Path):
    """Typecheck and the unit and behaviour tests (TypeScript and Python) as gates."""
    import re
    from pipeline.validate.run import evaluate
    tsc = sh("npx", "tsc", "--noEmit", check=False)
    ts_errors = len(re.findall(r"error TS\d+", tsc.stdout + tsc.stderr))
    vt = sh("npx", "vitest", "run", check=False)
    m = re.search(r"Tests\s+(?:(\d+) failed)?", vt.stdout)
    failed = int(m.group(1)) if m and m.group(1) else (0 if vt.returncode == 0 else 1)
    py = sh(sys.executable, "-m", "pytest", "-q", "pipeline", check=False)
    pm = re.search(r"(\d+) failed", py.stdout)
    metrics = {"typecheck_errors": ts_errors, "unit_test_failures": failed,
               "python_test_failures": int(pm.group(1)) if pm else (0 if py.returncode == 0 else 1)}
    (run / "code.json").write_text(json.dumps({"metrics": evaluate("code", metrics)}, indent=1))


def main():
    """fast | render | full [RUN_DIR]: render makes a run folder with the browser suites only, so the
    agent can score looks.json against those exact renders; full RUN_DIR then finishes that run."""
    kind = sys.argv[1] if len(sys.argv) > 1 else "fast"
    sha = sh("git", "rev-parse", "--short", "HEAD").stdout.strip()
    # uncommitted source changes: the run tested HEAD plus a working-tree diff, so say so
    if sh("git", "status", "--porcelain", "--untracked-files=no").stdout.strip():
        sha += "+dirty"
    stamp = datetime.now(ZoneInfo("America/Toronto")).strftime("%Y%m%d-%H%M")
    reuse = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    run = reuse or RESULTS / f"{stamp}-{sha}{'-webgl' if os.environ.get('WGS_WEBGL') == '1' else ''}"
    run.mkdir(parents=True, exist_ok=True)
    if kind == "render":
        r = sh("node", "tools/verify/visual.mjs", str(run), check=False)
        print(r.stdout[-4000:], r.stderr[-2000:])
        print(f"RUN {run}")
        return
    r = sh(sys.executable, "-m", "pipeline.validate.run", str(run), check=False)
    print(r.stdout[-6000:])
    if r.returncode == 2:
        raise SystemExit("ground truth hash mismatch")
    static_checks(run)
    code_checks(run)
    backend = "none"
    if kind == "full":
        if not (reuse and (run / "viewpoints").exists()):
            r = sh("node", "tools/verify/visual.mjs", str(run), check=False)
            print(r.stdout[-4000:], r.stderr[-2000:])
        r = sh("node", "tools/playtest.mjs", str(run / "playtest"), check=False)
        print(r.stdout[-600:])
        pt = run / "playtest" / "playtest.json"
        if pt.exists():
            from pipeline.validate.run import evaluate
            p = json.loads(pt.read_text())
            (run / "play.json").write_text(json.dumps({"metrics": evaluate("play", {
                "playtest_tasks_done": len(p["tasks_done"]), "playtest_page_errors": len(p["errors"])}),
                "detail": p}, indent=1))
        info = run / "visual_info.json"
        if info.exists():
            backend = json.loads(info.read_text()).get("backend", "unknown")
        for mod in ("tools.verify.style_stats", "tools.verify.palette_check", "pipeline.validate.topdown_compare",
                    "tools.verify.validate_looks", "tools.verify.contact_sheet", "tools.verify.selftest"):
            r = sh(sys.executable, "-m", mod, str(run), check=False)
            print(r.stdout[-3000:], r.stderr[-1500:])
    r = sh(sys.executable, "-m", "tools.verify.gate", str(run), backend, kind, check=False)
    print(r.stdout)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
