"""
Skelette und Bewegungen der 30 Tiere. Jedes Tier bekommt ein Skelett aus Bausteinen (Rumpf, Kopf, Arme, Beine,
Flügel, Flossen, Schwanz, Tentakel …); die Clips fragen nur ab, welche Knochen es gibt.
Drehungen in Grad um Welt-Achsen (z oben, -y vorn); _l liegt bei +x.
"""
import math
from mathutils import Vector, Quaternion
from rig import skelett, binden, clip

def V(*a):
    return Vector(a)

# ---------- Bausteine ----------
def rumpf(unten, oben, kopf_oben):
    return [("koerper", unten, oben, None), ("kopf", oben, kopf_oben, "koerper")]

def paar(name, a, b, eltern="koerper"):
    """Knochenpaar links (+x) / rechts (-x) aus der linken Lage"""
    a, b = Vector(a), Vector(b)
    return [(f"{name}_l", a, b, eltern), (f"{name}_r", V(-a.x, a.y, a.z), V(-b.x, b.y, b.z), eltern)]

def kette(name, punkte, eltern="koerper"):
    return [(f"{name}{i}", punkte[i - 1], punkte[i], eltern if i == 1 else f"{name}{i - 1}") for i in range(1, len(punkte))]

CHIBI_RUMPF = rumpf((0, 0.05, 0.16), (0, 0.02, 0.62), (0, -0.02, 1.36))
CHIBI_ARME = paar("arm", (0.22, -0.05, 0.58), (0.31, -0.13, 0.36))
CHIBI_BEINE = paar("bein", (0.13, -0.04, 0.28), (0.14, -0.09, 0.03))
CHIBI = CHIBI_RUMPF + CHIBI_ARME + CHIBI_BEINE

def schwimmer(ky, kz, r, z):
    k = ky + r * 0.2
    return ([("koerper", (0, k, z - 0.2), (0, k, z), None),
             ("kopf", (0, k, z), (0, ky - r * 1.05, kz), "koerper")]
            + kette("schwanz", [V(0, k, z), V(0, ky + r * 1.2, z + 0.01), V(0, ky + r * 1.9, z + 0.04), V(0, ky + r * 2.6, z + 0.08)])
            + paar("flosse", (r * 0.55, ky + r * 0.4, z - 0.1), (r * 1.2, ky + r * 0.45, z - 0.2)))

def vierbeiner(vorn, hinten, y_vorn, y_hinten, hoehe):
    """vorn/hinten: x-Abstand der Beine; hoehe: Hüfthöhe"""
    return (paar("bein_v", (vorn, y_vorn, hoehe), (vorn, y_vorn - 0.03, 0.03))
            + paar("bein_h", (hinten, y_hinten, hoehe), (hinten, y_hinten - 0.02, 0.03)))

def octopus_skelett():
    k = [("koerper", (0, 0, 0.3), (0, 0, 0.5), None), ("kopf", (0, 0, 0.5), (0, 0, 1.25), "koerper")]
    K = V(0, 0, 0.82)
    for i in range(8):
        w = i / 8 * math.pi * 2 + math.pi / 8
        d = V(math.cos(w), math.sin(w), 0)
        k += kette(f"tentakel{i}_", [K + d * 0.12 + V(0, 0, -0.3), K + d * 0.36 + V(0, 0, -0.58), K + d * 0.5 + V(0, 0, -0.72), K + d * 0.64 + V(0, 0, -0.55)])
    return k

def krabbe_skelett():
    k = [("koerper", (0, 0.05, 0.15), (0, 0, 0.5), None), ("kopf", (0, 0, 0.5), (0, -0.12, 0.8), "koerper")]
    k += paar("arm", (0.36, -0.06, 0.44), (0.6, -0.22, 0.66))
    for j in range(3):
        k += paar(f"bein{j}", (0.38, 0.1 - j * 0.12, 0.35), (0.62, 0.12 - j * 0.14, 0.05))
    return k

FLUEGEL_TEILE = ("fluegel",)   # eigene Flügel-Meshes hängen am Flügelknochen ihrer Seite

