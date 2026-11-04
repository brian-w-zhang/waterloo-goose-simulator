# Facade analyst brief (one building per agent)

The game recreates the University of Waterloo campus in a flat-colour (Untitled Goose Game) style.
The user rejected generic repeated window grids: every wall is modelled from what the photos show
(materials, colours, window types and counts, doors, panels, bands, canopies, signs, small details)
so each building is instantly recognizable. Your job: read the photos of ONE building and write its
spec. Do not change code or any other file.

Repo: /Users/junzhang/Projects/waterloo-goose-simulator. Building folder: docs/refs/buildings/<id>/.

Read first:
- docs/refs/FACADE-SPEC.md: the output format. Follow it exactly. The drawing code understands cell
  types window, door, glass (ribbon or curtain; give mullion_pitch, transom_pitch), curtain, panel
  (flat colour, or recessed infill with "glass" + "depth"), louvre, blank, void, stripes (module,
  light [w, colour], dark [w, colour]), honeycomb, and "hood" on a window (projection, fin_w,
  fin_colour, soffit_colour). Cells: "row/bay" keys, "*" wildcards, null = plain wall. Bands
  [z_from, z_to, colour, projection]; projection 0 recolours the wall of the rows it covers.
  Colours: palette names from config/palette.json ("world"); if nothing is within about 12 Lab,
  write "#hex (new: short_name)". Rows are metres from the building's ground; bays are metres along
  the wall from its end a to end b (building on your left walking a to b).
- <id>/walls.json (the walls W0.. with ends in art coordinates x east / y north, length, facing).
- <id>/NOTES.md (earlier notes from web and Commons photos).
- `python -m tools.art.study <ABBREV>` output if useful (lidar heights; run it from the repo root
  with .venv/bin/python; it writes review/art/<abbrev>_study.jpg).

Images:
- <id>/private/around/: earth_W*_whole.jpg (each wall square-on), earth_W*_l|m|r.jpg (thirds of long
  walls), earth_corner_*.jpg, sv_<wall>_<pano>_70.jpg (Street View aimed at that wall, detail) and
  _100.jpg (context); pose and date of every image in index.jsonl. Street View shot from inside a
  building comes out black: ignore it.
- <id>/private/earth_*.jpg (orbits), <id>/private/ortho_2023aug.jpg (7 cm top-down),
  <id>/commons/, <id>/private/web/ (+ web.jsonl).
- Scan quickly with contact sheets: `.venv/bin/python -m tools.refs.sheet docs/refs/buildings/<id>/private/around /tmp/<id>_sv.jpg --glob "sv_*_70.jpg"` (other globs likewise), then open single
  images with Read for detail. To see where along a wall a Street View photo looks, intersect its
  heading (index.jsonl lat/lng/heading) with the wall line.
- Sample colours with PIL in .venv/bin/python on sunlit, non-reflective patches; Street View is often
  under-exposed, so judge brightness against sunlit Earth views too.

Per wall (skip walls under ~5 m unless distinctive): material and colours, storey rows, bay sequence
with measured widths (count windows/bays, use the wall length), window type and size per row,
doors (where, width, glazed or solid, canopy), panels, louvres, bands, piers, copings, signage
(text, colour, position), attachments (bridges, stairs, ramps, railings, loading docks, canopies).
Also: the ground beside each wall, small objects with approximate positions (s along the wall,
metres out) for site.entities, bridges and shared walls with neighbours, plazas and paths, roof
equipment. If the lidar massing is wrong somewhere, say so in a top-level "geometry_notes".
Be precise and honest: cite photos for non-obvious claims, mark guesses, note photo dates
(Street View 2023-2025 is most current; Earth is 2024; web/Commons older).

Write docs/refs/buildings/<id>/facades.json (valid JSON; check it loads with python json). Report
back in under 30 lines: walls fully specified vs uncertain, main colours, notable details,
palette additions, geometry problems.
