"""Buildings: City footprints, lidar heights (p90 and height tiers), style class, ground level."""
import json
from functools import lru_cache

import numpy as np
import rasterio.features
from scipy import ndimage
from shapely import STRtree
from shapely.geometry import Polygon, shape
from shapely.geometry.polygon import orient

from ..config import CAMPUS, RAW, ROOT
from . import lidar
from . import osm

B = CAMPUS["buildings"]
TIER_STEP_M = 3.0          # height quantisation for tier segmentation
TIER_MIN_AREA_M2 = 60.0    # smaller tier regions merge into their neighbours
SPIKE_MAX_AREA_M2 = 150.0  # small tiers far above all neighbours are cranes, masts or canopy, not mass
SPIKE_RISE_M = 8.0
TIER_SIMPLIFY_M = 1.2      # tier outlines: removes lidar pixel stair-steps on walls off the raster grid
TIER_OPEN_PX = 2           # morphological opening per level: shaves one-pixel teeth before polygonising
STYLE_RULES = json.loads((ROOT / "config" / "style-rules.json").read_text())


@lru_cache(maxsize=1)
def city_features():
    feats = json.loads((RAW / "city" / "city_footprints.geojson").read_text())["features"]
    out = []
    for f in feats:
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        polys = [g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))
        for k, p in enumerate(polys):
            if p.geom_type == "Polygon" and p.area > 1.0:
                out.append((f["properties"], k, orient(p)))
    return out


@lru_cache(maxsize=1)
def osm_registration():
    """Median offset of OSM building centroids from matched City footprints (IoU over 0.7).

    OSM nodes go through pyproj's null datum shift while City data is native NAD83 UTM, so
    OSM-derived coordinates are shifted by minus this offset to register to the City base.
    """
    city = [p for _, _, p in city_features()]
    tree = STRtree(city)
    offs = []
    for wid, _ in osm.ways_where(lambda t: "building" in t):
        pts = osm.way_coords(wid)
        if not pts or len(pts) < 4 or pts[0] != pts[-1]:
            continue
        p = Polygon(pts)
        if not p.is_valid or p.area < 50:
            continue
        for i in tree.query(p):
            c = city[i]
            if p.intersection(c).area / p.union(c).area > 0.7:
                offs.append((p.centroid.x - c.centroid.x, p.centroid.y - c.centroid.y))
    o = np.median(np.array(offs), axis=0)
    return float(o[0]), float(o[1]), len(offs)


def osm_to_city(e, n):
    de, dn, _ = osm_registration()
    return e - de, n - dn


def _mask(poly, shape_, transform):
    return rasterio.features.geometry_mask([poly], out_shape=shape_, transform=transform, invert=True)


def _window(poly, pad=2.0):
    """Pixel window of the lidar mosaic around a polygon, plus its affine transform."""
    minx, miny, maxx, maxy = poly.bounds
    r0, c0 = lidar.rc_of(minx - pad, maxy + pad)
    r1, c1 = lidar.rc_of(maxx + pad, miny - pad)
    r0, c0 = max(int(np.floor(r0)), 0), max(int(np.floor(c0)), 0)
    r1, c1 = int(np.ceil(r1)) + 1, int(np.ceil(c1)) + 1
    t = lidar.transform() * rasterio.Affine.translation(c0, r0)
    return (slice(r0, r1), slice(c0, c1)), t


def tag_height(props, osm_tags):
    """Fallback height for buildings newer than the 2018 lidar: OSM height, levels, City storeys."""
    if osm_tags:
        h = osm_tags.get("height", "").replace("m", "").strip()
        try:
            return float(h), "osm_height"
        except ValueError:
            pass
        lv = osm_tags.get("building:levels")
        if lv:
            try:
                return float(lv) * B["storey_m"], "osm_levels"
            except ValueError:
                pass
    for key in ("FIRE_STOREYS", "FULL_STOREYS_MPAC"):
        v = props.get(key)
        if v:
            return float(v) * B["storey_m"], key.lower()
    return B["fallback_height_m"], "default"


