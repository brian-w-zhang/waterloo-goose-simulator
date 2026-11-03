"""One study sheet per building: python -m tools.art.study ABBREV [--profile]

review/art/<abbrev>_study.jpg: banded lidar heights (1.5 m bands, metres above ground) with a 10 m
grid in art coordinates, the 2023 7 cm orthophoto of the same window, and four Google Earth orbit
views. --profile also prints height cross-sections along and across the footprint's long axis.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import Polygon

from pipeline.build import lidar
from pipeline.coords import ORIGIN_E, ORIGIN_N

ROOT = Path(__file__).resolve().parents[2]
PAL = np.array([[40, 40, 60], [60, 60, 140], [50, 110, 200], [40, 170, 220], [60, 200, 160], [120, 220, 90],
                [200, 230, 60], [250, 200, 40], [250, 140, 30], [240, 80, 30], [220, 30, 40], [180, 20, 90],
                [140, 20, 140], [200, 200, 230], [255, 255, 255], [255, 220, 255], [255, 180, 255], [255, 140, 255]], np.uint8)


def ndsm(e0, n0, e1, n1):
    dsm = np.load(ROOT / "data/build/dsm_0p5.npy", mmap_mode="r")
    dtm = np.load(ROOT / "data/build/dtm_0p5.npy", mmap_mode="r")
    c0, c1 = int((e0 - lidar.E0) / 0.5), int((e1 - lidar.E0) / 0.5)
    r0, r1 = int((lidar.N1 - n1) / 0.5), int((lidar.N1 - n0) / 0.5)
    return np.clip(np.array(dsm[r0:r1, c0:c1]) - np.array(dtm[r0:r1, c0:c1]), 0, 26.9)


def main(ab, profile=False):
    cat = json.loads((ROOT / "docs/refs/catalog.json").read_text())
    items = [it for it in cat["items"] if it["kind"] == "building" and it["label"] == ab]
    it = max(items, key=lambda i: i["area_m2"])
    xs = [v for i in items for v in (i["bbox_utm"][0], i["bbox_utm"][2])]
    ys = [v for i in items for v in (i["bbox_utm"][1], i["bbox_utm"][3])]
    m = 15
    e0, e1, n0, n1 = min(xs) - m, max(xs) + m, min(ys) - m, max(ys) + m
    h = ndsm(e0, n0, e1, n1)
    S = 3
    img = Image.fromarray(PAL[np.clip((h / 1.5).astype(int), 0, len(PAL) - 1)]).resize((h.shape[1] * S, h.shape[0] * S), Image.NEAREST)
    d = ImageDraw.Draw(img)
    px = lambda x, y: ((x - e0) * 2 * S, (n1 - y) * 2 * S)
    for x in range(int(e0 // 10 * 10), int(e1) + 1, 10):
        d.line([px(x, n0), px(x, n1)], fill=(255, 255, 255) if x % 50 == 0 else (90, 90, 90), width=1)
        if x % 50 == 0:
            d.text((px(x, n1)[0] + 2, 2), f"x{x - ORIGIN_E:.0f}", fill="white")
    for y in range(int(n0 // 10 * 10), int(n1) + 1, 10):
        d.line([px(e0, y), px(e1, y)], fill=(255, 255, 255) if y % 50 == 0 else (90, 90, 90), width=1)
        if y % 50 == 0:
            d.text((2, px(e0, y)[1] + 2), f"y{y - ORIGIN_N:.0f}", fill="white")
    for k in range(len(PAL)):
        d.rectangle([img.width - 90, 4 + k * 13, img.width - 76, 14 + k * 13], fill=tuple(int(v) for v in PAL[k]))
        d.text((img.width - 72, 3 + k * 13), f"{k * 1.5:.1f}m", fill="white")
    ortho = Image.open(ROOT / it["dir"] / "private" / "ortho_2023aug.jpg") if (ROOT / it["dir"] / "private" / "ortho_2023aug.jpg").exists() else None
    H = 900
    tiles = [img.resize((round(img.width * H / img.height), H))]
    if ortho:
        tiles.append(ortho.resize((round(ortho.width * H / ortho.height), H)))
    row1 = Image.new("RGB", (sum(t.width for t in tiles), H), "white")
    x = 0
    for t in tiles:
        row1.paste(t, (x, 0))
        x += t.width
    earth = [ROOT / it["dir"] / "private" / f"earth_orbit_{a:03d}.jpg" for a in (0, 90, 180, 270)]
    earth = [Image.open(f).resize((800, 400)) for f in earth if f.exists()]
    row2 = Image.new("RGB", (1600, 800), "white")
    for k, e in enumerate(earth):
        row2.paste(e, ((k % 2) * 800, (k // 2) * 400))
    W = max(row1.width, row2.width)
    out = Image.new("RGB", (W, row1.height + row2.height), "white")
    out.paste(row1, (0, 0))
    out.paste(row2, (0, row1.height))
    p = ROOT / "review/art" / f"{ab.lower().replace(' ', '_')}_study.jpg"
    p.parent.mkdir(parents=True, exist_ok=True)
    out.save(p, quality=82)
    print(p, "window x", round(e0 - ORIGIN_E), round(e1 - ORIGIN_E), "y", round(n0 - ORIGIN_N), round(n1 - ORIGIN_N))
    if profile:
        blds = json.loads((ROOT / "data/build/art/buildings.json").read_text())
        fp = max((Polygon(b["footprint"]["outer"]) for b in blds.values() if (b["abbrev"] or "").strip() == ab), key=lambda g: g.area)
        r = fp.minimum_rotated_rectangle
        c = list(r.exterior.coords)
        a, b2 = np.array(c[1]) - np.array(c[0]), np.array(c[2]) - np.array(c[1])
        u, v = (a, b2) if np.linalg.norm(a) > np.linalg.norm(b2) else (b2, a)
        L, Wd = np.linalg.norm(u), np.linalg.norm(v)
        u, v = u / L, v / Wd
        cen = np.array(r.centroid.coords[0]) + np.array([ORIGIN_E, ORIGIN_N])
        print("axis u", u.round(4), "length", round(L, 1), "width", round(Wd, 1), "centre (art)", (cen - [ORIGIN_E, ORIGIN_N]).round(1))
        full = ndsm(e0, n0, e1, n1)
        def H_(p):
            cc, rr = int((p[0] - e0) * 2), int((n1 - p[1]) * 2)
            return full[rr, cc] if 0 <= rr < full.shape[0] and 0 <= cc < full.shape[1] else 0
        for t in np.linspace(-Wd / 2 + 2, Wd / 2 - 2, 5):
            print(f"along t={t:6.1f}", " ".join(f"{H_(cen + u * s + v * t):4.1f}" for s in np.arange(-L / 2, L / 2, 2.0)))
        for s in np.linspace(-L / 2 + 3, L / 2 - 3, 5):
            print(f"across s={s:6.1f}", " ".join(f"{H_(cen + u * s + v * t):4.1f}" for t in np.arange(-Wd / 2 - 4, Wd / 2 + 4, 1.0)))


if __name__ == "__main__":
    main(sys.argv[1], "--profile" in sys.argv)
