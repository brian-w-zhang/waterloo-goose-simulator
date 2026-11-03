# Data samples

Small, real extracts of every data layer the Waterloo Goose Simulator world pipeline needs, pulled on Nov 2, 2026, with provenance and licence for each file.

These are samples for building and testing the pipeline, not the production dataset. The full pipeline in [01-data-sourcing.md](../01-data-sourcing.md) re-fetches everything from source. Coordinates are WGS84 (EPSG:4326) unless the file says otherwise; rasters are in NAD83 / UTM zone 17N (EPSG:26917).

## osm/ (OpenStreetMap, ODbL 1.0, "(c) OpenStreetMap contributors")

| File | Contents | How it was made |
|---|---|---|
| `uw_main_campus_boundary.geojson` | The 4 main-campus polygons of OSM relation 11680616 "University of Waterloo" (109.1, 12.4, 101.4 and 174.7 ha) | OSM API `relation/11680616/full`, rings assembled with shapely |
| `overpass_count_uw_relation.json` | Overpass `out count` of buildings inside the relation: 427 ways and 2 relations | `queries/uw_count.overpassql` on overpass.kumi.systems |
| `osm_uw_buildings_in_campus_relation.json` | 427 building and building:part elements (424 ways, 3 relations) inside the campus relation, with geometry; 179 named | `queries/uw_buildings.overpassql`, kumi mirror, `osm_base` 2026-07-24 (about 3 months stale) |
| `osm_named_buildings_sample.geojson` | Named campus buildings with tags (levels, roof, colour, material) | Filtered from the OSM API map extract |
| `osm_walkways_core_sample.geojson` | 740 walkable ways (footway, path, steps, corridor, service, cycleway and roads) touching a box around DC, MC, SLC and the Arts quad | Subset of `queries/uw_walkways.overpassql` result (3,044 ways in the game bbox) |
| `osm_water_parking_transit.geojson` | 372 features: water, waterways, parking lots, ION light rail and stations, GRT bus stops in the game bbox | Subset of `queries/uw_landcover_water.overpassql` result (2,429 elements) |

## city-of-waterloo/ (Waterloo Open Data User Licence; "Contains information provided by the City of Waterloo under licence")

| File | Contents | Source layer |
|---|---|---|
| `cow_building_footprints_campus.geojson` | 480 building footprints with `BLDG_ABBREV`, `BLDG_NAME`, `OWNER` (115 "UNIVERSITY OF WATERLOO", 12 "OTHER UW"), `FIRE_STOREYS`, MPAC year and storeys | `https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/3` |
| `cow_trees_existing.geojson` | 691 City-owned trees (status Existing) with species, DBH, condition. City trees only: the campus interior is UW land and is not inventoried | `.../Public/Public_Forestry_Mobile/MapServer/1` |
| `cow_trails.geojson` | 53 trail segments (Laurel Trail, "University of Waterloo Trail") | `.../Public/Public_Operations/MapServer/31` |
| `cow_waterbodies.geojson` | 8 water bodies incl. Columbia Lake (10.80 ha) and Laurel Lake (0.66 ha) | `.../Public/Public_Base/MapServer/21` |
| `cow_creeks.geojson` | 12 creek centrelines (Laurel Creek) | `.../Public/Public_Base/MapServer/17` |

## ontario-lidar/ (Open Government Licence, Ontario; "Contains information licensed under the Open Government Licence, Ontario")

| File | Contents |
|---|---|
| `dtm_campus_4m_u16.png` | Bare-earth terrain, 585 x 450 px at 4 m, 16-bit grey; decode with `dtm_campus_4m_u16.json` (`elev = 323.499 + v/65535 * 31.035`) |
| `dtm_campus_4m_u16.json` | Origin (535590 E, 4814120 N, top-left), pixel size, min and max elevation, CRS, licence |
| `ndsm_campus_2m_preview.png` | Normalised surface model (DSM minus DTM) preview at 2 m, 8-bit, for eyeballing buildings and canopy |
| `uw_building_heights.csv` | One row per City footprint: lidar pixel count, median, p90 and p98 height above ground, ground elevation, matched OSM way, OSM levels, IoU between City and OSM footprints |

Source: OMAFRA Lidar 2016-18 (Lake Erie block), 0.5 m DSM and DTM, tiles `1km17{535,536,537}0{4812,4813,4814}02018LLAKEERIE`, read by HTTP range requests out of `Lake-Erie-DSM-29.zip` (3.39 GB) and `LIDAR2016to18_DTM-LkErie-S.zip` (3.26 GB) at `https://ws.gisetl.lrc.gov.on.ca/fmedatadownload/Packages/`.

## imagery/

| File | Contents | Licence |
|---|---|---|
| `ortho_village1_2026spring_0p5m.jpg` | 800 x 800 px export of the City's "2026 10cm Imagery Spring" over 536300 to 536700 E, 4813100 to 4813500 N (Village 1 area), resampled to 0.5 m | City of Waterloo. **Unverified** whether imagery falls under the open data licence; treat as reference only and do not ship it in the game until confirmed |

## queries/

| File | What |
|---|---|
| `uw_count.overpassql` | Count of buildings inside relation 11680616 |
| `uw_buildings.overpassql` | Buildings and building parts inside the relation, with geometry |
| `uw_walkways.overpassql` | All walkable and drivable ways in the game bbox |
| `uw_landcover_water.overpassql` | Landcover, water, trees, parking, transit in the game bbox |
| `arcgis_counts.sh` | `returnCountOnly` probes against City and Region ArcGIS layers |
| `lidar_heights.py` | Zonal statistics: per-footprint nDSM median, p90, p98 and OSM IoU (produces `uw_building_heights.csv`) |

Size: about 3.1 MB total.
