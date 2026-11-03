# Goose on campus: Untitled Goose Game style research for SE 390 MP3

Research memo for the MP3 "Advanced Technology" idea: a browser (three.js WebGPU) game of the University of Waterloo campus built from real map data, drawn in the style of Untitled Goose Game, where you play a Canada goose who terrorizes campus. Researched Nov 2, 2026 (America/Toronto). Companion to `slop-newyork-teardown.md` (map data pipeline) in this folder. Research only; nothing was posted or sent.

How to read this: claims with a link are from that source (fetched this session unless marked). "Observed" means I looked at the official Steam screenshots myself (saved in `raw/goose/ugg_1.jpg` to `ugg_6.jpg`). "Unverified" means I could not open the source. GitHub star counts and push dates come from the GitHub API on Nov 2, 2026 (dates are UTC).

---

## 1. TL;DR

- **The Untitled Goose Game (UGG) look is cheap to imitate and hard to get right.** It is untextured, flat-coloured, low-contrast 3D with no ink outlines, very faint soft shadows, a hint of ambient occlusion, a muted pastel palette, smooth rounded low-poly shapes, faceless "toy people", and a fixed high-angle, narrow-angle camera. The UI is hand-drawn: a paper to-do list, pencil "!" and "?" marks, thought bubbles showing the item an NPC wants, and white cartoon strokes for honks. Most of the charm comes from **animation, sound and palette discipline**, not shaders.
- **Gameplay is a stealth sandbox with a to-do list.** Five verbs (walk/run, honk, crouch/lower neck, flap wings, grab/drag with the beak), each on its own button and freely combinable. NPCs have limited vision cones, discrete AI states, idle routines, remembered item positions, and they tidy up after you, so every prank resets and can be replayed. The music is Debussy cut into hundreds of two-beat chunks that the game plays at high energy, low energy or silence depending on the action.
- **House House built the village from real places** (Orford, Suffolk, scouted on Google Street View), then squeezed and enclosed it for gameplay (GDC 2021 talk). That is the closest precedent for your "accurate campus from real data" idea. It also points at your main design tension: an accurate 1.5 km campus is much emptier than a game level.
- **Goat Simulator adds a sandbox layer:** ragdoll on a button, a tongue that grabs and drags anything, a Tony Hawk style score with combos, slow motion, and bugs kept on purpose. For a goose: a "Chaos" combo score on top of UGG-style to-do lists works well. Keep UGG's tone, where nobody gets hurt.
- **Open source: no good UGG clone exists in three.js, WebGPU or Rapier.** The most complete fan recreation is `jsdf/goose64` (N64 demake, 87 stars, no licence). The closest stack match is `MikeFernandez-Pro/a-goose-tale` (three.js WebGPU with vertex-animation crowds, MIT, 1 star, created Nov 1, 2026). Everything else is tiny or 2D. The useful open source is the **building blocks**: three.js r187 toon materials and `toonOutlinePass`, Rapier, recast-navigation-js or navcat for navmesh crowds, Yuka for vision, memory and state machines, three-vat for crowds, and slop-newyork or slop-singapore for the map pipeline.
- **Waterloo prior art is all small:** 2D runners (Honk n' Hurdle, Goose-Run), jam games (GOOSE DRIFT, Entitled Goose Game), GooseWatch and Waddleloo nest maps, a Minecraft campus. I found **no 3D, real-data, play-as-the-goose campus sandbox**, so the idea looks novel (search-based check, not exhaustive).
- **Feasibility warning:** the course guide budgets **32 h per student, 128 h for a team of 4, for MP3** (`guide.txt`, Time budget). That is about three to four person-weeks of full-time work. Scope it as **one dense, hand-tuned zone (for example DC, MC and SLC) inside a whole-campus toon extrusion**, with one goose, 10 to 30 NPCs and one to-do list. Pick **one** technical claim to benchmark. Section 6 has the plan.

---

## 2. Untitled Goose Game graphics: what the look actually is

Facts: Unity engine, Blender for all modelling and animation, FMOD audio, Git ([Road to the IGF, Game Developer](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-)). Small team: House House is four people (Nico Disseldorp programming; Jake Strasser environment art and level design; Stuart Gillespie-Cook animation; Michael McMaster art direction and graphic design), plus Kalonica Quigley (additional art and animation, "helped us refine the game's look very early on"), Em Halberstadt (sound), Dan Golding (music).

| Aspect | What it is | Source |
|---|---|---|
| Shading | Flat colour blocks, close to unlit. Observed: a subtle two-tone split between lit and unlit faces (deck sides vs tops, water-tank bands), no specular, no gloss, everything matte. | Frieze: "rendered in blocks of colour, a process akin to the cel-shading" ([Frieze](https://www.frieze.com/article/untitled-goose-game-and-why-it-feels-good-be-bad)); [gameartstyles.com](https://gameartstyles.com/game/untitled-goose-game): "Flat / Unlit", "Untextured"; observed |
| Textures | Essentially none. Strasser: "we don't want to texture things". The flat-vector habit came from their earlier JavaScript and 2D game Push Me Pull You. Observed: plank lines, paving and fence slats are **modelled geometry**, not texture. A few surfaces (brick wall at the pub) show simple flat pattern detail. | [GamesRadar preview](https://www.gamesradar.com/untitled-goose-game-preview/); observed |
| Outlines | **No ink outlines on geometry.** The only lines are UI strokes (honk marks, grab highlights). One blog says "thin outline"; the screenshots do not show any. | Katherine Cross: "Everything is lineless" ([Game Developer](https://www.gamedeveloper.com/design/an-untitled-i-untitled-goose-game-i-analysis)); gameartstyles "No outlines"; observed |
| Palette | Muted, desaturated pastels (sage greens, warm greys, dusty brick, cream). The white goose and its orange beak and feet are the highest-contrast thing on screen, so the player always reads first. Critics compare it to Sisley, Spencer, Caulfield and Julian Opie. | Frieze; observed |
| Lighting and shadows | Bright, high ambient; one sun; **shadows very faint and soft** (light grey blobs under props and people); a "whiff" of ambient occlusion in creases (under tables and benches). Community recreations: unlit albedo multiplied by a hard-stepped, low-strength shadow term. | [r/gamedev thread](https://www.reddit.com/r/gamedev/comments/t6ykhr/is_there_a_name_for_this_recently_popular_graphic/), [r/Unity3D thread](https://www.reddit.com/r/Unity3D/comments/mp3hqo/how_to_replicate_the_untitled_goose_game_art_style/) (community guesses, not dev statements); observed |
| Modelling | Low poly but **smooth and rounded**: bevelled edges, subdivided silhouettes, chunky proportions. Grass is small geometry tufts. Shrubs are clean cones and blobs with simple leaf cards. | [r/gamedev](https://www.reddit.com/r/gamedev/comments/dxc3rx/how_to_recreate_the_untitled_goose_game_art_style/) (subdivision tip); observed |
| Characters | Faceless villagers with only a nose, modelled on the miniature people of British kids' TV (Thomas, Postman Pat, Brum, Wallace and Gromit). Readable archetypes, big gestures. | [Nintendo Life interview](https://www.nintendolife.com/news/2019/09/feature_how_a_joke_hatched_gamings_most_horrible_goose); [Red Bull](https://www.redbull.com/us-en/untitled-goose-game-interview) |
| Camera | Fixed angle per area, high pitch looking down, close to the goose; the player can only zoom. It leans toward nearby humans and rotates between areas, which hides shortcuts and separates levels without loading screens. Players found the auto-lean disorienting with several NPCs nearby. Observed: verticals barely converge, so the field of view is narrow (telephoto, near-orthographic feel). My estimate: pitch about 45 to 55 degrees. | [Between the Frames](https://betweentheframes.home.blog/2019/10/09/an-untitled-article-for-untitled-goose-game/); [Nintendo World Report](http://www.nintendoworldreport.com/review/51756/untitled-goose-game-switch-review); [Destructoid](https://www.destructoid.com/reviews/review-untitled-goose-game/); estimate from screenshots |
| Atmosphere | Observed: soft light haze toward the far edge of frame, no heavy fog, no bloom, no colour grading drama. Calm, overcast-bright day. | observed |
| UI | Paper notepad to-do list with hand-written tasks crossed off; menu styled as **UK road signs**; pencil-style "!" and "?" over NPCs; **thought bubbles** with the wanted item drawn inside; white cartoon strokes for honks and noisy items; white lines around grabbable items. | [Atomic Bob-Omb UI essay](https://atomicbobomb.home.blog/2019/10/12/untitled-goose-game-and-ui/); Frieze; observed |
| Behind-the-scenes tricks | UI textures and to-do pages are stored as objects **under the map**; the wings sit **scaled down inside the goose body** and scale out when you flap; broken mugs are teleported off-map; a broom head "teleports" into the beak when you rip it off; a waterfall is a spinning textured cylinder; the house interior chaos is sound only. | [DTF breakdown (Russian), summarising Shesez's camera-hack video](https://dtf.ru/gamedev/78372-kak-untitled-goose-game-ustroena-za-kadrom) |
| Post-processing | No official breakdown found. Observed: anti-aliased, no bloom, no depth of field in gameplay, AO present. Treat as "AO plus AA, nothing else" (my inference). | observed; unverified |

### Animation (goose and people)
- **Goose first.** Strasser modelled the goose on day one and made a walk cycle soon after, while learning to animate; the reference was YouTube footage of the Dutch "Ganzenfanfare" geese marching through towns ([Panic Podcast transcript](https://podcast.panic.com/episodes/s01e01/transcript/), [GamesRadar](https://www.gamesradar.com/untitled-goose-game-preview/)). Gillespie-Cook became the animator partway through.
- **Hybrid animation:** "a mix of physics-driven procedural interaction and bespoke animations", for example the head extending to grab keys from a waistband or yank carrots ([Polygon, GDC 2018](https://www.polygon.com/2018/3/26/17157644/untitled-goose-game-preview-gdc-2018-day-of-the-devs/)).
- **IK look-at was the "a-ha":** Strasser rigged the goose and the groundskeeper with inverse kinematics so they turn their heads to look at each other at a certain distance. "That simple bit of IK injected so much humanity into the game" (McMaster, [VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/)).
- **Neck as a control:** holding the trigger bends the neck down (run neck-low or walk neck-high, as real geese do); low-level reaching can be fumbled, which is funny ([GamesRadar](https://www.gamesradar.com/untitled-goose-game-preview/)). Disseldorp calls the controls "1 percent QWOP" ([Behind the HONK](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a)).
- **Wings:** flap scales the hidden wing meshes out of the body (DTF breakdown above). **Feet:** the "fwap" is a rubber glove slapped on surfaces ([A Sound Effect](https://www.asoundeffect.com/untitled-goose-game-sound/)).
- People react with exaggerated full-body gestures (chin stroking, shooing, groping for glasses); state changes have dedicated reaction animations ([Behind the HONK](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a)).

### Recipe: the UGG look in three.js (WebGPU and TSL)
My suggested starting values; tune by eye against the Steam screenshots.
1. **Material:** `MeshToonNodeMaterial` (or a custom TSL node) with a 2-step ramp: lit = base colour, shadow side = base colour multiplied by about 0.85 and nudged slightly cooler. No specular, no environment map, no normal maps. Smooth normals on rounded props, flat normals on architecture.
2. **Light:** one `DirectionalLight` plus a strong `HemisphereLight` (sky cream, ground sage). Set `light.shadow.intensity` to about 0.2 to 0.3 (a real property in three.js r187 `LightShadow`) with soft PCF, so shadows read as faint grey blobs.
3. **AO:** `GTAONode` or `SSAONode` (both ship in three.js `examples/jsm/tsl/display/`) at half resolution, low strength; or bake AO into vertex colours offline (cheaper and steadier).
4. **No outlines by default.** If campus scale hurts readability, use a low-alpha, same-hue edge pass rather than black ink (see section 5.4).
5. **Camera:** `PerspectiveCamera` with a narrow FOV (about 20 to 30 degrees), pulled far back; fixed yaw per zone; scroll to zoom; a damped spring follow; a gentle lean toward the nearest alerted NPC (cap it, since reviewers hated the jitter).
6. **Colour management:** neutral tone mapping (or none), slightly lifted blacks, palette locked to 8 to 12 swatches per zone; the goose is the only pure white.
7. **Atmosphere:** pastel distance fog matched to the sky colour; desaturate with distance.
8. **UI in the same hand:** an SVG or Canvas notepad, pencil marks, thought-bubble sprites rendering the item's own mesh, white stroke "honk" sprites.

---

## 3. Gameplay

### 3.1 The goose's verbs and why they work
- Verbs are "the things we thought a goose does: honking, running, moving their neck, flapping their wings" ([Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-)). Wikipedia lists the actions as honk, duck down, run, flap wings, and grab objects with the beak ([Wikipedia](https://en.wikipedia.org/wiki/Untitled_Goose_Game)).
- **One button does one clear thing, and all combine independently** (waddle with wings in and neck down, or run with head up and wings out). They dropped Mario 64 style "weird moves" (for example rolling on the ground) because clearer controls made players play performatively ([Game Developer, Mario 64 article](https://www.gamedeveloper.com/design/how-i-mario-64-i-inspired-that-horrible-goose-s-moveset)).
- Grab and drag: light items are carried in the beak; heavy items are dragged, with surface-specific drag sounds. Crouch hides you behind plants and in boxes; honking makes noise that pulls attention; walkie-talkies "throw" a honk.
- **Rules of goose plausibility:** the goose can pick things up, move them, and hit simple switches (turn on a tap), but cannot combine items or act too cleverly ("a goose can turn on a tap, but it can't put a key in a lock"). Once they decided the goose could not use the groundskeeper's keys, they held that rule for the whole game ([VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/)).

### 3.2 Task structure
- The village is **five contiguous areas**: Garden, High Street, Back Gardens, Pub, Model Village. Each has a **to-do list**. Doing enough tasks unlocks a starred "gating" task that opens the next area. One-way "Dark Souls doors" later reconnect everything ([Wikipedia](https://en.wikipedia.org/wiki/Untitled_Goose_Game); [GDC 2021 talk](https://www.youtube.com/watch?v=cCsMz5tUXmc)).
- Examples: rake in the lake, make the groundskeeper hammer his thumb, trap the shopkeeper in the garage, make someone buy back their own stuff, break the vase, drop a bucket on the burly man ([ScreenRant](https://screenrant.com/untitled-goose-game-complete-walkthrough-guides-tasks/), [Game Developer analysis](https://www.gamedeveloper.com/design/an-untitled-i-untitled-goose-game-i-analysis)).
- Finale: steal the golden bell from the model village and carry it home through every area while villagers try to stop you. After that come extra lists (named "To Do (as well)", "To Do (quickly)" with timers, "To Do (finally)" per the fan wiki; the wiki page returned 403, so the names are from search snippets) and a crown for completing everything ([Wikipedia](https://en.wikipedia.org/wiki/Untitled_Goose_Game)).
- Puzzles came from a **"big list of gags"** of slapstick clichés ("Steal someone's glasses, they grope around on the ground for them"). Each area started as a setting plus a focus (Back Gardens: play two neighbours off each other "like in Yojimbo"), then gags were fitted in ([Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-); [VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/)).
- **Every puzzle self-resets** because people tidy up after the goose, so pranks can be retried and enjoyed again ([VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/); [Behind the HONK](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a)).

### 3.3 NPC AI
From Disseldorp ([Behind the HONK](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a); [Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-)):
- They grew one NPC (the groundskeeper's precursor) bottom-up. First: items the goose can steal, and the NPC chases the goose to get them back. Then **idle loops** where people use their items, **reaction animations** on state transitions, **vision cones** ("very limited vision"), **remembered positions** of items, and **thought bubbles**.
- "Very discrete AI states for when characters had noticed something missing or had spotted the goose."
- Spotted but not doing anything wrong: the NPC just stares (maybe strokes its chin). Spotted stealing or trespassing: "!" and a chase or shoo ([Atomic Bob-Omb](https://atomicbobomb.home.blog/2019/10/12/untitled-goose-game-and-ui/)).
- Early idea was a "big clockwork system of dozens of little faceless people" on schedules; it became intimate and small-cast instead ([VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/)). **Lesson for campus:** a crowd of hundreds is atmosphere; the comedy comes from a few NPCs with real state machines.
- Weak spot: reviewers found NPC priorities between tidying and routine hard to predict ([Nintendo World Report](http://www.nintendoworldreport.com/review/51756/untitled-goose-game-switch-review)).

A minimal NPC state machine to copy (my synthesis of the above): `Routine(idle loop, schedule) -> Notice(goose seen in cone | honk heard | item missing) -> React(anim: "!" or "?", stare) -> {Chase(goose holds my item) | Shoo(goose in my zone) | Search(go to remembered item pos, thought bubble) | Retrieve(pick item up) } -> Return(put item back at home pos) -> Routine`. Per NPC data: home zone, owned items with home positions, vision cone (angle, range, occlusion raycast), hearing radius, fear or annoyance meter, list of gag hooks.

### 3.4 Physics
Props are rigid bodies you can carry, drag and knock over. Props can be tug-of-warred with NPCs (players discovered you can break the broom that way). The design rule: if something "should" work in one case, make it work in similar cases, to keep players believing their silly ideas will work. They also left non-interactive objects (the red lawnmower) to calibrate expectations ([Behind the HONK](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a)). The goose's official website background (three.js + cannon.js toy props colliding with HTML elements) was built by Little Workshop, which shows the props reading well in three.js ([Little Workshop](https://littleworkshop.fr/projects/untitled-goose-game/)).

### 3.5 Sound and music
- **Honk:** placeholder in the first day or two. The 2017 trailer honk was actually a duck quack from a freesound field recording. The final honk is short, neutral and from a library, so players project emotion onto it, and it is spammable. The mix keeps the honk "above most of the sounds" ([FMOD interview](https://www.fmod.com/blog/untitled-goose-game-interview); [VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/); [Gameplay podcast](https://gameplay.co/untitled-goose-game-music-sound-design/), search snippet only).
- **Props:** about 160 unique objects, each with grab, release, impact and drag sounds recorded on concrete, grass and wood. Impact pitch and volume follow a velocity parameter (RTPC). Special honks: an echo down the well (FMOD snapshot), harmonica, walkie-talkie static, a muffled honk through a bottle. Area ambience layers fade in and out by position ([FMOD](https://www.fmod.com/blog/untitled-goose-game-interview); [A Sound Effect](https://www.asoundeffect.com/untitled-goose-game-sound/)).
- **Adaptive music:** Dan Golding recorded each Debussy Prélude twice (normal and "low energy") and cut both into **hundreds of files of about two beats each**. Code picks the next chunk as high energy, low energy or a pause, so it "feels a lot like someone is watching your game and playing the piano for you". Long silences leave space for the soundscape ([Behind the HONK](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a); [FMOD](https://www.fmod.com/blog/untitled-goose-game-interview)). Academic analysis: [Journal of Sound and Music in Games](https://online.ucpress.edu/jsmg/article/2/1/1/115922/Finding-Untitled-Goose-Game-s-Dynamic-Music-in-the) (403 for me, unverified). **Web Audio port:** pre-cut stems plus a scheduler on `AudioContext.currentTime`. Debussy's compositions are public domain but **recordings are not**, so record your own, use CC0 or public-domain recordings, or synthesize piano (licence check needed).

### 3.6 Why it is fun (what to copy)
1. A grounded, mundane world as the straight man, so the player controls comic timing ([GDC 2021](https://www.youtube.com/watch?v=cCsMz5tUXmc)).
2. A body that is fun to puppet: performative, combinable verbs, slightly fumbly.
3. Stealth tropes inverted: you are trying to be noticed at the right moment ([GamesRadar](https://www.gamesradar.com/untitled-goose-game-preview/)).
4. Clear goals with open solutions (the to-do list), and the gags reset so you can replay them.
5. Very watchable with friends on the couch ([Game Developer analysis](https://www.gamedeveloper.com/design/an-untitled-i-untitled-goose-game-i-analysis)).
6. "Kind-hearted cruelty": no one gets hurt, and no violence escalation the way GTA has (Disseldorp, [Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-)). There are deliberately no cops ([VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/)).

### 3.7 Goat Simulator mechanics
- Started as a joke prototype in an internal one-month jam (January 2014). Unreal Engine 3 with PhysX and APEX destruction and ragdolls; the goat model was bought for under $20; the glitchy alpha video got over a million views in two days ([Wikipedia](https://en.wikipedia.org/wiki/Goat_Simulator)).
- **Tongue:** a grappling-hook extension, "a bone in the tongue that is hooked to any object you want to grab", then drag or fling ([Game Developer, Ibrisagic](https://www.gamedeveloper.com/business/goat-simulator-s-use-of-unreal-engine-3-and-physx-for-very-fast-game-development)).
- **Ragdoll on a button** at any time, **slow motion** button, trampolines and fans for stunts, a **Tony Hawk style score** where chaining actions builds a multiplier, optional goals (height, flips, destroy X), hidden collectibles that unlock **mutators** (jetpack and so on) ([Wikipedia](https://en.wikipedia.org/wiki/Goat_Simulator)).
- "It's kinda like a skating game except instead of skates you're a goat, and instead of tricks you do stupid s***." Bugs are kept on purpose ("part of the fun"); a button teleports you out when stuck ([Hardcore Gamer, GDC 2014](https://hardcoregamer.com/previews/gdc-14-flipping-flopping-and-flailing-in-goat-simulator/79186/)).
- Design motto: "try really hard to make it look like you're not trying too hard"; no project plan; designers scripted features directly in the engine.

### 3.8 What translates to a goose on the UW campus
| Mechanic | Source | Campus version (ideas, not researched facts) |
|---|---|---|
| Honk, flap, crouch, grab, drag, run | UGG | Same five verbs, one button each. Hiss as a hold-honk variant (real Canada geese hiss; CBC quotes students being hissed at). |
| Zone to-do lists plus a gating task | UGG | Zones such as the Math/DC quad, SLC and the Great Hall, the Engineering block (E5/E7), Village 1 and REV, Ring Road and the ION stop, Dana Porter. Example tasks: steal a WatCard and drop it in Laurel Creek; make someone miss the ION train; honk in a silent study space; steal a hard hat; get chased around Ring Road; "attend" a campus tour. |
| NPC routines, vision cones, tidy-up | UGG | Students walking between classes on a real timetable (bell-schedule waves), a groundskeeper, a campus tour guide, a food truck vendor, cyclists. |
| Adaptive piano | UGG | Same stem system with your own recordings. |
| Chaos score with combos, slow-mo replay | Goat Sim | A "Menace meter": chain honk, steal, scatter into a combo multiplier; a daily leaderboard (a viral hook). |
| Ragdoll | Goat Sim | Ragdoll **the goose** (hit by a bike, falls off stairs), not the students. Keep UGG's no-harm tone. |
| Tongue grapple | Goat Sim | Neck-stretch "grab and swing" on light props only. |
| Hidden collectibles and mutators | Goat Sim | Hidden golden goslings unlock skins (Emden goose, "Mr. Goose" hat). |
| Seasonal mode | Waterloo | Nesting season (March to May): defend a nest; nest spots seeded from Waddleloo-style hotspots near V1 and REV ([UW news](https://uwaterloo.ca/computer-science/news/new-website-help-you-duck-duck-goose-campus)). |
| Real-data world | UGG GDC talk plus slop-newyork | Accurate macro layout; hand-placed dense "set pieces" where play happens. |

**IP caution:** take the look and the ideas, not the assets, names, notepad art or exact UI. McMaster said they rejected a Canada goose skin because "ours is a game about THIS goose" ([VICE](https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/)). A Canada goose on a Canadian campus is your own character, so lean into it.

---

## 4. Open source: spinoffs, clones and building blocks

### 4.1 Goose game recreations and spinoffs
| Repo or page | Stars | Licence | Engine and language | What is in it | Last push | Notes |
|---|---|---|---|---|---|---|
| [jsdf/goose64](https://github.com/jsdf/goose64) | 87 | none (all rights reserved) | C/C++, N64 SDK; also a desktop OpenGL build | UGG demake for Nintendo 64: ROM, Blender scripts for level positions and collision, Lua model export, sprite tools | 2023-12-03 | Most complete fan recreation. Good to read for goose controls and level structure; cannot reuse the code (no licence). |
| [MikeFernandez-Pro/a-goose-tale](https://github.com/MikeFernandez-Pro/a-goose-tale) ([play](https://mikefernandez-pro.github.io/a-goose-tale/)) | 1 | MIT (third-party models keep their own terms) | TypeScript, three.js `WebGPURenderer` with WebGL2 fallback, pnpm, headless tests | A gander carrying a torch gathers goslings at night; a rat swarm runs as **vertex animation textures** (three-vat); route editor | 2026-11-02 | **Closest stack match** (WebGPU, crowds, tests). Created Nov 1, 2026, so very new. Not UGG gameplay. |
| [GiwbyAlbatross/untextured-moose-game](https://github.com/GiwbyAlbatross/untextured-moose-game) | 0 | custom (LICENCE.md, "NOASSERTION") | Godot, GDScript | UGG/Goat Sim fan game with a moose; rigged moose .blend/.glb; textured trees | 2025-09-27 | Early stage. |
| [ariaz123git/geeked-geese](https://github.com/ariaz123git/geeked-geese) | 0 | MIT | Godot 4 | Physics comedy flying a **Canada goose** flock; design doc, CLAUDE.md, many WAVs (honks, hiss, flaps, human yelps) | 2026-10-12 | Agent-built; audio provenance unknown, so check before reusing any sound. |
| [Darcys-vengance-games/silly-goose](https://github.com/Darcys-vengance-games/silly-goose) | 4 | none | Godot | "HONK HONK goose go brrr" | 2026-03-02 | Not inspected. |
| [pressxtohonk/goose-game](https://github.com/pressxtohonk/goose-game) | 0 | none | TypeScript, 2D HTML/CSS sprites | Sprite goose walking on grass | 2026-02-23 | Toy. |
| [jlengstorf/honkify](https://github.com/jlengstorf/honkify) ([demo](https://honkify.netlify.app/)) | 133 | none | JavaScript | Script that makes links honk on any website | 2019-10-07 | Meme-level. |
| [Goose On The Loose (ferridian)](https://ferridian.itch.io/goose-on-the-loose), [jam page](https://itch.io/jam/godot-wild-jam-88/rate/4138456) | n/a | source "N/A" | Godot 4.5.1 | Goose spreading chaos over a small city using momentum, destruction and **ragdolls**; tasks; jam ranks #46 for fun and graphics | 2025 jam | Closest **gameplay** match (UGG + Goat Sim). Players complained about tank controls and the camera. |
| [Goose On The Loose (Bupio)](https://bupio.itch.io/goose-on-the-loose), [Goose Goose Go](https://comfyrainworm.itch.io/goose-goose-go) | n/a | not stated | HTML5 | Small browser goose games (honk and steal) | n/a | Pages load (HTTP 200); not played. |
| [Desktop Goose (samperson)](https://samperson.itch.io/desktop-goose) | n/a | closed freeware | n/a | A goose that wanders your desktop and steals your cursor | n/a | Famous "menace goose" prior art. |
| Mods: [HonkAPI](https://github.com/s1mplysalt/HonkAPI) (GPL-3.0), GooseTools, DevGoose | 4 to 7 | mixed | C# (Unity/Mono) | Modding frameworks for the real game | 2024 to 2026 | Shows UGG is a moddable Unity build; not useful for your build. |
| `webporting/Untitled-Goose-Game`, `web-ports/untitled-goose-game` | 2 | none | Unity WebGL | **Unofficial web ports of the commercial game** | 2026 | Do not use, link or demo; likely infringing. |

Search terms run on the GitHub API: "goose game" (1,065 results, mostly the "Game of the Goose" board game), "untitled goose game" (57), "goose simulator" (23, mostly IEC 61850 GOOSE substation tools), "goose three.js", "goose threejs", "goose godot", "goose bevy" (0), "goose babylon" (0), "goose unity honk" (0), "honk goose", "goat simulator" (104, none are real clones), "goose webgl", "canada goose game", "goose procedural animation" (0). Raw results are in `raw/goose/s_*.json`. **Conclusion: no three.js, Babylon, Bevy or Rapier UGG-style game with real source exists.** You would build the game layer from parts.

### 4.2 Building blocks (verified on GitHub, Nov 2, 2026)
| Need | Repo | Stars | Licence | Notes |
|---|---|---|---|---|
| Renderer, toon material, outline pass | [mrdoob/three.js](https://github.com/mrdoob/three.js) r187 | 117k | MIT | `MeshToonNodeMaterial`, `src/nodes/display/ToonOutlinePassNode.js` (inverted-hull style outline for toon materials), `GTAONode`, `SSAONode`, `SobelOperatorNode`, `OutlineNode`; examples `webgpu_materials_toon.html`, `webgpu_postprocessing_outline.html`; `CCDIKSolver` |
| Physics | [dimforge/rapier.js](https://github.com/dimforge/rapier.js) | 698 | Apache-2.0 | Now migrated into `dimforge/rapier` (typescript folder). Has a kinematic [character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), joints for ragdolls, WASM SIMD build |
| Character controller (R3F) | [pmndrs/ecctrl](https://github.com/pmndrs/ecctrl), [pmndrs/BVHEcctrl](https://github.com/pmndrs/BVHEcctrl), [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier) | 811 / 141 / 1,524 | MIT | Only if you use React Three Fiber |
| Navmesh and crowds | [isaac-mason/recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js); [isaac-mason/navcat](https://github.com/isaac-mason/navcat) | 435 / 300 | MIT | Recast/Detour in WASM with crowd simulation; navcat is pure JS |
| Game AI | [Mugen87/yuka](https://github.com/Mugen87/yuka) | 1,461 | MIT | `StateMachine`/`State`, steering behaviours, **perception: vision and memory** modules, goal-driven agents. Very close to UGG's NPC needs |
| Crowd animation | [MikeFernandez-Pro/three-vat](https://github.com/MikeFernandez-Pro/three-vat) | 4 | MIT | Vertex animation textures, thousands of instanced characters in one draw call (new; low stars) |
| Spatial queries | [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 3,549 | MIT | Fast raycasts for vision cones and camera occlusion |
| Post (WebGL path) | [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing); [OmarShehata/webgl-outlines](https://github.com/OmarShehata/webgl-outlines) | 2,935 / 415 | Zlib / MIT | Outline write-up and code (normal plus depth edges) |
| IK | [jsantell/THREE.IK](https://github.com/jsantell/THREE.IK) ([site](https://jsantell.com/three-ik/)) | 591 | MIT | FABRIK for three.js; stale since 2023, so port the idea to your own 50-line solver |
| Map pipeline | [mrdoob/slop-newyork](https://github.com/mrdoob/slop-newyork), [zz85/slop-singapore](https://github.com/zz85/slop-singapore), [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl) | 459 / 0 / 1,110 | MIT | See `slop-newyork-teardown.md`; streets-gl is a mature OSM 3D renderer to compare against |

### 4.3 Technical write-ups worth reading
- **Procedural animation primer:** [WeaverDev, "Making Bonehead"](https://weaverdev.io/projects/proc-anim-tutorial/) covers head tracking with clamped look rotation, smoothing, and a stepping-leg system (Unity; the concepts port directly).
- **IK in three.js:** [polyfork, "legs that find the ground"](https://polyfork.dev/blog/inverse-kinematics-three-js); [FABRIK creature skeletons](https://mytekdev.com/explorations/creature-skeletons/) (search result, not opened); three.js `CCDIKSolver`.
- **Active ragdolls:** [sergioabreu-g/active-ragdolls](https://github.com/sergioabreu-g/active-ragdolls) (Unity, Apache-2.0, 365 stars); the idea maps to Rapier joints with motors.
- **Toon in three.js:** [MeshToonMaterial docs](https://threejs.org/docs/pages/MeshToonMaterial.html), the WebGPU toon example, and the toon outline pass PR [#29483](https://github.com/mrdoob/three.js/pull/29483) (PR page timed out; the file is confirmed in the source tree).
- **NPC state machines:** Yuka's FSM and perception classes; UGG design notes in section 3.3.
- **Level design from real places:** [Jake Strasser, GDC 2021, "Google Maps, Not Greyboxes"](https://www.youtube.com/watch?v=cCsMz5tUXmc) ([GDC Vault](https://www.gdcvault.com/play/1027183/Google-Maps-Not-Greyboxes-Digital)). The full transcript was read. Key points: the village is a collage of **Orford, Suffolk** (shops on Pump Street, the pub from the Crown and Castle, the model village castle) plus Thaxted dressing; Street View capture dates were mined for props; one month per first-pass level; real geography was **bent for gameplay** (enclosed edges, a curve to focus play); the garage "already in the location" became the shop's gating puzzle.

---

## 5. Waterloo goose prior art (inspiration and novelty check)

| Project | What | Link | Status |
|---|---|---|---|
| Waddleloo (2026) | Crowd-sourced goose map with "safe route" routing; YOLOv8 plus Gemini Vision rate photos low, moderate or high risk; hotspots near V1 and REV; 200k social views in 10 days; expanded to Laurier | [waddleloo.com](https://www.waddleloo.com/), [UW CS news](https://uwaterloo.ca/computer-science/news/new-website-help-you-duck-duck-goose-campus), [CBC](https://www.cbc.ca/news/canada/kitchener-waterloo/avoid-the-honk-interactive-map-helps-waterloo-students-stay-away-from-canada-geese-9.7151994) | Live (200) |
| GooseWatch (UW, James McCarthy, Mapping Analysis and Design) | Mapbox-GL nest map; **routable network built from OSM**; routes by comfort level | [FAST page](https://fast.uwaterloo.ca/goosewatch/), [CBC 2017](https://www.cbc.ca/news/canada/kitchener-waterloo/goose-watch-university-of-waterloo-canadian-geese-1.4063509) | goose-watch.uwaterloo.ca no longer resolves; stopped after COVID (CBC) |
| UW Open Data "goosewatch" endpoint | Old v2 API resource for nest locations; used by [christoffles/goose-locator](https://github.com/christoffles/goose-locator) and [alykhank/GooseWatch](https://github.com/alykhank/GooseWatch) (iOS, MIT, 2013) | [api-documentation](https://github.com/uWaterloo/api-documentation/blob/master/v2/resources/goosewatch.md) | Doc page empty now; historical |
| Honk n' Hurdle | Unity HTML5 2D pixel runner: the goose chases a student past campus buildings | [itch](https://janeyao.itch.io/honk-n-hurdle), [repo](https://github.com/janeya0/honk-n-hurdle) | Live |
| Goose-Run (CS Club game channel) | Lane runner; "geese have unionized against your GPA", reach PAC | [CSC](https://csclub.uwaterloo.ca/game-channel/goose-run-game/) | Live |
| GOOSE DRIFT (UW Game Dev Club Fall 2026 jam) | Top-down goose racing "on the UWaterloo Campus"; downloadable .exe; AI-assisted graphics | [itch](https://vedpurohit.itch.io/goose-drift), [jam entry](https://itch.io/jam/university-of-waterloo-fall-2026-game-jam/rate/5102691) | Oct 2026 |
| Entitled Goose Game (UW Game Jam 2025) | Unity, Win64 zip | [repo](https://github.com/Anthony3141/Entitled-Goose-Game-Unity) | 2025 |
| Nesting Season (2016 to 2017) | "The Waterloo Campus is under attack by geese... YOU are the goose"; Unity 5 mobile snake-like | [repo](https://github.com/Andy-H-Nguyen/nesting-season) | Old |
| GooseHopper, Goosenstein (HackWATERLOO 2014), Goose Apocalypse (EngHack), MakeCode waterloo-goose-game | Small 2D or text games | [GooseHopper](https://github.com/Kyliejoycodes/GooseHopper), [Goosenstein](https://github.com/Uberi/Goosenstein), [waterloo-goose-game](https://brucew5978.github.io/waterloo-goose-game/) | Old |
| UW Minecraft campus (Engineering Orientation 2020) | Campus with topography and interiors from Google Maps and floor plans | [The Record](https://www.therecord.com/news/waterloo-region/uw-takes-its-orientation-week-online-in-light-of-covid-19/article_8300ab46-ca42-5cd8-8a23-7a1cad395958.html) | Unverified (429 on fetch; search snippet only) |
| Ron Eydt Village Minecraft map | REV with interiors | [Planet Minecraft](https://www.planetminecraft.com/project/ron-eydt-village-university-of-waterloo-early-access/), [r/uwaterloo](https://www.reddit.com/r/uwaterloo/comments/1jsxs0p/ron_eydt_village_university_of_waterloo_early/) | Unverified (403) |
| Waterloo Desktop Goose | macOS desktop goose (Swift, MIT, Oct 2026) | [repo](https://github.com/alyssadong2006/Waterloo-Desktop-Goose) | New |

Culture hooks for the pitch and video: Canada geese are federally protected (Migratory Birds Convention Act), so nests cannot be moved and students route around them; the viral Laurier goose-in-a-building video (CBC); the "Mr. Goose" admissions meme ([ChanceMeMrGoose](https://github.com/WilliamUW/ChanceMeMrGoose)). Over 60,000 breeding pairs in southern Ontario in 2025 (CBC, citing Government of Canada).

**Novelty verdict:** every Waterloo goose game found is 2D, a runner, a racer, or a jam prototype. None uses real GIS data, 3D campus geometry, stealth NPCs or a UGG-style sandbox. GOOSE DRIFT (Oct 2026) is the closest; it is a top-down racer.

---

## 6. Technical challenges, the Advanced Technology angle, benchmarks and feasibility

### 6.1 Hard problems in a browser version
1. **Scale versus density.** UGG is a tiny, packed village; the campus bbox is about 1.7 km by 1.4 km (`slop-newyork-teardown.md` section 7). Accurate data gives you lots of empty lawn and parking. Fix: accurate macro layout everywhere, plus 2 or 3 dense hand-tuned "set piece" zones; procedural prop scattering from OSM tags (`amenity=bench`, `bicycle_parking`, `waste_basket`, trees from the City inventory).
2. **Camera and occlusion.** A high fixed camera works in a low village; campus buildings are 3 to 12 storeys. You need per-zone camera rigs plus see-through: dither-fade or cut away building parts between camera and goose (raycast with three-mesh-bvh), and silhouette the goose behind walls.
3. **Procedural goose animation.** Neck chain (6 to 8 bones) solved by FABRIK or CCD toward a head target (look-at, grab, honk lunge); 2-bone leg IK with foot planting and a step trigger on stride distance; body bob, roll and lean from velocity; wing scale-out and flap; spring-damped secondary motion. Hardest part is **feel**, not maths.
4. **NPC crowds with real AI.** Hundreds of walkers (instanced, VAT-animated, Detour crowd on a navmesh baked from sidewalks and paths) plus 10 to 30 "smart" NPCs with vision cones (raycasts), hearing (honk radius), memory, item ownership and tidy-up. LOD the AI: full FSM near the goose, timetable-driven flow far away.
5. **Physics budget.** Rapier WASM: hundreds of sleeping props, a few dozen awake; kinematic goose controller; NPC capsules; optional goose ragdoll. Grabbing by joint (Goat Sim's "bone hooked to the object").
6. **Stylized buildings from footprints** (5.4 below) without texture work, plus terrain from the DTM (Laurel Creek valley, ring road slope).
7. **Load and memory:** world as a compact binary (NYB1-style packer from slop-newyork), gzip or brotli; target under about 10 MB for first play.
8. **WebGPU coverage:** keep `WebGPURenderer` with its automatic WebGL2 fallback, and benchmark both. Exact browser support per OS is unverified; check caniuse at build time.
9. **Audio:** Web Audio stem scheduler for adaptive piano; per-surface impact and drag sounds with velocity mapping; a honk that always sits on top of the mix.
10. **Data licences:** OSM is ODbL (attribution, share-alike on derived databases); City of Waterloo Open Data Licence; UW Geospatial Centre CAD is academic-use and likely not redistributable, so use it only as **private ground truth for evaluation** if the agreement allows (check). Ontario lidar licence: likely Open Government Licence (unverified).

### 6.2 Framing it as Advanced Technology
The handbook rubric (§14.2.5) asks you to show "a problem was solved convincingly" with excellence on importance, technical difficulty and scope, novelty, and multi-course knowledge, and suggests **comparing the solution to the alternatives** (`se-capstone-handbook.pdf`, p. 175 to 176). Engineers judge it, so lead with measurable tech, with the goose as the demo.

Suggested thesis: **"A GIS-to-playable-world compiler: turn open map data for a real place into a stylized, physics-enabled, NPC-populated game world that runs at 60 fps in a browser, with measured geometric fidelity."** The goose game is the showcase. Alternatives to compare against: plain OSM extrusion (OSM Buildings / streets-gl style), slop-singapore's generic pipeline, and a hand-modelled Blender scene (time cost).

Pick **one primary claim** for MP3 (128 h). Options:
- **A. Fidelity pipeline (most "engineering").** OSM + City footprints + lidar heights, then cleaned, stylized, navmesh-ready geometry.
- **B. Browser runtime at scale.** Stylized WebGPU renderer + Rapier + crowd AI holding 60 fps on a laptop iGPU.
- **C. Procedural goose animation.** Measurably natural with zero keyframes.

### 6.3 Benchmarks (measurable, demo-friendly)
| Area | Metric | How | Example target (set your own after a baseline) |
|---|---|---|---|
| Map fidelity | Footprint IoU and centroid error vs City of Waterloo footprints (and UW CAD privately) | Rasterise both at 0.5 m; per-building IoU | median IoU at least 0.9 |
| Heights | Roof height MAE and RMSE vs lidar DSM minus DTM | Per-footprint median | MAE under 1.5 m; versus about 3 m/level from `building:levels` only |
| Coverage | % of campus buildings with real height, name, style class | Count | 100% height, 90% named |
| Paths | Walkway network completeness vs OSM footways; routing success between all building entrances | Graph tests | 100% entrances reachable |
| Pipeline | Build time and output size | CI timing | under 5 min; world under 5 MB gz |
| Load | Bytes to first frame; time to interactive on 50 Mbps, cold cache | Lighthouse or WebPageTest-style runs | under 10 MB, under 5 s |
| Frame time | p50, p95, p99 ms at 1080p on 3 devices (M-series Mac, Intel Iris Xe laptop, mid gaming GPU), WebGPU vs WebGL2 | In-game profiler, scripted camera path, 60 s runs | p95 under 16.7 ms on iGPU |
| Draw calls and memory | Calls per frame, GPU memory | `renderer.info` | under 300 calls |
| NPC scale | Max animated NPCs (VAT plus crowd) at 60 fps; smart-NPC AI cost (µs per agent per tick) | Scripted sweep (100, 250, 500, 1,000) | 500 walkers plus 30 smart NPCs |
| Physics | Rapier step time vs awake bodies; max props | Sweep | 2 ms at 200 awake bodies |
| Animation quality | Foot skate (cm per planted step), IK target error (cm), jitter (angular accel), plus a blind user study (Likert, n of at least 10) vs a keyframe baseline | Log bone transforms | skate under 1 cm |
| AI correctness | Behaviour tests: noticed-in-cone, honk-heard, chase-if-owner, tidy-up returns item | Headless sim tests (like a-goose-tale's `pnpm test`) | 100% pass in CI |
| Visual regression | Screenshot diffs per commit (style drift) | Headless Chrome | SSIM over threshold |

### 6.4 Toon look for buildings generated from real footprints (concrete techniques)
1. **Two-tone ramp shading with a locked palette.** `MeshToonNodeMaterial` or a TSL `mix(shadowTint, base, step(0, N·L))`, faint shadows (`shadow.intensity` about 0.25), high hemisphere ambient. Map each building to 1 of 6 to 8 campus style classes (brutalist concrete for MC, DC and Hagey; red brick for residences; glass for E7 and QNC; limestone) using OSM `building:material` and `building:colour` where present (19% and 12% coverage on campus per the teardown) and a manual table for the rest. One flat colour per class plus a roof colour.
2. **Shape the silhouette with geometry, not texture.** Extrude footprints with a small chamfer on vertical corners; add a parapet lip and a contrasting roof cap; a darker plinth band at the base; inset horizontal window bands as real geometry or flat strips. UGG reads through clean shapes and bevels, so silhouettes do the work.
3. **World-space procedural facade bands in TSL, no textures.** Storey lines and window strips as flat colour rectangles computed from world position and storey height (slop-newyork's metre-true `facadeCell` idea, simplified to 2 colours), filtered with `fwidth` so they do not shimmer. Seed variation per building.
4. **Baked vertex-colour AO and ground gradient.** Offline in the pipeline: darken the bottom metre of walls, inside corners and under overhangs into vertex colours. That gives UGG's "whiff of AO" with zero runtime cost and no flicker; GTAO at half resolution is the runtime alternative.
5. Optional: **soft same-hue edges.** A depth plus normal edge pass (`SobelOperatorNode`/`OutlineNode`, or the OmarShehata approach) drawn at low alpha in a darker shade of the surface, only on buildings, for readability at campus distances. UGG itself has no outlines, so keep this subtle or skip it.
6. **Pastel atmosphere.** Distance fog in the sky colour, desaturation with distance, and a narrow-FOV fixed camera so buildings read like a diorama.

### 6.5 Feasibility and risk for 4 people, about 4 weeks, 128 team-hours
- **Realistic MP3 MVP (my estimate):** whole campus as toon extrusions with lidar or levels heights (pipeline forked from slop-singapore); one dense zone (for example the DC, MC and SLC triangle) with 30 to 60 interactive props; the goose with 5 verbs, procedural neck and legs; 10 to 20 smart NPCs with the FSM in 3.3 plus 100 to 300 ambient walkers; one to-do list (5 tasks plus a gating task); honk and props audio; benchmark harness and a results slide. Stretch: adaptive piano stems, Menace combo score, nesting-season mode.
- **Suggested split:** (1) data pipeline and fidelity metrics; (2) renderer, toon style and camera/occlusion; (3) goose controller, IK animation and physics; (4) NPC AI, navmesh crowds, tasks, UI and audio. Everyone shares the benchmark harness.
- **Week plan:** W1 (Nov 5 to 11) pipeline to first campus build, greybox goose on Rapier, style test scene, abstract due Nov 9. W2 goose verbs plus IK, toon buildings, navmesh, first NPC. W3 zone set-piece, 5 tasks, crowd scale-up, benchmarks running in CI; mid-MP3 check-in Nov 26. W4 polish, measurements on 3 devices, 5-minute video, slides (due around Dec 3 to 7; reviews Dec 8).
- **Risks:**
  1. **Time.** 128 h is small; AI agents write code fast but **animation feel, palette and camera tuning are human taste work**, and they are where UGG's quality lives. Timebox them.
  2. **The fun gap.** An accurate campus is sparse. Without dense set pieces it becomes a walking simulator; the GDC talk shows even House House bent reality.
  3. **Occlusion and camera** around tall buildings is a known pain (UGG reviewers complained even in a low village).
  4. **WebGPU-only features** and TSL shaders break easily with agents; keep WebGL2 fallback and screenshot regression tests (same advice as the teardown).
  5. **IP:** do not copy UGG assets, UI art, the name or the music recordings; credit OSM and the City.
  6. **Data licences** (6.1 item 10).
  7. **Novelty optics:** "a goose game" can read as a toy to judges; lead with the pipeline and benchmarks, use the goose as the demo.
- **Honest read:** a convincing, fun vertical slice plus solid benchmarks is feasible in MP3. A whole-campus UGG-quality game is not; that is a capstone-year (SE 490/491) scope.

---

## 7. Unverified or partly verified
- Fan wiki to-do list names and per-area task counts (fandom returned 403; names from search snippets; Wikipedia confirms the structure).
- UGG post-processing and shader specifics: no developer source found; descriptions are from screenshots and community recreations.
- Camera pitch and FOV values are my estimates from screenshots.
- JSMG music paper (403), Gameplay podcast (search snippet only), The Record Minecraft article (429), Planet Minecraft and Reddit REV map (403), three.js PR #29483 page (timeout; the file is confirmed in source).
- Itch browser goose games (Bupio, ComfyRainworm) load but were not played; their source availability is unknown.
- Browser WebGPU support by OS and Ontario lidar licence terms.

## 8. Files
- Screenshots used for "observed" claims: `raw/goose/ugg_1.jpg` to `ugg_6.jpg` (Steam store, app 837470).
- GitHub search results: `raw/goose/s_*.json`, `raw/goose/repos.tsv`, `raw/goose/libs.tsv`.
- Wikipedia extracts: `raw/goose/wiki_*.txt`.
