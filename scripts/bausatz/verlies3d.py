"""Ausstattung für die Gebäude der freien 3D-Ansicht (Torrahmen, Pfeiler, Fackeln, Banner, Fässer …)
und die Werkzeuge für die Kacheltexturen, die kacheln.py je Stil rendert.

Aufruf:
    blender -b --factory-startup --python scripts/bausatz/verlies3d.py -- frontend/public/modelle/bausatz

Ergebnis: verlies3d.glb mit den Teilen verlies3d_<name> (Leuchtendes: <name>__glut), siehe ALLE unten.

Die Kacheln (kacheln.py) entstehen wie die Teile aus echter Geometrie (Quader, verbeult, abgeschrägt) und werden
von oben mit Cycles gerendert: einmal Farbe × Verdeckung, einmal die Normalen. Damit die Kachel nahtlos
ist, liegt dieselbe Geometrie 3 × 3-mal nebeneinander (verknüpfte Kopien: Rauschen in Objektkoordinaten
ist in allen gleich), jede Steinreihe ist genau eine Kachel lang.

Maße wie im Spiel (components/gebaeude/frei/welt.ts): Zelle 1,4, Mauer 4,05 hoch.
Wandteile stehen mit der Wand bei y = 0 und ragen nach +y (im Spiel: −z, zur Seite des Weges).
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from baue import (EISEN, FLAMME, HOLZ, MOERTEL, MOOS, PLATTE, ROST, STEIN, STEIN_DUNKEL,  # noqa: E402
                  Teil, grafikkarte, hell, lin, mische, steinfarbe)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/bausatz"

ZELLE = 1.4
H = 4.05
AUFLOESUNG = 1024
STOFF_ROT = lin(0.48, 0.08, 0.07)
STOFF_BLAU = lin(0.10, 0.16, 0.42)
GOLD = lin(0.85, 0.66, 0.22)
WACHS = lin(0.92, 0.88, 0.76)
KNOCHEN = lin(0.82, 0.77, 0.64)
HOLZ_HELL = lin(0.45, 0.30, 0.16)
MOND = lin(0.55, 0.68, 1.0)


# ── Kleinkram ────────────────────────────────────────────────────────────────

def verbeule(t, verts, staerke, feinheit, versatz):
    """Ecken in Objektkoordinaten mit Rauschen verschieben (behauener Stein, gealtertes Holz)"""
    for v in verts:
        n = noise.noise_vector(v.co * feinheit + Vector(versatz))
        v.co += n * staerke


def stein(t, mitte, groesse, farbe, r, fase=0.02, teile=0, beulen=0.008, drehung=None):
    """Quader → abgeschrägt → unterteilt → verbeult: ein Stein mit Kanten, die nicht ganz gerade sind.
    Welche Ecken zu diesem Stein gehören, merkt sich eine eigene Ebene »alt« (0 = neu): Abschrägen und
    Unterteilen erben den Wert, die Python-Objekte der Ecken dagegen taugen danach nicht zum Vergleichen."""
    alt = t.bm.verts.layers.int.get("alt") or t.bm.verts.layers.int.new("alt")
    for v in t.bm.verts:
        v[alt] = 1
    erg = bmesh.ops.create_cube(t.bm, size=1.0)
    vs = erg["verts"]
    for v in vs:
        v[alt] = 0
    dreh = drehung if drehung is not None else (r.uniform(-0.015, 0.015), r.uniform(-0.015, 0.015), r.uniform(-0.02, 0.02))
    bmesh.ops.transform(t.bm, matrix=Matrix.Translation(Vector(mitte)) @ Euler(dreh).to_matrix().to_4x4() @ Matrix.Diagonal((*groesse, 1.0)), verts=vs)
    if fase > 0:
        kanten = list({e for v in vs for e in v.link_edges})
        bmesh.ops.bevel(t.bm, geom=kanten + vs, offset=min(fase, min(groesse) * 0.3), segments=2, profile=0.6, affect="EDGES", clamp_overlap=True)
    neu = [v for v in t.bm.verts if v[alt] == 0]
    if teile:
        kanten = list({e for v in neu for e in v.link_edges})
        bmesh.ops.subdivide_edges(t.bm, edges=kanten, cuts=teile, use_grid_fill=True)
        neu = [v for v in t.bm.verts if v[alt] == 0]
    verbeule(t, neu, beulen, 9.0, (r.random() * 50, r.random() * 50, r.random() * 50))
    t.faerbe(neu, farbe)
    return neu


def zylinder(t, mitte, radius, hoehe, farbe, seiten=10, achse="z", r2=None, deckel=True):
    vorher = set(t.bm.verts)
    bmesh.ops.create_cone(t.bm, cap_ends=deckel, segments=seiten, radius1=radius, radius2=radius if r2 is None else r2, depth=hoehe)
    neu = t.neu(vorher)
    dreh = {"z": Matrix(), "x": Matrix.Rotation(math.pi / 2, 4, "Y"), "y": Matrix.Rotation(math.pi / 2, 4, "X")}[achse]
    bmesh.ops.transform(t.bm, matrix=Matrix.Translation(Vector(mitte)) @ dreh, verts=neu)
    t.faerbe(neu, farbe)
    return neu


def kugel(t, mitte, radius, farbe, skala=(1, 1, 1), unter=2):
    vorher = set(t.bm.verts)
    bmesh.ops.create_icosphere(t.bm, subdivisions=unter, radius=radius)
    neu = t.neu(vorher)
    bmesh.ops.transform(t.bm, matrix=Matrix.Translation(Vector(mitte)) @ Matrix.Diagonal((*skala, 1.0)), verts=neu)
    t.faerbe(neu, farbe)
    return neu


def flamme(name, orte, groesse=1.0):
    """leuchtendes Teil: kleine gedrehte Würfel übereinander, je Ort eine Flamme"""
    glut = Teil(name + "__glut")
    r = random.Random(7)
    for (x, y, z) in orte:
        for i in range(5):
            s = (0.15 - i * 0.026) * groesse
            glut.quader((x + r.uniform(-0.01, 0.01) * groesse, y, z + i * 0.065 * groesse), (s, s, 0.12 * groesse),
                        hell(FLAMME, 1.0 + i * 0.12), drehung=(0, 0, r.uniform(0, 1.5)), fase=0.02 * groesse)
    return glut


# ── Kacheln ──────────────────────────────────────────────────────────────────

def teilung_genau(r, laenge, mini, maxi):
    """Strecke in Stücke, die genau `laenge` ergeben (für nahtlose Reihen)"""
    stuecke, rest = [], laenge
    while rest > maxi + 1e-6:
        s = r.uniform(mini, maxi)
        if rest - s < mini:
            s = rest / 2
        stuecke.append(s)
        rest -= s
    stuecke.append(rest)
    return stuecke


def kachel_mauer():
    """Quadermauerwerk: 8 Reihen je 0,175, Steine 0,25–0,5 lang, jede Reihe versetzt"""
    r = random.Random(101)
    t = Teil("k_mauer")
    t.quader((ZELLE / 2, ZELLE / 2, -0.03), (ZELLE * 1.02, ZELLE * 1.02, 0.04), MOERTEL, fase=0)
    reihen = 8
    rh = ZELLE / reihen
    for k in range(reihen):
        x = r.uniform(0, 0.4)
        for lang in teilung_genau(r, ZELLE, 0.25, 0.5):
            c = mische(STEIN, STEIN_DUNKEL, r.random() * 0.85)
            if r.random() < 0.08:
                c = mische(c, MOOS, 0.4)
            c = hell(c, 0.82 + r.random() * 0.3)
            vor = r.uniform(0.0, 0.025)
            stein(t, (x + lang / 2, k * rh + rh / 2, 0.035 + vor / 2), (lang - 0.018, rh - 0.018, 0.07 + vor), c, r,
                  fase=0.018, teile=3, beulen=0.006)
            x += lang
    return t


def kachel_boden():
    """Steinplatten: 2–3 Reihen, Platten 0,4–0,8 lang, leicht verkantet"""
    r = random.Random(202)
    t = Teil("k_boden")
    t.quader((ZELLE / 2, ZELLE / 2, -0.03), (ZELLE * 1.02, ZELLE * 1.02, 0.04), mische(MOERTEL, lin(0.25, 0.2, 0.15), 0.4), fase=0)
    y = 0.0
    for tiefe in teilung_genau(r, ZELLE, 0.4, 0.75):
        x = r.uniform(0, 0.5)
        for lang in teilung_genau(r, ZELLE, 0.4, 0.8):
            c = hell(mische(PLATTE, STEIN_DUNKEL, r.random() * 0.7), 0.8 + r.random() * 0.28)
            stein(t, (x + lang / 2, y + tiefe / 2, 0.03 + r.uniform(-0.006, 0.006)), (lang - 0.03, tiefe - 0.03, 0.06), c, r,
                  fase=0.03, teile=4, beulen=0.01,
                  drehung=(r.uniform(-0.02, 0.02), r.uniform(-0.02, 0.02), r.uniform(-0.015, 0.015)))
            x += lang
        y += tiefe
    return t


def kachel_decke():
    """Holzdielen entlang x, sieben Bretter, Stöße an zufälligen Stellen"""
    r = random.Random(303)
    t = Teil("k_decke")
    t.quader((ZELLE / 2, ZELLE / 2, -0.03), (ZELLE * 1.02, ZELLE * 1.02, 0.04), lin(0.06, 0.04, 0.03), fase=0)
    bretter = 7
    b = ZELLE / bretter
    for k in range(bretter):
        x = r.uniform(0, ZELLE)
        for lang in teilung_genau(r, ZELLE, 0.6, 1.4):
            c = hell(mische(HOLZ, HOLZ_HELL, r.random() * 0.5), 0.7 + r.random() * 0.35)
            stein(t, (x + lang / 2, k * b + b / 2, 0.03), (lang - 0.012, b - 0.014, 0.05), c, r, fase=0.01, teile=2, beulen=0.004,
                  drehung=(0, 0, 0))
            x += lang
    return t


# Maserungen: Muster (Rauschen, Holzwellen, Tapetenstreifen), Spanne der Helligkeit, Relief, Schmutz
MASERUNG = {
    "stein":    dict(muster="rauschen", spanne=(0.72, 1.12), relief=0.25, schmutz=0.7),
    "marmor":   dict(muster="marmor", spanne=(0.87, 1.04), relief=0.06, schmutz=0.95),
    "holz":     dict(muster="welle_y", spanne=(0.72, 1.12), relief=0.35, schmutz=0.75),
    "holz_v":   dict(muster="welle_x", spanne=(0.72, 1.12), relief=0.35, schmutz=0.75),
    "glatt":    dict(muster="rauschen", spanne=(0.9, 1.05), relief=0.12, schmutz=0.82),
    "metall":   dict(muster="fein", spanne=(0.86, 1.06), relief=0.06, schmutz=0.9),
    "streifen": dict(muster="streifen", spanne=(0.8, 1.08), relief=0.03, schmutz=0.88),
    "eis":      dict(muster="rauschen", spanne=(0.85, 1.12), relief=0.1, schmutz=1.0),
}


def kachel_material(name, maserung):
    """Shader: Eckenfarbe × feine Maserung × Verdeckung, als Leuchten (unabhängig vom Licht).
    Ein zweiter Ausgang zeigt die Normalen (mit Relief aus der Maserung) — umgeschaltet wird per `modus`."""
    M = MASERUNG[maserung]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    aus = N("ShaderNodeOutputMaterial")
    koord = N("ShaderNodeTexCoord")
    ecke = N("ShaderNodeVertexColor")
    ecke.layer_name = "Basis"
    rausch = N("ShaderNodeTexNoise")
    rausch.inputs["Scale"].default_value = 26.0
    rausch.inputs["Detail"].default_value = 8.0
    rausch.inputs["Roughness"].default_value = 0.6
    L(koord.outputs["Object"], rausch.inputs["Vector"])
    muster = M["muster"]
    if muster in ("welle_y", "welle_x", "streifen", "marmor"):
        welle = N("ShaderNodeTexWave")
        welle.wave_type = "BANDS"
        welle.bands_direction = {"welle_y": "Y", "welle_x": "X", "streifen": "X", "marmor": "DIAGONAL"}[muster]
        welle.inputs["Scale"].default_value = {"streifen": 9.0, "marmor": 3.0}.get(muster, 18.0)
        welle.inputs["Distortion"].default_value = {"streifen": 0.0, "marmor": 14.0}.get(muster, 6.0)
        welle.inputs["Detail"].default_value = 3.0 if muster != "marmor" else 6.0
        if muster == "streifen":
            welle.wave_profile = "SAW"
        L(koord.outputs["Object"], welle.inputs["Vector"])
        hoehe = welle.outputs["Fac"]
    elif muster == "fein":
        rausch.inputs["Scale"].default_value = 90.0
        rausch.inputs["Detail"].default_value = 4.0
        hoehe = rausch.outputs["Fac"]
    else:
        hoehe = rausch.outputs["Fac"]
    rampe = N("ShaderNodeMapRange")
    rampe.inputs["To Min"].default_value = M["spanne"][0]
    rampe.inputs["To Max"].default_value = M["spanne"][1]
    L(hoehe, rampe.inputs["Value"])
    # dunkle Flecken (Schmutz, Feuchtigkeit)
    flecken = N("ShaderNodeTexNoise")
    flecken.inputs["Scale"].default_value = 4.0
    flecken.inputs["Detail"].default_value = 3.0
    L(koord.outputs["Object"], flecken.inputs["Vector"])
    fl = N("ShaderNodeMapRange")
    fl.inputs["From Min"].default_value = 0.45
    fl.inputs["From Max"].default_value = 0.7
    fl.inputs["To Min"].default_value = 1.0
    fl.inputs["To Max"].default_value = M["schmutz"]
    L(flecken.outputs["Fac"], fl.inputs["Value"])
    ao = N("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.06
    ao.samples = 16
    ao_r = N("ShaderNodeMapRange")
    ao_r.inputs["To Min"].default_value = 0.3
    L(ao.outputs["AO"], ao_r.inputs["Value"])
    m1 = N("ShaderNodeMixRGB")
    m1.blend_type = "MULTIPLY"
    m1.inputs["Fac"].default_value = 1.0
    L(ecke.outputs["Color"], m1.inputs["Color1"])
    L(rampe.outputs["Result"], m1.inputs["Color2"])
    m2 = N("ShaderNodeMixRGB")
    m2.blend_type = "MULTIPLY"
    m2.inputs["Fac"].default_value = 1.0
    L(m1.outputs["Color"], m2.inputs["Color1"])
    L(fl.outputs["Result"], m2.inputs["Color2"])
    m3 = N("ShaderNodeMixRGB")
    m3.blend_type = "MULTIPLY"
    m3.inputs["Fac"].default_value = 1.0
    L(m2.outputs["Color"], m3.inputs["Color1"])
    L(ao_r.outputs["Result"], m3.inputs["Color2"])
    farbe = N("ShaderNodeEmission")
    L(m3.outputs["Color"], farbe.inputs["Color"])
    # Normalen: Relief aus der Maserung, in 0…1 und gegen die sRGB-Kodierung beim Speichern vorverzerrt
    relief = N("ShaderNodeBump")
    relief.inputs["Strength"].default_value = M["relief"]
    relief.inputs["Distance"].default_value = 0.003
    L(hoehe, relief.inputs["Height"])
    halb = N("ShaderNodeVectorMath")
    halb.operation = "MULTIPLY_ADD"
    halb.inputs[1].default_value = (0.5, 0.5, 0.5)
    halb.inputs[2].default_value = (0.5, 0.5, 0.5)
    L(relief.outputs["Normal"], halb.inputs[0])
    gamma = N("ShaderNodeGamma")
    gamma.inputs["Gamma"].default_value = 2.2
    L(halb.outputs["Vector"], gamma.inputs["Color"])
    norm = N("ShaderNodeEmission")
    L(gamma.outputs["Color"], norm.inputs["Color"])
    mat["farbe"] = farbe.name
    mat["normal"] = norm.name
    L(farbe.outputs["Emission"], aus.inputs["Surface"])
    return mat


def modus(mat, art):
    nt = mat.node_tree
    aus = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    nt.links.new(nt.nodes[mat[art]].outputs["Emission"], aus.inputs["Surface"])


def rendere_kachel(t, maserung, ordner, name, proben=(256, 64), groesse=(ZELLE, ZELLE), pixel=None):
    """Kachel 3 × 3-mal (verknüpft) auslegen, von oben rendern: Farbe (JPEG) und Normalen (JPEG)"""
    sz = bpy.data.scenes.new("Kachel_" + name)
    o = t.objekt()
    bpy.context.scene.collection.objects.unlink(o)
    mat = kachel_material("M_" + name, maserung)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            k = o if dx == dy == 0 else o.copy()
            k.location = (dx * groesse[0], dy * groesse[1], 0)
            sz.collection.objects.link(k)
    kam = bpy.data.objects.new("Kam_" + name, bpy.data.cameras.new("Kam_" + name))
    kam.data.type = "ORTHO"
    kam.data.ortho_scale = max(groesse)
    kam.location = (groesse[0] / 2, groesse[1] / 2, 2.0)
    sz.collection.objects.link(kam)
    sz.camera = kam
    sz.world = bpy.data.worlds.new("Schwarz_" + name)
    sz.world.color = (0, 0, 0)
    sz.render.engine = "CYCLES"
    sz.cycles.device = bpy.context.scene.cycles.device
    px = pixel or AUFLOESUNG
    sz.render.resolution_x = round(px * groesse[0] / max(groesse))
    sz.render.resolution_y = round(px * groesse[1] / max(groesse))
    sz.render.resolution_percentage = 100
    sz.view_settings.view_transform = "Standard"
    sz.view_settings.look = "None"
    sz.render.image_settings.file_format = "JPEG"
    sz.render.image_settings.quality = 92
    sz.render.image_settings.color_mode = "RGB"
    for art, proben, entrauschen in (("farbe", proben[0], True), ("normal", proben[1], False)):
        modus(mat, art)
        sz.cycles.samples = proben
        sz.cycles.use_denoising = entrauschen
        sz.render.filepath = os.path.abspath(os.path.join(ordner, f"{name}_{art}.jpg"))
        bpy.ops.render.render(write_still=True, scene=sz.name)
    print("KACHEL", name, len(o.data.polygons), "Flächen")


# ── Teile ────────────────────────────────────────────────────────────────────

def tuerrahmen(name):
    """Durchgang durch die dicke Mauer: Pfosten aus Quadern, oben ein scheitrechter Bogen mit Schlussstein.
    Öffnung entlang y (im Spiel z), 1,4 tief; über dem Bogen setzt das Spiel Mauer bis zur Decke."""
    r = random.Random(11)
    t = Teil(name)
    pb, oben = 0.26, 2.75
    for s in (-1, 1):
        x = s * (ZELLE / 2 - pb / 2)
        z, k = 0.0, 0
        while z < oben - 0.01:
            hh = min(r.uniform(0.3, 0.42), oben - z)
            breit = pb + (0.08 if k % 2 else 0)
            stein(t, (x - s * (0.04 if k % 2 else 0), 0, z + hh / 2), (breit, ZELLE, hh - 0.025), steinfarbe(r, z, oben), r, fase=0.03)
            z += hh
            k += 1
    # scheitrechter Bogen: Keilsteine fächerförmig
    n, unten = 7, oben
    for i in range(n):
        x0 = -ZELLE / 2 + i * ZELLE / n
        mitte = x0 + ZELLE / n / 2
        neig = -mitte * 0.35
        schluss = i == n // 2
        stein(t, (mitte, 0, unten + 0.21 + (0.04 if schluss else 0)), (ZELLE / n - 0.02, ZELLE + (0.06 if schluss else 0), 0.42 + (0.08 if schluss else 0)),
              hell(STEIN, 1.12) if schluss else steinfarbe(r, 2, 3), r, fase=0.03, drehung=(0, neig, 0))
    return [t]


def eckpfeiler(name):
    r = random.Random(12)
    t = Teil(name)
    b, hoehe = 0.5, H + 0.3
    stein(t, (0, 0, 0.16), (b + 0.16, b + 0.16, 0.32), STEIN_DUNKEL, r, fase=0.04)
    z, k = 0.32, 0
    while z < hoehe - 0.35:
        hh = min(r.uniform(0.3, 0.4), hoehe - 0.2 - z)
        if k % 2:
            stein(t, (0, -b / 4, z + hh / 2), (b, b / 2 - 0.02, hh - 0.025), steinfarbe(r, z, hoehe), r, fase=0.03)
            stein(t, (0, b / 4, z + hh / 2), (b, b / 2 - 0.02, hh - 0.025), steinfarbe(r, z, hoehe), r, fase=0.03)
        else:
            stein(t, (-b / 4, 0, z + hh / 2), (b / 2 - 0.02, b, hh - 0.025), steinfarbe(r, z, hoehe), r, fase=0.03)
            stein(t, (b / 4, 0, z + hh / 2), (b / 2 - 0.02, b, hh - 0.025), steinfarbe(r, z, hoehe), r, fase=0.03)
        z += hh
        k += 1
    stein(t, (0, 0, z + 0.1), (b + 0.14, b + 0.14, 0.2), STEIN, r, fase=0.04)
    t.quader((0, 0, hoehe / 2), (b - 0.08, b - 0.08, hoehe - 0.1), MOERTEL, fase=0)
    return [t]


def wandfackel(name):
    t = Teil(name)
    z = 2.15
    t.quader((0, 0.03, z), (0.16, 0.06, 0.3), EISEN, fase=0.012)
    t.quader((0, 0.13, z - 0.04), (0.05, 0.2, 0.05), EISEN, fase=0.01)
    t.ring((0, 0.24, z), 0.07, 0.016, ROST, achse="z", seiten=10, ringe=5)
    t.quader((0, 0.25, z + 0.08), (0.07, 0.07, 0.5), HOLZ, drehung=(0.22, 0, 0), fase=0.012)
    t.quader((0, 0.3, z + 0.32), (0.11, 0.11, 0.09), lin(0.1, 0.07, 0.05), drehung=(0.22, 0, 0), fase=0.02)
    return [t, flamme(name, [(0, 0.32, z + 0.4)], 1.25)]


def banner(name, stoff):
    """Wappenbanner an einer Stange: Stoff mit Goldborte und Raute, leicht gewellt, unten spitz"""
    t = Teil(name)
    oben, breit, lang = 3.45, 0.78, 1.9
    zylinder(t, (0, 0.12, oben + 0.04), 0.025, breit + 0.24, EISEN, seiten=8, achse="x")
    for s in (-1, 1):
        kugel(t, (s * (breit / 2 + 0.13), 0.12, oben + 0.04), 0.045, GOLD, unter=1)
        t.quader((s * (breit / 2 + 0.05), 0.06, oben + 0.04), (0.03, 0.12, 0.03), EISEN, fase=0.005)
    nx, nz = 10, 22
    raster = []
    for j in range(nz + 1):
        zeile = []
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            x = (u - 0.5) * breit
            spitze = (1 - abs(u - 0.5) * 2) * 0.28
            z = oben - v * (lang - 0.28) - (v ** 3) * spitze
            y = 0.16 + 0.035 * math.sin(u * 7.0 + v * 2.0) * v + 0.02 * v
            zeile.append(t.bm.verts.new((x, y, z)))
            rand = u < 0.09 or u > 0.91 or v > 0.93
            raute = abs(u - 0.5) * 2 + abs(v - 0.42) * 3.2 < 0.55
            kern = abs(u - 0.5) * 2 + abs(v - 0.42) * 3.2 < 0.3
            c = GOLD if rand or (raute and not kern) else (hell(stoff, 1.5) if kern else stoff)
            zeile[-1][t.farbe] = hell(c, 0.85 + 0.15 * math.sin(u * 7.0 + v * 2.0))
        raster.append(zeile)
    for j in range(nz):
        for i in range(nx):
            t.bm.faces.new((raster[j][i], raster[j][i + 1], raster[j + 1][i + 1], raster[j + 1][i]))
    return [t]


def gitterfenster(name):
    """Kleines vergittertes Fenster hoch in der Wand; dahinter fahles Mondlicht"""
    r = random.Random(14)
    t = Teil(name)
    z, b, h = 2.9, 0.62, 0.5
    stein(t, (0, 0.06, z - h / 2 - 0.08), (b + 0.3, 0.14, 0.16), STEIN, r, fase=0.03)
    stein(t, (0, 0.06, z + h / 2 + 0.08), (b + 0.3, 0.14, 0.16), STEIN_DUNKEL, r, fase=0.03)
    for s in (-1, 1):
        stein(t, (s * (b / 2 + 0.08), 0.06, z), (0.16, 0.14, h), steinfarbe(r, 1, 2), r, fase=0.03)
    t.quader((0, -0.02, z), (b, 0.04, h), lin(0.03, 0.03, 0.05), fase=0)
    for i in range(5):
        zylinder(t, (-b / 2 + (i + 0.5) * b / 5, 0.07, z), 0.016, h + 0.06, mische(EISEN, ROST, 0.4), seiten=6)
    zylinder(t, (0, 0.075, z), 0.014, b + 0.04, EISEN, seiten=6, achse="x")
    glut = Teil(name + "__glut")
    glut.quader((0, 0.0, z), (b - 0.02, 0.02, h - 0.02), hell(MOND, 0.55), fase=0)
    return [t, glut]


def balken(name):
    """Deckenbalken, 1,4 lang entlang x, mit eisernen Bändern; Oberkante bei z = 0 (hängt nach unten)"""
    r = random.Random(15)
    t = Teil(name)
    stein(t, (0, 0, -0.15), (ZELLE + 0.01, 0.24, 0.3), hell(HOLZ, 0.85), r, fase=0.025, teile=3, beulen=0.006, drehung=(0, 0, 0))
    for x in (-0.45, 0.45):
        t.quader((x, 0, -0.15), (0.05, 0.27, 0.33), EISEN, fase=0.006)
    return [t]


def fass(name):
    r = random.Random(16)
    t = Teil(name)
    seiten, hoehe, radius = 14, 0.9, 0.3
    for i in range(seiten):
        w = 2 * math.pi * i / seiten
        c = hell(mische(HOLZ, HOLZ_HELL, r.random()), 0.85 + r.random() * 0.25)
        for k, (z0, z1, rr) in enumerate(((0.0, 0.3, 0.0), (0.3, 0.6, 0.05), (0.6, 0.9, 0.0))):
            rad = radius + rr + (0.025 if k == 1 else 0.0)
            stein(t, (math.cos(w) * rad, math.sin(w) * rad, (z0 + z1) / 2), (0.05, 2 * math.pi * rad / seiten - 0.008, z1 - z0 + 0.002), c, r,
                  fase=0.008, teile=0, beulen=0.002, drehung=(0, 0, w))
    t.quader((0, 0, hoehe - 0.04), (radius * 1.7, radius * 1.7, 0.03), hell(HOLZ, 0.7), fase=0)
    for z in (0.12, 0.78):
        t.ring((0, 0, z), radius + 0.035, 0.014, EISEN, achse="z", seiten=18, ringe=4)
    return [t]


def kiste(name):
    r = random.Random(17)
    t = Teil(name)
    s = 0.62
    t.quader((0, 0, s / 2), (s - 0.04, s - 0.04, s - 0.04), lin(0.12, 0.08, 0.05), fase=0)
    for (achse, vz) in (("x", 1), ("x", -1), ("y", 1), ("y", -1), ("z", 1)):
        for k in range(4):
            v = -s / 2 + (k + 0.5) * s / 4
            c = hell(mische(HOLZ, HOLZ_HELL, r.random() * 0.7), 0.85 + r.random() * 0.2)
            if achse == "x":
                stein(t, (vz * (s / 2 - 0.015), v, s / 2), (0.03, s / 4 - 0.01, s - 0.02), c, r, fase=0.006, teile=0, drehung=(0, 0, 0))
            elif achse == "y":
                stein(t, (v, vz * (s / 2 - 0.015), s / 2), (s / 4 - 0.01, 0.03, s - 0.02), c, r, fase=0.006, teile=0, drehung=(0, 0, 0))
            else:
                stein(t, (v, 0, s - 0.015), (s / 4 - 0.01, s - 0.02, 0.03), c, r, fase=0.006, teile=0, drehung=(0, 0, 0))
    for x in (-1, 1):
        for y in (-1, 1):
            t.quader((x * (s / 2 - 0.02), y * (s / 2 - 0.02), s / 2), (0.07, 0.07, s + 0.01), hell(HOLZ, 0.6), fase=0.01)
    return [t]


def knochen(name):
    """Schädel und ein paar Knochen"""
    r = random.Random(18)
    t = Teil(name)
    kugel(t, (0, 0, 0.12), 0.12, KNOCHEN, skala=(0.9, 1.1, 0.95), unter=2)
    t.quader((0, -0.07, 0.04), (0.13, 0.09, 0.07), hell(KNOCHEN, 0.9), fase=0.02)
    for s in (-1, 1):
        kugel(t, (s * 0.045, -0.105, 0.13), 0.032, lin(0.05, 0.04, 0.03), unter=1)
    kugel(t, (0, -0.125, 0.085), 0.018, lin(0.06, 0.05, 0.04), unter=1)
    for _ in range(6):
        lang = r.uniform(0.25, 0.42)
        w = r.uniform(0, math.pi)
        mx, my = r.uniform(-0.3, 0.3), r.uniform(0.0, 0.35)
        vorher = set(t.bm.verts)
        zylinder(t, (0, 0, 0), 0.022, lang, hell(KNOCHEN, 0.9 + r.random() * 0.15), seiten=6, achse="x")
        for s in (-1, 1):
            kugel(t, (s * lang / 2, 0.012, 0), 0.032, KNOCHEN, unter=1)
            kugel(t, (s * lang / 2, -0.012, 0), 0.032, KNOCHEN, unter=1)
        neu = t.neu(vorher)
        bmesh.ops.transform(t.bm, matrix=Matrix.Translation((mx, my, 0.03)) @ Matrix.Rotation(w, 4, "Z"), verts=neu)
    return [t]


def kerzen(name):
    r = random.Random(19)
    t = Teil(name)
    stein(t, (0, 0, 0.05), (0.42, 0.34, 0.1), STEIN_DUNKEL, r, fase=0.025)
    orte = []
    for (x, y, h) in ((-0.1, -0.05, 0.28), (0.06, 0.06, 0.2), (0.12, -0.08, 0.14), (-0.04, 0.1, 0.1)):
        rad = r.uniform(0.032, 0.045)
        zylinder(t, (x, y, 0.1 + h / 2), rad, h, hell(WACHS, 0.9 + r.random() * 0.1), seiten=10)
        for _ in range(3):
            w = r.uniform(0, 2 * math.pi)
            lang = r.uniform(0.03, h * 0.6)
            t.quader((x + math.cos(w) * rad, y + math.sin(w) * rad, 0.1 + h - lang / 2), (0.018, 0.018, lang), WACHS, fase=0.008)
        t.quader((x, y, 0.1 + h + 0.015), (0.006, 0.006, 0.03), lin(0.05, 0.05, 0.05), fase=0)
        orte.append((x, y, 0.1 + h + 0.03))
    return [t, flamme(name, orte, 0.35)]


def geroell(name):
    r = random.Random(20)
    t = Teil(name)
    for _ in range(11):
        s = r.uniform(0.1, 0.26)
        w = r.uniform(0, 2 * math.pi)
        d = r.uniform(0, 0.35)
        stein(t, (math.cos(w) * d, math.sin(w) * d * 0.7, s * 0.3), (s, s * r.uniform(0.7, 1.2), s * 0.65), steinfarbe(r, 0, 1), r,
              fase=0.03, teile=2, beulen=0.02, drehung=(r.uniform(0, 1), r.uniform(0, 1), r.uniform(0, 3)))
    return [t]


def kette(name):
    """Kette, die von der Decke hängt, mit Haken unten (Oberkante z = 0)"""
    r = random.Random(21)
    t = Teil(name)
    z = -0.05
    for i in range(16):
        t.ring((r.uniform(-0.003, 0.003), 0, z), 0.04, 0.011, mische(EISEN, ROST, r.random() * 0.6), achse="y" if i % 2 else "x", seiten=8, ringe=4)
        z -= 0.085
    zylinder(t, (0, 0, z - 0.06), 0.012, 0.12, EISEN, seiten=6)
    t.ring((0.04, 0, z - 0.14), 0.045, 0.012, ROST, achse="y", seiten=10, ringe=4)
    return [t]


ALLE = [
    ("tuer", tuerrahmen, "boden"),
    ("pfeiler", eckpfeiler, "boden"),
    ("fackel", wandfackel, "wand"),
    ("banner_rot", lambda n: banner(n, STOFF_ROT), "wand"),
    ("banner_blau", lambda n: banner(n, STOFF_BLAU), "wand"),
    ("fenster", gitterfenster, "wand"),
    ("balken", balken, "decke"),
    ("fass", fass, "boden"),
    ("kiste", kiste, "boden"),
    ("knochen", knochen, "boden"),
    ("kerzen", kerzen, "boden"),
    ("geroell", geroell, "boden"),
    ("kette", kette, "decke"),
]


# ── Backen der Teile ─────────────────────────────────────────────────────────

def platte(name, groesse, ort, dreh):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=groesse)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = ort
    o.rotation_euler = dreh
    bpy.context.scene.collection.objects.link(o)
    return o


def backe_teile(objekte):
    """AO in die Ecken backen; je nach Teil steht dabei ein Boden darunter, eine Wand dahinter oder eine Decke darüber"""
    sz = bpy.context.scene
    sz.cycles.samples = 256
    sz.world = sz.world or bpy.data.worlds.new("Welt")
    sz.world.light_settings.distance = 0.4
    mat = bpy.data.materials.new("Backen")
    mat.use_nodes = True
    hilfe = {"boden": platte("_boden", 6, (0, 0, -0.001), (0, 0, 0)),
             "wand": platte("_wand", 6, (0, -0.001, 2), (math.pi / 2, 0, 0)),
             "decke": platte("_decke", 6, (0, 0, 0.001), (0, 0, 0))}
    for o, ort in objekte:
        for art, h in hilfe.items():
            h.hide_render = art != ort
        me = o.data
        if not me.materials:
            me.materials.append(mat)
        ao = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
        me.color_attributes.active_color = ao
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
            a = 1.0 if leuchtet else 0.28 + 0.72 * ao.data[i].color[0]
            farbe.data[i].color = (b[0] * a, b[1] * a, b[2] * a, 1.0)
        me.color_attributes.remove(me.color_attributes["AO"])
        me.color_attributes.remove(me.color_attributes["Basis"])
        me.color_attributes.active_color = me.color_attributes["Farbe"]
        me.color_attributes.render_color_index = 0
        me.materials.clear()
    for h in hilfe.values():
        bpy.data.objects.remove(h)


def zeige_material(o):
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


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    grafikkarte()
    # die Kacheln (Mauer, Boden, Decke je Stil) baut kacheln.py
    objekte = []
    for name, bau, ort in ALLE:
        for t in bau("verlies3d_" + name):
            o = t.objekt()
            for p in o.data.polygons:
                p.use_smooth = "banner" in name or "fass" in name
            objekte.append((o, ort))
    backe_teile(objekte)
    for o, _ in objekte:
        zeige_material(o)
    for o in bpy.context.scene.objects:
        o.select_set(any(o is x for x, _ in objekte))
    bpy.ops.export_scene.gltf(filepath=os.path.join(ZIEL, "verlies3d.glb"), export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True, export_vertex_color="ACTIVE", export_materials="EXPORT",
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
    dreiecke = {}
    for o, _ in objekte:
        o.data.calc_loop_triangles()
        dreiecke[o.name] = len(o.data.loop_triangles)
    print("VERLIES3D", sum(dreiecke.values()), dreiecke)
