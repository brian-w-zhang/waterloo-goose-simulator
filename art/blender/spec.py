"""facades.json (docs/refs/FACADE-SPEC.md) walls in the form arch.facade() draws."""


def to_facade(w, **extra):
    """One wall of facades.json -> arch.facade spec (None for hidden party walls)."""
    if w.get("hidden"):
        return None
    cells = {}
    for k, v in (w.get("cells") or {}).items():
        r, _, b = k.partition("/")
        # notes written in place of a cell (strings) mean plain wall
        cells[(r or "*", b or "*")] = v if isinstance(v, dict) else None
    z0 = w.get("z0", 0.0) if w.get("upper") else 0.0
    out = {"z0": z0, "rows": [tuple(r) for r in w["rows"]], "bays": [tuple(b) for b in w["bays"]], "cells": cells,
           "wall": w.get("wall", "concrete"), "bands": [(b[0] - z0, b[1] - z0, b[2], b[3] if len(b) > 3 and isinstance(b[3], (int, float)) else 0.0)
                     for b in w.get("bands", []) if len(b) >= 3],
           "piers": [tuple(p[:4]) for p in w.get("piers", []) if isinstance(p, (list, tuple)) and len(p) >= 4]}
    # cells that point at a shared block ("see": "honeycomb" or "W12.honeycomb") carry it with them
    for c in cells.values():
        if isinstance(c, dict) and c.get("see"):
            c["_spec"] = (extra.get("shared") or {}).get(c["see"].split(".")[-1], w.get(c["see"].split(".")[-1], {}))
    out.update({k: v for k, v in extra.items() if k != "shared"})
    return out


def draw_outline(k, ring, gy, top, walls, specs, default, plinth=1.5, tol=1.5):
    """Walls of one massing outline (a lidar tier or a hand-made block) from the building's facade
    specs: an edge lying on a documented wall draws that wall's spec over the part it covers; any
    other edge (setbacks, courts, faces the photos do not show) draws `default`. The rows start at
    the building's ground gy and stop at `top`; a plinth runs down into the terrain below gy."""
    import arch
    import data
    for i in range(len(ring)):
        for a, b, w, s_off in data.wall_pieces(ring[i], ring[(i + 1) % len(ring)], walls, tol):
            _piece(k, a, b, gy, top, w, s_off, specs, default, plinth)


def _piece(k, a, b, gy, top, w, s_off, specs, default, plinth):
    import arch
    sp = specs.get(w["id"]) if w else None
    if w and w["id"] in specs and sp is None:
        return                                    # a hidden party wall: the neighbour covers it
    sp = sp or default
    base = gy + sp.get("z0", 0.0)                 # upper faces (QNC's U walls) start above the ground
    if base >= top - 0.05:
        k.wall(a, b, gy - plinth, top, sp.get("wall", "concrete"))
        return
    k.wall(a, b, gy - plinth, base, sp.get("wall", "concrete"))
    arch.facade(k, a, b, base, sp, full=w["length_m"] if w else None, s_off=s_off if w else 0.0, z_top=top)
    if top > base + sum(r[0] for r in sp["rows"]) + 0.05:
        # the spec is shorter than this outline (a taller tier): finish the wall plainly
        k.wall(a, b, base + sum(r[0] for r in sp["rows"]), top, sp.get("wall", "concrete"))
