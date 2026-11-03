# Trees on and around campus

## Data sources

### 1. City of Waterloo Street Tree Inventory
This is the layer the task asked about.
- **REST URL:** https://services.arcgis.com/ZpeBVw5o1kjit7LT/ArcGIS/rest/services/Street_Tree_Inventory/FeatureServer/0
  - Point layer "Street Trees" in WGS84. maxRecordCount is 1000, so page with `resultOffset`.
  - 61,321 features city-wide.
- **Fields:** ASSET_ID, ROAD_ID, ADDR_ID, ADDRESS, STATUS (Existing / Stumped / To Be Stumped / Proposed / To Be Removed / Peg), COM_NAME, LATIN_NAME, OWNER, MAINT_BY, TREE_TYPE (Street / park...), REMOVED_DATE, REMOVED_REASON, DBH_CM, OBJECTID.
- **Coverage:** City-owned trees only. Every record in our bbox is OWNER = City of Waterloo. **It does not cover the campus interior or Ring Road.**
  - It does cover the campus edges: Westmount Rd N (657 in the bbox), Columbia St W (33), University Ave W (only 10, because University Ave is a Regional road), Hagey Blvd (55), Seagram Dr (21), Lester St, Phillip St and Albert St. It also covers parks east and south of campus.
- **Downloaded:** `private/data/city_street_trees_campus_bbox.geojson`, 3458 records in the bbox.
  - 2853 are Existing and 543 are Stumped. Median DBH of existing trees is 12 cm, so most are young street trees.
  - Top species in the bbox: Norway maple 539, sugar maple 330, red maple 179, honey locust 167, red oak 160, white ash 154 (mostly stumped by emerald ash borer, likely), serviceberry 105, littleleaf linden 100, basswood 89, Freeman maple 69, elm 68, birch 66, silver maple 65, crabapple 64, hackberry 63, cedar 57, ironwood 55, Kentucky coffeetree 48, London plane 48.

### 2. OpenStreetMap trees inside the campus boundary
- `private/data/osm_in_boundary.geojson`: **1507 tree nodes and 67 shrubs.** Only about 56 have species. This is the best public *position* data for campus trees, but it is incomplete; mapping is uneven, and dense woodlots are not individually mapped.
- **"Class of" memorial trees:** 47 trees named "Class of 1962"-"Class of 2008". They run in a double row along a path between about (-80.5442, 43.4718) and (-80.5448, 43.4738). OSM names this walk "Alumni Lane"; it runs north from near SLC/Health Services toward Columbia St / Village 1.
- Species tagged on campus include: Norway maple, horse chestnut, black ash, hackberry, bur oak, English oak, ironwood, red oak, ginkgo, butternut, honey locust ('Sunburst', 'Shademaster'), red maple, London plane, yellowwood, paperbark maple, swamp white oak, Freeman maple, blue ash, linden 'Glenleven', Kentucky coffeetree, tulip tree, sugar maple, white oak, Amur cork tree, black cherry, blue beech, American beech, sourgum, 'Ballerina' serviceberry, pin oak, 'Crimson King' and 'Schwedler' maples.

### 3. UW Plant Operations campus dataset
This has a **trees** layer and a vegetation layer, but access is limited to UW members via the Geospatial Centre. See `../maps/NOTES.md` section 3. **Request this if possible; it is the real campus tree inventory.**

### 4. Other sources
- The UW Ecology Lab has run volunteer tree-surveying of campus trees weekly since spring 2013 (https://uwaterloo.ca/ecology-lab/events/volunteer-oportunity-tree-surveying). No public dataset was found.
- An EcoMap note says Plant Ops hired an arborist to inventory the UW forest stands; this is not public.
- No UW "Campus Tree Walk" or arboretum guide was found.
- The UW Urban Forest (about 5 ha, between the main campus and the colleges / Laurel Creek) was designated a National Healing Forest (CBC 2023). Restoration there removes buckthorn and garlic mustard.

## Modelling guidance (target: late spring / summer)
- **Lawns and open quads** (MC/DC green, B1/B2 green, Arts quad edges, SLC green): scattered young-to-mid street-style deciduous trees.
  - Maples (Norway, red, sugar, Freeman), honey locust (fine, airy canopy), lindens, oaks, hackberry, Kentucky coffeetree, London plane.
  - Typical height 8-15 m, DBH 15-40 cm.
- **Conifer clumps:** tall Norway / white spruce and pines in clusters between buildings (MC-SLC spruces in the 2007 MC green panorama). Also white cedars as hedges.
- **Woodlots** (UW Urban Forest, Laurel Creek Forest, REV forest, CLV forest, Environmental Reserve):
  - Dense mixed Great Lakes-St. Lawrence forest: sugar maple, beech, ash (dead or dying), basswood, white cedar, white pine.
  - Understorey of buckthorn.
- Along Laurel Creek: willows (large weeping willows near the creek and ponds; see `../lamps/private/web/002_*`), Manitoba maple and dogwood thickets.
- Ornamentals near buildings: crabapples, serviceberry and magnolia (spring blossom); burning bush and junipers in beds (see `../grounds-commons`).

## Images
`private/web/`, 7 images. Flickr maples at UW (2025, autumn), campus blossoms (2025), frozen trees. Also see `../seasons/`.
