"""Challenge-Engine: Prüfung des Satzes, Stufen-Merge, Bewertung, Wertung, Lesetempo, DDA-Stufe.

Reine Funktionen, keine Datenbank. Der Router (api/routers/challenge.py) ruft sie auf;
die Lösungen verlassen den Server nie.
"""
import copy
import random
import statistics
from functools import lru_cache

from . import dda

STUFEN = (1, 2, 3, 4)
SPIELE = ("normal", "karten", "boss", "huepfen", "turm", "detektiv", "alchemie", "bruecke", "gericht")
THEMES = ("klassisch", "wald", "ninja", "verlies", "antike", "weltraum")
STUFE_PARAMS = {  # Systemvorgaben je Stufe (4 = schwerste); ablenker None = alle
    1: {"ablenker": 1, "tipps": True, "lese_wpm": 80},
    2: {"ablenker": 2, "tipps": False, "lese_wpm": 110},
    3: {"ablenker": 4, "tipps": False, "lese_wpm": 140},
    4: {"ablenker": None, "tipps": False, "lese_wpm": 170},
}
LEBEN = 3
MALUS = 0.5
MIN_CHALLENGES_JE_ETAPPE = 5
MAX_FAKTEN_JE_ETAPPE = 12
STUFE_MIN_SNAPSHOTS = 3
GERATEN_ANTEIL = 0.3
VORSCHLAG_MIN_STICHPROBE = 30
VORSCHLAG_GRENZE = 0.2
STANDARD_KALIBRIERUNG = {  # antwortzeit nach dda.DEFAULT_RULESET: fast endet bei 15 s, slow beginnt bei 40 s
    "lese_wpm": {str(s): p["lese_wpm"] for s, p in STUFE_PARAMS.items()},
    "antwortzeit": {"schnell": 15.0, "langsam": 40.0},
}


# ── Prüfung ──────────────────────────────────────────────────────────

def _ist_int(x) -> bool:
    return isinstance(x, int) and not isinstance(x, bool)


def _eintraege(daten: dict, schluessel: str, wo: str, fehler: list[str]) -> list[dict]:
    """Liste von Einträgen mit eindeutiger Text-id; Strukturfehler landen in ``fehler``."""
    liste = daten.get(schluessel)
    if not isinstance(liste, list):
        fehler.append(f"»{schluessel}« muss eine Liste sein.")
        return []
    aus, ids = [], set()
    for i, e in enumerate(liste, 1):
        if not isinstance(e, dict):
            fehler.append(f"{wo} {i}: muss ein Objekt sein.")
            continue
        eid = e.get("id")
        if not isinstance(eid, str) or not eid.strip():
            fehler.append(f"{wo} {i}: »id« fehlt (Text).")
            continue
        if eid in ids:
            fehler.append(f"{wo} »{eid}«: id kommt doppelt vor.")
        ids.add(eid)
        if not isinstance(e.get("text"), str) or not e["text"].strip():
            fehler.append(f"{wo} »{eid}«: »text« fehlt.")
        aus.append(e)
    return aus


def _pruefe_aufgeloest(satz: dict, assets: set[str] | None) -> tuple[list[str], list[str]]:
    """Regeln für einen vollständigen Satz (Basis oder eine aufgelöste Stufe)."""
    fehler: list[str] = []
    warnungen: list[str] = []
    if not isinstance(satz.get("title"), str) or not satz["title"].strip():
        fehler.append("»title« fehlt.")
    if "stages" in satz and not isinstance(satz["stages"], list):
        fehler.append("»stages« muss eine Liste sein.")
    fakten = _eintraege(satz, "facts", "Fakt", fehler)
    challenges = _eintraege(satz, "challenges", "Challenge", fehler)
    fakt_ids = {f["id"] for f in fakten}
    echte = {f["id"] for f in fakten if not f.get("decoy")}
    for c in challenges:
        if c["id"] in fakt_ids:
            fehler.append(f"»{c['id']}« ist Fakt und Challenge zugleich (ids müssen verschieden sein).")
        solve = c.get("solve")
        if not isinstance(solve, dict) or set(solve) not in ({"all"}, {"any"}):
            fehler.append(f"Challenge »{c['id']}«: »solve« braucht genau »all« oder »any«.")
        else:
            ids = next(iter(solve.values()))
            if not isinstance(ids, list) or not ids:
                fehler.append(f"Challenge »{c['id']}«: »solve« darf nicht leer sein.")
            else:
                for i in ids:
                    if i not in echte:
                        fehler.append(f"Challenge »{c['id']}«: »{i}« ist kein Fakt (oder ein Ablenker).")
        if "strength" in c and not (_ist_int(c["strength"]) and 1 <= c["strength"] <= 3):
            fehler.append(f"Challenge »{c['id']}«: »strength« muss 1 bis 3 sein.")
        if "stage" in c and not (_ist_int(c["stage"]) and c["stage"] >= 1):
            fehler.append(f"Challenge »{c['id']}«: »stage« muss eine ganze Zahl ab 1 sein.")
    if "claims" in satz:
        fehler += _pruefe_claims(satz, fakt_ids, echte, {c["id"] for c in challenges})
    if not fehler:
        je_etappe: dict[int, int] = {}
        for c in challenges:
            je_etappe[c.get("stage", 1)] = je_etappe.get(c.get("stage", 1), 0) + 1
        for nr, n in sorted(je_etappe.items()):
            if n < MIN_CHALLENGES_JE_ETAPPE:
                warnungen.append(f"Etappe {nr} hat nur {n} Challenges (empfohlen: mindestens {MIN_CHALLENGES_JE_ETAPPE}).")
        for nr in sorted(je_etappe):
            n = len(benoetigte_fakten([c for c in challenges if c.get("stage", 1) == nr]))
            if n > MAX_FAKTEN_JE_ETAPPE:
                warnungen.append(f"Etappe {nr} braucht {n} Fakten (empfohlen: höchstens {MAX_FAKTEN_JE_ETAPPE}).")
    if assets is not None:
        for e in [*fakten, *challenges]:
            if e.get("image") and e["image"] not in assets:
                warnungen.append(f"»{e['id']}«: Bild »{e['image']}« fehlt in den Assets.")
    return fehler, warnungen


