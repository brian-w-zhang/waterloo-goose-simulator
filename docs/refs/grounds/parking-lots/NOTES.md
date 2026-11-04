# Parking lots

## GIS (UW ArcGIS, public; see `../maps/NOTES.md`)
- **`private/data/uw_2025_parking_stalls.geojson`: 7231 individual stall polygons (2025).** This is ideal for painting line markings.
  - Fields: StallType, LotName, LotType, ServiceType.
  - StallType: 6862 regular (null), 101 Barrier-free, 60 service, 37 visitor mobile-pay, 24 visitor metered / pay & display, 26 carpool, 14 EV charge, 14 department, 13 special reserved, 11 "15 min Day Care drop-off", 9 "15 minute", 7 police visitor, 6 IST service, 6 motorcycle.
  - Stalls per lot: Q 1012, C 836, A 642, X 632, UWP 442, CLN 303, H 289, E 271, Toby Jenkins 263, B 257, N 256, L 207, W 190, M 184, RAC 163, R 146, O 141, CLS 118, RAC II 110, K 89, T 87, S 73, V 72, O-Visitor 67, J 62, CL-Visitor 50, ...
- **`private/data/uw_parking_lots_proposal2.geojson`: 73 lot polygons.**
  - Fields: LotName, LotType (Staff/Faculty, Student, Visitor, Residence, Reserved), Total stalls, Paved (ha), Disabled, VisitorParkingAvailability.
  - Examples: Lot A 636 stalls / 5.1 ha (staff); C 809 / 6.39 ha (student); X 630 / 4.88 ha; H 274 visitor; M 151 visitor; N 255 student; W 184 student; Q 1110; B-ENG6 213; O-Visitor 69; D 9 visitor; ECH gravel lot 95.
- `uw_parking_lot_points.geojson` (94 label points) and `uw_parking_lots_svctype.geojson` (95 polygons, UW vs contractor snow clearing).
- OSM (`private/data/osm_in_boundary.geojson`): 157 parking areas, 16 parking spaces, 5 entrances. OSM also has 7 `lift_gate` and 3 `toll_booth` barriers (gated lots).

## Operations and fixtures
- **Pay-and-display machines were removed** (starting 2025-01-20). Visitors pay with the **AMP mobile app** or use **gated lots** (https://uwaterloo.ca/parking/about/our-parking-lots).
  - Expect: lot ID signs, "AMP pay by app" signs, and barrier arms / booths at gated lots, which is where OSM shows lift gates and toll booths.
  - Do **not** model pay-and-display kiosks for a 2025+ look.
- **Lot names:** single letters (A, B, C, D, E, H, J, K, L, M, N, O, Q, R, S, T, V, W, X), plus CLN/CLS (Columbia Lake N/S), UWP, RAC, EC, OV etc.
  - **Lot signs are part of the 2020 wayfinding family** (see `../wayfinding-signs/`): black panel with a large white lot letter (inferred from the system; not photographed here).
- **Surface:** asphalt, with white painted stall lines. Barrier-free stalls are blue-painted with the white ISA symbol and a sign post. Concrete curbs or precast parking stops.
- Light poles in lots: tall single or double-head poles (see `../lamps/`).
- **Geese nest in lots in spring.** Flickr: "Geese nesting in parking lot A".

## Images (private/web, 6)
St Jerome's lot (Commons), Lot A geese, Lot C (car testing, about 2007), a visitor lot at night, a snowy lot, ducks.
