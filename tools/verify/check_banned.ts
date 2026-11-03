// Banned effects (doc 08 section 3.4): bloom, PBR on world geometry, env maps, DOF, grain, vignette,
// lens flare, motion blur, file textures, ACES or filmic tone mapping, ink outline passes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED: [string, RegExp][] = [
  ["bloom", /BloomNode|\bbloom\(/],
  ["pbr", /MeshStandard(Node)?Material|MeshPhysical(Node)?Material/],
  ["envmap", /envMap|PMREMGenerator|RoomEnvironment/],
  ["ssr", /SSRNode|\bssr\(/],
  ["dof", /DepthOfFieldNode|\bdof\(/],
  ["grain", /FilmNode|\bfilm\(/],
  ["chromatic", /ChromaticAberrationNode|chromaticAberration\(/],
  ["vignette", /vignette/i],
  ["lensflare", /LensflareMesh|Lensflare|lensflare\(/],
  ["motionblur", /motionBlur|MotionBlur/],
  ["file_texture", /TextureLoader|\.(png|jpe?g|webp|ktx2)["']/],
  ["tonemapping", /ACESFilmicToneMapping|AgXToneMapping|CineonToneMapping|ReinhardToneMapping/],
  ["outline", /toonOutlinePass|OutlineNode|SobelOperatorNode/],
  ["normal_maps", /normalMap|roughnessMap|metalnessMap/],
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

const hits: string[] = [];
for (const file of ["src", "app"].flatMap(walk)) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const [name, re] of BANNED) if (re.test(line)) hits.push(`${name} ${file}:${i + 1}`);
  });
}
console.log(JSON.stringify({ static_banned_violations: hits.length, hits }));
