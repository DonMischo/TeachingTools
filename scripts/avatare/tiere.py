"""Die 30 Avatar-Tiere (ids wie in components/AvatarPicker.tsx und gebaeude/avatar.ts)."""
import math
from mathutils import Vector, Quaternion
from basis import (Blob, blob_mesh, material, kugel, kegel, stab, ohr, auf_kopf, auge, augen, wangen, laecheln, nase,
                   schnurrhaare, stacheln, wurzel, misch, stufe, flecken, auf_ellipse, mund_ellipse, richtung_q)

KOPF, KR = Vector((0, -0.02, 0.95)), 0.36
WEISS, SCHWARZ = 0xf8fafc, 0x1f2937

def chibi(b, kopf=KOPF, kr=KR, rumpf=0.3, arme=True, beine=True, kopf_form=(1, 1, 1)):
    """Großer Kopf, Eierbauch, Stummelarme und -beine"""
    b.ellipse(kopf, kr, kopf_form)
    b.ellipse((0, 0.05, 0.45), rumpf, (0.9, 1.0, 1.0))
    for s in (-1, 1):
        if arme:
            b.kapsel((s * 0.24, -0.06, 0.56), (s * 0.31, -0.13, 0.38), 0.065)
        if beine:
            b.kapsel((s * 0.13, -0.04, 0.26), (s * 0.14, -0.07, 0.07), 0.085)
            b.ellipse((s * 0.14, -0.1, 0.05), 0.08, (1, 1.3, 0.6))
    return b

def bauch(co, kopf=KOPF, tief=0.16, oben=0.82):
    """weicher heller Bauchfleck vorn (0..1)"""
    return stufe(-co.y, tief, tief + 0.08) * stufe(co.z, 0.14, 0.2) * (1 - stufe(co.z, oben - 0.06, oben))

def schnauzenfleck(co, kopf=KOPF, ab=0.3):
    return stufe(-(co.y - kopf.y), ab, ab + 0.06) * (1 - stufe(co.z, kopf.z + 0.02, kopf.z + 0.08))

def gesicht_tier(root, kopf=KOPF, kr=KR, gier=0.36, nick=0.08, gr=0.085, iris=None, mund=True, wange=True, nase_farbe=None, mund_nick=-0.3):
    augen(kopf, kr, gier, nick, gr, root, iris=iris)
    if wange:
        wangen(kopf, kr, 0.72, -0.22, root)
    if nase_farbe is not None:
        p, _ = auf_kopf(kopf, kr, 0, -0.12, tief=1.0)
        nase(p, root, farbe=nase_farbe)
    if mund:
        laecheln("mund", kopf, kr * 1.005, 0.32, mund_nick, root, tiefe=0.06)

def root_fuer(name):
    return wurzel("tier_" + name)

# ---------- Säugetiere ----------
def cat():
    root = root_fuer("cat")
    FELL, HELL, STREIF = 0xf59e0b, 0xfde68a, 0xc2410c
    b = chibi(Blob())
    b.kette([(0, 0.3, 0.3), (0, 0.46, 0.42), (0, 0.52, 0.62), (0, 0.46, 0.82)], [0.06, 0.055, 0.05, 0.045])
    def farbe(co, n):
        c = misch(FELL, HELL, max(bauch(co), schnauzenfleck(co, ab=0.28)))
        streifen = stufe(math.sin(co.z * 26 + abs(co.x) * 5), 0.6, 0.9) * stufe(co.y, -0.05, 0.1)
        return misch(c, STREIF, streifen * 0.85)
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):
        p, n = auf_kopf(KOPF, KR, s * 0.55, 0.85, tief=0.85)
        ohr(f"ohr{s}", p, 0.11, 0.26, n + Vector((s * 0.1, 0, 0.25)), material("Fell", FELL), material("Innen", 0xfda4af), root)
    gesicht_tier(root, iris=0x84cc16, nase_farbe=0xf472b6)
    schnurrhaare(KOPF, KR, -0.15, root)
    return root

def dog():
    root = root_fuer("dog")
    FELL, HELL, BRAUN = 0xd6a36a, 0xfff1d6, 0x8b5a2b
    b = chibi(Blob())
    b.ellipse(KOPF + Vector((0, -0.3, -0.08)), 0.13, (1.1, 1.0, 0.8))     # Schnauze
    b.kapsel((0, 0.3, 0.35), (0, 0.4, 0.55), 0.05)                        # Stummelschwanz
    flecken_auge, _ = auf_kopf(KOPF, KR, 0.36, 0.08)
    def farbe(co, n):
        c = misch(FELL, HELL, max(bauch(co), schnauzenfleck(co, ab=0.3)))
        return misch(c, BRAUN, 1 - stufe((co - flecken_auge).length, 0.1, 0.14))
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):   # Schlappohren
        kugel(f"ohr{s}", KOPF + Vector((s * 0.33, 0.02, -0.02)), 0.15, material("Ohr", BRAUN), groesse=(0.45, 0.55, 1.1),
              drehung=Quaternion((0, 1, 0), s * 0.35), eltern=root)
    gesicht_tier(root, wange=True, mund=False)
    p, _ = auf_kopf(KOPF + Vector((0, -0.3, -0.08)), 0.13, 0, 0.3, tief=1.05)
    nase(p, root, farbe=0x1f1410, r=0.045)
    kugel("zunge", KOPF + Vector((0, -0.4, -0.2)), 0.05, material("Zunge", 0xf472b6), groesse=(1, 0.6, 1.2), eltern=root)
    return root

