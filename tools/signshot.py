"""Pose JSON looking at a named sign from 9 m in front of it: python -m tools.signshot "Hakka Nation" [dist]"""
import glob
import json
import math
import sys

from pipeline.chunkio import read_chunk

name = sys.argv[1]
dist = float(sys.argv[2]) if len(sys.argv) > 2 else 9.0
for f in glob.glob("public/world/c_*.wgc"):
    h, _ = read_chunk(f)
    for s in h.get("signs", []):
        if s["text"] == name:
            x, z = s["x"] + h["chunk"]["x0"], s["z"] + h["chunk"]["z0"]
            cx, cz = x + math.cos(s["rot"]) * dist, z - math.sin(s["rot"]) * dist
            yaw = math.degrees(math.atan2(x - cx, -(z - cz))) % 360
            y = s["y"] + (2.0 if s["style"] == "uw" else 3.0)
            print(json.dumps({"pose": {"x": round(cx, 2), "z": round(cz, 2), "y": round(y, 2), "yaw": round(yaw, 1), "pitch": -4, "fov": 50}}))
            sys.exit(0)
sys.exit(f"no sign {name}")
