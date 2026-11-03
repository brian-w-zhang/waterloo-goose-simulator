# REVIEW: overnight build, Nov 3, 2026

Draft written at 03:20 America/Toronto; it is regenerated at the end of the night with the final run.

## Summary

The whole University of Waterloo game area (2.6 x 1.8 km, 70 chunks of 256 m) is built from open data by a reproducible Python pipeline (City footprints, Ontario lidar heights and terrain, OSM paths, water, trees and street furniture) into binary chunks that a Next.js 16 app streams and renders with three.js WebGPU in a flat pastel toon style. A Canada goose built from code primitives walks it with a Rapier character controller and a follow camera that dithers away buildings in front of it. Every geometry claim is measured on the packed chunks by an automated harness (57 gates, 8 self-test mutants, all caught); the first full run passes 55 of 57.

## Metrics (latest run vs first run of the night)

Latest: `bench/results/verify/20261103-0310-ed15111/summary.json` (WebGPU, headless Chromium). First: `bench/results/verify/20261103-0235-77975de` (fast run, geometry only).

| metric | value | gate | pass | first run of the night | change |
|---|---|---|---|---|---|
| flythrough.hole_frames | 0 | <= 0 | pass | - | new |
| flythrough.chunks_never_loaded | 0 | <= 0 | pass | - | new |
| flythrough.bad_vertices | 0 | <= 0 | pass | - | new |
| flythrough.frame_ms_p95 | 6.2 | record only | - | - | new |
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
| heights.height_pixel_median_abs_m | 0.32 | < 1.5 | pass | 0.31 | +0.009947 |
| network.ring_road_osm_rel_err | 7.137e-06 | <= 0.01 | pass | 7.137e-06 | +0 |
| network.ring_road_city_rel_err | 0.01211 | <= 0.02 | pass | 0.01211 | +0 |
| network.laurel_creek_rel_err | 0.00128 | <= 0.02 | pass | 0.00128 | +0 |
| network.laurel_trail_rel_err | 0.0009101 | <= 0.02 | pass | 0.0009101 | +0 |
| network.columbia_lake_area_rel_err | 3.194e-06 | <= 0.02 | pass | 3.194e-06 | +0 |
| network.laurel_lake_area_rel_err | 4.187e-05 | <= 0.02 | pass | 4.187e-05 | +0 |
| network.width_ortho_fail_count | 1 | <= 0 | **FAIL** | 1 | +0 |
| network.width_tag_fail_count | 5 | <= 0 | **FAIL** | 5 | +0 |
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
| style.val_mean | 0.5877 | between [0.45, 0.65] | pass | - | new |
| style.val_std | 0.08225 | between [0.08, 0.18] | pass | - | new |
| style.dark_share | 0 | <= 0.002 | pass | - | new |
| style.edge_share | 0.00331 | <= 0.045 | pass | - | new |
| style.colourfulness | 0.1129 | between [0.1, 0.25] | pass | - | new |
| style.kmeans12_residual_de | 0.794 | <= 6.0 | pass | - | new |
| style.shadow_ratio | 0.951 | >= 0.75 | pass | - | new |
| style.penumbra_px | 5.706 | >= 4 | pass | - | new |
| terrain.terrain_rmse_m | 0.0365 | < 0.25 | pass | 0.0365 | +2.886e-08 |
| terrain.terrain_max_m | 0.3871 | < 1.5 | pass | 0.3871 | +0 |
| terrain.seam_max_m | 0.0003152 | < 0.01 | pass | 0.0003152 | +0 |
| topdown.topdown_building_iou_min | 0.9551 | >= 0.95 | pass | - | new |
| topdown.topdown_chamfer_mean_m | 0.08744 | <= 0.5 | pass | - | new |
| topdown.topdown_chamfer_p95_m | 0.4775 | <= 1.5 | pass | - | new |
| topdown.topdown_path_iou_min | 0.9179 | >= 0.85 | pass | - | new |
| walk.goose_walk_falls | 0 | <= 0 | pass | - | new |


## Contact sheet and overlays

- `review/contact-sheet.jpg` (gitignored: contains CC BY-SA photos; regenerate with `npm run verify`): photo, photo-match render, game-camera render and both looks passes per viewpoint, with attributions.
- `review/pairs/Vnn.jpg`, `review/overlays/overlay_<i>_<j>.png` and `review/overlays/overlay-sheet.jpg` (orthophoto at 60%, City outlines cyan, rendered outlines magenta; orthophoto is QA only, never shipped).

## Known issues

- Red gates: Laurel Trail ortho width (OSM tag 2.5 m used; by-eye ortho reading 3.0 m, tolerance 0.5 m) and 4 tagged cycleway widths where the cycleway lies under a road buffer (see gates to discuss).
- Looks (advisory): mean 2.7 of 5. Viewpoint V19 (bus platforms) has recognisability 1 because platform canopies are not modelled. The two scoring passes were done by the same agent minutes apart, so the 0.04 disagreement understates real noise.
- Post-2018 buildings (median nDSM under 1 m; heights from tags): 29, listed in `data/build/build_report.json` (`post2018`), including the SLC north wedge.

## Blockers

None so far (see `BLOCKERS.md`).

## Gates to discuss

- Laurel Trail width: the ortho reading (3.0 m, by eye, not authoritative) disagrees with the OSM width tag (2.5 m) that the pipeline uses; doc 08 calls the tag authoritative where present.

## Next steps

See the end-of-night version.
