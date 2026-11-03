# SE 390 MP3 project ideas (team Whiplash)

Research memo for Brian, Nov 2 2026: category fit, what is trending, hackathon scan, 8 ranked Advanced Technology candidates, top 3 with build plans. Read only research; nothing was sent or posted.

## 1. Category: Advanced Technology (confirmed fit)

Brian already picked Advanced Technology. The guide supports it on every constraint:

- What the guide asks for. Guide section 10, Results: "establish a scope and objective... develop an exciting vision of what you would present at symposium, and work backwards". Deliverables can be "technology prototypes". Handbook 2.2: "heavy on the technical problem. The opportunity here is typically that other engineers find the project interesting to hear about." So the complexity is supposed to live in the engineering, which is what Brian wants.
- How it is graded at symposium (Handbook 14.2.5). B: solved convincingly and excellent on one measure. A: two or more measures (importance, technical difficulty and scope, novelty, applies multiple upper year courses). A+: the same plus "positive mention from an industry professional". The handbook says the way to show a convincing solution is "comparing the solution to the alternatives". Benchmarks against baselines are the expected evidence, not user counts.
- Scope warning (14.2.5). Not "second year level", and not something "a single fourth year student" could finish in one term. Every idea below has a hard core sized for that.
- MP3 bar (guide section 7 table). Artifact: "a demonstrable system or result that a stranger could understand from a five-minute demo". External contact: "feedback obtained and visibly acted on". MP3 is also where you answer "is this the project we are taking into SE 490". So pick something with a long runway.
- AI policy (section 11). Coding agents are allowed, but the Results bar has gone up. Keep an AI-USE.md, put `Assisted-by:` trailers on commits (never Signed-off-by from an agent), and have a team member who understands each module. The guide says plainly that it will ask about code nobody understands. "A rougher prototype and three real user conversations is further ahead." That is why every idea below includes cheap outside contact: engineers who use the thing, maintainers of nearby tools, benchmark baselines.
- Examples close to this style: DejaView (time-travel Python debugger, Advanced Technology), LogWeaver (log parsing), Wombat SymX (symbolic executor).

## 2. What is trending (early Nov 2026), with evidence

Checked this turn: Hacker News points (Algolia API and hn front page), GitHub trending (weekly page), GitHub API star counts, issue searches. Items marked (X summary) come from X's auto-generated news summaries and I did not verify them separately.

