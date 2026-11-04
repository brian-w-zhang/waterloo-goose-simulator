"""Campus buildings from the generic builder (art/blender/generic.py): each one's own lidar massing and
style, with overrides from its references. A building moves to its own script when it needs one-off
parts the generic builder cannot make (DC's vaults, QNC's honeycomb, MC's hoods, SLC's crescent).

Order and membership follow docs/refs/MODEL-PLAN.md (tier 1, Ring Road core, nearest cluster first).
"""
import arch
import generic

MODELS = {
    # tier 1, cluster 1 (around MC, DC, QNC, SLC)
    "bld_c2": dict(abbrev="C2"),
    "bld_esc": dict(abbrev="ESC"),
    "bld_b1": dict(abbrev="B1"),
    "bld_b2": dict(abbrev="B2"),
    "bld_stc": dict(abbrev="STC"),
    "bld_eit": dict(abbrev="EIT"),
    "bld_m3": dict(abbrev="M3"),
    "bld_pac": dict(abbrev="PAC", extra="pac_mansard", skip_tiers=(10.0, 16.5), blank=False, roof="roof_metal", roof_high=(10.5, "roof_membrane"), h=1.3, sill=1.0),
    "bld_nh": dict(abbrev="NH"),
    "bld_gsc": dict(abbrev="GSC"),
    "bld_phy": dict(abbrev="PHY", extra="observatory"),
    "bld_erc": dict(abbrev="ERC"),
    "bld_lhi": dict(abbrev="LHI"),
    "bld_e3": dict(abbrev="E3"),
    "bld_bmh": dict(abbrev="BMH"),
    "bld_csb": dict(abbrev="CSB", extra="csb_stack", max_h=21.0),   # above 21 m the lidar saw steam
    "bld_ahs_exp": dict(abbrev="AHS EXP"),
    "bld_com": dict(abbrev="COM"),
    "bld_e2": dict(abbrev="E2"),
    "bld_rch": dict(abbrev="RCH", round=True, simplify=0.4),
    "bld_gh": dict(abbrev="GH"),
    "bld_cph": dict(abbrev="CPH"),
    "bld_dwe": dict(abbrev="DWE"),
    "bld_sch": dict(abbrev="SCH"),
    "bld_uc": dict(abbrev="UC"),
}
META = {}


def observatory(k, tiers):
    """PHY's rooftop observatory: a white dome on the smallest of the highest tiers."""
    top = max(tiers, key=lambda t: (round(t["h"]), -len(t["tris"])))
    ring = top["rings"][0]
    cx, cy = sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    z = top["ground_y"] + top["h"]
    k.tube([(cx, cy, z), (cx, cy, z + 1.2)], 2.6, "panel_white", sides=14)
    arch.dome(k, (cx, cy), 2.6, z + 1.2, "panel_white")


def pac_mansard(k, tiers):
    """PAC (facades.json roof and geometry_notes): dark slate standing-seam slopes rise from the brick
    walls (~9.3 m) to a silver fascia band (12.5-15 m) round the white membrane roof of the gym."""
    import math
    def area(t):
        r = t["rings"][0]
        return abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2
    gyms = [t for t in tiers if 13 <= t["h"] <= 16.5]
    if not gyms:
        return
    gym = max(gyms, key=area)        # the gym, not a corner tower
    ring = arch.ccw(gym["rings"][0])
    gy, top = gym["ground_y"], gym["ground_y"] + gym["h"]
    low = arch.inset(ring, -6.0)       # the slopes run ~6 m out to the brick walls (Earth orbit views)
    k.roof(ring, top, "roof_membrane")
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        la, lb = low[i], low[(i + 1) % len(ring)]
        k.quad((*la, gy + 9.3), (*lb, gy + 9.3), (*b, gy + 12.4), (*a, gy + 12.4), "brick_slate")
        k.wall(a, b, gy + 12.4, top + 0.3, "metal_silver")
        k.wall(la, lb, gy + 8.0, gy + 9.3, "brick_slc")
        # standing seams: thin ridges down the slope every 1.2 m
        L = math.dist(a, b)
        for j in range(1, int(L / 1.2)):
            f = j * 1.2 / L
            p0 = (la[0] + (lb[0] - la[0]) * f, la[1] + (lb[1] - la[1]) * f, gy + 9.35)
            p1 = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, gy + 12.4)
            k.tube([p0, p1], 0.05, "penthouse_metal", sides=3)


def csb_stack(k, tiers):
    """CSB's freestanding smokestack (facades.json geometry_notes: art 923.5, 521.5, about 62.6 m
    tall), brown brick, with a dark band at the top and the breeching duct."""
    gy = min(t["ground_y"] for t in tiers)
    x, y = 923.5, 521.5
    k.tube([(x, y, gy - 1.0), (x, y, gy + 59.5)], 2.3, "brick_dark", sides=16)
    k.tube([(x, y, gy + 59.5), (x, y, gy + 62.6)], 2.35, "brick_charcoal_tower", sides=16)


EXTRAS = {"observatory": observatory, "pac_mansard": pac_mansard, "csb_stack": csb_stack}


def build(model):
    o = dict(MODELS[model])
    if isinstance(o.get("extra"), str):
        o["extra"] = EXTRAS[o["extra"]]
    k = arch.Kit(model)
    META[model] = {"replaces": generic.build_generic(k, o.pop("abbrev"), **o)}
    return [k.finish()]
