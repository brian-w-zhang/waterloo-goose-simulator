# Rules for parallel work agents (Nov 2026)

Several agents work in this repo at once (buildings, trees, goose, people, UI). To stay out of
each other's way:

- Touch only the files your brief lists as yours. If you need a change elsewhere (for example a
  hook in src/game/engine.ts), keep it small and self-contained, and say so in your report.
- Do not commit, push or change git state. The lead commits.
- Blender: use headless Blender only (`npm run art -- <model>` or `blender -b -P ...`). Never use the
  Blender MCP tools: the live Blender belongs to the lead.
- Do not restart the shared server on port 3100. To test, run your own: `npm run build` must not be
  used concurrently either, so use the dev server on another port: `PORT=31xx npx next dev -p 31xx`,
  and point tools at it with `PORT=31xx`. Stop it when done.
- Do not delete or move anything under docs/refs/ (other agents read it).
- Palette: new colours go in config/palette.json "world" (or "goose", "people", "ui") with a comment-
  free key; keep the flat Untitled Goose Game look: no textures, palette colours only.
- Art style: flat colours, soft shapes, recognisable silhouettes; read docs/research/modelling-guide.md
  (Blender technique, glTF export, three.js loading) and docs/research/goose-mechanics-spec.md.
- Tests: `npx tsc --noEmit`, `npx vitest run`, `.venv/bin/python -m pytest -q pipeline` must pass.
- Report back in under 40 lines: what changed (files), how you checked it (screenshots under
  review/<your area>/), what is left.
