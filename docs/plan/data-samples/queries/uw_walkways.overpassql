// Walkable network on UW main campus (paths, sidewalks, steps, plazas, service roads)
[out:json][timeout:120];
(
  way["highway"~"^(footway|path|pedestrian|steps|cycleway|service|living_street|unclassified|tertiary|secondary|corridor)$"]
     (43.4630,-80.5600,43.4790,-80.5310);
);
out tags geom qt;
