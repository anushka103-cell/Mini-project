"""
MindSafe Avatar Generator v2 — Blender Python Script
=====================================================
Generates a stylised chibi / anime-proportioned 3D character.

Technique: revolved profiles + bmesh sculpting for smooth organic shapes.
NOT the old Skin-modifier stick-figure approach.

Run:  blender --background --python generate_avatar.py
"""

import bpy, bmesh, math, os
from mathutils import Vector, Matrix

# ── paths ───────────────────────────────────────────
EXPORT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "models", "avatar_base.glb")

# ── chibi proportions (meters) ──────────────────────
HEAD_R      = 0.18
HEAD_Y      = 1.42
NECK_Y      = 1.22
CHEST_Y     = 1.06
WAIST_Y     = 0.92
HIP_Y       = 0.82
KNEE_Y      = 0.50
ANKLE_Y     = 0.10
FOOT_Y      = 0.02
SHOULDER_W  = 0.22
HIP_W       = 0.10

# ── helpers ─────────────────────────────────────────

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False, confirm=False)
    for col in [bpy.data.meshes, bpy.data.materials,
                bpy.data.armatures]:
        for b in list(col):
            if b.users == 0:
                col.remove(b)

def _mat(name, color, rough=0.55):
    m = bpy.data.materials.new(name)
    if hasattr(m, 'use_nodes'):
        m.use_nodes = True
    nd = m.node_tree.nodes.get("Principled BSDF")
    if nd:
        nd.inputs["Base Color"].default_value = (*color, 1)
        nd.inputs["Roughness"].default_value = rough
    return m

def _assign(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)

def _smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True

def _sel(obj):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

def _apply_mods(obj):
    _sel(obj)
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError:
            pass

# ── revolved profile → smooth mesh ──────────────────

def _revolve(name, profile, segs=24, material=None):
    """Revolve [(radius, z), …] around Z axis → mesh object."""
    verts, faces = [], []
    n = len(profile)
    for si in range(segs):
        a = 2 * math.pi * si / segs
        ca, sa = math.cos(a), math.sin(a)
        for r, z in profile:
            verts.append((r * ca, r * sa, z))
    for si in range(segs):
        ns = (si + 1) % segs
        for pi in range(n - 1):
            faces.append((si*n+pi, si*n+pi+1, ns*n+pi+1, ns*n+pi))
    me = bpy.data.meshes.new(name + "_m")
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    _smooth(obj)
    if material:
        _assign(obj, material)
    _sel(obj)
    sub = obj.modifiers.new("Sub", 'SUBSURF')
    sub.levels = 2; sub.render_levels = 2
    _apply_mods(obj)
    _smooth(obj)
    return obj

