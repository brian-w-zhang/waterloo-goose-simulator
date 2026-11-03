# 01 Data sourcing: building UW main campus from open data

Every open data source for an accurate, reproducible University of Waterloo main campus, with endpoints, queries, licences, real counts measured on Nov 2, 2026, gotchas, a build pipeline and validation metrics.

Priority 1 for the project is the world and the map. This doc is the spec for that. All counts below were measured by Grok Bot on Nov 2, 2026 (America/Toronto) unless marked otherwise; samples are in [data-samples/](data-samples/README.md).

## 1. The area

- **Campus definition**: OSM relation [11680616](https://www.openstreetmap.org/relation/11680616) "University of Waterloo" (multipolygon, wikidata Q1049470). 400.4 ha across 7 polygons including satellite campuses. The 4 main-campus polygons in Waterloo total about 397 ha: part 0 main campus and residences 109.1 ha, part 1 east campus (E5, E6) 12.4 ha, part 2 101.4 ha, part 3 north campus (Accelerator Centre, OpenText, Columbia Icefield, Optometry) 174.7 ha. Bounds of the main parts: lon -80.5723 to -80.5324, lat 43.4645 to 43.4855. Sample: [data-samples/osm/uw_main_campus_boundary.geojson](data-samples/osm/uw_main_campus_boundary.geojson).
- **Recommended game bbox** (core campus plus Ring Road surroundings, Columbia Lake edge, ION line): S 43.4630, W -80.5600, N 43.4790, E -80.5310. In UTM 17N that is about 535593 to 537929 E and 4812326 to 4814116 N, roughly **2.3 km x 1.8 km**. North campus beyond Columbia Street can be a later extension.
- **Projection**: build everything in NAD83 / UTM zone 17N (EPSG:26917), metres, with a local origin (suggest 536000 E, 4813000 N) so float32 positions stay precise. All Ontario and City rasters are already in EPSG:26917.
- **Relief**: the DTM over the game bbox ranges from 323.4 m to 354.7 m, so about 31 m of relief. Terrain matters (Laurel Creek valley, Columbia Lake, the hill up to the Village residences).

## 2. Source inventory

Bbox note: counts from City `gis.waterloo.ca` MapServer layers (footprints 479, trails 53, water 8, creeks 12, existing trees 691, roads 99) used the smaller **core bbox** lon -80.5580 to -80.5370, lat 43.4650 to 43.4780. Counts from the hosted FeatureServers (1,090 buildings, 217 sidewalks, 138 trails, 3,076 trees, 2,871 contours), the Region layer (976) and Overpass (paths, landcover, transit) used the larger **game bbox**.

| Layer | Best source | Endpoint | Licence | Count (measured; see bbox note below) | Use |
|---|---|---|---|---|---|
| Campus boundary | OSM relation 11680616 | OSM API `relation/11680616/full` | ODbL 1.0 | 7 polygons | World limits, "on campus" tests |
| Building footprints (named, attributed) | City of Waterloo Public_Base layer 3 | `gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/3` | Waterloo Open Data User Licence | 479 in the core bbox (480 GeoJSON features) | Footprints, names, owner, fire storeys |
| Building footprints (rooftop outlines) | City hosted "Buildings" FeatureServer | `services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/Buildings/FeatureServer` | Waterloo Open Data | 1,090 (updated 2025-06-02) | Cross-check, small structures |
| Building footprints (region) | Region of Waterloo layer 11 | `utility.arcgis.com/usrsvcs/servers/12d17585568d410fb3b6cca6fdc44c70/.../MapServer/11` | Region Open Data Licence v2.0 | 976 | Cross-check |
| Building tags (levels, roof, colour, parts) | OSM | Overpass or OSM API | ODbL | 427 ways and 2 relations inside the relation (Overpass `out count`) | Levels, roof shape, colours, names, entrances |
| Heights | Ontario lidar DSM and DTM, 0.5 m | Package zips (see 5) | OGL Ontario | 9 one-km tiles cover the bbox | Roof heights, terrain, canopy |
| Terrain | Ontario lidar DTM | Same | OGL Ontario | 31 m relief | Heightmap |
| Paths, roads, steps, corridors | OSM | Overpass | ODbL | 3,044 ways, 192.4 km | Walk network, navmesh, road meshes |
| Sidewalks (City side) | City "Sidewalks" FeatureServer | hosted | Waterloo Open Data | 217 | Off-campus sidewalks |
| Trails | City Public_Operations 31 and hosted Trails_and_Pathways | `.../Public_Operations/MapServer/31` | Waterloo Open Data | 53 and 138 | Laurel Trail etc. |
| Water | City Public_Base 21 (lakes, ponds), 17 (creeks); OSM water | | Both | 8 water bodies, 12 creeks | Columbia Lake, Laurel Lake, Laurel Creek |
| Trees | OSM `natural=tree` plus City inventory plus lidar canopy | | ODbL, Waterloo Open Data, OGL | OSM 1,677 tree nodes (none with height); City 3,076 hosted or 691 existing in the core bbox | Tree instances |
| Landcover | OSM landuse, leisure, natural | Overpass | ODbL | grass 174, park 46, pitch 35, parking 215 | Ground materials |
| Imagery (reference) | City 2026 spring orthophoto, 10 cm | `Public/Public_Imagery_Current/MapServer` layer 9 | **Unverified** | n/a | Colour sampling, QA, not shipped |
| Transit | GRT GTFS, ION; OSM | `webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/1` | Region Open Data Licence | 30 bus stops (OSM), 2 ION stations | Buses, trains, crowd spawns |
| Class timetable | UW Open Data API v3 | `openapi.data.uwaterloo.ca` | UW API terms (**unverified**) | n/a | Crowd waves between classes |
| Street furniture | OSM nodes | Overpass | ODbL | inside campus: 230 lamps, 106 benches, 82 hydrants, 80 bike racks, 30 bins, 14 picnic tables, 171 entrances | Props, NPC destinations |

## 3. OpenStreetMap

### 3.1 How to fetch

Three ways, in order of reliability on Nov 2, 2026:

1. **OSM API map call** (fresh, small areas only): `https://api.openstreetmap.org/api/0.6/map?bbox=-80.558,43.465,-80.537,43.478` returned 6.9 MB of XML in 3.8 s. The API refuses areas over 0.25 square degrees or 50,000 nodes, so tile the game bbox into 2 to 4 calls. Also `https://api.openstreetmap.org/api/0.6/relation/11680616/full` for the boundary.
2. **Overpass** (best for filtered queries): the query files are in [data-samples/queries/](data-samples/queries/). Use `[out:json][timeout:180]` and `out tags geom qt;` so ways come with inline coordinates.
3. **Geofabrik extract** (reproducible snapshot): `https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf` is 1.03 GB with data up to 2026-11-01. Clip with `osmium extract -b -80.5600,43.4630,-80.5310,43.4790`. This is the most reproducible option: pin the file date in the build manifest.

Gotchas measured today:

- `overpass-api.de` returned **HTTP 406 for the default curl User-Agent**. Always send a descriptive `User-Agent` (for example `waterloo-goose-simulator/0.1 (contact email)`). With a custom UA it then returned 502 "at capacity" repeatedly.
- `overpass.private.coffee`, `maps.mail.ru` and `overpass.osm.jp` timed out. `overpass.kumi.systems` worked but its `timestamp_osm_base` was **2026-07-15 on one query and 2026-07-24 on another**, so its data was 3 to 4 months stale. Always log `osm3s.timestamp_osm_base` in the manifest. slop-newyork's `overpass.sh` handles this with mirror rotation (see [research/slop-newyork-teardown.md](research/slop-newyork-teardown.md)).
- For reproducible builds, prefer Geofabrik plus osmium locally, and use Overpass only for exploration.

### 3.2 Queries

Count of buildings inside the campus relation (result: 427 ways, 2 relations):

```
[out:json][timeout:60];
rel(11680616); map_to_area->.uw;
( way["building"](area.uw); way["building:part"](area.uw); rel["building"](area.uw); );
out count;
```

Walkways and roads in the game bbox (result: 3,044 ways, 192.4 km):

```
[out:json][timeout:180];
way["highway"~"^(footway|path|pedestrian|steps|cycleway|service|living_street|unclassified|tertiary|secondary|corridor)$"](43.4630,-80.5600,43.4790,-80.5310);
out tags geom qt;
```

Landcover, water and transit (result: 2,429 elements): `nwr` with `natural` in water, wetland, wood, scrub, grassland, tree_row; `waterway`; `landuse` grass, forest, meadow, recreation_ground; `leisure` park, garden, pitch, sports_centre; `amenity=parking`; `node[natural=tree]`; `highway=bus_stop`; `railway` light_rail, station, platform, tram_stop; `public_transport`. Full text in [data-samples/queries/uw_landcover_water.overpassql](data-samples/queries/uw_landcover_water.overpassql).

### 3.3 What OSM has on campus (measured)

From the OSM API extract, filtering to ways whose centroid lies inside the assembled campus polygon:

- **341 building or building:part ways.** Tag coverage: `building:levels` 279 (82%), `building:part` 184, `name` 109, `building:min_level` 64, `building:material` 64, `ref` 60, `roof:shape` 47, `building:colour` 42, `roof:colour` 38, `height` only 6.
- From the Overpass relation query: 427 elements, `building` values yes 221, university 63, terrace 49, dormitory 40, roof 13, office 11; 179 named.
- Some major buildings are **relations, not ways**: DC is relation 3776384 (type=building) and 8765264 (multipolygon); Environment 3 is relation 13372648. A way-only pipeline silently drops them. Handle `type=multipolygon` and `type=building` relations.
- Several towers are modelled with `building:part`, so the main outline's levels can be misleading. Example: Dana Porter Library's main way says 2 levels while the City says 10 fire storeys and lidar p90 is 39.4 m; the tower is in the parts.

Highways on campus (by count and length, campus polygon only): footway 964 (32.1 km), service 298 (26.0 km), corridor 174, steps 116, cycleway 64 (8.5 km), path 48, pedestrian 12 (2.4 km), platform 12. Across the whole game bbox (Overpass): footway 1,677 (81.6 km), service 661 (52.2 km), cycleway 102 (16.2 km), secondary 74 (12.5 km), path 132 (9.6 km), tertiary 31, unclassified 31, corridor 174 (5.2 km), pedestrian 16 (3.6 km), steps 145 (0.9 km); total 192.4 km.

- Only **44 of 3,044** ways have `width`, so path widths must be inferred by type (suggest footway 2.0 m, path 1.5 m, pedestrian 6 m, service 5 m, cycleway 2.5 m, secondary 12 m; tune against the orthophoto).
- `footway=sidewalk` 263, `footway=crossing` 189, `lit` set on 555, bridges 28, tunnels 14.
- **252 indoor ways** (`indoor=yes` or `highway=corridor`): the tunnels and bridges between buildings (for example the MC, DC, EIT links). The game can skip interiors at first but these ways are a gift for later "goose gets inside" content.
- Surfaces: asphalt 928, concrete 452, paving_stones 191, paved 127, none 1,221. Use these for ground materials and footstep sounds.
- Named paths: Laurel Trail, Path 2 East, Two Row Path, Ring Road, Main Path, Transit Plaza Road, Frank Tompa Drive, Hagey Boulevard, Rev Road, Seagram Drive.

Points inside the campus polygon: natural=tree 998, highway=street_lamp 230, entrance=yes 171, amenity=bench 106, crossing 100, emergency=fire_hydrant 82, amenity=bicycle_parking 80, amenity=waste_basket 30, bus_stop 17, leisure=picnic_table 14. Benches, bins, picnic tables and bike racks are perfect UGG-style interactables (see [03-untitled-goose-game-deep-dive.md](03-untitled-goose-game-deep-dive.md)).

Water in OSM: Columbia Lake (relation 224955), Laurel Lake, Laurel Creek (relation 11299680), Strauss Lake, Clair Lake.

Transit in OSM: "University of Waterloo" ION station and "Laurier-Waterloo Park" station, 3 to 6 light_rail ways, 30 bus stops in the game bbox (for example "University Ave. / Ring Rd." ref 2677 and "University of Waterloo Terminal" ref 102818).

## 4. City of Waterloo GIS

### 4.1 Endpoints

- ArcGIS Server 11.3 at `https://gis.waterloo.ca/maps/rest/services`. Data is natively EPSG:26917.
- `Public/Public_Base/MapServer` is **not listed** in the services directory but responds. Layer 3 Building Footprints, 12 Roads (99 in bbox), 17 Creeks (12), 21 Water Bodies (8). Layer 2 returns an error.
- `Public/Public_Operations/MapServer`: layers 2 and 3 street trees (690), 31 Trails (53, including UW-owned "University of Waterloo Trail" and Laurel Trail), 34 Winter Sidewalks and Trails (132, mostly City sidewalks, `WIDTH_M` mostly null). Layers 25 and 29 return 0 in the bbox.
- `Public/Public_Forestry_Mobile/MapServer/1`: tree inventory, 936 in the bbox (691 with status Existing).
- `Public/Public_Imagery_Current/MapServer`: layer 9 is "2026 10cm Imagery Spring". Archive services go back to 1930 (2025 summer, 2023 7 cm, and older).
- Hosted FeatureServers under `https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/`: `Buildings` (1,090 in the game bbox; rooftop outlines digitised from air photos since 2000; fields only OBJECTID and AREA_M; updated 2025-06-02), `Sidewalks` (217), `Trails_and_Pathways` (138), `Street_Tree_Inventory` (3,076), `Contours_2014` (2,871).
- Discovery: the Hub search API `https://opendata-city-of-waterloo.opendata.arcgis.com/api/search/v1/collections/all/items?q=building`.

Query pattern (GeoJSON straight out, in WGS84):

```
https://gis.waterloo.ca/maps/rest/services/Public/Public_Base/MapServer/3/query
  ?geometry=535593,4812326,537929,4814116&geometryType=esriGeometryEnvelope&inSR=26917
  &spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=geojson
```

Add `returnCountOnly=true` for counts, and page with `resultOffset` and `resultRecordCount` if a layer caps results (check `maxRecordCount` in the layer JSON).

Orthophoto export (reference only):

```
https://gis.waterloo.ca/maps/rest/services/Public/Public_Imagery_Current/MapServer/export
  ?bbox=536300,4813100,536700,4813500&bboxSR=26917&imageSR=26917
  &size=800,800&format=jpg&layers=show:9&f=image
```

### 4.2 What the City footprints give you

Fields on layer 3 include `BLDG_ABBREV`, `BLDG_NAME`, `OWNER`, `FIRE_STOREYS`, `FIRE_STOREYS_SOURCE`, `YEAR_BUILT_MPAC`, `FULL_STOREYS_MPAC`, `BUILDING_USE`, `MAJOR_BUILDING`. In the core bbox: 480 features; owner null 348, "UNIVERSITY OF WATERLOO" 115 (56 with `FIRE_STOREYS`), "OTHER UW" 12, "OTHER" 5. `BLDG_ABBREV` gives you the UW building codes (DC, MC, SLC, E5) directly, which is the join key to the UW API and to signage. Sample: [data-samples/city-of-waterloo/cow_building_footprints_campus.geojson](data-samples/city-of-waterloo/cow_building_footprints_campus.geojson); a UW-only attribute dump is in [research/raw/cow-uw-buildings-attrs.json](research/raw/cow-uw-buildings-attrs.json).

### 4.3 Licence

- Waterloo Open Data User Licence. The City's open data page says "You may use and republish the data as you wish, according to the Open Data Licence" (https://www.waterloo.ca/en/government/open-data.aspx).
- Attribution text "Contains information provided by the City of Waterloo under licence" and the "credit optional" wording come from a third-party summary (builddata.ca); **the full licence text was not fetched, so treat the exact terms as unverified** and read the licence before shipping.
- Whether the orthophoto imagery is covered by the same licence is **unverified**. Use it for colour sampling and QA only.

## 5. Ontario lidar (heights and terrain)

### 5.1 Products

- data.ontario.ca lists "Ontario Digital Surface Model (Lidar-Derived)", "Ontario Digital Terrain Model (Lidar-Derived)" and the point clouds, all under the **Open Government Licence, Ontario** (https://www.ontario.ca/page/open-government-licence-ontario). Attribution: "Contains information licensed under the Open Government Licence, Ontario."
- Tile indexes: `https://www.publicdocs.mnr.gov.on.ca/mirb/OntarioDSM_LidarDerived_TileIndex.zip` (32 MB, 195,576 tiles; fields TileName, FileName, Package, Project; CRS NAD83 CSRS geographic) and the matching DTM index (200,296 tiles).
- Campus coverage: 9 one-km tiles from project **"OMAFRA Lidar 2016-18"** (Lake Erie block), 2018 vintage, 0.5 m, EPSG:26917. Names `1km17{535,536,537}0{4812,4813,4814}02018LLAKEERIE.img` (DTM) and `..._DSM.img` (DSM). The DSM catalog lists `VerticalAccuracy` 5 with unclear units (**unverified**; likely centimetres, not checked).
- A newer project "DEDSFM Upper Thames-Grand River 2025" appears in the ImageServer catalog over campus, but only as overview tiles; full-resolution data was not available on Nov 2, 2026. Worth re-checking later in the term.

### 5.2 How to download only campus (the trick)

The tiles ship inside multi-GB package zips:

- DSM: `https://ws.gisetl.lrc.gov.on.ca/fmedatadownload/Packages/Lake-Erie-DSM-29.zip` (3.39 GB)
- DTM: `https://ws.gisetl.lrc.gov.on.ca/fmedatadownload/Packages/LIDAR2016to18_DTM-LkErie-S.zip` (3.26 GB)

The server supports HTTP range requests, so read the zip central directory and pull only the 9 tiles (about 6 MB compressed each) with Python `remotezip`:

```python
from remotezip import RemoteZip
url = "https://ws.gisetl.lrc.gov.on.ca/fmedatadownload/Packages/Lake-Erie-DSM-29.zip"
want = [f"1km17{e}0{n}02018LLAKEERIE_DSM.img" for e in (535, 536, 537) for n in (4812, 4813, 4814)]
with RemoteZip(url) as z:
    for name in z.namelist():
        if any(name.endswith(w) for w in want):
            z.extract(name, "lidar/dsm")
```

Gotcha: the ImageServers (`https://ws.geoservices.lrc.gov.on.ca/arcgis5/rest/services/Elevation/Ontario_DSM_LidarDerived/ImageServer` and the DTM twin) **return all zeros or NoData from `exportImage`** over campus (the default mosaic gives the 2025 overview-only project priority; `LockRaster` mosaic rules also failed), while `identify` works. Do not build on `exportImage`.

### 5.3 Heights: measured results

`nDSM = DSM - DTM`. For each City footprint, eroded by about 1 m to avoid wall-edge pixels, take the median, p90 and p98 of nDSM pixels ([data-samples/queries/lidar_heights.py](data-samples/queries/lidar_heights.py); output [data-samples/ontario-lidar/uw_building_heights.csv](data-samples/ontario-lidar/uw_building_heights.csv)).

Example p90 heights above ground: E5 32.5 m, E6 30.0 m, QNC 34.2 m, MC 25.8 m, M3 22.4 m, STC 25.1 m, DC about 16.5 to 16.7 m (main roof; the DC tower parts are taller), Dana Porter Library 39.4 m, Hagey Hall 22.4 m, PAC 15.0 m, EV3 24.6 m, VS1 8.5 m.

How good are "levels times storey height" estimates, compared with lidar p90:

| Estimator | n | RMSE | MAE |
|---|---|---|---|
| OSM `building:levels` x 3.5 m | 113 | 12.23 m | 5.82 m |
| City `FIRE_STOREYS` x 3.5 m | 93 | 10.81 m | 5.15 m |
| OSM levels x best-fit 3.62 m (only footprints with IoU over 0.7) | 72 | 6.24 m | n/a |

Conclusion: **use lidar for heights**; tags alone are off by 6 to 12 m RMSE, mostly from towers modelled as parts and from roof plant. Fall back to tags only for buildings newer than the 2018 lidar.

Gotchas:

- The lidar is 2018. Anything built or demolished since is wrong. Detect by comparing the City footprint `YEAR_BUILT_MPAC` and OSM `start_date`, or by footprints with near-zero nDSM.
- Trees overhanging footprints inflate nDSM; p98 is noisy (SLC p98 is about 40 m, which is not the roof). Use p90 or a robust mode, eroded footprints, and optionally mask pixels whose DSM first-return minus last-return differs (not available in the DSM product; would need the point cloud).
- Multi-height buildings (tower plus podium): segment the nDSM inside a footprint into height clusters, or rely on OSM `building:part` outlines and assign each part its own p90.

### 5.4 Terrain

- DTM resampled to 4 m is in [data-samples/ontario-lidar/dtm_campus_4m_u16.png](data-samples/ontario-lidar/dtm_campus_4m_u16.png): 585 x 450 px, origin 535590 E, 4814120 N (top-left), decode `elev = 323.499 + v / 65535 * 31.035`.
- For the game, 2 m terrain over 2.3 x 1.8 km is 1,168 x 896 samples (about 1 M vertices before LOD), which is fine for a chunked terrain with 4 levels of detail. Flatten terrain under building footprints to the footprint's median ground elevation so buildings sit cleanly.
- Water: cut lakes and creeks from the DTM using the City water polygons and set a flat water surface per lake (Columbia Lake 10.80 ha, Laurel Lake 0.66 ha).

## 6. Trees

- OSM: 1,677 `natural=tree` nodes in the game bbox (998 inside the campus polygon); 1,601 have no species and **none have a height**.
- City: 691 existing City-owned trees in the core bbox with species and DBH, but only on City land (streets and parks). UW's own campus trees are not in the City inventory. The hosted `Street_Tree_Inventory` has 3,076 in the wider bbox.
- Lidar: canopy shows clearly in the nDSM preview ([data-samples/ontario-lidar/ndsm_campus_2m_preview.png](data-samples/ontario-lidar/ndsm_campus_2m_preview.png)). Recommendation: place a tree at each OSM or City point, take its height from the local nDSM maximum within 3 m, pick a crown radius from DBH or from the nDSM blob, and add procedural trees in wooded landcover polygons (`natural=wood`) by Poisson-disk sampling against the nDSM.
- Tree species can pick a palette (maples go orange in autumn mode).

## 7. Transit, people and time

- GRT GTFS static: `https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/1` (older URL `https://www.regionofwaterloo.ca/opendatadownloads/GRT_GTFS.zip`). The Mobility Database lists the current feed as valid Oct 26 to Dec 21, 2026, 1.79 MB zipped (**from the Mobility Database listing, not unzipped by me**). GTFS-realtime feeds also exist. Region Open Data Licence v2.0: credit optional, suggested "Contains information provided by the Regional Municipality of Waterloo under licence"; no endorsement implied.
- GRT also publishes ION stations and routes as open datasets on the Region's open data portal.
- UW Open Data API v3: swagger at `https://openapi.data.uwaterloo.ca/swagger/v1/swagger.json`. Every call needs an `x-api-key` header (401 without one; how keys are issued was not checked). Useful endpoints: `/v3/Locations` and `/v3/Locations/geojson` (building codes with lat and long points), `/v3/ClassSchedules/{termCode}/...` (class start and end times, day pattern, `locationName`; no enrolment counts seen), `/v3/FoodServices/outlets`, `/v3/Terms`. Terms of use **not reviewed**; check before shipping data derived from it.
- Class timing for crowd waves: UW uses 50-minute MWF-style slots (8:30 to 9:20, 9:30 to 10:20 and so on) with 10-minute travel gaps, and 80-minute TTh slots (for example 1:30 to 2:50 and 3:00 to 4:20). Sources: https://uwaterloo.ca/health/faculty-staff/undergraduate-and-graduate-course-scheduling and https://uwaterloo.ca/future-students/missing-manual/student-life/whats-it-really-study-engineering-waterloo. So corridors should flood at :20 to :30 and :50 to :00. Even without the API, a hard-coded slot table gives believable rush hours.

## 8. Other building sources (for cross-checks, not primary)

- **Overture Maps buildings**: ODbL overall, mixing OSM, Esri Community Maps (CC BY 4.0), Microsoft ML footprints (ODbL) and Google Open Buildings (CC BY 4.0). Citation "Overture Maps Foundation, overturemaps.org" (https://docs.overturemaps.org/attribution/). Useful mainly for `height` where OSM lacks it; check per-feature `sources`.
- **Microsoft CanadianBuildingFootprints** (https://github.com/microsoft/CanadianBuildingFootprints): ODbL, 3,781,847 footprints in Ontario, reported precision 98.7% and recall 72.3%, no heights. Worse than City data for campus.
- **City contours 2014** (2,871 lines): redundant with the lidar DTM.

## 9. Pipeline

Deterministic, cached, re-runnable from a clean checkout. Each step writes to `data/build/` with a manifest entry (source URL, fetch time, `osm_base` timestamp or file date, sha256).

1. **fetch**: Geofabrik PBF (or OSM API tiles), City layers as GeoJSON via `query` (paged), lidar tiles via `remotezip`, GTFS zip. Cache in `data/raw/` keyed by URL plus date; never re-fetch in CI.
2. **clip and project**: osmium clip to the game bbox; reproject everything to EPSG:26917 with a local origin of 536000 E, 4813000 N.
3. **terrain**: mosaic DTM tiles, resample to 2 m, burn water polygons to flat lake levels, flatten under building footprints, export a 16-bit PNG heightmap per 256 m chunk plus a JSON with origin, scale and min and max.
4. **buildings**: start from City footprints (best names and codes), conflate with OSM ways and relations by IoU (match when IoU over 0.5), carry OSM `building:part`, roof shape and colours across, compute nDSM p90 per footprint or part, fall back to `levels x 3.62 m`, then `fire_storeys x 3.62 m`, then 8 m. Simplify polygons to 0.3 m, then triangulate walls and roofs (flat, or gabled or hipped from `roof:shape`).
5. **network**: OSM walkable ways become ribbons with type-based widths; build a pedestrian graph (nodes at intersections and entrances) for NPC routing; bake a navmesh over terrain minus building footprints and water (see [05-simulation-and-npc-design.md](05-simulation-and-npc-design.md)).
6. **landcover**: rasterise grass, park, pitch, parking, wood and water polygons into a splat map (one RGBA texel per 1 m) for ground shading.
7. **props**: trees (section 6), benches, bins, lamps, bike racks, picnic tables, bus stops from OSM nodes; ION track from light_rail ways.
8. **pack**: a binary world file in the spirit of slop-newyork's NYB1 (header, string table, typed arrays for vertices, indices, per-building metadata), split per chunk so the browser streams only nearby chunks. Target under 20 MB total, compressed.
9. **validate**: run the checks in section 10 and fail the build if thresholds regress.

## 10. Validation and benchmarks

| Metric | How | Baseline measured today | Target |
|---|---|---|---|
| Footprint agreement | IoU between City and OSM footprints for matched buildings | 451 of 480 matched; IoU median 0.806, mean 0.743, p10 0.483; 77% over 0.7, 12% over 0.9. UW-owned: 112 of 115 matched, median 0.743, p10 0.195 | Report per building; flag IoU under 0.5 for manual review |
| Roof height error | RMSE of chosen height vs lidar p90 on held-out buildings | Tags only: 10.8 to 12.2 m RMSE; fitted 6.24 m | Under 2 m RMSE for lidar-derived heights on buildings built before 2018 |
| Terrain error | DTM vs City spot elevations or contours | not measured | Under 0.5 m |
| Coverage | Share of UW-owned City footprints present in the world | n/a | 100% of the 115 |
| Path network connectivity | Share of building entrances reachable on the walk graph | not measured | Over 95% |
| Visual QA | Orthophoto vs top-down render overlay per chunk, screenshot diff | n/a | Manual sign-off per chunk |

These are also the MP3 "compare to alternatives" evidence the handbook asks for ([research/course-constraints.md](research/course-constraints.md)).

## 11. What the slop-cities forks teach

From [research/slop-newyork-teardown.md](research/slop-newyork-teardown.md) and the slop-cities index (https://github.com/zz85/slop-cities, `cities.yml`, about 80 playable takes):

- **Slop New York** (mrdoob, https://github.com/mrdoob/slop-newyork): build-time tools fetch open data (NYC footprints with heights, OSM via `overpass.sh` with mirror rotation), pack everything into one binary (NYB1) and render with three.js WebGPU. Copy the shape: offline build step, binary pack, streaming client.
- **Slop Helsinki** (https://github.com/kinotus/slop-helsinki): streams the city's photo-textured LoD2 3D Tiles. Lesson: when a city publishes 3D, use it; Waterloo does not, so we derive.
- **Slop Zurich** (https://github.com/colorfield/slop-zurich): swissBUILDINGS3D; the repo is about 130 MB, a warning to keep raw data out of git.
- **Slop San Francisco** (https://github.com/unable12/slop-sanfrancisco): DataSF plus USGS elevation; real hills, marine fog. Lesson: terrain sells place.
- **Slop Toronto** (https://github.com/johnfewell/slop-toronto and https://github.com/aalghooneh/slop-toronto): Toronto 3D Massing; aalghooneh's `tools/commons-palette.py` samples about 430 Wikimedia Commons photos to pick facade colours. Lesson for us: sample facade colour from photos or the orthophoto, then quantise to the toon palette.
- **Slop Singapore** (https://github.com/zz85/slop-singapore): a generic per-city config (`tools/city/cities/<city>.mjs`). Lesson: put all Waterloo-specific constants (bbox, origin, sources, widths) in one config file.
- **"LLM residents" fork** (https://github.com/trippuroskie/slop-newyork, MIT): eight Midtown residents with needs whose hourly plans come from one batched LLM call through a local Node server with a mock fallback when no key is set. Directly relevant prior art for the Jev design in [05-simulation-and-npc-design.md](05-simulation-and-npc-design.md).
- Contact sheet of slop-cities screenshots: [research/raw/slop-cities-screenshots-contact.jpg](research/raw/slop-cities-screenshots-contact.jpg). None of them are toon-shaded; a UGG-style campus would stand out.

## 12. Unverified or open items

- Exact text of the Waterloo Open Data User Licence and whether it covers orthophotos.
- UW Open Data API terms of use.
- Units of the lidar `VerticalAccuracy` 5.
- GTFS validity dates (from Mobility Database, not unzipped).
- Whether the 2025 DEDSFM lidar will publish full resolution over campus during the term.
- The OSM counts in 3.3 come from a 3-month-stale Overpass mirror (relation query) and a fresh OSM API extract (tag coverage); expect small drift.
