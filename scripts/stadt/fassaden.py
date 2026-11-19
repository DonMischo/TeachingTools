"""Kacheltexturen für die Häuser der 3D-Stadt: Fassaden (je ein Fensterfeld) und Dächer.

Aufruf:
    blender -b --factory-startup --python scripts/stadt/fassaden.py -- frontend/public/modelle/stadt/kacheln

Ergebnis: <kachel>_farbe.jpg und <kachel>_normal.jpg für
    putz        Fensterfeld 3,4 × 3,1 m (eine Achse, ein Geschoss): Putz, Fenster mit Rahmen und Sprossen,
                Faschen, Sohlbank, Gurtgesims an der Geschossgrenze
    ziegel      dasselbe Feld in Backstein
    dach        Biberschwanz-Ziegel, 2 × 2 m
    flachdach   Bahnen mit Nähten, 2 × 2 m
Die Farben sind hell und fast grau: das Frontend färbt Putz und Dach je Haus (components/stadt/drei/fassade.ts),
nur der Backstein bringt seine eigene Farbe mit. Gerendert wie die Kacheln der 3D-Gebäude
(scripts/bausatz/verlies3d.py: 3 × 3 verknüpfte Kopien, Farbe × Verdeckung, Normalen).
Kachel-Koordinaten: x entlang der Wand bzw. Traufe, y nach oben bzw. den Hang hinauf, z aus der Fläche heraus.
"""
import os
import random
import sys

import bpy

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HIER, "..", "bausatz"))
from baue import Teil, grafikkarte, hell, lin, mische  # noqa: E402
from verlies3d import rendere_kachel, stein, teilung_genau  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/stadt/kacheln"

ACHSE, GESCHOSS = 3.4, 3.1
# Fensteröffnung wie im bisherigen Shader (components/stadt/drei/szene.ts): 30–70 % der Achse, 38–84 % des Geschosses
FX0, FX1 = 0.3 * ACHSE, 0.7 * ACHSE
FY0, FY1 = 0.38 * GESCHOSS, 0.84 * GESCHOSS
PUTZ = lin(0.86, 0.85, 0.83)
STEIN = lin(0.93, 0.91, 0.87)
RAHMEN = lin(0.95, 0.95, 0.94)
GLAS = lin(0.07, 0.09, 0.12)
FUGE = lin(0.3, 0.29, 0.28)


def flaeche(t, r, x0, y0, x1, y1, farbe, z=0.0, dick=0.06, teile=6, beulen=0.004):
    if x1 - x0 < 0.01 or y1 - y0 < 0.01:
        return
    stein(t, ((x0 + x1) / 2, (y0 + y1) / 2, z + dick / 2), (x1 - x0, y1 - y0, dick), farbe, r, fase=0, teile=teile, beulen=beulen, drehung=(0, 0, 0))


def fenster(t, r):
    """Fenster in der Öffnung: Glas tief innen, Blendrahmen, Sprossenkreuz, Faschen, Sohlbank"""
    b = 0.07
    flaeche(t, r, FX0, FY0, FX1, FY1, GLAS, z=-0.14, dick=0.02, teile=2, beulen=0.001)
    # Laibung: dunkle Innenseiten der Öffnung
    for (x0, y0, x1, y1) in ((FX0, FY0, FX0 + 0.02, FY1), (FX1 - 0.02, FY0, FX1, FY1), (FX0, FY1 - 0.02, FX1, FY1)):
        flaeche(t, r, x0, y0, x1, y1, hell(PUTZ, 0.6), z=-0.14, dick=0.14, teile=0)
    # Blendrahmen und Sprossen
    for (x0, y0, x1, y1) in ((FX0, FY0, FX0 + b, FY1), (FX1 - b, FY0, FX1, FY1), (FX0, FY0, FX1, FY0 + b), (FX0, FY1 - b, FX1, FY1)):
        stein(t, ((x0 + x1) / 2, (y0 + y1) / 2, -0.09), (x1 - x0, y1 - y0, 0.05), RAHMEN, r, fase=0.008, teile=0, beulen=0.0, drehung=(0, 0, 0))
    mx, kreuz = (FX0 + FX1) / 2, FY0 + (FY1 - FY0) * 0.68
    stein(t, (mx, (FY0 + FY1) / 2, -0.095), (0.045, FY1 - FY0 - 2 * b, 0.04), RAHMEN, r, fase=0.006, teile=0, beulen=0.0, drehung=(0, 0, 0))
    stein(t, (mx, kreuz, -0.095), (FX1 - FX0 - 2 * b, 0.045, 0.04), RAHMEN, r, fase=0.006, teile=0, beulen=0.0, drehung=(0, 0, 0))
    # Faschen (Umrahmung aus Stein), Sohlbank darunter, Verdachung darüber
    f = 0.13
    for (x0, y0, x1, y1) in ((FX0 - f, FY0, FX0, FY1 + f), (FX1, FY0, FX1 + f, FY1 + f), (FX0, FY1, FX1, FY1 + f)):
        stein(t, ((x0 + x1) / 2, (y0 + y1) / 2, 0.055), (x1 - x0, y1 - y0, 0.05), STEIN, r, fase=0.012, teile=2, beulen=0.002, drehung=(0, 0, 0))
    stein(t, ((FX0 + FX1) / 2, FY0 - 0.05, 0.07), (FX1 - FX0 + 2 * f + 0.12, 0.1, 0.1), hell(STEIN, 0.95), r, fase=0.015, teile=2, beulen=0.002, drehung=(0, 0, 0))
    stein(t, ((FX0 + FX1) / 2, FY1 + f + 0.04, 0.08), (FX1 - FX0 + 2 * f + 0.1, 0.08, 0.08), STEIN, r, fase=0.015, teile=2, beulen=0.002, drehung=(0, 0, 0))