def _limb(name, start, end, r0, r1, segs=12, rings=8, material=None):
    """Tapered cylinder between two 3D points."""
    d = Vector(end) - Vector(start)
    ln = d.length
    if ln < 0.001:
        return None
    prof = [(r0 + (r1 - r0) * t / rings, ln * t / rings) for t in range(rings + 1)]
    obj = _revolve(name, prof, segs, material)
    up = Vector((0, 0, 1))
    dn = d.normalized()
    if (up - dn).length < 0.001:
        rot = Matrix.Identity(4)
    elif (up + dn).length < 0.001:
        rot = Matrix.Rotation(math.pi, 4, 'X')
    else:
        axis = up.cross(dn).normalized()
        rot = Matrix.Rotation(up.angle(dn), 4, axis)
    obj.matrix_world = Matrix.Translation(start) @ rot
    _sel(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

# ╔═══════════════════════════════════════════════════╗
# ║  MATERIALS                                         ║
# ╚═══════════════════════════════════════════════════╝

def mats():
    return {
        'Skin':  _mat("Skin",  (1.0, 0.88, 0.74), 0.6),
        'Hair':  _mat("Hair",  (0.42, 0.29, 0.54), 0.45),
        'EyeW':  _mat("Eye_White", (0.98, 0.98, 1.0), 0.15),
        'Iris':  _mat("Iris",  (0.27, 0.53, 1.0), 0.15),
        'Pupil': _mat("Pupil", (0.02, 0.02, 0.02), 0.1),
        'ClA':   _mat("Clothing_A", (0.42, 0.36, 0.58), 0.55),
        'ClB':   _mat("Clothing_B", (0.27, 0.32, 0.42), 0.55),
        'ClC':   _mat("Clothing_C", (0.65, 0.20, 0.22), 0.5),
        'ClD':   _mat("Clothing_D", (0.85, 0.85, 0.82), 0.5),
    }

# ╔═══════════════════════════════════════════════════╗
# ║  BODY  (revolved torso + limbs joined)             ║
# ╚═══════════════════════════════════════════════════╝

def _torso(M):
    prof = [
        (0.001, FOOT_Y),
        (0.032, FOOT_Y + 0.02),
        (0.036, ANKLE_Y),
        (0.044, ANKLE_Y + 0.08),
        (0.050, KNEE_Y - 0.05),
        (0.047, KNEE_Y),
        (0.054, KNEE_Y + 0.10),
        (0.068, HIP_Y - 0.05),
        (0.105, HIP_Y),
        (0.098, HIP_Y + 0.05),
        (0.088, WAIST_Y),
        (0.105, WAIST_Y + 0.05),
        (0.125, CHEST_Y - 0.04),
        (0.135, CHEST_Y),
        (0.128, CHEST_Y + 0.06),
        (0.085, CHEST_Y + 0.12),
        (0.045, NECK_Y - 0.02),
        (0.042, NECK_Y),
        (0.044, NECK_Y + 0.03),
        (0.001, NECK_Y + 0.04),
    ]
    torso = _revolve("Body", prof, 28, M['Skin'])
    # flatten front/back in torso area
    _sel(torso)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(torso.data)
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        z = v.co.z
        if HIP_Y - 0.1 < z < CHEST_Y + 0.15:
            v.co.x *= 1.12
            v.co.y *= 0.72
    bmesh.update_edit_mesh(torso.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    return torso

def _add_limbs(M):
    """Create arms + legs, then join them into Body."""
    sk = M['Skin']
    parts = []
    # arms
    for s, sx in [("L", -1), ("R", 1)]:
        sh  = (sx * SHOULDER_W, 0, CHEST_Y + 0.10)
        elb = (sx * (SHOULDER_W + 0.06), 0, CHEST_Y - 0.12)
        wr  = (sx * (SHOULDER_W + 0.04), 0, CHEST_Y - 0.32)
        hnd = (sx * (SHOULDER_W + 0.03), 0, CHEST_Y - 0.38)
        parts.append(_limb(f"ArmU_{s}", sh, elb, 0.034, 0.028, material=sk))
        parts.append(_limb(f"ArmL_{s}", elb, wr, 0.028, 0.025, material=sk))
        parts.append(_limb(f"Hand_{s}", wr, hnd, 0.024, 0.018, material=sk))
    # legs
    for s, sx in [("L", -1), ("R", 1)]:
        hp  = (sx * HIP_W, 0, HIP_Y)
        kn  = (sx * HIP_W, 0.015, KNEE_Y)
        ak  = (sx * HIP_W, 0, ANKLE_Y)
        ft  = (sx * HIP_W, -0.04, FOOT_Y)
        parts.append(_limb(f"LegU_{s}", hp, kn, 0.054, 0.040, material=sk))
        parts.append(_limb(f"LegL_{s}", kn, ak, 0.040, 0.034, material=sk))
        parts.append(_limb(f"Foot_{s}", ak, ft, 0.034, 0.038, 10, 5, sk))

    body = bpy.data.objects.get("Body")
    if body:
        _sel(body)
        for p in parts:
            if p:
                p.select_set(True)
        bpy.ops.object.join()
        _smooth(body)
    bpy.ops.object.select_all(action='DESELECT')
    return body

# ╔═══════════════════════════════════════════════════╗
# ║  HEAD  (anime chibi + shape keys)                 ║
# ╚═══════════════════════════════════════════════════╝

def _head(M):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=HEAD_R, segments=36, ring_count=24,
        location=(0, 0, HEAD_Y))
    h = bpy.context.active_object
    h.name = "Head"
    h.scale = (1.05, 0.95, 1.0)
    bpy.ops.object.transform_apply(scale=True)

    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(h.data)
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        lz = v.co.z - HEAD_Y
        # chin taper
        if lz < -HEAD_R * 0.25:
            f = (abs(lz) - HEAD_R * 0.25) / (HEAD_R * 0.75)
            s = 1.0 - f * 0.35
            v.co.x *= s
            v.co.y *= s * 0.9
        # cheek
        if -HEAD_R * 0.3 < lz < HEAD_R * 0.1 and abs(v.co.x) > HEAD_R * 0.4:
            v.co.x *= 1.05
        # flatten front
        if v.co.y < -HEAD_R * 0.5 and abs(lz) < HEAD_R * 0.5:
            v.co.y *= 0.92
    bmesh.update_edit_mesh(h.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    _smooth(h)
    _assign(h, M['Skin'])

    # shape keys
    h.shape_key_add(name="Basis")
    def sk(name, test, fn):
        k = h.shape_key_add(name=name, from_mix=False)
        basis = h.data.shape_keys.key_blocks["Basis"]
        for i, kv in enumerate(k.data):
            bv = basis.data[i]
            lx, ly, lz = bv.co.x, bv.co.y, bv.co.z - HEAD_Y
            if test(lx, ly, lz):
                fn(kv, lx, ly, lz)

    R = HEAD_R
    sk("blink_L",
       lambda x,y,z: -0.09<x<-0.02 and 0<z<0.05 and y<-R*0.5,
       lambda v,x,y,z: setattr(v.co,'z',v.co.z-0.015))
    sk("blink_R",
       lambda x,y,z: 0.02<x<0.09 and 0<z<0.05 and y<-R*0.5,
       lambda v,x,y,z: setattr(v.co,'z',v.co.z-0.015))
    sk("smile",
       lambda x,y,z: abs(x)>0.02 and -0.09<z<-0.03 and y<-R*0.4,
       lambda v,x,y,z: (setattr(v.co,'z',v.co.z+0.01*(abs(x)/0.08)),
                         setattr(v.co,'x',v.co.x+0.004*(1 if x>0 else -1))))
    sk("frown",
       lambda x,y,z: abs(x)>0.02 and -0.09<z<-0.03 and y<-R*0.4,
       lambda v,x,y,z: setattr(v.co,'z',v.co.z-0.008*(abs(x)/0.08)))
    sk("mouth_open",
       lambda x,y,z: abs(x)<0.05 and -0.10<z<-0.04 and y<-R*0.5,
       lambda v,x,y,z: setattr(v.co,'z',v.co.z-0.018 if z<-0.06 else v.co.z-0.006))
    sk("surprise",
       lambda x,y,z: (abs(x)<0.05 and -0.10<z<-0.04 and y<-R*0.5) or
                      (abs(x)<0.08 and 0.05<z<0.10 and y<-R*0.4),
       lambda v,x,y,z: setattr(v.co,'z',v.co.z+(0.01 if z>0.04 else -0.012)))
    sk("brow_up",
       lambda x,y,z: abs(x)<0.08 and 0.05<z<0.10 and y<-R*0.4,
       lambda v,x,y,z: setattr(v.co,'z',v.co.z+0.010))
    sk("brow_down",
       lambda x,y,z: abs(x)<0.08 and 0.05<z<0.10 and y<-R*0.4,
       lambda v,x,y,z: setattr(v.co,'z',v.co.z-0.008))
    sk("angry",
       lambda x,y,z: (abs(x)<0.08 and 0.05<z<0.10 and y<-R*0.4) or
                      (abs(x)<0.05 and -0.08<z<-0.03 and y<-R*0.5),
       lambda v,x,y,z: setattr(v.co,'z',v.co.z-0.006 if z>0.04 else v.co.z-0.004))
    sk("sad",
       lambda x,y,z: (abs(x)<0.08 and 0.05<z<0.10 and y<-R*0.4) or
                      (abs(x)>0.02 and -0.08<z<-0.03 and y<-R*0.5),
       lambda v,x,y,z: setattr(v.co,'z',
           v.co.z+0.005*(1-abs(x)/0.08) if z>0.04 else v.co.z-0.005))

    bpy.ops.object.select_all(action='DESELECT')
    return h

# ╔═══════════════════════════════════════════════════╗
# ║  NECK / EARS                                       ║
# ╚═══════════════════════════════════════════════════╝

def _neck(M):
    prof = [
        (0.042, NECK_Y - 0.02),
        (0.040, NECK_Y),
        (0.042, NECK_Y + 0.04),
        (0.050, HEAD_Y - HEAD_R * 0.85),
    ]
    return _revolve("Neck", prof, 20, M['Skin'])

def _ears(M):
    out = []
    for s, sx in [("L", -1), ("R", 1)]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.024, segments=10, ring_count=8,
            location=(sx * HEAD_R * 0.92, 0, HEAD_Y - 0.01))
        e = bpy.context.active_object
        e.name = f"Ear_{s}"
        e.scale = (0.45, 0.8, 1.0)
        bpy.ops.object.transform_apply(scale=True)
        _smooth(e); _assign(e, M['Skin'])
        out.append(e)
    bpy.ops.object.select_all(action='DESELECT')
    return out

# ╔═══════════════════════════════════════════════════╗
# ║  EYES  (large anime)                              ║
# ╚═══════════════════════════════════════════════════╝

def _eyes(M):
    out = []
    fwd = -HEAD_R * 0.88
    ez  = HEAD_Y + 0.01
    for s, xo in [("L", -0.055), ("R", 0.055)]:
        # white
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.034, segments=20, ring_count=14,
            location=(xo, fwd, ez))
        w = bpy.context.active_object
        w.name = f"Eye_{s}"
        w.scale = (1.0, 0.45, 1.2)
        bpy.ops.object.transform_apply(scale=True)
        _smooth(w); _assign(w, M['EyeW'])
        out.append(w)
        # iris
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.026, segments=18, ring_count=12,
            location=(xo, fwd - 0.034*0.35, ez))
        ir = bpy.context.active_object
        ir.name = f"Iris_{s}"
        ir.scale = (1.0, 0.32, 1.2)
        bpy.ops.object.transform_apply(scale=True)
        _smooth(ir); _assign(ir, M['Iris'])
        out.append(ir)
        # pupil
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.012, segments=14, ring_count=10,
            location=(xo, fwd - 0.034*0.45, ez))
        pu = bpy.context.active_object
        pu.name = f"Pupil_{s}"
        pu.scale = (1.0, 0.28, 1.2)
        bpy.ops.object.transform_apply(scale=True)
        _smooth(pu); _assign(pu, M['Pupil'])
        out.append(pu)
    bpy.ops.object.select_all(action='DESELECT')
    return out

