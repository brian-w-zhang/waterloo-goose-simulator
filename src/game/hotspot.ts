import type { Archetype, Sim, SimEvent, V2 } from "@/sim/sim";
import type { PersonLook } from "./actors";

/**
 * Hotspots (doc 06 M2 enclosures): dense sets of characters and owned items inside the open world.
 * Characters are fictional (tone rules: no real people). Offsets are metres from each anchor, an open
 * spot found from the packed world (lawn or paving well clear of walls).
 */

interface CharacterDef {
  id: string; name: string; archetype: Archetype; look: PersonLook; home: [number, number];
  routine: [number, number][]; items: { kind: string; at: [number, number]; name: string; held?: boolean }[];
}

export interface TaskDef { id: string; text: string; test: (e: SimEvent, sim: Sim) => boolean }

export interface HotspotDef { id: string; name: string; anchor: V2; characters: CharacterDef[]; tasks: TaskDef[] }

const grabbed = (name: string) => (e: SimEvent, s: Sim) => e.type === "grab" && e.who === "goose" && s.items.get(e.item)!.name === name;
const npcIn = (zone: string, s: Sim, id: string) => id.startsWith(`${zone}:`) && s.npcs.has(id);
const movedFar = (name: string, m: number) => (e: SimEvent, s: Sim) => {
  if (e.type !== "release" || s.items.get(e.item)!.name !== name) return false;
  const it = s.items.get(e.item)!;
  return Math.hypot(it.pos.x - it.homePos.x, it.pos.z - it.homePos.z) > m;
};

