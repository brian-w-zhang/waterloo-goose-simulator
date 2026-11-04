# Waterloo Goose Simulator

A browser game: a Canada goose loose on the University of Waterloo main campus, built from open map data and drawn in a flat pastel toon style. Everything you see comes from code and open data (City of Waterloo footprints, Ontario lidar, OpenStreetMap).

## Run it

```bash
npm install                      # Node 24, pinned versions in package-lock.json
uv venv -p 3.12 .venv && uv pip install -p .venv -r pipeline/requirements.txt
npm run pipeline                 # fetch open data into data/raw (once), build public/world (about 40 s)
npm run build && npm start       # http://localhost:3100  (WebGPU, WebGL2 fallback with ?webgl)
```

Controls: WASD move, Shift run (F while running: flap boost), Space honk, G grab and drop, C crouch (bow), F flap (tap: a hop; hold: fly up to about 3.5 m for a couple of seconds, steer with WASD, keep holding to glide down, let go to drop), right-drag or Q and E turn the camera, mouse wheel zoom, left-click the ground to teleport there, M campus map (click a place or a spot to teleport), V free camera. The to-do list and clock sit top left, the Menace score top right, credits bottom right.

Optional: `?jev=1` lets the Jev model on the Vercel AI Gateway choose what a character does after giving up a chase. It needs `AI_GATEWAY_API_KEY` in `.env` (read only by the server route `app/api/decide/route.ts`), and falls back to recorded answers and then a deterministic mock.

## How it works

- `pipeline/` (Python 3.12): `fetch.py` pulls City layers, OSM API tiles and the 18 lidar tiles (HTTP range requests out of multi-GB zips) and records them in `pipeline/manifest.json`; `build/` makes buildings (City footprints, lidar p90 heights and height tiers), terrain (2 m DTM), ground classes, trees, props, platforms, tufts, the walk network and the far LOD, packed into 70 binary chunks of 256 m (`pipeline/chunkio.py`, format WGC1).
- `src/` (TypeScript, Next.js 16, three.js 0.187 WebGPU, Rapier): chunk streaming and meshing (`world/`), TSL toon materials (`render/`), the goose (`goose/`), the game simulation (`sim/`, headless and deterministic), people, items and the hotspot (`game/`).
- `art/` (Blender 5.2, headless Python): hand-built models, one script per model in `art/models/`, shared helpers in `art/blender/` (palette colours, bevels, export; `data.py` reads the footprints, lidar tiers and terrain the pipeline writes to `data/build/art/`). `npm run art` (or `npm run art -- name`) exports `public/models/<name>.glb` and `public/models/index.json`; the game loads world models with their chunk and hides the procedural buildings they replace. Needs `npm run pipeline` first, and Blender (`brew install --cask blender`).
- `docs/refs/<ID>/`: openly licensed reference photos (Wikimedia Commons, Mapillary) with `docs/refs/ATTRIBUTION.csv`, per-building notes, and `poses.json` (camera poses estimated from each photo).
- `verify/`, `pipeline/validate/`, `tools/verify/`: the verification harness (`docs/plan/08-verification-and-self-checks.md`). `npm run verify:fast` checks geometry on the packed chunks; `npm run verify:render` then `npm run verify -- <run>` adds the browser suites, style statistics, palette lock, viewpoints, looks scores, contact sheet and self-test. Results go to `bench/results/verify/` and `VERIFY-LEDGER.md`.

## Play and look headlessly

With the production server running (`npm run build && npm start`):

| Command | What it does |
|---|---|
| `node tools/playtest.mjs` | Plays all three hotspots with real key presses, records a video, writes `review/playtest/playtest.json` (`WGS_WEBGL=1` for WebGL2) |
| `node tools/scenario_tug.mjs`, `scenario_hat.mjs`, `scenario_drag.mjs` | Tug-of-war, the hard hat (bow to be dressed), dragging on the Rapier joint |
| `node tools/goose_strip.mjs` | Goose pose strip: idle, walk, run, honk, crouch, flap, swim |
| `node tools/goose_flight.mjs` | Goose flight check: hold F and W, climb to the cap, glide, land; strip and height trace |
| `node tools/gallery.mjs` | Two game-camera angles of every key building |
| `node tools/ref_compare.mjs DC` | Reference photos in `docs/refs/DC/` beside the game rendered from each photo's pose (`review/refs/`) |
| `node tools/map_shot.mjs` | Minimap, map teleport, right-drag camera and ground-click teleport |
| `node tools/npcshot.mjs OUT.png green:prof` | Close-up of one character |
| `node tools/hud_shot.mjs OUT.png x z yaw dist` | The real game page with HUD at a place (`PITCH=` to tilt) |
| `node tools/bench.mjs`, `node tools/firstload.mjs` | Frame time on both backends; bytes before the game is ready |

In the page, `window.__wgs` is the test handle (goose, hotspot state, events, camera, census).

Planning documents are in `docs/plan/`; decisions made while building are in `NOTES.md`; the morning review is `REVIEW.md`.
