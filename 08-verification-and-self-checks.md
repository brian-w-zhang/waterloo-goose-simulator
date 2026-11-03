# 08 Verification and self-checks

The automatable system the coding agents build first and run at the end of every work session to prove that the Waterloo Goose Simulator world matches real Waterloo maps (distances, footprints, heights, widths, landmark positions) and looks like a recognisable campus drawn in the Untitled Goose Game style.

Written Nov 3, 2026 (America/Toronto). Every number in section 1 was computed on Nov 3 from the files in [data-samples/](data-samples/README.md), a fresh OSM API extract of the core bbox (newest element 2026-11-02 14:37 UTC, which is 9:37 am America/Toronto) and live City of Waterloo REST layers. The ground-truth files live in [data-samples/ground-truth/](data-samples/ground-truth/). Thresholds marked "starting value" have no measurement behind them yet: the agent measures them once in M0, records the measurement in the ledger and freezes them (section 4.4).

## 0. Principles

1. **Checks before features.** The harness in this doc is the first milestone of the overnight goal ([GOAL-PROMPT.md](GOAL-PROMPT.md)). A feature is not done until the checks that cover it pass and the result is recorded.
2. **Measure the built artefact, not the source.** Every geometry check decodes the packed chunks in `public/world/` (the same bytes the browser loads) and converts back to EPSG:26917. Checking the pipeline's intermediate GeoJSON would prove nothing about the decoder, the origin offset, float32 precision or axis flips.
3. **Independent truth where possible.** Most checks compare to the source the pipeline used (integrity), but several cross sources (ION stations from OSM against City footprints, Ring Road length from City Roads against OSM, per-pixel lidar against rendered heights, the orthophoto against everything). Integrity checks catch bugs; cross-source checks catch wrong choices.
4. **Numbers gate, eyes advise.** Geometry and style metrics are gates. Model-judged looks (section 2.5) are noisy, so they never pass anything on their own; they feed Brian's morning contact sheet.

## 1. Ground-truth set

### 1.1 Files

| File | What | Size |
|---|---|---|
| `data-samples/ground-truth/ground_truth.json` | 21 buildings, 25 landmarks, 27 distance pairs, 12 lengths, 2 water bodies, OSM width tags, City lane counts, 4 orthophoto width readings, path-network baseline, coverage totals, each with its source | 28 KB |
| `data-samples/ground-truth/viewpoints.json` | 20 street-level viewpoints, each paired with a Wikimedia Commons photo (URL, licence, author, date) plus the game-camera preset | 12 KB |
| `data-samples/ground-truth/style_reference.json` | Frame statistics of the 6 official UGG Steam screenshots, of the real campus photos and of the slop-cities contact sheet | 3 KB |
| `data-samples/ground-truth/compute_ground_truth.py` | Rebuilds `ground_truth.json` and `viewpoints.json` (fetches the OSM extract and City Roads into `raw/` if missing) | |
| `data-samples/ground-truth/style_stats.py` | The frame statistics used by the style gates (section 3) | |
| `data-samples/ground-truth/commons_refs.json` | Commons API metadata for the 20 chosen photos | 6 KB |

In the game repo these are copied to `verify/ground-truth/` with a `SHA256SUMS` file. They are frozen: no agent edits them (section 4.4).

### 1.2 Which source is authoritative for what

| Quantity | Authoritative source | Why | Cross-check |
|---|---|---|---|
| 2D footprints, building positions, areas, dimensions, bearings | City of Waterloo Building Footprints (`Public_Base/MapServer/3`) | Surveyed municipal layer, carries UW building codes; the pipeline's base geometry (doc 01 section 9) | OSM ways and relations (report only) |
| Roof heights of buildings that existed in 2018 | Ontario lidar nDSM p90 inside the footprint eroded about 1 m (`uw_building_heights.csv`) | Measured; tags miss it by 10.8 to 12.2 m RMSE (doc 01 section 5.3) | City `FIRE_STOREYS`, OSM `building:levels` |
| Terrain | Ontario lidar DTM | Measured, 0.5 m | City contours 2014 |
| Ring Road length | City Roads `RING RD` centreline (2,788.4 m) | Municipal centreline | OSM `name=Ring Road` (2,754.6 m) |
| Paths, corridors, steps, named walkways | OSM | Only source with campus paths | City Trails for Laurel Trail |
| Path and road widths | OSM `width` where tagged; otherwise the orthophoto readings in 1.5 (**not authoritative**, by eye) | Only 44 of 3,044 ways carry `width`; City `ROAD_WIDTH` is null on all 99 core-bbox road segments (queried Nov 3) | |
| Water outlines | City Water Bodies (`Public_Base/MapServer/21`) | Municipal | OSM water |
| Transit stations | OSM nodes 4211159080 (University of Waterloo) and 4211146895 (Laurier - Waterloo Park) | Only source in the samples | GRT GTFS stops (later) |
| Looks | Commons photos (viewpoints.json) and the UGG screenshots | Not metric: used only for the rubric and the style statistics | |

### 1.3 Buildings

Union of the listed City OBJECTIDs per building (see `city_objectids` in the JSON). OBB is the minimum rotated rectangle; bearing is the long axis measured clockwise from true north, mod 180; it is marked unreliable when the aspect ratio is under 1.3. `dev` buildings may be used to tune pipeline constants; `holdout` buildings may not (section 4.4).

