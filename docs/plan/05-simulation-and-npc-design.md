# 05 Simulation and NPC design

Priority 2 of the project: how students, staff and other geese live on the campus, from tiered agents and state machines to perception, reactions, memory and navigation, plus an optional Jev decision layer with costs, risks and a mandatory deterministic fallback.

Inputs: villager behaviour from [03-untitled-goose-game-deep-dive.md](03-untitled-goose-game-deep-dive.md) section 4, data from [01-data-sourcing.md](01-data-sourcing.md) (walk network, entrances, class slots), features from [04-goat-simulator-and-other-games.md](04-goat-simulator-and-other-games.md). Package versions were checked on npm on Nov 2, 2026.

## 1. Principles

1. **Comedy comes from a few legible minds, not from crowd size.** House House abandoned a "big clockwork system of dozens of little faceless people" for a small cast (VICE, via [research/goose-game-research.md](research/goose-game-research.md)). Crowds are atmosphere; 10 to 30 smart NPCs carry the gags.
2. **Deterministic core.** The game must be fully playable, testable and reproducible with no network. Every NPC decision has a deterministic rule. An LLM layer is an optional flavour on top.
3. **Never call a model per frame, never block on it.** Decisions are asynchronous, batched, cached, budgeted and allowed to arrive late or never.
4. **Simulate only what the player can perceive.** Level of detail for AI, like level of detail for meshes.

## 2. Agent tiers

| Tier | Count (target) | Who | Brain | Movement | Tick |
|---|---|---|---|---|---|
| A: Smart NPCs | 10 to 30 | Named archetypes in enclosures: groundskeeper, food truck vendor, tour guide, TA with coffee, security, frisbee players, study-group student | Hierarchical FSM (section 3) plus perception and memory; optional Jev | Navmesh plus local avoidance (Detour crowd), Rapier kinematic capsule | Perception 10 Hz, FSM 10 Hz within 60 m of the goose; 2 Hz otherwise |
| B: Ambient students | 300 to 500 | Students and staff walking between classes, eating, sitting | Schedule plus utility choice (class, food, social, rest); Scaredy-style honk response only | Pedestrian graph from OSM (A* on ways), polyline following with separation steering | 2 to 5 Hz; positions interpolated per frame |
| C: Off-screen population | thousands (virtual) | Everyone beyond about 250 m | No individual state: counts per graph edge per time slot | None (spawned into tier B when the goose approaches) | On slot change |
| G: Other geese | 5 to 50 | Wild Canada geese, later the player's gaggle | Flocking (Yuka steering: cohesion, separation, alignment, wander) plus a tiny FSM (graze, alarm, follow player, hiss) | Steering on the navmesh | 5 to 10 Hz |

Promotion and demotion: a tier B student who gets honked at, robbed or chased is promoted to tier A for a minute, then demoted back.

## 3. State machines

### 3.1 Smart NPC (tier A)

Hierarchical FSM based on UGG (doc 03 section 4.4), with campus states added:

```
Routine                         // schedule-driven loop at home zone
  sub-states: Work | Walk(to) | Sit | Eat | QueueAt(food truck) | Lecture(indoors, hidden)
Notice      -> on: goose in cone, honk heard, owned item missing, foreign item in zone, crowd panic nearby
React       -> "?" Wonder | "!" Shock (drop held item) | Stare (goose seen, not misbehaving)
Investigate -> walk to honk source or last-seen goose position
Chase       -> goose holds my item; speed = goose speed x 1.05; give up after 12 s or 40 m from home
Shoo        -> Chaser archetypes: goose in my zone; wave arms, step toward goose, line "Shoo! Go away!"
Search      -> go to remembered item position, thought bubble shows item
Retrieve    -> pick item up
Return      -> carry item to homePos
Tidy        -> foreign item: rule per archetype (bin it, shelf it, hand it to lost-and-found)
Flee        -> Scaredy: run from goose for 3 s, then Recover
Pratfall    -> slip, trip, sit down hard, get wet; 2 s recovery animation (never injury)
GiveUp      -> scratch head, back to Routine
Global: alertness level (0..3) from the zone's Menace meter; sets cone range, chase speed, signs
```

Priority ordering (resolves the "hard to predict" complaint about UGG): Pratfall > Flee > Chase > Retrieve > Shoo > Investigate > Tidy > Routine. Make it visible: the reaction mark and thought bubble always show the current top goal.

### 3.2 Ambient student (tier B)

```
Schedule -> pick a goal from the class slot table:
   at :20 and :50 -> Walk to next class building entrance (from UW API or a synthetic timetable)
   lunch window   -> Walk to a food outlet (OSM amenity, UW FoodServices outlets)
   free           -> utility pick: Sit (bench), Social (cluster), Study (indoors), Wander
Honk within 6 m -> Startle (jump, "!" mark), then 70% Flee 4 s, 30% Film it on phone (comedy beat)
Goose within 2 m -> Sidestep
Item stolen      -> Promote to tier A (Chase)
```

