"""Mosaic the 0.5 m lidar DTM and DSM tiles over the chunk grid extent (cached as .npy)."""
import numpy as np
import rasterio
from rasterio.merge import merge

from ..config import BUILD, CAMPUS, RAW

RES = 0.5
C = CAMPUS["chunk"]
E0 = C["grid_origin_e"]
N0 = C["grid_origin_n"]
E1 = E0 + C["cols"] * C["size_m"]
N1 = N0 + C["rows"] * C["size_m"]


def _mosaic(kind):
    cache = BUILD / f"{kind}_0p5.npy"
    if cache.exists():
        return np.load(cache)
    files = sorted((RAW / "lidar" / kind).glob("*.img"))
    srcs = [rasterio.open(f) for f in files]
    arr, _ = merge(srcs, bounds=(E0, N0, E1, N1), res=RES, nodata=np.nan, dtype="float32")
    for s in srcs:
        s.close()
    a = arr[0]
    a[a < -1e30] = np.nan
    BUILD.mkdir(parents=True, exist_ok=True)
    np.save(cache, a)
    return a


def dtm():
    """Bare-earth elevation, row 0 = north edge (N1), col 0 = west edge (E0)."""
    return _mosaic("dtm")


def dsm():
    return _mosaic("dsm")


def ndsm():
    return np.clip(dsm() - dtm(), 0, None)


def rc_of(e, n):
    """Fractional (row, col) of pixel centres for UTM coordinates."""
    return (N1 - np.asarray(n)) / RES - 0.5, (np.asarray(e) - E0) / RES - 0.5


def transform():
    return rasterio.transform.from_origin(E0, N1, RES, RES)
