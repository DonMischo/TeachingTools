"""Kacheltexturen für die Gebäude der freien 3D-Ansicht: je Baustil Mauer, Boden und Decke.

Aufruf:
    blender -b --factory-startup --python scripts/bausatz/kacheln.py -- frontend/public/modelle/bausatz [stil …]

Ohne Stil-Namen entstehen alle. Ergebnis: kacheln/<stil>/<mauer|boden|decke>_<farbe|normal>.jpg —
nahtlos, eine Kachel ist ein Feld der 3D-Welt (1,4 m) breit und hoch. Wie es gerendert wird (3 × 3
verknüpfte Kopien, Farbe × Verdeckung, Normalen), steht in verlies3d.py.

Bausteine: quader (Mauerwerk), platten (Steinplatten, Fliesen, Schachbrett), dielen (Bretter),
balkenwand (Blockhaus), paneele (Beton, Metall, Kassetten), putz, fachwerk, tapete.
"""
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from baue import Teil, grafikkarte, hell, lin, mische  # noqa: E402
from verlies3d import (ZELLE, kachel_boden, kachel_decke, kachel_mauer, rendere_kachel, stein,  # noqa: E402
                       teilung_genau, zylinder)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ZIEL = ARGS[0] if ARGS else "frontend/public/modelle/bausatz"
NUR = ARGS[1:]


def hx(h, f=1.0):
    """0xRRGGBB (sRGB) → lineare Eckenfarbe, optional heller/dunkler"""
    return hell(lin(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255), f)


def streuung(r, farben, s=0.18):
    return hell(mische(farben[0], farben[-1], r.random()) if len(farben) > 1 else farben[0], 1 - s / 2 + r.random() * s)


def grund(t, farbe):
    t.quader((ZELLE / 2, ZELLE / 2, -0.03), (ZELLE * 1.02, ZELLE * 1.02, 0.04), farbe, fase=0)


# ── Bausteine ────────────────────────────────────────────────────────────────

def quader(seed, farben, fuge, reihen=8, lang=(0.25, 0.5), tief=0.07, vor=0.025, beulen=0.006, fase=0.018, spalt=0.018, teile=3):
    """Mauerwerk: `reihen` gleich hohe Reihen, Steine zufällig lang, jede Reihe genau eine Kachel"""
    r = random.Random(seed)
    t = Teil("q%d" % seed)
    grund(t, fuge)
    rh = ZELLE / reihen
    for k in range(reihen):
        x = r.uniform(0, lang[1])
        for l in teilung_genau(r, ZELLE, *lang):
            v = r.uniform(0, vor)
            stein(t, (x + l / 2, k * rh + rh / 2, tief / 2 + v / 2), (l - spalt, rh - spalt, tief + v), streuung(r, farben), r,
                  fase=fase, teile=teile, beulen=beulen)
            x += l
    return t


def platten(seed, farben, fuge, tiefe=(0.4, 0.75), lang=(0.4, 0.8), raster=None, schach=False, beulen=0.01, spalt=0.03, fase=0.03, kipp=0.02):
    """Bodenplatten: frei (Reihen verschieden geteilt) oder im Raster n × n, auf Wunsch im Schachbrett"""
    r = random.Random(seed)
    t = Teil("p%d" % seed)
    grund(t, fuge)
    if raster:
        s = ZELLE / raster
        for i in range(raster):
            for j in range(raster):
                c = farben[(i + j) % 2] if schach else streuung(r, farben)
                c = hell(c, 0.93 + r.random() * 0.12)
                stein(t, (i * s + s / 2, j * s + s / 2, 0.03), (s - spalt, s - spalt, 0.06), c, r, fase=fase, teile=3, beulen=beulen,
                      drehung=(r.uniform(-kipp, kipp) / 3, r.uniform(-kipp, kipp) / 3, 0))
        return t
    y = 0.0
    for d in teilung_genau(r, ZELLE, *tiefe):
        x = r.uniform(0, lang[1])
        for l in teilung_genau(r, ZELLE, *lang):
            stein(t, (x + l / 2, y + d / 2, 0.03 + r.uniform(-0.006, 0.006)), (l - spalt, d - spalt, 0.06), streuung(r, farben, 0.28), r,
                  fase=fase, teile=4, beulen=beulen, drehung=(r.uniform(-kipp, kipp), r.uniform(-kipp, kipp), r.uniform(-0.015, 0.015)))
            x += l
        y += d
    return t


