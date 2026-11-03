# NOTES

Decisions, doc disagreements and assumptions, newest last. Times are America/Toronto.

## 2026-11-03 02:00 Audit of the goal and planning pack

Checked before writing code:

- Pinned versions exist on npm: three 0.187.0, @dimforge/rapier3d-compat 0.21.0, recast-navigation 0.44.0, three-mesh-bvh 0.9.18, navcat 0.4.1, vitest 5.1.0, @playwright/test 1.64.1; Next.js latest is 16.4.4.
- Live sources answer: City `Public_Base/MapServer/3` returns 1,097 footprints in the game bbox (the 480 in the docs is the smaller core bbox); the Ontario lidar package server returns HTTP 206 for range requests; the OSM API map call returns 200.
- Local Python is 3.15; the pipeline uses a uv-managed 3.12 venv as the prompt requires.

Disagreements and corrections (prompt section 0 records the outcome):

1. Doc 02 gives the "Canada goose variant" an orange beak and feet. Real Canada geese have black bills and legs; orange is the domestic white goose of the reference game. Brian: accurate enough to be noticeable, stylised so it works in the toon look and animation.
2. Doc 02 section 6 puts HH (and DC) in "brutalist concrete"; doc 08 V10 describes "Hagey Hall brick massing". Doc 02 says its abbreviation lists are guesses. Resolve from photos before the style pass.
3. Doc 08 game camera (60 m, vFOV 25 degrees) frames about 26 m of world vertically, so a 1 m goose is about 3% of frame height; in the reference screenshots the goose is about 10 to 15%. Keep 60 m for style statistics; gameplay camera defaults closer.
4. Prompt orders the full harness on a stub world first. Agreed reorder: vertical slice first, harness grows with it; no rule is weakened.
5. Vite replaced by Next.js 16 (Brian's request).
6. Doc 06 says about 63 chunks; the game bbox (about 2,336 x 1,790 m) needs 10 x 7 = 70 chunks of 256 m.
7. The overnight build is the MP2 demo (slides due end of Wed Nov 4), while the planning pack frames it as MP3.

Repo hygiene: the first public push contained the UGG screenshots, the orthophoto sample (licence unverified), the course guide text and the slop-cities screenshot sheet. Brian chose to scrub them from history and force-push main once; they are gitignored and kept locally.

## 2026-11-03 02:10 Plan for the night

1. Scaffold Next.js app, Python 3.12 venv, pinned deps, `.gitignore`, `AI-USE.md`, `THIRD_PARTY.md`.
2. Freeze ground truth into `verify/ground-truth/` with `SHA256SUMS` and a test.
3. `config/campus.json`, `config/palette.json`, `config/style-rules.json`; coordinate module (Python and TS) with a DC to MC azimuth test.
4. Pipeline fetch (City layers, OSM via API tiles, 9 lidar DSM and DTM tiles via remotezip) with a manifest.
5. Pipeline build: terrain 2 m, buildings with lidar p90, water, ribbons, trees, props, pack per 256 m chunk; geometry validators read the packed chunks.
6. Client: chunk decoder, streaming, toon materials, fog, faint shadows, far LOD.
7. Canada goose from primitives with procedural walk, Rapier controller, follow camera with occlusion fade.
8. Visual harness: top-down, fly-through, style stats, palette check, viewpoints, contact sheet, gate, selftest mutants.
9. Look-iteration loop on beauty shots; materials research from photos.
10. P2 verbs, items and NPCs in the SLC and PAC or DC and MC hotspot; final full verify and review pack.

## 2026-11-03 02:40 Pipeline and validator decisions

- **Datum.** City GeoJSON fetched with `outSR=26917` is native NAD83 UTM. The frozen centroids passed through a WGS84 export plus pyproj's null shift (the only transformation available without PROJ grids), so they sit +0.31 m E, -0.94 m N off the native layer (areas identical). Build frame: native City and lidar (both native EPSG:26917). Positions are gated against `verify/truth-native/landmarks_native.json` (doc 08 section 5 allows native recomputation) and the frozen-truth error is reported alongside.
- **OSM registration.** OSM nodes are shifted by minus the median OSM-minus-City centroid offset of 754 buildings matched at IoU over 0.7 (-0.34 m E, +0.49 m N), computed at build time from the data, not a constant.
- **No terrain flattening under footprints** (doc 02 section 3 step 8 suggested it). Flattening moved ground up to 1.9 m within 2 m of buildings on slopes and failed the terrain max gate; walls now reach down to the lowest DTM within 1 m of the footprint minus 0.3 m (`base_y`), which hides seams without editing terrain. Terrain RMSE went from 0.097 m to 0.037 m.
- **Coverage set.** The frozen totals (480, 115) come from the planning-pack sample, whose query box is not exactly the core bbox (6 footprints lie wholly south of 43.4650 in the sample's own coordinates). `verify/truth-native/core_objectids.json` records that exact OBJECTID set with the sample's sha256; coverage counts how many of those are in the packed world.
- **Tagged-width check** skips ways tagged as crossings or traffic islands (they lie on the carriageway, drawn as road) and takes the median of 5 samples along each way so junctions do not count as width.
- **Height tiers.** Footprints are split into height tiers from the 0.5 m nDSM (median filter 2.5 m, 3 m level steps, regions under 60 m2 merged) so the DC and Dana Porter towers keep their shape; per-pixel median absolute error 0.31 m.
