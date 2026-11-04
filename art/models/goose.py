"""Canada goose: one smooth skinned body+neck+head surface, layered wings, legs, webbed feet, rig and actions.

npm run art -- goose  ->  public/models/goose.glb  (not a world model; loaded by src/goose/skinned.ts)

Shapes are authored in "goose coordinates" (x left, f forward, z up; metres, feet on z = 0) and placed in
Blender at (x, -f, z): the goose faces Blender -Y, which the glTF exporter turns into +Z (the game's
forward). Proportions: Canada goose length ~0.9 m and wingspan ~1.5 m (All About Birds; Wikipedia),
scaled to the game goose the levels were tuned for (head ~0.93 m up, body ~0.85 m long, span 1.54 m).

Body+neck+head: a signed distance field (smooth union of ellipsoids and round cones) turned into a
mesh with surface nets, collapse-decimated with X symmetry, re-projected onto the field, then cut
along the colour borders (collar, chinstrap, breast, undertail) so palette blocks have crisp edges.
Bill, wings, legs and feet are separate shells skinned to their bones (rigid parts, blended joints).
Every action is sampled from a pose function per frame (24 fps, frame 0 == last frame for loops).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

import lib

FPS = 24
GROUP = "goose"


def P(x, f, z):
    return Vector((x, -f, z))


def col(name):
    return lib.swatch(name, GROUP)


# ---------------------------------------------------------------- signed distance field (numpy)

def sd_ellipsoid(X, F, Z, c, r, pitch=0.0):
    x, f, z = X - c[0], F - c[1], Z - c[2]
    if pitch:
        ca, sa = math.cos(pitch), math.sin(pitch)
        f, z = f * ca + z * sa, -f * sa + z * ca
    k0 = np.sqrt((x / r[0]) ** 2 + (f / r[1]) ** 2 + (z / r[2]) ** 2)
    k1 = np.sqrt((x / r[0] ** 2) ** 2 + (f / r[1] ** 2) ** 2 + (z / r[2] ** 2) ** 2)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)


def sd_round_cone(X, F, Z, a, b, r1, r2):
    """Inigo Quilez's exact round cone (capsule with two radii) from a to b."""
    ba = np.array(b) - np.array(a)
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = np.stack([X - a[0], F - a[1], Z - a[2]], -1)
    y = pa @ ba
    zz = y - l2
    q = pa * l2 - y[..., None] * ba
    x2 = np.sum(q * q, -1)
    y2 = y * y * l2
    z2 = zz * zz * l2
    k = math.copysign(1, rr) * rr * rr * x2
    d3 = (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
    d1 = np.sqrt(x2 + z2) * il2 - r2
    d2 = np.sqrt(x2 + y2) * il2 - r1
    return np.where(np.sign(zz) * a2 * z2 > k, d1, np.where(np.sign(y) * a2 * y2 < k, d2, d3))


def smin(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


# neck centre line (f, z, radius), from the base on the breast up to the head joint
NECK = [(0.195, 0.55, 0.078), (0.278, 0.665, 0.054), (0.306, 0.76, 0.045), (0.322, 0.835, 0.041),
        (0.334, 0.877, 0.041)]
HEAD_C = (0.373, 0.897)


def goose_sdf(X, F, Z):
    body = sd_ellipsoid(X, F, Z, (0, -0.03, 0.43), (0.162, 0.34, 0.145), pitch=0.04)
    breast = sd_ellipsoid(X, F, Z, (0, 0.14, 0.43), (0.148, 0.18, 0.152))
    back = sd_ellipsoid(X, F, Z, (0, -0.06, 0.47), (0.13, 0.3, 0.1))
    rump = sd_ellipsoid(X, F, Z, (0, -0.29, 0.425), (0.11, 0.16, 0.11), pitch=-0.25)
    tail = sd_ellipsoid(X, F, Z, (0, -0.445, 0.505), (0.07, 0.095, 0.02), pitch=0.28)
    d = smin(body, breast, 0.09)
    d = smin(d, back, 0.06)
    d = smin(d, rump, 0.08)
    d = smin(d, tail, 0.05)
    neck = None
    for (f0, z0, r0), (f1, z1, r1) in zip(NECK, NECK[1:]):
        s = sd_round_cone(X, F, Z, (0, f0, z0), (0, f1, z1), r0, r1)
        neck = s if neck is None else smin(neck, s, 0.02)
    head = sd_ellipsoid(X, F, Z, (0, HEAD_C[0], HEAD_C[1]), (0.041, 0.063, 0.044), pitch=-0.12)
    # a flat-ish crown and a fuller cheek: a second, lower ellipsoid under the eye
    cheek = sd_ellipsoid(X, F, Z, (0, 0.36, 0.885), (0.042, 0.045, 0.036))
    neck = smin(neck, smin(head, cheek, 0.02), 0.035)
    return smin(d, neck, 0.075)


def sdf_points(pts):
    return goose_sdf(pts[:, 0], pts[:, 1], pts[:, 2])


def surface_nets(fn, lo, hi, h):
    """Polygonise fn < 0 on a grid of spacing h; returns (verts (n,3), quads (m,4)) in goose coords."""
    axes = [np.arange(lo[i], hi[i] + h * 0.5, h) for i in range(3)]
    G = np.meshgrid(*axes, indexing="ij")
    D = fn(*G)
    nx, ny, nz = D.shape
    inside = D < 0
    corners = [(i, j, k) for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    cs = np.stack([inside[i:nx - 1 + i, j:ny - 1 + j, k:nz - 1 + k] for i, j, k in corners], -1)
    active = cs.any(-1) & ~cs.all(-1)
    idx = np.argwhere(active)
    vid = -np.ones(active.shape, np.int64)
    vid[tuple(idx.T)] = np.arange(len(idx))
    edges = [(a, b) for a in range(8) for b in range(a + 1, 8)
             if sum(abs(corners[a][t] - corners[b][t]) for t in range(3)) == 1]
    acc = np.zeros((len(idx), 3))
    cnt = np.zeros(len(idx))
    for a, b in edges:
        ia = idx + np.array(corners[a])
        ib = idx + np.array(corners[b])
        da = D[tuple(ia.T)]
        db = D[tuple(ib.T)]
        m = (da < 0) != (db < 0)
        t = da[m] / (da[m] - db[m])
        pa = ia[m] + t[:, None] * (ib[m] - ia[m])
        acc[m] += pa
        cnt[m] += 1
    verts = acc / cnt[:, None] * h + np.array(lo)
    quads = []
    for ax in range(3):
        o1, o2 = [(1, 2), (0, 2), (0, 1)][ax]
        sl0 = [slice(0, n) for n in D.shape]
        sl1 = list(sl0)
        sl0[ax] = slice(0, D.shape[ax] - 1)
        sl1[ax] = slice(1, D.shape[ax])
        ch = inside[tuple(sl0)] != inside[tuple(sl1)]
        e = np.argwhere(ch)
        e = e[(e[:, o1] > 0) & (e[:, o2] > 0)]
        flip = inside[tuple(e.T)]
        def cell(d1, d2):
            c = e.copy()
            c[:, o1] -= d1
            c[:, o2] -= d2
            return vid[tuple(c.T)]
        q = np.stack([cell(1, 1), cell(0, 1), cell(0, 0), cell(1, 0)], -1)
        q[flip] = q[flip][:, ::-1]
        quads.append(q[(q >= 0).all(-1)])
    return verts, np.concatenate(quads)


def project_to_surface(bm, iters=3):
    pts = np.array([v.co for v in bm.verts])
    g = np.column_stack([pts[:, 0], -pts[:, 1], pts[:, 2]])   # blender -> goose coords
    e = 1e-4
    for _ in range(iters):
        d = sdf_points(g)
        grad = np.column_stack([(sdf_points(g + np.eye(3)[i] * e) - d) / e for i in range(3)])
        n = grad / np.maximum(np.linalg.norm(grad, axis=1, keepdims=True), 1e-9)
        g = g - n * d[:, None]
    for v, p in zip(bm.verts, g):
        v.co = (p[0], -p[1], p[2])


# ---------------------------------------------------------------- colour regions (goose coords)

COLLAR_P = np.array([0.262, 0.605])
COLLAR_N = np.array([0.5, 0.866])
CHIN_PHI = math.radians(28)
CHIN_W = (-0.03, 0.016)
CHIN_TOP = 0.9


# slanted borders: white undertail below a line rising to the tail; pale breast in front of a line
# leaning back from the collar to the belly
UT_F, UT_Z, UT_K = -0.37, 0.49, -0.75
BR_F, BR_Z, BR_K = 0.2, 0.62, 0.75


def chin_w(f, z):
    return (f - 0.358) * math.cos(CHIN_PHI) + (z - 0.885) * math.sin(CHIN_PHI)


def region(x, f, z):
    if (f - COLLAR_P[0]) * COLLAR_N[0] + (z - COLLAR_P[1]) * COLLAR_N[1] > 0 and f > 0.12:
        if z > 0.83 and f > 0.30:
            w = chin_w(f, z)
            if CHIN_W[0] < w < CHIN_W[1] and z < CHIN_TOP:
                return "chinstrap"
        return "neck"
    if f < -0.37 and z > 0.488:
        return "tail"
    if z < UT_Z + (f - UT_F) * UT_K:
        return "undertail"
    if f > BR_F + (z - BR_Z) * BR_K or z < 0.31:
        return "breast"
    return "body"


def cut(bm, co, no, inside=None):
    """Bisect the faces whose centre passes `inside` (goose coords) along a plane given in goose coords."""
    faces = [fa for fa in bm.faces if inside is None or inside(*goose_of(fa.calc_center_median()))]
    geom = list({e for fa in faces for e in fa.edges}) + faces + list({v for fa in faces for v in fa.verts})
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=P(*co), plane_no=Vector((no[0], -no[1], no[2])), dist=1e-5)


def goose_of(v):
    return v.x, -v.y, v.z


def build_body():
    verts, quads = surface_nets(goose_sdf, (-0.2, -0.56, 0.24), (0.2, 0.46, 0.96), 0.006)
    bm = bmesh.new()
    bv = [bm.verts.new((x, -f, z)) for x, f, z in verts]
    for q in quads:
        try:
            bm.faces.new([bv[i] for i in q])
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = lib.mesh_object("goose_body", bm)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    smooth = ob.modifiers.new("smooth", "SMOOTH")
    smooth.factor, smooth.iterations = 0.5, 4
    tri = ob.modifiers.new("tri", "TRIANGULATE")
    dec = ob.modifiers.new("dec", "DECIMATE")
    dec.ratio = 1500 / (len(quads) * 2)
    dec.use_symmetry, dec.symmetry_axis = True, "X"
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    project_to_surface(bm)
    # colour borders as real edges
    near = lambda lo, hi: (lambda x, f, z: all(lo[i] - 0.03 <= (x, f, z)[i] <= hi[i] + 0.03 for i in range(3)))
    cut(bm, (0, COLLAR_P[0], COLLAR_P[1]), (0, COLLAR_N[0], COLLAR_N[1]), near((-1, 0.12, 0.45), (1, 0.4, 0.75)))
    cn = (0, math.cos(CHIN_PHI), math.sin(CHIN_PHI))
    head = near((-1, 0.29, 0.82), (1, 0.45, 0.95))
    for w in CHIN_W:
        cut(bm, (0, 0.358 + w * cn[1], 0.885 + w * cn[2]), cn, head)
    cut(bm, (0, 0.36, CHIN_TOP), (0, 0, 1), head)
    cut(bm, (0, -0.37, 0.488), (0, 0, 1), near((-1, -0.6, 0.45), (1, -0.3, 0.55)))
    cut(bm, (0, -0.37, 0.488), (0, 1, 0), near((-1, -0.42, 0.45), (1, -0.33, 0.6)))
    ut = Vector((-UT_K, 1)).normalized()
    cut(bm, (0, UT_F, UT_Z), (0, ut.x, ut.y), near((-1, -0.4, 0.25), (1, -0.05, 0.5)))
    br = Vector((1, -BR_K)).normalized()
    cut(bm, (0, BR_F, BR_Z), (0, br.x, br.y), near((-1, -0.1, 0.25), (1, 0.25, 0.64)))
    cut(bm, (0, 0, 0.31), (0, 0, 1), near((-1, -0.25, 0.28), (1, 0.1, 0.34)))
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="BEAUTY")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    regions = {}
    for p in me.polygons:
        regions.setdefault(region(*goose_of(p.center)), []).append(p.index)
    for name, faces in regions.items():
        lib.paint(ob, col(name), faces)
    return ob


# ---------------------------------------------------------------- small parts (bmesh lofts)

def loft(rings, cap0=True, cap1=True):
    """rings: list of lists of goose-coord points (same count); returns a bmesh with quads + fan caps."""
    bm = bmesh.new()
    vs = [[bm.verts.new(P(*p)) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for k in range(n):
            bm.faces.new([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]])
    for ring, on in ((vs[0], cap0), (vs[-1], cap1)):
        if on:
            c = bm.verts.new(sum((v.co for v in ring), Vector()) / n)
            for k in range(n):
                bm.faces.new([ring[k], ring[(k + 1) % n], c])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def ring_xz(f, zc, w, top, bot, n=8, x0=0.0):
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s = math.cos(a), math.sin(a)
        out.append((x0 + w * c, f, zc + (top if s > 0 else bot) * s))
    return out


def build_bill():
    # upper bill: a wedge from inside the face to the tip, rounded culmen, flat cutting edge, nail at the tip
    st = [(0.398, 0.0175, 0.016, 0.006, 0.889), (0.42, 0.016, 0.0135, 0.004, 0.887), (0.445, 0.0135, 0.0105, 0.003, 0.882),
          (0.468, 0.011, 0.008, 0.003, 0.876), (0.486, 0.0075, 0.0055, 0.0035, 0.870), (0.495, 0.0035, 0.003, 0.004, 0.866)]
    up = lib.mesh_object("goose_bill", loft([ring_xz(f, z, w, t, b) for f, w, t, b, z in st]))
    lo_st = [(0.404, 0.0145, 0.003, 0.008, 0.879), (0.43, 0.0125, 0.003, 0.0075, 0.876), (0.455, 0.0105, 0.003, 0.006, 0.872),
             (0.478, 0.0075, 0.0025, 0.0045, 0.867), (0.489, 0.004, 0.002, 0.003, 0.864)]
    lo = lib.mesh_object("goose_jaw", loft([ring_xz(f, z, w, t, b) for f, w, t, b, z in lo_st]))
    for ob in (up, lo):
        lib.paint(ob, col("bill"))
        for p in ob.data.polygons:
            p.use_smooth = True
    return up, lo


# leg chain rest positions (goose coords, left side x > 0)
HIP = (0.074, -0.02, 0.33)
ANKLE = (0.074, -0.075, 0.135)
FOOTJ = (0.074, -0.03, 0.024)
TOE = (0.074, 0.075, 0.006)


def build_leg(sx):
    pts = [(HIP, 0.024), ((0.074, -0.05, 0.23), 0.019), ((0.074, -0.07, 0.16), 0.0135), (ANKLE, 0.012),
           ((0.074, -0.05, 0.075), 0.0105), (FOOTJ, 0.011)]
    rings = []
    for i, ((x, f, z), r) in enumerate(pts):
        a = pts[max(i - 1, 0)][0]
        b = pts[min(i + 1, len(pts) - 1)][0]
        tf, tz = b[1] - a[1], b[2] - a[2]
        L = math.hypot(tf, tz)
        nf, nz = -tz / L, tf / L   # in-plane normal
        ring = []
        for k in range(7):
            ang = 2 * math.pi * k / 7
            ring.append((sx * x + r * math.cos(ang), f + nf * r * math.sin(ang), z + nz * r * math.sin(ang)))
        rings.append(ring)
    ob = lib.mesh_object("goose_leg", loft(rings))
    lib.paint(ob, col("legs"))
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def build_foot(sx):
    """Three webbed toes spread ~55 degrees, a hind nub, thin plate with rounded toe tips."""
    x0, f0 = sx * FOOTJ[0], FOOTJ[1]
    toes = [(-0.55, 0.09), (0.0, 0.108), (0.55, 0.09)]
    outline = [(-0.012, -0.016), (0.012, -0.016)]
    pts = []
    for k, (a, L) in enumerate(sorted(toes, key=lambda t: -t[0])):
        tip = (math.sin(a) * L, math.cos(a) * L)
        side = (math.cos(a) * 0.007, -math.sin(a) * 0.007)
        pts += [(tip[0] + side[0], tip[1] + side[1]), (tip[0] * 1.04, tip[1] * 1.04), (tip[0] - side[0], tip[1] - side[1])]
        if k < 2:
            a2, L2 = sorted(toes, key=lambda t: -t[0])[k + 1]
            am = (a + a2) / 2
            pts.append((math.sin(am) * 0.068, math.cos(am) * 0.068))   # web edge, curved back between toes
    # anticlockwise from the heel in (x, f): right heel, toes from +x to -x, left heel
    outline = [(0.014, -0.014)] + pts + [(-0.014, -0.014)]
    bm = bmesh.new()
    top = [bm.verts.new(P(x0 + sx * u, f0 + v, 0.009)) for u, v in outline]
    bot = [bm.verts.new(P(x0 + sx * u, f0 + v, 0.002)) for u, v in outline]
    ft = bm.faces.new(top)
    fb = bm.faces.new(bot[::-1])
    n = len(outline)
    for k in range(n):
        bm.faces.new([top[k], bot[k], bot[(k + 1) % n], top[(k + 1) % n]])
    bmesh.ops.triangulate(bm, faces=[ft, fb], quad_method="BEAUTY", ngon_method="EAR_CLIP")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = lib.mesh_object("goose_foot", bm)
    lib.paint(ob, col("legs"))
    return ob


# wing: open (rest) pose spans +x from the shoulder; chord runs backward (-f); stations along the span
SHOULDER = (0.108, 0.12, 0.548)
WING_DROP = 0.042          # the plate sits this far below the shoulder pivot (outward when folded)
ARM_L, HAND_L, TIP_L = 0.28, 0.18, 0.19
SPAN = ARM_L + HAND_L + TIP_L


def wing_le(s):
    u = max(0.0, (s - ARM_L) / (SPAN - ARM_L))
    return 0.13 * u ** 1.6 - 0.012 * math.sin(math.pi * min(s / ARM_L, 1))


def wing_te(s):
    """Trailing edge chord position: secondaries, then a fan of primaries narrowing to the tip."""
    if s <= ARM_L:
        return 0.19 + 0.035 * (s / ARM_L)
    u = (s - ARM_L) / (SPAN - ARM_L)
    return 0.225 + 0.03 * math.sin(math.pi * u * 0.8) - 0.11 * u ** 2.2


def wing_stations():
    ss = [0.0, 0.035, 0.07, 0.105, 0.14, 0.175, 0.21, 0.245, ARM_L]
    # primaries: a tip and a notch per feather, tips spaced ~0.055 m
    tips = [0.33, 0.39, 0.445, 0.5, 0.55, 0.595, 0.632]
    for k, t in enumerate(tips):
        ss.append(t - 0.025 if k == 0 else (tips[k - 1] + t) / 2)
        ss.append(t)
    ss.append(SPAN)
    out = []
    for s in ss:
        le, te = wing_le(s), wing_te(s)
        notch = 0.0
        if s > ARM_L:
            notch = 0.0 if any(abs(s - t) < 1e-6 for t in tips) or s == SPAN else 0.035 * min(1.0, (s - ARM_L) / 0.08)
        elif 0 < s < ARM_L:
            notch = 0.012 if round(s / 0.035) % 2 else 0.0   # scalloped secondaries
        te = te - notch
        if s == SPAN:
            le, te = wing_le(s), wing_le(s) + 0.012
        out.append((s, le, max(te, le + 0.01)))
    return out


def wing_plate(sx, stations, thick, h0, rows):
    """A closed lens-section shell over stations (s, c_le, c_te); thick(s, r) gives half-thickness at chord fraction r."""
    bm = bmesh.new()
    ox, of, oz = SHOULDER
    grid = []
    for s, le, te in stations:
        top, bot = [], []
        for r in rows:
            c = le + r * (te - le)
            t = thick(s, r)
            camber = 0.012 * math.sin(math.pi * min(r, 1)) * (1 - s / SPAN * 0.6)
            top.append(bm.verts.new(P(ox * sx + sx * s, of - c, oz - WING_DROP + h0 + camber + t)))
            bot.append(bm.verts.new(P(ox * sx + sx * s, of - c, oz - WING_DROP + h0 + camber - t)))
        grid.append((top, bot))
    for (t0, b0), (t1, b1) in zip(grid, grid[1:]):
        for k in range(len(rows) - 1):
            bm.faces.new([t0[k], t0[k + 1], t1[k + 1], t1[k]])
            bm.faces.new([b0[k], b1[k], b1[k + 1], b0[k + 1]])
        bm.faces.new([t0[0], t1[0], b1[0], b0[0]])
        bm.faces.new([t0[-1], b0[-1], b1[-1], t1[-1]])
    for t, b in (grid[0], grid[-1]):
        bm.faces.new(t + b[::-1])
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="BEAUTY")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def main_half_thick(s, r):
    return (0.013 * (1 - s / SPAN * 0.55)) * (1 - r) ** 1.3 + 0.0015


def covert_frac(s):
    return 0.62 if s < ARM_L else 0.62 - 0.32 * (s - ARM_L) / (SPAN - ARM_L)


def covert_sheet(sx, side):
    """Greater coverts: one scalloped sheet lying on the main plate (side +1 top, -1 underside), pale fringe row."""
    ox, of, oz = SHOULDER
    n = 26
    bm = bmesh.new()
    cols = []
    for k in range(n + 1):
        s = SPAN * 0.93 * k / n
        le, te = wing_le(s), wing_te(s)
        end = le + (te - le) * covert_frac(s) - 0.016 * (k % 2)
        row = []
        for r in (0.0, 0.8, 1.0):
            c = le - 0.002 + r * (end - le + 0.002)
            rr = min(max((c - le) / max(te - le, 1e-3), 0), 1)
            camber = 0.012 * math.sin(math.pi * rr) * (1 - s / SPAN * 0.6)
            h = side * (main_half_thick(s, rr) + 0.003 + (0.002 if r < 1 else 0.0))
            row.append(bm.verts.new(P(sx * (ox + s), of - c, oz - WING_DROP + camber + h)))
        cols.append(row)
    edge = []
    for a, b in zip(cols, cols[1:]):
        for k in range(2):
            fa = bm.faces.new([a[k], a[k + 1], b[k + 1], b[k]])
            if k == 1:
                edge.append(fa)
    for fa in edge:
        fa.material_index = 1
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="BEAUTY")
    # outward facing on its side of the plate
    for fa in bm.faces:
        fa.normal_update()
        if fa.normal.z * side < 0:
            fa.normal_flip()
    ob = lib.mesh_object("goose_coverts", bm)
    lib.paint(ob, col("body"))
    lib.paint(ob, col("body_edge"), [p.index for p in ob.data.polygons if p.material_index == 1])
    for p in ob.data.polygons:
        p.material_index = 0
    return ob