| id | split | area m2 | OBB long x short m | long-axis bearing (true) | lidar p90 m | fire storeys | City vs OSM IoU |
|---|---|---|---|---|---|---|---|
| DC | dev | 10,098 | 176.6 x 133.2 | 152.8 | 16.51 (main roof) | 3 | 0.0 (OSM has DC as a relation) |
| MC | dev | 5,229 | 93.0 x 68.3 | 159.8 | 25.80 | 5 | 0.882 |
| M3 | holdout | 2,081 | 46.8 x 46.8 | unreliable (aspect 1.00) | 22.42 | 4 | 0.825 |
| QNC | dev | 4,807 | 95.0 x 69.7 | 63.1 | 34.21 | 6 | 0.825 |
| SLC | dev | 7,329 | 181.0 x 77.3 | 0.1 | excluded (see 1.7) | | 0.344 and 0.593 (two parts) |
| PAC | dev | 7,107 | 117.2 x 83.5 | 16.6 | 14.96 | | 0.945 |
| LIB (Dana Porter) | dev | 2,472 | 49.7 x 49.7 | unreliable (aspect 1.00) | 39.41 | 10 | 0.866 |
| HH | holdout | 6,484 | 104.4 x 100.1 | unreliable (aspect 1.04) | 22.43 | | 0.67 |
| ML | dev | 2,196 | 67.2 x 61.9 | unreliable (aspect 1.09) | 11.02 | | 0.784 |
| E5 | dev | 2,762 | 102.8 x 29.5 | 151.7 | 32.53 | 5 | 0.836 |
| E6 | holdout | 1,909 | 56.3 x 37.1 | 151.6 | 29.98 | 6 | 0.856 |
| E7 | dev | 3,579 | 93.1 x 41.8 | 151.1 | 36.63 | 7 | 0.842 |
| EIT | holdout | 3,685 | 96.2 x 69.3 | 62.7 | 25.02 | 4 | 0.879 |
| STC | dev | 2,495 | 71.8 x 53.7 | 63.3 | 25.05 | 5 | 0.789 |
| EV3 | holdout | 2,445 | 75.7 x 45.5 | 157.1 | 24.62 | 3 | 0.695 |
| V1 (central complex) | dev | 3,297 | 80.6 x 64.8 | unreliable (aspect 1.24) | 9.67 | | 0.856 |
| REV (administration) | holdout | 2,075 | 78.4 x 41.6 | 111.5 | 8.95 | | 0.828 |
| PHY | dev | 4,500 | 118.4 x 90.6 | 149.1 | 14.71 | 3 | 0.86 |
| CPH | holdout | 3,972 | 128.6 x 56.1 | 141.4 | 16.64 | | 0.846 |
| B1 | dev | 2,467 | 102.0 x 27.6 | 153.8 | 14.59 | | 0.76 |
| EV2 | holdout | 2,203 | 59.7 x 45.1 | 64.4 | 22.40 | | 0.858 |

Heights are p90 of nDSM, i.e. roughly the main roof including some roof plant, not the tallest point. Several buildings have taller parts (the DC tower, the Dana Porter tower over a low podium); the per-pixel height check in 2.1 covers those.

### 1.4 Landmark distances

Centroid to centroid (City footprint unions, City water polygons, OSM station nodes). `utm_grid_m` is the metric the game must reproduce because the game world is UTM grid metres. Geodesic distances (GRS80) are in the JSON; over these pairs UTM grid / geodesic is 0.999616 to 0.999617, so grid distances are 0.04% (0.4 m per km) short of the ellipsoid. That is the UTM scale factor this far from the zone 17 central meridian, well inside every tolerance below.

| pair | UTM grid m | azimuth (true) | split |
|---|---|---|---|
| DC to MC | 157.4 | 248.7 | dev |
| SLC to PAC | 80.2 | 305.9 | dev |
| MC to QNC | 97.4 | 191.2 | dev |
| E5 to E7 | 37.8 | 82.4 | dev |
| E5 to E6 | 111.4 | 83.6 | holdout |
| MC to LIB | 289.2 | 152.2 | dev |
| LIB to HH | 195.7 | 164.5 | dev |
| HH to ML | 144.4 | 314.1 | holdout |
| SLC to DC | 269.6 | 74.1 | dev |
| SLC to LIB | 344.3 | 134.1 | dev |
| V1 to REV | 371.4 | 247.6 | dev |
| V1 to SLC | 378.4 | 85.0 | dev |
| REV to SLC | 741.2 | 76.4 | dev |
| DC to ION station (UW) | 111.3 | 37.6 | dev |
| SLC to ION station (UW) | 365.0 | 63.7 | dev |
| ION UW to ION Laurier - Waterloo Park | 720.6 | 132.1 | dev |
| PAC to REV | 691.8 | 251.3 | holdout |
| EIT to PHY | 90.3 | 155.3 | dev |
| STC to B1 | 39.6 | 60.8 | dev |
| EV3 to EV2 | 14.0 | 167.3 | holdout |
| DC to V1 | 645.2 | 260.5 | dev |
| QNC to STC | 92.0 | 140.7 | dev |
| E7 to QNC | 419.1 | 242.3 | dev |
| CPH to E5 | 227.5 | 345.1 | holdout |
| V1 to Columbia Lake centroid | 550.9 | 292.7 | dev |
| M3 to DC | 173.7 | 112.3 | holdout |
| Laurel Lake centroid to V1 | 703.7 | 317.2 | holdout |

The azimuths matter: a mirrored world (the classic three.js `-Z is north` slip) keeps every distance and fails every azimuth.

### 1.5 Lengths, widths, water, network, coverage

| Length | m | Source | Authoritative |
|---|---|---|---|
| Ring Road, City centreline (5 segments) | 2,788.4 | City Roads layer 12, `RING RD` | yes |
| Ring Road, OSM (12 ways incl. short one-way splits) | 2,754.6 | OSM | no |
| Laurel Creek inside the core bbox | 2,292.4 | City Perennial Creeks layer 17 | yes |
| Laurel Trail inside the core bbox, City | 2,081.4 | City Trails, Public_Operations 31 | yes |
| Laurel Trail inside the core bbox, OSM | 2,171.4 | OSM | no |
| All `highway=corridor` (indoor links) in the core bbox | 5,165.2 (174 ways) | OSM | no |
| E5 Bridge (indoor, layer 1) | 81.0 | OSM way 175807556 | no |
| MC to QNC Walkway (bridge) | 22.1 | OSM way 182197539 | no |
| Two Row Path | 554.9 | OSM | no |
| Path 2 East | 634.2 | OSM | no |
| Alumni Lane | 270.0 | OSM | no |
| South Walk (pedestrian) | 75.6 | OSM | no |

