"""Massing helper for art scripts: python -m tools.art.massing SPEC.json OUT.json

SPEC: {"abbrev": "DC", "exclude": [[[x, y], ...], ...], "simplify": 0.6, "merge_dh": 0.9, "min_area": 6,
       "axis": [ux, uy] (optional: square every outline to this axis, for orthogonal buildings)}
Reads data/build/art/buildings.json (lidar tiers per footprint part), removes the excluded polygons
(the parts a script models by hand), merges neighbouring tiers whose heights differ by less than
merge_dh, simplifies outlines and writes [{"h": tier height above ground, "ground_y": .., "rings": [...]}].
"""
import json
import sys
from pathlib import Path

import mapbox_earcut as earcut
import numpy as np
from shapely.geometry import Polygon, mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]


def _ortho_ring(pts):
    """Straighten a ring (already rotated into the axis frame): every edge becomes horizontal or
    vertical (by its angle), at the mean coordinate of its ends; corners are the edge crossings."""
    import numpy as np
    pts = np.asarray(pts[:-1] if np.allclose(pts[0], pts[-1]) else pts, float)
    n = len(pts)
    if n < 4:
        return None
    kinds, vals = [], []
    for k in range(n):
        a, b = pts[k], pts[(k + 1) % n]
        hz = abs(b[0] - a[0]) >= abs(b[1] - a[1])
        kinds.append(hz)
        vals.append((a[1] + b[1]) / 2 if hz else (a[0] + b[0]) / 2)
    # merge runs of the same kind (collinear after snapping), weighting by length
    ek, ev = [], []
    for k in range(n):
        if ek and ek[-1] == kinds[k]:
            ev[-1] = (ev[-1] + vals[k]) / 2
        else:
            ek.append(kinds[k]); ev.append(vals[k])
    if len(ek) > 1 and ek[0] == ek[-1]:
        ev[0] = (ev[0] + ev[-1]) / 2; ek.pop(); ev.pop()
    if len(ek) < 4 or len(ek) % 2:
        return None
    out = []
    for k in range(len(ek)):
        a, b = (ek[k - 1], ev[k - 1]), (ek[k], ev[k])
        if a[0] == b[0]:
            return None
        x = b[1] if not b[0] else a[1]
        y = b[1] if b[0] else a[1]
        out.append((x, y))
    return out


def square(g, ax, grid):
    """Rotate into the building axis, straighten every outline to it, rotate back."""
    import math
    from shapely import affinity
    ang = math.degrees(math.atan2(ax[1], ax[0]))
    c = g.centroid
    r = affinity.rotate(g, -ang, origin=c)
    polys = []
    for p in getattr(r, "geoms", [r]):
        if p.geom_type != "Polygon":
            continue
        ext = _ortho_ring(list(p.exterior.coords))
        if not ext:
            polys.append(p)
            continue
        holes = [h for h in (_ortho_ring(list(i.coords)) for i in p.interiors) if h]
        q = Polygon(ext, holes).buffer(0)
        polys.append(q if q.area > 0.5 * p.area else p)
    return affinity.rotate(unary_union(polys), ang, origin=c)


