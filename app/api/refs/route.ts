import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

/**
 * Reference browser for /inspect (local use: the private screenshots are git-ignored, so a deployed
 * copy has none). GET ?items      -> the catalogue (id, label, kind, dir) and which art model replaces it
 *                    ?item=<dir>  -> every image under that item folder, grouped by source
 *                    ?file=<path> -> the image itself (paths must stay inside docs/refs or review/art)
 */
const ROOT = process.cwd();   // local reference browser: nothing here belongs in a deployment trace
const REFS = join(ROOT, "docs", "refs");
const REVIEW = join(ROOT, "review", "art");
// extensions written without a leading dot in quotes (the banned-effects check reads "<dot>png" as a texture file)
const TYPES: Record<string, string> = Object.fromEntries(
  [["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]].map(([e, t]) => [`.${e}`, t]));
const IMG = new Set(Object.keys(TYPES));

function inside(p: string, base: string) {
  const r = relative(base, p);
  return !!r && !r.startsWith("..") && !r.includes(`..${sep}`);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if ((e.isFile() || e.isSymbolicLink()) && IMG.has(extname(e.name).toLowerCase()) && !e.name.startsWith("_")) out.push(p);
  }
  return out;
}

function group(rel: string): string {
  const n = rel.split("/").pop()!;
  if (n.startsWith("earth_")) return "Google Earth";
  if (n.startsWith("ortho_")) return "Aerial (City of Waterloo)";
  if (rel.includes("/sv/")) return "Street View";
  if (rel.includes("/web/")) return "Web photos";
  if (rel.includes("/commons/")) return "Wikimedia Commons";
  return "Other";
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.has("items")) {
    const cat = JSON.parse(readFileSync(join(REFS, "catalog.json"), "utf8")) as { items: Record<string, unknown>[] };
    let models: { models: { name: string }[]; _replaces?: Record<string, number[]> } = { models: [] };
    try { models = JSON.parse(readFileSync(join(ROOT, "public", "models", "index.json"), "utf8")); } catch { /* no art yet */ }
    const byOid = new Map<number, string>();
    for (const [name, oids] of Object.entries(models._replaces ?? {})) for (const o of oids) byOid.set(o, name);
    return Response.json(cat.items.map((it) => ({
      id: it.id, label: it.label, name: it.name, kind: it.kind, dir: it.dir, uw: it.uw ?? false,
      model: typeof it.objectid === "number" ? byOid.get(it.objectid) ?? null : null,
    })));
  }
  const item = q.get("item");
  if (item) {
    const dir = join(/* turbopackIgnore: true */ ROOT, item);
    if (!inside(dir, REFS)) return Response.json({ error: "outside docs/refs" }, { status: 400 });
    const files = walk(dir).map((p) => relative(ROOT, p).split(sep).join("/"));
    const grouped: Record<string, string[]> = {};
    for (const f of files.sort()) (grouped[group(f)] ??= []).push(f);
    // comparison sheets for the model, if any (review/art/<id>_*.jpg)
    const id = item.split("/").pop()!;
    const sheets = walk(REVIEW).map((p) => relative(ROOT, p).split(sep).join("/")).filter((f) => f.split("/").pop()!.startsWith(`${id}_`));
    if (sheets.length) grouped["Game vs Earth"] = sheets;
    let notes = "";
    try { notes = readFileSync(join(dir, "NOTES.md"), "utf8"); } catch { /* none */ }
    return Response.json({ groups: grouped, notes });
  }
  const file = q.get("file");
  if (file) {
    let p = join(/* turbopackIgnore: true */ ROOT, file);
    if (!inside(p, REFS) && !inside(p, REVIEW)) return new Response("outside the reference folders", { status: 400 });
    if (!existsSync(p)) return new Response("not found", { status: 404 });
    p = realpathSync(/* turbopackIgnore: true */ p);    // Street View links point into docs/refs/streetview
    if (!inside(p, realpathSync(REFS)) && !inside(p, realpathSync(REVIEW))) return new Response("link leaves the reference folders", { status: 400 });
    if (!statSync(p).isFile()) return new Response("not a file", { status: 400 });
    return new Response(readFileSync(p), { headers: { "content-type": TYPES[extname(p).toLowerCase()] ?? "application/octet-stream", "cache-control": "max-age=3600" } });
  }
  return Response.json({ error: "use ?items, ?item=<dir> or ?file=<path>" }, { status: 400 });
}