def fox():
    root = root_fuer("fox")
    ORANGE, CREME, DUNKEL = 0xf08a3c, 0xfff1d6, 0x4a2a1c
    b = chibi(Blob(), kr=0.37, beine=False, arme=False)
    for s in (-1, 1):
        b.ellipse((s * 0.3, 0.03, 0.83), 0.09, (1.1, 0.8, 0.75))
        b.kapsel((s * 0.13, -0.1, 0.32), (s * 0.13, -0.13, 0.08), 0.085)
        b.kapsel((s * 0.16, 0.17, 0.3), (s * 0.16, 0.15, 0.08), 0.095)
    b.ellipse((0, -0.32, 0.88), 0.13, (1.0, 1.25, 0.8))
    b.ellipse((0, -0.18, 0.58), 0.17, (1.1, 0.7, 1.0))
    b.kette([(0, 0.36, 0.38), (0, 0.55, 0.55), (0, 0.66, 0.8), (0, 0.66, 1.02)], [0.13, 0.19, 0.21, 0.17])
    def farbe(co, n):
        brust = stufe(-co.y, 0.16, 0.24) * stufe(co.z, 0.42, 0.5) * (1 - stufe(co.z, 0.8, 0.88))
        schnauze = stufe(-co.y, 0.33, 0.4) * (1 - stufe(co.z, 0.88, 0.94))
        wange = stufe(abs(co.x), 0.3, 0.36) * stufe(co.z, 0.74, 0.78) * (1 - stufe(co.z, 0.9, 0.94))
        spitze = stufe(co.y, 0.5, 0.56) * stufe(co.z, 0.86, 0.94)
        return misch(misch(ORANGE, CREME, max(brust, schnauze, wange, spitze)), DUNKEL, 1 - stufe(co.z, 0.06, 0.14))
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):
        p, n = auf_kopf(KOPF, 0.37, s * 0.55, 0.85, tief=0.85)
        ohr(f"ohr{s}", p, 0.14, 0.36, n + Vector((s * 0.15, 0, 0.2)), material("Fell", ORANGE), material("Innen", CREME), root,
            spitze_farbe=material("Spitze", DUNKEL))
    augen(KOPF, 0.37, 0.36, 0.08, 0.085, root)
    wangen(KOPF, 0.37, 0.75, -0.25, root)
    nase((0, -0.45, 0.93), root)
    return root

def panda():
    root = root_fuer("panda")
    b = chibi(Blob())
    for s in (-1, 1):
        b.kugel(KOPF + Vector((s * 0.25, 0.03, 0.27)), 0.1)
    flecken_pos = [auf_kopf(KOPF, KR, s * 0.36, 0.05)[0] for s in (-1, 1)]
    def farbe(co, n):
        if co.z > KOPF.z + 0.22 and abs(co.x) > 0.17: return SCHWARZ                          # Ohren
        if any(((co - p) * Vector((1, 1, 0.8))).length < 0.1 for p in flecken_pos): return SCHWARZ   # Augenflecken
        if (abs(co.x) > 0.2 and co.z < 0.62) or co.z < 0.2: return SCHWARZ                     # Arme, Beine
        if 0.56 < co.z < 0.7 and co.y > -0.1: return SCHWARZ                                   # Schulterband
        return WEISS
    blob_mesh("koerper", b, farbe, eltern=root)
    gesicht_tier(root, iris=0x6b4f3a, nase_farbe=SCHWARZ, wange=False)
    return root

def koala():
    root = root_fuer("koala")
    GRAU, HELL = 0x9ca3af, 0xe5e7eb
    b = chibi(Blob())
    for s in (-1, 1):
        b.kugel(KOPF + Vector((s * 0.33, 0.04, 0.12)), 0.15)
    blob_mesh("koerper", b, lambda co, n: misch(GRAU, HELL, bauch(co)), eltern=root)
    for s in (-1, 1):
        kugel(f"flausch{s}", KOPF + Vector((s * 0.34, -0.06, 0.12)), 0.09, material("Flausch", WEISS, rau=0.9), groesse=(1, 0.5, 1), eltern=root)
    augen(KOPF, KR, 0.4, 0.12, 0.07, root)
    wangen(KOPF, KR, 0.75, -0.2, root)
    p, _ = auf_kopf(KOPF, KR, 0, -0.08, tief=1.0)
    nase(p, root, farbe=0x374151, r=0.06, groesse=(1, 0.8, 1.35))
    laecheln("mund", KOPF, KR * 1.01, 0.28, -0.36, root, tiefe=0.05, dicke=0.013)   # unter der großen Nase
    return root

def tiger():
    root = root_fuer("tiger")
    FELL, HELL = 0xf97316, 0xfff7ed
    b = chibi(Blob())
    for s in (-1, 1):
        b.kugel(KOPF + Vector((s * 0.26, 0.03, 0.25)), 0.085)
    b.kette([(0, 0.3, 0.3), (0, 0.48, 0.38), (0, 0.56, 0.55), (0, 0.52, 0.72)], [0.06, 0.055, 0.05, 0.045])
    def farbe(co, n):
        c = misch(FELL, HELL, max(bauch(co), schnauzenfleck(co, ab=0.28)))
        streifen = stufe(math.sin(co.z * 24 + abs(co.x) * 9 + co.y * 6), 0.7, 0.92) * (1 - bauch(co)) * (1 - schnauzenfleck(co, ab=0.25))
        return misch(c, SCHWARZ, streifen)
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):
        kugel(f"ohrinnen{s}", KOPF + Vector((s * 0.26, -0.03, 0.26)), 0.05, material("Innen", HELL), groesse=(1, 0.4, 1), eltern=root)
    gesicht_tier(root, iris=0xfacc15, nase_farbe=0xf472b6)
    schnurrhaare(KOPF, KR, -0.15, root)
    return root

def lion():
    root = root_fuer("lion")
    FELL, HELL, MAEHNE = 0xeab308, 0xfef3c7, 0xb45309
    b = chibi(Blob())
    b.kette([(0, 0.3, 0.3), (0, 0.48, 0.36), (0, 0.6, 0.48)], [0.05, 0.045, 0.04])
    blob_mesh("koerper", b, lambda co, n: misch(FELL, HELL, max(bauch(co), schnauzenfleck(co, ab=0.28))), eltern=root)
    m = Blob()   # Mähne als Kranz hinter dem Gesicht
    for i in range(14):
        w = i / 14 * math.pi * 2
        m.kugel(KOPF + Vector((math.cos(w) * 0.34, 0.08, math.sin(w) * 0.34)), 0.14)
    m.kugel(KOPF + Vector((0, 0.18, 0)), 0.3)
    blob_mesh("maehne", m, mat=material("Maehne", MAEHNE, rau=0.8), glatt=8, ziel_flaechen=4000, eltern=root)
    kugel("quaste", (0, 0.66, 0.52), 0.07, material("Maehne", MAEHNE, rau=0.8), eltern=root)
    for s in (-1, 1):
        kugel(f"ohr{s}", KOPF + Vector((s * 0.24, -0.05, 0.27)), 0.07, material("Fell", FELL), eltern=root)
    gesicht_tier(root, iris=0xb45309, nase_farbe=0x7c2d12)
    return root