SKELETTE = {
    "cat": CHIBI + kette("schwanz", [V(0, 0.28, 0.3), V(0, 0.46, 0.42), V(0, 0.52, 0.62), V(0, 0.46, 0.84)]),
    "dog": CHIBI + kette("schwanz", [V(0, 0.28, 0.33), V(0, 0.4, 0.56)]),
    "fox": rumpf((0, 0.08, 0.18), (0, 0.0, 0.62), (0, -0.02, 1.3)) + vierbeiner(0.13, 0.16, -0.1, 0.17, 0.33)
           + kette("schwanz", [V(0, 0.3, 0.34), V(0, 0.5, 0.5), V(0, 0.64, 0.76), V(0, 0.67, 1.0), V(0, 0.63, 1.2)]),
    "panda": CHIBI, "koala": CHIBI, "cow": CHIBI, "hedgehog": CHIBI, "turtle": CHIBI,
    "pig": CHIBI,
    "tiger": CHIBI + kette("schwanz", [V(0, 0.28, 0.3), V(0, 0.48, 0.38), V(0, 0.56, 0.55), V(0, 0.52, 0.74)]),
    "lion": CHIBI + kette("schwanz", [V(0, 0.28, 0.3), V(0, 0.48, 0.36), V(0, 0.62, 0.5)]),
    "otter": CHIBI + kette("schwanz", [V(0, 0.22, 0.2), V(0, 0.4, 0.13), V(0, 0.6, 0.06)]),
    "sloth": CHIBI_RUMPF + CHIBI_BEINE + paar("arm", (0.22, -0.05, 0.6), (0.36, -0.17, 0.28)),
    "unicorn": CHIBI + kette("schwanz", [V(0, 0.3, 0.48), V(0, 0.48, 0.38), V(0, 0.6, 0.24)]),
    "dino": CHIBI + kette("schwanz", [V(0, 0.28, 0.33), V(0, 0.5, 0.24), V(0, 0.68, 0.16), V(0, 0.86, 0.11)]),
    "bee": CHIBI + paar("fluegel", (0.1, 0.28, 0.78), (0.48, 0.32, 0.62)),
    "owl": CHIBI_RUMPF + CHIBI_BEINE + paar("fluegel", (0.24, 0.06, 0.72), (0.46, 0.08, 0.3)),
    "parrot": CHIBI_RUMPF + CHIBI_BEINE + paar("fluegel", (0.22, 0.06, 0.7), (0.38, 0.08, 0.34)),
    "peacock": CHIBI_RUMPF + CHIBI_BEINE,
    "duck": CHIBI_RUMPF + paar("fluegel", (0.22, 0.05, 0.64), (0.38, 0.07, 0.36)) + paar("bein", (0.13, -0.06, 0.18), (0.13, -0.14, 0.02)),
    "penguin": rumpf((0, 0.02, 0.1), (0, 0.02, 0.72), (0, 0, 1.36)) + paar("fluegel", (0.3, 0.02, 0.76), (0.5, 0.02, 0.32))
               + paar("bein", (0.14, -0.05, 0.16), (0.14, -0.18, 0.02)),
    "flamingo": [("koerper", (0, 0.1, 0.62), (0, 0.0, 0.92), None)] + kette("hals", [V(0, 0.0, 0.92), V(0, -0.08, 1.06), V(0, -0.06, 1.2)])
                + [("kopf", (0, -0.06, 1.2), (0, -0.12, 1.62), "hals2")]
                + paar("fluegel", (0.12, 0.06, 0.86), (0.32, 0.14, 0.74)) + paar("bein", (0.08, 0.05, 0.62), (0.08, -0.02, 0.02)),
    "whale": schwimmer(-0.2, 0.55, 0.42, 0.55),
    "shark": schwimmer(-0.18, 0.55, 0.38, 0.55),
    "dolphin": schwimmer(-0.15, 0.56, 0.36, 0.56),
    "octopus": octopus_skelett(),
    "crab": krabbe_skelett(),
    "frog": rumpf((0, 0.05, 0.14), (0, 0.02, 0.58), (0, -0.02, 1.15)) + paar("arm", (0.2, -0.07, 0.47), (0.3, -0.16, 0.25))
            + paar("bein", (0.2, 0.05, 0.24), (0.42, -0.12, 0.04)),
    "axolotl": rumpf((0, 0.08, 0.16), (0, 0.02, 0.62), (0, -0.02, 1.25)) + vierbeiner(0.2, 0.18, -0.1, 0.18, 0.32)
               + kette("schwanz", [V(0, 0.22, 0.4), V(0, 0.44, 0.33), V(0, 0.7, 0.26)]),
    "butterfly": rumpf((0, 0.12, 0.18), (0, 0.05, 0.68), (0, 0, 1.3)) + paar("fluegel", (0.04, 0.18, 0.72), (0.62, 0.2, 0.72)),
}