def build_wing(sx):
    main = wing_plate(sx, wing_stations(), main_half_thick, 0.0, [0, 0.5, 1])
    ob = lib.mesh_object("goose_wing", main)
    lib.paint(ob, col("flight"))
    parts = [ob, covert_sheet(sx, 1), covert_sheet(sx, -1)]
    for o in parts:
        for p in o.data.polygons:
            p.use_smooth = True
    return parts


# ---------------------------------------------------------------- armature

def bones_spec():
    S = SHOULDER
    b = [
        ("root", (0, 0, 0), (0, 0.1, 0), None),
        ("hips", (0, -0.02, 0.43), (0, 0.08, 0.43), "root"),
        ("body", (0, -0.02, 0.43), (0, 0.12, 0.46), "hips"),
        ("tail", (0, -0.34, 0.47), (0, -0.48, 0.51), "body"),
        ("neck1", (0, NECK[0][0], NECK[0][1]), (0, NECK[1][0], NECK[1][1]), "body"),
        ("neck2", (0, NECK[1][0], NECK[1][1]), (0, NECK[2][0], NECK[2][1]), "neck1"),
        ("neck3", (0, NECK[2][0], NECK[2][1]), (0, NECK[3][0], NECK[3][1]), "neck2"),
        ("neck4", (0, NECK[3][0], NECK[3][1]), (0, NECK[4][0], NECK[4][1]), "neck3"),
        ("head", (0, NECK[4][0], NECK[4][1]), (0, 0.42, 0.895), "neck4"),
        ("jaw", (0, 0.402, 0.879), (0, 0.48, 0.868), "head"),
    ]
    for sx, sfx in ((1, "l"), (-1, "r")):
        x0 = S[0] * sx
        b += [
            (f"wing_arm_{sfx}", (x0, S[1], S[2]), (x0 + sx * ARM_L, S[1], S[2]), "body"),
            (f"wing_hand_{sfx}", (x0 + sx * ARM_L, S[1], S[2]), (x0 + sx * (ARM_L + HAND_L), S[1], S[2]), f"wing_arm_{sfx}"),
            (f"wing_tip_{sfx}", (x0 + sx * (ARM_L + HAND_L), S[1], S[2]), (x0 + sx * SPAN, S[1], S[2]), f"wing_hand_{sfx}"),
            (f"shin_{sfx}", (sx * HIP[0], HIP[1], HIP[2]), (sx * ANKLE[0], ANKLE[1], ANKLE[2]), "hips"),
            (f"tarsus_{sfx}", (sx * ANKLE[0], ANKLE[1], ANKLE[2]), (sx * FOOTJ[0], FOOTJ[1], FOOTJ[2]), f"shin_{sfx}"),
            (f"foot_{sfx}", (sx * FOOTJ[0], FOOTJ[1], FOOTJ[2]), (sx * TOE[0], TOE[1], TOE[2]), f"tarsus_{sfx}"),
        ]
    return b


