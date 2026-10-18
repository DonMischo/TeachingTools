"""Erzeugt die SVG-Grafiken des Methoden-Kompendiums (Stil wie Folianticas Compendium)."""
import json, os, sys
from collections import Counter
from xml.sax.saxutils import escape

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend", "public", "kompendium")
data = json.load(open(os.path.join(OUT, 'methoden_kompendium.json'), encoding='utf-8'))

BG, CARD, CARD2 = '#0F1E2E', '#1A2A3A', '#162030'
WHITE, SUB, TEXT, GOLD = '#FFFFFF', '#8AADCC', '#E0E8F0', '#C9A227'
KAT = {'didaktik': '#3D7DCA', 'paedagogik': '#2E9466', 'psychologie': '#C2652E'}
EVI = {'stark': '#2E9466', 'mittel': '#3D7DCA', 'begrenzt': '#B8860B', 'praxis': '#6B7B8C', 'umstritten': '#B03A2E'}
FONT = 'Arial, Helvetica, sans-serif'


def wrap(s, size, width):
    maxc = max(4, int(width / (size * 0.53)))
    out, line = [], ''
    for w in s.split():
        if len(line) + len(w) + (1 if line else 0) > maxc and line:
            out.append(line); line = w
        else:
            line = f'{line} {w}' if line else w
    if line: out.append(line)
    return out


def T(x, y, s, size=12, fill=TEXT, anchor='start', weight='normal', width=None, lh=1.3, italic=False):
    lines = wrap(s, size, width) if width else [s]
    st = ' font-style="italic"' if italic else ''
    parts = []
    for i, l in enumerate(lines):
        parts.append(f'<text x="{x}" y="{y + i * size * lh:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}"{st}>{escape(l)}</text>')
    return '\n'.join(parts), len(lines)


def R(x, y, w, h, fill, rx=6, stroke=None):
    s = f' stroke="{stroke}" stroke-width="1.5"' if stroke else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" rx="{rx}"{s}/>'


def frame(w, h, title, subtitle, body):
    head = [R(0, 0, w, h, BG, 12),
            T(w / 2, 38, title, 20, WHITE, 'middle', 'bold')[0],
            f'<line x1="60" y1="50" x2="{w - 60}" y2="50" stroke="{GOLD}" stroke-width="2"/>',
            T(w / 2, 70, subtitle, 12, SUB, 'middle')[0]]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" font-family="{FONT}" role="img" aria-label="{escape(title)}">\n'
            + '\n'.join(head + body) + '\n</svg>\n')


def save(name, svg):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(svg)