# ╔═══════════════════════════════════════════════════╗
# ║  HAIR                                              ║
# ╚═══════════════════════════════════════════════════╝

def _hair(M):
    out = []
    hr = HEAD_R
    mh = M['Hair']

    def cap(name, extra, cut_z, sculpt=None, hide=False):
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=hr + extra, segments=28, ring_count=18,
            location=(0, 0, HEAD_Y + extra * 0.3))
        o = bpy.context.active_object
        o.name = name
        if sculpt:
            bpy.ops.object.mode_set(mode='EDIT')
            bm = bmesh.from_edit_mesh(o.data)
            bm.verts.ensure_lookup_table()
            sculpt(bm)
            bmesh.update_edit_mesh(o.data)
            bpy.ops.object.mode_set(mode='OBJECT')
        # cut bottom
        _sel(o)
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(o.data)
        bm.verts.ensure_lookup_table()
        d = [v for v in bm.verts if v.co.z < cut_z]
        if d: bmesh.ops.delete(bm, geom=d, context='VERTS')
        bmesh.update_edit_mesh(o.data)
        bpy.ops.object.mode_set(mode='OBJECT')
        # cut face window
        _sel(o)
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(o.data)
        bm.verts.ensure_lookup_table()
        d = [v for v in bm.verts
             if v.co.y < -hr*0.50
             and HEAD_Y - hr*0.55 < v.co.z < HEAD_Y + hr*0.20]
        if d: bmesh.ops.delete(bm, geom=d, context='VERTS')
        bmesh.update_edit_mesh(o.data)
        bpy.ops.object.mode_set(mode='OBJECT')
        _smooth(o); _assign(o, mh)
        if hide: o.hide_set(True)
        bpy.ops.object.select_all(action='DESELECT')
        out.append(o)

    cap("Hair_Short", 0.028, HEAD_Y - hr*0.15)

    def med(bm):
        for v in bm.verts:
            lz = v.co.z - HEAD_Y
            if v.co.y > 0 and lz < 0:
                v.co.z -= 0.12 * abs(lz)/(hr*0.5)
            if abs(v.co.x) > hr*0.5 and lz < 0:
                v.co.z -= 0.09
    cap("Hair_Medium", 0.032, HEAD_Y - hr*1.5, med, True)

    def lng(bm):
        for v in bm.verts:
            lz = v.co.z - HEAD_Y
            if v.co.y > 0 and lz < 0:
                v.co.z -= 0.32 * abs(lz)/(hr*0.5)
            if abs(v.co.x) > hr*0.4 and lz < -hr*0.2:
                v.co.z -= 0.20
    cap("Hair_Long", 0.038, HEAD_Y - hr*3.0, lng, True)

    def spk(bm):
        for v in bm.verts:
            lz = v.co.z - HEAD_Y
            if lz > hr*0.15:
                s = 1.0 + 0.55*(lz/hr)
                v.co.x *= s; v.co.y *= s*0.7; v.co.z += 0.04
    cap("Hair_Spiky", 0.030, HEAD_Y - hr*0.2, spk, True)

    def pny(bm):
        for v in bm.verts:
            lz = v.co.z - HEAD_Y
            if v.co.y > hr*0.5 and lz < 0:
                v.co.y += 0.12; v.co.z -= 0.28
            elif v.co.y > hr*0.3 and lz < -hr*0.2:
                v.co.y += 0.06; v.co.z -= 0.14
    cap("Hair_Ponytail", 0.032, HEAD_Y - hr*2.0, pny, True)

    return out

