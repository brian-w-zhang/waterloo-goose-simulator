# 04 Goat Simulator and other games: a feature menu for a campus goose sandbox

Mechanics worth borrowing from Goat Simulator and ten other games, each rated by effort and fun for a 4-person, 128-hour MP3, plus a slapstick-only "Menace" scoring system that blends Goat Simulator chaos with Untitled Goose Game structure.

Facts about games come from their English Wikipedia articles (extracts fetched Nov 2, 2026, linked per row) and the earlier memo [research/goose-game-research.md](research/goose-game-research.md). Effort and fun ratings are my judgement, not sourced.

## 1. Goat Simulator in detail

**Goat Simulator (2014)**, https://en.wikipedia.org/wiki/Goat_Simulator
- Began as a joke prototype in an internal one-month game jam at Coffee Stain Studios (January 2014); Unreal Engine 3 with PhysX and APEX ragdolls; the goat model was a bought asset; the glitchy alpha video went viral.
- Open-ended third-person play as Pilgor in a suburban open world: jump, run, bash, and **lick**: "Licking objects attaches the goat's tongue to the object", so the goat drags or flings anything.
- Score with a **trick multiplier** for chaining actions (Tony Hawk style), optional goals, a slow-motion button, ragdoll on a button.
- **Hidden gold goat statues** unlock **mutators**, toggles that add a mechanic or change the goat (a demon goat, a giraffe and so on).
- Bugs kept on purpose, except crash bugs; a reset button for when you are stuck (Hardcore Gamer GDC 2014, via the earlier memo).

**Goat Simulator 3 (2022)**, https://en.wikipedia.org/wiki/Goat_Simulator_3
- Developed by Coffee Stain North; released November 17, 2022.
- Open world of San Angora, which the developers claim is **18 times larger** than the first game's.
- Lick-to-hitch retained; a new wardrobe for customising the goat (gear packs followed as DLC); a story mode where quests raise you through "the illuminati ranks" to unlock the Goat Castle door.
- **4-player online co-op** with **7 PvP minigames** startable anywhere (The Floor is Lava, Hoofball, Headsplat).
- A customisable **Goat Castle** hub upgraded by completing goals.

Why it works for us: Goat Sim proves an open world can be fun with no story if (1) the body is a toy, (2) every object reacts, (3) the score rewards creativity, and (4) secrets reward exploration. That is exactly the gap a whole-campus open world has to fill between UGG-style enclosures.

## 2. Other games and what to take

| Game | Mechanic (sourced) | Take for the goose | Source |
|---|---|---|---|
| Tony Hawk's Pro Skater (1999) | Combo score depends on air time, rotation, number and **variety** of tricks; repeating a trick in a sequence earns fewer points; a special gauge unlocks a big trick; **bailing loses the combo and empties the gauge**; career levels have 5 objectives in **two-minute** runs, including collecting S-K-A-T-E letters | The Menace combo: variety bonus, repeat decay, "getting caught" bails the combo; 2-minute "class change" runs | https://en.wikipedia.org/wiki/Tony_Hawk%27s_Pro_Skater |
| Hello Neighbor (2017) | The neighbour's AI changes behaviour from past attempts: bear traps on paths used before, bucket traps over doors used, cameras in areas visited often; a "friendly" mode turns traps off; reviews were mixed | Campus security or the groundskeeper learns your favourite routes (cheap heatmap memory); keep a friendly mode | https://en.wikipedia.org/wiki/Hello_Neighbor |
| The Sims (2000) | Sims have needs and, with free will on, interact with the world autonomously; the player can cancel actions in an action queue; Sims may not prioritise needs well and suffer for neglecting them (the "objects advertise what they satisfy" smart-object design is widely described but not in the extract I read) | Students with 3 needs (class, hunger, social) choose objects that advertise satisfaction; drives believable crowds cheaply | https://en.wikipedia.org/wiki/The_Sims_(video_game) |
| Katamari Damacy (2004) | The ball picks up objects smaller than itself and grows; animals such as cats chase the ball and knock things off it until it is big enough to scare them | Gaggle growth: more menace recruits more geese, which lets you scare bigger groups (a progression spine) | https://en.wikipedia.org/wiki/Katamari_Damacy |
| Human: Fall Flat (2016) | Physics grab with each arm; puzzles deliberately left "not really watertight" after watching playtests | Beak grab as a physics joint; leave puzzles loose so creative solutions work | https://en.wikipedia.org/wiki/Human:_Fall_Flat |
| Crazy Taxi (1999) | An arrow guides you; time extensions; "Crazy Box" minigames; players learn the town | A compass arrow to the current task; a city-learning payoff (real campus shortcuts); minigame challenges | https://en.wikipedia.org/wiki/Crazy_Taxi_(video_game) |
| Stray (2022) | Play as a cat; meow and context interactions; minimal UI | A context "honk" and nuzzle-style interactions; diegetic UI | https://en.wikipedia.org/wiki/Stray_(video_game) |
| Overcooked (2016) | Couch co-op chaos with shared tasks | Two-goose co-op later (UGG also added co-op in 2020) | https://en.wikipedia.org/wiki/Overcooked |
| Garry's Mod (2006) | Physics sandbox with no goals; reported as over 20 million copies sold, with a successor (S&box) (from a search summary, **unverified**) | A "sandbox mode" with no tasks, only toys (cheap if the item system is solid) | https://en.wikipedia.org/wiki/Garry%27s_Mod (not fetched) |
| Desktop Goose (samperson) | A goose that wanders your desktop, drags memes and steals the cursor | Proof that "goose as menace" is a widely loved premise; the menace-not-malice tone | https://samperson.itch.io/desktop-goose |

