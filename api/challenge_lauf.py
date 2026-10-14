"""Challenge-Lauf: die Spiellogik über einem Stand-dict (keine Datenbank).

Der Router (api/routers/challenge.py) bildet die Spalten von ChallengeStand auf dieses dict ab;
TaskCrawler (Boss-Folie) kann dieselbe Logik ohne ChallengeStand-Zeile nutzen.

lauf = {"stufe", "stufe_start", "seed", "spiel", "fertig",
        "zustand": {"etappe", "leben", "erledigt", "deck": {etappe: [fakt_ids]}, "deck_ablenker": [fakt_ids]},
        "fragen": [...], "verlauf": [...]}
"""
import random
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from . import challenge_engine as eng
from . import dda

STANDARD_STARTSTUFE = 2
SKINS = ("monster", "rap", "prinzessin", "einhorn")


# Eingaben, die der Challenge-Router und die Boss-Folien (TaskCrawler) teilen
class StartIn(BaseModel):
    spiel: str | None = Field(default=None, max_length=30)


class DeckIn(BaseModel):
    fakt_ids: list[str] = Field(max_length=100)


class AntwortIn(BaseModel):
    challenge_id: str = Field(max_length=100)
    fakt_ids: list[str] = Field(max_length=100)
    lese_ms: int = Field(ge=0)
    wahl_ms: int = Field(ge=0)
    tipp: bool = False


class LaufFehler(Exception):
    def __init__(self, status: int, text: str):
        super().__init__(text)
        self.status, self.text = status, text


def _satz(daten: dict, lauf: dict) -> dict:
    """Satz der aktuellen Stufe; im Gerichtssaal sind die Behauptungen die Challenges."""
    satz = eng.satz_fuer_stufe(daten, lauf["stufe"])
    if lauf["spiel"] == "gericht":
        satz["challenges"] = eng.claims_als_challenges(daten)
    return satz


def neuer_lauf(daten: dict, stufe: int, spiel: str = "normal", seed: int | None = None) -> dict:
    lauf = {"stufe": stufe, "stufe_start": stufe, "seed": random.getrandbits(31) if seed is None else seed,
            "spiel": spiel, "fertig": False, "fragen": [], "verlauf": [], "zustand": {}}
    lauf["zustand"] = {"etappe": eng.etappen(_satz(daten, lauf))[0], "leben": eng.LEBEN, "erledigt": [], "deck": {}}
    return lauf


def spiel_wechseln(daten: dict, lauf: dict, spiel: str) -> None:
    """Spielart eines bestehenden Laufs; vom/zum Gerichtssaal nur, solange es noch keine Antworten gibt."""
    if spiel == lauf["spiel"]:
        return
    if "gericht" in (spiel, lauf["spiel"]) and lauf["fragen"]:
        raise LaufFehler(409, "Der Gerichtssaal lässt sich nach der ersten Antwort nicht mehr wechseln")
    lauf["spiel"] = spiel
    if not lauf["fragen"]:
        lauf["zustand"]["etappe"] = eng.etappen(_satz(daten, lauf))[0]


def _in_etappe(satz: dict, nr: int) -> list[dict]:
    return [c for c in satz["challenges"] if c.get("stage", 1) == nr]


def _etappe(satz: dict, lauf: dict) -> int:
    """Aktuelle Etappe: ab dem gemerkten Stand die erste mit offenen Challenges (nach einem Stufenwechsel
    kann sich der Satz geändert haben), sonst die letzte."""
    erledigt = set(lauf["zustand"]["erledigt"])
    nummern = eng.etappen(satz)
    for nr in nummern:
        if nr >= lauf["zustand"]["etappe"] and any(c["id"] not in erledigt for c in _in_etappe(satz, nr)):
            return nr
    return nummern[-1]


