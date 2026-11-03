# Plazas, campus signage, and extra open data

Research for the flat-colour toon model. Everything below comes from things I opened and looked at: Google Street View panoramas (2023 and 2025 captures), Google Maps place pages, uwaterloo.ca pages, Wikimedia Commons, and Google Images grids. I also ran live `curl` checks against each data endpoint on 2026-11-03. I downloaded no images into the repo. I picked hex values by eye from overcast or sunny Street View frames, except where a note says I sampled pixels. Treat them as palette starting points. The machine-readable version is `plazas-signage-data.json`.

Confidence levels: **high** means I got a clear, close Street View look, or an official drawing. **medium** means one decent view, or a distant one. **low** means a thumbnail, or something inferred.

## Headline findings

- **Only one of the "plazas" is a classic strip plaza with a parking lot.** That is University Shops Plaza at 160–170 University Ave W. The others are ground-floor retail podiums under student high-rises. They sit at the sidewalk edge with no surface lot. Several businesses you listed sit somewhere other than where you placed them (see the address table).
- **UW's exterior signs are a single Entro-designed family installed between 2020 and 2023.** Every piece is a charcoal/black monolith with a sloped top and a gold perforated-metal band. The building code is set in large gold letters and the building name in white. UW publishes dimensioned elevations for every sign type, listed below.
- **The UW campus map is public ArcGIS with no key.** It has 223 to 273 building points with code and name, 7,231 parking-stall polygons, 66 accessible entrances, 229 bike racks, about 2,000 snow-route path and sidewalk polygons, and a vector-tile basemap with buildings, sidewalks, drives and tunnels. The UW Open Data API v3 needs an API key.
- **The City of Waterloo serves 10 cm spring-2026 orthoimagery** through a public MapServer export with no key. It is the best source I found for roof colours. Its licence is not stated (see Part C).

---

## Part A: commercial areas next to campus

### Where the named businesses actually are (Google Maps, checked 2026-11-03)

| Business | Address | Building |
|---|---|---|
| Hakka Nation | 170 University Ave W | University Shops Plaza |
| Indian Sweet Master, Farah Foods, BMO ATM, Williams Fresh Cafe, D Spot (160 Univ W) | 160–170 University Ave W | University Shops Plaza |
| Pho Anh Vu | west end of the same plaza (map label) | University Shops Plaza |
| LooBapBap | 280 Lester St #104 | mid-rise mixed-use at Lester & Hickory |
| Top Chicken | 280 Lester St #105 | same |
| Charminar House | 280 Lester St #112 | same |
| Now Tea | 280 Lester St, ground floor (sign seen in Street View) | same |
| Gladiator Burger | 222 Albert St (at the corner of University Ave W & Albert) | high-rise podium |
| Oka Sushi | 251 Hemlock St ("Sage 6") | high-rise podium |
| Toma's Pizza | 251 Hemlock St #110 | same |
| Foodie Fruitie | 203 Lester St #7, "Linden Square" | high-rise podium, at the corner of University & Lester |
| Song's Lamian | 203 Lester St Unit 1, Linden Square | same |
| KEN Sushi House | 256 Phillip St ("Phillip Square") | podium of the Blair House and Elora House towers |
| Tahini's | 250 Phillip St Unit A & B | Phillip Square |
| Circle Food, Student's Smart Shop, Hi Yogurt, Together Boba, Mengami, Izna Poke, Banh Mi Saigon, CoCo | not individually verified | Mengami, Izna Poke and Banh Mi Saigon are probably in University Shops Plaza. CoCo appears to be in the Linden Square glass podium (I saw a logo there). |

Your plaza 2 ("Phillip & Columbia, University Plaza") is really **280 Lester St**. Your plaza 3a ("King/University") is really at **University Ave W & Albert/Hemlock**, two blocks west of King.

### 1. University Shops Plaza, 160–170 University Ave W (about 43.4716, -80.5386). Confidence: high

