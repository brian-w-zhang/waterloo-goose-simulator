"""Line network shipped to the client (NPC routing, signage) and read by the validators."""
import json

from shapely.geometry import shape

from ..config import RAW
from ..coords import ORIGIN_E, ORIGIN_N
from . import osm
from .buildings import osm_to_city
from .ground import PATHS, ROADS, _width

WALKABLE = PATHS | ROADS | {"corridor"}


def _xz(e, n):
    return [round(e - ORIGIN_E, 2), round(-(n - ORIGIN_N), 2)]


def build():
    d = osm.load()
    ways = []
    for wid, tags in osm.ways_where(lambda t: t.get("highway") in WALKABLE or t.get("railway") in ("light_rail",)):
        refs = d["ways"][wid][0]
        if any(r not in d["utm"] for r in refs):
            continue
        hw = tags.get("highway")
        ways.append({
            "id": wid, "kind": hw or tags.get("railway"), "name": tags.get("name", ""),
            "width": _width(tags) if hw else 0,
            "indoor": tags.get("indoor") == "yes" or hw == "corridor" or tags.get("level", "0") not in ("0", ""),
            "access": tags.get("access", ""),
            "nodes": refs,
            "pts": [_xz(*osm_to_city(*d["utm"][r])) for r in refs],
        })
    entrances = [{"id": i, "x": p[0], "z": p[1]} for i, p in (
        (i, _xz(*osm_to_city(*d["utm"][i]))) for i, (_, _, t) in d["nodes"].items() if t.get("entrance"))]
    stations = [{"name": t.get("name", ""), "osm_id": i, "pos": _xz(*osm_to_city(*d["utm"][i]))}
                for i, (_, _, t) in d["nodes"].items()
                if t.get("railway") == "station" or (t.get("public_transport") == "station" and t.get("train") == "yes")]
    lines = []
    for key, label in (("city_creeks", "CREEK_LABEL"), ("city_trails", "PATH_TYPE")):
        for f in json.loads((RAW / "city" / f"{key}.geojson").read_text())["features"]:
            g = shape(f["geometry"])
            for part in ([g] if g.geom_type == "LineString" else list(getattr(g, "geoms", []))):
                lines.append({"source": key, "label": f["properties"].get(label) or "",
                              "name": f["properties"].get("TRAIL_NAME") or f["properties"].get("NAME") or "",
                              "pts": [_xz(x, y) for x, y in part.coords]})
    return {"ways": ways, "entrances": entrances, "stations": stations, "city_lines": lines}
