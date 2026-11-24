# -*- coding: utf-8 -*-
"""Arbeitsblatt »Rechnen mit Variablen – die vier Grundrechenarten«.

Eine Seite je Rechenart (Regelkasten + Aufgaben ★ → ★★★, 1–3 Variablen,
Zahlen aus ℕ, dann ℤ), danach die Lösungen mit Rechenweg ab neuer Seite.

Jede Aufgabe, jeder Zwischenschritt und jedes Ergebnis wird mit einem kleinen
Term-Parser nachgerechnet – ein Tippfehler im Rechenweg bricht den Bau ab.

    python ab_terme.py
    chrome --headless=new --no-pdf-header-footer --print-to-pdf=Arbeitsblatt_Terme.pdf ab_terme.html
"""
import pathlib
import re
from fractions import Fraction as Fr

OUT = pathlib.Path(__file__).with_name("ab_terme.html")
ACC, TXT, MUT, LINE = "#e07820", "#1a3060", "#5a6880", "#ccc0a0"
FARBE = {"plus": "#16a34a", "minus": "#db2777", "mal": "#2563eb", "durch": "#8b5cf6"}


# ── Polynome: {Monom: Koeffizient}, Monom = ((Variable, Exponent), …) ──────
def norm(p):
    return {m: c for m, c in p.items() if c != 0}


def add(p, q, s=1):
    r = dict(p)
    for m, c in q.items():
        r[m] = r.get(m, 0) + s * c
    return norm(r)


def mul(p, q):
    r = {}
    for m1, c1 in p.items():
        for m2, c2 in q.items():
            e = dict(m1)
            for v, k in m2:
                e[v] = e.get(v, 0) + k
            m = tuple(sorted(e.items()))
            r[m] = r.get(m, 0) + c1 * c2
    return norm(r)


def div(p, q):
    """Nur durch ein einzelnes Glied (Monom) – wie in der Schule."""
    assert len(q) == 1, "geteilt wird nur durch ein Glied"
    (mq, cq), = q.items()
    assert cq != 0, "durch 0 teilt man nicht"
    r = {}
    for m, c in p.items():
        e = dict(m)
        for v, k in mq:
            e[v] = e.get(v, 0) - k
            assert e[v] >= 0, "Division geht nicht glatt auf"
        m2 = tuple(sorted((v, k) for v, k in e.items() if k))
        r[m2] = r.get(m2, 0) + Fr(c) / cq
    return norm(r)


def potenz(p, n):
    r = {(): Fr(1)}
    for _ in range(n):
        r = mul(r, p)
    return r


# ── Parser für die Schreibweise auf dem Blatt ─────────────────────────────
TOK = re.compile(r"\s*(\d+|[a-z]|[+\-−·:()²³])")


def tokens(s):
    s = s.replace("−", "-")
    pos, out = 0, []
    while pos < len(s):
        m = TOK.match(s, pos)
        if not m:
            if s[pos:].strip() == "":
                break
            raise ValueError(f"unbekanntes Zeichen in »{s}« bei {s[pos:]}")
        out.append(m.group(1))
        pos = m.end()
    return out


def parse(s):
    t = tokens(s)
    i = 0

    def peek():
        return t[i] if i < len(t) else None

    def nimm():
        nonlocal i
        i += 1
        return t[i - 1]

    def summe():
        vz = 1
        if peek() in ("+", "-"):
            vz = -1 if nimm() == "-" else 1
        r = {m: vz * c for m, c in punkt().items()}
        while peek() in ("+", "-"):
            op = nimm()
            r = add(r, punkt(), -1 if op == "-" else 1)
        return r

    def punkt():  # · und : von links nach rechts
        r = produkt()
        while peek() in ("·", ":"):
            op = nimm()
            q = produkt()
            r = mul(r, q) if op == "·" else div(r, q)
        return r

    def produkt():  # ohne Malpunkt: 3x, 2ab, 2(x + 1) – bindet stärker als · und :
        r = faktor()
        while peek() is not None and (peek().isdigit() or peek().isalpha() or peek() == "("):
            r = mul(r, faktor())
        return r

    def faktor():
        if peek() == "-":
            nimm()
            return {m: -c for m, c in faktor().items()}
        tok = nimm()
        if tok == "(":
            r = summe()
            assert nimm() == ")", f"Klammer fehlt in »{s}«"
        elif tok.isdigit():
            r = norm({(): Fr(int(tok))})   # 0 ist der leere Term
        elif tok.isalpha():
            r = {((tok, 1),): Fr(1)}
        else:
            raise ValueError(f"unerwartet »{tok}« in »{s}«")
        while peek() in ("²", "³"):
            r = potenz(r, 2 if nimm() == "²" else 3)
        return r

    r = summe()
    assert i == len(t), f"Rest nicht gelesen in »{s}«: {t[i:]}"
    return r


