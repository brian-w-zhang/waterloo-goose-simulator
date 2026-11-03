"""Build the packed world: python -m pipeline.build

Steps: buildings, lakes, terrain, ground classes, trees, props, then one WGC1 file per 256 m chunk
plus public/world/index.json and a low-detail far.bin. Writes data/build/build_report.json.
"""
import json
import pickle
import time

import mapbox_earcut as earcut
import numpy as np
import shapely
from shapely.geometry import Polygon, box

from ..chunkio import write_chunk
from ..config import BUILD, CAMPUS, ROOT, WORLD
from ..coords import BASE_ELEV, ORIGIN_E, ORIGIN_N
from . import buildings as bmod
from . import ground, lidar, props, terrain, vegetation

C = CAMPUS["chunk"]
SIZE = C["size_m"]
CELL = terrain.CELL
NPC = int(SIZE / CELL)          # cells per chunk side
Q = 65535.0 / SIZE              # u16 quantisation of local x, z


def chunk_frame(i, j):
    e0 = C["grid_origin_e"] + i * SIZE
    n1 = C["grid_origin_n"] + (j + 1) * SIZE
    return e0, n1


def ring_arrays(poly, e0, n1):
    """Exterior then interior rings in local coordinates, without the closing vertex."""
    rings = [poly.exterior] + list(poly.interiors)
    xs, counts = [], []
    for r in rings:
        c = np.asarray(r.coords)[:-1]
        xs.append(np.c_[c[:, 0] - e0, n1 - c[:, 1]])
        counts.append(len(c))
    return np.vstack(xs), counts


def triangulate(poly, e0, n1):
    """Earcut a polygon with holes; returns local xz vertices and triangle indices."""
    v, counts = ring_arrays(poly, e0, n1)
    ends = np.cumsum(counts).astype(np.uint32)
    return v, earcut.triangulate_float64(v, ends).astype(np.uint32)


def face_up(v, t):
    """Orient triangles so their normal points to +y (local x east, z south)."""
    tri = t.reshape(-1, 3).copy()
    a, b, c = v[tri[:, 0]], v[tri[:, 1]], v[tri[:, 2]]
    ny = (b[:, 1] - a[:, 1]) * (c[:, 0] - a[:, 0]) - (b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1])
    flip = ny < 0
    tri[flip] = tri[flip][:, [0, 2, 1]]
    return tri.ravel()


def tessellate(geom, e0, n1):
    """Clip polygons to the 2 m terrain cells so draped pieces follow the heightfield."""
    verts, idx, base = [], [], 0
    for poly in ground.polygons(geom):
        minx, miny, maxx, maxy = poly.bounds
        c0, c1 = int(np.floor((minx - e0) / CELL)), int(np.ceil((maxx - e0) / CELL))
        r0, r1 = int(np.floor((n1 - maxy) / CELL)), int(np.ceil((n1 - miny) / CELL))
        c0, r0 = max(c0, 0), max(r0, 0)
        c1, r1 = min(c1, NPC), min(r1, NPC)
        if c1 <= c0 or r1 <= r0:
            continue
        cc, rr = np.meshgrid(np.arange(c0, c1), np.arange(r0, r1))
        cc, rr = cc.ravel(), rr.ravel()
        cells = shapely.box(e0 + cc * CELL, n1 - (rr + 1) * CELL, e0 + (cc + 1) * CELL, n1 - rr * CELL)
        shapely.prepare(poly)
        inside = shapely.contains(poly, cells)
        for k in np.nonzero(inside)[0]:
            x0, z0 = cc[k] * CELL, rr[k] * CELL
            verts.append(np.array([[x0, z0], [x0 + CELL, z0], [x0 + CELL, z0 + CELL], [x0, z0 + CELL]]))
            idx.append(np.array([0, 2, 1, 0, 3, 2], dtype=np.uint32) + base)
            base += 4
        edge = np.nonzero(~inside & shapely.intersects(poly, cells))[0]
        if len(edge):
            for g in shapely.intersection(cells[edge], poly):
                for p in ground.polygons(g):
                    if p.area < 1e-4:
                        continue
                    v, t = triangulate(p, e0, n1)
                    if len(t) == 0:
                        continue
                    t = face_up(v, t)
                    verts.append(v)
                    idx.append(t + base)
                    base += len(v)
    if not verts:
        return np.zeros((0, 2)), np.zeros(0, dtype=np.uint32)
    return np.vstack(verts), np.concatenate(idx)