def cow():
    root = root_fuer("cow")
    b = chibi(Blob())
    b.ellipse(KOPF + Vector((0, -0.28, -0.12)), 0.16, (1.25, 0.9, 0.8))   # Maul
    for s in (-1, 1):
        b.ellipse(KOPF + Vector((s * 0.38, 0.0, 0.08)), 0.08, (1.3, 0.6, 0.6))
    def farbe(co, n):
        if (co - (KOPF + Vector((0, -0.28, -0.12)))).length < 0.17 and co.y < KOPF.y - 0.22: return 0xf9a8d4
        return misch(WEISS, SCHWARZ, flecken(co, 7.0, 1.7))
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):
        kegel(f"horn{s}", KOPF + Vector((s * 0.2, 0.0, 0.3)), 0.045, 0.14, Vector((s * 0.7, 0, 1)), material("Horn", 0xfef3c7), biegung=(s * -0.03, 0), eltern=root)
        kugel(f"nuester{s}", KOPF + Vector((s * 0.06, -0.42, -0.12)), 0.022, material("Nase", 0x9d174d), eltern=root)
    augen(KOPF, KR, 0.42, 0.18, 0.075, root)
    kugel("glocke", (0, -0.2, 0.68), 0.06, material("Gold", 0xfacc15, rau=0.3, metall=0.7), eltern=root)
    return root

def pig():
    root = root_fuer("pig")
    ROSA, DUNKEL = 0xf9a8d4, 0xec4899
    b = chibi(Blob())
    b.ellipse(KOPF + Vector((0, -0.33, -0.06)), 0.12, (1.1, 0.5, 0.8))
    blob_mesh("koerper", b, lambda co, n: misch(ROSA, 0xfbcfe8, bauch(co)) if co.y > KOPF.y - 0.38 else rgb_d(DUNKEL), eltern=root)
    for s in (-1, 1):
        kugel(f"nuester{s}", KOPF + Vector((s * 0.04, -0.4, -0.06)), 0.025, material("Nase", 0x9d174d), eltern=root)
        p, n = auf_kopf(KOPF, KR, s * 0.55, 0.85, tief=0.85)
        ohr(f"ohr{s}", p, 0.1, 0.18, n + Vector((s * 0.2, -0.2, 0.2)), material("Fell", ROSA), material("Innen", DUNKEL), root, biegung=(0, -0.06))
    ringel = Blob().kette([(0, 0.32, 0.4), (0.05, 0.38, 0.45), (0.0, 0.42, 0.5), (-0.05, 0.38, 0.52), (0, 0.36, 0.58)], [0.03] * 5)
    blob_mesh("schwanz", ringel, mat=material("Fell", ROSA), glatt=4, ziel_flaechen=1500, eltern=root)
    gesicht_tier(root, nick=0.15, mund_nick=-0.45)
    return root

def rgb_d(h):
    from basis import rgb
    return rgb(h)

def otter():
    root = root_fuer("otter")
    FELL, HELL = 0x92400e, 0xfde68a
    b = chibi(Blob())
    for s in (-1, 1):
        b.kugel(KOPF + Vector((s * 0.27, 0.03, 0.22)), 0.06)
    b.ellipse((0, 0.38, 0.12), 0.22, (0.5, 1.0, 0.25), Quaternion((1, 0, 0), 0.4))   # flacher Schwanz
    blob_mesh("koerper", b, lambda co, n: misch(FELL, HELL, max(bauch(co), schnauzenfleck(co, ab=0.22))), eltern=root)
    gesicht_tier(root, nase_farbe=0x3f1d0b)
    schnurrhaare(KOPF, KR, -0.15, root, farbe=0xfde68a)
    return root

def sloth():
    root = root_fuer("sloth")
    FELL, GESICHT, MASKE = 0xa8a29e, 0xf5f5f4, 0x57534e
    b = chibi(Blob(), arme=False)
    for s in (-1, 1):
        b.kapsel((s * 0.24, -0.06, 0.58), (s * 0.36, -0.16, 0.3), 0.07)
    augenpos = [auf_kopf(KOPF, KR, s * 0.34, 0.03)[0] for s in (-1, 1)]
    def farbe(co, n):
        if any(((co - p) * Vector((0.8, 1, 1.4))).length < 0.1 for p in augenpos): return MASKE
        return misch(FELL, GESICHT, max(schnauzenfleck(co, ab=0.18) * stufe(co.z, 0.78, 0.82), bauch(co) * 0.5))
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):
        for k in range(3):
            kegel(f"kralle{s}{k}", (s * (0.36 + k * 0.02 - 0.02), -0.2, 0.26), 0.015, 0.07, Vector((0, -0.3, -1)), material("Kralle", 0x44403c), stufe_=0, eltern=root)
    gesicht_tier(root, iris=0x78350f, nase_farbe=0x44403c, gier=0.34, nick=0.03)
    return root

def hedgehog():
    root = root_fuer("hedgehog")
    STACHEL, HELL = 0x57341c, 0xfde68a
    b = chibi(Blob())
    blob_mesh("koerper", b, lambda co, n: misch(0x78350f, HELL, max(bauch(co, tief=0.1), stufe(-co.y, 0.1, 0.2) * stufe(co.z, 0.55, 0.6))), eltern=root)
    mat = material("Stachel", STACHEL, rau=0.7)
    stacheln("st_kopf", KOPF, KR, root, mat, reihen=4, je_reihe=7)
    stacheln("st_bauch", (0, 0.05, 0.45), 0.3, root, mat, reihen=3, je_reihe=6, bis=0.7)
    gesicht_tier(root, nase_farbe=SCHWARZ)
    return root

