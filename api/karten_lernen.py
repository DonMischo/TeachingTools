"""Lernhelfer für das Kartenquiz: übt, was noch nicht sitzt — mit Ablenkern.

Reine Logik ohne Datenbank (wie karten_quiz.py). Je Lernende:r und Kartensatz
gibt es einen Lernstand (models.KartenLernstand), je Objekt »ebene:id«:

    {"n": gesehen, "r": richtig, "f": falsch, "hist": [1, 0, 1 …] (neueste zuletzt, max. 8),
     "b": benennen schon einmal richtig, "fi": finden schon einmal richtig,
     "zuletzt": ISO-Zeit, "verwechselt": {"ebene:id": Anzahl}}

Welche Aufgabe als nächste kommt, entscheidet eine kleine Fuzzy-Regelbasis
(Sugeno, Ausgabe = gewichtetes Mittel): Eingänge sind die Sicherheit
(gewichtete Trefferquote, neuere Antworten zählen mehr) und die Pause seit
dem letzten Mal; Ausgang ist der Übungsbedarf 0–1. So kommen schwache
Objekte oft, sichere selten — aber nach einer langen Pause wieder.
"""
import math
import random
from datetime import datetime, timezone

from .karten_quiz import _abstand, normalisiere

HIST_MAX = 8
AUSWAHL_BIS = 0.5  # unter dieser Sicherheit: Auswahl aus 4 statt freier Eingabe
ABLENKER = 3


def schluessel(a: dict) -> str:
    return f"{a['ebene']}:{a['id']}"


# ── Fuzzy-Mengen ─────────────────────────────────────────────────────

def _rampe_ab(x: float, a: float, b: float) -> float:
    """1 bis a, fällt linear auf 0 bei b."""
    return 1.0 if x <= a else 0.0 if x >= b else (b - x) / (b - a)


def _rampe_auf(x: float, a: float, b: float) -> float:
    return 1.0 - _rampe_ab(x, a, b)


def _dreieck(x: float, a: float, m: float, b: float) -> float:
    if x <= a or x >= b:
        return 0.0
    return (x - a) / (m - a) if x <= m else (b - x) / (b - m)


def sicherheit(e: dict | None) -> float:
    """Gewichtete Trefferquote der letzten Antworten (neueste zählt doppelt so viel wie die davor …)."""
    hist = (e or {}).get("hist") or []
    if not hist:
        return 0.0
    gewichte = [0.7 ** (len(hist) - 1 - i) for i in range(len(hist))]
    wert = sum(g * h for g, h in zip(gewichte, hist)) / sum(gewichte)
    # Eine einzige richtige Antwort ist noch kein Wissen
    return wert * min(1.0, 0.5 + 0.25 * len(hist))


def _stunden_seit(e: dict | None, jetzt: datetime) -> float:
    z = (e or {}).get("zuletzt")
    if not z:
        return math.inf
    return max(0.0, (jetzt - datetime.fromisoformat(z)).total_seconds() / 3600)


def bedarf(e: dict | None, jetzt: datetime) -> float:
    """Übungsbedarf 0–1 aus Sicherheit und Pause (Fuzzy-Regeln)."""
    if not e or not e.get("n"):
        return 0.7  # neu: bald einmal zeigen, aber nicht vor allem Schwachen
    s = sicherheit(e)
    h = _stunden_seit(e, jetzt)
    niedrig, mittel, hoch = _rampe_ab(s, 0.2, 0.55), _dreieck(s, 0.3, 0.6, 0.9), _rampe_auf(s, 0.65, 0.9)
    kurz, mitte, lang = _rampe_ab(h, 1 / 6, 1), _dreieck(h, 1 / 6, 2, 24), _rampe_auf(h, 2, 48)
    regeln = [  # (Erfüllungsgrad, Bedarf)
        (niedrig, 1.0),
        (min(mittel, kurz), 0.4), (min(mittel, mitte), 0.6), (min(mittel, lang), 0.85),
        (min(hoch, kurz), 0.05), (min(hoch, mitte), 0.2), (min(hoch, lang), 0.5),
    ]
    summe = sum(w for w, _ in regeln)
    return sum(w * v for w, v in regeln) / summe if summe else 0.5


# ── Auswahl der nächsten Aufgabe ─────────────────────────────────────

