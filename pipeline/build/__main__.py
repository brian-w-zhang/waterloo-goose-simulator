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
from shapely import STRtree
from shapely.geometry import Polygon, box

from ..chunkio import write_chunk
from ..config import BUILD, CAMPUS, ROOT, WORLD
from ..coords import BASE_ELEV, ORIGIN_E, ORIGIN_N
from . import buildings as bmod
from . import doors, far, ground, landmarks, network, osm, props, signs, structures, terrain, tufts, vegetation

C = CAMPUS["chunk"]
BARRIER_KINDS = ["fence", "hedge", "wall", "retaining_wall"]
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
            # same diagonal as the client terrain mesh (north-east to south-west), so pieces lie on it
            idx.append(np.array([0, 3, 1, 1, 3, 2], dtype=np.uint32) + base)
            base += 4
        edge = np.nonzero(~inside & shapely.intersects(poly, cells))[0]
        if len(edge):
            # split partial cells into the terrain's two triangles so clipped pieces stay planar with it
            ce, cr = cc[edge], rr[edge]
            xw, xe = e0 + ce * CELL, e0 + (ce + 1) * CELL
            yn, ys = n1 - cr * CELL, n1 - (cr + 1) * CELL
            tri_a = shapely.polygons(np.stack([np.c_[xw, yn], np.c_[xw, ys], np.c_[xe, yn]], axis=1))
            tri_b = shapely.polygons(np.stack([np.c_[xe, yn], np.c_[xw, ys], np.c_[xe, ys]], axis=1))
            for g in shapely.intersection(np.concatenate([tri_a, tri_b]), poly):
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
    hf = terrain.heightfield(lk)
    np.save(BUILD / "heightfield.npy", hf)
    gcls = ground.classes(lk, bl)
    print(f"ground classes ({time.time() - t0:.0f}s)")
    trees = vegetation.build(bl, lk)
    plats = structures.build()
    door_list = doors.build(bl)
    path_lines = ground.highway_lines(ground.PATHS)
    decals = landmarks.build(bl)
    print(f"landmark decals {len(decals)}")
    plines = [ln for _, _, ln in path_lines]
    sign_list = signs.build(bl, door_list, STRtree(plines), plines)

    def sign_chunk(s):
        """Signs travel with their building's chunk: the mesher marks shop-front walls from the
        signs in the same chunk, and signs past the grid edge still have a home."""
        return int(bci[s[6]]), int(bcj[s[6]])
    print(f"signs {len(sign_list)} ({sum(1 for s in sign_list if s[5] == 'shop')} businesses)")
    # barriers: OSM fences, hedges and walls as straight segments (kind, e1, n1, e2, n2)
    bar = []
    for wid, t in osm.ways_where(lambda t: t.get("barrier") in BARRIER_KINDS):
        pts = osm.way_coords(wid)
        if pts and len(pts) > 1:
            q = [bmod.osm_to_city(*p) for p in pts]
            bar += [(BARRIER_KINDS.index(t["barrier"]), *a, *b) for a, b in zip(q, q[1:])]
    bar = np.array(bar) if bar else np.zeros((0, 5))
    print(f"barrier segments {len(bar)}")
    print(f"doors {len(door_list)}")
    tuft_map = tufts.build(gcls, bl, chunk_frame)
    print(f"tufts {sum(len(v) for v in tuft_map.values())} ({time.time() - t0:.0f}s)")
    pcent = np.array([[p.centroid.x, p.centroid.y] for p, *_ in plats]) if plats else np.zeros((0, 2))
    pr = props.build(path_lines)
    print(f"trees {len(trees)}, props {len(pr)} ({time.time() - t0:.0f}s)")
    with open(BUILD / "buildings.pkl", "wb") as f:
        pickle.dump(bl, f)

    cents = np.array([[b["footprint"].centroid.x, b["footprint"].centroid.y] for b in bl])
    # buildings that straddle the grid edge with their centroid outside belong to the edge chunk
    bci = np.clip(np.floor((cents[:, 0] - C["grid_origin_e"]) / SIZE).astype(int), 0, C["cols"] - 1)
    bcj = np.clip(np.floor((cents[:, 1] - C["grid_origin_n"]) / SIZE).astype(int), 0, C["rows"] - 1)
    tci = np.floor((trees[:, 0] - C["grid_origin_e"]) / SIZE).astype(int)
    tcj = np.floor((trees[:, 1] - C["grid_origin_n"]) / SIZE).astype(int)
    pci = np.floor((pr[:, 0] - C["grid_origin_e"]) / SIZE).astype(int)
    pcj = np.floor((pr[:, 1] - C["grid_origin_n"]) / SIZE).astype(int)
    index = {"version": 1, "chunk_size": SIZE, "cols": C["cols"], "rows": C["rows"],
             "grid_origin_e": C["grid_origin_e"], "grid_origin_n": C["grid_origin_n"],
             "origin": CAMPUS["origin"], "base_elevation_m": BASE_ELEV,
             "ground_classes": ground.CLASSES, "prop_kinds": props.KINDS, "barrier_kinds": BARRIER_KINDS, "chunks": []}
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
            lake_d = []
            for lake in lk:
                g = lake["geom"].intersection(cbox)
                shore = lake["geom"].boundary
                for p in ground.polygons(g):
                    # cell-tessellated so the shader gets a distance-to-shore gradient inside the lake
                    v, t = tessellate(p, e0, n1)
                    if len(t) == 0:
                        continue
                    t = face_up(v, t)
                    lake_d.append(shapely.distance(shapely.points(e0 + v[:, 0], n1 - v[:, 1]), shore))
                    lakes_h.append({"name": lake["name"], "objectid": lake["objectid"],
                                    "y": lake["level"] - BASE_ELEV, "first": int(sum(len(x) for x in li)),
                                    "count": int(len(t))})
                    lv.append(v)
                    li.append(t + base)
                    base += len(v)
            if lv:
                arrays["lake_d"] = np.clip(np.round(np.concatenate(lake_d) * 10), 0, 255).astype(np.uint8)
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
                              "ground_y": round(b["ground"] - BASE_ELEV, 3),
                              "base_y": round(b["base"] - BASE_ELEV, 3), "p90": round(b["p90"], 3),
                              "post2018": bool(b["post2018"]), "height_source": b["height_source"],
                              "footprint": fp, "parts": parts,
                              "roofs": [{"cx": round(r["cx"] - e0, 3), "cz": round(n1 - r["cy"], 3), "ux": round(r["ux"], 5),
                                         "uz": round(-r["uy"], 5), "hu": round(r["hu"], 3), "hv": round(r["hv"], 3),
                                         "eave": round(r["eave"], 3), "rise": round(r["rise"], 3)} for r in b.get("roofs", [])]})
            if rings_xz:
                arrays["ring_xz"] = np.vstack(rings_xz).astype(np.float32).ravel()
                arrays["ring_count"] = np.array(ring_counts, dtype=np.uint32)
            header["buildings"] = binfo
            # transit platforms
            pinfo, pxz, pcount = [], [], []
            for k, (poly, deck, canopy, kind) in enumerate(plats):
                if int((pcent[k, 0] - C["grid_origin_e"]) // SIZE) != i or int((pcent[k, 1] - C["grid_origin_n"]) // SIZE) != j:
                    continue
                v, cnt = ring_arrays(poly, e0, n1)
                g = float(np.median(terrain.sample(hf, np.asarray(poly.exterior.coords)[:, 0],
                                                   np.asarray(poly.exterior.coords)[:, 1]))) - BASE_ELEV
                pinfo.append({"ring_first": len(pcount), "ring_n": len(cnt), "ground_y": round(g, 3),
                              "deck": deck, "canopy": canopy, "kind": kind})
                pxz.append(v)
                pcount += cnt
            if pxz:
                arrays["plat_xz"] = np.vstack(pxz).astype(np.float32).ravel()
                arrays["plat_count"] = np.array(pcount, dtype=np.uint32)
            header["platforms"] = pinfo
            # doors on walls at OSM entrances (y at the building's ground level)
            dsel = [d for d in door_list if bci[d[3]] == i and bcj[d[3]] == j]
            if dsel:
                arrays["door_xyz"] = np.array([[d[0] - e0, bl[d[3]]["ground"] - BASE_ELEV, n1 - d[1]] for d in dsel],
                                              dtype=np.float32).ravel()
                arrays["door_rot"] = np.array([d[2] for d in dsel], dtype=np.float32)
            # barrier segments assigned by midpoint
            if len(bar):
                mid_i = np.floor(((bar[:, 1] + bar[:, 3]) / 2 - C["grid_origin_e"]) / SIZE).astype(int)
                mid_j = np.floor(((bar[:, 2] + bar[:, 4]) / 2 - C["grid_origin_n"]) / SIZE).astype(int)
                bs = bar[(mid_i == i) & (mid_j == j)]
                if len(bs):
                    y1 = terrain.sample(hf, bs[:, 1], bs[:, 2]) - BASE_ELEV
                    y2 = terrain.sample(hf, bs[:, 3], bs[:, 4]) - BASE_ELEV
                    arrays["bar_seg"] = np.c_[bs[:, 1] - e0, y1, n1 - bs[:, 2], bs[:, 3] - e0, y2, n1 - bs[:, 4]].astype(np.float32).ravel()
                    arrays["bar_kind"] = bs[:, 0].astype(np.uint8)
            header["decals"] = [{"x": round(d[0] - e0, 2), "z": round(n1 - d[1], 2), "y": round(bl[d[3]]["ground"] - BASE_ELEV, 2),
                                 "rot": round(d[2], 4), "kind": d[4]["kind"], "bottom": d[4]["bottom_m"], "top": d[4]["top_m"]}
                                for d in decals if int((d[0] - C["grid_origin_e"]) // SIZE) == i and int((d[1] - C["grid_origin_n"]) // SIZE) == j]
            # signs (assigned by their own position)
            sl = [s for s in sign_list if sign_chunk(s) == (i, j)]
            header["signs"] = [{"x": round(s[0] - e0, 2), "z": round(n1 - s[1], 2),
                                "y": round(float(terrain.sample(hf, s[0], s[1])) - BASE_ELEV, 2) if s[5] in ("uw", "uw_plaque")
                                else round(bl[s[6]]["ground"] - BASE_ELEV, 2),
                                "rot": round(s[2], 4), "text": s[3], "sub": s[4], "style": s[5]} for s in sl]
            # grass tufts and flowers
            tf = tuft_map[(i, j)]
            if len(tf):
                arrays["tuft_xz"] = np.round(np.clip(np.c_[tf[:, 0] - e0, n1 - tf[:, 1]], 0, SIZE) * Q).astype(np.uint16).ravel()
                arrays["tuft_kind"] = tf[:, 2].astype(np.uint8)
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
    far_bytes = far.build(hf, gcls, bl, bci, bcj, chunk_frame)
    print(f"far LOD {far_bytes / 1e6:.1f} MB")
    net = network.build(bl)
    (WORLD / "network.json").write_text(json.dumps(net, separators=(",", ":")))
    index["stations"] = net["stations"]
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