@lru_cache(maxsize=1)
def osm_building_tags():
    """OSM building ways as (polygon in City frame, tags) for tag conflation by IoU."""
    out = []
    for wid, tags in osm.ways_where(lambda t: "building" in t or "building:part" in t):
        pts = osm.way_coords(wid)
        if not pts or len(pts) < 4 or pts[0] != pts[-1]:
            continue
        p = Polygon([osm_to_city(e, n) for e, n in pts])
        if p.is_valid and p.area > 10:
            out.append((p, tags, "building:part" in tags and "building" not in tags))
    return out


def match_osm(poly, tree, items):
    best, best_iou = None, 0.5
    for i in tree.query(poly):
        p, tags, is_part = items[i]
        if is_part:
            continue
        iou = p.intersection(poly).area / p.union(poly).area
        if iou > best_iou:
            best, best_iou = tags, iou
    return best, (best_iou if best else 0.0)


def style_class(props, tags, area):
    ab = (props.get("BLDG_ABBREV") or "").strip()
    by_oid = STYLE_RULES.get("objectids", {}).get(str(props["OBJECTID"]))
    if by_oid:
        return by_oid
    for rule in STYLE_RULES["rules"]:
        if ab and ab in rule.get("abbrev", []):
            return rule["style"]
    tags = tags or {}
    mat = tags.get("building:material", "")
    bt = tags.get("building", "")
    for rule in STYLE_RULES["rules"]:
        if mat and mat in rule.get("material", []):
            return rule["style"]
        if bt and bt in rule.get("building", []):
            return rule["style"]
    if props.get("OWNER") is None and props.get("BUILDING_USE") is None and area < STYLE_RULES["house_max_area_m2"]:
        return STYLE_RULES["house"]
    v = STYLE_RULES.get("default_variants")
    if v:
        h = (int(props["OBJECTID"]) * 2654435761) % 2**32
        return v[h % len(v)]
    return STYLE_RULES["default"]


