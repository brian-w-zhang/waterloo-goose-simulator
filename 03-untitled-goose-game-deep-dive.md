# 03 Untitled Goose Game deep dive, translated into campus requirements

An in-depth breakdown of how Untitled Goose Game (House House, 2019) works: world, verbs, items, villagers, AI states, task design, camera, sound and music, then numbered requirements for a whole-campus Waterloo version.

Builds on the earlier memo [research/goose-game-research.md](research/goose-game-research.md), which covers the look, developer quotes and open source in detail; this doc adds the fan wiki's mechanical facts (now reachable through its API), the DiGRAA music paper and the GDC 2021 level design talk, and turns all of it into requirements.

## 0. Sources and confidence

| Source | What it gives | Confidence |
|---|---|---|
| Untitled Goose Game fan wiki, read through the MediaWiki API (`https://untitledgoosegame.fandom.com/api.php`, 313 pages; normal page URLs such as `https://untitledgoosegame.fandom.com/wiki/To-Do_List` return 403 to scripts) | Every to-do list and how each task is solved, villager types, item lists, reaction animations | Medium: community-written, matches Wikipedia's structure, not developer-confirmed |
| Developer interviews cited in the earlier memo (Game Developer "Behind the HONK" and "Road to the IGF", VICE, FMOD, A Sound Effect, Polygon) | Design intent, AI states, IK, sound | High |
| Dan Golding, "Finding Untitled Goose Game's dynamic music in the world of silent cinema", DiGRA Australia 2020 extended abstract, https://digraa.org/wp-content/uploads/2020/01/DiGRAA_2020_paper_47.pdf (published in full as Journal of Sound and Music in Games 2(1), 2021; the JSMG page returned 403) | Music system | High (by the composer) |
| Jake Strasser, "Google Maps, Not Greyboxes", GDC 2021, https://www.youtube.com/watch?v=cCsMz5tUXmc and https://www.gdcvault.com/play/1027183/ ; Japanese summary at https://www.4gamer.net/games/476/G047618/20210724011/ | Level design from real places | High |
| Six official Steam screenshots in [research/raw/goose/](research/raw/goose/) | Observed look, measured palette | High for what they show |

## 1. World structure