def waehle(aufgaben: list[dict], objekte: dict, letzte: list[str], jetzt: datetime, rng: random.Random) -> dict:
    """Gewichteter Zufall nach Bedarf² — die zuletzt gestellten (max. 2) nicht gleich wieder."""
    sperre = set(letzte[-2:]) if len(aufgaben) > 2 else set(letzte[-1:]) if len(aufgaben) > 1 else set()
    kandidaten = [a for a in aufgaben if schluessel(a) not in sperre] or aufgaben
    gewichte = [bedarf(objekte.get(schluessel(a)), jetzt) ** 2 + 0.01 for a in kandidaten]
    return rng.choices(kandidaten, weights=gewichte, k=1)[0]


def richtung(e: dict | None, rng: random.Random) -> str:
    """Erst benennen, dann finden; wenn beides schon klappte, gemischt."""
    if not (e or {}).get("b"):
        return "benennen"
    if not (e or {}).get("fi"):
        return "finden"
    return rng.choice(["benennen", "finden"])


def hilfe(e: dict | None, art: str = "benennen") -> str:
    """Auswahl mit Ablenkern, solange unsicher — und in jeder Richtung, bis sie einmal geklappt hat."""
    geklappt = (e or {}).get("b" if art == "benennen" else "fi")
    return "auswahl" if sicherheit(e) < AUSWAHL_BIS or not geklappt else "frei"


def _km(p, q) -> float:
    if not p or not q:
        return math.inf
    dx = (p[0] - q[0]) * math.cos(math.radians((p[1] + q[1]) / 2))
    return math.hypot(dx, p[1] - q[1]) * 111.2


def _namens_naehe(a: str, b: str) -> float:
    """0–1: wie ähnlich zwei Namen aussehen (gleicher Anfang, kleiner Editierabstand)."""
    x, y = normalisiere(a), normalisiere(b)
    if not x or not y:
        return 0.0
    rel = 1 - _abstand(x, y) / max(len(x), len(y))
    return max(0.0, rel) * 0.7 + (0.3 if x[0] == y[0] else 0.0)


def ablenker(ziel: dict, kandidaten: list[dict], e: dict | None, rng: random.Random, k: int = ABLENKER) -> list[dict]:
    """Bis zu k falsche Antworten, die zum Verwechseln taugen.

    ``kandidaten``: andere Objekte (gleiche Ebene zuerst) mit name und anker.
    Punkte: frühere Verwechslungen ≫ Nähe auf der Karte > ähnlicher Name, dazu etwas Zufall.
    """
    verwechselt = (e or {}).get("verwechselt", {})
    # Eine Stadt mit Bundesländern als Auswahl wäre zu leicht: dieselbe Ebene, solange genug da sind
    gleiche = [c for c in kandidaten if c["ebene"] == ziel["ebene"] and normalisiere(c["name"]) != normalisiere(ziel["name"])]
    if len({normalisiere(c["name"]) for c in gleiche}) >= k:
        kandidaten = gleiche
    gesehen, wertung = {normalisiere(ziel["name"])}, []
    for c in kandidaten:
        n = normalisiere(c["name"])
        if not n or n in gesehen or schluessel(c) == schluessel(ziel):
            continue
        gesehen.add(n)
        punkte = 3.0 * verwechselt.get(schluessel(c), 0)
        punkte += 1.5 * math.exp(-_km(ziel.get("anker"), c.get("anker")) / 150)
        punkte += 1.0 * _namens_naehe(ziel["name"], c["name"])
        punkte += 0.4 * (c["ebene"] == ziel["ebene"])
        wertung.append((punkte + rng.random() * 0.5, c))
    wertung.sort(key=lambda x: -x[0])
    return [c for _, c in wertung[:k]]


# ── Verbuchen ────────────────────────────────────────────────────────

def verbuche(objekte: dict, a: dict, richtig: bool, art: str, jetzt: datetime, verwechselt_mit: str | None = None) -> dict:
    """Neue Antwort in den Lernstand eintragen; gibt den neuen Eintrag zurück (objekte wird nicht verändert)."""
    alt = objekte.get(schluessel(a)) or {}
    neu = {**alt, "n": alt.get("n", 0) + 1, "r": alt.get("r", 0) + richtig, "f": alt.get("f", 0) + (not richtig),
           "hist": [*(alt.get("hist") or []), int(richtig)][-HIST_MAX:], "zuletzt": jetzt.isoformat()}
    if richtig:
        neu["b" if art == "benennen" else "fi"] = True
    if verwechselt_mit and verwechselt_mit != schluessel(a):
        v = dict(alt.get("verwechselt") or {})
        v[verwechselt_mit] = v.get(verwechselt_mit, 0) + 1
        neu["verwechselt"] = v
    return neu