## 3. Feature menu

Effort: **S** about 2 to 6 team-hours, **M** about 8 to 20, **L** 25 or more (of the 128 MP3 hours). Fun: 1 (nice) to 3 (core). "Pri" says whether it belongs in the MP3 slice.

| # | Feature | From | Effort | Fun | Pri | Notes |
|---|---|---|---|---|---|---|
| 1 | Five verbs (honk, grab and drag, crouch, flap, run) | UGG | M | 3 | Must | Without these there is no game |
| 2 | Beak grab as a physics joint, drag heavy items | UGG, Goat Sim lick | M | 3 | Must | Rapier joint; tug-of-war with NPCs |
| 3 | Honk reactions ("?", "!", drop item, shoo) | UGG | S | 3 | Must | Cheapest big laugh |
| 4 | Item ownership and tidy-up | UGG | M | 3 | Must | Makes pranks resettable |
| 5 | Zone to-do list (6 plus 1 gating) | UGG | M | 3 | Must | Data-driven tasks |
| 6 | Menace combo score (section 4) | THPS, Goat Sim | S | 3 | Must | Turns open-world wandering into play |
| 7 | Class-change crowd waves on the real bell schedule | Waterloo data | M | 2 | Should | Uses doc 01's timetable |
| 8 | Goose ragdoll on a button (the goose only) | Goat Sim | M | 2 | Should | Rapier ragdoll; keeps the no-harm tone |
| 9 | Slow-motion replay of the last combo | Goat Sim | S | 2 | Should | Great for the 5-minute video |
| 10 | Compass arrow to the current task | Crazy Taxi | S | 1 | Should | Needed in a 2 km world |
| 11 | Hidden golden goslings that unlock mutators (jetpack goose, giant goose, Emden skin) | Goat Sim | S per mutator | 2 | Should | Exploration reward across the whole campus |
| 12 | Gaggle recruitment (more geese follow as menace grows) | Katamari | M | 3 | Should | Flocking with Yuka steering; scales the chaos |
| 13 | Security or groundskeeper that learns your routes | Hello Neighbor | M | 2 | Could | Heatmap of goose positions; place "No Geese" signs on hot paths |
| 14 | Needs-driven students (class, hunger, social) | The Sims | M | 2 | Should | Cheap utility AI; Jev optional (doc 05) |
| 15 | Timed list ("before the 10:20 change") | UGG, THPS | S | 2 | Should | Uses the bell schedule |
| 16 | Adaptive piano music | UGG | M | 2 | Could | Branching 2-beat chunks |
| 17 | Two-goose local co-op | UGG 2020 update, Overcooked | L | 2 | Could | Split input is easy, camera is not |
| 18 | Online PvP minigames | Goat Sim 3 | L | 2 | Could | Out of MP3 scope |
| 19 | Seasonal mode: nesting season, goose defends a nest | Waterloo | M | 3 | Could | Very Waterloo; good for SE 490 |
| 20 | Sandbox mode (no tasks) | Garry's Mod | S | 1 | Should | Falls out of the item system |
| 21 | Photo mode with campus postcard frames | Stray, Goat Sim videos | S | 2 | Should | Viral clips |
| 22 | Daily challenge seed and leaderboard | Goat Sim, THPS | M | 2 | Could | Needs a backend |
| 23 | Wardrobe items, here with abilities (hard hat: headbutt; graduation cap: tour guides follow you) | Goat Sim 3 wardrobe, abilities are my idea | M | 2 | Could | |
| 24 | Ride the ION or a GRT bus between zones | Waterloo | M | 2 | Could | Real GTFS timetable; fast travel |
| 25 | Interiors through the tunnel and bridge network | Waterloo OSM `indoor` ways | L | 2 | Could | 252 indoor ways mapped |

