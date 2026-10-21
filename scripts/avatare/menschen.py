"""Die sieben Klassen (Normal, Krieger, Magier, Priester, Rapper, Rocker, Metalhead) je männlich/weiblich."""
import bpy, math
from mathutils import Vector, Quaternion
from basis import (Blob, blob_mesh, material, kugel, kegel, stab, gesicht, wurzel, misch, stufe, auf_kopf)

KOPF, KR = Vector((0, 0, 1.15)), 0.3
HAUT_STD = 0xf6d5b8   # wird in der App durch den gewählten Hautton ersetzt

def ring(name, mitte, r, dicke, mat, drehung=(0, 0, 0), groesse=(1, 1, 1), eltern=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=dicke, major_segments=40, minor_segments=10, location=mitte, rotation=drehung)
    obj = bpy.context.active_object
    obj.name, obj.scale = name, groesse
    obj.data.materials.append(mat)
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.parent = eltern
    return obj

def koerper(root, form, oben, unten, schuhe, robe=None, faerben=None, schuh_gross=1.0, ohren=True):
    """Kleidung (Vertexfarben) und Haut (eigenes Material) des Chibi-Körpers"""
    w = form == "w"
    b = Blob()
    b.ellipse((0, 0, 0.69), 0.17, (0.95 if w else 1.05, 0.8, 1.15))                       # Oberkörper
    if robe is not None:
        b.stumpf((0, 0, 0.005), (0, 0, 0.66), 0.32, 0.15)                                    # Gewand: Kegel mit geradem Saum
    else:
        if w:
            b.ellipse((0, 0, 0.5), 0.15, (1.12, 0.85, 0.7))                                  # Hüfte
        for s in (-1, 1):
            b.kapsel((s * 0.085, 0, 0.5), (s * 0.09, -0.01, 0.13), 0.075, 0.07)               # Beine
            b.ellipse((s * 0.09, -0.04, 0.06), 0.085 * schuh_gross, (0.9, 1.35, 0.7))        # Schuhe
    for s in (-1, 1):
        b.kapsel((s * 0.16, 0, 0.79), (s * 0.29, -0.05, 0.53), 0.058, 0.066)                  # Ärmel

    def farbe(co, n):
        if faerben:
            c = faerben(co, n)
            if c is not None: return c
        if robe is not None: return robe
        if co.z < 0.12: return schuhe
        if co.z < (0.47 if w else 0.5) and abs(co.x) < 0.2: return unten
        return oben
    blob_mesh("kleidung", b, farbe, ziel_flaechen=9000, eltern=root)
    h = Blob()
    h.kugel(KOPF, KR)
    h.kapsel((0, 0, 0.95), (0, 0, 0.82), 0.065)                                             # Hals
    for s in (-1, 1):
        h.kugel((s * 0.305, -0.075, 0.48), 0.06)                                           # Hände
        if ohren:
            h.ellipse(KOPF + Vector((s * 0.29, 0.02, -0.02)), 0.055, (0.5, 0.8, 1.15))         # Ohren
    blob_mesh("haut", h, mat=material("Haut", HAUT_STD, rau=0.7), ziel_flaechen=5000, eltern=root)