def unicorn():
    root = root_fuer("unicorn")
    WEISS_, MAEHNE = 0xfdfcff, [0xf9a8d4, 0xc4b5fd, 0x93c5fd, 0xa7f3d0]
    b = chibi(Blob())
    b.ellipse(KOPF + Vector((0, -0.26, -0.1)), 0.15, (1.05, 1.0, 0.85))
    blob_mesh("koerper", b, lambda co, n: rgb_d(0xc4b5fd) if co.z < 0.1 else rgb_d(WEISS_), eltern=root)
    for s in (-1, 1):
        p, n = auf_kopf(KOPF, KR, s * 0.5, 0.8, tief=0.85)
        ohr(f"ohr{s}", p, 0.09, 0.22, n + Vector((s * 0.1, 0, 0.3)), material("Fell", WEISS_), material("Innen", 0xf9a8d4), root)
    kegel("horn", KOPF + Vector((0, -0.18, 0.28)), 0.06, 0.36, Vector((0, -0.4, 1)), material("Horn", 0xfacc15, rau=0.3, metall=0.5, leucht=0.3), drall=6.0, segmente=8, eltern=root)
    for i, (y, z) in enumerate([(0.05, 1.28), (0.2, 1.2), (0.3, 1.05), (0.33, 0.88)]):   # Regenbogenmähne
        kugel(f"maehne{i}", (0, y, z), 0.11, material("Maehne", MAEHNE[i % 4], rau=0.7), groesse=(0.7, 1, 1), eltern=root)
    for i, (y, z) in enumerate([(0.36, 0.45), (0.48, 0.38), (0.56, 0.28)]):
        kugel(f"schweif{i}", (0, y, z), 0.1 - i * 0.015, material("Maehne", MAEHNE[(i + 1) % 4], rau=0.7), eltern=root)
    gesicht_tier(root, iris=0xa855f7, nick=0.12, mund_nick=-0.42)
    return root

# ---------- Vögel ----------
def penguin():
    root = root_fuer("penguin")
    BLAU, HELL, GELB = 0x2e5fb8, 0xeaf4ff, 0xffc23a
    K, R = Vector((0, 0, 1.0)), 0.34
    b = Blob()
    b.ellipse((0, 0.02, 0.5), 0.38, (1.0, 0.95, 1.12))
    b.kugel(K, R)
    for s in (-1, 1):
        b.ellipse((s * 0.4, 0.02, 0.55), 0.22, (0.28, 0.6, 1.0), Quaternion((0, 1, 0), -s * 0.45))
    def farbe(co, n):
        vorn = stufe(-co.y, 0.06, 0.16)
        bauch_ = vorn * stufe(co.z, 0.12, 0.2) * (1 - stufe(co.z, 0.78, 0.86))
        gesicht_ = stufe(-co.y, 0.16, 0.24) * stufe(co.z, 0.8, 0.86) * (1 - stufe(co.z, 1.14, 1.2)) * (1 - stufe(abs(co.x), 0.22, 0.3))
        return misch(BLAU, HELL, max(bauch_, gesicht_) * (1 - stufe(abs(co.x), 0.36, 0.42)))
    blob_mesh("koerper", b, farbe, eltern=root)
    for s in (-1, 1):
        kugel(f"fuss{s}", (s * 0.14, -0.14, 0.04), 0.1, material("Fuss", 0xff9a2e), groesse=(1, 1.6, 0.42), eltern=root)
    augen(K, R, 0.34, 0.12, 0.08, root)
    wangen(K, R, 0.7, -0.15, root)
    p, n = auf_kopf(K, R, 0, -0.1, tief=0.9)
    kegel("schnabel", p, 0.1, 0.2, Vector((0, -1, -0.15)), material("Schnabel", GELB, rau=0.4), flach=0.75, eltern=root)
    for k, (x, l) in enumerate([(-0.05, 0.16), (0.0, 0.22), (0.05, 0.16)]):
        kegel(f"kamm{k}", (x, 0.02, K.z + R * 0.92), 0.04, l, Vector((x * 2, 0.1, 1)), material("Kamm", GELB, rau=0.4), stufe_=1, eltern=root)
    return root

def duck():
    root = root_fuer("duck")
    GELB, ORANGE = 0xfde047, 0xfb923c
    b = chibi(Blob(), beine=False, arme=False)
    for s in (-1, 1):
        b.ellipse((s * 0.3, 0.05, 0.5), 0.15, (0.4, 0.8, 0.9), Quaternion((0, 1, 0), -s * 0.4))
    blob_mesh("koerper", b, lambda co, n: misch(GELB, 0xfef9c3, bauch(co)), eltern=root)
    kugel("schnabel", KOPF + Vector((0, -0.37, -0.08)), 0.13, material("Schnabel", ORANGE, rau=0.4), groesse=(1.1, 0.9, 0.35), eltern=root)
    for s in (-1, 1):
        kugel(f"fuss{s}", (s * 0.13, -0.12, 0.04), 0.1, material("Fuss", ORANGE), groesse=(1, 1.5, 0.35), eltern=root)
    for k in range(3):
        kegel(f"feder{k}", KOPF + Vector(((k - 1) * 0.04, 0.02, KR * 0.95)), 0.035, 0.14, Vector(((k - 1) * 0.3, 0.3, 1)), material("Fell", GELB), stufe_=1, eltern=root)
    augen(KOPF, KR, 0.38, 0.12, 0.08, root)
    wangen(KOPF, KR, 0.72, -0.15, root)
    return root

def owl():
    root = root_fuer("owl")
    BRAUN, HELL, DUNKEL = 0x92400e, 0xfde68a, 0x5a2a0a
    b = chibi(Blob(), arme=False)
    def farbe(co, n):
        scheibe = stufe(-(co.y - KOPF.y), 0.24, 0.3) * stufe(co.z, KOPF.z - 0.25, KOPF.z - 0.18)
        return misch(BRAUN, HELL, max(scheibe, bauch(co) * 0.7))
    blob_mesh("koerper", b, farbe, eltern=root)
    def fluegel_farbe(co, n):   # dunkle Schwungfedern unten, helle Bänder
        return misch(misch(BRAUN, DUNKEL, 1 - stufe(co.z, 0.3, 0.5)), HELL, stufe(math.sin(co.z * 40), 0.8, 0.95) * 0.5)
    for s in (-1, 1):   # Flügel: flache Schwinge mit drei Federspitzen, leicht abgespreizt
        f = Blob()
        f.ellipse((s * 0.33, 0.06, 0.55), 0.22, (0.22, 0.75, 1.0), Quaternion((0, 1, 0), -s * 0.45))
        for k in range(3):
            f.ellipse((s * (0.42 + k * 0.04), 0.0 + k * 0.08, 0.33 - k * 0.02), 0.09, (0.25, 0.55, 1.2), Quaternion((0, 1, 0), -s * (0.55 + k * 0.12)))
        blob_mesh(f"fluegel{s}", f, fluegel_farbe, glatt=6, ziel_flaechen=2500, eltern=root)
    for s in (-1, 1):
        p, n = auf_kopf(KOPF, KR, s * 0.6, 0.75, tief=0.9)
        kegel(f"federohr{s}", p, 0.07, 0.2, n + Vector((s * 0.2, 0, 0.5)), material("Fell", BRAUN), flach=0.5, vorn=Vector((0, -1, 0)), eltern=root)
    augen(KOPF, KR, 0.36, 0.06, 0.1, root, iris=0xf59e0b)
    p, n = auf_kopf(KOPF, KR, 0, -0.12, tief=0.95)
    kegel("schnabel", p, 0.05, 0.11, Vector((0, -0.6, -1)), material("Schnabel", 0xfacc15, rau=0.4), eltern=root)
    return root

