"""People: faceless miniature villagers in the Untitled Goose Game manner (spec V-ART-1/2).

npm run art -- people            every variant -> public/models/person_<variant>.glb
npm run art -- people:person_coat  one variant
blender -b -P art/models/people.py -- preview OUT.png [action frame]   contact sheet (workbench)

Every variant shares one 17-bone skeleton (bone names, hierarchy and clip names are identical; bone
lengths follow each variant's height). Each GLB holds:
  body, body_lod1          one skinned surface per LOD (skin-modifier graph, subdivided, decimated)
  hair_<style>[_lod1]      rigid on the head bone: short, long, bun, ponytail, curly, buzz, bald
  hat_<kind>[_lod1]        rigid on the head bone: hardhat, toque, cap, brim
and the actions listed in CLIPS. Faces carry a palette colour (COLOR_0) and a clothing slot in
TEXCOORD_0.x = (slot + 0.5) / 16, so the game can recolour a variant per character or per crowd
instance (SLOTS below; slot 8 keeps its baked colour).

Animation is generated, not hand keyed: legs are solved by two-bone IK against feet planted on the
ground (walk and run feet move back at exactly stride / period, so the game matches the playback
rate to the ground speed and nothing slides); clip extras record each locomotion clip's stride.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender"))
import lib  # noqa: E402

FPS = 24
SLOTS = {"skin": 0, "hair": 1, "top": 2, "bottom": 3, "over": 4, "shoes": 5, "acc": 6, "hat": 7, "fixed": 8}

# default look baked into each GLB (the game recolours per character)
DEFAULT = {"skin": "skin_a", "hair": "hair_brown", "top": "cloth_navy", "bottom": "denim", "over": "cloth_cream",
           "shoes": "shoes", "acc": "bag_black", "hat": "cloth_red"}

# variant: height (m), build (width factor), belly, clothing switches
VARIANTS = {
    "hoodie":   dict(h=1.74, w=1.00, belly=1.0, sleeves="long", legs="trousers", hood=True),
    "backpack": dict(h=1.78, w=1.02, belly=1.0, sleeves="long", legs="trousers", jacket=True, backpack=True),
    "dress":    dict(h=1.66, w=0.92, belly=0.95, sleeves="short", legs="dress", hips=1.08, shoulders=0.92),
    "puffer":   dict(h=1.70, w=1.00, belly=1.0, sleeves="long", legs="trousers", puffer=True, collar=True),
    "tee":      dict(h=1.80, w=0.98, belly=0.95, sleeves="short", legs="shorts"),
    "coat":     dict(h=1.72, w=1.10, belly=1.22, sleeves="long", legs="trousers", coat=True, scarf=True),
    "worker":   dict(h=1.76, w=1.14, belly=1.15, sleeves="long", legs="trousers", vest=True, boots=True),
    "apron":    dict(h=1.70, w=1.10, belly=1.12, sleeves="short", legs="trousers", apron=True),
}
MODELS = [f"person_{v}" for v in VARIANTS]
META = {m: {"world": False} for m in MODELS}
HAIRS = ["short", "long", "bun", "ponytail", "curly", "buzz", "bald"]
HATS = ["hardhat", "toque", "cap", "brim"]

BONES = ["hips", "spine", "chest", "neck", "head",
         "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
         "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R"]
PARENT = {"spine": "hips", "chest": "spine", "neck": "chest", "head": "neck",
          "upper_arm.L": "chest", "forearm.L": "upper_arm.L", "hand.L": "forearm.L",
          "upper_arm.R": "chest", "forearm.R": "upper_arm.R", "hand.R": "forearm.R",
          "thigh.L": "hips", "shin.L": "thigh.L", "foot.L": "shin.L",
          "thigh.R": "hips", "shin.R": "thigh.R", "foot.R": "shin.R"}


def V(x, y, z):
    return Vector((x, y, z))


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def Rx(a):
    return Quaternion((1, 0, 0), a)


def Ry(a):
    return Quaternion((0, 1, 0), a)


def Rz(a):
    return Quaternion((0, 0, 1), a)


# ---------------------------------------------------------------- proportions

class Dims:
    """Joint positions in Blender space (Z up, the person faces -Y, their left is +X)."""

    def __init__(self, v):
        k = v["h"] / 1.72
        w = v["w"]
        self.k, self.w = k, w
        self.ankle_z = 0.08 * k
        self.knee_z = 0.44 * k
        self.hip_z = 0.81 * k
        self.hip_x = 0.092 * w * v.get("hips", 1.0)
        self.waist_z = 0.98 * k
        self.chest_z = 1.19 * k
        self.neck_z = 1.39 * k
        self.head_z = 1.465 * k
        self.head_top = 1.735 * k
        self.sh_x = 0.178 * w * v.get("shoulders", 1.0)
        self.sh_z = 1.345 * k
        a = math.radians(13)   # A-pose: arms 13 degrees out from the body
        self.elbow = V(self.sh_x + math.sin(a) * 0.265 * k, 0, self.sh_z - math.cos(a) * 0.265 * k)
        self.wrist = self.elbow + V(math.sin(a) * 0.235 * k, 0, -math.cos(a) * 0.235 * k)
        self.hand_tip = self.wrist + V(math.sin(a) * 0.1 * k, 0, -math.cos(a) * 0.1 * k)
        self.toe = V(0, -0.135 * k, 0.03 * k)
        self.thigh = self.hip_z - self.knee_z
        self.shin = self.knee_z - self.ankle_z
        self.head_c = V(0, -0.008 * k, self.head_z + 0.13 * k)    # centre of the skull
        self.head_r = V(0.113, 0.121, 0.137) * k

    def bones(self):
        d = self
        b = {"hips": (V(0, 0, d.hip_z), V(0, 0, d.waist_z)),
             "spine": (V(0, 0, d.waist_z), V(0, 0, d.chest_z)),
             "chest": (V(0, 0, d.chest_z), V(0, 0, d.neck_z)),
             "neck": (V(0, 0, d.neck_z), V(0, 0, d.head_z)),
             "head": (V(0, 0, d.head_z), V(0, 0, d.head_top))}
        for s, side in ((1, "L"), (-1, "R")):
            m = V(s, 1, 1)
            b[f"upper_arm.{side}"] = (V(d.sh_x, 0, d.sh_z) * m, d.elbow * m)
            b[f"forearm.{side}"] = (d.elbow * m, d.wrist * m)
            b[f"hand.{side}"] = (d.wrist * m, d.hand_tip * m)
            b[f"thigh.{side}"] = (V(s * d.hip_x, 0, d.hip_z), V(s * d.hip_x, 0, d.knee_z))
            b[f"shin.{side}"] = (V(s * d.hip_x, 0, d.knee_z), V(s * d.hip_x, 0, d.ankle_z))
            b[f"foot.{side}"] = (V(s * d.hip_x, 0, d.ankle_z), V(s * d.hip_x, d.toe.y, d.toe.z))
        return b


# ---------------------------------------------------------------- geometry helpers

def evaluated_copy(ob, name):
    """A new object holding `ob` with its modifiers applied (ob is removed)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    bpy.data.objects.remove(ob)
    if old.users == 0:
        bpy.data.meshes.remove(old)
    me.name = name
    out = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(out)
    return out


