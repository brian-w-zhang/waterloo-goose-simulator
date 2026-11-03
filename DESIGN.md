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
