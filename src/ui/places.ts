/** Map places: grouping for the full map's list, display names, and which buildings get a corner-map label. */
export interface Place { id: string; name: string; x: number; z: number; kind: string }
export type Group = "Goose business" | "Academic" | "Residences" | "Food & shops" | "Landmarks" | "Services";
export const GROUPS: Group[] = ["Goose business", "Academic", "Residences", "Food & shops", "Landmarks", "Services"];

const RESIDENCES = /^(V1|REV|MKV|CLV|CMH|MHR|UWP|UEC|UET|UNC|USC|UWC|UWT)/;
const FOOD = new Set(["SLC", "SCH", "UC", "FED", "GH"]);
const LANDMARKS = new Set(["PAC", "CIF", "POV", "BRH", "TC", "NH", "HH", "LIB"]);
const SERVICES = new Set(["COM", "CSB", "GSC", "GST", "HS", "UWD", "COG"]);

export function groupOf(p: Place): Group {
  if (p.kind === "hotspot") return "Goose business";
  if (p.kind === "water") return "Landmarks";
  if (RESIDENCES.test(p.id)) return "Residences";
  if (FOOD.has(p.id)) return "Food & shops";
  if (LANDMARKS.has(p.id)) return "Landmarks";
  if (SERVICES.has(p.id)) return "Services";
  return "Academic";
}

/** "ENERGY RESEARCH CENTRE" reads as shouting; title-case all-caps names and fix the source's typos. */
export function displayName(name: string): string {
  const n = name.trim().replace("Autonomus", "Autonomous");
  if (n === n.toUpperCase() && /[A-Z]{4}/.test(n)) {
    return n.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bV(\d)\b/, "V$1");
  }
  return n;
}

/** Buildings labelled on the corner map (its scale only has room for the landmarks people navigate by). */
export const MAIN_LABELS = new Set(["MC", "DC", "SLC", "PAC", "LIB", "QNC", "E5", "E7", "M3", "HH", "V1", "RCH", "EIT", "SCH", "NH", "STC", "CMH", "REV", "AL", "ML", "E3", "PHY"]);
