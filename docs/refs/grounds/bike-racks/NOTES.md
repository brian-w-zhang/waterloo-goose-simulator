# Bike racks, shelters and repair stations

## Best data: the UW bike rack inventory (public ArcGIS)
- `private/data/uw_bike_racks_v2.geojson` contains **229 rack points** from https://services5.arcgis.com/z87D0RdgTttiUQbV/arcgis/rest/services/Bike_RackDatav2/FeatureServer/0. They hold **2198 bike slots** in total.
- Fields: Location_Description (for example "DC outside entrance 1842G"), rack_type, bike_slot_count, Shelter (Yes / Partially / No), placement_type (Movable 191 / Fixed 37), security, rack_intention, winter_handing (left in place / moved for winter / snow-cleared), Latitude, Longitude.
- Rack types:

| rack_type | count | slots | sheltered | example locations |
|---|---|---|---|---|
| **Inverted U Squared Off** | 164 | 1314 | 45 | DC entrance 1842G, HH hub entrance, HH under the overhang, PAS loading dock. This is the campus default. |
| Raised Circle | 15 | 336 | 5 | SCH, Tatham Centre, AL ramp, DP/AL quad |
| Post and Ring | 13 | 198 | 0 | EV1 dock, EV3, E5 under link, E5 by the tracks |
| Triangular Green Single Sided Access | 12 | 68 | 0 | REV north quad, CLV, Minota Hagey |
| Inverted U Rounded Top | 9 | 72 | 3 | CHEM2, MC alcoves near 1026, BMH |
| Bolted Single Inverted U | 6 | 52 | 0 | GSC, CMH, IA |
| Bolted C | 2 | 98 | 2 | PSE |
| Triangular Unpainted Single Sided | 3 | 22 | 0 | MKV / V1, UWP |
| Orange Raised Ovals | 1 | 8 | 0 | DP/AL quad |
| Curved bars with loop lock hole | 1 | 14 | 1 | EV3 |
| Post and Square | 1 | 16 | 0 | E5 |

- Also: `Bike_relatioship_WFL1` (108 aggregated rack groups with occupancy surveys) and `Bike_Racksv2_copy` (218, older).
- OSM (`private/data/osm_in_boundary.geojson`): 102 bicycle_parking (stands 38, rack 15, wall_loops 10, bollard 7, lockers 3; 14 covered; colours silver / grey) and **5 bicycle_repair_station** points.

## Modelling-ready descriptions
- **"Inverted U squared off":**
  - Galvanised or silver steel tube, about 50 mm diameter, about 0.9 m high and 0.6-0.75 m wide, with square-cornered top bends.
  - Typically several hoops welded to **two ground rails**, which makes them movable units. 191 of the 229 racks are "Movable".
  - Spacing is about 0.9 m. Example: DC west side (`../grounds-commons` NOTES, "galvanised inverted-U hoops on a ground rail (DC 2025)").
- Older types are still visible in photos: **red wave racks** (DC 2012), galvanised coil / grid "raised circle" racks (SLC 2020), and **green triangular racks** at residences.
- **Covered racks:** some buildings have canopy-covered racks (QNC, B1, ESC, EIT per FAUW) or racks under building overhangs.
  - The **Landscape Forms "Ring" bike racks with repair stations** at the "South Common" project are a separate type; the project date is unknown (see `../benches-tables/`).
- **Secure parking:**
  - A bike cage beside **EV3** (rented monthly).
  - Bike lockers at 6 locations.
  - A new indoor WatCard-access bike room on East Campus (2025).
  - The Bike Centre is in SLC 0101.
- **Repair stations:** free fix-it stands with pumps. One is on the north side of DWE next to CPH; all are on the campus map.
  - Generic form: a steel post about 1.2 m tall with hanger arms and tethered tools, often painted. The colour at UW is unverified.

## Images (private/web, 2)
"Bikes galore near the Davis Centre" (Flickr, about 2005) and a Laurel Trail bike entrance. There are few close-ups; use `docs/refs/streetview/` and `../ion-station/private/web/005_*` (bus depot bike parking).
