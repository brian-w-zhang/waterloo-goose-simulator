"""Game top-down render of a chunk next to the 2025 summer ortho of the same square:
.venv/bin/python -m review.trees.pair i j GAME.png OUT.jpg"""
import json
import sys
from pathlib import Path

from PIL import Image

from review.trees.overlay import ROOT, ortho

i, j, game, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
idx = json.loads((ROOT / "public" / "world" / "index.json").read_text())
s = idx["chunk_size"]
e0, n0 = idx["grid_origin_e"] + i * s, idx["grid_origin_n"] + j * s
o = ortho("2025summer", e0, n0, s, s / 1024).resize((1024, 1024))
g = Image.open(game).convert("RGB").resize((1024, 1024))
im = Image.new("RGB", (2048, 1024))
im.paste(g, (0, 0))
im.paste(o, (1024, 0))
im.resize((1600, 800)).save(out, quality=85)