Agent harnesses, memory, observability
- GitHub weekly trending is mostly agent skills and harness tooling: claude-mem (persistent agent memory) at 110,835 stars, +7,255 this week; obra/superpowers about 311k; t3code about 42k (+9,770); hyperframes about 77k; JetBrains thinkrail and a Cloudflare security-audit skill also listed. https://github.com/trending?since=weekly
- "Memory Tax" paper: plain RAG over raw history beat most dedicated agent memory systems on LongMemEval. @omarsar0 post had 509 likes and 438 bookmarks: https://x.com/omarsar0/status/2115098954799169970 . A review of 30 memory products had 198 likes and 219 bookmarks: https://x.com/sermakarevich/status/2115087554877776113
- HN "Claude Code regularly sends each background agent's transcript to its model", 588 points: https://gist.github.com/flamerix-ai/c3905705cc4205e5de3011fa2e74efce
- Show HN "Deedglass: an agent said it updated 1 row; Postgres changed 301": https://github.com/deedglass/deedglass
- AI SDK DevTools records runs but does not replay them (docs: https://ai-sdk.dev/docs/ai-sdk-core/devtools). Small replay tools already exist: agentoptics/rewind (Rust, 13 stars), Abhi-2526/agent-rewind (Python, 0 stars).

Sandboxes and agent runtimes
- NVIDIA OpenShell, "safe, private runtime for fleets of autonomous AI agents": 508 HN points, 20,984 stars. https://github.com/NVIDIA/OpenShell
- Microsoft MXC sandbox: 196 points. Launch HN Agent37 (agent sandboxes): 163 points.
- Ongoing debate over VMs, ephemeral sandboxes, or Wasm for agents (X summary). Perplexity SPACE Firecracker sandbox and the PGX Postgres-per-agent project also appeared only as X summaries.

Multi-agent simulation (closest to Brian's interests)
- YC Labs "We ran AI agent swarms in Minecraft and Mindustry": 421 HN points. 50 agents spontaneously built ration ledgers and bureaucracy. Bed Wars was Claude vs GPT. Its finding that "Claude wrote lessons in private memory files and repeated the mistakes anyway" is a direct memory research hook. https://labs.ycombinator.com/projects/games/index.html , harness at https://github.com/yc-software/minecraft-agent-harness (122 stars, created Oct 29).
- Show HN "SimCity, but with Permits": 941 points (top Show HN of October). https://news.ycombinator.com/item?id=50170593
- Show HN "Gemini plays StarCraft" benchmark: 254 points (starskirmish.com/bench/v0-2). https://news.ycombinator.com/item?id=50118688
- Genie 4 world model: 1,044 points.

Terminals
- Mitchell Hashimoto's OSC 7501 Program Status Protocol (Oct 6) lets programs report idle, working, blocked or done to the terminal. A GitHub search finds about 4,163 references. Support has merged in xterm.js (PR #6260, merged Oct 27). Follow-up xterm.js PR #6266 merged Oct 29. tmux PR #5830 is open, and Claude Code issue #105534 reports a probe/DA1 race bug. https://mitchellh.com/writing/program-status-osc7501
- HN "WorldTUI: I trained a 360M model to pretend to be a terminal": 654 points. Show HN "Corgi, an agent and terminal multiplexer": 141. Ghostty is trending (about 63k stars).

Compilers, Wasm, Rust
- Cloudflare tsrs (TypeScript port to Rust): 437 points. Rust borrow checker unsoundness bugs: 751.
- Static recompilation to WebAssembly: PS2 games (316 points, https://github.com/snuri00/ps2-web-recomp), God of War PSP (251). Quake in safe Rust in the browser: 241.

What I could not verify: X-summary claims like REA's 400k stars, Open Duet's 6k stars, Harness2 benchmark numbers, PGX numbers, and Beacon's funding. I did not use these as the basis for any idea.

## 3. Hackathon scan (last 12 months) and what survives the filter

Filter: is there a hard implementation core that 5 weeks could push past a weekend demo, measured with benchmarks, without needing to collect data?

| Project | Event and link | Hard core? | Keep? |
|---|---|---|---|
| Physical Realities: thousands of AI guests in a theme park, Pixi plus SpacetimeDB. Their stated bottleneck was "decision requests accumulated faster than inference could resolve them" | MHacks 2026 Grand Prize, https://devpost.com/software/physical-realities | Yes: scheduling, batching, and fidelity versus cost | Yes, folded into idea 2 |
| Sim Francisco: 10k Census-seeded synthetic residents. Clustering into about 300 personas cut inference cost 10 to 100x at the same accuracy | Anthropic Opus 4.8 Build Day, 2nd, https://claude.com/resources/articles/meet-the-winners-of-our-claude-opus-4-8-build-day-hackathon | Yes: persona compression | Yes, idea 2 |
| Settlers of Solana: agent swarm simulating a market economy | Hack the North 2026 gallery, https://hackthenorth2026.devpost.com/project-gallery | Moderate | Inspiration for idea 2 and idea 3 |
| GurtOS: each agent task is its own Linux user with a copy-on-write file layer. Undo in 48 ms, kill switch froze 10 agents in 271 ms, 15 of 16 attacks stopped | Cal Hacks 13.0 gallery, https://devpost.com/software/gurtos (code: github.com/benz16107/calhacks13) | Yes: OS-level isolation and benchmarks | Yes, folded into idea 5 (and idea 1's workspace snapshots) |
| Tekton: 3D reconstruction where verifier sub-agents trace every component to a source ("evidence chain") | Anthropic Opus 4.8 Build Day, 1st (same link) | Yes: provenance plus verification loops | Yes, the provenance idea goes into idea 4 |
| ARGUS: five agents attack your app in a sandbox, prove vulns, verify the patch | MHacks 2026 gallery, https://mhacks-2026.devpost.com/project-gallery | Moderate | Inspiration for idea 8 |
| Standard Response: voice-agent mass calling plus ALNS routing. In an Eaton fire replay, 641 of 662 people got out vs 39 | Cal Hacks 13.0, 6 prizes, https://www.borisnezlobin.com/writing/calhacks-record | Yes, but needs real incident data | Dropped (data heavy) |
| Signal / FinRet: multi-agent research with citations and conflict flags | Hack the North 2026 finalists (gallery link) | Mostly prompting | Dropped |
| Confab: detect LLM confabulation from hidden-state geometry | HackPrinceton Spring '26 gallery, https://hackprinceton-spring-26.devpost.com/project-gallery | Needs model internals and labeled data | Dropped |
| Peel (HackMIT grand prize, hardware), Shepherd (TreeHacks 1st, smart cane), Reflex (HTN finalist, exoskeleton plus SmolVLA fine-tune) | https://plume.hackmit.org/gallery , https://treehacks-2026.devpost.com/ , https://devpost.com/software/reflex-e0jkih | Hardware or training | Dropped |
| Vercel Zero to Agent winners (PersonaAI, FITWISE, Origami), Cursor city hackathons, Replit buildathons | https://community.vercel.com/hackathons/zero-to-agent/winners | Mostly app wrappers | Dropped |

HackPrinceton Fall 2026 is Nov 13 to 15, so it has no winners yet. HackMIT 2026 judging is on Plume rather than Devpost. I could not find who won Cal Hacks "Most Technically Complex".

Pattern: weekend winners show that a big agent simulation or an agent OS is possible. None of them measured cost versus fidelity, replay determinism, or isolation overhead against baselines. That measurement is where an Advanced Technology project goes further than the demo.

## 4. Eight candidates (ranked)

Impressiveness is 1 to 5 (5 means a symposium referee remembers it). "H" marks ideas taken from a hackathon.

### 1. Flight Recorder: deterministic record, replay and fork for AI SDK agents
- Pitch: a black box for TypeScript agents. Record every model stream chunk, tool call and workspace change, then replay offline for free, fork at step N with a changed prompt or tool, and diff the two timelines.
- Trending: the agent transcript privacy story (588 HN points), agent observability, AI SDK DevTools without replay, the Deedglass problem. Prior art is small and Python or Rust (rewind, 13 stars), so a TypeScript, AI SDK native version has room. Closest course example: DejaView.
- Hard core: capturing nondeterminism (time, randomness, network, parallel tool calls), byte-exact replay of streaming responses, request fingerprinting and divergence detection with strict, ordered and fuzzy modes, a content-addressed trace store, per-step workspace snapshots so a fork restores the files too (GurtOS-style copy-on-write layer), and a timeline diff UI.
- Why data is not the bottleneck: traces come from your own agent runs. Test agents can be small and scripted.
- Claude Code milestones: (M1) trace schema plus recorder middleware around AI SDK `LanguageModel` and tools, with golden-file tests. (M2) strict replay with a divergence error, and property tests showing record then replay gives identical output. (M3) fork at step N, with workspace snapshots via git objects or overlay. (M4) parallel tool call ordering and fuzzy matching. (M5) Next.js timeline and diff viewer. (M6) benchmark harness.
- Benchmarks: replay fidelity on 3 or more open agents (for example an AI SDK example agent, a coding agent on SWE-style tasks, a browser agent), recording overhead in ms per step, debugging time saved in a small timed study with 5 developers, and a feature comparison with DevTools and rewind.
- Cheap outside contact: 5 AI SDK users debug a planted bug with and without the tool. Ask Vercel AI SDK and DevTools folks for feedback (Brian has Gateway contacts). Post a Show HN.
- 5 week risk: medium. Full determinism for arbitrary tools is impossible, so define the supported boundary clearly.
- Impressiveness: 4. Runway into SE 490: strong (CI regression tests from traces, Gateway integration).

### 2. Crowd: level-of-detail cognition for 1,000+ generative agents (H: Physical Realities, Sim Francisco, Settlers of Solana)
- Pitch: a simulation engine that runs a town of 1,000 or more memory-bearing agents at about 1/20th the token cost of naive per-agent calls. Agents near the action or the camera think at full depth. Distant ones run on clustered personas, cached plans, or cheap models.
- Trending: YC Labs swarms (421 HN points), SimCity with Permits (941), the MHacks grand prize and Anthropic 2nd place both hitting this exact bottleneck.
- Hard core: a cognition scheduler with priority queues, an inference budget per tick and deadlines, persona clustering with drift detection to promote an agent back to full depth when it diverges, a memory stream with reflection (Generative Agents style) that can be compacted and rehydrated, batching and caching through AI Gateway with model routing per tier, and deterministic seeded ticks for reproducibility. Render in the browser or in Brian's Arcade ASCII engine.
- Why data is not the bottleneck: fidelity is measured against the system's own full-depth run (same seed, all agents at full depth) using behavioral divergence metrics. You do not need real-world ground truth. No training.
- Milestones: (M1) deterministic tick engine with a scripted policy and tests. (M2) full-depth agent with memory, retrieval and reflection, plus a 25-agent Smallville-like scenario. (M3) LOD tiers and the scheduler. (M4) persona clustering with promotion and demotion. (M5) benchmark runner for cost, latency per tick and fidelity across 100, 500 and 1,000 agents. (M6) viewer with an agent inspector.
- Benchmarks: tokens and dollars per simulated agent-hour against naive per-agent calls and against Sim Francisco-style static clustering. Fidelity divergence on scripted events (party invite spread, rumor diffusion as in the Generative Agents paper). Human believability ratings for 10 sampled agents.
- Cheap outside contact: 6 to 10 raters do blind believability comparisons (full vs LOD agents). Email the YC Labs post authors and the ai-town community for feedback. The MHacks and Sim Francisco teams already ran into this problem and might give a quote.
- 5 week risk: medium to high. Token spend on the full-depth baselines needs a budget (use cheap models for baselines and keep 1,000-agent runs short).
- Impressiveness: 5. Strongest fit with Brian's Notion multi-agent win and his memory interests.

### 3. Arena: a deterministic ASCII game environment and benchmark for LLM agent teams
- Pitch: a headless, seeded, turn-or-tick based team strategy game (Bed Wars or RTS-lite) that renders in the terminal, built so LLM agents can play with fair latency budgets. It ships a replay format and a cross-model leaderboard through AI Gateway.
- Trending: Gemini plays StarCraft benchmark (254 HN points), YC Labs Bed Wars Claude vs GPT (part of the 421-point post), the Settlers of Solana style swarm hacks.
- Hard core: a deterministic simulation engine (fixed-point math, seeded RNG, lockstep ticks), an async agent protocol with deadlines (a slow model loses tempo, not correctness), an observation encoder (ASCII grid plus structured JSON) and action validation, replay and spectator mode in Arcade, a tournament runner with Elo or TrueSkill, and team messaging with message-volume metrics.
- Why data is not the bottleneck: the environment generates its own episodes.
- Milestones: (M1) game rules engine with property-based tests for determinism (same seed and actions give the same hash). (M2) scripted baseline bots. (M3) LLM agent adapter via AI SDK and Gateway, with timeouts. (M4) replay format and ASCII spectator. (M5) tournament runner and leaderboard site. (M6) analysis of coordination metrics.
- Benchmarks: models vs scripted baselines, determinism tests, harness overhead, rating stability (confidence intervals over N games).
- Cheap outside contact: invite 3 to 5 people who build agent harnesses to submit agents (YC Labs, the StarSkirmish author). Have friends play human-vs-agent matches.
- 5 week risk: medium. Game design takes time, so copy a known ruleset.
- Impressiveness: 4. Very demoable in 5 minutes.

### 4. Status Lab: OSC 7501 conformance suite, fuzzer and universal agent inbox
- Pitch: the missing test kit for the new terminal status protocol. A conformance suite and fuzzer that runs against real terminals and multiplexers through a PTY, plus a terminal-agnostic ASCII inbox that shows every agent's state across tmux, ssh and containers.
- Trending: the OSC 7501 spec (Oct 6) has about 4,163 GitHub references in a month. There is a real interop bug class: claude-code #105534 (a probe reply that arrives after the DA1 sentinel is dropped), and tmux #5830 is still open. Mitchell's post notes one tool kept 16 heuristic rules to guess Claude Code's state, changed 10 times in 3 months.
- Hard core: a streaming escape-sequence parser that is robust to split writes, a PTY harness driving many emulators (xterm.js headless, libghostty, tmux, zellij, WezTerm), grammar-based fuzzing, a hierarchical record store with lifetime semantics, and probe and feature detection timing.
- Why data is not the bottleneck: it is pure protocol engineering.
- Milestones: (M1) parser plus spec-derived unit tests. (M2) PTY harness and 2 emulator adapters. (M3) fuzzer and differential testing between implementations. (M4) results matrix site. (M5) inbox TUI. (M6) bug reports with minimal repros.
- Benchmarks: conformance matrix across N implementations, number of bugs found, parser throughput vs the xterm.js addon.
- Cheap outside contact: easiest of all eight. Mitchell asked implementers to email him, and maintainers are actively responding on these issues. Filing well-made repro issues counts as outside contact even though the category is not Open Source.
- 5 week risk: low technically. Scope risk: the protocol is small, so the suite and inbox must carry the difficulty. A referee may see it as narrow.
- Impressiveness: 3.

### 5. Forkspace: copy-on-write agent workspaces with per-task undo and parallel attempts (H: GurtOS)
- Pitch: run 8 coding agent attempts on the same repo at once, each in an instant copy-on-write workspace. Score them, keep the winner, undo the rest, and measure the overhead against git worktrees, Docker and microVMs.
- Trending: OpenShell (508 points), MXC (196), Agent37 (163), the sandbox debate. GurtOS shows the demo is feasible.
- Hard core: overlayfs or FUSE layers in Rust, process isolation per task (user namespaces), network allowlist proxy, snapshot and merge semantics, crash-safe journal, and a TypeScript SDK for AI SDK agents.
- Data: none needed.
- Milestones: (M1) overlay layer create, commit and discard with tests. (M2) namespace sandbox runner. (M3) parallel attempt orchestrator plus scorer (tests pass). (M4) network proxy and audit log. (M5) benchmark suite. (M6) SDK and viewer.
- Benchmarks: spawn time, disk use, I/O overhead and undo latency vs git worktree, Docker and Firecracker. Success rate of best-of-N vs single attempt on a fixed task set.
- Outside contact: agent tooling developers. Contact the GurtOS team to compare numbers.
- 5 week risk: high (Linux kernel features, security edge cases). Furthest from Brian's TypeScript strengths.
- Impressiveness: 4.

### 6. Provenance memory: an agent memory layer that never loses the path back to the raw transcript (H: Tekton evidence chain)
- Pitch: a TypeScript memory engine for AI SDK agents in which every extracted fact links to its source spans and keeps temporal versions. Retrieval falls back to raw spans when facts conflict. It is benchmarked head to head against plain RAG, the result the Memory Tax paper says most memory systems lose to.
- Trending: Memory Tax (509 likes), claude-mem at 110k stars, the 30-product memory review.
- Hard core: bitemporal fact store, span-level provenance index, conflict detection, hybrid retrieval planner, incremental compaction.
- Data: public benchmarks (LongMemEval, LoCoMo). Nothing collected. Cost is in tokens, not data work.
- Milestones: (M1) store and ingestion with tests. (M2) baseline RAG. (M3) fact extraction with provenance. (M4) conflict-aware retrieval. (M5) benchmark runner. (M6) inspector UI.
- Outside contact: the Memory Tax authors and the claude-mem maintainer.
- 5 week risk: medium to high. It may not beat RAG. An honest negative result is acceptable under the guide, but the work becomes evaluation heavy, which Brian wanted to avoid.
- Impressiveness: 3.

### 7. Wildcard: Effect Ledger, a Postgres wire protocol proxy that checks what agents claim against what they actually did (H: ARGUS-style verification)
- Pitch: sits between an agent and Postgres, records every statement's real effects (row diffs), compares them to the agent's stated intent, and auto-branches risky transactions for approval or rollback.
- Trending: Deedglass Show HN, Postgres 19 delayed by AI-found bugs (808 HN points).
- Hard core: wire protocol parsing (extended query protocol), transaction-scoped effect capture with logical decoding, intent parsing, savepoint-based branching, and keeping latency low.
- Data: none. Milestones: proxy passthrough, effect capture, intent diff, branching, benchmark (pgbench overhead), viewer.
- Outside contact: a few backend developers who run agents against dev databases.
- Risk: medium. Impressiveness: 3.

### 8. Wildcard: a static recompiler from homebrew Game Boy ROMs to WebAssembly
- Pitch: translate Game Boy machine code ahead of time into Wasm, with an interpreter fallback for self-modifying code, and measure speed against interpreters.
- Trending: PS2 to Wasm (316 HN points), PSP (251).
- Hard core: control flow recovery, jump tables, cycle-accurate timing hooks, Wasm codegen.
- Data: none. Use open homebrew ROMs only (legal caveat).
- Outside contact: the emulation community. Risk: high (accuracy is a long tail). Impressiveness: 4, but it does not use any of Brian's agent strengths.

## 5. Ranking and recommendation

Ranked: (1) Flight Recorder, (2) Crowd LOD agents, (3) Arena, (4) Status Lab, (5) Forkspace, (6) Provenance memory, (7) Effect Ledger, (8) Wasm recompiler.

Top 3 and why:
1. Flight Recorder. It plays to Brian's AI SDK and Gateway knowledge, has a clear "compared to alternatives" benchmark story, mirrors DejaView, and is easy to split into tested modules for overnight Claude Code runs (determinism makes test oracles easy). Outside contact is cheap: developers debugging a planted bug.
2. Crowd. It has the highest ceiling and matches Brian's interests exactly. Two recent hackathon winners hit this exact bottleneck and did not measure it. It needs a token budget and a solid fidelity metric.
3. Arena. It is the most demoable in 5 minutes, reuses the Arcade ASCII strengths, generates its own data, and other agent builders can submit entries.

Fallback if outside contact looks thin by week 2: Status Lab, which has the fastest maintainer responses.

Possible merge: Arena could be the environment Crowd runs in (one engine, two papers). Flight Recorder traces could feed both. Only do this if the team is confident. It doubles scope.

Decide first (before the abstract, Mon Nov 9):
1. By Thu Nov 5: pick between Flight Recorder and Crowd on one question. Do you want the SE 490 story to be "developer infrastructure" or "simulation research"? Each person writes a one-paragraph symposium pitch and you compare.
2. Before writing the abstract, line up 3 outside contacts for the chosen idea (Brian sends these. I sent nothing): for Flight Recorder, 3 AI SDK developers plus one Vercel contact. For Crowd, the YC Labs post authors and 2 hackathon teams.
3. Set the token budget (Gateway credits) and the main benchmark metric in the abstract's "expected results" section.
4. Split the work: one person owns the benchmark harness from day 1, so results build up while Claude Code builds features.

## 6. Caveats
- The X news items are auto-generated summaries, and some numbers there could not be confirmed. Ideas rest on HN points, GitHub data and primary pages checked this turn.
- Prior art moves fast. Re-check "agent replay" and "LOD generative agents" before the abstract.
- Token costs for ideas 2, 3 and 6 are real. Plan with cheap models for baselines.
- The guide warns about code nobody understands. Assign a human owner per milestone, and keep AI-USE.md and the Assisted-by trailers from day 1.
- Prepared with Grok Bot research (web, HN API, GitHub API, X search). Verify key claims against the linked primary sources before citing them in the abstract.