# 01 Phasenmodelle -----------------------------------------------------------
def svg01():
    W, H = 960, 600
    x0, x1 = 210, 920
    zones = [('EINSTIEG', 0.0, 0.25, '#24425F'), ('HAUPTTEIL', 0.25, 0.78, '#1F3A2E'), ('ABSCHLUSS', 0.78, 1.0, '#4A2E1E')]
    b = []
    for name, a, e, col in zones:
        xa, xe = x0 + a * (x1 - x0), x0 + e * (x1 - x0)
        b.append(R(xa, 88, xe - xa - 4, 486, col, 6))
        b.append(T((xa + xe) / 2, 108, name, 12, WHITE, 'middle', 'bold')[0])
    models = [
        ('Meyer (klassisch)', [('Einstieg', 0, .25), ('Erarbeitung', .25, .78), ('Ergebnissicherung', .78, 1)]),
        ('Roth (1957)', [('Motivation', 0, .12), ('Schwierigkeit', .12, .25), ('Lösung', .25, .42), ('Tun & Ausführen', .42, .6), ('Behalten & Einüben', .6, .78), ('Übertragung', .78, 1)]),
        ('Aebli – PADUA', [('Problemlösend aufbauen', 0, .3), ('Durcharbeiten', .3, .55), ('Üben', .55, .78), ('Anwenden', .78, 1)]),
        ('Gagné – 9 Lernereignisse', [('Aufmerksamkeit · Ziel · Vorwissen', 0, .25), ('Inhalt · Anleitung', .25, .5), ('Ausführen · Feedback', .5, .78), ('Prüfen · Transfer', .78, 1)]),
        ('AVIVA', [('Ankommen', 0, .12), ('Vorwissen', .12, .25), ('Informieren', .25, .5), ('Verarbeiten', .5, .78), ('Auswerten', .78, 1)]),
        ('5E (BSCS)', [('Engage', 0, .25), ('Explore', .25, .43), ('Explain', .43, .6), ('Elaborate', .6, .78), ('Evaluate', .78, 1)]),
        ('Merrill – First Principles', [('Aktivieren', 0, .25), ('Demonstrieren', .25, .5), ('Anwenden', .5, .78), ('Integrieren', .78, 1)]),
        ('Wahl – Sandwich', [('Orientierung', 0, .25), ('Input', .25, .36), ('Verarbeitung', .36, .5), ('Input', .5, .62), ('Verarbeitung', .62, .78), ('Transferplanung', .78, 1)]),
        ('Rosenshine (Prinzipien)', [('Tägliche Wiederholung', 0, .25), ('Kleine Schritte · Modelle · angeleitete Übung', .25, .78), ('Verständnis prüfen · Wiederholen', .78, 1)]),
    ]
    palette = ['#3D7DCA', '#2E9466', '#C2652E', '#7E57C2', '#B8860B', '#2A9DB0']
    y = 124
    for i, (name, steps) in enumerate(models):
        b.append(R(30, y, 170, 44, CARD, 4))
        nl = len(wrap(name, 12, 155))
        b.append(T(40, y + 27 if nl == 1 else y + 19, name, 12, WHITE, weight='bold', width=155, lh=1.2)[0])
        for j, (lab, a, e) in enumerate(steps):
            xa, xe = x0 + a * (x1 - x0) + 2, x0 + e * (x1 - x0) - 6
            b.append(R(xa, y + 6, xe - xa, 32, palette[j % len(palette)], 4))
            size = 11 if (xe - xa) / max(1, len(lab)) > 5.6 else 9.5
            t, n = T((xa + xe) / 2, y + 26 if len(wrap(lab, size, xe - xa - 6)) == 1 else y + 19, lab, size, WHITE, 'middle', width=xe - xa - 6, lh=1.15)
            b.append(t)
        y += 50
    b.append(T(W / 2, 590, 'Quellen: Meyer 1987 · Roth 1957 · Aebli 1983 · Gagné 1985 · Städeli et al. 2010 · Bybee et al. 2006 · Merrill 2002 · Wahl 2013 · Rosenshine 2012', 10.5, SUB, 'middle')[0])
    save('01_phasenmodelle.svg', frame(W, H, 'PHASENMODELLE IM VERGLEICH', 'Alle Modelle teilen die Grundstruktur Einstieg – Hauptteil – Abschluss, setzen aber unterschiedliche Schwerpunkte', b))


# 02 Kontexte ----------------------------------------------------------------
def svg02():
    W, H = 960, 560
    cols = [
        ('KINDER', 'ca. 3–10 Jahre', '#2A9DB0', [
            ('Aufmerksamkeit', 'Kurze Phasen, häufige Wechsel, Bewegung einplanen'),
            ('Was trägt', 'Spiel, Handeln mit Material, Geschichten, Rituale'),
            ('Selbstregulation', 'Exekutive Funktionen im Aufbau – Co-Regulation durch Erwachsene'),
            ('Typische Methoden', 'Angeleitetes Spiel, dialogisches Vorlesen, Good Behavior Game, Gefühlsuhr'),
            ('Vorsicht', 'Abstrakte Reflexion und lange Gruppenarbeiten überfordern'),
        ]),
        ('JUGENDLICHE', 'ca. 11–18 Jahre', '#7E57C2', [
            ('Aufmerksamkeit', 'Längere Phasen möglich, wenn relevant und herausfordernd'),
            ('Was trägt', 'Peers, Status, Autonomie, Sinn und Identität'),
            ('Selbstregulation', 'Wächst, aber Belohnungssensitivität und soziale Bewertung hoch'),
            ('Typische Methoden', 'Peer Instruction, Debatte, Projekte, Klassenrat, WOOP'),
            ('Vorsicht', 'Bloßstellen vor der Gruppe, kontrollierende Sprache, Kinderspiele'),
        ]),
        ('ERWACHSENE', 'Weiterbildung, Teams', '#C2652E', [
            ('Aufmerksamkeit', 'Sandwich – Input höchstens 15–20 Min., dann verarbeiten'),
            ('Was trägt', 'Erfahrung, Problembezug, Nutzen, Mitsprache'),
            ('Selbstregulation', 'Meist hoch, aber Zeit und Transfer sind knapp'),
            ('Typische Methoden', 'Fallarbeit, kollegiale Beratung, World Café, Retrospektive, Transferplan'),
            ('Vorsicht', 'Belehren ohne Bezug, ungefragte Selbstoffenbarung, »Spielchen«'),
        ]),
    ]
    b = []
    cw, gap, x = 290, 20, 35
    for name, age, col, rows in cols:
        b.append(R(x, 90, cw, 52, col, 6))
        b.append(T(x + cw / 2, 113, name, 16, WHITE, 'middle', 'bold')[0])
        b.append(T(x + cw / 2, 132, age, 11, WHITE, 'middle')[0])
        y = 152
        for i, (k, v) in enumerate(rows):
            b.append(R(x, y, cw, 66, CARD if i % 2 == 0 else CARD2, 4))
            b.append(T(x + 12, y + 18, k.upper(), 10.5, col if col != '#7E57C2' else '#B39DDB', weight='bold')[0])
            b.append(T(x + 12, y + 36, v, 11.5, TEXT, width=cw - 24)[0])
            y += 70
        x += cw + gap
    b.append(T(W / 2, 520, 'Entwicklungsstand, Vorwissen und Sprache zählen mehr als das Alter – Altersangaben sind Orientierung.', 12, GOLD, 'middle', italic=True)[0])
    b.append(T(W / 2, 545, 'Quellen: Diamond 2013 · Skene et al. 2022 · Blakemore & Mills 2014 · Knowles et al. 2015 · Wahl 2013', 10.5, SUB, 'middle')[0])
    save('02_kontexte_alter.svg', frame(W, H, 'KONTEXTE – WER LERNT?', 'Was sich zwischen Kindern, Jugendlichen und Erwachsenen für die Methodenwahl ändert', b))


