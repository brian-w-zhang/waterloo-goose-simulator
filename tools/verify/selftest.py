"""Test the tests (doc 08 section 4.4 rule 6): python -m tools.verify.selftest [RUN_DIR]

Builds mutants of the packed world (and of the source tree for the static checks) in a temp folder,
runs the matching validator and asserts that the named gate fails. A mutant that passes means the
check is broken. Writes RUN_DIR/selftest.json when a run folder is given; exits 1 on any surviving mutant.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

from pipeline.chunkio import read_chunk, write_chunk
from pipeline.config import ROOT, WORLD
from pipeline.coords import ORIGIN_E, ORIGIN_N
from pipeline.validate import geometry, heights, terrain
from pipeline.validate.run import evaluate
from pipeline.validate.world import World

DC_OBJECTID = 21642


def mutate(dst: Path, fn, drop=None):
    dst.mkdir(parents=True)
    index = json.loads((WORLD / "index.json").read_text())
    for name in ("network.json", "far.wgc"):
        shutil.copy(WORLD / name, dst / name)
    keep = []
    for c in index["chunks"]:
        if drop and drop(c):
            continue
        h, a = read_chunk(WORLD / c["file"])
        a = {k: np.array(v) for k, v in a.items()}
        h = json.loads(json.dumps(h))
        del h["arrays"]
        fn(h, a)
        write_chunk(dst / c["file"], h, a)
        keep.append(c)
    index["chunks"] = keep
    (dst / "index.json").write_text(json.dumps(index))
    return World.load(dst)


def map_rings(h, a, f):
    """Apply f(E, N) -> (E, N) to every building ring vertex of a chunk."""
    if "ring_xz" not in a:
        return
    e0, n1 = h["chunk"]["e0"], h["chunk"]["n1"]
    v = a["ring_xz"].reshape(-1, 2).astype(np.float64)
    E, N = f(e0 + v[:, 0], n1 - v[:, 1])
    a["ring_xz"] = np.c_[E - e0, n1 - N].astype(np.float32).ravel()


def building_rings(h, a, oid, f):
    if "ring_xz" not in a:
        return
    counts = a["ring_count"].astype(int)
    starts = np.r_[0, np.cumsum(counts)]
    v = a["ring_xz"].reshape(-1, 2)
    for b in h["buildings"]:
        if b["objectid"] != oid:
            continue
        for grp in [b["footprint"]] + b["parts"]:
            for k in range(grp["ring_first"], grp["ring_first"] + grp["ring_n"]):
                v[starts[k]:starts[k + 1]] = f(v[starts[k]:starts[k + 1]])
    a["ring_xz"] = v.ravel()


def scale(h, a):
    map_rings(h, a, lambda E, N: (ORIGIN_E + 1.01 * (E - ORIGIN_E), ORIGIN_N + 1.01 * (N - ORIGIN_N)))


def mirror(h, a):
    map_rings(h, a, lambda E, N: (2 * ORIGIN_E - E, N))
    # mirrored rings change winding; keep them valid polygons by reversing each ring
    counts = a["ring_count"].astype(int) if "ring_count" in a else []
    if len(counts):
        starts = np.r_[0, np.cumsum(counts)]
        v = a["ring_xz"].reshape(-1, 2)
        for k in range(len(counts)):
            v[starts[k]:starts[k + 1]] = v[starts[k]:starts[k + 1]][::-1]
        a["ring_xz"] = v.ravel()


def move_dc(h, a):
    building_rings(h, a, DC_OBJECTID, lambda v: v + np.array([3.0, 0.0], dtype=v.dtype))


def taller(h, a):
    for b in h["buildings"]:
        for p in b["parts"]:
            if p["h"] is not None:
                p["h"] += 3.0


def step_edge(h, a):
    if h["chunk"]["i"] == 4 and h["chunk"]["j"] == 3:
        t = h["terrain"]
        q = a["terrain_h"].reshape(t["n"], t["n"]).astype(np.int64)
        q[:, -1] = np.clip(q[:, -1] + int(round(0.4 / t["hscale"])), 0, 65535)
        a["terrain_h"] = q.astype(np.uint16).ravel()


def static_mutant(tmp: Path, snippet: str, script: str, key: str):
    src = tmp / "repo"
    shutil.copytree(ROOT / "src", src / "src")
    shutil.copytree(ROOT / "app", src / "app")
    (src / "src" / "mutant.ts").write_text(snippet)
    r = subprocess.run(["npx", "tsx", str(ROOT / "tools" / "verify" / script)], cwd=src, capture_output=True, text=True)
    return json.loads(r.stdout.strip().splitlines()[-1])[key]


def main():
    run = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    results = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        cases = [
            ("scale_1.01", scale, None, geometry, "distance_fail_count", "geometry"),
            ("mirror_x", mirror, None, geometry, "azimuth_max_err_deg", "geometry"),
            ("dc_moved_3m", move_dc, None, geometry, "landmark_pos_max_m", "geometry"),
            ("heights_plus_3m", taller, None, heights, "height_rmse_dev_m", "heights"),
            ("chunk_dropped", lambda h, a: None, lambda c: c["i"] == 6 and c["j"] == 3, geometry, "coverage_uw_core", "geometry"),
            ("terrain_step_0.4m", step_edge, None, terrain, "seam_max_m", "terrain"),
        ]
        for name, fn, drop, mod, metric, group in cases:
            w = mutate(tmp / name, fn, drop)
            m, _ = mod.run(w)
            res = evaluate(group, {metric: m[metric]})[metric]
            results.append({"mutant": name, "metric": metric, "value": m[metric], "gate_failed": res["pass"] is False})
            print(f"{'ok  ' if res['pass'] is False else 'MISS'} {name}: {metric} = {m[metric]}")
        for name, snippet, script, key in (
                ("off_palette_colour", 'export const c = "#123456";\n', "check_colours.ts", "static_colour_violations"),
                ("bloom_enabled", 'import { bloom } from "three/addons/tsl/display/BloomNode.js";\nexport const b = bloom;\n',
                 "check_banned.ts", "static_banned_violations")):
            v = static_mutant(tmp / name, snippet, script, key)
            results.append({"mutant": name, "metric": key, "value": v, "gate_failed": v > 0})
            print(f"{'ok  ' if v > 0 else 'MISS'} {name}: {key} = {v}")
        # a type error in the real tree (temporary file, always removed) must turn the typecheck gate red
        bad = ROOT / "src" / "__selftest_mutant.ts"
        try:
            bad.write_text('export const mutant: number = "not a number";\n')
            r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=ROOT, capture_output=True, text=True)
            n = r.stdout.count("error TS")
        finally:
            bad.unlink(missing_ok=True)
        results.append({"mutant": "type_error", "metric": "typecheck_errors", "value": n, "gate_failed": n > 0})
        print(f"{'ok  ' if n > 0 else 'MISS'} type_error: typecheck_errors = {n}")
    survived = [r["mutant"] for r in results if not r["gate_failed"]]
    if run:
        (run / "selftest.json").write_text(json.dumps({"metrics": {"selftest_survivors": {
            "value": len(survived), "gate": 0, "op": "<=", "pass": not survived, "report_only": False}},
            "detail": {"mutants": results}}, indent=1, default=float))
    print(f"{len(results) - len(survived)}/{len(results)} mutants caught")
    sys.exit(1 if survived else 0)


if __name__ == "__main__":
    main()