export const HOTSPOTS: HotspotDef[] = [
  {
    id: "green", name: "MC and DC green", anchor: { x: 940, z: -382 },
    characters: [
      { id: "prof", name: "Professor Larkin", archetype: "normal",
        look: { skin: "skin_a", hair: "hair_grey", top: "cloth_cream", bottom: "cloth_grey" },
        home: [-8, 4], routine: [[-8, 4], [-12, -2], [-6, -6], [-3, 2]],
        items: [{ kind: "coffee", at: [-7, 5], name: "the professor's coffee", held: true }, { kind: "textbook", at: [-9, 5.5], name: "a calculus textbook" },
          { kind: "laptop", at: [-8.5, 3], name: "the professor's laptop" }, { kind: "apple", at: [-6.5, 3.5], name: "an apple" },
          { kind: "textbook", at: [-10, 2], name: "a linear algebra textbook" }, { kind: "coffee", at: [-11, -1], name: "a forgotten coffee" }] },
      { id: "keeper", name: "Groundskeeper Morgan", archetype: "chaser",
        look: { skin: "skin_c", hair: "hair_dark", top: "hivis", bottom: "cloth_green", hat: "hardhat" },
        home: [9, -8], routine: [[9, -8], [12, 0], [6, 8], [-2, -12]],
        items: [{ kind: "cone", at: [10, -9], name: "a traffic cone" }, { kind: "cone", at: [11.5, -7], name: "a traffic cone" },
          { kind: "cone", at: [13, -5], name: "a traffic cone" }, { kind: "cone", at: [8, -11], name: "a traffic cone" },
          { kind: "hardhat", at: [7, -7], name: "a spare hard hat" }, { kind: "umbrella", at: [9, -6], name: "a big umbrella" }] },
      { id: "guide", name: "Tour guide Priya", archetype: "normal",
        look: { skin: "skin_b", hair: "hair_dark", top: "cloth_gold", bottom: "cloth_black" },
        home: [2, 12], routine: [[2, 12], [-6, 10], [-2, 15], [6, 14]],
        items: [{ kind: "flag", at: [3, 13], name: "the tour flag", held: true }, { kind: "watcard", at: [1, 11], name: "a WatCard" },
          { kind: "umbrella", at: [4, 11], name: "an umbrella" }, { kind: "coffee", at: [0, 13.5], name: "a latte" },
          { kind: "backpack", at: [5, 12.5], name: "a tote of brochures" }] },
      { id: "frosh", name: "First-year Sam", archetype: "scaredy",
        look: { skin: "skin_d", hair: "hair_blond", top: "cloth_red", bottom: "denim" },
        home: [-3, -10], routine: [[-3, -10], [3, -12], [0, -5]],
        items: [{ kind: "backpack", at: [-4, -11], name: "Sam's backpack" }, { kind: "frisbee", at: [-1, -9], name: "a frisbee" },
          { kind: "apple", at: [-5, -9.5], name: "a snack apple" }, { kind: "watcard", at: [-2, -11.5], name: "Sam's WatCard" },
          { kind: "textbook", at: [-3.5, -8], name: "a chemistry textbook" }, { kind: "coffee", at: [1, -10], name: "an iced coffee" }] },
      { id: "eng", name: "Engineering student Jo", archetype: "normal",
        look: { skin: "skin_b", hair: "hair_brown", top: "cloth_navy", bottom: "cloth_grey" },
        home: [12, 6], routine: [[12, 6], [8, 2], [14, 10]],
        items: [{ kind: "ringbox", at: [13, 7], name: "an iron ring box" }, { kind: "laptop", at: [11, 7.5], name: "Jo's laptop" },
          { kind: "coffee", at: [12.5, 4.5], name: "Jo's coffee" }, { kind: "textbook", at: [10.5, 5], name: "a statics textbook" },
          { kind: "frisbee", at: [14, 8], name: "a club frisbee" }, { kind: "apple", at: [13.5, 5.5], name: "an apple" },
          { kind: "backpack", at: [10, 8], name: "Jo's backpack" }] },
    ],
    tasks: [
      { id: "coffee", text: "Steal the professor's coffee", test: grabbed("the professor's coffee") },
      { id: "drop", text: "Honk someone into dropping what they carry", test: (e, s) => e.type === "drop" && npcIn("green", s, e.npc) },
      { id: "chase", text: "Get chased across the green", test: (e, s) => e.type === "chase" && npcIn("green", s, e.npc) },
      { id: "flag", text: "Run off with the tour flag", test: grabbed("the tour flag") },
      { id: "ring", text: "Hide an engineer's iron ring box", test: movedFar("an iron ring box", 20) },
      { id: "giveup", text: "Make someone give up and scratch their head", test: (e, s) => e.type === "giveup" && npcIn("green", s, e.npc) },
    ],
  },
  {
    id: "plaza", name: "SLC and PAC plaza", anchor: { x: 722, z: -290 },
    characters: [
      { id: "vendor", name: "Lunch vendor Dev", archetype: "chaser",
        look: { skin: "skin_c", hair: "hair_dark", top: "cloth_cream", bottom: "cloth_navy" },
        home: [-6, 2], routine: [[-6, 2], [-8, 5], [-4, -1]],
        items: [{ kind: "pizza", at: [-5, 3], name: "a box of pizza", held: true }, { kind: "pizza", at: [-7, 1.5], name: "a second pizza box" },
          { kind: "bottle", at: [-6.5, 3.5], name: "a water bottle" }, { kind: "apple", at: [-4.5, 1], name: "a fruit cup" }] },
      { id: "coach", name: "Coach Rivera", archetype: "chaser",
        look: { skin: "skin_a", hair: "hair_brown", top: "cloth_gold", bottom: "cloth_black" },
        home: [-14, -14], routine: [[-14, -14], [-10, -8], [-16, -6]],
        items: [{ kind: "ball", at: [-13, -13], name: "a basketball", held: true }, { kind: "ball", at: [-15, -12], name: "a volleyball" },
          { kind: "bottle", at: [-12, -15], name: "the coach's water bottle" }, { kind: "cone", at: [-11, -11], name: "a drill cone" }] },
      { id: "studier", name: "Grad student Alex", archetype: "scaredy",
        look: { skin: "skin_b", hair: "hair_dark", top: "cloth_green", bottom: "denim" },
        home: [6, -4], routine: [[6, -4], [8, -6], [4, -2]],
        items: [{ kind: "laptop", at: [6.5, -3.5], name: "Alex's thesis laptop" }, { kind: "textbook", at: [5, -5], name: "a stack of journal papers" },
          { kind: "coffee", at: [7, -4.5], name: "a double espresso" }] },
      { id: "busker", name: "Busker Kim", archetype: "normal",
        look: { skin: "skin_d", hair: "hair_blond", top: "cloth_red", bottom: "cloth_grey", hat: "cloth_navy" },
        home: [3, 8], routine: [[3, 8], [1, 10], [5, 9]],
        items: [{ kind: "hat", at: [4, 8.5], name: "the busker's tip hat" }, { kind: "bottle", at: [2, 7], name: "a thermos" }] },
    ],
    tasks: [
      { id: "pizza", text: "Make off with a box of pizza", test: grabbed("a box of pizza") },
      { id: "ball", text: "Steal the coach's basketball", test: grabbed("a basketball") },
      { id: "laptop", text: "Carry the thesis laptop 15 m away", test: movedFar("Alex's thesis laptop", 15) },
      { id: "hat", text: "Pinch the busker's tip hat", test: grabbed("the busker's tip hat") },
      { id: "shoo", text: "Get shooed off the plaza", test: (e, s) => e.type === "shoo" && npcIn("plaza", s, e.npc) },
    ],
  },
  {
    id: "village", name: "Village 1 ring", anchor: { x: 442, z: -232 },
    characters: [
      { id: "don", name: "Residence don Taylor", archetype: "chaser",
        look: { skin: "skin_b", hair: "hair_brown", top: "cloth_navy", bottom: "denim" },
        home: [-4, 3], routine: [[-4, 3], [2, 6], [5, -2], [-3, -4]],
        items: [{ kind: "watcard", at: [-3.5, 3.5], name: "the don's master key card", held: true }, { kind: "bottle", at: [-5, 2], name: "the don's mug" }] },
      { id: "laundry", name: "Student with laundry, Riley", archetype: "normal",
        look: { skin: "skin_a", hair: "hair_blond", top: "cloth_green", bottom: "cloth_grey" },
        home: [6, 4], routine: [[6, 4], [9, 1], [4, 8]],
        items: [{ kind: "basket", at: [6.5, 4.5], name: "a laundry basket", held: true }, { kind: "sock", at: [7, 3], name: "a stray sock" },
          { kind: "sock", at: [5.5, 5.5], name: "another stray sock" }] },
      { id: "frisbee", name: "Ultimate player Jordan", archetype: "scaredy",
        look: { skin: "skin_c", hair: "hair_dark", top: "cloth_red", bottom: "cloth_black" },
        home: [-6, -8], routine: [[-6, -8], [2, -10], [-8, -4]],
        items: [{ kind: "frisbee", at: [-5, -8.5], name: "the team frisbee" }, { kind: "bottle", at: [-7, -9], name: "a sports drink" },
          { kind: "backpack", at: [-6.5, -7], name: "a gym bag" }] },
    ],
    tasks: [
      { id: "key", text: "Snatch the don's master key card", test: grabbed("the don's master key card") },
      { id: "basket", text: "Make Riley drop the laundry basket", test: (e, s) => e.type === "drop" && s.items.get(e.item)!.name === "a laundry basket" },
      { id: "sock", text: "Run off with a stray sock", test: grabbed("a stray sock") },
      { id: "frisbee", text: "Steal the team frisbee and drop it far away", test: movedFar("the team frisbee", 20) },
    ],
  },
];

