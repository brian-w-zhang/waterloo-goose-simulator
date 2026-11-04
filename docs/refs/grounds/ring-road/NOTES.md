# Ring Road

## Geometry and road facts
- **Loop length:** about **2.7 km** (from the e-bike lap video, https://www.youtube.com/watch?v=mP_TjV2HxUw).
- Ring Road is owned by UW. The City and Region layers do not cover it: no City street-tree, sign or sidewalk records.
- **OSM tags** (12 ways, `../maps/private/data/osm_campus_bbox_tags.json`): highway=unclassified, asphalt, **2 lanes** (one 3-lane segment), **maxspeed 40 (km/h)**, lit=yes, mostly two-way; one one-way pair near a junction.
  - I could not confirm the posted limit from a UW source. Treat 40 km/h as OSM's claim.
- **Traffic calming, from OSM** (lon, lat):
  - Speed **humps:** (-80.54383, 43.46869) south Ring Road near ML/Arts; (-80.53936, 43.47144) east side near E2/E3; (-80.54677, 43.47147) west near SLC/PAC / Health Services; (-80.5408, 43.46726) south-east near University Ave / South Campus Hall.
  - The other humps are on the station access road and Phillip Street side: (-80.54155, 43.4757), (-80.53976, 43.47529), (-80.54244, 43.47678), (-80.54275, 43.4774).
  - **Bumps:** 4 in a row on the north access road, around 43.4778-43.4791, -80.5429 to -80.5434. Probably near Lot X / the R&T Park road; not verified.
  - **Islands:** 3, on Phillip St.
- Forum note (2015, unofficial): when East Ring Road was rebuilt in 2007, its harsh speed bumps were replaced with smooth humps.
- **Crossings:** OSM has 143 crossing nodes inside the boundary (not all on Ring Road):
  - 65 uncontrolled, 39 unmarked, 37 signalised.
  - Markings: 56 "ladder" (continental), 41 none, 6 lines, 2 zebra.
  - 93 crossings have tactile paving.
  - Saved as `private/data/osm_in_boundary.geojson`.
- **Pedestrian crossovers (PXO):**
  - From the Daily Bulletin, 2015-08-20 and 2016-01-07. The East Ring Road project began in August 2015.
  - It removed part of the east-side sidewalk and added **five, then six, accessible priority pedestrian crossovers** where vehicles must stop.
  - It relocated a bus stop and added a fence and planter barrier along the ION tracks to stop mid-block crossing. Powered gates are at the track crossings.
  - Each new crossover got in-road "STOP FOR PEDESTRIANS" signs: a fluorescent yellow-green flexible panel with a red STOP octagon and a pedestrian pictogram, on a black rubber base. See `private/web/003_0107pedestrians.jpg`.
  - Ontario PXO standard (Region brochure: https://www.regionofwaterloo.ca/media/sj5ehwr1/pedestriancrossover_brochure.pdf):
    - Type C/D: ladder markings, "X" sign pairs and shark-teeth yield lines.
    - Type B: overhead flashing amber.
    - I did not verify which types UW uses on each crossing.

## Character (from photos)
- 2 asphalt lanes, about 3.3-3.5 m each.
- **Concrete curbs**, and a concrete sidewalk on the inner side for most of the loop, typically separated by a grass boulevard.
- **Tall grey (galvanised or silver) light poles with a single curved arm and LED or cobra head** along the road (`private/web/009_*` night shot, east Ring Road near E3/E5).
- Mature conifers and deciduous trees close to the road on the west and north sides.
- **New black pedestrian wayfinding totems** (2020 wayfinding project) at path junctions beside Ring Road: `private/web/003_ring-road.jpg`, and see `../wayfinding-signs/`.
- **The E7 bridge over Ring Road** (`../engineering-quad/private/web/000_e7-bridge.jpg`). The E5 footbridge to the station is a hydro / UW layer item.
- GRT and Fed Bus stops on Ring Road: see `../bus-stops-and-shelters/`.

## Images (private/web)
- `000_0820map.jpg`: 2015 construction map of the east Ring Road section (E5 / CPH / DWE).
- `003_0107pedestrians.jpg`: the PXO in-road sign.
- `002_pse.jpg`, `003_ring-road.jpg`: UW News 2024; the latter shows a path beside Ring Road with a black wayfinding totem, in summer.
- Flickr images: south campus hall section, "Mech Eng secret courtyard entrance from east Ring Road", Davis Centre from Ring Road, Ring Road at night (snow), Ring Road geese.
- For more: the Street View capture in `docs/refs/streetview/` and the videos in `../walking-tours/`.
