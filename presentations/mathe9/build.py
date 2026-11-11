# -*- coding: utf-8 -*-
"""Baut mathe9.html (Zusammenfassung Mathe Kl. 9 »Grundlagen-Fit«).

    python build.py
    chrome --headless=new --allow-file-access-from-files --virtual-time-budget=4000       --no-pdf-header-footer --print-to-pdf=Mathe_Kl9_Grundlagen-Fit.pdf mathe9.html

Braucht qrcode (pip) und frontend/node_modules (KaTeX). cap_* sind
Wertetabellen und Terme, aus dem Funktionen-Tool übernommen (JSON: svg, table, tex).
"""
import io, math, pathlib, qrcode, qrcode.image.svg

OUT = pathlib.Path(__file__).with_name("mathe9.html")
FRONTEND = pathlib.Path(__file__).resolve().parents[2] / "frontend"
KATEX = (FRONTEND / "node_modules" / "katex" / "dist").as_uri()
LOGO = (FRONTEND / "public" / "EGE_logo.png").as_uri()

# Farbcode (wie im Funktionen-Tool: x violett, Graph im Akzent)
X, Y, A, C, B = "#8b5cf6", "#2563eb", "#db2777", "#16a34a", "#0891b2"
ACC, MARK, TXT, MUT, LINE = "#e07820", "#f59e0b", "#1a3060", "#5a6880", "#ccc0a0"

# ── Videos (alle per YouTube-oEmbed geprüft, Kanal Lehrerschmidt) ─────────
def qr_svg(url):
    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1)
    buf = io.BytesIO(); img.save(buf)
    s = buf.getvalue().decode()
    return s[s.find("<svg"):]

def video(vid, title, dauer_hint=""):
    url = f"https://www.youtube.com/watch?v={vid}"
    return f"""<a class="video" href="{url}">
  <div class="qr">{qr_svg(url)}</div>
  <div><div class="vlabel">▶ Video · Lehrerschmidt</div>
  <div class="vtitle">{title}</div><div class="vurl">youtu.be/{vid}{dauer_hint}</div></div></a>"""