def skin_object(name, nodes, edges, smoothing=0.75):
    """nodes: list of (co, (rx, ry)); edges: index pairs. Skin modifier only (not yet applied)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([n[0] for n in nodes], edges, [])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    sk = ob.modifiers.new("skin", "SKIN")
    sk.branch_smoothing = smoothing
    sk.use_smooth_shade = True
    for sv, n in zip(me.skin_vertices[0].data, nodes):
        sv.radius = n[1]
    me.skin_vertices[0].data[0].use_root = True
    return ob


def finish(ob, name, subsurf, ratio):
    """Subdivide, decimate (mirror-symmetric) and bake into a plain smooth mesh."""
    if subsurf:
        m = ob.modifiers.new("sub", "SUBSURF")
        m.levels = subsurf
        m.render_levels = subsurf
    if ratio < 1:
        m = ob.modifiers.new("dec", "DECIMATE")
        m.ratio = ratio
        m.use_symmetry = True
        m.symmetry_axis = "X"
    ob = evaluated_copy(ob, name)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def ellipsoid(name, centre, radii, seg=16, rings=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        v.co = V(v.co.x * radii.x, v.co.y * radii.y, v.co.z * radii.z) + centre
    ob = lib.mesh_object(name, bm)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def rounded_box(name, centre, size, levels=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:   # size: half extents
        v.co = V(v.co.x * size.x * 2, v.co.y * size.y * 2, v.co.z * size.z * 2)
    ob = lib.mesh_object(name, bm)
    m = ob.modifiers.new("sub", "SUBSURF")
    m.levels = levels
    ob = evaluated_copy(ob, name)
    for v in ob.data.vertices:
        v.co += centre
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def tube(name, rings, seg=16, gap=0.0, thick=0.012):
    """A skirt-like open tube: rings = [(z, rx, ry, y_offset)], top to bottom. `gap` (radians) cuts
    an opening at the front (for an open coat). Solidified so it reads from inside too."""
    bm = bmesh.new()
    grid = []
    for z, rx, ry, yo in rings:
        row = []
        for i in range(seg + (1 if gap else 0)):
            a = (gap / 2 + (2 * math.pi - gap) * i / seg) if gap else 2 * math.pi * i / seg
            # angle 0 at the front (-Y)
            row.append(bm.verts.new(V(math.sin(a) * rx, -math.cos(a) * ry + yo, z)))
        grid.append(row)
    n = len(grid[0])
    for r in range(len(grid) - 1):
        for i in range(n if not gap else n - 1):
            j = (i + 1) % n
            bm.faces.new((grid[r][i], grid[r][j], grid[r + 1][j], grid[r + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = lib.mesh_object(name, bm)
    # outward normals: the first face should point away from the axis
    p = ob.data.polygons[0]
    if p.normal.dot(V(p.center.x, p.center.y, 0)) < 0:
        ob.data.flip_normals()
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness = thick
    m.offset = 1.0
    m2 = ob.modifiers.new("sub", "SUBSURF")
    m2.levels = 1
    ob = evaluated_copy(ob, name)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = objs[0]
    ob.name = name
    ob.data.name = name
    return ob


# ---------------------------------------------------------------- painting

FIXED = ["reflect", "hardhat"]
SLOT_NAMES = {i: s for s, i in SLOTS.items()}


def paint_slots(ob, slot_of_face, look):
    """The slot code in UV.x (and a fixed colour index in UV.y) for every face, then colours."""
    me = ob.data
    uv = me.uv_layers.get("slot") or me.uv_layers.new(name="slot")
    for p in me.polygons:
        slot, colour = slot_of_face(p)
        u = (SLOTS[slot] + 0.5) / 16
        vv = (FIXED.index(colour) + 0.5) / 16 if colour else 0.97
        for li in p.loop_indices:
            uv.data[li].uv = (u, vv)
    recolour(ob, look)


def recolour(ob, look):
    """Corner colours (palette, linear) from the slot codes (decimation keeps UV seams exact)."""
    me = ob.data
    uv = me.uv_layers["slot"]
    col = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for p in me.polygons:
        u, vv = uv.data[p.loop_indices[0]].uv
        slot = SLOT_NAMES[int(u * 16)]
        name = FIXED[int(vv * 16)] if vv < 0.9 else look[slot]
        c = lib.swatch(name, "people")
        for li in p.loop_indices:
            col.data[li].color = c
    me.color_attributes.active_color = col


def paint_all(ob, slot, look, colour=None):
    paint_slots(ob, lambda p: (slot, colour), look)


# ---------------------------------------------------------------- body

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length, t


def nearest_bone(p, segs):
    best, bt, bd = None, 0, 1e9
    for name, (a, b) in segs.items():
        d, t = seg_dist(p, a, b)
        if d < bd:
            best, bt, bd = name, t, d
    return best, bt, bd


class Graph:
    """Skin-modifier graph: nodes with radii and a region label (bone name), edges child -> parent."""

    def __init__(self):
        self.nodes, self.edges, self.labels = [], [], []

    def node(self, co, rx, ry=None, parent=None, label="hips"):
        self.nodes.append((co, (rx, ry if ry is not None else rx)))
        self.labels.append(label)
        i = len(self.nodes) - 1
        if parent is not None:
            self.edges.append((parent, i))
        return i

    def region(self, p):
        """(label, edge t) of the edge whose swept radius best explains point p."""
        best, bl, bt = 1e9, "hips", 0.0
        for a, b in self.edges:
            (ca, ra), (cb, rb) = self.nodes[a], self.nodes[b]
            dd, t = seg_dist(p, ca, cb)
            r = (ra[0] + ra[1]) / 2 * (1 - t) + (rb[0] + rb[1]) / 2 * t
            score = dd / max(r, 1e-4)
            if score < best:
                best, bl, bt = score, self.labels[b], t
        return bl, bt


def body(v, d, lod):
    """The clothed body as one skin-modifier surface (the head is separate). Returns the dense mesh
    (to be painted, then decimated) and its graph."""
    k, w = d.k, d.w
    puff = 1.2 if v.get("puffer") else 1.0
    g = Graph()
    node = g.node
    belly = v.get("belly", 1.0)
    hips = v.get("hips", 1.0)
    sh = v.get("shoulders", 1.0)
    root = node(V(0, 0, d.hip_z + 0.05 * k), 0.158 * w * hips, 0.112 * k * max(belly, 1), label="hips")
    waist = node(V(0, 0, d.waist_z), 0.150 * w * puff * (1 + (belly - 1) * 0.7), 0.106 * k * belly * puff, root, "spine")
    if v.get("puffer"):
        # quilted bands: alternating fat and pinched rings up the torso
        prev = waist
        for j, z in enumerate((1.06, 1.13, 1.20, 1.27)):
            f = 1.0 if j % 2 == 0 else 0.94
            prev = node(V(0, 0, z * k), 0.165 * w * puff * f, 0.112 * k * puff * f, prev, "spine" if z < 1.15 else "chest")
        chest = prev
    else:
        chest = node(V(0, 0, d.chest_z), 0.168 * w * (1 + (belly - 1) * 0.4), 0.114 * k * (1 + (belly - 1) * 0.55), waist, "chest")
    up = node(V(0, 0.004 * k, 1.315 * k), 0.165 * w * sh * (0.97 * puff if puff > 1 else 1), 0.100 * k * (puff if puff > 1 else 1), chest, "chest")
    nk0 = node(V(0, 0.008 * k, d.neck_z + 0.012 * k), 0.06 * k * (1.45 if v.get("collar") else 1), None, up, "neck")
    node(V(0, 0.018 * k, d.head_z + 0.01 * k), 0.052 * k, None, nk0, "neck")
    for s, side in ((1, "L"), (-1, "R")):
        m = V(s, 1, 1)
        shp = V(s * d.sh_x, 0, d.sh_z)
        e = d.elbow * m
        wr = d.wrist * m
        shn = node(shp, 0.072 * k * puff, None, up, f"upper_arm.{side}")
        mid = (shp + e) / 2
        if puff > 1:
            m1 = node(mid + V(0, 0, 0.045 * k), 0.07 * k * puff, None, shn, f"upper_arm.{side}")
            m2 = node(mid - V(0, 0, 0.045 * k), 0.063 * k * puff, None, m1, f"upper_arm.{side}")
            el = node(e, 0.056 * k * puff, None, m2, f"forearm.{side}")
        else:
            m1 = node(mid, 0.064 * k, None, shn, f"upper_arm.{side}")
            el = node(e, 0.054 * k, None, m1, f"forearm.{side}")
        fm = node((e + wr) / 2, 0.05 * k * (puff if puff > 1 else 1), None, el, f"forearm.{side}")
        cuff = node(wr + (e - wr).normalized() * 0.025 * k, 0.043 * k * (1.2 if puff > 1 else 1), None, fm, f"forearm.{side}")
        wrist = node(wr, 0.034 * k, 0.037 * k, cuff, f"hand.{side}")
        palm = node(wr + (d.hand_tip * m - wr) * 0.5, 0.03 * k, 0.05 * k, wrist, f"hand.{side}")
        node(d.hand_tip * m, 0.025 * k, 0.04 * k, palm, f"hand.{side}")
        # legs
        x = s * d.hip_x
        boot = 1.12 if v.get("boots") else 1.0
        hj = node(V(x, 0, d.hip_z - 0.015 * k), 0.104 * k * (1.06 if hips > 1 else 1), None, root, f"thigh.{side}")
        th = node(V(x, 0.003 * k, (d.hip_z + d.knee_z) / 2), 0.09 * k, None, hj, f"thigh.{side}")
        kn = node(V(x, 0, d.knee_z), 0.067 * k, None, th, f"shin.{side}")
        calf = node(V(x, 0.012 * k, d.knee_z - 0.12 * k), 0.07 * k, None, kn, f"shin.{side}")
        sh2 = node(V(x, 0.004 * k, d.ankle_z + 0.08 * k), 0.052 * k * boot, None, calf, f"shin.{side}")
        an = node(V(x, 0.0, d.ankle_z), 0.056 * k * boot, None, sh2, f"foot.{side}")
        ball = node(V(x, -0.075 * k, 0.045 * k), 0.054 * k * boot, 0.048 * k, an, f"foot.{side}")
        node(V(x, -0.14 * k, 0.04 * k), 0.048 * k * boot, 0.036 * k, ball, f"foot.{side}")
        node(V(x, 0.045 * k, 0.045 * k), 0.05 * k * boot, 0.044 * k, an, f"foot.{side}")

    ob = skin_object("body_skin", g.nodes, g.edges)
    ob.modifiers.new("sub", "SUBSURF").levels = 2
    ob = evaluated_copy(ob, "body_part")
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob, g


def decimate(ob, target):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= target:
        return ob
    m = ob.modifiers.new("dec", "DECIMATE")
    m.ratio = target / tris
    m.use_symmetry = True
    m.symmetry_axis = "X"
    ob = evaluated_copy(ob, ob.name)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def arm_axis(d, side):
    s = 1 if side == "L" else -1
    a = V(s * d.sh_x, 0, d.sh_z)
    return a, ((d.elbow * V(s, 1, 1)) - a).normalized()


def cuts(v, d):
    """Planes (point, normal) along every colour border, cut into the dense body before painting so
    clothing edges come out straight (the decimation keeps them)."""
    k = d.k
    out = [(V(0, 0, d.ankle_z + (0.12 if v.get("boots") else 0.045) * k), V(0, 0, 1))]
    if v["legs"] == "shorts":
        out.append((V(0, 0, d.knee_z + 0.11 * k), V(0, 0, 1)))
    if v["legs"] != "dress":
        out.append((V(0, 0, waist_line(v, d)), V(0, 0, 1)))
    for side in ("L", "R"):
        a, ax = arm_axis(d, side)
        if v["sleeves"] == "short":
            out.append((a + ax * 0.14 * k, ax))
    if v.get("collar"):
        out.append((V(0, 0, d.neck_z + 0.05 * k), V(0, 0, 1)))
    if v.get("scarf"):
        out.append((V(0, 0, d.neck_z + 0.04 * k), V(0, 0, 1)))
    if v.get("vest"):
        for z in (1.04, 1.08, 1.17, 1.21):
            out.append((V(0, 0, z * k), V(0, 0, 1)))
        out.append((V(0, 0, d.neck_z - 0.02 * k), V(0, 0, 1)))
    if v.get("jacket"):
        for s in (1, -1):
            out.append((V(s * 0.05 * k, 0, 0), V(1, 0, 0)))
    if v.get("coat"):
        for s in (1, -1):   # a V opening from the waist to the collar
            out.append((V(s * 0.012 * k, 0, 1.0 * k), V(1, 0, -s * 0.28).normalized()))
    if v.get("apron"):
        for s in (1, -1):
            out += [(V(s * 0.1 * k, 0, 0), V(1, 0, 0)), (V(s * 0.06 * k, 0, 0), V(1, 0, 0)), (V(s * 0.09 * k, 0, 0), V(1, 0, 0))]
        out.append((V(0, 0, 1.28 * k), V(0, 0, 1)))
    if v.get("backpack"):
        for s in (1, -1):
            out += [(V(s * 0.07 * k, 0, 0), V(1, 0, 0)), (V(s * 0.11 * k, 0, 0), V(1, 0, 0))]
        out.append((V(0, 0, 1.1 * k), V(0, 0, 1)))
    if v.get("hood"):
        out += [(V(0.085 * k, 0, 0), V(1, 0, 0)), (V(-0.085 * k, 0, 0), V(1, 0, 0)),
                (V(0, 0, 0.98 * k), V(0, 0, 1)), (V(0, 0, 1.08 * k), V(0, 0, 1))]
    return out


def waist_line(v, d):
    k = d.k
    if v.get("coat"):
        return d.hip_z + 0.0 * k
    if v.get("jacket") or v.get("puffer"):
        return d.hip_z + 0.04 * k
    return d.hip_z + 0.1 * k


def cut_mesh(ob, planes):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for co, no in planes:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True


def body_slot(v, d, g, segs):
    """Clothing slot (and optional fixed colour) for a body face, from its region and position. The
    borders here are the planes in cuts()."""
    k = d.k

    def f(p):
        c = p.center
        label, _ = g.region(c)
        part = label.split(".")[0]
        arm = part in ("upper_arm", "forearm")
        front = c.y < 0
        if part == "hand":
            return "skin", None
        if part in ("foot", "shin", "thigh") and c.z < d.ankle_z + (0.12 if v.get("boots") else 0.045) * k:
            return "shoes", None
        if part in ("thigh", "shin"):
            if v["legs"] == "shorts" and c.z < d.knee_z + 0.11 * k:
                return "skin", None
            return "bottom", None          # dress: tights (bottom = skin for bare legs)
        if part == "neck":
            if v.get("collar") and c.z < d.neck_z + 0.05 * k:
                return "top", None
            if v.get("scarf") and c.z < d.neck_z + 0.04 * k:
                return "acc", None
            return "skin", None
        if not arm and v["legs"] != "dress" and c.z < waist_line(v, d):
            return "bottom", None
        if arm:
            a, ax = arm_axis(d, label.split(".")[1])
            if v["sleeves"] == "short" and (c - a).dot(ax) > 0.14 * k:
                return "skin", None
            return ("over", None) if (v.get("coat") or v.get("jacket")) else ("top", None)
        # torso
        if v.get("vest"):
            if c.z < d.neck_z - 0.02 * k:
                band = 1.04 * k < c.z < 1.08 * k or 1.17 * k < c.z < 1.21 * k
                return ("fixed", "reflect") if band else ("over", None)
            return "top", None
        if v.get("jacket"):
            return ("top", None) if front and abs(c.x) < 0.05 * k and abs(c.x) * 3 < -c.y else ("over", None)
        if v.get("coat"):
            open_w = 0.012 * k + 0.28 * max(c.z - 1.0 * k, 0)
            return ("top", None) if front and abs(c.x) < open_w and abs(c.x) * 2 < -c.y else ("over", None)
        if v.get("apron") and front and -c.y > abs(c.x) * 0.6:
            if abs(c.x) < 0.1 * k and c.z < 1.28 * k:
                return "over", None
            if 0.06 * k < abs(c.x) < 0.09 * k and c.z >= 1.28 * k:
                return "over", None   # neck straps
        if v.get("backpack") and c.z > 1.1 * k and 0.07 * k < abs(c.x) < 0.11 * k and (front or c.z > 1.3 * k):
            return "acc", None    # straps over the shoulders and down the front
        if v.get("hood") and front and abs(c.x) < 0.085 * k and 0.98 * k < c.z < 1.08 * k and -c.y > 0.06 * k:
            return "over", None   # kangaroo pocket (the game defaults it to the top colour)
        return "top", None
    return f


def head(d, lod):
    seg, rings = (18, 12) if lod == 0 else (10, 7)
    hc, hr = d.head_c, d.head_r
    h = ellipsoid("head", hc, hr, seg, rings)
    for vv in h.data.vertices:
        rel = vv.co - hc
        if rel.z < 0:   # narrower jaw
            f = 1 - 0.18 * (-rel.z / hr.z) ** 1.5
            vv.co.x = hc.x + rel.x * f
            vv.co.y = hc.y + rel.y * (1 - 0.08 * (-rel.z / hr.z))
    parts = [h]
    if lod == 0:
        # the nose is the only feature (and shows which way they face); small ears
        parts.append(ellipsoid("nose", hc + V(0, -hr.y * 0.96, -0.012 * d.k), V(0.019, 0.024, 0.026) * d.k, 8, 6))
        for s in (1, -1):
            parts.append(ellipsoid("ear", hc + V(s * hr.x * 0.97, 0.008 * d.k, -0.005 * d.k), V(0.016, 0.026, 0.034) * d.k, 8, 6))
    return join(parts, "head_part")


def hair(style, d, lod):
    """Hair: a cap a little bigger than the skull, cut along a hairline (high at the forehead, low at
    the nape), plus a style shape. Rigid on the head bone."""
    k, hc, hr = d.k, d.head_c, d.head_r
    seg, rings = (20, 14) if lod == 0 else (10, 8)
    grow = {"curly": 1.2, "buzz": 1.025, "bald": 1.04}.get(style, 1.07)
    lift = {"curly": 0.02, "buzz": 0.0}.get(style, 0.008)
    cap = ellipsoid("hair", hc + V(0, 0.004 * k, lift * k), V(hr.x * grow, hr.y * grow, hr.z * grow * (1.04 if style != "buzz" else 1)), seg, rings)
    me = cap.data
    bm = bmesh.new()
    bm.from_mesh(me)

    def keep(co):
        rel = co - hc
        ang = math.atan2(rel.x, -rel.y)            # 0 = front
        back = (1 - math.cos(ang)) / 2             # 0 front .. 1 back
        if style == "bald":
            # a horseshoe fringe round the back at ear height
            return -0.04 * k < rel.z < 0.035 * k and back > 0.35
        line = {"long": 0.045, "curly": 0.03}.get(style, 0.055) * k   # forehead hairline height
        nape = {"long": -0.12, "bun": -0.05, "ponytail": -0.05, "curly": -0.06, "buzz": -0.04}.get(style, -0.055) * k
        side = (-0.075 if style == "long" else -0.01) * k
        z = line + (side - line) * min(back * 2, 1) if back < 0.5 else side + (nape - side) * (back - 0.5) * 2
        return rel.z > z

    bmesh.ops.delete(bm, geom=[vv for vv in bm.verts if not keep(vv.co)], context="VERTS")
    for vv in bm.verts:
        rel = vv.co - hc
        if style == "long" and rel.z < 0.02 * k:
            # falls straight past the cheeks instead of hugging the jaw
            f = 1 + 0.5 * min((0.02 * k - rel.z) / (0.1 * k), 1)
            vv.co.x = hc.x + rel.x * f
            vv.co.y = hc.y + rel.y * (1 + 0.25 * min((0.02 * k - rel.z) / (0.1 * k), 1))
        if style == "curly":
            n = rel.normalized()
            bump = 0.5 + 0.5 * math.sin(n.x * 17) * math.sin(n.y * 17 + 1) * math.sin(n.z * 15)
            vv.co += n * bump * 0.02 * k
    bm.to_mesh(me)
    bm.free()
    sol = cap.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.012 * k
    sol.offset = -1
    parts = [evaluated_copy(cap, "hair")]
    s2 = (12, 8) if lod == 0 else (8, 6)
    if style == "long":
        # hair down the back to the shoulder blades and a lock each side of the face
        parts.append(rounded_box("hair_back", hc + V(0, 0.075 * k, -0.15 * k), V(0.12, 0.05, 0.11) * k, 2 if lod == 0 else 1))
    elif style == "bun":
        parts.append(ellipsoid("bun", hc + V(0, 0.085 * k, 0.085 * k), V(0.055, 0.05, 0.05) * k, *s2))
    elif style == "ponytail":
        parts.append(ellipsoid("tie", hc + V(0, 0.105 * k, 0.02 * k), V(0.03, 0.03, 0.03) * k, *s2))
        parts.append(ellipsoid("tail", hc + V(0, 0.13 * k, -0.08 * k), V(0.035, 0.035, 0.11) * k, *s2))
    return join(parts, f"hair_{style}" + ("_lod1" if lod else ""))


def hat(kind, d, lod):
    k, hc, hr = d.k, d.head_c, d.head_r
    s1 = (20, 10) if lod == 0 else (12, 6)
    top = hc + V(0, 0.002 * k, hr.z * 0.25)
    parts = []
    if kind == "hardhat":
        dome = ellipsoid("dome", top + V(0, 0, -0.005 * k), V(hr.x * 1.16, hr.y * 1.18, hr.z * 1.0), *s1)
        cut(dome, lambda co: co.z >= top.z - 0.004 * k)
        parts += [dome, ellipsoid("brim", top + V(0, -0.02 * k, -0.002 * k), V(hr.x * 1.38, hr.y * 1.5, 0.012 * k), *s1),
                  ellipsoid("ridge", top + V(0, 0, hr.z * 0.95), V(0.022 * k, hr.y * 0.95, 0.02 * k), 8, 6)]
        out = join(parts, "hat")
        paint_all(out, "fixed", None, "hardhat")
        return out
    if kind == "toque":
        dome = ellipsoid("dome", top + V(0, 0.004 * k, -0.01 * k), V(hr.x * 1.1, hr.y * 1.1, hr.z * 1.2), *s1)
        cut(dome, lambda co: co.z >= top.z - 0.012 * k)
        band = ellipsoid("band", top + V(0, 0.004 * k, 0.006 * k), V(hr.x * 1.15, hr.y * 1.15, 0.03 * k), *s1)
        parts += [dome, band, ellipsoid("pom", top + V(0, 0.01 * k, hr.z * 1.3), V(0.04, 0.04, 0.036) * k, 10, 7)]
    elif kind == "cap":
        dome = ellipsoid("dome", top + V(0, 0.004 * k, -0.012 * k), V(hr.x * 1.1, hr.y * 1.1, hr.z * 0.95), *s1)
        cut(dome, lambda co: co.z >= top.z - 0.004 * k)
        parts += [dome, ellipsoid("bill", top + V(0, -hr.y * 1.2, 0.0), V(hr.x * 0.82, hr.y * 0.65, 0.01 * k), *s1)]
    elif kind == "brim":
        crown = ellipsoid("crown", top + V(0, 0, 0.02 * k), V(hr.x * 1.05, hr.y * 1.08, hr.z * 0.85), *s1)
        cut(crown, lambda co: co.z >= top.z - 0.004 * k)
        parts += [crown, ellipsoid("brim", top + V(0, 0, 0.0), V(hr.x * 1.75, hr.y * 1.8, 0.012 * k), *s1)]
    out = join(parts, "hat")
    paint_all(out, "hat", DEFAULT)
    return out


def cut(ob, keep):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    sol = ob.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.008
    sol.offset = -1


def extras(v, d, lod):
    """Clothing that is not part of the body surface: skirt, coat tails, apron, hood, backpack, scarf.
    Returns [(object, slot, colour, weights)], weights: 'chest' | 'hips' | 'skirt' (hips + thighs)."""
    k, w = d.k, d.w
    out = []
    seg = 18 if lod == 0 else 10
    if v["legs"] == "dress":
        sk = tube("skirt", [(d.waist_z - 0.01 * k, 0.138 * w, 0.096 * k, 0.0), (d.hip_z, 0.178 * w * 1.06, 0.13 * k, 0.004 * k),
                            (d.knee_z + 0.03 * k, 0.215 * w * 1.06, 0.175 * k, 0.012 * k)], seg)
        out.append((sk, "top", None, "skirt"))
    if v.get("coat"):
        ct = tube("coat_tail", [(d.waist_z, 0.15 * w * 1.1, 0.104 * k * 1.12, 0.0), (d.hip_z - 0.06 * k, 0.19 * w * 1.04, 0.145 * k, 0.012 * k),
                                (d.knee_z - 0.03 * k, 0.205 * w * 1.04, 0.16 * k, 0.025 * k)], seg, gap=0.5)
        out.append((ct, "over", None, "skirt"))
    if v.get("apron"):
        ap = tube("apron", [(d.hip_z + 0.07 * k, 0.17 * w * 1.08, 0.126 * k * 1.06, -0.002 * k), (d.knee_z + 0.07 * k, 0.19 * w, 0.15 * k, -0.012 * k)],
                  seg, gap=2 * math.pi - 1.8)
        # the gap is everything but the front 100 degrees: turn it round to the front
        for vv in ap.data.vertices:
            vv.co.x, vv.co.y = -vv.co.x, -vv.co.y
        out.append((ap, "over", None, "skirt"))
    if v.get("hood"):
        hd = ellipsoid("hood", V(0, 0.092 * k, d.neck_z - 0.01 * k), V(0.115, 0.055, 0.075) * k, 14 if lod == 0 else 8, 8 if lod == 0 else 5)
        for vv in hd.data.vertices:   # wrap the rim round the neck
            vv.co.y -= 0.9 * (vv.co.x / k) ** 2 * k
        out.append((hd, "top", None, "chest"))
    if v.get("backpack"):
        bp = rounded_box("pack", V(0, 0.145 * k, 1.20 * k), V(0.135 * w, 0.062 * k, 0.17 * k), 2 if lod == 0 else 1)
        parts = [bp]
        if lod == 0:
            parts.append(rounded_box("pocket", V(0, 0.215 * k, 1.12 * k), V(0.09 * w, 0.025 * k, 0.07 * k), 1))
        out.append((join(parts, "backpack"), "acc", None, "chest"))
    if v.get("scarf"):
        sc = ellipsoid("scarf", V(0, 0.004 * k, d.neck_z + 0.005 * k), V(0.088 * k, 0.082 * k, 0.04 * k), 16 if lod == 0 else 8, 8 if lod == 0 else 5)
        tail = rounded_box("scarf_tail", V(0.05 * k, -0.105 * k, d.neck_z - 0.12 * k), V(0.035 * k, 0.014 * k, 0.11 * k), 1)
        out.append((join([sc, tail], "scarf"), "acc", None, "chest"))
    return out


# ---------------------------------------------------------------- rig and weights

def make_rig(d):
    arm = bpy.data.armatures.new("rig")
    rig = bpy.data.objects.new("rig", arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    segs = d.bones()
    for name in BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail = segs[name]
        # roll so local X is the person's left-right axis for every bone (hinges bend about X)
        b.align_roll(V(0, -1, 0) if name.split(".")[0] not in ("foot",) else V(0, 0, 1))
    for name, p in PARENT.items():
        arm.edit_bones[name].parent = arm.edit_bones[p]
        arm.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig, segs


NEIGHBOURS = {b: {b, PARENT.get(b)} | {c for c, p in PARENT.items() if p == b} for b in BONES}


CHAIN_CHILD = {"spine": "chest", "upper_arm.L": "forearm.L", "forearm.L": "hand.L", "upper_arm.R": "forearm.R",
               "forearm.R": "hand.R", "thigh.L": "shin.L", "shin.L": "foot.L", "thigh.R": "shin.R", "shin.R": "foot.R",
               "hips": "spine"}


def weight_body(ob, g, segs, d):
    """Deterministic weights: each vertex follows the bone of its skin region, blended 50/50 at the
    joints over a quarter of the bone, and the chest top blends into the shoulders."""
    groups = {b: ob.vertex_groups.new(name=b) for b in BONES}
    for vv in ob.data.vertices:
        b, _ = g.region(vv.co)
        a, tail = segs[b]
        ab = tail - a
        t = (vv.co - a).dot(ab) / ab.length_squared
        ws = {b: 1.0}
        if b in PARENT and t < 0.3:
            w = 0.5 * (1 - smooth(t / 0.3))
            ws[PARENT[b]] = ws.get(PARENT[b], 0) + w
            ws[b] -= w
        if b in CHAIN_CHILD and t > 0.7:
            w = 0.5 * smooth((t - 0.7) / 0.3)
            ws[CHAIN_CHILD[b]] = ws.get(CHAIN_CHILD[b], 0) + w
            ws[b] -= w
        if b == "chest":
            for side in ("L", "R"):
                dd = (vv.co - segs[f"upper_arm.{side}"][0]).length
                r = 0.1 * d.k
                if dd < r:
                    w = 0.4 * (1 - dd / r)
                    ws[f"upper_arm.{side}"] = w
                    ws["chest"] -= w
        for bn, wv in ws.items():
            if wv > 0.005:
                groups[bn].add([vv.index], wv, "REPLACE")


def weight_rigid(ob, bone):
    g = ob.vertex_groups.new(name=bone)
    g.add([vv.index for vv in ob.data.vertices], 1.0, "REPLACE")


def weight_skirt(ob, d):
    """Skirts and coat tails: hips at the waist, sliding to the thigh on each side toward the hem."""
    gh = ob.vertex_groups.new(name="hips")
    gl = ob.vertex_groups.new(name="thigh.L")
    gr = ob.vertex_groups.new(name="thigh.R")
    for vv in ob.data.vertices:
        t = smooth((d.hip_z + 0.05 * d.k - vv.co.z) / (d.hip_z - d.knee_z))
        side = smooth(0.5 + vv.co.x / (0.12 * d.k))   # 0 right .. 1 left
        thigh = 0.85 * t
        gh.add([vv.index], 1 - thigh, "REPLACE")
        if thigh * side > 0.01:
            gl.add([vv.index], thigh * side, "REPLACE")
        if thigh * (1 - side) > 0.01:
            gr.add([vv.index], thigh * (1 - side), "REPLACE")


def bind(ob, rig):
    ob.parent = rig
    m = ob.modifiers.new("rig", "ARMATURE")
    m.object = rig


# ---------------------------------------------------------------- animation

class Leg:
    def __init__(self, d, s):
        self.s = s
        self.x = s * d.hip_x
        k = d.k
        self.ankle_rest = V(self.x, 0, d.ankle_z)
        self.heel = V(0, 0.05 * k, 0)          # ground points relative to the ankle's ground spot
        self.ball = V(0, -0.085 * k, 0)


def ik(hip, ankle, T, L):
    """Two-bone leg in the sagittal plane (knee forward). Returns (thigh, knee) world-ish quaternion
    for the thigh and the knee hinge angle."""
    v = ankle - hip
    dist = min(v.length, (T + L) * 0.9995)
    psi = -math.asin(max(-1, min(1, v.x / max(v.length, 1e-6))))
    phi = math.atan2(v.y, -v.z)
    a = math.acos(max(-1, min(1, (T * T + dist * dist - L * L) / (2 * T * dist))))
    interior = math.acos(max(-1, min(1, (T * T + L * L - dist * dist) / (2 * T * L))))
    return Ry(psi) @ Rx(phi - a), math.pi - interior, phi - a


class Pose:
    def __init__(self):
        self.q = {b: Quaternion() for b in BONES}   # rotation relative to parent, in rest-global axes
        self.hips = V(0, 0, 0)                       # hips translation (armature space)


def arm_rest(s, adduct=0.16):
    """Arms hanging relaxed from the A-pose rest."""
    return Ry(s * adduct)


def legs_ik(P, d, feet, hips_q=None):
    """Set thigh/shin/foot so ankles reach feet[s] = (ankle position, foot pitch)."""
    hq = hips_q or P.q["hips"]
    hp = V(0, 0, d.hip_z) + P.hips
    for s, side in ((1, "L"), (-1, "R")):
        ank, pitch = feet[side]
        joint = hp + hq @ V(s * d.hip_x, 0, 0)
        g, knee, th = ik(joint, ank, d.thigh, d.shin)
        P.q[f"thigh.{side}"] = hq.inverted() @ g
        P.q[f"shin.{side}"] = Rx(knee)
        P.q[f"foot.{side}"] = Rx(pitch - th - knee)


def foot_on_ground(leg, d, track_y, pitch):
    """Ankle position for a foot whose sole (when flat) has its ankle over track_y, pitched about the
    heel (pitch < 0, toes up) or the ball (pitch > 0, heel up)."""
    ground = V(leg.x, track_y, 0)
    piv = leg.heel if pitch < 0 else leg.ball
    rel = V(0, 0, d.ankle_z) - piv
    return ground + piv + Rx(pitch) @ rel


def locomotion(d, P_, frames, D, beta, lift, p_strike, p_off, lean, arm_amp, forearm, bob_keep, kick=0.0, run=False):
    """Generate an in-place cycle with planted feet: during stance the foot moves back at D / period."""
    S = D * beta / 2
    legs = {"L": Leg(d, 1), "R": Leg(d, -1)}

    def foot(u, leg):
        u %= 1.0
        if u < beta:
            s = u / beta
            y = -S + 2 * S * s
            if s < 0.15:
                p = p_strike * (1 - smooth(s / 0.15))
            elif s > 0.6:
                p = p_off * smooth((s - 0.6) / 0.4)
            else:
                p = 0.0
            return foot_on_ground(leg, d, y, p), p
        s = (u - beta) / (1 - beta)
        a0, p0 = foot(beta - 1e-4, leg)
        a1, p1 = foot(0.0, leg)
        e = smooth(s)
        pos = a0.lerp(a1, e)
        pos.z += lift * math.sin(math.pi * s) ** 1.2
        pos.y += kick * math.sin(math.pi * min(s * 1.6, 1.0))   # heel kicks up behind when running
        pos.z += kick * 0.8 * math.sin(math.pi * min(s * 1.6, 1.0))
        p = p0 + (p1 - p0) * e - 0.25 * math.sin(math.pi * s) * (1 if not run else 0.5)
        return pos, p

    # hip height: as high as the planted feet allow, a little crouched, smoothed
    R = (d.thigh + d.shin) * 0.975
    hz = []
    for f in range(frames):
        u = f / frames
        h = d.hip_z
        for side, off in (("L", 0.0), ("R", 0.5)):
            a, _ = foot(u + off, legs[side])
            dx = a.x - legs[side].x
            reach = math.sqrt(max(R * R - (a.y) ** 2 - dx * dx, 0.01))
            h = min(h, a.z + reach)
        hz.append(h)
    sm = [(hz[(i - 1) % frames] + 2 * hz[i] + hz[(i + 1) % frames]) / 4 for i in range(frames)]
    mean = sum(sm) / frames
    poses = []
    for f in range(frames):
        u = f / frames
        P = Pose()
        c = math.cos(2 * math.pi * u)
        yaw = -0.07 * c * (1.3 if run else 1)
        P.hips = V(0.014 * math.cos(2 * math.pi * (u - 0.25)) * (0.4 if run else 1), 0,
                   (mean + (sm[f] - mean) * bob_keep) - d.hip_z)
        P.q["hips"] = Rz(yaw)
        feet = {side: foot(u + off, legs[side]) for side, off in (("L", 0.0), ("R", 0.5))}
        legs_ik(P, d, feet)
        chest_yaw = -yaw * 1.6
        P.q["spine"] = Rx(lean * 0.6) @ Rz(chest_yaw * 0.5 - yaw)
        P.q["chest"] = Rx(lean * 0.4) @ Rz(chest_yaw * 0.5)
        P.q["neck"] = Rx(-lean * 0.6) @ Rz(-chest_yaw * 0.6)
        P.q["head"] = Rx(-lean * 0.3 + 0.03 * math.cos(4 * math.pi * u))
        for s, side in ((1, "L"), (-1, "R")):
            sw = s * arm_amp * math.cos(2 * math.pi * (u - 0.04))   # opposite to the same-side leg
            fwd = max(0.0, -sw)
            P.q[f"upper_arm.{side}"] = Rx(sw) @ arm_rest(s, 0.2 if run else 0.16)
            P.q[f"forearm.{side}"] = Rx(-forearm - 0.35 * fwd)
            P.q[f"hand.{side}"] = Rx(-0.1)
        poses.append(P)
    return poses


def standing(d, P, spread=0.0, front=0.0, crouch=0.0, back=0.0, sway=0.0):
    """Plant both feet at rest (optionally one forward) and solve the legs for the hips' pose."""
    feet = {}
    for s, side in ((1, "L"), (-1, "R")):
        leg = Leg(d, s)
        ff = front if s == 1 else -front * 0.4
        a = foot_on_ground(leg, d, -ff, 0.0) + V(s * spread, 0, 0)
        feet[side] = (a, 0.0)
    P.hips = P.hips + V(sway, back, -crouch)
    legs_ik(P, d, feet)


