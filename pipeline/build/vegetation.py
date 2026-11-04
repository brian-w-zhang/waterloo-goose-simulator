"""Trees: one per lidar crown (marker-controlled watershed of the canopy height model), merged with the
City street-tree inventory and OSM tree nodes, with a species kind per tree.

Crowns: the 0.5 m nDSM (2018 lidar) above 2.5 m, outside building footprints and water, and rough
(foliage scatters the returns; flat or pitched roofs of unmapped sheds, buses and houses are planar).
Markers are local maxima of the smoothed canopy with a window that grows with height; the watershed
assigns every canopy pixel to one marker. Each segment is a tree: apex position, height, equivalent
crown radius, elliptical extent, crown-base estimate and shape features (height/radius, apex
sharpness, profile fill). Where the 2025 summer orthophoto is available (docs/refs/ortho, git-ignored),
segments that are no longer green (felled for construction since 2018) are dropped and the crown
colour feeds the species guess.

Points: a City inventory or OSM tree inside a crown takes that crown and lends it its species; several
points in one crown split it between them; a point with no crown in 2018 (planted later) keeps its
position with a size from its DBH.

Growth: crowns measured in 2018 grow to their 2025 size (grow()); young lawn trees roughly double.

Kinds (index into KINDS, matching the art models art/models/trees.py and src/world/chunkMesh.ts).
"""
import json
from pathlib import Path

import numpy as np
import rasterio.features
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from shapely import LineString, union_all

from ..config import BUILD, CAMPUS, RAW
from . import lidar, osm
from .buildings import osm_to_city

KINDS = ["maple", "oak", "locust", "linden", "spruce", "pine", "cedar", "willow", "ornamental", "shrub"]
K = {k: i for i, k in enumerate(KINDS)}

CANOPY_MIN_M = 2.5          # nDSM above this can be crown
TREE_MIN_M = 3.0            # a marker must reach this height
ROUGH_MIN = 0.12            # mean |z - 3x3 mean| over 2.5 m (m); planes give ~0, foliage 0.2-0.6
BLOCK_BUFFER_M = 1.0
MIN_SEGMENT_M2 = 2.0
ORTHO = Path(__file__).resolve().parents[2] / "docs" / "refs" / "ortho" / "private"
GREEN_EXG = 0.03          # excess green (2g - r - b) / (r + g + b) of foliage in the orthophotos
ORTHO_TILE_M = 150
EVERGREEN_MIN = 0.65        # share of foliage pixels in the leaf-off spring photo that makes a conifer
LIDAR_YEAR, TARGET_YEAR = 2018, 2025    # the crowns are measured in 2018; the game shows summer 2025
VEG_MIN = 0.2              # share of foliage pixels a crown needs in the 2025 summer photo

# genus -> kind for City / OSM species
GENUS = {
    "Acer": "maple", "Nyssa": "maple", "Cercidiphyllum": "maple", "Parrotia": "maple", "Liquidamber": "maple",
    "Liquidambar": "maple", "Sorbus": "ornamental", "Morus": "maple", "Ulmus": "oak",
    "Quercus": "oak", "Fraxinus": "oak", "Celtis": "oak", "Platanus": "oak", "Plantanus": "oak", "Fagus": "oak",
    "Juglans": "oak", "Liriodendron": "oak", "Aesculus": "oak", "Gymnocladus": "locust", "Gymnodladus": "locust",
    "Populus": "oak", "Catalpa": "oak", "Eucommia": "oak", "Maclura": "oak",
    "Gleditsia": "locust", "Robinia": "locust", "Phellodendron": "locust", "Cladrastis": "locust", "Maackia": "locust",
    "Tilia": "linden", "Ginkgo": "linden", "Ostrya": "linden", "Carpinus": "linden", "Betula": "linden",
    "Metasequoia": "spruce", "Picea": "spruce", "Abies": "spruce", "Pseudotsuga": "spruce", "Tsuga": "spruce",
    "Pinus": "pine", "Larix": "pine",
    "Thuja": "cedar", "Juniperus": "cedar", "Taxus": "cedar", "Chamaecyparis": "cedar",
    "Salix": "willow",
    "Malus": "ornamental", "Prunus": "ornamental", "Amelanchier": "ornamental", "Pyrus": "ornamental",
    "Cercis": "ornamental", "Syringa": "ornamental", "Cornus": "ornamental", "Magnolia": "ornamental",
    "Crataegus": "ornamental", "Hamamelis": "ornamental",
    "Viburnum": "shrub", "Rhamnus": "shrub", "Rhus": "shrub", "Euonymus": "shrub",
}


