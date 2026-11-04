"""Street View photos next to the game seen from the same camera, for trees:
.venv/bin/python -m review.trees.sv [PORT]   -> review/trees/sv_<n>.jpg

Takes recent (2025) Street View frames from docs/refs/buildings/*/private/around/index.jsonl (car
panoramas with their lat/lng, heading, pitch and horizontal fov), converts them to game poses and renders
the game from each (review/trees/sv_render.mjs), then pastes the pair side by side."""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

from pipeline.coords import lonlat_to_utm

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PICK = ["dc/sv_W9_miDjyEmMHYSytDuL_4VACg_100.jpg", "dc/sv_W9_uhcier5BTsNhuncexsHvhw_100.jpg",
        "eit/sv_W0_jrLXaqlgNsx1DoPtEwk7Xw_100.jpg", "dwe/sv_W11_4SNyg9zE97RHK_Cn_yghlw_100.jpg",
        "dwe/sv_W13_a6wmUGYMwpdcND2ZZJMgQw_100.jpg", "slc/sv_W18_LVF4_AcYB7TLQRn8iCSrtg_100.jpg"]
port = sys.argv[1] if len(sys.argv) > 1 else "3100"
campus = json.loads((ROOT / "config" / "campus.json").read_text())
oe, on = campus["origin"]["e"], campus["origin"]["n"]
poses = []
for p in PICK:
    b, f = p.split("/")
    d = ROOT / "docs" / "refs" / "buildings" / b / "private" / "around"
    row = next(json.loads(l) for l in (d / "index.jsonl").read_text().splitlines() if json.loads(l)["file"] == f)
    e, n = lonlat_to_utm(row["lng"], row["lat"])
    w, h = Image.open(d / f).size
    import math
    vfov = math.degrees(2 * math.atan(math.tan(math.radians(row["fov"] / 2)) * h / w))
    poses.append({"photo": str(d / f), "x": float(e) - oe, "z": on - float(n), "y": 2.5, "yaw": row["heading"],
                  "pitch": row["pitch"], "fov": vfov, "w": w, "h": h, "out": str(OUT / f"_game_{len(poses)}.png")})
subprocess.run(["node", str(OUT / "sv_render.mjs"), json.dumps(poses)], check=True, env={**__import__("os").environ, "PORT": port})
for k, p in enumerate(poses):
    a = Image.open(p["photo"]).convert("RGB")
    g = Image.open(p["out"]).convert("RGB").resize(a.size)
    im = Image.new("RGB", (a.width * 2, a.height))
    im.paste(a, (0, 0))
    im.paste(g, (a.width, 0))
    im.save(OUT / f"sv_{k}.jpg", quality=85)
    Path(p["out"]).unlink()
print("wrote", len(poses))