# ── Ergebnis hübsch schreiben ─────────────────────────────────────────────
HOCH = {2: "²", 3: "³"}


def monom_text(m):
    return "".join(v + HOCH.get(k, "") if k > 1 else v for v, k in m)


def text(p):
    if not p:
        return "0"
    # höherer Grad zuerst, dann alphabetisch, Zahl allein zuletzt
    reihe = sorted(p.items(), key=lambda mc: (-sum(k for _, k in mc[0]), [v for v, _ in mc[0]] or ["~"]))
    teile = []
    for n, (m, c) in enumerate(reihe):
        c = Fr(c)
        betrag = abs(c)
        zahl = str(betrag.numerator) if betrag.denominator == 1 else f"{betrag.numerator}/{betrag.denominator}"
        if m and betrag == 1:
            zahl = ""
        vz = ("−" if c < 0 else "") if n == 0 else (" − " if c < 0 else " + ")
        teile.append(vz + zahl + monom_text(m))
    return "".join(teile)


def gleich(a, b):
    return norm(parse(a)) == norm(parse(b))


# ── Inhalt ────────────────────────────────────────────────────────────────
# Aufgabe: (Stufe, Term, [Rechenschritte])  – jeder Schritt »Term | Hinweis«,
# der letzte Schritt ist das Ergebnis. Alles wird nachgerechnet.
SEITEN = [
    {
        "id": "plus", "titel": "Addieren", "zeichen": "+",
        "einleitung": "Nur <b>gleichartige Glieder</b> (gleiche Variable mit gleicher Hochzahl) lassen sich zusammenfassen – man zählt dann die Zahlen davor zusammen.",
        "regeln": [
            ("a + a = 2a", "zwei gleiche"),
            ("3a + 2a = 5a", "Zahlen davor addieren"),
            ("a + b = a + b", "verschieden – bleibt so"),
            ("a + a + b = 2a + b", "nur die a zusammen"),
            ("2a + 3b + a = 3a + 3b", "sortieren hilft"),
            ("2a + 3 + 4 = 2a + 7", "Zahlen zu Zahlen"),
            ("x² + x = x² + x", "andere Hochzahl – bleibt"),
            ("a + (−b) = a − b", "plus minus = minus"),
        ],
        "klammer": [("a + (b + c) = a + b + c", "Plusklammer: einfach weglassen"), ("a + (b − c) = a + b − c", "Vorzeichen bleiben")],
        "aufgaben": [
            (1, "3x + 5x", ["(3 + 5)x", "8x"]),
            (1, "a + a + a", ["3a"]),
            (1, "4y + 2 + y", ["4y + y + 2 | sortieren", "5y + 2"]),
            (1, "2x + 3 + 5x + 4", ["2x + 5x + 3 + 4 | sortieren", "7x + 7"]),
            (2, "3a + 2b + 4a + b", ["3a + 4a + 2b + b | sortieren", "7a + 3b"]),
            (2, "5x + (−2x)", ["5x − 2x | plus minus = minus", "3x"]),
            (2, "−4y + 7 + 6y + (−9)", ["−4y + 6y + 7 − 9", "2y − 2"]),
            (2, "2a + 3b + (4a + 5b)", ["2a + 3b + 4a + 5b | Plusklammer weglassen", "6a + 8b"]),
            (3, "3x + 2y + z + 4x + 5z", ["3x + 4x + 2y + z + 5z | sortieren", "7x + 2y + 6z"]),
            (3, "−2a + 4b + (−3c) + 5a + (−6b) + 4c", ["−2a + 5a + 4b − 6b − 3c + 4c", "3a − 2b + c"]),
            (3, "x² + 3x + 2x² + (−5x) + 4", ["x² + 2x² + 3x − 5x + 4 | x² und x getrennt", "3x² − 2x + 4"]),
            (3, "(2x + 3y) + (−x + 4z) + (5y + (−z))", ["2x + 3y − x + 4z + 5y − z | Klammern weglassen", "2x − x + 3y + 5y + 4z − z", "x + 8y + 3z"]),
        ],
    },
    {
        "id": "minus", "titel": "Subtrahieren", "zeichen": "−",
        "einleitung": "Auch beim Abziehen gilt: nur gleichartige Glieder zusammenfassen. Das <b>Vorzeichen gehört zum Glied</b> dahinter. Vorsicht bei der <b>Minusklammer</b>!",
        "regeln": [
            ("5a − 2a = 3a", "Zahlen davor abziehen"),
            ("a − a = 0", "nichts bleibt"),
            ("2a − 5a = −3a", "Ergebnis darf negativ sein"),
            ("a − b = a − b", "verschieden – bleibt so"),
            ("3a + b − a = 2a + b", "nur die a zusammen"),
            ("a − (−b) = a + b", "minus minus = plus"),
            ("−a − a = −2a", "zwei Schulden"),
            ("7 − 2a − 3 = 4 − 2a", "Zahlen zu Zahlen"),
        ],
        "klammer": [("a − (b + c) = a − b − c", "Minusklammer: alle Vorzeichen drehen"),
                    ("a − (b − c) = a − b + c", "aus − wird +"), ("−(a + b) = −a − b", "Minus vor der Klammer")],
        "aufgaben": [
            (1, "9x − 4x", ["(9 − 4)x", "5x"]),
            (1, "7a − 7a", ["0"]),
            (1, "8y − 3 − 2y", ["8y − 2y − 3 | sortieren", "6y − 3"]),
            (1, "12x − 5 − 4x − 2", ["12x − 4x − 5 − 2", "8x − 7"]),
            (2, "3a − 8a", ["(3 − 8)a", "−5a"]),
            (2, "6x − 4y − 2x − 7y", ["6x − 2x − 4y − 7y | sortieren", "4x − 11y"]),
            (2, "−5a − 3 − (−2a)", ["−5a − 3 + 2a | minus minus = plus", "−3a − 3"]),
            (2, "4x − (2x + 3)", ["4x − 2x − 3 | Minusklammer: Vorzeichen drehen", "2x − 3"]),
            (3, "7a − (3a − 2b)", ["7a − 3a + 2b | aus − 2b wird + 2b", "4a + 2b"]),
            (3, "5x − 2y − (3x − 4y + z)", ["5x − 2y − 3x + 4y − z | alle Vorzeichen drehen", "2x + 2y − z"]),
            (3, "−(2a − 3b) − (4a + b − c)", ["−2a + 3b − 4a − b + c | beide Klammern auflösen", "−6a + 2b + c"]),
            (3, "6x − (−2x + 5y) − (3y − 4z) − z", ["6x + 2x − 5y − 3y + 4z − z", "8x − 8y + 3z"]),
        ],
    },
    {
        "id": "mal", "titel": "Multiplizieren", "zeichen": "·",
        "einleitung": "Beim Malnehmen darf man <b>alles</b> zusammenfassen: <b>Zahlen mal Zahlen</b>, <b>Variablen mal Variablen</b>. Den Malpunkt zwischen Zahl und Variable lässt man weg.",
        "regeln": [
            ("3 · a = 3a", "Malpunkt fällt weg"),
            ("a · a = a²", "gleiche Variable: hoch 2"),
            ("a · b = ab", "verschiedene: nebeneinander"),
            ("2a · 3b = 6ab", "Zahlen mal Zahlen, Variablen mal Variablen"),
            ("2a · 3a = 6a²", ""),
            ("a² · a = a³", "Hochzahlen addieren"),
            ("(−2) · (−3a) = 6a", "minus mal minus = plus"),
            ("(−2) · 3a = −6a", "minus mal plus = minus"),
        ],
        "klammer": [("a · (b + c) = ab + ac", "jedes Glied in der Klammer mal a"),
                    ("−a · (b − c) = −ab + ac", "Vorzeichen mitnehmen"),
                    ("(a + b) · (c + d) = ac + ad + bc + bd", "jedes mal jedes")],
        "aufgaben": [
            (1, "3 · 4x", ["(3 · 4)x", "12x"]),
            (1, "5a · 2", ["(5 · 2)a", "10a"]),
            (1, "x · x", ["x²"]),
            (1, "2a · 3b", ["(2 · 3) · ab | Zahlen mal Zahlen, Variablen mal Variablen", "6ab"]),
            (2, "−3 · 6y", ["(−3 · 6)y", "−18y"]),
            (2, "(−4x) · (−5y)", ["(−4) · (−5) · xy | minus mal minus = plus", "20xy"]),
            (2, "2x · 3x · y", ["(2 · 3) · x · x · y", "6x²y"]),
            (2, "4 · (x + 3)", ["4 · x + 4 · 3 | jedes Glied mal 4", "4x + 12"]),
            (3, "−2a · (3a − 4b + 1)", ["−2a · 3a − 2a · (−4b) − 2a · 1", "−6a² + 8ab − 2a"]),
            (3, "3x · (2y − z) − x · (y + 4z)", ["6xy − 3xz − xy − 4xz | beide Klammern ausmultiplizieren", "5xy − 7xz"]),
            (3, "(x + 2) · (x − 5)", ["x · x − 5x + 2x − 10 | jedes mal jedes", "x² − 3x − 10"]),
            (3, "(2a − b) · (a + 3c)", ["2a · a + 2a · 3c − b · a − b · 3c | jedes mal jedes", "2a² + 6ac − ab − 3bc"]),
        ],
    },
    {
        "id": "durch", "titel": "Dividieren", "zeichen": ":",
        "einleitung": "Geteilt wird <b>Zahl durch Zahl</b> und <b>Variable durch Variable</b>. Durch 0 darf man nicht teilen – alle Variablen im Teiler sind ≠ 0.",
        "regeln": [
            ("6a : 3 = 2a", "Zahl durch Zahl"),
            ("a : a = 1", "gleiche Variable kürzt sich weg"),
            ("6ab : 2a = 3b", "a kürzt sich, b bleibt"),
            ("a² : a = a", "eine Hochzahl weniger"),
            ("12ab : 4 = 3ab", "nur die Zahl wird geteilt"),
            ("(−8a) : 2 = −4a", "minus durch plus = minus"),
            ("(−8a) : (−2) = 4a", "minus durch minus = plus"),
            ("0 : a = 0", "aber a : 0 geht nicht!"),
        ],
        "klammer": [("(a + b) : c = a : c + b : c", "jedes Glied einzeln teilen"),
                    ("(6a − 9b) : 3 = 2a − 3b", "Vorzeichen bleiben"),
                    ("(8a − 4) : (−4) = −2a + 1", "durch Minus: alle Vorzeichen drehen")],
        "aufgaben": [
            (1, "12x : 4", ["(12 : 4)x", "3x"]),
            (1, "20a : 5", ["(20 : 5)a", "4a"]),
            (1, "8y : y", ["8 · (y : y) | y kürzt sich", "8"]),
            (1, "15ab : 3", ["(15 : 3)ab", "5ab"]),
            (2, "18a : (−3)", ["(18 : (−3))a | plus durch minus = minus", "−6a"]),
            (2, "−24y : (−6)", ["(−24 : (−6))y | minus durch minus = plus", "4y"]),
            (2, "21xy : 7x", ["(21 : 7) · (xy : x) | x kürzt sich", "3y"]),
            (2, "(20x + 15) : 5", ["20x : 5 + 15 : 5 | jedes Glied einzeln", "4x + 3"]),
            (3, "36abc : (−9ac)", ["(36 : (−9)) · (abc : ac) | a und c kürzen sich", "−4b"]),
            (3, "(−18a + 12b − 6c) : (−6)", ["−18a : (−6) + 12b : (−6) − 6c : (−6) | jedes Glied einzeln", "3a − 2b + c"]),
            (3, "24x²y : (−8xy)", ["(24 : (−8)) · (x²y : xy) | x und y kürzen sich je einmal", "−3x"]),
            (3, "(14x² − 21xy + 7x) : 7x", ["14x² : 7x − 21xy : 7x + 7x : 7x | jedes Glied durch 7x", "2x − 3y + 1"]),
        ],
    },
]