def build_rig():
    arm = bpy.data.armatures.new("goose_rig")
    rig = bpy.data.objects.new("goose_rig", arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, parent in bones_spec():
        eb = arm.edit_bones.new(name)
        eb.head, eb.tail = P(*h), P(*t)
        eb.roll = 0
        if parent:
            eb.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return rig


def seg_dist(p, a, b):
    a, b, p = np.array(a), np.array(b), np.array(p)
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + np.outer(t, ab)), axis=1) if p.ndim > 1 else np.linalg.norm(p - (a + t * ab))


def weight_body(ob):
    """Soft weights by distance to bone capsules (exp falloff), top three kept."""
    pts = np.array([goose_of(v.co) for v in ob.data.vertices])
    caps = {
        "body": ((0, -0.24, 0.43), (0, 0.13, 0.44), 0.13),
        "tail": ((0, -0.38, 0.48), (0, -0.52, 0.52), 0.035),
        "head": ((0, NECK[4][0], NECK[4][1]), (0, 0.41, 0.893), 0.04),
    }
    for k in range(4):
        (f0, z0, r0), (f1, z1, r1) = NECK[k], NECK[k + 1]
        caps[f"neck{k + 1}"] = ((0, f0, z0), (0, f1, z1), (r0 + r1) / 2)
    names = list(caps)
    D = np.stack([seg_dist(pts, a, b) - r for a, b, r in caps.values()], 1)
    W = np.exp(-(D - D.min(1, keepdims=True)) / 0.012)
    W[:, names.index("body")] *= 1.0
    order = np.argsort(-W, 1)[:, :3]
    groups = {n: ob.vertex_groups.new(name=n) for n in names}
    for i in range(len(pts)):
        top = order[i]
        s = W[i, top].sum()
        for j in top:
            w = W[i, j] / s
            if w > 0.01:
                groups[names[j]].add([i], float(w), "REPLACE")