def tiers(poly, nd, t, base_h):
    """Split a footprint into height tiers from the nDSM; returns [(polygon, height_m)]."""
    m = _mask(poly, nd.shape, t)
    if m.sum() < 16:
        return [(poly, base_h)]
    sm = ndimage.median_filter(nd, size=5)
    lev = np.where(m, np.round(sm / TIER_STEP_M), -1).astype(np.int32)
    # majority-style cleanup: small connected regions take the most common neighbouring level
    px_area = lidar.RES ** 2
    for _ in range(3):
        changed = False
        for L in np.unique(lev[lev >= 0]):
            lab, n = ndimage.label(lev == L)
            if n == 0:
                continue
            sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
            for k in np.where(sizes * px_area < TIER_MIN_AREA_M2)[0]:
                reg = lab == (k + 1)
                ring = ndimage.binary_dilation(reg) & ~reg & (lev >= 0)
                if ring.any():
                    vals, cnt = np.unique(lev[ring], return_counts=True)
                    lev[reg] = vals[np.argmax(cnt)]
                    changed = True
        if not changed:
            break
    for L in np.unique(lev[lev >= 0]):
        lab, n = ndimage.label(lev == L)
        for k in range(1, n + 1):
            comp = lab == k
            ring = ndimage.binary_dilation(comp, iterations=2) & ~comp & (lev >= 0)
            if comp.sum() * px_area < SPIKE_MAX_AREA_M2 and ring.any() \
                    and (L - lev[ring].max()) * TIER_STEP_M > SPIKE_RISE_M:
                vals, cnt = np.unique(lev[ring], return_counts=True)
                lev[comp] = vals[np.argmax(cnt)]
    levels = np.unique(lev[lev >= 0])
    if len(levels) <= 1:
        return [(poly, base_h)]
    out = []
    # smooth each level's region: an opening removes teeth, the removed pixels go to a neighbour level
    for L in levels:
        reg = lev == L
        opened = ndimage.binary_opening(reg, iterations=TIER_OPEN_PX)
        teeth = reg & ~opened
        if teeth.any() and opened.any():
            dist, near = ndimage.distance_transform_edt(~((lev >= 0) & ~teeth & (lev != L)), return_indices=True)
            # only teeth touching another level move to it; a narrow wing with no neighbour stays put
            move = teeth & (dist <= TIER_OPEN_PX + 1)
            lev[move] = lev[near[0][move], near[1][move]]
    levels = np.unique(lev[lev >= 0])
    for L in levels:
        reg = (lev == L).astype(np.uint8)
        hvals = nd[(lev == L)]
        h = float(np.median(hvals))
        for geom, val in rasterio.features.shapes(reg, mask=reg.astype(bool), transform=t):
            p = shape(geom).simplify(TIER_SIMPLIFY_M, preserve_topology=True).intersection(poly)
            for q in ([p] if p.geom_type == "Polygon" else list(getattr(p, "geoms", []))):
                if q.geom_type == "Polygon" and q.area >= 15.0:
                    out.append((orient(q), h))
    if not out:
        return [(poly, base_h)]
    # footprint area no tier covers (dropped small regions, simplification slivers): each piece joins
    # the tier along whose edge it lies (longest shared boundary), so a sliver at a low wing's edge
    # does not rise to the tallest tier's height as a spike
    from shapely import union_all
    rest = poly.difference(union_all([q for q, _ in out]))
    if rest.area > 0.01:
        geoms = [out[i][0] for i in range(len(out))]
        add = [[] for _ in out]
        for g in ([rest] if rest.geom_type == "Polygon" else [x for x in getattr(rest, "geoms", []) if x.geom_type == "Polygon"]):
            if g.area < 0.01:
                continue
            edge = g.boundary
            shared = [edge.intersection(q.buffer(0.05)).length for q in geoms]
            k = max(range(len(geoms)), key=lambda i: shared[i]) if max(shared) > 0 else \
                min(range(len(geoms)), key=lambda i: geoms[i].distance(g))
            add[k].append(g)
        merged_out = []
        for (q, h), extra in zip(out, add):
            m = union_all([q] + extra) if extra else q
            for g in ([m] if m.geom_type == "Polygon" else [x for x in getattr(m, "geoms", []) if x.geom_type == "Polygon"]):
                if g.area > 0.01:
                    merged_out.append((orient(g), h))
        out = merged_out
    return out


def min_rect(poly):
    """Minimum rotated rectangle as centre, unit long axis and half sizes (long, short)."""
    c = list(poly.minimum_rotated_rectangle.exterior.coords)[:4]
    e1 = np.subtract(c[1], c[0]); e2 = np.subtract(c[2], c[1])
    L1, L2 = np.hypot(*e1), np.hypot(*e2)
    u = e1 / L1 if L1 >= L2 else e2 / L2
    cx, cy = np.mean(c, axis=0)
    return float(cx), float(cy), float(u[0]), float(u[1]), max(L1, L2) / 2, min(L1, L2) / 2


def round_roof(p, z):
    """Vaulted roof height at x, y for a rect roof record (also used by the validator)."""
    v = abs(-(p[0] - z["cx"]) * z["uy"] + (p[1] - z["cy"]) * z["ux"]) / z["hv"]
    return z["eave"] + z["rise"] * np.sqrt(np.clip(1 - v * v, 0, 1))


@lru_cache(maxsize=1)
def osm_round_roofs():
    """OSM building parts tagged roof:shape=round, registered to the City frame (rectangles only)."""
    out = []
    for wid, tags in osm.ways_where(lambda t: t.get("roof:shape") == "round"):
        pts = osm.way_coords(wid)
        if not pts or len(pts) < 4:
            continue
        p = Polygon([osm_to_city(e, n) for e, n in pts])
        if p.is_valid and p.area / p.minimum_rotated_rectangle.area > 0.9:
            out.append((wid, p))
    return out


