"""Terrain vs the lidar DTM at seeded points outside footprints and water, and chunk seams."""
import numpy as np
from scipy.ndimage import map_coordinates
from shapely import STRtree, points, union_all

from ..build import lidar
from ..config import CAMPUS


def run(world):
    m, detail = {}, {}
    bb = CAMPUS["bbox_utm"]
    rng = np.random.default_rng(CAMPUS["seeds"]["terrain_points"])
    blocked = union_all([b.footprint for b in world.buildings] + [p for _, p in world.lakes.values()]
                        + [world.ground_class_polys("water")])
    tree = STRtree([blocked])
    pts = []
    while len(pts) < CAMPUS["terrain_points_n"]:
        e = rng.uniform(bb["min_e"], bb["max_e"], 200)
        n = rng.uniform(bb["min_n"], bb["max_n"], 200)
        ok = ~blocked.contains(points(e, n)) if not blocked.is_empty else np.ones(200, bool)
        pts += [(a, b) for a, b, k in zip(e, n, ok) if k]
    pts = np.array(pts[:CAMPUS["terrain_points_n"]])
    r, c = lidar.rc_of(pts[:, 0], pts[:, 1])
    truth = map_coordinates(lidar.dtm(), [r, c], order=1, mode="nearest")
    got = world.terrain_at(pts[:, 0], pts[:, 1])
    err = got - truth
    m["terrain_rmse_m"] = float(np.sqrt(np.mean(err ** 2)))
    m["terrain_max_m"] = float(np.max(np.abs(err)))
    worst = np.argsort(-np.abs(err))[:5]
    detail["worst"] = [{"e": round(pts[k, 0], 1), "n": round(pts[k, 1], 1), "err": round(float(err[k]), 3)} for k in worst]
    # seams: shared edge samples of neighbouring chunks
    by = {(ch["i"], ch["j"]): hh for ch, hh, _ in world.terrain}
    seam = 0.0
    for (i, j), hh in by.items():
        if (i + 1, j) in by:
            seam = max(seam, float(np.max(np.abs(hh[:, -1] - by[(i + 1, j)][:, 0]))))
        if (i, j + 1) in by:  # j + 1 is the northern neighbour: its south row meets our north row
            seam = max(seam, float(np.max(np.abs(hh[0, :] - by[(i, j + 1)][-1, :]))))
    m["seam_max_m"] = seam
    return m, detail