def parrot():
    root = root_fuer("parrot")
    GRUEN, ROT, BLAU, GELB = 0x22c55e, 0xef4444, 0x3b82f6, 0xfacc15
    b = chibi(Blob(), arme=False)
    for s in (-1, 1):
        b.ellipse((s * 0.31, 0.06, 0.52), 0.2, (0.35, 0.75, 1.0), Quaternion((0, 1, 0), -s * 0.3))
    def farbe(co, n):
        if abs(co.x) > 0.27 and co.z < 0.75: return BLAU
        c = misch(GRUEN, ROT, stufe(co.z, 0.78, 0.86))
        return misch(c, GELB, bauch(co) * 0.6)
    blob_mesh("koerper", b, farbe, eltern=root)
    for k, (f, x) in enumerate(((ROT, -0.07), (BLAU, 0.0), (GELB, 0.07))):
        kugel(f"feder{k}", (x, 0.35, 0.22), 0.25, material("Feder", f), groesse=(0.2, 0.25, 1), drehung=Quaternion((1, 0, 0), 0.5), eltern=root)
    # Hakenschnabel: oben kräftig und nach unten gebogen, darunter ein kleiner Unterschnabel
    p, n = auf_kopf(KOPF, KR, 0, -0.02, tief=0.9)
    kegel("schnabel", p, 0.1, 0.22, Vector((0, -1, -0.15)), material("Schnabel", 0xfef3c7, rau=0.4), biegung=(0, 0.12), flach=0.85, vorn=Vector((0, 0, 1)), eltern=root)
    p2, _ = auf_kopf(KOPF, KR, 0, -0.2, tief=0.92)
    kegel("unterschnabel", p2, 0.06, 0.09, Vector((0, -1, -0.3)), material("Unterschnabel", 0x78716c, rau=0.5), flach=0.8, vorn=Vector((0, 0, 1)), eltern=root)
    augen(KOPF, KR, 0.42, 0.12, 0.075, root)
    return root

def flamingo():
    root = root_fuer("flamingo")
    ROSA, HELL = 0xf9a8d4, 0xfce7f3
    K, R = Vector((0, -0.12, 1.35)), 0.24
    b = Blob()
    b.ellipse((0, 0.05, 0.78), 0.26, (0.9, 1.15, 0.85))
    b.kette([(0, 0.0, 0.92), (0, -0.08, 1.05), (0, -0.04, 1.18), (0, -0.1, 1.28)], [0.07, 0.065, 0.06, 0.07])
    b.kugel(K, R)
    for s in (-1, 1):
        b.ellipse((s * 0.22, 0.08, 0.8), 0.18, (0.35, 0.9, 0.7))
    blob_mesh("koerper", b, lambda co, n: misch(ROSA, HELL, stufe(abs(co.x), 0.2, 0.24) * (1 - stufe(co.z, 0.95, 1.0))), eltern=root)
    for s in (-1, 1):
        stab(f"bein{s}", (s * 0.08, 0.05, 0.6), (s * 0.08, 0.02, 0.04), 0.022, material("Bein", 0xf472b6), eltern=root)
        kugel(f"fuss{s}", (s * 0.08, -0.05, 0.03), 0.07, material("Bein", 0xf472b6), groesse=(1, 1.4, 0.3), eltern=root)
    p, n = auf_kopf(K, R, 0, -0.1, tief=0.9)
    kegel("schnabel", p, 0.06, 0.2, Vector((0, -1, -0.6)), material("Schnabel", 0xfef3c7, rau=0.4), biegung=(0, 0.06), eltern=root,
          farbe_nach_hoehe=(0.55, material("Spitze", SCHWARZ)))
    augen(K, R, 0.4, 0.15, 0.06, root)
    wangen(K, R, 0.72, -0.15, root, groesse=0.04)
    return root

def peacock():
    root = root_fuer("peacock")
    BLAU, GRUEN = 0x1d4ed8, 0x059669
    b = chibi(Blob(), arme=False)
    blob_mesh("koerper", b, lambda co, n: misch(BLAU, 0x60a5fa, bauch(co) * 0.6), eltern=root)
    for i in range(9):   # Rad mit Augenflecken
        a = math.pi * (0.12 + i / 8 * 0.76)
        x, z = math.cos(a) * 0.62, 0.35 + math.sin(a) * 0.62
        kugel(f"rad{i}", (x, 0.34, z), 0.17, material("Rad", GRUEN, rau=0.5), groesse=(1, 0.18, 1.25), drehung=Quaternion((0, 1, 0), -(a - math.pi / 2)), eltern=root)
        kugel(f"auge{i}", (x, 0.31, z), 0.065, material("Radauge", 0x1e3a8a), groesse=(1, 0.3, 1.2), eltern=root)
        kugel(f"kern{i}", (x, 0.29, z), 0.03, material("Radkern", 0xfacc15, leucht=0.5), groesse=(1, 0.3, 1.2), eltern=root)
    for k in range(3):
        stab(f"krone{k}", KOPF + Vector(((k - 1) * 0.05, 0.0, KR * 0.95)), KOPF + Vector(((k - 1) * 0.08, 0.03, KR + 0.16)), 0.01, material("Krone", BLAU), eltern=root)
        kugel(f"kronenkugel{k}", KOPF + Vector(((k - 1) * 0.08, 0.03, KR + 0.17)), 0.025, material("Krone", 0x60a5fa), eltern=root)
    p, n = auf_kopf(KOPF, KR, 0, -0.08, tief=0.92)
    kegel("schnabel", p, 0.06, 0.14, Vector((0, -1, -0.2)), material("Schnabel", 0xa8a29e, rau=0.4), eltern=root)
    augen(KOPF, KR, 0.4, 0.12, 0.075, root)
    return root