def default_arms(P, a=0.0):
    for s, side in ((1, "L"), (-1, "R")):
        P.q[f"upper_arm.{side}"] = Rx(0.04 + a * s) @ arm_rest(s)
        P.q[f"forearm.{side}"] = Rx(-0.18)
        P.q[f"hand.{side}"] = Rx(-0.08)


def arm(P, side, flex, abd=0.0, inward=0.0, elbow=0.0, twist=0.0, wrist=0.0):
    """Shoulder flexion (forward/up is negative X rotation), abduction (out), horizontal inward swing."""
    s = 1 if side == "L" else -1
    P.q[f"upper_arm.{side}"] = Rz(-s * inward) @ Rx(flex) @ Ry(s * (0.16 - abd)) @ Quaternion((0, 0, 1), twist * s)
    P.q[f"forearm.{side}"] = Rx(-elbow)
    P.q[f"hand.{side}"] = Rx(wrist)


def clip_poses(name, d):
    """Pose list (one per frame at 24 fps) for each clip."""
    k = d.k
    out = []
    if name == "walk":
        return locomotion(d, None, 24, 1.25, 0.6, 0.075 * k, -0.28, 0.55, 0.04, 0.32, 0.22, 0.85)
    if name == "run":
        return locomotion(d, None, 14, 2.2, 0.34, 0.13 * k, -0.2, 0.7, 0.2, 0.75, 1.35, 0.5, kick=0.1 * k, run=True)
    if name == "idle":
        n = 60
        for f in range(n):
            u = f / n
            P = Pose()
            sway = 0.018 * math.sin(2 * math.pi * u)
            standing(d, P, front=0.04 * k, crouch=0.012 * k, sway=sway)
            br = math.sin(2 * math.pi * u * 2)
            P.q["hips"] = Ry(-sway * 1.5)
            P.q["spine"] = Ry(sway * 1.2) @ Rx(0.012 * br)
            P.q["chest"] = Rx(-0.02 * br)
            P.q["neck"] = Ry(sway * 0.5)
            P.q["head"] = Rz(0.06 * math.sin(2 * math.pi * u + 1)) @ Rx(0.03)
            default_arms(P, 0.03 * math.sin(2 * math.pi * u + 0.5))
            out.append(P)
        return out
    if name == "look":       # glance about (the "?" moment)
        n = 72
        for f in range(n):
            u = f / n
            P = Pose()
            standing(d, P, front=0.03 * k, crouch=0.01 * k)
            yaw = 0.75 * (smooth(u / 0.2) - 2 * smooth((u - 0.3) / 0.25) + smooth((u - 0.7) / 0.25))
            P.q["chest"] = Rz(yaw * 0.3)
            P.q["neck"] = Rz(yaw * 0.3)
            P.q["head"] = Rz(yaw * 0.45) @ Rx(-0.05)
            default_arms(P)
            out.append(P)
        return out
    if name == "talk":
        n = 48
        for f in range(n):
            u = f / n
            P = Pose()
            standing(d, P, front=0.04 * k, crouch=0.01 * k)
            beat = math.sin(2 * math.pi * u * 2)
            P.q["spine"] = Rz(0.06 * math.sin(2 * math.pi * u))
            P.q["head"] = Rx(0.06 * beat) @ Rz(0.08 * math.sin(2 * math.pi * u))
            arm(P, "R", -0.35 - 0.12 * beat, inward=0.25, elbow=1.25 + 0.2 * beat, wrist=-0.3)
            arm(P, "L", -0.25 + 0.1 * math.sin(2 * math.pi * u * 2 + 1.5), inward=0.2, elbow=0.95, wrist=-0.3)
            out.append(P)
        return out
    if name == "shrug":      # "?" huh
        n = 24
        for f in range(n):
            u = f / n
            e = smooth(u / 0.35) * (1 - 0.25 * smooth((u - 0.6) / 0.4))
            P = Pose()
            standing(d, P, front=0.03 * k)
            P.q["chest"] = Rx(-0.05 * e)
            P.q["head"] = Rz(0.18 * e) @ Rx(0.1 * e)
            for side in ("L", "R"):
                arm(P, side, -0.25 * e, abd=0.45 * e, elbow=1.4 * e, wrist=0.3 * e)
            out.append(P)
        return out
    if name == "startle":    # "!" jump back
        n = 15
        for f in range(n):
            u = f / n
            e = smooth(u / 0.3)
            P = Pose()
            P.hips = V(0, 0.05 * k * e, 0.02 * k * math.sin(math.pi * min(u / 0.5, 1)))
            standing(d, P, front=0.05 * k)
            P.q["spine"] = Rx(-0.18 * e)
            P.q["head"] = Rx(-0.12 * e)
            for side in ("L", "R"):
                arm(P, side, -1.9 * e, abd=0.5 * e, elbow=0.8 * e, wrist=-0.4 * e)
            out.append(P)
        return out
    if name == "scratch":    # give up (spec V-ANIM-3)
        n = 36
        for f in range(n):
            u = f / n
            P = Pose()
            standing(d, P, front=0.03 * k, sway=-0.015 * k)
            P.q["head"] = Ry(0.18) @ Rx(0.1)
            P.q["spine"] = Ry(0.04)
            jig = math.sin(2 * math.pi * u * 6)
            arm(P, "R", -2.25, abd=0.6, elbow=2.15 + 0.12 * jig, wrist=-0.4)
            arm(P, "L", 0.05, abd=0.45, elbow=1.7, twist=0.0, wrist=0.2)   # hand on the hip
            out.append(P)
        return out
    if name == "clap":       # "all done" (spec V-ANIM-4)
        n = 12
        for f in range(n):
            u = f / n
            c = 0.5 + 0.5 * math.cos(2 * math.pi * u)
            P = Pose()
            standing(d, P, front=0.03 * k)
            P.q["head"] = Rx(-0.08)
            for side in ("L", "R"):
                arm(P, side, -0.75, inward=0.62 - 0.32 * c, elbow=1.1, wrist=-0.2)
            out.append(P)
        return out
    if name == "fist":       # shaking a fist at the goose
        n = 14
        for f in range(n):
            u = f / n
            jig = math.sin(2 * math.pi * u)
            P = Pose()
            standing(d, P, front=0.12 * k, crouch=0.02 * k)
            P.q["spine"] = Rx(0.1)
            P.q["head"] = Rx(0.05)
            arm(P, "R", -2.35 + 0.15 * jig, abd=0.15, inward=0.2, elbow=0.9 + 0.25 * jig, wrist=0.2)
            arm(P, "L", 0.0, abd=0.45, elbow=1.7, wrist=0.2)
            out.append(P)
        return out
    if name == "shoo":       # go away! (spec V-ANIM-1): both arms sweep down and out
        n = 16
        for f in range(n):
            u = f / n
            sweep = 0.5 + 0.5 * math.sin(2 * math.pi * u)
            P = Pose()
            standing(d, P, front=0.15 * k, crouch=0.04 * k)
            P.q["spine"] = Rx(0.18)
            P.q["head"] = Rx(-0.1)
            for side in ("L", "R"):
                arm(P, side, -1.25 + 0.75 * sweep, abd=0.15 + 0.35 * sweep, elbow=0.35, wrist=-0.6 + 0.9 * sweep)
            out.append(P)
        return out
    if name == "tug":        # tug of war: braced and leaning back, short jerks
        n = 12
        for f in range(n):
            u = f / n
            jerk = math.sin(2 * math.pi * u)
            P = Pose()
            P.hips = V(0, 0.08 * k + 0.02 * k * jerk, 0)
            standing(d, P, front=0.28 * k, crouch=0.09 * k)
            P.q["spine"] = Rx(-0.22 - 0.06 * jerk)
            P.q["chest"] = Rx(-0.08)
            P.q["head"] = Rx(0.25)
            for side in ("L", "R"):
                arm(P, side, -1.35, inward=0.55, elbow=0.25 + 0.1 * jerk, wrist=0.2)
            out.append(P)
        return out
    if name == "carry":      # both hands in front, holding something (upper body only in game)
        P = Pose()
        standing(d, P, front=0.03 * k)
        for side in ("L", "R"):
            arm(P, side, -0.45, inward=0.5, elbow=1.25, wrist=0.15)
        return [P] * 2
    if name == "hold":       # one thing in the right hand at the chest (coffee, card, flag)
        P = Pose()
        standing(d, P, front=0.03 * k)
        default_arms(P)
        arm(P, "R", -0.3, inward=0.2, elbow=1.45, wrist=0.1)
        return [P] * 2
    if name == "phone":      # filming the goose
        P = Pose()
        standing(d, P, front=0.04 * k)
        P.q["head"] = Rx(0.12)
        arm(P, "R", -1.05, inward=0.45, elbow=1.65, wrist=-0.2)
        arm(P, "L", -0.9, inward=0.55, elbow=1.55, wrist=-0.2)
        return [P] * 2
    if name == "headshake":  # disapproval (spec V-ANIM-2): arms folded, slow head shake
        n = 30
        for f in range(n):
            u = f / n
            P = Pose()
            standing(d, P, front=0.03 * k)
            P.q["head"] = Rz(0.32 * math.sin(2 * math.pi * u)) @ Rx(0.06)
            for side in ("L", "R"):
                arm(P, side, -0.35, inward=0.65, elbow=1.75, wrist=0.0)
            out.append(P)
        return out
    if name == "dress":      # reaching down to put a hat on the goose
        n = 38
        for f in range(n):
            u = f / n
            e = smooth(u / 0.35) * (1 - smooth((u - 0.75) / 0.25))
            P = Pose()
            P.hips = V(0, 0.07 * k * e, 0)
            standing(d, P, front=0.12 * k * e, crouch=0.14 * k * e)
            P.q["spine"] = Rx(0.55 * e)
            P.q["chest"] = Rx(0.3 * e)
            P.q["head"] = Rx(0.1 * e)
            for side in ("L", "R"):
                arm(P, side, -0.9 * e + 0.04, inward=0.4 * e, elbow=0.3 * e)
            out.append(P)
        return out
    if name == "fall":       # pratfall: over backwards, a moment on the grass, back up (2.2 s)
        n = 53
        for f in range(n):
            t = f / FPS
            e = smooth(t / 0.4) * (1 - smooth((t - 1.7) / 0.5))
            P = Pose()
            P.hips = V(0, 0.32 * k * e, -(d.hip_z - 0.15 * k) * e)
            P.q["hips"] = Rx(-1.25 * e)
            wob = math.sin(t * 9) * 0.08 * e if 0.4 < t < 1.7 else 0
            for side, s in (("L", 1), ("R", -1)):
                P.q[f"thigh.{side}"] = Rx(-0.4 * e - (0.35 * e if s == 1 else 0.15 * e) + wob * s)
                P.q[f"shin.{side}"] = Rx(0.5 * e)
                P.q[f"foot.{side}"] = Rx(-0.2 * e)
            P.q["spine"] = Rx(0.25 * e)
            P.q["head"] = Rx(0.35 * e)
            for side in ("L", "R"):
                arm(P, side, -2.2 * e, abd=0.6 * e, elbow=0.4 * e)
            if e < 1e-3:
                standing(d, P)
                default_arms(P)
            elif t > 1.7 or t < 0.4:
                # blend the legs back to standing as they get up
                Q = Pose()
                standing(d, Q)
                for b in ("thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R"):
                    P.q[b] = Q.q[b].slerp(P.q[b], e)
            out.append(P)
        return out
    if name == "sit":        # on a bench or a ledge (seat at knee height)
        P = Pose()
        P.hips = V(0, 0.05 * k, -(d.hip_z - d.knee_z - 0.02 * k))
        for side in ("L", "R"):
            P.q[f"thigh.{side}"] = Rx(-1.5)
            P.q[f"shin.{side}"] = Rx(1.5)
            P.q[f"foot.{side}"] = Rx(0.0)
        P.q["spine"] = Rx(0.08)
        for side in ("L", "R"):
            arm(P, side, -0.45, inward=0.25, elbow=0.75)
        return [P] * 2
    raise KeyError(name)


