# Goose & Villager Behaviour Spec (UGG-inspired)

Research date: 2026-11-03. Purpose: a behavioural reference for building our own original
Canada-goose-on-campus game that *feels* like Untitled Goose Game (House House, 2019). This is
not a recreation brief. Use it to tune feel, not to copy content, characters or levels.

## How to read this

Each requirement has:

- **ID**: `G-CTRL`, `G-MOVE`, `G-ANIM`, `G-REACT`, `I-` (items), `V-` (villagers), `C-` (camera), `S-` (sound).
- **Statement**: what to implement, worded so it can be tested.
- **Test**: how to check it.
- **Src**: source tags, listed in the [Sources](#sources) table at the end.
- **Conf**: how confident we are that UGG actually works this way.
  - **H**: a developer said it, or 2+ independent sources agree.
  - **M**: one review, preview or wiki page says it.
  - **L**: no direct source. This is our own extrapolation or tuning, and is marked **[OURS]**.
    Treat it as a design choice, not as a fact about UGG.

**Numbers.** No source publishes UGG's speeds, distances or timings. Every number in this
document is a **[OURS]** starting value for tuning. The *ordering* of values (for example
crouch < walk < run) is sourced wherever a source is cited.

**Gaps.** Several things the brief asked about turned up nothing in the sources:

- hold-to-honk / variable honk
- leg IK
- preening idles
- swimming pose
- the hit/startle pose beyond "wings rear up"
- per-area fixed camera angles

These gaps are called out explicitly. The relevant requirements are marked [OURS] or "unverified".

---

## 1. Goose controls

### 1.1 Input map (reference: UGG defaults)

| Action | Switch | Xbox | PS4 | PC (wiki tutorial) | Src |
|---|---|---|---|---|---|
| Move | L stick | L stick | L stick | left-click to move (keys remappable) | NL-REV, WIKI-HOME |
| Honk | Y | X | Square | Space | NL-REV, WIKI-HTP, WIKI-HOME |
| Run (hold) | B | A (hold) | X (hold) | double-click (mouse scheme) | NL-REV, WIKI-HTP, PCG-REV |
| Grab / drop / interact (beak) | A | B | O | right-click | NL-REV, WIKI-HTP, WIKI-HOME |
| Crouch / bend neck down (hold) | ZL | LT | L2 | hold Ctrl | NL-REV, WIKI-HTP, WIKI-HOME |
| Flap / spread wings (hold) | ZR | RT | R2 | X | NL-REV, WIKI-HTP, WIKI-HOME |
| Zoom in / out | L / R | - | - | - | NL-REV |
| To-do list + control reminder | Minus | - | - | Tab | NL-REV, WIKI-HOME |

- **G-CTRL-1**: The goose has exactly these verbs: move, run, honk, grab/drop/interact, crouch (neck down), flap. There is no jump and no attack. Contextual actions (hide in a box, untie laces, flip a switch) all go through the single grab button.
  *Test:* the input map has no other gameplay actions. *Src:* GD-IGF, VICE, GR-PRE, NL-REV, WIKI-GOOSE. *Conf:* H
- **G-CTRL-2**: The goose can pick things up, move them and flip simple switches. It must never "use" or combine items: it can turn on a tap, but it cannot put a key in a lock.
  *Test:* no recipe or combination system exists; keys never unlock anything when the goose carries them. *Src:* VICE (McMaster). *Conf:* H
- **G-CTRL-3**: All controls are remappable. Run, crouch and zoom offer a hold/toggle option. The game supports gamepad and keyboard+mouse at the same time.
  *Test:* settings menu. *Src:* FGDB, GCRIT, VG-REV ("zoom ... hold-activated to toggle"). *Conf:* H
- **G-CTRL-4 (honk input)**: Honk is a single press that produces one short honk. Mashing produces repeated honks with no cooldown that the player can feel. The player controls the timing, which is the comedy.
  *Test:* 10 presses in 2 s gives 10 audible honks. *Src:* GPLAY (Parkinson: "button mash it as much as you like"), PANIC (Gillespie-Cook on "pacing" and "timing"). *Conf:* H
- **G-CTRL-5 (hold/variable honk)**: No source describes hold-to-honk or variable-length honks in UGG. The only "continuous honk" reports come from players rebinding honk to the mouse wheel. **[OURS] option:** if we add a hold honk, make it a *separate*, sustained honk that stretches the neck, so the crisp single-tap honk stays the default.
  *Src:* GRANT. *Conf:* L

### 1.2 Locomotion feel

- **G-MOVE-1 (speed ordering)**: The speeds are ordered crouch-walk < walk < run. Crouch is "a slow, sneaky stealth stance".
  *Test:* measure steady-state speeds. *Src:* PCG-PRE, VG-REV. *Conf:* H for the ordering.
  **[OURS] starting values** (goose body length BL is about 0.6 m): crouch 0.8 BL/s, walk 1.6 BL/s, run 3.2 BL/s, swim 1.4 BL/s.
- **G-MOVE-2 (run costs turning)**: Running widens the turning circle and reduces responsiveness. Walking turns tightly. Reviewers consistently notice this trade-off.
  *Test:* at run speed the minimum turn radius is at least 2x the walk turn radius. *Src:* NL-REV ("reduces your turning circle and overall responsiveness"), NWR, GIZ ("harder to turn if you're running"). *Conf:* H.
  **[OURS]**: walk turn rate about 540 deg/s; run turn rate about 220 deg/s.
- **G-MOVE-3 (momentum / awkwardness)**: Movement has a deliberate, slightly "willful" momentum, described as "1 percent QWOP". Acceleration and deceleration are visible. Low-level actions such as reaching down to grab can be fumbled, and that is meant to be funny.
  *Test:* about 0.15–0.25 s from 0 to walk speed **[OURS]**; a small overshoot is visible when stopping. *Src:* GD-HONK (Disseldorp), KOT ("willful sense of momentum"), GR-PRE. *Conf:* H for the feel; L for the numbers.
- **G-MOVE-4 (flap assists)**: Holding flap while running gives a speed boost and *more* turning control. Flapping while standing is a display.
  *Test:* run+flap speed is above run speed, and run+flap turn rate is above run turn rate. *Src:* WIKI-GOOSE ("more control with turning ... speed you up if you are running"). *Conf:* M.
  **[OURS]**: +20% speed, +40% turn rate.
- **G-MOVE-5 (crouch fits gaps)**: Crouching lowers the goose's collision height so it fits under small gaps (hedge holes, benches, tables, terrace underfloor) and lets it reach items on the ground.
  *Test:* a 0.5 BL-high gap passes when crouched and blocks when standing. *Src:* WIKI-GOOSE, DESTR ("ducking low to fit through tight spaces"), NL-REV. *Conf:* H
- **G-MOVE-6 (self-preservation flee)**: If the goose walks too close to a person, it *involuntarily* runs away from them. Disseldorp compares it to Mario running when on fire. Player steering is reduced while this happens.
  *Test:* entering a villager's personal radius triggers a flee state with an automatic run away from that villager. *Src:* GR-PRE (Disseldorp). *Conf:* H.
  **[OURS]**: radius 0.8 BL; flee lasts 0.6–1.0 s.
- **G-MOVE-7 (swimming)**: The goose can enter and swim in the lake and canal, and paddle smugly while villagers stay at the edge. Water is the goose's safe zone: items dropped in water end up "far out of his reach".
  *Test:* walking into deep water switches to swim locomotion. *Src:* WIRED-REV ("walk, swim, run, crouch"), PCG-REV ("smugly paddling"), IGN-REV (gardener "on the edge of the water shaking his head"). *Conf:* H.
  **Conflict:** the fan wiki says the Groundskeeper is "willing to go into the water" to retrieve items (WIKI-GK1). Treat wading as villager-specific.
- **G-MOVE-8 (relative to villagers)**: Villagers' running is "a little faster than the Goose" (the scared boy is the exception), but the goose takes corners faster. Escapes come from cornering and gaps, not straight-line speed.
  *Test:* villager run speed is 1.05–1.15x goose run speed **[OURS]**; villager turn rate is below goose run turn rate. *Src:* WIKI-VILL, PCG-PRE ("I take corners faster"), DESTR ("they'll eventually catch up"). *Conf:* M

---

## 2. Goose animation

### 2.1 Overall approach

- **G-ANIM-1 (hybrid)**: Use bespoke keyframed cycles (walk, run, flap, honk, crouch) layered with physics-driven procedural interaction for the head, neck and grabbing. Polygon saw "a mix of physics-driven procedural interaction and bespoke animations" on both the goose and the farmer.
  *Src:* POLY-18. UGG was modelled and animated in Blender (GD-IGF) and built in Unity (GR-PRE). *Conf:* H
- **G-ANIM-2 (reference)**: Base the walk on real-goose footage. House House used the Dutch "Ganzenfanfare" marching geese to study geese that "plod along really slowly", and Strasser built the walk cycle by looking at geese.
  *Src:* GR-PRE, PANIC. *Conf:* H. (For us: use Canada goose footage.)

### 2.2 Neck and head

- **G-ANIM-3 (look-at IK)**: The goose head uses an IK look-at. When the goose and a villager are within a set distance of each other, *both* turn their heads to look at each other and hold eye contact. House House call this their "a-ha moment".
  *Test:* villager within R_look, goose head yaw/pitch tracks the villager's head within ±10 deg, and the villager's head tracks the goose. *Src:* VICE (McMaster: "Jake rigged up the goose and the groundskeeper with an inverse kinematics system"), KOT ("the goose's gaze becomes trained on them. If they notice, they stare back"), GR-PRE, PANIC. *Conf:* H.
  **[OURS]**: R_look = 4 BL; head turn speed limited to about 360 deg/s with an ease-out curve.
- **G-ANIM-4 (attend to interactables)**: When a grabbable or interactable is in reach, the goose turns its head toward it and opens its beak slightly. This is the main "you can grab this" cue.
  *Test:* item within R_reach: head aims at the item's grab point and beak opens 10–20% **[OURS]**. *Src:* WIKI-HOME ("will turn their head towards items they can interact with, and open their beak slightly"). *Conf:* M.
  **[OURS]**: R_reach = 1.2 BL standing; when crouched, R_reach covers ground-level items too.
- **G-ANIM-5 (neck reaches for grabs)**: On grab, the neck extends procedurally toward the target's grab point, for example keys on a belt or a carrot top. If the target is too low the goose has to crouch, and when the target is high the neck cranes and strains upward.
  *Test:* the beak tip reaches the grab socket; reach is clamped at max neck length. *Src:* POLY-18 ("goose head extends to grab the farmer's keys from his waistband or to yank carrots out of their rows"), search summary of GCRIT/other reviews ("crane and strain to grab objects high and low"). *Conf:* H
- **G-ANIM-6 (crouch pose)**: Crouch bends the neck down and forward so the head is low, as real geese do. Disseldorp: "Sometimes they run with their neck down low and sometimes they walk with their neck up high."
  *Test:* in crouch the head is below back height and ahead of the chest. *Src:* GR-PRE. *Conf:* H
- **G-ANIM-7 (inquisitive lean)**: When approaching something, the neck leans forward "with an almost innocent inquisitiveness".
  *Src:* KOT. *Conf:* M.
  **[OURS]**: the neck leans forward 10–15 deg in proportion to walk speed toward a look target.
- **G-ANIM-8 (honk pose)**: Each honk is an abrupt, crisp gesture. No source describes the frames. **[OURS]**: a 0.25 s gesture where the neck extends forward and slightly up, the beak opens wide at the peak, and the body settles back.
  *Src:* PANIC ("abrupt, really crisp honk"). *Conf:* L for the pose details.

### 2.3 Body, gait, wings

- **G-ANIM-9 (waddle)**: The walk has a self-assured waddle with slappy feet. Reviewers single out the walk animation ("one of the best walk animations of 2019"). The gait reads as a strut, as if the goose owns the place.
  *Src:* KOT, IGN-REV, PCG-BEST ("strutting around like it owns the place"), WIRED-REV. *Conf:* H.
  **[OURS]**: side-to-side body roll ±6 deg per step, a small vertical bob each footfall, and step cadence tied to speed.
- **G-ANIM-10 (run)**: In the run, the neck can go low and forward (see G-ANIM-6). Wings stay folded unless flap is held. **[OURS]**: wings half-open while running is a reasonable stylisation, but no source confirms it.
  *Src:* GR-PRE. *Conf:* M for the neck; L for the wings.
- **G-ANIM-11 (flap)**: Flap unfolds the wings in "a grand display of size and ferocity". Used after a victory it reads as celebration or showing off.
  *Src:* PCG-PRE, VOOKS ("extend my wings and honk to safety"), WIKI-FUN ("flap your wings, bow your head ... show off"). *Conf:* H
- **G-ANIM-12 (backwards drag run)**: When dragging a heavy item, the goose faces the item it holds and moves *backwards*, pulling it. PC Gamer names "the I've-just-stolen-your-rake backwards run" as a signature animation.
  *Test:* while dragging, the goose's facing is locked toward the held point and input drives backward or sideways motion. *Src:* PCG-BEST. *Conf:* M (one source, but a specific one).
- **G-ANIM-13 (legs)**: No source on foot IK. **[OURS]**: plant-foot IK on slopes and steps keeps the waddle readable.
  *Conf:* L
- **G-ANIM-14 (idles)**: No source on preening or idle cycles. **[OURS]**: optional idle look-arounds driven by the look-at system (G-ANIM-3/4). Keep idles subtle so player-driven "performance" dominates.
  *Conf:* L
- **G-ANIM-15 (bow head)**: Bowing the head (crouch) or turning the back to an NPC while holding a wearable (crown) makes the NPC place it on the goose's head. Bowing is also part of the goose's repertoire of "show off" gestures.
  *Src:* WIKI-CROWN, WIKI-FUN. *Conf:* M

### 2.4 Startle / caught reaction

- **G-REACT-1 (caught)**: When a villager catches or shoos the goose:
  1. the goose's wings rear up;
  2. the goose drops whatever it holds;
  3. the goose is limited to running away until the wings settle.

  There is no fail state.
  *Test:* catch event drops the item, plays the wings-up pose and forces flee for T. *Src:* PCG-PRE ("your wings rear up, you drop whatever you're holding, and you're limited to running away until your goose wings settle"), IGN-REV ("Getting caught with an object simply makes you drop it"). *Conf:* H.
  **[OURS]**: T = 1.0–1.5 s.
- **G-REACT-2 (indignant recovery)**: After being thwarted the goose "flaps and flutters", then "immediately compose[s] itself". The recovery is quick and indignant, not cowed.
  *Src:* KOT. *Conf:* M

---

## 3. Items and interactions

### 3.1 Indication and grabbing

- **I-1 (target selection)**: The single grab button targets the nearest or best-facing grabbable in reach. The current target is visibly indicated (see G-ANIM-4). Mis-targeting between close items is a known irritation, so bias selection by facing direction and show a clear highlight.
  *Src:* IGN-REV ("incorrectly highlighting one item to grab because it was just a little too close to another"), WIKI-HOME. *Conf:* H for the existence of a highlight; L for its exact visual.
- **I-2 (context prompt)**: Hide spots and contextual interactables show a large ring/circle prompt when the goose is in range.
  *Src:* WIKI-BOX ("When you see a big circle ... hop in and hop out"). *Conf:* M
- **I-3 (grab points)**: Large items have specific visible grab points (handles, rims, tags). Small details are added to big objects "that made it clear the goose would grab it from that point".
  *Src:* RPS. *Conf:* H

### 3.2 Weight classes

- **I-4 (three classes)**: Implement these three classes:
  - **carry**: lifted in the beak and swinging from it, for example keys, a sock, a sandwich;
  - **drag**: too heavy to lift; the goose drags it slowly, for example a rake, pumpkin, crate, boot or topsoil bag;
  - **push-only**: cannot be grabbed; the goose walks into it or nudges it with the beak while crouched, for example cabbages, a big pot, balls.

  *Test:* each item has a class, and drag items reduce goose speed. *Src:* WIKI-GK, WIKI-GK1, NL-REV ("heavier items can only be dragged"), VG-REV ("carry with ease or struggle with, dragging them slowly"), WIKI-HOME ("walk while bending forwards"), RPS (the goose can move "stuff that's as big as its own body"). *Conf:* H.
  **[OURS]**: drag speed multiplier 0.45–0.6 of walk speed, scaled by mass.
- **I-5 (hammer throw)**: A subset of drag items is light enough that if the goose spins with enough force, the item lifts off the ground and can be "hammer-thrown". In UGG this subset is the teapot and the doll. The behaviour emerged from shape and centre of gravity rather than being designed.
  *Test:* spinning in place while dragging such an item makes it orbit, and releasing flings it. *Src:* RPS (Gillespie-Cook, Disseldorp). *Conf:* H
- **I-6 (carried item dangles)**: A carried item hangs from the beak with physics (pendulum swing). It looks deliberately "a bit clunky ... that's part of the comedy".
  *Test:* the item is joint-attached at the beak socket with damping, and swings visibly on turns and stops. *Src:* RPS ("You get away with a lot because the goose isn't meant to hold anything"), OHAVEN ("a sock hanging from its beak"). *Conf:* M for physics specifically (it is implied by "physics objects" in PANIC).

### 3.3 Physics, drops, persistence

- **I-7 (physics objects)**: Items are rigid-body physics objects. Balls roll down inclines, solid items stack fairly reliably, and items can be pushed.
  *Src:* PANIC (Disseldorp: "physics objects"), NL-REV. *Conf:* H
- **I-8 (items float)**: Items float, so they are never lost. Anything that falls into an inescapable hole (a well) reappears somewhere retrievable (the canal).
  *Src:* RPS, NL-REV. *Conf:* H
- **I-9 (fragile items)**: A few designated fragile items (pint glasses, a fancy vase) shatter when dropped or thrown hard. The owner later replaces them so the gag can repeat.
  *Src:* RPS, WIKI (Pub item list: "these break if dropped"). *Conf:* H
- **I-10 (self-resetting world)**: Every prank must be repeatable. Villagers tidy items back to their home positions, so failed or successful gags reset.
  *Src:* VICE, RPS, GD-HONK. *Conf:* H

### 3.4 Items with behaviour

- **I-11 (item-modified honk)**: Some carried items alter the honk:
  - glass bottle: muffled or echoing;
  - harmonica: notes;
  - traffic cone: "conical resonance";
  - walkie-talkie: transmits the honk to its paired unit, with static;
  - honking down a well: echo.

  *Src:* ASFX, GPLAY, IGN-REV, VOOKS, WIKI-FUN. *Conf:* H
- **I-12 (noise-making items)**: Some items make sound while carried, and the sound draws villagers. A radio starts playing when picked up, and the bell dings when the goose honks or runs with it. Villagers in hearing range home in on the noise.
  *Src:* WIKI-FUN, WIKI-BELL, PANIC ("the characters in the game would know where the goose was"). *Conf:* H
- **I-13 (honk proxies)**: When the goose honks through a proxy (walkie-talkie, or near a figurine or statue), villagers attribute the honk to that object and investigate it.
  *Src:* WIKI-VILL, WIKI-FUN, WIKI-MV. *Conf:* M

### 3.5 Hiding, disguise, wearing, switches

- **I-14 (hide spots)**: Bushes, boxes and under-table spaces hide the goose from vision. Honking from a hide spot makes villagers come and investigate without finding the source. A box can be entered or exited with grab.
  *Src:* WIKI-FUN, WIKI-BOX, KOT, IGN-REV. *Conf:* H
- **I-15 (discovered hiding)**: A villager who finds the goose hiding (in the box, or posing on a statue base) shows a confusion swirl. They then shoo the goose out, and some throw the box.
  *Src:* WIKI-ANIM, WIKI-BOX. *Conf:* M
- **I-16 (disguise by stillness)**: Standing still on an empty statue base passes as the statue. Moving, or honking too much, gives the disguise away.
  *Src:* WIKI-FUN, WIKI-DUCK. *Conf:* M
- **I-17 (wearables)**: The goose can't put items on itself. Villagers put wearables on the goose when the goose presents itself correctly: bows its head or turns its back while holding the item, or stands on a statue base.
  *Src:* WIKI-CROWN, WIKI-BOW. *Conf:* M
- **I-18 (switches)**: Interactables operated with grab include taps/sprinklers, gate bolts, garage pull handles, TV switches, umbrellas (open with a blast that scatters nearby items) and radio plugs. Owners switch them back off, and some treat this as high priority.
  *Src:* WIKI-INT, WIKI-TAPS, RPS (umbrella "a little bomb"), KOT. *Conf:* H
- **I-19 (attached items)**: Items can be attached to villagers (keys on a belt, a hat on the head, glasses on the face). These can only be stolen when the villager is distracted or bending over.
  *Src:* RPS ("clip keys to someone's belt ... take someone's hat, which requires them to bend over"). *Conf:* H
- **I-20 (tug-of-war)**: If the goose grabs an item a villager is holding (for example the free end of a broom), the villager holds on and a tug-of-war follows. Holding long enough can break a breakable item, or wrest it free.
  *Test:* both parties are joint-attached; after T_tug the item breaks or one party wins. *Src:* GD-HONK ("Breaks the broom by tug of warring"), TWIN/guides ("keep pulling for a few seconds"), IGN-REV ("nab something out of a person's hand over and over"). *Conf:* H.
  **[OURS]**: T_tug = 2–4 s.
- **I-21 (shoelaces)**: Grabbing a villager's shoelaces unties them. A villager with untied laces trips if they run on flat ground. Some villagers stop to re-tie their laces, which bends them over and creates a steal window.
  *Src:* WIKI-LACE, WIKI-BOY, IGN-REV. *Conf:* H

---

## 4. Villager animation and AI presentation

### 4.1 Art and proportions

- **V-ART-1**: Characters are low-poly, untextured and flat-coloured, with clean silhouettes. They are modelled on the *faceless* miniature people of UK children's TV (for example Thomas the Tank Engine), so they have no facial features. Expression comes from posture and gesture.
  *Src:* NL-INT (McMaster: "modelled after the faceless miniature people"), GR-PRE, WIKI-UGG. *Conf:* H
- **V-ART-2**: Each villager has distinct, simple clothing blocks in a muted palette. For example, the Groundskeeper wears a light-blue shirt, green overalls, brown gloves, a maroon hat and dark-green boots. Each villager also has one or two signature props. Props and objects are "cartoon ideals" with unmistakable silhouettes ("If you've got a pipe in the game, it has to look like a classic pipe").
  *Src:* WIKI-GK, RPS. *Conf:* H
- **V-ART-3 (goose look)**: The goose is two colours: white body, orange beak and feet, black dot eyes. It has a slightly "frowning" brow line and a classic clean silhouette.
  *Src:* VICE, PANIC, WIKI-UGG1, GCRIT ("the whole animal is just two colours"). *Conf:* H. (Ours: a Canada goose's black head, neck and white chinstrap is an equally strong two-to-three-tone silhouette.)

### 4.2 AI states shown on screen

- **V-AI-1 (limited vision)**: Villagers have narrow forward vision cones and remembered positions. They can't see behind themselves (this was the step that made the game a stealth game).
  *Src:* GD-HONK ("vision cones, remembered positions, thought bubbles"), GD-IGF ("very limited vision"), GR-PRE. *Conf:* H.
  **[OURS]**: 90–110 deg cone, 8 BL range.
- **V-AI-2 (discrete, readable states)**: Use discrete states with a *conspicuous* reaction animation at every state transition, so players can build intuition. Discrete states include:
  - idle routine (using their items)
  - noticed something missing
  - spotted the goose
  - chasing
  - returning an item
  - investigating a noise
  - giving up

  *Src:* GD-HONK ("reaction animations for state transitions", "idle loops where people would use their items"), GD-IGF, RPS. *Conf:* H
- **V-AI-3 (priorities)**: Villagers have a per-character list of cared-about items and a priority order. For example, a running tap outranks a stolen pumpkin. They switch to the highest-priority mess immediately.
  *Src:* RPS. *Conf:* H

### 4.3 Reaction markers and bubbles

- **V-FX-1 ("?")**: A honk the villager hears but can't place shows a "?" above them. They walk toward the honk source and look around.
  *Src:* WIKI-ANIM, WIKI-VILL, RPS. *Conf:* H
- **V-FX-2 ("!")**: A sudden close honk shows a "!", a startle jump and the villager *drops what they're holding*.
  *Src:* WIKI-ANIM, NL-REV ("make them jump and drop whatever it is they are carrying"). *Conf:* H.
  **[OURS]**: "close" = within 2 BL, or any honk when the villager is unaware of the goose.
- **V-FX-3 (thought bubble)**: When a cared-about item is missing, show a thought bubble containing a *picture of the item* while the villager looks around and scratches their head. This is the game's main hint system.
  *Src:* RPS (Disseldorp: "a thought bubble ... a big picture of the stool and he'll look around and scratch his head"). *Conf:* H
- **V-FX-4 (confusion swirl)**: A villager who sees through a hiding spot or disguise shows a swirl.
  *Src:* WIKI-ANIM. *Conf:* M

### 4.4 Gesture set (per-character flavour of shared states)

- **V-ANIM-1 (shoo)**: After repeated honks, or on finding the goose somewhere it shouldn't be, the villager walks at the goose and shoos it. This is a step toward the goose with an arm-sweep "go away" gesture, or a broom sweep for the shopkeeper character. Personalise the flavour per character: exasperated, offended, "just stop it".
  *Src:* WIKI-ANIM, POLY-18 (farmer "tries ... to shoo you away"), PCG-PRE ("shakes his head and turns back"), KOT ("push you off the premises with a broom"), SHACK19 ("boldly step to it and shoo it away"). *Conf:* H
- **V-ANIM-2 (head shake)**: Disapproval is a slow head shake, used when the goose honks or causes a mess within sight but nothing actionable happens.
  *Src:* PCG-PRE, IGN-REV. *Conf:* H
- **V-ANIM-3 (give up)**: When the villager can't find the item or the source of a honk, they scratch their head and resume their schedule.
  *Src:* WIKI-VILL, RPS. *Conf:* H
- **V-ANIM-4 ("all done")**: After tidying, play a per-character completion gesture: hand clap, nose scratch, stretch, or "well, well, well". An elderly character might rub a sore back.
  *Src:* WIKI-ANIM. *Conf:* M
- **V-ANIM-5 (chase)**: A villager who sees the goose with one of their cared-about items runs after it. If they catch it, the goose drops the item (G-REACT-1) and the villager picks it up and carries it back to its home spot. Scared characters chase too, but run away when honked at repeatedly.
  *Src:* WIKI-VILL, WIKI-CHASER, WIKI-SCAREDY, RPS, DESTR. *Conf:* H
- **V-ANIM-6 (pick-up / put-back)**: Villagers bend down to pick items up and carefully put them back. Precious items get special carries: the gardener carries a pulled-up rose "ever-so-gently with both hands, cupping it like a small bird". Bending over is a deliberate vulnerability window (see I-19).
  *Src:* PCG-PRE, RPS. *Conf:* H. Note from House House: making humans carry odd objects without looking wrong was *harder* than the goose (RPS), so author per-size carry poses.
- **V-ANIM-7 (fall / trip)**: Villagers can fall in these situations:
  - they trip when running with untied laces (I-21);
  - they fall onto their bottom when startled by a honk from a non-goose source such as a walkie-talkie or figurine;
  - they fall when a seat is pulled away;
  - a scripted gag knocks them down.

  Falls make them drop items and leave a brief window while they get up.
  *Src:* WIKI-VILL ("will fall to the ground if startled by something 'honking' that is not the goose"), WIKI-LACE, WIKI-FUN, RPS. *Conf:* H
- **V-ANIM-8 (escalation)**: After the goose completes most of an area's tasks, the villager puts up a "No Goose" sign and becomes more aggressive about chasing, with slightly faster running.
  *Src:* WIKI-VILL, WIKI-GK. *Conf:* M
- **V-ANIM-9 (eye contact)**: The villager's head look-at mirrors G-ANIM-3. Silent, prolonged eye contact after a prank is a core comedic beat, and players deliberately stare and honk.
  *Src:* VICE, GR-PRE, KOT, PANIC. *Conf:* H
- **V-VOX-1**: Villagers make understated, muffled non-verbal vocalisations (no words), and their clothes have per-animation cloth foley. The goose is meant to be the loudest thing in the space.
  *Src:* GPLAY (Halberstadt). *Conf:* H

---

## 5. Camera

- **C-1 (automatic, no rotation)**: The camera is automatic, from a fixed perspective. The player cannot rotate it; the only camera controls are zoom in and zoom out.
  *Src:* NWR ("just the ability to zoom in and out"), KOT ("fixed camera perspective"), GCRIT ("automatic camera"), NL-REV. *Conf:* H
- **C-2 (lean toward villagers)**: The camera frames the goose but *leans toward the nearest relevant human*, so the player can watch them.
  *Src:* NWR ("The camera will lean in the direction of the human in your vicinity"). *Conf:* H
- **C-3 (avoid UGG's known flaw)**: With several humans nearby, UGG's camera flips between them and pans "sporadically", which reviewers widely criticised. **[OURS] requirement:**
  - weight multiple villagers into one blended look-ahead target;
  - add hysteresis (minimum dwell about 1.5 s);
  - cap pan speed.

  *Test:* with two villagers on opposite sides, the camera target never switches more than once per 1.5 s. *Src:* NWR, DESTR, OHAVEN, GCRIT. *Conf:* H that it's a problem; L for the fix.
- **C-4 (zoom + options)**:
  - Provide zoom in and zoom out, plus a hold/toggle option for zoom.
  - Provide a "permanently zoomed out" option, which reduces panning.
  - Provide a "camera follows goose only" accessibility option for motion sickness.
  - Zooming out is encouraged for spotting things.

  *Src:* DESTR, VG-REV, FGDB, WIKI-HOME. *Conf:* H
- **C-5 (occlusion)**: Scenery can occasionally block the view in UGG. **[OURS]**: fade or cut away occluders between the camera and the goose.
  *Src:* search summary of UCA "Press Y To Honk" review. *Conf:* M that it happens.
- **C-6 (per-area fixed angles)**: Not confirmed by any source. **[OURS]**: a single consistent high three-quarter pitch with per-zone yaw hints is an acceptable starting point.
  *Conf:* L

---

## 6. Sound

### 6.1 Honk

- **S-1 (honk character)**: The honk is short, loud, abrupt, "rude" and *neutral*, so players project their own emotion onto it. UGG's honk was cut down from close-miked library goose recordings (Mattia Cellotto, *Animal Hyperrealism*). Real long honks were "slow and warbly" and were rejected.
  *Test:* honk duration about 0.2–0.35 s **[OURS]**; no pitch slide. *Src:* GPLAY, VICE, PANIC. *Conf:* H
- **S-2 (honk variation)**: Use a small pool of short neutral takes, played with light randomisation (snippets from one session) so mashing doesn't machine-gun one identical sample. A second player gets a distinctly different (squeakier) honk from another goose breed.
  *Src:* GPLAY ("little takes ... really short and really neutral", Toulouse goose for player 2). *Conf:* M for the pool; H for the player-2 honk.
- **S-3 (honk modifiers)**: See I-11. Implement modifiers as DSP/snapshot chains: EQ plus a convolution impulse response plus static for the walkie-talkie; a reverb/delay snapshot with a distance parameter for the well; layered note samples for the harmonica.
  *Src:* ASFX. *Conf:* H

### 6.2 Foley

- **S-4 (goose feet)**: Soft "fwap"/pitter-patter footsteps, recorded by lightly slapping a rubber glove on each surface. Use separate sets per surface (at least grass, stone/pavement, wood, and a water splash) and separate events for walking, running and stopping.
  *Src:* ASFX, GPLAY, GD-HONK ("quiet 'fwap'"), OHAVEN, WIRED-REV. *Conf:* H
- **S-5 (wings)**: Wing flaps are cloth or burlap-like foley.
  *Src:* GPLAY. *Conf:* M
- **S-6 (props)**: Every prop has unique grab, release and impact sounds, plus a drag loop for drag-class items. Impacts are recorded per surface: concrete rings out, grass is dull. About 160 objects in UGG.
  *Src:* GPLAY, ASFX, GD-HONK, PANIC. *Conf:* H
- **S-7 (impact velocity)**: Impact pitch and volume scale with impact velocity, using a per-prop curve, a max-instances limit and a cooldown. The overall mix is a "soft performance" where nothing jumps out except rare crashes.
  *Src:* ASFX, GPLAY. *Conf:* H
- **S-8 (silence as default)**: The ambient bed is quiet (park and birdsong-level). Most of the time *no music plays*.
  *Src:* GPLAY, IGN-REV, POLY-18. *Conf:* H

### 6.3 Adaptive piano

- **S-9 (three states)**: Music state is driven by how the world relates to the goose:
  1. **Silent**: nobody is concerned with the goose.
  2. **Low-energy**: villagers are aware or suspicious, or the goose is sneaking up or scheming near someone.
  3. **High-energy**: actively being chased.

  *Test:* state transitions follow the max awareness level of the villagers in range. *Src:* GPLAY (Golding), VERGE, GD-DEB. *Conf:* H
- **S-10 (beat-sliced stems)**: Each piece is recorded as two performances: high-energy (normal), and low-energy (slower, quieter, sometimes in a lower register). Both are sliced at every beat into index-aligned stems (about 360 per 2.5-min piece). Playback advances stem by stem, and at each stem boundary the game picks the high or low version of the *next* index. Silence can be entered at any stem. Stems are exported with full reverb tails and overlapped, so cuts sound like the sustain pedal is held.
  *Src:* GPLAY, VERGE, GD-DEB, WIKI-UGG1 (WP summary: "196 to 425" stems). *Conf:* H
- **S-11 (responsiveness)**: Transitions happen at the next beat, so the music feels like "a pianist was watching you play". The chase reads as Benny Hill / silent-film; the creep reads as menacing low passages.
  *Src:* GD-IGF, IGN-REV, VOOKS, PANIC. *Conf:* H
- **S-12 (source music)**: UGG used six public-domain Debussy *Préludes*, and the radio plays separate diegetic tracks. **For our original game: choose different public-domain solo-piano repertoire, or compose our own, and record our own performances.** Solo piano is what makes beat-slicing work (Disseldorp).
  *Src:* GD-DEB, VERGE, WIKI (WP summary). *Conf:* H

---

## 7. Top-10 implementation priorities

1. G-ANIM-3 / V-ANIM-9: mutual head look-at (eye contact) between goose and villager.
2. G-CTRL-4 / S-1: one-tap, mashable, crisp neutral honk with a neck-forward pose.
3. G-ANIM-4 / G-ANIM-5: head turns toward reachable items, beak parts, neck extends procedurally to grab points.
4. G-MOVE-2 / G-MOVE-3: run trades turning for speed; slight willful momentum.
5. I-4 / G-ANIM-12: carry vs drag vs push classes; drag = slow backwards pull.
6. V-FX-1..3: "?" for unplaced honks, "!" plus drop on close startle, thought bubble with item picture plus head scratch.
7. G-REACT-1 / V-ANIM-5: caught means wings rear up, item dropped, forced flee; villager returns item home.
8. V-AI-1 / V-AI-2: narrow vision cones and conspicuous transition animations.
9. C-1..C-3: automatic camera that leans toward villagers, with hysteresis to avoid UGG's flip-flopping.
10. S-9 / S-10: three-state beat-sliced adaptive piano over a mostly silent bed.

---

## Sources

| Tag | Source | URL |
|---|---|---|
| VICE | VICE, "Honks vs quacks: a long chat with the developers of Untitled Goose Game" (Michael McMaster) | https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/ |
| GD-HONK | Game Developer, "Behind the HONK: an Untitled Goose Game Q&A" (Nico Disseldorp) | https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a |
| GD-IGF | Game Developer, "Road to the IGF: House House's Untitled Goose Game" | https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i- |
| GD-DEB | Game Developer, "Getting goosey with Debussy: creating an adaptive score" | https://www.gamedeveloper.com/audio/getting-goosey-with-debussy-creating-an-adaptive-score-for-i-untitled-goose-game-i- |
| GR-PRE | GamesRadar / GamesTM, "We wanted to make our little Mario 64" (Disseldorp, Strasser) | https://www.gamesradar.com/untitled-goose-game-preview/ |
| RPS | Rock Paper Shotgun, "How Untitled Goose Game made a game out of everyday items" (Disseldorp, Gillespie-Cook) | https://www.rockpapershotgun.com/how-untitled-goose-game-made-a-game-out-of-everyday-items |
| PANIC | Panic podcast S01E01 transcript (all four House House members) | https://podcast.panic.com/episodes/s01e01/transcript/ |
| NL-INT | Nintendo Life, "How a joke hatched gaming's most horrible goose" (McMaster) | https://www.nintendolife.com/news/2019/09/feature_how_a_joke_hatched_gamings_most_horrible_goose |
| GPLAY | Gameplay podcast transcript, Dan Golding and Em Halberstadt | https://gameplay.co/untitled-goose-game-music-sound-design/ |
| ASFX | A Sound Effect, Em Halberstadt interview | https://www.asoundeffect.com/untitled-goose-game-sound/ |
| VERGE | The Verge, "How Untitled Goose Game adapted Debussy" (Golding) | https://www.theverge.com/2019/9/23/20879792/untitled-goose-game-nintendo-switch-debussy |
| POLY-18 | Polygon GDC 2018 preview | https://www.polygon.com/2018/3/26/17157644/untitled-goose-game-preview-gdc-2018-day-of-the-devs |
| PCG-PRE | PC Gamer hands-on preview | https://www.pcgamer.com/ruining-lives-comes-naturally-when-inhabiting-the-body-of-a-goose/ |
| PCG-REV | PC Gamer review | https://www.pcgamer.com/untitled-goose-game-review/ |
| PCG-BEST | PC Gamer, Best Character 2019 | https://pcgamer.com/best-character-2019-untitled-goose-game |
| KOT | Kotaku review | https://kotaku.com/untitled-goose-game-the-kotaku-review-1838264644 |
| IGN-REV | IGN review | https://www.ign.com/articles/2019/09/20/untitled-goose-game-review |
| NL-REV | Nintendo Life review (Switch button map) | https://www.nintendolife.com/reviews/switch-eshop/untitled_goose_game |
| NWR | Nintendo World Report review (camera) | https://nintendoworldreport.com/review/51756/untitled-goose-game-switch-review |
| DESTR | Destructoid review (camera, chases) | https://www.destructoid.com/review-untitled-goose-game/ |
| OHAVEN | The Outer Haven review | https://www.theouterhaven.net/2019/09/untitled-goose-game-review-honkin-around |
| VOOKS | Vooks review | https://vooks.net/untitled-goose-game-switch-review |
| VG-REV | VG247 review | https://www.vg247.com/untitled-goose-game-review |
| GCRIT | GameCritics review | https://gamecritics.com/mike-suskie/untitled-goose-game-review/ |
| WIRED-REV | Wired review (mirror) | https://wirednews.pages.dev/story/untitled-goose-game-review |
| GIZ | Gizmodo, "A birdwatcher's review" | https://gizmodo.com/a-birdwatchers-review-of-untitled-goose-game-1838402227 |
| SHACK19 | Shacknews GDC 2019 hands-on | https://www.shacknews.com/article/110632/untitled-goose-game-hands-on-preview-from-gdc-2019 |
| FGDB | Family Gaming Database accessibility | https://www.familygamingdatabase.com/accessibility/Untitled+Goose+Game |
| GRANT | Game Rant, continuous honk via rebinding | https://gamerant.com/untitled-goose-game-terrifying-honking/ |
| TWIN | Twinfinite, how to break the broom | https://twinfinite.net/2019/09/untitled-goose-game-how-to-break-the-broom/ |
| WIKI-GOOSE | UGG Wiki: Goose | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Goose&format=json&prop=wikitext |
| WIKI-HOME | UGG Wiki: Home (tutorial controls, head-turn cue) | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Home&format=json&prop=wikitext |
| WIKI-HTP | UGG Wiki: How to play guide | https://untitledgoosegame.fandom.com/api.php?action=parse&page=How_to_play_guide_for_Untitled_Goose_Game&format=json&prop=wikitext |
| WIKI-ANIM | UGG Wiki: Characters Animations | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Characters_Animations&format=json&prop=wikitext |
| WIKI-VILL | UGG Wiki: Villagers | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Villagers&format=json&prop=wikitext |
| WIKI-CHASER / WIKI-SCAREDY | UGG Wiki: villager types | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Chaser_Villager&format=json&prop=wikitext |
| WIKI-GK | UGG Wiki: Groundskeeper | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Groundskeeper&format=json&prop=wikitext |
| WIKI-GK1 | Untitled Goose Game Wiki (second fandom wiki): The Groundskeeper | https://untitled-goose-game.fandom.com/api.php?action=parse&page=The_Groundskeeper&format=json&prop=wikitext |
| WIKI-BOY | UGG Wiki: Boy / Wimp | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Wimp&format=json&prop=wikitext |
| WIKI-LACE | UGG Wiki: Shoelaces | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Shoelaces&format=json&prop=wikitext |
| WIKI-BOX | UGG Wiki: Empty Box | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Empty_Box&format=json&prop=wikitext |
| WIKI-DUCK | UGG Wiki: Duck Statue Base | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Duck_Statue_Base&format=json&prop=wikitext |
| WIKI-BOW | Untitled Goose Game Wiki: Bow | https://untitled-goose-game.fandom.com/api.php?action=parse&page=Bow&format=json&prop=wikitext |
| WIKI-CROWN | UGG Wiki: Crown | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Crown&format=json&prop=wikitext |
| WIKI-BELL | UGG Wiki: Mini Golden Bell | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Golden_Bell&format=json&prop=wikitext |
| WIKI-INT / WIKI-TAPS | UGG Wiki: Interactables, Taps | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Taps&format=json&prop=wikitext |
| WIKI-FUN | UGG Wiki: Fun Stuff | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Fun_Stuff&format=json&prop=wikitext |
| WIKI-MV | UGG Wiki: Model Village | https://untitledgoosegame.fandom.com/api.php?action=parse&page=Model_Village&format=json&prop=wikitext |
| WIKI-UGG / WIKI-UGG1 | UGG Wiki game page; Wikipedia (dev + music summary) | https://en.wikipedia.org/wiki/Untitled_Goose_Game |

### Searched, nothing usable found

- **GDC Vault.** The only House House GDC talk is Jake Strasser's "Google Maps, Not Greyboxes" (level design, GDC 2020/2021), with no animation content. No GDC animation or AI postmortem exists. "Behind the HONK" is a Game Developer Q&A, not a GDC talk.
- **TCRF.** The page is behind a Cloudflare challenge and could not be read.
- **Developer tweets.** No neck or honk animation breakdowns were found.
