"""Build art models: npm run art [-- name ...]  (blender -b --python-exit-code 1 -P art/build.py -- ...)

Each art/models/<name>.py defines build() that creates its objects in an empty scene (and any
actions); the result is exported to public/models/<name>.glb. With no names, every model is built.

A model may set META = {"world": True, "replaces": [City OBJECTID, ...]}: world models are authored
in world metres (Blender X east, Y north from the campus origin) and listed in public/models/index.json
with the chunk that holds their centre; the game hides the procedural buildings they replace.
"""
import importlib.util
import json
import sys
import time
from pathlib import Path

ART = Path(__file__).resolve().parent
sys.path.insert(0, str(ART / "blender"))
import lib  # noqa: E402

OUT = lib.ROOT / "public" / "models"


WORLD_INDEX = json.loads((lib.ROOT / "public" / "world" / "index.json").read_text())


def chunk_of(objs):
    xs = [(o.matrix_world @ v.co) for o in objs if o.type == "MESH" for v in o.data.vertices]
    cx = (min(v.x for v in xs) + max(v.x for v in xs)) / 2
    cy = (min(v.y for v in xs) + max(v.y for v in xs)) / 2
    W = WORLD_INDEX
    i = int((cx + W["origin"]["e"] - W["grid_origin_e"]) // W["chunk_size"])
    j = int((cy + W["origin"]["n"] - W["grid_origin_n"]) // W["chunk_size"])
    return f"{i}_{j}"


def run(name):
    spec = importlib.util.spec_from_file_location(name, ART / "models" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    lib.clear()
    t0 = time.time()
    objs = mod.build()
    meta = getattr(mod, "META", {})
    entry = {"name": name, "chunk": chunk_of(objs), "replaces": meta.get("replaces", [])} if meta.get("world") else None
    out = lib.export(OUT / f"{name}.glb", objs)
    print(f"[art] {name}: {out.stat().st_size / 1024:.0f} KB in {time.time() - t0:.1f}s")
    return entry


def write_index(entries):
    """Merge into public/models/index.json (a partial build keeps the other models' entries)."""
    p = OUT / "index.json"
    old = json.loads(p.read_text()) if p.exists() else {"models": []}
    models = {m["name"]: {**m, "replaces": old.get("_replaces", {}).get(m["name"], [])} for m in old.get("models", [])}
    for name, e in entries.items():
        if e:
            models[name] = e
        else:
            models.pop(name, None)
    models = {n: m for n, m in models.items() if (OUT / f"{n}.glb").exists()}
    idx = {"models": [{"name": m["name"], "chunk": m["chunk"]} for m in models.values()],
           "buildings": {str(o): m["name"] for m in models.values() for o in m.get("replaces", [])},
           "_replaces": {m["name"]: m.get("replaces", []) for m in models.values()}}
    p.write_text(json.dumps(idx, indent=1))


args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
names = args or sorted(p.stem for p in (ART / "models").glob("*.py") if not p.stem.startswith("_"))
write_index({n: run(n) for n in names})
