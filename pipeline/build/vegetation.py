"""Trees from OSM and City points plus lidar canopy maxima; heights from the nDSM."""
import json

import numpy as np
import rasterio.features
from scipy import ndimage
from scipy.spatial import cKDTree
from shapely import union_all

from ..config import CAMPUS, RAW
from . import lidar, osm
from .buildings import osm_to_city

CONIFER_CITY_PREFIXES = ("Pi", "Pn", "Ab", "Th", "Ts", "Ju", "La")
MIN_CANOPY_M = 4.0
PEAK_WINDOW_PX = 9                      # 4.5 m local-maximum window
POINT_TREE_RADIUS_M = 3.0
PLANTED_AFTER_LIDAR_H_M = 5.0           # point trees with no canopy in 2018 get this height


def crown_radius(h):
    return float(np.clip(0.28 * h + 1.0, 1.8, 7.0))


def build(buildings, lakes):
    nd = lidar.ndsm()
    t = lidar.transform()
    blocked = union_all([b["footprint"].buffer(1.5) for b in buildings] + [lk["geom"] for lk in lakes])
    block_mask = rasterio.features.geometry_mask([blocked], out_shape=nd.shape, transform=t, invert=True)
    trees = []  # (e, n, h, kind) kind 0 deciduous, 1 conifer
    for e, n, tags in osm.node_points(lambda tg: tg.get("natural") == "tree"):
        e, n = osm_to_city(e, n)
        trees.append([e, n, 0.0, 1 if tags.get("leaf_type") == "needleleaved" else 0])
    for f in json.loads((RAW / "city" / "city_trees.geojson").read_text())["features"]:
        p = f["properties"]
        if p.get("STATUS") != "Existing" or not f.get("geometry"):
            continue
        e, n = f["geometry"]["coordinates"][:2]
        sp = p.get("SPECIES") or ""
        trees.append([e, n, 0.0, 1 if sp.startswith(CONIFER_CITY_PREFIXES) else 0])
    pts = np.array(trees) if trees else np.zeros((0, 4))
    # point-tree heights: max nDSM within 3 m
    mx = ndimage.maximum_filter(nd, size=int(2 * POINT_TREE_RADIUS_M / lidar.RES) + 1)
    r, c = lidar.rc_of(pts[:, 0], pts[:, 1])
    ri = np.clip(np.round(r).astype(int), 0, nd.shape[0] - 1)
    ci = np.clip(np.round(c).astype(int), 0, nd.shape[1] - 1)
    h = mx[ri, ci]
    pts[:, 2] = np.where(h >= MIN_CANOPY_M, h, PLANTED_AFTER_LIDAR_H_M)
    # canopy maxima not explained by a point tree
    sm = ndimage.gaussian_filter(nd, 1.5)
    peaks = (sm == ndimage.maximum_filter(sm, size=PEAK_WINDOW_PX)) & (sm >= MIN_CANOPY_M) & ~block_mask
    pr, pc = np.nonzero(peaks)
    pe = lidar.E0 + (pc + 0.5) * lidar.RES
    pn = lidar.N1 - (pr + 0.5) * lidar.RES
    ph = nd[pr, pc]
    if len(pts):
        dist, _ = cKDTree(pts[:, :2]).query(np.c_[pe, pn])
        keep = dist > 4.0
        pe, pn, ph = pe[keep], pn[keep], ph[keep]
    rng = np.random.default_rng(CAMPUS["seeds"]["trees"])
    kind = (rng.random(len(pe)) < 0.15).astype(float)
    lid = np.c_[pe, pn, ph, kind]
    allt = np.vstack([pts, lid]) if len(pts) else lid
    radius = np.array([crown_radius(x) for x in allt[:, 2]])
    return np.c_[allt, radius]  # e, n, h, kind, radius
