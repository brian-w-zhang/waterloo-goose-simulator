# 06 Architecture and milestones

Stack, repository layout, runtime architecture, weekly milestones for MP3 (Nov 5 to Dec 7, 2026) with acceptance tests, the benchmark harness, risks and open questions.

Budget: 128 team-hours (4 people x 32 h) including meetings, playtests, slides and video ([research/course-constraints.md](research/course-constraints.md)). The milestone estimates below sum to about 108 h, leaving about 20 h for meetings, peer critiques and slack.

## 1. Stack

| Layer | Choice | Version checked Nov 2, 2026 | Why |
|---|---|---|---|
| Language | TypeScript (game, server), Python 3.12 (data pipeline) | | GIS tooling is best in Python (shapely, pyproj, rasterio); game in TS |
| Bundler and dev server | Vite | 8.3.5 | Fast, standard for three.js |
| Renderer | three.js `WebGPURenderer` with automatic WebGL2 fallback, TSL materials | three 0.187.0 (MIT) | WebGPU preferred; fallback covers Linux and Firefox gaps |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | 0.21.0 (Apache-2.0) | Character controller, joints, WASM |
| Navigation | `recast-navigation` and `@recast-navigation/three`; `navcat` as a pure-JS alternative | 0.44.0 (MIT); 0.4.1 (MIT) | Navmesh plus Detour crowd |
| Spatial queries | `three-mesh-bvh` | 0.9.18 (MIT) | Vision rays, camera occlusion |
| Steering reference | `yuka` | 0.7.8 (MIT, last release 2022) | Flocking, FSM reference |
| Audio | Web Audio API directly | | Stem scheduler, per-surface sounds |
| UI | Plain DOM and SVG overlays (to-do list, marks) | | No framework needed for MP3 |
| Tests | A unit test runner (Vitest is the usual Vite choice; version not checked), Playwright for headless screenshots (version not checked) | | Behaviour tests, screenshot diffs |
| Pipeline deps | shapely, pyproj, rasterio, pyshp, remotezip, pillow, osmium (pyosmium) | used Nov 2 except osmium | Proven in this research |
| Hosting | Vercel static site plus one Vercel Function (`/api/decide`) for Jev | | Same platform as the AI Gateway |
| Jev access | Plain `fetch` to `https://ai-gateway.vercel.sh/v1/evaluate` from the server | | The evaluate endpoint is not a chat or generate call; askjev uses a server-only proxy |

## 2. Repository layout

```
waterloo-goose-simulator/
  AI-USE.md                 tools, what for, how generated code is reviewed (course rule)
  README.md                 how to build the world and run the game
  DESIGN.md                 goose plausibility rule, tone rules, task grammar
  config/
    campus.json             bbox, origin, CRS, chunk size, source URLs and pinned dates
    palette.json            the only allowed colours
    style-rules.json        tag to style class table (doc 02 section 6)
    overrides/              per-building overrides keyed by City BLDG_ABBREV
  pipeline/                 Python: fetch, clip, terrain, buildings, network, landcover, props, pack, validate
    requirements.txt        pinned
    manifest.json           written by fetch: url, fetched_at, osm_base, sha256 per input
  data/
    raw/                    gitignored cache of downloads
    build/                  gitignored outputs
  public/world/             packed chunks served to the game (gitignored, built in CI or by script)
  src/
    main.ts
    render/                 renderer setup, materials (TSL), camera, occlusion fade
    world/                  chunk streaming, binary decoder, terrain, buildings, props
    physics/                Rapier world, goose controller, grab joints
    goose/                  verbs, input, procedural neck and legs
    ai/                     tiers, FSMs, perception, memory, scheduler, Jev client, fallback
    nav/                    navmesh loading, crowd, pedestrian graph A*
    tasks/                  task data, evaluator, to-do UI
    audio/                  sounds, music scheduler
    bench/                  benchmark harness (section 5)
  api/decide.ts             Vercel Function: Jev proxy with cache and limits
  tests/
    unit/                   FSM, perception, task evaluator, decoder
    sim/                    headless scenario tests (no GPU)
    visual/                 Playwright screenshots and style checks
```