def dielen(seed, farben, fuge, bretter=7, lang=(0.6, 1.4), senkrecht=False, spalt=0.014):
    """Bretter entlang x (senkrecht: entlang y), Stöße an zufälligen Stellen"""
    r = random.Random(seed)
    t = Teil("d%d" % seed)
    grund(t, fuge)
    b = ZELLE / bretter
    for k in range(bretter):
        x = r.uniform(0, ZELLE)
        for l in teilung_genau(r, ZELLE, *lang):
            c = streuung(r, farben, 0.3)
            m, g = ((x + l / 2, k * b + b / 2, 0.03), (l - 0.012, b - spalt, 0.05))
            if senkrecht:
                m, g = (m[1], m[0], m[2]), (g[1], g[0], g[2])
            stein(t, m, g, c, r, fase=0.01, teile=2, beulen=0.004, drehung=(0, 0, 0))
            x += l
    return t


def balkenwand(seed, farben, fuge, stämme=6):
    """Blockhaus: liegende Rundhölzer übereinander"""
    r = random.Random(seed)
    t = Teil("b%d" % seed)
    grund(t, fuge)
    h = ZELLE / stämme
    for k in range(stämme):
        rad = h * 0.56
        zylinder(t, (ZELLE / 2, k * h + h / 2, -rad * 0.35), rad, ZELLE * 3.2, streuung(r, farben, 0.3), seiten=14, achse="x")
    return t


def paneele(seed, farbe, fuge, nx=2, ny=2, nieten=False, loecher=False, vertieft=False, spalt=0.02, fase=0.01, beulen=0.002):
    """Platten im Raster: Metall mit Nieten, Beton mit Ankerlöchern, Kassetten (vertieft: Rahmen hoch, Feld tief)"""
    r = random.Random(seed)
    t = Teil("n%d" % seed)
    grund(t, fuge)
    bx, by = ZELLE / nx, ZELLE / ny
    for i in range(nx):
        for j in range(ny):
            mx, my = i * bx + bx / 2, j * by + by / 2
            c = hell(farbe, 0.92 + r.random() * 0.14)
            if vertieft:
                for (ox, oy, sx, sy) in ((0, by / 2 - 0.05, bx, 0.1), (0, -by / 2 + 0.05, bx, 0.1), (bx / 2 - 0.05, 0, 0.1, by), (-bx / 2 + 0.05, 0, 0.1, by)):
                    stein(t, (mx + ox, my + oy, 0.05), (sx, sy, 0.1), c, r, fase=0.02, teile=1, beulen=beulen, drehung=(0, 0, 0))
                stein(t, (mx, my, 0.015), (bx - 0.24, by - 0.24, 0.03), hell(c, 0.9), r, fase=0.03, teile=2, beulen=beulen, drehung=(0, 0, 0))
            else:
                stein(t, (mx, my, 0.03), (bx - spalt, by - spalt, 0.06), c, r, fase=fase, teile=3, beulen=beulen, drehung=(0, 0, 0))
            if nieten:
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        zylinder(t, (mx + sx * (bx / 2 - 0.05), my + sy * (by / 2 - 0.05), 0.065), 0.012, 0.012, hell(farbe, 1.15), seiten=8)
            if loecher:
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        zylinder(t, (mx + sx * bx / 4, my + sy * by / 4, 0.058), 0.018, 0.006, hell(farbe, 0.45), seiten=10)
    return t


def putz(seed, farbe, beulen=0.006):
    """Glatter Putz: eine Fläche, leicht wellig"""
    r = random.Random(seed)
    t = Teil("u%d" % seed)
    grund(t, hell(farbe, 0.8))
    for dx in (0, 1):
        for dy in (0, 1):
            stein(t, (dx * ZELLE / 2 + ZELLE / 4, dy * ZELLE / 2 + ZELLE / 4, 0.02), (ZELLE / 2 + 0.002, ZELLE / 2 + 0.002, 0.04), farbe, r,
                  fase=0, teile=8, beulen=beulen, drehung=(0, 0, 0))
    return t


