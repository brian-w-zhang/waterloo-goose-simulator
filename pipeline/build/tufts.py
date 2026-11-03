"""Grass tufts and flowers: along the edges of lawns (paths, walls, water) plus a sparse scatter,
the small ground detail that makes the flat toon lawns read at the close game camera."""
import numpy as np
import shapely
from shapely import union_all
from shapely.geometry import box

from ..config import CAMPUS

EDGE_STEP_M = 0.8
EDGE_INSET_M = 0.35
SCATTER_PER_M2 = 1 / 8
FLOWER_SHARE = 0.06


def chunk_tufts(cbox, gcls, footprints, rng):
    """[(e, n, kind)] with kind 0 tuft, 1 yellow flower, 2 pink flower."""
    hard = [gcls[k].intersection(cbox) for k in gcls if k != "wood"]
    hard += [f for f in footprints if f.intersects(cbox)]
    lawn = cbox.difference(union_all([g for g in hard if not g.is_empty])) if hard else cbox
    if lawn.is_empty:
        return np.zeros((0, 3))
    edge = lawn.buffer(-EDGE_INSET_M).boundary
    pts = []
    for line in getattr(edge, "geoms", [edge]):
        if line.length < EDGE_STEP_M:
            continue
        d = np.arange(rng.uniform(0, EDGE_STEP_M), line.length, EDGE_STEP_M)
        p = shapely.line_interpolate_point(line, d)
        pts.append(np.c_[shapely.get_x(p), shapely.get_y(p)] + rng.normal(0, 0.15, (len(d), 2)))
    n = rng.poisson(lawn.area * SCATTER_PER_M2)
    minx, miny, maxx, maxy = cbox.bounds
    cand = np.c_[rng.uniform(minx, maxx, n * 2), rng.uniform(miny, maxy, n * 2)]
    shapely.prepare(lawn)
    inside = shapely.contains_xy(lawn, cand[:, 0], cand[:, 1])
    pts.append(cand[inside][:n])
    allp = np.vstack(pts) if pts else np.zeros((0, 2))
    kind = np.zeros(len(allp))
    fl = rng.random(len(allp)) < FLOWER_SHARE
    kind[fl] = 1 + (rng.random(fl.sum()) < 0.4)
    return np.c_[allp, kind]


def build(gcls, bl, chunk_frame):
    rng = np.random.default_rng(CAMPUS["seeds"]["props"])
    C = CAMPUS["chunk"]
    S = C["size_m"]
    fps = [b["footprint"] for b in bl]
    out = {}
    for j in range(C["rows"]):
        for i in range(C["cols"]):
            e0, n1 = chunk_frame(i, j)
            out[(i, j)] = chunk_tufts(box(e0, n1 - S, e0 + S, n1), gcls, fps, rng)
    return out
