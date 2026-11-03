# Modelling guide: Blender 5.2 headless scripts to glTF for the goose game

Goal: models built by `blender -b -P script.py`, exported to GLB, loaded by
`src/render/models.ts` (GLTFLoader, then our own toon material with
`vertexColors = true`). Colours come only from `config/palette.json`, stored
in `COLOR_0`. The look should be flat, muted and softly lit, like Untitled Goose
Game (UGG), but the forms must read as properly modelled objects.

How things were checked (2026-11-03):

- **[V-local]**: I ran it on this machine with Blender 5.2.3 LTS
  (`/opt/homebrew/bin/blender`), three.js 0.187 (`node_modules/three`) and
  `@gltf-transform/cli` 4.5.1. I inspected the GLB output.
- **[V-doc]**: I read it in a primary doc.
- **[Unverified]**: an opinion, a forum claim or my own inference.

Test scripts used for this guide: skin-modifier goose, auto weights, actions,
export, facade and tree crown. They ran cleanly. The snippets below are
condensed from them.

---

## 0. Ten rules

1. **Silhouette first.** At our camera distance (roughly 8 to 25 m, looking
   down at about 45 degrees), the outline and the big value blocks are most of
   what anyone sees. Model the silhouette, then the large planes, then the
   chamfers. Never start with detail.
2. **Take proportions from reference, then simplify.** Measure real sizes:
   footprint, floor height, window grid, tree height and crown width. Then
   remove small parts. Don't change proportions to look "cute". UGG's levels
   are "generally pretty faithfully based on a real life place" (Game
   Developer, Road to the IGF).
3. **Every hard edge the camera can see gets a small bevel** (1 segment, 2 to
   5 cm on buildings, 0.5 to 1 cm on props) with hardened normals. A bevel
   catches a line of light, which is the main thing that separates "modelled"
   from "a box".
4. **One continuous skin for organic forms.** Don't build a goose or a person
   from overlapping spheres and cylinders. Make one mesh (skin modifier,
   metaball, or voxel remesh of a union), then decimate it.
5. **Choose shading per part.** Smooth shading on organic and rounded parts.
   Flat shading, or smooth with sharp edges, on architecture. Mixing the two on
   one object is normal (see section 1.4).
6. **Recess windows for real** (10 to 25 cm reveal). Painted-on glass
   rectangles are the strongest "blocky" giveaway on buildings.
7. **Colour by blocks, not noise.** Use 2 to 4 palette swatches per object,
   split along real material boundaries (brick, limestone band, glass, frame).
   Put colours on face corners so the boundaries stay sharp.
8. **Use a triangle budget per thing the camera sees.** Spend triangles on the
   silhouette and curvature. Don't spend them on flat walls.
9. **Write colours last.** The Remesh modifier deletes colour attributes
   [V-local]. Decimate and bevel interpolate them.
10. **Fix the export settings once** in a shared helper (section 6) and never
    change them per script.

---

## 1. What makes stylised low poly read as "proper"

### 1.1 Silhouette, proportion and shape language

