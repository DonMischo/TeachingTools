"""
Skelett, Gewichte und Bewegungen für die Avatare.

skelett() legt eine Armature unter die Wurzel; binden() hängt alle Teile daran:
der Hauptkörper (verschmolzener Blob) bekommt automatische Gewichte, Einzelteile (Gesicht, Haare, Hut, Waffen …)
hängen starr am nächsten Knochen, die Haut (Kopf, Hals, Hände) Ecke für Ecke an Kopf oder Hand.
clip() schreibt eine Bewegung als Action; Drehungen werden in Welt-Achsen angegeben (z oben, -y vorn).
"""
import bpy, math
from mathutils import Vector, Quaternion, Euler
from basis import aktiv

HAUPT = ("kleidung", "koerper")   # bekommen weiche, automatische Gewichte
PRO_ECKE = {"haut": ("head", "hand_l", "hand_r")}   # Kopf, Hals und Hände in einem Mesh: jede Ecke zum nächsten dieser Knochen

def skelett(root, knochen):
    """knochen: [(name, kopf, ende, eltern|None)] in Weltkoordinaten (die Figur steht im Ursprung)"""
    arm_daten = bpy.data.armatures.new("skelett")
    arm = bpy.data.objects.new("skelett", arm_daten)
    bpy.context.scene.collection.objects.link(arm)
    arm.parent = root
    aktiv(arm)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, kopf, ende, eltern in knochen:
        b = arm_daten.edit_bones.new(name)
        b.head, b.tail = Vector(kopf), Vector(ende)
        b.align_roll(Vector((0, -1, 0)) if abs(b.vector.normalized().y) < 0.9 else Vector((0, 0, 1)))
        if eltern:
            b.parent = arm_daten.edit_bones[eltern]
            b.use_connect = (b.parent.tail - b.head).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm

def _abstand(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length

def _naechster(arm, p, nur=None):
    knochen = [b for b in arm.data.bones if not nur or b.name in nur]
    return min(knochen, key=lambda b: _abstand(p, b.head_local, b.tail_local)).name

def _fest(obj):
    """Modifikatoren und Transformation einbacken: ein Skin-Mesh in glTF hat keine eigene Lage"""
    aktiv(obj)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def binden(root, arm, starr=None, vorzug=None):
    """starr: {objektname: knochen} erzwingt den Knochen eines Einzelteils (sonst der nächste zur Mitte);
    vorzug=(knochen, spielraum): dieser Knochen gewinnt, wenn er höchstens `spielraum` weiter weg ist
    (Tiere: Schnurrhaare, Wangen und Mund am breiten Kopf liegen sonst näher an den Armen)"""
    starr = starr or {}
    teile = [o for o in root.children_recursive if o.type == "MESH"]
    for obj in teile:
        _fest(obj)
    for obj in teile:
        obj.parent = arm
        if obj.name in HAUPT:
            for o in bpy.context.view_layer.objects:
                o.select_set(o in (obj, arm))
            bpy.context.view_layer.objects.active = arm
            bpy.ops.object.parent_set(type="ARMATURE_AUTO")
            continue
        mod = obj.modifiers.new("skelett", "ARMATURE")
        mod.object = arm
        gruppen = {}
        def gruppe(name):
            if name not in gruppen:
                gruppen[name] = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            return gruppen[name]
        if obj.name in PRO_ECKE:
            for v in obj.data.vertices:
                gruppe(_naechster(arm, v.co, PRO_ECKE[obj.name])).add([v.index], 1.0, "REPLACE")
        else:
            mitte = sum((v.co for v in obj.data.vertices), Vector()) / max(1, len(obj.data.vertices))
            knochen = starr.get(obj.name) or _naechster(arm, mitte)
            if obj.name not in starr and vorzug and vorzug[0] in arm.data.bones:
                b, k = arm.data.bones[vorzug[0]], arm.data.bones[knochen]
                if _abstand(mitte, b.head_local, b.tail_local) <= _abstand(mitte, k.head_local, k.tail_local) + vorzug[1]:
                    knochen = vorzug[0]
            gruppe(knochen).add([v.index for v in obj.data.vertices], 1.0, "REPLACE")

def _q(w):
    """(x, y, z) in Grad um die Welt-Achsen, in dieser Reihenfolge"""
    return Euler([math.radians(a) for a in w], "XYZ").to_quaternion()

def clip(arm, name, laenge, spuren, fps=24, schleife=True):
    """spuren: {knochen: [(zeit_s, {"r": (x,y,z) Grad Welt, "l": (x,y,z) Welt, "s": (x,y,z) lokal}), …]}
    Fehlende Kanäle bleiben in Ruhe. Bei schleife wird der erste Schlüssel am Ende wiederholt."""
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion, pb.location, pb.scale = Quaternion(), Vector(), Vector((1, 1, 1))
    for knochen, schluessel in spuren.items():
        pb = arm.pose.bones[knochen]
        ruhe = pb.bone.matrix_local.to_quaternion()
        if schleife and schluessel[0][0] == 0:
            schluessel = list(schluessel) + [(laenge, schluessel[0][1])]
        for t, k in schluessel:
            f = 1 + round(t * fps)
            if "r" in k:
                pb.rotation_quaternion = ruhe.inverted() @ _q(k["r"]) @ ruhe
                pb.keyframe_insert("rotation_quaternion", frame=f)
            if "l" in k:
                pb.location = ruhe.inverted() @ Vector(k["l"])
                pb.keyframe_insert("location", frame=f)
            if "s" in k:
                pb.scale = Vector(k["s"])
                pb.keyframe_insert("scale", frame=f)
    return ablegen(arm, act, name)

def ablegen(arm, act, name):
    """Action als eigene NLA-Spur ablegen: so exportiert glTF jede Bewegung als eigenen Clip"""
    spur = arm.animation_data.nla_tracks.new()
    spur.name = name
    spur.strips.new(name, int(act.frame_range[0]), act)
    arm.animation_data.action = None
    return act
