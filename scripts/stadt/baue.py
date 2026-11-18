"""Modelle für die 3D-Stadt der Stadtentwicklung (Häuser, Dächer, Wahrzeichen).

Aufruf:
    blender -b --factory-startup --python scripts/stadt/baue.py -- frontend/public/modelle/stadt
    … -- <zielordner> --bild <datei.png>   rendert zusätzlich eine Übersicht

Ergebnis: stadt.glb. Jedes Modell besteht aus benannten Teilen <modell>_<teil> mit teil ∈ wand, dach, akzent.
Die Teile tragen nur Helligkeit je Ecke (unten dunkler, Dachflächen heller); die Farbe setzt das Frontend
(components/stadt/drei/modelle.ts) je Teil. Maße:
    haus_wand        Grundfläche 1 × 1 (x = an der Straße, y = Tiefe), Höhe 1 — Fenster malt der Shader
    dach_sattel/walm/flach/mansard   Grundfläche 1 × 1, Höhe 1 — sitzt auf der Wand, das Frontend streckt es
    alle Wahrzeichen Grundfläche 1 × 1, Höhe 1 — das Frontend streckt auf Breite, Tiefe, Höhe des Bauwerks
Blender: z oben; der glTF-Export dreht auf y oben (x bleibt, Blender-y wird zu −z).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/stadt"
BILD = ARGS[ARGS.index("--bild") + 1] if "--bild" in ARGS else None


# ── Grundlagen ───────────────────────────────────────────────────────────────

def objekt(name, bm, glatt=False):
    me = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = glatt
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def quader(bm, x0, y0, z0, x1, y1, z1):
    m = Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1))
    bmesh.ops.create_cube(bm, size=1, matrix=m)


def walze(bm, x, y, z0, z1, r1, r2=None, seiten=16):
    """Zylinder bzw. Kegelstumpf (r2 = 0: Spitze)"""
    m = Matrix.Translation((x, y, (z0 + z1) / 2))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seiten, radius1=r1, radius2=r1 if r2 is None else r2, depth=z1 - z0, matrix=m)


def kuppel(bm, x, y, z, r, flach=1.0, seiten=16):
    m = Matrix.Translation((x, y, z)) @ Matrix.Diagonal((1, 1, flach, 1))
    bmesh.ops.create_uvsphere(bm, u_segments=seiten, v_segments=max(6, seiten // 2), radius=r, matrix=m)


def giebel(bm, x0, y0, x1, y1, z0, z1, laengs=True):
    """Satteldach-Prisma über dem Rechteck; First längs x (laengs) oder längs y"""
    if laengs:
        ym = (y0 + y1) / 2
        v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, ym, z1), (x1, ym, z1))]
        faces = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    else:
        xm = (x0 + x1) / 2
        v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (xm, y0, z1), (xm, y1, z1))]
        faces = [(1, 2, 5, 4), (3, 0, 4, 5), (0, 1, 4), (2, 3, 5), (0, 3, 2, 1)]
    for f in faces:
        bm.faces.new([v[i] for i in f])


def walmdach(bm, x0, y0, x1, y1, z0, z1, first=0.5):
    """Walmdach: First kürzer als die Traufe"""
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    d = (x1 - x0) * (1 - first) / 2
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0 + d, ym, z1), (x1 - d, ym, z1))]
    for f in ((0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)):
        bm.faces.new([v[i] for i in f])


def pyramide(bm, x, y, z0, z1, r, seiten=4):
    walze(bm, x, y, z0, z1, r, 0.0001, seiten)


def helligkeit(o, fn=None):
    """Helligkeit je Ecke: unten dunkler (Umgebungsverdeckung), oben hell"""
    me = o.data
    attr = me.color_attributes.new("Farbe", "FLOAT_COLOR", "POINT")
    zs = [v.co.z for v in me.vertices] or [0]
    lo, hi = min(zs), max(zs)
    for v in me.vertices:
        t = (v.co.z - lo) / (hi - lo + 1e-6)
        h = fn(v.co, v.normal, t) if fn else 0.72 + 0.28 * t
        h = max(0.0, min(1.0, h))
        attr.data[v.index].color = (h, h, h, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0


def material(o):
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


def einpassen(teile):
    """alle Teile gemeinsam auf Grundfläche 1 × 1 (Mitte im Ursprung) und Höhe 1 (Fuß auf z = 0) bringen"""
    punkte = [v.co for o in teile for v in o.data.vertices]
    x0, x1 = min(p.x for p in punkte), max(p.x for p in punkte)
    y0, y1 = min(p.y for p in punkte), max(p.y for p in punkte)
    z0, z1 = min(p.z for p in punkte), max(p.z for p in punkte)
    m = Matrix.Diagonal((1 / (x1 - x0), 1 / (y1 - y0), 1 / (z1 - z0), 1)) @ Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -z0))
    for o in teile:
        o.data.transform(m)
        o.data.update()


def modell(name, bauer, einpassen_=True):
    """bauer(teile) füllt die bmeshes {wand, dach, akzent}; leere Teile entfallen"""
    teile = {k: bmesh.new() for k in ("wand", "dach", "akzent")}
    bauer(teile)
    objs = []
    for k, bm in teile.items():
        if not bm.verts:
            bm.free()
            continue
        objs.append(objekt(f"{name}_{k}", bm))
    if einpassen_:
        einpassen(objs)
    for o in objs:
        helligkeit(o, (lambda co, n, t: 0.82 + 0.18 * max(0.0, n.z)) if o.name.endswith("_dach") else None)
        material(o)
    return objs


# ── Häuser ───────────────────────────────────────────────────────────────────

def haus_wand(t):
    # Sockel etwas breiter, Gesims oben
    quader(t["wand"], -0.5, -0.5, 0.0, 0.5, 0.5, 1.0)
    quader(t["wand"], -0.51, -0.51, 0.0, 0.51, 0.51, 0.06)
    quader(t["wand"], -0.515, -0.515, 0.965, 0.515, 0.515, 1.0)


def dach_sattel(t):
    giebel(t["dach"], -0.5, -0.5, 0.5, 0.5, 0.0, 1.0)
    quader(t["akzent"], 0.18, 0.08, 0.35, 0.28, 0.2, 1.02)          # Schornstein


def dach_walm(t):
    walmdach(t["dach"], -0.5, -0.5, 0.5, 0.5, 0.0, 1.0, 0.45)


def dach_flach(t):
    quader(t["dach"], -0.5, -0.5, 0.0, 0.5, 0.5, 0.35)
    for x0, y0, x1, y1 in ((-0.5, -0.5, 0.5, -0.45), (-0.5, 0.45, 0.5, 0.5), (-0.5, -0.5, -0.45, 0.5), (0.45, -0.5, 0.5, 0.5)):
        quader(t["dach"], x0, y0, 0.35, x1, y1, 1.0)                  # Attika
    quader(t["akzent"], -0.2, -0.15, 0.35, 0.05, 0.1, 0.8)            # Aufzugshaus


def dach_mansard(t):
    # steiles Untergeschoss, flaches Oberdach
    bm = t["dach"]
    v = [bm.verts.new(p) for p in ((-0.5, -0.5, 0), (0.5, -0.5, 0), (0.5, 0.5, 0), (-0.5, 0.5, 0),
                                    (-0.4, -0.4, 0.7), (0.4, -0.4, 0.7), (0.4, 0.4, 0.7), (-0.4, 0.4, 0.7), (0, -0.1, 1.0), (0, 0.1, 1.0))]
    for f in ((0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 8), (6, 7, 9), (5, 6, 9, 8), (7, 4, 8, 9), (0, 3, 2, 1)):
        bm.faces.new([v[i] for i in f])


# ── Wahrzeichen ──────────────────────────────────────────────────────────────

def kirche(t):
    quader(t["wand"], -0.5, -0.22, 0, 0.35, 0.22, 0.42)                  # Schiff
    giebel(t["dach"], -0.52, -0.25, 0.37, 0.25, 0.42, 0.62)
    walze(t["wand"], -0.5, 0, 0, 0.42, 0.2, None, 12)                   # Apsis
    kuppel(t["dach"], -0.5, 0, 0.42, 0.2, 0.6, 12)
    quader(t["wand"], 0.3, -0.12, 0, 0.5, 0.12, 0.72)                   # Turm
    quader(t["wand"], 0.29, -0.13, 0.62, 0.51, 0.13, 0.66)
    pyramide(t["akzent"], 0.4, 0, 0.72, 1.0, 0.16, 8)                  # Spitzhelm


def kathedrale(t):
    quader(t["wand"], -0.5, -0.25, 0, 0.3, 0.25, 0.48)
    giebel(t["dach"], -0.52, -0.27, 0.32, 0.27, 0.48, 0.66)
    quader(t["wand"], -0.15, -0.45, 0, 0.05, 0.45, 0.4)                  # Querhaus
    giebel(t["dach"], -0.17, -0.47, 0.07, 0.47, 0.4, 0.58, False)
    for s in (-1, 1):
        quader(t["wand"], 0.3, s * 0.25 - 0.1, 0, 0.5, s * 0.25 + 0.1, 0.8)
        pyramide(t["akzent"], 0.4, s * 0.25, 0.8, 1.0, 0.11, 8)
    kuppel(t["akzent"], -0.05, 0, 0.6, 0.12, 1.0, 12)


def burg(t):
    quader(t["wand"], -0.45, -0.45, 0, 0.45, 0.45, 0.32)                # Ringmauer (massiv, Hof ist Dachfläche)
    for x in (-0.42, 0.42):
        for y in (-0.42, 0.42):
            walze(t["wand"], x, y, 0, 0.45, 0.08, None, 10)
            walze(t["dach"], x, y, 0.45, 0.62, 0.095, 0.0001, 10)
    quader(t["wand"], -0.15, -0.15, 0, 0.15, 0.15, 0.85)                # Bergfried
    for i in range(8):                                                  # Zinnen
        a = i / 8 * math.tau
        quader(t["wand"], math.cos(a) * 0.12 - 0.025, math.sin(a) * 0.12 - 0.025, 0.85, math.cos(a) * 0.12 + 0.025, math.sin(a) * 0.12 + 0.025, 0.92)
    quader(t["akzent"], 0.0, -0.005, 0.92, 0.01, 0.005, 1.0)             # Fahnenstange


def schloss(t):
    quader(t["wand"], -0.5, -0.12, 0, 0.5, 0.12, 0.55)                  # Corps de Logis
    walmdach(t["dach"], -0.5, -0.13, 0.5, 0.13, 0.55, 0.78, 0.8)
    for s in (-1, 1):                                                  # Flügel
        x0, x1 = (0.36, 0.5) if s > 0 else (-0.5, -0.36)
        quader(t["wand"], x0, -0.5, 0, x1, 0.12, 0.5)
        walmdach(t["dach"], x0 - 0.005, -0.5, x1 + 0.005, 0.12, 0.5, 0.68, 0.7)
    quader(t["wand"], -0.1, -0.16, 0, 0.1, 0.16, 0.7)                   # Mittelpavillon
    walze(t["wand"], 0, 0, 0.7, 0.8, 0.08, None, 16)
    kuppel(t["akzent"], 0, 0, 0.8, 0.09, 1.6, 16)


def tempel(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.5, 0.18)                    # Podium
    quader(t["wand"], -0.3, -0.25, 0.18, 0.3, 0.42, 0.7)                 # Cella
    for i in range(6):                                                  # Säulen vorn
        walze(t["akzent"], -0.4 + i * 0.16, -0.4, 0.18, 0.7, 0.035, None, 8)
    for i in range(1, 5):
        for s in (-1, 1):
            walze(t["akzent"], s * 0.4, -0.4 + i * 0.18, 0.18, 0.7, 0.035, None, 8)
    giebel(t["dach"], -0.46, -0.48, 0.46, 0.48, 0.7, 1.0, False)


def kolonnade(t):
    """Forum, Plaza mit Arkaden: niedriger Ring aus Säulengängen"""
    for x0, y0, x1, y1 in ((-0.5, -0.5, 0.5, -0.4), (-0.5, 0.4, 0.5, 0.5), (-0.5, -0.4, -0.4, 0.4), (0.4, -0.4, 0.5, 0.4)):
        quader(t["wand"], x0, y0, 0, x1, y1, 0.75)
        giebel(t["dach"], x0, y0, x1, y1, 0.75, 1.0, (x1 - x0) > (y1 - y0))


def arena(t, halb=False):
    for k, (r, z) in enumerate(((0.5, 0.75), (0.42, 1.0))):
        walze(t["wand"] if k == 0 else t["dach"], 0, 0, 0, z, r, r * 0.97, 32)
    walze(t["akzent"], 0, 0, 0.75, 1.01, 0.28, 0.28, 32)               # Arena-Sand (Deckel)
    if halb:
        bmesh.ops.delete(t["wand"], geom=[v for v in t["wand"].verts if v.co.y > 0.02], context="VERTS")


def foerderturm(t):
    quader(t["wand"], -0.5, -0.3, 0, 0.0, 0.3, 0.3)                      # Maschinenhaus
    giebel(t["dach"], -0.5, -0.32, 0.0, 0.32, 0.3, 0.4)
    for x in (0.1, 0.4):                                               # Gerüst: vier Beine, Streben
        for y in (-0.15, 0.15):
            quader(t["akzent"], x - 0.015, y - 0.015, 0, x + 0.015, y + 0.015, 0.92)
    for z in (0.25, 0.5, 0.75):
        quader(t["akzent"], 0.09, -0.16, z, 0.41, 0.16, z + 0.02)
    quader(t["akzent"], 0.0, -0.01, 0.35, 0.3, 0.01, 0.37)               # Strebe zum Maschinenhaus
    for y in (-0.12, 0.12):                                             # Seilscheiben
        walze(t["akzent"], 0.25, y, 0.93, 0.97, 0.13, None, 16)
    quader(t["akzent"], 0.08, -0.17, 0.92, 0.42, 0.17, 0.94)


def hochofen(t):
    walze(t["wand"], 0.15, 0, 0, 0.75, 0.16, 0.11, 16)                  # Ofen
    walze(t["akzent"], 0.15, 0, 0.75, 0.9, 0.06, 0.06, 10)
    for x, y in ((-0.25, -0.3), (-0.25, 0.3), (-0.45, 0)):              # Winderhitzer
        walze(t["wand"], x, y, 0, 0.6, 0.08, None, 12)
        kuppel(t["dach"], x, y, 0.6, 0.08, 1.0, 12)
    walze(t["wand"], 0.42, 0.3, 0, 1.0, 0.04, 0.03, 10)                  # Schlot
    quader(t["wand"], -0.5, -0.5, 0, 0.5, -0.35, 0.25)                   # Gießhalle
    giebel(t["dach"], -0.5, -0.5, 0.5, -0.35, 0.25, 0.33)
    quader(t["akzent"], -0.25, -0.01, 0.55, 0.15, 0.01, 0.58)            # Rohr


def fabrik(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.5, 0.45)
    for i in range(5):                                                  # Sheddach
        y0 = -0.5 + i * 0.2
        bm = t["dach"]
        v = [bm.verts.new(p) for p in ((-0.5, y0, 0.45), (0.5, y0, 0.45), (0.5, y0 + 0.2, 0.45), (-0.5, y0 + 0.2, 0.45), (-0.5, y0 + 0.2, 0.62), (0.5, y0 + 0.2, 0.62))]
        for f in ((0, 1, 5, 4), (1, 2, 5), (0, 4, 3), (3, 4, 5, 2), (0, 3, 2, 1)):
            bm.faces.new([v[k] for k in f])
    walze(t["akzent"], 0.4, 0.4, 0, 1.0, 0.05, 0.035, 10)               # Schornstein


def kran(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.5, 0.08)                     # Kaimauer
    for x in (-0.15, 0.15):                                             # Portal
        for y in (-0.15, 0.15):
            quader(t["akzent"], x - 0.02, y - 0.02, 0.08, x + 0.02, y + 0.02, 0.6)
    quader(t["akzent"], -0.18, -0.18, 0.6, 0.18, 0.18, 0.7)              # Maschinenhaus
    quader(t["akzent"], -0.03, -0.5, 0.7, 0.03, 0.5, 0.74)               # Ausleger über dem Wasser
    quader(t["akzent"], -0.01, -0.02, 0.74, 0.01, 0.02, 1.0)             # Spitze
    quader(t["dach"], -0.4, 0.25, 0.08, -0.25, 0.45, 0.2)                # Container
    quader(t["dach"], 0.25, 0.25, 0.08, 0.4, 0.45, 0.2)


def leuchtturm(t):
    walze(t["wand"], 0, 0, 0, 0.33, 0.32, 0.27, 16)
    walze(t["akzent"], 0, 0, 0.33, 0.55, 0.27, 0.23, 16)
    walze(t["wand"], 0, 0, 0.55, 0.78, 0.23, 0.2, 16)
    walze(t["dach"], 0, 0, 0.78, 0.82, 0.3, None, 16)                    # Galerie
    walze(t["akzent"], 0, 0, 0.82, 0.92, 0.16, None, 12)                 # Laterne
    kuppel(t["dach"], 0, 0, 0.92, 0.17, 0.6, 12)


def moschee(t):
    quader(t["wand"], -0.45, -0.45, 0, 0.3, 0.45, 0.4)                   # Gebetshalle
    walze(t["wand"], -0.08, 0, 0.4, 0.5, 0.22, None, 16)
    kuppel(t["dach"], -0.08, 0, 0.5, 0.23, 0.9, 16)
    walze(t["wand"], 0.42, 0.38, 0, 0.9, 0.06, None, 8)                  # Minarett
    walze(t["akzent"], 0.42, 0.38, 0.9, 1.0, 0.075, 0.0001, 8)
    quader(t["wand"], 0.3, -0.45, 0, 0.5, 0.45, 0.2)                     # Hofmauer


def bahnhof(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, -0.2, 0.5)                     # Empfangsgebäude
    walmdach(t["dach"], -0.5, -0.5, 0.5, -0.2, 0.5, 0.65, 0.8)
    quader(t["wand"], -0.06, -0.52, 0, 0.06, -0.38, 0.85)                # Uhrturm
    pyramide(t["akzent"], 0, -0.45, 0.85, 1.0, 0.09, 4)
    bm = t["dach"]                                                     # Bahnsteighalle als Tonne
    seg = 10
    ring0, ring1 = [], []
    for k in range(seg + 1):
        a = math.pi * k / seg
        x, z = -0.45 * math.cos(a), 0.15 + 0.4 * math.sin(a)
        ring0.append(bm.verts.new((x, -0.2, z)))
        ring1.append(bm.verts.new((x, 0.5, z)))
    for k in range(seg):
        bm.faces.new((ring0[k], ring0[k + 1], ring1[k + 1], ring1[k]))


def hochhaus(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.5, 0.6)
    quader(t["wand"], -0.38, -0.38, 0.6, 0.38, 0.38, 0.85)               # Rücksprung
    quader(t["wand"], -0.24, -0.24, 0.85, 0.24, 0.24, 0.95)
    pyramide(t["akzent"], 0, 0, 0.95, 1.0, 0.03, 4)                      # Antenne
    quader(t["dach"], -0.5, -0.5, 0.6, 0.5, 0.5, 0.61)


def silo(t):
    for x in (-0.33, 0, 0.33):
        walze(t["wand"], x, 0.1, 0, 0.82, 0.16, None, 16)
        kuppel(t["dach"], x, 0.1, 0.82, 0.16, 0.4, 16)
    quader(t["wand"], -0.5, -0.5, 0, 0.5, -0.1, 0.35)
    quader(t["akzent"], -0.08, -0.12, 0.82, 0.08, 0.12, 1.0)             # Elevatorkopf


def muehle(t):
    quader(t["wand"], -0.5, -0.4, 0, 0.3, 0.4, 0.55)
    giebel(t["dach"], -0.52, -0.42, 0.32, 0.42, 0.55, 1.0)
    m = Matrix.Translation((0.4, 0, 0.4)) @ Matrix.Rotation(math.pi / 2, 4, "Y")
    bmesh.ops.create_cone(t["akzent"], cap_ends=True, segments=16, radius1=0.4, radius2=0.4, depth=0.12, matrix=m)  # Wasserrad


def tor(t):
    quader(t["wand"], -0.5, -0.5, 0, -0.18, 0.5, 0.75)
    quader(t["wand"], 0.18, -0.5, 0, 0.5, 0.5, 0.75)
    quader(t["wand"], -0.18, -0.5, 0.45, 0.18, 0.5, 0.75)
    giebel(t["dach"], -0.52, -0.52, 0.52, 0.52, 0.75, 1.0, False)


def rathaus(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.5, 0.55)
    giebel(t["dach"], -0.52, -0.52, 0.52, 0.52, 0.55, 0.8)
    quader(t["wand"], -0.1, -0.56, 0, 0.1, -0.36, 0.85)                  # Turm an der Front
    pyramide(t["akzent"], 0, -0.46, 0.85, 1.0, 0.12, 8)


def kuppelbau(t):
    """Thermen, Kulturhaus, Universität: Hauptbau mit Kuppel und Säulenportal"""
    quader(t["wand"], -0.5, -0.4, 0, 0.5, 0.4, 0.55)
    quader(t["dach"], -0.52, -0.42, 0.55, 0.52, 0.42, 0.6)
    walze(t["wand"], 0, 0, 0.6, 0.72, 0.22, None, 16)
    kuppel(t["akzent"], 0, 0, 0.72, 0.22, 1.2, 16)
    for i in range(6):
        walze(t["wand"], -0.25 + i * 0.1, -0.47, 0, 0.5, 0.025, None, 8)
    giebel(t["dach"], -0.3, -0.5, 0.3, -0.4, 0.5, 0.62, False)


def campus(t):
    """flacher Bürobau mit Innenhof und Glasband"""
    for x0, y0, x1, y1 in ((-0.5, -0.5, 0.5, -0.25), (-0.5, 0.25, 0.5, 0.5), (-0.5, -0.25, -0.25, 0.25), (0.25, -0.25, 0.5, 0.25)):
        quader(t["wand"], x0, y0, 0, x1, y1, 0.8)
        quader(t["akzent"], x0 - 0.005, y0 - 0.005, 0.8, x1 + 0.005, y1 + 0.005, 1.0)
        quader(t["dach"], x0, y0, 1.0, x1, y1, 1.0001)


def festungsbau(t):
    """Zitadelle, Kasbah: wuchtiger Block mit Ecktürmen und Zinnen"""
    quader(t["wand"], -0.45, -0.45, 0, 0.45, 0.45, 0.6)
    for x in (-0.45, 0.45):
        for y in (-0.45, 0.45):
            quader(t["wand"], x - 0.08, y - 0.08, 0, x + 0.08, y + 0.08, 0.85)
            quader(t["dach"], x - 0.09, y - 0.09, 0.85, x + 0.09, y + 0.09, 1.0)
    quader(t["dach"], -0.46, -0.46, 0.6, 0.46, 0.46, 0.66)


def kaserne(t):
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.5, 0.6)
    walmdach(t["dach"], -0.52, -0.52, 0.52, 0.52, 0.6, 1.0, 0.85)


def kontor(t):
    """Hafenkontor: Speicherhaus mit Treppengiebeln, Ladeluken-Gaube, Kai und Ladekran zur Wasserseite (+y)"""
    quader(t["wand"], -0.5, -0.5, 0, 0.5, 0.2, 0.62)                     # Speicher
    giebel(t["dach"], -0.52, -0.52, 0.52, 0.22, 0.62, 0.95, False)      # First quer: Giebel zu Stadt und Wasser
    for s in (-1, 1):                                                  # Treppengiebel an beiden Enden
        y0 = -0.53 if s < 0 else 0.19
        for k in range(4):
            b = 0.46 - k * 0.11
            quader(t["wand"], -b, y0, 0.62 + k * 0.08, b, y0 + 0.04, 0.68 + k * 0.08)
    quader(t["akzent"], -0.07, 0.18, 0.66, 0.07, 0.3, 0.86)               # Ladeluke mit Kranbalken
    quader(t["akzent"], -0.015, 0.2, 0.84, 0.015, 0.42, 0.87)
    quader(t["dach"], -0.5, 0.2, 0, 0.5, 0.5, 0.06)                       # Kai
    for x in (-0.38, -0.12, 0.14, 0.4):                                  # Poller
        walze(t["akzent"], x, 0.46, 0.06, 0.12, 0.02, None, 6)
    quader(t["akzent"], 0.3, 0.3, 0.06, 0.34, 0.34, 0.5)                 # Tretkran: Mast und Ausleger
    quader(t["akzent"], 0.3, 0.3, 0.48, 0.34, 0.55, 0.51)
    quader(t["dach"], -0.35, 0.28, 0.06, -0.2, 0.4, 0.16)                # Fässer und Ballen
    quader(t["dach"], -0.15, 0.3, 0.06, -0.05, 0.38, 0.13)


MODELLE = {
    "haus_wand": haus_wand, "dach_sattel": dach_sattel, "dach_walm": dach_walm, "dach_flach": dach_flach, "dach_mansard": dach_mansard,
    "kirche": kirche, "kathedrale": kathedrale, "burg": burg, "schloss": schloss, "tempel": tempel, "kolonnade": kolonnade,
    "arena": arena, "theater": lambda t: arena(t, True), "foerderturm": foerderturm, "hochofen": hochofen, "fabrik": fabrik,
    "kran": kran, "leuchtturm": leuchtturm, "moschee": moschee, "bahnhof": bahnhof, "hochhaus": hochhaus, "silo": silo,
    "muehle": muehle, "tor": tor, "rathaus": rathaus, "kuppelbau": kuppelbau, "campus": campus, "festungsbau": festungsbau,
    "kaserne": kaserne, "kontor": kontor,
}


def uebersicht(alle, datei):
    szene = bpy.context.scene
    kopien = []
    for i, teile in enumerate(alle):
        for o in teile:
            k = o.copy()
            k.location = ((i % 10) * 1.6, -(i // 10) * 1.8, 0)
            szene.collection.objects.link(k)
            kopien.append(k)
    kam = bpy.data.objects.new("Kamera", bpy.data.cameras.new("Kamera"))
    kam.data.type = "ORTHO"
    kam.data.ortho_scale = 17
    kam.location = (7.2, -14, 9)
    kam.rotation_euler = (math.radians(58), 0, 0)
    szene.collection.objects.link(kam)
    szene.camera = kam
    szene.render.engine = "BLENDER_WORKBENCH"
    szene.display.shading.light = "STUDIO"
    szene.display.shading.color_type = "VERTEX"
    szene.render.resolution_x, szene.render.resolution_y = 1800, 900
    szene.render.filepath = datei
    bpy.ops.render.render(write_still=True)
    for k in kopien + [kam]:
        bpy.data.objects.remove(k)


if __name__ == "__main__":
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    alle = [modell(n, f) for n, f in MODELLE.items()]
    os.makedirs(ZIEL, exist_ok=True)
    if BILD:
        uebersicht(alle, os.path.abspath(BILD))
    for o in bpy.context.scene.collection.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ZIEL, "stadt.glb"), export_format="GLB", export_apply=True, export_yup=True,
                              export_vertex_color="ACTIVE", export_materials="EXPORT",
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    dreiecke = {}
    for o in bpy.context.scene.collection.objects:
        o.data.calc_loop_triangles()
        dreiecke[o.name] = len(o.data.loop_triangles)
    print("STADT", len(dreiecke), sum(dreiecke.values()))
