"""Fetch every raw input into data/raw/ and record it in pipeline/manifest.json.

Usage: python -m pipeline.fetch [city|osm|lidar|all]
Cached files are not re-fetched; delete them to refresh.
"""
import hashlib
import json
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import requests

from .config import CAMPUS, RAW, ROOT

MANIFEST = ROOT / "pipeline" / "manifest.json"
UA = {"User-Agent": CAMPUS["user_agent"]}
BB = CAMPUS["bbox_utm"]
BBW = CAMPUS["bbox_wgs84"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def load_manifest():
    return json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"inputs": {}}


def record(manifest, key, path: Path, url: str, **extra):
    manifest.update(load_manifest())  # other fetch processes may have written meanwhile
    manifest["inputs"][key] = {
        "path": str(path.relative_to(ROOT)),
        "url": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        **extra,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def get(url, params=None, tries=3, timeout=120):
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            if attempt == tries - 1:
                raise
            wait = 2 ** (attempt + 1)
            print(f"  retry {attempt + 1} after {e}; sleeping {wait}s")
            time.sleep(wait)


def arcgis_layer(url, out: Path):
    """All features intersecting the game bbox, in EPSG:26917, paged."""
    meta = get(url, params={"f": "json"}).json()
    page = int(meta.get("maxRecordCount", 1000))
    feats, offset = [], 0
    while True:
        r = get(f"{url}/query", params={
            "geometry": f"{BB['min_e']},{BB['min_n']},{BB['max_e']},{BB['max_n']}",
            "geometryType": "esriGeometryEnvelope", "inSR": 26917,
            "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
            "outSR": 26917, "f": "geojson", "resultOffset": offset,
            "resultRecordCount": page, "orderByFields": "OBJECTID",
        }).json()
        batch = r.get("features", [])
        feats += batch
        if len(batch) < page:
            break
        offset += page
    out.write_text(json.dumps({"type": "FeatureCollection", "crs": "EPSG:26917", "features": feats}))
    return len(feats)


def fetch_city(manifest):
    layers = {k: v for k, v in CAMPUS["sources"].items()
              if k.startswith("city_") and not k.endswith("ortho_export")}
    for key, url in layers.items():
        out = RAW / "city" / f"{key}.geojson"
        if out.exists():
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        n = arcgis_layer(url, out)
        record(manifest, key, out, url, features=n)
        print(f"{key}: {n} features")


def fetch_osm(manifest):
    """OSM API map calls over a 2 x 2 tiling of the game bbox (the API caps nodes per call)."""
    url = CAMPUS["sources"]["osm_api_map"]
    lons = [BBW["w"], (BBW["w"] + BBW["e"]) / 2, BBW["e"]]
    lats = [BBW["s"], (BBW["s"] + BBW["n"]) / 2, BBW["n"]]
    for i in range(2):
        for j in range(2):
            out = RAW / "osm" / f"map_{i}{j}.osm"
            if out.exists():
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            bbox = f"{lons[i]},{lats[j]},{lons[i + 1]},{lats[j + 1]}"
            r = get(url, params={"bbox": bbox}, timeout=300)
            out.write_bytes(r.content)
            newest = max((el.get("timestamp", "") for el in ET.fromstring(r.content)), default="")
            record(manifest, f"osm_map_{i}{j}", out, f"{url}?bbox={bbox}", newest_element=newest)
            print(f"osm tile {i}{j}: {len(r.content) / 1e6:.1f} MB, newest {newest}")
            time.sleep(2)
    rel = CAMPUS["sources"]["osm_campus_relation"]
    out = RAW / "osm" / "campus_relation.osm"
    if not out.exists():
        u = f"https://api.openstreetmap.org/api/0.6/relation/{rel}/full"
        out.write_bytes(get(u).content)
        record(manifest, "osm_campus_relation", out, u)


def fetch_lidar(manifest):
    from remotezip import RemoteZip

    L = CAMPUS["lidar"]
    for kind in ("dtm", "dsm"):
        want = {L[f"{kind}_name"].format(e=e, n=n)
                for e in L["tile_e_km"] for n in L["tile_n_km"]}
        outdir = RAW / "lidar" / kind
        outdir.mkdir(parents=True, exist_ok=True)
        missing = {w for w in want if not (outdir / w).exists()}
        if not missing:
            continue
        url = L[f"{kind}_zip"]
        with RemoteZip(url, headers=UA) as z:
            names = z.namelist()
            for w in sorted(missing):
                hits = [n for n in names if n.endswith(w)]
                if not hits:
                    print(f"  {kind}: {w} not in package")
                    continue
                data = z.read(hits[0])
                (outdir / w).write_bytes(data)
                record(manifest, f"lidar_{kind}_{w}", outdir / w, f"{url}#{hits[0]}")
                print(f"  {kind}: {w} {len(data) / 1e6:.1f} MB")


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    manifest = load_manifest()
    if what in ("city", "all"):
        fetch_city(manifest)
    if what in ("osm", "all"):
        fetch_osm(manifest)
    if what in ("lidar", "all"):
        fetch_lidar(manifest)


if __name__ == "__main__":
    main()
