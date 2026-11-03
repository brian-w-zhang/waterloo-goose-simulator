"""Palette lock (doc 08 section 3.2) on a run folder: python -m tools.verify.palette_check RUN_DIR

- Palette-ID pass: the debug "palette" renders show each material's base colour unlit. Every pixel
  whose 3 x 3 neighbourhood is uniform (anti-aliased edge pixels blend two swatches by design) must be
  within Delta E 1976 of 1.0 of a swatch in config/palette.json.
- Lit frame: at least 95% of the game-camera pixels must be within Delta E 12 of the expanded palette
  (each swatch times lighting factors 0.45 to 1.30, times fog blends 0, 0.25, 0.5, 0.75 toward the sky).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

from pipeline.config import PALETTE

GROUPS = ("world", "goose", "light")


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def to_lab(rgb):
    a = srgb_to_lin(rgb)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = a @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def swatches():
    hexes = [h for g in GROUPS for h in PALETTE[g].values()]
    return np.array([[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] for h in hexes])


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64) / 255


def palette_id(images, sw):
    tree = cKDTree(to_lab(sw))
    off = tot = 0
    worst = []
    for p in images:
        a = load(p)
        q = (a * 255).round().astype(np.int32)
        key = (q[..., 0] << 16) | (q[..., 1] << 8) | q[..., 2]
        uniform = np.ones(key.shape, bool)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                uniform &= np.roll(np.roll(key, dy, 0), dx, 1) == key
        uniform[[0, -1], :] = False
        uniform[:, [0, -1]] = False
        lab = to_lab(a[uniform])
        d, _ = tree.query(lab)
        off += int((d > 1.0).sum())
        tot += int(uniform.sum())
        if (d > 1.0).any():
            worst.append((p.name, round(float((d > 1.0).mean()), 4)))
    return off / max(tot, 1), worst


def lit_share(images, sw):
    sky = sw[[i for i, h in enumerate(h for g in GROUPS for h in PALETTE[g].values())
              if h == PALETTE["world"]["sky"]][0]]
    lin = srgb_to_lin(sw)
    sky_lin = srgb_to_lin(sky)
    exp = []
    for f in np.arange(0.45, 1.31, 0.05):
        for fog in (0.0, 0.25, 0.5, 0.75):
            exp.append(lin_to_srgb(lin * f * (1 - fog) + sky_lin * fog))
    tree = cKDTree(to_lab(np.concatenate(exp)))
    shares = {}
    for p in images:
        lab = to_lab(load(p)[::2, ::2].reshape(-1, 3))
        d, _ = tree.query(lab)
        shares[p.name] = float((d <= 12).mean())
    return float(np.mean(list(shares.values()))) if shares else None, shares


def main():
    run = Path(sys.argv[1])
    from pipeline.validate.run import evaluate
    sw = swatches()
    vp = run / "viewpoints"
    pid, worst = palette_id(sorted(vp.glob("palette_*.png")), sw)
    lit, per = lit_share(sorted(vp.glob("game_*.png")), sw)
    metrics = {"palette_id_off_share": pid, "lit_palette_share": lit}
    (run / "palette.json").write_text(json.dumps({"metrics": evaluate("style", metrics),
                                                  "detail": {"palette_id_worst": worst[:10], "lit_per_image": per}}, indent=1))
    print(json.dumps(metrics))


if __name__ == "__main__":
    main()