def um_fenster(t, r, farbe, z, dick):
    """Fläche rund um die Öffnung: unten und oben über die ganze Achse, seitlich nur in Fensterhöhe —
    so liegen die Stöße unter Sohlbank, Verdachung und Faschen statt quer durchs Geschoss"""
    flaeche(t, r, 0, 0, ACHSE, FY0, farbe, z=z, dick=dick)
    flaeche(t, r, 0, FY1, ACHSE, GESCHOSS, farbe, z=z, dick=dick)
    flaeche(t, r, 0, FY0, FX0, FY1, farbe, z=z, dick=dick)
    flaeche(t, r, FX1, FY0, ACHSE, FY1, farbe, z=z, dick=dick)


def gesims(t, r):
    """Gurtgesims an der Geschossgrenze (unten in der Kachel, nahtlos über die Achse)"""
    stein(t, (ACHSE / 2, 0.07, 0.06), (ACHSE * 1.002, 0.14, 0.08), STEIN, r, fase=0.02, teile=2, beulen=0.002, drehung=(0, 0, 0))


def kachel_putz():
    r = random.Random(1)
    t = Teil("putz")
    t.quader((ACHSE / 2, GESCHOSS / 2, -0.2), (ACHSE * 1.02, GESCHOSS * 1.02, 0.04), FUGE, fase=0)
    um_fenster(t, r, PUTZ, 0.0, 0.06)
    fenster(t, r)
    gesims(t, r)
    return t


def kachel_ziegel():
    """Backstein im Läuferverband; Steine, die in die Öffnung ragen, werden seitlich gekappt"""
    r = random.Random(2)
    t = Teil("ziegel")
    t.quader((ACHSE / 2, GESCHOSS / 2, -0.2), (ACHSE * 1.02, GESCHOSS * 1.02, 0.04), lin(0.62, 0.6, 0.56), fase=0)
    um_fenster(t, r, lin(0.62, 0.6, 0.56), -0.02, 0.02)
    reihen = 40
    rh = GESCHOSS / reihen
    for k in range(reihen):
        y0, y1 = k * rh, (k + 1) * rh
        im_fenster = y1 > FY0 - 0.02 and y0 < FY1 + 0.02
        x = (0.125 if k % 2 else 0.0)
        for lang in teilung_genau(r, ACHSE, 0.23, 0.26):
            stuecke = [(x, x + lang)]
            if im_fenster:
                stuecke = [(a, min(b, FX0)) for a, b in stuecke if a < FX0] + [(max(a, FX1), b) for a, b in stuecke if b > FX1]
            for a, b in stuecke:
                if b - a < 0.03:
                    continue
                c = hell(mische(lin(0.62, 0.26, 0.17), lin(0.45, 0.2, 0.14), r.random()), 0.85 + r.random() * 0.3)
                stein(t, ((a + b) / 2, (y0 + y1) / 2, 0.02), (b - a - 0.012, rh - 0.012, 0.04), c, r, fase=0.008, teile=0, beulen=0.002,
                      drehung=(0, 0, r.uniform(-0.004, 0.004)))
            x += lang
    fenster(t, r)
    gesims(t, r)
    return t


def kachel_dach():
    """Biberschwanz: Reihen leicht gekippter Ziegel, jede Reihe um einen halben Ziegel versetzt"""
    r = random.Random(3)
    t = Teil("dach")
    t.quader((1.0, 1.0, -0.06), (2.04, 2.04, 0.04), lin(0.2, 0.19, 0.18), fase=0)
    reihen, breit = 9, 2.0 / 11
    rh = 2.0 / reihen
    for k in range(reihen):
        x = breit / 2 if k % 2 else 0.0
        for i in range(11):
            c = hell(lin(0.8, 0.78, 0.76), 0.78 + r.random() * 0.34)
            stein(t, (x + i * breit + breit / 2, k * rh + rh * 0.55, 0.02), (breit - 0.012, rh * 1.25, 0.022), c, r, fase=0.01, teile=1, beulen=0.003,
                  drehung=(-0.12, 0, r.uniform(-0.02, 0.02)))
    return t


def kachel_flachdach():
    r = random.Random(4)
    t = Teil("flachdach")
    t.quader((1.0, 1.0, -0.04), (2.04, 2.04, 0.04), lin(0.4, 0.4, 0.4), fase=0)
    for i in range(2):
        flaeche(t, r, i * 1.0 + 0.01, 0, i * 1.0 + 0.99, 2.0, hell(lin(0.7, 0.7, 0.69), 0.92 + r.random() * 0.1), z=0, dick=0.03, teile=6, beulen=0.006)
        stein(t, (i * 1.0 + 0.995, 1.0, 0.025), (0.03, 2.002, 0.02), lin(0.62, 0.62, 0.6), r, fase=0.008, teile=0, beulen=0.0, drehung=(0, 0, 0))
    return t


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    grafikkarte()
    os.makedirs(ZIEL, exist_ok=True)
    for name, bau, maserung, groesse in (("putz", kachel_putz, "glatt", (ACHSE, GESCHOSS)), ("ziegel", kachel_ziegel, "stein", (ACHSE, GESCHOSS)),
                                         ("dach", kachel_dach, "glatt", (2.0, 2.0)), ("flachdach", kachel_flachdach, "glatt", (2.0, 2.0))):
        rendere_kachel(bau(), maserung, ZIEL, name, proben=(128, 32), groesse=groesse, pixel=512)
