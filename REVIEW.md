# REVIEW: overnight build, Nov 3, 2026

## Summary

The whole University of Waterloo game area (2.56 x 1.79 km, 70 chunks of 256 m) is compiled from open data by a reproducible Python pipeline: 1,108 City of Waterloo footprints with Ontario lidar heights and height tiers, a 2 m lidar terrain, lakes with shore bands, OSM paths, roads with painted markings, plazas with paving joints, 19,520 trees, 1,115 OSM props, transit platforms with canopies, lawn tufts and flowers, a walk network and a far LOD. A Next.js 16 app streams the chunks and renders them with three.js 0.187 (WebGPU, WebGL2 fallback, both verified) in a flat pastel toon style tuned against the measured reference statistics. A code-built Canada goose walks it on a Rapier character controller with a follow camera that lifts and opens a see-through circle when buildings or tree crowns block it. On the MC and DC green there is a playable hotspot: five fictional characters with a hierarchical state machine (notice, react, investigate, chase, shoo, search, return, flee, give up), 30 owned items, honk, grab, crouch, flap and run, a six-task to-do list, and 220 ambient students on the OSM path graph who startle at a honk. An automated harness measures every claim on the packed chunks and real screenshots: the latest full run passes **55 of 57 gates on both WebGPU and WebGL2** (the two reds are path-width gates discussed below), all 8 self-test mutants are caught, and 10 unit and behaviour tests pass.