def fachwerk(seed, putzfarbe, holzfarbe):
    """Fachwerk: Putzfelder zwischen Ständern, Riegel in halber Höhe, ein Schrägband"""
    r = random.Random(seed)
    t = putz(seed, putzfarbe, beulen=0.008)
    b = 0.16
    stein(t, (0.08, ZELLE / 2, 0.05), (b, ZELLE + 0.002, 0.07), holzfarbe, r, fase=0.012, teile=2, beulen=0.004, drehung=(0, 0, 0))
    stein(t, (ZELLE / 2, ZELLE * 0.5, 0.05), (ZELLE + 0.002, b * 0.9, 0.07), hell(holzfarbe, 0.95), r, fase=0.012, teile=2, beulen=0.004, drehung=(0, 0, 0))
    w = math.atan2(ZELLE * 0.5, ZELLE - b)
    lang = math.hypot(ZELLE * 0.5, ZELLE - b)
    stein(t, (ZELLE / 2 + b / 2, ZELLE * 0.25, 0.048), (lang, b * 0.8, 0.065), hell(holzfarbe, 0.9), r, fase=0.012, teile=2, beulen=0.004, drehung=(0, 0, w))
    return t


def tapete(seed, farbe):
    """Tapete: glatte Fläche; das Streifenmuster kommt aus dem Shader (Maserung »streifen«)"""
    return putz(seed, farbe, beulen=0.002)


# ── Stile ────────────────────────────────────────────────────────────────────
# je Stil: (Teil, Maserung) für Mauer, Boden, Decke. Farben angelehnt an die Paletten in szene.ts.

