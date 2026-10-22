"""Stundenplanung als Dokument: PDF, DOCX oder LaTeX.

Aus der Planung entsteht erst ein schlichtes HTML-Dokument (Überschriften,
Tabellen, Listen — kein Seiten-Layout), daraus macht pandoc DOCX bzw. LaTeX;
das PDF ist das DOCX, durch LibreOffice geschickt.

Inhaltsverzeichnis: DOCX und LaTeX bekommen ein echtes (Word-Feld bzw.
\\tableofcontents). LibreOffice füllt das Word-Feld beim Umwandeln nicht, darum
trägt das PDF ein ausgeschriebenes Verzeichnis (ohne Seitenzahlen).

Verknüpfte Methoden kommen aus dem Methoden-Kompendium (YAML in
data/methoden_kompendium), ihre Quellen landen nummeriert im Quellenteil.
Verknüpfte Spiele (Caputh, TaskCrawler, Challenge) bringen Aufgaben, Lösungen
und ihre Differenzierung mit — beim TaskCrawler und bei der Challenge samt
der Fuzzy-Regeln aus api/dda.py, damit das Dokument die Anpassung belegt.
"""
import html
import io
import re
import tempfile
import zipfile
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import yaml
from sqlalchemy.orm import Session

from . import dda
from .challenge_engine import STUFE_PARAMS
from .doc_convert import convert_to_pdf
from .models import ChallengeSet, ExitGame, ExitTicketSession, LessonMaterial, LessonPlan, Quiz

KOMPENDIUM_DIR = Path(__file__).parent.parent / "data" / "methoden_kompendium"
MAX_METHODEN = 5

FORMATE = {
    "pdf": ("application/pdf", ".pdf"),
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
    "tex": ("application/x-tex", ".tex"),
}

SOZIALFORM_NAME = {"Plenum": "Plenum", "EA": "Einzelarbeit", "PA": "Partnerarbeit", "GA": "Gruppenarbeit", "Gruppen": "Gruppen"}
EVIDENZ_NAME = {"stark": "stark", "mittel": "mittel", "begrenzt": "begrenzt", "praxis": "Praxiswissen", "umstritten": "umstritten"}
FOLIEN_NAME = {"explanation": "Erklärung", "example": "Beispiel", "task": "Aufgabe", "door": "Tür", "boss": "Bosskampf"}

# Quellen zur Fuzzy-Steuerung (DOIs gegen Crossref geprüft, 2026-10-22)
DDA_QUELLEN = {
    "q_zadeh1965": {"autor": "Zadeh, L. A.", "jahr": 1965, "titel": "Fuzzy sets",
                    "erschienen_in": "Information and Control, 8(3), 338–353", "doi": "10.1016/S0019-9958(65)90241-X"},
    "q_mamdani1975": {"autor": "Mamdani, E. H. & Assilian, S.", "jahr": 1975,
                      "titel": "An experiment in linguistic synthesis with a fuzzy logic controller",
                      "erschienen_in": "International Journal of Man-Machine Studies, 7(1), 1–13",
                      "doi": "10.1016/S0020-7373(75)80002-2"},
    "q_hunicke2005": {"autor": "Hunicke, R.", "jahr": 2005, "titel": "The case for dynamic difficulty adjustment in games",
                      "erschienen_in": "Proceedings of the 2005 ACM SIGCHI International Conference on Advances in "
                                       "Computer Entertainment Technology, 429–433", "doi": "10.1145/1178477.1178573"},
}

# Deutsche Namen der Fuzzy-Größen aus dda.DEFAULT_RULESET
GROESSE = {"response_time": "Antwortzeit (s)", "error_rate": "Fehlerquote (%)", "help_requests": "Hinweisabrufe",
           "retry_count": "Wiederholungen", "difficulty_level": "Schwierigkeit", "npc_helpfulness": "Hilfsbereitschaft",
           "time_limit": "Richtzeit (s)", "scaffolding_level": "Unterstützung (Gerüst)"}
MENGE = {"fast": "schnell", "medium": "mittel", "slow": "langsam", "low": "niedrig", "high": "hoch", "none": "keine",
         "few": "wenige", "many": "viele", "easy": "leicht", "normal": "normal", "hard": "schwer", "very_hard": "sehr schwer",
         "minimal": "minimal", "moderate": "mäßig", "proactive": "proaktiv", "tight": "knapp", "comfortable": "bequem",
         "generous": "großzügig", "hints": "Hinweise", "guided": "geführt", "full": "voll"}


