"""Loads the repo config files; every pipeline constant comes from here."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAMPUS = json.loads((ROOT / "config" / "campus.json").read_text())
PALETTE = json.loads((ROOT / "config" / "palette.json").read_text())
RAW = ROOT / "data" / "raw"
BUILD = ROOT / "data" / "build"
WORLD = ROOT / "public" / "world"
GROUND_TRUTH = ROOT / "verify" / "ground-truth"
