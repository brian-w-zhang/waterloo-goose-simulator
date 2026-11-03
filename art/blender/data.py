"""World data for the art scripts, from data/build/art/ (pipeline/build/artdata.py; run npm run pipeline first).

Coordinates: x east, y north in metres from the campus origin, z = elevation - base (game y).
"""
import json

import numpy as np

from lib import ROOT

ART = ROOT / "data" / "build" / "art"
_blds = None
_terrain = None


def buildings():
    global _blds
    if _blds is None:
        _blds = list(json.loads((ART / "buildings.json").read_text()).values())
    return _blds


def building_parts(abbrev):
    """Every footprint part carrying this City abbreviation (a building can have several)."""
    out = [b for b in buildings() if (b["abbrev"] or "").strip() == abbrev]
    if not out:
        raise KeyError(f"no building {abbrev!r} in {ART / 'buildings.json'}")
    return out


def _grid():
    global _terrain
    if _terrain is None:
        t = json.loads((ART / "terrain.json").read_text())
        _terrain = (np.load(t["heightfield"]), t)
    return _terrain


def height_at(x, y):
    """Game ground height (bilinear, same grid as the game's terrain) at art coordinates."""
    h, t = _grid()
    e, n = np.asarray(x) + t["origin_e"], np.asarray(y) + t["origin_n"]
    c, r = (e - t["e0"]) / t["cell"], (t["n1"] - n) / t["cell"]
    c0 = np.clip(np.floor(c).astype(int), 0, h.shape[1] - 2)
    r0 = np.clip(np.floor(r).astype(int), 0, h.shape[0] - 2)
    fc, fr = c - c0, r - r0
    v = (h[r0, c0] * (1 - fc) * (1 - fr) + h[r0, c0 + 1] * fc * (1 - fr)
         + h[r0 + 1, c0] * (1 - fc) * fr + h[r0 + 1, c0 + 1] * fc * fr)
    return v - t["base_elevation"]


def lidar_massing(abbrev, exclude=None, **opts):
    """Lidar tiers of a building outside `exclude` polygons, merged and simplified
    (tools/art/massing.py runs in the project's Python: shapely is not in Blender).
    opts: simplify, merge_dh, min_area, min_width, axis (square outlines to it), grid."""
    import subprocess
    tag = abbrev.lower().replace(" ", "_")
    spec, out = ART / f"{tag}_massing_spec.json", ART / f"{tag}_massing.json"
    spec.write_text(json.dumps({"abbrev": abbrev, "exclude": exclude or [], **opts}))
    subprocess.run([str(ROOT / ".venv" / "bin" / "python"), "-m", "tools.art.massing", str(spec), str(out)], cwd=ROOT, check=True)
    return json.loads(out.read_text())


def facades(building_dir):
    """The building's photo-read facade spec (docs/refs/buildings/<id>/facades.json) and walls."""
    d = ROOT / building_dir
    spec = json.loads((d / "facades.json").read_text()) if (d / "facades.json").exists() else None
    walls = json.loads((d / "walls.json").read_text())["walls"] if (d / "walls.json").exists() else []
    return spec, walls


def wall_for(a, b, walls, tol=1.5):
    """The documented wall (walls.json, art coordinates) a tier edge a-b lies on, with the edge's
    start position along it: (wall, s_off) or (None, 0) for inner walls (setbacks, courts)."""
    import math
    for w in walls:
        (ax, ay), (bx, by) = w["art"]
        L = math.hypot(bx - ax, by - ay)
        tx, ty = (bx - ax) / L, (by - ay) / L
        def proj(p):
            return (p[0] - ax) * tx + (p[1] - ay) * ty, abs(-(p[0] - ax) * ty + (p[1] - ay) * tx)
        s0, d0 = proj(a)
        s1, d1 = proj(b)
        if d0 < tol and d1 < tol and s1 > s0 and s0 > -tol and s1 < L + tol:
            return w, max(0.0, s0)
    return None, 0.0
