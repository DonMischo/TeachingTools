"""
Die sechs Verdächtigen im Challenge-Modus Detektiv als 32×32-Pixelfiguren (eigene Arbeit, CC BY 4.0).
Je Figur vier Standbilder: ruhig, eingeatmet (Oberkörper 1 px tiefer), ruhig, Blinzeln.

Aufruf (aus dem Repo-Wurzelordner):  python scripts/npcs/zeichne_npcs.py [--vorschau datei.png]
Schreibt nach frontend/public/challenge/pixel/npcs/<name>_idle_<1..4>.png
"""
import sys
from pathlib import Path
from PIL import Image

ZIEL = Path(__file__).resolve().parents[2] / "frontend/public/challenge/pixel/npcs"
N = 32
KONTUR = (27, 20, 32, 255)


def farbe(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def dunkler(c, f=0.72):
    return tuple(int(v * f) for v in c[:3]) + (255,)


def heller(c, f=0.35):
    return tuple(int(v + (255 - v) * f) for v in c[:3]) + (255,)


class Blatt:
    """32×32-Raster; `dy` verschiebt alles oberhalb der Beine (Atmen)."""

    def __init__(self, dy=0, blinzeln=False):
        self.p = {}
        self.dy = dy
        self.blinzeln = blinzeln

    def px(self, x, y, c, fest=False):
        y = y if fest or y >= 27 else y + self.dy
        if 0 <= x < N and 0 <= y < N:
            self.p[(x, y)] = c

    def rect(self, x0, y0, x1, y1, c, fest=False):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c, fest)

    def zeilen(self, y0, zeilen, c):
        """Zeilen als (x0, x1) — praktisch für runde Formen."""
        for i, (a, b) in enumerate(zeilen):
            self.rect(a, y0 + i, b, y0 + i, c)

    def bild(self):
        im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for (x, y), c in self.p.items():
            im.putpixel((x, y), c)
        # Kontur: jedes leere Pixel neben einer Figur wird dunkel
        rand = []
        for y in range(N):
            for x in range(N):
                if (x, y) in self.p:
                    continue
                if any((x + a, y + b) in self.p for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    rand.append((x, y))
        for xy in rand:
            im.putpixel(xy, KONTUR)
        return im


# ── gemeinsame Teile ─────────────────────────────────────────────────────────

def beine(b, hose, schuh):
    b.rect(12, 27, 14, 29, hose, fest=True)
    b.rect(17, 27, 19, 29, hose, fest=True)
    b.rect(14, 27, 14, 29, dunkler(hose), fest=True)
    b.rect(19, 27, 19, 29, dunkler(hose), fest=True)
    b.rect(11, 30, 14, 30, schuh, fest=True)
    b.rect(17, 30, 20, 30, schuh, fest=True)


def rumpf(b, stoff, haut, aermel=None):
    aermel = aermel or stoff
    b.rect(10, 18, 21, 26, stoff)
    b.rect(10, 18, 10, 26, dunkler(stoff))
    b.rect(21, 18, 21, 26, dunkler(stoff))
    # Arme mit Händen
    b.rect(8, 19, 9, 24, aermel)
    b.rect(22, 19, 23, 24, aermel)
    b.rect(8, 19, 8, 24, dunkler(aermel))
    b.rect(23, 19, 23, 24, dunkler(aermel))
    b.rect(8, 25, 9, 26, haut)
    b.rect(22, 25, 23, 26, haut)


def kopf(b, haut, augen="#2b2a4a", wangen=True, mund=True):
    b.zeilen(6, [(12, 19), (11, 20)] + [(10, 21)] * 8 + [(11, 20), (12, 19)], haut)
    b.rect(21, 8, 21, 15, dunkler(haut, 0.88))
    b.rect(12, 17, 19, 17, dunkler(haut, 0.88))
    a = farbe(augen)
    if b.blinzeln:
        b.rect(12, 12, 13, 12, a)
        b.rect(18, 12, 19, 12, a)
    else:
        b.rect(12, 11, 13, 12, a)
        b.rect(18, 11, 19, 12, a)
        b.px(12, 11, heller(a, 0.75))
        b.px(18, 11, heller(a, 0.75))
    if wangen:
        b.px(11, 14, farbe("#e8907c"))
        b.px(20, 14, farbe("#e8907c"))
    if mund:
        b.rect(15, 15, 16, 15, dunkler(haut, 0.55))


# ── die Verdächtigen ─────────────────────────────────────────────────────────

def herr_brandt(b):
    """Handwerker: Schiebermütze, Schnauzer, Weste mit Hosenträgern."""
    haut, hemd, weste = farbe("#f1c27d"), farbe("#e9e4d8"), farbe("#7a5230")
    beine(b, farbe("#4a4e69"), farbe("#2e2018"))
    rumpf(b, hemd, haut)
    b.rect(10, 18, 13, 26, weste)
    b.rect(18, 18, 21, 26, weste)
    b.rect(10, 18, 10, 26, dunkler(weste))
    b.rect(21, 18, 21, 26, dunkler(weste))
    b.px(12, 21, farbe("#d9b44a"))
    b.px(12, 23, farbe("#d9b44a"))
    b.rect(10, 26, 21, 26, farbe("#3b2a1a"))  # Gürtel
    kopf(b, haut, mund=False)
    b.rect(13, 14, 18, 14, farbe("#5a3a22"))  # Schnauzer
    b.px(13, 15, farbe("#5a3a22"))
    b.px(18, 15, farbe("#5a3a22"))
    b.rect(10, 9, 10, 12, farbe("#5a3a22"))   # Koteletten
    b.rect(21, 9, 21, 12, farbe("#5a3a22"))
    kappe = farbe("#6b6f5a")
    b.zeilen(4, [(12, 19), (10, 21), (9, 22), (9, 22)], kappe)
    b.rect(9, 7, 23, 8, dunkler(kappe))      # Schirm
    b.rect(13, 4, 18, 4, heller(kappe, 0.2))
    b.px(15, 5, dunkler(kappe))


def frau_keller(b):
    """Haushälterin: Dutt, grünes Kleid, weiße Schürze, Schlüsselbund."""
    haut, kleid, haar = farbe("#f6d5b8"), farbe("#3f7d5c"), farbe("#a0442a")
    b.rect(11, 25, 20, 29, kleid, fest=True)   # Rock bis unten
    b.rect(11, 25, 11, 29, dunkler(kleid), fest=True)
    b.rect(20, 25, 20, 29, dunkler(kleid), fest=True)
    b.rect(12, 30, 14, 30, farbe("#2e2018"), fest=True)
    b.rect(17, 30, 19, 30, farbe("#2e2018"), fest=True)
    rumpf(b, kleid, haut)
    b.rect(12, 20, 19, 28, farbe("#f4f1ea"))  # Schürze
    b.rect(12, 20, 12, 28, farbe("#d8d2c4"))
    b.rect(13, 19, 18, 19, farbe("#f4f1ea"))
    b.rect(22, 25, 23, 27, farbe("#c9a227"))  # Schlüssel
    b.px(23, 28, farbe("#c9a227"))
    kopf(b, haut)
    b.zeilen(4, [(13, 18), (11, 20), (10, 21), (10, 21)], haar)
    b.rect(10, 8, 10, 13, haar)
    b.rect(21, 8, 21, 13, haar)
    b.rect(11, 8, 14, 8, haar)               # Scheitel
    b.zeilen(0, [(14, 17), (13, 18), (13, 18), (14, 17)], dunkler(haar, 0.85))  # Dutt
    b.px(15, 1, heller(haar))


def haendler_voss(b):
    """Händler: breitkrempiger Hut, Brille, pflaumenfarbener Mantel, Goldkette, Geldbeutel."""
    haut, mantel = farbe("#a86b45"), farbe("#6d2f5c")
    beine(b, farbe("#3a3550"), farbe("#1e1a14"))
    rumpf(b, mantel, haut)
    b.rect(15, 18, 16, 26, farbe("#f0e6c8"))  # Hemd
    for x, y in ((13, 19), (14, 20), (17, 20), (18, 19), (15, 21), (16, 21)):
        b.px(x, y, farbe("#e8c04a"))         # Goldkette
    b.rect(5, 23, 7, 26, farbe("#b07a2a"))    # Geldbeutel
    b.px(6, 22, farbe("#7a5118"))
    b.px(6, 24, farbe("#e8c04a"))
    kopf(b, haut, wangen=False)
    b.rect(11, 10, 14, 13, farbe("#2b2a4a"))  # Brille
    b.rect(17, 10, 20, 13, farbe("#2b2a4a"))
    b.rect(12, 11, 13, 12, farbe("#bfe3f0") if not b.blinzeln else haut)
    b.rect(18, 11, 19, 12, farbe("#bfe3f0") if not b.blinzeln else haut)
    if b.blinzeln:
        b.rect(12, 12, 13, 12, farbe("#2b2a4a"))
        b.rect(18, 12, 19, 12, farbe("#2b2a4a"))
    b.rect(15, 11, 16, 11, farbe("#2b2a4a"))
    b.rect(13, 15, 18, 16, farbe("#2b1d14"))  # Kinnbart
    b.rect(15, 15, 16, 15, farbe("#7a3b2a"))
    hut = farbe("#3a2a20")
    b.rect(7, 7, 24, 8, hut)
    b.zeilen(2, [(12, 19), (11, 20), (11, 20), (11, 20), (11, 20)], hut)
    b.rect(11, 6, 20, 6, farbe("#c0392b"))    # Hutband
    b.rect(12, 2, 19, 2, heller(hut, 0.15))


def magister_lenz(b):
    """Magister: spitzer Sternenhut, langer weißer Bart, Robe, Stab mit Kugel."""
    haut, robe = farbe("#f0c8a0"), farbe("#2f4b9a")
    b.rect(10, 25, 21, 29, robe, fest=True)
    b.rect(10, 25, 10, 29, dunkler(robe), fest=True)
    b.rect(21, 25, 21, 29, dunkler(robe), fest=True)
    b.rect(11, 30, 14, 30, farbe("#4a3426"), fest=True)
    b.rect(17, 30, 20, 30, farbe("#4a3426"), fest=True)
    rumpf(b, robe, haut)
    b.rect(10, 22, 21, 22, farbe("#d4af37"))  # Gürtel
    b.rect(25, 9, 25, 29, farbe("#7a5230"))   # Stab
    b.px(25, 29, farbe("#7a5230"), fest=True)
    b.rect(24, 6, 26, 8, farbe("#7fe0ff"))
    b.px(24, 6, farbe("#e8fbff"))
    b.rect(22, 25, 25, 26, haut)              # Hand am Stab
    kopf(b, haut, wangen=False, mund=False)
    bart = farbe("#ecebe6")
    b.zeilen(13, [(11, 20), (11, 20), (12, 19), (12, 19), (13, 18), (13, 18), (14, 17), (14, 17), (15, 16)], bart)
    b.rect(11, 13, 11, 15, dunkler(bart, 0.85))
    b.rect(14, 13, 17, 13, farbe("#cfcdc4"))  # Schnurrbart
    b.rect(11, 9, 14, 9, bart)                # Augenbrauen
    b.rect(17, 9, 20, 9, bart)
    hut = farbe("#283e86")
    b.zeilen(0, [(17, 18), (16, 18), (15, 18), (14, 18), (13, 19), (12, 19), (11, 20)], hut)
    b.rect(8, 7, 23, 8, dunkler(hut))
    b.px(15, 3, farbe("#f7d64a"))
    b.px(17, 5, farbe("#f7d64a"))
    b.px(13, 6, farbe("#f7d64a"))


def dr_siedler(b):
    """Alchemistin: wilde graue Haare, Schutzbrille auf der Stirn, Laborkittel, grüner Kolben."""
    haut, kittel, haar = farbe("#f3d2b3"), farbe("#eef0ee"), farbe("#9aa0a8")
    beine(b, farbe("#40434e"), farbe("#202024"))
    rumpf(b, kittel, haut)
    b.rect(15, 18, 16, 26, farbe("#7a3b5a"))  # Bluse unterm Kittel
    b.rect(12, 23, 13, 24, farbe("#c9ced2"))  # Tasche
    b.px(13, 22, farbe("#3a6ea5"))            # Stift
    # Kolben in der rechten Hand
    b.rect(23, 21, 23, 22, farbe("#d6eef0"))
    b.zeilen(23, [(22, 24), (21, 25), (21, 25)], farbe("#5be06a"))
    b.px(22, 23, farbe("#c8ffd0"))
    kopf(b, haut)
    b.zeilen(2, [(11, 13), (10, 21), (9, 22), (8, 23), (8, 23)], haar)
    b.px(18, 2, haar)
    b.px(20, 3, heller(haar))
    b.rect(8, 7, 9, 13, haar)
    b.rect(22, 7, 23, 13, haar)
    b.rect(7, 9, 7, 11, haar)
    b.rect(24, 9, 24, 11, haar)
    b.rect(10, 7, 21, 7, farbe("#5a4632"))    # Brillenband
    b.rect(11, 6, 14, 8, farbe("#b8862f"))    # Schutzbrille
    b.rect(17, 6, 20, 8, farbe("#b8862f"))
    b.rect(12, 7, 13, 7, farbe("#9fe8ff"))
    b.rect(18, 7, 19, 7, farbe("#9fe8ff"))


def baron_falk(b):
    """Baron: Zylinder, Monokel, gezwirbelter Schnurrbart, Frack mit roter Schärpe."""
    haut, frack = farbe("#f2cfb0"), farbe("#22223a")
    beine(b, farbe("#2a2a40"), farbe("#0f0f18"))
    rumpf(b, frack, haut, aermel=frack)
    b.rect(14, 18, 17, 25, farbe("#f4f1ea"))  # Hemdbrust
    b.rect(15, 18, 16, 18, farbe("#a01f2b"))  # Fliege
    b.px(14, 18, farbe("#a01f2b"))
    b.px(17, 18, farbe("#a01f2b"))
    for i in range(8):                        # Schärpe schräg
        b.rect(11 + i, 19 + i, 12 + i, 19 + i, farbe("#b3263a"))
    b.px(19, 21, farbe("#e8c04a"))            # Orden
    b.rect(5, 18, 5, 26, farbe("#2b1d14"))    # Spazierstock
    b.rect(5, 17, 7, 17, farbe("#d4af37"))
    b.rect(8, 25, 9, 26, farbe("#f4f1ea"))    # weiße Handschuhe
    b.rect(22, 25, 23, 26, farbe("#f4f1ea"))
    kopf(b, haut, wangen=False, mund=False)
    b.rect(17, 10, 20, 13, farbe("#d4af37"))  # Monokel
    b.rect(18, 11, 19, 12, farbe("#bfe3f0") if not b.blinzeln else haut)
    if b.blinzeln:
        b.rect(18, 12, 19, 12, farbe("#2b2a4a"))
    b.rect(20, 14, 20, 17, farbe("#d4af37"))  # Kettchen
    b.rect(13, 14, 18, 14, farbe("#3a2a20"))  # Schnurrbart, gezwirbelt
    b.px(12, 13, farbe("#3a2a20"))
    b.px(19, 13, farbe("#3a2a20"))
    b.rect(15, 16, 16, 16, dunkler(haut, 0.55))
    b.rect(10, 7, 10, 11, farbe("#c8c8cc"))   # graue Schläfen
    b.rect(21, 7, 21, 11, farbe("#c8c8cc"))
    hut = farbe("#15151f")
    b.rect(8, 6, 23, 7, hut)
    b.rect(11, 0, 20, 5, hut)
    b.rect(11, 4, 20, 4, farbe("#7a1f2b"))    # Hutband
    b.rect(12, 0, 12, 3, heller(hut, 0.2))


FIGUREN = {
    "townsfolk_m": herr_brandt,
    "townsfolk_f": frau_keller,
    "merchant": haendler_voss,
    "mage": magister_lenz,
    "alchemist": dr_siedler,
    "king": baron_falk,
}
BILDER = [dict(dy=0), dict(dy=1), dict(dy=0), dict(dy=0, blinzeln=True)]


def zeichne(name, nr):
    b = Blatt(**BILDER[nr - 1])
    FIGUREN[name](b)
    return b.bild()


def main():
    if "--vorschau" in sys.argv:
        ziel = sys.argv[sys.argv.index("--vorschau") + 1]
        s = 8
        bogen = Image.new("RGBA", (len(FIGUREN) * N * s, 4 * N * s), (40, 38, 46, 255))
        for i, name in enumerate(FIGUREN):
            for nr in range(1, 5):
                bogen.alpha_composite(zeichne(name, nr).resize((N * s, N * s), Image.NEAREST), (i * N * s, (nr - 1) * N * s))
        bogen.save(ziel)
        return
    ZIEL.mkdir(parents=True, exist_ok=True)
    for name in FIGUREN:
        for nr in range(1, 5):
            zeichne(name, nr).save(ZIEL / f"{name}_idle_{nr}.png")
    print(f"{len(FIGUREN) * 4} Bilder nach {ZIEL}")


if __name__ == "__main__":
    main()