- **Form:** one long single-storey L/strip building on the south side of University Ave. The ION rail corridor runs behind it.
- **Roof:** a large dark-brown asphalt-shingle mansard/hip roof (#5E5048) over the whole run. It has gable and hip pavilions at the corners. One corner pavilion has a **red standing-seam metal roof** (#B5524A). Rooftop units sit behind the roof slope.
- **Walls:** beige horizontal vinyl siding (#CDBFA6) on the fascia and gable ends. Tan stucco piers between bays (#C8A57E). Red-brick pilasters at some corners (#9A4E3A). At the rear, facing the ION tracks, the walls are salmon-red brick and painted block (#B06A5A, #C98F80). One end unit is ochre stucco (#E0A94E).
- **Storefronts:** full-height glass in dark bronze/black aluminium frames, many with frosted lower decals. The roof overhang forms a **continuous covered walkway**. There is no separate awning.
- **Signs:** individual channel-letter or panel signs on the siding band, one per unit, all different colours. Examples: Indian Sweet Master is white script on red (#C8202A); BMO is white on blue (#0079C1); Hakka Nation and Farah Foods are white letters on a charcoal panel (#2E2E30). Lettering is white or pale on dark or saturated backgrounds.
- **Pylon sign:** a dark-grey pylon at the University Ave entrance with red and black tenant panels (#C8262E, #222).
- **Parking:** an asphalt lot between the building and University Ave. Stalls are perpendicular with yellow lines. There is one row along the walkway curb, then a drive aisle, then double-loaded rows, plus landscaped islands with shrubs. Access is from University Ave and Phillip St.
- **Sources:** Street View 2023-08, pano xuL_Wj17IJecsbqI9hEE_A (front) and UePLtkO7wS3tbWGxBjubkw (lot and pylon). A user photosphere from 2026-10 at the ION crossing showed the rear. Hakka Nation owner photo, 2024-10.

### 2. 280 Lester St (LooBapBap, Top Chicken, Now Tea, Charminar House; about 43.4753, -80.5356). Confidence: high

- **Form:** a mixed-use student apartment block of about **8 storeys** (ground retail plus about 7 residential floors; I counted balcony rows, medium confidence). It sits right at the Lester St sidewalk with a grass boulevard and street trees. **No surface parking**; there is on-street parking on Lester.
- **Walls:** dark charcoal-brown brick volumes (#433B38) on either side of a recessed centre bay. The centre bay is cream panel or stucco (#D8CDB4) with clear-glass balconies. **Red-orange vertical fins** (#C4492C) run from the ground to about level 4 between retail bays.
- **Roof:** flat. I did not see it.
- **Storefronts:** full-height glazing with black mullions. A continuous **grey metal sign fascia** (#6E7076) runs above the storefronts. Each tenant has its own panel, mostly black with white or yellow lettering. Examples: Now Tea is white Chinese and English text on black; Top Chicken is yellow-and-white on black. There are no awnings. A brick-base unit at the left (Bob's Place) has a black sign.
- **Sources:** Street View 2025-05, pano JJAAQUmqRrloUhyshvAG8w.

### 3a. University Ave W & Albert/Hemlock (Gladiator Burger, Oka Sushi, Toma's Pizza; about 43.4741, -80.5315). Confidence: medium-high

- **Form:** ground floors of student high-rises, roughly 12 to 16 storeys or more. The corner podium is **2 storeys** of glass curtain wall.
- **Podium:** blue-green glass (#6F9DB5) in white or silver frames. A **terracotta-orange panel pier** (#C8875A) marks the corner. There is a white panel fascia (#EDEDEA) and a grey-taupe band. Gladiator's sign is a red box (#C62630) with a white helmet logo and white lettering.
- **Towers above:** blue glass with **white perforated metal balcony screens** (#E8ECEE). The neighbouring towers are white, red-brick or red panel (#B23A2E), with blue glass.
- **Parking:** none at the front. A wide concrete sidewalk with a planter and bike rings.
- **Sources:** Street View 2025-05, pano mQVpsrn54q8McJUL1Znitg (from the Gladiator place page), plus pano 6ezvFOyeA5ZSNFCaI2kjUw.

### 3b. Linden Square, 203 Lester St at University Ave (Foodie Fruitie, Song's Lamian, CoCo; about 43.4725, -80.5340). Confidence: medium-high

- **Form:** a **2-storey glass and metal-panel podium** at the corner. Above it is a high-rise of about 20 storeys in buff/tan brick (#C9A882) with red-brown brick stripes (#8E4A3A). At the back, on the Lester side, the base is **rough-faced white stone-look block** (#DEDAD2) with red-brick accents (#A8553A) and white perforated decorative screens.
- **Storefronts:** dark tinted glass (#2E3A46) in silver-grey metal panels (#B9BEC2). Tenant logos are applied to the glass. There is a canopy over the corner entry. The forecourt is grey concrete pavers. **No parking lot**; just a driveway lane behind.
- **Neighbour to the east:** a red panel (#B8302A) and blue-glass mid-rise with Pizza Depot at grade.
- **Sources:** Street View 2025-05, pano xO_4dgIGPDfeaEHTB44dHA. Panos from 2018-10 (8zhf4LLvtMU_zvV2zuoIMw, ltRQ85YDgtLPpD276fL4zg) show the rear block.

### 3c. Phillip Square, 250–256 Phillip St (KEN Sushi House, Tahini's; about 43.4734, -80.5372). Confidence: high

- **Form:** twin student towers, **Blair House** and **Elora House**, about 20 storeys or more. They share a **2-storey retail podium** on the east side of Phillip St. A plaza with stairs and steps runs between the towers.
- **Podium:** glass storefronts with white round columns. There are **two wood-look, copper-orange horizontal fascia bands** (#A0532E), one over each podium level. Above them is a dark charcoal band (#4A4A52) carrying the building names in white letters.
- **Towers:** cream/beige panel (#D6CDB8), mid-grey panel (#8A8C94) and blue glass slots.
- **Signs:** small tenant panels on the glass (the UPS Store, KEN Sushi's black round logo). No awnings, no surface parking.
- **Sources:** Street View 2025-05, pano jxhU6_7ZojJc9m5mF7tkTA.

---

## Part B: signage

### UW exterior wayfinding family (Campus Wayfinding Project, Entro Communications)

Building signs were installed from 2020-02, pedestrian, parking and road signs over summer 2020, and entrance pillars in late 2020. UW reported all exterior work complete in March 2023. Sources: https://uwaterloo.ca/wayfinding/project-updates, https://uwaterloo.ca/daily-bulletin/2023-04-04.

The dimensioned elevations are official drawings on https://uwaterloo.ca/wayfinding/exterior-design-system. All dimensions are width × height. Confidence: high.

| Sign | Width × height | Notes |
|---|---|---|
| Primary site ID, large (main entrances) | 2222 × 5613 mm | monolith, sloped top, UW wordmark plus crest |
| Primary site ID, medium | 1778 × 4800 mm | sloped top, gold bands, no text |
| Primary site ID, small | 1421 × 4100 mm | same |
| Secondary site ID / East Campus / Residences | 1421 × about 2282 mm | sloped gold cap, wordmark, area name |
| Pedestrian directional / main directory map / location ID | 684 × 3170 mm | slim pylon, gold patterned lower third and cap |
| Secondary directional, path marker | 320 × 1814 mm | slim post with gold cap |
| Main path ID | 416 × 2535 mm | large gold path number |
| **Building entrance sign, freestanding** | **589 × 2438 mm** | gold code (for example "MC", "B1 B2"), white name, accessibility icons |
| Building entrance sign, wall-mounted | 589 × 1665 mm | beside the door |
| Building entrance sign, horizontal (over door) | 1955 × 397 mm | above the doors |
| East Campus / Residence building entrance | 684 × 2438 mm | for example "EC East Campus 2", "MKV" |
| Vehicular directional | about 2300 × 1800 mm | 2-post panel, gold arrows |
| Visitor parking ID | about 600 × 3100 mm | green "P" disc |

- **Shape:** a tall, slim rectangular prism, roughly 120 to 200 mm deep (estimated from photos). The top is **cut at a slope**, high on one side. A band of **gold perforated/dotted metal** follows the slope at the top. On the big pillars, a second wide diagonal gold band covers the lower third.
- **Colours:**
  - Body: charcoal near-black. I sampled #343434 from the drawings and saw about #1C1A17 to #222222 on installed signs.
  - Gold: UW brand gold #FED34C, or the deeper #EAAB00, for the code letters. The perforated metal reads as gold over dark. It renders as about #A88830 in the drawings and looks olive-gold #6E6A3A to #B8954A in photos, depending on light and what shows through the holes.
  - Text: white #FFFFFF for names.
  - Crest: the standard UW shield (gold, black, red).
  - Brand palette: https://uwaterloo.ca/brand/how-express-our-brand/colour gives #FED34C, #EAAB00, #FAE100, #000000.
- **Placement:** freestanding building signs stand **next to the main entrance doors**, a little to one side, on the paving. Wall-mounted versions sit beside the door. Horizontal versions go over the door head. The main entrance pillars are a **staggered row of three** (large, medium, small) set on landscaping at the **northwest corner of University Ave W & Ring Rd/Seagram Dr** (about 43.4690, -80.5395), facing University Ave. They are in Street View 2025-05, pano lMTiNYE60DVXQ9Y6Ek20Bg, and in the Daily Bulletin photo of the "South Campus Entrance". The older brick-and-letter "WELCOME WARRIORS" sign still stands behind them.
- **Caveat:** the real-world MC sign is not in Street View, because campus coverage dates from 2014. Its look is inferred from the system drawings and the EIT preview image.

### "UNIVERSITY OF WATERLOO" 3D letter sign

Freestanding dimensional letters in dark charcoal/black (#2A2A2A), set on a long light-grey concrete plinth (#C8C8C4). "UNIVERSITY OF" sits in small caps above a large "WATERLOO". It was moved in 2020 from the University Ave entrance to a spot **between the Arts Quad and the Grad House**. The letters look about 1 m tall for WATERLOO and the sign about 6 to 7 m long (low confidence, estimated from people in photos). Sources: https://kitchener.citynews.ca/2020/08/20/iconic-uw-sign-moving-to-new-location-2651508/, https://uwaterloo.ca/wayfinding/questions-and-answers. Confidence: medium.

### ION University of Waterloo station

The station is at 43.47312, -80.54107, with a centre platform. The **station ID tower** is a rectangular box at the platform end, roughly 2.5 m wide by about 5 m tall (low confidence; no scale object in the photo).

- **Cladding:** a **checkerboard of glass panels** in navy, blue, dark grey and white/frosted (#1E2A44, #3A5A8C, #5A5E66, #E6E8EA).
- **Top band:** black glass (#141414) with **brushed-silver 3D letters** "University of Waterloo" (#C8CACC). The ION logo is on the left and the GRT logo on the right, both in blue (about #2A55B0; low confidence on the exact brand hex).
- **Canopy:** dark steel. Fencing is black chain-link with galvanised rails.

Sources: https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Station_(46593200905).jpg, https://commons.wikimedia.org/wiki/File:University_of_Waterloo_Station_(33631992418).jpg, https://commons.wikimedia.org/wiki/Category:University_of_Waterloo_station. Confidence: medium.

---

## Part C: extra open data

I tested every endpoint below with live `curl` requests on 2026-11-03. The project already uses City of Waterloo Public_Base layers 3, 12, 17 and 21, Public_Operations 31, Public_Forestry_Mobile 1, Ontario lidar DSM/DTM, and the OSM API.

### UW (ArcGIS org `z87D0RdgTttiUQbV`, public, no key, no licence stated)

The campus map (https://uwaterloo.ca/map/) is an ArcGIS Experience (item 48e2192807e14d7692d76b505f0a9d82) built on webmap c3930fe1ee3647d6be57726c68ef3216. Base URL: `https://services5.arcgis.com/z87D0RdgTttiUQbV/arcgis/rest/services/`

| Layer | Contents | What it adds |
|---|---|---|
| `BuildingsView/FeatureServer/0` (223) and `BuildingsV3/FeatureServer/0` (273) | **points**: buildingCode, buildingName, alternateBuildingNames, parentBuildingCode | building codes and names for sign labels. Not outlines, and no floor counts. |
| `v2_UWaterloo_Open_Data/FeatureServer/1` `accessibleentrances` (66) | points: name, description | entrance positions, so you know where to put entrance signs and doors |
| `v2_UWaterloo_Open_Data/FeatureServer` layers 0–22 | accessible, atms, buildings, carshare, firepits, libraries, meter, permit, visitor, photospheres, stops, and others | points of interest and props |
| `2025MasterParking_Stalls/FeatureServer/0` (7,231 polygons) | StallType, LotName | **individual parking stall polygons**: line paint and accessible stalls |
| `SvcLotType_SnowRouteMapping/FeatureServer/2` (95 polygons) | LotName, SvcLotType | parking lot outlines |
| `SnowRemoval_SnowRouteMapping/FeatureServer/1` (1,992 polygons) | Primary, Secondary or Tertiary route | **paved path and sidewalk surface polygons** across campus |
| `Bike_RackDatav2/FeatureServer/0` (229) | rack type, capacity, shelter | bike rack props |
| `Water_and_Greenspace/FeatureServer/0-2` | waterways, waterbodies, greenspace | derived from OSM (ODbL) |
| `ParkingView`, `FoodView` | lot and food points | labels |

The vector tile basemap is at `https://tiles.arcgis.com/tiles/z87D0RdgTttiUQbV/arcgis/rest/services/campus_basemap/VectorTileServer/tile/{z}/{y}/{x}.pbf` (gzipped MVT, max zoom 23). It has the source layers dev_BUILDINGS, dev_SIDEWALK, dev_DRIVE, dev_RINGROAD, dev_TUNNELS, dev_PARCELS and dev_LINKS, which give UW's own building outlines, sidewalks and **tunnels**. A request for tile 16/23963/18105 returned 200 with 19 KB.

The UW Open Data API v3 (`https://openapi.data.uwaterloo.ca/v3/Locations`) returns **401 without an X-API-KEY header**. A free key is available through https://github.com/uWaterloo/OpenData. The v2 API host at api.uwaterloo.ca is dead.

### City of Waterloo (`gis.waterloo.ca` MapServer and `services.arcgis.com/ZpeBVw5o1kjit7LT`, no key)

The licence is the City of Waterloo Open Data Licence (an OGL-style licence that allows commercial use with attribution). It appears in the hub metadata for the hosted layers. Counts below are for a bounding box of roughly 2 km × 1 km around campus.

| Layer | Count | What it adds |
|---|---|---|
| `Public_Imagery_Current/MapServer` layer 9, "2026 10cm Imagery Spring" (via `export`) | n/a | **10 cm orthophoto** for roof and paving colour sampling. Tested: returned a 512 px PNG of the MC roof. No licence is stated on the service, and it is not on the open-data portal, so use it for reference only. |
| `ZpeBVw5o1kjit7LT/Sidewalks/FeatureServer/0` | 108 lines | PATH_TYPE, SURFACE, BLVD_TYPE |
| `ZpeBVw5o1kjit7LT/Street_Tree_Inventory/FeatureServer/0` | 702 points | species and DBH_CM, which drive tree size |
| `Public_Operations/MapServer/2` (street trees) | 540 points | species |
| `ZpeBVw5o1kjit7LT/Trails_and_Pathways`, `WalkabilityNetwork` | 46 and 338 lines | path network |
| `Public_Operations/MapServer/5` (address points) | 5,019 points | civic addresses for business labels. **Has owner-name fields; do not ingest those.** |
| `Public_Operations/MapServer/6` (property fabric) | 377 polygons | parcels and lot edges |
| `ZpeBVw5o1kjit7LT/Contours/FeatureServer/0` | 475 lines | terrain check |
| `ZpeBVw5o1kjit7LT/Buildings/FeatureServer/0` | 396 polygons | footprints with AREA_M only. **No heights**; get heights from lidar or OSM. |
| `Public_Operations/MapServer/29, 30, 24, 13, 20` | small counts | bike parking, bike lanes, parks, public art, heritage |
| `ZpeBVw5o1kjit7LT/SignInventory` (street signs) | 0 in the bbox | |
| `ParkingLots` (city-operated) | 0 in the bbox | not useful here |

I found **no street-light layer** for the City of Waterloo. The street-light and hydro-pole layers on the hub belong to the City of Kitchener (`services1.arcgis.com/qAo1OsXi67t7XgmS` is Kitchener's org).

### Region of Waterloo (no key; Region of Waterloo Open Data Licence)

| Layer | Count | What it adds |
|---|---|---|
| ION Stops: `https://utility.arcgis.com/usrsvcs/servers/f063d1fb147847f796ce8c024e117419/rest/services/OpenData/OpenData/MapServer/5` | 2 in the bbox (University of Waterloo, Laurier–Waterloo Park) | station points |
| ION Routes: `.../1aea43272d854f59a4d5d710fc8e2c17/rest/services/OpenData/OpenData/MapServer/6` | 2 lines | track centreline |
| GRT Stops: `.../52c4134809a94f85b31a2e9553de1358/rest/services/OpenData/OpenData/MapServer/3` | 40 | bus stop and shelter props |
| GRT GTFS: `https://webapps.regionofwaterloo.ca/api/grt-routes/api/staticfeeds/1` | the HEAD request returned 200 (application/zip) | stops and shapes. The old grt.ca/GTFS URL returns 404. |

### Other sources

| Source | Status | What it adds |
|---|---|---|
| OSM via Overpass (`https://overpass-api.de/api/interpreter`; ODbL; needs a User-Agent header, otherwise 406) | In the campus bbox: 480 buildings, **220 `building:part`** (204 with height or levels), 133 with levels, 41 with `building:colour`, 38 with `roof:colour`, 42 with material, 31 with `roof:shape`, 59 with `ref` | **OSM 3D building parts are well mapped here.** Use them for massing and step-backs. |
| Overture Maps buildings (`s3://overturemaps-us-west-2/release/2026-10-21.0/`; ODbL/CDLA; no key) | the bucket listing works | merged footprints, sometimes with height |
| Sketchfab search API (`https://api.sketchfab.com/v3/search?type=models&q=university%20of%20waterloo`; no key to search, account needed to download) | found "Tower at uWaterloo" (CC BY-NC-SA) and "Porcellino UW Modern Languages building" (CC BY-SA) | only one-off models; not worth importing |
| Google Photorealistic 3D Tiles (`tile.googleapis.com/v1/3dtiles/root.json`) | 403 without a key; the terms of service forbid extracting or caching geometry | visual reference only |
| Mapillary (`graph.mapillary.com`) | needs an OAuth token (I got 500 without one). The web map shows dense coverage on University Ave, Columbia, Ring Rd, Phillip, King and the ION corridor, plus some interior campus paths. CC BY-SA. | **newer street-level views than Google's 2014 campus imagery**, useful for checking signs |
| SketchUp 3D Warehouse | not tested; search only through the web UI | |

---

## Sources

- Google Street View panoramas: xuL_Wj17IJecsbqI9hEE_A, UePLtkO7wS3tbWGxBjubkw (2023-08); JJAAQUmqRrloUhyshvAG8w, mQVpsrn54q8McJUL1Znitg, 6ezvFOyeA5ZSNFCaI2kjUw, xO_4dgIGPDfeaEHTB44dHA, jxhU6_7ZojJc9m5mF7tkTA, lMTiNYE60DVXQ9Y6Ek20Bg, g_99Q0mA9rAeWemvoXagUg (2025-05). Open them as `https://www.google.com/maps/@?api=1&map_action=pano&pano=<id>`.
- Google Maps place pages: Hakka Nation, TOP CHICKEN, LooBapBap, Charminar House, Gladiator Burger - Waterloo, Oka Sushi, Toma's Pizza, Foodie Fruitie, Song's Lamian, KEN Sushi House Phillip Square, Tahini's.
- https://uwaterloo.ca/wayfinding/exterior-design-system
- https://uwaterloo.ca/wayfinding/project-updates
- https://uwaterloo.ca/wayfinding/questions-and-answers
- https://uwaterloo.ca/daily-bulletin/2023-04-04
- https://uwaterloo.ca/brand/how-express-our-brand/colour
- https://kitchener.citynews.ca/2020/08/20/iconic-uw-sign-moving-to-new-location-2651508/
- https://commons.wikimedia.org/wiki/Category:University_of_Waterloo_station
- https://en.wikipedia.org/wiki/University_of_Waterloo_station
