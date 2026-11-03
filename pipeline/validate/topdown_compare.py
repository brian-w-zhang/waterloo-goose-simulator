"""Top-down registration (doc 08 section 2.2): rendered flat-ID chunk images vs truth rasters.

Usage: python -m pipeline.validate.topdown_compare RUN_DIR
Reads RUN_DIR/topdown/td_<i>_<j>.png (512 x 512, 0.5 m per pixel, rendered by tools/verify/visual.mjs),
rasterises City footprints, OSM ribbons and City water for the same chunk, writes RUN_DIR/topdown.json
and overlays to RUN_DIR/overlays/ (orthophoto at 60%, City outlines cyan, rendered outlines magenta).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import rasterio.features
import requests
from PIL import Image
from rasterio.transform import from_origin
from shapely import union_all
from shapely.geometry import box, shape

from ..build.ground import PATHS, ROADS, _area_polys, _width, highway_lines
from ..config import CAMPUS, RAW, ROOT
from .run import evaluate

PX = 0.5
N = 512
MIN_BUILDING_PX = 400
MIN_PATH_PX = 2000
ORTHO_CACHE = ROOT / "verify" / "cache" / "ortho"


def masks(img):
    a = np.asarray(Image.open(img).convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 200) & (g < 60) & (b < 60), (g > 200) & (r < 60) & (b < 60), (b > 200) & (r < 60) & (g < 60)


def edges(m):
    return cv2.Canny(m.astype(np.uint8) * 255, 50, 150) > 0


def ortho(e0, n1):
    """City 2026 spring orthophoto clip for QA overlays only (licence unverified; never shipped)."""
    ORTHO_CACHE.mkdir(parents=True, exist_ok=True)
    f = ORTHO_CACHE / f"o_{e0}_{n1}.jpg"
    if not f.exists():
        try:
            r = requests.get(CAMPUS["sources"]["city_ortho_export"], timeout=60,
                             headers={"User-Agent": CAMPUS["user_agent"]}, params={
                                 "bbox": f"{e0},{n1 - N * PX},{e0 + N * PX},{n1}", "bboxSR": 26917, "imageSR": 26917,
                                 "size": f"{N},{N}", "format": "jpg", "layers": "show:9", "f": "image"})
            r.raise_for_status()
            f.write_bytes(r.content)
        except requests.RequestException:
            return None
    return np.asarray(Image.open(f).convert("RGB"))


def main():
    run = Path(sys.argv[1])
    td = run / "topdown"
    ov = run / "overlays"
    ov.mkdir(exist_ok=True)
    city = [shape(f["geometry"]).buffer(0) for f in
            json.loads((RAW / "city" / "city_footprints.geojson").read_text())["features"]]
    water = [shape(f["geometry"]) for f in json.loads((RAW / "city" / "city_water.geojson").read_text())["features"]]
    creeks = [shape(f["geometry"]).buffer(2.0) for f in json.loads((RAW / "city" / "city_creeks.geojson").read_text())["features"]]
    water_all = union_all(water + creeks)
    # truth: OSM path and road ribbons at tagged or default widths, plus OSM pedestrian and footway areas
    ribbons = union_all([ln.buffer(_width(t) / 2) for _, t, ln in highway_lines(PATHS | ROADS)]
                        + _area_polys(lambda t: t.get("highway") == "pedestrian")
                        + _area_polys(lambda t: t.get("highway") == "footway" and t.get("area") == "yes")
                        + _area_polys(lambda t: t.get("area:highway") in ROADS))
    blocked = union_all(city)
    paths_truth = ribbons.difference(blocked).difference(water_all)
    C = CAMPUS["chunk"]
    rows, b_ious, p_ious, chamfers = [], [], [], []
    for f in sorted(td.glob("td_*.png")):
        i, j = map(int, f.stem.split("_")[1:])
        e0 = C["grid_origin_e"] + i * C["size_m"]
        n1 = C["grid_origin_n"] + (j + 1) * C["size_m"]
        t = from_origin(e0, n1, PX, PX)
        cb = box(e0, n1 - C["size_m"], e0 + C["size_m"], n1)
        bsel = [g for g in city if g.intersects(cb)]
        tb = rasterio.features.rasterize(bsel, out_shape=(N, N), transform=t, dtype="uint8").astype(bool) if bsel else np.zeros((N, N), bool)
        pg = paths_truth.intersection(cb)
        tp = rasterio.features.rasterize([pg], out_shape=(N, N), transform=t, dtype="uint8").astype(bool) if not pg.is_empty else np.zeros((N, N), bool)
        rb, rp, rw = masks(f)
        row = {"chunk": f"{i}_{j}"}
        if tb.sum() >= MIN_BUILDING_PX:
            iou = (tb & rb).sum() / max((tb | rb).sum(), 1)
            b_ious.append(iou)
            row["building_iou"] = round(float(iou), 4)
            et = edges(tb)
            dt = cv2.distanceTransform((~et).astype(np.uint8), cv2.DIST_L2, 3) * PX
            er = edges(rb)
            d = dt[er]
            if d.size:
                chamfers.append(d)
                row["chamfer_mean_m"] = round(float(d.mean()), 3)
        if tp.sum() >= MIN_PATH_PX:
            piou = (tp & rp).sum() / max((tp | rp).sum(), 1)
            p_ious.append(piou)
            row["path_iou"] = round(float(piou), 4)
        rows.append(row)
        base = ortho(e0, n1)
        canvas = (base * 0.6 + 255 * 0.4).astype(np.uint8) if base is not None else np.full((N, N, 3), 235, np.uint8)
        canvas[edges(tb)] = (0, 200, 220)
        canvas[edges(rb)] = (220, 0, 200)
        Image.fromarray(canvas).save(ov / f"overlay_{i}_{j}.png")
    allc = np.concatenate(chamfers) if chamfers else np.array([np.nan])
    metrics = {"topdown_building_iou_min": float(min(b_ious)) if b_ious else None,
               "topdown_chamfer_mean_m": float(np.nanmean(allc)),
               "topdown_chamfer_p95_m": float(np.nanpercentile(allc, 95)),
               "topdown_path_iou_min": float(min(p_ious)) if p_ious else None}
    worst = sorted((r for r in rows if "building_iou" in r), key=lambda r: r["building_iou"])[:5]
    (run / "topdown.json").write_text(json.dumps({"metrics": evaluate("topdown", metrics),
                                                  "detail": {"chunks": rows, "worst_building": worst,
                                                             "path_iou_median": float(np.median(p_ious)) if p_ious else None}},
                                                 indent=1))
    print(json.dumps(metrics))


if __name__ == "__main__":
    main()
