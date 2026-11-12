# -*- coding: utf-8 -*-
"""Arbeitsblatt »Scheitelpunktform und Ausmultiplizieren« (Klasse 9).

Seite 1: Aufgaben, ab Seite 2: Lösungen mit Rechenweg.
Schreibweise wie im Tafelwerk: y = a(x + d)² + e  ⟹  S(−d | e).

    python ab_scheitelpunktform.py
    chrome --headless=new --allow-file-access-from-files --no-pdf-header-footer \
      --print-to-pdf=Arbeitsblatt_Scheitelpunktform.pdf ab_scheitelpunktform.html
"""
import pathlib
from fractions import Fraction as Fr

OUT = pathlib.Path(__file__).with_name("ab_scheitelpunktform.html")
X, A, D, E, Y = "#8b5cf6", "#db2777", "#0891b2", "#16a34a", "#2563eb"
ACC, TXT, MUT, LINE = "#e07820", "#1a3060", "#5a6880", "#ccc0a0"


def col(c, t):
    return f'<b style="color:{c}">{t}</b>'


# ── kleine Rechnung, damit die Lösungen garantiert stimmen ────────────────
def zahl(v):
    v = Fr(v).limit_denominator(1000)
    s = str(float(v)).rstrip("0").rstrip(".") if v.denominator != 1 else str(v.numerator)
    return s.replace("-", "−").replace(".", ",")


def nf_text(a, b, c):
    """ax² + bx + c als Text, Faktor 1 und Summand 0 fallen weg."""
    teile, erstes = [], True
    for v, x in ((a, "x²"), (b, "x"), (c, "")):
        v = Fr(v)
        if v == 0:
            continue
        betrag = "" if abs(v) == 1 and x else zahl(abs(v))
        vz = ("−" if v < 0 else "") if erstes else (" − " if v < 0 else " + ")
        teile.append(vz + betrag + x)
        erstes = False
    return "".join(teile) or "0"


def spf_zu_nf(a, d, e):
    a, d, e = Fr(a), Fr(d), Fr(e)
    return a, 2 * a * d, a * d * d + e


def kl(d):
    """(x + 3) bzw. (x − 3)"""
    d = Fr(d)
    return f"(x {'−' if d < 0 else '+'} {zahl(abs(d))})"


def spf_text(a, d, e):
    a, d, e = Fr(a), Fr(d), Fr(e)
    f = "" if a == 1 else "−" if a == -1 else zahl(a)
    kern = "x²" if d == 0 else f"{kl(d)}²"
    if d == 0 and f not in ("", "−"):
        kern = "x²"
    rest = "" if e == 0 else f" {'−' if e < 0 else '+'} {zahl(abs(e))}"
    return f"y = {f}{kern}{rest}"


def binom(d):
    """(x + d)² = x² + 2dx + d²"""
    d = Fr(d)
    return nf_text(1, 2 * d, d * d)


def ausmultiplizieren(a, d, e):
    """Rechenweg SPF → NF als Zeilen."""
    a, d, e = Fr(a), Fr(d), Fr(e)
    z = [spf_text(a, d, e)]
    f = "" if a == 1 else "−" if a == -1 else zahl(a) + " · "
    rest = "" if e == 0 else f" {'−' if e < 0 else '+'} {zahl(abs(e))}"
    if d != 0:
        z.append(f"y = {f}({binom(d)}){rest}" + f"&emsp;<span class='g'>| {'1.' if d > 0 else '2.'} binomische Formel</span>")
        if a != 1:
            z.append(f"y = {nf_text(a, 2 * a * d, a * d * d)}{rest}&emsp;<span class='g'>| mit {zahl(a) if a > 0 else '(' + zahl(a) + ')'} ausmultiplizieren</span>")
    na, nb, nc = spf_zu_nf(a, d, e)
    z.append(f"<b>y = {nf_text(na, nb, nc)}</b>&emsp;<span class='g'>| zusammenfassen</span>")
    return z


def S(d, e):
    return f"S({zahl(-Fr(d))} | {zahl(e)})"


