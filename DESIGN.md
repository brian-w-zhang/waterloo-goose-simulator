# Design rules

## Goose plausibility (doc 03 R-G2)

The goose can carry, drag, push, honk near things and operate a simple switch. It never combines items or uses a tool. Every interaction is one of those verbs; the rule holds everywhere.

## Verbs

Honk (Space), grab and drop (G or click), crouch (C: slower, harder to see), flap (F: a speed boost while running), run (Shift). People are slightly faster than a running goose, so escapes use timing, flapping and obstacles.

## Tone (doc 04 section 4.3)

Slapstick only: nobody is hurt, there are no police, nothing escalates to violence, and characters are fictional (no real people). Pranks reset: people retrieve and return their things, or give up and scratch their heads.

## Items

Every item has an owner, a home position and a zone (schema in `src/sim/sim.ts`). Props are drawn 1.5 times life size so they read from the diorama camera; the map itself stays to scale and is gated by the verification harness.

## Look

Flat palette colours from `config/palette.json` only, no textures, no ink outlines, faint soft shadows, a high narrow camera; buildings take their colours and window patterns from photo research (`docs/research/building-looks.md`). Our goose is a Canada goose: black head and neck, white chinstrap, brown-grey body.

## Tasks and their solution paths (doc 03 R-T2)

Every task has at least two ways to complete it; the first path of each is checked headlessly in `tests/sim/hotspot.test.ts` where marked.

### MC and DC green

| Task | Path 1 | Path 2 |
|---|---|---|
| Steal the professor's coffee | Honk up close so the professor drops it, then grab it (tested) | Wait until the professor sets it down at home and sneak in crouched from behind |
| Honk someone into dropping what they carry | Close honk at the professor (tested) or the tour guide | Honk at a character carrying an item back home after a chase |
| Get chased across the green | Grab any owned item in its owner's view (tested) | Grab an item out of view, then walk past its owner |
| Run off with the tour flag | Honk at the guide, then grab the dropped flag | Wait for the guide to plant it during the routine and take it from the grass |
| Hide an engineer's iron ring box | Carry it more than 20 m away and drop it (tested) | Drop it behind a building wall where Jo cannot see it, then lead Jo away with a honk |
| Make someone give up and scratch their head | Outrun a chaser for 12 s or past their 40 m leash | Hide behind a building until they lose sight for 4 s |
| Finale (unlocks after 4 tasks): deliver the professor's laptop to the SLC plaza | Grab the laptop while the professor investigates a honk and run to the plaza | Lure the professor away with honks, then drag the laptop along the path |

### SLC and PAC plaza

| Task | Path 1 | Path 2 |
|---|---|---|
| Make off with a box of pizza | Honk the vendor into dropping the box, grab it | Take the second box from the stall while the vendor chases a crowd scatter |
| Steal the coach's basketball | Honk the coach, grab the dropped ball | Grab it from the rack when the coach walks the drill loop |
| Carry the thesis laptop 15 m away | Grab it while Alex flees a honk (Alex is a scaredy archetype) | Wait for Alex to walk the routine loop, then take it |
| Pinch the busker's tip hat | Sneak in crouched while the busker faces away | Honk to send the busker investigating, then grab |
| Get shooed off the plaza | Stand near the vendor's stall (tested) | Honk three times near the coach |

### Village 1 ring

| Task | Path 1 | Path 2 |
|---|---|---|
| Snatch the don's master key card | Close honk at the don, grab the dropped card | Steal it after the don sets it down on the routine loop |
| Make Riley drop the laundry basket | Close honk at Riley | Get Riley to chase you, then honk once Riley is close |
| Run off with a stray sock | Grab any stray sock while Riley is busy | Make Riley drop the basket first, then take one of the spilled socks |
| Steal the team frisbee and drop it far away | Honk Jordan (scaredy) away, grab and run | Grab it during the routine while Jordan walks the far end |

## Procedural decoration (not map data)

Grass tufts, flowers and foundation shrubs along walls that face lawn are seeded decoration placed by the pipeline from the real lawn and footprint geometry (`pipeline/build/tufts.py`, seed in `config/campus.json`). They are not surveyed features and no geometry gate depends on them; they exist for the dense, hand-made look of the reference style.
