"""Contact sheet of one reference folder: python -m tools.refs.sheet docs/refs/buildings/dc [OUT.jpg] [--glob earth_*]"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

TW = 400


def sheet(folder, out=None, pattern="*.jpg", cols=4):
    folder = Path(folder)
    files = sorted(list(folder.glob(pattern)) + list((folder / "private").glob(pattern)) + list((folder / "commons").glob(pattern)))
    if not files:
        print("no images in", folder)
        return None
    thumbs = []
    for f in files:
        im = Image.open(f).convert("RGB")
        im = im.resize((TW, round(im.height * TW / im.width)))
        lab = Image.new("RGB", (TW, im.height + 16), "white")
        lab.paste(im, (0, 16))
        ImageDraw.Draw(lab).text((4, 2), f.name[:60], fill="black")
        thumbs.append(lab)
    rows = [thumbs[k:k + cols] for k in range(0, len(thumbs), cols)]
    H = sum(max(t.height for t in r) for r in rows)
    S = Image.new("RGB", (TW * cols, H), "white")
    y = 0
    for r in rows:
        for c, t in enumerate(r):
            S.paste(t, (c * TW, y))
        y += max(t.height for t in r)
    out = Path(out) if out else folder / "private" / "_sheet.jpg"
    S.save(out, quality=80)
    print(out, len(files))
    return out


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    g = sys.argv[sys.argv.index("--glob") + 1] if "--glob" in sys.argv else "*.jpg"
    sheet(a[0], a[1] if len(a) > 1 and not a[1].startswith("earth") else None, g)