def weight_rigid(ob, bone):
    ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")


def weight_span(ob, sfx):
    """Wing parts: arm / hand / tip by span distance from the shoulder, 2 cm blends at the joints."""
    ga, gh, gt = (ob.vertex_groups.new(name=f"wing_{n}_{sfx}") for n in ("arm", "hand", "tip"))
    for v in ob.data.vertices:
        s = abs(v.co.x) - SHOULDER[0]
        def ramp(e):
            return min(max((s - e + 0.02) / 0.04, 0), 1)
        u1, u2 = ramp(ARM_L), ramp(ARM_L + HAND_L)
        wa, wh, wt = 1 - u1, u1 * (1 - u2), u2
        for g, w in ((ga, wa), (gh, wh), (gt, wt)):
            if w > 0.001:
                g.add([v.index], w, "REPLACE")


def weight_leg(ob, sfx):
    gs, gt = ob.vertex_groups.new(name=f"shin_{sfx}"), ob.vertex_groups.new(name=f"tarsus_{sfx}")
    for v in ob.data.vertices:
        z = v.co.z
        u = min(max((ANKLE[2] + 0.012 - z) / 0.024, 0), 1)
        if 1 - u > 0.001:
            gs.add([v.index], 1 - u, "REPLACE")
        if u > 0.001:
            gt.add([v.index], u, "REPLACE")