def brett(daten: dict, lauf: dict, bild=lambda name: name, tipps: bool | None = None, satz: dict | None = None) -> dict:
    satz = satz or _satz(daten, lauf)
    etappe = _etappe(satz, lauf)
    erledigt = set(lauf["zustand"]["erledigt"])
    params = eng.STUFE_PARAMS[lauf["stufe"]]
    titel = {s.get("id"): s.get("title") for s in satz.get("stages", []) if isinstance(s, dict)}
    # Ablenker: eine feste Auswahl je Spieler (seed), damit sie beim Neuladen gleich bleiben
    ablenker = [f for f in satz["facts"] if f.get("decoy")]
    if params["ablenker"] is not None:
        ablenker = random.Random(lauf["seed"]).sample(ablenker, min(params["ablenker"], len(ablenker)))
    fakten = [f for f in satz["facts"] if not f.get("decoy")] + ablenker
    aufgaben = _in_etappe(satz, etappe)
    rng = random.Random(lauf["seed"] + etappe)
    rng.shuffle(fakten)
    rng.shuffle(aufgaben)

    def challenge_out(c: dict) -> dict:
        aus = {"id": c["id"], "text": c["text"], "image": bild(c["image"]) if c.get("image") else None,
               "formula": c.get("formula"), "strength": c.get("strength", 1), "erledigt": c["id"] in erledigt}
        if params["tipps"] if tipps is None else tipps:
            aus["tip"] = c.get("tip")
        return aus

    return {
        "stufe": lauf["stufe"], "etappe": etappe, "leben": lauf["zustand"]["leben"], "spiel": lauf["spiel"],
        "deck": lauf["zustand"].get("deck", {}).get(str(etappe)),
        "etappen": [{"nr": nr, "titel": titel.get(nr) or f"Etappe {nr}",
                     "erledigt": all(c["id"] in erledigt for c in _in_etappe(satz, nr))}
                    for nr in eng.etappen(satz)],
        "challenges": [challenge_out(c) for c in aufgaben],
        "fakten": [{"id": f["id"], "text": f["text"], "image": bild(f["image"]) if f.get("image") else None,
                    "formula": f.get("formula"), "info": f.get("info")} for f in fakten],
        "fertig": lauf["fertig"],
    }


def deck_setzen(daten: dict, lauf: dict, fakt_ids: list[str]) -> None:
    """Kartenspiel: die Fakten, mit denen die aktuelle Etappe gespielt wird (nur solche des Bretts)."""
    satz = _satz(daten, lauf)
    b = brett(daten, lauf, satz=satz)
    ids = list(dict.fromkeys(fakt_ids))
    if not ids or not set(ids) <= {f["id"] for f in b["fakten"]}:
        raise LaufFehler(400, "Das Deck braucht mindestens einen Fakt aus dem Brett")
    z = lauf["zustand"]
    z["deck"] = {**z.get("deck", {}), str(b["etappe"]): ids}
    ablenker = {f["id"] for f in satz["facts"] if f.get("decoy")}
    z["deck_ablenker"] = list(dict.fromkeys([*z.get("deck_ablenker", []), *(i for i in ids if i in ablenker)]))


def antworte(daten: dict, lauf: dict, challenge_id: str, fakt_ids: list[str], lese_ms: int, wahl_ms: int, tipp: bool,
             kalibrierung: dict | None = None) -> dict:
    return _antworte(daten, lauf, challenge_id, fakt_ids, lese_ms, wahl_ms, tipp, kalibrierung)[0]


def antworte_mit_brett(daten: dict, lauf: dict, challenge_id: str, fakt_ids: list[str], lese_ms: int, wahl_ms: int,
                       tipp: bool, kalibrierung: dict | None = None, bild=lambda name: name) -> tuple[dict, dict, dict]:
    """Antwort, neues Brett und Wertung mit einem einzigen Satz (der Stufe nach der Antwort)."""
    aus, satz = _antworte(daten, lauf, challenge_id, fakt_ids, lese_ms, wahl_ms, tipp, kalibrierung)
    return aus, brett(daten, lauf, bild, satz=satz), wertung(daten, lauf, satz)