# ── Graph im Stil des Funktionen-Tools ───────────────────────────────────
def graph(funcs=(), xr=(-5, 5), yr=(-5, 5), w=300, h=300, points=(), extra=None, grid=1, labels_every=1, axis_names=("x", "y")):
    M = 22
    x0, x1 = xr; y0, y1 = yr
    sx = lambda x: M + (x - x0) / (x1 - x0) * (w - 2 * M)
    sy = lambda y: h - M - (y - y0) / (y1 - y0) * (h - 2 * M)
    o = [f'<svg class="graph" viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg">']
    cid = f"c{id(funcs)}{w}{h}{len(points)}"
    o.append(f'<defs><clipPath id="{cid}"><rect x="{M}" y="{M}" width="{w-2*M}" height="{h-2*M}"/></clipPath>'
             f'<marker id="ar{cid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{TXT}"/></marker></defs>')
    g = []
    t = math.ceil(x0 / grid) * grid
    while t <= x1 + 1e-9:
        g.append(f'<line x1="{sx(t):.1f}" y1="{M}" x2="{sx(t):.1f}" y2="{h-M}"/>'); t += grid
    t = math.ceil(y0 / grid) * grid
    while t <= y1 + 1e-9:
        g.append(f'<line x1="{M}" y1="{sy(t):.1f}" x2="{w-M}" y2="{sy(t):.1f}"/>'); t += grid
    o.append(f'<g stroke="{LINE}" stroke-width="1" opacity="0.7">{"".join(g)}</g>')
    o.append(f'<g stroke="{TXT}" stroke-width="1.6"><line x1="{M-6}" y1="{sy(0):.1f}" x2="{w-M+8}" y2="{sy(0):.1f}" marker-end="url(#ar{cid})"/>'
             f'<line x1="{sx(0):.1f}" y1="{h-M+6}" x2="{sx(0):.1f}" y2="{M-8}" marker-end="url(#ar{cid})"/></g>')
    lab = [f'<g fill="{MUT}" font-size="9.5" style="font-variant-numeric:tabular-nums">']
    t = math.ceil(x0)
    while t <= x1:
        if t != 0 and t % labels_every == 0 and t < x1:
            lab.append(f'<text x="{sx(t):.1f}" y="{sy(0)+12:.1f}" text-anchor="middle">{fmt(t)}</text>')
        t += 1
    t = math.ceil(y0)
    while t <= y1:
        if t != 0 and t % labels_every == 0 and t < y1:
            lab.append(f'<text x="{sx(0)-4:.1f}" y="{sy(t)+3.5:.1f}" text-anchor="end">{fmt(t)}</text>')
        t += 1
    lab.append(f'<text x="{sx(0)-4:.1f}" y="{sy(0)+12:.1f}" text-anchor="end">0</text>')
    lab.append(f'<text x="{w-M+4:.1f}" y="{sy(0)-6:.1f}" font-weight="800" font-size="13" fill="{X}">{axis_names[0]}</text>')
    lab.append(f'<text x="{sx(0)+7:.1f}" y="{M-4:.1f}" font-weight="800" font-size="13" fill="{Y}">{axis_names[1]}</text></g>')
    o.append("".join(lab))
    for f in funcs:
        fn, col = f["f"], f.get("color", ACC)
        pts, d = [], ""
        n = 400
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            y = fn(x)
            if y0 - 3 <= y <= y1 + 3:
                d += ("L" if pts else "M") + f"{sx(x):.1f},{sy(y):.1f}"; pts.append(1)
            else:
                pts = []
        dash = ' stroke-dasharray="5 4"' if f.get("dash") else ""
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{f.get("width", 2.6)}" stroke-linecap="round" clip-path="url(#{cid})"{dash}/>')
        if "label" in f:
            lx, ly = f["label_at"]
            o.append(f'<text x="{sx(lx):.1f}" y="{sy(ly):.1f}" fill="{col}" font-size="11.5" font-weight="800" '
                     f'paint-order="stroke" stroke="#fff" stroke-width="3.5" text-anchor="{f.get("anchor","start")}">{f["label"]}</text>')
    for p in points:
        x, y = p["x"], p["y"]; col = p.get("color", ACC)
        if p.get("cross"):
            o.append(f'<g stroke="{MARK}" stroke-width="1.3" stroke-dasharray="4 3"><line x1="{sx(x):.1f}" y1="{sy(y):.1f}" x2="{sx(x):.1f}" y2="{sy(0):.1f}"/>'
                     f'<line x1="{sx(x):.1f}" y1="{sy(y):.1f}" x2="{sx(0):.1f}" y2="{sy(y):.1f}"/></g>')
        o.append(f'<circle cx="{sx(x):.1f}" cy="{sy(y):.1f}" r="{p.get("r",4)}" fill="{col}" stroke="#fff" stroke-width="1.5"/>')
        if "label" in p:
            dx, dy = p.get("off", (7, -7))
            o.append(f'<text x="{sx(x)+dx:.1f}" y="{sy(y)+dy:.1f}" font-size="11" font-weight="800" fill="{p.get("lcolor", TXT)}" '
                     f'paint-order="stroke" stroke="#fff" stroke-width="3.5" text-anchor="{p.get("anchor","start")}">{p["label"]}</text>')
    if extra:
        o.append(extra(sx, sy))
    o.append("</svg>")
    return "".join(o)

def fmt(v):
    return (f"{v:g}").replace("-", "−").replace(".", ",")

# ── Bausteine ────────────────────────────────────────────────────────────
def box(kind, title, body):
    return f'<div class="box {kind}"><div class="boxt">{title}</div>{body}</div>'

def steps(*items):
    return '<ol class="steps">' + "".join(f"<li>{i}</li>" for i in items) + "</ol>"

def key(*ks):
    return "".join(f'<span class="key">{k}</span>' for k in ks)

pages = []
import json, re
def tool(name, hint):
    d = json.loads(pathlib.Path(__file__).with_name("cap_" + name).read_text(encoding="utf8"))
    rows = [r for r in re.findall(r"<tr.*?</tr>", d["table"], re.S) if "button" not in r and "Rechnung" not in r]
    svg = re.sub(r"(<svg[^>]*?) class=\"[^\"]*\"", lambda m: m.group(1), d["svg"], count=1)
    svg = re.sub(r"(<svg[^>]*?) style=\"[^\"]*\"", lambda m: m.group(1) + " class=\"toolsvg\"", svg, count=1)
    return f"""<div class="card toolpanel"><div class="tphead"><span class="boxt" style="color:#6d3fd6">📈 Wertetabelle aus dem Funktionen-Tool</span>
<span class="tpterm">{d["tex"]}</span></div>
<div class="tpgrid"><div><table class="tptab">{"".join(rows)}</table><p class="small mut" style="margin:5px 0 0">{hint}</p></div></div></div>"""
def page(nr, emoji, title, sub, body):
    pages.append(f"""<section class="page">
<header><div class="hl"><span class="em">{emoji}</span><div><div class="kicker">Mathe Kl. 9 · Grundlagen-Fit · {nr}</div>
<h1>{title}</h1><p class="sub">{sub}</p></div></div></header>
<div class="content">{body}</div>
<footer><span>TT – Teaching Tools · Mathe-Zusammenfassung Klasse 9</span><span>Seite {len(pages)+1}</span></footer></section>""")

xs, ys, as_, cs = (f'<b style="color:{X}">x</b>', f'<b style="color:{Y}">y</b>', f'<b style="color:{A}">a</b>', f'<b style="color:{C}">c</b>')
def col(c, t): return f'<b style="color:{c}">{t}</b>'

# ── Seite 1: Titel ───────────────────────────────────────────────────────
pages.append(f"""<section class="page title">
<div class="tophead"><img src="{LOGO}" alt="" class="logo"><span>TT – Teaching Tools · Mathematik</span></div>
<div class="hero"><div class="kicker">Zusammenfassung · Klasse 9</div>
<h1 class="big">Mathe&#8209;Grundlagen<br><span style="color:{ACC}">von null auf Parabel</span></h1>
<p class="lead">Du hast seit Klasse 5 viel vergessen? Kein Problem. Dieses Heft fängt ganz vorne an:
Zeichen lesen, Koordinatensystem, Quadratzahlen und Wurzeln, Wertetabellen und Funktionen
bis zur Parabel, Scheitelpunktform, p&#8209;q&#8209;Formel und Schnittpunkten. Jede Seite hat ein <b>So&nbsp;geht's</b>, ein Beispiel und ein Video.</p></div>
<div class="grid2">
<div class="card"><div class="boxt">📚 Inhalt</div>
<ol class="toc">
<li>Wie lerne ich mit Buch und Hefter?</li><li>Rechenzeichen und Symbole</li><li>Das Koordinatensystem</li>
<li>Quadratzahlen und Wurzeln</li><li>Wertetabellen von Hand</li><li>Wertetabellen mit dem Casio fx-87</li>
<li>Lineare Funktionen</li><li>Die Normalparabel <span class="m">y = x²</span></li><li>Verschieben mit <span class="m">+c</span></li>
<li>Strecken, Stauchen, Spiegeln mit <span class="m">a</span></li><li>Alles zusammen: <span class="m">y = ax² + c</span></li>
<li>Klammern quadrieren: jedes mal jedes</li><li>Die binomischen Formeln</li>
<li>Die Scheitelpunktform <span class="m">y = a(x + d)² + e</span></li><li>Quadratische Ergänzung</li>
<li>Nullstellen mit der p-q-Formel</li><li>Schnittpunkte berechnen</li><li>Übungen und Lösungen</li></ol></div>
<div class="card"><div class="boxt">🎨 Der Farbcode – gilt im ganzen Heft</div>
<table class="legend">
<tr><td>{col(X,'x')}</td><td>die Eingabe, was du einsetzt (wie im Funktionen-Tool)</td></tr>
<tr><td>{col(Y,'y')}</td><td>das Ergebnis, der Funktionswert</td></tr>
<tr><td>{col(A,'a')} / {col(A,'m')}</td><td>die Zahl <b>vor</b> dem x: macht steil, flach oder dreht um</td></tr>
<tr><td>{col(C,'c')} / {col(C,'n')} / {col(C,'e')}</td><td>die Zahl <b>allein</b>: schiebt nach oben oder unten</td></tr>
<tr><td>{col(B,'b')} / {col(B,'p')} / {col(B,'d')}</td><td>Zahl vor dem einfachen x, links/rechts (ab Seite 13)</td></tr>
<tr><td><span class="sw" style="background:{ACC}"></span></td><td>der Graph</td></tr>
<tr><td><span class="sw" style="background:{MARK};border-radius:50%"></span></td><td>ein markierter Punkt</td></tr></table>
<div class="boxlegend">
<span class="box-mini so">So geht's</span><span class="box-mini merk">Merke</span><span class="box-mini achtung">Achtung, Fehlerfalle</span><span class="box-mini tool">Probier's aus</span></div>
</div></div>
<div class="card howto"><div class="boxt">📱 So benutzt du die Videos</div>
<p>Jede Video-Karte hat einen QR-Code. Am Handy: Kamera drauf halten. Am PC: die Karte anklicken.
Alle Videos sind vom Kanal <b>Lehrerschmidt</b> auf YouTube. Schau ein Video <b>einmal ganz</b> und dann
noch einmal mit Stift in der Hand, und halte an, wenn er eine Aufgabe stellt.</p></div>
<footer><span>TT – Teaching Tools · Mathe-Zusammenfassung Klasse 9</span><span>Seite 1</span></footer></section>""")

# ── 1 Lernen ─────────────────────────────────────────────────────────────
cycle = f"""<svg viewBox="0 0 330 250" width="330" height="250" xmlns="http://www.w3.org/2000/svg" class="cycle">
<defs><marker id="cy" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{MUT}"/></marker></defs>
<circle cx="165" cy="125" r="88" fill="none" stroke="{LINE}" stroke-width="2" stroke-dasharray="3 5"/>
""" + "".join(
    f'<g transform="translate({165+92*math.cos(math.radians(-90+72*i)):.0f},{125+92*math.sin(math.radians(-90+72*i)):.0f})">'
    f'<circle r="31" fill="{c}" /><text y="-6" text-anchor="middle" font-size="17" font-weight="900" fill="#fff">{i+1}</text>'
    f'<text y="11" text-anchor="middle" font-size="9.5" font-weight="800" fill="#fff">{t}</text></g>'
    for i, (t, c) in enumerate([("lesen", Y), ("Beispiele", X), ("nochmal", B), ("selber", ACC), ("vergleichen", C)])
) + f'<text x="165" y="121" text-anchor="middle" font-size="13" font-weight="900" fill="{TXT}">Merkseite</text><text x="165" y="137" text-anchor="middle" font-size="10" fill="{MUT}">5 Schritte</text></svg>'

page("1", "📖", "Wie lerne ich mit Buch und Hefter?",
     "Bevor es losgeht: Wer richtig liest, muss weniger raten.", f"""
<div class="grid2">
<div>{box("so", "So geht's: die grüne Wichtig-Seite im Lehrbuch",
  "<p>Am Anfang jedes Themas steht im Buch eine <b>grüne Seite</b>. Sie erklärt das Thema kurz und übersichtlich. "
  "Lies sie nicht wie einen Roman, sondern wie eine Bauanleitung:</p>" + steps(
  "<b>Überschrift lesen.</b> Sag in einem Satz: Worum geht es? (Beispiel: <i>»Es geht um Parabeln.«</i>)",
  "<b>Fett gedruckte Wörter suchen.</b> Das sind die Fachwörter. Schreib sie mit Stift raus.",
  "<b>Den farbigen Kasten lesen.</b> Darin steht die Regel. Das ist das Wichtigste der Seite.",
  "<b>Das Bild / den Graphen anschauen.</b> Finde im Bild alles, was im Text steht. Zeig mit dem Finger drauf.",
  "<b>Das Beispiel Zeile für Zeile lesen.</b> Frag bei jeder Zeile: Was wurde hier gemacht – und warum?",
  "<b>Buch zu.</b> Erkläre die Regel laut, als ob du sie einem Fünftklässler erklärst. Klappt es nicht? Zurück zu 3."))}
{box("achtung", "Fehlerfalle", "<p>Gleich zu den Aufgaben blättern und die grüne Seite überspringen. Dann fehlt dir die Regel und du rätst nur.</p>")}
</div>
<div>{box("so", "So geht's: die Merkseite im Hefter", "<div class='center'>" + cycle + "</div>" + steps(
  f"{col(Y,'Lesen:')} Regel einmal langsam lesen. Unbekannte Wörter markieren.",
  f"{col(X,'Beispiele anschauen:')} Jeden Rechenschritt verfolgen. Mit Farbe zeigen, was sich ändert.",
  f"{col(B,'Nochmal lesen:')} Jetzt verstehst du die Regel besser, weil du das Beispiel kennst.",
  f"{col(ACC,'Selber machen:')} Beispiel <b>abdecken</b> und selbst rechnen, auf einem Schmierzettel.",
  f"{col(C,'Vergleichen:')} Aufdecken. Gleich? ✔ Anders? Finde die Zeile, wo es auseinander geht."))}
{box("merk", "Merke", "<p>Du kannst ein Thema erst, wenn du eine Aufgabe <b>ohne Hilfe</b> lösen kannst. Lesen allein reicht nicht.</p>")}
</div></div>
<div class="videos">{video("oquGtpjoK2E", "10 Tipps für bessere Leistungen in der Schule")}</div>
""")

# ── 2 Symbole ────────────────────────────────────────────────────────────
sym = [("+", "plus", "addieren, zusammenzählen", "3 + 4 = 7", "Summe"),
       ("−", "minus", "subtrahieren, abziehen", "9 − 5 = 4", "Differenz"),
       ("· &nbsp;(×)", "mal", "multiplizieren", "3 · 4 = 12", "Produkt"),
       (": &nbsp;÷ &nbsp;/", "geteilt durch", "dividieren (auch als Bruchstrich)", "12 : 4 = 3 &nbsp; ¹²⁄₄ = 3", "Quotient"),
       ("=", "ist gleich", "beide Seiten haben denselben Wert", "2 · 5 = 10", ""),
       ("&lt;", "ist kleiner als", "links steht die kleinere Zahl", "3 &lt; 8 &nbsp; −5 &lt; −1", ""),
       ("&gt;", "ist größer als", "links steht die größere Zahl", "8 &gt; 3 &nbsp; 0 &gt; −2", ""),
       ("≤", "kleiner oder gleich", "kleiner – oder genau gleich", "x ≤ 4: 4 darf auch sein", ""),
       ("≥", "größer oder gleich", "größer – oder genau gleich", "x ≥ 0: 0 darf auch sein", ""),
       ("x²", "x hoch 2, x Quadrat", "die Zahl mal sich selbst", "5² = 5 · 5 = 25", "Potenz"),
       ("√", "Wurzel aus", "welche Zahl mal sich selbst ergibt das?", "√25 = 5", "Quadratwurzel"),
       ("≈", "ungefähr gleich", "gerundet", "√2 ≈ 1,41", "")]
rows = "".join(f"<tr><td class='sym'>{s}</td><td><b>{n}</b></td><td>{m}</td><td class='m'>{e}</td><td class='mut'>{f}</td></tr>" for s, n, m, e, f in sym)
page("2", "➕", "Rechenzeichen und Symbole",
     "Mathe ist eine Sprache. Wer die Zeichen nicht lesen kann, kann die Sätze nicht verstehen.", f"""
<table class="symtab"><thead><tr><th>Zeichen</th><th>Sprich</th><th>Bedeutung</th><th>Beispiel</th><th>Ergebnis heißt</th></tr></thead><tbody>{rows}</tbody></table>
<div class="grid3">
{box("so", "So merkst du dir &lt; und &gt;", "<div class='center' style='font-size:30px;font-weight:900;margin:2px 0'>2 <span style='color:" + ACC + "'>&lt;</span> 7</div>"
  "<p>Die <b>offene Seite</b> zeigt zur <b>größeren</b> Zahl, die <b>Spitze</b> zur kleineren. "
  "Das Krokodil frisst immer die größere Zahl. 🐊</p><p>Bei <b>≤ / ≥</b> kommt ein Strich dazu: »oder gleich«.</p>")}
{box("merk", "Mal-Punkt ist oft unsichtbar", f"<p class='m'>2{col(X,'x')} = 2 · {col(X,'x')}<br>{col(A,'a')}{col(X,'x')}² = {col(A,'a')} · {col(X,'x')} · {col(X,'x')}<br>3(x + 1) = 3 · (x + 1)</p>"
  "<p>Zwischen Zahl und Buchstabe und vor einer Klammer steht ein <b>Mal</b>, auch wenn du keinen Punkt siehst.</p>")}
{box("achtung", "Fehlerfalle: Minus und Quadrat", f"<p class='m'>(−3)² = (−3)·(−3) = <b>9</b><br>−3² = −(3·3) = <b>−9</b></p>"
  "<p>Das Quadrat gilt nur für das, was <b>direkt davor</b> steht. Willst du eine negative Zahl quadrieren: <b>Klammer drum!</b> Das gilt auch im Taschenrechner.</p>"
  "<p>Minus mal Minus = Plus.</p>")}
</div>
<div class="grid2">
{box("so", "Punkt vor Strich, Klammern zuerst", "<p class='m'>2 + 3 · 4 = 2 + 12 = 14 &nbsp; (nicht 20)<br>(2 + 3) · 4 = 5 · 4 = 20</p><p>Reihenfolge: <b>Klammer → Hoch / Wurzel → Punkt (· :) → Strich (+ −)</b></p>")}
<div class="videos col">{video("zRWwa7XZJLo", "Negative Zahlen – Einführung mit Zahlenstrahl")}</div>
</div>""")

# ── 3 Koordinatensystem ──────────────────────────────────────────────────
def ks_extra(sx, sy):
    return (f'<g stroke-width="3" fill="none" stroke-linecap="round">'
            f'<line x1="{sx(0)}" y1="{sy(0)+0.5}" x2="{sx(3)-4}" y2="{sy(0)+0.5}" stroke="{X}" marker-end="url(#kx)"/>'
            f'<line x1="{sx(3)}" y1="{sy(0)}" x2="{sx(3)}" y2="{sy(2)+5}" stroke="{Y}" marker-end="url(#ky)"/>'
            f'<line x1="{sx(0)}" y1="{sy(0)-0.5}" x2="{sx(-2)+4}" y2="{sy(0)-0.5}" stroke="{X}" marker-end="url(#kx)" opacity=".75"/>'
            f'<line x1="{sx(-2)}" y1="{sy(0)}" x2="{sx(-2)}" y2="{sy(-3)-5}" stroke="{Y}" marker-end="url(#ky)" opacity=".75"/></g>'
            f'<defs><marker id="kx" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{X}"/></marker>'
            f'<marker id="ky" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{Y}"/></marker></defs>'
            f'<g font-size="10" font-weight="800" paint-order="stroke" stroke="#fff" stroke-width="3.5"><text x="{sx(1.5)}" y="{sy(0)+24}" fill="{X}" text-anchor="middle">3 nach rechts</text>'
            f'<text x="{sx(3)+5}" y="{sy(1)+3}" fill="{Y}">2 hoch</text>'
            f'<text x="{sx(-1)}" y="{sy(0)-11}" fill="{X}" text-anchor="middle">2 nach links</text>'
            f'<text x="{sx(-2)-4}" y="{sy(-1.6)}" fill="{Y}" text-anchor="end">3 runter</text>'
            f'<g fill="{MUT}" font-size="10" font-weight="700" opacity=".8"><text x="{sx(4)}" y="{sy(4.4)}" text-anchor="middle">I</text>'
            f'<text x="{sx(-4)}" y="{sy(4.4)}" text-anchor="middle">II</text><text x="{sx(-4)}" y="{sy(-4.4)}" text-anchor="middle">III</text>'
            f'<text x="{sx(4)}" y="{sy(-4.4)}" text-anchor="middle">IV</text></g></g>')

ks = graph(xr=(-5, 5), yr=(-5, 5), w=330, h=330,
           points=[{"x": 3, "y": 2, "label": "P(3|2)", "color": MARK, "r": 5},
                   {"x": -2, "y": -3, "label": "Q(−2|−3)", "color": MARK, "r": 5, "off": (-6, 14), "anchor": "end"}],
           extra=ks_extra)
page("3", "📐", "Das Koordinatensystem",
     "Zwei Zahlenstrahlen, die sich kreuzen. Damit gibt jeder Punkt eine genaue Adresse.", f"""
<div class="grid2">
<div>{box("so", "So geht's: Koordinatensystem zeichnen", steps(
  "<b>Lineal + spitzer Bleistift.</b> Nie freihand.",
  f"Die {col(X,'x-Achse')} waagerecht (→) zeichnen, die {col(Y,'y-Achse')} senkrecht (↑). Sie kreuzen sich im <b>Ursprung (0|0)</b>.",
  "Beide Achsen bekommen am Ende eine <b>Pfeilspitze</b>.",
  "<b>Einheit festlegen:</b> meist 1 cm = 2 Kästchen = 1. Auf beiden Achsen gleich!",
  "<b>Beschriften:</b> Zahlen an die Striche (1, 2, 3 … und links/unten −1, −2 …). Die Null nur einmal.",
  f"Die Achsen benennen: {col(X,'x')} rechts an die Pfeilspitze, {col(Y,'y')} oben an die Pfeilspitze."))}
{box("so", "So geht's: Punkt einzeichnen", f"<p class='m center' style='font-size:20px'>P( {col(X,'3')} | {col(Y,'2')} )</p>" + steps(
  "Starte immer im <b>Ursprung</b>.",
  f"Die <b>erste</b> Zahl ist {col(X,'x')}: so weit nach <b>rechts</b> (+) bzw. <b>links</b> (−).",
  f"Die <b>zweite</b> Zahl ist {col(Y,'y')}: von dort nach <b>oben</b> (+) bzw. <b>unten</b> (−).",
  "Kreuz × oder Punkt setzen und den <b>Namen</b> daneben schreiben."))}
</div>
<div><div class="card graphcard">{ks}</div>
{box("merk", "Eselsbrücke", f"<p><b>Erst laufen, dann springen.</b> Erst den Flur entlang ({col(X,'x')}), dann die Treppe hoch oder runter ({col(Y,'y')}).</p><p>x kommt im Alphabet vor y – also kommt x zuerst.</p>")}
{box("achtung", "Fehlerfalle", "<p>x und y vertauschen: P(3|2) ist <b>nicht</b> derselbe Punkt wie (2|3). Und: Zahlen gehören an die <b>Linien</b>, nicht in die Kästchen.</p>")}
</div></div>
<div class="videos">{video("LcImU4dohqs", "Koordinatensystem – Punkt (x|y) eintragen")}{video("fxyZhe8bVyI", "Koordinatensystem mit negativem Bereich")}</div>""")

# ── 4 Quadrat & Wurzel ──────────────────────────────────────────────────
def sq(n, s=13, color=ACC):
    cells = "".join(f'<rect x="{2+i*s}" y="{2+j*s}" width="{s}" height="{s}" fill="{color}" fill-opacity=".22" stroke="{color}" stroke-width="1"/>' for i in range(n) for j in range(n))
    return f'<svg width="{n*s+4}" height="{n*s+4}" viewBox="0 0 {n*s+4} {n*s+4}" xmlns="http://www.w3.org/2000/svg">{cells}</svg>'
sqtab = "<table class='sqtab'><tr>" + "".join(
    f"<td><span class='n'>{n}²</span><span class='eq'>=</span><b>{n*n}</b></td>" + ("</tr><tr>" if n % 5 == 0 and n < 20 else "")
    for n in range(1, 21)) + "</tr></table>"
page("4", "🟧", "Quadratzahlen und Wurzeln",
     "Quadrieren und Wurzelziehen sind Gegenspieler: Das eine macht das andere rückgängig.", f"""
<div class="grid2">
{box("merk", "Was ist ein Quadrat?", f"<div class='sqrow'><div>{sq(2)}<span>2 · 2 = <b>4</b></span></div><div>{sq(3)}<span>3 · 3 = <b>9</b></span></div><div>{sq(4)}<span>4 · 4 = <b>16</b></span></div></div>"
  "<p>Ein Quadrat hat vier <b>gleich lange</b> Seiten. Lege 3 Reihen mit je 3 Kästchen: Das sind 9 Kästchen. "
  "Darum heißt <b>3 · 3 = 3² = 9</b> »3 <b>Quadrat</b>«. Die kleine 2 heißt <b>Exponent</b>: »nimm die Zahl 2-mal als Faktor«.</p>")}
{box("merk", "Was ist eine Wurzel?", "<p>Die Wurzel fragt rückwärts: <b>Welche Zahl mal sich selbst ergibt das?</b></p>"
  "<p class='m center' style='font-size:19px'>√49 = ? &nbsp;→&nbsp; ? · ? = 49 &nbsp;→&nbsp; <b>7</b></p>"
  f"<p>Am Bild: Ein Quadrat hat 16 Kästchen. Wie lang ist eine Seite? √16 = <b>4</b>.</p>"
  "<p class='m center'>quadrieren: 7 ⟶ 49 &nbsp;&nbsp; Wurzel: 49 ⟶ 7</p>")}
</div>
<div class="card" style="padding:9px 12px;margin-bottom:9px"><div class="boxt">🧠 Quadratzahlen bis 20 – auswendig lernen!</div>{sqtab}
<p class="mut small">Lerntrick: jeden Tag eine Reihe von 5 laut aufsagen, vorwärts und rückwärts (»400 ist 20 hoch 2«). Nach 4 Tagen kannst du alle.</p></div>
<div class="grid3">
{box("so", "So ziehst du eine Wurzel", steps("Steht die Zahl in der Tabelle? Dann ablesen: √144 = 12.",
  "Nicht in der Tabelle? Zwischen welchen Quadratzahlen liegt sie? √30: 25 &lt; 30 &lt; 36, also liegt √30 zwischen 5 und 6.",
  "Genau: Taschenrechner, Taste √: √30 ≈ 5,48."))}
{box("achtung", "Fehlerfallen", "<p>• 3² ist <b>nicht</b> 3 · 2 = 6, sondern 3 · 3 = 9.</p><p>• (−4)² = 16. Auch eine negative Zahl wird beim Quadrieren positiv.</p>"
  "<p>• Darum gibt es <b>keine</b> Wurzel aus einer negativen Zahl: √−9 geht nicht (Taschenrechner: »Math ERROR«).</p>")}
{box("merk", "Merke", "<p class='m'>√(a²) = a &nbsp;(a ≥ 0)<br>√0 = 0 &nbsp; √1 = 1</p><p>Die Gleichung x² = 25 hat <b>zwei</b> Lösungen: x = 5 und x = −5. Das brauchst du bei den Nullstellen!</p>")}
</div>
<div class="videos">{video("Y_4w5HzU_ss", "Quadratzahlen bis 20 muss man auswendig lernen!")}{video("MkcArrEhUQI", "Quadratwurzel ziehen – ganz einfach erklärt")}{video("nHZx_9SgLEY", "Potenzieren und Radizieren – Grundlagen")}</div>""")

# ── 5 Wertetabelle per Hand ──────────────────────────────────────────────
wx = [-2, -1, 0, 1, 2, 3]
wt = (f"<table class='wt'><tr><th style='color:{X}'>x</th>" + "".join(f"<td style='color:{X}'><b>{fmt(v)}</b></td>" for v in wx) +
      f"</tr><tr class='calc'><th>Rechnung</th>" + "".join(f"<td>2·({fmt(v)})+1</td>" if v < 0 else f"<td>2·{fmt(v)}+1</td>" for v in wx) +
      f"</tr><tr><th style='color:{Y}'>y</th>" + "".join(f"<td style='color:{Y}'><b>{fmt(2*v+1)}</b></td>" for v in wx) + "</tr></table>")
g5 = graph([{"f": lambda x: 2 * x + 1, "label": "y = 2x + 1", "label_at": (1.6, 5.2), "anchor": "end"}], xr=(-3, 4), yr=(-4, 7), w=250, h=300,
           points=[{"x": v, "y": 2 * v + 1, "color": ACC} for v in wx] + [{"x": 2, "y": 5, "label": "(2|5)", "color": MARK, "cross": True, "r": 5, "anchor": "end", "off": (-8, -6)}])
page("5", "🧮", "Wertetabellen von Hand",
     "Die Wertetabelle ist die Brücke zwischen Term und Graph – genau wie im Funktionen-Tool.", f"""
<div class="grid2 wide-left">
<div>{box("so", "So geht's: Wertetabelle erstellen", steps(
  f"Tabelle mit zwei (besser drei) Zeilen zeichnen: {col(X,'x')}, Rechnung, {col(Y,'y')}.",
  f"In die {col(X,'x')}-Zeile kommen die Zahlen, die du einsetzt, meist −3 bis 3.",
  f"<b>Für jedes</b> {col(X,'x')}: Den Term abschreiben und {col(X,'x')} durch die Zahl ersetzen. Negative Zahlen in <b>Klammern</b>!",
  "Rechnen: Klammer → Hoch → Punkt → Strich.",
  f"Ergebnis in die {col(Y,'y')}-Zeile.",
  f"Jede Spalte ist ein Punkt ({col(X,'x')}|{col(Y,'y')}). Punkte einzeichnen und verbinden: gerade mit Lineal, Parabel freihand."))}
<p class="m" style="margin:6px 0 4px">Beispiel: y = 2·{col(X,'x')} + 1</p>{wt}
<p class="small">Die Spalte {col(X,'2')} heißt: 2·2+1 = {col(Y,'5')} → Punkt <b>(2|5)</b>. Im Graphen orange markiert.</p>
{box("achtung", "Fehlerfalle: negative Zahlen einsetzen", f"<p class='m'>y = {col(X,'x')}² für {col(X,'x')} = −3: &nbsp;(−3)² = <b>9</b> ✔ &nbsp;&nbsp; −3² = −9 ✘</p><p>Immer erst die Klammer schreiben, dann einsetzen.</p>")}
</div>
<div><div class="card graphcard">{g5}</div>
{box("tool", "Probier's aus: Funktionen-Tool", "<p>In TT unter <b>Simulationen → 📈 Funktionen</b> (Code von deiner Lehrkraft): Term eingeben, Wertetabelle und Graph entstehen zusammen. "
  "Fahre über die Tabelle: Der Punkt leuchtet im Graphen. Klicke »?«: Das Tool zeigt die Rechnung – vergleiche mit deiner!</p>")}
</div></div>
{tool("lin", "Die Zeile »Rechnung« zeigt genau das, was du von Hand rechnest. Jede Spalte ist ein Punkt im Graphen.")}
<div class="videos">{video("dLfPBJgHgC4", "Lineare Funktion – Wertetabelle erstellen")}{video("ggtEEE_xgd0", "Normalparabel y=x² mit Wertetabelle zeichnen")}</div>""")

# ── 6 Casio ──────────────────────────────────────────────────────────────
screen = lambda lines: '<div class="lcd">' + "".join(f"<div>{l}</div>" for l in lines) + "</div>"
page("6", "🖩", "Wertetabellen mit dem Casio fx-87",
     "Der Taschenrechner rechnet die ganze Tabelle für dich. Beispiel: y = x² + 1 von −3 bis 3.", f"""
<div class="grid2">
<div>{box("so", "fx-87DE PLUS (graue Tasten, MODE-Taste)", steps(
  f"{key('MODE')} drücken, dann {key('3')} für <b>TABLE</b>.",
  f"Es steht <span class='m'>f(X)=</span>. Funktion eingeben. Das <b>X</b> bekommst du mit {key('ALPHA')} {key(')')}.<br>Für x² + 1: {key('ALPHA')}{key(')')} {key('x²')} {key('+')} {key('1')}",
  f"{key('=')} drücken.",
  f"<b>Start?</b> → {key('(−)')}{key('3')}{key('=')} &nbsp; (Achtung: für »minus 3« die Taste {key('(−)')}, nicht {key('−')})",
  f"<b>Ende?</b> → {key('3')}{key('=')} &nbsp;&nbsp; <b>Schritt?</b> → {key('1')}{key('=')}",
  f"Die Tabelle erscheint. Mit {key('▲')}{key('▼')} blättern. {key('AC')} = zurück zur Funktion.",
  f"Fertig? {key('MODE')} {key('1')} bringt dich zurück zum normalen Rechnen."))}
{screen(["f(X)=X²+1", "&nbsp;", "&nbsp;&nbsp;&nbsp;X&nbsp;&nbsp;&nbsp;&nbsp;F(X)", "1&nbsp;&nbsp;−3&nbsp;&nbsp;&nbsp;10", "2&nbsp;&nbsp;−2&nbsp;&nbsp;&nbsp;&nbsp;5", "3&nbsp;&nbsp;−1&nbsp;&nbsp;&nbsp;&nbsp;2"])}
</div>
<div>{box("so", "fx-87DE CW (neues Modell, HOME-Taste)", steps(
  f"{key('HOME')} drücken, mit den Pfeiltasten das Symbol <b>Tabellen</b> wählen, {key('OK')}.",
  f"{key('TOOLS')} → <b>f(x)/g(x) definieren</b> → <b>f(x) definieren</b>.",
  f"Funktion eingeben. Für das x gibt es die eigene Taste {key('x')}: {key('x')}{key('x²')}{key('+')}{key('1')} {key('OK')}.",
  f"{key('TOOLS')} → <b>Tabellenbereich</b>: Start {key('(−)')}{key('3')}{key('OK')}, Ende {key('3')}{key('OK')}, Schritt {key('1')}{key('OK')}.",
  f"Mit {key('OK')} die Tabelle anzeigen, mit {key('▲')}{key('▼')} blättern.",
  f"{key('HOME')} → <b>Rechnen</b> bringt dich zurück."))}
{box("merk", "Schritt bedeutet …", "<p>… wie weit x jedes Mal wächst. Schritt 1: −3, −2, −1, 0 … &nbsp; Schritt 0,5: −3; −2,5; −2 … (mehr Punkte, genauerer Graph). Höchstens 30 Zeilen.</p>")}
{box("achtung", "Fehlerfallen am Rechner", f"<p>• Statt X wurde das Mal-Zeichen {key('×')} getippt → »Syntax ERROR«.</p><p>• Ende kleiner als Start → Fehler.</p><p>• Im normalen Rechnen: (−3)² <b>mit Klammer</b> tippen, sonst −9.</p>")}
</div></div>
{box("tool", "Kontrolle", "<p>Vergleiche die Rechner-Tabelle mit deiner Tabelle von Hand. Stimmt eine Zahl nicht, liegt der Fehler fast immer beim <b>Minus</b> oder bei der <b>Klammer</b>. "
  "Ausführliche Anleitung: Casio-Handbuch online (support.casio.com → fx-87DE PLUS / fx-87DE CW → Tabellen).</p>")}
""")

# ── 7 Lineare Funktionen ─────────────────────────────────────────────────
def tri(sx, sy):
    return (f'<g stroke-width="2.6" stroke-linecap="round"><line x1="{sx(0)}" y1="{sy(-1)}" x2="{sx(1)}" y2="{sy(-1)}" stroke="{X}"/>'
            f'<line x1="{sx(1)}" y1="{sy(-1)}" x2="{sx(1)}" y2="{sy(1)}" stroke="{A}"/>'
            f'<line x1="{sx(1)}" y1="{sy(1)}" x2="{sx(2)}" y2="{sy(1)}" stroke="{X}"/>'
            f'<line x1="{sx(2)}" y1="{sy(1)}" x2="{sx(2)}" y2="{sy(3)}" stroke="{A}"/></g>'
            f'<g font-size="11" font-weight="800"><text x="{sx(0.5)}" y="{sy(-1)+13}" fill="{X}" text-anchor="middle">1 →</text>'
            f'<text x="{sx(1)+5}" y="{sy(0)+4}" fill="{A}">2 ↑</text><text x="{sx(1.5)}" y="{sy(1)+13}" fill="{X}" text-anchor="middle">1 →</text>'
            f'<text x="{sx(2)+5}" y="{sy(2)+4}" fill="{A}">2 ↑</text></g>')
g7 = graph([{"f": lambda x: 2 * x - 1, "label": "y = 2x − 1", "label_at": (2.6, 4.6), "anchor": "end"},
            {"f": lambda x: -0.5 * x + 3, "color": Y, "label": "y = −½x + 3", "label_at": (-3.8, 5.3)}],
           xr=(-4, 4), yr=(-4, 6), w=290, h=330, extra=tri,
           points=[{"x": 0, "y": -1, "label": "n = −1", "color": C, "r": 5, "anchor": "end", "off": (-7, 4), "lcolor": C},
                   {"x": 0, "y": 3, "color": C, "r": 5, "label": "n = 3", "off": (7, -6), "lcolor": C}])
page("7", "📈", "Lineare Funktionen",
     "Der Graph ist immer eine Gerade. Zwei Zahlen bestimmen alles: Steigung und Startpunkt.", f"""
<div class="formula">y = {col(A,'m')} · {col(X,'x')} + {col(C,'n')}</div>
<p class="center small mut" style="margin-top:-4px">In manchen Büchern und bei Lehrerschmidt heißt das n auch <b>b</b>: y = mx + b. Gemeint ist dasselbe.</p>
<div class="grid2">
<div>{box("merk", "Was bedeuten m und n?", f"<p>{col(C,'n')} = <b>y-Achsenabschnitt</b>: Dort schneidet die Gerade die y-Achse. Punkt (0|{col(C,'n')}).</p>"
  f"<p>{col(A,'m')} = <b>Steigung</b>: Gehst du <b>1 nach rechts</b>, geht die Gerade {col(A,'m')} nach oben.</p>"
  f"<p>{col(A,'m')} &gt; 0: steigt ↗ &nbsp; {col(A,'m')} &lt; 0: fällt ↘ &nbsp; {col(A,'m')} = 0: waagerecht →</p>")}
{box("so", "So geht's: Gerade zeichnen ohne Tabelle", steps(
  f"{col(C,'n')} ablesen und den Punkt (0|{col(C,'n')}) auf der y-Achse markieren. Bei y = 2x − 1: (0|−1).",
  f"Steigungsdreieck: von dort <b>1 nach rechts</b> ({col(X,'→')}) und {col(A,'m')} nach oben ({col(A,'↑')}). Bei m = 2: 2 hoch.",
  "Den Schritt noch einmal wiederholen, damit du einen dritten Punkt hast.",
  "Mit dem <b>Lineal</b> durch alle Punkte, über die Punkte hinaus. Graph beschriften."))}
{box("achtung", "Fehlerfallen", f"<p>• Bei negativem {col(A,'m')} geht es nach <b>unten</b>: m = −½ → 1 rechts, ½ runter (oder 2 rechts, 1 runter).</p><p>• Bruch als Steigung: m = ⅔ heißt 3 nach rechts, 2 nach oben.</p>")}
</div>
<div><div class="card graphcard">{g7}</div>
{box("tool", "Probier's aus", f"<p>Gib im Funktionen-Tool <span class='m'>2x−1</span> ein. Ändere dann nur {col(A,'m')}: 3x−1, 0.5x−1, −2x−1. Was passiert? Ändere dann nur {col(C,'n')}.</p>")}
</div></div>
<div class="videos">{video("TKK-25nz-cE", "Lineare Funktion zeichnen (y=mx+b)")}{video("fN52WXY_72g", "Steigungsdreieck bei einer linearen Funktion")}{video("tBhQwSmrAZc", "Lineare Funktion zeichnen mit dem Steigungsdreieck")}</div>""")

# ── 8 Normalparabel ──────────────────────────────────────────────────────
px = [-3, -2, -1, 0, 1, 2, 3]
pt = (f"<table class='wt'><tr><th style='color:{X}'>x</th>" + "".join(f"<td style='color:{X}'><b>{fmt(v)}</b></td>" for v in px) +
      "</tr><tr class='calc'><th>Rechnung</th>" + "".join(f"<td>({fmt(v)})²</td>" if v < 0 else f"<td>{fmt(v)}²</td>" for v in px) +
      f"</tr><tr><th style='color:{Y}'>y</th>" + "".join(f"<td style='color:{Y}'><b>{fmt(v*v)}</b></td>" for v in px) + "</tr></table>")
def stairs(sx, sy):
    o = []
    for (x0_, y0_, x1_, y1_, t) in [(0, 0, 1, 1, "1"), (1, 1, 2, 4, "3"), (2, 4, 3, 9, "5")]:
        o.append(f'<line x1="{sx(x0_)}" y1="{sy(y0_)}" x2="{sx(x1_)}" y2="{sy(y0_)}" stroke="{X}" stroke-width="2"/>'
                 f'<line x1="{sx(x1_)}" y1="{sy(y0_)}" x2="{sx(x1_)}" y2="{sy(y1_)}" stroke="{A}" stroke-width="2"/>'
                 f'<text x="{sx(x1_)+4}" y="{(sy(y0_)+sy(y1_))/2+4}" font-size="10.5" font-weight="800" fill="{A}">{t} ↑</text>')
    return "".join(o)
g8 = graph([{"f": lambda x: x * x, "label": "y = x²", "label_at": (-2.1, 6.5), "anchor": "end"}], xr=(-4, 4), yr=(-1, 10), w=290, h=330, extra=stairs,
           points=[{"x": v, "y": v * v} for v in px] + [{"x": 0, "y": 0, "label": "S(0|0)", "color": MARK, "r": 5, "off": (8, 14)}])
page("8", "🔵", "Die Normalparabel y = x²",
     "Das x steht im Quadrat. Darum ist der Graph keine Gerade mehr, sondern eine Kurve: die Parabel.", f"""
<div class="grid2">
<div><p class="m" style="margin:2px 0 4px">Wertetabelle für y = {col(X,'x')}²</p>{pt}
{box("merk", "Eigenschaften der Normalparabel", "<p>• Form wie ein <b>U</b>, nach oben offen.</p>"
  "<p>• Der tiefste Punkt heißt <b>Scheitelpunkt</b> S. Bei y = x² ist S(0|0).</p>"
  "<p>• Sie ist <b>symmetrisch</b> zur y-Achse: links und rechts gleich (2² = 4 und (−2)² = 4).</p>"
  "<p>• y ist nie negativ, weil ein Quadrat nie negativ ist.</p>")}
{box("so", "So geht's: Parabel zeichnen", steps(
  "Wertetabelle von −3 bis 3 (siehe Seite 5/6).",
  "Punkte sauber einzeichnen.",
  "<b>Freihand</b> zu einer runden Kurve verbinden – <b>keine Spitze</b> unten, kein Lineal! Oder die Parabel-Schablone nehmen.",
  "Den Scheitelpunkt S beschriften."))}
{box("merk", "Treppen-Trick ohne Tabelle", f"<p>Vom Scheitel aus: 1 rechts → {col(A,'1 hoch')}, 1 rechts → {col(A,'3 hoch')}, 1 rechts → {col(A,'5 hoch')} (ungerade Zahlen 1, 3, 5, 7 …). Nach links genauso.</p>")}
</div>
<div><div class="card graphcard">{g8}</div>
{box("achtung", "Fehlerfalle", "<p>Die Parabel unten spitz zeichnen (wie ein V). Zwischen −1 und 1 ist sie ganz flach und rund!</p>")}
</div></div>
{tool("np", "Links und rechts vom Scheitel stehen dieselben y-Werte (9, 4, 1, 0, 1, 4, 9): Die Parabel ist symmetrisch.")}
<div class="videos">{video("PrMmIPs7dKw", "Quadratische Funktion – Was ist das?")}{video("ggtEEE_xgd0", "Normalparabel y=x² mit Wertetabelle zeichnen")}</div>""")

# ── 9 +c ─────────────────────────────────────────────────────────────────
g9 = graph([{"f": lambda x: x * x, "color": MUT, "dash": True, "width": 1.8, "label": "y = x²", "label_at": (1.25, 1.6)},
            {"f": lambda x: x * x + 2, "color": C, "label": "y = x² + 2", "label_at": (-1.7, 6.6), "anchor": "end"},
            {"f": lambda x: x * x - 3, "color": ACC, "label": "y = x² − 3", "label_at": (2.85, 4.5)}],
           xr=(-4, 4), yr=(-4, 8), w=300, h=330,
           points=[{"x": 0, "y": 2, "label": "S(0|2)", "color": C, "r": 5, "off": (8, 4)}, {"x": 0, "y": -3, "label": "S(0|−3)", "color": ACC, "r": 5, "off": (8, 14)}],
           extra=lambda sx, sy: (f'<g stroke="{C}" stroke-width="2" marker-end="url(#up)"><line x1="{sx(-2)}" y1="{sy(4)}" x2="{sx(-2)}" y2="{sy(6)+5}"/><line x1="{sx(2)}" y1="{sy(4)}" x2="{sx(2)}" y2="{sy(6)+5}"/></g>'
                                 f'<defs><marker id="up" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{C}"/></marker></defs>'))
page("9", "⬆️", "Verschieben nach oben und unten: + c",
     "Eine Zahl hinter dem x² nimmt die ganze Parabel und schiebt sie hoch oder runter. Form bleibt gleich.", f"""
<div class="formula">y = {col(X,'x')}² + {col(C,'c')}</div>
<div class="grid2">
<div>{box("merk", "Was macht c?", f"<p>{col(C,'c')} &gt; 0: Parabel wandert um {col(C,'c')} <b>nach oben</b>.</p><p>{col(C,'c')} &lt; 0: Parabel wandert um {col(C,'c')} <b>nach unten</b>.</p>"
  f"<p>Der Scheitelpunkt ist <b>S(0|{col(C,'c')})</b>. Die Form bleibt genau die Normalparabel.</p>")}
{box("so", "So geht's", steps(
  f"{col(C,'c')} ablesen: y = x² <b>− 3</b> → c = −3. Das Vorzeichen gehört dazu!",
  f"Scheitelpunkt S(0|{col(C,'c')}) auf der y-Achse einzeichnen: S(0|−3).",
  "Von S aus die Normalparabel zeichnen (Treppe 1, 3, 5 oder Schablone)."))}
{box("so", "Warum ist das so?", f"<p>Jeder y-Wert der Normalparabel bekommt einfach {col(C,'c')} dazu:</p>"
  "<table class='wt small'><tr><th>x</th><td>−2</td><td>−1</td><td>0</td><td>1</td><td>2</td></tr>"
  "<tr><th>x²</th><td>4</td><td>1</td><td>0</td><td>1</td><td>4</td></tr>"
  f"<tr><th style='color:{C}'>x² + 2</th><td style='color:{C}'><b>6</b></td><td style='color:{C}'><b>3</b></td><td style='color:{C}'><b>2</b></td><td style='color:{C}'><b>3</b></td><td style='color:{C}'><b>6</b></td></tr></table>"
  "<p>Alle Punkte rutschen um 2 nach oben (grüne Pfeile im Bild).</p>")}
</div>
<div><div class="card graphcard">{g9}</div>
{box("tool", "Probier's aus", "<p>Funktionen-Tool: <span class='m'>x^2+2</span>, dann <span class='m'>x^2−3</span>, dann <span class='m'>x^2+0.5</span>. Achte nur auf den Scheitelpunkt.</p>")}
</div></div>
<div class="videos">{video("xBZe1j91JEE", "Quadratische Funktion auf der y-Achse verschieben")}</div>""")

# ── 10 Faktor a ──────────────────────────────────────────────────────────
ga = graph([{"f": lambda x: x * x, "color": MUT, "dash": True, "width": 1.8, "label": "x²", "label_at": (2.3, 6.2)},
            {"f": lambda x: 2 * x * x, "color": A, "label": "y = 2x²", "label_at": (-1.85, 7.4), "anchor": "end"},
            {"f": lambda x: 0.5 * x * x, "color": ACC, "label": "y = ½x²", "label_at": (3.6, 4.1), "anchor": "end"}],
           xr=(-4, 4), yr=(-1, 8), w=255, h=255)
gb = graph([{"f": lambda x: -x * x, "color": Y, "label": "y = −x²", "label_at": (1.6, -5.2)},
            {"f": lambda x: -0.5 * x * x, "color": B, "label": "y = −½x²", "label_at": (-3.7, -2.4), "anchor": "start"},
            {"f": lambda x: x * x, "color": MUT, "dash": True, "width": 1.8, "label": "x²", "label_at": (1.9, 4.6)}],
           xr=(-4, 4), yr=(-7, 6), w=255, h=255)
page("10", "↕️", "Strecken, Stauchen, Spiegeln: der Faktor a",
     "Die Zahl vor dem x² bestimmt, wie steil die Parabel ist und ob sie nach oben oder nach unten offen ist.", f"""
<div class="formula">y = {col(A,'a')} · {col(X,'x')}²</div>
<div class="grid2">
<div class="card graphcard">{ga}<p class="cap">a &gt; 1: schmaler (gestreckt) · 0 &lt; a &lt; 1: breiter (gestaucht)</p></div>
<div class="card graphcard">{gb}<p class="cap">a negativ: Parabel ist nach <b>unten</b> offen (gespiegelt)</p></div>
</div>
<table class="symtab casetab"><thead><tr><th>a ist …</th><th>Beispiel</th><th>Öffnung</th><th>Form</th><th>Name</th></tr></thead><tbody>
<tr><td>a = 1</td><td class="m">y = x²</td><td>nach oben ∪</td><td>normal</td><td>Normalparabel</td></tr>
<tr><td>a &gt; 1</td><td class="m">y = 2x², y = 3x²</td><td>nach oben ∪</td><td><b>schmaler, steiler</b></td><td>gestreckt</td></tr>
<tr><td>0 &lt; a &lt; 1</td><td class="m">y = ½x², y = 0,2x²</td><td>nach oben ∪</td><td><b>breiter, flacher</b></td><td>gestaucht</td></tr>
<tr><td>a = −1</td><td class="m">y = −x²</td><td><b>nach unten ∩</b></td><td>normal</td><td>gespiegelt</td></tr>
<tr><td>a &lt; −1 &nbsp;/&nbsp; −1 &lt; a &lt; 0</td><td class="m">y = −2x² / y = −½x²</td><td><b>nach unten ∩</b></td><td>schmaler / breiter</td><td>gespiegelt + gestreckt / gestaucht</td></tr></tbody></table>
<div class="grid3">
{box("so", "So geht's: Treppe mit a", f"<p>Vom Scheitel aus: 1 rechts → {col(A,'a')} · 1 hoch, 1 rechts → {col(A,'a')} · 3 hoch, 1 rechts → {col(A,'a')} · 5 hoch.</p><p>Bei a = 2: 2, 6, 10. Bei a = −½: ½, 1½, 2½ <b>runter</b>.</p>")}
{box("merk", "Merke", f"<p><b>Vorzeichen</b> von {col(A,'a')}: oben oder unten offen.<br><b>Betrag</b> von {col(A,'a')} (ohne Minus): größer als 1 → schmal, kleiner als 1 → breit.</p>")}
{box("achtung", "Fehlerfalle", "<p>»½x² ist kleiner, also ist die Parabel kleiner.« Nein: Sie ist <b>breiter</b>! Rechne nach: bei x = 2 ist ½·4 = 2, die Normalparabel ist schon bei 4.</p>")}
</div>
<div class="videos">{video("XBLrXimmTUM", "Parabel gestreckt (y=2x²) und gestaucht (y=½x²)")}{video("jpWXokYwscI", "Normalparabel y=−x² nach unten geöffnet")}{video("uyrqaMgx4JY", "Parabeln zeichnen – ein Überblick")}</div>""")

# ── 11 y = ax² + c ───────────────────────────────────────────────────────
g11 = graph([{"f": lambda x: -0.5 * x * x + 4, "label": "y = −½x² + 4", "label_at": (1.6, 5.2)}],
            xr=(-4, 4), yr=(-5, 6), w=280, h=310,
            points=[{"x": 0, "y": 4, "label": "S(0|4)", "color": MARK, "r": 5, "off": (-8, -8), "anchor": "end"}] +
                   [{"x": v, "y": -0.5 * v * v + 4} for v in (-3, -2, -1, 1, 2, 3)] +
                   [{"x": v, "y": 0, "color": Y, "r": 4.5} for v in (-math.sqrt(8), math.sqrt(8))])
page("11", "🎯", "Alles zusammen: y = ax² + c",
     "Jetzt kennst du beide Stellschrauben. In 4 Schritten skizzierst du jede dieser Parabeln.", f"""
<div class="formula">y = {col(A,'a')} · {col(X,'x')}² + {col(C,'c')}</div>
<div class="grid2">
<div>{box("so", "So geht's in 4 Schritten – Beispiel y = −½x² + 4", steps(
  f"<b>Ablesen:</b> {col(A,'a = −½')}, {col(C,'c = 4')}. (Vorzeichen mitnehmen!)",
  f"<b>Scheitelpunkt:</b> S(0|{col(C,'c')}) = S(0|4) einzeichnen.",
  f"<b>Öffnung:</b> {col(A,'a')} ist negativ → nach <b>unten</b> offen. |a| = ½ &lt; 1 → <b>breiter</b>.",
  f"<b>Punkte:</b> Treppe mit a: ½, 1½, 2½ runter. Oder Wertetabelle (Casio!). Dann rund verbinden."))}
<table class='wt'><tr><th style='color:{X}'>x</th><td>−3</td><td>−2</td><td>−1</td><td>0</td><td>1</td><td>2</td><td>3</td></tr>
<tr><th style='color:{Y}'>y</th><td>−0,5</td><td>2</td><td>3,5</td><td><b>4</b></td><td>3,5</td><td>2</td><td>−0,5</td></tr></table>
{box("merk", "Steckbrief einer Parabel", f"<p>Sag zu jeder Parabel drei Dinge:</p><p>1. <b>Scheitelpunkt</b> S(0|{col(C,'c')})<br>2. <b>Öffnung</b> nach oben / unten (Vorzeichen von {col(A,'a')})<br>3. <b>Form</b> gestreckt / normal / gestaucht (Betrag von {col(A,'a')})</p>")}
</div>
<div><div class="card graphcard">{g11}<p class="cap">Die blauen Punkte sind die <b>Nullstellen</b>: dort ist y = 0. → Seite 17</p></div>
{box("tool", "Probier's aus", "<p>Funktionen-Tool: <span class='m'>-0.5x^2+4</span>. Prüfe deine Tabelle mit der Tool-Tabelle. Dann <span class='m'>2x^2-3</span>: Steckbrief zuerst im Kopf, dann nachschauen.</p>")}
{box("achtung", "Fehlerfalle", "<p>Erst c, dann a vergessen – oder umgekehrt. Immer <b>beide</b> Zahlen ablesen, bevor du zeichnest.</p>")}
</div></div>
{tool("ac", "Prüfe den Steckbrief: S(0|4), nach unten offen, breiter als die Normalparabel.")}
<div class="videos">{video("w4uGBMebiTg", "Quadratische Funktionen zeichnen – eine Übersicht")}{video("9jPuMJhEt0o", "y=(x−2)² und y=(x−2)²−2 – Parabeln zeichnen (Ausblick)")}</div>""")

# ── 12 Klammern quadrieren (Bögen wie in »Umrechnen«) ────────────────────
def boegen(t, prod, farben):
    """(t0 t1)·(t2 t3) mit vier Bögen: oben vorne·vorne, vorne·hinten; unten hinten·vorne, hinten·hinten."""
    W, H, ym = 276, 206, 103
    xs = [44, 102, 178, 236]
    o = [f'<svg class="boegen" viewBox="0 0 {W} {H}" width="{W}" height="{H}" xmlns="http://www.w3.org/2000/svg"><defs>']
    for c in dict.fromkeys(farben):
        o.append(f'<marker id="bg{c[1:]}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>')
    o.append('</defs>')
    # Klammern, Malpunkt, Glieder
    for x, ch in [(20, "("), (126, ")"), (140, "·"), (154, "("), (260, ")")]:
        o.append(f'<text x="{x}" y="{ym}" text-anchor="middle" dominant-baseline="central" font-size="30" fill="{MUT}" font-family="Cambria Math, Cambria, serif">{ch}</text>')
    for i, (x, tt) in enumerate(zip(xs, t)):
        c = X if tt == "x" else B
        o.append(f'<text x="{x}" y="{ym}" text-anchor="middle" dominant-baseline="central" font-size="23" font-weight="700" fill="{c}" font-family="Cambria Math, Cambria, serif">{tt}</text>')
    schilder = []
    def bogen(i, j, oben, hoehe, label, farbe, nr):
        y = ym - 16 if oben else ym + 16
        x1, x2 = xs[i], xs[j]   # Start und Ziel mittig über bzw. unter dem Glied
        cy = y - hoehe if oben else y + hoehe
        mx = (x1 + x2) / 2
        o.append(f'<path d="M {x1} {y} Q {mx} {cy} {x2} {y}" fill="none" stroke="{farbe}" stroke-width="2.3" marker-end="url(#bg{farbe[1:]})"/>')
        ly = (y + cy) / 2
        w = 13 + 7.2 * len(label)
        schilder.append(f'<rect x="{mx - w/2}" y="{ly - 10}" width="{w}" height="20" rx="6" fill="#fff" stroke="{farbe}" stroke-width="1"/>'
                        f'<text x="{mx}" y="{ly + 0.5}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="800" fill="{farbe}">{nr} {label}</text>')
    bogen(0, 2, True, 30, prod[0], farben[0], "①")
    bogen(0, 3, True, 136, prod[1], farben[1], "②")
    bogen(1, 2, False, 30, prod[2], farben[2], "③")
    bogen(1, 3, False, 136, prod[3], farben[3], "④")
    o += schilder
    o.append('</svg>')
    return "".join(o)

def fall(titel, t, prod, glieder, ergebnis, hinweis):
    farben = [X, B, B, A]
    zeile = " ".join(f'<span style="color:{c}">{g}</span>' for g, c in zip(glieder, farben))
    return f"""<div class="card fall"><div class="boxt">{titel}</div>
<div class="center">{boegen(t, prod, farben)}</div>
<p class="m">= {zeile}</p><p class="m">= <b>{ergebnis}</b></p><p class="small mut">{hinweis}</p></div>"""

page("12", "🌈", "Klammern quadrieren: jedes mal jedes",
     "(x + d)² heißt: die Klammer mal sich selbst. Mit vier Bögen vergisst du kein Produkt – und bei Minus kein Vorzeichen.", f"""
<div class="formula">({col(X,'x')} + {col(B,'d')})² = ({col(X,'x')} + {col(B,'d')}) · ({col(X,'x')} + {col(B,'d')})</div>
<div class="grid2">
{box("so", "So geht's: vier Bögen", steps(
  f"<b>Quadrat ausschreiben:</b> die Klammer zweimal hinschreiben, Malpunkt dazwischen.",
  f"{col(X,'① vorne mal vorne')} – Bogen oben, kurz",
  f"{col(B,'② vorne mal hinten')} – Bogen oben, weit",
  f"{col(B,'③ hinten mal vorne')} – Bogen unten, kurz",
  f"{col(A,'④ hinten mal hinten')} – Bogen unten, weit",
  "<b>Zusammenfassen:</b> ② und ③ sind gleichartig (beide mit x) – zusammenzählen."))}
<div>{box("merk", "Vorzeichen gehören zum Glied", "<p>Das Rechenzeichen <b>vor</b> einer Zahl reist mit: in (x − 3) ist das hintere Glied <b>−3</b>.</p><p class='m'>plus · plus = plus &nbsp; minus · minus = <b>plus</b><br>plus · minus = minus</p>")}
{box("achtung", "Fehlerfalle", "<p class='m'>(x + 3)² ≠ x² + 9</p><p>So fehlen die Bögen ② und ③ – das mittlere Glied 6x. Quadrieren heißt nicht: jedes Glied einzeln hoch 2.</p>")}
</div></div>
<div class="grid3 faelle">
{fall("Fall 1: (x + 3)²", ["x", "+3", "x", "+3"], ["x·x", "x·3", "3·x", "3·3"], ["x²", "+ 3x", "+ 3x", "+ 9"], "x² + 6x + 9", "Alles plus: das mittlere Glied ist doppelt da.")}
{fall("Fall 2: (x − 3)²", ["x", "−3", "x", "−3"], ["x·x", "x·(−3)", "(−3)·x", "(−3)·(−3)"], ["x²", "− 3x", "− 3x", "+ 9"], "x² − 6x + 9", "Minus mal minus gibt plus: hinten steht +9.")}
{fall("Fall 3: (x + 3)(x − 3)", ["x", "+3", "x", "−3"], ["x·x", "x·(−3)", "3·x", "3·(−3)"], ["x²", "− 3x", "+ 3x", "− 9"], "x² − 9", "② und ③ heben sich auf: die Mitte fällt weg.")}
</div>
<div class="videos">{video("X5E2bqby8f0", "Ausmultiplizieren – Klammern auflösen")}{video("jiIii_3DwUw", "1. binomische Formel mit Übungen")}</div>""")

# ── 13 Binomische Formeln + Geometrie ────────────────────────────────────
def quadrat_1(x=118, d=50):
    """(x + d)²: großes Quadrat = x² + d·x + d·x + d²"""
    m, W = 26, 26 + x + d + 8
    o = [f'<svg viewBox="0 0 {W} {W}" width="{W}" height="{W}" xmlns="http://www.w3.org/2000/svg" font-family="Cambria Math, Cambria, serif">']
    felder = [(0, 0, x, x, X, "x²"), (x, 0, d, x, B, "d·x"), (0, x, x, d, B, "d·x"), (x, x, d, d, A, "d²")]
    for fx, fy, fw, fh, c, t in felder:
        o.append(f'<rect x="{m+fx}" y="{m+fy}" width="{fw}" height="{fh}" fill="{c}" fill-opacity=".18" stroke="{c}" stroke-width="2"/>'
                 f'<text x="{m+fx+fw/2}" y="{m+fy+fh/2}" text-anchor="middle" dominant-baseline="central" font-size="{18 if fw > 60 and fh > 60 else 14}" font-weight="700" fill="{c}">{t}</text>')
    for a, b, t, c in [(0, x, "x", X), (x, x + d, "d", B)]:
        o.append(f'<text x="{m+(a+b)/2}" y="{m-8}" text-anchor="middle" font-size="15" font-weight="700" fill="{c}">{t}</text>'
                 f'<text x="{m-9}" y="{m+(a+b)/2}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="{c}">{t}</text>')
    o.append('</svg>')
    return "".join(o)

def quadrat_2(x=150, d=44):
    """(x − d)²: vom x²-Quadrat zwei Streifen d·x weg, die doppelt weggenommene Ecke d² zurück."""
    m, W = 26, 26 + x + 8
    k = x - d
    o = [f'<svg viewBox="0 0 {W} {W}" width="{W}" height="{W}" xmlns="http://www.w3.org/2000/svg" font-family="Cambria Math, Cambria, serif">',
         f'<rect x="{m}" y="{m}" width="{x}" height="{x}" fill="none" stroke="{MUT}" stroke-width="1.5" stroke-dasharray="4 3"/>',
         f'<rect x="{m}" y="{m}" width="{k}" height="{k}" fill="{X}" fill-opacity=".2" stroke="{X}" stroke-width="2.2"/>',
         f'<text x="{m+k/2}" y="{m+k/2}" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="700" fill="{X}">(x − d)²</text>',
         f'<rect x="{m+k}" y="{m}" width="{d}" height="{x}" fill="{B}" fill-opacity=".14" stroke="{B}" stroke-width="1.5"/>',
         f'<rect x="{m}" y="{m+k}" width="{x}" height="{d}" fill="{B}" fill-opacity=".14" stroke="{B}" stroke-width="1.5"/>',
         f'<rect x="{m+k}" y="{m+k}" width="{d}" height="{d}" fill="{A}" fill-opacity=".3" stroke="{A}" stroke-width="2"/>',
         f'<text x="{m+k+d/2}" y="{m+k/2}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="{B}">− d·x</text>',
         f'<text x="{m+k/2}" y="{m+k+d/2}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="{B}">− d·x</text>',
         f'<text x="{m+k+d/2}" y="{m+k+d/2}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="{A}">+d²</text>',
         f'<text x="{m+x/2}" y="{m-8}" text-anchor="middle" font-size="15" font-weight="700" fill="{X}">x</text>',
         f'<text x="{m-9}" y="{m+x/2}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill="{X}">x</text>',
         '</svg>']
    return "".join(o)

page("13", "📐", "Die binomischen Formeln",
     "Die drei Fälle von der letzten Seite kommen so oft vor, dass sie Namen haben. Hier sind sie – und warum sie stimmen.", f"""
<table class="symtab binom"><thead><tr><th>Name</th><th>Formel</th><th>Beispiel (von Seite 13)</th><th>Merkmal</th></tr></thead><tbody>
<tr><td><b>1. binomische Formel</b></td><td class="m">({col(X,'x')} + {col(B,'d')})² = {col(X,'x²')} + {col(B,'2·d·x')} + {col(A,'d²')}</td><td class="m">(x + 3)² = x² + 6x + 9</td><td>alles plus</td></tr>
<tr><td><b>2. binomische Formel</b></td><td class="m">({col(X,'x')} − {col(B,'d')})² = {col(X,'x²')} − {col(B,'2·d·x')} + {col(A,'d²')}</td><td class="m">(x − 3)² = x² − 6x + 9</td><td>Mitte minus, hinten plus</td></tr>
<tr><td><b>3. binomische Formel</b></td><td class="m">({col(X,'x')} + {col(B,'d')})({col(X,'x')} − {col(B,'d')}) = {col(X,'x²')} − {col(A,'d²')}</td><td class="m">(x + 3)(x − 3) = x² − 9</td><td>Mitte fällt weg</td></tr>
</tbody></table>
{box("merk", "Merksatz für 1 und 2", f"<p><b>{col(X,'Erstes Quadrat')} – {col(B,'doppeltes Produkt')} – {col(A,'zweites Quadrat')}.</b> Das Vorzeichen in der Mitte ist das aus der Klammer, hinten steht immer <b>plus</b>.</p>")}
<div class="grid2">
<div class="card geo"><div class="boxt">🟪 Warum die 1. Formel stimmt</div><div class="center">{quadrat_1()}</div>
<p>Ein Quadrat mit der Seite <b>x + d</b> hat die Fläche (x + d)². Zerschneide es: ein Quadrat {col(X,'x²')}, zwei Rechtecke {col(B,'d·x')}, ein kleines Quadrat {col(A,'d²')}.</p>
<p class="m center">(x + d)² = {col(X,'x²')} + {col(B,'2·d·x')} + {col(A,'d²')}</p></div>
<div class="card geo"><div class="boxt">🟪 Warum die 2. Formel stimmt</div><div class="center">{quadrat_2()}</div>
<p>Vom Quadrat {col(X,'x²')} zwei Streifen {col(B,'d·x')} abschneiden. Dabei ist die Ecke {col(A,'d²')} <b>doppelt</b> weg – einmal zurücklegen.</p>
<p class="m center">(x − d)² = {col(X,'x²')} − {col(B,'2·d·x')} + {col(A,'d²')}</p></div>
</div>
<div class="grid2">
{box("tool", "Kopfrechnen-Trick", "<p class='m'>21² = (20 + 1)² = 400 + 40 + 1 = <b>441</b><br>19² = (20 − 1)² = 400 − 40 + 1 = <b>361</b><br>19 · 21 = (20 − 1)(20 + 1) = 400 − 1 = <b>399</b></p>")}
{box("achtung", "Fehlerfallen", "<p>• Das <b>doppelte</b> Produkt: bei (x + 5)² ist die Mitte 2·5·x = <b>10x</b>, nicht 5x.</p><p>• Hinten bei der 2. Formel: <b>+</b>d², nicht −d².</p><p>• Weißt du's nicht mehr: einfach die vier Bögen von Seite 13 machen.</p>")}
</div>
<div class="videos">{video("Q0KXX4MkFVE", "1. binomische Formel – zeichnerisch und rechnerisch")}{video("jiIii_3DwUw", "1. binomische Formel mit Übungen")}</div>""")

# ── 14 Scheitelpunktform ─────────────────────────────────────────────────
def pfeile(sx, sy, wege):
    """Verschiebe-Pfeile vom Ursprung: [(x0, y0, x1, y1, farbe, text, dx, dy), …]"""
    o = []
    for x0, y0, x1, y1, c, t, dx, dy in wege:
        mid = "pf" + c.lstrip("#")   # eine Pfeilspitze je Farbe
        o.append(f'<defs><marker id="{mid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker></defs>')
        o.append(f'<line x1="{sx(x0)}" y1="{sy(y0)}" x2="{sx(x1)}" y2="{sy(y1)}" stroke="{c}" stroke-width="3" marker-end="url(#{mid})"/>')
        o.append(f'<text x="{(sx(x0)+sx(x1))/2+dx}" y="{(sy(y0)+sy(y1))/2+dy}" fill="{c}" font-size="10.5" font-weight="800" '
                 f'paint-order="stroke" stroke="#fff" stroke-width="3.5" text-anchor="middle">{t}</text>')
    return "".join(o)

g_spf = graph([{"f": lambda x: x * x, "color": MUT, "dash": True, "width": 1.8, "label": "x²", "label_at": (2.3, 5.0)},
               {"f": lambda x: (x - 1) ** 2 - 4, "label": "y = (x − 1)² − 4", "label_at": (3.9, 4.6), "anchor": "end"}],
              xr=(-3, 5), yr=(-5, 6), w=280, h=300,
              points=[{"x": 1, "y": -4, "label": "S(1|−4)", "color": MARK, "r": 5, "off": (9, 5)}],
              extra=lambda sx, sy: pfeile(sx, sy, [(0, 0, 1, 0, B, "1 rechts", 0, -7), (1, 0, 1, -4, C, "4 runter", -26, 0)]))

weg = f"""<div class="card" style="padding:8px 12px;margin-bottom:8px"><div class="boxt">🔁 Zwei Formen – ein Graph</div>
<div class="wege"><div class="form-k"><b>Scheitelpunktform</b><span class="m">y = {col(A,'a')}(x + {col(B,'d')})² + {col(C,'e')}</span><span class="mut small">S sofort ablesen</span></div>
<div class="pfeile"><span>ausmultiplizieren →</span><span>← quadratische Ergänzung</span></div>
<div class="form-k"><b>Normalform</b><span class="m">y = {col(A,'a')}x² + {col(B,'b')}x + {col(C,'c')}</span><span class="mut small">für p-q und Schnittpunkte</span></div></div></div>"""

page("14", "📍", "Die Scheitelpunktform",
     "In y = a(x + d)² + e steht der Scheitelpunkt schon drin (Schreibweise wie im Tafelwerk). Und mit den binomischen Formeln kommst du zur Normalform.", f"""
<div class="formula">y = {col(A,'a')} · ({col(X,'x')} + {col(B,'d')})² + {col(C,'e')} &nbsp;⟹&nbsp; S(−{col(B,'d')} | {col(C,'e')})</div>
{weg}
<div class="grid2">
<div>{box("merk", "Was bedeuten d und e?", f"<p>{col(B,'d')}: verschiebt nach links oder rechts – aber <b>andersherum</b>: d positiv → <b>links</b>, d negativ → <b>rechts</b>. Der Scheitelpunkt liegt bei x = −{col(B,'d')}.</p>"
  f"<p>{col(C,'e')}: so weit nach <b>oben</b> (e negativ: nach unten) – wie das c von Seite 10.</p>"
  f"<p>{col(A,'a')}: Öffnung und Form, genau wie bisher.</p>")}
{box("achtung", "Fehlerfalle: Vorzeichen in der Klammer", f"<p class='m'>(x <b>+</b> 3)² → d = 3 &nbsp;→ S bei x = <b>−3</b> → links<br>(x <b>−</b> 2)² → d = −2 → S bei x = <b>+2</b> → rechts</p>"
  f"<p>Die x-Koordinate von S ist immer das <b>Gegenteil</b> von {col(B,'d')}. Trick: Was muss man für x einsetzen, damit die Klammer 0 wird? Das ist die x-Koordinate von S.</p>")}
{box("so", "So geht's: Scheitelpunktform → Normalform", steps(
  "<b>Klammer quadrieren</b> – vier Bögen (Seite 13) oder binomische Formel (Seite 14):<br><span class='m'>(x + d)² = x² + 2·d·x + d²</span><br>Steht ein Minus drin, die 2. Formel: <span class='m'>(x − 1)² = x² − 2x + 1</span>",
  f"<b>Mit {col(A,'a')} ausmultiplizieren</b> – jedes Glied in der Klammer!",
  f"<b>Zusammenfassen:</b> die Zahlen ohne x mit {col(C,'e')} verrechnen."))}
{box("achtung", "Fehlerfallen beim Ausmultiplizieren", "<p>• (x − 1)² ist <b>nicht</b> x² − 1² – das mittlere Glied −2x fehlt dann. Immer die binomische Formel!</p>"
  "<p>• 2·(x² + 2x + 1): das <b>+1</b> am Ende auch mal 2 nehmen → +2.</p>")}
</div>
<div><div class="card graphcard">{g_spf}<p class="cap">Normalparabel 1 nach rechts, 4 nach unten → S(1|−4)</p></div>
{box("so", "Beispiel 1: y = (x − 1)² − 4", "<p class='m'>= (x² − 2·1·x + 1²) − 4<br>= x² − 2x + 1 − 4<br>= <b>x² − 2x − 3</b></p><p class='small'>d = −1, e = −4 → <b>S(1 | −4)</b></p><p class='small mut'>Genau die Funktion von der p-q-Seite (Seite 17).</p>")}
{box("so", "Beispiel 2: y = 2(x + 1)² − 3", f"<p class='m'>= 2·(x² + 2x + 1) − 3<br>= 2x² + 4x + 2 − 3<br>= <b>2x² + 4x − 1</b></p><p class='small'>d = 1, e = −3 → <b>S(−1 | −3)</b></p>")}
</div></div>
<div class="videos">{video("J6pEEA7B9-g", "Parabel – Scheitelpunkt ablesen")}{video("9jPuMJhEt0o", "y=(x−2)² und y=(x−2)²−2 – Parabeln zeichnen")}</div>""")

# ── 13 Quadratische Ergänzung ────────────────────────────────────────────
g_qe = graph([{"f": lambda x: x * x - 6 * x + 5, "label": "y = x² − 6x + 5", "label_at": (6.6, 5.2), "anchor": "end"}],
             xr=(-1, 7), yr=(-5, 6), w=270, h=290,
             points=[{"x": 3, "y": -4, "label": "S(3|−4)", "color": MARK, "r": 5, "off": (9, 5)},
                     {"x": 1, "y": 0, "color": Y, "r": 4.5}, {"x": 5, "y": 0, "color": Y, "r": 4.5}])
page("15", "🧩", "Quadratische Ergänzung: Normalform → Scheitelpunktform",
     "Der Trick: Man ergänzt die Zahl, die zur binomischen Formel fehlt – und zieht sie gleich wieder ab. Dann steht S da.", f"""
<div class="grid2 wide-left">
<div>{box("so", "So geht's – Beispiel y = x² − 6x + 5", steps(
  f"<b>Halbe Zahl vor x</b> nehmen, mit Vorzeichen: {col(B,'−6')} : 2 = {col(B,'−3')}.<br>Das ist {col(B,'d')} – es kommt in die Klammer (x + d) = (x − 3).",
  f"<b>Quadrat davon ergänzen und gleich wieder abziehen:</b> ({col(B,'−3')})² = 9<br><span class='m'>y = x² − 6x <b>+ 9 − 9</b> + 5</span>",
  "<b>Binomische Formel rückwärts:</b> die ersten drei Glieder werden eine Klammer<br><span class='m'>y = (x − 3)² − 9 + 5</span>",
  f"<b>Zusammenfassen:</b> <span class='m'>y = (x − 3)² − 4</span><br>d = −3, e = −4 &nbsp;⟹&nbsp; <b>S(−d | e) = S(3 | −4)</b>"))}
{box("so", "Wenn vor x² eine Zahl steht – Beispiel y = 2x² + 8x + 3", steps(
  f"<b>{col(A,'a')} ausklammern</b>, aber nur aus den x-Gliedern:<br><span class='m'>y = 2(x² + 4x) + 3</span>",
  "<b>In der Klammer ergänzen:</b> d = 4 : 2 = 2, d² = 4<br><span class='m'>y = 2(x² + 4x + 4 − 4) + 3</span>",
  "<b>Klammer bilden:</b><br><span class='m'>y = 2((x + 2)² − 4) + 3</span>",
  f"<b>Die −4 mit {col(A,'a')} herausholen:</b><br><span class='m'>y = 2(x + 2)² − 8 + 3</span><br><span class='m'>y = 2(x + 2)² − 5</span> &nbsp;⟹&nbsp; d = 2: <b>S(−2 | −5)</b>"))}
</div>
<div><div class="card graphcard">{g_qe}<p class="cap">x² − 6x + 5 = (x − 3)² − 4 &nbsp;·&nbsp; blaue Punkte: Nullstellen 1 und 5</p></div>
{box("merk", "Merke", "<p>Ergänzen heißt: <b>+ Zahl − Zahl</b>. Insgesamt hast du 0 dazugezählt – der Term bleibt gleich, er sieht nur anders aus.</p>")}
{box("achtung", "Fehlerfallen", "<p>• Nur ergänzen, nicht abziehen → falscher Term.</p><p>• Bei a ≠ 1: die abgezogene Zahl steht in der Klammer und muss <b>mal a</b> heraus (−4 · 2 = −8).</p><p>• Halbieren vergessen: bei −6x ist d = −3, nicht −6.</p><p>• S falsch abgelesen: bei (x − 3)² ist S bei x = <b>+3</b>.</p>")}
{box("tool", "Kontrolle", "<p>Probe durch Ausmultiplizieren (vier Bögen, Seite 13). Oder im Funktionen-Tool: Term eingeben, auf <b>Scheitelpunktform</b> klicken – das Tool formt um und zeigt S.</p>")}
</div></div>
<div class="videos">{video("0DXjdwpJ3S0", "Quadratische Ergänzung – von der Normalform zur Scheitelpunktform")}{video("jiIii_3DwUw", "1. binomische Formel mit Übungen")}</div>""")

# ── 14 pq-Formel ─────────────────────────────────────────────────────────
g12 = graph([{"f": lambda x: x * x - 2 * x - 3, "label": "y = x² − 2x − 3", "label_at": (3.35, 4.5), "anchor": "end"}],
            xr=(-3, 5), yr=(-5, 6), w=270, h=290,
            points=[{"x": -1, "y": 0, "label": "x₁ = −1", "color": Y, "r": 5, "off": (-6, -8), "anchor": "end", "lcolor": Y},
                    {"x": 3, "y": 0, "label": "x₂ = 3", "color": Y, "r": 5, "off": (6, -8), "lcolor": Y},
                    {"x": 1, "y": -4, "label": "S(1|−4)", "color": MARK, "r": 5, "off": (8, 4)}])
def mini(f, t):
    return '<div class="minig">' + graph([{"f": f}], xr=(-2, 4), yr=(-4, 4), w=150, h=130, labels_every=2) + f"<p class='cap'>{t}</p></div>"
page("16", "🚀", "Nullstellen mit der p-q-Formel",
     "Kommt ein x ohne Quadrat dazu (y = ax² + bx + c), hilft Ablesen nicht mehr. Die Nullstellen liefert die p-q-Formel.", f"""
<div class="grid2 wide-left">
<div>{box("merk", "Was sind Nullstellen?", f"<p>Die Stellen, an denen die Parabel die <b>x-Achse</b> schneidet. Dort ist {col(Y,'y = 0')}. Man setzt also den Term = 0 und löst nach {col(X,'x')} auf.</p>")}
<div class="card" style="padding:9px 12px;margin-bottom:8px"><div class="boxt">📏 Die p-q-Formel</div>
<p>Gilt nur für die Form <span class="m">x² + {col(B,'p')}x + {col(C,'q')} = 0</span> (vor x² steht 1!)</p>
<div class="formula small-f">\\( x_{{1,2}} = -\\frac{{\\color{{{B}}}p}}{{2}} \\pm \\sqrt{{\\left(\\frac{{\\color{{{B}}}p}}{{2}}\\right)^2 - {{\\color{{{C}}}q}}}} \\)</div></div>
{box("so", "So geht's – Beispiel 2x² − 4x − 6 = 0", steps(
  f"<b>Auf 1 bringen:</b> Steht vor x² eine Zahl ≠ 1, teile <b>alles</b> durch {col(A,'a')}: &nbsp;<span class='m'>2x² − 4x − 6 = 0 &nbsp;|: 2 &nbsp;→ x² − 2x − 3 = 0</span>",
  f"<b>p und q ablesen</b> – mit Vorzeichen: {col(B,'p = −2')}, {col(C,'q = −3')}.",
  f"<b>Einsetzen:</b> <span class='m'>x = −({col(B,'−2')})/2 ± √( ({col(B,'−2')}/2)² − ({col(C,'−3')}) )</span>",
  "<b>Ausrechnen:</b> <span class='m'>x = 1 ± √(1 + 3) = 1 ± √4 = 1 ± 2</span>",
  f"<b>Zwei Lösungen:</b> <span class='m'>{col(Y,'x₁ = 1 − 2 = −1')}, &nbsp;{col(Y,'x₂ = 1 + 2 = 3')}</span>",
  "<b>Probe:</b> (−1)² − 2·(−1) − 3 = 1 + 2 − 3 = 0 ✔"))}
</div>
<div><div class="card graphcard">{g12}</div>
{box("achtung", "Fehlerfallen", "<p>• Vergessen, durch a zu teilen.</p><p>• Vorzeichen: Bei <b>−</b>2x ist p = <b>−2</b>, dann ist −p/2 = <b>+1</b>.</p><p>• Minus vor q: − (−3) = + 3.</p>")}
</div></div>
<div class="card" style="padding:8px 12px;margin-bottom:8px"><div class="boxt">🔍 Was unter der Wurzel steht, entscheidet: die Diskriminante D = (p/2)² − q</div>
<div class="grid3 tight">{mini(lambda x: x*x-2*x-3, "D &gt; 0 → <b>2</b> Nullstellen<br>x² − 2x − 3: D = 4")}{mini(lambda x: x*x-2*x+1, "D = 0 → <b>1</b> Nullstelle<br>x² − 2x + 1: D = 0")}{mini(lambda x: x*x-2*x+3, "D &lt; 0 → <b>keine</b> Nullstelle<br>x² − 2x + 3: D = −2 (√ geht nicht!)")}</div></div>
{tool("pq", "In der f(x)-Zeile steht bei x = −1 und bei x = 3 eine 0. Das sind die Nullstellen – wie mit der p-q-Formel berechnet.")}
<div class="videos">{video("EwITpDN5W1w", "PQ-Formel – Nullstellen berechnen")}{video("MA3Gma66Jvw", "Quadratische Funktion – Nullstellen berechnen")}{video("RWK9MJj_3CU", "Keine Nullstelle – warum keine Wurzel aus negativen Zahlen")}</div>""")

# ── 15 Schnittpunkte ─────────────────────────────────────────────────────
g_sp = graph([{"f": lambda x: x * x - 1, "label": "f(x) = x² − 1", "label_at": (-1.7, 5.4)},
              {"f": lambda x: x + 1, "color": Y, "label": "g(x) = x + 1", "label_at": (3.9, 3.7), "anchor": "end"}],
             xr=(-3, 4), yr=(-2, 6), w=270, h=290,
             points=[{"x": -1, "y": 0, "label": "S₁(−1|0)", "color": MARK, "r": 5, "off": (-10, -8), "anchor": "end"},
                     {"x": 2, "y": 3, "label": "S₂(2|3)", "color": MARK, "r": 5, "off": (-9, -8), "anchor": "end"}])
page("17", "✖️", "Schnittpunkte berechnen",
     "Wo sich zwei Graphen schneiden, haben beide Funktionen denselben y-Wert. Also: gleichsetzen und nach x auflösen.", f"""
<div class="formula">f(x) = g(x)</div>
<div class="grid2 wide-left">
<div>{box("so", "So geht's – Parabel und Gerade: f(x) = x² − 1, g(x) = x + 1", steps(
  "<b>Gleichsetzen:</b> <span class='m'>x² − 1 = x + 1</span>",
  "<b>Alles auf eine Seite</b>, rechts bleibt 0: <span class='m'>x² − 1 − x − 1 = 0 → x² − x − 2 = 0</span>",
  f"<b>p-q-Formel</b> (Seite 17): {col(B,'p = −1')}, {col(C,'q = −2')}<br><span class='m'>x = 0,5 ± √(0,25 + 2) = 0,5 ± 1,5</span> &nbsp;→&nbsp; {col(X,'x₁ = −1')}, {col(X,'x₂ = 2')}",
  f"<b>y ausrechnen:</b> x in eine der beiden Funktionen einsetzen (die Gerade ist leichter):<br><span class='m'>g(−1) = 0, &nbsp;g(2) = 3</span>",
  "<b>Antwort mit Punkten:</b> <span class='m'><b>S₁(−1 | 0)</b>, &nbsp;<b>S₂(2 | 3)</b></span>",
  "<b>Probe</b> mit der anderen Funktion: f(2) = 4 − 1 = 3 ✔"))}
{box("so", "Zwei Geraden: f(x) = 2x + 1, g(x) = −x + 4", "<p class='m'>2x + 1 = −x + 4 &nbsp;| + x − 1<br>3x = 3 &nbsp;| : 3<br>x = 1 → y = 2·1 + 1 = 3 → <b>S(1 | 3)</b></p><p class='small mut'>Kein x²: keine p-q-Formel nötig, nur umstellen.</p>")}
</div>
<div><div class="card graphcard">{g_sp}</div>
{box("merk", "Wie viele Schnittpunkte?", "<p>Das sagt die Diskriminante D der Gleichung nach Schritt 2:</p><p>D &gt; 0: <b>zwei</b> &nbsp;·&nbsp; D = 0: <b>einer</b> (die Gerade berührt nur) &nbsp;·&nbsp; D &lt; 0: <b>keiner</b></p>")}
{box("achtung", "Fehlerfallen", "<p>• Nur x angeben – ein Schnittpunkt braucht <b>x und y</b>.</p><p>• Beim Rüberbringen Vorzeichen drehen: aus <b>+ x</b> rechts wird <b>− x</b> links.</p><p>• Zwei Parabeln: x² kann wegfallen (x² − x² = 0) – dann einfach linear weiter.</p>")}
{box("tool", "Probier's aus", "<p>Funktionen-Tool: f = <span class='m'>x^2-1</span>, mit »＋ weitere Funktion« g = <span class='m'>x+1</span>. Das Tool markiert S1 und S2 und schreibt die Koordinaten in die Legende.</p>")}
</div></div>
<div class="videos">{video("i361KL1OumQ", "Gleichsetzungsverfahren – Gleichungssysteme lösen")}{video("HFMpd5EjahE", "Lineare Funktionen – gibt es einen Schnittpunkt?")}{video("aGmxlKRxT8w", "PQ-Formel – schwierige Aufgaben")}</div>""")

# ── 16 Übungen ───────────────────────────────────────────────────────────
ex = [
 ("Symbole", "Setze &lt;, &gt; oder = ein: &nbsp;a) −4 ☐ −7 &nbsp; b) 3² ☐ 2³ &nbsp; c) (−2)² ☐ −2²"),
 ("Koordinaten", "Zeichne ein Koordinatensystem von −5 bis 5 und trage ein: A(4|1), B(−3|2), C(−1|−4), D(0|3)."),
 ("Quadrat & Wurzel", "a) 13² &nbsp; b) 17² &nbsp; c) √196 &nbsp; d) √361 &nbsp; e) Zwischen welchen ganzen Zahlen liegt √50?"),
 ("Wertetabelle", "Erstelle von Hand eine Wertetabelle für y = x² − 2 (x von −3 bis 3). Prüfe mit dem Casio."),
 ("Linear", "Zeichne y = 3x − 2 und y = −x + 4 mit Steigungsdreieck. Wo schneiden sie sich (ablesen)?"),
 ("Steckbrief", "Gib S, Öffnung und Form an: a) y = 3x² − 1 &nbsp; b) y = −¼x² + 2 &nbsp; c) y = −x² − 3"),
 ("Klammern quadrieren", "Mit den vier Bögen: a) (x + 4)² &nbsp; b) (x − 5)² &nbsp; c) (x + 6)(x − 6) &nbsp; d) 31² im Kopf"),
 ("Scheitelpunktform", "S ablesen, in Normalform umformen: a) y = (x − 3)² + 1 &nbsp; b) y = −(x + 2)² + 5 &nbsp; c) y = 3(x − 1)² − 4"),
 ("Quadr. Ergänzung", "In Scheitelpunktform bringen, S angeben: a) y = x² + 4x + 1 &nbsp; b) y = x² − 10x + 20 &nbsp; c) y = 2x² − 12x + 7"),
 ("p-q-Formel", "Berechne die Nullstellen: a) x² − 6x + 5 = 0 &nbsp; b) 2x² + 4x − 16 = 0 &nbsp; c) x² + 2x + 5 = 0"),
 ("Schnittpunkte", "Berechne die Schnittpunkte: a) f(x) = x² − 3, g(x) = 2x &nbsp; b) f(x) = x² + 1, g(x) = 2x &nbsp; c) f(x) = x² + 2, g(x) = x"),
]
sol = [
 "a) −4 &gt; −7 &nbsp; b) 9 &gt; 8 &nbsp; c) 4 &gt; −4",
 "A: 4 rechts, 1 hoch · B: 3 links, 2 hoch · C: 1 links, 4 runter · D: auf der y-Achse bei 3",
 "a) 169 &nbsp; b) 289 &nbsp; c) 14 &nbsp; d) 19 &nbsp; e) 7 und 8 (49 &lt; 50 &lt; 64)",
 "x: −3 −2 −1 0 1 2 3 → y: 7 2 −1 −2 −1 2 7",
 "Schnittpunkt (1,5|2,5): 3·1,5 − 2 = 2,5 und −1,5 + 4 = 2,5 ✔",
 "a) S(0|−1), oben, gestreckt &nbsp; b) S(0|2), unten, gestaucht &nbsp; c) S(0|−3), unten, normal",
 "a) x² + 8x + 16 &nbsp; b) x² − 10x + 25 &nbsp; c) x² − 36 &nbsp; d) (30 + 1)² = 900 + 60 + 1 = 961",
 "a) S(3|1): x² − 6x + 10 &nbsp; b) S(−2|5): −x² − 4x + 1 &nbsp; c) S(1|−4): 3x² − 6x − 1",
 "a) (x + 2)² − 3, S(−2|−3) &nbsp; b) (x − 5)² − 5, S(5|−5) &nbsp; c) 2(x − 3)² − 11, S(3|−11)",
 "a) p=−6, q=5: x = 3 ± 2 → 1 und 5 &nbsp; b) |:2 → x²+2x−8=0: x = −1 ± 3 → −4 und 2 &nbsp; c) D = 1 − 5 = −4 &lt; 0 → keine Nullstelle",
 "a) x² − 2x − 3 = 0 → x = 1 ± 2: S₁(−1|−2), S₂(3|6) &nbsp; b) x² − 2x + 1 = 0, D = 0: Berührpunkt (1|2) &nbsp; c) x² − x + 2 = 0, D = −1,75: kein Schnittpunkt",
]
page("18", "✍️", "Übungen und Lösungen",
     "Schritt 4 und 5 aus dem Lernkreislauf: selber machen – dann vergleichen. Lösungen erst danach anschauen!", f"""
<ol class="ex">{"".join(f"<li><b>{t}:</b> {a}</li>" for t, a in ex)}</ol>
<div class="card sol"><div class="boxt">✅ Lösungen zum Vergleichen</div><ol class="ex small">{"".join(f"<li>{s}</li>" for s in sol)}</ol></div>
<div class="grid2">
{box("tool", "Prüfen mit dem Funktionen-Tool", "<p>Aufgaben 4–11 kannst du im Funktionen-Tool kontrollieren: Term eingeben, Tabelle vergleichen, Scheitelpunkt und Nullstellen im Graphen ablesen (über den Graphen fahren zeigt den Punkt).</p>")}
{box("merk", "Wenn etwas nicht klappt", "<p>1. Zurück zur passenden Seite in diesem Heft.<br>2. Das Video dazu anschauen.<br>3. Die Aufgabe noch einmal ohne Hilfe.<br>4. Immer noch nicht? Frag nach – mit genau der Zeile, wo du hängst.</p>")}
</div>""")

CSS = f"""
@page {{ size: A4; margin: 0; }}
:root {{ --bg:#f4f0ea; --surface:#fff; --border:{LINE}; --text:{TXT}; --muted:{MUT}; --accent:{ACC}; --green:#6a921a; --red:#c83030; }}
* {{ box-sizing: border-box; }}
html, body {{ margin:0; background:var(--bg); color:var(--text); font-family: system-ui, "Segoe UI", sans-serif; font-size: 11.4px; line-height: 1.38;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.page {{ width:210mm; height:297mm; padding:9mm 11mm 7mm; display:flex; flex-direction:column; break-after:page; overflow:hidden; position:relative; background:var(--bg); }}
.content {{ flex:1; zoom:1.12; }}
header {{ border-bottom: 3px solid var(--accent); padding-bottom:5px; margin-bottom:8px; }}
.hl {{ display:flex; gap:10px; align-items:center; }}
.em {{ font-size:30px; width:46px; height:46px; display:grid; place-items:center; background:var(--surface); border:1px solid var(--border); border-radius:14px; }}
.kicker {{ font-size:9px; text-transform:uppercase; letter-spacing:.08em; font-weight:800; color:var(--accent); }}
h1 {{ font-size:21px; font-weight:900; letter-spacing:-.02em; margin:0; line-height:1.15; }}
.sub {{ margin:2px 0 0; color:var(--muted); font-size:11px; }}
footer {{ display:flex; justify-content:space-between; color:var(--muted); font-size:8.5px; border-top:1px solid var(--border); padding-top:4px; margin-top:6px; }}
.card {{ background:var(--surface); border:1px solid var(--border); border-radius:16px; }}
.grid2 {{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }}
.grid2.wide-left {{ grid-template-columns: 1.25fr 1fr; }}
.grid3 {{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap:9px; }}
.grid3.tight {{ gap:6px; }}
.box {{ background:var(--surface); border:1px solid var(--border); border-left:5px solid var(--accent); border-radius:12px; padding:7px 10px 7px; margin-bottom:8px; break-inside:avoid; }}
.box p {{ margin:3px 0; }}
.boxt {{ font-weight:900; font-size:11.5px; margin-bottom:3px; }}
.box.so {{ border-left-color:{Y}; }} .box.so .boxt {{ color:{Y}; }} .box.so .boxt::before {{ content:"🛠 "; }}
.box.merk {{ border-left-color:var(--green); background:#f6faee; }} .box.merk .boxt {{ color:#4d6c10; }} .box.merk .boxt::before {{ content:"💡 "; }}
.box.achtung {{ border-left-color:var(--red); background:#fdf3f2; }} .box.achtung .boxt {{ color:var(--red); }} .box.achtung .boxt::before {{ content:"⚠️ "; }}
.box.tool {{ border-left-color:{X}; background:#f6f3ff; }} .box.tool .boxt {{ color:#6d3fd6; }} .box.tool .boxt::before {{ content:"📈 "; }}
.box-mini {{ display:inline-block; border-radius:999px; padding:2px 9px; margin:2px 4px 2px 0; font-size:9.5px; font-weight:800; border:1px solid; }}
.box-mini.so {{ color:{Y}; border-color:{Y}; }} .box-mini.merk {{ color:#4d6c10; border-color:var(--green); background:#f6faee; }}
.box-mini.achtung {{ color:var(--red); border-color:var(--red); background:#fdf3f2; }} .box-mini.tool {{ color:#6d3fd6; border-color:{X}; background:#f6f3ff; }}
ol.steps {{ margin:3px 0 1px; padding:0; list-style:none; counter-reset:s; }}
ol.steps li {{ counter-increment:s; position:relative; padding-left:24px; margin:3.5px 0; }}
ol.steps li::before {{ content:counter(s); position:absolute; left:0; top:-1px; width:17px; height:17px; border-radius:50%; background:var(--accent); color:#fff; font-weight:900; font-size:9.5px; display:grid; place-items:center; }}
.m {{ font-family: "Cambria Math", Cambria, "Times New Roman", serif; font-size:1.12em; }}
.center {{ text-align:center; }} .mut {{ color:var(--muted); }} .small {{ font-size:9.6px; }}
.formula {{ text-align:center; font-family:"Cambria Math", Cambria, serif; font-size:26px; font-weight:700; background:var(--surface); border:2px solid var(--accent); border-radius:14px; padding:4px 10px; margin:0 auto 8px; width:max-content; min-width:40%; }}
.formula.small-f {{ font-size:15px; border-width:1px; margin:6px auto 4px; }}
.graphcard {{ padding:6px; display:flex; flex-direction:column; align-items:center; margin-bottom:8px; }}
.graph {{ display:block; max-width:100%; height:auto; font-family:system-ui, sans-serif; }}
.cap {{ font-size:9.4px; color:var(--muted); text-align:center; margin:2px 0 0; }}
.videos {{ display:flex; gap:8px; margin-top:2px; }}
.videos.col {{ flex-direction:column; justify-content:center; }}
.video {{ flex:1; display:flex; gap:8px; align-items:center; text-decoration:none; color:inherit; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:5px 8px 5px 5px; break-inside:avoid; }}
.video .qr {{ width:54px; height:54px; flex:none; }} .video .qr svg {{ width:54px; height:54px; display:block; }}
.vlabel {{ font-size:8.5px; font-weight:900; color:#c4302b; text-transform:uppercase; letter-spacing:.05em; }}
.vtitle {{ font-weight:800; font-size:10.3px; line-height:1.25; }}
.vurl {{ font-size:8.5px; color:var(--muted); }}
table {{ border-collapse:collapse; }}
.symtab {{ width:100%; background:var(--surface); border-radius:12px; overflow:hidden; margin-bottom:9px; border:1px solid var(--border); }}
.symtab th {{ text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); padding:4px 7px; background:#ede8e0; }}
.symtab td {{ padding:3.2px 7px; border-top:1px solid #ece6da; }}
.symtab td.sym {{ font-size:17px; font-weight:900; color:var(--accent); white-space:nowrap; }}
.casetab td {{ font-size:10px; }}
.wt {{ background:var(--surface); border:1px solid var(--border); border-radius:10px; margin:2px 0 6px; font-variant-numeric:tabular-nums; }}
.wt th, .wt td {{ border:1px solid #e6dfd2; padding:3px 7px; text-align:center; }}
.wt th {{ background:#ede8e0; text-align:left; }}
.wt tr.calc td {{ color:var(--muted); font-size:9.3px; }} .wt tr.calc th {{ font-size:9.3px; color:var(--muted); font-weight:600; }}
.sqtab {{ width:100%; font-variant-numeric:tabular-nums; }}
.sqtab td {{ padding:2.5px 4px; border-bottom:1px dashed #ece6da; font-size:12px; }}
.sqtab .n {{ color:{X}; font-weight:800; display:inline-block; width:30px; text-align:right; }} .sqtab .eq {{ color:var(--muted); margin:0 5px; }}
.sqtab b {{ color:{Y}; }}
.sqrow {{ display:flex; gap:14px; align-items:flex-end; justify-content:center; margin:4px 0; }}
.sqrow div {{ display:flex; flex-direction:column; align-items:center; gap:2px; font-size:10px; }}
.key {{ display:inline-block; min-width:19px; padding:0 5px; margin:1px 1px; border:1px solid #9aa3b5; border-bottom-width:2.5px; border-radius:5px; background:#f1f3f7; font-size:10.5px; font-weight:800; text-align:center; line-height:15px; color:#222; white-space:nowrap; }}
.lcd {{ font-family:Consolas, monospace; background:#c9d4b8; color:#1d2614; border:6px solid #3a3f48; border-radius:10px; padding:6px 10px; font-size:11.5px; margin:0 auto 8px; width:70%; }}
.legend td {{ padding:2.5px 5px; vertical-align:middle; }} .legend td:first-child {{ font-size:15px; white-space:nowrap; }}
.sw {{ display:inline-block; width:22px; height:9px; border-radius:4px; }}
.minig {{ display:flex; flex-direction:column; align-items:center; }}
ol.ex {{ padding-left:20px; margin:4px 0 10px; font-size:11.3px; }} ol.ex li {{ margin:6px 0; }}
ol.ex.small {{ font-size:10.2px; }} ol.ex.small li {{ margin:3px 0; }}
.sol {{ padding:9px 12px; margin-bottom:10px; border-style:dashed; }}
/* Titelseite */
.title {{ background: linear-gradient(180deg, #fff 0%, var(--bg) 42%); }}
.tophead {{ display:flex; align-items:center; gap:10px; color:var(--muted); font-weight:700; font-size:10px; }}
.logo {{ height:34px; }}
.hero {{ margin:16mm 0 8mm; }}
.big {{ font-size:44px; line-height:1.05; letter-spacing:-.03em; margin:4px 0 10px; }}
.lead {{ font-size:13.5px; max-width:150mm; color:var(--text); }}
.title .card {{ padding:12px 14px; }}
.toc {{ margin:4px 0 0; padding-left:20px; font-size:11.5px; }} .toc li {{ margin:2.5px 0; }}
.howto {{ margin-top:10px; }}
.title footer {{ margin-top:auto; }}
.boxlegend {{ margin-top:8px; }}
.cycle {{ max-width:100%; height:auto; }}
.katex {{ font-size:1.05em; }}
.faelle .fall {{ padding:7px 9px; }}
.fall .boegen {{ width:100%; height:auto; max-width:276px; }}
.fall p.m {{ margin:1px 0; font-size:14px; }}
.binom td {{ font-size:11px; }} .binom td.m {{ font-size:14px; white-space:nowrap; }}
.geo {{ padding:8px 12px; }} .geo p {{ margin:4px 0; }}
ol.steps .m {{ white-space:nowrap; }}
.wege {{ display:grid; grid-template-columns: 1fr auto 1fr; gap:10px; align-items:center; }}
.form-k {{ display:flex; flex-direction:column; align-items:center; gap:2px; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:6px; }}
.form-k .m {{ font-size:15px; }}
.pfeile {{ display:flex; flex-direction:column; gap:4px; font-weight:800; font-size:10.5px; color:var(--accent); text-align:center; }}
.toolpanel {{ padding:8px 12px 8px; margin-bottom:8px; border-color:{X}; }}
.tphead {{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px; }}
.tpterm {{ background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:2px 12px; font-size:12px; }}
.tpterm .katex {{ font-size:1.25em; }}
.tpgrid {{ display:grid; grid-template-columns: 1fr; gap:12px; align-items:center; }}
.toolsvg {{ width:300px; height:auto; display:block; font-family:system-ui,sans-serif; }}
.tptab {{ font-size:12px; font-variant-numeric:tabular-nums; width:100%; }}
.tptab th {{ text-align:left; padding:3px 8px 3px 0; color:var(--muted); white-space:nowrap; }}
.tptab td {{ border-left:1px solid var(--border); padding:3px 5px; text-align:center; white-space:nowrap; }}
.tptab tr + tr {{ border-top:1px solid var(--border); }}
.tptab .katex {{ font-size:1em; }}
"""

macros = "{}"
html = f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Mathe Kl. 9 – Grundlagen-Fit</title>
<link rel="stylesheet" href="{KATEX}/katex.min.css"><style>{CSS}</style></head><body>
{''.join(pages)}
<script src="{KATEX}/katex.min.js"></script><script src="{KATEX}/contrib/auto-render.min.js"></script>
<script>renderMathInElement(document.body, {{delimiters:[{{left:'\\\\(',right:'\\\\)',display:false}}], throwOnError:false}});
const bad=[...document.querySelectorAll('.page')].map((p,i)=>[i+1,p.scrollHeight-p.clientHeight]).filter(x=>x[1]>0);
document.body.setAttribute('data-overflow', JSON.stringify(bad));</script>
</body></html>"""
OUT.write_text(html, encoding="utf-8")
print("ok", OUT, len(pages), "Seiten")