# ---------------------------------------------------------------- poses and actions

AX, AY, AZ = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def R(axis, a):
    return Quaternion(axis, a)


def mirror_q(q):
    return Quaternion((q.w, q.x, -q.y, -q.z))


def wing_fold(sfx, open_=0.0, lift=0.0):
    """Folded wing for side sfx; open_ in [0,1] blends toward a half-raised display, lift raises the wrist a bit."""
    lean = 0.3
    q_arm = R(AY, -(math.pi / 2 + lean)) @ R(AZ, math.pi / 2 + 0.11)
    q_arm = R(AX, -0.06 - lift) @ q_arm
    q_hand = R(AY, -0.22) @ R(AZ, -0.05)
    q_tip = R(AY, -0.3) @ R(AZ, -0.1)
    if sfx == "r":
        q_arm, q_hand, q_tip = mirror_q(q_arm), mirror_q(q_hand), mirror_q(q_tip)
    return {f"wing_arm_{sfx}": dict(q=q_arm, s=Vector((1, 0.82, 1))),
            f"wing_hand_{sfx}": dict(q=q_hand, s=Vector((1, 0.6, 1))),
            f"wing_tip_{sfx}": dict(q=q_tip, s=Vector((1, 1.15, 1)))}


def wing_open(sfx, up, hand, tip, sweep=0.0, hand_sweep=0.0):
    """Spread wing: up = elevation of the arm (rad, + raises the tip), hand/tip relative elevations."""
    q_arm = R(AY, -up) @ R(AZ, sweep)
    q_hand = R(AY, -hand) @ R(AZ, hand_sweep)
    q_tip = R(AY, -tip) @ R(AZ, hand_sweep * 0.6)
    if sfx == "r":
        q_arm, q_hand, q_tip = mirror_q(q_arm), mirror_q(q_hand), mirror_q(q_tip)
    one = Vector((1, 1, 1))
    return {f"wing_arm_{sfx}": dict(q=q_arm, s=one), f"wing_hand_{sfx}": dict(q=q_hand, s=one),
            f"wing_tip_{sfx}": dict(q=q_tip, s=one)}