Suggested MP3 slice: 1 to 6, plus 7, 9, 10 and 14 if time allows. That matches the doc 06 milestones.

## 4. The Menace score

A Tony Hawk style combo system with UGG's no-harm rules. Pure slapstick: inconvenience, surprise, mess, never injury.

### 4.1 Events and base points

| Event | Base points | Notes |
|---|---|---|
| Honk that makes an NPC "?" | 10 | Investigate from a distance |
| Honk that makes an NPC "!" and drop an item | 50 | |
| Steal an item from a hand | 75 | |
| Steal a worn item (hat, glasses) | 100 | |
| Drag an item more than 20 m | 5 per 10 m | |
| Item into water (Laurel Creek, Columbia Lake, a fountain) | 120 | |
| Make an NPC chase you for 10 s | 40 | |
| Lose a chaser by hiding (break line of sight, then crouch in cover) | 150 | Stealth payoff |
| Scatter a group (3 or more NPCs flee one honk) | 60 per NPC | |
| Make an NPC trip, sit down hard or get wet (slapstick, no injury) | 150 | Must play a recover animation |
| Interrupt a scheduled activity (a lecture queue, a tour, a frisbee game) | 200 | |
| Complete a to-do task | 500 | Ends the combo with a bonus |

### 4.2 Combo rules

- A **combo** starts with any scoring event and stays alive while another event happens within **4 seconds**.
- **Multiplier** = 1 + 0.5 x (number of distinct event types in the combo). Variety beats spam.
- **Repeat decay**: the n-th repeat of the same event type in a combo scores `base x 0.6^(n-1)` (THPS-style).
- **Same-target decay**: the same NPC scores at most 3 times per combo, to stop bullying one victim and to keep the tone light.
- **Bail**: if an NPC grabs the goose or takes the item back mid-combo, the combo's pending points are lost (THPS bailing). Being shooed is not a bail.
- **Banking**: points bank when the combo times out or a task completes.
- **Menace meter**: banked points fill a meter that sets world alertness (more "No Geese" signs, faster chasers, security patrols) and unlocks gaggle recruits (feature 12). That turns score into a difficulty curve, as UGG's 5-task escalation does.

### 4.3 Tone guardrails (enforced in code review)

- No injuries, blood, damage numbers or cruelty. Falls are pratfalls with a quick recovery.
- No police; campus "security" only shoos and puts up signs (UGG has deliberately no cops).
- No real person's name or likeness on NPCs; generic archetypes (student, TA, tour guide, groundskeeper, food truck vendor, cyclist).
- No real-world harmful acts as tasks (blocking the ION track, fire alarms). Cones on steps are fine; trains are not.

### 4.4 Example combo

Honk at a tour group (scatter 4: 240), steal the guide's flag (75), drag it 30 m (15), drop it in the Laurel Creek (120), lose the chasing guide behind the hedge (150). Five distinct event types gives a multiplier of 3.5, so (240 + 75 + 15 + 120 + 150) x 3.5 = 2,100 points. If the guide had grabbed the goose before the hedge, the pending 450 points would be lost.

## 5. Open questions for playtests

- Does a score encourage spam honking? Tune repeat decay and the same-target cap with real players.
- How much of the 2 km world should have tasks vs pure sandbox? Start with 3 enclosures plus mutator hunts between them.
- Co-op is very watchable (UGG was "very watchable with friends") but expensive; keep it for SE 490.
