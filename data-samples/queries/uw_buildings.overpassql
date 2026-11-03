// Buildings and 3D building parts inside the UW campus relation (all parts, incl. satellite campuses)
[out:json][timeout:120];
rel(11680616);
map_to_area->.uw;
(
  way["building"](area.uw);
  way["building:part"](area.uw);
  rel["building"](area.uw);
  rel["type"="building"](area.uw);
);
out tags geom qt;
