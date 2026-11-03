"""Style gates (doc 08 section 3.1 and 3.3) on a run folder: python -m tools.verify.style_stats RUN_DIR

Frame statistics come from the frozen verify/ground-truth/style_stats.py (imported, not copied, so
the measurement is identical to the one that produced the reference values). Gate: the mean of the
game-camera renders inside the band, and no single frame outside the band widened by 50% each side.
Also measures the style test scene: shadowed / lit ground luminance and penumbra width.
"""
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from pipeline.config import ROOT

spec = importlib.util.spec_from_file_location("frozen_style_stats", ROOT / "verify" / "ground-truth" / "style_stats.py")
frozen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frozen)

KEYS = {"sat_mean": "mean_s", "val_mean": "mean_v", "val_std": "std_v", "dark_share": "dark_frac_v_lt_0p12",
        "edge_share": "edge_frac_g_gt_0p2", "colourfulness": "colourfulness", "kmeans12_residual_de": "kmeans12_mean_dE"}
THRESHOLDS = json.loads((ROOT / "verify" / "thresholds.json").read_text())["style"]


def widened(spec_):
    g = spec_["gate"]
    if spec_["op"] == "between":
        w = (g[1] - g[0]) * 0.5
        return lambda v: g[0] - w <= v <= g[1] + w
    return lambda v: v <= g * 1.5


def frame_stats(images):
    per = {p.name: {k: float(v) for k, v in frozen.stats(str(p)).items()} for p in images}
    metrics, outliers = {}, {}
    for name, key in KEYS.items():
        vals = [s[key] for s in per.values()]
        metrics[name] = float(np.mean(vals))
        ok = widened(THRESHOLDS[name])
        outliers[name] = [n for n, s in per.items() if not ok(s[key])]
    return metrics, outliers, per


def shadow_metrics(run):
    a = np.asarray(Image.open(run / "style_scene_shadow.png").convert("L")).astype(float)
    b = np.asarray(Image.open(run / "style_scene_noshadow.png").convert("L")).astype(float)
    ratio = np.where(b > 5, a / np.maximum(b, 1), 1.0)
    shadow = ratio < 0.99
    if shadow.sum() < 50:
        return {"shadow_ratio": None, "penumbra_px": None}, {"note": "no shadow found in the style scene"}
    core = ndimage.binary_erosion(shadow, iterations=6)
    r_min = float(np.median(ratio[core])) if core.any() else float(ratio[shadow].min())
    depth = (1 - ratio) / max(1 - r_min, 1e-6)
    transition = (depth > 0.1) & (depth < 0.9)
    edge_len = max(int((shadow & ~ndimage.binary_erosion(shadow)).sum()), 1)
    return {"shadow_ratio": r_min, "penumbra_px": float(transition.sum() / edge_len)}, {"shadow_px": int(shadow.sum())}


def main():
    run = Path(sys.argv[1])
    from pipeline.validate.run import evaluate
    games = sorted((run / "viewpoints").glob("game_*.png"))
    metrics, detail = {}, {}
    if games:
        m, outliers, per = frame_stats(games)
        metrics.update(m)
        detail["outliers_widened_band"] = outliers
        detail["per_image"] = per
        detail["any_frame_outside_widened_band"] = {k: bool(v) for k, v in outliers.items()}
    if (run / "style_scene_shadow.png").exists():
        sm, sd = shadow_metrics(run)
        metrics.update(sm)
        detail["shadow"] = sd
    res = evaluate("style", metrics)
    for name, bad in detail.get("outliers_widened_band", {}).items():
        if bad and res.get(name):
            res[name]["pass"] = False
    (run / "style.json").write_text(json.dumps({"metrics": res, "detail": detail}, indent=1))
    print(json.dumps({k: round(v, 4) if isinstance(v, float) else v for k, v in metrics.items()}))


if __name__ == "__main__":
    main()