def _pruefe_claims(satz: dict, fakt_ids: set[str], echte: set[str], challenge_ids: set[str]) -> list[str]:
    """Behauptungen für den Gerichtssaal: wie Challenges, aber mit ``refutedBy`` statt ``solve``."""
    fehler: list[str] = []
    for c in _eintraege(satz, "claims", "Behauptung", fehler):
        if c["id"] in fakt_ids | challenge_ids:
            fehler.append(f"Behauptung »{c['id']}«: id ist schon Fakt oder Challenge (ids müssen verschieden sein).")
        widerlegt = c.get("refutedBy")
        if not isinstance(widerlegt, list) or not widerlegt:
            fehler.append(f"Behauptung »{c['id']}«: »refutedBy« darf nicht leer sein.")
        else:
            fehler += [f"Behauptung »{c['id']}«: »{i}« ist kein Fakt (oder ein Ablenker)." for i in widerlegt if i not in echte]
        if "strength" in c and not (_ist_int(c["strength"]) and 1 <= c["strength"] <= 3):
            fehler.append(f"Behauptung »{c['id']}«: »strength« muss 1 bis 3 sein.")
        if "stage" in c and not (_ist_int(c["stage"]) and c["stage"] >= 1):
            fehler.append(f"Behauptung »{c['id']}«: »stage« muss eine ganze Zahl ab 1 sein.")
    return fehler


def _pruefe_stufen(daten: dict) -> list[str]:
    """Aufbau von ``levels`` (nicht der aufgelöste Satz)."""
    levels = daten.get("levels")
    if levels is None:
        return []
    if not isinstance(levels, dict):
        return ["»levels« muss ein Objekt sein."]
    fehler = []
    for k, stufe in levels.items():
        if k not in {str(s) for s in STUFEN}:
            fehler.append(f"»levels«: Schlüssel »{k}« ist keine Stufe (1 bis 4).")
        elif not isinstance(stufe, dict):
            fehler.append(f"Stufe {k}: muss ein Objekt sein.")
        else:
            for feld in ("facts", "challenges"):
                liste = stufe.get(feld, [])
                if not isinstance(liste, list) or not all(isinstance(e, dict) and isinstance(e.get("id"), str) for e in liste):
                    fehler.append(f"Stufe {k}: »{feld}« braucht Einträge mit »id«.")
            if not isinstance(stufe.get("omit", []), list):
                fehler.append(f"Stufe {k}: »omit« muss eine Liste sein.")
    return fehler


def pruefe_satz(daten: dict, assets: set[str] | None = None) -> tuple[list[str], list[str]]:
    """(fehler, warnungen). Basis und jede Stufe mit eigenen Anpassungen werden einzeln geprüft."""
    if not isinstance(daten, dict):
        return ["Der Satz muss ein JSON-Objekt sein."], []
    fehler,warnungen = _pruefe_aufgeloest({k: v for k, v in daten.items() if k != "levels"}, assets)
    fehler += _pruefe_stufen(daten)
    if fehler:
        return fehler, warnungen
    for k in sorted(daten.get("levels") or {}):
        f, w = _pruefe_aufgeloest(satz_fuer_stufe(daten, int(k)), assets)
        fehler += [f"Stufe {k}: {m}" for m in f]
        warnungen += [f"Stufe {k}: {m}" for m in w]
    return fehler, warnungen