def ndsm_tiers(parts, excl, spec):
    """Height levels straight from the 0.5 m lidar inside the footprints: histogram peaks become
    levels, every pixel takes its nearest level, a 3x3 mode filter cleans speckle, and each level is
    traced into polygons (rasterio.features.shapes)."""
    import rasterio.features
    from affine import Affine
    from scipy import ndimage
    from pipeline.build import lidar
    from pipeline.coords import ORIGIN_E, ORIGIN_N
    fp = unary_union([Polygon(b["footprint"]["outer"], b["footprint"]["holes"]).buffer(0) for b in parts]).buffer(0.25)
    if excl is not None:
        fp = fp.difference(excl)
    x0, y0, x1, y1 = fp.bounds
    e0, n1 = x0 + ORIGIN_E, y1 + ORIGIN_N
    c0, r0 = int((e0 - lidar.E0) / 0.5), int((lidar.N1 - n1) / 0.5)
    W, H = int((x1 - x0) / 0.5) + 2, int((y1 - y0) / 0.5) + 2
    dsm = np.load(ROOT / "data/build/dsm_0p5.npy", mmap_mode="r")
    dtm = np.load(ROOT / "data/build/dtm_0p5.npy", mmap_mode="r")
    h = np.array(dsm[r0:r0 + H, c0:c0 + W]) - np.array(dtm[r0:r0 + H, c0:c0 + W])
    # pixel (row, col) -> art coordinates of the pixel's corner
    T = Affine(0.5, 0, (lidar.E0 + c0 * 0.5) - ORIGIN_E, 0, -0.5, (lidar.N1 - r0 * 0.5) - ORIGIN_N)
    inside = rasterio.features.geometry_mask([fp], out_shape=h.shape, transform=T, invert=True)
    vals = h[inside & (h > 1.5)]
    hist, edges = np.histogram(vals, bins=np.arange(1.5, vals.max() + 0.5, 0.25))
    sm = ndimage.uniform_filter1d(hist.astype(float), 5)
    peaks = [k for k in range(1, len(sm) - 1) if sm[k] >= sm[k - 1] and sm[k] > sm[k + 1] and hist[max(0, k - 2):k + 3].sum() * 0.25 >= spec.get("min_area", 8)]
    levels = []
    for k in sorted(peaks, key=lambda k: -sm[k]):
        lv = (edges[k] + edges[k + 1]) / 2
        if all(abs(lv - l) > spec.get("merge_dh", 0.9) for l in levels):
            levels.append(lv)
    levels = np.array(sorted(levels))
    lab = np.argmin(np.abs(h[..., None] - levels[None, None, :]), axis=2) + 1
    lab[~inside | (h < 1.5)] = 0
    lab = ndimage.generic_filter(lab, lambda w: np.bincount(w.astype(int)).argmax(), size=3, mode="nearest").astype(np.int32)
    gy = max(b["ground_y"] for b in parts)
    out = []
    for g, v in rasterio.features.shapes(lab, mask=lab > 0, transform=T):
        poly = Polygon(g["coordinates"][0], g["coordinates"][1:]).buffer(0)
        out.append([poly, float(levels[int(v) - 1]), gy])
    return out


def main(spec_path, out_path):
    spec = json.loads(Path(spec_path).read_text())
    blds = json.loads((ROOT / "data" / "build" / "art" / "buildings.json").read_text())
    parts = [b for b in blds.values() if (b["abbrev"] or "").strip() == spec["abbrev"]]
    excl = unary_union([Polygon(r) for r in spec.get("exclude", [])]) if spec.get("exclude") else None
    tiers = []
    if spec.get("source") == "ndsm":
        tiers = ndsm_tiers(parts, excl, spec)
        parts = []
    for b in parts:
        for p in b["parts"]:
            g = Polygon(p["outer"], p["holes"]).buffer(0)
            if excl is not None:
                g = g.difference(excl)
            if g.area > 0.5:
                tiers.append([g, p["h"], b["ground_y"]])
    # merge by height: sort, then union each tier into an earlier one of similar height it touches
    tiers.sort(key=lambda t: t[1])
    merged = []
    for g, h, gy in tiers:
        for m in merged:
            if abs(m[1] - h) < spec.get("merge_dh", 0.9) and m[0].buffer(0.3).intersects(g):
                a0, a1 = m[0].area, g.area
                m[0] = unary_union([m[0], g]).buffer(0.25).buffer(-0.25)
                m[1] = (m[1] * a0 + h * a1) / (a0 + a1)
                break
        else:
            merged.append([g, h, gy])
    out = []
    ax = spec.get("axis")
    for g, h, gy in merged:
        g = g.simplify(spec.get("simplify", 0.6))
        if ax:
            g = square(g, ax, spec.get("grid", 0.5)).simplify(0.05)
        for poly in getattr(g, "geoms", [g]):
            # slivers left by the exclusion (thin wedges) are dropped
            if poly.geom_type == "Polygon" and poly.area >= spec.get("min_area", 6) \
                    and not poly.buffer(-spec.get("min_width", 0) / 2).is_empty:
                poly = orient(poly, 1.0)          # outer ring ccw, holes cw (walls face out of the solid)
                rings = [list(map(list, poly.exterior.coords))[:-1]] + [list(map(list, r.coords))[:-1] for r in poly.interiors]
                verts = np.array([p for r in rings for p in r], dtype=np.float64)
                ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
                tris = earcut.triangulate_float64(verts, ends).reshape(-1, 3)
                out.append({"h": round(h, 2), "ground_y": gy, "rings": rings[:1], "holes": rings[1:],
                            "tris": [[verts[i].round(3).tolist() for i in t] for t in tris]})
    Path(out_path).write_text(json.dumps(out))
    print(len(out), "tiers")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