def stile():
    S = {}
    S["verlies"] = {"mauer": (kachel_mauer, "stein"), "boden": (kachel_boden, "stein"), "decke": (kachel_decke, "holz")}
    S["burg"] = {
        "mauer": (lambda: quader(401, [hx(0xa8a29e), hx(0x8a8580)], hx(0x3a3634), reihen=5, lang=(0.4, 0.8), tief=0.09, vor=0.03), "stein"),
        "boden": (lambda: platten(402, [hx(0xc9c2b8), hx(0x9c958c)], hx(0x4a443e)), "stein"),
        "decke": (lambda: dielen(403, [hx(0x6b4423), hx(0x8a5a30)], hx(0x1c120a), bretter=6), "holz"),
    }
    S["gotisch"] = {
        "mauer": (lambda: quader(411, [hx(0x6b6560), hx(0x55504c)], hx(0x24211f), reihen=6, lang=(0.3, 0.55), tief=0.08), "stein"),
        "boden": (lambda: platten(412, [hx(0x8f8a84), hx(0x3f3a36)], hx(0x1c1917), raster=4, schach=True, beulen=0.004, kipp=0.0), "marmor"),
        "decke": (lambda: quader(413, [hx(0x57524d), hx(0x44403c)], hx(0x1c1917), reihen=4, lang=(0.45, 0.7)), "stein"),
    }
    S["mittelalter"] = {
        "mauer": (lambda: fachwerk(421, hx(0xf0e8d4), hx(0x4a2c17)), "glatt"),
        "boden": (lambda: dielen(422, [hx(0x9c7a52), hx(0x7a5a38)], hx(0x2a1a0e), bretter=6), "holz"),
        "decke": (lambda: dielen(423, [hx(0x4a2c17), hx(0x5c3a1f)], hx(0x140c06), bretter=5), "holz"),
    }
    S["antike"] = {
        "mauer": (lambda: quader(431, [hx(0xf7f5f0), hx(0xe6e1d6)], hx(0xc9c2b5), reihen=3, lang=(0.6, 1.4), tief=0.05, vor=0.006, beulen=0.002, fase=0.012, spalt=0.008), "marmor"),
        "boden": (lambda: platten(432, [hx(0xf3efe6), hx(0xb5643c)], hx(0x8a7a66), raster=2, schach=True, beulen=0.002, spalt=0.012, fase=0.012, kipp=0.0), "marmor"),
        "decke": (lambda: paneele(433, hx(0xece6d8), hx(0xb8ad98), nx=2, ny=2, vertieft=True), "glatt"),
    }
    S["klassisch"] = {
        "mauer": (lambda: putz(441, hx(0xe7dccd)), "glatt"),
        "boden": (lambda: dielen(442, [hx(0xc9975c), hx(0xa8763e)], hx(0x4a3218), bretter=10, lang=(0.3, 0.6)), "holz"),
        "decke": (lambda: putz(443, hx(0xf5f1ea)), "glatt"),
    }
    S["viktorianisch"] = {
        "mauer": (lambda: tapete(451, hx(0x1f5a36)), "streifen"),
        "boden": (lambda: dielen(452, [hx(0x6b3a2a), hx(0x8a4a30)], hx(0x24120a), bretter=9, lang=(0.3, 0.7)), "holz"),
        "decke": (lambda: paneele(453, hx(0xe9dfc8), hx(0xb0a080), nx=2, ny=2, vertieft=True), "glatt"),
    }
    S["retro"] = {
        "mauer": (lambda: tapete(461, hx(0xd9822b)), "streifen"),
        "boden": (lambda: putz(462, hx(0xb5651d), beulen=0.012), "stein"),
        "decke": (lambda: putz(463, hx(0xf3e7c9)), "glatt"),
    }
    S["holz"] = {
        "mauer": (lambda: balkenwand(471, [hx(0x8b5a2b), hx(0xa86c34)], hx(0x2a1a0c)), "holz"),
        "boden": (lambda: dielen(472, [hx(0xe0b47e), hx(0xc4945a)], hx(0x5a3a1a), bretter=6), "holz"),
        "decke": (lambda: dielen(473, [hx(0x7a4a22), hx(0x6a3e1c)], hx(0x24160a), bretter=6), "holz"),
    }
    S["eis"] = {
        "mauer": (lambda: quader(481, [hx(0xbfe6fa), hx(0x8fd0f2)], hx(0x5aa8d8), reihen=4, lang=(0.45, 0.8), tief=0.07, vor=0.02, beulen=0.008, fase=0.03), "eis"),
        "boden": (lambda: platten(482, [hx(0xeaf6fd), hx(0xcfe9f8)], hx(0x8cc4e6), raster=3, beulen=0.006, kipp=0.01), "eis"),
        "decke": (lambda: quader(483, [hx(0xd8f0fc), hx(0xa8daf4)], hx(0x6ab0dc), reihen=3, lang=(0.5, 0.9)), "eis"),
    }
    S["wueste"] = {
        "mauer": (lambda: quader(491, [hx(0xe8b96a), hx(0xd49a4a)], hx(0x8a5a26), reihen=5, lang=(0.45, 0.9), tief=0.08, beulen=0.01), "stein"),
        "boden": (lambda: platten(492, [hx(0xf2d48e), hx(0xe0b868)], hx(0xa87a3a), raster=3, beulen=0.008, kipp=0.01), "stein"),
        "decke": (lambda: dielen(493, [hx(0xb08850), hx(0x9a7444)], hx(0x4a3218), bretter=5), "holz"),
    }
    S["beton"] = {
        "mauer": (lambda: paneele(501, hx(0xb4afaa), hx(0x6a6662), nx=1, ny=2, loecher=True, spalt=0.012, fase=0.004), "glatt"),
        "boden": (lambda: paneele(502, hx(0xc9c5c0), hx(0x7a7672), nx=1, ny=1, spalt=0.01, fase=0.004), "glatt"),
        "decke": (lambda: paneele(503, hx(0xd6d2cd), hx(0x8a8682), nx=1, ny=1, loecher=True, spalt=0.01, fase=0.004), "glatt"),
    }
    S["raumstation"] = {
        "mauer": (lambda: paneele(511, hx(0x4a5a70), hx(0x10161f), nx=2, ny=3, nieten=True, spalt=0.03, fase=0.02), "metall"),
        "boden": (lambda: paneele(512, hx(0x5f6f82), hx(0x1a222c), nx=2, ny=2, nieten=True, spalt=0.03, fase=0.015), "metall"),
        "decke": (lambda: paneele(513, hx(0x3a4658), hx(0x0c1118), nx=2, ny=2, nieten=True, spalt=0.04), "metall"),
    }
    S["neon"] = {
        "mauer": (lambda: paneele(521, hx(0x3a3a40), hx(0x0c0c0e), nx=1, ny=4, spalt=0.012, fase=0.006), "metall"),
        "boden": (lambda: platten(522, [hx(0xdedee2), hx(0xcfcfd4)], hx(0x8a8a90), raster=4, beulen=0.002, spalt=0.012, fase=0.01, kipp=0.0), "glatt"),
        "decke": (lambda: paneele(523, hx(0xf2f2f4), hx(0xa0a0a6), nx=2, ny=2, spalt=0.015), "glatt"),
    }
    return S


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    grafikkarte()
    for stil, kacheln in stile().items():
        if NUR and stil not in NUR:
            continue
        ordner = os.path.join(ZIEL, "kacheln", stil)
        os.makedirs(ordner, exist_ok=True)
        for name, (bau, maserung) in kacheln.items():
            rendere_kachel(bau(), maserung, ordner, name, proben=(128, 32))
        print("STIL", stil, "fertig")