def kind_of_species(latin):
    if not latin:
        return -1
    genus = latin.replace("×", "").split()[0].strip().capitalize()
    k = GENUS.get(genus)
    return K[k] if k else -1


def _year(name, shape):
    """One orthophoto year on the lidar grid: mean RGB (H, W, 3 uint8), foliage fraction (share of the 10 cm
    pixels with excess green above GREEN_EXG or dark purple-red, uint8 0-255) and coverage."""
    from PIL import Image
    H, W = shape
    n_px = round(ORTHO_TILE_M / lidar.RES)
    rgb = np.zeros((H, W, 3), np.uint8)
    green = np.zeros((H, W), np.uint8)
    have = np.zeros((H, W), bool)
    for f in (ORTHO / name).glob("*.jpg"):
        e, n = map(int, f.stem.split("_"))
        im = Image.open(f).convert("RGB")
        k = im.width // n_px
        a = np.asarray(im.resize((n_px * k, n_px * k)), dtype=np.float32)
        exg = (2 * a[..., 1] - a[..., 0] - a[..., 2]) / (a.sum(2) + 1.0)
        # foliage: green, or the dark purple-red of 'Crimson King' maples and purple-leaf plums
        mean = a.mean(2)
        purple = (a[..., 0] > a[..., 1] + 6) & (a[..., 2] < a[..., 0]) & (mean > 25) & (mean < 85)
        g = ((exg > GREEN_EXG) | purple).reshape(n_px, k, n_px, k).mean((1, 3))
        m = a.reshape(n_px, k, n_px, k, 3).mean((1, 3))
        c0, r0 = round((e - lidar.E0) / lidar.RES), round((lidar.N1 - (n + ORTHO_TILE_M)) / lidar.RES)
        rs, cs, re, ce = max(r0, 0), max(c0, 0), min(r0 + n_px, H), min(c0 + n_px, W)
        if rs < re and cs < ce:
            rgb[rs:re, cs:ce] = m[rs - r0:re - r0, cs - c0:ce - c0]
            green[rs:re, cs:ce] = np.round(g[rs - r0:re - r0, cs - c0:ce - c0] * 255)
            have[rs:re, cs:ce] = True
    return rgb, green, have


def ortho_features(shape):
    """Summer 2025 (leaf-on) colour and greenness, spring 2026 (leaf-off) greenness, on the lidar grid,
    cached in data/build; None where the photos are not on this machine."""
    cache = BUILD / "ortho_trees_0p5.npz"
    if cache.exists():
        z = np.load(cache)
        return {k: z[k] for k in z.files}
    if not (ORTHO / "2025summer").exists():
        return None
    rgb, g25, have = _year("2025summer", shape)
    out = {"rgb": rgb, "g25": g25, "have": have}
    if (ORTHO / "2026spring").exists():
        _, g26, have26 = _year("2026spring", shape)
        out.update(g26=g26, have26=have26)
    np.savez_compressed(cache, **out)
    return out


