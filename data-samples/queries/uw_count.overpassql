[out:json][timeout:60];
rel(11680616);
map_to_area->.uw;
(
  way["building"](area.uw);
  way["building:part"](area.uw);
  rel["building"](area.uw);
);
out count;
