// Palette lock, static part (doc 08 section 3.2): no colour literals in src/ or app/ outside config/palette.json.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "app"];
const PATTERNS = [/#[0-9a-fA-F]{6}\b/, /#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/, /new\s+(THREE\.)?Color\(\s*(0x|["'#]|\d)/, /\brgba?\(/, /0x[0-9a-fA-F]{6}\b/];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|css)$/.test(p) ? [p] : [];
  });
}

const hits: string[] = [];
for (const file of ROOTS.flatMap(walk)) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (PATTERNS.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}
console.log(JSON.stringify({ static_colour_violations: hits.length, hits }));