How to run: see `README.md` (`npm run pipeline`, `npm run build && npm start`, open http://localhost:3100).

## Metrics

Latest full run: `bench/results/verify/20261103-0358-0e4f9b4/summary.json` (WebGPU, headless Chromium 156 on the build machine). Change column: against the first run of the night, `bench/results/verify/20261103-0235-77975de` (geometry only). Ledger: `VERIFY-LEDGER.md`.

| metric | value | gate | pass | first run of the night | change |
|---|---|---|---|---|---|
| flythrough.hole_frames | 0 | <= 0 | pass | - | new |
| flythrough.chunks_never_loaded | 0 | <= 0 | pass | - | new |
| flythrough.bad_vertices | 0 | <= 0 | pass | - | new |
| flythrough.frame_ms_p95 | 7.8 | record only | - | - | new |
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
| style.sat_mean | 0.226 | between [0.18, 0.35] | pass | - | new |
| style.val_mean | 0.5847 | between [0.45, 0.65] | pass | - | new |
| style.val_std | 0.0835 | between [0.08, 0.18] | pass | - | new |
| style.dark_share | 0 | <= 0.002 | pass | - | new |
| style.edge_share | 0.003505 | <= 0.045 | pass | - | new |
| style.colourfulness | 0.1119 | between [0.1, 0.25] | pass | - | new |
| style.kmeans12_residual_de | 0.831 | <= 6.0 | pass | - | new |
| style.shadow_ratio | 0.951 | >= 0.75 | pass | - | new |
| style.penumbra_px | 5.706 | >= 4 | pass | - | new |
| terrain.terrain_rmse_m | 0.0365 | < 0.25 | pass | 0.0365 | +2.886e-08 |
| terrain.terrain_max_m | 0.3871 | < 1.5 | pass | 0.3871 | +0 |
| terrain.seam_max_m | 0.0003152 | < 0.01 | pass | 0.0003152 | +0 |
| topdown.topdown_building_iou_min | 0.9782 | >= 0.95 | pass | - | new |
| topdown.topdown_chamfer_mean_m | 0.05854 | <= 0.5 | pass | - | new |
| topdown.topdown_chamfer_p95_m | 0 | <= 1.5 | pass | - | new |
| topdown.topdown_path_iou_min | 0.9866 | >= 0.85 | pass | - | new |
| walk.goose_walk_falls | 0 | <= 0 | pass | - | new |


WebGL2 (forced): `bench/results/verify/20261103-0411-bfa6872` passes **55 of 57**, the same two width reds as WebGPU (an earlier WebGL2 run, `20261103-0341-0aada59`, passed 53/57 before the ID and palette passes moved to no-MSAA rendering).

First load (`bench/results/firstload-2026-11-03-6a549a2.json`): 5.34 MB transferred before the game is ready (doc 06 M1 gate: under 10 MB), 21 requests, chunks gzip-compressed by the pipeline (whole world 20 MB). Before compression the same measure was 9.05 MB.

Frame time (`bench/results/frametime-2026-11-03-f23b7d4.json`, headless, uncapped, 1280 x 720, 220 ambient students, 201 draw calls, 1.26 M triangles including the shadow pass): WebGPU p50 1.2 ms, p95 1.6 ms; WebGL2 p50 2.7 ms, p95 5.0 ms. Not the doc 02 reference iGPU: the build machine only.

Looks (advisory, agent vision, two shuffled passes): mean 2.76 of 5 (silhouette 2.5, proportions 2.95, pattern 2.75, colour 3.3, recognisability 2.33); disagreement 0.03, which understates real noise because one agent scored both passes minutes apart and reused justification wording where an observation did not change.

## Contact sheet and overlays

- `review/contact-sheet.jpg`: 20 rows of reference photo, photo-match render, game-camera render and both looks passes, with attributions. Regenerate with `npm run verify:render` then `npm run verify -- <run>`.
- `review/pairs/Vnn.jpg` and `review/overlays/overlay_<i>_<j>.png` plus `review/overlays/overlay-sheet.jpg` (City 2026 orthophoto at 60%, City outlines cyan, rendered outlines magenta).
- Images are gitignored because the photos are CC BY-SA and the orthophoto licence is unverified; the repo is public.
- Look log screenshots: `review/look/` (beauty shots `beauty1` to `beauty5`, scenarios, close-ups).

## Known issues

- Red gates: `network.width_ortho_fail_count` (Laurel Trail: OSM tag 2.5 m used, by-eye ortho reading 3.0 m, tolerance 0.5 m) and `network.width_tag_fail_count` (way 952173528, tagged 4 m, measures 9.15 m because it abuts another path and the class union cannot separate them).
- Accepted regressions (`verify/exceptions.yaml`): per-pixel height median 0.310 to 0.320 m (roof-gap fix) and 12-colour k-means residual 0.794 to 0.840 (tufts, flowers, canopies).
- Viewpoint V19 (bus platforms) scores recognisability 1: only one canopy corner is in frame from the frozen pose. Other low scores: V16 (frozen pose shows a brick block, not EV3), V17 (the REV entrance is a close-up of a door), V06 (QNC far behind a foreground wall).
- Landmark gaps: DC has teal glass walls but no barrel vault, ducts or red portal frames (a vault override was tried and reverted because the lidar tiers are irregular); MC lacks the blank stair towers; QNC lacks the honeycomb cube; M3 is all brick (no glass centre bay).
- Post-2018 buildings (median nDSM under 1 m; heights from tags or 8 m default), 29: SLC (8.0 m, default), Passageway (8.0 m, default), OBJECTID 21481 (8.0 m, default), OBJECTID 21482 (8.0 m, default), OBJECTID 21483 (8.0 m, default), OBJECTID 26443 (57.92 m, osm_levels), OBJECTID 28007 (8.0 m, default), WATERLOO MEMORIAL RECREATION COMPLEX (8.0 m, default), WATERLOO MEMORIAL RECREATION COMPLEX (10.86 m, osm_levels), OBJECTID 29877 (32.58 m, fire_storeys), ESC (8.0 m, default), OBJECTID 30616 (43.44 m, fire_storeys), AVR (3.62 m, osm_levels), OBJECTID 31061 (21.72 m, fire_storeys), OBJECTID 31175 (8.0 m, default), Elora House (76.02 m, osm_levels), OBJECTID 32023 (8.0 m, default), CIF (8.0 m, default), Waterloo Park Splash Pad Pavilion (8.0 m, default), OBJECTID 32961 (54.3 m, fire_storeys), OBJECTID 33044 (8.0 m, default), OBJECTID 33136 (21.72 m, osm_levels), OBJECTID 33888 (72.4 m, fire_storeys), OBJECTID 34101 (21.72 m, fire_storeys), MHR (8.0 m, default), CIF (8.0 m, default), Waterloo Park Splash Pad Pavilion (8.0 m, default), OBJECTID 38185 (8.0 m, default), OBJECTID 39717 (8.0 m, default).
- The goose carries items by simulation, not a Rapier joint; dragging heavy items uses the same path (doc asked for a joint).
- The fly-through frame time in the harness (36.6 ms p95) is the CPU time of a forced synchronous render per frame in a test loop, not game frame time; use the frame-time benchmark.
- Sample data: none in the build; every layer was fetched live (`pipeline/manifest.json`). The planning-pack samples are used only as the frozen truth's own source.

## Blockers

None (`BLOCKERS.md`). `AI_GATEWAY_API_KEY` was not available, so the optional Jev layer has only the mock and recorded-replay paths, as the goal specifies.

## Gates to discuss

- **Laurel Trail ortho width**: the pipeline uses the OSM width tag (2.5 m); the by-eye ortho reading says 3.0 m. Doc 08 itself calls the tag authoritative and the ortho readings "not authoritative". Suggest replacing the gate with the tag or a surveyed reading.
- **Tagged widths where paths abut**: a class-union measurement cannot separate adjacent ribbons; measuring per-way ribbons would need per-way geometry in the chunks.
- **Frozen truth frame**: the frozen centroids carry a +0.31 m E, -0.94 m N datum offset from the City's WGS84 export; positions are gated against `verify/truth-native/` (native recomputation, as doc 08 section 5 allows) and the frozen-truth error is reported (median about 1.0 m).
- **Game-camera target**: doc 08 does not say what the style camera targets; targeting building centroids filled frames with roofs, so the style suite targets the viewpoint ground position (`NOTES.md`).

## Look log (iterations tonight)

1. First render: palette colours squared by a vertex-colour double multiply; fixed.
2. Researched building materials (`docs/research/building-looks.md`): DC teal glass, Hagey Hall brown brick, Dana Porter cream fins, QNC blue glass, E5 silver panels; window patterns per style.
3. Palette moved toward the measured reference swatches and lights dimmed until every style statistic sat in its band.
4. Grass squares poking through plazas (terrain diagonal mismatch) fixed; tufts and flowers; transit canopies; screen-space see-through.
5. Roof plant and grey roofs; paving joints; lake shore band; road markings; diamond panels on E5; thought bubbles and honk strokes; smart camera lift.

## Next steps

1. Replace the Laurel Trail ortho-width gate with the tag value or a surveyed reading (gates to discuss).
2. Per-way ribbon geometry in the chunks so tagged widths can be measured per way.
3. Landmark overrides for DC (vault, ducts, red frames), MC stair towers with the tie and QNC's cube, as authored geometry checked by the geometry gates.
4. Rapier joints for dragging heavy items (cones, backpacks) and a tug-of-war when a character grabs back.
5. A second hotspot (SLC and PAC plaza) using the same item and character schema.
6. Re-run the full WebGL2 verify and the frame-time benchmark on the doc 02 reference iGPU laptop.
7. Live Jev path once a gateway key exists, with record and replay into `data/jev/recorded.json`.
