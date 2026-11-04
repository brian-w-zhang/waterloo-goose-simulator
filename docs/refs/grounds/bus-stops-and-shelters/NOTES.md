# GRT bus stops and shelters

## Data
- **`private/data/grt_stops_campus_bbox.geojson`:** 57 GRT stops in our bbox, from UW open data layer `v2_UWaterloo_Open_Data/20`, which is a GTFS copy of unknown date. Fields: id, name, location_type.
  - Campus stops include:
    - Ring Rd / UW - South Campus Hall 2515 (-80.54028, 43.46859).
    - Ring Rd / UW - Environment 3 2516 (-80.54359, 43.46779).
    - Ring Rd / UW - University Club 2518 (-80.54799, 43.47273).
    - Ring Rd / UW - QNC 2530 (-80.54447, 43.47072).
    - Columbia / UW - Village 1 1096 / 1120.
    - Columbia / UW - Optometry 1094.
    - Columbia / UW 2531 / 3898 / 3899.
    - Hagey / UW 4074 / 4075.
    - University Ave / UW 1090 / 2676 / 3683.
    - University Ave / Ring Rd 2677 / 2780.
    - UW Station 1123 / 6004 / 6120.
  - The list may be outdated: a 2026 forum post says the Ring Road stops moved about 20 m south.
- **OSM, inside the boundary** (`private/data/osm_in_boundary.geojson`): 30 bus_stop and 23 platform nodes; **34 tagged shelter=yes, 16 shelter=no; bench=yes on 34**. OSM includes the "University of Waterloo Terminal" platforms.

## Shelter design (from photos; dimensions are estimates)
- **Standard GRT shelter:**
  - Clear glass panels in a **silver/grey aluminium frame**.
  - The roof fascia is a **yellow/gold GRT-branded band** on older shelters (`private/web/002_*`, South Campus Hall stop, 2015).
  - Footprint about 1.5 x 3.0-4.0 m, height about 2.5 m.
  - It has a GRT route-map panel and an end ad panel.
- **GRT stop pole:** a round galvanised pole with a **blue-and-white GRT stop flag** carrying the stop number and route numbers (visible in the same photo).
- ION and iXpress stops use larger ION/iXpress-branded shelters (not collected here).
- **Buses:** GRT conventional buses are white with a blue/grey stripe; iXpress buses are white with a large blue "X" (images 003, 006, both at UW about 2012).

## Gaps
There are no close-ups of the current UW Ring Road shelters. Use `docs/refs/streetview/` captures for those.