# ── Kompendium ───────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def kompendium() -> tuple[dict, dict]:
    """(Methoden je id, Quellen je id) aus den YAML-Quellen des Kompendiums."""
    methoden: dict[str, dict] = {}
    for f in sorted(KOMPENDIUM_DIR.glob("m_*.yml")):
        for m in yaml.safe_load(f.read_text(encoding="utf-8")) or []:
            methoden[m["id"]] = m
    quellen: dict[str, dict] = {}
    for f in sorted(KOMPENDIUM_DIR.glob("quellen*.yml")):
        for qid, (autor, jahr, titel, erschienen, ref) in (yaml.safe_load(f.read_text(encoding="utf-8")) or {}).items():
            q = {"autor": autor, "jahr": jahr, "titel": titel, "erschienen_in": erschienen}
            if ref.startswith("10."):
                q["doi"] = ref
            elif ref:
                q["url"] = ref
            quellen[qid] = q
    return methoden, quellen


# ── HTML-Bausteine ───────────────────────────────────────────────────

_MATHE = re.compile(r"\$\$(.+?)\$\$|\$([^$\n]+?)\$", re.S)


def _t(text) -> str:
    """Text → HTML: escapen, Zeilenumbrüche, KaTeX ($…$, $$…$$) als Formel für pandoc."""
    s = str(text or "")
    teile, pos = [], 0
    for m in _MATHE.finditer(s):
        teile.append(html.escape(s[pos:m.start()]).replace("\n", "<br>"))
        anzeige = m.group(1) is not None
        formel = (m.group(1) if anzeige else m.group(2)).replace("</", "<\\/")
        typ = "math/tex; mode=display" if anzeige else "math/tex"
        teile.append(f'<script type="{typ}">{formel}</script>')
        pos = m.end()
    teile.append(html.escape(s[pos:]).replace("\n", "<br>"))
    return "".join(teile)


def _liste(punkte, geordnet=False) -> str:
    tag = "ol" if geordnet else "ul"
    return f"<{tag}>" + "".join(f"<li>{p}</li>" for p in punkte) + f"</{tag}>" if punkte else ""


def _tabelle(kopf: list[str], zeilen: list[list[str]], breiten: list[int]) -> str:
    """Breiten in Prozent — ohne sie setzt LaTeX nicht umbrechende Spalten."""
    cols = "".join(f'<col style="width: {b}%">' for b in breiten)
    th = "".join(f"<th>{k}</th>" for k in kopf)
    tr = "".join("<tr>" + "".join(f"<td>{z}</td>" for z in zeile) + "</tr>" for zeile in zeilen)
    return f"<table><colgroup>{cols}</colgroup><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>"


def _feld(name: str, wert: str) -> str:
    return f"<p><strong>{name}:</strong> {wert}</p>" if wert else ""