Keep raw data out of git (slop-zurich's repo is about 130 MB, the warning example). The build must be reproducible from `config/campus.json` and the manifest.

## 3. Runtime architecture

- **World streaming**: 256 m chunks over the 2.3 x 1.8 km bbox (about 9 x 7 = 63 chunks). Each chunk file holds terrain heights, merged building geometry per style class, path ribbons, prop instances, navmesh tile and metadata. Load the 3 x 3 around the goose at full detail, the next ring at low detail, and the rest as a single far-LOD mesh of extruded boxes.
- **Binary format** (in the spirit of slop-newyork's NYB1, see [research/slop-newyork-teardown.md](research/slop-newyork-teardown.md)): magic, version, chunk header, string table, then typed arrays (Float32 positions relative to chunk origin, Uint16 or Uint32 indices, Uint8 style class, Uint16 building id). Brotli on the host.
- **Sim loop**: fixed 30 Hz simulation, 60 Hz physics, render at display rate with interpolation. One `World` state object, seeded PRNG streams, event bus (honks, item events, task events).
- **AI scheduler**: tiers and LOD (doc 05 section 2); Jev requests async through `/api/decide` with fallback first.
- **Debug overlay**: FPS, frame time p95, draw calls, triangles, physics and AI ms, active NPC counts by tier, Jev requests in flight and cache hit rate, plus vision cone and navmesh visualisation toggles. This overlay is the demo of the "Advanced Technology" part.

## 4. Milestones (MP3)

Dates in America/Toronto. Each milestone ends with a tagged build, screenshots and a short changelog.

### M0 (Nov 5 to 8): set-up and spikes, about 12 h

- Repo, `AI-USE.md`, kanban board, meeting schedule (2 per week), CI running unit tests.
- Spike 1: three.js r187 WebGPU scene with the toon recipe ([snippets/toon-recipe.mjs](snippets/toon-recipe.mjs)) on all 4 teammates' machines; note which fall back to WebGL2.
- Spike 2: pipeline fetches the 9 lidar tiles and City footprints from scratch on a clean machine.
- Abstract (`abstract.md`) drafted; due Mon Nov 9.

Acceptance: CI green; screenshots from every teammate's browser with the backend logged; lidar and footprints fetched by script.

### M1 (Nov 9 to 15): the world, greybox, about 26 h

- Pipeline end to end: terrain (2 m), buildings (City footprints conflated with OSM, lidar heights), water, path ribbons, trees, props, packed chunks.
- Game loads chunks and streams around a free camera.
- Goose greybox: Rapier kinematic controller walking on terrain and paths; follow camera with occlusion fade.

Acceptance tests:
- All 115 UW-owned City footprints exist in the build (count test).
- Height RMSE vs lidar p90 under 2 m on the held-out set of 20 buildings built before 2018 (validation step).
- Footprint IoU report generated; buildings under 0.5 flagged in a review list.
- Walk the goose from DC to SLC to the Village 1 ring without falling through terrain (scripted sim test).
- First frame under 10 MB transferred; p95 frame time logged on the iGPU laptop.

### M2 (Nov 16 to 22): the goose and the first enclosure, about 26 h

- Five verbs, grab joints, drag sounds, honk with the mix rule.
- Toon style pass: palette locked, style rules, landmark overrides for 3 to 5 buildings.
- Enclosure 1 (suggest the DC and MC courtyard or the SLC and PAC plaza): 30 or more interactable items, 5 smart NPCs with the full FSM, ambient students on the pedestrian graph.
- Item system and tidy-up.

Acceptance tests:
- Headless behaviour tests: noticed-in-cone, honk-heard-investigate, close-honk-drops-item, chase-if-owner, give-up-after-timeout, tidy-returns-item (100% pass).
- Style checks: frame mean saturation 0.18 to 0.35, mean value 0.45 to 0.65; no off-palette colours outside goose and UI.
- 5 smart NPCs plus 200 ambient at p95 under 16.7 ms on the iGPU laptop.

### M3 (Nov 23 to 29): tasks, score, playtests, about 22 h

- To-do list for enclosure 1: 6 tasks plus a gating task, each with 2 solution paths documented and 1 tested headlessly.
- Menace combo score (doc 04 section 4) and the debug overlay.
- Class-change waves from the bell schedule.
- **First external playtest** (at least 5 people outside the team) by Nov 26; notes in the repo; at least 2 changes made because of it.
- Mid-MP3 check-in Thu Nov 26 (request one if not invited).
- Optional: Jev decision layer behind a flag with record and replay.

Acceptance tests:
- Every task completes in a scripted run.
- Combo maths unit tests (variety multiplier, repeat decay, bail).
- 30 smart NPCs plus 500 ambient: p95 frame time measured on 3 devices and both backends.
- With the Jev flag on: no frame over 33 ms caused by AI; 0 requests from the client with a key; fallback-only run plays identically from a seed.

### M4 (Nov 30 to Dec 7): polish, measurements, presentation, about 22 h

- Second playtest round; fix the top 3 issues.
- Benchmark runs and the results slide: fidelity (IoU, height RMSE), performance (frame time, draw calls, load size), AI (agent counts, ms per tick; Jev latency, cost and A/B result if built).
- Slides (5 to 8) covering problem, results, organisation, AI use, lessons, peer critique responses, IP.
- 5-minute video on private YouTube; slides in GitLab and video link in the sign-up sheet by end of Mon Dec 7. Reviews Tue Dec 8.

Acceptance: video under 5:00; every teammate appears; every claim on the results slide has a benchmark artefact in the repo.

### Stretch (SE 490)

Whole-campus enclosures, interiors through the tunnel network, adaptive music, co-op, nesting season mode, gaggle recruitment, ION and bus rides, seasonal palettes, public build with budgets.

## 5. Benchmark harness

- `src/bench/` runs **scripted camera and goose paths** (recorded input files) over fixed seeds, for 60 s each, in headless Chrome via Playwright and on real devices via a `?bench=` URL flag.
- Records per frame: CPU frame time, GPU time where the backend exposes timestamps, draw calls and triangles (`renderer.info`), physics step ms, AI ms, NPC counts by tier, Jev in flight. Outputs JSON plus a summary (p50, p95, p99).
- **Sweeps**: ambient NPCs 100, 250, 500, 1,000; smart NPCs 10, 20, 30, 50; awake rigid bodies 50, 100, 200; backends WebGPU and WebGL2; render scale 0.75 and 1.
- **Fidelity suite** (pipeline): IoU distribution vs City footprints, height RMSE and MAE vs lidar p90 on a held-out set, coverage of UW-owned buildings, entrance reachability on the walk graph.
- **Comparison baselines** (the handbook's "compare to alternatives"): OSM-only extrusion (levels x 3.5 m) vs our lidar heights; fallback-only NPCs vs Jev-assisted; Recast vs navcat bake and query times.
- Results committed under `bench/results/<date>-<device>.json` so the slides cite files, not memories.

Reference devices: one Intel iGPU laptop (Iris Xe class), one Apple M-series laptop, one discrete GPU desktop. Record exact models, browser versions and backends.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 128 h is small for a whole campus plus a game | High | High | Whole campus is procedural (cheap); hand work only in 1 enclosure for MP3 |
| The fun gap: accurate campus is sparse | High | High | Enclosures, Menace score, mutator hunts; playtest by Nov 26 |
| Camera and occlusion around tall buildings | Medium | High | Prototype in M1; dither-fade plus goose silhouette |
| WebGPU gaps on teammates' Linux or Firefox | Medium | Medium | WebGL2 fallback tested in CI; no compute-only features in the core |
| TSL shader regressions from AI-generated code | Medium | Medium | Screenshot diffs and style checks in CI |
| Overpass outages and stale mirrors | High (seen today) | Low | Geofabrik plus osmium for builds; OSM API for small refreshes |
| Lidar is from 2018 | Certain | Low | Tag fallback for newer buildings; re-check the 2025 DEDSFM release |
| Licence missteps (imagery, UW API, UGG trade dress) | Medium | High | [07-licences-and-prior-art.md](07-licences-and-prior-art.md); imagery not shipped; own art and music |
| Jev latency, cost, terms | Medium | Low (optional) | Fallback-first, budgets, ask TypeSafe before public launch |
| Team members land on different stacks | Low | Medium | One repo, one style guide, agent rules in [00-README-START-HERE.md](00-README-START-HERE.md) |

## 7. Open questions

1. Which enclosure first: DC and MC courtyard (iconic for SE students) or SLC and PAC plaza (busiest, food trucks)?
2. Free camera yaw or UGG-style fixed angles per area?
3. Game time scale: how many real minutes per game hour?
4. Use the UW Open Data API for real class schedules (needs an API key and a terms check) or a synthetic timetable from the slot table?
5. Is Jev in scope for MP3, or an SE 490 experiment? It is only worth it with the A/B evaluation.
6. Who is the external expert for the A+ "positive mention" (a games or GIS professional, a UW faculty member in graphics or GIS)?
7. Public deployment for viral reach, or private for MP3? Affects licences, budgets and the Jev terms question.
