# Does UW have a 360 virtual tour or photosphere set?

**Short answer:** not a modern self-hosted 360 tour. Here is what exists:

1. **UW Photospheres open-data layer (57 points).**
   - Source: https://services5.arcgis.com/z87D0RdgTttiUQbV/arcgis/rest/services/v2_UWaterloo_Open_Data/FeatureServer/18 (fields: name, url).
   - Downloaded to `private/data/uw_photospheres.geojson`.
   - Every URL is a **Google Maps contributed photosphere** by one account (contrib 109625689197700120214), shot about 2014-2015. The image IDs date from 2014/2015.
   - We are not allowed to use Google Maps imagery, so these are only listed, not fetched.
   - Outdoor / grounds-relevant spheres, with lon/lat:
     - Playing fields (-80.55335, 43.47513).
     - Warrior Field x3 (about -80.5497, 43.4744).
     - Bridge to University Colleges (-80.5443, 43.4683).
     - SLC patio (-80.54504, 43.47194).
     - **Peter Russell Rock Garden** (-80.54359, 43.47150).
     - QNC (-80.54419, 43.47133).
     - CEIT (-80.54219, 43.47174).
     - Bridge between MC, M3 and DC (-80.54407, 43.47281).
     - Environment 1 courtyard (-80.54242, 43.46838).
     - St Jerome's courtyard (-80.5455, 43.46896).
     - Village 1 (-80.55057, 43.47148).
     - Mackenzie King Village x2.
     - Conrad Grebel (-80.54534, 43.46654).
     - St Paul's (-80.54672, 43.4677).
   - The rest are interiors (labs, lounges, residence rooms, the Stratford campus).
2. **Live virtual campus tours:** https://uwaterloo.ca/future-students/tours-events/virtual-campus-tour. These are scheduled YouTube livestreams with a student guide. They are not 360 and not archived.
3. **Official drone video tour:** https://www.youtube.com/watch?v=yhhuSXlzi_c (2021, 4K). See `../walking-tours/NOTES.md`.
4. **Self-guided tour:** the stops are printed on the campus map. See `../maps/private/pdf/fp3990_campusmap_2026_tour-lr-1-final-ua.pdf`; the self-guided-tour PDF URL returns 404.
5. **ArcGIS StoryMap "University of Waterloo Campus Tour":** https://storymaps.arcgis.com/stories/712fa7b5cab144dfb7ae40c4b9dec2a2. Search snippets say it includes a "Health Services Pond Reservoir" stop. Not fetched; it is a JS app.
6. **"University of Waterloo - 360 Tour"** (https://www.youtube.com/watch?v=Qk3D0AkVwB4, Explore Waterloo Region, 2025) is a Federation Hall venue promo only.
7. **Do not confuse with Wilfrid Laurier University.** Laurier (next door) has a real 360 tour at wlu.ca/.../virtual-tour-waterloo.html, a 3D campus map and a "Laurier Waterloo Campus 360° Tour" video. Those cover Laurier, not UW.
8. **UW's "3D City Model" web scene** (ArcGIS item a3c568e6630e47b7841ccf6ea73108dd, owner prselvak_uwaterloo):
   - App: https://uwaterloo.maps.arcgis.com/apps/webappviewer3d/index.html?id=9bb6a80289eb4fab82a95ada70cce540
   - Layers: City of Waterloo building footprints, a "WaterlooStreetTrees" feature layer (services1.arcgis.com/DwLTn0u9VBSZvUPe/.../WaterlooStreetTrees/FeatureServer/0, a copy of the City inventory), GRT stops, photospheres, and UW Buildings (services1.arcgis.com/DwLTn0u9VBSZvUPe/.../UW_Buildings/FeatureServer/0).
   - It is a student or teaching project, not an official tour.
