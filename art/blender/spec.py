"""facades.json (docs/refs/FACADE-SPEC.md) walls in the form arch.facade() draws."""


def to_facade(w, **extra):
    """One wall of facades.json -> arch.facade spec (None for hidden party walls)."""
    if w.get("hidden"):
        return None
    cells = {}
    for k, v in (w.get("cells") or {}).items():
        r, _, b = k.partition("/")
        cells[(r or "*", b or "*")] = v
    out = {"rows": [tuple(r) for r in w["rows"]], "bays": [tuple(b) for b in w["bays"]], "cells": cells,
           "wall": w.get("wall", "concrete"), "bands": [tuple(b) for b in w.get("bands", [])],
           "piers": [tuple(p) for p in w.get("piers", [])]}
    out.update(extra)
    return out


def draw_outline(k, ring, gy, top, walls, specs, default, plinth=1.5):
    """Walls of one massing outline (a lidar tier or a hand-made block) from the building's facade
    specs: an edge lying on a documented wall draws that wall's spec over the part it covers; any
    other edge (setbacks, courts, faces the photos do not show) draws `default`. The rows start at
    the building's ground gy and stop at `top`; a plinth runs down into the terrain below gy."""
    import arch
    import data
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        w, s_off = data.wall_for(a, b, walls)
        sp = specs.get(w["id"]) if w else None
        if w and w["id"] in specs and sp is None:
            continue                                  # a hidden party wall: the neighbour covers it
        sp = sp or default
        k.wall(a, b, gy - plinth, gy, sp.get("wall", "concrete"))
        arch.facade(k, a, b, gy, sp, full=w["length_m"] if w else None, s_off=s_off if w else 0.0, z_top=top)
        if top > gy + sum(r[0] for r in sp["rows"]) + 0.05:
            # the spec is shorter than this outline (a taller tier): finish the wall plainly
            k.wall(a, b, gy + sum(r[0] for r in sp["rows"]), top, sp.get("wall", "concrete"))