def ang(v):
    return math.atan2(v[1], v[0])


def leg_ik(pose, sfx, hip_off, foot_f, foot_z, toe=0.0):
    """Two-bone IK in the side plane (Blender y, z) for the foot joint; hip_off = hips translation (goose f, z)."""
    sx = 1 if sfx == "l" else -1
    H0 = Vector((-HIP[1], HIP[2]))
    A0 = Vector((-ANKLE[1], ANKLE[2]))
    F0 = Vector((-FOOTJ[1], FOOTJ[2]))
    H = H0 + Vector((-hip_off[0], hip_off[1]))
    T = Vector((-foot_f, foot_z))
    L1, L2 = (A0 - H0).length, (F0 - A0).length
    d = T - H
    dl = min(max(d.length, abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4)
    ca = (L1 * L1 + dl * dl - L2 * L2) / (2 * L1 * dl)
    al = math.acos(min(max(ca, -1), 1))
    th1 = ang(d) + al   # ankle bends backward (+y)
    A = H + Vector((math.cos(th1), math.sin(th1))) * L1
    F = H + d.normalized() * dl
    a1 = th1 - ang(A0 - H0)
    a2 = ang(F - A) - ang(F0 - A0)
    a3 = toe
    pose[f"shin_{sfx}"] = dict(q=R(AX, a1))
    pose[f"tarsus_{sfx}"] = dict(q=R(AX, a2 - a1))
    pose[f"foot_{sfx}"] = dict(q=R(AX, a3 - a2))



def neck_pose(pose, p1, p2, p3, p4, head_pitch=0.0, yaw=0.0, jaw=0.0):
    """Pitches (+ = forward/down) per neck bone; the head is levelled, then head_pitch added."""
    for n, a in zip(("neck1", "neck2", "neck3", "neck4"), (p1, p2, p3, p4)):
        pose[n] = dict(q=R(AZ, yaw / 4) @ R(AX, a))
    pose["head"] = dict(q=R(AX, -(p1 + p2 + p3 + p4) + head_pitch))
    pose["jaw"] = dict(q=R(AX, jaw))


def base_pose():
    pose = {}
    pose.update(wing_fold("l"))
    pose.update(wing_fold("r"))
    return pose


def gait(t, cycle, duty, lift, bob, roll, hip_drop=0.0, toe_curl=0.6):
    """Common locomotion: feet planted for `duty` of the cycle, sliding back `cycle * duty` metres."""
    pose = base_pose()
    tau = 2 * math.pi
    hz = -hip_drop - bob * (0.5 + 0.5 * math.cos(2 * tau * (t - duty / 2 + 0.05)))
    sway = 0.012 * math.cos(tau * (t - duty / 2))
    pose["hips"] = dict(loc=Vector((sway * 0.6, 0, hz)))
    rl = roll * math.cos(tau * (t - duty / 2))
    pose["body"] = dict(q=R(AY, rl) @ R(AZ, 0.04 * math.sin(tau * (t - duty / 2))))
    D = cycle * duty
    for sfx, ph in (("l", t), ("r", (t + 0.5) % 1)):
        if ph < duty:
            u = ph / duty
            ff = D / 2 - u * D
            fz = FOOTJ[2]
            toe = 0.0
        else:
            u = (ph - duty) / (1 - duty)
            e = 0.5 - 0.5 * math.cos(math.pi * u)
            ff = -D / 2 + e * D
            fz = FOOTJ[2] + lift * math.sin(math.pi * u)
            toe = toe_curl * math.sin(math.pi * min(u * 1.3, 1))
        leg_ik(pose, sfx, (0, hz), FOOTJ[1] + ff, fz, toe)
    pose["tail"] = dict(q=R(AZ, -0.12 * math.cos(tau * (t - duty / 2))))
    return pose


def act_idle(t):
    tau = 2 * math.pi
    pose = base_pose()
    pose["hips"] = dict(loc=Vector((0, 0, -0.004 * (0.5 + 0.5 * math.sin(2 * tau * t)))))
    pose["body"] = dict(q=R(AX, 0.015 * math.sin(tau * t)))
    for sfx in ("l", "r"):
        leg_ik(pose, sfx, (0, pose["hips"]["loc"].z), FOOTJ[1], FOOTJ[2])
    neck_pose(pose, -0.03 + 0.04 * math.sin(tau * t), 0.02 * math.sin(tau * t + 1), 0.0, 0.0,
              head_pitch=0.04 * math.sin(tau * t + 2), yaw=0.18 * math.sin(tau * t))
    pose["tail"] = dict(q=R(AZ, 0.25 * math.sin(4 * tau * t) * max(0, math.sin(tau * t)) ** 4))
    return pose


def act_walk(t):
    pose = gait(t, cycle=0.44, duty=0.6, lift=0.05, bob=0.018, roll=0.1)
    tau = 2 * math.pi
    pump = math.sin(2 * tau * (t + 0.1))
    neck_pose(pose, 0.1 + 0.05 * pump, -0.04 * pump, 0.0, 0.0, head_pitch=0.04,
              yaw=-0.08 * math.cos(tau * (t - 0.3)))
    return pose


def act_run(t):
    pose = gait(t, cycle=0.76, duty=0.4, lift=0.08, bob=0.028, roll=0.07, hip_drop=0.015, toe_curl=0.9)
    tau = 2 * math.pi
    pose["body"]["q"] = R(AX, 0.2) @ pose["body"]["q"]
    pump = math.sin(2 * tau * (t + 0.1))
    neck_pose(pose, 0.75 + 0.05 * pump, 0.3, -0.35, -0.25, head_pitch=0.15, yaw=0.0)
    lift = 0.12 + 0.05 * pump
    pose.update(wing_fold("l", lift=lift))
    pose.update(wing_fold("r", lift=lift))
    return pose


def act_crouch(t):
    pose = gait(t, cycle=0.44, duty=0.65, lift=0.035, bob=0.01, roll=0.06, hip_drop=0.085, toe_curl=0.4)
    pose["body"]["q"] = R(AX, 0.14) @ pose["body"]["q"]
    tau = 2 * math.pi
    neck_pose(pose, 0.95, 0.4, -0.5, -0.4, head_pitch=0.12 + 0.03 * math.sin(2 * tau * t),
              yaw=0.1 * math.sin(tau * t))
    return pose


def act_honk(t):
    """One-shot: neck thrusts forward and up, the bill gapes, then settles (neck/head/jaw only differ from idle)."""
    pose = act_idle(0)
    e = math.sin(math.pi * min(t / 0.75, 1)) if t < 0.75 else 0.0
    gape = math.sin(math.pi * min(max((t - 0.12) / 0.5, 0), 1))
    neck_pose(pose, 0.32 * e, 0.18 * e, -0.1 * e, -0.15 * e, head_pitch=-0.45 * gape + 0.1 * e, jaw=0.62 * gape)
    return pose


def air_body(pose, t, beat):
    """Flying body: legs tucked back under the tail, neck stretched forward, slight bob with the beat."""
    pose["hips"] = dict(loc=Vector((0, 0, 0.015 * beat)))
    pose["body"] = dict(q=R(AX, -0.05 + 0.03 * beat))
    for sfx in ("l", "r"):
        pose[f"shin_{sfx}"] = dict(q=R(AX, 1.05))
        pose[f"tarsus_{sfx}"] = dict(q=R(AX, 0.35))
        pose[f"foot_{sfx}"] = dict(q=R(AX, 1.6))
    neck_pose(pose, 0.85, 0.25, -0.25, -0.35, head_pitch=0.25 - 0.05 * beat)
    pose["tail"] = dict(q=R(AX, -0.15))


def act_flap(t):
    tau = 2 * math.pi
    pose = {}
    c = math.cos(tau * t)
    for sfx in ("l", "r"):
        up = 0.3 + 0.95 * c
        hand = 0.35 * math.cos(tau * t - 1.0)
        tip = 0.3 * math.cos(tau * t - 1.7)
        upstroke = max(0, math.sin(tau * t))   # wings swept back and hand folded a bit on the way up
        pose.update(wing_open(sfx, up, hand, tip, sweep=0.12 * upstroke, hand_sweep=0.45 * upstroke))
    air_body(pose, t, -c)
    return pose


def act_glide(t):
    tau = 2 * math.pi
    pose = {}
    s = math.sin(tau * t)
    for sfx in ("l", "r"):
        pose.update(wing_open(sfx, 0.1 + 0.04 * s, 0.05 + 0.03 * math.sin(tau * t - 0.8),
                              -0.06 + 0.05 * math.sin(tau * t - 1.5), sweep=-0.05, hand_sweep=0.05))
    air_body(pose, t, 0.3 * s)
    return pose


def act_swim(t):
    tau = 2 * math.pi
    pose = base_pose()
    pose["hips"] = dict(loc=Vector((0, 0, 0.004 * math.sin(2 * tau * t))))
    pose["body"] = dict(q=R(AX, -0.06 + 0.02 * math.sin(tau * t)) @ R(AY, 0.03 * math.sin(tau * t)))
    for sfx, ph in (("l", 0.0), ("r", 0.5)):
        k = math.sin(tau * (t + ph))
        pose[f"shin_{sfx}"] = dict(q=R(AX, 0.85 + 0.3 * k))
        pose[f"tarsus_{sfx}"] = dict(q=R(AX, 0.55 + 0.3 * k))
        pose[f"foot_{sfx}"] = dict(q=R(AX, -0.2 + 0.6 * k))
    neck_pose(pose, -0.08, 0.06, 0.02, 0.0, head_pitch=0.02 * math.sin(tau * t), yaw=0.12 * math.sin(tau * t * 0.5))
    pose["tail"] = dict(q=R(AX, -0.12) @ R(AZ, 0.1 * math.sin(tau * t)))
    return pose


ACTIONS = {
    # name: (pose function of t in [0, 1], frames, loop)
    "idle": (act_idle, 48, True),
    "walk": (act_walk, 16, True),
    "run": (act_run, 12, True),
    "crouch": (act_crouch, 20, True),
    "honk": (act_honk, 16, False),
    "flap": (act_flap, 10, True),
    "glide": (act_glide, 48, True),
    "swim": (act_swim, 36, True),
}


def local_of(rig, name, spec):
    rest = rig.data.bones[name].matrix_local.to_quaternion()
    inv = rest.inverted()
    q = inv @ spec.get("q", Quaternion()) @ rest
    loc = inv @ spec.get("loc", Vector())
    s = spec.get("s", Vector((1, 1, 1)))
    M = rest.to_matrix()
    scl = Vector([sum(M[j][i] ** 2 * s[j] for j in range(3)) for i in range(3)])
    return q, loc, scl


def make_action(rig, name, fn, frames, loop):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    slot = act.slots.new(id_type="OBJECT", name="goose_rig")
    cb = act.layers.new("Layer").strips.new(type="KEYFRAME").channelbag(slot, ensure=True)
    curves = {}
    prev = {}
    for fr in range(frames + 1):
        t = fr / frames if loop else fr / frames
        pose = fn(t % 1.0 if loop else t)
        for b in rig.pose.bones:
            q, loc, scl = local_of(rig, b.name, pose.get(b.name, {}))
            if b.name in prev and prev[b.name].dot(q) < 0:
                q = -q
            prev[b.name] = q
            for path, vals in (("rotation_quaternion", q), ("location", loc), ("scale", scl)):
                for i, v in enumerate(vals):
                    key = (b.name, path, i)
                    if key not in curves:
                        curves[key] = cb.fcurves.new(f'pose.bones["{b.name}"].{path}', index=i)
                    curves[key].keyframe_points.insert(fr, v, options={"FAST"})
    for fc in curves.values():
        fc.update()
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, frames
    act.use_cyclic = loop
    return act


def build():
    body = build_body()
    up, jaw = build_bill()
    parts = [body, up, jaw]
    weight_body(body)
    weight_rigid(up, "head")
    weight_rigid(jaw, "jaw")
    for sx, sfx in ((1, "l"), (-1, "r")):
        leg = build_leg(sx)
        weight_leg(leg, sfx)
        foot = build_foot(sx)
        weight_rigid(foot, f"foot_{sfx}")
        wings = build_wing(sx)
        for w in wings:
            weight_span(w, sfx)
        parts += [leg, foot] + wings
    rig = build_rig()
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    mesh = body
    mesh.name = mesh.data.name = "goose"
    mesh.data.validate()
    mesh.parent = rig
    mod = mesh.modifiers.new("rig", "ARMATURE")
    mod.object = rig
    rig.animation_data_create()
    for name, (fn, frames, loop) in ACTIONS.items():
        act = make_action(rig, name, fn, frames, loop)
        tr = rig.animation_data.nla_tracks.new()
        tr.name = name
        st = tr.strips.new(name, 0, act)
        st.action_slot = act.slots[0]
        tr.mute = True
    rig.animation_data.action = None
    print(f"[goose] triangles: {sum(len(p.vertices) - 2 for p in mesh.data.polygons)}, bones: {len(rig.data.bones)}")
    return [rig, mesh]
