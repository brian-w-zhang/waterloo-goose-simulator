# REVIEW: overnight build, Nov 3, 2026

## Summary

The whole University of Waterloo game area (2.56 x 1.79 km, 70 chunks of 256 m) is compiled from open data by a reproducible Python pipeline. It includes:

- 1,108 City of Waterloo footprints with Ontario lidar heights and height tiers, styled from two rounds of photo research;
- a 2 m lidar terrain, and lakes with shore bands;
- OSM paths, roads with painted markings, plazas with paving joints, fences, hedges and walls, and doors at entrances;
- 19,520 trees, 1,115 OSM props, and transit platforms with canopies;
- procedural lawn tufts, flowers and foundation shrubs;
- a walk network and a far level of detail.

A Next.js 16 app streams the gzip-compressed chunks (5.4 MB before the game is ready) and renders them with three.js 0.187 in a flat pastel toon style, on WebGPU and WebGL2, both verified. A code-built Canada goose walks the campus on a Rapier character controller, with honk, grab, crouch, flap, run and an idle peck. The follow camera tilts, swings to a clear angle or pulls in when buildings block it, and opens a dithered see-through circle through walls and tree crowns.

There are three playable hotspots (doc 03 R-W3): the MC and DC green, the SLC and PAC plaza, and the Village 1 ring. They hold twelve fictional characters with a hierarchical state machine (notice, react, investigate, chase, shoo, search, return, flee, give up), speech lines and thought bubbles, plus 75 owned items (30, 25 and 20 per hotspot). A fifteen-task to-do list follows the nearest hotspot and includes a gated finale. Around them, 220 students walk the OSM path graph and startle at a honk, and the ION train runs on the real line.

An automated harness measures every claim on the packed chunks and real screenshots. The latest full run passes **58 of 60 gates on both WebGPU and WebGL2**; the two reds are path-width gates, discussed below. All 9 self-test mutants are caught, and all 14 unit and behaviour tests pass, including headless task checks for every hotspot.