def canopy(nd, block):
    """Crown pixels: high, rough, not building or water."""
    resid = np.abs(nd - ndi.uniform_filter(nd, 3))
    rough = ndi.uniform_filter(resid, 5)
    can = (nd > CANOPY_MIN_M) & ~block & (rough > ROUGH_MIN)
    can = ndi.binary_opening(can, np.ones((3, 3), bool))
    # smooth foliage patches inside a crown read as holes: close them (only where the nDSM is high)
    can |= ndi.binary_closing(can, np.ones((3, 3), bool)) & (nd > CANOPY_MIN_M) & ~block
    lab, n = ndi.label(can)
    size = np.bincount(lab.ravel())
    small = size < MIN_SEGMENT_M2 / lidar.RES ** 2
    small[0] = False
    can[small[lab]] = False
    return can


def window_m(h):
    """Local-maximum search radius for a crown apex of height h (m)."""
    return np.clip(1.0 + 0.11 * h, 1.5, 4.0)


def segment(nd, can):
    """Marker-controlled watershed of the smoothed canopy. Returns (labels, markers (r, c))."""
    chm = np.where(can, nd, 0.0)
    sm = ndi.gaussian_filter(chm, 1.0)
    sm[~can] = 0
    radii = np.arange(1.5, 4.01, 0.5)
    rbin = np.clip(np.round((window_m(sm) - 1.5) / 0.5).astype(int), 0, len(radii) - 1)
    peak = np.zeros(nd.shape, bool)
    for k, r in enumerate(radii):
        mx = ndi.maximum_filter(sm, size=2 * int(round(r / lidar.RES / 1.13)) + 1)   # square of the disk's area
        peak |= (rbin == k) & (sm >= mx - 1e-6)
    peak &= can & (sm >= TREE_MIN_M)
    # one marker per plateau
    pl, n = ndi.label(peak, np.ones((3, 3), bool))
    cen = np.array(ndi.center_of_mass(peak, pl, np.arange(1, n + 1))) if n else np.zeros((0, 2))
    mr, mc = np.clip(np.round(cen[:, 0]).astype(int), 0, nd.shape[0] - 1), np.clip(np.round(cen[:, 1]).astype(int), 0, nd.shape[1] - 1)
    markers = np.zeros(nd.shape, np.int32)
    markers[mr, mc] = np.arange(1, n + 1)
    top = max(float(sm.max()), 1.0)
    cost = np.where(can, (top - sm) / top * 60000, 65535).astype(np.uint16)
    lab = ndi.watershed_ift(cost, markers, structure=np.ones((3, 3), bool))
    lab[~can] = 0
    # a label only keeps the canopy patch its marker stands on
    cc, _ = ndi.label(can, np.ones((3, 3), bool))
    mcc = np.zeros(n + 1, np.int32)
    mcc[1:] = cc[mr, mc]
    lab[cc != mcc[lab]] = 0
    lab, keep = _merge_shallow(lab, sm, n, np.c_[mr, mc])
    return lab, np.c_[mr, mc][keep]