CLIPS = ["idle", "walk", "run", "look", "talk", "shrug", "startle", "scratch", "clap", "fist", "shoo", "tug",
         "carry", "hold", "phone", "headshake", "dress", "fall", "sit"]
LOOPING = {"idle", "walk", "run", "look", "talk", "scratch", "clap", "fist", "shoo", "tug", "carry", "hold", "phone", "headshake", "sit"}


def bake_actions(rig, d):
    rest = {b.name: b.matrix_local.to_quaternion() for b in rig.data.bones}
    rig.animation_data_create()
    actions = []
    for name in CLIPS:
        poses = clip_poses(name, d)
        loop = name in LOOPING
        n = len(poses)
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        slot = act.slots.new(id_type="OBJECT", name="rig")
        cb = act.layers.new("layer").strips.new(type="KEYFRAME").channelbag(slot, ensure=True)
        # a loop repeats its first pose at the end so the clip duration is exactly n frames
        frames = list(range(n + 1)) if loop else list(range(n))
        series = {b: [] for b in BONES}
        loc = []
        for f in frames:
            P = poses[f % n]
            for b in BONES:
                Rb = rest[b]
                q = Rb.inverted() @ P.q[b] @ Rb
                prev = series[b][-1] if series[b] else None
                if prev is not None and prev.dot(q) < 0:
                    q = -q
                series[b].append(q)
            loc.append(rest["hips"].inverted() @ P.hips)
        for b in BONES:
            for i in range(4):
                fc = cb.fcurves.new(f'pose.bones["{b}"].rotation_quaternion', index=i)
                fc.keyframe_points.add(len(frames))
                fc.keyframe_points.foreach_set("co", [c for f, q in zip(frames, series[b]) for c in (f, q[i])])
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
        for i in range(3):
            fc = cb.fcurves.new('pose.bones["hips"].location', index=i)
            fc.keyframe_points.add(len(frames))
            fc.keyframe_points.foreach_set("co", [c for f, l in zip(frames, loc) for c in (f, l[i])])
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
        act.use_frame_range = True
        act.frame_start, act.frame_end = frames[0], frames[-1]
        act.use_cyclic = loop
        tr = rig.animation_data.nla_tracks.new()
        tr.name = name
        st = tr.strips.new(name, 0, act)
        st.action_slot = act.slots[0]
        tr.mute = True
        actions.append(act)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return actions


