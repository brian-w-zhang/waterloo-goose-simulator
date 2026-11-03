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
    "bld_pac": dict(abbrev="PAC", blank=False, roof="roof_metal", roof_high=(10.5, "roof_membrane"), h=1.3, sill=1.0),
    "bld_nh": dict(abbrev="NH"),
    "bld_gsc": dict(abbrev="GSC"),
    "bld_phy": dict(abbrev="PHY", extra="observatory"),
    "bld_erc": dict(abbrev="ERC"),
    "bld_lhi": dict(abbrev="LHI"),
    "bld_e3": dict(abbrev="E3"),
    "bld_bmh": dict(abbrev="BMH"),
    "bld_csb": dict(abbrev="CSB"),
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


EXTRAS = {"observatory": observatory}


def build(model):
    o = dict(MODELS[model])
    if isinstance(o.get("extra"), str):
        o["extra"] = EXTRAS[o["extra"]]
    k = arch.Kit(model)
    META[model] = {"replaces": generic.build_generic(k, o.pop("abbrev"), **o)}
    return [k.finish()]
