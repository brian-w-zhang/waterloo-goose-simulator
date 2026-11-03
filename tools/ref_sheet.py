"""Side-by-side sheets for tools/ref_compare.mjs: python -m tools.ref_sheet OUT_DIR ID PAIRS_JSON"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

H = 480


def fit(path):
    im = Image.open(path).convert("RGB")
    return im.resize((round(im.width * H / im.height), H))


def main(out, ident, pairs):
    rows = []
    for p in pairs:
        a, b = fit(p["photo"]), fit(p["game"])
        row = Image.new("RGB", (a.width + b.width + 10, H + 24), "white")
        row.paste(a, (0, 24))
        row.paste(b, (a.width + 10, 24))
        ImageDraw.Draw(row).text((6, 5), f"{Path(p['photo']).name} | game | {p['note']}", fill="black")
        name = Path(out) / f"{ident}_{Path(p['photo']).stem}.jpg"
        row.save(name, quality=88)
        rows.append(row)
    if rows:
        w = max(r.width for r in rows)
        sheet = Image.new("RGB", (w, sum(r.height for r in rows)), "white")
        y = 0
        for r in rows:
            sheet.paste(r, (0, y))
            y += r.height
        sheet.save(Path(out) / f"{ident}_sheet.jpg", quality=85)
        print(f"sheet {Path(out) / f'{ident}_sheet.jpg'} ({len(rows)} pairs)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))
