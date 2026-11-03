# REVIEW: overnight build, Nov 3, 2026

## Summary

The whole University of Waterloo game area (2.56 x 1.79 km, 70 chunks of 256 m) is compiled from open data by a reproducible Python pipeline. It includes:

- 1,108 City of Waterloo footprints with Ontario lidar heights and height tiers, styled from two rounds of photo research;
- OSM round roofs for the Davis Centre vault (teal glass with ducts) and the parking lots' painted stalls;
- a 2 m lidar terrain, and lakes with shore bands;
- OSM paths, roads with painted markings, plazas with paving joints, fences, hedges and walls, and doors at entrances;
- monument signs at every named building's main door, and fascia signs for the plaza's shops and restaurants from OSM, spread so they never overlap;
- 19,520 trees, 1,115 OSM props, and transit platforms with canopies;
- procedural lawn tufts, flowers and foundation shrubs;
- a walk network and a far level of detail.

A Next.js 16 app streams the gzip-compressed chunks (6.2 MB before the game is ready) and renders them with three.js 0.187 in a flat pastel toon style, on WebGPU and WebGL2, both verified. A code-built Canada goose walks the campus on a Rapier character controller, with honk, grab, crouch, flap, run, swim and an idle peck. Its head turns toward nearby items and people, and carried items swing from its bill. Some carried items change the honk (a traffic cone resonates, a cup muffles it). Loose items get shoved when the goose runs into them, apples and balls roll downhill, and anything dropped in water floats and drifts. The follow camera tilts, swings to a clear angle or pulls in when buildings block it, and opens a dithered see-through circle through walls and tree crowns.

There are three playable hotspots (doc 03 R-W3): the MC and DC green, the SLC and PAC plaza, and the Village 1 ring. They hold twelve fictional characters, each with a hierarchical state machine (notice, react, investigate, chase, shoo, search, return, flee, give up, tug-of-war, pratfall). Characters walk Recast navmeshes baked in the browser around each hotspot (about 110 ms each), so they path around buildings. They have speech lines and thought bubbles, plus 75 items (30, 25 and 20 per hotspot). The goose can hide in bushes, win tug-of-wars, and bow with the spare hard hat until someone puts it on its head. It grabs whatever its bill points at. Glass and china dropped at a run shatter, and their owner sets out a new one 20 s later.

A seventeen-task to-do list follows the nearest hotspot and includes a gated finale. A Menace score adds combos, and a "No Geese" sign goes up once a hotspot is mostly done. A game clock drives class-change crowd waves, and an adaptive procedural piano plays calm or chase phrases. Around the hotspots, up to 330 students walk the OSM path graph and startle at a honk, and the ION train runs on the real line.

When a character gives up a chase, the optional Jev layer (`?jev=1`) picks their next move through the Vercel AI Gateway, called from the server only (about 280 ms, $0.000017 a call). Calls are cached and replayed from `data/jev/recorded.jsonl`, with a deterministic mock fallback.

An automated harness measures every claim on the packed chunks and real screenshots, and it plays the game. A headless playtest drives the goose with real key presses at all three hotspots (it teleports between them), records a video and must finish at least eight tasks. It finished all nine in seven straight runs across both backends. The latest full run passes **62 of 64 gates on both WebGPU and WebGL2**; the two reds are path-width gates, discussed below. All 9 self-test mutants are caught, and all 24 unit and behaviour tests pass, plus 5 pipeline tests.

