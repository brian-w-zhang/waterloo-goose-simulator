"""City of Waterloo orthophotos over the reference boundary: python -m tools.refs.ortho [layer ...]

Exports 150 m tiles from gis.waterloo.ca Public_Imagery_Archive (EPSG:26917) at native resolution into
docs/refs/ortho/private/<year>/<e>_<n>.jpg (git-ignored), skipping tiles outside the boundary or
already saved. Layers: 44 = 2026 spring 10 cm (leaf-off: paths, curbs, paving), 43 = 2025 summer
10 cm (leaf-on: crowns, lawns), 8 = 2023 August 7 cm (sharpest). Then crops() cuts a top-down image
for every catalogue item into its folder (private/ortho_<year>.jpg).
"""
import json
import sys
import time
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image
from shapely.geometry import Polygon, box

from tools.refs.catalog import BOUNDARY_UTM

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "refs" / "ortho" / "private"
SVC = "https://gis.waterloo.ca/maps/rest/services/Public/Public_Imagery_Archive/MapServer/export"
LAYERS = {44: ("2026spring", 0.10), 43: ("2025summer", 0.10), 8: ("2023aug", 0.07)}
TILE = 150


def fetch(layer):
    name, res = LAYERS[layer]
    d = OUT / name
    d.mkdir(parents=True, exist_ok=True)
    B = Polygon(BOUNDARY_UTM)
    x0, y0, x1, y1 = B.bounds
    px = round(TILE / res)
    n = 0
    for e in range(int(x0 // TILE * TILE), int(x1) + 1, TILE):
        for nn in range(int(y0 // TILE * TILE), int(y1) + 1, TILE):
            if not box(e, nn, e + TILE, nn + TILE).intersects(B):
                continue
            f = d / f"{e}_{nn}.jpg"
            if f.exists():
                continue
            url = (f"{SVC}?bbox={e},{nn},{e + TILE},{nn + TILE}&bboxSR=26917&imageSR=26917&size={px},{px}"
                   f"&format=jpg&layers=show:{layer}&f=image")
            for attempt in range(3):
                try:
                    data = urllib.request.urlopen(url, timeout=60).read()
                    Image.open(BytesIO(data)).verify()
                    f.write_bytes(data)
                    n += 1
                    break
                except Exception as ex:
                    print("retry", f.name, ex)
                    time.sleep(3)
    print(name, "tiles fetched", n)


def mosaic_crop(name, x0, y0, x1, y1, out, max_px=2400):
    """Cut [x0, x1] x [y0, y1] (UTM) from the saved tiles of one year."""
    res = {v[0]: v[1] for v in LAYERS.values()}[name]
    W, H = round((x1 - x0) / res), round((y1 - y0) / res)
    canvas = Image.new("RGB", (W, H), "white")
    for e in range(int(x0 // TILE * TILE), int(x1) + 1, TILE):
        for nn in range(int(y0 // TILE * TILE), int(y1) + 1, TILE):
            f = OUT / name / f"{e}_{nn}.jpg"
            if not f.exists():
                continue
            t = Image.open(f)
            canvas.paste(t, (round((e - x0) / res), round((y1 - (nn + TILE)) / res)))
    if max(W, H) > max_px:
        s = max_px / max(W, H)
        canvas = canvas.resize((round(W * s), round(H * s)))
    canvas.save(out, quality=88)


def crops():
    cat = json.loads((ROOT / "docs" / "refs" / "catalog.json").read_text())
    for it in cat["items"]:
        if it["kind"] == "building":
            x0, y0, x1, y1 = it["bbox_utm"]
            m = 15
            win = (x0 - m, y0 - m, x1 + m, y1 + m)
        elif it["kind"] == "zone":
            e, n = it["sw_utm"]
            win = (e - 10, n - 10, e + 110, n + 110)
        else:
            continue
        for name in ("2026spring", "2025summer", "2023aug"):
            out = ROOT / it["dir"] / "private" / f"ortho_{name}.jpg"
            if not out.exists() and (OUT / name).exists():
                mosaic_crop(name, *win, out)
    print("crops done")


if __name__ == "__main__":
    args = [int(a) for a in sys.argv[1:] if a.isdigit()]
    for layer in args or list(LAYERS):
        fetch(layer)
    if "--no-crops" not in sys.argv:
        crops()