# ---------- Wassertiere (schweben) ----------
def schwimmer(b, kopf, kr, z=0.55):
    """Runder Kopf vorn (Gesicht sitzt darauf), Körper verjüngt nach hinten, Fluke und Seitenflossen"""
    b.kugel(kopf, kr)
    b.ellipse((0, kopf.y + kr * 0.8, z), kr * 0.85, (0.85, 1.3, 0.8))
    b.kapsel((0, kopf.y + kr * 1.6, z + 0.02), (0, kopf.y + kr * 2.1, z + 0.06), kr * 0.3, kr * 0.18)
    b.ellipse((0, kopf.y + kr * 2.25, z + 0.07), 0.2, (1.6, 0.45, 0.22))
    for s in (-1, 1):
        b.ellipse((s * kr * 0.95, kopf.y + kr * 0.4, z - 0.15), 0.14, (1.0, 0.6, 0.22), Quaternion((0, 1, 0), s * 0.5))
    return b

def whale():
    root = root_fuer("whale")
    BLAU, HELL = 0x3b82f6, 0xdbeafe
    K, R = Vector((0, -0.2, 0.55)), 0.42
    b = schwimmer(Blob(), K, R)
    blob_mesh("koerper", b, lambda co, n: misch(BLAU, HELL, stufe(-(co.z - K.z), 0.12, 0.2)), eltern=root)
    augen(K, R, 0.5, 0.15, 0.075, root)
    wangen(K, R, 0.8, -0.05, root)
    laecheln("mund", K, R * 1.01, 1.0, -0.12, root, tiefe=0.07, dicke=0.013)
    for k, z in enumerate((1.05, 1.18, 1.3)):   # Fontäne
        kugel(f"fontaene{k}", (0, K.y + 0.05, z), 0.05 + k * 0.02, material("Wasser", 0x7dd3fc, rau=0.1, leucht=0.4), eltern=root)
    return root

def shark():
    root = root_fuer("shark")
    GRAU, HELL = 0x64748b, 0xf1f5f9
    K, R = Vector((0, -0.18, 0.55)), 0.38
    b = schwimmer(Blob(), K, R)
    blob_mesh("koerper", b, lambda co, n: misch(GRAU, HELL, stufe(-(co.z - K.z), 0.1, 0.18)), eltern=root)
    kegel("rueckenflosse", (0, K.y + 0.3, K.z + 0.3), 0.14, 0.3, Vector((0, 0.5, 1)), material("Flosse", 0x475569), flach=0.3, vorn=Vector((1, 0, 0)), eltern=root)
    augen(K, R, 0.5, 0.2, 0.068, root)
    mund_ellipse("mund", K, R, (1, 1, 1), -0.1, 1.3, 0.05, root, dicke=0.013, zaehne=7, zahn_laenge=0.04)
    return root

def dolphin():
    root = root_fuer("dolphin")
    BLAU, HELL = 0x60a5fa, 0xe0f2fe
    K, R = Vector((0, -0.15, 0.56)), 0.36
    SCHNAUZE, SR, SFORM = K + Vector((0, -0.33, -0.08)), 0.11, (0.9, 1.5, 0.65)
    b = schwimmer(Blob(), K, R)
    b.ellipse(SCHNAUZE, SR, SFORM)
    blob_mesh("koerper", b, lambda co, n: misch(BLAU, HELL, stufe(-(co.z - K.z), 0.06, 0.14)), eltern=root)
    kegel("rueckenflosse", (0, K.y + 0.35, K.z + 0.26), 0.12, 0.25, Vector((0, 0.7, 1)), material("Flosse", 0x3b82f6), flach=0.3, biegung=(0, 0.08), vorn=Vector((1, 0, 0)), eltern=root)
    augen(K, R, 0.5, 0.18, 0.068, root)
    wangen(K, R, 0.78, -0.02, root, groesse=0.045)
    mund_ellipse("mund", SCHNAUZE, SR, SFORM, -0.015, 2.2, 0.0, root, dicke=0.011)   # Lächeln an der Schnauze entlang
    return root

def octopus():
    root = root_fuer("octopus")
    LILA, HELL = 0xc084fc, 0xf5d0fe
    K, R = Vector((0, 0, 0.82)), 0.38
    b = Blob()
    b.ellipse(K, R, (1.0, 1.0, 1.12))
    for i in range(8):   # Tentakel, außen nach oben eingerollt
        w = i / 8 * math.pi * 2 + math.pi / 8
        d = Vector((math.cos(w), math.sin(w), 0))
        pkt = [K + d * 0.2 + Vector((0, 0, -0.35)), K + d * 0.36 + Vector((0, 0, -0.58)), K + d * 0.5 + Vector((0, 0, -0.72)), K + d * 0.6 + Vector((0, 0, -0.66)), K + d * 0.63 + Vector((0, 0, -0.55))]
        b.kette(pkt, [0.11, 0.085, 0.065, 0.05, 0.04])
    blob_mesh("koerper", b, lambda co, n: misch(LILA, HELL, stufe(-n.z, 0.3, 0.6) * (1 - stufe(co.z, 0.35, 0.45))), eltern=root)
    augen(K, R, 0.36, 0.0, 0.09, root)
    wangen(K, R, 0.7, -0.25, root)
    laecheln("mund", K, R * 1.005, 0.35, -0.35, root, tiefe=0.07)
    return root

