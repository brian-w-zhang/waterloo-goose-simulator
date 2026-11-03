"""Building heights on the packed world vs lidar (doc 08 section 2.1): key buildings, seeded
random 20, and per-pixel heights over footprint pixels."""
import numpy as np
import rasterio.features

from ..build import lidar
from ..config import CAMPUS
from .geometry import UW, core_box
from .truth import load

ERODE = CAMPUS["buildings"]["height_erode_m"]
PCT = CAMPUS["buildings"]["height_percentile"]


def _window(poly, pad=3.0):
    minx, miny, maxx, maxy = poly.bounds
    r0, c0 = lidar.rc_of(minx - pad, maxy + pad)
    r1, c1 = lidar.rc_of(maxx + pad, miny - pad)
    r0, c0 = max(int(np.floor(r0)), 0), max(int(np.floor(c0)), 0)
    r1, c1 = int(np.ceil(r1)) + 1, int(np.ceil(c1)) + 1
    return (slice(r0, r1), slice(c0, c1)), lidar.transform() * rasterio.Affine.translation(c0, r0)


def packed_raster(b, sl, t, shape_):
    """Height above the building's ground for every 0.5 m pixel covered by its packed parts."""
    shapes = [(p, h) for p, h in b.parts if h is not None and not p.is_empty]
    r = rasterio.features.rasterize(shapes, out_shape=shape_, transform=t, fill=np.nan, dtype="float32")
    if b.roofs:
        # vaulted roofs are part of the rendered surface: raise pixels under each vault to its profile
        from ..build.buildings import round_roof
        rows, cols = np.indices(shape_)
        xs, ys = rasterio.transform.xy(t, rows.ravel(), cols.ravel())
        xs, ys = np.asarray(xs), np.asarray(ys)
        for z in b.roofs:
            du = (xs - z["cx"]) * z["ux"] + (ys - z["cy"]) * z["uy"]
            dv = -(xs - z["cx"]) * z["uy"] + (ys - z["cy"]) * z["ux"]
            inside = (np.abs(du) <= z["hu"]) & (np.abs(dv) <= z["hv"])
            vh = np.where(inside, round_roof((xs, ys), z), np.nan).reshape(shape_)
            r = np.where(np.isfinite(vh) & (~np.isfinite(r) | (vh > r)), vh, r)
    return r.astype("float32")


def eroded_mask(poly, shape_, t):
    er = poly.buffer(-ERODE)
    g = er if (not er.is_empty and er.area > 4) else poly
    return rasterio.features.geometry_mask([g], out_shape=shape_, transform=t, invert=True)


def packed_p90(b, nd_shape_window):
    sl, t = nd_shape_window
    shape_ = (sl[0].stop - sl[0].start, sl[1].stop - sl[1].start)
    r = packed_raster(b, sl, t, shape_)
    m = eroded_mask(b.footprint, shape_, t)
    v = r[m & np.isfinite(r)]
    return float(np.percentile(v, PCT)) if v.size else float("nan")


def run(world):
    gt = load()
    nd = lidar.ndsm()
    m, detail = {}, {}
    by_oid = {}
    for b in world.buildings:
        by_oid.setdefault(b.objectid, []).append(b)
    errs = {"dev": [], "holdout": []}
    rows = []
    for t in gt["buildings"]:
        hl = t.get("height_lidar")
        if not hl:
            continue
        bs = by_oid.get(hl["source_objectid"])
        if not bs:
            rows.append({"id": t["id"], "missing": True})
            continue
        b = bs[0]
        sl, tr = _window(b.footprint)
        hp = packed_p90(b, (sl, tr))
        e = hp - hl["p90_m"]
        errs[t["split"]].append(e)
        rows.append({"id": t["id"], "split": t["split"], "packed_p90": round(hp, 2), "truth": hl["p90_m"], "err": round(e, 2)})
    alle = errs["dev"] + errs["holdout"]
    m["height_key_max_err_m"] = float(np.max(np.abs(alle)))
    m["height_rmse_dev_m"] = float(np.sqrt(np.mean(np.square(errs["dev"]))))
    m["height_rmse_holdout_m"] = float(np.sqrt(np.mean(np.square(errs["holdout"]))))
    detail["key"] = rows

    # seeded random 20 pre-2018 UW footprints; truth recomputed from the source lidar
    core = core_box()
    pool = sorted((b for b in world.buildings if b.owner == UW and not b.post2018
                   and b.footprint.area > 100 and b.footprint.intersects(core)), key=lambda b: (b.objectid, b.id))
    rng = np.random.default_rng(CAMPUS["seeds"]["height_holdout"])
    pick = [pool[i] for i in rng.choice(len(pool), size=min(CAMPUS["height_holdout_n"], len(pool)), replace=False)]
    re = []
    for b in pick:
        sl, tr = _window(b.footprint)
        win = nd[sl]
        mk = eroded_mask(b.footprint, win.shape, tr)
        truth = float(np.percentile(win[mk], PCT))
        re.append(packed_p90(b, (sl, tr)) - truth)
    m["height_random20_rmse_m"] = float(np.sqrt(np.mean(np.square(re))))

    # per pixel over all pre-2018 footprints in the core bbox
    pix = []
    for b in world.buildings:
        if b.post2018 or not b.footprint.intersects(core):
            continue
        sl, tr = _window(b.footprint)
        win = nd[sl]
        r = packed_raster(b, sl, tr, win.shape)
        mk = eroded_mask(b.footprint, win.shape, tr) & np.isfinite(r)
        pix.append(np.abs(r[mk] - win[mk]))
    pix = np.concatenate(pix)
    m["height_pixel_median_abs_m"] = float(np.median(pix))
    detail["pixel"] = {"n": int(pix.size), "p90_abs_m": round(float(np.percentile(pix, 90)), 2)}
    return m, detail