- **Silhouette test.** Render the object in black against white, from the
  game camera's pitch, at the size it will appear on screen (often 60 to
  200 px tall). If the species, building or prop can't be recognised, fix the
  outline before anything else. 80.lv interviews say the same: start with the
  right silhouette and exaggerate only selected measurements (Emek Can Özben;
  "Creating visual interest in low poly artworks";
  https://80.lv/articles/creating-visual-interest-in-low-poly-artworks).
- **Shape language.** Round, soft shapes mean friendly (goose body, shrubs,
  people). Boxes mean stable (buildings). Points mean alert (spruce tips, a
  stretched goose neck). Keep each object to one main language with one
  accent.
- **Break perfect regularity on organic things only.** Add a few degrees of
  random lean, ±10 % scale, and lumpy crowns. Keep architecture straight; a
  campus is built from orthogonal concrete.
- **Simplify by removing, not by blurring.** Drop small things such as
  downpipes, small vents and individual bricks. Keep the things that carry
  identity at distance: window rhythm, the parapet line, entrance canopies,
  rooftop plant boxes, stair towers.

### 1.2 Bevels on hard edges (Bevel modifier) [V-local]

```python
bev = ob.modifiers.new("Bevel", 'BEVEL')
bev.width = 0.03                 # metres; buildings 0.02-0.05, props 0.005-0.01
bev.segments = 1                 # 1 = chamfer (cheap); 2-3 only for big rounded props
bev.limit_method = 'ANGLE'       # or 'WEIGHT' with edge bevel weights for control
bev.angle_limit = math.radians(50)
bev.harden_normals = True        # flat faces stay flat, the chamfer takes the gradient
bev.use_clamp_overlap = True     # stops bevels crossing on thin parts
bev.miter_outer = 'MITER_ARC'    # cleaner corners where 3+ beveled edges meet (optional)
```

- `harden_normals` writes custom normals. Before 4.1 this needed Auto Smooth.
  Since 4.1 Auto Smooth is gone: Blender picks vertex, face or corner normals
  itself and uses custom normals when they exist (4.1 release notes,
  https://developer.blender.org/docs/release_notes/4.1/modeling/).
- Other options verified on `BevelModifier` in 5.2: `affect`, `offset_type`,
  `profile_type`, `profile`, `face_strength_mode`, `vmesh_method`,
  `mark_sharp`, `vertex_group`.
- To apply in a script, either export with `export_apply=True`, or run
  `bpy.ops.object.modifier_apply(modifier="Bevel")` with the object active.

### 1.3 Weighted normals and custom split normals

- For chamfered low poly the standard technique is **face-weighted normals**:
  each vertex normal leans towards its largest adjacent face. Large faces then
  shade flat and the narrow chamfers take the curvature (Polycount wiki "Face
  weighted normals"; the site refused connections on the day I checked, so
  this is [Unverified] for today but long established).
- Modifier [V-local]:

  ```python
  wn = ob.modifiers.new("WN", 'WEIGHTED_NORMAL')
  wn.mode = 'FACE_AREA'      # or 'CORNER_ANGLE', 'FACE_AREA_WITH_ANGLE'
  wn.weight = 50
  wn.keep_sharp = True
  ```

  Put it after Bevel in the stack. If Bevel has `harden_normals=True` you
  usually don't need it.
- Direct API [V-local]: `mesh.normals_split_custom_set(list_of_loop_normals)`,
  `mesh.normals_split_custom_set_from_vertices(...)`,
  `mesh.set_sharp_from_angle(angle=...)`.
- The exporter writes custom normals as `NORMAL`. Every sharp edge or custom
  normal split duplicates vertices in glTF, so the vertex count rises a little
  (the Blender manual's glTF page says flat-shaded edges raise vertex counts).

### 1.4 Smooth vs flat per part [V-local]

```python
bpy.ops.object.shade_smooth()                                    # all smooth
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35), keep_sharp_edges=True)
bpy.ops.object.shade_auto_smooth(use_auto_smooth=True, angle=math.radians(35))  # adds the modifier
# no operator context needed:
mesh.polygons.foreach_set("use_smooth", flags)    # per face
mesh.set_sharp_from_angle(angle=math.radians(35))
```

- Goose body, neck, heads, bushes, tree crowns: smooth.
- Trunks: smooth with sharp-by-angle.
- Buildings and benches: flat faces with beveled edges and hardened normals.
- Toon ramps exaggerate faceting, so on a toon material an organic
  20-triangle sphere looks worse than on PBR. Organic parts need more
  segments than you'd expect, or a smoother ramp.

### 1.5 Subdivide, then decimate (the cheap "sculpted" look)

1. Build a coarse control shape (skin modifier, metaball, a box cage).
2. Add Subdivision Surface level 2 for a smooth, continuous surface.
3. Apply it.
4. Decimate (`'COLLAPSE'`, `ratio` 0.2 to 0.5, `use_collapse_triangulate=True`,
   `use_symmetry=True, symmetry_axis='X'` for bilateral creatures).

Collapse decimation keeps the silhouette and puts triangles where curvature
is. It looks "hand-modelled low poly" rather than a primitive.
`'DISSOLVE'` (planar, `angle_limit`) is the right tool for architecture:
it merges coplanar faces without changing the shape. [V-local:
`decimate_type` items are COLLAPSE, UNSUBDIV, DISSOLVE.]

### 1.6 Edge flow

Only important for parts that deform: the goose neck, wing roots, people's
shoulders, hips and knees. Rules:

- Use loops around the deforming axis.
- Put at least 3 loops across each joint.
- Avoid poles on the bend.

Skin modifier output already has ring loops along each edge. Decimating
destroys loops, so on rigged meshes decimate lightly (ratio ≥ 0.5) or use
`'UNSUBDIV'`. Static props don't need edge flow.

### 1.7 No intersecting primitives (one surface per organic form)

Ways to merge overlapping shapes into one clean skin, all [V-local] headless:

| Method | Call | Notes |
|---|---|---|
| Skin modifier | `ob.modifiers.new("Skin",'SKIN')`, radii via `me.skin_vertices[0].data[i].radius = (rx, ry)` | Best for necks, limbs, trunks, branches. Props: `branch_smoothing`, `use_smooth_shade`, `use_x_symmetry`. |
| Metaballs to mesh | `mb = bpy.data.metaballs.new(); e = mb.elements.new(); e.co, e.radius`; `bpy.ops.object.convert(target='MESH')` or `bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph))` | Blobby bodies and crowns. `mb.resolution` 0.05 to 0.1. |
| Voxel remesh | modifier `REMESH`, `mode='VOXEL'`, `voxel_size=0.02-0.05`; or `bpy.ops.object.voxel_remesh()` using `mesh.remesh_voxel_size` | Unions anything. **Drops colour attributes** (the modifier has no preserve option; the operator has `mesh.use_remesh_preserve_attributes`). Always decimate afterwards. |
| Boolean union | modifier `BOOLEAN`, `operation='UNION'`, `solver='EXACT'` | Good for hard surface (a building wing joined to a tower). Clean up afterwards with `bmesh.ops.dissolve_limit`. |
| Convex hull | `bmesh.ops.convex_hull(bm, input=verts)` | Tree crowns and rocks from clustered spheres (used in section 5). |

### 1.8 Architectural chamfers at camera scale

At 15 m with a roughly 50 degree FOV, 1 px is about 1.5 to 3 cm. Detail
smaller than about 5 cm disappears, and detail of 10 to 30 cm reads clearly.

| Element | Real size to model | How |
|---|---|---|
| Window reveal (depth) | 0.12 to 0.25 m | inset face, translate along `-normal` |
| Window frame or mullion width | 0.06 to 0.12 m (exaggerate to 0.1 to 0.15) | inset thickness, or `bmesh.ops.subdivide_edges` on the glass face, then a thin inset |
| Sill | protrudes 0.05 to 0.08 m, 0.06 to 0.1 m tall | extrude the bottom strip of the reveal outwards, or add a thin box |
| Floor band or string course | 0.2 to 0.4 m tall, proud 0.03 to 0.05 m | cut a loop with `bisect_plane`, extrude the band faces outwards |
| Parapet coping | overhang 0.05 m, 0.1 m thick | inset the roof face 0.3 m, extrude the ring up 0.6 to 1 m, bevel the top |
| Canopy | 0.15 to 0.3 m slab, cantilever 1.5 to 3 m | a separate beveled slab; slim posts |
| Glass curtain wall | mullion grid every 1.2 to 1.5 m | grid-split the face, `inset_individual` thickness 0.04, push in 0.05 |

---

## 2. Untitled Goose Game specifically

Primary documentation on UGG's shading is thin. House House has given no
technical art talk that I could find. What can be sourced:

- **Tools.** "The game engine is Unity", and "We used Blender for all the
  modeling and animation" (Road to the IGF, Game Developer, 2020,
  https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-).
  Kalonica Quigley did additional art and animation.
- **Style.** "Low poly meshes, flat colours, and untextured 3D models",
  continuing *Push Me Pull You*'s flat-colour 2D (GamesTM No. 206, cited by
  Wikipedia, https://en.wikipedia.org/wiki/Untitled_Goose_Game). The
  "storybook" feeling comes from UK children's TV (Michael McMaster to
  Nintendo Life, 2019, via Wikipedia).
- **Real places.** Jake Strasser scouted real English villages on Google
  Street View and built the levels from them ("Google Maps, Not Greyboxes",
  GDC, https://gdcvault.com/play/1027183/). Our approach of real campus
  footprints with simplified forms is the same idea.
- **Goose design.** A "platonic goose": "White and orange, frowning mouth,
  honking noise". Early verbs were "honk, flap, crane its neck". A simple IK
  makes the goose and the groundskeeper turn their heads to look at each
  other, which "injected so much humanity" (VICE interview,
  https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/).
  The villagers started out as "dozens of little faceless people".
- **No outlines.** Reviewers note "not a single black line" around people and
  objects (WayTooManyGames review,
  https://waytoomany.games/2019/10/05/review-untitled-goose-game/).
- **Shading.** [Unverified] Polycount forum guesses
  (https://polycount.com/discussion/220550/untitled-goose-game-rendering):
  "just flat colors and very low opacity shadows", an emissive-ish or flat
  ambient look, and soft contact darkening under characters that may be SSAO.
  None of this is confirmed by the developers.
- **My own observations** [Unverified, from screenshots, not a source]:
  - Forms are rounded and heavily simplified, but proportions are realistic.
    The villagers have real body proportions with simple heads, not chibi.
  - Buildings keep real details (sash windows, sills, gutters, fence
    pickets) as actual geometry in a few colours.
  - Shadows are soft and low contrast and tinted, never black.
  - Colour is blocked by material, with very little gradient inside a block.

**Takeaways for us.** Real proportions plus geometric detail at the right
scale give the "proper" read. Flat palette colour, low-contrast soft shadows
and no outlines give the UGG feel. A shader can't rescue a primitive-looking
mesh: in UGG the quality is in the modelling. See also
`docs/plan/03-untitled-goose-game-deep-dive.md`.

---

## 3. Creatures and characters in Blender via Python

### 3.1 Goose body and neck (skin modifier) [V-local]

```python
import bpy, math
pts   = [(0,-.35,.35),(0,-.1,.42),(0,.15,.42),(0,.3,.5),(0,.36,.7),(0,.38,.85),(0,.45,.9)]  # tail→head, +Y forward
radii = [.06, .17, .19, .10, .05, .045, .05]
me = bpy.data.meshes.new("goose"); me.from_pydata(pts, [(i,i+1) for i in range(len(pts)-1)], [])
ob = bpy.data.objects.new("Goose", me); bpy.context.scene.collection.objects.link(ob)
skin = ob.modifiers.new("Skin", 'SKIN'); skin.use_smooth_shade = True
for v, r in zip(me.skin_vertices[0].data, radii): v.radius = (r, r*0.85)   # (x, y) ellipse
me.skin_vertices[0].data[0].use_root = True
ob.modifiers.new("Sub", 'SUBSURF').levels = 2
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)  # 608 quads here
dec = ob.modifiers.new("Dec", 'DECIMATE'); dec.ratio = 0.5; dec.use_symmetry = True; dec.symmetry_axis = 'X'
bpy.ops.object.modifier_apply(modifier="Dec")                                 # ~600 tris
```

- Shape the body further in bmesh after applying: squash the belly with a
  smooth falloff, lift the tail.
- Model the beak, feet and eyes as separate small meshes parented to bones
  (rigid parts need no skinning). The beak's sharp base line is a colour
  boundary.
- `bpy.ops.object.skin_armature_create(modifier="Skin")` works headless
  [V-local]. It makes one bone per skin edge, which is usually too many for a
  goose. If you delete that armature, its vertex groups stay on the mesh.
  Remove them: `ob.vertex_groups.clear()`.
- Alternatives:
  - A curve with `bevel_depth` plus a taper curve for the neck, converted with
    `bpy.ops.object.convert(target='MESH')`.
  - Metaballs for the body (section 1.7).
  - Union the neck and body with a voxel remesh (0.02 m), then decimate.
- Budget: goose 1.5k to 3k triangles. It is the hero and fills the screen.
  NPC people 1.5k to 2.5k triangles.

### 3.2 People

Use the same recipe with a skin modifier graph that branches: pelvis, then
spine, neck and head; pelvis, then legs; chest, then arms. The skin modifier
handles branches (`branch_smoothing` 0.5 to 1).

- Proportions: about 7 heads tall, with simplified hands (mitten shapes) and
  feet.
- Clothes as colour blocks on corners: shirt, trousers, shoes, skin, hair.
- Hair and backpacks are separate rigid meshes on the head and chest bones.

### 3.3 Armature and automatic weights headless [V-local]

```python
arm = bpy.data.armatures.new("Rig"); rig = bpy.data.objects.new("Rig", arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
prev = None
for name, h, t in [("root",(0,-.35,.4),(0,.25,.45)), ("neck1",(0,.25,.45),(0,.36,.68)),
                   ("neck2",(0,.36,.68),(0,.38,.85)), ("head",(0,.38,.85),(0,.5,.9))]:
    b = arm.edit_bones.new(name); b.head, b.tail = h, t
    if prev: b.parent, b.use_connect = prev, True
    prev = b
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')   # → {'FINISHED'} in background mode (5.2.3)
```

- **Answer to the headless question: yes.** `parent_set(type='ARMATURE_AUTO')`
  (bone heat) works in `-b` mode. It created one vertex group per bone with
  sensible counts. Other verified types are `ARMATURE_ENVELOPE`,
  `ARMATURE_NAME` (empty groups) and `ARMATURE`.
- Bone heat can fail with "Bone Heat Weighting: failed to find solution for
  one or more bones" when the mesh is non-manifold or has overlapping shells
  [Unverified: known behaviour, not reproduced here]. Remesh into one shell first, or
  fall back to `ARMATURE_ENVELOPE`, or write weights yourself
  (`vg = ob.vertex_groups.new(name="neck1"); vg.add([idx], w, 'REPLACE')`).
  Writing weights yourself is deterministic and often better for a simple
  chain.
- Call `me.validate()` before export. The exporter warned "Mesh is not valid"
  on the skin-modifier mesh. The export was still fine.
- Wing and leg bones: add `wing.L/R` (parent root) and
  `thigh.L → shin.L → foot.L`. Keep fewer than 25 bones. The exporter keeps
  4 influences (`export_influence_nb=4`).

### 3.4 Actions and keyframes in Blender 5.x [V-local]

Blender 5 uses **slotted, layered actions**. `Action.fcurves` no longer exists
(`hasattr(action, 'fcurves') == False` in 5.2). There are two ways to make
actions.

```python
# (a) keyframe_insert on pose bones: creates action + slot + layer + strip automatically
pb = rig.pose.bones["neck1"]; pb.rotation_mode = 'XYZ'
for f, deg in [(1, 0), (6, 30), (10, -10), (16, 0)]:
    pb.rotation_euler = (math.radians(deg), 0, 0); pb.keyframe_insert("rotation_euler", frame=f)
honk = rig.animation_data.action; honk.name = "honk"

# (b) build explicitly (faster for many keys, no scene frame changes)
walk = bpy.data.actions.new("walk")
slot = walk.slots.new(id_type='OBJECT', name="Rig")
cb = walk.layers.new("Layer").strips.new(type='KEYFRAME').channelbag(slot, ensure=True)
fc = cb.fcurves.new('pose.bones["root"].location', index=2)
for f, v in [(1,0),(7,.03),(13,0),(19,.03),(25,0)]: fc.keyframe_points.insert(f, v)
walk.use_frame_range = True; walk.frame_start, walk.frame_end = 1, 25; walk.use_cyclic = True
# helper also exists: bpy_extras.anim_utils.action_ensure_channelbag_for_slot(action, slot)
```

- **Keep every action for export.** Stash each action on an NLA track (the
  "Actions" export mode exports an action "if it is the active action on an
  object, or it is stashed to an NLA track", Blender manual glTF page). Set
  `use_fake_user=True` as well.

  ```python
  rig.animation_data.action = None
  for a in (honk, walk):
      tr = rig.animation_data.nla_tracks.new(); tr.name = a.name
      st = tr.strips.new(a.name, 1, a); st.action_slot = a.slots[0]; tr.mute = True
  ```

  Verified: both actions exported as separate glTF animations "honk" and
  "walk".
- **Make loops seamless.** First key equals last key. Don't duplicate the end
  frame in playback. Use `LoopRepeat` in three.js. The exporter samples every
  frame by default (`export_force_sampling=True`), so FCurve modifiers such as
  Cycles or Noise are baked into the action's frame range.
- Suggested cycles at 24 fps (author at 24, three.js plays by seconds):

  | Clip | Frames | Notes |
  |---|---|---|
  | `idle` | 48 | |
  | `walk` | 24 | body bob ×2, neck counter-sway, feet alternate |
  | `run` | 16 | body pitched forward, wings slightly out |
  | `flap` | 12 | wing roll ±70 degrees, tail lift |
  | `honk` | 16 | neck forward and up, beak open, one-shot |
  | `grab` | 12 | |
  | `neck_stretch` | 12 | |

- Additive layering, such as honking while walking, is easiest in three.js:
  `THREE.AnimationUtils.makeClipAdditive` on an upper-body clip.

### 3.5 Export options for animation (names verified against the 5.2 operator) [V-local]

Defaults dumped from `bpy.ops.export_scene.gltf.get_rna_type()` in 5.2.3:

- `export_animations=True`
- `export_animation_mode='ACTIONS'` (also `ACTIVE_ACTIONS`, `BROADCAST`,
  `NLA_TRACKS`, `SCENE`)
- `export_nla_strips=True`
- `export_merge_animation='ACTION'` (also `NLA_TRACK`, `NONE`)
- `export_skins=True`
- `export_influence_nb=4`
- `export_def_bones=False`
- `export_leaf_bone=False`
- `export_force_sampling=True`
- `export_frame_step=1`
- `export_optimize_animation_size=True`
- `export_anim_slide_to_zero=False`
- `export_reset_pose_bones=True`
- `export_rest_position_armature=True`
- `export_morph=True`
- `export_morph_animation=True`
- `export_apply=False`
- `export_yup=True`

Recommended for characters: `export_def_bones=True` (drops non-deform helper
bones) and `export_anim_slide_to_zero=True`. Output channels: one TRS set per
bone (12 channels for 4 bones) even for bones without keys, because
`export_optimize_animation_keep_anim_armature=True`.

**Pitfall:** `export_loglevel` is listed as an operator property, but passing
it raised `KeyError: 'loglevel'` in 5.2.3. Don't pass it.

### 3.6 Playing in three.js

```ts
import { clone as skClone } from "three/addons/utils/SkeletonUtils.js";
const gltf = await loadModel("goose");
const goose = skClone(gltf.scene);              // plain .clone() breaks SkinnedMesh bindings
applyMaterial(goose, toonMat);                  // node materials handle skinning in WebGPU
const mixer = new THREE.AnimationMixer(goose);
const clip = (n: string) => THREE.AnimationClip.findByName(gltf.animations, n);
const walk = mixer.clipAction(clip("walk")).play();
const honk = mixer.clipAction(clip("honk")); honk.setLoop(THREE.LoopOnce, 1); honk.clampWhenFinished = true;
// blend: walk.crossFadeTo(mixer.clipAction(clip("run")), 0.2, false); speed: walk.timeScale = v / walkSpeed
// each frame: mixer.update(dt)
```

- Share one material across all instances.
- Animate procedural extras (head look-at IK, as UGG does) after
  `mixer.update`, by rotating the `head` bone directly.

---

## 4. Architecture in Blender via Python

### 4.1 Footprint polygon to a building with real recessed windows [V-local]

The approach: build each wall as a grid of quads (bays × floors) so the
topology is clean and every window cell is its own face. Then run
`inset_individual` and push the inner face in. This tested at 858 triangles
for a 24 × 12 m, 3-storey block with 8 × 4 bays, a parapet, and bevels.

```python
import bpy, bmesh, math
from mathutils import Vector
def facade_building(name, footprint, floor_h=3.5, floors=3, bay=3.0, frame=0.45, reveal=0.18, parapet=0.6):
    bm = bmesh.new(); H = floor_h*floors; n = len(footprint); win = []
    for i in range(n):                                   # footprint CCW, metres, local origin
        a = Vector((*footprint[i], 0)); b = Vector((*footprint[(i+1) % n], 0))
        L = (b-a).length; t = (b-a)/L; nb = max(1, round(L/bay))
        zs = [f*floor_h for f in range(floors+1)] + [H+parapet]
        cols = [[bm.verts.new(a + t*(L*k/nb) + Vector((0,0,z))) for z in zs] for k in range(nb+1)]
        for k in range(nb):
            for f in range(floors+1):
                q = bm.faces.new((cols[k][f], cols[k+1][f], cols[k+1][f+1], cols[k][f+1]))
                if f < floors and not (f == 0 and k == nb//2): win.append(q)   # door bay
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)        # weld wall corners
    # roof: a face over the top ring (for convex/simple footprints sort by angle; else use the footprint order)
    ...
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    win = [f for f in win if f.is_valid]
    bmesh.ops.inset_individual(bm, faces=win, thickness=frame, use_even_offset=True)
    for f in win:
        bmesh.ops.translate(bm, vec=-f.normal*reveal, verts=f.verts)
        f.material_index = 1                              # tag for colouring (glass)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ...
```

Details to add with the same ops:

- **Mullions.** On each recessed glass face, `bmesh.ops.subdivide_edges` on
  its horizontal edges (`cuts=1` or `2`) for vertical splits. Then
  `inset_individual(thickness=0.05)` on the new faces and push them in by
  0.04. That leaves the mullion grid at the reveal depth.
- **Sills.** After the reveal, select the bottom edge loop of the window
  opening and `extrude_edge_only`, or add a 0.08 m box. Translate it 0.06 m
  outwards.
- **Bands and string courses.** Make the band its own row in `zs` (for
  example `[0, 3.2, 3.5, 6.7, 7.0, ...]`). The band row faces are then
  `extrude_face_region` and moved 0.04 m out along the normal. Colour them
  `limestone` or `concrete`.
- **Ribbon windows** (common at Waterloo: Math & Computer, Davis Centre
  brutalism). Make one face per floor per wall instead of per bay, inset it,
  push it in, then split mullions.
- **Entrances.** Make the door bay deeper (0.6 to 1.2 m) and taller. Add a
  canopy slab (a beveled box, 0.25 m thick, 2 m cantilever) and 2 posts.
- **Parapet and coping.** The extra `H+parapet` row gives the parapet wall.
  For the coping and the roof drop: inset the roof face by 0.25 m, translate
  the inner face down by `parapet - 0.1`, then bevel the parapet top edges.
- **Colour.** Write a `BYTE_COLOR` / `CORNER` attribute from `material_index`
  (or a custom int attribute) via `color_srgb` (section 6). Delete material
  slots before export, or keep one dummy.

**Bevel last.** Add the Bevel modifier (section 1.2) with
`limit_method='ANGLE'` so every 90-degree reveal edge gets a 2 to 3 cm
chamfer, and export with `export_apply=True`.

### 4.2 Geometry nodes vs bmesh

| | bmesh (recommended here) | Geometry nodes |
|---|---|---|
| Authoring from Python | direct, readable, debuggable in plain Python | node trees built by `node_group.nodes.new(...)` and links: verbose, fragile across versions |
| Per-building data (footprints, heights from `data/`) | trivial | needs attributes or one modifier per building |
| Window grids, insets | `inset_individual`, `extrude_face_region`, `bisect_plane` | Extrude Mesh (individual), Scale Elements |
| Scattering and instancing (trees, lamp posts) | manual | strong (Instance on Points). Export with `export_gn_mesh=True` and `export_gpu_instances=True` |
| Determinism and diffs | plain code | node trees are opaque in diffs |

Use bmesh for buildings and props. Consider geometry nodes only for scatter
previews. Do scatter at runtime in three.js with `InstancedMesh` instead, so
the GLB holds one tree per species variant.

### 4.3 Triangle budgets and LODs

Suggested budgets (WebGPU, mid laptop, around 150 buildings and 600 trees on
campus):

| Thing | LOD0 | LOD1 (> about 60 m) | LOD2 (> about 150 m) |
|---|---|---|---|
| Typical building | 1k to 4k | 300 to 800 (no reveals: glass faces flush, colour only) | box plus roof, < 100 |
| Hero building (DC, MC, SLC) | 4k to 10k | 1k to 2k | < 200 |
| Tree | 300 to 800 | 80 to 200 | impostor or 12-triangle hull |
| Bench, bin, lamp | 100 to 400 | instanced, no LOD needed | |
| Goose | 1.5k to 3k | | |
| Person | 1.5k to 2.5k | | |

- **Making LOD1.** Don't use collapse-decimate on architecture: it eats
  reveals unevenly. Regenerate with `reveal=0` and no bevel, then
  `dissolve_limit(angle_limit=radians(1))`. That is deterministic and clean.
- **Organic LODs.** Use `DECIMATE` collapse `ratio=0.3`, or
  `gltf-transform simplify --ratio 0.3 --error 0.01`.
- **Naming.** Export LODs as `NAME_LOD0`, `NAME_LOD1` in one GLB and build a
  `THREE.LOD` at load time.

---

## 5. Vegetation

The principle: the crown is a few **clusters** (3 to 7 lumps), not one ball
and not many leaves. The trunk carries 2 to 4 visible main limbs into the
clusters. Smooth shading, two canopy swatches (`tree_canopy`,
`tree_canopy_light`) blocked per cluster, or a light top and dark bottom by
normal.z.

Crown recipe [V-local, 54 triangles after `ratio=0.35`; use ratio 0.5 to 0.7
for 100 to 250 triangles]:

```python
rnd = random.Random(seed); bm = bmesh.new()
for i in range(lobes):
    r = radius*rnd.uniform(.55, .8)
    off = Vector((rnd.uniform(-1,1), rnd.uniform(-1,1), rnd.uniform(-.3,.6))).normalized()*radius*.45
    s = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r); bmesh.ops.translate(bm, vec=off, verts=s['verts'])
hull = bmesh.ops.convex_hull(bm, input=bm.verts[:])
bmesh.ops.delete(bm, geom=list(set(hull['geom_interior']) | set(hull['geom_unused'])), context='VERTS')
for v in bm.verts:                      # flatten underside, add lumps
    if v.co.z < 0: v.co.z *= .8
    v.co += v.normal * mathutils.noise.noise(v.co*1.7) * radius*.12
```

The convex hull loses concavities between lobes, so the crown can look like
a potato. For a more clustered read, use metaballs (one element per lobe,
`resolution` 0.15 to 0.25), convert to mesh, then decimate. Or keep 2 or 3
separate hulls that overlap slightly. Overlap is acceptable for foliage
because the toon shading hides the seam.

Species silhouettes (the outline is the identity; keep each recognisable in
black):

| Species | Silhouette | Construction |
|---|---|---|
| Sugar or Norway maple | broad oval to round, dense, 60 to 70 % of height is crown | 5 to 7 metaball lobes, squashed bottom, 3 to 4 skin-modifier limbs |
| White spruce | narrow cone, slightly drooping tiers, pointed tip | 4 to 6 stacked cones (`create_cone`, cap_ends) with jittered radii, each tier's base wider and pulled down at the rim; `conifer` swatch |
| White or red pine | irregular, flat-topped, wind-swept tufts on a long bare trunk | 3 to 5 flattened ellipsoid tufts off asymmetric skin-modifier branches |
| Honey locust | open, airy, vase-shaped, light canopy, see-through | trunk forks low into 3 to 5 limbs; small separate flattened lobes with gaps; lighter swatch |
| Weeping willow | rounded dome with curtains to the ground | dome lobe plus 8 to 14 tapered "curtain" strips (skin modifier or a cylinder with taper) hanging from the rim |
| Hedge or bush | rounded box (hedge), lumpy mound (shrub) | bevelled box with segments 3 then noise displacement; metaball mound |

Trunks: a skin modifier on a small branching graph (trunk, then 2 to 4
limbs), `branch_smoothing=1`, radius tapering 0.25 to 0.05 m, 6-sided cross
section (Subsurf level 0 or 1). 60 to 150 triangles.

Variation and instancing:

- Generate 3 to 4 variants per species (different `seed`) into one GLB:
  `maple_a`, `maple_b`, and so on.
- At runtime use one `InstancedMesh` per variant mesh, with per-instance
  random Y rotation, ±15 % scale and slight lean. Optionally add
  `instanceColor` within the palette pair, or use a shader-side hue jitter
  for slight green variation.
- Build trunk and crown as two primitives of one mesh, so each variant has
  two draw-call groups.
- Bake soft "AO" into the vertex colour: darken the crown underside, using
  palette swatches only, for example `tree_canopy` below and
  `tree_canopy_light` above.

Sapling Tree Gen exists (extension, GPL; outputs are yours). It aims at
realistic branching, not few-lobe stylised crowns, so I don't recommend it as
the main tool.

---

## 6. glTF export and web optimisation

### 6.1 Vertex colour colour space [V-local + V-doc]

- **glTF `COLOR_0` is linear.** Blender's exporter writes linear values. A
  `BYTE_COLOR` corner attribute set with `color_srgb = (0.902, 0.902, 0.851)`
  reads back as `.color = (0.791, 0.791, 0.694)` (linear). It exported as
  normalised `UNSIGNED_SHORT` VEC4 with value 51858/65535 = 0.791, which is
  linear.
- `FLOAT_COLOR` attributes also exported as normalised `u16`. Both data types
  give linear `COLOR_0`. Prefer `BYTE_COLOR` + `CORNER` (sharp colour borders,
  smaller in Blender).
- three.js `GLTFLoader` maps `COLOR_0` to `color`, keeps the `normalized`
  flag, and does no colour conversion (`GLTFLoader.js` line 2338 map, 0.187).
  With `vertexColors=true` the toon material multiplies linear vertex colour
  in the linear working space, and the renderer outputs sRGB. So: **write
  palette hex via `color_srgb` in Blender and the screen shows the hex**
  (before lighting).
- Mistake to avoid: writing `hex/255` into `.color` (the linear setter). The
  colours come out washed out and too light.
- Helper:

  ```python
  def hex_srgb(h): return tuple(int(h[i:i+2], 16)/255 for i in (1,3,5)) + (1.0,)
  col = me.color_attributes.new("Color", 'BYTE_COLOR', 'CORNER')   # domain CORNER = per-face colour
  me.color_attributes.active_color = col
  for p in me.polygons:
      c = hex_srgb(PALETTE[part_of(p)])
      for li in p.loop_indices: col.data[li].color_srgb = c
  ```

- **Exporter selection** [V-local]:
  - `export_vertex_color` items are `MATERIAL` (default), `ACTIVE`, `NAME`,
    `NONE`.
  - With no material, `MATERIAL` still exports the active attribute
    (`export_active_vertex_color_when_no_material=True`).
  - A material without a Color Attribute node exported **both** `COLOR_0` and
    `COLOR_1` under `MATERIAL`.
  - Use `export_vertex_color='ACTIVE', export_all_vertex_colors=False` for
    one deterministic `COLOR_0`.
  - The older names `export_colors` and `export_attributes` are different
    things: `export_attributes=False` controls custom `_ATTR` attributes.
- **Quantisation.** `gltf-transform meshopt` and `optimize` quantise
  `COLOR_0` to `u8_norm` by default. In linear 8-bit, our darkest swatch
  (goose `tail` `#2f2c29`) round-trips to `#2e2a2a`, at most 2/255 error.
  Invisible, but it breaks exact palette checks. Pass
  `--quantize-color 12` (gives `u16_norm`) if verification compares exact
  hex.

### 6.2 One shared export call [V-local names]

```python
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB',
    use_selection=False, export_apply=True,          # bake Bevel/WeightedNormal/Decimate
    export_yup=True, export_normals=True, export_texcoords=False, export_tangents=False,
    export_materials='NONE',                         # game assigns its own toon material
    export_vertex_color='ACTIVE', export_all_vertex_colors=False,
    export_attributes=False, export_extras=True,     # extras: custom props → userData (e.g. collision tags)
    export_cameras=False, export_lights=False,
    export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
    export_def_bones=True, export_anim_slide_to_zero=True,
    export_gpu_instances=False,                      # instance in three.js instead
    export_draco_mesh_compression_enable=False,      # compress with gltf-transform afterwards
)
```

- `export_materials='NONE'` (and `'PLACEHOLDER'`) still writes `COLOR_0`
  and leaves no `materials` array [V-local]. `models.ts` assigns its own
  material anyway.
- The exporter can also do meshopt or Draco itself
  (`export_meshopt_compression_enable`, `export_draco_mesh_compression_*`;
  both libraries shipped in 5.2). One gltf-transform step after export is
  easier to control.

### 6.3 gltf-transform steps (CLI 4.5.1, flags from `-h`) [V-local]

```sh
npx gltf-transform dedup  in.glb  a.glb                   # --accessors --meshes --materials --skins --textures
npx gltf-transform weld   a.glb   b.glb                   # merges equal vertices (needed before simplify)
npx gltf-transform simplify b.glb c.glb --ratio 0.5 --error 0.001   # organic LODs only; --lock-border
npx gltf-transform meshopt c.glb out.glb --level high --quantize-color 12
npx gltf-transform inspect out.glb                        # check COLOR_0, tri counts, animations
npx gltf-transform validate out.glb
```

- `optimize` does everything in one command, but its defaults matter:
  `--compress meshopt`, `--flatten true`, `--join true`, `--instance true`,
  `--palette true`, `--simplify true` with `--simplify-error 0.0001`,
  `--weld true`, `--resample true`, `--prune true`.
- `--join` and `--flatten` merge named meshes and nodes. That breaks
  `getObjectByName("door")`, hit-test parts and LOD naming. `optimize` does
  **not** accept `--quantize-color` (it errors) [V-local]. A verified
  two-step that keeps names and exact colours:
  `optimize in.glb t.glb --join false --flatten false --compress false --simplify false`,
  then `meshopt t.glb out.glb --quantize-color 12`. This gave `COLOR_0:u16_norm`
  and kept both animations. Or use the explicit chain above.
- On the goose test, `optimize` kept skin, both animations and `COLOR_0`
  (27.7 KB to 13.1 KB).
- **Loader change required.** Meshopt output needs
  `loader.setMeshoptDecoder(MeshoptDecoder)`
  (`three/addons/libs/meshopt_decoder.module.js`). Draco needs `DRACOLoader`
  and a wasm decoder. `src/render/models.ts` currently sets neither.
- Prefer meshopt over Draco here. It's smaller to decode, it compresses
  animation too, and there's no wasm path setup.

### 6.4 Naming conventions

- One GLB per asset family: `public/models/<family>.glb`.
- Inside it, node names in `snake_case` with semantic suffixes:
  - `goose` (SkinnedMesh) and `goose_rig`
  - `bench_a_LOD0` / `bench_a_LOD1`
  - `maple_a_trunk` / `maple_a_crown`
  - `col_*` for collision proxies (hidden, `extras.collider=true`)
- Animation names: lowercase verbs (`walk`, `run`, `flap`, `honk`, `idle`).
- Origins: buildings at footprint centroid on the ground. Props at the base
  centre. Characters at the feet, facing +Y in Blender, which is −Z in glTF
  after Y-up conversion. Pick one convention and assert it in a test.
- Units are metres. Apply transforms (`bpy.ops.object.transform_apply`) before
  export so scale is 1.

---

## 7. Tools, add-ons and skills (licence-safe for a public web game)

| Tool | What for | Licence | Verdict |
|---|---|---|---|
| Blender 5.2 + bundled glTF exporter | everything here | GPL. Output files are not GPL. | core |
| glTF Transform CLI (`@gltf-transform/cli`) | dedup, weld, simplify, meshopt, inspect, validate | MIT | adopt |
| meshoptimizer / gltfpack (also exposed in the Blender exporter as `export_use_gltfpack*`) | compression and simplification | MIT | adopt (via gltf-transform) |
| Khronos glTF Validator | CI check on every GLB | Apache-2.0 | adopt (`gltf-transform validate` uses it) |
| three.js `SkeletonUtils`, `MeshoptDecoder` | runtime | MIT | adopt |
| Sapling Tree Gen (extensions.blender.org) | realistic tree skeletons | GPL-2.0+/3.0+ by version; generated meshes are yours | optional, not the stylised path |
| Kenney (kenney.nl), Quaternius, Poly Pizza CC0 items | reference only, or placeholder props | CC0 (check each item on Poly Pizza; some are CC-BY) | fine; must be recoloured to the palette |
| Poly Haven | reference HDRIs and models | CC0 | fine for reference |
| blender-mcp (ahujasid) | live agent control of a GUI Blender | MIT. Its optional telemetry grants the maintainer rights to prompts and scene data, so disable it. | not needed for headless scripts |
| Community "Blender agent skills" (EL4CTEO/blender-skills, and others) | prompt packs for bpy | reported MIT, code not reviewed [Unverified] | read for ideas; don't vendor without review |
| **BlenderKit** | asset library | "Royalty Free" assets: games are allowed only if assets "shouldn't be directly extractable", and no reselling. A GLB on a public website **is directly extractable**. | **avoid** RF assets. CC0-tagged BlenderKit assets are fine. |
| Sketchfab downloads | reference | per-model CC licences, often CC-BY or NC | avoid NC. Record BY in `THIRD_PARTY.md`. |

Anything third-party that ships must be listed in `THIRD_PARTY.md`.
Generating everything from our own scripts avoids the question.

---

## 8. Checklist per model script

- [ ] Real dimensions from reference recorded at the top of the script.
- [ ] Silhouette check: render (Workbench, flat, black) from the game camera
      pitch at in-game pixel size. Workbench render works headless.
- [ ] One continuous skin for organic parts. `me.validate()` returns clean.
- [ ] Bevel with harden normals on hard edges; smooth shading on organic
      parts.
- [ ] Colours written last, via `color_srgb`, from palette keys only. Assert
      that every corner colour is a palette swatch.
- [ ] Triangle count within the section 4.3 budget. Print it from the
      evaluated mesh:
      `sum(len(p.vertices)-2 for p in ob.evaluated_get(dg).to_mesh().polygons)`.
- [ ] Shared export helper (6.2), then gltf-transform (6.3), then
      `inspect` + `validate` in CI.
- [ ] For rigs: deform bones only, actions stashed on NLA, loops seamless,
      names lowercase.

---

## Sources

- Blender 5.2 manual, glTF 2.0 add-on: https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html
  (animation modes, Use Vertex Color, GPU instances, Apply Modifiers)
- Blender 4.1 modelling release notes (Auto Smooth removal, Smooth by Angle):
  https://developer.blender.org/docs/release_notes/4.1/modeling/
- Blender Bevel modifier manual: https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/bevel.html
- Local verification: operator and RNA property dumps and test exports with
  Blender 5.2.3; `node_modules/three/examples/jsm/loaders/GLTFLoader.js`
  (r187); `gltf-transform <cmd> -h` (4.5.1).
- UGG: Road to the IGF (Game Developer):
  https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i- ;
  Behind the HONK Q&A: https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a ;
  VICE interview: https://www.vice.com/en/article/honks-vs-quacks-a-long-chat-with-the-developers-of-untitled-goose-game/ ;
  Wikipedia (GamesTM 206, Nintendo Life): https://en.wikipedia.org/wiki/Untitled_Goose_Game ;
  GDC, Strasser: https://gdcvault.com/play/1027183/ ;
  Polycount thread (speculation): https://polycount.com/discussion/220550/untitled-goose-game-rendering ;
  WayTooManyGames review: https://waytoomany.games/2019/10/05/review-untitled-goose-game/
- 80.lv: https://80.lv/articles/creating-visual-interest-in-low-poly-artworks ,
  https://80.lv/articles/emek-can-ozben-low-poly-environment
- glTF Transform CLI: https://gltf-transform.dev/cli
- BlenderKit licensing FAQ (via search snippet; the page now redirects to a
  different domain, which I did not follow):
  https://www.blenderkit.com/docs/licenses/licensing-faq/
- Sapling Tree Gen: https://extensions.blender.org/add-ons/sapling-tree-gen/