def _merge_shallow(lab, sm, n, mk):
    """Merge neighbouring segments with no real dip between their tops (two bumps of one crown)."""
    pairs, vals = [], []
    for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
        a = lab[max(dr, 0):, max(-dc, 0):lab.shape[1] - max(dc, 0)]
        b = lab[:lab.shape[0] - dr, max(dc, 0):][:, :a.shape[1]] if dc >= 0 else lab[:lab.shape[0] - dr, :lab.shape[1] + dc]
        sa = sm[max(dr, 0):, max(-dc, 0):lab.shape[1] - max(dc, 0)]
        sb = sm[:lab.shape[0] - dr, max(dc, 0):][:, :a.shape[1]] if dc >= 0 else sm[:lab.shape[0] - dr, :lab.shape[1] + dc]
        m = (a > 0) & (b > 0) & (a != b)
        lo, hi = np.minimum(a[m], b[m]), np.maximum(a[m], b[m])
        pairs.append(lo.astype(np.int64) * (n + 1) + hi)
        vals.append(np.minimum(sa[m], sb[m]))
    key, val = np.concatenate(pairs), np.concatenate(vals)
    ident = np.arange(n + 1)
    if len(key):
        o = np.argsort(key, kind="stable")
        key, val = key[o], val[o]
        st = np.r_[0, np.nonzero(np.diff(key))[0] + 1]
        saddle = np.maximum.reduceat(val, st)
        a, b = np.divmod(key[st], n + 1)
        top = np.zeros(n + 1)
        top[1:] = ndi.maximum(sm, lab, np.arange(1, n + 1))
        lower = np.minimum(top[a], top[b])
        dist = np.hypot(*(mk[a - 1] - mk[b - 1]).T) * lidar.RES
        merge = (lower - saddle < 0.35 + 0.03 * lower) & (dist < 1.5 * window_m(np.maximum(top[a], top[b])))
        # a sliver (under 6 m2) hanging off a crown without a deep dip is part of that crown
        px = np.bincount(lab.ravel(), minlength=n + 1) * lidar.RES ** 2
        merge |= (np.minimum(px[a], px[b]) < 6.0) & (saddle > 0.6 * lower)
        parent = np.arange(n + 1)

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        for x, y in zip(a[merge], b[merge]):
            rx, ry = find(x), find(y)
            if rx != ry:
                # the taller top names the merged crown
                if top[rx] < top[ry]:
                    rx, ry = ry, rx
                parent[ry] = rx
        ident = np.array([find(x) for x in range(n + 1)])
    roots = np.unique(ident[1:])
    new = np.zeros(n + 1, np.int32)
    new[roots] = np.arange(1, len(roots) + 1)
    return new[ident][lab], roots - 1


