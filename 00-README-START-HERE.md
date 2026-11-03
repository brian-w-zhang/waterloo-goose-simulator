# Waterloo Goose Simulator: start here

Entry point for the SE 390 MP3 project context pack: vision, priorities, the doc map, a glossary and the rules a coding agent (Claude Code or similar) must follow in this repo.

Written Nov 2, 2026 (America/Toronto) for the MP3 team (4 people, Nov 5 to Dec 7, 2026, 32 h each, Advanced Technology category). Everything here is research and planning; no code repo exists yet.

## 1. Vision

A browser 3D game of the **entire University of Waterloo main campus as one continuous open world**, built from open map data, where you play a **Canada goose menace**. It plays like a mix of Goat Simulator's sandbox chaos and Untitled Goose Game's stealth pranks with to-do lists, and it looks like Untitled Goose Game: flat, pastel, untextured, faint shadows, a diorama camera. Not level-based. Not photoreal.

The engineering story behind the goose: **a reproducible compiler from open GIS data (OSM, City of Waterloo footprints, Ontario lidar) to a stylised, physics-enabled, NPC-populated world that runs in a browser**, validated against ground truth and benchmarked, with an optional cheap AI decision layer for NPCs that is measured against a deterministic baseline.

## 2. Priorities

1. **World and map first.** Accurate, reproducible, whole-campus geometry from open data, running smoothly in the browser. See [01-data-sourcing.md](01-data-sourcing.md) and [02-graphics-approach.md](02-graphics-approach.md).
2. **Simulation second.** Students, staff and geese with state machines, perception and memory; optionally Jev (TypeSafe AI's evaluation model on the Vercel AI Gateway) for cheap, async, batched decisions, always with a deterministic fallback and never per frame. See [05-simulation-and-npc-design.md](05-simulation-and-npc-design.md).
3. Then the game layer: verbs, items, tasks, Menace score. See [03-untitled-goose-game-deep-dive.md](03-untitled-goose-game-deep-dive.md) and [04-goat-simulator-and-other-games.md](04-goat-simulator-and-other-games.md).

Out of scope: reusing Arcade; building on Brian's other projects (askjev contributes only knowledge about Jev).

## 3. Doc map

| File | Read it for |
|---|---|
| [01-data-sourcing.md](01-data-sourcing.md) | Every data source with endpoints, queries, licences, real counts, gotchas, the build pipeline and validation metrics |
| [02-graphics-approach.md](02-graphics-approach.md) | Procedural vs hand-modelled vs hybrid; the three.js r187 TSL toon recipe; palette; tag-to-style rules; performance budget |
| [03-untitled-goose-game-deep-dive.md](03-untitled-goose-game-deep-dive.md) | How UGG works (verbs, items, villagers, AI states, tasks, camera, music) and numbered requirements (R-W, R-G, R-I, R-N, R-T, R-C, R-S, R-X) |
| [04-goat-simulator-and-other-games.md](04-goat-simulator-and-other-games.md) | Feature menu rated by effort and fun; the Menace combo score |
| [05-simulation-and-npc-design.md](05-simulation-and-npc-design.md) | Agent tiers, FSMs, perception, memory, navigation; Jev architecture, costs and risks |
| [06-architecture-and-milestones.md](06-architecture-and-milestones.md) | Stack, repo layout, MP3 milestones with acceptance tests, benchmark harness, risks, open questions |
| [07-licences-and-prior-art.md](07-licences-and-prior-art.md) | Data and code licences, attribution text, UGG IP lines, prior art and novelty |
| [08-verification-and-self-checks.md](08-verification-and-self-checks.md) | Ground truth, automated geometry and look checks, style gates, the verification loop and pitfalls |
| [GOAL-PROMPT.md](GOAL-PROMPT.md) | The overnight /goal prompt for Claude Code |
| [data-samples/README.md](data-samples/README.md) | Real extracts of every layer (about 3 MB) with provenance |
| [snippets/toon-recipe.mjs](snippets/toon-recipe.mjs) | The toon material, fog, lights and AO code from doc 02 |
| [research/README.md](research/README.md) | Earlier memos (copied unedited), course constraints, raw evidence |
| [research/course-constraints.md](research/course-constraints.md) | Dates, weights, rubric and AI rules from the course guide |

## 4. Folder tree

```
waterloo-goose-simulator/
  00-README-START-HERE.md
  01-data-sourcing.md
  02-graphics-approach.md
  03-untitled-goose-game-deep-dive.md
  04-goat-simulator-and-other-games.md
  05-simulation-and-npc-design.md
  06-architecture-and-milestones.md
  07-licences-and-prior-art.md
  08-verification-and-self-checks.md
  GOAL-PROMPT.md
  data-samples/
    README.md
    city-of-waterloo/   cow_building_footprints_campus.geojson, cow_trees_existing.geojson,
                        cow_trails.geojson, cow_waterbodies.geojson, cow_creeks.geojson
    imagery/            ortho_village1_2026spring_0p5m.jpg
    ontario-lidar/      dtm_campus_4m_u16.png, dtm_campus_4m_u16.json,
                        ndsm_campus_2m_preview.png, uw_building_heights.csv
    osm/                uw_main_campus_boundary.geojson, overpass_count_uw_relation.json,
                        osm_uw_buildings_in_campus_relation.json, osm_named_buildings_sample.geojson,
                        osm_walkways_core_sample.geojson, osm_water_parking_transit.geojson
    queries/            uw_count.overpassql, uw_buildings.overpassql, uw_walkways.overpassql,
                        uw_landcover_water.overpassql, arcgis_counts.sh, lidar_heights.py
  snippets/
    toon-recipe.mjs
  research/
    README.md
    course-constraints.md
    guide.txt
    goose-game-research.md
    slop-newyork-teardown.md
    mp3-ideas.md
    mp3-wow-ideas.md
    mp3-viral-x-ideas.md
    raw/
      slop-cities-screenshots-contact.jpg
      cow-uw-buildings-attrs.json
      goose/            repos.tsv, libs.tsv, ugg_1.jpg to ugg_6.jpg, wiki_*.txt, s_*.json
      x2/               all.tsv, verified.json
```

## 5. Key facts at a glance

- Campus: OSM relation 11680616, 400.4 ha over 7 polygons; game bbox S 43.4630, W -80.5600, N 43.4790, E -80.5310 (about 2.3 x 1.8 km), built in EPSG:26917.
- 480 City building footprints in the core bbox, 115 owned by UW; OSM has 427 building elements inside the campus relation.
- Lidar: 9 tiles of 0.5 m DSM and DTM (OMAFRA Lidar 2016-18, 2018 vintage), pulled out of multi-GB zips with HTTP range requests; terrain relief about 31 m.
- City vs OSM footprints: median IoU 0.806. Tag-based heights miss lidar by 10.8 to 12.2 m RMSE, so heights come from lidar.
- 3,044 walkable or drivable OSM ways (192 km) in the game bbox, only 44 with a width tag.
- Jev: $0.042 per 1M input tokens, output free, p50 383 ms and p95 727 ms (askjev measurements), 1,200 requests per minute.

## 6. Glossary

| Term | Meaning |
|---|---|
| UGG | Untitled Goose Game (House House, 2019) |
| Enclosure | A dense, hand-tuned play area inside the open world (a quad, a plaza), following UGG's enclosure principle |
| Chunk | A 256 m square tile of the world, the unit of streaming and baking |
| nDSM | Normalised digital surface model: DSM minus DTM, height above ground |
| DSM, DTM | Digital surface model (top of everything) and digital terrain model (bare earth) |
| IoU | Intersection over union of two footprints; 1 is a perfect match |
| p90 height | The 90th percentile of nDSM pixels inside a footprint, used as roof height |
| ODbL | Open Database Licence, OSM's licence |
| OGL Ontario | Open Government Licence, Ontario |
| TSL | three.js Shading Language: node-based shaders that compile to WGSL (WebGPU) or GLSL (WebGL2) |
| Tier A, B, C | Smart NPCs, ambient students, virtual off-screen population (doc 05) |
| Menace score | The combo scoring system (doc 04) |
| Jev | TypeSafe AI's evaluation model (`typesafe-ai/jev`) returning choices, scores and probabilities |
| askjev | Brian's MP1 project built on Jev; source of the Jev facts here |
| Fallback | The deterministic rule that decides when Jev is off, slow or unsure |
| NYB1 | Slop New York's binary world format, the model for our chunk packer |

## 7. Rules for the coding agent

These apply to any AI coding agent working in the project repo. They come from the course guide (section 11) and from this plan.

### Process

1. **Work milestone by milestone** ([06-architecture-and-milestones.md](06-architecture-and-milestones.md)). Do not start a later milestone's features before the current milestone's acceptance tests pass.
2. **Small, reviewable commits.** One concern per commit. A human reviews every change before it merges.
3. **Commit trailer, every AI-assisted commit**: `Assisted-by: AGENT_NAME:MODEL_VERSION [TOOLS]`, for example `Assisted-by: Claude:claude-opus-4-5`. Never `Co-authored-by:` or `Generated-by:` for AI. **Never add `Signed-off-by:`**; only a human can.
4. **Do not annotate source files** with AI notices. Provenance lives in commit trailers and `AI-USE.md`.
5. **Keep `AI-USE.md` current** at the repo root: tools, what they are used for, how generated code is reviewed. Update it when practice changes.
6. **Never fabricate**: no invented APIs, versions, citations or data. If unsure whether a three.js, Rapier or Recast API exists, check the installed package source.

### Tests and evidence

7. **Every feature ships with a test**: unit tests for logic (FSM, combo maths, decoder), headless sim tests for behaviour (no GPU), pipeline validation for data.
8. **Screenshots for every visual change**: run the Playwright visual suite, attach before and after screenshots to the PR, and keep the style checks (saturation, value, palette) green.
9. **Benchmarks are artefacts**: any performance or fidelity claim must point at a JSON file in `bench/results/`.
10. **Determinism**: the sim must reproduce from a seed and an input log. Tests never call the network; Jev calls are replayed from recordings.

### Code rules

11. Colours only from `config/palette.json`. Constants (bbox, origin, widths, sources) only in `config/campus.json`.
12. The renderer must work on both WebGPU and WebGL2 backends; no compute-only features in the core path.
13. Never call a model per frame or block the game on a network call. The Jev API key never reaches the client.
14. Keep raw data out of git; the pipeline must rebuild from source URLs and the manifest.
15. Tone: slapstick only, nobody hurt, no police, no real people (doc 04 section 4.3).
16. IP: no UGG or Goat Simulator assets, names, UI art, fonts or recordings (doc 07 section 3). Record any third-party code in `THIRD_PARTY.md`.
17. Attribution text from doc 07 must appear in the game's credits.

## 8. Things to correct in earlier framing

- **Jev is not Brian's project.** It is TypeSafe AI's model. Brian's MP1 project is **askjev**, which is built on Jev and says "Not affiliated with TypeSafe" (https://github.com/brian-w-zhang/askjev README). The Jev ids `typesafe-ai/jev`, `jev-1.13.0` and `jev-1.14.0` are Vercel AI Gateway model ids, not GitHub repos.
- The earlier memo [research/goose-game-research.md](research/goose-game-research.md) estimates the campus bbox at about 1.7 x 1.4 km; this pack uses a slightly larger game bbox of about 2.3 x 1.8 km to include Columbia Lake's edge and the ION line.
- The earlier memo lists the UGG fan wiki and the JSMG music paper as unverified (403). Both are now covered: the wiki through its MediaWiki API, the music paper through the DiGRAA 2020 extended abstract.
- The earlier memo marks the Ontario lidar licence as unverified; it is the Open Government Licence, Ontario (data.ontario.ca).

## 9. Unverified items (collected)

- Full text of the Waterloo Open Data User Licence, and whether City orthophotos are covered.
- UW Open Data API terms and how API keys are issued.
- Units of the lidar `VerticalAccuracy` 5 field.
- GRT GTFS validity dates (from the Mobility Database listing, not unzipped).
- WebGPU browser support per OS (secondary sources; check caniuse and the gpuweb implementation status page at build time).
- Whether TypeSafe's terms allow Jev as an NPC brain in a public game (askjev's reading: label AI output; section 2.3(a) bans a standalone Jev service; ask TypeSafe).
- The exact `criteria` format of Jev choice questions (only askjev's notes were used).
- Style-class abbreviation lists in doc 02 section 6 (my guesses; confirm against imagery).
- OSM counts from the Overpass mirror are from data 3 to 4 months old.
- Garry's Mod sales figure (search summary only).

AID statement: Grok Bot (AI agent) collected the data, ran the measurements and drafted this pack on Nov 2, 2026 (information collection, data analysis, writing). Counts, versions and API shapes were checked against live endpoints, npm and source files the same day; items not checked are listed in section 9.