def _datum(d: str | None) -> str:
    try:
        return datetime.strptime(d or "", "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return ""


class _Dokument:
    """Sammelt HTML, nummeriert Überschriften wie pandoc (--number-sections) und Quellen in Zitierreihenfolge."""

    def __init__(self):
        self.teile: list[str] = []
        self.zaehler = [0, 0, 0]
        self.anker = 0
        self.verzeichnis: list[tuple[int, str, str, str]] = []  # (Ebene, Nummer, Text, Anker)
        self.quellen: dict[str, int] = {}
        self.quelldaten: dict[str, dict] = {}

    def add(self, s: str):
        self.teile.append(s)

    def h(self, ebene: int, text: str, nummeriert: bool = True):
        self.anker += 1
        anker = f"abschnitt-{self.anker}"
        nummer = ""
        if nummeriert:
            self.zaehler[ebene - 1] += 1
            for i in range(ebene, 3):
                self.zaehler[i] = 0
            nummer = ".".join(str(z) for z in self.zaehler[:ebene])
        if ebene <= 2:
            self.verzeichnis.append((ebene, nummer, text, anker))
        klasse = "" if nummeriert else ' class="unnumbered"'
        self.add(f'<h{ebene} id="{anker}"{klasse}>{html.escape(text)}</h{ebene}>')

    def zitiere(self, ids: list[str], daten: dict) -> str:
        nummern = []
        for qid in ids:
            if qid not in daten:
                continue
            if qid not in self.quellen:
                self.quellen[qid] = len(self.quellen) + 1
                self.quelldaten[qid] = daten[qid]
            nummern.append(self.quellen[qid])
        return f"[{', '.join(str(n) for n in nummern)}]" if nummern else ""

    def inhaltsverzeichnis(self) -> str:
        zeilen = "".join(
            f'<p>{"&#160;" * 6 * (e - 1)}<a href="#{a}">{n + " " if n else ""}{html.escape(t)}</a></p>'
            for e, n, t, a in self.verzeichnis)
        return f'<h1 class="unnumbered unlisted">Inhaltsverzeichnis</h1>{zeilen}'


# ── Spiele: Aufgaben, Lösungen, Differenzierung ─────────────────────

def _antworten(answers: list[dict], sortiert: bool = False) -> str:
    if sortiert:
        return "<p><em>Richtige Reihenfolge:</em></p>" + _liste([_t(a.get("text")) for a in answers], geordnet=True)
    return _liste([("✔ <strong>" + _t(a.get("text")) + "</strong>") if a.get("correct") else ("✘ " + _t(a.get("text")))
                   for a in answers])


def _zeitstrahl(tl: dict) -> str:
    einheit = (tl.get("axis") or {}).get("unit") or ""
    punkte = []
    for it in tl.get("items") or []:
        wert = f"{it.get('value')}{' ' + einheit if einheit else ''}"
        if "actual" in it:
            punkte.append(f"<strong>{_t(it.get('label'))}</strong> steht falsch bei {html.escape(wert)}, richtig: {html.escape(str(it['actual']))}")
        else:
            punkte.append(f"{_t(it.get('label'))} → {html.escape(wert)}")
    modus = "Fehler finden" if tl.get("mode") == "spot" else "Einordnen"
    return f"<p><em>Zeitstrahl ({modus}), Lösung:</em></p>" + _liste(punkte)


def _taskcrawler_aufgabe(task: dict) -> str:
    """Eine Aufgabe (oder ihre Varianten) mit Lösung."""
    kind = task.get("kind")
    varianten = task.get("variants") or [task]
    aus = []
    for i, v in enumerate(varianten, 1):
        kopf = f"Variante {i}: " if len(varianten) > 1 else ""
        aus.append(f"<p>{kopf}{_t(v.get('question') or task.get('question'))}</p>")
        if kind in ("single", "multi", "true_false"):
            aus.append(_antworten(v.get("answers") or task.get("answers") or []))
        elif kind == "input":
            aus.append(_feld("Lösung", " / ".join(_t(a) for a in (v.get("accept") or task.get("accept") or []))))
        elif kind == "timeline":
            aus.append(_zeitstrahl(task.get("timeline") or {}))
        elif kind == "karte":
            aus.append("<p><em>Kartenaufgabe — die Lösung ist auf der Karte markiert.</em></p>")
    if len(varianten) > 1:
        aus.insert(0, f"<p><em>{len(varianten)} Varianten — jedes Kind bekommt fest eine zugelost (Abschreibschutz).</em></p>")
    return "".join(aus)


def _taskcrawler(doc: _Dokument, game: ExitGame) -> bool:
    """Gibt zurück, ob das Spiel die Fuzzy-DDA nutzt."""
    data = game.data or {}
    if game.description:
        doc.add(f"<p>{_t(game.description)}</p>")
    folien = data.get("slides") or []
    doc.h(3, "Aufgaben und Lösungen")
    zeilen = []
    for nr, s in enumerate(folien, 1):
        art = FOLIEN_NAME.get(s.get("type"), s.get("type") or "")
        teile = []
        aufgaben = s.get("tasks") or ([s["task"]] if s.get("task") else [])
        for a in aufgaben:
            teile.append(_taskcrawler_aufgabe(a))
            if a.get("easierAlternative"):
                teile.append("<p><em>Leichtere Alternative:</em></p>" + _taskcrawler_aufgabe(a["easierAlternative"]))
        if s.get("type") == "boss" and isinstance(s.get("challenge"), dict):
            teile.append(f"<p>Bosskampf aus {len(s['challenge'].get('challenges') or [])} Challenges "
                         f"(Startstufe {s.get('startstufe', 2)}).</p>")
        if s.get("hints"):
            teile.append("<p><em>Hinweise (gestuft):</em></p>" + _liste([_t(h) for h in s["hints"]], geordnet=True))
        if s.get("extraExample"):
            teile.append(_feld("Zusatzbeispiel", _t(s["extraExample"].get("text") if isinstance(s["extraExample"], dict) else s["extraExample"])))
        if s.get("onFailReview"):
            teile.append(_feld("Bei Fehlschlag zurück zu", html.escape(", ".join(s["onFailReview"]))))
        if not teile:
            continue
        zeilen.append([str(nr), f"{html.escape(art)}<br><strong>{_t(s.get('title'))}</strong>", "".join(teile)])
    if zeilen:
        doc.add(_tabelle(["Nr.", "Folie", "Aufgabe und Lösung"], zeilen, [7, 23, 70]))
    else:
        doc.add("<p>Dieses Spiel enthält keine Aufgaben.</p>")

    doc.h(3, "Differenzierung")
    alle = [a for s in folien for a in (s.get("tasks") or ([s["task"]] if s.get("task") else []))]
    merkmale = [
        (sum(1 for s in folien if s.get("hints")), "Folien mit gestuften Hinweisen"),
        (sum(1 for a in alle if len(a.get("variants") or []) > 1), "Aufgaben mit Varianten (Abschreibschutz)"),
        (sum(1 for a in alle if a.get("easierAlternative")), "Aufgaben mit leichterer Alternative"),
        (sum(1 for s in folien if s.get("extraExample")), "Folien mit Zusatzbeispiel"),
        (sum(1 for s in folien if s.get("onFailReview")), "Folien mit Wiederholungsschleife bei Fehlschlag"),
    ]
    doc.add(_liste([f"{n} {text}" for n, text in merkmale if n]))
    dda_cfg = data.get("dda") or {}
    levels = dda_cfg.get("levels") or []
    if dda_cfg.get("enabled") is False or not levels:
        doc.add("<p>Ohne adaptive Steuerung: feste zwei Hinweise je Folie, keine Richtzeit.</p>")
        return False
    doc.add("<p>Das Spiel stuft jedes Kind laufend nach Antwortzeit, Fehlern, Hinweisabrufen und Wiederholungen "
            "in eine der folgenden Unterstützungsstufen ein (Fuzzy-Steuerung, siehe Abschnitt "
            "»Adaptive Differenzierung«). Stufe 1 = selbstständig, letzte Stufe = meiste Unterstützung.</p>")
    n = len(levels)
    zeilen = [[str(i + 1), _t(l.get("name") or ""), f"{round(i * 100 / n)}–{round((i + 1) * 100 / n)}",
               "alle" if (l.get("hintCount") or 0) >= 99 else str(l.get("hintCount", 0)),
               f"{l['timeLimitSeconds']} s" if l.get("timeLimitSeconds") else "—",
               "ja" if l.get("extraExample") else "nein", "ja" if l.get("offerEasier") else "nein"]
              for i, l in enumerate(levels)]
    doc.add(_tabelle(["Stufe", "Name", "Gerüstwert", "Hinweise", "Richtzeit", "Extra-Beispiel", "Leichter"],
                     zeilen, [9, 23, 14, 12, 13, 15, 14]))
    return True


def _caputh(doc: _Dokument, quiz: Quiz) -> None:
    from .routers.capuths import _caputh_to_json

    data = _caputh_to_json(quiz)
    if quiz.description:
        doc.add(f"<p>{_t(quiz.description)}</p>")
    doc.h(3, "Fragen und Lösungen")
    typname = {"single": "Einfachauswahl", "multi": "Mehrfachauswahl (Teilpunkte)", "true_false": "Wahr/Falsch",
               "survey": "Umfrage (ohne Wertung)", "sort": "Sortieren", "umrechnung": "Umrechnen",
               "timeline": "Zeitstrahl", "karte": "Karte"}
    zeilen = []
    for nr, q in enumerate(data.get("questions") or [], 1):
        typ = q.get("type")
        if typ == "timeline":
            loesung = _zeitstrahl(q.get("timeline") or {})
        elif typ == "karte":
            loesung = "<p><em>Kartenaufgabe — die Lösung ist auf der Karte markiert.</em></p>"
        elif typ == "umrechnung":
            loesung = _feld("Lösung", " / ".join(_t(a["text"]) for a in q.get("answers") or []))
        elif typ == "survey":
            loesung = _liste([_t(a["text"]) for a in q.get("answers") or []])
        else:
            loesung = _antworten(q.get("answers") or [], sortiert=typ == "sort")
        zeit = q.get("time_limit") or data.get("time_limit_default")
        zeilen.append([str(nr), f"{html.escape(typname.get(typ, typ))}{f'<br>{zeit} s' if zeit else ''}",
                       f"<p>{_t(q.get('question'))}</p>{loesung}"])
    doc.add(_tabelle(["Nr.", "Typ / Zeit", "Frage und Lösung"], zeilen, [7, 24, 69]) if zeilen
            else "<p>Dieses Quiz enthält keine Fragen.</p>")
    doc.h(3, "Differenzierung")
    fragen = data.get("questions") or []
    typen = sorted({typname.get(q.get("type"), q.get("type")) for q in fragen})
    punkte = [
        "Caputh läuft im Gleichschritt der Klasse — es passt die Fragen nicht pro Kind an.",
        f"Unterschiedliche Fragetypen: {html.escape(', '.join(typen))}." if typen else "",
        "Mehrfachauswahl wird mit Teilpunkten gewertet." if any(q.get("type") == "multi" for q in fragen) else "",
        "Antworten werden je Kind gemischt." if quiz.randomize_answers else "",
    ]
    doc.add(_liste([p for p in punkte if p]))


def _challenge(doc: _Dokument, satz: ChallengeSet) -> bool:
    data = satz.data or {}
    fakten = {f["id"]: f for f in data.get("facts") or []}
    doc.h(3, "Challenges und Lösungen")
    zeilen = []
    for c in data.get("challenges") or []:
        solve = c.get("solve") or {}
        art, ids = ("alle", solve["all"]) if "all" in solve else ("einer von", solve.get("any") or [])
        loesung = _liste([_t(fakten.get(i, {}).get("text", i)) for i in ids])
        zeilen.append([html.escape(str(c.get("stage", ""))), _t(c.get("text")),
                       f"<p><em>Lösung ({art}):</em></p>{loesung}" + (_feld("Tipp", _t(c["tip"])) if c.get("tip") else "")])
    for c in data.get("claims") or []:
        loesung = _liste([_t(fakten.get(i, {}).get("text", i)) for i in c.get("refutedBy") or []])
        zeilen.append([html.escape(str(c.get("stage", ""))), f"Behauptung: {_t(c.get('text'))}",
                       f"<p><em>Widerlegt durch:</em></p>{loesung}"])
    doc.add(_tabelle(["Etappe", "Challenge", "Lösung"], zeilen, [13, 39, 48]) if zeilen
            else "<p>Dieser Satz enthält keine Challenges.</p>")
    ablenker = [f for f in fakten.values() if f.get("decoy")]
    if ablenker:
        doc.add("<p><strong>Ablenker</strong> (passen zu keiner Challenge):</p>" + _liste([_t(f["text"]) for f in ablenker]))

    doc.h(3, "Differenzierung")
    doc.add("<p>Jedes Kind spielt auf einer von vier Stufen (4 = schwerste). Die Stufe passt sich nach der "
            "Fuzzy-Steuerung an (siehe Abschnitt »Adaptive Differenzierung«): frühestens nach drei Antworten auf "
            "einer Stufe, höchstens eine Stufe pro Schritt. Gerüstwert unter 25 → Stufe 4, unter 50 → 3, unter 75 → 2, "
            "sonst Stufe 1.</p>")
    levels = data.get("levels") or {}
    zeilen = []
    for stufe, p in STUFE_PARAMS.items():
        anp = levels.get(str(stufe)) or {}
        geaendert = len(anp.get("facts") or []) + len(anp.get("challenges") or [])
        eigen = ", ".join(t for t in [f"{geaendert} angepasste Einträge" if geaendert else "",
                                       f"{len(anp.get('omit') or [])} ausgelassen" if anp.get("omit") else ""] if t)
        zeilen.append([str(stufe), "alle" if p["ablenker"] is None else str(p["ablenker"]),
                       "ja" if p["tipps"] else "nein", f"{p['lese_wpm']} Wörter/min", eigen or "—"])
    doc.add(_tabelle(["Stufe", "Ablenker", "Tipps", "Erwartetes Lesetempo", "Eigene Fassung im Satz"],
                     zeilen, [10, 15, 12, 26, 37]))
    for stufe in sorted(levels):
        anp = levels[stufe] or {}
        texte = [_t(c.get("text")) for c in anp.get("challenges") or [] if c.get("text")]
        if texte:
            doc.add(f"<p><em>Stufe {html.escape(stufe)} — eigene Formulierungen:</em></p>" + _liste(texte))
    return True


def _fuzzy_abschnitt(doc: _Dokument) -> None:
    regeln = dda.DEFAULT_RULESET
    doc.h(2, "Adaptive Differenzierung (Fuzzy-DDA)")
    zit = doc.zitiere(["q_zadeh1965", "q_mamdani1975", "q_hunicke2005"], DDA_QUELLEN)
    doc.add(
        "<p>TaskCrawler und Challenge passen die Unterstützung je Kind laufend an (dynamische "
        "Schwierigkeitsanpassung, DDA). Die Entscheidung trifft eine Fuzzy-Steuerung nach Mamdani "
        f"{zit}: Aus den letzten {dda.RECENT_WINDOW} Antworten eines Kindes werden Mittelwerte gebildet, "
        "diese in unscharfe Mengen übersetzt (Dreiecksfunktionen), die Regeln ausgewertet (UND = Minimum, "
        "Zusammenfassen = Maximum) und das Ergebnis über den Schwerpunkt in einen Gerüstwert von 0 bis 100 "
        "zurückgerechnet. Der Gerüstwert wählt die Stufe. Die Rechnung läuft auf dem Server; jede Einstufung "
        "wird protokolliert und ist für die Lehrkraft nachvollziehbar.</p>")
    doc.add("<p><strong>Eingangsgrößen</strong> (Dreiecke als a | b | c: Fußpunkte und Spitze):</p>")
    doc.add(_tabelle(["Größe", "Bereich", "Unscharfe Mengen"], [
        [html.escape(GROESSE.get(i["id"], i["id"])), f"{i['range'][0]}–{i['range'][1]}",
         "; ".join(f"{MENGE.get(m['name'], m['name'])} ({' | '.join(str(p) for p in m['params'])})"
                   for m in i["membershipFunctions"])]
        for i in regeln["inputs"]], [25, 15, 60]))
    doc.add("<p><strong>Regeln:</strong></p>")
    doc.add(_tabelle(["Wenn …", "dann …", "Gewicht"], [
        [" und ".join(f"{GROESSE.get(a['input'], a['input'])} {MENGE.get(a['fuzzySet'], a['fuzzySet'])}" for a in r["antecedents"]),
         ", ".join(f"{GROESSE.get(c['output'], c['output'])} {MENGE.get(c['fuzzySet'], c['fuzzySet'])}" for c in r["consequents"]),
         str(r.get("weight", 1.0)).replace(".", ",")]
        for r in regeln["rules"]], [43, 42, 15]))


# ── Dokument ─────────────────────────────────────────────────────────

def _methode(doc: _Dokument, m: dict, quellen: dict) -> None:
    zit = doc.zitiere(m.get("quellen") or [], quellen)
    doc.add(f"<p><strong>Methode aus dem Kompendium: {_t(m['name'])}</strong>"
            f"{' (' + html.escape(m['dauer']) + ')' if m.get('dauer') else ''} {zit}</p>")
    doc.add(f"<p>{_t(m.get('kurz'))}</p>")
    if m.get("ablauf"):
        doc.add("<p><em>Ablauf:</em></p>" + _liste([_t(s) for s in m["ablauf"]], geordnet=True))
    if m.get("stolpersteine"):
        doc.add("<p><em>Stolpersteine:</em></p>" + _liste([_t(s) for s in m["stolpersteine"]]))
    ev = m.get("evidenz") or {}
    if ev:
        doc.add(_feld("Evidenz", f"{html.escape(EVIDENZ_NAME.get(ev.get('stufe'), ev.get('stufe', '')))} — {_t(ev.get('text'))}"))


def _werkzeug_inhalt(db: Session, link: dict):
    """Verknüpfter Spielinhalt oder None."""
    typ, ref = link.get("type"), link.get("ref_id")
    if typ not in ("caputh", "exitgame", "challenge") or not str(ref or "").isdigit():
        return None
    modell = {"caputh": Quiz, "exitgame": ExitGame, "challenge": ChallengeSet}[typ]
    return db.get(modell, int(ref))


def build_html(plan: LessonPlan, db: Session, mit_verzeichnis: bool) -> tuple[str, dict]:
    """HTML-Körper und pandoc-Metadaten."""
    methoden, kq = kompendium()
    doc = _Dokument()
    phasen = [p for p in plan.phasen or [] if isinstance(p, dict)]
    materialien: dict[str, list[str]] = {}
    for mat in db.query(LessonMaterial).filter_by(plan_id=plan.id).order_by(LessonMaterial.uploaded_at):
        materialien.setdefault(mat.phase_id, []).append(mat.original_filename)

    doc.h(1, "Überblick")
    lehrkraft = f"{plan.teacher.first_name} {plan.teacher.last_name}" if plan.teacher else ""
    summe = sum(p.get("dauer_min") or 0 for p in phasen)
    doc.add(_tabelle(["Angabe", "Wert"], [[k, html.escape(str(v))] for k, v in [
        ("Thema", plan.title), ("Fach", plan.fach), ("Klasse", plan.klasse), ("Datum", _datum(plan.datum)),
        ("Dauer", f"{plan.dauer_min} Minuten (verplant: {summe})"), ("Lehrkraft", lehrkraft),
    ] if v], [30, 70]))

    doc.h(1, "Lernziele")
    ziele = [z for z in plan.lernziele or [] if z.strip()]
    doc.add(_liste([_t(z) for z in ziele], geordnet=True) or "<p>Keine Lernziele angegeben.</p>")

    doc.h(1, "Verlaufsplanung")
    zeilen, minute = [], 0
    for p in phasen:
        ende = minute + (p.get("dauer_min") or 0)
        namen = [methoden[i]["name"] for i in p.get("methoden") or [] if i in methoden]
        methode = "; ".join(html.escape(x) for x in [p.get("methode") or "", *namen] if x)
        material = "; ".join(html.escape(x) for x in [p.get("material") or "", *materialien.get(p.get("id"), [])] if x)
        if p.get("tool_link"):
            material = "; ".join(x for x in [material, html.escape(p["tool_link"].get("label") or p["tool_link"].get("type", ""))] if x)
        zeilen.append([f"{minute}–{ende}′", f"<strong>{_t(p.get('name'))}</strong>", _t(p.get("inhalt")),
                       html.escape(p.get("sozialform") or ""), methode, material])
        minute = ende
    doc.add(_tabelle(["Zeit", "Phase", "Inhalt / Verlauf", "SF", "Methode", "Material / Medien"], zeilen,
                     [10, 16, 30, 10, 16, 18]) if zeilen else "<p>Keine Phasen geplant.</p>")
    if zeilen:
        doc.add("<p><em>SF = Sozialform: EA Einzelarbeit, PA Partnerarbeit, GA Gruppenarbeit.</em></p>")

    if phasen:
        doc.h(1, "Phasen im Detail")
        for p in phasen:
            doc.h(2, f"{p.get('name') or 'Phase'} ({p.get('dauer_min') or 0} min)")
            doc.add(f"<p>{_t(p.get('inhalt'))}</p>" if p.get("inhalt") else "")
            doc.add(_feld("Sozialform", html.escape(SOZIALFORM_NAME.get(p.get("sozialform"), p.get("sozialform") or ""))))
            doc.add(_feld("Methode", _t(p.get("methode"))))
            doc.add(_feld("Material / Medien", _t(p.get("material"))))
            if materialien.get(p.get("id")):
                doc.add(_feld("Dateien", html.escape(", ".join(materialien[p["id"]]))))
            link = p.get("tool_link") or None
            if link:
                ziel = (f'<a href="{html.escape(link["url"])}">{html.escape(link.get("label") or link["url"])}</a>'
                        if link.get("type") == "link" and link.get("url") else html.escape(link.get("label") or link.get("type", "")))
                doc.add(_feld("Werkzeug", ziel))
                if link.get("type") == "exit-ticket":
                    ticket = db.query(ExitTicketSession).filter_by(code=link.get("ref_id")).first()
                    if ticket:
                        doc.add(_feld("Frage im Exit Ticket", _t(ticket.question)))
            for mid in p.get("methoden") or []:
                if mid in methoden:
                    _methode(doc, methoden[mid], kq)

    spiele = [(p, p["tool_link"], inhalt) for p in phasen if p.get("tool_link")
              for inhalt in [_werkzeug_inhalt(db, p["tool_link"])] if inhalt is not None]
    if spiele:
        doc.h(1, "Digitale Werkzeuge und Differenzierung")
        doc.add("<p>Die folgenden Spiele sind in der Stunde verknüpft. Aufgeführt sind alle Aufgaben mit "
                "Lösungen und die Art, wie das Spiel auf einzelne Kinder eingeht.</p>")
        fuzzy = False
        for p, link, inhalt in spiele:
            doc.h(2, f"{link.get('label') or inhalt.title} — Phase »{p.get('name') or ''}«")
            if isinstance(inhalt, ExitGame):
                doc.add("<p><em>TaskCrawler: Escape-Spiel mit Erklär-, Beispiel- und Aufgabenfolien; "
                        "Codeschnipsel aus den Aufgaben öffnen die Tür.</em></p>")
                fuzzy = _taskcrawler(doc, inhalt) or fuzzy
            elif isinstance(inhalt, Quiz):
                doc.add("<p><em>Caputh: Live-Quiz der ganzen Klasse mit Punkten für die Häuser.</em></p>")
                _caputh(doc, inhalt)
            else:
                doc.add("<p><em>Challenge: Kinder lösen Challenges, indem sie passende Fakten kombinieren.</em></p>")
                fuzzy = _challenge(doc, inhalt) or fuzzy
        if fuzzy:
            _fuzzy_abschnitt(doc)

    if plan.hausaufgaben:
        doc.h(1, "Hausaufgaben")
        doc.add(f"<p>{_t(plan.hausaufgaben)}</p>")
    if plan.notizen:
        doc.h(1, "Notizen und Differenzierung")
        doc.add(f"<p>{_t(plan.notizen)}</p>")

    if doc.quellen:
        doc.h(1, "Quellen", nummeriert=False)
        eintraege = []
        for qid, n in doc.quellen.items():
            q = doc.quelldaten[qid]
            ref = q.get("doi") and f"https://doi.org/{q['doi']}" or q.get("url")
            link = f' <a href="{html.escape(ref)}">{html.escape(ref)}</a>' if ref else ""
            eintraege.append(f"<p>[{n}] {html.escape(q['autor'])} ({q['jahr']}). <em>{html.escape(q['titel'])}</em>. "
                             f"{html.escape(q.get('erschienen_in') or '')}.{link}</p>")
        doc.add("".join(eintraege))

    koerper = "".join(doc.teile)
    if mit_verzeichnis:
        koerper = doc.inhaltsverzeichnis() + koerper
    untertitel = " · ".join(x for x in [plan.fach, plan.klasse and f"Klasse {plan.klasse}", _datum(plan.datum)] if x)
    meta = {"title": plan.title, "subtitle": untertitel, "author": lehrkraft}
    return koerper, meta


# ── Umwandlung ───────────────────────────────────────────────────────

A4 = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" '
      'w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>')