# ── alles nachrechnen ─────────────────────────────────────────────────────
# Allgemeine Regeln, die sich mit dem Monom-Teiler nicht ausrechnen lassen (a : c geht nicht glatt auf)
ALLGEMEIN = {"(a + b) : c = a : c + b : c"}
for seite in SEITEN:
    for links, _ in seite["regeln"] + seite["klammer"]:
        if links in ALLGEMEIN:
            continue
        l, r = links.split(" = ")
        assert gleich(l, r) or l.strip() == r.strip(), f"Regel stimmt nicht: {links}"
    for st, term, schritte in seite["aufgaben"]:
        soll = parse(term)
        for s in schritte:
            z = s.split(" | ")[0]
            assert norm(parse(z)) == norm(soll), f"{seite['titel']}: {term} ≠ {z}"
        # Ergebnis muss ganz zusammengefasst sein: so viele Glieder wie der ausgerechnete Term
        ende = schritte[-1].split(" | ")[0]
        glieder = len(re.split(r" [+−] ", ende.lstrip("−"))) if ende != "0" else 0
        assert glieder == len(soll), f"nicht fertig zusammengefasst: {term} → {ende} (richtig wäre {text(soll)})"


# ── HTML ──────────────────────────────────────────────────────────────────
abc = "abcdefghijklmnop"
STERNE = {1: "★", 2: "★★", 3: "★★★"}
STUFE_TEXT = {1: "eine Variable, natürliche Zahlen", 2: "zwei Variablen, auch negative Zahlen", 3: "drei Variablen, mit Klammern"}


