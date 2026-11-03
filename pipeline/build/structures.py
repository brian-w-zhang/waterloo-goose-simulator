"""Transit platforms from OSM: raised decks, with canopies where the platform is sheltered or covered."""
from shapely.geometry import LineString, Polygon
from shapely.geometry.polygon import orient

from . import osm
from .buildings import osm_to_city

BUS_DECK_M = 0.2
RAIL_DECK_M = 0.35
BUS_WIDTH_M = 2.5
RAIL_WIDTH_M = 4.0
CANOPY_UNDERSIDE_M = 3.0


def build():
    """[(polygon, deck height m, canopy bool, kind)] in the City frame."""
    out = []
    pred = lambda t: t.get("highway") == "platform" or t.get("railway") == "platform" \
        or (t.get("public_transport") == "platform" and t.get("covered") == "yes")
    for wid, t in osm.ways_where(pred):
        pts = osm.way_coords(wid)
        if not pts or len(pts) < 2:
            continue
        pts = [osm_to_city(e, n) for e, n in pts]
        rail = t.get("railway") == "platform"
        if pts[0] == pts[-1] and len(pts) >= 4:
            poly = Polygon(pts)
        else:
            poly = LineString(pts).buffer((RAIL_WIDTH_M if rail else BUS_WIDTH_M) / 2, cap_style="flat", join_style="mitre")
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 2:
            continue
        canopy = t.get("shelter") == "yes" or t.get("covered") == "yes"
        out.append((orient(poly.simplify(0.2)), RAIL_DECK_M if rail else BUS_DECK_M, canopy, "rail" if rail else "bus"))
    return out