def form(a):
    a = Fr(a)
    o = "oben" if a > 0 else "unten"
    f = "gestreckt" if abs(a) > 1 else "gestaucht" if abs(a) < 1 else "normal"
    return o, f


# ── Aufgaben ──────────────────────────────────────────────────────────────
A1 = [(1, 2, 1), (1, -3, -4), (1, 5, 0), (1, 0, -6), (-1, -1, 3), (2, 4, -5), (Fr(1, 2), -2, 1), (-3, 1, -2)]
A2 = [(4, 4), (-5, -5), (6, -6), (7, 7), (-Fr(3, 2), -Fr(3, 2)), (10, -10)]
A3 = [(1, 3, -2), (1, -2, 5), (2, 1, -4), (-1, -3, 1), (Fr(1, 2), 2, -3), (-2, -1, 6)]
A4 = [((2, -1), 1), ((-3, 4), -1), ((1, 2), 2), ((-2, 0), Fr(1, 2))]   # (S, a)

# Gegenproben: SPF und NF müssen an mehreren Stellen gleich sein
for a, d, e in A1 + A3:
    na, nb, nc = spf_zu_nf(a, d, e)
    for x in (-3, 0, 2, Fr(5, 2)):
        assert na * x * x + nb * x + nc == Fr(a) * (x + Fr(d)) ** 2 + Fr(e)
for p, q in A2:
    for x in (-2, 0, 3):
        assert (x + Fr(p)) * (x + Fr(q)) == x * x + (Fr(p) + Fr(q)) * x + Fr(p) * Fr(q)


def produkt_text(p, q):
    p, q = Fr(p), Fr(q)
    if p == q:
        return f"{kl(p)}²"
    return f"{kl(p)}{kl(q)}"


def bogen_weg(p, q):
    p, q = Fr(p), Fr(q)
    k = lambda v: zahl(v) if v >= 0 else f"({zahl(v)})"
    vz = lambda v: f"{'−' if v < 0 else '+'} {zahl(abs(v))}"
    return [
        f"{produkt_text(p, q)} = {kl(p)} · {kl(q)}",
        f"= {col(X, 'x²')} {col(D, vz(q) + 'x')} {col(D, vz(p) + 'x')} {col(A, vz(p * q))}"
        f"&emsp;<span class='g'>| ① x·x &nbsp;② x·{k(q)} &nbsp;③ {k(p)}·x &nbsp;④ {k(p)}·{k(q)}</span>",
        f"<b>= {nf_text(1, p + q, p * q)}</b>" + ("&emsp;<span class='g'>| 3. binomische Formel: Mitte fällt weg</span>" if p == -q else
                                                  f"&emsp;<span class='g'>| {'1.' if p > 0 else '2.'} binomische Formel</span>"),
    ]


# ── kleines Bogenbild für den Merkkasten ──────────────────────────────────
def boegen_svg():
    W, H, ym = 250, 150, 75
    xs = [40, 90, 158, 208]
    t = ["x", "+d", "x", "+d"]
    o = [f'<svg viewBox="0 0 {W} {H}" width="{W * 0.82:.0f}" height="{H * 0.82:.0f}" xmlns="http://www.w3.org/2000/svg">']
    for x, ch in [(18, "("), (112, ")"), (124, "·"), (136, "("), (230, ")")]:
        o.append(f'<text x="{x}" y="{ym}" text-anchor="middle" dominant-baseline="central" font-size="24" fill="{MUT}" font-family="Cambria Math, serif">{ch}</text>')
    for x, tt in zip(xs, t):
        o.append(f'<text x="{x}" y="{ym}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" fill="{X if tt == "x" else D}" font-family="Cambria Math, serif">{tt}</text>')
    for (i, j, oben, h, c, n) in [(0, 2, 1, 24, X, "①"), (0, 3, 1, 96, D, "②"), (1, 2, 0, 24, D, "③"), (1, 3, 0, 96, A, "④")]:
        y = ym - 14 if oben else ym + 14
        x1, x2 = xs[i], xs[j]
        cy = y - h if oben else y + h
        mx = (x1 + x2) / 2
        ux, uy = x2 - mx, y - cy
        l = (ux * ux + uy * uy) ** 0.5
        ax, ay = ux / l, uy / l
        o.append(f'<path d="M {x1} {y} Q {mx} {cy} {x2} {y}" fill="none" stroke="{c}" stroke-width="2.2"/>')
        o.append(f'<polygon points="{x2},{y} {x2 - ax * 8 - ay * 4.5},{y - ay * 8 + ax * 4.5} {x2 - ax * 8 + ay * 4.5},{y - ay * 8 - ax * 4.5}" fill="{c}"/>')
        o.append(f'<text x="{mx}" y="{(y + cy) / 2 + 1}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="{c}" paint-order="stroke" stroke="#fff" stroke-width="4">{n}</text>')
    o.append("</svg>")
    return "".join(o)


