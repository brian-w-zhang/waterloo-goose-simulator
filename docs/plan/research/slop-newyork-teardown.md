# Slop New York teardown and a UW campus adaptation plan

Research memo for the SE capstone brainstorm: how mrdoob's Slop New York was built, how realistic it is, how the 50 "slop cities" remixes compare, and what it would take to do the same for the University of Waterloo campus. Researched Nov 2, 2026 (America/Toronto). Repo read at commit 737b769 (154 commits, 2026-10-20 to 2026-11-03).

Sources read: github.com/mrdoob/slop-newyork (cloned), github.com/zz85/slop-cities (cloned), 7 remix repos (cloned), mrdoob's X posts and replies, the live site via curl, OSM API, City of Waterloo GIS REST service. "Unverified" marks anything I could not confirm.

---

## 1. TL;DR

- **It is not "fully procedural" in the data sense.** The geography is real open data baked offline into the repo: NYC street centrelines, borough and park boundaries, building footprints with surveyed roof heights, tree points, subway entrances, plus OpenStreetMap for Central Park, piers, coastline and landmark outlines. What is procedural is *everything you see*: every mesh, facade, window, interior, road texture, tree, car and sound is generated in code at load time. There are zero image, model (glb/gltf) or audio files in the repo.
- **Buildings = real footprint polygons extruded to their real roof height**, with flat roofs, then dressed entirely by shaders (TSL): window grids, parallax "fake interiors" behind the glass, storefronts, soot, party walls, night lighting. Era (construction year) picks the style: pre-1945 brick/limestone, later curtain-wall glass. Fire escapes, cornices, water towers and HVAC are instanced props streamed near the player. ~20 icons (Empire State, Chrysler...) are hand-modelled in code and fitted to their real lots.
- **Why it looks good:** physically based lighting (atmospheric sky, sun with 2-cascade shadows, PMREM environment light), ACES tone mapping plus a careful color grade and bloom, screen-space reflections on wet roads and glass, fog matched to the sky, and obsessive anti-aliasing of procedural detail so distant windows do not shimmer. Plus real data, so proportions and street widths are right.
- **Size:** the "784KB gzipped" claim matched the Oct 22 version (I measured 782.5 KB gzipped across index.html, css and js at commit 7269225). mrdoob later said it grew to **2.2 MB** once real building footprints were added (X post, 2026-10-28). Today the two binary data blobs alone are 563 KB.
- **For UW:** OSM has 338 building/part outlines inside the campus polygon, **82% with building:levels** but only 2% with real height. City of Waterloo open data has 479 footprints in the campus bbox with a FIRE_STOREYS field (56 of 115 UW-owned have it). Ontario's lidar DSM gives true roof heights. Best template is **not** the Manhattan code directly but the generic OSM pipeline in **zz85/slop-singapore** (a `tools/city/cities/<city>.mjs` config file), optionally with heights refined from Ontario lidar. Feasible for a 4 to 5 person team with AI agents in a term for a convincing campus; "accurate" needs lidar heights and campus-specific facade styles.

---

## 2. Where the map data came from (slop-newyork)