Class waves: 50-minute slots start on the half hour (8:30, 9:30 and so on, ending at :20) and 80-minute Tuesday and Thursday slots (for example 1:30 to 2:50, 3:00 to 4:20), with 10 minutes to move (sources in doc 01 section 7). So the paths flood at :20 to :30 and :50 to :00. One game hour can be 4 real minutes so a session sees several waves.

### 3.3 Other geese

Graze (wander on grass polygons), Alarm (neck up, honk, when a student is within 4 m), Hiss (nest-defence mode only), FollowPlayer (recruited into the gaggle). Recruit rule: the Menace meter crosses a threshold and the player honks near a grazing goose.

## 4. Perception

| Sense | Model | Implementation |
|---|---|---|
| Vision | Cone: 110 degrees, 18 m by day (alertness 0), 25 m at alertness 3; occlusion by raycast to goose head and body (2 rays) against building and prop BVH | `three-mesh-bvh` (0.9.18, MIT) raycasts; at most 1 vision check per NPC per tick; staggered across ticks |
| Peripheral | 220 degrees, 4 m | Distance check only |
| Hearing | Honk radius 25 m, attenuated by 40% per wall crossed (one ray), so a honk behind a building is "heard" but fuzzy (investigate the wrong spot) | Sound events on an event bus with position and loudness |
| Item awareness | Each NPC knows the homePos of owned items; checks "is it there" when within 8 m of homePos or every 10 s | Item registry |
| Crowd contagion | If 3 or more agents within 10 m flee, nearby tier B agents get a "panic" stimulus | Spatial hash grid (8 m cells) |

Yuka (0.7.8, MIT) has vision and memory modules plus FSM and steering classes, but its last release was in 2022, so treat it as a reference implementation and be ready to vendor or rewrite the small parts we use.

## 5. Reactions

- Reaction marks are sprites in our own hand-drawn style: "?", "!", a swirl, a thought bubble rendering the wanted item's own mesh.
- Each reaction has a minimum display time (0.6 s) so players can read it; the FSM waits for it before acting.
- Lines are short and text-only at first ("Hey!", "My coffee!", "Shoo!"), from a per-archetype table. Voice is a later feature.
- Pratfalls use a short ragdoll blend (Rapier) or an authored animation, then a recover clip. No damage state exists.

## 6. Memory

| Memory | Scope | Decay | Use |
|---|---|---|---|
| Item last-seen positions | Per smart NPC | Overwritten | Search |
| Goose last-seen position and time | Per smart NPC | 30 s | Investigate, Chase |
| Grudge (how often the goose wronged me) | Per smart NPC | Halves every 5 game minutes | Faster Notice, longer Chase, unique lines |
| Route heatmap (where the goose goes) | Global, per zone (8 m grid) | Halves every 10 game minutes | Hello Neighbor-style: security places "No Geese" signs or patrols on hot cells |
| Zone alertness | Per zone | From Menace meter | Global modifiers |

Memory is plain data in a single `World` object, serialisable for save files and deterministic replays.

## 7. Navigation and movement

| Tool | Version, licence (npm, Nov 2, 2026) | Use |
|---|---|---|
| `recast-navigation` and `@recast-navigation/three` | 0.44.0, MIT | Bake a navmesh per chunk from terrain minus buildings and water; Detour crowd for tier A and geese; area costs (path ribbons cheap, grass medium, roads expensive) |
| `navcat` | 0.4.1, MIT | Pure-JS alternative to Recast (no WASM); worth a benchmark against recast-navigation |
| Own A* on the OSM pedestrian graph | n/a | Tier B routing: thousands of cheap queries, cacheable per origin and destination entrance |
| `@dimforge/rapier3d-compat` | 0.21.0, Apache-2.0 | Goose kinematic character controller, NPC capsules, props, joints for grabbing, ragdolls |
| `yuka` | 0.7.8, MIT (2022) | Steering behaviours for geese flocking; FSM and perception reference |
| `three-mesh-bvh` | 0.9.18, MIT | Vision raycasts, camera occlusion |

Navmesh build in the pipeline (offline), not in the browser: bake per 256 m chunk with a 1 m tile border, ship as binary, and stitch at load. Agent radius 0.35 m for people, 0.3 m for geese. Doors are the OSM `entrance` nodes (171 on campus): NPCs "enter" a building by walking to the entrance and despawning, which hides the lack of interiors.

## 8. Simulation loop and determinism

