# Maps, GIS layers and open data for the UW main campus grounds

Collected 2026-11-03. Downloads are in `private/` (git-ignored). Coordinates are WGS84 lon/lat unless noted. Our boundary bbox is -80.5625, 43.4636 to -80.5303, 43.4803 (`docs/refs/boundary.geojson`).

## 1. Official campus map
- **Current printed map (2026):** `private/pdf/fp3990_campusmap_2026_tour-lr-1-final-ua.pdf`. It is linked from https://uwaterloo.ca/about/maps-and-directions.
  - One page, 1728 x 864 pt. Rendered at 110 dpi as `private/pdf/campusmap_2026-1.png`.
  - Legend: accessible entrances and parking, bike parking cage, bike repair station, Bike Centre (SLC 0101), GRT / GO / FedBus stops, motorcycle parking, permit / payment / short-term parking, self-guided tour stops ("Campus tours start here").
- Older maps for comparison: the 2023 map with tour (`fp2642_...pdf`) and the 2022 tear-off (`fp2102_...pdf`).
- **Interactive map:** https://uwaterloo.ca/map/ redirects to an ArcGIS Experience Builder app, https://experience.arcgis.com/experience/48e2192807e14d7692d76b505f0a9d82.
  - Its web map item is `c3930fe1ee3647d6be57726c68ef3216`.
  - Operational layers: Parking, Food, Buildings.
  - Basemaps: "campus basemap" vector tiles (item `165be6335c4a4073a07aaca354772cb2`) over Esri OSM Light Gray.
- **Peter Russell Rock Garden map:** see `../peter-russell-rock-garden/`.

## 2. UW's public ArcGIS Online services
The services are at https://services5.arcgis.com/z87D0RdgTttiUQbV/arcgis/rest/services. They are public, there are 22 of them, and each can be queried with `/query?where=1=1&outFields=*&f=geojson`. The useful ones are below; downloaded copies are noted.

| Service / layer | Geometry | n | Key fields | Saved as |
|---|---|---|---|---|
| `Bike_RackDatav2/0` | point | 229 | rack_type, bike_slot_count, Shelter, placement_type, Location_Description, winter_handing | `../bike-racks/private/data/uw_bike_racks_v2.geojson` |
| `2025MasterParking_Stalls/0` (also `Symboled_2025_...`) | polygon (each stall) | 7231 | StallType, LotName, LotType, ServiceType | `../parking-lots/private/data/uw_2025_parking_stalls.geojson` |
| `MasterParking_LOTS_gdb/0,1` | polygon (lots) | 73 / 72 | LotName, LotType, Total, Paved (ha), Disabled, VisitorParkingAvailability | `../parking-lots/private/data/uw_parking_lots_proposal2.geojson` |
| `ParkingView/0` | point | 94 | LotName, LotType, URL, LotLabel | `../parking-lots/private/data/uw_parking_lot_points.geojson` |
| `SvcLotType_SnowRouteMapping/2` | polygon | 95 | LotName, SvcLotType (UW / contractor serviced) | `../parking-lots/private/data/uw_parking_lots_svctype.geojson` |
| `SnowRemoval_SnowRouteMapping/1` | polygon | 1992 | SnowRouteCategory (Primary / Secondary / Tertiary / N/A) | `private/data/uw_snow_removal_polygons.geojson` |
| `PropertyPoints_SnowRouteMapping/0` | point | 264 | ShortName (building codes) | `private/data/uw_property_points.geojson` |
| `Water_and_Greenspace/0,1,2` | line / polygon | 188 / 69 / 802 | OSM-derived waterways, waterbodies, greenspace | `private/data/uw_waterways.geojson`, `uw_waterbodies.geojson`, `uw_greenspace.geojson` |
| `v2_UWaterloo_Open_Data/18` photospheres | point | 57 | name, url (Google Maps photospheres) | `../uw-virtual-tour/private/data/uw_photospheres.geojson` |
| `v2_UWaterloo_Open_Data/8` firepits | point | 3 | CL1, CL2, Laurel Creek fire pit | `private/data/uw_firepits.geojson` |
| `v2_UWaterloo_Open_Data/20` stops | point | 2524 (GRT, all of the region) | id, name | `../bus-stops-and-shelters/private/data/grt_stops_campus_bbox.geojson` (57 in our bbox) |
| `v2_.../0,1,11,...` | point | | accessible entrances (66), inclusive washrooms, ATMs, visitor parking, meters, motorcycle, carshare, construction sites | not downloaded |
| `BuildingsV3` / `v3_opendata_buildings` | point | 273 | buildingCode, name, lat/lon | not downloaded (the repo has building data already) |

**The snow-removal polygons (1992) are likely the best public UW layer for paved-surface footprints.** They seem to tile roads, sidewalks and paths by snow-clearing priority. Note that 1086 of them are "N/A".

UW has no public layer for trees, lights, signs, benches or bins.