# ── Seite 1: Aufgaben ─────────────────────────────────────────────────────
abc = "abcdefgh"
t1 = "".join(f"<tr><td class='nr'>{abc[i]})</td><td class='m'>{spf_text(a, d, e)}</td><td class='feld'>S( &emsp;&emsp; | &emsp;&emsp; )</td><td class='feld'>oben / unten</td><td class='feld'>gestreckt / normal / gestaucht</td></tr>"
             for i, (a, d, e) in enumerate(A1))
t2 = "".join(f"<div class='aufg'><span class='nr'>{abc[i]})</span> <span class='m'>{produkt_text(p, q)}</span> = <span class='linie'></span></div>" for i, (p, q) in enumerate(A2))
t3 = "".join(f"<div class='aufg breit'><span class='nr'>{abc[i]})</span> <span class='m'>{spf_text(a, d, e)}</span><div class='kasten'></div></div>" for i, (a, d, e) in enumerate(A3))
t4 = "".join(f"<div class='aufg'><span class='nr'>{abc[i]})</span> S({zahl(s[0])} | {zahl(s[1])}), &nbsp;a = {zahl(a)}<div class='kasten klein'></div></div>" for i, (s, a) in enumerate(A4))

seite1 = f"""<section class="page">
<header><div><div class="kicker">Mathe Kl. 9 · Quadratische Funktionen · Arbeitsblatt</div>
<h1>Scheitelpunktform und Ausmultiplizieren</h1></div>
<div class="kopf">Name: ____________________ &nbsp; Klasse: ______ &nbsp; Datum: __________</div></header>

<div class="merk">
<div class="merktext">
<div class="formel">y = {col(A,'a')}(x + {col(D,'d')})² + {col(E,'e')} &nbsp;⟹&nbsp; S(−{col(D,'d')} | {col(E,'e')})</div>
<p>{col(D,'d')}: x-Koordinate von S ist das <b>Gegenteil</b> von d. &nbsp;{col(E,'e')}: y-Koordinate wie sie ist. &nbsp;{col(A,'a')}: Vorzeichen → Öffnung, Betrag &gt; 1 gestreckt, &lt; 1 gestaucht.</p>
<p><b>Ausmultiplizieren:</b> 1. Klammer quadrieren (vier Bögen) &nbsp;2. mit {col(A,'a')} malnehmen – jedes Glied &nbsp;3. mit {col(E,'e')} zusammenfassen.</p>
</div>
<div class="merkbild">{boegen_svg()}<div class="bildtext">① vorne·vorne ② vorne·hinten<br>③ hinten·vorne ④ hinten·hinten</div></div>
</div>

<h2>1&nbsp; Scheitelpunkt, Öffnung und Form ablesen <span class="be">Kreise ein bzw. trage ein.</span></h2>
<table class="t1">{t1}</table>

<h2>2&nbsp; Klammern quadrieren <span class="be">mit den vier Bögen</span></h2>
<div class="raster3">{t2}</div>

<h2>3&nbsp; Forme in die Normalform y = ax² + bx + c um</h2>
<div class="raster3">{t3}</div>

<h2>4&nbsp; Stelle die Gleichung in Scheitelpunktform auf und forme in die Normalform um</h2>
<div class="raster4">{t4}</div>

<h2>5&nbsp; Fehler gesucht! <span class="be">Was ist falsch? Rechne richtig.</span></h2>
<div class="raster2">
<div class="aufg"><span class="nr">a)</span> Tim: &nbsp;<span class="m">y = (x − 4)² + 1 = x² + 16 + 1 = x² + 17</span><div class="kasten klein"></div></div>
<div class="aufg"><span class="nr">b)</span> Lena: &nbsp;»<span class="m">y = (x + 2)² − 3</span> hat den Scheitelpunkt S(2 | −3).«<div class="kasten klein"></div></div>
</div>
<footer>TT – Teaching Tools · Arbeitsblatt Scheitelpunktform · Lösungen auf der Rückseite</footer>
</section>"""

