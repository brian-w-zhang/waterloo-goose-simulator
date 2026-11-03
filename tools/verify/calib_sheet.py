"""Compose calibration candidates next to the reference photo: python -m tools.verify.calib_sheet DIR VP"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from pipeline.config import ROOT


def main():
    d, vp = Path(sys.argv[1]), sys.argv[2]
    files = sorted(d.glob(f"{vp}_b*_h*.png"), key=lambda p: (int(p.stem.split("_b")[1].split("_")[0]), int(p.stem.split("_h")[1])))
    backs = sorted({int(p.stem.split("_b")[1].split("_")[0]) for p in files})
    heads = sorted({int(p.stem.split("_h")[1]) for p in files})
    tw, th = 320, 180
    ref = Image.open(ROOT / "verify" / "cache" / "refs" / f"{vp}.jpg").convert("RGB")
    ref = ref.resize((int(ref.width * th * 2 / ref.height), th * 2))
    sheet = Image.new("RGB", (ref.width + len(heads) * tw, max(th * 2, len(backs) * th)), "white")
    sheet.paste(ref, (0, 0))
    dr = ImageDraw.Draw(sheet)
    for f in files:
        b = int(f.stem.split("_b")[1].split("_")[0])
        h = int(f.stem.split("_h")[1])
        x, y = ref.width + heads.index(h) * tw, backs.index(b) * th
        sheet.paste(Image.open(f).convert("RGB").resize((tw, th)), (x, y))
        dr.text((x + 4, y + 4), f"back {b} m, heading {h:+d}", fill="black")
    out = d / f"sheet_{vp}.jpg"
    sheet.save(out, quality=85)
    print(out)


if __name__ == "__main__":
    main()
