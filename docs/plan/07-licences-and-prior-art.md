# 07 Licences and prior art

What each data source, library and reference allows, the attribution the game must show, the Untitled Goose Game IP lines not to cross, and the prior art that establishes novelty for the Advanced Technology pitch.

This is a reading of public licence pages and summaries, not legal advice. The IP guest lecture (Thu Nov 19) and the MP3 review will ask about this ([research/course-constraints.md](research/course-constraints.md)).

## 1. Data licences

| Source | Licence | Obligations | Verified? |
|---|---|---|---|
| OpenStreetMap (buildings, paths, water, props, transit) | Open Database Licence 1.0, https://opendatacommons.org/licenses/odbl/1-0/ ; OSM copyright page https://www.openstreetmap.org/copyright | Attribution "(c) OpenStreetMap contributors" visible in the game (credits or a map corner). **Share-alike for derivative databases**: our packed world files mix OSM with other data. If we publicly use them, we must offer the derived database (or the method to recreate it) under ODbL. The rendered game itself is a "Produced Work" needing only attribution (OSMF guideline https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline, **not re-read for this doc**) | Licence: yes. How it applies to our packed format: my reading |
| Ontario lidar DSM and DTM | Open Government Licence, Ontario, https://www.ontario.ca/page/open-government-licence-ontario | Attribution "Contains information licensed under the Open Government Licence, Ontario." | Yes (data.ontario.ca entries list OGL Ontario) |
| City of Waterloo vector layers (footprints, trees, trails, water) | Waterloo Open Data User Licence (open data page https://www.waterloo.ca/en/government/open-data.aspx says "You may use and republish the data as you wish, according to the Open Data Licence") | Attribution "Contains information provided by the City of Waterloo under licence" (from a third-party summary) | **Partly**: full licence text not fetched |
| City of Waterloo orthophotos | Unknown whether the open data licence covers imagery services | Use as private reference only; do not ship tiles or derived textures until confirmed | **No** |
| Region of Waterloo data (footprints, GRT GTFS, ION) | Region Open Data Licence v2.0 | Credit optional; suggested "Contains information provided by the Regional Municipality of Waterloo under licence"; no endorsement implied | Yes (summary of the licence page) |
| UW Open Data API v3 | API terms not reviewed | Needs a key; check terms before shipping derived schedules | **No** |
| Overture Maps buildings | ODbL overall; components from Esri Community Maps (CC BY 4.0), Microsoft (ODbL), Google Open Buildings (CC BY 4.0) | "Overture Maps Foundation, overturemaps.org" plus component credits, https://docs.overturemaps.org/attribution/ | Yes |
| Microsoft CanadianBuildingFootprints | ODbL | Attribution, share-alike | Yes (repo README) |
| Google Photorealistic 3D Tiles | Google Maps Platform terms | Not open data; rejected for this project | Not re-read |
| UGG fan wiki text | Fandom wikis are CC BY-SA (general Fandom policy, **not checked for this wiki**) | We use facts, not text; no copying of wiki prose into the game | Partly |

Credits screen text (draft):

> Map data (c) OpenStreetMap contributors, available under the Open Database Licence. Contains information licensed under the Open Government Licence, Ontario. Contains information provided by the City of Waterloo under licence. Contains information provided by the Regional Municipality of Waterloo under licence. Some NPC decisions are made by an AI model (Jev by TypeSafe AI) when online. Not affiliated with the University of Waterloo, House House or Panic.

The University of Waterloo name and building names are factual references; avoid UW logos and crests (trademarks) unless permission is obtained.

## 2. Code licences (npm, Nov 2, 2026)

| Package | Version | Licence | Notes |
|---|---|---|---|
| three | 0.187.0 | MIT | Keep the licence notice |
| @dimforge/rapier3d-compat | 0.21.0 | Apache-2.0 | Include licence and any NOTICE when distributing |
| recast-navigation, @recast-navigation/three | 0.44.0 | MIT (wraps Recast and Detour, which are zlib-licensed upstream) | |
| navcat | 0.4.1 | MIT | |
| yuka | 0.7.8 | MIT | |
| three-mesh-bvh | 0.9.18 | MIT | |
| vite | 8.3.5 | MIT (Vite's usual licence; not re-checked) | Build tool, not shipped |

Code we may read but not copy:

- `jsdf/goose64` (UGG N64 demake, 87 stars): **no licence**, so all rights reserved. Read for ideas only.
- Any "web port" of the commercial game (`webporting/Untitled-Goose-Game`, `web-ports/untitled-goose-game`): likely infringing. Do not use, link or demo.

Code we may reuse with attribution (MIT): `mrdoob/slop-newyork` (459 stars) for the pipeline shape and packer ideas; `StrandedKitty/streets-gl` (1,110 stars) as an OSM 3D renderer to compare against; `MikeFernandez-Pro/a-goose-tale` and `MikeFernandez-Pro/three-vat` (vertex animation crowds); `trippuroskie/slop-newyork` (LLM residents). Record anything copied in `THIRD_PARTY.md` with the commit.

## 3. Untitled Goose Game: IP lines

Generally, game mechanics and an art style are not protected by copyright, while specific assets, characters, names, text, music recordings and trade dress can be (general principle, not legal advice). The safe lines:

| Allowed | Not allowed |
|---|---|
| A goose that honks, grabs, crouches, flaps and runs | The UGG goose model, animations or sounds |
| A to-do list structure with tasks and gating | UGG's notepad art, handwriting font, task text or UI layout |
| Flat-shaded pastel low-poly style, faint shadows | Any UGG textures, models or screenshots in the game |
| Villager archetypes (a groundskeeper is a generic job) | UGG character designs, names ("the Wimp", "the burly man"), or recreating their scenes |
| Adaptive piano with branching chunks | UGG's recordings; any commercial recording of Debussy without a licence. The compositions (1909 to 1912) are public domain; recordings are not |
| Saying "inspired by Untitled Goose Game" in a pitch or post | Using "Untitled Goose Game" or "Goose Game" in our title, logo or store listing; implying endorsement |

Also from the developers: they rejected a Canada goose skin because "ours is a game about THIS goose" (VICE, via [research/goose-game-research.md](research/goose-game-research.md)). A Canada goose on a Canadian campus is clearly our own character.

Goat Simulator: same logic. Borrow mechanics (combo score, ragdoll, mutators), not names, the goat, or assets.

## 4. Course rules on AI and IP

- Accountability: fabricated citations and licence violations are on the team, whatever produced them.
- Code provenance through `Assisted-by:` commit trailers; `AI-USE.md` at the root; agents never add `Signed-off-by:`.
- Caution with AI-generated images and large generated content; prefer code-generated geometry and our own art. Disclose any AI-generated asset in `AI-USE.md` and `THIRD_PARTY.md`.
- The IP lecture (Nov 19) asks teams to discuss IP for their situation: data licences, code licences, trade dress, and who owns the code among team members (worth a team agreement before SE 490).

## 5. Prior art

### 5.1 Real-place 3D in the browser

| Project | What | Relevance |
|---|---|---|
| Slop New York and about 80 slop-cities takes (https://github.com/zz85/slop-cities) | Open data cities in three.js, mostly photoreal-ish facades | Pipeline shape; none are toon-shaded or a campus |
| streets-gl (https://github.com/StrandedKitty/streets-gl) | Mature OSM 3D renderer in WebGL2 | Comparison baseline for "plain OSM extrusion" |
| OSM Buildings, F4 Map and similar | OSM 3D map viewers | Not games; no NPCs |
| UW Minecraft campus (Engineering Orientation 2020) and the Ron Eydt Village Minecraft map | Hand-built campus | Hand-modelled alternative; not reproducible from data (sources in the earlier memo, partly unverified) |

### 5.2 Goose games and Waterloo goose projects

From the earlier memo (section 5, with links): Waddleloo (2026 goose risk map), GooseWatch (UW nest map, defunct), Honk n' Hurdle (2D runner), Goose-Run (CS Club runner), GOOSE DRIFT (UW Game Dev Club Fall 2026 jam, top-down racer), Entitled Goose Game (UW Game Jam 2025, Unity), Nesting Season (2016 to 2017, Unity mobile), Waterloo Desktop Goose (macOS, Oct 2026), plus Desktop Goose (samperson), `goose64`, `a-goose-tale` and a few Godot fan games.

Novelty verdict (search-based, not exhaustive): no 3D, real-data, play-as-the-goose campus sandbox exists, at Waterloo or elsewhere. GOOSE DRIFT (Oct 2026) is the closest Waterloo game and is a top-down racer.

### 5.3 Simulation prior art

- The Sims (needs-driven autonomous agents), Hello Neighbor (adaptive AI from past attempts), UGG (small cast with discrete states). See [04-goat-simulator-and-other-games.md](04-goat-simulator-and-other-games.md).
- "LLM residents" Slop New York fork (batched LLM planning with a mock fallback) and Generative Agents (Park et al. 2023, https://arxiv.org/abs/2304.03442). See [05-simulation-and-npc-design.md](05-simulation-and-npc-design.md) section 9.7.

### 5.4 How to state novelty in the pitch

"A reproducible compiler from open GIS data (OSM, municipal footprints, provincial lidar) to a stylised, physics-enabled, NPC-populated open world that runs in a browser, validated against ground truth (footprint IoU, roof RMSE) and benchmarked on consumer laptops, with an optional low-cost AI decision layer evaluated against a deterministic baseline." The goose is the demo that makes strangers understand it in five minutes.