# ── Lösungen ──────────────────────────────────────────────────────────────
l1 = "".join(f"<tr><td class='nr'>{abc[i]})</td><td class='m'>{spf_text(a, d, e)}</td><td>d = {zahl(d)}, e = {zahl(e)}</td><td><b>{S(d, e)}</b></td><td>nach {form(a)[0]}, {form(a)[1]}</td></tr>"
             for i, (a, d, e) in enumerate(A1))
l2 = "".join(f"<div class='weg'><span class='nr'>{abc[i]})</span>{'<br>'.join(bogen_weg(p, q))}</div>" for i, (p, q) in enumerate(A2))
l3 = "".join(f"<div class='weg'><span class='nr'>{abc[i]})</span>{'<br>'.join(ausmultiplizieren(a, d, e))}</div>" for i, (a, d, e) in enumerate(A3))
l4 = []
for i, ((sx, sy), a) in enumerate(A4):
    d, e = -Fr(sx), Fr(sy)
    z = [f"S({zahl(sx)} | {zahl(sy)}) ⟹ d = {zahl(d)}, e = {zahl(e)}"] + ausmultiplizieren(a, d, e)
    l4.append(f"<div class='weg'><span class='nr'>{abc[i]})</span>{'<br>'.join(z)}</div>")
l4 = "".join(l4)

seite2 = f"""<section class="page loesung">
<header><div><div class="kicker">Lösungen mit Rechenweg</div><h1>Scheitelpunktform und Ausmultiplizieren</h1></div></header>
<h2>1&nbsp; Ablesen: S(−d | e)</h2>
<table class="t1 lt">{l1}</table>
<h2>2&nbsp; Klammern quadrieren</h2>
<div class="raster2">{l2}</div>
<h2>3&nbsp; Scheitelpunktform → Normalform</h2>
<div class="raster2">{l3}</div>
<footer>TT – Teaching Tools · Lösungen Seite 1</footer>
</section>
<section class="page loesung">
<header><div><div class="kicker">Lösungen mit Rechenweg</div><h1>Scheitelpunktform und Ausmultiplizieren</h1></div></header>
<h2>4&nbsp; Gleichung aus S und a</h2>
<div class="raster2">{l4}</div>
<h2>5&nbsp; Fehler gesucht</h2>
<div class="raster2">
<div class="weg"><span class="nr">a)</span>Tim hat (x − 4)² wie x² + 4² gerechnet – die Bögen ② und ③ fehlen, also das mittlere Glied −8x.<br>
y = (x − 4)² + 1 = (x² − 8x + 16) + 1<br><b>y = x² − 8x + 17</b></div>
<div class="weg"><span class="nr">b)</span>Lena hat das Vorzeichen von d übernommen. Die x-Koordinate ist das Gegenteil von d:<br>
d = 2 ⟹ x<sub>S</sub> = −2<br><b>S(−2 | −3)</b> &nbsp;(Probe: (−2 + 2)² − 3 = −3 ✓)</div>
</div>
<div class="tipp"><b>Kontrolle für Aufgabe 3 und 4:</b> Setze x = 0 in beide Formen ein – es muss dasselbe herauskommen (das ist c). Beispiel 3a: (0 + 3)² − 2 = 7 = c ✓</div>
<footer>TT – Teaching Tools · Lösungen Seite 2</footer>
</section>"""