Widths. OSM tags in the core bbox: Laurel Trail 2.5 m (2 m on one way), a few footways 1.5 and 2.5 m, paths 2 m, steps 1.5 and 2 m, Phillip Street 12 m. City lane counts: University Ave W 4 to 5, Columbia St W 4, Westmount Rd N 4, Seagram Dr 2, Ring Rd null (OSM says 2). Readings by eye on the City 2026 spring 10 cm orthophoto with a 1 m tick ruler perpendicular to the OSM way (QA only; imagery licence unverified):

| Site | OSM way | UTM E, N | Reading | Tolerance |
|---|---|---|---|---|
| Ring Road site A | 24636861 | 536970, 4812760 | 11.0 m curb to curb, plus about 2 m sidewalk | 1.0 m |
| Ring Road site B | 467027539 | 536569, 4813333 | 11.0 m curb to curb, plus about 2.5 m sidewalk | 1.0 m |
| Laurel Trail | 175807340 | 536887, 4813918 | 3.0 m paved (tag says 2.5 m) | 0.5 m |
| Alumni Lane footway | 182419169 | 536802, 4813462 | 2.8 m paved | 0.5 m |

So doc 01's default of 2.0 m for an untagged footway looks low for main campus paths; calibrate type defaults on dev sites only and add more ortho sites to the dev list rather than editing these.

Water. Columbia Lake polygon area 114,754 m2 (11.48 ha), perimeter 3,767 m; Laurel Lake 6,610 m2, perimeter 429 m. The City's own `HECTARES` field says 10.80 ha for Columbia Lake while its `SHAPE.AREA` and the geometry say 11.48 ha; the game must match the geometry.

Network baseline (OSM walkable ways, access not private or no, core bbox): 7,632 graph nodes in 21 components, the largest has 7,503 (98.3%). Of 244 `entrance` nodes, 200 (82.0%) sit exactly on the largest component, 229 (93.9%) are within 10 m and 241 (98.8%) within 15 m.

Coverage. 480 City footprints in the core bbox totalling 366,297 m2; 115 owned by "UNIVERSITY OF WATERLOO" totalling 216,578 m2.

Registration between sources. For 348 City footprints matched to an OSM way with IoU over 0.7, the centroid offset is median 0.98 m, p90 2.55 m, max 12.42 m, with a mean shift of +0.09 m east and -0.44 m north. There is no large systematic datum offset, so a source mix-up shows up as scattered metre-level errors, not a global shift.

### 1.6 Viewpoints

Twenty street-level cameras (eye height 1.7 m, pitch 5 degrees, horizontal FOV 60 degrees as a phone-camera default). Ten positions come from the Commons file's coordinates, which may be the camera or the subject; ten are estimated from the map and the photo. Every heading is computed toward the target centroid and is a prior, not truth: section 2.5 calibrates each pose once.

