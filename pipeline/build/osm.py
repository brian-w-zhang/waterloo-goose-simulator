"""Parse the OSM API tiles into nodes, ways and relations with UTM coordinates."""
import xml.etree.ElementTree as ET
from functools import lru_cache

import numpy as np

from ..config import RAW
from ..coords import lonlat_to_utm


@lru_cache(maxsize=1)
def load():
    nodes, ways, rels = {}, {}, {}
    for f in sorted((RAW / "osm").glob("map_*.osm")):
        for el in ET.parse(f).getroot():
            tags = {t.get("k"): t.get("v") for t in el.findall("tag")}
            i = int(el.get("id", 0))
            if el.tag == "node":
                nodes[i] = (float(el.get("lon")), float(el.get("lat")), tags)
            elif el.tag == "way":
                ways[i] = ([int(n.get("ref")) for n in el.findall("nd")], tags)
            elif el.tag == "relation":
                rels[i] = ([(m.get("type"), int(m.get("ref")), m.get("role")) for m in el.findall("member")], tags)
    ids = np.fromiter(nodes.keys(), dtype=np.int64)
    lon = np.array([nodes[i][0] for i in ids])
    lat = np.array([nodes[i][1] for i in ids])
    e, n = lonlat_to_utm(lon, lat)
    utm = {int(i): (float(a), float(b)) for i, a, b in zip(ids, e, n)}
    return {"nodes": nodes, "ways": ways, "rels": rels, "utm": utm}


def way_coords(wid):
    d = load()
    refs, _ = d["ways"][wid]
    pts = [d["utm"][r] for r in refs if r in d["utm"]]
    return pts if len(pts) == len(refs) else None


def node_points(pred):
    """[(e, n, tags)] for nodes whose tags satisfy pred."""
    d = load()
    return [(*d["utm"][i], tags) for i, (_, _, tags) in d["nodes"].items() if tags and pred(tags)]


def ways_where(pred):
    d = load()
    return [(wid, tags) for wid, (_, tags) in d["ways"].items() if tags and pred(tags)]