def haare(root, farbe, stil, unter_hut=False, pony=4):
    """stil: kurz (Stachelspitzen), lang, zopf, dutt; unter_hut: oben flach, keine Spitzen"""
    mat = material("Haar", farbe, rau=0.6)
    h = Blob()
    h.ellipse(KOPF + Vector((0, 0.05, 0.04)), KR * 1.06, (1.0, 1.0, 0.86 if unter_hut else 1.0))
    h.kugel(KOPF + Vector((0, 0.1, -0.08)), KR * 0.95)
    xs = [(-0.15 + 0.3 * i / (pony - 1)) for i in range(pony)]
    for x in xs:
        h.ellipse(KOPF + Vector((x, -0.2, 0.17 - abs(x) * 0.3)), 0.085, (1.0, 0.6, 1.25), Quaternion((0, 1, 0), x * 1.5))
    if stil in ("lang", "zopf", "dutt"):
        for s in (-1, 1):
            h.kette([KOPF + Vector((s * 0.26, -0.06, -0.04)), KOPF + Vector((s * 0.25, -0.08, -0.3))], [0.07, 0.055])
    if stil == "lang":
        h.kette([KOPF + Vector((0, 0.2, -0.05)), KOPF + Vector((0, 0.26, -0.3)), KOPF + Vector((0, 0.25, -0.52))], [0.17, 0.14, 0.1])
    if stil == "zopf":
        h.kette([KOPF + Vector((0, 0.28, 0.06)), KOPF + Vector((0, 0.38, -0.1)), KOPF + Vector((0, 0.4, -0.34))], [0.1, 0.09, 0.065])
    if stil == "dutt":
        h.kugel(KOPF + Vector((0, 0.18, 0.26)), 0.12)
    blob_mesh("haare", h, mat=mat, glatt=8, ziel_flaechen=5000, eltern=root)
    if stil == "kurz" and not unter_hut:   # Anime-Spitzen nach oben/hinten
        for k, (gier, nick, l) in enumerate(((0.0, 1.2, 0.2), (0.7, 0.9, 0.17), (-0.7, 0.9, 0.17), (2.6, 0.6, 0.16), (-2.6, 0.6, 0.16), (3.14, 0.9, 0.18))):
            p, n = auf_kopf(KOPF + Vector((0, 0.05, 0.04)), KR * 1.02, gier, nick)
            kegel(f"spitze{k}", p, 0.08, l, n + Vector((0, 0.5, 0.3)), mat, segmente=8, stufe_=1, eltern=root)
    if stil == "zopf":
        kugel("zopfband", KOPF + Vector((0, 0.3, 0.04)), 0.05, material("Band", 0xef4444), eltern=root)

HAND = Vector((0.305, -0.075, 0.48))

def stab_in_hand(name, seite, laenge_unten, laenge_oben, mat, eltern, neigung=0.18):
    """Stab, der durch die Hand läuft und leicht nach außen kippt (nichts schneidet Hut oder Krempe); gibt die Spitze zurück"""
    hand = Vector((seite * HAND.x, HAND.y, HAND.z))
    d = Vector((seite * neigung, -0.04, 1)).normalized()
    stab(name, hand - d * laenge_unten, hand + d * laenge_oben, 0.022, mat, eltern=eltern)
    return hand + d * laenge_oben

def figur(name, form, iris, braue):
    root = wurzel(name)
    gesicht(name + "_gesicht", KOPF, KR * 1.012, iris[0], iris[1], braue, wimpern_fluegel=form == "w", eltern=root)
    return root

# ---------- Klassen ----------
def normal(form):
    w = form == "w"
    root = figur(f"mensch_normal_{form}", form, (0xe0a46a, 0x7a3f12), 0x3a2010)
    shirt = 0x10b981 if w else 0x2563eb
    def motiv(co, n):   # gelber Stern-Kreis vorn auf dem Shirt
        if co.y < -0.1 and ((co.x) ** 2 + (co.z - 0.72) ** 2) < 0.055 ** 2: return 0xfacc15
        return None
    koerper(root, form, shirt, 0x1e3a8a, 0xf8fafc, faerben=motiv)
    haare(root, 0x4a2c17, "zopf" if w else "kurz")
    return root