def _a4(docx: Path) -> None:
    """pandoc schreibt ein leeres sectPr (Word/LibreOffice nehmen dann US Letter)."""
    ein = zipfile.ZipFile(io.BytesIO(docx.read_bytes()))
    aus = io.BytesIO()
    with zipfile.ZipFile(aus, "w", zipfile.ZIP_DEFLATED) as z:
        for name in ein.namelist():
            daten = ein.read(name)
            if name == "word/document.xml":
                daten = re.sub(r"<w:sectPr[^>]*/>|<w:sectPr.*?</w:sectPr>", A4, daten.decode("utf-8"), flags=re.S).encode("utf-8")
            elif name == "word/styles.xml":
                # Tabellen in 9 pt, sonst bricht LibreOffice Wörter in schmalen Spalten mitten durch
                daten = re.sub(r'(<w:style [^>]*w:styleId="Table"[^>]*>.*?)(</w:style>)', r'\1<w:rPr><w:sz w:val="18"/></w:rPr>\2',
                               daten.decode("utf-8"), count=1, flags=re.S).encode("utf-8")
            z.writestr(name, daten)
    docx.write_bytes(aus.getvalue())


def _meta_args(meta: dict) -> list[str]:
    return [f"--metadata={k}:{v}" for k, v in meta.items() if v] + ["--metadata=lang:de-DE"]


def export(plan: LessonPlan, db: Session, fmt: str) -> bytes | None:
    """Datei im Format fmt (pdf/docx/tex); None, wenn pandoc oder LibreOffice scheitert."""
    import pypandoc

    koerper, meta = build_html(plan, db, mit_verzeichnis=fmt == "pdf")
    args = ["--standalone", "--number-sections", *_meta_args(meta)]
    toc = ["--toc", "--toc-depth=2", "--metadata=toc-title:Inhaltsverzeichnis"]
    if fmt == "tex":
        return pypandoc.convert_text(koerper, "latex", format="html", extra_args=[
            *args, *toc, "--variable=documentclass:scrartcl", "--variable=papersize:a4",
            "--variable=geometry:margin=2.2cm", "--variable=colorlinks"]).encode("utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        ziel = Path(tmp) / "stundenplanung.docx"
        pypandoc.convert_text(koerper, "docx", format="html", outputfile=str(ziel),
                              extra_args=args + (toc if fmt == "docx" else []))
        _a4(ziel)
        if fmt == "docx":
            return ziel.read_bytes()
        pdf = convert_to_pdf(ziel, Path(tmp))
        return pdf.read_bytes() if pdf else None