FLIEGT = ("bee", "butterfly")
SCHWIMMT = ("whale", "shark", "dolphin")

# ---------- Clips ----------
def achse(a, grad):
    """Drehung um eine beliebige Achse als Euler-Grad (für rig.clip)"""
    e = Quaternion(Vector(a).normalized(), math.radians(grad)).to_euler("XYZ")
    return tuple(math.degrees(x) for x in e)

def welle(knochen, laenge, a, achse_=(0, 0, 1), schritte=4, versatz=0.6, phase=0.0):
    """Pendeln einer Kette (Schwanz, Tentakel): jeder Knochen etwas später"""
    sp = {}
    for i, k in enumerate(knochen):
        sp[k] = [(laenge * j / schritte, {"r": achse(achse_, a * math.sin(2 * math.pi * j / schritte - i * versatz + phase))}) for j in range(schritte)]
    return sp

def heben(seite, grad):
    """seitliches Heben eines Arms/Flügels: links um -y, rechts um +y"""
    return (0, -grad if seite == "l" else grad, 0)

def tier_clips(arm, tier):
    hat = set(b.name for b in arm.data.bones)
    schwanz = sorted(k for k in hat if k.startswith("schwanz"))
    hals = sorted(k for k in hat if k.startswith("hals"))
    tentakel = [sorted(k for k in hat if k.startswith(f"tentakel{i}_")) for i in range(8)]
    tentakel = [t for t in tentakel if t]
    seiten = ("l", "r")
    def da(sp):   # nur Spuren für vorhandene Knochen
        return {k: v for k, v in sp.items() if k in hat}
    def fluegel_schlag(laenge, a, mitte=0, schritte=2):
        return {f"fluegel_{s}": [(laenge * j / schritte, {"r": heben(s, mitte + (a if j % 2 else -a))}) for j in range(schritte)] for s in seiten}
    def tentakel_welle(laenge, a, schritte=4):
        sp = {}
        for i, t in enumerate(tentakel):
            w = i / 8 * math.pi * 2 + math.pi / 8
            quer = (-math.sin(w), math.cos(w), 0)   # Achse quer zum Tentakel: hebt und senkt ihn
            sp.update(welle(t, laenge, a, quer, schritte, phase=i * 0.8))
        return sp

    # idle: atmen, Kopf neigen, Schwanz pendeln, Flügel/Flossen leicht bewegen
    l = 2.0
    idle = {"koerper": [(0, {"s": (1, 1, 1)}), (1.0, {"s": (1.02, 1.04, 1.02)})],
            "kopf": [(0, {"r": (0, 0, 0)}), (1.0, {"r": (4, 6, 0)})],
            **{f"arm_{s}": [(0, {"r": (0, 0, 0)}), (1.0, {"r": heben(s, 6)})] for s in seiten},
            **welle(schwanz, l, 12 if tier not in SCHWIMMT else 8),
            **welle(hals, l, 3, (1, 0, 0)),
            **tentakel_welle(l, 10)}
    if tier in FLIEGT:
        idle.update(fluegel_schlag(0.25, 30, mitte=10))
        idle["koerper"] = [(0, {"l": (0, 0, 0)}), (1.0, {"l": (0, 0, 0.05)})]
    else:
        idle.update(fluegel_schlag(l, 5, schritte=2))
    idle.update({f"flosse_{s}": [(0, {"r": heben(s, -8)}), (1.0, {"r": heben(s, 8)})] for s in seiten})
    clip(arm, "idle", l, da(idle))

    # lauf: Beine im Wechsel, Arme gegengleich, wippen; Flieger schlagen, Schwimmer schlängeln
    l, sw = 0.6, 26
    lauf = {"koerper": [(0, {"l": (0, 0, 0), "r": (0, -4, 0)}), (0.15, {"l": (0, 0, 0.035), "r": (0, 0, 0)}),
                        (0.3, {"l": (0, 0, 0), "r": (0, 4, 0)}), (0.45, {"l": (0, 0, 0.035), "r": (0, 0, 0)})],
            "kopf": [(0, {"r": (-3, 0, 0)}), (0.15, {"r": (3, 0, 0)}), (0.3, {"r": (-3, 0, 0)}), (0.45, {"r": (3, 0, 0)})]}
    vor = [(0, {"r": (sw, 0, 0)}), (0.3, {"r": (-sw, 0, 0)})]
    zurueck = [(0, {"r": (-sw, 0, 0)}), (0.3, {"r": (sw, 0, 0)})]
    for k in ("bein_l", "bein_v_l", "bein_h_r"):
        lauf[k] = vor
    for k in ("bein_r", "bein_v_r", "bein_h_l"):
        lauf[k] = zurueck
    lauf["arm_l"] = [(0, {"r": (-20, 0, 0)}), (0.3, {"r": (20, 0, 0)})]
    lauf["arm_r"] = [(0, {"r": (20, 0, 0)}), (0.3, {"r": (-20, 0, 0)})]
    for j in range(3):   # Krabbe: Beinpaare abwechselnd
        a = sw if j % 2 else -sw
        lauf[f"bein{j}_l"] = [(0, {"r": (0, 0, a)}), (0.3, {"r": (0, 0, -a)})]
        lauf[f"bein{j}_r"] = [(0, {"r": (0, 0, -a)}), (0.3, {"r": (0, 0, a)})]
    lauf.update(welle(schwanz, l, 25 if tier in SCHWIMMT else 16))
    lauf.update(tentakel_welle(l, 22))
    lauf.update(fluegel_schlag(0.2 if tier in FLIEGT else l / 2, 35 if tier in FLIEGT else 12, mitte=10 if tier in FLIEGT else 0))
    lauf.update({f"flosse_{s}": [(0, {"r": heben(s, -15)}), (0.3, {"r": heben(s, 15)})] for s in seiten})
    if tier in FLIEGT or tier in SCHWIMMT or tentakel:
        lauf["koerper"] = [(0, {"l": (0, 0, 0)}), (0.3, {"l": (0, 0, 0.06)})]
    clip(arm, "lauf", l, da(lauf))

    ruhe = {"r": (0, 0, 0), "l": (0, 0, 0)}
    null = {"r": (0, 0, 0)}
    # angriff: ausholen, nach vorn stoßen, Arme/Flügel/Scheren schlagen zu
    angriff = {"koerper": [(0, ruhe), (0.22, {"r": (-12, 0, 0), "l": (0, 0.06, 0)}), (0.36, {"r": (20, 0, 0), "l": (0, -0.18, 0.03)}),
                           (0.5, {"r": (16, 0, 0), "l": (0, -0.16, 0)}), (0.8, ruhe)],
               "kopf": [(0, null), (0.22, {"r": (-10, 0, 0)}), (0.36, {"r": (12, 0, 0)}), (0.8, null)],
               **{f"arm_{s}": [(0, null), (0.22, {"r": (40, heben(s, 30)[1], 0)}), (0.36, {"r": (-75, 0, 0)}), (0.8, null)] for s in seiten},
               **{f"fluegel_{s}": [(0, null), (0.22, {"r": heben(s, 70)}), (0.36, {"r": heben(s, -20)}), (0.8, null)] for s in seiten},
               **{f"bein_v_{s}": [(0, null), (0.36, {"r": (-35, 0, 0)}), (0.8, null)] for s in seiten},
               **{k[0]: [(0, null), (0.36, {"r": (-30, 0, 0)}), (0.8, null)] for k in tentakel}}
    if schwanz:
        angriff[schwanz[0]] = [(0, null), (0.36, {"r": (0, 0, 35)}), (0.8, null)]
    clip(arm, "angriff", 0.8, da(angriff), schleife=False)

    # treffer: zurückgeworfen
    treffer = {"koerper": [(0, ruhe), (0.08, {"r": (-18, 0, 6), "l": (0, 0.1, 0)}), (0.5, ruhe)],
               "kopf": [(0, null), (0.1, {"r": (-14, -8, 0)}), (0.5, null)],
               **{f"arm_{s}": [(0, null), (0.1, {"r": heben(s, 35)}), (0.5, null)] for s in seiten},
               **{f"fluegel_{s}": [(0, null), (0.1, {"r": heben(s, 45)}), (0.5, null)] for s in seiten}}
    if schwanz:
        treffer[schwanz[0]] = [(0, null), (0.1, {"r": (25, 0, 0)}), (0.5, null)]
    clip(arm, "treffer", 0.5, da(treffer), schleife=False)

    # jubel: Hüpfer mit Stauchen, Arme/Flügel hoch
    jubel = {"koerper": [(0, ruhe), (0.15, {"l": (0, 0, -0.04), "s": (1.06, 0.9, 1.06)}), (0.4, {"l": (0, 0, 0.26), "s": (0.96, 1.08, 0.96)}),
                         (0.65, {"l": (0, 0, 0), "s": (1.06, 0.92, 1.06)}), (1.0, {"l": (0, 0, 0), "s": (1, 1, 1)})],
             "kopf": [(0, null), (0.4, {"r": (-14, 0, 0)}), (1.0, null)],
             **{f"arm_{s}": [(0, null), (0.35, {"r": heben(s, 130)}), (0.55, {"r": heben(s, 110)}), (0.75, {"r": heben(s, 130)}), (1.0, null)] for s in seiten},
             **{f"bein_{s}": [(0, null), (0.4, {"r": (-25, 0, 0)}), (0.7, null)] for s in seiten},
             **{f"bein_v_{s}": [(0, null), (0.4, {"r": (-40, 0, 0)}), (0.7, null)] for s in seiten},
             **{f"bein_h_{s}": [(0, null), (0.4, {"r": (35, 0, 0)}), (0.7, null)] for s in seiten},
             **welle(schwanz, 1.0, 25),
             **tentakel_welle(1.0, 30)}
    jubel.update({f"fluegel_{s}": [(t, {"r": heben(s, 60 if j % 2 else 0)}) for j, t in enumerate((0, 0.15, 0.3, 0.45, 0.6, 0.75))] + [(1.0, null)] for s in seiten})
    clip(arm, "jubel", 1.0, da(jubel), schleife=False)

    # tod: kippt zur Seite und bleibt liegen (Schwimmer drehen sich auf den Rücken)
    um = (0, 160, 0) if tier in SCHWIMMT or tentakel else (0, -86, 0)
    tod = {"koerper": [(0, ruhe), (0.25, {"r": (-10, -10, 0), "l": (0, 0, 0.05)}), (0.8, {"r": um, "l": (0.05, 0, -0.04)}),
                       (1.0, {"r": (um[0], um[1] * 0.95, 0), "l": (0.05, 0, -0.02)}), (1.2, {"r": um, "l": (0.05, 0, -0.04)})],
           "kopf": [(0, null), (0.8, {"r": (8, -10, 0)}), (1.2, {"r": (10, -14, 0)})],
           **{f"arm_{s}": [(0, null), (1.2, {"r": heben(s, 50)})] for s in seiten},
           **{f"fluegel_{s}": [(0, null), (1.2, {"r": heben(s, 40)})] for s in seiten}}
    if tier in FLIEGT:   # fällt herunter
        tod["koerper"] = [(0, ruhe), (0.6, {"r": (0, -60, 0), "l": (0, 0, -0.1)}), (1.2, {"r": (0, -86, 0), "l": (0.05, 0, -0.12)})]
    if schwanz:
        tod[schwanz[0]] = [(0, null), (1.2, {"r": (30, 0, 0)})]
    clip(arm, "tod", 1.2, da(tod), schleife=False)

def rigge_tier(tier):
    def rigge(root):
        arm = skelett(root, SKELETTE[tier])
        hat = set(b.name for b in arm.data.bones)
        starr = {}
        for o in root.children_recursive:
            if o.type == "MESH" and o.name.startswith(FLUEGEL_TEILE) and "fluegel_l" in hat:
                mitte = sum((v.co for v in o.data.vertices), Vector()) / max(1, len(o.data.vertices))
                starr[o.name] = "fluegel_l" if (o.matrix_world @ mitte).x > 0 else "fluegel_r"
        binden(root, arm, starr, vorzug=("kopf", 0.15))
        tier_clips(arm, tier)
    return rigge

TIER_RIGS = {f"tier_{t}": rigge_tier(t) for t in SKELETTE}
