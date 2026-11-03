import type { Archetype, Sim, V2 } from "@/sim/sim";
import type { PersonLook } from "./actors";

/**
 * Hotspot 1: the open green between MC and DC (doc 06 M2 enclosure). Characters are fictional
 * (tone rules: no real people). Offsets are metres from the anchor, which is the green's centre,
 * 23 m from the nearest wall or path, so every spot below is lawn.
 */
export const ANCHOR: V2 = { x: 940, z: -382 };

interface CharacterDef {
  id: string; name: string; archetype: Archetype; look: PersonLook; home: [number, number];
  routine: [number, number][]; items: { kind: string; at: [number, number]; name: string }[];
}

export const CHARACTERS: CharacterDef[] = [
  { id: "prof", name: "Professor Larkin", archetype: "normal",
    look: { skin: "skin_a", hair: "hair_grey", top: "cloth_cream", bottom: "cloth_grey" },
    home: [-8, 4], routine: [[-8, 4], [-12, -2], [-6, -6], [-3, 2]],
    items: [{ kind: "coffee", at: [-7, 5], name: "the professor's coffee" }, { kind: "textbook", at: [-9, 5.5], name: "a calculus textbook" },
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
    items: [{ kind: "flag", at: [3, 13], name: "the tour flag" }, { kind: "watcard", at: [1, 11], name: "a WatCard" },
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
];

export const ITEM_WEIGHT: Record<string, "carry" | "drag"> = { cone: "drag", backpack: "drag", umbrella: "carry", flag: "carry" };

/** Populate the simulation with the hotspot's characters and items (30 interactables). */
export function populate(sim: Sim) {
  const at = ([dx, dz]: [number, number]): V2 => ({ x: ANCHOR.x + dx, z: ANCHOR.z + dz });
  let k = 0;
  for (const c of CHARACTERS) {
    sim.addNpc({ id: c.id, name: c.name, archetype: c.archetype, home: at(c.home), routine: c.routine.map(at) });
    for (const it of c.items) {
      sim.addItem({ id: `${it.kind}_${k++}`, name: it.name, kind: "take", weight: ITEM_WEIGHT[it.kind] ?? "carry",
        owner: c.id, homePos: at(it.at), zone: "mc_dc_green", flags: { noisy: it.kind === "laptop" } });
    }
  }
}