# ---------------------------------------------------------------- build

def build_person(variant, offset=None, lods=(0, 1), with_hair=None, with_hat=None):
    v = VARIANTS[variant]
    d = Dims(v)
    rig, segs = make_rig(d)
    objs = [rig]
    for lod in lods:
        b, g = body(v, d, lod)
        cut_mesh(b, cuts(v, d))
        paint_slots(b, body_slot(v, d, g, segs), DEFAULT)
        b = decimate(b, int(__import__("os").environ.get("PEOPLE_TRIS", 1900)) if lod == 0 else 560)
        recolour(b, DEFAULT)
        weight_body(b, g, segs, d)
        hd = head(d, lod)
        paint_all(hd, "skin", DEFAULT)
        weight_rigid(hd, "head")
        parts = [b, hd]
        for ob, slot, colour, wmode in extras(v, d, lod):
            paint_all(ob, slot, DEFAULT, colour)
            if wmode == "skirt":
                weight_skirt(ob, d)
            else:
                weight_rigid(ob, wmode)
            parts.append(ob)
        whole = join(parts, "body" + ("_lod1" if lod else ""))
        bind(whole, rig)
        objs.append(whole)
        for style in (with_hair or HAIRS):
            hr = hair(style, d, lod)
            paint_all(hr, "hair", DEFAULT)
            weight_rigid(hr, "head")
            bind(hr, rig)
            objs.append(hr)
        for kind in (with_hat if with_hat is not None else HATS):
            ht = hat(kind, d, lod)
            ht.name = f"hat_{kind}" + ("_lod1" if lod else "")
            weight_rigid(ht, "head")
            bind(ht, rig)
            objs.append(ht)
    bake_actions(rig, d)
    for o in objs:
        if o.type == "MESH":
            o.data.validate()
    if offset is not None:
        rig.location = offset
    return objs


