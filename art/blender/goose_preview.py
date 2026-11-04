"""Turnaround renders of art/models/goose.py (headless): blender -b -P art/blender/goose_preview.py -- OUT_DIR [action:frame ...]

Workbench, vertex colours, side / front / top / three-quarter views per pose; writes OUT_DIR/<pose>_<view>.png.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "models"))
import lib  # noqa: E402
import goose  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = Path(args[0] if args else "/tmp/goose_preview")
out.mkdir(parents=True, exist_ok=True)
poses = args[1:] or ["rest:0"]

lib.clear()
rig, mesh = goose.build()
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "VERTEX"
sc.display.shading.show_shadows = False
sc.render.resolution_x, sc.render.resolution_y = 520, 420
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.75, 0.8, 0.72)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
target = Vector((0, 0, 0.5))
VIEWS = {"side": (90, 5, "ORTHO"), "front": (0, 5, "ORTHO"), "back": (180, 20, "ORTHO"), "top": (0, 89.5, "ORTHO"),
         "q34": (40, 25, "PERSP"), "game": (200, 40, "PERSP")}
import os  # noqa: E402,F811
if os.environ.get("VIEWS"):
    VIEWS = {k: v for k, v in VIEWS.items() if k in os.environ["VIEWS"].split(",")}

for spec in poses:
    name, _, fr = spec.partition(":")
    ad = rig.animation_data
    if name == "rest":
        ad.action = None
        for pb in rig.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
    else:
        act = bpy.data.actions[name]
        ad.action = act
        ad.action_slot = act.slots[0]
    sc.frame_set(int(fr or 0))
    for view, (az, el, kind) in VIEWS.items():
        cam_data.type = kind
        if kind == "ORTHO":
            cam_data.ortho_scale = 1.7 if view in ("top", "front", "back") else 1.25
        else:
            cam_data.lens = 50
        d = 2.6
        a, e = math.radians(az), math.radians(el)
        # azimuth measured from the goose's forward (Blender -Y): 90 = its left side
        pos = target + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * d
        cam.location = pos
        cam.rotation_euler = (target - pos).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = str(out / f"{name}{fr}_{view}.png")
        bpy.ops.render.render(write_still=True)
print("[preview] done", out)

# folded-wing clearance: wing vertices (posed) inside the body field
if os.environ.get("CLEAR"):
    import numpy as np
    act = bpy.data.actions["idle"]
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    sc.frame_set(0)
    dg = bpy.context.evaluated_depsgraph_get()
    me = mesh.evaluated_get(dg).to_mesh()
    gi = {g.index: g.name for g in mesh.vertex_groups}
    pts = []
    for v, vo in zip(me.vertices, mesh.data.vertices):
        names = [gi[g.group] for g in vo.groups if g.weight > 0.5]
        if any(n.startswith("wing") for n in names):
            pts.append((v.co.x, -v.co.y, v.co.z))
    d = goose.sdf_points(np.array(pts))
    print("[clear] wing verts", len(d), "inside body", int((d < 0).sum()), "min", d.min())
