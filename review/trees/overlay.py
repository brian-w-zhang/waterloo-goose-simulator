"""Crowns over the orthophoto for a few areas: .venv/bin/python -m review.trees.overlay [--rebuild]

Runs pipeline.build.vegetation.build (cached in data/build/trees_review.npy), then for each area draws the
2023 August 7 cm ortho with every tree's crown (ellipse, kind colour) and apex, plus the lidar segment
edges, into review/trees/overlay_<area>.jpg. Old trees (the previous build's tree_xyz) can be drawn
with --old for comparison.
"""
import pickle
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from pipeline.build import lidar, vegetation  # noqa: E402
from pipeline.config import BUILD  # noqa: E402

ORTHO = ROOT / "docs" / "refs" / "ortho" / "private"
OUT = Path(__file__).resolve().parent
# name: (e0, n0) south-west corner of a 120 m window
AREAS = {
    "mc_dc_green": (536900, 4813300),
    "alumni_lane": (536600, 4813250),
    "ring_rd_south": (536900, 4812900),
    "laurel_creek": (536500, 4813500),
    "columbia_woods": (536250, 4813700),
    "westmount": (535900, 4813000),
    "central_lawn": (536730, 4813420),
}
COLOURS = {"maple": (255, 80, 60), "oak": (255, 160, 0), "locust": (255, 255, 0), "linden": (0, 255, 160),
           "spruce": (0, 120, 255), "pine": (160, 80, 255), "cedar": (0, 230, 255), "willow": (255, 0, 255),
           "ornamental": (255, 150, 200), "shrub": (255, 255, 255)}


def ortho(year, e0, n0, size, res):
    tres = {"2023aug": 0.07, "2025summer": 0.10, "2026spring": 0.10}[year]
    W = round(size / res)
    canvas = Image.new("RGB", (W, W), "black")
    for e in range(int(e0 // 150 * 150), int(e0 + size) + 1, 150):
        for n in range(int(n0 // 150 * 150), int(n0 + size) + 1, 150):
            f = ORTHO / year / f"{e}_{n}.jpg"
            if not f.exists():
                continue
            t = Image.open(f)
            k = tres / res
            t = t.resize((round(t.width * k), round(t.height * k)))
            canvas.paste(t, (round((e - e0) / res), round((n0 + size - (n + 150)) / res)))
    return canvas


def trees(rebuild=False):
    cache = BUILD / "trees_review.npy"
    if cache.exists() and not rebuild:
        return np.load(cache)
    from pipeline.build import buildings as bmod, terrain
    bl = bmod.build()
    lk = terrain.lakes()
    t = vegetation.build(bl, lk)
    np.save(cache, t)
    return t


def draw(name, e0, n0, t, size=120, res=0.1, year="2025summer"):
    im = ortho(year, e0, n0, size, res)
    d = ImageDraw.Draw(im)
    sel = (t[:, 0] > e0 - 10) & (t[:, 0] < e0 + size + 10) & (t[:, 1] > n0 - 10) & (t[:, 1] < n0 + size + 10)
    for e, n, h, k, r, base, ratio, th in t[sel]:
        x, y = (e - e0) / res, (n0 + size - n) / res
        col = COLOURS[vegetation.KINDS[int(k)]]
        a, b = r * np.sqrt(ratio) / res, r / np.sqrt(ratio) / res
        pts = [(x + a * np.cos(s) * np.cos(th) - b * np.sin(s) * np.sin(th),
                y - (a * np.cos(s) * np.sin(th) + b * np.sin(s) * np.cos(th))) for s in np.linspace(0, 2 * np.pi, 25)]
        d.line(pts, fill=col, width=2)
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=col)
    n_in = int(((t[:, 0] >= e0) & (t[:, 0] < e0 + size) & (t[:, 1] >= n0) & (t[:, 1] < n0 + size)).sum())
    rr = t[(t[:, 0] >= e0) & (t[:, 0] < e0 + size) & (t[:, 1] >= n0) & (t[:, 1] < n0 + size), 4]
    d.rectangle((0, 0, 560, 26), fill=(0, 0, 0))
    d.text((6, 6), f"{name} {year}  trees {n_in}  mean crown r {rr.mean() if len(rr) else 0:.2f} m  ({e0},{n0}) {size} m", fill=(255, 255, 255))
    y = 30
    for k, c in COLOURS.items():
        d.rectangle((6, y, 18, y + 10), fill=c)
        d.text((22, y), k, fill=(255, 255, 255))
        y += 13
    im.save(OUT / f"overlay_{name}.jpg", quality=85)
    return n_in


if __name__ == "__main__":
    t = trees("--rebuild" in sys.argv)
    print("trees", len(t), "mean r", t[:, 4].mean(), "kinds", {k: int((t[:, 3] == i).sum()) for i, k in enumerate(vegetation.KINDS)})
    names = [a for a in sys.argv[1:] if a in AREAS] or list(AREAS)
    for a in names:
        print(a, draw(a, *AREAS[a], t))
