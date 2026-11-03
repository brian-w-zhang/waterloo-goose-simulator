# Waterloo Goose Simulator

A browser game: a Canada goose loose on the University of Waterloo main campus, built from open map data and drawn in a flat pastel toon style. Everything you see comes from code and open data (City of Waterloo footprints, Ontario lidar, OpenStreetMap).

## Run it

```bash
npm install                      # Node 24, pinned versions in package-lock.json
uv venv -p 3.12 .venv && uv pip install -p .venv -r pipeline/requirements.txt
npm run pipeline                 # fetch open data into data/raw (once), build public/world (about 40 s)
npm run build && npm start       # http://localhost:3100  (WebGPU, WebGL2 fallback with ?webgl)
```

Controls: WASD move, Shift run (F while running: flap boost), Space honk, G or click grab and drop, C crouch, Q and E turn the camera, mouse wheel zoom. The to-do list sits top left; credits bottom right.

## How it works

- `pipeline/` (Python 3.12): `fetch.py` pulls City layers, OSM API tiles and the 18 lidar tiles (HTTP range requests out of multi-GB zips) and records them in `pipeline/manifest.json`; `build/` makes buildings (City footprints, lidar p90 heights and height tiers), terrain (2 m DTM), ground classes, trees, props, platforms, tufts, the walk network and the far LOD, packed into 70 binary chunks of 256 m (`pipeline/chunkio.py`, format WGC1).
- `src/` (TypeScript, Next.js 16, three.js 0.187 WebGPU, Rapier): chunk streaming and meshing (`world/`), TSL toon materials (`render/`), the goose (`goose/`), the game simulation (`sim/`, headless and deterministic), people, items and the hotspot (`game/`).
- `verify/`, `pipeline/validate/`, `tools/verify/`: the verification harness (`docs/plan/08-verification-and-self-checks.md`). `npm run verify:fast` checks geometry on the packed chunks; `npm run verify:render` then `npm run verify -- <run>` adds the browser suites, style statistics, palette lock, viewpoints, looks scores, contact sheet and self-test. Results go to `bench/results/verify/` and `VERIFY-LEDGER.md`.

Planning documents are in `docs/plan/`; decisions made while building are in `NOTES.md`; the morning review is `REVIEW.md`.
