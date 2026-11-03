"""Shared helpers for the Blender model scripts (run inside headless Blender, see art/build.py).

Colours: every face corner carries a palette colour in the float colour attribute "Col", in linear
space (glTF COLOR_0 is linear; the game's toon material reads it as is). Materials are not exported:
the game assigns its own material to every mesh.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
PALETTE = json.loads((ROOT / "config" / "palette.json").read_text())


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def swatch(name, group="world"):
    """Palette colour as linear RGBA."""
    h = PALETTE[group][name].lstrip("#")
    return tuple(srgb_to_linear(int(h[k:k + 2], 16) / 255) for k in (0, 2, 4)) + (1.0,)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_object(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def paint(ob, colour, faces=None):
    """Set the corner colour of `faces` (indices; all when None) to a palette swatch (linear RGBA)."""
    me = ob.data
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    sel = set(range(len(me.polygons))) if faces is None else set(faces)
    for p in me.polygons:
        if p.index in sel:
            for li in p.loop_indices:
                attr.data[li].color = colour
    me.color_attributes.active_color = attr


def modifier(ob, kind, **kw):
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items():
        setattr(m, k, v)
    return m


def bevel(ob, width=0.02, segments=2, angle_deg=40, harden=True):
    """Soft architectural edges: angle-limited bevel with hardened normals (no shading smear)."""
    m = modifier(ob, "BEVEL", width=width, segments=segments, limit_method="ANGLE",
                 angle_limit=math.radians(angle_deg), harden_normals=harden)
    ob.data.shade_smooth() if hasattr(ob.data, "shade_smooth") else None
    return m


def weighted_normals(ob):
    return modifier(ob, "WEIGHTED_NORMAL", keep_sharp=True)


def export(path, objects=None):
    """Write a .glb with modifiers applied, Y up, corner colours as COLOR_0, no materials."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if objects is not None:
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=objects is not None,
        export_apply=True, export_yup=True, export_normals=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_materials="NONE", export_animations=True, export_skins=True)
    return path


def new_bmesh():
    return bmesh.new()