How to run: see `README.md` (`npm run pipeline`, then `npm run build && npm start`, then open http://localhost:3100).

## Metrics

- **Latest full run:** `bench/results/verify/20261103-0927-90bc483/summary.json` (WebGPU, headless Chromium 156 on the build machine).
- **WebGL2 run:** `bench/results/verify/20261103-0928-90bc483-webgl/summary.json`, 62/64 with the same reds (the WebGL2 column below). An earlier WebGL2 run (0624) finished only 3 of 4 playtest tasks because walking up to the coffee shoved it out of reach. That was fixed in 666acfb.
- **Change column:** compared against the first run of the night, `bench/results/verify/20261103-0235-77975de` (geometry only).
- **Ledger:** `VERIFY-LEDGER.md`.

| metric | value | gate | pass | first run of the night | change | WebGL2 |
|---|---|---|---|---|---|---|
| code.typecheck_errors | 0 | <= 0 | pass | - | new | 0 |
| code.unit_test_failures | 0 | <= 0 | pass | - | new | 0 |
| code.python_test_failures | 0 | <= 0 | pass | - | new | 0 |
| flythrough.hole_frames | 0 | <= 0 | pass | - | new | 0 |
| flythrough.chunks_never_loaded | 0 | <= 0 | pass | - | new | 0 |
| flythrough.bad_vertices | 0 | <= 0 | pass | - | new | 0 |
| flythrough.frame_ms_p95 | 11.2 | record only | - | - | new | 14.6 |
| geometry.coverage_uw_core | 115 | >= 115 | pass | 115 | +0 | 115 |
| geometry.coverage_all_core | 480 | >= 475 | pass | 480 | +0 | 480 |
| geometry.built_area_uw_rel_err | 1.412e-05 | <= 0.02 | pass | 1.412e-05 | +0 | 1.412e-05 |
| geometry.built_area_all_rel_err | 8.444e-05 | <= 0.02 | pass | 8.444e-05 | +0 | 8.444e-05 |
| geometry.iou_city_median | 1 | >= 0.95 | pass | 1 | -2.385e-09 | 1 |
| geometry.iou_city_p10 | 0.9991 | >= 0.88 | pass | 0.9991 | +2.079e-05 | 0.9991 |
| geometry.iou_osm_median_report | 0.8125 | >= 0.75 | report | 0.8133 | -0.0007365 | 0.8125 |
| geometry.iou_city_key_min | 0.9989 | >= 0.9 | pass | 0.9989 | +0 | 0.9989 |
| geometry.key_area_max_rel_err | 0.001049 | <= 0.03 | pass | 0.001049 | +0 | 0.001049 |
| geometry.key_obb_side_fail_count | 0 | <= 0 | pass | 0 | +0 | 0 |
| geometry.key_bearing_max_err_deg | 0.07075 | <= 2.0 | pass | 0.07075 | +0 | 0.07075 |
| geometry.uw_buildings_signed_share | 1 | >= 0.95 | pass | - | new | 1 |
| geometry.signs_inside_footprints | 0 | <= 0 | pass | - | new | 0 |
| geometry.landmark_pos_median_m | 0.0006034 | < 0.5 | pass | 0.0006034 | +0 | 0.0006034 |
| geometry.landmark_pos_max_m | 0.5832 | < 2.0 | pass | 0.5832 | +0 | 0.5832 |
| geometry.distance_fail_count | 0 | <= 0 | pass | 0 | +0 | 0 |
| geometry.distance_median_err_m | 0.03261 | < 0.5 | pass | 0.03261 | +0 | 0.03261 |
| geometry.azimuth_max_err_deg | 0.1295 | <= 1.0 | pass | 0.1295 | +0 | 0.1295 |
| heights.height_key_max_err_m | 1.3 | <= 2.0 | pass | 1.3 | +0 | 1.3 |
| heights.height_rmse_dev_m | 0.5317 | < 1.5 | pass | 0.6102 | -0.0785 | 0.5317 |
| heights.height_rmse_holdout_m | 0.608 | < 2.0 | pass | 0.609 | -0.001064 | 0.608 |
| heights.height_random20_rmse_m | 0.5502 | < 2.0 | pass | 0.5745 | -0.02423 | 0.5502 |
| heights.height_pixel_median_abs_m | 0.34 | < 1.5 | pass | 0.31 | +0.02996 | 0.34 |
| network.ring_road_osm_rel_err | 7.137e-06 | <= 0.01 | pass | 7.137e-06 | +0 | 7.137e-06 |
| network.ring_road_city_rel_err | 0.01211 | <= 0.02 | pass | 0.01211 | +0 | 0.01211 |
| network.laurel_creek_rel_err | 0.00128 | <= 0.02 | pass | 0.00128 | +0 | 0.00128 |
| network.laurel_trail_rel_err | 0.0009101 | <= 0.02 | pass | 0.0009101 | +0 | 0.0009101 |
| network.columbia_lake_area_rel_err | 3.189e-06 | <= 0.02 | pass | 3.194e-06 | -4.365e-09 | 3.189e-06 |
| network.laurel_lake_area_rel_err | 4.183e-05 | <= 0.02 | pass | 4.187e-05 | -3.75e-08 | 4.183e-05 |
| network.width_ortho_fail_count | 1 | <= 0 | **FAIL** | 1 | +0 | 1 |
| network.width_tag_fail_count | 1 | <= 0 | **FAIL** | 5 | -4 | 1 |
| network.largest_component_share | 0.9867 | >= 0.98 | pass | 0.9867 | +0 | 0.9867 |
| network.entrance_reach_15m | 0.9877 | >= 0.95 | pass | 0.9877 | +0 | 0.9877 |
| network.network_length_rel_err | 1.198e-06 | <= 0.01 | pass | 1.198e-06 | +0 | 1.198e-06 |
| palette.palette_id_off_share | 0 | <= 0.0 | pass | - | new | 0 |
| palette.lit_palette_share | 1 | >= 0.95 | pass | - | new | 1 |
| play.playtest_tasks_done | 9 | >= 8 | pass | - | new | 9 |
| play.playtest_page_errors | 0 | <= 0 | pass | - | new | 0 |
| selftest.selftest_survivors | 0 | <= 0 | pass | - | new | 0 |
| static.static_colour_violations | 0 | <= 0 | pass | 0 | +0 | 0 |
| static.static_banned_violations | 0 | <= 0 | pass | 0 | +0 | 0 |
| static.camera_config_ok | 1 | == 1 | pass | 1 | +0 | 1 |
| style.sat_mean | 0.2327 | between [0.18, 0.35] | pass | - | new | 0.2327 |
| style.val_mean | 0.5778 | between [0.45, 0.65] | pass | - | new | 0.5778 |
| style.val_std | 0.08195 | between [0.08, 0.18] | pass | - | new | 0.08195 |
| style.dark_share | 0 | <= 0.002 | pass | - | new | 0 |
| style.edge_share | 0.004645 | <= 0.045 | pass | - | new | 0.004645 |
| style.colourfulness | 0.1134 | between [0.1, 0.25] | pass | - | new | 0.1134 |
| style.kmeans12_residual_de | 0.925 | <= 6.0 | pass | - | new | 0.9305 |
| style.shadow_ratio | 0.951 | >= 0.75 | pass | - | new | 0.951 |
| style.penumbra_px | 5.706 | >= 4 | pass | - | new | 5.704 |
| terrain.terrain_rmse_m | 0.0365 | < 0.25 | pass | 0.0365 | +2.886e-08 | 0.0365 |
| terrain.terrain_max_m | 0.3871 | < 1.5 | pass | 0.3871 | +0 | 0.3871 |
| terrain.seam_max_m | 0.0003152 | < 0.01 | pass | 0.0003152 | +0 | 0.0003152 |
| topdown.topdown_building_iou_min | 0.9782 | >= 0.95 | pass | - | new | 0.9782 |
| topdown.topdown_chamfer_mean_m | 0.05336 | <= 0.5 | pass | - | new | 0.05335 |
| topdown.topdown_chamfer_p95_m | 0 | <= 1.5 | pass | - | new | 0 |
| topdown.topdown_path_iou_min | 0.9867 | >= 0.85 | pass | - | new | 0.9867 |
| walk.goose_walk_falls | 0 | <= 0 | pass | - | new | 0 |

**First load** (`bench/results/firstload-2026-11-03-666acfb.json`): 6.19 MB transferred before the game is ready, against the doc 06 M1 gate of under 10 MB, in 23 requests and 626 ms on localhost.

**Frame time** (`bench/results/frametime-2026-11-03-ff69352.json`, last run after 90bc483): measured headless and uncapped at 1280 x 720, with the full crowd, 241 draw calls and 1,371,684 triangles including the shadow pass. This is within the doc 02 budget of 1.5 M triangles and 300 draw calls. Before 90c1eb7, the hidden crowd slots added 0.5 M triangles. Results are from the build machine only, not the doc 02 reference iGPU.

| Backend | p50 | p95 |
|---|---|---|
| WebGPU | 1.5 ms | 1.9 ms |
| WebGL2 | 3.1 ms | 4.6 ms |

**Heights baseline** (`bench/results/heights-baseline-2026-11-03-8cd9ca7.json`, doc 06 section 5): against lidar p90 on 118 UW footprints, the packed lidar tiers have an RMSE of 0.59 m. OSM levels x 3.5 m gives 6.63 m (61 footprints with a tag), and City FIRE_STOREYS x 3.5 m gives 5.10 m.

**Looks** (advisory, agent vision, shuffled): mean 2.86 of 5.

| Criterion | Mean |
|---|---|
| Silhouette | 2.5 |
| Proportions | 2.95 |
| Pattern | 3.0 |
| Colour | 3.3 |
| Recognisability | 2.53 |

The 0.03 disagreement between passes understates real noise. One agent scored both passes, and in the latest runs both came from one shuffled viewing (`looks.json` says so).

The scores have plateaued for a structural reason. The 20 viewpoints are frozen photo-match poses, and several frame something other than the landmark: V12 stands 100 m from the SLC courtyard where the panorama was taken, V16 faces EV2 in front of EV3, and V06 faces Health Services in front of QNC. Cameras may not be moved and the world may not be edited to please a photo, so most work since went into what the player sees. That work is the play camera, tree fading, planting and furniture from data, and the beauty sets in `review/look/beauty10` and `review/look/ugg_compare.jpg`, which the photo scores do not measure. Re-calibrating V06, V12 and V16 (a human decision under doc 08) would make the scores more informative.

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
  - Top-down chamfer mean went from 0.05854 to 0.05865 m (the DC vault overhangs its footprint by centimetres).
  - Random-20 height RMSE went from 0.5477 to 0.5502 m when the lidar tiers were smoothed (dev RMSE improved from 0.569 to 0.528 m).
  - Dev height RMSE went from 0.5279 to 0.5317 m when tier teeth stopped moving to levels they don't touch (a correctness fix).
- **Viewpoints with recognisability 1 or 2** (scores from both passes):
  - V02 (2 / 3): DC is guessable from the teal glass but lacks its vault and ducts
  - V03 (2 / 2): with a conifer in front and a buff wall it does not read as MC's concrete bands
  - V06 (1 / 1): QNC is a faint shape behind trees; not recognisable
  - V10 (2 / 2): brown brick behind trees; not clearly Hagey Hall
  - V11 (2 / 2): a glass wall with a door over a courtyard; recognisable only with the label
  - V12 (2 / 2): the plaza and glass ribbon only hint at the SLC courtyard
  - V16 (1 / 1): EV3 is not in view; the visible building is a different brick block
  - V17 (1 / 1): the REV entrance is not identifiable
  - V19 (2 / 1): a canopy hints at a transit stop, not specifically these platforms
  - V20 (3 / 2): the platform canopy beside the rail bed and E5 behind make it guessable as the ION stop
- **Landmark gaps:**
  - DC now has its OSM round-roof vault with teal ducts, but no red portal frames.
  - MC has the pink tie (placed by a ray from the V04 photo pose), but no blank stair towers: the lidar has no taller tier there, so placing them would be guesswork.
  - QNC has blue glass over a charcoal brick base, but no honeycomb cube.
  - M3 is all brick, with no glass centre bay.
  - SLC's crescent facade is polygonal, and its brick ends are missing.
- **Post-2018 buildings** (median nDSM under 1 m; heights from tags or an 8 m default), 29 in total: SLC (8.0 m, default), Passageway (8.0 m, default), OBJECTID 21481 (8.0 m, default), OBJECTID 21482 (8.0 m, default), OBJECTID 21483 (8.0 m, default), OBJECTID 26443 (57.92 m, osm_levels), OBJECTID 28007 (8.0 m, default), WATERLOO MEMORIAL RECREATION COMPLEX (8.0 m, default), WATERLOO MEMORIAL RECREATION COMPLEX (10.86 m, osm_levels), OBJECTID 29877 (32.58 m, fire_storeys), ESC (8.0 m, default), OBJECTID 30616 (43.44 m, fire_storeys), AVR (3.62 m, osm_levels), OBJECTID 31061 (21.72 m, fire_storeys), OBJECTID 31175 (8.0 m, default), Elora House (76.02 m, osm_levels), OBJECTID 32023 (8.0 m, default), CIF (8.0 m, default), Waterloo Park Splash Pad Pavilion (8.0 m, default), OBJECTID 32961 (54.3 m, fire_storeys), OBJECTID 33044 (8.0 m, default), OBJECTID 33136 (21.72 m, osm_levels), OBJECTID 33888 (72.4 m, fire_storeys), OBJECTID 34101 (21.72 m, fire_storeys), MHR (8.0 m, default), CIF (8.0 m, default), Waterloo Park Splash Pad Pavilion (8.0 m, default), OBJECTID 38185 (8.0 m, default), OBJECTID 39717 (8.0 m, default).
- **Item physics:** dragged items (cones, totes, baskets) are Rapier dynamic bodies on a spherical joint at the bill (`tools/scenario_drag.mjs`). Light items are carried, shoved, rolled and floated by a small kinematic step instead. Items do not stack, and fragile items do not break.
- **Fly-through frame time:** the harness's 36.6 ms p95 is the CPU time of a forced synchronous render in a test loop, not game frame time. Use the frame-time benchmark instead.
- **Error handling:** an independent silent-failure review of the runtime found 10 issues; all are fixed (commit b6d2815). Failed chunks now retry with backoff, one frame exception no longer freezes the game, navmeshes wait for their chunks, and Jev failures are logged. A forced 404 on one chunk was logged, reported in `window.__wgs.info()` and recovered.
- **Correctness review:** a second independent review of this session's game code found six bugs, all fixed (commit f9ce7f3) with regression tests. Examples: an owner could pick up the pieces of a smashed mug, people stalled beside a standing goose, dragged items jumped to the goose when grabbed, and shop-front walls missed signs in a neighbouring chunk.
- **Jev cold start:** the first live call after a server start used to time out at 1.4 s, so a warm-up request now opens the gateway connection when `?jev=1` starts.
- **Data provenance:** there is no sample data in the build; every layer was fetched live (`pipeline/manifest.json`).

## Blockers

There are no blockers (`BLOCKERS.md`). The gateway key is read only by the Next.js server route and never reaches the client or the repo.

## Gates to discuss

- **Laurel Trail ortho width:** the pipeline uses the OSM width tag (2.5 m), and the by-eye ortho reading says 3.0 m. Doc 08 itself calls tags authoritative and ortho readings "not authoritative". Suggest replacing this gate with the tag or a surveyed reading.
- **Tagged widths where paths abut:** a class-union measurement cannot separate adjacent ribbons. Measuring per way would need per-way geometry in the chunks.
- **Look leakage:** the research rows behind M3's glass bay and QNC's charcoal base cite the same Commons photos as viewpoints V05 and V06, so those two pairs are not independent tests of those features (`NOTES.md`, 06:55). Research should cite photos outside the 20 viewpoints.
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
10. **Landmarks:** the DC vault from OSM `roof:shape=round` with teal ducts, MC's pink tie, QNC's charcoal base, and parapets on flat roofs.
11. **Signs:** UW monument signs (proportions from the UW sign standard) at main doors, a wall plaque where there is no free ground, and plaza shop fascias de-overlapped along each wall.
12. **Roofs and ground:** a darker light-roof swatch, so low terraces stop reading as holes in a wall from above. Parking stalls became their own class, so they never paint over drive aisles.
13. **People:** chunky nose-only figures with hairstyles, eye contact with the goose, and tug, fall, clap, shake and dressing gestures. The groundskeeper got a dome hard hat.
14. **Tiers:** lidar tier outlines simplified at 1.2 m and opened by 2 px, removing pixel stair-steps (ring vertices 54,700 to 40,392).
15. **Goose:** the run reads (neck forward and low), the flap snaps open to a full sideways span, and the camera's lean toward people scales with zoom.
16. **UGG frame:** side-by-side against the UGG screenshots (`review/look/ugg_compare.jpg`, local only) showed foreground trees as huge flat shapes and the goose too small. Trees now fade whole when they cover the goose or stand well in front of it (no holes or ghosts), and the play camera is 18 m at 24 degrees (goose about 11% of frame height, inside the amended band).
17. **Density from data:** the 33 OSM gardens, 2 flowerbeds and 9 scrub areas are planted with shrubs and flowers (which are also hiding spots). Six more street-furniture kinds come from OSM: stop signs (moved to the verge), UW blue-light emergency phones, recycling, post boxes, notice boards and bollards.
18. **Tools:** `tools/gallery.mjs` renders two game-camera angles of every key building; scenario scripts cover the tug-of-war and the hard hat.

## Next steps

1. Replace the Laurel Trail ortho-width gate with the tag value or a surveyed reading (see gates to discuss).
2. Add per-way ribbon geometry to the chunks, so tagged widths can be measured per way.
3. Add landmark overrides as authored geometry, checked by the geometry gates:
   - DC: the red portal frames;
   - QNC: the cube;
   - SLC: the crescent and brick ends;
   - M3: the glass bay.
4. Rapier bodies for light items too, so they can stack and topple, plus fragile items that break (spec I-7, I-9).
5. Drag sounds per surface (footsteps already change between grass, paving and water).
6. Re-run the frame-time benchmark on the doc 02 reference iGPU laptop.
