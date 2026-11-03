"""Terrain heightfield on the 2 m grid: DTM resampled and lakes burned in.

Footprints are not flattened (that moved the ground outside them); walls reach down to the
lowest ground under each footprint instead (buildings.base)."""
import json

import numpy as np
import rasterio.features
from shapely.geometry import shape

from ..config import CAMPUS, RAW
from . import lidar

CELL = CAMPUS["terrain"]["cell_m"]
STEP = int(round(CELL / lidar.RES))           # 0.5 m pixels per terrain cell
LAKE_BANK_M = 0.8                              # lake bed sits this far below the water surface
LAKE_BED_INSET_M = 3.0


def node_transform():
    """Affine of the node grid (node (0, 0) is the NW corner of the chunk grid)."""
    return rasterio.transform.from_origin(lidar.E0 - CELL / 2, lidar.N1 + CELL / 2, CELL, CELL)


def resample_dtm():
    """Elevation at every 2 m node: mean of the 2 x 2 lidar pixels around the node."""
    d = lidar.dtm()
    H, W = d.shape
    p = np.pad(d, 1, mode="edge")
    nr, nc = H // STEP + 1, W // STEP + 1
    r = np.arange(nr) * STEP
    c = np.arange(nc) * STEP
    # node at pixel boundary index r (between pixel r-1 and r): padded indices r and r+1
    a = p[np.ix_(r, c)] + p[np.ix_(r + 1, c)] + p[np.ix_(r, c + 1)] + p[np.ix_(r + 1, c + 1)]
    return (a / 4.0).astype(np.float64)


def lakes():
    """City water polygons with their water level (median DTM inside, hydro-flattened)."""
    feats = json.loads((RAW / "city" / "city_water.geojson").read_text())["features"]
    d = lidar.dtm()
    out = []
    for f in feats:
        g = shape(f["geometry"])
        m = rasterio.features.geometry_mask([g], out_shape=d.shape, transform=lidar.transform(), invert=True)
        if m.sum() < 10:
            continue
        out.append({"name": f["properties"].get("NAME") or "", "geom": g,
                    "level": float(np.median(d[m])), "objectid": f["properties"]["OBJECTID"]})
    return out


def heightfield(lake_list):
    h = resample_dtm()
    t = node_transform()
    for lk in lake_list:
        bed = lk["geom"].buffer(-LAKE_BED_INSET_M)
        inner = rasterio.features.geometry_mask([lk["geom"]], out_shape=h.shape, transform=t, invert=True)
        h[inner] = np.minimum(h[inner], lk["level"] - 0.25)
        if not bed.is_empty:
            deep = rasterio.features.geometry_mask([bed], out_shape=h.shape, transform=t, invert=True)
            h[deep] = lk["level"] - LAKE_BANK_M
    return h


def sample(h, e, n):
    """Bilinear height at UTM points from the node grid."""
    c = (np.asarray(e) - lidar.E0) / CELL
    r = (lidar.N1 - np.asarray(n)) / CELL
    c0 = np.clip(np.floor(c).astype(int), 0, h.shape[1] - 2)
    r0 = np.clip(np.floor(r).astype(int), 0, h.shape[0] - 2)
    fc, fr = c - c0, r - r0
    return (h[r0, c0] * (1 - fc) * (1 - fr) + h[r0, c0 + 1] * fc * (1 - fr)
            + h[r0 + 1, c0] * (1 - fc) * fr + h[r0 + 1, c0 + 1] * fc * fr)