def build(model):
    variant = model.removeprefix("person_")
    objs = build_person(variant)
    for o in objs:
        if o.type == "MESH":
            tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
            print(f"[people] {model} {o.name}: {tris} tris")
    return objs


# ---------------------------------------------------------------- preview (contact sheet)

PREVIEW_LOOKS = {
    "hoodie": dict(skin="skin_b", hair="hair_dark", top="cloth_red", bottom="denim"),
    "backpack": dict(skin="skin_e", hair="hair_black", top="cloth_cream", over="cloth_green", bottom="cloth_khaki", acc="bag_black"),
    "dress": dict(skin="skin_f", hair="hair_black", top="cloth_gold", bottom="cloth_black"),
    "puffer": dict(skin="skin_d", hair="hair_blond", top="cloth_navy", bottom="cloth_black", hat="cloth_maroon"),
    "tee": dict(skin="skin_c", hair="hair_dark", top="cloth_teal", bottom="cloth_grey", hat="cloth_navy"),
    "coat": dict(skin="skin_a", hair="hair_grey", top="cloth_cream", over="cloth_navy", bottom="cloth_grey", acc="cloth_maroon"),
    "worker": dict(skin="skin_c", hair="hair_dark", top="cloth_green", over="hivis", bottom="cloth_green"),
    "apron": dict(skin="skin_e", hair="hair_auburn", top="cloth_white", over="cloth_red", bottom="cloth_navy"),
}