def crown_features(nd, lab, n, o=None):
    """Per segment 1..n: dict of arrays (apex rc, h, area, ellipse, base, shape, colour)."""
    idx = np.arange(1, n + 1)
    H, W = nd.shape
    flat = lab.ravel()
    sel = flat > 0
    li = flat[sel]
    rr, cc = np.divmod(np.nonzero(sel)[0], W)
    z = nd.ravel()[sel]
    cnt = np.bincount(li, minlength=n + 1).astype(float)
    # apex: highest pixel
    order = np.lexsort((z, li))
    last = np.r_[np.nonzero(np.diff(li[order]))[0], len(order) - 1]
    ap = order[last]
    lab_ap = li[ap]
    ar = np.zeros(n + 1); ac = np.zeros(n + 1); h = np.zeros(n + 1)
    ar[lab_ap], ac[lab_ap], h[lab_ap] = rr[ap], cc[ap], z[ap]
    # height: 98th percentile-ish (robust to a stray return): mean of apex and the 3x3 max of a smoothed nDSM
    sm = ndi.gaussian_filter(nd, 0.7)
    h = np.minimum(h, sm[ar.astype(int), ac.astype(int)] + 0.5)
    area = cnt * lidar.RES ** 2
    # moments for the ellipse
    def s(v):
        return np.bincount(li, v, minlength=n + 1)
    my, mx = s(rr) / np.maximum(cnt, 1), s(cc) / np.maximum(cnt, 1)
    dy, dx = rr - my[li], cc - mx[li]
    cyy, cxx, cxy = s(dy * dy) / np.maximum(cnt, 1), s(dx * dx) / np.maximum(cnt, 1), s(dx * dy) / np.maximum(cnt, 1)
    tr, det = cxx + cyy, cxx * cyy - cxy ** 2
    l1 = tr / 2 + np.sqrt(np.maximum(tr * tr / 4 - det, 0))
    l2 = np.maximum(tr - l1, 1e-6)
    ratio = np.sqrt(l1 / l2)                                    # major / minor
    theta = 0.5 * np.arctan2(-2 * cxy, cxx - cyy)             # major-axis angle from east, counter-clockwise (north up)
    req = np.sqrt(area / np.pi)
    # profile: relative mean height, crown base from the low edge of the crown
    zmean = s(z) / np.maximum(cnt, 1)
    base = np.zeros(n + 1)
    srt = np.lexsort((z, li))
    start = np.r_[0, np.nonzero(np.diff(li[srt]))[0] + 1]
    present = li[srt][start]
    p15 = z[srt][np.minimum(start + (cnt[present] * 0.15).astype(int), len(srt) - 1)]
    base[present] = p15
    fill = (zmean - base) / np.maximum(h - base, 0.5)
    # apex sharpness: drop from the apex to the mean height 1.0-1.5 m away
    d2 = (rr - ar[li]) ** 2 + (cc - ac[li]) ** 2
    ring = (d2 >= (1.0 / lidar.RES) ** 2) & (d2 <= (1.5 / lidar.RES) ** 2)
    rn = np.bincount(li[ring], minlength=n + 1)
    rz = np.bincount(li[ring], z[ring], minlength=n + 1) / np.maximum(rn, 1)
    sharp = np.where(rn > 0, h - rz, 0.0)
    out = dict(r=ar[idx], c=ac[idx], h=h[idx], area=area[idx], req=req[idx], ratio=ratio[idx], theta=theta[idx],
               base=base[idx], fill=fill[idx], sharp=sharp[idx])
    # crown centre: height-weighted centroid (the apex of a leaning or one-sided crown is off its middle)
    w = (z - base[li]).clip(0.1) ** 2
    ws = np.maximum(s(w), 1e-6)
    out.update(cr=(s(w * rr) / ws)[idx], cc=(s(w * cc) / ws)[idx])
    if o is not None:
        pix = np.nonzero(sel)[0]
        # colour of the sunlit upper crown (top 40 %), 2025 summer
        up = (z > 0.6 * h[li]) & o["have"].ravel()[pix]
        px = o["rgb"].reshape(-1, 3)[pix[up]].astype(float)
        un = np.bincount(li[up], minlength=n + 1)
        col = np.stack([np.bincount(li[up], px[:, k], minlength=n + 1) for k in range(3)], 1) / np.maximum(un, 1)[:, None]
        tot = col.sum(1) + 1e-3
        # foliage share over the crown, smoothed over 2.5 m (lean of the tops and photo registration)
        hv = o["have"].ravel()[pix]
        hn = np.bincount(li[hv], minlength=n + 1)
        g25 = ndi.uniform_filter(o["g25"].astype(np.float32) / 255, 5).ravel()[pix]
        out.update(bright=(tot / 3)[idx], blue=(col[:, 2] / tot)[idx], green=(col[:, 1] / tot)[idx],
                   veg=(np.bincount(li[hv], g25[hv], minlength=n + 1) / np.maximum(hn, 1))[idx],
                   covered=(hn / np.maximum(cnt, 1))[idx] > 0.5)
        if "g26" in o:
            # evergreen share in the leaf-off spring photo (conifers stay green)
            h6 = o["have26"].ravel()[pix]
            g26 = ndi.uniform_filter(o["g26"].astype(np.float32) / 255, 3).ravel()[pix]
            n6 = np.bincount(li[h6], minlength=n + 1)
            out.update(ever=(np.bincount(li[h6], g26[h6], minlength=n + 1) / np.maximum(n6, 1))[idx],
                       covered26=(n6 / np.maximum(cnt, 1))[idx] > 0.5)
    return out