def regelkasten(seite):
    c = FARBE[seite["id"]]
    regeln = "".join(f"<div class='regel'><span class='m'>{l}</span><span class='hinweis'>{h}</span></div>" for l, h in seite["regeln"])
    klammer = "".join(f"<div class='regel breit'><span class='m'>{l}</span><span class='hinweis'>{h}</span></div>" for l, h in seite["klammer"])
    titel_k = "Klammerregeln" if seite["id"] in ("mal", "durch") else ("Minusklammer" if seite["id"] == "minus" else "Plusklammer")
    return f"""<div class="kasten-regel" style="border-left-color:{c}">
<p class="einl">{seite['einleitung']}</p>
<div class="regeln">{regeln}</div>
<div class="ktitel" style="color:{c}">{titel_k}</div>
<div class="regeln k">{klammer}</div></div>"""


def aufgabenseite(seite, n):
    c = FARBE[seite["id"]]
    teile = []
    for st in (1, 2, 3):
        items = [(i, t) for i, (s, t, _) in enumerate(seite["aufgaben"]) if s == st]
        felder = "".join(f"<div class='aufg'><span class='nr'>{abc[i]})</span><span class='m'>{t}</span> =<span class='linie'></span></div>" for i, t in items)
        teile.append(f"<div class='stufe'><div class='st'><span style='color:{c}'>{STERNE[st]}</span> <span class='stt'>{STUFE_TEXT[st]}</span></div><div class='raster'>{felder}</div></div>")
    return f"""<section class="page">
<header><div><div class="kicker" style="color:{c}">Rechnen mit Variablen · Teil {n} von 4</div>
<h1><span class="zeichen{' punkt' if seite['zeichen'] == '·' else ''}" style="background:{c}">{seite['zeichen']}</span> {seite['titel']}</h1></div>
<div class="kopf">Name: ____________________ &nbsp; Klasse: ______ &nbsp; Datum: __________</div></header>
{regelkasten(seite)}
<h2>Aufgaben <span class="be">Fasse so weit wie möglich zusammen.</span></h2>
{''.join(teile)}
<footer>TT – Teaching Tools · Rechnen mit Variablen · {seite['titel']} · Lösungen ab Seite 5</footer>
</section>"""