def krieger(form):
    w = form == "w"
    METALL, DUNKEL = 0x9ca3af, 0x6b7280
    root = figur(f"mensch_krieger_{form}", form, (0x7ee89a, 0x1f7a3a), 0x6a2a08)
    def ruestung(co, n):
        if 0.47 < co.z < 0.53 and abs(co.x) < 0.2: return 0x78350f                    # Gürtel
        if co.z > 0.74 and abs(co.x) > 0.13: return DUNKEL                            # Schulterplatten
        return None
    koerper(root, form, METALL, 0x57341c, 0x3f2a14, faerben=ruestung)
    haare(root, 0xb45309, "zopf" if w else "kurz", unter_hut=True, pony=0)   # kein Pony: der stäche vorn durch den Helm
    for s in (-1, 1):   # Schulterkugeln
        kugel(f"schulter{s}", (s * 0.19, 0, 0.81), 0.08, material("Metall", DUNKEL, rau=0.3, metall=0.6), groesse=(1, 1, 0.75))
        bpy.data.objects[f"schulter{s}"].parent = root
    # Helm mit Hörnern
    kugel("helm", KOPF + Vector((0, 0.04, 0.06)), KR * 1.15, material("Metall", METALL, rau=0.3, metall=0.6), groesse=(1, 1, 0.92), segmente=32, eltern=root)
    kugel("helmrand", KOPF + Vector((0, 0.04, 0.06)), KR * 1.18, material("Metall", DUNKEL, rau=0.3, metall=0.6), groesse=(1, 1, 0.1), segmente=32, eltern=root)
    for s in (-1, 1):
        kegel(f"horn{s}", KOPF + Vector((s * 0.27, 0.03, 0.12)), 0.06, 0.28, Vector((s * 1, 0, 0.6)), material("Horn", 0xf5f0e6, rau=0.4), segmente=10, eltern=root)
    # Schwert rechts, Schild links
    stab("klinge", (0.31, -0.12, 0.47), (0.31, -0.12, 1.12), 0.03, material("Klinge", 0xe5e7eb, rau=0.2, metall=0.8), eltern=root)
    stab("parier", (0.2, -0.12, 0.5), (0.42, -0.12, 0.5), 0.02, material("Gold", 0xfacc15, rau=0.3, metall=0.7), eltern=root)
    schild = kugel("schild", (-0.36, -0.08, 0.6), 0.2, material("Schild", 0xb91c1c, rau=0.5), groesse=(0.22, 1, 1), segmente=32, eltern=root)
    kugel("schildbuckel", (-0.41, -0.08, 0.6), 0.055, material("Gold", 0xfacc15, rau=0.3, metall=0.7), eltern=root)
    return root

def magier(form):
    w = form == "w"
    ROBE, SAUM = 0x5b3bb5, 0xf2c14e
    root = figur(f"mensch_magier_{form}", form, (0xc6a2ff, 0x5a2bd6), 0x8f7ad8 if w else 0xb0b0c0)
    def saum(co, n):
        if co.z < 0.35: return misch(ROBE, SAUM, stufe(co.z, 0.12, 0.16) * (1 - stufe(co.z, 0.2, 0.24)))
        return None
    koerper(root, form, ROBE, ROBE, ROBE, robe=ROBE, faerben=saum, ohren=not w)
    haare(root, 0xc9b6ff if w else 0xe5e7eb, "lang" if w else "kurz", unter_hut=True)
    if not w:   # Rauschebart unter dem Mund
        b = Blob()
        b.ellipse(KOPF + Vector((0, -0.17, -0.3)), 0.13, (1.0, 0.7, 1.25))
        b.ellipse(KOPF + Vector((0, -0.12, -0.2)), 0.12, (1.25, 0.7, 0.6))
        blob_mesh("bart", b, mat=material("Haar", 0xe5e7eb, rau=0.6), glatt=8, ziel_flaechen=3000, eltern=root)
    hut = material("Hut", ROBE, rau=0.6)
    kugel("krempe", KOPF + Vector((0, 0.04, 0.16)), 0.5, hut, groesse=(1, 1, 0.1), segmente=40, eltern=root)
    kegel("hut", KOPF + Vector((0, 0.04, 0.16)), 0.34, 0.72, Vector((0, 0, 1)), hut, biegung=(0, 0.32), segmente=16, eltern=root)
    kugel("hutband", KOPF + Vector((0, 0.04, 0.2)), 0.335, material("Saum", SAUM, rau=0.35, metall=0.3), groesse=(1, 1, 0.16), segmente=32, eltern=root)
    spitze = stab_in_hand("stab", 1, 0.45, 0.58, material("Holz", 0x6b3e1f), root)
    kugel("stabkugel", spitze + Vector((0.01, 0, 0.06)), 0.085, material("Kristall", 0x6fe0ff, rau=0.1, leucht=3.0), eltern=root)
    return root

def priester(form):
    w = form == "w"
    ROBE, GOLD = 0xf8fafc, 0xd4a017
    root = figur(f"mensch_priester_{form}", form, (0x9ad0ff, 0x2a5aa8), 0x4a2a14)
    def zier(co, n):
        if co.y < -0.08 and abs(co.x) < 0.035 and co.z < 0.85: return GOLD            # Goldstreifen vorn
        if 0.48 < co.z < 0.53 and abs(co.x) < 0.2: return GOLD                         # Kordel
        return None
    koerper(root, form, ROBE, ROBE, ROBE, robe=ROBE, faerben=zier)
    haare(root, 0x6b4423, "lang" if w else "kurz")
    ring("schein", KOPF + Vector((0, 0.05, 0.42)), 0.17, 0.02, material("Gold", GOLD, rau=0.3, metall=0.6, leucht=1.5), eltern=root)
    spitze = stab_in_hand("stab", -1, 0.45, 0.62, material("Gold", GOLD, rau=0.3, metall=0.6), root)
    kugel("sonne", spitze + Vector((-0.015, 0, 0.09)), 0.11, material("Sonne", 0xfde047, leucht=2.0), groesse=(1, 0.25, 1), eltern=root)
    return root