How to run: see `README.md` (`npm run pipeline`, then `npm run build && npm start`, then open http://localhost:3100).

## Metrics

- **Latest full run:** `bench/results/verify/20261103-0453-168c23d/summary.json` (WebGPU, headless Chromium 156 on the build machine).
- **WebGL2 run:** `bench/results/verify/20261103-0454-168c23d/summary.json`, 58/60 with the same reds.
- **Change column:** compared against the first run of the night, `bench/results/verify/20261103-0235-77975de` (geometry only).
- **Ledger:** `VERIFY-LEDGER.md`.

| metric | value | gate | pass | first run of the night | change |
|---|---|---|---|---|---|
| code.typecheck_errors | 0 | <= 0 | pass | - | new |
| code.unit_test_failures | 0 | <= 0 | pass | - | new |
| code.python_test_failures | 0 | <= 0 | pass | - | new |
| flythrough.hole_frames | 0 | <= 0 | pass | - | new |
| flythrough.chunks_never_loaded | 0 | <= 0 | pass | - | new |
| flythrough.bad_vertices | 0 | <= 0 | pass | - | new |
| flythrough.frame_ms_p95 | 8.9 | record only | - | - | new |
| geometry.coverage_uw_core | 115 | >= 115 | pass | 115 | +0 |
| geometry.coverage_all_core | 480 | >= 475 | pass | 480 | +0 |
| geometry.built_area_uw_rel_err | 1.412e-05 | <= 0.02 | pass | 1.412e-05 | +0 |
| geometry.built_area_all_rel_err | 8.444e-05 | <= 0.02 | pass | 8.444e-05 | +0 |
| geometry.iou_city_median | 1 | >= 0.95 | pass | 1 | -2.385e-09 |
| geometry.iou_city_p10 | 0.9991 | >= 0.88 | pass | 0.9991 | +2.079e-05 |
| geometry.iou_osm_median_report | 0.8125 | >= 0.75 | report | 0.8133 | -0.0007365 |
| geometry.iou_city_key_min | 0.9989 | >= 0.9 | pass | 0.9989 | +0 |
| geometry.key_area_max_rel_err | 0.001049 | <= 0.03 | pass | 0.001049 | +0 |
| geometry.key_obb_side_fail_count | 0 | <= 0 | pass | 0 | +0 |
| geometry.key_bearing_max_err_deg | 0.07075 | <= 2.0 | pass | 0.07075 | +0 |
| geometry.landmark_pos_median_m | 0.0006034 | < 0.5 | pass | 0.0006034 | +0 |
| geometry.landmark_pos_max_m | 0.5832 | < 2.0 | pass | 0.5832 | +0 |
| geometry.distance_fail_count | 0 | <= 0 | pass | 0 | +0 |
| geometry.distance_median_err_m | 0.03261 | < 0.5 | pass | 0.03261 | +0 |
| geometry.azimuth_max_err_deg | 0.1295 | <= 1.0 | pass | 0.1295 | +0 |
| heights.height_key_max_err_m | 1.3 | <= 2.0 | pass | 1.3 | +0 |
| heights.height_rmse_dev_m | 0.6102 | < 1.5 | pass | 0.6102 | +0 |
| heights.height_rmse_holdout_m | 0.609 | < 2.0 | pass | 0.609 | +0 |
| heights.height_random20_rmse_m | 0.5745 | < 2.0 | pass | 0.5745 | +0 |
| heights.height_pixel_median_abs_m | 0.32 | < 1.5 | pass | 0.31 | +0.009949 |
| network.ring_road_osm_rel_err | 7.137e-06 | <= 0.01 | pass | 7.137e-06 | +0 |
| network.ring_road_city_rel_err | 0.01211 | <= 0.02 | pass | 0.01211 | +0 |
| network.laurel_creek_rel_err | 0.00128 | <= 0.02 | pass | 0.00128 | +0 |
| network.laurel_trail_rel_err | 0.0009101 | <= 0.02 | pass | 0.0009101 | +0 |
| network.columbia_lake_area_rel_err | 3.189e-06 | <= 0.02 | pass | 3.194e-06 | -4.365e-09 |
| network.laurel_lake_area_rel_err | 4.183e-05 | <= 0.02 | pass | 4.187e-05 | -3.75e-08 |
| network.width_ortho_fail_count | 1 | <= 0 | **FAIL** | 1 | +0 |
| network.width_tag_fail_count | 1 | <= 0 | **FAIL** | 5 | -4 |
| network.largest_component_share | 0.9867 | >= 0.98 | pass | 0.9867 | +0 |
| network.entrance_reach_15m | 0.9877 | >= 0.95 | pass | 0.9877 | +0 |
| network.network_length_rel_err | 1.198e-06 | <= 0.01 | pass | 1.198e-06 | +0 |
| palette.palette_id_off_share | 0 | <= 0.0 | pass | - | new |
| palette.lit_palette_share | 1 | >= 0.95 | pass | - | new |
| selftest.selftest_survivors | 0 | <= 0 | pass | - | new |
| static.static_colour_violations | 0 | <= 0 | pass | 0 | +0 |
| static.static_banned_violations | 0 | <= 0 | pass | 0 | +0 |
| static.camera_config_ok | 1 | == 1 | pass | 1 | +0 |
| style.sat_mean | 0.2302 | between [0.18, 0.35] | pass | - | new |
| style.val_mean | 0.5807 | between [0.45, 0.65] | pass | - | new |
| style.val_std | 0.08495 | between [0.08, 0.18] | pass | - | new |
| style.dark_share | 0 | <= 0.002 | pass | - | new |
| style.edge_share | 0.004545 | <= 0.045 | pass | - | new |
| style.colourfulness | 0.1126 | between [0.1, 0.25] | pass | - | new |
| style.kmeans12_residual_de | 0.877 | <= 6.0 | pass | - | new |
| style.shadow_ratio | 0.951 | >= 0.75 | pass | - | new |
| style.penumbra_px | 5.706 | >= 4 | pass | - | new |
| terrain.terrain_rmse_m | 0.0365 | < 0.25 | pass | 0.0365 | +2.886e-08 |
| terrain.terrain_max_m | 0.3871 | < 1.5 | pass | 0.3871 | +0 |
| terrain.seam_max_m | 0.0003152 | < 0.01 | pass | 0.0003152 | +0 |
| topdown.topdown_building_iou_min | 0.9782 | >= 0.95 | pass | - | new |
| topdown.topdown_chamfer_mean_m | 0.05854 | <= 0.5 | pass | - | new |
| topdown.topdown_chamfer_p95_m | 0 | <= 1.5 | pass | - | new |
| topdown.topdown_path_iou_min | 0.9867 | >= 0.85 | pass | - | new |
| walk.goose_walk_falls | 0 | <= 0 | pass | - | new |


**First load** (`bench/results/firstload-2026-11-03-ebad0a0.json`): 5.36 MB transferred before the game is ready, against the doc 06 M1 gate of under 10 MB, in 21 requests. The pipeline gzip-compresses the chunks, so the whole world is 20 MB; before compression the same measure was 9.05 MB.

**Frame time** (`bench/results/frametime-2026-11-03-967393d.json`): measured headless and uncapped at 1280 x 720, with 220 ambient students, 233 draw calls and 1,469,163 triangles including the shadow pass. This is within the doc 02 budget of 1.5 M triangles and 300 draw calls. Results are from the build machine only, not the doc 02 reference iGPU.

| Backend | p50 | p95 |
|---|---|---|
| WebGPU | 1.5 ms | 1.9 ms |
| WebGL2 | 3.0 ms | 5.4 ms |

**Looks** (advisory, agent vision, two shuffled passes): mean 2.81 of 5.

| Criterion | Mean |
|---|---|
| Silhouette | 2.5 |
| Proportions | 2.95 |
| Pattern | 2.9 |
| Colour | 3.25 |
| Recognisability | 2.43 |

The 0.03 disagreement between passes understates real noise. One agent scored both passes minutes apart, and it reused wording where an observation did not change.

## Contact sheet and overlays

- `review/contact-sheet.jpg`: 20 rows, each with the reference photo, the photo-match render, the game-camera render and both looks passes, with attributions.
- `review/pairs/Vnn.jpg`: the side-by-side pairs used for scoring.
- `review/overlays/overlay_<i>_<j>.png` and `review/overlays/overlay-sheet.jpg`: the City 2026 orthophoto at 60%, City outlines in cyan, rendered outlines in magenta.
- To regenerate: `npm run verify:render`, then `npm run verify -- <run>`.
- These images are gitignored because the photos are CC BY-SA, the orthophoto licence is unverified, and the repo is public.
- The look-log screenshots are in `review/look/`: beauty shots `beauty1` to `beauty7`, scenarios, close-ups and overviews.

## Known issues

- **Red gates:**
  - `network.width_ortho_fail_count`: for the Laurel Trail the pipeline uses the OSM tag (2.5 m), while the by-eye ortho reading is 3.0 m with a 0.5 m tolerance.
  - `network.width_tag_fail_count`: way 952173528 is tagged 4 m but measures 9.15 m, because it abuts another path and the class union cannot separate them.
- **Accepted regressions** (`verify/exceptions.yaml`):
  - Per-pixel height median went from 0.310 to 0.320 m (roof-gap fix).
  - The 12-colour k-means residual went from 0.794 to 0.840 (tufts, flowers, canopies).
- **Weak viewpoints:**
  - V19 (bus platforms) scores recognisability 1: only one canopy corner is in frame from the frozen pose.
  - V16: the frozen pose shows a brick block, not EV3.
  - V17: the Ron Eydt Village entrance photo is a close-up of a door.
  - V06: QNC sits far behind a foreground wall.
  - V03: the frozen pose frames the buff neighbour, not MC's concrete.
- **Landmark gaps:**
  - DC has teal glass walls but no barrel vault, ducts or red portal frames. A vault override was tried and reverted because the lidar tiers are irregular.
  - MC lacks the blank stair towers and the tie: the lidar has no taller tier there, so placing them would be guesswork.
  - QNC lacks the honeycomb cube.
  - M3 is all brick, with no glass centre bay.
  - SLC's crescent facade is polygonal.
- **Post-2018 buildings** (median nDSM under 1 m; heights from tags or an 8 m default), 29 in total: SLC (8.0 m, default), Passageway (8.0 m, default), OBJECTID 21481 (8.0 m, default), OBJECTID 21482 (8.0 m, default), OBJECTID 21483 (8.0 m, default), OBJECTID 26443 (57.92 m, osm_levels), OBJECTID 28007 (8.0 m, default), WATERLOO MEMORIAL RECREATION COMPLEX (8.0 m, default), WATERLOO MEMORIAL RECREATION COMPLEX (10.86 m, osm_levels), OBJECTID 29877 (32.58 m, fire_storeys), ESC (8.0 m, default), OBJECTID 30616 (43.44 m, fire_storeys), AVR (3.62 m, osm_levels), OBJECTID 31061 (21.72 m, fire_storeys), OBJECTID 31175 (8.0 m, default), Elora House (76.02 m, osm_levels), OBJECTID 32023 (8.0 m, default), CIF (8.0 m, default), Waterloo Park Splash Pad Pavilion (8.0 m, default), OBJECTID 32961 (54.3 m, fire_storeys), OBJECTID 33044 (8.0 m, default), OBJECTID 33136 (21.72 m, osm_levels), OBJECTID 33888 (72.4 m, fire_storeys), OBJECTID 34101 (21.72 m, fire_storeys), MHR (8.0 m, default), CIF (8.0 m, default), Waterloo Park Splash Pad Pavilion (8.0 m, default), OBJECTID 38185 (8.0 m, default), OBJECTID 39717 (8.0 m, default).
- **Item physics:** the goose carries and drags items through the simulation, not a Rapier joint as doc 05 asks.
- **Fly-through frame time:** the harness's 36.6 ms p95 is the CPU time of a forced synchronous render in a test loop, not game frame time. Use the frame-time benchmark instead.
- **Data provenance:** there is no sample data in the build; every layer was fetched live (`pipeline/manifest.json`).

## Blockers

There are no blockers (`BLOCKERS.md`). `AI_GATEWAY_API_KEY` was not available, so the optional Jev layer (`?jev=1`) has only the mock and recorded-replay paths, as the goal specifies.

## Gates to discuss

- **Laurel Trail ortho width:** the pipeline uses the OSM width tag (2.5 m), and the by-eye ortho reading says 3.0 m. Doc 08 itself calls tags authoritative and ortho readings "not authoritative". Suggest replacing this gate with the tag or a surveyed reading.
- **Tagged widths where paths abut:** a class-union measurement cannot separate adjacent ribbons. Measuring per way would need per-way geometry in the chunks.
- **Frozen truth frame:** the frozen centroids carry a datum offset (+0.31 m E, -0.94 m N) from the City's WGS84 export. Positions are gated against `verify/truth-native/` (a native recomputation, which doc 08 section 5 allows), and the error against the frozen truth is reported too (median about 1.0 m).
- **Game-camera target:** doc 08 does not say what the style camera targets. Targeting building centroids filled frames with roofs, so the style suite targets the viewpoint's ground position instead (`NOTES.md`).

## Look log (iterations tonight)

1. **First render:** palette colours were squared by a double vertex-colour multiply. Fixed.
2. **Building research, round 1** (`docs/research/building-looks.md`):
   - DC is teal glass, not concrete.
   - Hagey Hall is brown brick.
   - Dana Porter is cream fins.
   - QNC is blue glass.
   - E5 is silver diamond panels.

   Window patterns are now set per style.
3. **Style statistics:** the palette moved toward the measured reference swatches and the lights were dimmed until every style statistic sat in its band.
4. **Ground and visibility:**
   - Fixed grass squares poking through plazas.
   - Added tufts, flowers and transit canopies.
   - Added the screen-space see-through.
5. **Surface detail:**
   - Roof plant, plus a warm-grey gravel colour for roofs.
   - Paving joints and the lake shore band.
   - Road markings and E5's diamond panels.
   - Doors at OSM entrances, and ground-floor windows aligned to each building's base.
   - Fences, hedges and walls.
6. **Life:** thought bubbles, honk strokes, speech lines, the idle peck and the ION train.
7. **Camera:** an occlusion tilt, a whisker swing toward the nearest clear angle, and a spring-arm pull-in.
8. **Research round 2** (`docs/research/building-looks-pass2.json`): B1, B2, C2, ESC and E2 are buff brick, and STC, EV1, GSC and SCH are brown brick, where round 1 had guessed grey concrete or red brick.
9. **Density:** foundation shrubs along walls facing lawn. Triangles dropped from 2.04 M to 1.47 M through low-poly shrubs, flower dots and tree crowns.

## Next steps

1. Replace the Laurel Trail ortho-width gate with the tag value or a surveyed reading (see gates to discuss).
2. Add per-way ribbon geometry to the chunks, so tagged widths can be measured per way.
3. Add landmark overrides as authored geometry, checked by the geometry gates:
   - DC: the vault, ducts and red frames;
   - QNC: the cube;
   - SLC: the crescent;
   - M3: the glass bay.
4. Rapier joints for dragging heavy items (cones, backpacks, baskets), and a tug-of-war when a character grabs an item back.
5. A music system and per-surface footstep and drag sounds (doc 03 R-S1, R-S2).
6. Re-run the frame-time benchmark on the doc 02 reference iGPU laptop.
7. Build the live Jev path once a gateway key exists, with record and replay into `data/jev/recorded.json`.