def _antworte(daten, lauf, challenge_id, fakt_ids, lese_ms, wahl_ms, tipp, kalibrierung) -> tuple[dict, dict]:
    """(Antwort, Satz der Stufe nach der Antwort)."""
    if lauf["fertig"]:
        raise LaufFehler(409, "Schon fertig")
    satz = _satz(daten, lauf)
    challenge = next((c for c in satz["challenges"] if c["id"] == challenge_id), None)
    if challenge is None:
        raise LaufFehler(404, "Challenge nicht gefunden")
    etappe = _etappe(satz, lauf)
    z = {**lauf["zustand"], "erledigt": list(lauf["zustand"]["erledigt"]), "deck": dict(lauf["zustand"].get("deck", {}))}
    if challenge.get("stage", 1) != etappe or challenge["id"] in z["erledigt"]:
        raise LaufFehler(409, "Diese Challenge ist gerade nicht dran")
    deck = z["deck"].get(str(etappe))
    if deck is not None and not set(fakt_ids) <= set(deck):
        raise LaufFehler(409, "Nur Fakten aus dem Deck sind erlaubt")

    wertung = eng.bewerte(challenge, fakt_ids)
    fakten = {f["id"]: f for f in satz["facts"]}
    woerter = eng.woerter(challenge["text"]) + sum(eng.woerter(fakten[i]["text"]) for i in set(fakt_ids) if i in fakten)
    frage = {"c": challenge["id"], "f": fakt_ids, "q": wertung["qualitaet"], "komplett": wertung["komplett"],
             "kombo": wertung["kombo"], "schaden": wertung["schaden"], "stufe": lauf["stufe"], "lese_ms": lese_ms,
             "wahl_ms": wahl_ms, "woerter": woerter, "tipp": tipp, "t": datetime.now(timezone.utc).isoformat()}
    wiederholungen = sum(1 for f in lauf["fragen"] if f["c"] == challenge["id"])
    snapshot = {**dda.snapshot_from_task_metrics(wertung["komplett"], wahl_ms / 1000, 0 if wertung["komplett"] else 1,
                                                 int(tipp), wiederholungen), "stufe": lauf["stufe"]}

    zurueck = etappe_geschafft = False
    if wertung["komplett"]:
        z["erledigt"].append(challenge["id"])
    if not wertung["treffer"]:
        z["leben"] -= 1
        if z["leben"] <= 0:
            zurueck, z["leben"] = True, eng.LEBEN
            z["deck"].pop(str(etappe), None)  # neu zusammenstellen
    if all(c["id"] in z["erledigt"] for c in _in_etappe(satz, etappe)):
        etappe_geschafft = True
        z["leben"] = eng.LEBEN
        weitere = [nr for nr in eng.etappen(satz) if nr > etappe]
        if weitere:
            z["etappe"] = weitere[0]
        else:
            lauf["fertig"] = True

    lauf["fragen"] = [*lauf["fragen"], frage]
    lauf["verlauf"] = [*lauf["verlauf"], snapshot][-dda.HISTORY_LIMIT:]
    lauf["zustand"] = z
    stufe_alt = lauf["stufe"]
    lauf["stufe"] = eng.neue_stufe(lauf["stufe"], lauf["verlauf"], kalibrierung)
    if lauf["stufe"] != stufe_alt:
        satz = _satz(daten, lauf)

    aus = {"qualitaet": wertung["qualitaet"], "treffer": wertung["treffer"], "komplett": wertung["komplett"],
           "kombo": wertung["kombo"], "schaden": wertung["schaden"], "falsch_gewaehlt": len(wertung["falsch"]),
           "leben": z["leben"], "zurueck_zur_karte": zurueck, "etappe_geschafft": etappe_geschafft,
           "fertig": lauf["fertig"], "stufe": lauf["stufe"]}
    if wertung["komplett"]:
        aus["feedback"] = challenge.get("feedback")
    return aus, satz


def anzahl_challenges(daten: dict, lauf: dict) -> int:
    return len(_satz(daten, lauf)["challenges"])


def wertung(daten: dict, lauf: dict, satz: dict | None = None) -> dict:
    satz = satz or _satz(daten, lauf)
    return {"guete": round(eng.guete(lauf["fragen"]), 4),
            "ergebnis": eng.ergebnis(lauf["fragen"], len(satz["challenges"]))}