# 03 Methodenlandkarte (datengetrieben) --------------------------------------
def svg03():
    W, H = 960, 540
    M = data['methoden']
    phasen = ['einstieg', 'hauptteil', 'abschluss', 'uebergreifend']
    plab = {'einstieg': 'EINSTIEG', 'hauptteil': 'HAUPTTEIL', 'abschluss': 'ABSCHLUSS', 'uebergreifend': 'ÜBERGREIFEND'}
    kats = ['didaktik', 'paedagogik', 'psychologie']
    klab = {'didaktik': 'DIDAKTIK', 'paedagogik': 'PÄDAGOGIK', 'psychologie': 'PSYCHOLOGIE'}
    stufen = ['stark', 'mittel', 'begrenzt', 'praxis', 'umstritten']
    b = []
    x0, y0, cw, ch = 190, 100, 180, 112
    for j, p in enumerate(phasen):
        b.append(T(x0 + j * cw + cw / 2, y0 - 6, plab[p], 12, WHITE, 'middle', 'bold')[0])
    maxn = max(sum(1 for m in M if m['kategorie'] == k and p in m['phasen']) for k in kats for p in phasen)
    for i, k in enumerate(kats):
        y = y0 + i * ch
        n_k = sum(1 for m in M if m['kategorie'] == k)
        b.append(R(30, y + 4, 150, ch - 8, KAT[k], 6))
        b.append(T(105, y + ch / 2, klab[k], 14, WHITE, 'middle', 'bold')[0])
        b.append(T(105, y + ch / 2 + 18, f'{n_k} Methoden', 11, WHITE, 'middle')[0])
        for j, p in enumerate(phasen):
            sel = [m for m in M if m['kategorie'] == k and p in m['phasen']]
            x = x0 + j * cw
            b.append(R(x + 4, y + 4, cw - 8, ch - 8, CARD, 6))
            b.append(T(x + 16, y + 34, str(len(sel)), 26, WHITE, weight='bold')[0])
            c = Counter(m['evidenz']['stufe'] for m in sel)
            bw = (cw - 32) * len(sel) / maxn
            bx = x + 16
            for s in stufen:
                if c[s]:
                    w = bw * c[s] / len(sel)
                    b.append(f'<rect x="{bx:.1f}" y="{y + 50}" width="{w:.1f}" height="16" fill="{EVI[s]}"/>')
                    bx += w
            st = c['stark']
            b.append(T(x + 16, y + 88, f'davon {st} stark belegt' if st else 'keine stark belegt', 10.5, SUB)[0])
    # Legende
    lx = 190
    b.append(T(30, 470, 'EVIDENZ:', 11, WHITE, weight='bold')[0])
    for s in stufen:
        b.append(R(lx - 92, 460, 14, 14, EVI[s], 2))
        b.append(T(lx - 72, 471, s.capitalize(), 11, TEXT)[0])
        lx += 120
    b.append(T(W / 2, 505, 'Methoden mit mehreren Phasen zählen in jeder Phase. Balkenlänge ∝ Anzahl, Farbanteile = Evidenzstufen.', 11, SUB, 'middle')[0])
    b.append(T(W / 2, 525, f'Stand {data["meta"]["generated"]} · {len(M)} Methoden · {data["meta"]["total_quellen"]} Quellen', 10.5, SUB, 'middle')[0])
    save('03_evidenzlandkarte.svg', frame(W, H, 'METHODENLANDKARTE', 'Wie viele Methoden es je Kategorie und Phase gibt – und wie gut sie belegt sind', b))