def crab():
    root = root_fuer("crab")
    ROT, HELL = 0xef4444, 0xfecaca
    K = Vector((0, 0, 0.42))
    b = Blob()
    b.ellipse(K, 0.36, (1.45, 1.0, 0.75))
    for s in (-1, 1):
        b.kapsel((s * 0.42, -0.08, 0.45), (s * 0.58, -0.2, 0.62), 0.06)                       # Scherenarme
        for k in range(3):
            b.kapsel((s * 0.38, 0.1 - k * 0.12, 0.35), (s * 0.62, 0.12 - k * 0.14, 0.05), 0.035)  # Beine
    blob_mesh("koerper", b, lambda co, n: misch(ROT, HELL, stufe(-n.z, 0.4, 0.7)), eltern=root)
    schere = material("Schere", 0xdc2626, rau=0.45)
    for s in (-1, 1):
        kugel(f"schere{s}", (s * 0.62, -0.24, 0.72), 0.13, schere, groesse=(0.8, 0.6, 1.0), eltern=root)
        kegel(f"zange{s}", (s * 0.62, -0.28, 0.82), 0.05, 0.14, Vector((s * 0.2, -0.4, 1)), schere, eltern=root)
        stab(f"stiel{s}", (s * 0.12, -0.12, 0.62), (s * 0.15, -0.14, 0.82), 0.025, material("Panzer", ROT), eltern=root)
        kugel(f"stielauge{s}", (s * 0.15, -0.15, 0.86), 0.07, material("Panzer", ROT), eltern=root)
    for s in (-1, 1):
        auge(f"auge{s}", Vector((s * 0.15, -0.15, 0.86)), 0.07, s * 0.15, 0.1, 0.045, eltern=root)
    laecheln("mund", K, 0.37, 0.6, -0.1, root, tiefe=0.05)
    return root

def turtle():
    root = root_fuer("turtle")
    HAUT_, PANZER, RAND = 0x84cc16, 0x65a30d, 0xfef08a
    b = chibi(Blob())
    blob_mesh("koerper", b, lambda co, n: misch(HAUT_, 0xd9f99d, bauch(co)), eltern=root)
    p = Blob(); p.ellipse((0, 0.24, 0.52), 0.4, (1.12, 0.72, 1.15))
    def panzer(co, n):
        waben = abs(math.sin(co.x * 13) * math.sin(co.z * 13 + co.x * 5))
        if co.y < 0.12: return rgb_d(RAND)
        return misch(0x7c9a2b, 0x3f5212, stufe(waben, 0.82, 0.92))
    blob_mesh("panzer", p, panzer, glatt=8, ziel_flaechen=4000, eltern=root)
    gesicht_tier(root, iris=0x713f12)
    return root

def axolotl():
    root = root_fuer("axolotl")
    ROSA, HELL, MAGENTA = 0xffa6c9, 0xffe0ee, 0xe0458f
    K, R = Vector((0, -0.02, 0.92)), 0.34
    b = Blob()
    b.ellipse(K, R, (1.28, 1.0, 0.9))
    b.ellipse((0, 0.06, 0.45), 0.29, (0.92, 1.0, 1.05))
    for s in (-1, 1):
        b.kapsel((s * 0.2, -0.1, 0.3), (s * 0.27, -0.16, 0.08), 0.07)
        b.kapsel((s * 0.18, 0.18, 0.28), (s * 0.24, 0.2, 0.07), 0.075)
    b.ellipse((0, 0.42, 0.32), 0.3, (0.22, 1.0, 0.55), Quaternion((1, 0, 0), 0.35))
    for s in (-1, 1):
        for k, w in enumerate((0.55, 0.15, -0.25)):
            a = Vector((s * 0.38, 0.06, K.z + 0.08 + k * 0.02))
            d = Vector((s * math.cos(w), 0.1, math.sin(w))).normalized()
            b.kapsel(a, a + d * 0.3, 0.045, 0.035)
            for j in range(1, 4):
                q = a + d * (0.1 * j)
                b.kugel(q + Vector((0, 0, 0.035)), 0.035).kugel(q - Vector((0, 0, 0.035)), 0.03)
    def farbe(co, n):
        kieme = stufe(abs(co.x), 0.44, 0.5) * stufe(co.z, 0.8, 0.86)
        bauch_ = stufe(-co.y, 0.12, 0.22) * (1 - stufe(co.z, 0.66, 0.74)) * stufe(co.z, 0.1, 0.16)
        return misch(misch(ROSA, HELL, bauch_), MAGENTA, kieme)
    blob_mesh("koerper", b, farbe, eltern=root)
    augen(K, R * 1.1, 0.5, 0.18, 0.06, root)
    wangen(K, R * 1.2, 0.85, -0.2, root, farbe=0xff6a9a, groesse=0.055)
    laecheln("mund", K, R * 1.03, 1.1, -0.18, root, farbe=0x7a1f45, tiefe=0.12)
    return root

# ---------- Insekten, Reptilien ----------
def bee():
    root = root_fuer("bee")
    GELB = 0xfacc15
    b = chibi(Blob(), rumpf=0.34)
    def farbe(co, n):
        if co.z > 0.72: return GELB
        return misch(GELB, SCHWARZ, stufe(math.sin(co.z * 30), 0.2, 0.5))
    blob_mesh("koerper", b, farbe, eltern=root)
    fluegel = material("Fluegel", 0xe0f2fe, rau=0.1, alpha=0.55)
    for s in (-1, 1):
        kugel(f"fluegel{s}", (s * 0.28, 0.3, 0.75), 0.24, fluegel, groesse=(1, 0.12, 0.65), drehung=Quaternion((0, 1, 0), s * -0.6), eltern=root)
        stab(f"fuehler{s}", KOPF + Vector((s * 0.1, 0, KR * 0.9)), KOPF + Vector((s * 0.2, -0.05, KR + 0.22)), 0.012, material("Fuehler", SCHWARZ), eltern=root)
        kugel(f"fuehlerkugel{s}", KOPF + Vector((s * 0.2, -0.05, KR + 0.24)), 0.035, material("Fuehler", SCHWARZ), eltern=root)
    kegel("stachel", (0, 0.32, 0.35), 0.04, 0.12, Vector((0, 1, -0.3)), material("Stachel", SCHWARZ), stufe_=0, eltern=root)
    gesicht_tier(root)
    return root

