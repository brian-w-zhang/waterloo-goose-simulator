# Facade and site specs

Every modelled building gets `docs/refs/buildings/<id>/facades.json`, written from its photos, and
the model script draws each wall from it (`art/blender/arch.py` `facade()`). No wall is drawn from a
generic pattern once its spec exists.

## Inputs, per building

- `walls.json`: the walls W0, W1, ... (from `python -m tools.refs.around <ABBREV>`): ends in art
  coordinates (x east, y north, metres from the campus origin), length, outward compass facing.
  Walls run counter-clockwise; along a wall, distance `s` runs from its first end `a` to `b`, and the
  building is on the left when you walk from a to b (outside on the right).
- `private/around/`: `earth_<wall>_whole.jpg` (the whole wall square-on), `earth_<wall>_l|m|r.jpg`
  (thirds of long walls), `earth_corner_<k>.jpg`, and Street View `sv_<wall>_<pano>_70.jpg` (detail,
  looking slightly up) and `_100.jpg` (context), with pose and date in `index.jsonl`.
- `private/web/`, `commons/`, `private/ortho_*.jpg` (7 cm top-down), `private/earth_*.jpg` (orbits),
  `NOTES.md`, and the lidar heights (`python -m tools.art.study <ABBREV>`).

## facades.json

```json
{
  "building": "DC",
  "sources_checked": ["around/sv_W2_...", "..."],
  "colours": {"main_wall": {"hex": "#cfc6b4", "palette": "cream_panel", "where": "precast panels, all wings"}},
  "walls": {
    "W2": {
      "faces": "SE", "length_m": 70.1, "confidence": "high",
      "summary": "east wing end: 3 storeys of precast panels, ribbon windows, main entrance with red portal at s 30-38",
      "height_m": 11.4,
      "rows": [[4.0, "ground"], [3.6, "upper"], [3.4, "upper"], [0.4, "parapet"]],
      "bays": [[6.0, "pier"], [3.0, "win"], [3.0, "win"], [8.0, "entrance"], [3.0, "win"]],
      "cells": {
        "ground/win": {"type": "window", "w": 0.8, "h": 0.6, "mullions": 2, "glass": "window_dark", "frame": "metal_silver"},
        "ground/entrance": {"type": "door", "w": 0.9, "h": 3.0, "mullions": 3, "transoms": 1, "canopy": [1.2, "steel_red"]},
        "upper/win": {"type": "window", "w": 0.85, "h": 0.45, "mullions": 1},
        "*/pier": null
      },
      "wall": "cream_panel",
      "bands": [[3.9, 4.2, "metal_silver", 0.08]],
      "piers": [],
      "signs": [{"s": 34, "z": 4.6, "w": 6, "h": 0.6, "text": "DAVIS CENTRE", "colour": "panel_white", "on": "canopy"}],
      "attached": ["glazed bridge to E3 leaves at s 60-66, level 2"],
      "notes": "what was uncertain, which photo shows what"
    }
  },
  "roof": [{"what": "white duct housing", "where": "...", "size_m": [2, 3, 1.8]}],
  "site": {
    "bridges": [{"to": "E3", "from_wall": "W21", "s": [60, 66], "levels": [1, 2], "look": "glazed, red steel posts"}],
    "neighbours": ["MC across the green to the west, ~60 m"],
    "ground": ["red-brown and grey interlocking pavers on the east plaza", "lawn with diagonal concrete paths to the west"],
    "entities": [{"type": "bike_rack", "kind": "galvanised inverted-U on a rail", "where": "along W2, s 10-25, 2 m out", "count": 8, "photo": "sv_W2_..."}]
  }
}
```

- `rows` are bottom to top in metres from the building's ground; `bays` widths are metres along
  the wall (the script stretches them to the wall's real length). Cells are `"<row kind>/<bay kind>"`;
  `"*"` matches any kind; `null` is plain wall.
- Colours are palette names from `config/palette.json` (world group). If nothing is close (more than
  about 12 in Lab), give the hex and the place it appears; a new swatch is added for it.
- Every number is read off the photos: count windows and bays, measure against storey height (about
  3.5-4 m for these buildings), door height (about 2.1-2.4 m) and the wall's known length.
- Say which photo each claim comes from when it is not obvious, and mark guesses.

## Small things

Objects on the ground (benches, signs, lamps, bins, bike racks, bollards, planters, art, trees) go
in `site.entities` with an approximate place relative to a wall or to the building; they are merged
into the world entity register by position (one entry per real object however many photos show it).