All fetched once by scripts in `tools/`, baked into `js/*.js` or `js/*.bin.gz`, and served as static files. Nothing is fetched from a map API at runtime (only the repo's own data files, via `fetch()` in `js/building-geodata.js` and `js/tree-geodata.js`).

| Layer | Source (URL) | Script | Output in repo |
|---|---|---|---|
| Street centrelines, widths, lanes, direction, grade level | NYC CSCL street centerline, data.cityofnewyork.us dataset `inkn-q76z` | `tools/geo-streets.mjs`, `tools/geo-base.mjs` | `tools/data/cscl_manhattan.json` (6.25 MB raw) to `js/nyc-geodata.js` |
| Borough shapes | NYC DCP Borough Boundaries, dataset `gthc-hcne` | `tools/geo-base.mjs` | `tools/data/dcp_boroughs.json` (3.2 MB) |
| Parks | NYC Parks properties, dataset `enfh-gkve` | same | `tools/data/nycparks_manhattan.json` (1.4 MB) |
| Central Park water, lawns, drives, named sites | OSM via Overpass | `tools/overpass.sh` + `tools/data/q_cp.overpassql` | `tools/data/osm_centralpark.json` |
| Coastline (NJ shore etc.) | OSM `natural=coastline` | `q_coast.overpassql` | `osm_coastline.json` |
| Piers | OSM `man_made=pier` | `q_piers.overpassql` | `osm_piers.json` |
| Landmark footprints (hardcoded name list of ~60 buildings) | OSM | `q_landmarks.overpassql` | `osm_landmarks.json` |
| **Building footprints + roof height + construction year** | NYC OTI Building Footprints, https://data.cityofnewyork.us/resource/5zhs-2jue.json (fields `the_geom, height_roof, bin, feature_code, construction_year`) | `tools/build-buildings.py` (Shapely) | `js/building-geodata.bin.gz`, **440,558 bytes, 37,353 buildings** (header of `js/building-geodata.js`) |
| Street trees | NYC Parks Forestry Tree Points, https://data.cityofnewyork.us/resource/hn5i-inap.json | `tools/build-trees.py` | `js/tree-geodata.bin.gz`, **122,875 bytes, 70,680 living trees** |
| Subway entrances | MTA Subway Entrances 2024, https://data.ny.gov/resource/i9wp-a4ja.json | `tools/build-subway-entrances.mjs` | `js/subway-geodata.js` (12 KB) |

Licences/credits: `README.md` (NYC Open Data, MTA, OSM ODbL).

Pipeline details worth copying:
- **Local metric frame.** `tools/geo-base.mjs` projects lon/lat to a local tangent plane in metres (WGS84 ellipsoid radii at a reference latitude), then rotates 29.017 degrees so the Manhattan grid is axis-aligned, origin at 5th Ave and 42nd St. 1 unit = 1 m.
- **Blocks are derived, not downloaded.** `tools/geo-blocks.mjs` rasterises every at-grade roadway at its curb-to-curb width (CSCL `streetwidth`, feet to metres) on a 1 m grid, subtracts it from land, and labels what is left as blocks ("curb islands"), then insets 4.6 m for sidewalks (`SIDEWALK = 4.6`).
- **Road graph** for traffic from the same centrelines: `tools/geo-roadgraph.mjs`; merged polylines with Ramer-Douglas-Peucker simplification in `tools/build-geodata.mjs`.
- **Compact binary format** for buildings (`tools/build-buildings.py`, format "NYB1"): coordinates quantised to 0.5 m, heights to 1 m, years to decades, buildings Morton-ordered so neighbours are adjacent, zigzag varint deltas in separate X and Z streams, then gzip. That is how 37k buildings fit in 440 KB.
- **Robust fetching.** `tools/overpass.sh` rotates 3 Overpass mirrors with backoff and validates JSON before atomically replacing data (commit 57f94f8).
- Note: `tools/geo-base.mjs` mentions a `tools/fetch-geodata.sh` that is **not in the repo**; the raw building and tree snapshots are kept outside the repo by design (docstrings in `build-buildings.py`, `build-trees.py`).

### How it evolved (git log)
- 2026-10-20: initial commit. Buildings were **procedurally invented** on the real blocks: seeded random (`mulberry32`) heights and types by district (`'midtown'`, waterfront low-rise, "Billionaires' Row" supertall rule) in `js/buildings.js` (2,636 lines at commit 7269225).
- 10-21: ACES tone mapping, color grading, bloom (dfecae4, ba95249).
- 10-22: README and MIT licence; the viral tweet (784 KB).
- 10-23: synthesized spatial audio, ES modules, gamepad.
- 10-24 to 10-27: traffic, pedestrians, physics, LOD and culling, real MTA subway entrances (50f1cf8).
- **10-28: switch to real data.** "Use surveyed footprints and heights for Manhattan's tallest buildings" (1daa665), "Load full Manhattan building footprints" (062c4a9), "Replace procedural building infill with surveyed details" (0073425), trees from NYC inventory (7249a39). mrdoob tweeted size went to 2.2 MB.
- 10-29 onward: storefronts, entrances, fire escapes, perf work, three.js r187 (16d6782).
- Authors: all 154 commits by mrdoob ("Spent a bunch of tokens": AI agent written, his words). 29 test files in `tests/`.

---

## 3. How buildings are generated

Code: `js/buildings.js` (`buildCityBlocks`), `js/building-footprints.js`, `js/building-details.js`, `js/fire-escapes.js`, `js/tsl-materials.js`, `js/landmarks.js`.

1. **Decode** the NYB1 blob in the browser (`js/building-geodata.js`, uses `DecompressionStream('gzip')`). Each record: polygons with holes, height, year.
2. **Pick a style per building** (`js/buildings.js` ~line 348): seeded by position. Built before 1945: 80% limestone/buff brick pre-war, 20% red brick. 1945 to 1980: mix of pre-war masonry and curtain wall. Later or unknown: curtain-wall glass variants. 55% of buildings 6 m+ get storefronts (the data has no use field, comment says so).
3. **Geometry is plain extrusion** (`js/building-footprints.js`): for each footprint edge, one wall quad from 0.22 m to roof height; roof is the triangulated polygon (`THREE.ShapeUtils.triangulateShape`). **All roofs are flat.** Walls are merged into one mesh per 1 km cell (few draw calls).
4. **Wall classification** gives realism cheaply: an edge touching a neighbour's roof becomes a windowless "lot line" party wall above the neighbour (`partyWallHeight`, `WALL_KINDS` in `js/tsl-materials.js`: shop, front, rear, lotLine). Courtyard walls are rear walls.
5. **Facade in the shader, no textures** (`createPreWarBuildingMaterial`, `createCurtainWallMaterial`, `facadeCell` in `js/tsl-materials.js`, 3,497 lines): window bays ~2.7 m wide by 3.8 m storeys computed from world coordinates so bays are metre-true on any wall angle; corner piers; ground-floor shops; soot; canyon ambient occlusion (`canyonSkyAONode`); a warm "canyon bounce" color.
6. **Fake interiors** (`evaluateApartmentInterior`): parallax interior mapping, rooms 2 to 3 bays wide with partitions behind mullions, drapes, random lit windows at night; distant lit windows collapse into filtered 1 to 2 pixel clusters (`distantWindowLight`) so they do not alias.
7. **Streamed details** near the player (quadtree in `js/buildings.js`): cornices, water towers, HVAC, awnings, scaffold sheds, fire escapes on pre-1945 buildings under 30 m (`addSurveyedFireEscapes`), instanced, with LOD (near detailed stairs, far masked planes, `js/fire-escapes.js`).
8. **Landmarks** (`js/landmarks.js`, 40 KB): Empire State, Chrysler (own crown material), etc. modelled in code around a local origin and fitted to real OSM lots (`fitToSite(..., { height: 443 })`).
9. **Collision** uses the same polygons (`js/building-collision.js`).

Only canvas-generated textures exist: billboards, shop signs, FFT ocean waves (`fft2DInverse`, `getWaterWaveTexture`), smoke.

---

## 4. Whole-app architecture and rendering

- **Stack:** plain ES modules, no bundler, no package.json, no build step. `index.html` import map loads three.js r187 (`three/webgpu`, `three/tsl`) from jsDelivr. Static hosting on GitHub Pages. ~33,600 lines of JS in `js/` (largest: `city-grid.js` 3,544, `tsl-materials.js` 3,497, `boroughs.js` 3,367, `traffic.js` 2,468).
- **Renderer:** `WebGPURenderer` with WebGL2 fallback (commit 2aad875), materials written in TSL (three.js shading language). `renderer.setPixelRatio(1.0)` (`js/main.js:86`).
- **Lighting** (`js/lighting.js`): `SkyMesh` atmospheric sky (Rayleigh/Mie), `SunLight` with 2 shadow cascades in one atlas (3072 px tiles if the GPU allows), PMREM environment lighting, hemisphere sky/ground bounce, 4 time presets (golden, midday, twilight, midnight), `ClusteredLighting(256, 32, 28, 48)` for thousands of street lamps and headlights (`js/main.js:89`).
- **Post** (`js/main.js` ~225 to 260, `js/post-processing.js`): MRT pass, SSR at half resolution (wet roads, glass), bloom on a peak-clamped input, ACES, contrast pivot at middle grey, split-tone (cool shadows, warm highlights), vibrance, subtle vignette. Per-preset exposure/bloom table `LOOKS`.
- **Ground detail** (`createRoadSurfaceMaterial`, `createSidewalkMaterial`): asphalt wear, tar snakes, cracks, potholes, puddles with wet sheen, 5 ft sidewalk flags with gum stains; all procedural and faded out at distance.
- **Sim:** `js/traffic.js` (lane graph, signals, police), `js/pedestrian-system.js` + `js/pedestrians.js` (routes, conversations, WALK signals, dives), `js/vehicle-physics.js`, `js/controllers.js` (walk, car, bike, helicopter), `js/audio-*.js` (all sound synthesized with Web Audio).
- **Performance:** chunked static batches and spatial culling (`js/scene-culling.js`), shadow stand-ins, tree LOD (`js/trees.js` lod 0/1/2 cards), streaming details only around the player.

### Live site (curl, Nov 2)
`index.html` 24,110 B; `js/nyc-geodata.js` 398,739 B (gzip on the wire); `js/building-geodata.bin.gz` 440,558 B; `js/tree-geodata.bin.gz` 122,875 B; `js/tsl-materials.js` 49,855 B gz; `js/city-grid.js` 56,070 B gz. My own sum of all text files gzipped (878 KB) plus the two blobs (563 KB) is ~1.44 MB; mrdoob's 2.2 MB figure may count three.js from the CDN (unverified).

---

## 5. How realistic and accurate is it really

Accurate (from survey data): street positions and widths, block shapes, building footprints and roof heights (NYC survey), tree locations, subway entrances, coastline, park features.

Invented or approximate:
- **Facade materials are guessed** from construction decade and a random roll, not from photos. The data has no use field, so which buildings have shops is random (comment in `js/buildings.js`).
- **Flat roofs everywhere** (no setbacks beyond what footprints encode, no pitched roofs), except hand-modelled landmarks.
- **Terrain is flat**; there is no elevation model (only highway decks are raised).
- Window sizes, storey heights, interiors, signs, pedestrians, traffic volumes are all procedural.
- Only Manhattan south of ~129th St is detailed (`CUT_Z = -7090` in `tools/geo-blocks.mjs`); other boroughs are low detail.
- mrdoob himself: "made Slop New York more fun to drive around and way less sloppy" (2026-10-28) and "Pedestrian (not very good) car avoidance" (2026-10-26).

So: "looks right at a glance from street level and from the air" rather than "digital twin". The realism is mostly lighting, grading and density of small details, not photogrammetry.

---

## 6. Slop Cities comparison (github.com/zz85/slop-cities)

The list (`cities.yml`) has 50 cities and 143 play/source links (forks, remixes, own-engine takes). mrdoob: "35+ projects ... in just 4 days" (2026-10-26) and "41 slop cities" in a week (2026-10-30). Screenshot contact sheet: `raw/slop-cities-screenshots-contact.jpg`.

| City (repo) | Building data | Generation approach | Size (git clone) | Look (from author screenshots) |
|---|---|---|---|---|
| New York (mrdoob/slop-newyork) | NYC surveyed footprints + heights (37,353) | Extrusion + TSL procedural facades + hand landmarks | 19 MB working tree (24 MB .git), ~1.4 to 2.2 MB download | Strong street level; real-feeling canyons |
| Helsinki (kinotus/slop-helsinki) | City of Helsinki **photo-textured LoD2 3D city model** (3D Tiles from kartta.hel.fi, streamed at runtime) + city terrain | Uses the real mesh; OSM extrusion only as fallback (`?buildings=osm`) | Not cloned | **Most photoreal** at street level: real facades and roofs |
| Zürich (colorfield/slop-zurich) | swisstopo **swissBUILDINGS3D 3.0** (real roofs, b3dm Draco tiles stored in repo) + swissALTI3D terrain | Real 3D roofs, real relief, LV95 frame | 130 MB repo, ~72 MB published | Very accurate shape, real hills; facades less detailed |
| San Francisco (unable12) | DataSF footprints, OSM, USGS elevation: 15,735 core + 154,870 regional buildings | NYC-style procedural facades per neighbourhood + terrain | 175 MB | Real hills and fog |
| Toronto (johnfewell/slop-toronto) | OSM + City of Toronto **3D Massing 2025** (behind `?massing=1`, `tools/build-massing.mjs`) | NYC engine via Abuja fork; volumetric clouds, TTC subway, streetcars | 206 MB (assets 52 MB) | Polished golden-hour skyline; boxes at street level |
| Toronto (aalghooneh/slop-toronto) | OSM; true outline + height for buildings 40 m+ | Facade colours measured from ~430 Wikimedia Commons photos (`tools/commons-palette.py`) | 55 MB | Good colour fidelity trick |
| Singapore (zz85/slop-singapore) | OSM only; height = `height`, else `building:levels` x level height, else typical by type (`tools/city/tiles.mjs:137`) | **Generic city pipeline**: `tools/city/cities/<city>.mjs` config with origin, bbox, `districts` mapping to styles (glass-towers, offices, shophouses, housing, midrise, lowrise), places, trees, liveries, landmark replacements | 94 MB | Good aerial; generic up close |
| Seattle (treycausey) | 4,490 OSM buildings | Stylized; no traffic/pedestrians | 33 MB | Low detail, toy-like |
| Utrecht (bertt) | OSM + city tree GeoParquet | Extrusion | 45 MB | Untextured grey walls in screenshot; weakest look |

**Which looks most realistic and why:** Helsinki, because it renders the city's own photo-textured 3D model, so facades, roofs and colours are real; Zürich is the most geometrically accurate (surveyed roofs plus terrain). Among pure procedural takes, mrdoob's New York still looks best because it has surveyed heights, era-driven facade styles, party walls, fake interiors, and the most lighting/post work. OSM-only extrusions (Seattle, Utrecht) look worst: missing heights default to a few storeys and walls are uniform.

---

## 7. Waterloo campus: data available (checked Nov 2, 2026)

Campus bbox used: 43.4650 to 43.4780 N, -80.5580 to -80.5370 W (around 43.4723 N, -80.5449 W).

**OpenStreetMap** (OSM API `map` call, 6.9 MB XML, because all public Overpass mirrors were at capacity or timed out; raw file not kept):
- 712 building or building:part ways with centroid in bbox; **338 inside the UW campus relation** (OSM relation 11680616, "University of Waterloo").
- On campus: `building:levels` 276 (82%), `building:part` 183 (54%, i.e. multi-part 3D mapping exists), `name` 107, `building:material` 64 (19%), `building:min_level` 63, `roof:shape` 47 (14%), `building:colour` 41, `roof:colour` 37, **`height` only 6 (2%)**.
- Named buildings with outlines include Davis Centre (DC), Mathematics & Computer (MC), M3, Engineering 2, 3, 5, 6 and 7, QNC, SLC, PAC, Dana Porter, Hagey Hall, the V1, Ron Eydt Village and Mackenzie King Village residences, St. Jerome's, Renison, Conrad Grebel. 30 named outlines lack levels or height on the main way (some may carry them on their parts; not checked individually).
- Elsewhere in the bbox (Northdale, plazas) coverage is much lower: 45% with levels.

**City of Waterloo open data** (ArcGIS REST, https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/3, portal https://opendata-city-of-waterloo.opendata.arcgis.com/): rooftop outlines digitised at 1:250 from orthophotos. In the campus bbox: **479 footprints**; 115 owned by "UNIVERSITY OF WATERLOO", of which 56 have `FIRE_STOREYS`; 93 footprints in the bbox have FIRE_STOREYS; MPAC storeys and year built are nearly empty on campus (8 and 3). Fields include BLDG_NAME, BLDG_ABBREV (e.g. DC = 3, E6 = 6, M3 = 4). Open Data Licence. Raw attributes saved in `raw/cow-uw-buildings-attrs.json`.
- Same server has a **Street Tree Inventory** (Public_Operations MapServer layer 1/2, species, condition) and the portal lists street centrelines, sidewalks, trails (portal listing seen; layers not queried).

**Ontario lidar DSM / DTM** (Ontario Digital Surface Model, Lidar-Derived: https://data.ontario.ca/dataset/ontario-digital-surface-model-lidar-derived, tile index https://www.publicdocs.mnr.gov.on.ca/mirb/OntarioDSM_LidarDerived_TileIndex.zip; also DTM): 1 km tiles; roof height = DSM minus DTM sampled per footprint gives real heights for all 338 to 479 buildings. Exact Waterloo project and vintage not verified (UW Geospatial Centre lists SWOOP 2015 for the Region). QGIS plugin "Ontario Elevation Manager" automates downloads.

**UW-specific:** UW Open Data API v3 `/v3/Locations/geojson` (needs free API key, https://uwaterloo.ca/api/) gives building codes and points, not full footprints (schema says coordinates only). The UW Library Geospatial Centre has a **campus CAD/shapefile set current to 2025** (buildings, curbs, sidewalks, steps, trees, tunnels, retaining walls, contours) for current students under a data release agreement, academic use only, and the City must be credited; redistribution in a public repo is likely not allowed (check before using).

**Other:** Microsoft Canadian Building Footprints and StatCan Open Database of Buildings (footprints, no heights), Overture Maps buildings (mix of OSM and ML footprints, some heights): not checked this turn. Orthophotos: Region of Waterloo/SWOOP imagery available through the UW Geospatial Centre (licence restricted; unverified for public use).

---

## 8. What is NYC-specific vs reusable in slop-newyork

NYC-specific (rewrite or delete):
- `tools/geo-base.mjs` frame (origin 5th & 42nd, 29 degree Manhattan grid bearing), `tools/geo-streets.mjs` and `tools/geo-blocks.mjs` (CSCL field names `rw_type`, `streetwidth`, `trafdir`, `from_level_code`; regexes for FDR, Henry Hudson, Broadway plazas).
- `tools/build-buildings.py` (NYC OTI schema, BIN ranges for Manhattan, feature codes), `tools/build-trees.py`, `tools/build-subway-entrances.mjs`.
- `js/city-config.js` (avenues, numbered streets, islands, piers), `js/city-grid.js`, `js/boroughs.js`, `js/nyc-map.js`, `js/landmarks.js` (Empire State, Chrysler), `js/subway-entrances.js`, fire escapes and water towers as a style, taxis/liveries in `js/cars.js`.

Reusable almost as is:
- `js/tsl-materials.js` facade, interior, road, sidewalk, water, tree materials; `js/lighting.js`; `js/post-processing.js`; SSR setup in `js/main.js`.
- `js/building-footprints.js` extrusion with party walls, `js/building-collision.js`, `js/scene-culling.js`, `js/trees.js` (procedural species), `js/controllers.js`, `js/vehicle-physics.js`, `js/cameras.js`, audio, touch and gamepad.
- `tools/overpass.sh`, the NYB1 packer idea, the test setup in `tests/`.

Better starting point: **zz85/slop-singapore**, which already generalised this into `tools/city/fetch.mjs`, `tools/city/build.mjs`, `tools/city/preview.mjs` with a per-city config (`tools/city/cities/singapore.mjs`: origin, `bearing: 'auto'`, detail bbox, districts to styles, places, trees source, landmark way ids to hide). A `waterloo.mjs` config is the shortest path to a first build.

---

## 9. Waterloo adaptation plan

Phase 0 (week 1, low risk): fork slop-singapore, write `tools/city/cities/waterloo.mjs` (origin DC/MC quad ~43.4723, -80.5449; detail bbox above; driveSide right; districts: "brutalist-concrete" for MC/DC/Hagey, "modern-glass" for E5/E7/QNC, "residence-brick" for V1/REV/MKV, "lowrise" for Northdale), fetch OSM, build, preview. Expect a recognisable campus in days.

Phase 1 (weeks 2 to 4): heights. Join OSM outlines with City of Waterloo FIRE_STOREYS and with Ontario lidar DSM minus DTM (median roof height per footprint, also gives roof shape hints). Use `building:part` + `building:min_level` so bridges and towers (e.g. E5/E7 links, SLC) are stacked correctly. Add terrain from the DTM (Laurel Creek, the slope by the ring road), following Zürich or SF.

Phase 2 (weeks 4 to 8): campus look. New TSL facade styles for UW's architecture: exposed concrete and brick brutalism (MC, DC, Hagey), glass curtain walls (E7, QNC), red brick residences. Measure colours from your own photos (aalghooneh's Commons palette trick). Hand-model 5 to 10 icons in code (DC, MC, QNC, E7, SLC, PAC, Porter, the bridges). Trees from City of Waterloo inventory plus OSM `natural=tree`; ION LRT line along the east edge from OSM.

Phase 3 (weeks 8 to 12): the "advanced technology" angle (pick one so it is a capstone, not a fork): live GRT/ION GTFS-realtime vehicles, room/course data from the UW API, pedestrian flow sim between classes, accessibility routing, or a digital twin for wayfinding. Optionally extend to uptown Waterloo and Kitchener with OSM-only low detail.

### Effort and risk (team using AI coding agents)
- First recognisable build: 2 to 5 days for one person (forks like Seattle, Nairobi, Toronto appeared within 1 to 6 days of the tweet; GTA The 6 on top of Slop Toronto was "built in 6 hours").
- Looks as good as New York: 6 to 10 weeks of steady iteration; mrdoob's own polish ran 154 commits in 2 weeks with heavy token use.
- Risks: (1) WebGPU only on recent Chrome/Edge/Safari, WebGL2 fallback loses features; (2) TSL shaders are large (3.5k lines) and AI agents break them easily; write visual regression screenshots per commit; (3) data licences (UW Geospatial Centre data likely cannot be published; OSM requires ODbL attribution and share-alike for derived databases); (4) OSM heights are mostly levels, so heights are estimates until lidar is joined; (5) Overpass public servers are often overloaded (happened today): cache raw extracts in the repo; (6) "slop" originality: a capstone needs a novel contribution beyond re-skinning.

### Techniques that make procedural cities look good, not bad
1. Real footprints and real heights. Wrong proportions read as fake instantly.
2. Physically based sky + sun + environment map, then **tone mapping and colour grading** (ACES, contrast around middle grey, split tone, restrained bloom). Most bad city sims skip this.
3. Shadows with cascades and contact detail; canyon ambient occlusion.
4. Windows with depth: interior mapping instead of flat blue rectangles; random lit windows at night.
5. Variation everywhere, seeded per building: tone, soot, era-driven style; no two adjacent facades identical.
6. Party walls and blank side walls where buildings touch; storefronts only on street faces.
7. Anti-aliasing procedural detail (fwidth-filtered lines, fading detail with distance, window light clustering). Shimmer is the main "cheap" tell.
8. Ground clutter: road wear, puddles, sidewalk joints, street trees from real inventories, lamps, signals.
9. Atmosphere: distance fog matched to the sky horizon; golden-hour defaults.
10. Hand-model the 5 to 10 buildings people recognise; generic everything else.
11. Life: traffic, pedestrians, synthesized audio. Motion sells realism more than polygons.
12. Keep it light (streaming, instancing, one mesh per cell) so it holds 60 fps; stutter reads as low quality.

---

## 10. Open items / unverified
- Exact Ontario lidar project and resolution over UW, and whether its licence permits redistribution (likely Open Government Licence, unverified).
- Whether the 2.2 MB figure includes three.js from the CDN.
- Live look of each remix: judged from authors' screenshots in `zz85/slop-cities/screenshots/`, not by running them.
- Overpass counts were not re-run (servers at capacity); counts come from the OSM API map extract, which includes ways crossing the bbox edge (filtered by centroid).
