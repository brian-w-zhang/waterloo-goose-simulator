"""Mathematics & Computer (MC), 1968, brutalist board-formed concrete.

References (docs/refs/buildings/mc/): Earth views, 2023 7 cm orthophoto, lidar (tools.art.study MC),
Commons photos (commons/NOTES.md: window-hood bands, fluted stair towers, piers at ground floor,
the pink tie on the west stair tower).

Form from the lidar: a 93 x 68 m block on a square grid (axis bearing ~339 deg), main roof 21.5 m
(ground floor plus five office floors), a sunken court at 14 m and a skylit court at 18-19 m, a
ring of square stair and plant towers to 25.8-26.3 m, and a row of slot skylights near the south.
Facades: every office floor is a band of tall narrow windows between deep concrete fins under a
projecting hood; the towers are blank with vertical flutes.
"""
import arch
import data

META = {"world": True, "replaces": []}
AXIS = (-0.3503, 0.9366)

HOODS = {"storey": 3.55, "bay": 1.2, "w": 0.9, "h": 2.55, "sill": 0.35, "depth": 0.7, "first": 0.0,
         "top_margin": 1.0, "glass": "window_dark", "frame": "concrete_deep", "ledge": (0.45, 0.45, "concrete_cool")}
GROUND = {"storey": 3.6, "bay": 4.8, "w": 3.8, "h": 3.0, "sill": 0.1, "depth": 1.4, "first": 0.0,
          "top_margin": 0.3, "glass": "window_dark", "frame": "concrete_deep"}


FLUTES = {"storey": 40, "bay": 0.9, "w": 0.4, "h": 39.0, "sill": 0.2, "depth": 0.12, "first": 0.0,
          "top_margin": 0.0, "glass": "concrete_cool", "frame": "concrete_deep"}


def build():
    parts = data.building_parts("MC")
    META["replaces"] = sorted({p["objectid"] for p in parts})
    k = arch.Kit("bld_mc")
    for tier in data.lidar_massing("MC", source="ndsm", simplify=0.8, merge_dh=1.2, min_area=10, min_width=2.0, axis=list(AXIS)):
        gy, h = tier["ground_y"], tier["h"]
        z0, z1 = gy - 1.5, gy + h
        if h > 23.5:            # stair and plant towers: blank fluted concrete
            k.tier(tier, z0, z1, "concrete_cool", "roof_light", windows={**FLUTES, "h": z1 - z0 - 0.6, "storey": z1 - z0})
        elif h > 12:            # office floors with window hoods; ground floor glazing set back behind piers
            k.tier(tier, gy + 3.6, z1, "concrete_cool", "roof_light", windows=HOODS)
            ring = tier["rings"][0]
            for i in range(len(ring)):
                k.wall(ring[i], ring[(i + 1) % len(ring)], z0, gy + 3.6, "concrete_cool", windows=GROUND)
        else:                   # low wings, links and court roofs
            k.tier(tier, z0, z1, "concrete_cool", "roof_light", windows=GROUND if h > 3 else None)
    return [k.finish()]