def preview(out, clip=None, frame=0, view="front"):
    lib.clear()
    looks = [("hoodie", "short", None), ("backpack", "curly", None), ("dress", "bun", None), ("puffer", "buzz", "toque"),
             ("tee", "ponytail", "cap"), ("coat", "bald", None), ("worker", "short", "hardhat"), ("apron", "long", None)]
    for i, (variant, style, hat_kind) in enumerate(looks):
        objs = build_person(variant, offset=V((i - 3.5) * 0.75, 0, 0) if view == "front" else V(0, (i - 3.5) * 0.75, 0),
                            lods=(0,), with_hair=[style], with_hat=[hat_kind] if hat_kind else [])
        rig = objs[0]
        look = {**DEFAULT, **PREVIEW_LOOKS[variant]}
        for o in objs[1:]:
            recolour(o, look)
        if clip:
            act = bpy.data.actions[clip] if clip in bpy.data.actions else next(a for a in bpy.data.actions if a.name.startswith(clip))
            rig.animation_data.action = act
            rig.animation_data.action_slot = act.slots[0]
        # the actions of each person are named clip, clip.001, ... : pick the one matching this rig
        if clip:
            mine = [a for a in bpy.data.actions if a.name.split(".")[0] == clip]
            act = mine[i]
            rig.animation_data.action = act
            rig.animation_data.action_slot = act.slots[0]
    scene = bpy.context.scene
    scene.frame_set(int(frame))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 6.2
    cam.location = V(0, -9, 2.6)
    cam.rotation_euler = (math.radians(80), 0, 0)
    if view == "side":
        cam.location = V(9, 0, 2.6)
        cam.rotation_euler = (math.radians(80), 0, math.radians(90))
    scene.camera = cam
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError as e:
        print("engine", e)
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_shadows = False
    sh.show_cavity = False
    scene.render.resolution_x, scene.render.resolution_y = 1800, 640
    world = bpy.data.worlds.new("w")
    world.color = (0.55, 0.6, 0.5)
    scene.world = world
    sh.background_type = "WORLD"
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__" and "preview" in sys.argv:
    a = sys.argv[sys.argv.index("preview") + 1:]
    preview(a[0], a[1] if len(a) > 1 else None, a[2] if len(a) > 2 else 0, a[3] if len(a) > 3 else "front")