def loesungsblock(seite):
    c = FARBE[seite["id"]]
    karten = []
    for i, (st, term, schritte) in enumerate(seite["aufgaben"]):
        zeilen = []
        for k, s in enumerate(schritte):
            z, *h = s.split(" | ")
            letzte = k == len(schritte) - 1
            zz = f"<b>{z}</b>" if letzte else z
            zeilen.append(f"= {zz}" + (f"<span class='g'> | {h[0]}</span>" if h else ""))
        karten.append(f"<div class='weg'><span class='nr' style='color:{c}'>{abc[i]})</span><span class='m'>{term}</span><br>" + "<br>".join(zeilen) + "</div>")
    return f"<h2 style='color:{c}'>{seite['zeichen']}&nbsp; {seite['titel']}</h2><div class='raster3'>{''.join(karten)}</div>"


seiten_html = [aufgabenseite(s, n + 1) for n, s in enumerate(SEITEN)]
for paar in (SEITEN[:2], SEITEN[2:]):
    seiten_html.append(f"""<section class="page loesung">
<header><div><div class="kicker">Lösungen mit Rechenweg</div><h1>Rechnen mit Variablen</h1></div></header>
{''.join(loesungsblock(s) for s in paar)}
<footer>TT – Teaching Tools · Rechnen mit Variablen · Lösungen</footer>
</section>""")