def build():
    """All buildings with heights and parts, in UTM. Returns list of dicts."""
    nd = lidar.ndsm()
    dtm = lidar.dtm()
    items = osm_building_tags()
    tree = STRtree([p for p, _, _ in items])
    out = []
    for idx, (props, k, poly) in enumerate(city_features()):
        sl, t = _window(poly)
        ndw, dtmw = nd[sl], dtm[sl]
        full = _mask(poly, ndw.shape, t)
        er = poly.buffer(-B["height_erode_m"])
        em = _mask(er, ndw.shape, t) if not er.is_empty and er.area > 4 else full
        if em.sum() == 0:
            em = full
        vals = ndw[em]
        p90 = float(np.percentile(vals, B["height_percentile"])) if vals.size else 0.0
        med = float(np.median(vals)) if vals.size else 0.0
        ground = float(np.median(dtmw[full])) if full.any() else float("nan")
        ring = _mask(poly.buffer(B["skirt_m"]), ndw.shape, t)
        base = float(np.min(dtmw[ring])) - 0.3 if ring.any() else ground - B["skirt_m"]
        tags, iou = match_osm(poly, tree, items)
        source = "lidar_p90"
        post2018 = med < B["post2018_median_ndsm_m"]
        if post2018:
            p90, source = tag_height(props, tags)
            parts = [(poly, p90)]
        else:
            parts = tiers(poly, ndw, t, p90)
            # tiers at ground level inside a built footprint are newer than the lidar
            fill = tag_height(props, tags)[0] if any(h < 1.5 for _, h in parts) else None
            parts = [(q, h if h >= 1.5 else fill) for q, h in parts]
        # vaulted roofs from OSM roof:shape=round parts: eave and crest from the lidar inside the part;
        # tiers under the vault are capped at the eave so the vault surface is what shows
        roofs = []
        for wid, rp in osm_round_roofs():
            if source != "lidar_p90" or rp.intersection(poly).area < 0.5 * rp.area:
                continue
            rsl, rt = _window(rp)
            rm = _mask(rp, nd[rsl].shape, rt)
            vals_r = nd[rsl][rm]
            eave, crest = float(np.percentile(vals_r, 15)), float(np.percentile(vals_r, 95))
            if crest - eave < 1.0:
                continue
            cx, cy, ux, uy, hu, hv = min_rect(rp)
            roofs.append({"osm_way": wid, "cx": cx, "cy": cy, "ux": ux, "uy": uy, "hu": hu, "hv": hv,
                          "eave": eave, "rise": crest - eave})
            capped = []
            for q, h in parts:
                inside, outside = q.intersection(rp), q.difference(rp)
                for g, hh in ((inside, min(h, eave)), (outside, h)):
                    for gg in ([g] if g.geom_type == "Polygon" else list(getattr(g, "geoms", []))):
                        if gg.geom_type == "Polygon" and gg.area > 0.5:
                            capped.append((orient(gg), hh))
            parts = capped
        simple = orient(poly.simplify(B["simplify_tolerance_m"], preserve_topology=True))
        out.append({
            "id": idx,
            "objectid": props["OBJECTID"],
            "part_index": k,
            "abbrev": (props.get("BLDG_ABBREV") or "").strip(),
            "name": props.get("BLDG_NAME") or (tags or {}).get("name", ""),
            "owner": props.get("OWNER"),
            "footprint": simple,
            "ground": ground,
            "base": base,
            "p90": p90,
            "median": med,
            "height_source": source,
            "post2018": post2018,
            "parts": parts,
            "roofs": roofs,
            "osm_iou": iou,
            "osm_tags": tags or {},
            "style": style_class(props, tags, poly.area),
        })
    return out