def point_trees():
    """City inventory (Existing) and OSM tree nodes: (e, n, kind or -1, dbh_cm or nan, source)."""
    pts = []
    for f in json.loads((RAW / "city" / "city_trees.geojson").read_text())["features"]:
        p = f["properties"]
        if p.get("STATUS") != "Existing" or not f.get("geometry"):
            continue
        e, n = f["geometry"]["coordinates"][:2]
        k = kind_of_species(p.get("LATIN_NAME"))
        if k < 0 and (p.get("SPECIES") or "").startswith(("Pi", "Pn", "Ab")):
            k = K["spruce"]
        pts.append((e, n, k, float(p.get("DBH_CM") or np.nan), 0))
    city = np.array(pts) if pts else np.zeros((0, 5))
    tree = cKDTree(city[:, :2]) if len(city) else None
    for e, n, tags in osm.node_points(lambda tg: tg.get("natural") in ("tree", "shrub")):
        e, n = osm_to_city(e, n)
        if tree is not None and tree.query([e, n])[0] < 2.0:
            continue
        k = kind_of_species(tags.get("species") or tags.get("genus") or tags.get("taxon"))
        if tags.get("natural") == "shrub":
            k = K["shrub"]
        elif k < 0 and tags.get("leaf_type") == "needleleaved":
            k = K["spruce"]
        try:
            dbh = float(tags.get("dbh_cm", "nan"))
        except ValueError:
            dbh = np.nan
        pts.append((e, n, k, dbh, 1))
    return np.array(pts) if pts else np.zeros((0, 5))


def water_distance(lakes, shape):
    """Distance (m) to lakes and OSM streams on the lidar grid."""
    geoms = [lk["geom"] for lk in lakes]
    for wid, tags in osm.ways_where(lambda t: t.get("waterway") in ("stream", "river", "canal", "ditch", "drain")):
        pts = osm.way_coords(wid)
        if pts and len(pts) >= 2:
            geoms.append(LineString([osm_to_city(e, n) for e, n in pts]).buffer(2.0))
    if not geoms:
        return np.full(shape, 1e9)
    wet = rasterio.features.geometry_mask(geoms, out_shape=shape, transform=lidar.transform(), invert=True)
    return ndi.distance_transform_edt(~wet) * lidar.RES


def classify(f, wdist, rng):
    """Kind per crown from its lidar shape and the photos' colour (when no species record covers it).

    Conifers: still green in the leaf-off spring 2026 photo (where it covers the crown), else a tall
    narrow crown with a sharp apex. Spruce = dense cone; pine = broader, flatter-topped, irregular;
    cedar = small and narrow. Broadleaf: shrub and ornamental by size, willow by the water, honey locust
    for light airy crowns, linden for upright narrow crowns, oak/ash for broad spreading ones, maple
    for the rest (the commonest street and lawn tree in the City inventory).
    """
    h, req, sharp, fill = f["h"], f["req"], f["sharp"], f["fill"]
    slender = h / np.maximum(req, 0.5)
    n = len(h)
    u = rng.random(n)
    shape_conifer = ((sharp > 0.25 * h * 0.35) & (slender > 2.6) & (fill < 0.5)) | ((slender > 3.3) & (sharp > 1.2) & (h > 6))
    if "ever" in f:
        conifer = np.where(f["covered26"], f["ever"] > EVERGREEN_MIN, shape_conifer)
        bright = np.where(f["covered"], f["bright"], 80.0)
        greenish = np.where(f["covered"], f["green"], 0.36)
    else:
        conifer, bright, greenish = shape_conifer, np.full(n, 80.0), np.full(n, 0.36)
    kind = np.full(n, K["maple"])
    broad = (slender < 1.6) | (req > 6.5)
    kind[broad & (u < 0.6)] = K["oak"]
    kind[~broad & (u < 0.2)] = K["oak"]
    kind[(slender > 2.6) & (req < 3.5) & (u < 0.7)] = K["linden"]
    light = (bright > 95) & (greenish > 0.365)
    kind[light & (h < 17) & (req < 6) & (u < 0.75)] = K["locust"]
    kind[(h < 7.5) & (req < 2.5)] = K["ornamental"]
    kind[(h < 4.0) | ((h < 5.0) & (req < 1.2))] = K["shrub"]
    kind[(wdist < 12) & (req > 3.0) & (h < 18) & (light | (u < 0.5))] = K["willow"]
    con = np.full(n, K["spruce"])
    con[(slender < 2.2) | (fill > 0.6) | ((sharp < 0.6) & (h > 8))] = K["pine"]
    con[(req < 1.6) & (h < 10)] = K["cedar"]
    kind[conifer] = con[conifer]
    return kind