# ── Stufen und Etappen ───────────────────────────────────────────────

def satz_fuer_stufe(daten: dict, stufe: int) -> dict:
    """Basis mit den Anpassungen der Stufe (flaches Merge je id, neue ids kommen dazu, omit entfällt)."""
    satz = copy.deepcopy({k: v for k, v in daten.items() if k != "levels"})
    anpassung = (daten.get("levels") or {}).get(str(stufe)) or {}
    for schluessel in ("facts", "challenges"):
        liste = satz.get(schluessel, [])
        vorhanden = {e["id"]: e for e in liste}
        for neu in copy.deepcopy(anpassung.get(schluessel, [])):
            if neu["id"] in vorhanden:
                vorhanden[neu["id"]].update(neu)
            else:
                liste.append(neu)
                vorhanden[neu["id"]] = neu
        weg = set(anpassung.get("omit", []))
        satz[schluessel] = [e for e in liste if e["id"] not in weg]
    return satz


def claims_als_challenges(daten: dict) -> list[dict]:
    """Gerichtssaal: jede Behauptung ist eine Challenge, die durch einen der ``refutedBy``-Fakten gelöst wird."""
    return [{"id": c["id"], "text": c["text"], "solve": {"any": list(c["refutedBy"])},
             **{k: c[k] for k in ("stage", "strength", "feedback") if k in c}} for c in daten.get("claims") or []]


def benoetigte_fakten(challenges: list[dict]) -> list[str]:
    """Alle Fakt-ids, die in der ``solve``-Liste einer der Challenges stehen (ohne Doppelte, in Reihenfolge)."""
    return list(dict.fromkeys(i for c in challenges for ids in c["solve"].values() for i in ids))


def fakten_fuer_etappe(satz: dict, aufgaben: list[dict], ablenker: int | None, rng: random.Random) -> list[dict]:
    """Brett-Fakten einer Etappe: alle nötigen plus Ablenker (erst Decoys, dann echte Fakten anderer Etappen),
    zusammen höchstens MAX_FAKTEN_JE_ETAPPE; nötige fallen nie weg. Gemischt."""
    noetig = set(benoetigte_fakten(aufgaben))
    gewaehlt = [f for f in satz["facts"] if f["id"] in noetig]
    ziel = MAX_FAKTEN_JE_ETAPPE if ablenker is None else min(MAX_FAKTEN_JE_ETAPPE, len(gewaehlt) + ablenker)
    decoys = [f for f in satz["facts"] if f.get("decoy")]
    andere = [f for f in satz["facts"] if not f.get("decoy") and f["id"] not in noetig]
    rng.shuffle(decoys)
    rng.shuffle(andere)
    gewaehlt += [*decoys, *andere][:max(0, ziel - len(gewaehlt))]
    rng.shuffle(gewaehlt)
    return gewaehlt


def etappen(satz: dict) -> list[int]:
    return sorted({c.get("stage", 1) for c in satz.get("challenges", [])})


# ── Bewertung ────────────────────────────────────────────────────────

def bewerte(challenge: dict, fakt_ids: list[str]) -> dict:
    alle = "all" in challenge["solve"]
    loesung = set(challenge["solve"]["all" if alle else "any"])
    gewaehlt = set(fakt_ids)
    richtig, falsch = gewaehlt & loesung, gewaehlt - loesung
    if alle:
        einheit, basis = 1 / len(loesung), len(richtig) / len(loesung)
    else:
        einheit, basis = 1, 1 if richtig else 0
    netto = round(max(0, basis - MALUS * einheit * len(falsch)), 4)
    komplett = basis == 1 and not falsch
    kombo = komplett and alle and len(loesung) >= 2
    faktor = 1 + 0.25 * (len(loesung) - 1) if kombo else 1
    schaden = round(netto * challenge.get("strength", 1) * 10 * faktor)
    return {"qualitaet": netto, "treffer": netto > 0, "komplett": komplett, "kombo": kombo,
            "schaden": int(schaden), "falsch": sorted(falsch)}


def guete(fragen: list[dict]) -> float:
    return sum(f["q"] for f in fragen) / len(fragen) if fragen else 0.0


def ergebnis(fragen: list[dict], anzahl_challenges: int) -> float:
    if not fragen or anzahl_challenges <= 0:
        return 0
    geschafft = len({f["c"] for f in fragen if f["komplett"]})
    return round(guete(fragen) * min(1, geschafft / anzahl_challenges), 4)


# ── Lesetempo ────────────────────────────────────────────────────────

def woerter(text: str) -> int:
    return len(text.split())


def lesetempo(woerter: int, lese_ms: int) -> float | None:
    """Wörter pro Minute."""
    return woerter / (lese_ms / 60000) if lese_ms > 0 else None


