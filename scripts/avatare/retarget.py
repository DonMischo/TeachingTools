"""
Überträgt Bewegungen aus Quaternius' Universal Animation Library (CC0, .glb) auf das Menschen-Skelett (bewegung.MENSCH).

Die Chibi-Figuren haben andere Proportionen als die Quelle; deshalb:
- Arme und Beine folgen der RICHTUNG der Quell-Glieder (Gelenkpositionen), nicht deren Achsen,
- Becken, Wirbel, Hals und Kopf übernehmen die Drehung gegenüber der Ruhehaltung,
- die Beckenhöhe wird auf die kleinere Figur umgerechnet, Laufbewegungen bleiben auf der Stelle.
"""
import bpy
from mathutils import Vector, Quaternion
from rig import ablegen

ABSPREIZEN = 0.3

# unser Knochen -> Kandidaten in der Quelle (der erste vorhandene zählt)
DREHUNG = {"pelvis": ["pelvis"], "spine_01": ["spine_02", "spine_01"], "spine_02": ["spine_03", "spine_04"],
           "neck_01": ["neck_01"], "head": ["Head", "head"]}
GLIED = {}   # unser Knochen -> (Quell-Gelenk, Quell-Gelenk am Ende)
for s in ("l", "r"):
    GLIED.update({f"upperarm_{s}": (f"upperarm_{s}", f"lowerarm_{s}"), f"lowerarm_{s}": (f"lowerarm_{s}", f"hand_{s}"),
                  f"thigh_{s}": (f"thigh_{s}", f"calf_{s}"), f"calf_{s}": (f"calf_{s}", f"foot_{s}"),
                  f"foot_{s}": (f"foot_{s}", f"ball_{s}")})

def lade_quelle(pfad):
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    neu = [o for o in bpy.data.objects if o not in vorher]
    quelle = next(o for o in neu if o.type == "ARMATURE")
    for o in neu:
        if o.type == "MESH":
            o.hide_render = o.hide_viewport = True
    return quelle

def _q_zu(a, b):
    return a.normalized().rotation_difference(b.normalized())

def uebertrage(arm, quelle, action_name, name, auf_der_stelle=False, spiegeln=False):
    """Bäckt eine Quell-Action Bild für Bild auf `arm` und legt sie als NLA-Spur `name` ab;
    spiegeln tauscht links und rechts (z. B. zaubert der Magier dann mit der freien Hand)"""
    qb = quelle.pose.bones
    welt = quelle.matrix_world
    def seite(n):
        return n[:-2] + {"_l": "_r", "_r": "_l"}[n[-2:]] if spiegeln and n[-2:] in ("_l", "_r") else n
    def pos(n):
        p = welt @ qb[seite(n)].head
        return Vector((-p.x, p.y, p.z)) if spiegeln else p
    def rot(n):
        return (welt.to_quaternion() @ qb[n].matrix.to_quaternion())
    def wahl(kand):
        return next((k for k in kand if k in qb), None)
    dreh = {u: wahl(k) for u, k in DREHUNG.items() if wahl(k)}
    glied = {u: q for u, q in GLIED.items() if q[0] in qb and q[1] in qb}

    quelle.animation_data_create()
    act_q = bpy.data.actions[action_name]
    quelle.animation_data.action = act_q
    # Ruhehaltung der Quelle (Bindepose)
    ruhe_rot = {u: welt.to_quaternion() @ quelle.data.bones[q].matrix_local.to_quaternion() for u, q in dreh.items()}
    becken_q = dreh.get("pelvis")
    ruhe_becken = welt @ quelle.data.bones[becken_q].head_local
    k = arm.data.bones["pelvis"].head_local.z / max(1e-4, ruhe_becken.z)

    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    reihenfolge = [b.name for b in arm.data.bones]   # Eltern stehen vor Kindern
    rest = {b.name: b.matrix_local.to_quaternion() for b in arm.data.bones}
    letzte = {}
    start, ende = (int(f) for f in act_q.frame_range)
    scene = bpy.context.scene
    for f in range(start, ende + 1):
        scene.frame_set(f)
        pose_rot = {}
        for n in reihenfolge:
            b = arm.data.bones[n]
            eltern_pose = pose_rot.get(b.parent.name, rest[b.parent.name]) if b.parent else Quaternion()
            eltern_rest = rest[b.parent.name] if b.parent else Quaternion()
            weiter = eltern_pose @ eltern_rest.inverted()   # wie weit sich das Elternglied gegenüber der Ruhe gedreht hat
            if n in dreh:
                d = rot(dreh[n]) @ ruhe_rot[n].inverted()
                if spiegeln:   # Drehung an der yz-Ebene gespiegelt
                    d = Quaternion((d.w, d.x, -d.y, -d.z))
                ziel = d @ rest[n]
                basis = (weiter @ rest[n]).inverted() @ ziel
            elif n in glied:
                d_quelle = pos(glied[n][1]) - pos(glied[n][0])
                if n.startswith("upperarm"):   # Oberarme etwas abspreizen: der Chibi-Rumpf ist breiter als die Quelle
                    d_quelle = d_quelle.normalized() + Vector((ABSPREIZEN if n.endswith("_l") else -ABSPREIZEN, 0, 0))
                d_ruhe = b.tail_local - b.head_local
                swing = _q_zu(d_ruhe, weiter.inverted() @ d_quelle)
                basis = rest[n].inverted() @ swing @ rest[n]
            else:
                basis = Quaternion()
            if n in letzte and letzte[n].dot(basis) < 0:
                basis.negate()
            letzte[n] = basis
            pose_rot[n] = weiter @ rest[n] @ basis
            pb = arm.pose.bones[n]
            pb.rotation_quaternion = basis
            pb.keyframe_insert("rotation_quaternion", frame=f - start + 1)
        d = (pos(becken_q) - (Vector((-ruhe_becken.x, ruhe_becken.y, ruhe_becken.z)) if spiegeln else ruhe_becken)) * k
        if auf_der_stelle:
            d.x = d.y = 0
        pb = arm.pose.bones["pelvis"]
        pb.location = rest["pelvis"].inverted() @ d
        pb.keyframe_insert("location", frame=f - start + 1)
    quelle.animation_data.action = None
    return ablegen(arm, act, name)
