// Water, green space, parking, trees and transit stops in the game bbox
[out:json][timeout:120];
(
  nwr["natural"~"^(water|wetland|wood|scrub|grassland|tree_row)$"](43.4630,-80.5600,43.4790,-80.5310);
  nwr["waterway"](43.4630,-80.5600,43.4790,-80.5310);
  nwr["landuse"~"^(grass|forest|meadow|recreation_ground)$"](43.4630,-80.5600,43.4790,-80.5310);
  nwr["leisure"~"^(park|garden|pitch|sports_centre)$"](43.4630,-80.5600,43.4790,-80.5310);
  nwr["amenity"="parking"](43.4630,-80.5600,43.4790,-80.5310);
  node["natural"="tree"](43.4630,-80.5600,43.4790,-80.5310);
  node["highway"="bus_stop"](43.4630,-80.5600,43.4790,-80.5310);
  nwr["railway"~"^(light_rail|station|platform|tram_stop)$"](43.4630,-80.5600,43.4790,-80.5310);
  nwr["public_transport"~"^(platform|station|stop_position)$"](43.4630,-80.5600,43.4790,-80.5310);
);
out tags geom qt;