# 04 Dunlosky ----------------------------------------------------------------
def svg04():
    W, H = 960, 560
    rows = [
        ('Abrufübung (Practice Testing)', 'hoch', 'Quiz, Karteikarten, Brain Dump ohne Unterlagen'),
        ('Verteiltes Üben (Distributed Practice)', 'hoch', 'Wiederholen nach Tagen und Wochen'),
        ('Elaboratives Fragen', 'mittel', '»Warum ist das so?« beantworten'),
        ('Selbsterklären', 'mittel', 'Jeden Lösungsschritt sich selbst erklären'),
        ('Verschachteltes Üben (Interleaving)', 'mittel', 'Aufgabentypen mischen'),
        ('Zusammenfassen', 'gering', 'Hilft nur, wenn es geübt wurde'),
        ('Markieren / Unterstreichen', 'gering', 'Fühlt sich gut an, bringt wenig'),
        ('Schlüsselwort-Mnemonik', 'gering', 'Nur für bestimmte Vokabeln'),
        ('Bildhafte Vorstellung beim Lesen', 'gering', 'Nur bei bildhaften Texten'),
        ('Wiederlesen', 'gering', 'Deutlich schwächer als Abrufen'),
    ]
    val = {'hoch': 3, 'mittel': 2, 'gering': 1}
    col = {'hoch': '#2E9466', 'mittel': '#3D7DCA', 'gering': '#B03A2E'}
    b = []
    y = 100
    b.append(T(40, y - 8, 'TECHNIK', 11, SUB, weight='bold')[0])
    b.append(T(360, y - 8, 'NUTZEN', 11, SUB, weight='bold')[0])
    b.append(T(620, y - 8, 'IN DER PRAXIS', 11, SUB, weight='bold')[0])
    for i, (name, u, hint) in enumerate(rows):
        b.append(R(30, y, 900, 36, CARD if i % 2 == 0 else CARD2, 4))
        b.append(T(40, y + 23, name, 12.5, TEXT, weight='bold')[0])
        b.append(R(360, y + 9, 70 * val[u], 18, col[u], 3))
        b.append(T(366 + 70 * val[u], y + 23, u.upper(), 11, col[u] if u != 'mittel' else '#7FB2EE', weight='bold')[0])
        b.append(T(620, y + 23, hint, 11.5, SUB)[0])
        y += 40
    b.append(T(W / 2, 520, 'Die beliebtesten Techniken – Wiederlesen und Markieren – gehören zu den schwächsten.', 12.5, GOLD, 'middle', italic=True)[0])
    b.append(T(W / 2, 545, 'Quelle: Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), Psychological Science in the Public Interest, 14(1)', 10.5, SUB, 'middle')[0])
    save('04_lerntechniken_dunlosky.svg', frame(W, H, 'ZEHN LERNTECHNIKEN NACH NUTZEN', 'Bewertung von zehn verbreiteten Lerntechniken über Alter, Fächer und Materialien hinweg', b))