- Five contiguous areas: **Garden, High Street, Back Gardens, Pub, Model Village**, around a central well. One-way gates later loop the areas together ([Wikipedia](https://en.wikipedia.org/wiki/Untitled_Goose_Game); GDC 2021).
- The village is a **collage of real places**: Strasser scouted with Google Street View; Pump Street in **Orford, Suffolk** was the main reference, including its diagonal road. Thaxted was considered and dropped because it lacked **enclosure**. Real geography was bent for play: edges enclosed, curves added to focus attention, an existing garage became a gating puzzle (GDC 2021 talk; 4gamer summary).
- Density is extreme: each area is a few tens of metres across but holds 20 or more interactable items. The Groundskeeper's Garden alone lists 22 take-able item types (some in multiples: 10 carrots, 4 pumpkins, 3 topsoil bags), 2 push-only items (4 cabbages, the big pot) and 3 interact-only objects (2 taps, the gate) (fan wiki, Groundskeeper page).

**What this means for campus**: real UW geography is the opposite of enclosed. the 12 OSM ways named Ring Road add up to about 2.8 km, and most of campus is lawn, parking and paths. UGG's lesson is not "be accurate"; it is "start from the real place, then enclose and densify". An open world can keep every building where it really is, and still create enclosures: quads (Arts quad, the DC and MC courtyard, the SLC and PAC plaza), building courtyards, the Village 1 and REV residence rings, the ION platform.

## 2. The goose's verbs

From the fan wiki Goose page and the earlier memo:

| Verb | What it does | Design notes |
|---|---|---|
| Honk | Distracts or scares people | Spammable, always on top of the mix; a close honk shocks a villager into dropping what they hold |
| Grab | Carry light items in the beak, drag heavy ones | Hold to keep; tug-of-war with villagers is possible (break the broom) |
| Crouch | Lower the neck: fit under gaps, pick items off the ground, hide in plants | Run neck-low or walk neck-high |
| Flap wings | Better turning and a speed boost while running | Wings are hidden meshes scaled out of the body |
| Run | Escape | Villagers are slightly faster than the goose (except the Wimp), so escapes rely on obstacles and hiding |

Rules of plausibility (VICE interview): the goose can pick things up, move them and hit simple switches (taps, a TV switch, a garage handle), but cannot combine items or act too cleverly. Once decided, the rule held everywhere. Every interaction is one of: carry, drag, push, honk near, honk into (walkie-talkies), pull a handle or switch.

Examples of physical-interaction timing from the wiki: stealing the Groundskeeper's keys means **holding them for about 3.5 seconds**; tripping the old man means pulling his stool "very early" as he sits; making the Groundskeeper hammer his thumb means honking right before the **third** hammer swing.

## 3. Items: the real content

The fan wiki classifies every item three ways:

1. **Take-able**: carry or drag (radio, keys, rake, sun hat, glasses, toy plane, pint glass, bell).
2. **Push-able only**: too big or round (cabbages, big pot, soccer ball).
3. **Interact-able**: fixed, operated by grab (taps, gates, the TV switch, shoelaces, the garage handle, the church tower cracks).

Items carry **ownership** and a **home position**. Villagers notice their own items missing and go and get them; some villagers have special rules for items that are not theirs (section 4). Items can be **noisy** (the radio blares when picked up; making it wet silences it), **wearable** (hats, glasses, the ribbon on the goose), **breakable** or **respawnable** (pint glasses are replaced by the Publican; a broken vase stays broken), and can be **hiding spots** (the empty box, the duck statue base).

## 4. Villagers

The 12 villagers (fan wiki Characters page): Groundskeeper, Boy (the "Wimp"), Shopkeeper, TV Shop Owner, Tidy Neighbour, Messy Neighbour, Publican, Publican's Husband (the "burly man"), Delivery person, two Pub Patrons (yellow and blue), Old Man.

### 4.1 Archetypes (fan wiki villager type pages)

| Type | Who | Behaviour |
|---|---|---|
| Normal | Groundskeeper, Messy Neighbour, Delivery person, Old Man | Retrieve their own items |
| Chaser | Shopkeeper, TV Shop Owner, Publican, Publican's Husband | Retrieve items **and** chase or shoo the goose out of their area |
| Scaredy | the Boy | Runs away from repeated honks; can be herded anywhere by honking; cannot enter the Pub or Back Gardens |
| Tidy | Tidy Neighbour | Throws anything that is not his over the fence |

### 4.2 Personality hooks (one per villager)

- Groundskeeper: hates the radio and turns it off; keeps moving the big pot; is embarrassed about being bald, so he reaches for any hat (the sun hat task).
- Boy: plays with his toy plane and ball, re-ties shoelaces, knows the TV Shop Owner's number and calls her from the phone booth.
- Shopkeeper: sweeps with a push broom; puts anything left in her shop on a shelf and sells it, which creates "make someone buy back their own stuff".
- Tidy and Messy Neighbours: a feud over a fence, played off "like in Yojimbo" (Road to the IGF); the Messy Neighbour dresses a garden bust with whatever is in her collection bowl.
- Old Man: back pain, harmonica, darts, copies the goose's ring toss.
- Pub Patrons: applaud a performance on the drain "stage" if the goose copies their requested actions (honk, bend down, spread wings) and award a flower.
- Publican and Husband: throw away the box the goose hides in; replace stolen pint glasses.

Each villager also has a "what I do with the golden bell" rule (pub table, bust's bowl, over the fence, shop shelf, the Groundskeeper's belt), so the finale chase uses every personality once more.

### 4.3 Behaviour rules (fan wiki, Behaviour and Animations pages)

- Villagers follow an idle routine (a schedule of loops) unless there is something to tidy.
- They move slightly faster than the goose, except the Boy.
- They chase while the goose holds their item. If they cannot find a lost item, they scratch their head and give up, then resume routine.
- **Honks**: a honk heard from out of sight makes a villager investigate the source (even a honk from the duck statue or the walkie-talkies). A close honk shocks them and makes them drop what they hold. A villager honked at repeatedly shoos the goose with a character-specific line ("Go Away!", "Oh My Gosh!", "Just Stop It, Goose.").
- Shared reaction marks: **"?" Wonder** (heard a honk, looking for the source), **"!" Shock** (honked at suddenly; drops the item), **Confusion swirl** (sees through a hiding spot such as the empty box; shoos the goose).
- Escalation: after the goose completes 5 tasks in an area, villagers put up "No Goose" signs and chase harder; the starred final task of each area unlocks at that point.
- Completion animations per villager (clap, stretch, a back-pain stretch) when their area is done.
- Developer view (Behind the HONK): "very discrete AI states" for "noticed something missing" and "spotted the goose"; limited vision cones; remembered item positions; thought bubbles showing the item they want.
- A known weak spot: reviewers found villager priorities between tidying and routine hard to predict (Nintendo World Report via the earlier memo). Lesson: make priorities legible (thought bubbles, marks) and consistent.

### 4.4 The state machine, reconstructed

```
Routine (idle loop at home zone)
  -> Notice: goose in vision cone | honk heard | owned item missing | foreign item in my zone
  -> React: "?" (heard) | "!" (shocked, drop item) | stare (goose seen, not misbehaving)
  -> one of:
       Chase    (goose holds my item; speed slightly above goose)
       Shoo     (goose in my zone and I am a Chaser, or repeated honks)
       Search   (go to remembered position; thought bubble with the item)
       Retrieve (pick item up)
       Tidy     (foreign item: Tidy throws it over the fence; Shopkeeper shelves it)
       Flee     (Scaredy, repeated honks)
  -> Return (carry item to its home position)
  -> Give up (cannot find: scratch head) -> Routine
Global modifiers: alertness level rises with tasks done (signs, faster chase); bell mode in the finale.
```

## 5. Task design

### 5.1 The lists (fan wiki To-Do List page)

| Area | Tasks (the starred one unlocks after 5 others) |
|---|---|
| Garden | get into the garden; get the groundskeeper wet; steal the groundskeeper's keys; make the groundskeeper wear his sun hat; rake in the lake; have a picnic; * make the groundskeeper hammer his thumb |
| High Street | break the broom; trap the boy in the phone booth; make the boy wear the wrong glasses; make someone buy back their own stuff; get on TV; go shopping; * trap the shopkeeper in the garage |
| Back Gardens | make someone break the fancy vase; help the woman dress up the bust; make the man spit out his tea; get dressed up with a ribbon; make the man go barefoot; do the washing; * make someone prune the prize rose |
| Pub | get into the pub; break the dartboard; get the toy boat; make the old man fall on his bum; be awarded a flower; steal a pint glass and drop it in the canal; set the table; * drop a bucket on the burly man's head |
| Model Village | get into the miniature village; steal the beautiful miniature golden bell; ...and take it all the way back home |

After the credits: "to do (as well)" (15 tasks over two pages, for example lock the groundskeeper out of the garden, trip the boy in the puddle, open an umbrella inside the TV shop, catch an object as it is thrown over the fence, get thrown over the fence, sail the toy boat under a bridge, steal the old man's woollen hat), "to do (quickly!!)" (finish each area's list before the church bells ring), and "to do (finally)" (cross out everything; reward: a crown).

### 5.2 Task grammar

Every task is one of a handful of patterns, which makes them easy to author as data:

| Pattern | Examples | Campus analogue |
|---|---|---|
| Get into a place | get into the garden, the pub, the model village | get into the SLC, into a lecture hall, onto the ION platform |
| Steal an item | keys (hold 3.5 s), golden bell | WatCard, a hard hat, a TA's coffee |
| Move item X to place Y | rake into the lake, pint glass into the canal, picnic | WatCard into Laurel Creek, a traffic cone onto the Dana Porter steps |
| Make a person do something | wear the sun hat, buy back their stuff, spit out tea, fall on bum | make a tour guide lead the tour into a puddle; make a student buy back their own textbook at the bookstore |
| Collect a set | go shopping (the list), set the table, collect five flowers | collect the iron ring?, five stolen pens, a full "lunch" from the food trucks |
| Perform | be awarded a flower | honk-dance for a busker crowd; get on the campus TV screens |
| Trap someone | phone booth, garage, locked out of the garden | trap a student in a phone booth equivalent (a revolving door, a bike locker) |
| Timed | before the church bells ring | before the 10:20 class change |
| Finale carry | bell all the way home | the "golden goose" trophy carried through every zone |

Design properties worth copying:

- **Multiple solutions**: most tasks list 2 or 3 methods on the wiki (three ways into the garden: the hose lures him out, the radio lures him out, the hole in the hedge).
- **Tasks chain**: trapping the Boy in the phone booth makes him call the TV Shop Owner, who runs out, which opens the TV shop for "get on TV".
- **Cross-area interactions**: the Groundskeeper's trowel left in the shop makes him buy it back; the Boy can be herded into the garden gateway to lock the Groundskeeper out.
- **Self-reset**: villagers tidy up, so gags can be retried.
- **Gating**: 5 of 6 tasks unlock the starred one, and the starred one physically opens the next area.

## 6. Camera

Fixed angle per area, high pitch, narrow FOV, follows the goose, leans toward nearby humans, rotates between areas; the player only zooms (earlier memo section 2, with sources). The fixed angles also hide shortcuts. Players disliked the auto-lean when several NPCs were close.

## 7. Sound and music

- About 160 objects each have grab, release, impact and drag sounds on several surfaces; impact pitch and volume follow velocity; area ambiences crossfade by position (FMOD interview via the earlier memo).
- **Music** (Golding, DiGRAA 2020): pre-recorded, **non-generative** performances of **six Debussy Preludes for solo piano (1909 to 1912, public domain compositions)** that "respond to on-screen events within a buffer of only a few seconds at maximum". The inspiration was **silent cinema accompaniment**, "aiming to replicate affect rather than process", not other game music systems. It corresponds to van Geelen's "branching" model of dynamic music "to a more granular degree than previously imagined". Result: "a theoretical minimum of 10^52 possible performances of each of these century-old pieces" (the PDF prints "1052", a lost superscript). Players read more correspondence between image and music than is intended (Chion's "added value").
- Mechanism (Behind the HONK and FMOD, via the earlier memo): each Prelude recorded twice (normal and low energy), cut into hundreds of roughly two-beat chunks; the next chunk is high energy, low energy or silence depending on what the goose is doing.

## 8. Why it is fun (synthesis)

1. A mundane world as the straight man; the player controls comic timing.
2. A fumbly, performative body with independent verbs.
3. Inverted stealth: you want to be noticed at the right moment.
4. Legible villager minds (marks, thought bubbles), so the player can plan a prank.
5. Clear goals, open methods, resettable gags.
6. Kind-hearted cruelty: nobody gets hurt, no police, no escalation to violence.
7. Music that seems to watch you.

## 9. Requirements for Waterloo Goose Simulator

Priorities follow the project: P1 world and map, P2 simulation. "Must" means MP3 vertical slice; "Should" means MP3 if time allows; "Could" means SE 490.

### World (P1)

- **R-W1 (Must)**: one continuous world covering the game bbox (about 2.3 x 1.8 km) with every UW-owned City footprint present at its real position (doc 01).
- **R-W2 (Must)**: real terrain from the lidar DTM, real lakes and creeks, real path network.
- **R-W3 (Must)**: at least 3 "enclosures" (dense set pieces) chosen from real places, each with 20 or more interactables: suggested DC and MC courtyard, SLC and PAC plaza with the food trucks, the Village 1 ring. Enclosure is made with real features (building walls, hedges, fences, terrain), adding only fences or hedges that plausibly exist and marking them as "game additions" in the override file.
- **R-W4 (Should)**: every OSM bench, bin, bike rack, picnic table, lamp and bus stop instanced as a prop; a subset interactive.
- **R-W5 (Could)**: interiors through the `indoor=yes` corridor ways (the tunnels and bridges).

### Goose (P1 for controls, P2 for depth)

- **R-G1 (Must)**: the five verbs, one input each, freely combinable: honk, grab and drag, crouch, flap, run.
- **R-G2 (Must)**: plausibility rule written in `DESIGN.md`: carry, drag, push, honk, operate a simple switch; never combine items or use tools.
- **R-G3 (Must)**: villagers slightly faster than the goose; escapes use obstacles and hiding.
- **R-G4 (Should)**: procedural neck IK and look-at toward nearby people (the "a-ha" from the developers).
- **R-G5 (Should)**: a Canada goose design (black neck, white chinstrap, brown-grey body): our own character, not the UGG white goose.

### Items

- **R-I1 (Must)**: item data schema with `kind` (take, push, interact), `owner`, `homePos`, `zone`, `weight` (carry or drag), flags `noisy`, `wearable`, `breakable`, `respawn`, `hidingSpot`, `surfaceSounds`.
- **R-I2 (Must)**: 30 to 60 interactable items per enclosure, chosen from real campus objects (WatCard, coffee cup, hard hat, textbook, laptop, bike, traffic cone, umbrella, iron ring box, frisbee, tour guide flag, lab coat).

### Villagers (P2)

- **R-N1 (Must)**: the state machine of 4.4 with the four archetypes (Normal, Chaser, Scaredy, Tidy) plus campus ones (doc 05).
- **R-N2 (Must)**: shared reaction marks "?", "!" and a confusion swirl, and a thought bubble showing the wanted item, drawn in our own hand-drawn style.
- **R-N3 (Must)**: honk rules: far honk causes investigate, close honk causes shock and drop, repeated honks cause shoo (Chasers) or flee (Scaredy).
- **R-N4 (Must)**: tidy-up and give-up behaviour so every prank resets.
- **R-N5 (Should)**: one personality hook per named NPC and one bell-equivalent rule each.
- **R-N6 (Should)**: escalation per zone after 5 tasks ("No Geese" signs, faster chase).

### Tasks

- **R-T1 (Must)**: tasks as data (JSON) using the grammar in 5.2, with at least 6 tasks plus 1 gating task in the first enclosure.
- **R-T2 (Must)**: each task has at least 2 solution paths in the design doc, and a headless test that proves at least 1 path completes.
- **R-T3 (Should)**: a timed list keyed to the real class bell schedule ("before the 10:20 change").
- **R-T4 (Could)**: a finale carry through all zones.

### Camera, sound, music

- **R-C1 (Must)**: high, narrow-FOV follow camera with occlusion fade (doc 02, section 8); no aggressive auto-lean.
- **R-S1 (Must)**: honk always on top of the mix; per-surface impact and drag sounds with velocity mapping.
- **R-S2 (Should)**: a branching music system: our own recordings (or a licensed or public-domain recording, licence checked) of public-domain piano pieces cut into 2-beat chunks at 2 energy levels plus rests, scheduled on Web Audio `AudioContext.currentTime`. Do not use UGG's recordings.

### Tone and IP

- **R-X1 (Must)**: slapstick only; nobody is hurt; no police; no property destruction beyond comedy breakables.
- **R-X2 (Must)**: no UGG assets, names, UI art, fonts, notepad design or recordings. Our own to-do list style (for example a UW-themed lecture handout or a WatCard receipt), our own goose. See [07-licences-and-prior-art.md](07-licences-and-prior-art.md).