# ── Erfolge ──────────────────────────────────────────────────────────
#
# Arten (models: SatzInhalt.erfolge, routers/karten.py::Erfolg):
#   anteil       Anteil richtig über die Ebenen ≥ schwelle            (Quiz)
#   fehlerfrei   alle Aufgaben der Ebenen im ersten Versuch richtig   (Quiz)
#   objekte      genau diese Objekte richtig                          (Quiz)
#   serie        »anzahl« richtige Antworten hintereinander           (Quiz)
#   tempo        alle der Ebenen richtig, binnen »sekunden« ab der ersten Antwort (Quiz)
#   beide        jedes Objekt der Ebenen benannt UND gefunden         (Lernstand: Quiz + Üben)
#   aufgeholt    »anzahl« Objekte, die einmal falsch waren, sitzen jetzt (Sicherheit ≥ 0,8)
#   dranbleiben  an »anzahl« verschiedenen Tagen mit dem Satz geübt
#   komplett     alle anderen Erfolge des Satzes

ARTEN = ("anteil", "fehlerfrei", "objekte", "serie", "tempo", "beide", "aufgeholt", "dranbleiben", "komplett")


def erfolg_erreicht(v: dict, aufgaben: list[dict], antworten: dict, verlauf: dict, lern: dict, tage: list[str],
                    erreicht: set[str], alle_ids: list[str]) -> bool:
    art = v.get("art", "anteil")
    teil = [a for a in aufgaben if a["ebene"] in v.get("ebenen", [])]
    stand = lambda a: antworten.get(str(a["nr"]), {})  # noqa: E731
    if art == "anteil":
        return bool(teil) and sum(bool(stand(a).get("richtig")) for a in teil) / len(teil) >= float(v.get("schwelle", 1.0))
    if art == "fehlerfrei":
        return bool(teil) and all(stand(a).get("richtig") and stand(a).get("versuche") == 1 for a in teil)
    if art == "objekte":
        ziel = [a for a in aufgaben if schluessel(a) in set(v.get("objekte", []))]
        return bool(ziel) and all(stand(a).get("richtig") for a in ziel)
    if art == "serie":
        return verlauf.get("beste_serie", 0) >= int(v.get("anzahl") or 5)
    if art == "tempo":
        if not teil or not all(stand(a).get("richtig") for a in teil):
            return False
        return max(stand(a).get("t", math.inf) for a in teil) <= int(v.get("sekunden") or 120)
    if art == "beide":
        return bool(teil) and all(lern.get(schluessel(a), {}).get("b") and lern.get(schluessel(a), {}).get("fi") for a in teil)
    if art == "aufgeholt":
        menge = teil or aufgaben
        n = sum(1 for a in menge if lern.get(schluessel(a), {}).get("f") and sicherheit(lern.get(schluessel(a))) >= 0.8)
        return n >= int(v.get("anzahl") or 3)
    if art == "dranbleiben":
        return len(set(tage)) >= int(v.get("anzahl") or 3)
    if art == "komplett":
        andere = [i for i in alle_ids if i != v["id"]]
        return bool(andere) and all(i in erreicht for i in andere)
    return False


def beschreibung(v: dict, ebenen_namen: dict[str, str]) -> str:
    """Ein Satz für Spieler: was zu tun ist."""
    art = v.get("art", "anteil")
    namen = ", ".join(ebenen_namen.get(e, e) for e in v.get("ebenen", [])) or "allen Ebenen"
    anteil = {0.5: "die Hälfte", 0.75: "drei Viertel", 1.0: "alle"}.get(float(v.get("schwelle", 1.0)), f"{round(float(v.get('schwelle', 1)) * 100)} %")
    return {
        "anteil": f"{anteil} richtig: {namen}",
        "fehlerfrei": f"ohne Fehlversuch: {namen}",
        "objekte": f"diese {len(v.get('objekte', []))} Objekte richtig",
        "serie": f"{v.get('anzahl') or 5} richtige Antworten hintereinander",
        "tempo": f"{namen} komplett in {v.get('sekunden') or 120} Sekunden",
        "beide": f"jedes Objekt benennen und finden: {namen}",
        "aufgeholt": f"{v.get('anzahl') or 3} frühere Fehler sicher gelernt",
        "dranbleiben": f"an {v.get('anzahl') or 3} Tagen üben",
        "komplett": "alle anderen Erfolge",
    }.get(art, "")


def heute(jetzt: datetime | None = None) -> str:
    return (jetzt or datetime.now(timezone.utc)).date().isoformat()