export const ITEM_WEIGHT: Record<string, "carry" | "drag"> = { cone: "drag", backpack: "drag", basket: "drag", umbrella: "carry", flag: "carry", pizza: "carry" };

/** Populate the simulation with every hotspot's characters and items; ids are "<hotspot>:<id>". */
export function populate(sim: Sim) {
  let k = 0;
  for (const h of HOTSPOTS) {
    const at = ([dx, dz]: [number, number]): V2 => ({ x: h.anchor.x + dx, z: h.anchor.z + dz });
    for (const c of h.characters) {
      const npcId = `${h.id}:${c.id}`;
      sim.addNpc({ id: npcId, name: c.name, archetype: c.archetype, home: at(c.home), routine: c.routine.map(at) });
      for (const it of c.items) {
        const id = `${it.kind}_${k++}`;
        sim.addItem({ id, name: it.name, kind: "take", weight: ITEM_WEIGHT[it.kind] ?? "carry",
          owner: npcId, homePos: at(it.at), zone: h.id, flags: { noisy: it.kind === "laptop" } });
        // some things start in their owner's hands: honk first to make them drop it
        if (it.held) { sim.items.get(id)!.heldBy = npcId; sim.npcs.get(npcId)!.holding = id; }
      }
    }
  }
}

export const LOOKS = new Map(HOTSPOTS.flatMap((h) => h.characters.map((c) => [`${h.id}:${c.id}`, c.look] as const)));
