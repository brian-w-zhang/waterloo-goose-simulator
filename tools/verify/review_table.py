"""Metrics table for REVIEW.md from run summaries.

python -m tools.verify.review_table FIRST_RUN LATEST_RUN [WEBGL_RUN]
The optional WebGL2 run adds a column with its value for every metric.
"""
import json
import sys
from pathlib import Path


def load(p):
    return json.loads((Path(p) / "summary.json").read_text())["metrics"]


def fmt(v):
    if isinstance(v, float):
        return f"{v:.4g}"
    return str(v)


def main():
    first, last = load(sys.argv[1]), load(sys.argv[2])
    gl = load(sys.argv[3]) if len(sys.argv) > 3 else None
    head = "| metric | value | gate | pass | first run of the night | change |"
    rows = [head + (" WebGL2 |" if gl else ""), "|---|---|---|---|---|---|" + ("---|" if gl else "")]
    for k, r in last.items():
        if r.get("op") is None:
            continue
        f = first.get(k, {}).get("value")
        v = r["value"]
        ch = f"{v - f:+.4g}" if isinstance(v, (int, float)) and isinstance(f, (int, float)) else "new"
        gate = f"{r['op']} {r['gate']}" if r["op"] != "record" else "record only"
        ok = "report" if r.get("report_only") else {True: "pass", False: "**FAIL**", None: "-"}[r.get("pass")]
        row = f"| {k} | {fmt(v)} | {gate} | {ok} | {fmt(f) if f is not None else '-'} | {ch} |"
        if gl is not None:
            g = gl.get(k, {}).get("value")
            row += f" {fmt(g) if g is not None else '-'} |"
        rows.append(row)
    print("\n".join(rows))


if __name__ == "__main__":
    main()
