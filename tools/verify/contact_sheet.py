"""Pairs, contact sheet and overlay sheet (doc 08 sections 2.2 and 2.5).

Usage: python -m tools.verify.contact_sheet RUN_DIR
Writes review/pairs/Vnn.jpg (reference photo | photo-match render, attribution line),
review/contact-sheet.jpg (20 rows: photo, photo-match, game camera, scores) and
review/overlays/ (copies of the run's top-down overlays plus overlay-sheet.jpg).
Photos come from the gitignored cache; review images are gitignored too (public repo).
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pipeline.config import ROOT

REVIEW = ROOT / "review"
REFS = ROOT / "verify" / "cache" / "refs"
VP = json.loads((ROOT / "verify" / "ground-truth" / "viewpoints.json").read_text())["viewpoints"]
H = 300


def font(size):
    for f in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit(img, h=H):
    return img.resize((max(1, int(img.width * h / img.height)), h), Image.LANCZOS)


def attribution(v):
    r = v["reference"]
    return f"{v['id']} {v['name']}: photo \"{r['title'].removeprefix('File:')}\" by {r['author'] or 'unknown author'}, {r['licence']}, Wikimedia Commons"


def main():
    run = Path(sys.argv[1])
    vpdir = run / "viewpoints"
    looks = {}
    if (run / "looks.json").exists():
        for e in json.loads((run / "looks.json").read_text()).get("scores", []):
            looks.setdefault(e["id"], []).append(e)
    pairs = REVIEW / "pairs"
    pairs.mkdir(parents=True, exist_ok=True)
    f_small, f_big = font(14), font(18)
    rows = []
    for v in VP:
        ref = REFS / f"{v['id']}.jpg"
        photo = vpdir / f"photo_{v['id']}.png"
        game = vpdir / f"game_{v['id']}.png"
        if not (ref.exists() and photo.exists()):
            continue
        a, b = fit(Image.open(ref).convert("RGB")), fit(Image.open(photo).convert("RGB"))
        pair = Image.new("RGB", (a.width + b.width + 10, H + 28), "white")
        pair.paste(a, (0, 0))
        pair.paste(b, (a.width + 10, 0))
        ImageDraw.Draw(pair).text((4, H + 6), attribution(v), fill="black", font=f_small)
        pair.save(pairs / f"{v['id']}.jpg", quality=88)
        g = fit(Image.open(game).convert("RGB")) if game.exists() else Image.new("RGB", (533, H), "white")
        rows.append((v, a, b, g))
    if not rows:
        print("no viewpoint renders")
        return
    score_w = 420
    W = max(r[1].width for r in rows) + max(r[2].width for r in rows) + max(r[3].width for r in rows) + score_w + 40
    sheet = Image.new("RGB", (W, len(rows) * (H + 34) + 40), "white")
    d = ImageDraw.Draw(sheet)
    d.text((10, 10), "Reference photo | photo-match render | game-camera render | looks scores (two blind passes)", fill="black", font=f_big)
    y = 40
    for v, a, b, g in rows:
        x = 0
        for img in (a, b, g):
            sheet.paste(img, (x, y))
            x += img.width + 10
        lines = []
        for e in looks.get(v["id"], []):
            lines.append(f"pass {e['pass']}: " + " ".join(f"{k[:4]} {e[k]['score']}" for k in
                                                          ("silhouette", "proportions", "pattern", "colour", "recognisability")))
        d.multiline_text((x + 6, y + 6), "\n".join(lines) or "not scored", fill="black", font=f_small, spacing=6)
        d.text((4, y + H + 6), attribution(v), fill="black", font=f_small)
        y += H + 34
    sheet.save(REVIEW / "contact-sheet.jpg", quality=85)
    ov = run / "overlays"
    if ov.exists():
        dst = REVIEW / "overlays"
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(ov, dst)
        tiles = sorted(dst.glob("overlay_*.png"))
        cols = 10
        t = 160
        osheet = Image.new("RGB", (cols * t, ((len(tiles) + cols - 1) // cols) * t), "white")
        for k, f in enumerate(sorted(tiles, key=lambda p: (-int(p.stem.split("_")[2]), int(p.stem.split("_")[1])))):
            osheet.paste(Image.open(f).convert("RGB").resize((t, t)), ((k % cols) * t, (k // cols) * t))
        osheet.save(dst / "overlay-sheet.jpg", quality=85)
    print(f"pairs {len(rows)}, contact sheet {REVIEW / 'contact-sheet.jpg'}")


if __name__ == "__main__":
    main()
