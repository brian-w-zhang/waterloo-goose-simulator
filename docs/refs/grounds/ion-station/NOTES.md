# University of Waterloo ION station and rail corridor

## Facts
Sources: Wikipedia, "University of Waterloo station"; GRT; UW Daily Bulletin 2015-08-20.
- **Light rail:** an island (centre) platform with **2 tracks**.
  - The LRT shares the **CN Waterloo Spur** (freight to Elmira). Freight may run 11 pm to 5 am.
  - A **gauntlet track** beside Platform 1 offsets freight trains away from the platform edge.
- Opened 2019 (ION opening, June 2019).
- **Bus terminal (opened January 2022):** 5 stands, platforms 3-7. GO buses use 6 (load) and 7 (unload).
  - It sits on the access road between **Phillip St (east) and Ring Road (west)**. Its west end has a **level crossing for the ION tracks and the Laurel Trail**; the road continues west as William Tutte Way.
- **Ring Road stops:** about half the old Ring Road bus slips and shelters were removed for the LRT. The western stops remain (Fed Bus).
- **Fencing:** a fence and planter barrier runs along the tracks to stop mid-block crossings. Pedestrian crossings of the tracks have **powered gates** (planned 2015; forum posts confirm gate footings at Columbia St).
- **GRT stop IDs (UW open data):**
  - University of Waterloo Station: 1123 (-80.54121, 43.47264), 6004 / 6120 (-80.5414, 43.4734).
  - Parent "place_UWAT" (-80.53838, 43.4749).
  - Columbia / Laurel Trail (U.W. Station): 5025 / 5026.
  - See `../bus-stops-and-shelters/private/data/grt_stops_campus_bbox.geojson`.
- **Track geometry:** City `Railways` layer, 6 LRT segments in the bbox: `private/data/city_railways_bbox.geojson`. OSM also has catenary masts (3 tagged in the bbox; most are not mapped).
- **Vehicles:** Bombardier Flexity Freedom LRVs (ION 501-514). The livery is white with GRT/ION blue (see Flickr images 021-028).

## Images (private/web, 29)
- Commons: University of Waterloo Station, Nov 2016 (under construction) and Nov 2017.
  - The 2018-2019 Flickr / Commons set (40542699203 ... 46593202955) shows the platform canopy, fencing, track and Laurel Trail crossing.
  - Also: bus platforms under construction (May 2021) and complete; bike parking at the bus depot; ION electrification.
- Flickr: ION 503 on opening day (2019), ION 505, 506 and 512 at UW station.

## Modelling notes
- The canopy is a long, thin steel-and-glass roof on round columns over an island platform about 4-5 m wide. Platform length is about 50 m for one LRV, plus margin (inferred).
  - **Verify with images 006-017.** I did not inspect them all.
- The surroundings are ballast or concrete track bed, black chain-link and ornamental fences, crossing arms with bells and lights, and the Laurel Trail asphalt (about 3 m wide) crossing at grade.