def rapper(form):
    w = form == "w"
    root = figur(f"mensch_rapper_{form}", form, (0xf0b36a, 0x8a4a12), 0x111111)
    koerper(root, form, 0xdc2626, 0x1f2937, 0xf8fafc, schuh_gross=1.25)
    kapuze = Blob(); kapuze.ellipse((0, 0.16, 0.86), 0.14, (1.3, 0.7, 0.7))
    blob_mesh("kapuze", kapuze, mat=material("Stoff", 0xb91c1c, rau=0.7), glatt=6, ziel_flaechen=2000, eltern=root)
    haare(root, 0x111827, "lang" if w else "kurz", unter_hut=True, pony=3)
    kugel("kappe", KOPF + Vector((0, 0.05, 0.08)), KR * 1.1, material("Kappe", 0xf8fafc, rau=0.6), groesse=(1, 1, 0.75), segmente=32, eltern=root)
    kugel("schild", KOPF + Vector((0, 0.33, 0.12)), 0.17, material("Schirm", 0x111827, rau=0.6), groesse=(0.9, 1, 0.12), eltern=root)          # Schirm nach hinten
    for s in (-1, 1):   # Sonnenbrille hochgeschoben
        kugel(f"brille{s}", KOPF + Vector((s * 0.1, -0.27, 0.2)), 0.065, material("Brille", 0x0f172a, rau=0.1, metall=0.5), groesse=(1.2, 0.4, 0.8), eltern=root)
    ring("kette", (0, -0.07, 0.87), 0.15, 0.02, material("Gold", 0xfacc15, rau=0.25, metall=0.8, leucht=0.4), drehung=(1.3, 0, 0), eltern=root)
    kugel("anhaenger", (0, -0.22, 0.75), 0.045, material("Gold", 0xfacc15, rau=0.25, metall=0.8, leucht=0.4), eltern=root)
    stab("mikro", (0.3, -0.12, 0.42), (0.3, -0.12, 0.6), 0.022, material("Mikro", 0x374151, rau=0.4, metall=0.5), eltern=root)
    kugel("mikrokopf", (0.3, -0.12, 0.64), 0.045, material("Mikro", 0x6b7280, rau=0.4, metall=0.5), eltern=root)
    return root

def rocker(form):
    w = form == "w"
    root = figur(f"mensch_rocker_{form}", form, (0xa8b8c8, 0x3a4a5a), 0x2a1010)
    koerper(root, form, 0x111827, 0x1e3a8a, 0x111827)
    haare(root, 0x7f1d1d if w else 0x292524, "lang")
    ring("bandana", KOPF + Vector((0, 0.02, 0.1)), KR * 1.02, 0.03, material("Bandana", 0xdc2626, rau=0.7), groesse=(1, 1, 1), eltern=root)
    for x in (-0.1, 0.0, 0.1):   # Nieten
        kugel(f"niete{x}", (x, -0.15, 0.84), 0.018, material("Niete", 0xd1d5db, rau=0.2, metall=0.9), eltern=root)
    g = wurzel("gitarre")   # auf dem Rücken
    g.parent = root
    g.location, g.rotation_euler = (0, 0.22, 0.6), (0, 0.6, 0)
    rot = material("Gitarre", 0xdc2626, rau=0.35)
    kugel("korpus", (0, 0, 0), 0.16, rot, groesse=(1, 0.3, 1.15), eltern=g)
    kugel("korpus2", (0, 0, 0.19), 0.12, rot, groesse=(1, 0.3, 1), eltern=g)
    stab("hals", (0, 0, 0.25), (0, 0, 0.72), 0.025, material("Holz", 0x78350f), eltern=g)
    kugel("kopfplatte", (0, 0, 0.76), 0.05, material("Kopf", 0x111827), groesse=(1, 0.4, 1.4), eltern=g)
    return root

