# GOAL-PROMPT: overnight /goal for Claude Code

The self-contained prompt Brian pastes into Claude Code as a long-running /goal for Waterloo Goose Simulator; everything below the line is addressed to the coding agent.

---

You are building **Waterloo Goose Simulator** overnight, alone, with no human available until morning. Work autonomously in small verified increments. Never stall waiting for a person. Never invent data. Never fake a check.

## 1. Mission

Build a browser 3D game of the **whole University of Waterloo main campus as one continuous open world**, where the player is a Canada goose menace. It must be **geometrically accurate to real Waterloo maps** (footprints, heights, distances, paths, terrain, water, landmark positions) and **look like a recognisable campus drawn in the Untitled Goose Game style**: flat pastel colours, no textures, no ink outlines, faint soft shadows, a high narrow-FOV diorama camera. All graphics come from code and open data. Accuracy and looks are proven by an automated verification harness you build first and run every increment.

## 2. Executive decisions (already made; do not relitigate)

| # | Decision | Status | Rationale |
|---|---|---|---|
| 1 | Graphics are code-generated: procedural toon geometry and TSL materials from the data; the goose built from code primitives (capsules, lathe) with procedural neck and leg IK. Hand-made models only for 3 to 5 landmark overrides if time remains, authored as code or small glTF you write. No AI-generated meshes, no texture files beyond tiny palette, LUT or noise textures | Firm | Only code scales to about 500 buildings reproducibly, and UGG's look comes from shapes, palette and animation, not textures |
| 2 | The engine is not handwritten: three.js `WebGPURenderer` (r187, WebGL2 fallback) for rendering, Rapier for physics, recast-navigation for the navmesh (navcat is the pure-JS alternative to benchmark). You write only the world pipeline, chunk streaming, style system, goose controller and NPC AI | Firm (navmesh library revisitable after a benchmark) | Engines are solved problems; the novel work is the data-to-world compiler |
| 3 | The world pipeline is Python and produces packed binary chunks (256 m tiles); accuracy is validated against City footprints, lidar and the ground-truth set | Firm (binary layout revisitable) | GIS tooling is best in Python; binary chunks stream fast; validation is the project's evidence |
| 4 | Open world, no levels. "Enclosures" are only dense hotspots of interactables inside the continuous world | Firm | The pitch is the whole campus; UGG density lives in hotspots |
| 5 | NPC AI is deterministic state machines first. Jev (TypeSafe AI's evaluation model on the Vercel AI Gateway `/v1/evaluate` endpoint) is optional, asynchronous, cached, behind a flag, through a server-side proxy only | Firm on deterministic primary; Jev scope revisitable | The game must be playable, testable and reproducible offline; the model is a measured extra |
| 6 | Benchmarks are first-class (doc 06 section 5): every performance or fidelity claim points to a JSON file in `bench/results/` | Firm | The course rewards measured results compared with alternatives |
| 7 | Verification comes first: the doc 08 harness is your first milestone and runs at the end of every increment | Firm | Without it neither you nor Brian can tell progress from drift |

Correction to carry everywhere: **Jev is TypeSafe AI's model, not Brian's.** Brian's MP1 project askjev is built on Jev and is not affiliated with TypeSafe.

## 3. Read first, in this order

The planning pack is at `docs/plan/` (if it is not there, search the repo for `00-README-START-HERE.md`; if it is absent, log a blocker and proceed from this prompt alone). Read fully before writing code:

1. `00-README-START-HERE.md`: vision, glossary, the agent rules (they bind you).
2. `08-verification-and-self-checks.md`: the harness, gates, thresholds, ledger, anti-reward-hacking rules. This is your definition of done.
3. `01-data-sourcing.md`: sources, endpoints, gotchas, pipeline steps.
4. `02-graphics-approach.md` and `snippets/toon-recipe.mjs`: the toon recipe, palette, style rules, performance budget.
5. `06-architecture-and-milestones.md`: stack, repo layout, milestones, benchmark harness.
6. `05-simulation-and-npc-design.md`, `03-untitled-goose-game-deep-dive.md`, `04-goat-simulator-and-other-games.md`: P2 design.
7. `07-licences-and-prior-art.md`: licences, attribution text, UGG IP lines.
8. `data-samples/README.md` and `data-samples/ground-truth/`: real extracts and the frozen ground truth.

9. Course context (read after the list above, skim for what applies, do not copy it into the repo): `docs/plan/research/se390-mp2-notion-page.md` (a local copy of Brian's Notion page "SE 390 MP2", with the MP2 deadlines, the grading breakdown, the AI-use policy and the deliverables), `docs/plan/research/course-constraints.md` (what the SE 390 course rules mean for this build), and `docs/plan/research/guide.txt` (the full SE 390 course guide v1.2, which is authoritative if anything conflicts). If a Notion connector is available, the live pages are https://app.notion.com/p/40dd23b11b0481f59c9ffe691703220e (SE 390 MP2) and https://app.notion.com/p/e8d45efbaf8c47489cbb46b100dacf4a (the full course guide). Background only: `docs/plan/research/goose-game-research.md` and `docs/plan/research/slop-newyork-teardown.md` (how the reference projects were built).

The course context decides **how the work is judged** (the category is Advanced Technology: measured results, comparison against alternatives, and the AI-use policy with the `Assisted-by` trailer and `AI-USE.md`), not **what to build**. What to build is this prompt and the planning pack.

When a doc and this prompt disagree, this prompt wins; log the disagreement in `NOTES.md`.

## 4. Scope tonight: a working MVP first

The target for tonight is a **playable, verified MVP**, not a feature-complete game: the real campus map loads from the pipeline, looks like the Untitled Goose Game style, and a goose walks around it with a follow camera while every P1 gate is measured and reported. Depth beats breadth. A smaller world that is accurate and verified beats a bigger one that is not. If you must cut, cut P2 content first, then the number of chunks, and never the verification harness.

**Out of scope tonight (Brian does these later, do not start them):** the MP2 slides, the 5-minute narration script, the YouTube video, the abstract and the peer critiques. Do keep the facts those will need (benchmarks in `bench/results/`, the ledger, `AI-USE.md`, the commit trailers), because the slides and script will be built from them afterwards.

## 5. Order of work

### Priority 1: world, map, verification, look, movement

Do these in order. Each step ends with `npm run verify:fast` green and a commit.

1. **V0, the harness** (doc 08 section 4.1). Scaffold the repo (section 6), copy `data-samples/ground-truth/` to `verify/ground-truth/` with `SHA256SUMS`, implement the Python validators and npm scripts from doc 08 section 4.5 against a stub world (a few City footprints extruded), the ledger, the gate, the contact sheet and `verify:selftest` with every mutant failing. Calibrate and freeze the 20 viewpoint poses; measure and freeze the starting-value thresholds in `verify/thresholds.json`.
2. **M0 spikes** (doc 06): three.js 0.187.0 scene with the toon recipe on both backends (`forceWebGL: true` for WebGL2), backend logged; pipeline fetches the 9 lidar tiles (HTTP range requests with `remotezip`) and the City footprints from scratch.
3. **Pipeline end to end** (doc 01 section 9): fetch with a manifest, clip and project to EPSG:26917 with local origin 536000 E, 4813000 N, terrain at 2 m, buildings (City footprints conflated with OSM ways and relations, parts, lidar p90 heights, post-2018 detector), water, path ribbons, trees, props, pack per 256 m chunk. Geometry gates of doc 08 section 2.1 green.
4. **Streaming and rendering**: chunk decoder, 3 x 3 full detail plus far LOD, toon materials from `config/palette.json` and `config/style-rules.json`, baked AO as vertex colour, fog, faint shadows following the camera. Top-down (2.2) and fly-through (2.3) gates green.
5. **Free-fly camera and goose walking**: free-fly debug camera; greybox goose from primitives with a Rapier kinematic controller on terrain and paths; UGG-style follow camera with occlusion dither-fade. The doc 06 M1 walk test (DC to SLC to Village 1) passes.
6. **Style pass**: doc 08 section 3 gates green on the 20 game-camera renders; viewpoint renders and your scored `looks.json`; review pack produced.

### Priority 2: the game layer (only after every P1 gate is green and the review pack exists)

1. Goose verbs: honk, grab and drag (Rapier joint), crouch, flap, run; procedural neck and legs.
2. Items: the doc 03 R-I1 schema, a first set of 30 interactables in one hotspot (DC and MC courtyard or SLC and PAC plaza), ownership and home positions.
3. NPCs: the doc 05 hierarchical FSM with perception and memory; 5 smart NPCs plus ambient walkers on the OSM pedestrian graph; the doc 06 M2 headless behaviour tests.
4. Optional Jev layer behind `?jev=1` (off by default): `api/decide.ts` server proxy, cache, deadline, fallback-first, record and replay. If `AI_GATEWAY_API_KEY` is not set, build only the recorded and mock paths and say so.

P1 gates must stay green while you do P2. A P2 change that breaks a P1 gate is reverted.

## 6. Repo layout

Use doc 06 section 2, plus:

```
verify/ground-truth/        frozen copy of data-samples/ground-truth/ + SHA256SUMS
verify/thresholds.json      frozen gates and measured starting values
verify/viewpoints.calibrated.json
verify/exceptions.yaml      accepted regressions (never on holdout metrics)
verify/cache/               gitignored: reference photos, orthophoto clips
pipeline/validate/          geometry.py heights.py terrain.py network.py topdown_compare.py
tools/verify/               style_stats.py palette_check.py validate_looks.py contact_sheet.py gate.py selftest.py check_colours.ts check_banned.ts
tests/visual/               topdown, flythrough, viewpoints, style-scene Playwright specs
bench/results/verify/<YYYYMMDD-HHMM>-<shortsha>/
review/                     pairs/, contact-sheet.jpg, overlays/ (gitignored images; REVIEW.md links them)
VERIFY-LEDGER.md  REVIEW.md  NOTES.md  BLOCKERS.md  AI-USE.md  THIRD_PARTY.md
```

## 7. Hard constraints

- Browser game. TypeScript for the game and server, Python 3.12 for data. three.js 0.187.0 with `WebGPURenderer`, imports from `three/webgpu` and `three/tsl`, WebGL2 fallback working; no compute-only features in the core path. Rapier `@dimforge/rapier3d-compat` 0.21.0, `recast-navigation` 0.44.0, `three-mesh-bvh` 0.9.18, Vite, Vitest, Playwright. Pin versions in lockfiles; check an API exists in the installed package source before using it.
- Colours only from `config/palette.json`; constants (bbox, origin, widths, sources, seeds) only in `config/campus.json`.
- No copyrighted assets. No UGG or Goat Simulator assets, names, UI art, fonts, task text or recordings; our goose is a Canada goose; never put "Untitled Goose Game" or "Goose Game" in the title or UI (doc 07 section 3). The UGG screenshots are for measurement only and never enter the repo.
- Data licences: OSM (ODbL), Ontario lidar (OGL Ontario), City of Waterloo vector layers (Waterloo Open Data User Licence), Region of Waterloo (Region Open Data Licence v2.0). Put the doc 07 section 1 credits text in the game's credits screen; OSM attribution must be visible. The City orthophoto licence is unconfirmed, so it is QA-only: never ship tiles or derived textures. Reference photos stay in the gitignored cache with attribution on the contact sheet.
- Raw data out of git; the build reproduces from `config/campus.json` and the manifest. Fetch with a descriptive User-Agent, cache in `data/raw/`, record `osm_base` or file dates.
- Never call a model per frame or block the game on a network call. The gateway key never reaches the client. Tests never call the network; Jev calls are replayed from recordings.
- Determinism: seeded PRNG streams; a seed plus an input log reproduces a session.
- Tone: slapstick only, nobody hurt, no police, no real people.
- Do not push, open pull requests, post, email or contact anyone. Work on a local branch named `goal/overnight-<date>`. Brian reviews every change in the morning.

## 8. Self-verification loop

Every increment:

1. Pick the next item; write its test or gate first if one does not exist.
2. Implement the smallest change that could pass.
3. Run `npm run verify:fast` (geometry and static checks, under 3 minutes) and the unit tests.
4. If green and the gate shows no regression, commit. If not, fix or revert before anything else.

Every 2 hours, after any rendering change, and at the end: run the full `npm run verify`, score the 20 photo pairs yourself with the doc 08 section 2.5 rubric (blind, twice with shuffled order, a concrete observation for every score), and append the ledger line.

Definition of done per phase is doc 08 section 4.1. A phase is done only when its gates pass **and** the run folder and ledger line exist. Model-judged looks never pass a phase on their own.

Reward-hacking rules (doc 08 section 4.4) are binding: frozen ground truth with a checked hash; tune only on `dev` items; never tune on holdout items or viewpoints; never move a calibrated camera or edit the world to please a photo; never loosen a threshold without a logged reason; checks read packed chunks and real screenshots, never intermediates; `verify:selftest` must show every mutant failing.

## 9. Logging and the ledger

- `VERIFY-LEDGER.md`: one appended line per full run (time in America/Toronto, short SHA, backend, gates passed of total, key metrics, run folder). Never edit old lines.
- `NOTES.md`: decisions you made and why, doc disagreements, assumptions, with timestamps.
- `BLOCKERS.md`: anything that stopped an item (what, error text, what you tried, what you did instead).
- `bench/results/`: every benchmark and verification run as JSON.

## 10. Commit discipline

- One concern per commit, small and reviewable, message says what and why and names the gates that pass.
- Every AI-assisted commit ends with the trailer `Assisted-by: Claude:<your exact model id> [tools]` (doc 00 rule 3). Never add `Co-authored-by:`, `Generated-by:` or `Signed-off-by:`.
- No AI notices in source files. Keep `AI-USE.md` current (tools, what for, how generated code is reviewed). Record any third-party code in `THIRD_PARTY.md`.
- Never commit a change that fails the regression gate.

## 11. When blocked

- Log it in `BLOCKERS.md`, then move to the next item you can do. Never wait for a human.
- A failed download: retry with backoff (3 tries), try the documented alternative (Geofabrik plus osmium instead of Overpass; another Overpass mirror; the OSM API map call), then mark the item blocked and continue with cached or sample data, **labelled as sample data** in REVIEW.md.
- Never invent data, coordinates, heights, API shapes or results. If a value is unknown, leave the check red and say so.
- Never fake verification: no hard-coded metric values, no skipped tests reported as passing, no thresholds edited to turn red into green, no screenshots taken from a different build.
- If a gate looks wrong, do not weaken it: write the evidence in `NOTES.md` and in REVIEW.md under "gates to discuss", keep it red, and continue with other work.

## 12. Budget

- Assume one night of wall-clock time and a finite token and context budget. Work in increments of at most about 45 minutes; commit after each green one.
- Keep outputs small in your context: write large logs to files and read summaries.
- Prefer finishing and verifying one thing over starting three.
- Reserve the last 45 minutes (or the last 15% of your remaining budget, whichever comes first) for the final full verify and the review pack. If you are running out early, stop feature work immediately and produce the pack.

## 13. Anti-slop rules

- No dead code, commented-out blocks, unused exports or files "for later".
- No placeholder data presented as real. Sample, stub or mock data is named as such in code, file names and REVIEW.md.
- No TODO without an entry in REVIEW.md next steps.
- No invented library APIs; read the installed source when unsure.
- No duplicated constants; config files own them.
- No claims without an artefact path. No "should work": run it.
- No decorative abstractions; write the simplest code that passes the gate.
- No new dependency without a reason in the commit message and a licence line in `THIRD_PARTY.md`.
- Tests assert behaviour and numbers, not implementation details.

## 14. Stop condition

- Do **not** stop while any P1 gate is red and you still have budget and an unblocked item.
- When every P1 gate is green and the review pack is produced, continue with P2 in the same increments within the remaining budget.
- Stop when the budget reserve in section 12 is reached, or when every remaining item is blocked. In every case, finish by running the full `npm run verify` and producing the review pack below. Never end a session without it.

## 15. Morning deliverables for Brian

1. `REVIEW.md` at the repo root:
   - one-paragraph summary of what now works;
   - **metrics table**: every gated metric with value, gate, pass or fail, and the change since the first run of the night, for both backends where available (IoU median and p10 vs City, OSM IoU report, height RMSE dev and holdout, per-pixel height error, distance median and max error, azimuth max error, coverage, terrain RMSE, Ring Road length, entrance reachability, top-down IoU and chamfer, the seven style statistics, palette lock, looks mean per criterion and the scoring disagreement, frame-time p95);
   - link to the contact sheet and overlays;
   - **known issues** (every red gate, every exception, every post-2018 building, every viewpoint with recognisability 1 or 2, every sample-data stand-in);
   - **blockers** (summary of `BLOCKERS.md`);
   - **gates to discuss** (where you think a gate is wrong, with evidence);
   - **next steps**, ordered, each small enough for one increment.
2. `review/contact-sheet.jpg`: 20 rows of reference photo, photo-match render, game-camera render and scores, with photo attributions.
3. `review/overlays/`: top-down overlays per chunk.
4. The latest `bench/results/verify/<run>/summary.json` and the ledger.
5. A clean branch history of small commits with trailers.

## 16. First 30 minutes

1. Read `00` and `08` fully; skim the rest of the read-first list; write a 10-line plan in `NOTES.md`.
2. `git init` if needed, create the branch, scaffold the doc 06 layout, `AI-USE.md`, `.gitignore` (data/raw, data/build, public/world, verify/cache, review images).
3. Pin dependencies: `npm i three@0.187.0 @dimforge/rapier3d-compat@0.21.0 recast-navigation@0.44.0 three-mesh-bvh@0.9.18` plus Vite, Vitest and Playwright; a Python venv with pinned shapely, pyproj, rasterio, numpy, pillow, remotezip, opencv-python-headless, pytest.
4. Copy the ground truth to `verify/ground-truth/`, write `SHA256SUMS`, and a test that checks it.
5. Write `config/campus.json` (bbox, origin, CRS, chunk size, seeds, source URLs) and `config/palette.json` from doc 02 section 4.
6. Write the coordinate-conversion module (EPSG:26917 to world and back) with a unit test using three ground-truth landmarks and the azimuth of DC to MC (248.7 degrees).
7. Run `npm run verify:fast` on the stub world; append the first ledger line, even though most gates are red.
8. Commit: "V0: scaffold, frozen ground truth, first ledger line".