CSS = f"""
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; background: #fff; color: {TXT}; font-family: system-ui, "Segoe UI", sans-serif; font-size: 11px; line-height: 1.35;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.page {{ width: 210mm; height: 297mm; padding: 10mm 12mm 8mm; display: flex; flex-direction: column; break-after: page; overflow: hidden; position: relative; }}
header {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; border-bottom: 3px solid {ACC}; padding-bottom: 4px; margin-bottom: 7px; }}
.kicker {{ font-size: 8.5px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; color: {ACC}; }}
h1 {{ font-size: 19px; font-weight: 900; margin: 0; letter-spacing: -.02em; }}
.kopf {{ font-size: 10px; color: {MUT}; white-space: nowrap; }}
h2 {{ font-size: 12.5px; font-weight: 900; margin: 9px 0 4px; }}
h2 .be {{ font-weight: 400; font-size: 10px; color: {MUT}; margin-left: 6px; }}
.m {{ font-family: "Cambria Math", Cambria, "Times New Roman", serif; font-size: 13px; white-space: nowrap; }}
.merk {{ display: flex; gap: 10px; align-items: center; background: #f6faee; border: 1px solid {LINE}; border-left: 5px solid #6a921a; border-radius: 10px; padding: 6px 10px; }}
.merk p {{ margin: 3px 0; }}
.merktext {{ flex: 1; }}
.formel {{ font-family: "Cambria Math", Cambria, serif; font-size: 18px; font-weight: 700; }}
.merkbild {{ text-align: center; }}
.bildtext {{ font-size: 8.5px; color: {MUT}; margin-top: -4px; }}
.t1 {{ width: 100%; border-collapse: collapse; }}
.t1 td {{ border-bottom: 1px solid #ece6da; padding: 3.5px 5px; }}
.t1 .feld {{ color: {MUT}; font-size: 10px; }}
.nr {{ font-weight: 800; color: {ACC}; margin-right: 4px; }}
.raster3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 12px; }}
.raster4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 10px; }}
.raster2 {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px 14px; }}
.aufg {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px; }}
.linie {{ flex: 1; min-width: 70px; border-bottom: 1px solid #888; height: 14px; }}
.kasten {{ width: 100%; height: 74px; margin-top: 3px; border-radius: 6px;
  background-image: linear-gradient(#d9d9d9 1px, transparent 1px), linear-gradient(90deg, #d9d9d9 1px, transparent 1px);
  background-size: 5mm 5mm; border: 1px solid #cfcfcf; }}
.kasten.klein {{ height: 64px; }}
footer {{ margin-top: auto; font-size: 8px; color: {MUT}; border-top: 1px solid {LINE}; padding-top: 3px; }}
.loesung .weg {{ background: #faf8f4; border: 1px solid #ece6da; border-radius: 8px; padding: 5px 8px; font-family: "Cambria Math", Cambria, serif; font-size: 12.5px; line-height: 1.55; }}
.loesung .weg .nr {{ font-family: system-ui, sans-serif; }}
.g {{ font-family: system-ui, sans-serif; font-size: 9px; color: {MUT}; }}
.lt td {{ font-size: 11px; }}
.tipp {{ margin-top: 10px; background: #f6f3ff; border-left: 5px solid {X}; border-radius: 8px; padding: 6px 10px; }}
"""

html = f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Arbeitsblatt Scheitelpunktform</title><style>{CSS}</style></head><body>
{seite1}{seite2}
<script>const bad=[...document.querySelectorAll('.page')].map((p,i)=>[i+1,p.scrollHeight-p.clientHeight]).filter(x=>x[1]>0);
document.body.setAttribute('data-overflow', JSON.stringify(bad));</script></body></html>"""
OUT.write_text(html, encoding="utf-8")
print("ok", OUT)
