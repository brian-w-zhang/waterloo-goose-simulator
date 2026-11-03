"""Grass tufts and flowers: along the edges of lawns (paths, walls, water) plus a sparse scatter,
the small ground detail that makes the flat toon lawns read at the close game camera. OSM gardens,
flowerbeds and scrub are planted with shrubs and flowers where they are mapped."""
import numpy as np
import shapely
from shapely import union_all
from shapely.geometry import box

from ..config import CAMPUS

EDGE_STEP_M = 0.8
EDGE_INSET_M = 0.35
SCATTER_PER_M2 = 1 / 8
FLOWER_SHARE = 0.06
SHRUB_STEP_M = 3.2         # foundation planting along walls that face lawn (procedural decoration)
SHRUB_OFFSET_M = 1.4
SHRUB_KEEP = 0.8
# mapped planting (OSM leisure=garden, landuse=flowerbed, natural=scrub, natural=grassland, wetland
# reedbeds): shrub spacing (0 for none), share flowering, flowers per m2, grass tufts per m2
PLANTING = {"garden": (1.7, 0.5, 0.8, 0.0), "flowerbed": (1.2, 0.7, 3.0, 0.0), "scrub": (3.4, 0.15, 0.0, 0.0),
            "grassland": (0.0, 0.0, 0.06, 0.55), "reedbed": (0.0, 0.0, 0.0, 2.5)}


def planting_areas():
    """[(polygon, kind)] for mapped gardens, flowerbeds and scrub, in the City frame."""
    from shapely.geometry import Polygon

    from . import osm
    from .buildings import osm_to_city
    out = []
    for wid, t in osm.ways_where(lambda t: t.get("leisure") == "garden" or t.get("landuse") == "flowerbed"
                                 or t.get("natural") in ("scrub", "grassland") or t.get("wetland") == "reedbed"):
        pts = osm.way_coords(wid)
        if not pts or len(pts) < 4 or pts[0] != pts[-1]:
            continue
        p = Polygon([osm_to_city(e, n) for e, n in pts])
        p = p if p.is_valid else p.buffer(0)
        kind = ("garden" if t.get("leisure") == "garden" else "flowerbed" if t.get("landuse") == "flowerbed"
                else "reedbed" if t.get("wetland") == "reedbed" else "grassland" if t.get("natural") == "grassland" else "scrub")
        if not p.is_empty:
            out.append((p, kind))
    return out


def plant(area, kind, rng):
    """[(e, n, kind)] shrubs on a jittered grid and flower dots inside one planting area."""
    step, flowering, flowers, tufts = PLANTING[kind]
    minx, miny, maxx, maxy = area.bounds
    out = [np.zeros((0, 3))]
    if step:
        gx, gy = np.meshgrid(np.arange(minx + step / 2, maxx, step), np.arange(miny + step / 2, maxy, step))
        xy = np.c_[gx.ravel(), gy.ravel()] + rng.uniform(-step * 0.35, step * 0.35, (gx.size, 2))
        xy = xy[shapely.contains_xy(area, xy[:, 0], xy[:, 1])] if len(xy) else xy
        out.append(np.c_[xy, 3 + (rng.random(len(xy)) < flowering)])
    m = rng.poisson(area.area * tufts) if tufts else 0
    if m:
        t = np.c_[rng.uniform(minx, maxx, m * 2), rng.uniform(miny, maxy, m * 2)]
        t = t[shapely.contains_xy(area, t[:, 0], t[:, 1])][:m]
        out.append(np.c_[t, np.zeros(len(t))])
    n = rng.poisson(area.area * flowers)
    if n:
        f = np.c_[rng.uniform(minx, maxx, n * 2), rng.uniform(miny, maxy, n * 2)]
        f = f[shapely.contains_xy(area, f[:, 0], f[:, 1])][:n]
        out.append(np.c_[f, 1 + (rng.random(len(f)) < 0.5)])
    return np.vstack(out)


def chunk_tufts(cbox, gcls, footprints, rng, plantings=()):
    """[(e, n, kind)] with kind 0 tuft, 1 white flower, 2 pink flower, 3 shrub, 4 flowering shrub."""
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
    out = np.c_[allp, kind]
    shrubs = []
    for f in footprints:
        if not f.intersects(cbox) or f.area < 150:
            continue
        ring = f.exterior.buffer(SHRUB_OFFSET_M).exterior
        d = np.arange(rng.uniform(0, SHRUB_STEP_M), ring.length, SHRUB_STEP_M)
        if not len(d):
            continue
        p = shapely.line_interpolate_point(ring, d)
        xy = np.c_[shapely.get_x(p), shapely.get_y(p)]
        keep = (rng.random(len(xy)) < SHRUB_KEEP) & shapely.contains_xy(lawn, xy[:, 0], xy[:, 1])
        xy = xy[keep]
        shrubs.append(np.c_[xy, 3 + (rng.random(len(xy)) < 0.3)])
    for area, kind in plantings:
        a = area.intersection(lawn)
        if a.area > 1:
            shrubs.append(plant(a, kind, rng))
    return np.vstack([out] + shrubs) if shrubs else out


def build(gcls, bl, chunk_frame):
    rng = np.random.default_rng(CAMPUS["seeds"]["props"])
    C = CAMPUS["chunk"]
    S = C["size_m"]
    fps = [b["footprint"] for b in bl]
    areas = planting_areas()
    out = {}
    for j in range(C["rows"]):
        for i in range(C["cols"]):
            e0, n1 = chunk_frame(i, j)
            cb = box(e0, n1 - S, e0 + S, n1)
            out[(i, j)] = chunk_tufts(cb, gcls, fps, rng, [(a, k) for a, k in areas if a.intersects(cb)])
    return out
