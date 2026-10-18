"""Baut methoden_kompendium.json aus den YAML-Teilen und prüft alle Verweise."""
import glob, json, os, sys
from collections import Counter
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'frontend', 'public', 'kompendium')
os.makedirs(OUT, exist_ok=True)

def load(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return yaml.safe_load(f)

LEGENDE = {
    'kategorien': {
        'didaktik': 'Didaktik – Planung, Lehr-Lern-Methoden, Übung, Diagnose',
        'paedagogik': 'Pädagogik – Beziehung, Führung, Gemeinschaft, Konflikt, Erwachsenen- und Teamarbeit',
        'psychologie': 'Psychologie – Motivation, Selbstregulation, Emotion, Stress, Beratung, Prävention, Gruppen',
    },
    'phasen': {
        'einstieg': 'Einstieg / Opener',
        'hauptteil': 'Hauptteil / Erarbeitung, Vertiefung, Übung',
        'abschluss': 'Abschluss / Closer, Sicherung, Reflexion',
        'uebergreifend': 'Übergreifend / Haltung, Planung, Programm',
    },
    'setting': {
        'einzel': 'Einzeln', 'partner': 'Partner', 'kleingruppe': 'Kleingruppe (3–6)',
        'plenum': 'Plenum / Klasse', 'grossgruppe': 'Großgruppe (> 30)',
    },
    'zielgruppen': {
        'kinder': 'Kinder (ca. 3–10)', 'jugendliche': 'Jugendliche (ca. 11–18)', 'erwachsene': 'Erwachsene',
    },
    'anwendung': {
        'vorwissen': 'Vorwissen aktivieren', 'wissensaufbau': 'Wissen aufbauen',
        'verstehen': 'Verstehen & Konzeptwandel', 'ueben': 'Üben, Festigen, Wiederholen',
        'problemloesen': 'Problemlösen & Transfer', 'kreativitaet': 'Ideen & Kreativität',
        'diskussion': 'Gespräch & Argumentation', 'lesen_schreiben': 'Lesen & Schreiben',
        'lernstrategien': 'Lernstrategien & Selbstregulation', 'motivation': 'Motivation & Interesse',
        'diagnose': 'Diagnose & Feedback', 'klassenfuehrung': 'Klassenführung & Verhalten',
        'beziehung': 'Beziehung & Klima', 'konflikt': 'Konflikt & Mobbing',
        'sozial_emotional': 'Sozial-emotionale Kompetenz', 'stress_gesundheit': 'Stress & Gesundheit',
        'teamentwicklung': 'Teamentwicklung', 'partizipation': 'Partizipation & Demokratie',
        'entscheidung': 'Entscheiden & Planen', 'beratung': 'Beratung & Veränderung',
        'reflexion': 'Reflexion & Professionalisierung', 'heterogenitaet': 'Differenzierung & Inklusion',
        'krise': 'Krise & Belastung',
        'therapie': 'Therapie & klinische Arbeit',
    },
    'unterkategorien': {
        'didaktik': {
            'planung': 'Planung, Struktur, Großformen', 'instruktion': 'Instruktion und Erklären',
            'aktivierung': 'Einstiege und Denkroutinen', 'kooperativ': 'Kooperative Lernformen',
            'gespraech': 'Gespräch, Diskussion, Argumentation', 'handlung': 'Handlungs-, Simulations- und Spielformen',
            'selbststaendig': 'Offene und selbstständige Lernformen', 'lesen_schreiben': 'Lesen, Schreiben, Sprache',
            'mathe_nawi': 'Mathematik und Naturwissenschaften', 'ueben': 'Üben, Wiederholen, Gedächtnis',
            'kreativ': 'Ideenfindung und Kreativität', 'visualisierung': 'Visualisieren und Präsentieren',
            'diagnose': 'Diagnose, Feedback, Bewertung', 'reflexion': 'Abschluss und Reflexion',
            'differenzierung': 'Differenzierung und Inklusion',
        },
        'paedagogik': {
            'beziehung': 'Beziehung und Klima', 'fuehrung': 'Klassenführung und Regeln', 'konflikt': 'Konflikt und Mobbing',
            'kommunikation': 'Kommunikation', 'partizipation': 'Partizipation und Engagement',
            'reform': 'Reform- und Frühpädagogik', 'moderation': 'Moderation und Großgruppen',
            'profession': 'Professionalisierung und Kollegium', 'eltern': 'Eltern und Mentoring',
        },
        'psychologie': {
            'motivation': 'Motivation und Ziele', 'kognition': 'Kognition, Gedächtnis, Metakognition',
            'selbststeuerung': 'Selbststeuerung und Gewohnheiten', 'verhalten': 'Verhaltenspsychologie (ABA)',
            'sozial': 'Soziale Kompetenz', 'emotion_stress': 'Emotion, Stress, Entspannung',
            'positiv': 'Positive Psychologie und Ressourcen', 'praevention': 'Präventionsprogramme',
            'beratung': 'Beratung und Gesprächsführung', 'diagnostik': 'Diagnostik', 'gruppe': 'Gruppen und Teams',
            'therapie': 'Therapieverfahren und klinische Arbeit', 'imaginativ': 'Imaginative und hypnosystemische Methoden',
            'krise': 'Krise und Notfall',
        },
    },
    'evidenz': {
        'stark': 'Mehrere Metaanalysen oder große RCTs mit konsistentem Befund',
        'mittel': 'Positive Befunde mit Einschränkungen (Studienzahl, Heterogenität, Umsetzung)',
        'begrenzt': 'Theoretisch plausibel, wenige direkte Studien',
        'praxis': 'Bewährtes Praxisformat ohne eigene Wirksamkeitsforschung',
        'umstritten': 'Widersprüchliche oder schwindende Befunde, Replikationsprobleme',
    },
    'qualifikation': {
        'alle': 'Von jeder Lehr- oder Leitungsperson einsetzbar',
        'fortbildung': 'Schulung oder Manualkenntnis empfohlen',
        'fachkraft': 'Psychologisch/therapeutisch qualifizierte Fachkraft; andere unterstützen und vermitteln',
    },
}

SVG_ASSETS = [
    ('svg_01', '01_phasenmodelle.svg', 'Phasenmodelle im Vergleich', '2.1'),
    ('svg_02', '02_kontexte_alter.svg', 'Kontexte – Kinder, Jugendliche, Erwachsene', '1.2'),
    ('svg_03', '03_evidenzlandkarte.svg', 'Methodenlandkarte nach Kategorie, Phase und Evidenz', '1.3'),
    ('svg_04', '04_lerntechniken_dunlosky.svg', 'Zehn Lerntechniken nach Nutzen (Dunlosky et al. 2013)', '3.2'),
    ('svg_05', '05_kooperative_strukturen.svg', 'Kooperative Grundstrukturen – Ich-Du-Wir und Gruppenpuzzle', '3.4'),
    ('svg_06', '06_gruppenphasen.svg', 'Gruppenphasen nach Tuckman und Leitungsverhalten', '11.1'),
    ('svg_07', '07_casel_kompetenzen.svg', 'Fünf sozial-emotionale Kompetenzen (CASEL)', '9.3'),
    ('svg_08', '08_feedback_ebenen.svg', 'Feedback – drei Fragen, vier Ebenen', '4.4'),
    ('svg_09', '09_praeventionsstufen.svg', 'Präventionsstufen und Qualifikation', '1.4'),
    ('svg_10', '10_gespraechsfuehrung.svg', 'Gesprächsansätze im Vergleich', '10.1'),
]

errors = []
quellen_raw = {}
for f in sorted(glob.glob(os.path.join(HERE, 'quellen*.yml'))):
    quellen_raw.update(load(os.path.basename(f)))
quellen = []
for qid, (autor, jahr, titel, erschienen, ref) in quellen_raw.items():
    q = {'id': qid, 'autor': autor, 'jahr': jahr, 'titel': titel, 'erschienen_in': erschienen}
    if ref.startswith('10.'):
        q['doi'] = ref
        q['url'] = 'https://doi.org/' + ref
    elif ref:
        q['url'] = ref
    quellen.append(q)
qids = {q['id'] for q in quellen}

methoden = []
for f in sorted(glob.glob(os.path.join(HERE, 'm_*.yml'))):
    methoden += load(os.path.basename(f))
kapitel = load('kapitel.yml')
mythen = load('mythen.yml')

ids = Counter(m['id'] for m in methoden)
for k, n in ids.items():
    if n > 1: errors.append(f'doppelte id {k}')
mids = set(ids)

def check_list(m, key, vocab):
    for v in m.get(key, []):
        if v not in vocab: errors.append(f"{m['id']}: {key} '{v}' unbekannt")

used = Counter()
for m in methoden:
    for key in ('id', 'name', 'kategorie', 'phasen', 'setting', 'zielgruppen', 'anwendung', 'kurz', 'evidenz', 'qualifikation', 'quellen'):
        if key not in m: errors.append(f"{m.get('id')}: fehlt {key}")
    if m['kategorie'] not in LEGENDE['kategorien']: errors.append(f"{m['id']}: kategorie")
    check_list(m, 'phasen', LEGENDE['phasen'])
    check_list(m, 'setting', LEGENDE['setting'])
    check_list(m, 'zielgruppen', LEGENDE['zielgruppen'])
    check_list(m, 'anwendung', LEGENDE['anwendung'])
    if m['evidenz']['stufe'] not in LEGENDE['evidenz']: errors.append(f"{m['id']}: evidenz {m['evidenz']['stufe']}")
    if m['qualifikation'] not in LEGENDE['qualifikation']: errors.append(f"{m['id']}: qualifikation")
    if m.get('unterkategorie') not in LEGENDE['unterkategorien'][m['kategorie']]:
        errors.append(f"{m['id']}: unterkategorie '{m['unterkategorie']}' passt nicht zu {m['kategorie']}")
    for q in m['quellen']:
        used[q] += 1
        if q not in qids: errors.append(f"{m['id']}: quelle {q} fehlt")
    for v in m.get('verweise', []):
        if v not in mids: errors.append(f"{m['id']}: verweis {v} fehlt")
svgs = {s[1] for s in SVG_ASSETS}
for k in kapitel:
    for a in k['abschnitte']:
        for q in a['quellen']:
            used[q] += 1
            if q not in qids: errors.append(f"Abschnitt {a['id']}: quelle {q} fehlt")
        if a.get('svg') and a['svg'] not in svgs: errors.append(f"Abschnitt {a['id']}: svg {a['svg']}")
for my in mythen:
    for q in my['quellen']:
        used[q] += 1
        if q not in qids: errors.append(f"Mythos {my['id']}: quelle {q} fehlt")

unused = sorted(qids - set(used))
quellen = [q for q in quellen if q['id'] in used]
quellen.sort(key=lambda q: (q['autor'].lower(), q['jahr']))

if errors:
    print('\n'.join(errors)); sys.exit(1)

# Methoden je Kategorie, dann Phase, dann Name sortieren
phase_order = list(LEGENDE['phasen'])
kat_order = list(LEGENDE['kategorien'])
methoden.sort(key=lambda m: (kat_order.index(m['kategorie']), phase_order.index(m['phasen'][0]), m['name'].lower()))

data = {
    'meta': {
        'title': 'Methoden-Kompendium – Didaktik, Pädagogik, Psychologie',
        'subtitle': 'Wissenschaftlich fundierte Methoden für Einzel- und Gruppensettings mit Kindern, Jugendlichen und Erwachsenen',
        'description': 'Methoden, Werkzeuge und Modelle für Einstieg, Hauptteil und Abschluss von Lerneinheiten und Sitzungen, geordnet nach Kategorie, Kontext und Anwendungsgebiet, mit Evidenzeinschätzung und Quellen.',
        'format_version': '1.0',
        'sprache': 'de',
        'generated': '2026-10-18',
        'total_methoden': len(methoden),
        'total_kapitel': len(kapitel),
        'total_quellen': len(quellen),
        'total_mythen': len(mythen),
        'total_svg_assets': len(SVG_ASSETS),
        'hinweis': 'Evidenzangaben fassen den Forschungsstand zum Zeitpunkt der Erstellung zusammen; DOIs wurden gegen Crossref/doi.org geprüft.',
    },
    'legende': LEGENDE,
    'kapitel': kapitel,
    'methoden': methoden,
    'mythen': mythen,
    'svg_assets': [{'id': i, 'filename': f, 'title': t, 'abschnitt': a} for i, f, t, a in SVG_ASSETS],
    'quellen': quellen,
}
with open(os.path.join(OUT, 'methoden_kompendium.json'), 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Statistik
c = Counter((m['kategorie'], p) for m in methoden for p in m['phasen'])
print('Methoden:', len(methoden), '| Quellen genutzt:', len(quellen), '| ungenutzt:', len(unused))
for k in kat_order:
    print(' ', k, {p: c[(k, p)] for p in phase_order}, 'gesamt', sum(1 for m in methoden if m['kategorie'] == k))
print('Evidenz:', Counter(m['evidenz']['stufe'] for m in methoden))
print('Zielgruppen:', Counter(z for m in methoden for z in m['zielgruppen']))
print('Setting:', Counter(z for m in methoden for z in m['setting']))
print('Anwendung:', Counter(z for m in methoden for z in m['anwendung']).most_common())
print('Ungenutzt:', unused)