def metalhead(form):
    w = form == "w"
    SHIRT, JEANS, KUTTE = 0x111111, 0x1c1c22, 0x34507a
    root = figur(f"mensch_metalhead_{form}", form, (0x9fb8a0, 0x3a4a3a), 0x0a0a0a)
    def kleidung(co, n):
        # weißer Totenkopf vorn auf dem Bandshirt (zwischen den Westenhälften)
        if co.y < -0.1 and abs(co.x) < 0.07:
            kopf = (co.x / 0.05) ** 2 + ((co.z - 0.74) / 0.045) ** 2
            augen = min(((co.x - s) / 0.016) ** 2 + ((co.z - 0.745) / 0.016) ** 2 for s in (-0.02, 0.02))
            if kopf < 1 and augen > 1: return 0xf1f1f1
            if 0.66 < co.z < 0.7 and abs(co.x) < 0.03 and (int(co.x * 120) % 2 == 0): return 0xf1f1f1   # Zähne
            if co.z > 0.52: return SHIRT
        # Kutte (Jeansweste) mit bunten Aufnähern
        if 0.52 < co.z < 0.86 and abs(co.x) < 0.2:
            if co.y > 0.08 and abs(co.x) < 0.11 and 0.6 < co.z < 0.78: return 0xb91c1c          # großer Rückenaufnäher
            if co.y < -0.05 and -0.14 < co.x < -0.09 and 0.7 < co.z < 0.75: return 0xfacc15   # kleiner Aufnäher vorn links
            if co.y < -0.05 and 0.09 < co.x < 0.13 and 0.62 < co.z < 0.66: return 0xdc2626     # und rechts
            return KUTTE
        if 0.47 < co.z < 0.53 and abs(co.x) < 0.2:
            return 0x27272a                                                                       # Gürtel
        if 0.26 < co.z < 0.29 and co.y < -0.06 and 0.05 < abs(co.x) < 0.13:
            return 0x4b5563                                                                       # Risse an den Knien
        return None
    koerper(root, form, SHIRT, JEANS, 0x0b0b0b, faerben=kleidung, schuh_gross=1.3)
    haare(root, 0x0f0f12, "lang", pony=3)
    mat = material("Haar", 0x0f0f12, rau=0.6)
    for x in (-1, 1):   # Mähne vorn über die Schultern bis zur Brust
        b = Blob().kette([KOPF + Vector((x * 0.27, -0.04, -0.05)), KOPF + Vector((x * 0.25, -0.1, -0.32)), KOPF + Vector((x * 0.22, -0.13, -0.55))], [0.08, 0.075, 0.06])
        blob_mesh(f"mähne{x}", b, mat=mat, glatt=6, ziel_flaechen=1500, eltern=root)
    if not w:   # Kinnbart
        b = Blob(); b.ellipse(KOPF + Vector((0, -0.25, -0.29)), 0.035, (0.9, 0.6, 1.4))
        blob_mesh("kinnbart", b, mat=mat, glatt=4, ziel_flaechen=800, eltern=root)
    nieten = material("Niete", 0xd1d5db, rau=0.2, metall=0.9)
    for sx in (-1, 1):   # Nietenarmbänder
        ring(f"armband{sx}", (sx * 0.292, -0.065, 0.53), 0.062, 0.022, material("Leder", 0x111111, rau=0.5), drehung=(0, sx * 0.45, 0), eltern=root)
        for k in range(5):
            a = k / 5 * 6.283
            kegel(f"niete{sx}_{k}", (sx * 0.292 + 0.07 * math.cos(a) * 0.9, -0.065 + 0.07 * math.sin(a), 0.53), 0.012, 0.03,
                  Vector((math.cos(a), math.sin(a), 0)), nieten, stufe_=0, segmente=6, eltern=root)
    kugel("schnalle", (0, -0.16, 0.5), 0.035, material("Schnalle", 0xe5e7eb, rau=0.2, metall=0.9), groesse=(1.2, 0.4, 1), eltern=root)
    return root

KLASSEN = {"normal": normal, "krieger": krieger, "magier": magier, "priester": priester, "rapper": rapper, "rocker": rocker, "metalhead": metalhead}
MENSCHEN = {f"mensch_{k}_{f}": (lambda k=k, f=f: KLASSEN[k](f)) for k in KLASSEN for f in ("m", "w")}
