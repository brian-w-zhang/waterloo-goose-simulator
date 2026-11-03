"""World x, z of the 20 viewpoint cameras and their targets: python -m tools.verify.viewpoints_world"""
import json

from pipeline.config import ROOT
from pipeline.coords import lonlat_to_utm, utm_to_world

VP = json.loads((ROOT / "verify" / "ground-truth" / "viewpoints.json").read_text())["viewpoints"]
NATIVE = json.loads((ROOT / "verify" / "truth-native" / "landmarks_native.json").read_text())["buildings"]


def main():
    out = {}
    for v in VP:
        e, n = lonlat_to_utm(v["camera"]["lon"], v["camera"]["lat"])
        x, z = utm_to_world(e, n)
        t = NATIVE.get(v["target"])
        tx, tz = utm_to_world(t["utm_e"], t["utm_n"]) if t else (None, None)
        out[v["id"]] = {"x": round(float(x), 2), "z": round(float(z), 2),
                        "target": v["target"], "tx": None if tx is None else round(float(tx), 2),
                        "tz": None if tz is None else round(float(tz), 2)}
    (ROOT / "verify" / "viewpoints.world.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"{len(out)} viewpoints")


if __name__ == "__main__":
    main()
