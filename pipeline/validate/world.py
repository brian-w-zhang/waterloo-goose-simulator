"""Decode the packed world (public/world) back into EPSG:26917 for the validators.

Every check reads these decoded artefacts, never pipeline intermediates (doc 08 section 4.4 rule 5).
"""
import json
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path

import numpy as np
from shapely import union_all
from shapely.geometry import LineString, Polygon
from shapely.geometry.polygon import orient

from ..chunkio import read_chunk
from ..config import WORLD
from ..coords import BASE_ELEV, ORIGIN_E, ORIGIN_N

Q = 256 / 65535.0


@dataclass
class Building:
    id: int
    objectid: int
    abbrev: str
    owner: str | None
    footprint: Polygon
    parts: list           # [(Polygon, height_m)]
    ground: float         # elevation, m
    post2018: bool
    height_source: str
    style: str
    roofs: list           # vault records in UTM: cx, cy, ux, uy, hu, hv, eave, rise


@dataclass
class World:
    root: Path
    index: dict
    chunks: list = field(default_factory=list)   # [(header, arrays)]

    @classmethod
    def load(cls, root: Path = WORLD):
        index = json.loads((root / "index.json").read_text())
        w = cls(root, index)
        for c in index["chunks"]:
            w.chunks.append(read_chunk(root / c["file"]))
        return w

    @cached_property
    def buildings(self) -> list[Building]:
        out = []
        for h, a in self.chunks:
            if "ring_xz" not in a:
                continue
            e0, n1 = h["chunk"]["e0"], h["chunk"]["n1"]
            xz = a["ring_xz"].reshape(-1, 2).astype(np.float64)
            counts = a["ring_count"].astype(np.int64)
            starts = np.r_[0, np.cumsum(counts)]

            def poly(first, n):
                rings = []
                for k in range(first, first + n):
                    v = xz[starts[k]:starts[k + 1]]
                    rings.append(np.c_[e0 + v[:, 0], n1 - v[:, 1]])
                return orient(Polygon(rings[0], rings[1:]))

            for b in h["buildings"]:
                fp = poly(b["footprint"]["ring_first"], b["footprint"]["ring_n"])
                parts = [(poly(p["ring_first"], p["ring_n"]), p["h"]) for p in b["parts"]]
                roofs = [{"cx": e0 + r["cx"], "cy": n1 - r["cz"], "ux": r["ux"], "uy": -r["uz"], "hu": r["hu"],
                          "hv": r["hv"], "eave": r["eave"], "rise": r["rise"]} for r in b.get("roofs", [])]
                out.append(Building(b["id"], b["objectid"], b["abbrev"], b["owner"], fp, parts,
                                    b["ground_y"] + BASE_ELEV, b["post2018"], b["height_source"], b["style"], roofs))
        return out

    @cached_property
    def terrain(self):
        """[(header_chunk, heights (n x n) in elevation m)] per chunk."""
        out = []
        for h, a in self.chunks:
            t = h["terrain"]
            n = t["n"]
            hh = (t["hmin"] + a["terrain_h"].astype(np.float64) * t["hscale"]).reshape(n, n) + BASE_ELEV
            out.append((h["chunk"], hh, t["cell"]))
        return out

    def terrain_at(self, e, n):
        """Bilinear packed ground elevation at UTM points (NaN outside the world)."""
        e, n = np.asarray(e, float), np.asarray(n, float)
        out = np.full(e.shape, np.nan)
        for ch, hh, cell in self.terrain:
            m = (e >= ch["e0"]) & (e < ch["e0"] + ch["size"]) & (n <= ch["n1"]) & (n > ch["n1"] - ch["size"])
            if not m.any():
                continue
            c = (e[m] - ch["e0"]) / cell
            r = (ch["n1"] - n[m]) / cell
            c0 = np.clip(np.floor(c).astype(int), 0, hh.shape[1] - 2)
            r0 = np.clip(np.floor(r).astype(int), 0, hh.shape[0] - 2)
            fc, fr = c - c0, r - r0
            out[m] = (hh[r0, c0] * (1 - fc) * (1 - fr) + hh[r0, c0 + 1] * fc * (1 - fr)
                      + hh[r0 + 1, c0] * (1 - fc) * fr + hh[r0 + 1, c0 + 1] * fc * fr)
        return out

    @cached_property
    def lakes(self) -> dict:
        """objectid -> (name, union polygon of the packed lake triangles)."""
        tris = {}
        names = {}
        for h, a in self.chunks:
            if "lake_xz" not in a:
                continue
            e0, n1 = h["chunk"]["e0"], h["chunk"]["n1"]
            v = a["lake_xz"].reshape(-1, 2).astype(np.float64)
            idx = a["lake_idx"].reshape(-1, 3)
            for lk in h["lakes"]:
                t = idx[lk["first"] // 3:(lk["first"] + lk["count"]) // 3]
                names[lk["objectid"]] = lk["name"]
                for tri in t:
                    p = v[tri]
                    tris.setdefault(lk["objectid"], []).append(Polygon(np.c_[e0 + p[:, 0], n1 - p[:, 1]]))
        return {k: (names[k], union_all(v)) for k, v in tris.items()}

    def ground_class_polys(self, cls_name, bounds=None):
        """Union of the packed ground triangles of one class (optionally only near bounds)."""
        k = self.index["ground_classes"].index(cls_name)
        polys = []
        for h, a in self.chunks:
            if "ground_xz" not in a:
                continue
            e0, n1, size = h["chunk"]["e0"], h["chunk"]["n1"], h["chunk"]["size"]
            if bounds is not None:
                minx, miny, maxx, maxy = bounds
                if e0 > maxx or e0 + size < minx or n1 < miny or n1 - size > maxy:
                    continue
            v = a["ground_xz"].reshape(-1, 2).astype(np.float64) * Q
            t = a["ground_idx"].reshape(-1, 3)
            cls = a["ground_cls"]
            t = t[cls[t[:, 0]] == k]
            pts = np.c_[e0 + v[:, 0], n1 - v[:, 1]]
            for tri in t:
                p = pts[tri]
                if bounds is not None and (p[:, 0].max() < minx or p[:, 0].min() > maxx
                                           or p[:, 1].max() < miny or p[:, 1].min() > maxy):
                    continue
                polys.append(Polygon(p))
        return union_all([p for p in polys if p.area > 1e-6]) if polys else Polygon()

    @cached_property
    def network(self) -> dict:
        net = json.loads((self.root / "network.json").read_text())

        def utm(pts):
            return [(x + ORIGIN_E, ORIGIN_N - z) for x, z in pts]

        for w in net["ways"]:
            w["line"] = LineString(utm(w["pts"])) if len(w["pts"]) > 1 else None
        for ln in net["city_lines"]:
            ln["line"] = LineString(utm(ln["pts"])) if len(ln["pts"]) > 1 else None
        for s in net["stations"]:
            s["utm"] = utm([s["pos"]])[0]
        for en in net["entrances"]:
            en["utm"] = utm([(en["x"], en["z"])])[0]
        return net