def butterfly():
    root = root_fuer("butterfly")
    ORANGE, SCHW = 0xfb923c, 0x292524
    K, R = Vector((0, 0, 0.95)), 0.3
    b = Blob()
    b.kugel(K, R)
    b.kapsel((0, 0.05, 0.7), (0, 0.12, 0.2), 0.13, 0.08)
    blob_mesh("koerper", b, lambda co, n: rgb_d(0x44403c) if co.z < 0.68 else rgb_d(0x57534e), eltern=root)
    def fluegel_farbe(co, n):
        x = abs(co.x)
        d = min(math.hypot(x - 0.38, co.z - 0.85) / 0.3, math.hypot(x - 0.3, co.z - 0.45) / 0.22)
        rand = stufe(d, 0.68, 0.78)
        punkt = (1 - stufe(abs(math.sin(math.atan2(co.z - 0.65, x - 0.3) * 7)), 0.0, 0.35)) * stufe(d, 0.84, 0.88) * (1 - stufe(d, 0.96, 1.0))
        return misch(misch(ORANGE, SCHW, rand), WEISS, punkt)
    for s in (-1, 1):
        f = Blob()
        f.ellipse((s * 0.38, 0.18, 0.85), 0.3, (1.0, 0.1, 0.85), Quaternion((0, 0, 1), s * -0.3))
        f.ellipse((s * 0.3, 0.2, 0.45), 0.22, (1.0, 0.1, 0.9), Quaternion((0, 0, 1), s * 0.2))
        blob_mesh(f"fluegel{s}", f, fluegel_farbe, voxel=0.009, glatt=4, ziel_flaechen=3000, eltern=root)
        stab(f"fuehler{s}", K + Vector((s * 0.08, -0.05, R * 0.9)), K + Vector((s * 0.2, -0.12, R + 0.25)), 0.01, material("Fuehler", SCHW), eltern=root)
        kugel(f"fuehlerkugel{s}", K + Vector((s * 0.2, -0.12, R + 0.27)), 0.03, material("Fuehler", SCHW), eltern=root)
    augen(K, R, 0.36, 0.05, 0.075, root)
    wangen(K, R, 0.72, -0.2, root, groesse=0.045)
    laecheln("mund", K, R * 1.01, 0.3, -0.3, root, tiefe=0.06)
    return root

def frog():
    root = root_fuer("frog")
    GRUEN, HELL = 0x4ade80, 0xd9f99d
    K, R, FORM = Vector((0, -0.02, 0.82)), 0.35, (1.3, 1.0, 0.82)
    b = Blob()
    b.ellipse(K, R, FORM)
    b.ellipse((0, 0.05, 0.4), 0.28, (1.0, 1.0, 0.9))
    domes = [K + Vector((s * 0.2, -0.04, 0.25)) for s in (-1, 1)]
    for d in domes:
        b.kugel(d, 0.13)
    for s in (-1, 1):
        b.kapsel((s * 0.22, -0.08, 0.45), (s * 0.3, -0.16, 0.25), 0.06)
        b.kapsel((s * 0.22, 0.05, 0.2), (s * 0.4, -0.1, 0.05), 0.08)
        b.ellipse((s * 0.42, -0.16, 0.03), 0.09, (1.2, 1.3, 0.35))
    blob_mesh("koerper", b, lambda co, n: misch(GRUEN, HELL, max(bauch(co, oben=0.72), stufe(-co.y, 0.3, 0.36) * (1 - stufe(co.z, 0.78, 0.82)))), eltern=root)
    for s, d in zip((-1, 1), domes):
        auge(f"auge{s}", d, 0.13, s * 0.2, 0.25, 0.075, eltern=root)
    for s in (-1, 1):   # Wangen genau auf dem breiten Kopf
        p, n = auf_ellipse(K, R, FORM, s * 0.75, -0.06)
        kugel(f"wange{s}", p, 0.055, material("Wange", 0xff8a9a, rau=0.8), groesse=(1, 0.3, 0.7), drehung=richtung_q(n), eltern=root)
    mund_ellipse("mund", K, R, FORM, -0.06, 1.7, 0.06, root, dicke=0.014)
    return root

def dino():
    root = root_fuer("dino")
    TUERKIS, HELL, ORANGE = 0x2dd4bf, 0xccfbf1, 0xfb923c
    SCHNAUZE, SR, SFORM = KOPF + Vector((0, -0.27, -0.1)), 0.19, (1.15, 1.3, 0.78)   # lange Schnauze
    b = chibi(Blob())
    b.ellipse(SCHNAUZE, SR, SFORM)
    b.kette([(0, 0.32, 0.32), (0, 0.5, 0.24), (0, 0.68, 0.16), (0, 0.82, 0.12)], [0.15, 0.11, 0.08, 0.05])
    def farbe(co, n):
        kinn = stufe(-(co.z - SCHNAUZE.z), 0.04, 0.1) * stufe(-co.y, 0.3, 0.36)
        return misch(TUERKIS, HELL, max(bauch(co), kinn))
    blob_mesh("koerper", b, farbe, eltern=root)
    zacken = material("Zacken", ORANGE, rau=0.5)
    for k, (z0, r0, e, g) in enumerate([(KOPF, KR, 1.35, 1.0), (KOPF, KR, 0.95, 1.0), (KOPF, KR, 0.5, 0.9),
                                         (Vector((0, 0.05, 0.45)), 0.31, 0.6, 0.9), (Vector((0, 0.05, 0.45)), 0.31, 0.15, 0.8)]):
        n = Vector((0, math.cos(e), math.sin(e)))
        kegel(f"zacke{k}", Vector(z0) + n * r0 * 0.95, 0.06 * g, 0.15 * g, n, zacken, segmente=8, stufe_=1, eltern=root)
    augen(KOPF, KR, 0.42, 0.2, 0.08, root, iris=0xf97316)
    wangen(KOPF, KR, 0.78, -0.08, root)
    # breites Grinsen entlang der Schnauze, mit spitzen Zähnchen oben
    mund_ellipse("mund", SCHNAUZE, SR, SFORM, -0.05, 2.4, 0.02, root, dicke=0.013, zaehne=6, zahn_laenge=0.045)
    for s in (-1, 1):
        kugel(f"nuester{s}", SCHNAUZE + Vector((s * 0.05, -SR * SFORM[1] * 0.92, 0.07)), 0.016, material("Nase", 0x115e59), eltern=root)
    return root

TIERE = {"tier_" + f.__name__: f for f in (cat, dog, fox, frog, panda, koala, tiger, lion, cow, pig, penguin, duck, owl, octopus, butterfly,
                                           unicorn, bee, turtle, dino, whale, shark, dolphin, otter, sloth, hedgehog, crab, parrot, flamingo, peacock, axolotl)}