## 3. UW Plant Operations campus CAD/GIS (restricted, but the best source)
This is the Geospatial Centre's "University of Waterloo campus" dataset: https://uwaterloo.ca/library/geospatial/collections/canadian-geospatial-data-resources/university-waterloo-campus
- Provided by Plant Operations as DWG and shapefiles, UTM 17N NAD83, "current to 2025".
- Layers include **trees, vegetation, landscaping, sidewalks, steps, curbs, fences, retaining walls, bike racks, recycling containers, sanitation containers, contours, trails, playing fields, ponds, roads, parking, E5 footbridge, service tunnels**.
- Lighting is not listed.
- **Access is limited to current UW students, staff and faculty.** You request it through Ask-Us (https://uwaterloo.ca/lib-geospatial/got-question-need-appointment-ask-us) and sign the data release agreement. Use is limited to academic and personal purposes, with acknowledgement.
- If the user is a UW student, this is the single most valuable request to make.

## 4. EcoMap (Environmental Stewardship, CC BY-SA 4.0)
- About page: https://uwaterloo.ca/environmental-stewardship/about-ecomap
- Dashboard: https://uwaterloo.maps.arcgis.com/apps/dashboards/a14fea722af148da9b3f2ca84a8359b0
- Downloaded to `../planters-and-gardens/private/data/ecomap/` (`ecomap_shapefiles.zip`, UTM 17N NAD83). Layers:
  - Natural_Areas (7): UW Urban Forest, Laurel Creek Forest, REV Forest, CLV Forest, Environmental Reserve 1-3.
  - Semi_Natural_Areas (28, "Lawn; Trees").
  - Landscaped_Areas (52: 38 lawns, 13 fields, 1 greenhouse).
  - Gardens_&_Greenroofs (17).
  - Creeks (21).
  - Waterbodies (195).
  - **Walkability_Network_(Paths) (286):** 135 "Campus Walkway" segments plus crossings typed Zebra / Lined / Unmarked.
  - Trails (98).
  - Roads, Buildings, Campus_Boundary, TERANET_Parcels.

## 5. City of Waterloo open data (services.arcgis.com/ZpeBVw5o1kjit7LT)
These layers cover the City's own assets only. Ring Road and the campus interior are private, so they are not included; the campus edge streets are. Downloads are clipped to our bbox:
- `Street_Tree_Inventory/0`: see `../trees/NOTES.md`.
- `Trails_and_Pathways/0`: 163 in bbox. Fields: TRAIL_NAME, SURFACE, OWNER (includes "University of Waterloo Trail" x17 and Laurel Trail). Saved as `../laurel-creek-and-trail/private/data/city_trails_bbox.geojson`.
- `Sidewalks/0`: 261. SURFACE is mostly Concrete; BLVD_TYPE. Saved as `private/data/city_sidewalks_bbox.geojson`.
- `WalkabilityNetwork/0`: 684. Saved as `private/data/city_walkability_network_bbox.geojson`.
- **`Contours_2014/0`: 3163 lines, 1 m interval, elevations 321-355 m.** This is useful for terrain. Saved as `private/data/city_contours_2014_bbox.geojson`.
- `WaterFeatures_Creeks/0` (23, Laurel Creek perennial / intermittent), `WaterFeatures_WaterBodies/0` (11), `Stormwater_Ponds/0` (5).
- `Bridges/0` (5), `Retaining_Wall/2` (25, saved in `../bollards-fences-railings/`), `Railways/0` (ION LRT segments), `PublicArt/0`, `BicycleParking/0`, `Parks/0`.
- `SignInventory/0,1` (street signs and poles, with SIGN_HEIGHT / SIGN_WIDTH / SIGN_TYPE): **0 features in our bbox**, so it does not cover campus edges.
- No streetlight layer was found in this City org.

## 6. OpenStreetMap (Overpass, fetched 2026-11-03)
- The raw bbox dump, `private/data/osm_campus_bbox_tags.json` (9764 elements), is split by topic and clipped to the boundary polygon in each topic's `private/data/osm_in_boundary.geojson`.
- Counts inside the boundary:
  - 1507 trees and 67 shrubs.
  - **416 `highway=street_lamp`.** Some are actually power poles.
  - 111 benches and 20 picnic tables.
  - 102 bicycle_parking and 5 bicycle repair stations.
  - 35 waste baskets and 8 recycling points.
  - 182 barriers: kerbs, 18 fences, 19 gates, 7 lift gates, 4 bollards.
  - 11 artworks / fountains.
  - 25 gardens.
  - 187 Ring Road crossings / signals and 15 traffic-calming nodes.
- Tag completeness is uneven. For example, only 56 trees have a species.

## 7. Other references
- City of Waterloo Cultural Heritage Landscape study, "4 Institutional Landscapes": `private/pdf/4-institutional-landscapes.pdf`.
  - It describes UW main campus as a 237-acre designed landscape centred on Ring Road. The landscape design is by **Hideo Sasaki**, with Shore & Moffat, Len Shore, Mathers & Haldenby and Stephen Phillips.
  - Early design emphasis: "plantings, winding paths and roads, and clustered buildings ... naturalized setting and flowing landscape".
  - Heritage attributes: mature trees and shrubs; a network of foot paths and bridges; lawns, plazas and seating areas; Laurel Creek.
  - The Ontario Heritage Trust plaque is at the south entrance.
- **UW Campus Master Plan 2009:** the Plant Ops link returns 404, so it was not downloaded.
- **NW Campus Development Guidelines 2012:** downloaded as `private/pdf/2012_nw_campus_development_guidelines-1.pdf` (37 pages). It covers the R&T-park side of campus only.
  - Generic rules: walkways at least 3.0 m wide (up to 6.0 m); sidewalks at least 1.5 m.
  - It has no furniture or lamp specs.
- No public UW site-furniture or lighting standard was found. The only UW standard published online is the waste receptacle one (see `../bins/`).
- City "Forestry" Geocortex services (maps.waterloo.ca) also exist but look internal; I did not test them.
- The Region of Waterloo GIS host (gis.region.waterloo.on.ca) did not respond.