def _wpm(stufe: int, kalibrierung: dict | None) -> float:
    return ((kalibrierung or {}).get("lese_wpm") or {}).get(str(stufe)) or STUFE_PARAMS[stufe]["lese_wpm"]


def geraten(woerter: int, lese_ms: int, stufe: int, kalibrierung: dict | None = None) -> bool:
    """Gelesen in weniger als 30 % der erwarteten Zeit."""
    erwartet_ms = woerter / _wpm(stufe, kalibrierung) * 60000
    return lese_ms < GERATEN_ANTEIL * erwartet_ms


# ── Dynamische Stufe (DDA) ───────────────────────────────────────────

def _regelwerk(kalibrierung: dict | None) -> dict:
    """Standard-Regelwerk; mit Kalibrierung verschieben sich nur die Grenzen der Antwortzeit."""
    zeit = (kalibrierung or {}).get("antwortzeit")
    if not zeit:
        return dda.DEFAULT_RULESET
    return _regelwerk_fuer(zeit["schnell"], zeit["langsam"])


@lru_cache(maxsize=64)
def _regelwerk_fuer(schnell: float, langsam: float) -> dict:
    regeln = copy.deepcopy(dda.DEFAULT_RULESET)
    grenzen = {"fast": [0, 0, schnell], "medium": [schnell * 0.67, (schnell + langsam) / 2, langsam * 1.25],
               "slow": [langsam, 60, 60]}
    eingang = next(i for i in regeln["inputs"] if i["id"] == "response_time")
    for mf in eingang["membershipFunctions"]:
        mf["params"] = [min(60, max(0, p)) for p in grenzen[mf["name"]]]
    return regeln


def neue_stufe(stufe: int, verlauf: list[dict], kalibrierung: dict | None = None) -> int:
    """Höchstens ein Schritt Richtung Ziel; erst nach drei Antworten auf der aktuellen Stufe."""
    seit_wechsel = 0
    for s in reversed(verlauf):
        if s.get("stufe") != stufe:
            break
        seit_wechsel += 1
    if seit_wechsel < STUFE_MIN_SNAPSHOTS:
        return stufe
    geruest = dda.infer(_regelwerk(kalibrierung), dda.current_metrics(verlauf))["scaffolding_level"]
    ziel = 4 if geruest < 25 else 3 if geruest < 50 else 2 if geruest < 75 else 1
    return max(1, min(4, stufe + (ziel > stufe) - (ziel < stufe)))


# ── Kalibrierung (Vorschlag, die Lehrkraft bestätigt) ────────────────

def _begrenzt(neu: float, alt: float) -> float:
    return min(alt * (1 + VORSCHLAG_GRENZE), max(alt * (1 - VORSCHLAG_GRENZE), neu))


def vorschlag(fragen_je_stufe: dict[int, list[dict]], aktuell: dict) -> dict:
    """Neue Werte aus den bisherigen Antworten: Median-Lesetempo je Stufe, p25/p75 der Wahlzeit;
    je Wert höchstens ±20 % gegenüber ``aktuell``, erst ab 30 Antworten."""
    alt = {"lese_wpm": {**STANDARD_KALIBRIERUNG["lese_wpm"], **(aktuell.get("lese_wpm") or {})},
           "antwortzeit": {**STANDARD_KALIBRIERUNG["antwortzeit"], **(aktuell.get("antwortzeit") or {})}}
    werte = copy.deepcopy(alt)
    stichprobe = {}
    for stufe in STUFEN:
        fragen = [f for f in fragen_je_stufe.get(stufe, []) if not geraten(f["woerter"], f["lese_ms"], stufe, alt)]
        tempos = [t for t in (lesetempo(f["woerter"], f["lese_ms"]) for f in fragen) if t is not None]
        stichprobe[stufe] = len(tempos)
        if len(tempos) >= VORSCHLAG_MIN_STICHPROBE:
            werte["lese_wpm"][str(stufe)] = round(_begrenzt(statistics.median(tempos), alt["lese_wpm"][str(stufe)]))
    zeiten = [f["wahl_ms"] / 1000 for fragen in fragen_je_stufe.values() for f in fragen]
    zeit_genug = len(zeiten) >= VORSCHLAG_MIN_STICHPROBE
    if zeit_genug:
        p25, _, p75 = statistics.quantiles(zeiten, n=4)
        schnell = round(_begrenzt(p25, alt["antwortzeit"]["schnell"]), 1)
        langsam = round(_begrenzt(p75, alt["antwortzeit"]["langsam"]), 1)
        if 0 < schnell < langsam <= 60:
            werte["antwortzeit"] = {"schnell": schnell, "langsam": langsam}
    return {"werte": werte, "stichprobe": stichprobe,
            "genug": zeit_genug or any(n >= VORSCHLAG_MIN_STICHPROBE for n in stichprobe.values())}
