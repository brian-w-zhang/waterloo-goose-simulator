# Bollards, fences, railings, hydrants, retaining walls

## Data
- OSM inside the boundary (`private/data/osm_in_boundary.geojson`): 182 barriers.
  - 112 kerbs (mostly with tactile paving at crossings).
  - **18 fences** (metal 9; black 6, grey 4; height 2 m on 6).
  - 19 gates, 7 lift gates (parking), 3 toll booths, 4 bollards, 3 cycle barriers, 4 retaining walls, 4 walls, 2 swing gates.
- City `Retaining_Wall/2` in the bbox (25; fields HEIGHT, LENGTH, MATERIAL), mostly on City land at the edges: `private/data/city_retaining_walls_bbox.geojson`.
- The UW Plant Ops dataset (restricted) has **fences, retaining walls, curbs and steps** layers. See `../maps/NOTES.md`.
- OSM has 161 fire hydrants in the bbox (in the raw dump, `../maps/private/data/osm_campus_bbox_tags.json`).

## Types seen
- **Fire hydrants:** **red** bodies with a black or red cap and chained caps. They are tall Canadian (McAvity-style) units about 0.9 m high. A **red/orange snow-marker flag rod** stands next to each (see `private/web/000_*`, `001_*`).
- **ION corridor fencing:** black chain-link and black steel picket fencing along the tracks, plus planter barriers on East Ring Road (2015). Powered crossing gates.
- **Railings:**
  - Black steel picket railing around the **Porcellino** statue at ML.
  - Black / galvanised handrails on ramps and stairs.
  - Timber-and-steel railings on the Laurel Creek footbridges (see `../laurel-creek-and-trail/`).
- **Concrete:** concrete curbs everywhere; concrete seat walls and **retaining walls** in the Arts Quad (2018) and along sloped lawns. The garden at -80.54227, 43.46906 is tagged as a retaining wall.
- **Bollards:** few are mapped. Expect removable steel bollards at service-lane entries to pedestrian zones, and lit bollards at plazas. Unverified.
- **Paving work** (`private/web/003_*`): replacement of grey and red-brown interlocking pavers on a campus walkway, a student project photo. This is a useful paver close-up.