def grow(t, years=TARGET_YEAR - LIDAR_YEAR):
    """Seven summers of growth since the lidar (in place): young lawn and street trees were 1-2.5 m in
    crown radius in 2018 and are 3-4 m in the 2025 photos. Height and radius grow fastest when the tree
    is small and slow down as it matures; a crown never grows past 55 % of the distance to its
    nearest neighbour (packed rows and woodland stay packed)."""
    h, r = t[:, 2].copy(), t[:, 4].copy()
    dr = years * np.clip(0.3 - 0.012 * h, 0.04, 0.25)
    dh = years * np.clip(0.4 - 0.02 * h, 0.03, 0.3)
    d, _ = cKDTree(t[:, :2]).query(t[:, :2], k=2)
    cap = np.maximum(r, 0.55 * d[:, 1])
    t[:, 4] = np.minimum(r + dr, cap)
    t[:, 2] = h + dh * (t[:, 4] - r) / np.maximum(dr, 1e-6)   # crowns held back by neighbours do not shoot up either


def build(buildings, lakes):
    """Trees as rows (e, n, h, kind, radius, crown_base, ratio, theta)."""
    nd = np.nan_to_num(lidar.ndsm())
    t = lidar.transform()
    blocked = union_all([b["footprint"].buffer(BLOCK_BUFFER_M) for b in buildings] + [lk["geom"] for lk in lakes])
    block = rasterio.features.geometry_mask([blocked], out_shape=nd.shape, transform=t, invert=True)
    o = ortho_features(nd.shape)
    can = canopy(nd, block)
    lab, mk = segment(nd, can)
    n = len(mk)
    f = crown_features(nd, lab, n, o)
    rng = np.random.default_rng(CAMPUS["seeds"]["trees"])
    wdist = water_distance(lakes, nd.shape)
    near_w = wdist[f["r"].astype(int), f["c"].astype(int)]
    alive = f["area"] >= MIN_SEGMENT_M2
    if o is not None:
        # felled since 2018 (or a roof edge that leaked past the footprints): no foliage in 2025 summer,
        # and either a bright surface there now (paving, roofs, a building site) or hugging a building.
        # A dark crown with no green is a purple-leaf tree or one in a building's shadow: kept.
        near = ndi.distance_transform_edt(~block) * lidar.RES < 2.0
        cnt = np.maximum(np.bincount(lab.ravel(), minlength=n + 1)[1:], 1)
        hug = np.bincount(lab.ravel(), near.ravel(), minlength=n + 1)[1:] / cnt
        alive &= ~(f["covered"] & (f["veg"] < VEG_MIN) & ((f["bright"] >= 80) | (hug > 0.3)))
    kind = classify(f, near_w, rng)

    # point sources: which crown each point stands in (or within 1.5 m of)
    pts = point_trees()
    pr, pc = lidar.rc_of(pts[:, 0], pts[:, 1])
    ri = np.clip(np.round(pr).astype(int), 0, nd.shape[0] - 1)
    ci = np.clip(np.round(pc).astype(int), 0, nd.shape[1] - 1)
    inside = (pr >= 0) & (pc >= 0) & (pr < nd.shape[0]) & (pc < nd.shape[1])
    _, (nr, nc) = ndi.distance_transform_edt(lab == 0, return_indices=True)
    near = lab[nr[ri, ci], nc[ri, ci]]
    dist = np.hypot(nr[ri, ci] - ri, nc[ri, ci] - ci) * lidar.RES
    pl = np.where(inside & (dist <= 1.5), near, 0)
    pl[pl > 0] = np.where(alive[pl[pl > 0] - 1], pl[pl > 0], 0)

    rows = []
    def add(e, nn, h, k, req, base, ratio, theta):
        rows.append((e, nn, h, k, req, base, ratio, theta))

    E = lambda c: lidar.E0 + (c + 0.5) * lidar.RES
    N = lambda r: lidar.N1 - (r + 0.5) * lidar.RES
    owners = {}
    for p, l in enumerate(pl):
        if l > 0:
            owners.setdefault(int(l), []).append(p)
    split = {l: ps for l, ps in owners.items() if len(ps) > 1}
    for i in range(n):
        l = i + 1
        if not alive[i] or l in split:
            continue
        k = kind[i]
        if l in owners and pts[owners[l][0], 2] >= 0:
            k = int(pts[owners[l][0], 2])
        add(E(f["cc"][i]), N(f["cr"][i]), f["h"][i], k, f["req"][i], f["base"][i], f["ratio"][i], f["theta"][i])
    # a crown with several mapped trees: split its pixels between them (nearest point)
    if split:
        objs = ndi.find_objects(lab)
        for l, ps in split.items():
            if objs[l - 1] is None:
                continue
            ys, xs = objs[l - 1]
            sub = lab[ys, xs] == l
            r_, c_ = np.nonzero(sub)
            r_ = r_ + ys.start
            c_ = c_ + xs.start
            pp = np.c_[pr[ps], pc[ps]]
            owner = cKDTree(pp).query(np.c_[r_, c_])[1]
            for j, p in enumerate(ps):
                m = owner == j
                if m.sum() < 4:
                    continue
                z = nd[r_[m], c_[m]]
                h = float(np.percentile(z, 99))
                req = np.sqrt(m.sum() * lidar.RES ** 2 / np.pi)
                k = int(pts[p, 2]) if pts[p, 2] >= 0 else int(kind[l - 1])
                add(pts[p, 0], pts[p, 1], h, k, req, float(np.percentile(z, 15)), 1.0, 0.0)
    n_crowns = len(rows)
    # mapped trees with no crown in 2018: planted since, sized from their DBH
    for p in np.nonzero(inside & (pl == 0))[0]:
        if near[p] > 0 and dist[p] <= 1.5:
            continue   # stands in a felled crown
        dbh = pts[p, 3]
        if not np.isfinite(dbh) or dbh <= 0:
            dbh = 8.0
        k = int(pts[p, 2]) if pts[p, 2] >= 0 else K["maple"]
        h = float(np.clip(2.0 + 0.32 * dbh, 3.0, 9.0))
        req = float(np.clip(0.6 + 0.07 * dbh, 0.9, 3.0))
        if k in (K["spruce"], K["pine"], K["cedar"]):
            req *= 0.7
        if k == K["shrub"]:
            h, req = 2.0, 1.0
        add(pts[p, 0], pts[p, 1], h, k, req, 0.35 * h, 1.0, 0.0)
    out = np.array(rows, dtype=float)
    grow(out[:n_crowns])
    # crown base: never below 1/5 of the height (so trunks show), never above 2/3
    out[:, 5] = np.clip(out[:, 5], 0.2 * out[:, 2], 0.66 * out[:, 2])
    conif = np.isin(out[:, 3], [K["spruce"], K["cedar"]])
    out[conif, 5] = np.minimum(out[conif, 5], 0.12 * out[conif, 2] + 0.3)   # spruce and cedar skirts reach the ground
    kd, h = out[:, 3], out[:, 2]
    out[kd == K["pine"], 5] = np.maximum(out[kd == K["pine"], 5], 0.45 * h[kd == K["pine"]])   # long bare pine trunks
    out[kd == K["willow"], 5] = np.minimum(out[kd == K["willow"], 5], 0.15 * h[kd == K["willow"]])   # curtains hang low
    out[kd == K["shrub"], 5] = 0.05 * h[kd == K["shrub"]]
    out[:, 6] = np.clip(out[:, 6], 1.0, 2.0)
    return out
