"""Contact sheet of the tree models: blender -b -P review/trees/preview.py -- OUT.png
Imports public/models/tree_<kind>_<v>.glb, scales each like a typical tree of its kind (height, crown
radius, crown base) the way src/world/chunkMesh.ts does, and renders them in a row per variant."""
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
out = sys.argv[sys.argv.index("--") + 1]
KINDS = {  # h, r, base
    "maple": (12, 4.5, 3.5), "oak": (14, 6, 4), "locust": (11, 4.5, 3.5), "linden": (13, 3.5, 3),
    "spruce": (15, 3.5, 1.5), "pine": (16, 4.5, 7), "cedar": (8, 1.5, 0.8), "willow": (12, 6, 1.5),
    "ornamental": (6, 2.5, 1.8), "shrub": (2.5, 1.5, 0.1)}
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
x = 0
for kind, (h, r, base) in KINDS.items():
    for v in range(3):
        f = ROOT / "public" / "models" / f"tree_{kind}_{v}.glb"
        if not f.exists():
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(f))
        for o in set(bpy.data.objects) - before:
            if o.type != "MESH":
                continue
            o.matrix_world.translation.z = 0
            if o.name.startswith("crown"):
                o.scale = (r * o.scale.x, r * o.scale.y, (h - base) * o.scale.z)
                o.location = (o.location.x * r + x, o.location.y * r + v * 16, base + o.location.z * (h - base))
            else:
                hh = base + (h - base) * 0.5
                o.scale = (r * o.scale.x, r * o.scale.y, hh * o.scale.z)
                o.location = (o.location.x * r + x, o.location.y * r + v * 16, o.location.z * hh)
    x += 16
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
cam.location = (x / 2 - 8, -70, 30)
cam.rotation_euler = (math.radians(72), 0, 0)
cam.data.lens = 24
sc.camera = cam
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "VERTEX"
sc.display.shading.light = "STUDIO"
sc.render.resolution_x, sc.render.resolution_y = 1800, 700
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