- Fixed-step simulation at 30 Hz (physics at 60 Hz), decoupled from rendering. Seeded PRNG (one stream per subsystem) so a seed plus an input log reproduces a session.
- Staggered ticks: each NPC has a phase offset so perception checks spread evenly across frames.
- Budget: AI under 2 ms per frame on the iGPU laptop for 30 smart NPCs plus 500 ambient agents; measure in the benchmark harness (doc 06).
- Optionally run the sim in a Web Worker with a SharedArrayBuffer of positions (requires cross-origin isolation headers on the host). Start on the main thread; move only if the profile says so.

## 9. Jev as an optional decision layer

### 9.1 What Jev is (facts)

- **Jev is TypeSafe AI's evaluation model**, served on the Vercel AI Gateway as `typesafe-ai/jev` (with pinned versions `typesafe-ai/jev-1.13.0` and `typesafe-ai/jev-1.14.0`, the latter released 2026-10-10), per the gateway's public `/v1/models` listing fetched Nov 2, 2026. It is **not Brian's project**: Brian's MP1 project **askjev** (https://github.com/brian-w-zhang/askjev) is built on Jev and states it is not affiliated with TypeSafe.
- It is a "System One decision model" that returns **choices, scores and boolean probabilities**, not free text. Context 32,000 tokens through the gateway. Price: **$0.042 per 1M input tokens, output free** (gateway listing).
- Call shape (verified by askjev, `docs/01-jev.md`, 2026-09-24): `POST https://ai-gateway.vercel.sh/v1/evaluate` with `{ model, state, questions }`; `questions` is a map of id to `{ type: "boolean" | "choice" | "score", instructions, criteria }`. Answers: boolean `{ type, probability }`; choice `{ choice, probabilities, confidence }`; score `{ score, probabilities, confidence }`. Usage is in `inputTokens`. `providerMetadata.gateway.generationId` identifies the call.
- Measured by askjev through the gateway: **p50 383 ms, p95 727 ms** end to end; limits **1,200 requests per minute**, rate limiting above about **8 concurrent workers**; batching several questions over one state in one request is "12.2x cheaper and 10x faster" (TypeSafe cookbook figures quoted by askjev) and does not change answers beyond noise.
- No seed or temperature. Repeats vary slightly (askjev measured noise of about 0.005 to 0.011 standard deviation on booleans), and **near-tie choices flip**. TypeSafe documents weak spots including numbers, date and time comparison, large states full of irrelevant detail, option order (a lean toward the first option) and generation.

### 9.2 Where it adds value (and where it does not)

Good fits: one-second, common-sense judgments that would be tedious to hand-author for many archetypes and situations.

- "Given this student's situation, what do they do about the goose?" Choice: ignore, film it, flee, shoo, chase, call security, laugh with friends.
- "How annoyed is this TA?" Score with situation-described levels, used to modulate chase time.
- "Would this person go back for their coffee?" Boolean.
- Tour guide improvisation: choose the next stop from a list when the goose disrupts the tour.

Bad fits: anything per frame, pathfinding, physics, timing-critical reactions (honk shock must be instant), dialogue generation (Jev does not generate text), anything tests must reproduce exactly.

### 9.3 Architecture

```
Browser (game)                        Server (Vercel Function, Node)         Vercel AI Gateway
-------------------------------       ---------------------------------      -----------------
DecisionScheduler                      /api/decide
  - collects decision requests          - auth: per-session token, rate cap
    from NPCs at decision points        - validate schema, clamp sizes
    (not per frame)                     - cache: sha256(model@version +    ->  POST /v1/evaluate
  - dedupes by situation key              state + questions) -> answer          model: typesafe-ai/jev-1.14.0
  - max 8 in flight, 1 per NPC          - concurrency 8, timeout 900 ms         state, questions
  - deadline 1.5 s, else fallback       - logs generationId, tokens, latency
  - applies answer only if NPC          - never exposes AI_GATEWAY_API_KEY
    is still in the same state
Deterministic fallback (always computed first; Jev result may override within allowed options)
```

- **Decision points only**: Notice, end of React, GiveUp, a schedule slot change. A smart NPC makes at most one Jev request per 5 s; ambient students use Jev only when promoted.
- **Fallback first**: the deterministic utility function computes an answer immediately; the NPC starts acting on it. If Jev answers within the deadline and the NPC is still in the same state, the NPC switches only if Jev's choice is one of the allowed options and its confidence is above a threshold (start at 0.6). Otherwise the fallback stands. The game never waits.
- **Small, situational states** (Jev is weaker with large irrelevant states): archetype, 3 to 5 facts about the situation (what the goose did, what I hold, how many times today, where I am going and how late I am), written as plain sentences with names instead of numbers (Jev is weaker on numbers and times).
- **Fixed option lists**, shuffled per call with the order logged, to measure and reduce first-option bias; include "none of these".
- **Batch questions** over one NPC's state in one request (next action, annoyance, will-chase), not one request per question.
- **Cache** by a coarse situation key (archetype, event type, alertness band, item type): identical situations reuse answers, which also bounds cost and makes replays mostly stable.
- **Pin a version** (`typesafe-ai/jev-1.14.0`) for determinism across a term; log the served model and generationId.
- **Record and replay**: in tests and benchmarks, a recorded decisions file replaces the network, so CI is deterministic.

Example request body (illustrative; field names from askjev's verified shape):

```json
{
  "model": "typesafe-ai/jev-1.14.0",
  "state": "A second-year engineering student is walking from the library to a class that starts in a few minutes. A Canada goose just honked loudly right behind her and grabbed the coffee from her hand. She has been bothered by this goose once before today. Other students are nearby and watching.",
  "questions": {
    "action": {
      "type": "choice",
      "instructions": "What does she most likely do in the next few seconds?",
      "criteria": { "chase": "Runs after the goose to get the coffee back", "shoo": "Waves her arms and shouts at the goose but stays put", "film": "Laughs and films the goose on her phone", "leave": "Gives up on the coffee and hurries to class", "none": "None of these" }
    },
    "annoyed": {
      "type": "boolean",
      "instructions": "Is she clearly annoyed rather than amused?"
    }
  }
}
```

The exact `criteria` format for each type must be checked against TypeSafe's current docs before coding; askjev's notes are the only source used here.

### 9.4 Cost and rate estimates

Assume about 400 input tokens per request (askjev measured a market cost of about $0.000017 for a roughly 450-token call, which matches $0.042 per 1M).

| Scenario | Requests | Tokens per hour | Cost per hour of play |
|---|---|---|---|
| 30 smart NPCs, 1 decision per 10 s each | 3 per s, 10,800 per h | 4.3 M | about $0.18 |
| 30 smart NPCs at 1 per 5 s, plus 2 promoted students per s | 8 per s, 28,800 per h | 11.5 M | about $0.48 |
| Hard cap at the gateway limit | 20 per s (1,200 per min) | 28.8 M | about $1.21 |

With caching, real usage should be well below these. Even the cap is cheap for a class demo, but a public deployment multiplies it by concurrent players, so a public build needs a per-session budget (for example 600 requests) after which only the fallback runs.

### 9.5 Risks

| Risk | Mitigation |
|---|---|
| Latency spikes (p95 727 ms, tails worse) | Fallback-first design; deadline 1.5 s; answers applied only if still relevant |
| Non-determinism (no seed; near-tie flips) | Version pin, cache, record and replay, thresholds; tests never call the network |
| Option-order bias | Shuffle options and log order; measure the effect as a benchmark |
| Leaking the gateway key | Server-only proxy (askjev's `web/src/lib/server/jev.ts` pattern), never in client bundles; per-session tokens |
| Cost runaway in a public build | Per-session and global budgets, cache, kill switch flag |
| Terms of use | askjev's reading of TypeSafe's MCA and AUP (not legal advice): label AI output as AI (AUP 1.4); section 2.3(a) bans offering Jev "as a standalone service" (an NPC brain inside a game is not standalone, but **confirm with TypeSafe** before a public launch); section 16.4 no implied partnership or branding. Add an in-game note: "Some NPC decisions are made by an AI model." |
| Course rules | Disclose in AI-USE.md and the presentation's AI section; an LLM inside the product is separate from AI used to write code |
| It is not fun | Benchmark it (9.6). If players cannot tell the difference, keep the FSM and say so; that is a valid result |

### 9.6 How to evaluate it (for the Advanced Technology claim)

- **A/B playtest**: same build with fallback-only vs Jev-assisted NPCs; players rate "the people felt alive" and "reactions were funny" (Likert, n at least 10), blind to condition.
- **Agreement**: share of decisions where Jev and the fallback agree; examine disagreements for funnier outcomes.
- **Latency and freshness**: share of Jev answers applied before the deadline; p50 and p95 latency in play.
- **Cost**: tokens and dollars per play hour, cache hit rate.
- **Stability**: answer flip rate under option shuffles for the same situation.

### 9.7 Prior art

- The "LLM residents" fork of Slop New York (https://github.com/trippuroskie/slop-newyork, MIT, pushed 2026-10-27): eight Midtown residents with hunger, work and social needs; hourly plans for all residents come from **one batched LLM call** through a local Node server (`server/residents-server.mjs`), with a mock provider when no key is set and a per-provider cost table. Same shape as our design: batched, server-side, mock fallback.
- Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (2023), https://arxiv.org/abs/2304.03442: LLM-driven agents with memory, reflection and planning in a small town. Far more expensive than our design (a text-generating model per agent action); useful as a related-work slide, not as an architecture.
- askjev (Brian's MP1): the Jev integration knowledge (call shape, noise, latency, legal reading) comes from there.
