"""The one place that converts between WGS84, EPSG:26917 and game world coordinates.

World axes: x = E - origin.e, y = elevation - base, z = -(N - origin.n); north is -z.
"""
import numpy as np
from pyproj import Geod, Transformer

from .config import CAMPUS

ORIGIN_E = float(CAMPUS["origin"]["e"])
ORIGIN_N = float(CAMPUS["origin"]["n"])
BASE_ELEV = float(CAMPUS["base_elevation_m"])

# Same transformation path the ground truth was computed with (doc 08 section 5, Datum).
_FWD = Transformer.from_crs("EPSG:4326", "EPSG:26917", always_xy=True)
_INV = Transformer.from_crs("EPSG:26917", "EPSG:4326", always_xy=True)
TRANSFORMER_DESCRIPTION = _FWD.description
_GEOD = Geod(ellps="GRS80")


def lonlat_to_utm(lon, lat):
    return _FWD.transform(lon, lat)


def utm_to_lonlat(e, n):
    return _INV.transform(e, n)


def utm_to_world(e, n, elev=None):
    x = np.asarray(e, dtype=np.float64) - ORIGIN_E
    z = -(np.asarray(n, dtype=np.float64) - ORIGIN_N)
    if elev is None:
        return x, z
    return x, np.asarray(elev, dtype=np.float64) - BASE_ELEV, z


def world_to_utm(x, z, y=None):
    e = np.asarray(x, dtype=np.float64) + ORIGIN_E
    n = ORIGIN_N - np.asarray(z, dtype=np.float64)
    if y is None:
        return e, n
    return e, n, np.asarray(y, dtype=np.float64) + BASE_ELEV


def azimuth_deg(e1, n1, e2, n2):
    """Grid azimuth from point 1 to point 2, clockwise from grid north, in [0, 360)."""
    return float(np.degrees(np.arctan2(e2 - e1, n2 - n1)) % 360.0)


def true_azimuth_deg(e1, n1, e2, n2):
    """Azimuth clockwise from true north (what the ground truth stores), in [0, 360)."""
    lon1, lat1 = utm_to_lonlat(e1, n1)
    lon2, lat2 = utm_to_lonlat(e2, n2)
    az, _, _ = _GEOD.inv(lon1, lat1, lon2, lat2)
    return float(az % 360.0)
