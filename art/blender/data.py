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