def main():
    t0 = time.time()
    WORLD.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    reg = bmod.osm_registration()
    bl = bmod.build()
    print(f"buildings {len(bl)} ({time.time() - t0:.0f}s); OSM registration {reg}")
    lk = terrain.lakes()
    hf = terrain.heightfield(bl, lk)
    np.save(BUILD / "heightfield.npy", hf)
    gcls = ground.classes(lk, bl)
    print(f"ground classes ({time.time() - t0:.0f}s)")
    trees = vegetation.build(bl, lk)
    path_lines = ground.highway_lines(ground.PATHS)
    pr = props.build(path_lines)
    print(f"trees {len(trees)}, props {len(pr)} ({time.time() - t0:.0f}s)")
    with open(BUILD / "buildings.pkl", "wb") as f:
        pickle.dump(bl, f)

    cents = np.array([[b["footprint"].centroid.x, b["footprint"].centroid.y] for b in bl])
    bci = np.floor((cents[:, 0] - C["grid_origin_e"]) / SIZE).astype(int)
    bcj = np.floor((cents[:, 1] - C["grid_origin_n"]) / SIZE).astype(int)
    tci = np.floor((trees[:, 0] - C["grid_origin_e"]) / SIZE).astype(int)
    tcj = np.floor((trees[:, 1] - C["grid_origin_n"]) / SIZE).astype(int)
    pci = np.floor((pr[:, 0] - C["grid_origin_e"]) / SIZE).astype(int)
    pcj = np.floor((pr[:, 1] - C["grid_origin_n"]) / SIZE).astype(int)
    index = {"version": 1, "chunk_size": SIZE, "cols": C["cols"], "rows": C["rows"],
             "grid_origin_e": C["grid_origin_e"], "grid_origin_n": C["grid_origin_n"],
             "origin": CAMPUS["origin"], "base_elevation_m": BASE_ELEV,
             "ground_classes": ground.CLASSES, "prop_kinds": props.KINDS, "chunks": []}
    for j in range(C["rows"]):
        for i in range(C["cols"]):
            e0, n1 = chunk_frame(i, j)
            cbox = box(e0, n1 - SIZE, e0 + SIZE, n1)
            arrays, header = {}, {"version": 1}
            r0 = (C["rows"] - 1 - j) * NPC
            c0 = i * NPC
            h = hf[r0:r0 + NPC + 1, c0:c0 + NPC + 1] - BASE_ELEV
            hmin, hmax = float(h.min()), float(h.max())
            hscale = max(hmax - hmin, 1e-3) / 65535.0
            arrays["terrain_h"] = np.round((h - hmin) / hscale).astype(np.uint16)
            header["chunk"] = {"i": i, "j": j, "e0": e0, "n1": n1, "size": SIZE,
                               "x0": e0 - ORIGIN_E, "z0": -(n1 - ORIGIN_N)}
            header["terrain"] = {"n": NPC + 1, "cell": CELL, "hmin": hmin, "hscale": hscale}
            # ground pieces
            gv, gi, gc = [], [], []
            base = 0
            for k, name in enumerate(ground.CLASSES):
                if name not in gcls:
                    continue
                geom = gcls[name].intersection(cbox)
                if geom.is_empty:
                    continue
                v, t = tessellate(geom, e0, n1)
                if len(t) == 0:
                    continue
                gv.append(v)
                gi.append(t + base)
                gc.append(np.full(len(v), k, dtype=np.uint8))
                base += len(v)
            if gv:
                v = np.vstack(gv)
                arrays["ground_xz"] = np.round(np.clip(v, 0, SIZE) * Q).astype(np.uint16).ravel()
                arrays["ground_cls"] = np.concatenate(gc)
                arrays["ground_idx"] = np.concatenate(gi).astype(np.uint32)
            # lake surfaces (flat)
            lakes_h = []
            lv, li, base = [], [], 0
            for lake in lk:
                g = lake["geom"].intersection(cbox)
                for p in ground.polygons(g):
                    v, t = triangulate(p, e0, n1)
                    if len(t) == 0:
                        continue
                    t = face_up(v, t)
                    lakes_h.append({"name": lake["name"], "objectid": lake["objectid"],
                                    "y": lake["level"] - BASE_ELEV, "first": int(sum(len(x) for x in li)),
                                    "count": int(len(t))})
                    lv.append(v)
                    li.append(t + base)
                    base += len(v)
            if lv:
                arrays["lake_xz"] = np.vstack(lv).astype(np.float32).ravel()
                arrays["lake_idx"] = np.concatenate(li).astype(np.uint32)
            header["lakes"] = lakes_h
            # buildings
            sel = np.nonzero((bci == i) & (bcj == j))[0]
            rings_xz, ring_counts, binfo = [], [], []
            for bi in sel:
                b = bl[bi]
                fv, fc = ring_arrays(b["footprint"], e0, n1)
                fp = {"ring_first": len(ring_counts), "ring_n": len(fc)}
                rings_xz.append(fv)
                ring_counts += fc
                parts = []
                for poly, hpart in b["parts"]:
                    pv, pc = ring_arrays(poly, e0, n1)
                    parts.append({"h": round(float(hpart), 3), "ring_first": len(ring_counts), "ring_n": len(pc)})
                    rings_xz.append(pv)
                    ring_counts += pc
                binfo.append({"id": int(b["id"]), "objectid": int(b["objectid"]), "abbrev": b["abbrev"],
                              "name": b["name"], "owner": b["owner"], "style": b["style"],
                              "ground_y": round(b["ground"] - BASE_ELEV, 3), "p90": round(b["p90"], 3),
                              "post2018": bool(b["post2018"]), "height_source": b["height_source"],
                              "footprint": fp, "parts": parts})
            if rings_xz:
                arrays["ring_xz"] = np.vstack(rings_xz).astype(np.float32).ravel()
                arrays["ring_count"] = np.array(ring_counts, dtype=np.uint32)
            header["buildings"] = binfo
            # trees
            ts = trees[(tci == i) & (tcj == j)]
            if len(ts):
                ty = terrain.sample(hf, ts[:, 0], ts[:, 1]) - BASE_ELEV
                arrays["tree_xyz"] = np.c_[ts[:, 0] - e0, ty, n1 - ts[:, 1]].astype(np.float32).ravel()
                arrays["tree_hr"] = np.c_[ts[:, 2], ts[:, 4]].astype(np.float32).ravel()
                arrays["tree_kind"] = ts[:, 3].astype(np.uint8)
            # props
            ps = pr[(pci == i) & (pcj == j)]
            if len(ps):
                py = terrain.sample(hf, ps[:, 0], ps[:, 1]) - BASE_ELEV
                arrays["prop_xyz"] = np.c_[ps[:, 0] - e0, py, n1 - ps[:, 1]].astype(np.float32).ravel()
                arrays["prop_rot"] = ps[:, 3].astype(np.float32)
                arrays["prop_kind"] = ps[:, 2].astype(np.uint8)
            name = f"c_{i}_{j}.wgc"
            write_chunk(WORLD / name, header, arrays)
            index["chunks"].append({"i": i, "j": j, "file": name, "buildings": len(binfo),
                                    "trees": int(len(ts)), "props": int(len(ps)),
                                    "bytes": (WORLD / name).stat().st_size})
    (WORLD / "index.json").write_text(json.dumps(index, indent=1))
    total = sum(c["bytes"] for c in index["chunks"])
    report = {"buildings": len(bl), "trees": int(len(trees)), "props": int(len(pr)),
              "osm_registration_m": {"de": reg[0], "dn": reg[1], "matches": reg[2]},
              "post2018": [{"objectid": b["objectid"], "abbrev": b["abbrev"], "name": b["name"],
                            "height_m": round(b["p90"], 2), "source": b["height_source"]}
                           for b in bl if b["post2018"]],
              "world_bytes": total, "seconds": round(time.time() - t0, 1)}
    (BUILD / "build_report.json").write_text(json.dumps(report, indent=1))
    print(f"packed {len(index['chunks'])} chunks, {total / 1e6:.1f} MB in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