# 05 Kooperative Strukturen --------------------------------------------------
def svg05():
    W, H = 960, 600
    b = []
    # Think-Pair-Share
    b.append(T(40, 104, 'ICH – DU – WIR (THINK – PAIR – SHARE)', 13, GOLD, weight='bold')[0])
    steps = [('ICH', 'allein denken und notieren', '1–5 Min.', '#3D7DCA'), ('DU', 'zu zweit vergleichen, verbessern', '2–5 Min.', '#2E9466'), ('WIR', 'Zufallsauswahl stellt vor', '5–10 Min.', '#C2652E')]
    x = 40
    for i, (k, v, t, c) in enumerate(steps):
        b.append(R(x, 118, 260, 70, c, 8))
        b.append(T(x + 16, 146, k, 20, WHITE, weight='bold')[0])
        b.append(T(x + 80, 142, v, 12, WHITE, width=170)[0])
        b.append(T(x + 80, 176, t, 10.5, WHITE)[0])
        if i < 2:
            b.append(f'<path d="M{x + 264} 153 l18 0 m-7 -7 l7 7 l-7 7" stroke="{GOLD}" stroke-width="2.5" fill="none"/>')
        x += 300
    # Jigsaw
    b.append(T(40, 228, 'GRUPPENPUZZLE (JIGSAW)', 13, GOLD, weight='bold')[0])
    cols = ['#3D7DCA', '#2E9466', '#C2652E', '#7E57C2']
    labels = ['A', 'B', 'C', 'D']
    phases = [('1  Stammgruppen', 'je Person ein Teilthema', 'stamm'), ('2  Expertengruppen', 'gleiches Teilthema erarbeiten', 'experte'), ('3  Stammgruppen', 'einander unterrichten, dann Einzeltest', 'stamm')]
    px = 40
    for title, sub, kind in phases:
        b.append(R(px, 240, 280, 200, CARD, 8))
        b.append(T(px + 140, 262, title, 12.5, WHITE, 'middle', 'bold')[0])
        b.append(T(px + 140, 280, sub, 10.5, SUB, 'middle')[0])
        for g in range(4):
            gx, gy = px + 20 + (g % 2) * 130, 296 + (g // 2) * 70
            b.append(R(gx, gy, 110, 58, CARD2, 6, '#2C4258'))
            for p in range(4):
                cx, cy = gx + 18 + p * 25, gy + 29
                c = cols[p] if kind == 'stamm' else cols[g]
                lab = labels[p] if kind == 'stamm' else labels[g]
                b.append(f'<circle cx="{cx}" cy="{cy}" r="10" fill="{c}"/>')
                b.append(T(cx, cy + 4, lab, 10, WHITE, 'middle', 'bold')[0])
        px += 300
    for ax in (322, 622):
        b.append(f'<path d="M{ax} 340 l14 0 m-6 -6 l6 6 l-6 6" stroke="{GOLD}" stroke-width="2.5" fill="none"/>')
    # 5 Grundelemente
    b.append(T(40, 476, 'FÜNF GRUNDELEMENTE WIRKSAMER GRUPPENARBEIT (Johnson & Johnson)', 13, GOLD, weight='bold')[0])
    el = ['Positive Abhängigkeit', 'Individuelle Verantwortlichkeit', 'Unterstützende Interaktion', 'Soziale Fertigkeiten', 'Gruppenreflexion']
    x = 40
    for e in el:
        b.append(R(x, 488, 168, 50, CARD, 6))
        b.append(T(x + 84, 508 if len(e) > 20 else 518, e, 11.5, TEXT, 'middle', 'bold', width=150)[0])
        x += 176
    b.append(T(W / 2, 580, 'Quellen: Lyman 1981 · Brüning & Saum 2009 · Aronson et al. 1978 · Johnson & Johnson 2009 · Slavin 1996', 10.5, SUB, 'middle')[0])
    save('05_kooperative_strukturen.svg', frame(W, H, 'KOOPERATIVE GRUNDSTRUKTUREN', 'Erst allein denken, dann austauschen – und jede Person ist für das Ergebnis verantwortlich', b))


# 06 Tuckman -----------------------------------------------------------------
def svg06():
    W, H = 960, 520
    ph = [
        ('FORMING', 'Orientierung', 'Unsicherheit, Höflichkeit, Abhängigkeit von Leitung', 'Struktur, Ziele, Kennenlernen, Erwartungen klären', '#3D7DCA'),
        ('STORMING', 'Auseinandersetzung', 'Konflikte um Rollen, Einfluss und Vorgehen', 'Konflikte normalisieren, moderieren, Regeln aushandeln', '#B03A2E'),
        ('NORMING', 'Normbildung', 'Vereinbarungen, Zusammenhalt, Rollen klären sich', 'Vereinbarungen festigen, Verantwortung übergeben', '#B8860B'),
        ('PERFORMING', 'Arbeitsphase', 'Selbststeuerung, Fokus auf Aufgabe, gegenseitige Hilfe', 'Zurücktreten, beraten, Hindernisse aus dem Weg räumen', '#2E9466'),
        ('ADJOURNING', 'Abschluss', 'Bilanz, Abschied, Trauer oder Erleichterung', 'Würdigen, auswerten, Abschlussritual', '#7E57C2'),
    ]
    b = []
    # Leistungskurve
    pts = [(80, 210), (250, 240), (420, 190), (600, 130), (780, 120), (900, 190)]
    d = 'M' + ' L'.join(f'{x} {y}' for x, y in pts)
    b.append(f'<path d="{d}" stroke="{GOLD}" stroke-width="3" fill="none" stroke-linejoin="round"/>')
    b.append(T(40, 100, 'Leistungsfähigkeit der Gruppe', 10.5, SUB)[0])
    x = 30
    for i, (en, de, gruppe, leitung, c) in enumerate(ph):
        cx = x + 88
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            if xa <= cx <= xb:
                cy = ya + (yb - ya) * (cx - xa) / (xb - xa)
        b.append(f'<circle cx="{cx}" cy="{cy:.0f}" r="7" fill="{c}" stroke="{WHITE}" stroke-width="1.5"/>')
        b.append(R(x, 262, 176, 50, c, 6))
        b.append(T(cx, 284, en, 14, WHITE, 'middle', 'bold')[0])
        b.append(T(cx, 302, de, 11, WHITE, 'middle')[0])
        b.append(R(x, 318, 176, 78, CARD, 4))
        b.append(T(x + 10, 334, 'GRUPPE', 9.5, SUB, weight='bold')[0])
        b.append(T(x + 10, 350, gruppe, 11, TEXT, width=158, lh=1.25)[0])
        b.append(R(x, 400, 176, 78, CARD2, 4))
        b.append(T(x + 10, 416, 'LEITUNG', 9.5, GOLD, weight='bold')[0])
        b.append(T(x + 10, 432, leitung, 11, TEXT, width=158, lh=1.25)[0])
        x += 182
    b.append(T(W / 2, 505, 'Heuristik, kein Naturgesetz – Phasen überlappen und kehren wieder. Quellen: Tuckman 1965 · Tuckman & Jensen 1977', 10.5, SUB, 'middle')[0])
    save('06_gruppenphasen.svg', frame(W, H, 'GRUPPENPHASEN UND LEITUNGSVERHALTEN', 'Was in Gruppen typischerweise passiert – und was die Leitung in jeder Phase tun kann', b))


# 07 CASEL -------------------------------------------------------------------
def svg07():
    W, H = 960, 560
    cx, cy = 480, 318
    comp = [
        ('Selbstwahrnehmung', 'Gefühle, Stärken, Werte erkennen', 'Gefühls-Check-in · Stärkenarbeit', -90),
        ('Selbstmanagement', 'Emotionen, Impulse, Ziele steuern', 'Atemübung · WOOP · Selbstinstruktion', -18),
        ('Verantwortungsvolle Entscheidungen', 'Folgen abwägen, ethisch handeln', 'Problemlösetraining · Klassenrat', 54),
        ('Beziehungsfähigkeit', 'Kommunizieren, kooperieren, Konflikte lösen', 'Streitschlichtung · Ich-Botschaften', 126),
        ('Soziale Wahrnehmung', 'Perspektiven übernehmen, Empathie', 'Rollenspiel · Gruppenpuzzle', 198),
    ]
    import math
    b = [f'<circle cx="{cx}" cy="{cy}" r="78" fill="{CARD}" stroke="{GOLD}" stroke-width="2"/>',
         T(cx, cy - 6, 'SOZIAL-', 15, WHITE, 'middle', 'bold')[0], T(cx, cy + 14, 'EMOTIONALES', 15, WHITE, 'middle', 'bold')[0],
         T(cx, cy + 34, 'LERNEN', 15, WHITE, 'middle', 'bold')[0]]
    cols = ['#3D7DCA', '#2E9466', '#C2652E', '#7E57C2', '#2A9DB0']
    for i, (n, d, m, ang) in enumerate(comp):
        a = math.radians(ang)
        bx, by = cx + 250 * math.cos(a), cy + 178 * math.sin(a)
        b.append(f'<line x1="{cx + 80 * math.cos(a):.0f}" y1="{cy + 80 * math.sin(a):.0f}" x2="{bx:.0f}" y2="{by:.0f}" stroke="{cols[i]}" stroke-width="2"/>')
        b.append(R(bx - 130, by - 40, 260, 82, cols[i], 8))
        b.append(T(bx, by - 18, n, 13, WHITE, 'middle', 'bold')[0])
        b.append(T(bx, by + 2, d, 11, WHITE, 'middle')[0])
        b.append(T(bx, by + 22, m, 10.5, '#F0F4F8', 'middle', italic=True)[0])
    b.append(T(W / 2, 548, 'SEL-Programme: +11 Perzentilränge Leistung, bessere Sozialkompetenz (Durlak et al. 2011, 213 Studien) · Rahmenmodell: CASEL', 10.5, SUB, 'middle')[0])
    save('07_casel_kompetenzen.svg', frame(W, H, 'FÜNF SOZIAL-EMOTIONALE KOMPETENZEN', 'Das CASEL-Rahmenmodell mit passenden Methoden aus diesem Kompendium', b))


# 08 Feedback ----------------------------------------------------------------
def svg08():
    W, H = 960, 540
    b = []
    qs = [('FEED UP', 'Wohin gehe ich?', 'Ziele und Erfolgskriterien'), ('FEED BACK', 'Wo stehe ich?', 'Stand bezogen auf Kriterien'), ('FEED FORWARD', 'Was ist der nächste Schritt?', 'Konkreter Verbesserungsschritt')]
    x = 40
    for i, (k, q, d) in enumerate(qs):
        b.append(R(x, 92, 280, 74, ['#3D7DCA', '#2E9466', '#C2652E'][i], 8))
        b.append(T(x + 140, 116, k, 15, WHITE, 'middle', 'bold')[0])
        b.append(T(x + 140, 136, q, 12.5, WHITE, 'middle', italic=True)[0])
        b.append(T(x + 140, 155, d, 11, WHITE, 'middle')[0])
        x += 300
    lv = [
        ('AUFGABE', 'Ist das richtig? Was fehlt?', '»Die Einleitung nennt noch keine These.«', 'wirksam, v. a. bei Fehlern im Wissen', 3),
        ('PROZESS', 'Welche Strategie hilft?', '»Prüfe deine Lösung durch Einsetzen.«', 'sehr wirksam für tieferes Verstehen', 4),
        ('SELBSTREGULATION', 'Wie überwache ich mich selbst?', '»Woran kannst du selbst erkennen, ob es stimmt?«', 'sehr wirksam, fördert Selbstständigkeit', 4),
        ('PERSON', 'Lob oder Tadel der Person', '»Du bist so klug!«', 'kaum wirksam, kann schaden', 1),
    ]
    y = 192
    b.append(T(40, y, 'VIER EBENEN', 12, GOLD, weight='bold')[0])
    b.append(T(560, y, 'BEISPIEL', 11, SUB, weight='bold')[0])
    y += 10
    for i, (n, q, ex, w, s) in enumerate(lv):
        b.append(R(30, y, 900, 62, CARD if i % 2 == 0 else CARD2, 4))
        b.append(T(44, y + 24, n, 13, WHITE, weight='bold')[0])
        b.append(T(44, y + 44, q, 11, SUB)[0])
        for k in range(4):
            b.append(R(300 + k * 26, y + 20, 20, 20, ('#2E9466' if s >= 3 else '#B03A2E') if k < s else '#2C4258', 3))
        b.append(T(410, y + 35, w, 11, TEXT, width=140)[0])
        b.append(T(560, y + 35, ex, 11.5, TEXT, italic=True, width=360)[0])
        y += 66
    b.append(T(W / 2, 490, 'Über ein Drittel der Feedback-Interventionen verschlechtert Leistung – besonders, wenn sie die Aufmerksamkeit auf die Person lenkt.', 12, GOLD, 'middle', italic=True)[0])
    b.append(T(W / 2, 520, 'Quellen: Hattie & Timperley 2007 · Kluger & DeNisi 1996 · Wisniewski, Zierer & Hattie 2020', 10.5, SUB, 'middle')[0])
    save('08_feedback_ebenen.svg', frame(W, H, 'FEEDBACK – DREI FRAGEN, VIER EBENEN', 'Lernförderliches Feedback beantwortet drei Fragen und zielt auf Aufgabe, Prozess und Selbstregulation', b))


# 09 Präventionsstufen -------------------------------------------------------
def svg09():
    W, H = 960, 560
    b = []
    tiers = [
        ('INDIZIERT', 'Personen mit ersten Symptomen', 'fachkraft', 'Kognitive Umstrukturierung · DBT-Skills · Verhaltensaktivierung · Angstprogramme (gezielt)', '#B03A2E', 200),
        ('SELEKTIV', 'Gruppen mit erhöhtem Risiko', 'fortbildung', 'Soziales Kompetenztraining · Daily Report Card · Mentoring · No Blame Approach', '#B8860B', 330),
        ('UNIVERSELL', 'Alle Lernenden einer Gruppe', 'alle', 'Klassenführung · SEL-Unterricht · Atemübung · Gefühls-Check-in · Begrüßung an der Tür', '#2E9466', 460),
    ]
    y = 96
    for name, who, q, ex, c, w in tiers:
        x = 260 - w / 2 + 40
        b.append(f'<polygon points="{x},{y + 110} {x + w},{y + 110} {x + w - 40},{y} {x + 40},{y}" fill="{c}"/>' if False else R(300 - w / 2, y, w, 110, c, 6))
        b.append(T(300, y + 46, name, 16, WHITE, 'middle', 'bold')[0])
        b.append(T(300, y + 68, who, 11.5, WHITE, 'middle', width=w - 20)[0])
        b.append(R(560, y, 370, 110, CARD, 6))
        b.append(T(576, y + 24, 'QUALIFIKATION: ' + {'alle': 'jede Lehr-/Leitungsperson', 'fortbildung': 'mit Schulung/Manual', 'fachkraft': 'psychologische/therapeutische Fachkraft'}[q], 11, c if c != '#2E9466' else '#5CC593', weight='bold', width=340)[0])
        b.append(T(576, y + 54, ex, 11.5, TEXT, width=340)[0])
        y += 122
    b.append(T(W / 2, 486, 'Lehrkräfte erkennen, unterstützen und vermitteln – Diagnostik und Behandlung gehören in Fachhände.', 12.5, GOLD, 'middle', italic=True)[0])
    b.append(T(W / 2, 510, 'Bei Selbst- oder Fremdgefährdung, Gewalt oder Kindeswohlgefährdung: sofort Schulleitung, Schulpsychologie, Krisendienst einbeziehen.', 11, TEXT, 'middle')[0])
    b.append(T(W / 2, 540, 'Quellen: Mrazek & Haggerty 1994 (IOM-Präventionsmodell) · WHO 2011', 10.5, SUB, 'middle')[0])
    save('09_praeventionsstufen.svg', frame(W, H, 'PRÄVENTIONSSTUFEN UND ROLLEN', 'Wer welche psychologischen Methoden einsetzen sollte', b))


# 10 Gesprächsführung --------------------------------------------------------
def svg10():
    W, H = 960, 580
    cols = ['ANSATZ', 'KERNIDEE', 'TYPISCHE FRAGE', 'GUT, WENN …']
    xs = [30, 210, 450, 720]
    ws = [175, 235, 265, 210]
    rows = [
        ('Aktives Zuhören', 'Inhalt und Gefühl spiegeln, nicht bewerten', '»Du bist also enttäuscht, weil …?«', 'jemand sich verstanden fühlen muss', '#2A9DB0'),
        ('Motivierende Gesprächsführung', 'Ambivalenz klären, eigene Gründe für Veränderung stärken', '»Was spricht für dich dafür, es zu ändern?«', 'jemand zwischen Wollen und Nicht-Wollen schwankt', '#3D7DCA'),
        ('Lösungsfokussiert', 'Ziele, Ressourcen und Ausnahmen statt Ursachen', '»Wann war es schon etwas besser? Was war da anders?«', 'schnell kleine Schritte gefunden werden sollen', '#2E9466'),
        ('Systemisch', 'Wechselwirkungen und Perspektiven sichtbar machen', '»Was glaubst du, würde deine Mutter dazu sagen?«', 'Konflikte mehrere Beteiligte betreffen', '#7E57C2'),
        ('Coaching (GROW)', 'Ziel – Realität – Optionen – Wille', '»Was genau wirst du bis wann tun?«', 'Ziele klar und Personen handlungsfähig sind', '#C2652E'),
    ]
    b = []
    for i, c in enumerate(cols):
        b.append(T(xs[i] + 6, 102, c, 11, SUB, weight='bold')[0])
    y = 112
    for i, (n, k, q, g, c) in enumerate(rows):
        b.append(R(30, y, 900, 72, CARD if i % 2 == 0 else CARD2, 4))
        b.append(R(30, y, 6, 72, c, 2))
        b.append(T(xs[0] + 14, y + 26, n, 12.5, WHITE, weight='bold', width=ws[0] - 14)[0])
        b.append(T(xs[1] + 6, y + 24, k, 11.5, TEXT, width=ws[1])[0])
        b.append(T(xs[2] + 6, y + 24, q, 11.5, '#F3D27A', width=ws[2], italic=True)[0])
        b.append(T(xs[3] + 6, y + 24, g, 11.5, TEXT, width=ws[3])[0])
        y += 78
    b.append(T(W / 2, 525, 'Gemeinsame Haltung: Die Person ist Expertin für ihr Leben, die Gesprächsleitung für den Prozess. Ratschläge sparsam und nach Erlaubnis.', 11.5, GOLD, 'middle', italic=True)[0])
    b.append(T(W / 2, 555, 'Quellen: Gordon 1974 · Miller & Rollnick 2013 · de Shazer 1985 · Selvini Palazzoli et al. 1980 · Whitmore 1992', 10.5, SUB, 'middle')[0])
    save('10_gespraechsfuehrung.svg', frame(W, H, 'GESPRÄCHSANSÄTZE IM VERGLEICH', 'Fünf Ansätze für Beratung, Coaching und Konfliktgespräche', b))


for f in (svg01, svg02, svg03, svg04, svg05, svg06, svg07, svg08, svg09, svg10):
    f()
print('SVGs geschrieben nach', OUT)
