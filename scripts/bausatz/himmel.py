"""Gemalte Himmel für die Außenwelten der freien 3D-Ansicht (Wald, Winter, Oase, Leuchtpilze, Garten).

Aufruf:
    blender -b --factory-startup --python scripts/bausatz/himmel.py -- frontend/public/modelle/himmel [welt …]

Ergebnis: <welt>.jpg, ein Rundumbild (equirektangular, 2048 × 1024) — oben der Himmel, in der Mitte
der Horizont. Alles kommt aus dem Welt-Shader von Cycles, ohne Objekte:
    Farbverlauf (Horizont = Nebelfarbe der Welt, damit der Boden im Dunst nahtlos übergeht),
    Sonne mit Schein, Wolken als Schicht über dem Kopf (Rauschen auf x/z und y/z → perspektivisch),
    ferne Hügel bzw. Berge rundum (Rauschen auf dem Kreis der Himmelsrichtungen → nahtlos),
    nachts Sterne und Mond.
Farben wie die Stimmungen in components/gebaeude/frei/welt.ts.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from baue import grafikkarte  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/himmel"
NUR = ARGS[1:]


def lin(h):
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255), 1.0)


# oben, Horizont (= Nebel), Sonne, Wolken, Hügel (Farbe, Höhe, Zackigkeit), Wolkenmenge, Nacht
WELTEN = {
    "wald":   dict(oben=0x5f93d6, horizont=0xe9d6ac, sonne=0xfff0c8, wolke=0xfff6e6, huegel=0x6f8f6a, hoehe=0.17, zacken=0.3, wolken=0.55, nacht=False, sonne_hoch=0.35),
    "winter": dict(oben=0x7fa3d0, horizont=0xe8eef6, sonne=0xfff6ec, wolke=0xf4f7fb, huegel=0x9fb2cc, hoehe=0.28, zacken=1.0, wolken=0.7, nacht=False, sonne_hoch=0.18),
    "oase":   dict(oben=0x2f84de, horizont=0xf3dfb0, sonne=0xfff3d0, wolke=0xffffff, huegel=0xe2bf86, hoehe=0.1, zacken=0.1, wolken=0.25, nacht=False, sonne_hoch=0.6),
    "pilze":  dict(oben=0x03021a, horizont=0x171245, sonne=0xd8d0ff, wolke=0x5a3a9a, huegel=0x0d0a24, hoehe=0.18, zacken=0.5, wolken=0.45, nacht=True, sonne_hoch=0.4),
    "garten": dict(oben=0x3f8ee6, horizont=0xdcecf7, sonne=0xfffbe8, wolke=0xffffff, huegel=0x7fae78, hoehe=0.12, zacken=0.2, wolken=0.5, nacht=False, sonne_hoch=0.5),
}


class Baum:
    """kleiner Helfer für Knoten: Mathe, Vektoren, Mischen"""

    def __init__(self, nt):
        self.nt = nt

    def knoten(self, typ, **werte):
        n = self.nt.nodes.new(typ)
        for k, v in werte.items():
            setattr(n, k, v)
        return n

    def ein(self, n, i, wert):
        if hasattr(wert, "is_output") or hasattr(wert, "links"):
            self.nt.links.new(wert, n.inputs[i])
        else:
            n.inputs[i].default_value = wert
        return n

    def mathe(self, op, a, b=0.0, klemmen=False):
        n = self.knoten("ShaderNodeMath", operation=op, use_clamp=klemmen)
        self.ein(n, 0, a)
        self.ein(n, 1, b)
        return n.outputs[0]

    def vek(self, op, a, b=(0, 0, 0)):
        n = self.knoten("ShaderNodeVectorMath", operation=op)
        self.ein(n, 0, a)
        self.ein(n, 1, b)
        return n.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH") else n.outputs["Vector"]

    def misch(self, fac, a, b):
        n = self.knoten("ShaderNodeMix", data_type="RGBA")
        self.ein(n, "Factor", fac)
        self.ein(n, 6, a)
        self.ein(n, 7, b)
        return n.outputs[2]

    def bereich(self, wert, von, bis, nach_von=0.0, nach_bis=1.0, glatt=True):
        n = self.knoten("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP" if glatt else "LINEAR")
        self.ein(n, "Value", wert)
        self.ein(n, "From Min", von)
        self.ein(n, "From Max", bis)
        self.ein(n, "To Min", nach_von)
        self.ein(n, "To Max", nach_bis)
        return n.outputs["Result"]

    def rauschen(self, vektor, skala, detail=6.0, rauh=0.55):
        n = self.knoten("ShaderNodeTexNoise")
        self.ein(n, "Vector", vektor)
        self.ein(n, "Scale", skala)
        self.ein(n, "Detail", detail)
        self.ein(n, "Roughness", rauh)
        return n.outputs["Fac"]

    def xyz(self, x, y, z):
        n = self.knoten("ShaderNodeCombineXYZ")
        self.ein(n, 0, x)
        self.ein(n, 1, y)
        self.ein(n, 2, z)
        return n.outputs[0]


def himmel_shader(welt, W):
    welt.use_nodes = True
    nt = welt.node_tree
    nt.nodes.clear()
    B = Baum(nt)
    aus = B.knoten("ShaderNodeOutputWorld")
    licht = B.knoten("ShaderNodeBackground")
    koord = B.knoten("ShaderNodeTexCoord")
    d = B.vek("NORMALIZE", koord.outputs["Generated"])
    sep = B.knoten("ShaderNodeSeparateXYZ")
    B.ein(sep, 0, d)
    x, y, z = sep.outputs[0], sep.outputs[1], sep.outputs[2]

    # Verlauf: am Horizont die Nebelfarbe, nach oben der Himmel
    hoch = B.bereich(z, 0.0, 0.75, glatt=False)
    hoch = B.mathe("POWER", hoch, 0.6)
    farbe = B.misch(hoch, lin(W["horizont"]), lin(W["oben"]))

    # Sonne bzw. Mond: Richtung aus Höhe und fester Himmelsrichtung
    h = W["sonne_hoch"]
    sonne = (math.cos(h) * 0.6, math.cos(h) * 0.8, math.sin(h))
    sd = B.vek("DOT_PRODUCT", d, sonne)
    schein = B.mathe("POWER", B.mathe("MAXIMUM", sd, 0.0), 24.0 if not W["nacht"] else 80.0)
    schein = B.mathe("MULTIPLY", schein, 0.55 if not W["nacht"] else 0.35)
    scheibe = B.bereich(sd, 0.9985 if not W["nacht"] else 0.9993, 0.9992 if not W["nacht"] else 0.9997)
    farbe = B.misch(B.mathe("ADD", schein, scheibe, klemmen=True), farbe, lin(W["sonne"]))

    if W["nacht"]:
        # Sterne: Voronoi auf der Richtung, nur die Mitte jeder Zelle leuchtet; zum Horizont hin weniger
        vor = B.knoten("ShaderNodeTexVoronoi")
        B.ein(vor, "Vector", d)
        B.ein(vor, "Scale", 260.0)
        stern = B.bereich(vor.outputs["Distance"], 0.11, 0.0)
        hell = B.rauschen(d, 40.0, 2.0)
        stern = B.mathe("MULTIPLY", stern, B.bereich(hell, 0.3, 0.6))
        stern = B.mathe("MULTIPLY", stern, B.bereich(z, 0.05, 0.35))
        farbe = B.misch(stern, farbe, (1.0, 0.97, 0.9, 1))
        # ein Schleier wie Milchstraße / Nebel in Violett
        schleier = B.rauschen(B.vek("MULTIPLY", d, (1.0, 1.0, 3.0)), 2.2, 8.0, 0.6)
        schleier = B.mathe("MULTIPLY", B.bereich(schleier, 0.5, 0.75), B.bereich(z, 0.1, 0.5))
        farbe = B.misch(B.mathe("MULTIPLY", schleier, 0.35), farbe, lin(0x7a4ad8))

    # Wolken: Schicht über dem Kopf — Richtung auf eine Ebene projizieren (x/z, y/z)
    zz = B.mathe("MAXIMUM", z, 0.04)
    ebene = B.xyz(B.mathe("DIVIDE", x, zz), B.mathe("DIVIDE", y, zz), 0.0)
    w1 = B.rauschen(ebene, 0.35, 8.0, 0.58)
    w2 = B.rauschen(B.vek("MULTIPLY", ebene, (2.5, 2.5, 1)), 0.35, 4.0, 0.5)
    dicht = B.mathe("ADD", B.mathe("MULTIPLY", w1, 0.75), B.mathe("MULTIPLY", w2, 0.25))
    schwelle = 0.62 - W["wolken"] * 0.18
    maske = B.bereich(dicht, schwelle, schwelle + 0.12)
    maske = B.mathe("MULTIPLY", maske, B.bereich(z, 0.02, 0.22))
    # Unterseite der Wolken dunkler, Ränder zur Sonne hin heller
    schatten = B.bereich(dicht, schwelle + 0.05, schwelle + 0.3, 1.0, 0.72)
    wolke = B.misch(schatten, lin(W["horizont"]), lin(W["wolke"]))
    wolke = B.misch(B.mathe("MULTIPLY", schein, 1.5), wolke, lin(W["sonne"]))
    farbe = B.misch(B.mathe("MULTIPLY", maske, 0.92), farbe, wolke)

    # Ferne Hügel rundum: Höhe aus Rauschen auf dem Kreis der Himmelsrichtungen (nahtlos)
    rund = B.vek("NORMALIZE", B.xyz(x, y, 0.0))
    grob = B.rauschen(B.vek("MULTIPLY", rund, (1.6, 1.6, 1)), 1.0, 3.0, 0.5)
    fein = B.rauschen(B.vek("MULTIPLY", rund, (9.0, 9.0, 1)), 1.0, 4.0, 0.6)
    hoehe = B.mathe("ADD", B.mathe("MULTIPLY", grob, W["hoehe"] * 1.4), B.mathe("MULTIPLY", fein, W["hoehe"] * W["zacken"] * 0.5))
    hoehe = B.mathe("SUBTRACT", hoehe, W["hoehe"] * 0.45)
    berg = B.bereich(B.mathe("SUBTRACT", hoehe, z), -0.002, 0.002)
    # zwei Reihen: vorne kräftiger, hinten im Dunst
    hinten = B.mathe("ADD", B.mathe("MULTIPLY", B.rauschen(B.vek("MULTIPLY", rund, (3.0, 3.0, 1)), 1.0, 4.0, 0.55), W["hoehe"] * 1.7), -W["hoehe"] * 0.5)
    berg2 = B.bereich(B.mathe("SUBTRACT", hinten, z), -0.002, 0.002)
    dunst = B.misch(0.55, lin(W["huegel"]), lin(W["horizont"]))
    farbe = B.misch(berg2, farbe, dunst)
    vorn = B.misch(B.bereich(z, -0.02, W["hoehe"] * 1.2, 0.15, 0.45), lin(W["huegel"]), lin(W["horizont"]))
    farbe = B.misch(berg, farbe, vorn)
    # unter dem Horizont: Nebelfarbe (der Boden der Welt deckt das ohnehin)
    farbe = B.misch(B.bereich(z, 0.0, -0.04), farbe, lin(W["horizont"]))

    B.ein(licht, "Color", farbe)
    B.ein(licht, "Strength", 1.0)
    nt.links.new(licht.outputs[0], aus.inputs["Surface"])


def rendere(name, W, ordner):
    sz = bpy.context.scene
    sz.world = bpy.data.worlds.new("Himmel_" + name)
    himmel_shader(sz.world, W)
    if not sz.camera:
        kam = bpy.data.objects.new("Kamera", bpy.data.cameras.new("Kamera"))
        kam.data.type = "PANO"
        kam.data.panorama_type = "EQUIRECTANGULAR"
        kam.rotation_euler = (math.pi / 2, 0, 0)
        sz.collection.objects.link(kam)
        sz.camera = kam
    sz.render.engine = "CYCLES"
    sz.cycles.samples = 24
    sz.cycles.use_denoising = False
    sz.render.resolution_x, sz.render.resolution_y = 2048, 1024
    sz.view_settings.view_transform = "Standard"
    sz.view_settings.look = "None"
    sz.render.image_settings.file_format = "JPEG"
    sz.render.image_settings.quality = 88
    sz.render.filepath = os.path.abspath(os.path.join(ordner, name + ".jpg"))
    bpy.ops.render.render(write_still=True)
    print("HIMMEL", name)


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    grafikkarte()
    os.makedirs(ZIEL, exist_ok=True)
    for name, W in WELTEN.items():
        if not NUR or name in NUR:
            rendere(name, W, ZIEL)
