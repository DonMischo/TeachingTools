"""Bausatz für Haus und Verlies des TaskCrawlers: Mauern, Pfeiler, Bodenplatten, Torbögen, Stufen.

Aufruf:
    blender -b --factory-startup --python scripts/bausatz/baue.py -- frontend/public/modelle/bausatz
    … -- <zielordner> --bild <datei.png>   rendert zusätzlich ein kleines Verlies aus den Teilen (Cycles)

Ergebnis ist je Stil eine Datei <stil>.glb (bisher: verlies.glb). Die Teile heißen
    verlies_mauer1 … mauer4   Mauerstück 2,2 lang (x), 0,3 dick (y), 1,5 hoch; 3 = mit Fackel, 4 = mit Ketten
    verlies_pfeiler           Eckpfeiler 0,3 × 0,3 (etwas dicker gemauert), 1,68 hoch
    verlies_block             ganzes Feld 2,2 × 2,2 voll gemauert
    verlies_boden1 … boden3   Bodenplatte 2,2 × 2,2, 0,25 dick
    verlies_bodenschmal       Bodenstreifen 2,2 × 0,3
    verlies_bodenklein        Bodenstück 0,3 × 0,3
    verlies_bogen             Torbogen über einem Durchgang 2,2 breit (x)
    verlies_stufe             Stufe 2,2 × 0,44, 1 hoch (wird im Spiel in der Höhe gestreckt)
Ein Teil, das leuchtet (Fackelflamme), heißt <teil>__glut. Alle Teile stehen mit dem Fuß auf z = 0 und
der Mitte im Ursprung. Die Ecken tragen ihre echte Farbe mal Umgebungsverdeckung (Ambient Occlusion), mit
Cycles auf der Grafikkarte gebacken — im Spiel kostet das nichts, die Schatten in den Fugen sind schon drin.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/bausatz"
BILD = ARGS[ARGS.index("--bild") + 1] if "--bild" in ARGS else None

WEIT, SCHMAL = 2.2, 0.3
WAND_H = 1.5


def lin(r, g, b):
    """sRGB (0…1) → linear, so wie glTF die Eckenfarben erwartet"""
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)


def mische(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(4))


def hell(c, f):
    return (c[0] * f, c[1] * f, c[2] * f, 1.0)


# Verlies: kühler grauer Stein, dunkler Mörtel, etwas Moos unten, rostiges Eisen
STEIN = lin(0.46, 0.44, 0.41)
STEIN_DUNKEL = lin(0.33, 0.31, 0.30)
MOOS = lin(0.30, 0.36, 0.22)
MOERTEL = lin(0.16, 0.15, 0.14)
PLATTE = lin(0.50, 0.47, 0.43)
EISEN = lin(0.16, 0.15, 0.15)
ROST = lin(0.35, 0.20, 0.11)
HOLZ = lin(0.32, 0.20, 0.10)
FLAMME = lin(1.0, 0.62, 0.18)


# ── Grundlagen ───────────────────────────────────────────────────────────────

class Teil:
    """ein bmesh mit Eckenfarbe; Klötze, Ringe usw. werden angehängt"""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.farbe = self.bm.verts.layers.float_color.new("Basis")

    def neu(self, vorher):
        return [v for v in self.bm.verts if v not in vorher]

    def faerbe(self, verts, c):
        for v in verts:
            v[self.farbe] = c

    def quader(self, mitte, groesse, farbe, drehung=(0, 0, 0), fase=0.018, rauh=0.0, r=None):
        """Quader mit abgeschrägten Kanten; rauh = Ecken zufällig verschieben (behauener Stein)"""
        vorher = set(self.bm.verts)
        erg = bmesh.ops.create_cube(self.bm, size=1.0)
        vs = erg["verts"]
        m = Matrix.Translation(Vector(mitte)) @ Euler(drehung).to_matrix().to_4x4() @ Matrix.Diagonal((*groesse, 1.0))
        bmesh.ops.transform(self.bm, matrix=m, verts=vs)
        if fase > 0:
            kanten = list({e for v in vs for e in v.link_edges})
            f = min(fase, min(groesse) * 0.3)
            bmesh.ops.bevel(self.bm, geom=kanten + vs, offset=f, segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
        neu = self.neu(vorher)
        if rauh and r:
            for v in neu:
                v.co += Vector((r.uniform(-rauh, rauh), r.uniform(-rauh, rauh), r.uniform(-rauh, rauh)))
        self.faerbe(neu, farbe)
        return neu

    def ring(self, mitte, radius, dicke, farbe, achse="x", seiten=8, ringe=5):
        """Kettenglied (Torus)"""
        vorher = set(self.bm.verts)
        punkte = []
        for i in range(seiten):
            a = 2 * math.pi * i / seiten
            kreis = []
            for j in range(ringe):
                b = 2 * math.pi * j / ringe
                rr = radius + dicke * math.cos(b)
                p = Vector((rr * math.cos(a), rr * math.sin(a) * 1.4, dicke * math.sin(b)))
                kreis.append(self.bm.verts.new(p))
            punkte.append(kreis)
        for i in range(seiten):
            for j in range(ringe):
                a, b = punkte[i][j], punkte[(i + 1) % seiten][j]
                c, d = punkte[(i + 1) % seiten][(j + 1) % ringe], punkte[i][(j + 1) % ringe]
                self.bm.faces.new((a, b, c, d))
        neu = self.neu(vorher)
        dreh = {"x": Euler((0, math.pi / 2, 0)), "y": Euler((math.pi / 2, 0, math.pi / 2)), "z": Euler((0, 0, 0))}[achse]
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(Vector(mitte)) @ dreh.to_matrix().to_4x4(), verts=neu)
        self.faerbe(neu, farbe)
        return neu

    def objekt(self):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for p in me.polygons:
            p.use_smooth = False
        o = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(o)
        return o


# ── Mauerwerk ────────────────────────────────────────────────────────────────

def steinfarbe(r, z, h):
    """Farbe eines Mauersteins: mal heller, mal dunkler, unten öfter Moos"""
    c = mische(STEIN, STEIN_DUNKEL, r.random() * 0.8)
    if r.random() < 0.35 * max(0.0, 1 - z / (h * 0.5)):
        c = mische(c, MOOS, 0.35 + r.random() * 0.4)
    return hell(c, 0.85 + r.random() * 0.3)


def mauerwerk(t, r, laenge, dicke, hoehe, x0=0.0, y0=0.0, drehung=0.0, zerfall=0.0, reihe_h=0.25):
    """Steine in versetzten Reihen, eine Wand entlang x, Mörtelkern innen; drehung um z um (x0, y0)"""
    dreh = Matrix.Rotation(drehung, 3, "Z")
    reihen = max(1, round(hoehe / reihe_h))
    rh = hoehe / reihen
    fuge = 0.022
    kern = t.quader((0, 0, hoehe / 2 - 0.01), (laenge - 0.02, dicke - 0.05, hoehe - 0.02), MOERTEL, fase=0)
    alle = [kern]
    for k in range(reihen):
        z = k * rh
        x = -laenge / 2 - (r.uniform(0.1, 0.3) if k % 2 else 0.0)
        while x < laenge / 2 - 0.01:
            lang = r.uniform(0.32, 0.6)
            a, b = max(x, -laenge / 2), min(x + lang, laenge / 2)
            x += lang
            if b - a < 0.08:
                continue
            # oben bröckelt die Mauer: einzelne Steine fehlen in der obersten Reihe
            if k == reihen - 1 and r.random() < zerfall:
                continue
            hh = rh - fuge + (r.uniform(-0.05, 0.03) if k == reihen - 1 else 0)
            tief = dicke + r.uniform(0.0, 0.05)
            m = ((a + b) / 2, r.uniform(-0.012, 0.012), z + fuge / 2 + hh / 2)
            alle.append(t.quader(m, (b - a - fuge, tief, hh), steinfarbe(r, z, hoehe),
                                 drehung=(r.uniform(-0.02, 0.02), r.uniform(-0.02, 0.02), r.uniform(-0.025, 0.025)),
                                 fase=0.022, rauh=0.007, r=r))
    verschiebe = Matrix.Translation((x0, y0, 0)) @ dreh.to_4x4()
    bmesh.ops.transform(t.bm, matrix=verschiebe, verts=[v for vs in alle for v in vs])


def fackel(t, seite=1):
    """Wandhalter mit Fackel an der Seite y = seite · 0,15; die Flamme kommt als eigenes Teil zurück"""
    y = seite * 0.15
    t.quader((0, y + seite * 0.02, 1.0), (0.12, 0.04, 0.2), EISEN, fase=0.01)
    t.quader((0, y + seite * 0.09, 0.98), (0.04, 0.14, 0.04), EISEN, fase=0.008)
    t.ring((0, y + seite * 0.16, 1.02), 0.05, 0.012, ROST, achse="z", seiten=8, ringe=4)
    t.quader((0, y + seite * 0.16, 1.07), (0.05, 0.05, 0.36), HOLZ, drehung=(seite * 0.25, 0, 0), fase=0.01)
    t.quader((0, y + seite * 0.2, 1.24), (0.08, 0.08, 0.06), lin(0.12, 0.08, 0.05), drehung=(seite * 0.25, 0, 0), fase=0.015)
    glut = Teil(t.name + "__glut")
    r = random.Random(5)
    for i in range(5):
        s = 0.17 - i * 0.03
        glut.quader((r.uniform(-0.012, 0.012), y + seite * (0.22 + i * 0.014), 1.3 + i * 0.07), (s, s, 0.13),
                    hell(FLAMME, 1.0 + i * 0.1), drehung=(0, 0, r.uniform(0, 1.5)), fase=0.02)
    return glut


def ketten(t, r, seite=1):
    """zwei Ketten mit Schellen, an Ringen in der Wand"""
    y = seite * 0.17
    for x in (-0.35, 0.35):
        t.quader((x, y - seite * 0.01, 1.2), (0.08, 0.03, 0.08), EISEN, fase=0.008)
        z = 1.16
        n = 6 + r.randint(0, 2)
        for i in range(n):
            t.ring((x + r.uniform(-0.005, 0.005), y + seite * 0.01, z), 0.028, 0.008, mische(EISEN, ROST, r.random() * 0.7),
                   achse="y" if i % 2 else "x", seiten=8, ringe=4)
            z -= 0.062
        t.ring((x, y + seite * 0.02, z - 0.03), 0.055, 0.012, ROST, achse="y", seiten=10, ringe=4)


def geroell(t, r, seite=1, n=7):
    """Steinbrocken am Fuß der Mauer"""
    for _ in range(n):
        s = r.uniform(0.06, 0.15)
        t.quader((r.uniform(-0.8, 0.8), seite * r.uniform(0.18, 0.4), s * 0.35), (s, s * r.uniform(0.8, 1.3), s * 0.7),
                 steinfarbe(r, 0, 1), drehung=(r.uniform(0, 1), r.uniform(0, 1), r.uniform(0, 3)), fase=0.02, rauh=0.012, r=r)


def mauer(name, seed, art=None):
    r = random.Random(seed)
    t = Teil(name)
    mauerwerk(t, r, WEIT, SCHMAL, WAND_H, zerfall=0.45 if art == "geroell" else 0.15)
    glut = None
    if art == "fackel":
        glut = fackel(t, 1)
    elif art == "ketten":
        ketten(t, r, 1)
    elif art == "geroell":
        geroell(t, r, 1)
        geroell(t, r, -1, n=4)
    teile = [t.objekt()]
    if glut:
        teile.append(glut.objekt())
    return teile


def pfeiler(name, seed):
    r = random.Random(seed)
    t = Teil(name)
    b, h = 0.46, 1.68
    t.quader((0, 0, 0.08), (b + 0.12, b + 0.12, 0.16), STEIN_DUNKEL, fase=0.03, rauh=0.006, r=r)
    z, k = 0.16, 0
    while z < h - 0.2:
        hh = r.uniform(0.22, 0.3)
        hh = min(hh, h - 0.14 - z)
        # abwechselnd längs und quer gelegte Blöcke, wie bei echten Ecken
        if k % 2:
            t.quader((0, -b / 4, z + hh / 2), (b, b / 2 - 0.02, hh - 0.02), steinfarbe(r, z, h), fase=0.025, rauh=0.006, r=r)
            t.quader((0, b / 4, z + hh / 2), (b, b / 2 - 0.02, hh - 0.02), steinfarbe(r, z, h), fase=0.025, rauh=0.006, r=r)
        else:
            t.quader((-b / 4, 0, z + hh / 2), (b / 2 - 0.02, b, hh - 0.02), steinfarbe(r, z, h), fase=0.025, rauh=0.006, r=r)
            t.quader((b / 4, 0, z + hh / 2), (b / 2 - 0.02, b, hh - 0.02), steinfarbe(r, z, h), fase=0.025, rauh=0.006, r=r)
        z += hh
        k += 1
    t.quader((0, 0, z + 0.06), (b + 0.1, b + 0.1, 0.12), STEIN, fase=0.03, rauh=0.006, r=r)
    t.quader((0, 0, h / 2), (b - 0.06, b - 0.06, h - 0.1), MOERTEL, fase=0)
    return [t.objekt()]


def block(name, seed):
    r = random.Random(seed)
    t = Teil(name)
    d = 0.24
    for i, (x, y, w) in enumerate(((0, -(WEIT - d) / 2, 0), (0, (WEIT - d) / 2, 0),
                                   (-(WEIT - d) / 2, 0, math.pi / 2), ((WEIT - d) / 2, 0, math.pi / 2))):
        sub = Teil("_tmp")
        mauerwerk(sub, r, WEIT - (0 if i < 2 else 2 * d), d, WAND_H, x, y, w, zerfall=0.0)
        me = bpy.data.meshes.new("_tmp")
        sub.bm.to_mesh(me)
        sub.bm.free()
        t.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    t.farbe = t.bm.verts.layers.float_color["Basis"]
    platten(t, r, WEIT - 2 * d, WEIT - 2 * d, WAND_H - 0.12, 0.12)
    return [t.objekt()]


# ── Boden ────────────────────────────────────────────────────────────────────

def teilung(r, laenge, mini, maxi):
    """eine Strecke in zufällige Stücke zerlegen"""
    stuecke, rest = [], laenge
    while rest > maxi:
        s = r.uniform(mini, maxi)
        if rest - s < mini:
            s = rest / 2
        stuecke.append(s)
        rest -= s
    stuecke.append(rest)
    r.shuffle(stuecke)
    return stuecke


def platten(t, r, bx, by, z0, dicke, mini=0.42, maxi=0.85):
    """Steinplatten in Reihen (entlang x), jede Reihe anders geteilt"""
    fuge = 0.03
    t.quader((0, 0, z0 + dicke * 0.4), (bx - 0.01, by - 0.01, dicke * 0.8), MOERTEL, fase=0)
    y = -by / 2
    for tiefe in teilung(r, by, min(mini, by), min(maxi, by)) if by > 0.35 else [by]:
        x = -bx / 2
        for lang in teilung(r, bx, min(mini, bx), min(maxi, bx)) if bx > 0.35 else [bx]:
            c = hell(mische(PLATTE, STEIN_DUNKEL, r.random() * 0.6), 0.85 + r.random() * 0.25)
            hh = dicke * r.uniform(0.9, 1.0)
            t.quader((x + lang / 2, y + tiefe / 2, z0 + hh / 2), (lang - fuge, tiefe - fuge, hh), c,
                     drehung=(r.uniform(-0.012, 0.012), r.uniform(-0.012, 0.012), r.uniform(-0.02, 0.02)),
                     fase=0.03, rauh=0.006, r=r)
            x += lang
        y += tiefe


def boden(name, seed, bx=WEIT, by=WEIT):
    r = random.Random(seed)
    t = Teil(name)
    platten(t, r, bx, by, 0.0, 0.25)
    return [t.objekt()]


# ── Torbogen und Stufe ───────────────────────────────────────────────────────

def bogen(name, seed):
    """Pfosten aus Quadern und ein flacher Bogen aus Keilsteinen; Öffnung entlang y, Bogen spannt über x"""
    r = random.Random(seed)
    t = Teil(name)
    halb, pb, tief, ph = WEIT / 2, 0.26, 0.4, 1.3
    for s in (-1, 1):
        x = s * (halb - pb / 2)
        z = 0.0
        while z < ph - 0.01:
            hh = min(r.uniform(0.24, 0.34), ph - z)
            t.quader((x, 0, z + hh / 2), (pb + r.uniform(0, 0.04), tief, hh - 0.02), steinfarbe(r, z, ph), fase=0.025, rauh=0.006, r=r)
            z += hh
    # Bogen: Ellipse von Pfosten zu Pfosten, a = halbe Weite, b = Stich
    a, b, n = halb - pb / 2, 0.55, 9
    for i in range(n):
        w0, w1 = math.pi * i / n, math.pi * (i + 1) / n
        wm = (w0 + w1) / 2
        p = Vector((a * math.cos(wm), 0, ph + b * math.sin(wm)))
        sehne = (Vector((a * math.cos(w1), 0, b * math.sin(w1))) - Vector((a * math.cos(w0), 0, b * math.sin(w0)))).length
        neig = math.atan2(b * math.cos(wm), -a * math.sin(wm))
        schluss = i == n // 2
        c = hell(STEIN, 1.1) if schluss else steinfarbe(r, 1, 2)
        t.quader(p, (sehne - 0.02, tief + (0.06 if schluss else 0), 0.3 + (0.06 if schluss else 0)), c,
                 drehung=(0, -neig, 0), fase=0.025, rauh=0.005, r=r)
    return [t.objekt()]


def stufe(name, seed):
    r = random.Random(seed)
    t = Teil(name)
    t.quader((0, 0, 0.5), (WEIT - 0.02, 0.44, 1.0), STEIN_DUNKEL, fase=0)
    x = -WEIT / 2
    for lang in teilung(r, WEIT, 0.5, 0.9):
        t.quader((x + lang / 2, 0.01, 0.94), (lang - 0.025, 0.44, 0.12), hell(PLATTE, 0.9 + r.random() * 0.2),
                 fase=0.025, rauh=0.006, r=r)
        x += lang
    return [t.objekt()]


# ── Backen: Umgebungsverdeckung mit Cycles auf der Grafikkarte ───────────────

def grafikkarte():
    sz = bpy.context.scene
    sz.render.engine = "CYCLES"
    try:
        p = bpy.context.preferences.addons["cycles"].preferences
        for typ in ("OPTIX", "CUDA"):
            try:
                p.compute_device_type = typ
                p.get_devices()
                gpus = [d for d in p.devices if d.type == typ]
                if gpus:
                    for d in p.devices:
                        d.use = d.type == typ
                    sz.cycles.device = "GPU"
                    print("BAUSATZ Grafikkarte:", typ, [d.name for d in gpus])
                    return
            except TypeError:
                continue
    except KeyError:
        pass
    print("BAUSATZ ohne Grafikkarte (CPU)")


def backe_ao(teile):
    """je Teil: Boden darunter, AO in die Ecken backen, mit der Grundfarbe multiplizieren"""
    sz = bpy.context.scene
    sz.cycles.samples = 256
    sz.world = sz.world or bpy.data.worlds.new("Welt")
    sz.world.light_settings.distance = 0.35
    mat = bpy.data.materials.new("Backen")
    mat.use_nodes = True
    boden_me = bpy.data.meshes.new("_boden")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=4.0)
    bm.to_mesh(boden_me)
    bm.free()
    unterlage = bpy.data.objects.new("_unterlage", boden_me)
    sz.collection.objects.link(unterlage)
    for o in teile:
        me = o.data
        if not me.materials:
            me.materials.append(mat)
        ao = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
        me.color_attributes.active_color = ao
        # Bodenteile liegen im Spiel neben weiteren Bodenteilen, Mauern stehen auf dem Boden
        unterlage.location.z = -0.001 if "__glut" not in o.name and "boden" not in o.name else -10
        for x in sz.objects:
            x.select_set(False)
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        basis = me.color_attributes["Basis"]
        farbe = me.color_attributes.new("Farbe", "FLOAT_COLOR", "POINT")
        leuchtet = "__glut" in o.name
        for i in range(len(me.vertices)):
            b = basis.data[i].color
            a = 1.0 if leuchtet else 0.3 + 0.7 * ao.data[i].color[0]
            farbe.data[i].color = (b[0] * a, b[1] * a, b[2] * a, 1.0)
        me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.remove(me.color_attributes["Basis"])
        me.color_attributes.active_color = me.color_attributes["Farbe"]
        me.color_attributes.render_color_index = 0
        me.materials.clear()
    bpy.data.objects.remove(unterlage)


def zeige_material(o):
    """Material für die Übersicht und den Export: zeigt die Eckenfarbe, Flammen leuchten"""
    leuchtet = "__glut" in o.name
    name = "Glut" if leuchtet else "Stein"
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        ecke = nt.nodes.new("ShaderNodeVertexColor")
        ecke.layer_name = "Farbe"
        nt.links.new(ecke.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.9
        if leuchtet:
            nt.links.new(ecke.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = 8.0
    o.data.materials.append(mat)


# ── Übersicht: ein kleines Verlies aus den Teilen ────────────────────────────

def welt(i):
    return math.ceil(i / 2) * SCHMAL + math.floor(i / 2) * WEIT + (WEIT if i % 2 else SCHMAL) / 2


def uebersicht(teile, datei):
    """wie im Spiel zusammengesetzt (Raster wie szene.ts), gerendert mit Cycles + Entrauschen"""
    sz = bpy.context.scene
    nach = {o.name: o for o in teile}
    kopien = []

    def setze(name, i, j, dreh=0.0, sz_z=1.0, z=0.0):
        for k in (name, name + "__glut"):
            if k in nach:
                c = nach[k].copy()
                # Spiel: x = welt(i), z = welt(j)  →  Blender: x, y = −z
                c.location = (welt(i), -welt(j), z)
                c.rotation_euler = (0, 0, dreh)
                c.scale = (1, 1, sz_z)
                sz.collection.objects.link(c)
                kopien.append(c)

    # 5 × 5 Felder: ein Flur in Zeile 1 und Spalte 3, ein Saal unten rechts
    R = 7
    offen = {(x, 1) for x in range(1, 6)} | {(3, y) for y in range(1, 6)} | {(x, y) for x in (3, 4, 5) for y in (5,)} | {(5, 4), (5, 5)}
    for y in range(R):
        for x in range(R):
            if (x, y) in offen:
                bx, by = x % 2, y % 2
                if bx and by:
                    setze(f"verlies_boden{1 + (x * 3 + y) % 3}", x, y)
                elif bx or by:
                    setze("verlies_bodenschmal", x, y, 0 if by == 0 else math.pi / 2)
                else:
                    setze("verlies_bodenklein", x, y)
                continue
            if not any((x + dx, y + dy) in offen for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                continue
            if x % 2 == 0 and y % 2 == 0:
                setze("verlies_pfeiler", x, y)
            elif x % 2 == 1 and y % 2 == 1:
                setze("verlies_block", x, y)
            else:
                lang_x = x % 2 == 1
                n = 1 + (x * 7 + y * 3) % 4
                setze(f"verlies_mauer{n}", x, y, (0 if lang_x else math.pi / 2) + (math.pi if (x + y) % 4 == 0 else 0))
    setze("verlies_bogen", 3, 4, math.pi / 2 * 0)
    for s in range(5):
        setze("verlies_stufe", 1, 1, math.pi / 2, sz_z=0.2, z=-0.25 * (s + 1) + 0.25)
        kopien[-1].location.x = welt(1) - WEIT / 2 + 0.22 + s * 0.44
    for o in teile:
        o.hide_render = True
    kam = bpy.data.objects.new("Kamera", bpy.data.cameras.new("Kamera"))
    kam.data.lens = 32
    mitte = Vector((welt(3), -welt(3), 0))
    kam.location = mitte + Vector((7.5, -8.5, 9.0))
    kam.rotation_euler = (mitte - kam.location).to_track_quat("-Z", "Y").to_euler()
    sz.collection.objects.link(kam)
    sz.camera = kam
    for nr, (ort, staerke) in enumerate([((welt(3), -welt(1), 1.4), 60), ((welt(5), -welt(5), 1.4), 45)]):
        l = bpy.data.objects.new(f"Licht{nr}", bpy.data.lights.new(f"Licht{nr}", "POINT"))
        l.data.energy = staerke
        l.data.color = (1.0, 0.72, 0.45)
        l.data.shadow_soft_size = 0.2
        l.location = ort
        sz.collection.objects.link(l)
    sz.world.use_nodes = True
    sz.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.01, 0.012, 0.02, 1)
    sz.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    sz.cycles.samples = 128
    sz.cycles.use_denoising = True
    try:
        sz.cycles.denoiser = "OPTIX"
    except TypeError:
        pass
    sz.view_settings.view_transform = "AgX"
    sz.render.resolution_x, sz.render.resolution_y = 1600, 1000
    sz.render.filepath = datei
    bpy.ops.render.render(write_still=True)
    for k in kopien:
        bpy.data.objects.remove(k)
    for o in teile:
        o.hide_render = False


# ── Bauen ────────────────────────────────────────────────────────────────────

def alles():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    teile = []
    teile += mauer("verlies_mauer1", 11)
    teile += mauer("verlies_mauer2", 12, "geroell")
    teile += mauer("verlies_mauer3", 13, "fackel")
    teile += mauer("verlies_mauer4", 14, "ketten")
    teile += pfeiler("verlies_pfeiler", 21)
    teile += block("verlies_block", 31)
    for i in (1, 2, 3):
        teile += boden(f"verlies_boden{i}", 40 + i)
    teile += boden("verlies_bodenschmal", 51, WEIT, SCHMAL)
    teile += boden("verlies_bodenklein", 52, SCHMAL, SCHMAL)
    teile += bogen("verlies_bogen", 61)
    teile += stufe("verlies_stufe", 71)
    return teile


if __name__ == "__main__":
    teile = alles()
    grafikkarte()
    backe_ao(teile)
    for o in teile:
        zeige_material(o)
    os.makedirs(ZIEL, exist_ok=True)
    if BILD:
        uebersicht(teile, os.path.abspath(BILD))
    for o in bpy.context.scene.objects:
        o.select_set(o in teile)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ZIEL, "verlies.glb"), export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_vertex_color="ACTIVE", export_materials="EXPORT",
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    dreiecke = {}
    for o in teile:
        o.data.calc_loop_triangles()
        dreiecke[o.name] = len(o.data.loop_triangles)
    print("BAUSATZ", sum(dreiecke.values()), dreiecke)
