"""Schema and justification check for the agent-written looks.json (doc 08 section 2.5).

Usage: python -m tools.verify.validate_looks RUN_DIR
Every viewpoint needs two passes (shuffled order) with five criteria scored 1 to 5, each with a
justification naming something concrete (at least 25 characters, not a stock phrase). Writes the
per-criterion means and the mean absolute disagreement between passes into RUN_DIR/looks_check.json.
"""
import json
import re
import sys
from pathlib import Path

CRITERIA = ("silhouette", "proportions", "pattern", "colour", "recognisability")
STOCK = re.compile(r"^(looks (good|fine|ok|similar)|matches( well)?|same|similar|good|ok|fine|n/?a)\.?$", re.I)
KEY_VIEWS = {"V01", "V04", "V07", "V08", "V10", "V11", "V13", "V19"}


def check(doc, ids):
    errors, by = [], {}
    for e in doc.get("scores", []):
        by.setdefault(e.get("id"), {})[e.get("pass")] = e
        for c in CRITERIA:
            item = e.get(c)
            if not isinstance(item, dict) or item.get("score") not in (1, 2, 3, 4, 5):
                errors.append(f"{e.get('id')} pass {e.get('pass')}: {c} needs an integer score 1 to 5")
                continue
            why = (item.get("why") or "").strip()
            if len(why) < 25 or STOCK.match(why):
                errors.append(f"{e.get('id')} pass {e.get('pass')}: {c} justification is not a concrete observation")
    for i in ids:
        if set(by.get(i, {})) != {1, 2}:
            errors.append(f"{i}: needs exactly passes 1 and 2")
    return errors, by


def main():
    run = Path(sys.argv[1])
    f = run / "looks.json"
    vp = sorted(p.stem.split("_")[1] for p in (run / "viewpoints").glob("photo_*.png"))
    if not f.exists():
        (run / "looks_check.json").write_text(json.dumps({"valid": False, "errors": ["looks.json missing"]}, indent=1))
        print("looks.json missing")
        return
    doc = json.loads(f.read_text())
    errors, by = check(doc, vp)
    means = {c: sum(e[c]["score"] for p in by.values() for e in p.values()) / max(sum(len(p) for p in by.values()), 1)
             for c in CRITERIA} if not errors else {}
    dis = [abs(p[1][c]["score"] - p[2][c]["score"]) for p in by.values() if 1 in p and 2 in p for c in CRITERIA] if not errors else []
    known = sorted(i for i, p in by.items() if i in KEY_VIEWS and any(e["recognisability"]["score"] == 1 for e in p.values())) if not errors else []
    out = {"valid": not errors, "errors": errors[:30], "mean_per_criterion": means,
           "mean": sum(means.values()) / len(means) if means else None,
           "mean_disagreement": sum(dis) / len(dis) if dis else None, "key_views_scored_1": known}
    (run / "looks_check.json").write_text(json.dumps(out, indent=1))
    print(json.dumps({k: v for k, v in out.items() if k != "errors"}), f"{len(errors)} errors")


if __name__ == "__main__":
    main()
