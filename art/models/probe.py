"""Pipeline probe: a bevelled two-colour block. Checks export, colour space and loading (tests/art.test.ts)."""
import bmesh
import lib


def build():
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    ob = lib.mesh_object("probe", bm)
    lib.paint(ob, lib.swatch("brick_red"))
    lib.paint(ob, lib.swatch("roof_light"), [p.index for p in ob.data.polygons if p.normal.z > 0.9])
    lib.bevel(ob, width=0.06, segments=2)
    lib.weighted_normals(ob)
    return [ob]