# ╔═══════════════════════════════════════════════════╗
# ║  CLOTHING                                          ║
# ╚═══════════════════════════════════════════════════╝

def _clothing(M):
    out = []

    # body contour reference points (radius, z)
    body_top = [
        (0.105, HIP_Y),
        (0.098, HIP_Y + 0.05),
        (0.088, WAIST_Y),
        (0.105, WAIST_Y + 0.05),
        (0.125, CHEST_Y - 0.04),
        (0.140, CHEST_Y),
        (0.133, CHEST_Y + 0.06),
        (0.090, CHEST_Y + 0.12),
        (0.050, NECK_Y - 0.02),
    ]
    body_bot = [
        (0.038, ANKLE_Y),
        (0.046, ANKLE_Y + 0.08),
        (0.052, KNEE_Y - 0.05),
        (0.049, KNEE_Y),
        (0.056, KNEE_Y + 0.10),
        (0.070, HIP_Y - 0.05),
        (0.105, HIP_Y),
        (0.098, HIP_Y + 0.05),
        (0.090, WAIST_Y),
        (0.098, WAIST_Y + 0.03),
    ]

    def top(name, material, zb, zt, off=0.014, hide=False):
        pts = [(r + off, z) for r, z in body_top if zb - 0.02 <= z <= zt + 0.02]
        if len(pts) < 3: return
        pts.insert(0, (pts[0][0] - 0.01, zb))
        pts.append((pts[-1][0] - 0.01, zt))
        o = _revolve(name, pts, 24, material)
        _sel(o)
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(o.data)
        bm.verts.ensure_lookup_table()
        for v in bm.verts:
            if HIP_Y - 0.1 < v.co.z < CHEST_Y + 0.15:
                v.co.x *= 1.12; v.co.y *= 0.72
        bmesh.update_edit_mesh(o.data)
        bpy.ops.object.mode_set(mode='OBJECT')
        if hide: o.hide_set(True)
        bpy.ops.object.select_all(action='DESELECT')
        out.append(o)

    def bot(name, material, zb, zt, off=0.010, hide=False):
        pts = [(r + off, z) for r, z in body_bot if zb - 0.02 <= z <= zt + 0.02]
        if len(pts) < 3: return
        pts.insert(0, (pts[0][0], zb))
        pts.append((pts[-1][0], zt))
        o = _revolve(name, pts, 24, material)
        _sel(o)
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(o.data)
        bm.verts.ensure_lookup_table()
        for v in bm.verts:
            if HIP_Y - 0.1 < v.co.z < WAIST_Y + 0.1:
                v.co.x *= 1.12; v.co.y *= 0.72
        bmesh.update_edit_mesh(o.data)
        bpy.ops.object.mode_set(mode='OBJECT')
        if hide: o.hide_set(True)
        bpy.ops.object.select_all(action='DESELECT')
        out.append(o)

    top("Top_Hoodie",  M['ClA'], HIP_Y - 0.05, NECK_Y - 0.02, 0.016)
    top("Top_Tshirt",  M['ClC'], WAIST_Y, NECK_Y - 0.02, 0.012, True)
    top("Top_Jacket",  M['ClD'], HIP_Y - 0.08, NECK_Y - 0.02, 0.020, True)
    top("Top_Tanktop", M['ClA'], WAIST_Y, CHEST_Y + 0.12, 0.010, True)

    bot("Bottom_Pants",  M['ClB'], ANKLE_Y, WAIST_Y + 0.02)
    bot("Bottom_Shorts", M['ClB'], KNEE_Y - 0.02, WAIST_Y + 0.02, hide=True)
    bot("Bottom_Skirt",  M['ClC'], KNEE_Y + 0.05, WAIST_Y + 0.02, 0.022, True)

    # dress
    dress_pts = [
        (0.065, KNEE_Y - 0.05),
        (0.078, KNEE_Y),
        (0.088, KNEE_Y + 0.10),
        (0.100, HIP_Y - 0.05),
        (0.118, HIP_Y),
        (0.112, HIP_Y + 0.05),
        (0.100, WAIST_Y),
        (0.118, WAIST_Y + 0.05),
        (0.138, CHEST_Y - 0.04),
        (0.152, CHEST_Y),
        (0.146, CHEST_Y + 0.06),
        (0.100, CHEST_Y + 0.12),
        (0.062, NECK_Y - 0.02),
    ]
    dr = _revolve("Full_Dress", dress_pts, 24, M['ClA'])
    _sel(dr)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(dr.data)
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        if HIP_Y - 0.1 < v.co.z < CHEST_Y + 0.15:
            v.co.x *= 1.12; v.co.y *= 0.72
        if v.co.z < HIP_Y:
            fl = 1.0 + 0.18*(HIP_Y - v.co.z)/(HIP_Y - KNEE_Y + 0.05)
            v.co.x *= fl; v.co.y *= fl
    bmesh.update_edit_mesh(dr.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    dr.hide_set(True)
    bpy.ops.object.select_all(action='DESELECT')
    out.append(dr)

    return out

# ╔═══════════════════════════════════════════════════╗
# ║  ARMATURE                                          ║
# ╚═══════════════════════════════════════════════════╝

def _armature():
    ad = bpy.data.armatures.new("Armature")
    ao = bpy.data.objects.new("Armature", ad)
    bpy.context.collection.objects.link(ao)
    _sel(ao)
    bpy.ops.object.mode_set(mode='EDIT')

    def b(name, head, tail, par=None):
        bn = ad.edit_bones.new(name)
        bn.head = Vector(head); bn.tail = Vector(tail)
        if par:
            bn.parent = ad.edit_bones[par]
            bn.use_connect = (Vector(head) - Vector(ad.edit_bones[par].tail)).length < 0.01

    b("Hips",   (0,0,HIP_Y),       (0,0,WAIST_Y))
    b("Spine",  (0,0,WAIST_Y),      (0,0,CHEST_Y),      "Hips")
    b("Chest",  (0,0,CHEST_Y),      (0,0,CHEST_Y+0.10), "Spine")
    b("Neck",   (0,0,NECK_Y-0.03),  (0,0,NECK_Y),       "Chest")
    b("Head",   (0,0,NECK_Y),       (0,0,HEAD_Y+HEAD_R), "Neck")

    for s, sx in [("L",-1),("R",1)]:
        b(f"Shoulder_{s}", (sx*(SHOULDER_W-0.06),0,CHEST_Y+0.10),
                           (sx*SHOULDER_W,0,CHEST_Y+0.10), "Chest")
        b(f"UpperArm_{s}", (sx*SHOULDER_W,0,CHEST_Y+0.10),
                           (sx*(SHOULDER_W+0.06),0,CHEST_Y-0.12), f"Shoulder_{s}")
        b(f"LowerArm_{s}", (sx*(SHOULDER_W+0.06),0,CHEST_Y-0.12),
                           (sx*(SHOULDER_W+0.04),0,CHEST_Y-0.32), f"UpperArm_{s}")
        b(f"Hand_{s}",     (sx*(SHOULDER_W+0.04),0,CHEST_Y-0.32),
                           (sx*(SHOULDER_W+0.03),0,CHEST_Y-0.38), f"LowerArm_{s}")

    for s, sx in [("L",-1),("R",1)]:
        b(f"UpperLeg_{s}", (sx*HIP_W,0,HIP_Y),       (sx*HIP_W,0.015,KNEE_Y), "Hips")
        b(f"LowerLeg_{s}", (sx*HIP_W,0.015,KNEE_Y),  (sx*HIP_W,0,ANKLE_Y),    f"UpperLeg_{s}")
        b(f"Foot_{s}",     (sx*HIP_W,0,ANKLE_Y),     (sx*HIP_W,-0.04,FOOT_Y), f"LowerLeg_{s}")

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    return ao

# ╔═══════════════════════════════════════════════════╗
# ║  PARENTING + EXPORT                                ║
# ╚═══════════════════════════════════════════════════╝

def _parent(arm, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        if o and o.type == 'MESH':
            o.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except RuntimeError:
        bpy.ops.object.parent_set(type='ARMATURE')
    bpy.ops.object.select_all(action='DESELECT')

def _export(fp):
    for o in bpy.data.objects:
        o.hide_set(False)
    bpy.ops.export_scene.gltf(
        filepath=fp, export_format='GLB', use_selection=False,
        export_apply=True, export_animations=False,
        export_morph=True, export_skins=True,
        export_lights=False, export_cameras=False)
    print(f"\n✅ Exported → {fp}")

# ╔═══════════════════════════════════════════════════╗
# ║  MAIN                                              ║
# ╚═══════════════════════════════════════════════════╝

def main():
    print("\n🎭 MindSafe Avatar Generator v2")
    print("=" * 40)
    clear_scene()
    M = mats()

    print("  body…")
    _torso(M)
    body = _add_limbs(M)

    print("  neck…")
    neck = _neck(M)

    print("  head…")
    head = _head(M)

    print("  ears…")
    ears = _ears(M)

    print("  eyes…")
    eyes = _eyes(M)

    print("  hair…")
    hair = _hair(M)

    print("  clothing…")
    cloth = _clothing(M)

    print("  armature…")
    arm = _armature()

    print("  parenting…")
    _parent(arm, [body, neck, head] + ears + eyes + hair + cloth)

    os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
    print("  exporting…")
    _export(EXPORT_PATH)
    print("🎉 Done!")

if __name__ == "__main__":
    main()
else:
    main()