| id | camera lat, lon | heading | position | reference photo (licence, author) |
|---|---|---|---|---|
| V01 Davis Centre north atrium | 43.47302, -80.54168 | 215.1 | Commons | [Davis Centre (University of Waterloo) - Waterloo, ON.jpg](https://commons.wikimedia.org/wiki/File:Davis_Centre_(University_of_Waterloo)_-_Waterloo,_ON.jpg) (CC BY-SA 4.0, JFVoll) |
| V02 Davis Centre from the ION tracks | 43.473506, -80.541516 | 205.0 | estimated | [UWaterloo Davis Centre.jpg](https://commons.wikimedia.org/wiki/File:UWaterloo_Davis_Centre.jpg) (CC BY-SA 4.0, wctaiwan) |
| V03 MC long facade from the MC and DC green | 43.472329, -80.542885 | 250.0 | estimated | [MC DC Courtyard in Summer.jpg](https://commons.wikimedia.org/wiki/File:MC_DC_Courtyard_in_Summer.jpg) (CC BY-SA 3.0, Sampsonchen) |
| V04 MC tower with the pink tie | 43.471731, -80.544484 | 51.5 | Commons | [UW-MathFaculty-PinkTie.jpg](https://commons.wikimedia.org/wiki/File:UW-MathFaculty-PinkTie.jpg) (CC BY-SA 3.0, author field empty) |
| V05 M3 facade | 43.472976, -80.544801 | 70.0 | estimated | [University of Waterloo Math 3.jpg](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Math_3.jpg) (CC BY-SA 3.0, Victor Vucicevich) |
| V06 QNC from Ring Road | 43.470208, -80.545772 | 50.0 | estimated | [Quantum Nano Center UW 2013.jpg](https://commons.wikimedia.org/wiki/File:Quantum_Nano_Center_UW_2013.jpg) (CC BY-SA 3.0, JustSomePics) |
| V07 Dana Porter Library from the south | 43.46915, -80.54238 | 8.0 | Commons | [Dana Porter Library - Waterloo, ON.jpg](https://commons.wikimedia.org/wiki/File:Dana_Porter_Library_-_Waterloo,_ON.jpg) (CC BY-SA 4.0, JFVoll) |
| V08 Dana Porter silhouette from the northeast | 43.470075, -80.541572 | 237.1 | Commons | [Dana Porter Library.jpg](https://commons.wikimedia.org/wiki/File:Dana_Porter_Library.jpg) (CC BY-SA 4.0, Matt Polkiewicz) |
| V09 Arts quad toward Dana Porter | 43.469093, -80.54252 | 15.9 | Commons | [Waterloo ontario campus 3.jpg](https://commons.wikimedia.org/wiki/File:Waterloo_ontario_campus_3.jpg) (CC BY-SA 3.0, DINO2411) |
| V10 Hagey Hall brick massing | 43.46784, -80.54062 | 286.1 | Commons | [Hagey Hall of the Humanities (University of Waterloo) - Waterloo, ON.jpg](https://commons.wikimedia.org/wiki/File:Hagey_Hall_of_the_Humanities_(University_of_Waterloo)_-_Waterloo,_ON.jpg) (CC BY-SA 4.0, JFVoll) |
| V11 SLC curved glass courtyard | 43.472254, -80.544842 | 225.0 | estimated | [University of Waterloo Student Life Center.jpg](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Student_Life_Center.jpg) (CC BY-SA 3.0, Victor Vucicevich) |
| V12 SLC courtyard panorama | 43.472264, -80.544467 | 240.0 | estimated | [Student Life Centre Courtyard ... August 2007.jpg](https://commons.wikimedia.org/wiki/File:Student_Life_Centre_Courtyard_at_the_University_of_Waterloo_in_August_2007.jpg) (CC BY 3.0, Giligone) |
| V13 E5 long facade from Ring Road | 43.472563, -80.540911 | 62.0 | estimated | [E5 Building University of Waterloo (19673237343).jpg](https://commons.wikimedia.org/wiki/File:E5_Building_University_of_Waterloo_(19673237343).jpg) (CC BY-SA 2.0, Kiyan) |
| V14 E5 glass corner at sunset | 43.473171, -80.54068 | 120.0 | estimated | [E5 at sunset.JPG](https://commons.wikimedia.org/wiki/File:E5_at_sunset.JPG) (CC BY-SA 4.0, Maestroso simplo) |
| V15 Physics building from the path | 43.470004, -80.541968 | 20.0 | estimated | [Physics Building University of Waterloo Fall 2012.jpg](https://commons.wikimedia.org/wiki/File:Physics_Building_University_of_Waterloo_Fall_2012.jpg) (CC BY-SA 3.0, JustSomePics) |
| V16 Environment 3 from Ring Road | 43.467804, -80.544285 | 70.0 | estimated | [Environment 3 University of Waterloo.jpg](https://commons.wikimedia.org/wiki/File:Environment_3_University_of_Waterloo.jpg) (CC BY-SA 3.0, JustSomePics) |
| V17 Ron Eydt Village entrance | 43.470334, -80.55392 | 270.0 | estimated | [Entrance to Ron Eydt Village (4773822393).jpg](https://commons.wikimedia.org/wiki/File:Entrance_to_Ron_Eydt_Village_(4773822393).jpg) (CC BY 2.0, Ben Babcock) |
| V18 Columbia Lake shoreline | 43.473133, -80.553224 | 280.0 | estimated | [Columbia Lake - Waterloo, Ontario 2019-10-11 (01).jpg](https://commons.wikimedia.org/wiki/File:Columbia_Lake_-_Waterloo,_Ontario_2019-10-11_(01).jpg) (CC BY-SA 4.0, Ryan Hodnett) |
| V19 University of Waterloo station bus platforms | 43.473881, -80.541069 | 196.4 | Commons | [University of Waterloo station bus platforms.jpg](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_station_bus_platforms.jpg) (CC0, Radagast) |
| V20 University of Waterloo ION platform | 43.473497, -80.541599 | 120.0 | estimated | [University of Waterloo Station Nov 2017.jpg](https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Station_Nov_2017.jpg) (CC0, Radagast) |

I viewed all 20 thumbnails to confirm each shows its subject. Gaps: no usable Commons exterior for PAC, E7, V1 or EIT (the EIT category is mostly interiors), so those are covered by the top-down check only. Stated photo dates run from 2006 to 2022, so some show older states of a building or its surroundings. Victor Vucicevich's 2012 files all carry the same generic coordinate (43.4722, -80.5472), so their positions were estimated, not read.

Licences: CC BY, CC BY-SA and CC0 allow reuse with attribution (and share-alike for BY-SA). Keep the photos in a gitignored cache (`verify/cache/refs/`), fetched by URL; put the attribution line under each photo on the contact sheet; do not commit them or the contact sheets to a public repo. Mapillary street imagery is CC BY-SA ([Mapillary licence page](https://help.mapillary.com/hc/en-us/articles/115001770409-Licenses)) and is a fallback for the missing buildings (coverage on campus not checked). Do not use Google Street View imagery: it is under the Google Maps Platform terms, not open data (terms not re-read for this doc).

### 1.7 Findings while building the set

- **The SLC north wedge is newer than the lidar.** City OBJECTID 19801 (2,819 m2, part of the SLC) has median nDSM 0.10 m while the 2026 orthophoto shows a roof over it, so it was not there when the 2018 lidar was flown (construction date not checked). Its height must come from tags or an override, and it is excluded from the height truth. This is the template for the "post-2018" detector in section 5.
- **DC has IoU 0.0 against OSM** because OSM maps it as relations 3776384 and 8765264, which a way-only conflation misses (doc 01 section 3.3). Any check that matches City to OSM ways must handle relations or it will silently report DC as unmatched.
- **Five of the 21 key buildings are too square for a meaningful long-axis bearing** (M3, LIB, HH, ML, V1); the bearing gate skips them.
- **Columbia Lake's attribute and geometry disagree** (10.80 ha vs 11.48 ha). Trust geometry.
- **City footprints register well to the 2026 orthophoto** at the SLC (checked by overlay), so the orthophoto is usable for QA overlays.

## 2. Automated checks

### 2.1 Geometry unit tests (pipeline side, Python, pytest)

All checks read the decoded chunks and convert world coordinates back to EPSG:26917 with the origin from `config/campus.json` (suggest x = E - 536000, z = -(N - 4813000), y = elevation - base; whatever convention is chosen, one function owns it and every check uses that function).

| Check | Metric | Gate | Why this number |
|---|---|---|---|
| Coverage | UW-owned City footprints present; all core-bbox footprints present | 115 of 115; at least 475 of 480 (99%) | Doc 06 M1; the City layer is the base, so nothing should be lost |
| Built area | Sum of game footprint area vs 216,578 m2 (UW) and 366,297 m2 (all) | Within 2% | Simplification at 0.3 m plus right-angle snapping costs about perimeter x 0.3 / area, which is 1 to 3% for campus buildings |
| Footprint IoU, game vs City | Per building, polygons with area over 50 m2 | Median at least 0.95, p10 at least 0.88, every key building in 1.3 at least 0.90 | Same reasoning: a 0.3 m boundary change on Dana Porter (2,472 m2, perimeter about 200 m) gives IoU about 0.976; small sheds near 100 m2 drop to about 0.88 |
| Footprint IoU, game vs OSM (report, not gate) | Same, for matched pairs | Report; alert if the median drops under 0.75 | The two sources only agree to median 0.806 (451 of 480 matched, p10 0.483), so gating on OSM would punish correct City geometry |
| Area and dimensions | Key buildings: area, OBB long and short side | Area within 3%; sides within max(1.0 m, 2%) | Chamfers of 0.15 to 0.3 m and snapping |
| Bearing | Long-axis bearing, key buildings with aspect at least 1.3 | Within 2 degrees | Snapping to right angles can rotate a polygon a little; more means a projection or axis bug |
| Landmark positions | Centroid error of each key building and station | Median under 0.5 m, max under 2.0 m | Pipeline keeps City coordinates; float32 relative to the chunk origin is exact to millimetres |
| Distances | 27 pairs, absolute error | Each within max(1.0 m, 0.5%); median under 0.5 m | Positions above, combined |
| Azimuths | 27 pairs | Each within 1 degree | Catches mirrored or rotated worlds |
| Heights (integrity) | Game main-roof height above local ground vs lidar p90 for key buildings built before 2018 | Each within 2.0 m; RMSE under 1.5 m on dev; RMSE under 2.0 m on holdout | Heights come from p90 directly, so a larger error means the pipeline corrupted them (parapet added to the wrong value, base elevation wrong, storey snapping) |
| Heights (holdout, doc 06) | RMSE vs p90 over a seeded random 20 of the pre-2018 UW footprints (seed in `config/campus.json`, never changed) | Under 2.0 m | Doc 06 M1 acceptance |
| Heights (per pixel) | Rendered top-down height map at 1 m vs nDSM over footprint pixels | Median absolute error under 1.5 m (**starting value**) | Independent of the per-building p90: catches missing towers (Dana Porter, DC) that a single extrusion would flatten |
| Terrain | Game ground height at 500 seeded points outside footprints and water vs DTM | RMSE under 0.25 m, max under 1.5 m | 2 m resampling of a 0.5 m DTM; flattening only under footprints |
| Chunk seams | Height difference across every chunk edge | Under 0.01 m | Shared edge samples must be identical |
| Ring Road | Rendered centreline length | Within 1% of OSM 2,754.6 m and within 2% of City 2,788.4 m | The two sources differ by 1.2% |
| Laurel Creek, Laurel Trail | Length inside the core bbox | Within 2% of City values | |
| Water | Columbia Lake and Laurel Lake area | Within 2% of 114,754 m2 and 6,610 m2 | |
| Widths | Ribbon width at the 4 ortho sites and on all ways with a `width` tag | Within the tolerance listed in 1.5; tagged ways within 0.25 m of the tag | |
| Walk network | Entrances within 15 m of the largest component of the game graph; largest component share | At least 95% (baseline 98.8%); at least 98% (baseline 98.3%) | Measured baseline; the game graph must not lose connectivity |
| Network length | Total edge length of the game graph vs the source ways | Within 1% | |

### 2.2 Top-down registration against the map and the orthophoto

1. Render each 256 m chunk with an orthographic camera looking straight down at 0.5 m per pixel (512 x 512) in a **flat debug mode**: unlit, no fog, no shadows, buildings in one ID colour, path ribbons in another, water in a third.
2. Rasterise the same chunk from the ground truth: City footprints, OSM path ribbons at their tagged or default widths, City water.
3. Metrics per chunk: building-mask IoU (gate at least 0.95), boundary chamfer distance from rendered edges to City edges (gate: mean at most 0.5 m, p95 at most 1.5 m), path-mask IoU (gate at least 0.85, **starting value**).
4. Diagnostic only: Canny edges of the City 2026 orthophoto (export URL in doc 01 section 4.1, resampled to 0.5 m) against rendered edges, reported as chamfer mean. Not a gate: the orthophoto has trees, shadows and relief displacement (tall roofs lean away from the image centre), so it cannot be truth for edges.
5. Write `overlay_<chunk>.png`: orthophoto at 60% opacity, City outlines in cyan, rendered outlines in magenta. These go on the morning contact sheet.

### 2.3 Fly-through consistency

A Playwright script drives the camera on a fixed path: a Ring Road loop at 40 m altitude, then each of the 20 viewpoints, then a diagonal across the whole bbox, at a fixed speed, render size 1280 x 720, fixed seed and time of day. It records per frame: chunk loads and evictions, frame time, draw calls, triangles. Gates:

- **No holes**: the clear colour is set to `#ff00ff`, which is banned from the palette; any frame with more than 0.1% magenta pixels below the horizon line fails and is saved.
- Every chunk the manifest lists is loaded at least once; the building count per loaded chunk equals the manifest.
- No NaN or out-of-bbox vertex positions (decoder test).
- The goose sim test from doc 06 M1: walk DC to SLC to the Village 1 ring without falling through terrain.
- Frame-time p95 recorded per backend (gate comes from doc 02 section 7 on the reference iGPU; headless runs only record).

### 2.4 Fixed viewpoints: renders

For each of the 20 viewpoints the harness renders two images:

- **photo-match**: the viewpoint camera (eye height 1.7 m, the calibrated heading, pitch and FOV) in the normal toon style, 1280 x 720;
- **game-camera**: the UGG-style camera (pitch 50 degrees, vertical FOV 25 degrees, 60 m from the target) for the style suite.

Pose calibration (once, in M0, then frozen): for each viewpoint the agent may adjust only the camera (position within 30 m, heading, pitch, FOV between 40 and 75 degrees) so that the rendered silhouette of the target lines up with the photo. Record the final pose and a one-line reason in `verify/viewpoints.calibrated.json`. After calibration the poses are frozen: the agent may never move a camera to make a later score better, and never moves world geometry to match a photo.

### 2.5 Photo comparison by the agent's own vision

The harness writes `review/pairs/Vnn.jpg`: the reference photo and the photo-match render side by side at the same height, with the attribution line. The agent opens each pair image and scores five criteria from 1 to 5, each with a written justification of at least one specific observation:

| Criterion | 5 | 3 | 1 |
|---|---|---|---|
| Silhouette | Outline and skyline of the target match the photo | Main masses right, one wrong or missing mass (missing tower, wrong roof) | Unrelated shape |
| Proportions | Height to width and setbacks look the same | Off by roughly a storey or a bay | Clearly wrong scale |
| Window and roofline pattern | Band rhythm, storey count and roof edge read the same (stylised is fine) | Bands present but wrong rhythm or count | No pattern or the wrong kind (glass building drawn as brick bands) |
| Colour family | Wall and roof colours are the right family (concrete grey, dusty brick, teal glass, cream) after the palette mapping | Right family for walls only | Wrong family |
| Landmark recognisability | A UW student would name the building from this image | Recognisable with the label | Not recognisable |

Rules that keep this honest:

- Score blind: score the new pairs before opening previous scores; never copy or average previous scores.
- Every score needs its justification; a score without a concrete observation ("the tower is missing above the podium") is invalid and the validator (`tools/verify/validate_looks.py`) rejects the file.
- Each pair is scored twice in the same run with the pair order shuffled; record both and the absolute difference. Report the mean disagreement in the ledger.
- Model-judged looks are noisy and can be fooled by the agent's own expectations. They **never** pass a milestone on their own. They block only in one case: a landmark-recognisability score of 1 on V01, V04, V07, V08, V10, V11, V13 or V19 (DC, MC, Dana Porter twice, Hagey Hall, SLC, E5, the ION station) must be logged as a known issue in REVIEW.md.
- Every run writes `review/contact-sheet.jpg` (20 rows: photo, photo-match render, game-camera render, scores) and the overlay sheets from 2.2. This contact sheet is Brian's morning review and the real gate on looks.

## 3. Style checks: the Untitled Goose Game look

### 3.1 Measurable targets

Frame statistics from `style_stats.py` (frame resized to 960 x 540). UGG values were measured on the six official Steam screenshots in `research/raw/goose/` (md5-identical to the store's `path_full` files, URLs below). Photo values are the 24 candidate Commons photos; slop values are the slop-cities contact sheet. All from `style_reference.json`.

| Metric | UGG (6 screenshots) | Real campus photos | slop-cities sheet | Gate on game-camera renders (mean of the 20 inside the band; no single frame outside the band widened by 50% on each side) |
|---|---|---|---|---|
| Mean HSV saturation | 0.201 to 0.328 | 0.141 to 0.512 | 0.278 | 0.18 to 0.35 (doc 02) |
| Mean HSV value | 0.489 to 0.605 | 0.367 to 0.653 | 0.402 | 0.45 to 0.65 (doc 02) |
| Std of value (contrast) | 0.101 to 0.159 | 0.211 to 0.347 | 0.278 | 0.08 to 0.18 |
| Share of pixels with value under 0.12 (ink, hard shadow) | 0.0 | 0.0023 to 0.199 | 0.189 | At most 0.002 |
| Share of pixels with luminance gradient over 0.2 (edges, outlines, texture) | 0.012 to 0.036 | 0.032 to 0.311 | 0.079 | At most 0.045 |
| Colourfulness (Hasler and Suesstrunk) | 0.118 to 0.214 | 0.091 to 0.282 | 0.152 | 0.10 to 0.25 |
| 12-colour k-means residual, mean Delta E (flat shading) | 2.22 to 5.18 | 3.18 to 7.57 | 7.43 | At most 6.0 |

Value contrast, dark share and edge share separate UGG from photos and from photoreal open-data cities cleanly; saturation and value alone do not (photos overlap them). The goose's black neck (`#2b2b2b`, value 0.17) stays above the 0.12 dark cut.

### 3.2 Palette lock test

- **Static**: `tools/verify/check_colours.ts` fails on any colour literal (hex, `new Color(`, `rgb(`) in `src/` outside `config/palette.json` and an allowlist for debug tools.
- **Palette-ID pass**: a debug render mode outputs each material's base palette colour (no lighting, no jitter, no AO, no fog). Every non-sky, non-UI pixel must be within Delta E 1976 of 1.0 of a swatch in `palette.json`. This is exact by construction, so any failure is a hard-coded or computed colour.
- **Lit frame**: build the expanded palette (each swatch times the toon ramp levels, times fog blends 0, 0.25, 0.5, 0.75 toward the sky colour, times AO 0.8 to 1.0). At least 95% of pixels must be within Delta E 12 of the expanded palette (**starting value**, measured once in M0).

### 3.3 Shadows, outlines, camera

- Test scene (`tests/visual/style-scene.spec.ts`): a 10 m cube on flat ground under the game lights. Shadowed ground luminance divided by lit ground luminance at least 0.75 (faint; `shadow.intensity` 0.25 in doc 02); penumbra width at least 4 px at 720p (soft). Both **starting values**.
- Outline absence: dark share and edge share above; plus no outline pass in the render pipeline unless a flag enables a same-hue, low-alpha edge (doc 02 section 9).
- Camera config unit test: game camera vertical FOV 20 to 30 degrees, pitch 45 to 55 degrees (doc 02 section 8; these are estimates from screenshots).

### 3.4 Banned effects (static check in `tools/verify/check_banned.ts`)

Bloom (`BloomNode`, `bloom(`), PBR materials (`MeshStandardMaterial`, `MeshPhysicalMaterial` and their node versions) on world geometry, environment maps and reflections, screen-space reflections, depth of field, film grain, chromatic aberration, vignette, lens flare, motion blur, image textures from files (only `palette`, `lut` and `noise` textures under 64 KB on an allowlist), normal and roughness maps, ACES or filmic tone mapping (neutral or none), black ink outlines, photo textures of any kind, assets from UGG or Goat Simulator.

### 3.5 Reference images

Official UGG Steam store screenshots for app 837470 (from `https://store.steampowered.com/api/appdetails?appids=837470`, Nov 3, 2026); the first six are the files in `research/raw/goose/`:

1. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/837470/ss_deb5b83b07d3f7c1050ea46b51117109da06952b.1920x1080.jpg
2. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/837470/ss_7576323f465966792d0fb021acf5a8a81a16e9f9.1920x1080.jpg
3. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/837470/ss_f77f22299e196a9e8e702bd36fbba9951a6c0a01.1920x1080.jpg
4. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/837470/ss_4f8a37c4fe9882876c891333dc2a76060a3e5652.1920x1080.jpg
5. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/837470/ss_df679de6ce524a4d3c3d452a29593adbd88c38bb.1920x1080.jpg
6. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/837470/ss_f85be4e268c984bcdec7c35138830fe1a7e50484.1920x1080.jpg

They are House House's copyrighted images: use them only to measure statistics and to look at. Never commit them to the game repo, never ship them, never sample them into textures (doc 07 section 3).

## 4. The loop

### 4.1 Definition of done per milestone

| Milestone | Done when these pass and are in the ledger |
|---|---|
| V0 (first milestone of the overnight goal) | Harness runs end to end on a stub world: ground truth copied with SHA256SUMS; `npm run verify` produces a summary JSON, the ledger line, the contact sheet and the overlay sheet; `npm run verify:selftest` shows every gate failing on its mutant (4.4); viewpoint poses calibrated and frozen; starting values measured and frozen |
| M0 (doc 06) | V0 plus CI green, the toon test scene rendered on both backends, lidar and footprints fetched by script |
| M1 | All of 2.1 (coverage, IoU, positions, distances, azimuths, heights, terrain, seams, lengths, water, widths, network), 2.2 gates on every chunk, 2.3 gates, the M1 tests from doc 06 |
| M2 | M1 still green, plus all of section 3 on the game-camera set, plus the doc 06 M2 behaviour tests |
| M3 and M4 | Everything above stays green; the benchmark files from doc 06 section 5 exist for every claim |

### 4.2 Results ledger

- Every run writes `bench/results/verify/<YYYYMMDD-HHMM>-<shortsha>/` with `summary.json` (every metric, its gate, pass or fail, the backend, the browser version, the pipeline manifest hash, the ground-truth hash), the renders, the overlays, `looks.json` and the contact sheet.
- `VERIFY-LEDGER.md` at the repo root gets one appended line per run: time (America/Toronto), short SHA, backend, gates passed of total, IoU median, height RMSE dev and holdout, distance median error, style std of value, looks mean, path to the run folder. Never edit or delete old lines.

### 4.3 Regression gates

- `tools/verify/gate.py` compares the run with the last green run on the same backend. Each metric has a direction and a noise band (geometry 0; style statistics 0.005; frame time 10%). A change that makes any gated accuracy metric worse beyond its band fails, even if the absolute gate still passes.
- Never merge or keep a commit that fails the gate. Revert it or fix forward in the next commit before doing anything else.
- An accepted regression needs an entry in `verify/exceptions.yaml` (metric, old, new, reason, the commit that will recover it) and a line under known issues in REVIEW.md. Exceptions are never allowed on holdout metrics or on the ground-truth hash.

### 4.4 Avoiding reward hacking

1. **Frozen truth**: `verify/ground-truth/` is read-only by policy; `SHA256SUMS` is checked at the start of every run; a mismatch fails the run. New truth (for example more ortho width sites) goes in a separate file, in its own commit, with provenance, and never replaces existing values.
2. **Dev and holdout**: tune pipeline constants (storey height, simplification tolerance, path widths, colour mapping) only against `dev` items. Holdout items are evaluated every run and logged, and a holdout failure is fixed by a general change justified on dev data, never by a constant chosen to fix that item.
3. **No tuning on viewpoints**: poses are frozen after calibration; the world is never edited to please a photo or a score; landmark overrides (doc 02) are allowed only as authored geometry keyed by `BLDG_ABBREV` and are re-checked by every geometry gate like any other building.
4. **Thresholds are frozen**: starting values are measured once in V0 and written to `verify/thresholds.json`; loosening any threshold needs a logged reason in the ledger and appears in REVIEW.md.
5. **Measure artefacts**: every check reads the packed chunks and the actual screenshots, never pipeline intermediates or constants; a check that imports the value it is checking is a bug.
6. **Test the tests**: `npm run verify:selftest` builds mutants (world scaled 1.01; X mirrored; one building moved 3 m; all heights plus 3 m; a chunk dropped; an off-palette colour; bloom enabled; a 0.4 m terrain step at a chunk edge) and asserts that the matching gate fails for each. If a mutant passes, the check is broken.
7. **Checks are artefacts**: no claim in REVIEW.md, a commit message or the slides without a path to a run folder.

### 4.5 Commands to build

Python (`pipeline/validate/`, pytest, run from the repo root):

| Script | Does |
|---|---|
| `pipeline/validate/geometry.py` | Coverage, area, IoU (City and OSM), dimensions, bearings, positions, distances, azimuths |
| `pipeline/validate/heights.py` | Per-building integrity, seeded holdout 20, per-pixel height map vs nDSM |
| `pipeline/validate/terrain.py` | Terrain points and chunk seams |
| `pipeline/validate/network.py` | Lengths, widths, water areas, entrance reachability, component share |
| `pipeline/validate/topdown_compare.py` | Rasterises truth per chunk, compares with rendered top-down PNGs, writes overlays |
| `tools/verify/style_stats.py` | Copy of `data-samples/ground-truth/style_stats.py` |
| `tools/verify/palette_check.py` | Palette-ID pass and lit-frame expanded palette test |
| `tools/verify/validate_looks.py` | Schema and justification check for `looks.json` |
| `tools/verify/contact_sheet.py` | Contact sheet and overlay sheet with attributions |
| `tools/verify/gate.py` | Regression gate against the last green run, writes `summary.json` and the ledger line |
| `tools/verify/selftest.py` | Builds the mutants and checks that each gate fails |

npm scripts (`package.json`):

| Script | Runs |
|---|---|
| `verify:geometry` | `python -m pipeline.validate.geometry && ... heights && ... terrain && ... network` |
| `verify:topdown` | `playwright test tests/visual/topdown.spec.ts` then `topdown_compare.py` |
| `verify:flythrough` | `playwright test tests/visual/flythrough.spec.ts` |
| `verify:viewpoints` | `playwright test tests/visual/viewpoints.spec.ts` (photo-match and game-camera sets, pairs images) |
| `verify:style` | `playwright test tests/visual/style-scene.spec.ts`, `style_stats.py`, `palette_check.py`, `check_colours.ts`, `check_banned.ts` |
| `verify:looks` | `validate_looks.py` on the agent-written `looks.json` |
| `verify:selftest` | `selftest.py` |
| `verify` | All of the above, then `contact_sheet.py` and `gate.py` |
| `verify:fast` | Geometry and static checks only (under 3 minutes), for every increment |

Headless visual runs use the WebGL2 backend (`forceWebGL: true`) with device pixel ratio 1 for determinism; WebGPU runs are recorded separately and gated only against their own last green run. Whether headless Chrome exposes WebGPU on the build machine is **unverified**; log it in the ledger.

Tools: three.js 0.187.0 (https://threejs.org/), Playwright 1.64.1 (https://playwright.dev/), Vitest 5.1.0 (https://vitest.dev/), pixelmatch 8.0.0 (https://github.com/mapbox/pixelmatch) and ssim.js 3.5.0 (https://github.com/obartra/ssim) for before and after diffs, shapely 2.2.0 (https://shapely.readthedocs.io/), pyproj 3.8.0 (https://pyproj4.github.io/pyproj/), rasterio 1.5.2 (https://rasterio.readthedocs.io/), opencv-python-headless 5.0.0.93 (https://pypi.org/project/opencv-python-headless/) for Canny and chamfer. Versions are the npm and PyPI latest on Nov 3, 2026; pin them in the lockfiles.

## 5. Pitfalls

- **Three coordinate systems.** Build in EPSG:26917 (NAD83 / UTM 17N, metres). EPSG:4326 is degrees (never measure in it). EPSG:3857 (Web Mercator, what ArcGIS and slippy tiles default to) exaggerates distances by 1 / cos(latitude), about 1.38 here, so a pipeline step that slips into 3857 makes the campus 38% too big; the scale gate catches it. Request City layers with `outSR=26917` or transform with one shared function.
- **Datum.** pyproj's default EPSG:4326 to EPSG:26917 path here is "Inverse of NAD83 to WGS 84 (1)", a null datum shift with a stated accuracy of 4 m (pyproj 3.8.0, PROJ 9.8.1). The ground truth was computed through that path; the game pipeline must use the same transformation (assert the transformer description in a test) or recompute the truth from native 26917 queries.
- **Vertical datum.** The DTM elevations (323.5 to 354.5 m in the 4 m sample) are as delivered by Ontario; whether they are CGVD2013 or CGVD28 is **unverified**. nDSM heights are datum-free; only mixing with City contours or spot heights needs care. In the game, subtract one base elevation from `config/campus.json` so float32 stays precise.
- **Axis conventions.** three.js is y-up and right-handed; with x east and y up, north is -z. Mirroring passes every distance test; the azimuth gate exists for this.
- **OSM building parts.** `building:part` ways carry the towers (Dana Porter's main way says 2 levels; lidar says 39.4 m). Some buildings are relations (DC, EV3). Match City to OSM relations as well as ways, and give parts their own heights.
- **City vs OSM offsets.** Matched centroids differ by median 0.98 m and p90 2.55 m. Never mix City outlines with OSM parts without aligning the parts to the City outline first, or towers float off their podiums.
- **Lidar vintage.** 2018. Anything built since (the SLC north wedge) has near-zero nDSM; anything demolished still has height. Detect with "median nDSM under 1 m over a footprint the 2026 orthophoto shows as roofed" and fall back to tags or an override; list every such building in REVIEW.md.
- **Construction sites.** Footprints with `STATUS` other than BUILT, or orthophoto areas showing cranes or bare ground, are excluded from height truth and flagged.
- **Trees over footprints** inflate p98 (SLC p98 about 40 m); use p90 and eroded footprints, never max.
- **Orthophoto relief displacement.** Tall roofs are shifted in a standard orthophoto; use it for overlays and colour, not as edge truth.
- **Indoor corridors.** 174 `highway=corridor` ways (5.2 km) and bridges (E5 Bridge, MC to QNC Walkway) are indoors or elevated (`layer=1`). Do not drape them on terrain as outdoor ribbons; exclude them from outdoor width and ribbon checks; keep them in the walk graph flagged indoor.
- **One-way splits.** Ring Road is 12 OSM ways including short one-way pairs, so naive summing double-counts a little; the length gate allows 1%.
- **Stale mirrors.** Overpass mirrors were 3 to 4 months stale on Nov 2 (doc 01); record `osm_base` or the PBF date in the manifest and in every ledger line.

## 6. Unverified items

- The 4 orthophoto widths were read by eye; they are not survey values.
- Thresholds marked "starting value" (per-pixel height error, path-mask IoU, lit-frame palette share, shadow ratio and penumbra) have no measurement yet.
- Commons coordinates may mark the subject rather than the camera; every heading is a prior to calibrate.
- The construction date of the SLC north wedge (only "after the 2018 lidar" is supported by data).
- The Waterloo orthophoto licence (doc 01): use it for QA only.
- Vertical datum of the Ontario DTM.
- Headless WebGPU availability on the build machine.
- The UGG camera pitch and FOV ranges (doc 02 estimates from screenshots).
