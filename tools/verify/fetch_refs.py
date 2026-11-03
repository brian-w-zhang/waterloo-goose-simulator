"""Fetch the 20 Commons reference photos into the gitignored cache (verify/cache/refs/).

Usage: python -m tools.verify.fetch_refs. Photos are CC BY, CC BY-SA or CC0; they are never committed
and carry their attribution on the contact sheet (doc 08 section 1.6).
"""
import json
import time

import requests

from pipeline.config import CAMPUS, ROOT

OUT = ROOT / "verify" / "cache" / "refs"
API = "https://commons.wikimedia.org/w/api.php"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ua = {"User-Agent": CAMPUS["user_agent"]}
    vps = json.loads((ROOT / "verify" / "ground-truth" / "viewpoints.json").read_text())["viewpoints"]
    for v in vps:
        dst = OUT / f"{v['id']}.jpg"
        if dst.exists():
            continue
        r = requests.get(API, headers=ua, timeout=60, params={
            "action": "query", "titles": v["reference"]["title"], "prop": "imageinfo",
            "iiprop": "url", "iiurlwidth": 1280, "format": "json"}).json()
        page = next(iter(r["query"]["pages"].values()))
        url = page["imageinfo"][0]["thumburl"]
        dst.write_bytes(requests.get(url, headers=ua, timeout=120).content)
        print(v["id"], url)
        time.sleep(1)


if __name__ == "__main__":
    main()