CSS = f"""
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; background: #fff; color: {TXT}; font-family: system-ui, "Segoe UI", sans-serif; font-size: 11.5px; line-height: 1.35;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.page {{ width: 210mm; height: 297mm; padding: 11mm 13mm 8mm; display: flex; flex-direction: column; break-after: page; overflow: hidden; }}
header {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; border-bottom: 3px solid {ACC}; padding-bottom: 5px; margin-bottom: 8px; }}
.kicker {{ font-size: 9px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; color: {ACC}; }}
h1 {{ font-size: 22px; font-weight: 900; margin: 2px 0 0; letter-spacing: -.02em; display: flex; align-items: center; gap: 8px; }}
.zeichen {{ display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: #fff; font-size: 22px; line-height: 1; }}
.zeichen.punkt {{ font-size: 40px; font-weight: 900; }}
.kopf {{ font-size: 10px; color: {MUT}; white-space: nowrap; }}
h2 {{ font-size: 13.5px; font-weight: 900; margin: 10px 0 4px; }}
h2 .be {{ font-weight: 400; font-size: 10.5px; color: {MUT}; margin-left: 6px; }}
.m {{ font-family: "Cambria Math", Cambria, "Times New Roman", serif; font-size: 14.5px; white-space: nowrap; }}
.kasten-regel {{ background: #faf8f4; border: 1px solid {LINE}; border-left: 6px solid; border-radius: 10px; padding: 7px 11px 8px; }}
.einl {{ margin: 0 0 6px; }}
.regeln {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px 16px; }}
.regeln.k {{ grid-template-columns: 1fr; }}
.regel {{ display: flex; align-items: baseline; gap: 8px; border-bottom: 1px dotted #ddd; padding: 1px 0; }}
.regel .m {{ min-width: 150px; font-size: 15px; }}
.regel.breit .m {{ min-width: 260px; }}
.hinweis {{ font-size: 9.8px; color: {MUT}; }}
.ktitel {{ font-weight: 900; font-size: 11px; margin: 7px 0 2px; }}
.stufe {{ margin-top: 7px; }}
.st {{ font-size: 13px; font-weight: 900; margin-bottom: 2px; }}
.stt {{ font-size: 9.5px; font-weight: 400; color: {MUT}; }}
.raster {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; }}
.aufg {{ display: flex; align-items: flex-end; gap: 5px; height: 21mm; border-bottom: 1px solid #e3e3e3; padding-bottom: 3px; }}
.nr {{ font-weight: 800; color: {ACC}; }}
.linie {{ flex: 1; min-width: 40px; }}
footer {{ margin-top: auto; font-size: 8px; color: {MUT}; border-top: 1px solid {LINE}; padding-top: 3px; }}
.raster3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px 8px; }}
.loesung .weg {{ background: #faf8f4; border: 1px solid #ece6da; border-radius: 8px; padding: 4px 7px; font-family: "Cambria Math", Cambria, serif; font-size: 12px; line-height: 1.5; }}
.loesung .weg .m {{ font-size: 12.5px; }}
.loesung .weg .nr {{ font-family: system-ui, sans-serif; margin-right: 5px; }}
.g {{ font-family: system-ui, sans-serif; font-size: 8.3px; color: {MUT}; }}
.loesung h2 {{ font-size: 15px; margin: 6px 0 4px; }}
"""

html = f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Rechnen mit Variablen</title><style>{CSS}</style></head><body>
{''.join(seiten_html)}
<script>const bad=[...document.querySelectorAll('.page')].map((p,i)=>[i+1,p.scrollHeight-p.clientHeight]).filter(x=>x[1]>0);
document.body.setAttribute('data-overflow', JSON.stringify(bad));</script></body></html>"""
OUT.write_text(html, encoding="utf-8")
print("ok", OUT, f"{sum(len(s['aufgaben']) for s in SEITEN)} Aufgaben geprüft")
