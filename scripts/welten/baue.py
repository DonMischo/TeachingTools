"""Modelle für die 3D-Welt des TaskCrawlers (Bäume, Tannen, Palmen, Felsen, Büsche, Kaktus, Baumstumpf).

Aufruf:
    blender -b --factory-startup --python scripts/welten/baue.py -- frontend/public/modelle/welten
    … -- <zielordner> --bild <datei.png>   rendert zusätzlich eine Übersicht aller Modelle

Ergebnis ist eine Datei welten.glb. Jedes Modell besteht aus benannten Teilen, die das Frontend einzeln
einfärbt (components/gebaeude/frei/modelle.ts):
    laubbaum1_stamm, laubbaum1_krone, tanne1_stamm, tanne1_krone, tanne1_schnee, palme1_stamm, palme1_krone,
    fels1_stein, busch1_krone, kaktus1_krone, stumpf1_stamm …
Die Teile tragen keine Farbe, nur Helligkeit je Ecke (oben hell, unten und innen dunkel) — die Farbe kommt
im Spiel aus der Palette der Welt. Bäume, Tannen, Palmen, Kaktus und Stumpf sind 1 hoch und stehen auf z = 0,
Felsen und Büsche sind 1 breit.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/welten"
BILD = ARGS[ARGS.index("--bild") + 1] if "--bild" in ARGS else None


# ── Grundlagen ───────────────────────────────────────────────────────────────

def objekt(name, bm, glatt=True):
    """bmesh → Objekt in der Szene"""
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = glatt
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def backe(o, name=None):
    """Modifikatoren fest einrechnen (ohne Operatoren, damit es im Hintergrund läuft)"""
    dg = bpy.context.evaluated_depsgraph_get()
    neu = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    alt = o.data
    o.modifiers.clear()
    o.data = neu
    neu.name = name or o.name
    bpy.data.meshes.remove(alt)
    return o


def vereinfache(o, dreiecke, glatt=True):
    """auf etwa so viele Dreiecke eindampfen"""
    me = o.data
    me.calc_loop_triangles()
    jetzt = len(me.loop_triangles)
    if jetzt > dreiecke:
        m = o.modifiers.new("weniger", "DECIMATE")
        m.ratio = dreiecke / jetzt
        backe(o)
    for p in o.data.polygons:
        p.use_smooth = glatt
    return o


def verschmelze(o, feinheit):
    """mehrere Körper zu einer Hülle (Voxel-Remesh)"""
    m = o.modifiers.new("huelle", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = feinheit
    return backe(o)


def helligkeit(o, fn):
    """Helligkeit je Ecke: fn(ort, normale) → 0…1"""
    me = o.data
    attr = me.color_attributes.new("Farbe", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        h = max(0.0, min(1.0, fn(v.co, v.normal)))
        attr.data[v.index].color = (h, h, h, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0


def material(o):
    """ein weißes Material, das die Eckenfarbe zeigt (für die Übersicht und den Export)"""
    mat = bpy.data.materials.get("Hell")
    if not mat:
        mat = bpy.data.materials.new("Hell")
        mat.use_nodes = True
        baum = mat.node_tree
        bsdf = baum.nodes.get("Principled BSDF")
        farbe = baum.nodes.new("ShaderNodeVertexColor")
        farbe.layer_name = "Farbe"
        baum.links.new(farbe.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 1.0
    o.data.materials.append(mat)


def einpassen(teile, hoehe=None, breite=None):
    """alle Teile eines Modells gemeinsam verschieben und skalieren: Fuß auf z = 0, Höhe bzw. Breite 1"""
    punkte = [o.matrix_world @ v.co for o in teile for v in o.data.vertices]
    unten = min(p.z for p in punkte)
    mx = (min(p.x for p in punkte) + max(p.x for p in punkte)) / 2
    my = (min(p.y for p in punkte) + max(p.y for p in punkte)) / 2
    if hoehe:
        f = hoehe / (max(p.z for p in punkte) - unten)
    else:
        f = breite / max(max(p.x for p in punkte) - min(p.x for p in punkte), max(p.y for p in punkte) - min(p.y for p in punkte))
    m = Matrix.Scale(f, 4) @ Matrix.Translation((-mx if breite else 0, -my if breite else 0, -unten))
    for o in teile:
        o.data.transform(m)
        o.data.update()


def rohr(bm, weg, seiten=7, deckel=True):
    """Schlauch entlang einer Reihe (Ort, Radius): Stämme, Äste, Arme"""
    ringe = []
    for i, (ort, radius) in enumerate(weg):
        ort = Vector(ort)
        vor = Vector(weg[min(i + 1, len(weg) - 1)][0]) - Vector(weg[max(i - 1, 0)][0])
        vor.normalize()
        quer = vor.cross(Vector((0.3, 1, 0.1))).normalized()
        hoch = vor.cross(quer).normalized()
        ringe.append([bm.verts.new(ort + (quer * math.cos(a) + hoch * math.sin(a)) * radius)
                      for a in (k / seiten * math.tau for k in range(seiten))])
    for a, b in zip(ringe, ringe[1:]):
        for k in range(seiten):
            bm.faces.new((a[k], a[(k + 1) % seiten], b[(k + 1) % seiten], b[k]))
    if deckel:
        bm.faces.new(list(reversed(ringe[0])))
        bm.faces.new(ringe[-1])
    return ringe


def kugel(bm, mitte, radius, unter=2, flach=1.0):
    m = Matrix.Translation(mitte) @ Matrix.Diagonal((1, 1, flach, 1))
    return bmesh.ops.create_icosphere(bm, subdivisions=unter, radius=radius, matrix=m)["verts"]


def beule(bm, staerke, feinheit, versatz=0.0):
    """Rauschen entlang der Normalen: nichts ist ganz rund"""
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * noise.noise(v.co * feinheit + Vector((versatz, versatz * 0.7, versatz * 1.3))) * staerke


def laub_hell(unten, oben):
    """oben und außen hell, unten und zur Mitte dunkel — mit etwas Rauschen wie gemalt"""
    def fn(co, n):
        t = (co.z - unten) / max(1e-6, oben - unten)
        return 0.5 + 0.34 * t + 0.14 * n.z + 0.06 * noise.noise(co * 1.7)
    return fn


def rinde(co, n):
    return 0.62 + 0.2 * noise.noise(Vector((co.x * 2.5, co.y * 2.5, co.z * 0.6))) + 0.12 * n.z


# ── Modelle ──────────────────────────────────────────────────────────────────

def laubbaum(name, seed):
    r = random.Random(seed)
    bm = bmesh.new()
    # Stamm: Wurzelansatz, dann leicht krumm nach oben
    neige = Vector((r.uniform(-0.35, 0.35), r.uniform(-0.35, 0.35), 0))
    weg = [((0, 0, 0), 0.72), ((0, 0, 0.35), 0.46)]
    for i, z in enumerate((1.6, 3.2, 4.8, 6.0)):
        weg.append((Vector((0, 0, z)) + neige * (z / 6) ** 1.5 + Vector((r.uniform(-0.12, 0.12), r.uniform(-0.12, 0.12), 0)), 0.4 - i * 0.07))
    rohr(bm, weg, 8)
    spitze = Vector(weg[-1][0])
    aeste = []
    for k in range(r.randint(2, 3)):
        a = r.uniform(0, math.tau)
        ab = Vector(weg[r.randint(3, 4)][0])
        ende = ab + Vector((math.cos(a) * r.uniform(1.3, 2.0), math.sin(a) * r.uniform(1.3, 2.0), r.uniform(1.0, 1.8)))
        rohr(bm, [(ab, 0.17), ((ab + ende) / 2 + Vector((0, 0, 0.25)), 0.12), (ende, 0.06)], 5)
        aeste.append(ende)
    stamm = objekt(name + "_stamm", bm)
    helligkeit(stamm, rinde)

    bm = bmesh.new()
    # Krone: Wolke aus Kugeln um die Astenden
    for mitte in [spitze + Vector((0, 0, 0.9))] + aeste:
        kugel(bm, mitte + Vector((r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), r.uniform(0.1, 0.5))), r.uniform(1.25, 1.75), 2, r.uniform(0.75, 0.95))
    for k in range(r.randint(3, 5)):
        a = r.uniform(0, math.tau)
        kugel(bm, spitze + Vector((math.cos(a) * r.uniform(0.9, 1.9), math.sin(a) * r.uniform(0.9, 1.9), r.uniform(0.3, 1.9))), r.uniform(0.9, 1.4), 2, 0.85)
    krone = verschmelze(objekt(name + "_krone", bm), 0.3)
    bm = bmesh.new()
    bm.from_mesh(krone.data)
    beule(bm, 0.28, 0.9, seed)
    bm.to_mesh(krone.data)
    bm.free()
    vereinfache(krone, 340)
    zs = [v.co.z for v in krone.data.vertices]
    helligkeit(krone, laub_hell(min(zs), max(zs)))
    einpassen([stamm, krone], hoehe=1)
    return [stamm, krone]


def tanne(name, seed):
    r = random.Random(seed)
    H = 9.0
    bm = bmesh.new()
    rohr(bm, [((0, 0, 0), 0.5), ((0, 0, 0.3), 0.3), ((0, 0, H * 0.5), 0.2), ((0, 0, H * 0.92), 0.05)], 7)
    stamm = objekt(name + "_stamm", bm)
    helligkeit(stamm, rinde)

    gruen, weiss = bmesh.new(), bmesh.new()
    stufen = 6
    for s in range(stufen):
        t = s / (stufen - 1)
        unten = 2.2 + (H - 3.4) * t                      # Unterkante der Stufe
        hoch = (H - unten) * (0.62 if s < stufen - 1 else 1.0) + 0.25
        radius = (2.3 - 1.75 * t) * r.uniform(0.9, 1.08)
        zacken = 12
        dreh = r.uniform(0, math.tau)
        # Rand im Zickzack: jede zweite Ecke weiter außen und tiefer — hängende Zweige
        def rand(bmx, faktor, heben):
            return [bmx.verts.new((math.cos(dreh + k / zacken * math.tau) * radius * faktor * (1.0 if k % 2 else 0.74),
                                   math.sin(dreh + k / zacken * math.tau) * radius * faktor * (1.0 if k % 2 else 0.74),
                                   unten + heben - (0.34 if k % 2 else 0.0) * faktor)) for k in range(zacken)]
        aussen = rand(gruen, 1.0, 0.0)
        mitte = [gruen.verts.new((math.cos(dreh + k / zacken * math.tau) * radius * 0.42, math.sin(dreh + k / zacken * math.tau) * radius * 0.42, unten + hoch * 0.5)) for k in range(zacken)]
        spitze = gruen.verts.new((0, 0, unten + hoch))
        boden = gruen.verts.new((0, 0, unten + 0.35))
        for k in range(zacken):
            n = (k + 1) % zacken
            gruen.faces.new((aussen[k], aussen[n], mitte[n], mitte[k]))
            gruen.faces.new((mitte[k], mitte[n], spitze))
            gruen.faces.new((aussen[n], aussen[k], boden))
        # Schnee: liegt auf dem oberen Teil jeder Stufe
        sa = rand(weiss, 0.8, 0.16 + hoch * 0.12)
        sm = [weiss.verts.new((math.cos(dreh + k / zacken * math.tau) * radius * 0.4, math.sin(dreh + k / zacken * math.tau) * radius * 0.4, unten + hoch * 0.56)) for k in range(zacken)]
        ss = weiss.verts.new((0, 0, unten + hoch + 0.06))
        for k in range(zacken):
            n = (k + 1) % zacken
            weiss.faces.new((sa[k], sa[n], sm[n], sm[k]))
            weiss.faces.new((sm[k], sm[n], ss))
    krone = objekt(name + "_krone", gruen)
    helligkeit(krone, lambda co, n: 0.52 + 0.3 * (co.z / H) + 0.16 * n.z + 0.05 * noise.noise(co * 1.3))
    schnee = objekt(name + "_schnee", weiss)
    helligkeit(schnee, lambda co, n: 0.86 + 0.14 * n.z)
    einpassen([stamm, krone, schnee], hoehe=1)
    return [stamm, krone, schnee]


def palme(name, seed):
    r = random.Random(seed)
    H = 6.0
    bm = bmesh.new()
    # Stamm im Bogen, mit Wülsten wie Blattnarben
    lehne = Vector((math.cos(seed), math.sin(seed), 0)) * r.uniform(0.9, 1.7)
    weg = []
    n = 12
    for i in range(n + 1):
        t = i / n
        ort = Vector((0, 0, H * t)) + lehne * t * t
        weg.append((ort, (0.36 - 0.16 * t) * (1.12 if i % 2 else 0.94) + (0.14 if i == 0 else 0)))
    rohr(bm, weg, 8)
    stamm = objekt(name + "_stamm", bm)
    helligkeit(stamm, rinde)
    kopf = Vector(weg[-1][0])

    bm = bmesh.new()
    wedel = r.randint(8, 10)
    for w in range(wedel):
        a = w / wedel * math.tau + r.uniform(-0.2, 0.2)
        aus = Vector((math.cos(a), math.sin(a), 0))
        quer = Vector((-math.sin(a), math.cos(a), 0))
        lang = r.uniform(2.6, 3.4)
        steil = r.uniform(0.25, 0.75)
        vorher = None
        stationen = 7
        for i in range(stationen + 1):
            t = i / stationen
            mitte = kopf + aus * (lang * t) + Vector((0, 0, steil * math.sin(math.pi * t * 0.8) * 1.2 - (t ** 2.2) * lang * 0.62))
            breit = 0.52 * math.sin(math.pi * (0.08 + 0.92 * t)) ** 0.8 * (0.72 if i % 2 else 1.0)
            # V-förmiger Querschnitt: die Rippe liegt höher als die Ränder
            jetzt = (bm.verts.new(mitte - quer * breit - Vector((0, 0, breit * 0.45))), bm.verts.new(mitte), bm.verts.new(mitte + quer * breit - Vector((0, 0, breit * 0.45))))
            if vorher:
                bm.faces.new((vorher[0], vorher[1], jetzt[1], jetzt[0]))
                bm.faces.new((vorher[1], vorher[2], jetzt[2], jetzt[1]))
            vorher = jetzt
    # ein Schopf in der Mitte, damit man nicht durchsieht
    kugel(bm, kopf, 0.34, 1)
    krone = objekt(name + "_krone", bm)
    helligkeit(krone, lambda co, nn: 0.58 + 0.3 * abs(nn.z) + 0.1 * noise.noise(co * 2.0) + 0.06 * ((co - kopf).length / 3.4))
    einpassen([stamm, krone], hoehe=1)
    return [stamm, krone]


def fels(name, seed):
    r = random.Random(seed)
    bm = bmesh.new()
    kugel(bm, (0, 0, 0), 1.0, 3)
    if r.random() < 0.6:
        kugel(bm, (r.uniform(0.4, 0.8), r.uniform(-0.5, 0.5), -0.2), r.uniform(0.5, 0.75), 3)
    o = objekt(name + "_stein", bm)
    verschmelze(o, 0.13)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    beule(bm, 0.42, 0.75, seed * 3.1)
    beule(bm, 0.12, 2.4, seed * 1.7)
    for v in bm.verts:
        v.co.z = max(-0.3, v.co.z * r.uniform(0.75, 0.8))   # unten flach: liegt auf dem Boden
    bm.to_mesh(o.data)
    bm.free()
    vereinfache(o, 130, glatt=False)
    helligkeit(o, lambda co, n: 0.6 + 0.3 * n.z + 0.12 * noise.noise(co * 2.2))
    einpassen([o], breite=1)
    return [o]


def busch(name, seed):
    r = random.Random(seed)
    bm = bmesh.new()
    for k in range(r.randint(4, 6)):
        a = r.uniform(0, math.tau)
        kugel(bm, (math.cos(a) * r.uniform(0, 0.55), math.sin(a) * r.uniform(0, 0.55), r.uniform(0.3, 0.7)), r.uniform(0.4, 0.62), 2)
    o = verschmelze(objekt(name + "_krone", bm), 0.12)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    beule(bm, 0.14, 2.2, seed * 2.3)
    for v in bm.verts:
        v.co.z = max(0.0, v.co.z)
    bm.to_mesh(o.data)
    bm.free()
    vereinfache(o, 170)
    zs = [v.co.z for v in o.data.vertices]
    helligkeit(o, laub_hell(min(zs), max(zs)))
    einpassen([o], breite=1)
    return [o]


def kaktus(name, seed):
    r = random.Random(seed)
    bm = bmesh.new()

    def saeule(start, ende, radius):
        """gerippte Säule mit runder Kuppe"""
        start, ende = Vector(start), Vector(ende)
        achse = (ende - start)
        lang = achse.length
        q = Vector((0, 0, 1)).rotation_difference(achse.normalized()).to_matrix().to_4x4()
        rippen, ringe = 10, []
        profil = [(0.0, 0.8), (0.15, 1.0), (0.8, 1.0), (0.92, 0.82), (1.0, 0.4)]
        for t, f in profil:
            ringe.append([bm.verts.new(Matrix.Translation(start) @ q @ Vector((
                math.cos(k / (rippen * 2) * math.tau) * radius * f * (1.0 if k % 2 else 0.8),
                math.sin(k / (rippen * 2) * math.tau) * radius * f * (1.0 if k % 2 else 0.8), lang * t))) for k in range(rippen * 2)])
        for a, b in zip(ringe, ringe[1:]):
            for k in range(rippen * 2):
                bm.faces.new((a[k], a[(k + 1) % (rippen * 2)], b[(k + 1) % (rippen * 2)], b[k]))
        bm.faces.new(ringe[-1])

    saeule((0, 0, 0), (0, 0, 3.0), 0.42)
    for seite in (1, -1):
        if seite < 0 and r.random() < 0.3:
            continue
        hoch = r.uniform(1.0, 1.7)
        knie = Vector((seite * r.uniform(0.75, 0.95), 0, hoch))
        saeule((seite * 0.3, 0, hoch - 0.05), knie + Vector((seite * 0.1, 0, 0)), 0.24)
        saeule(knie - Vector((0, 0, 0.12)), knie + Vector((0, 0, r.uniform(0.8, 1.3))), 0.24)
    o = objekt(name + "_krone", bm)
    helligkeit(o, lambda co, n: 0.66 + 0.2 * n.z + 0.14 * (math.sqrt(co.x ** 2 + co.y ** 2) > 0.36))
    einpassen([o], hoehe=1)
    return [o]


def stumpf(name, seed):
    r = random.Random(seed)
    bm = bmesh.new()
    rohr(bm, [((0, 0, 0), 0.95), ((0, 0, 0.25), 0.62), ((0, 0, 0.8), 0.55), ((r.uniform(-0.05, 0.05), 0, 1.0), 0.56)], 10)
    # Wurzeln
    for k in range(4):
        a = k / 4 * math.tau + r.uniform(-0.3, 0.3)
        rohr(bm, [((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.3), 0.2), ((math.cos(a) * 1.0, math.sin(a) * 1.0, 0.05), 0.12), ((math.cos(a) * 1.35, math.sin(a) * 1.35, -0.05), 0.05)], 5)
    o = objekt(name + "_stamm", bm)
    # die Schnittfläche oben ist hell
    helligkeit(o, lambda co, n: 1.0 if co.z > 0.97 and n.z > 0.7 else rinde(co, n))
    einpassen([o], hoehe=1)
    return [o]


# ── Bauen ────────────────────────────────────────────────────────────────────

def alles():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    modelle = []
    for i in (1, 2, 3):
        modelle.append(laubbaum(f"laubbaum{i}", 10 + i))
    for i in (1, 2):
        modelle.append(tanne(f"tanne{i}", 20 + i))
    for i in (1, 2):
        modelle.append(palme(f"palme{i}", 30 + i))
    for i in (1, 2, 3):
        modelle.append(fels(f"fels{i}", 40 + i))
    for i in (1, 2):
        modelle.append(busch(f"busch{i}", 50 + i))
    modelle.append(kaktus("kaktus1", 61))
    modelle.append(stumpf("stumpf1", 71))
    for teile in modelle:
        for o in teile:
            material(o)
    return modelle


def uebersicht(modelle, datei):
    """alle Modelle nebeneinander rendern (nur zum Ansehen; die Kopien verschwinden danach)"""
    szene = bpy.context.scene
    kopien = []
    x = 0.0
    for teile in modelle:
        gross = 6.0 if any(o.name.split("_")[0][:-1] in ("laubbaum", "tanne", "palme") for o in teile) else 1.6
        for o in teile:
            k = o.copy()
            k.location = (x, 0, 0)
            k.scale = (gross, gross, gross)
            szene.collection.objects.link(k)
            kopien.append(k)
        x += 5.2 if gross > 3 else 2.4
    kam_daten = bpy.data.cameras.new("Kamera")
    kam_daten.type = "ORTHO"
    kam_daten.ortho_scale = x + 2
    kam = bpy.data.objects.new("Kamera", kam_daten)
    kam.location = (x / 2 - 2.4, -40, 9)
    kam.rotation_euler = (math.radians(80), 0, 0)
    szene.collection.objects.link(kam)
    szene.camera = kam
    sonne = bpy.data.objects.new("Sonne", bpy.data.lights.new("Sonne", "SUN"))
    sonne.rotation_euler = (math.radians(50), 0, math.radians(30))
    sonne.data.energy = 3
    szene.collection.objects.link(sonne)
    szene.render.engine = "BLENDER_WORKBENCH"
    szene.display.shading.light = "STUDIO"
    szene.display.shading.color_type = "VERTEX"
    szene.render.resolution_x, szene.render.resolution_y = 2000, 560
    szene.render.film_transparent = False
    szene.render.filepath = datei
    bpy.ops.render.render(write_still=True)
    for k in kopien + [kam, sonne]:
        bpy.data.objects.remove(k)


if __name__ == "__main__":
    modelle = alles()
    os.makedirs(ZIEL, exist_ok=True)
    if BILD:
        uebersicht(modelle, os.path.abspath(BILD))
    for o in bpy.context.scene.collection.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ZIEL, "welten.glb"), export_format="GLB", export_apply=True, export_yup=True,
                              export_vertex_color="ACTIVE", export_materials="NONE" if False else "EXPORT",
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    dreiecke = {}
    for o in bpy.context.scene.collection.objects:
        o.data.calc_loop_triangles()
        dreiecke[o.name] = len(o.data.loop_triangles)
    print("WELTEN", sum(dreiecke.values()), dreiecke)
