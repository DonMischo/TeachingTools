"""Regeln der gemeinsamen Bestenliste (``routers/bestenlisten.py``).

Je Werkzeug: welche Modi es gibt, ob mehr oder weniger gewinnt, welche
Plausibilitätsgrenzen gelten und welche Zusatzfelder (``extra``) mitkommen.

**Zur Ehrlichkeit der Zahlen:** Die Werte kommen aus dem Browser und liessen
sich mit den Entwicklerwerkzeugen frisieren. Dagegen hilft nur eine
Plausibilitätsgrenze, nicht mehr — für eine Klassenbestenliste ist das der
richtige Aufwand, für eine Wertung mit Konsequenzen wäre es zu wenig.
"""
from dataclasses import dataclass
from typing import Callable

from fastapi import HTTPException


def _unplausibel() -> HTTPException:
    return HTTPException(400, "Dieser Wert ist nicht plausibel.")


@dataclass(frozen=True)
class Modus:
    richtung: str  # "max": mehr ist besser, "min": weniger ist besser
    pruefe: Callable[[float, dict], None]


@dataclass(frozen=True)
class Werkzeug:
    modi: dict[str, Modus]
    # Aus dem Browser-Body die erlaubten Zusatzfelder holen und prüfen (422 bei Unsinn).
    bereinige: Callable[[dict], dict]
    # Gäste ohne Konto tragen sich nicht ein: eine Liste frei gewählter Namen wäre keine.
    nur_konten: bool = False
    # "eintrag": Sitzung, in der die Bestleistung fiel (session_id);
    # "teilnehmer": alle, die in der Sitzung einen Stand gemeldet haben.
    sitzung_filter: str = "eintrag"
    # Sortierwert aus dem gemeldeten Wert (Standard: der Wert selbst).
    rang: Callable[[str, float, dict], float] | None = None


def _ganz(extra: dict, schluessel: str, hoechstens: int | None = None) -> int:
    wert = extra.get(schluessel, 0)
    if isinstance(wert, bool) or not isinstance(wert, int) or wert < 0 or (hoechstens is not None and wert > hoechstens):
        raise HTTPException(422, f"Ungültiges Feld: {schluessel}")
    return wert


def _text(extra: dict, schluessel: str) -> str | None:
    wert = extra.get(schluessel)
    if wert is not None and not isinstance(wert, str):
        raise HTTPException(422, f"Ungültiges Feld: {schluessel}")
    return wert[:200] if wert else None


# ── Markieren & Bearbeiten: kleinste Zeit gewinnt ───────────────────────────
# Modus → Zahl der Aufgaben; spiegelt MODI in frontend/src/lib/markieren/aufgaben.ts.
MARKIEREN_AUFGABEN = {"markieren": 10, "bearbeiten": 8, "gemischt": 12, "tastatur": 10}
# Schneller als eine Sekunde je Aufgabe geht es nicht: allein das grüne »Geschafft« steht 0,7 s.
MIN_MS_JE_AUFGABE = 1000
MAX_MS = 60 * 60 * 1000


def _markieren_pruefe(aufgaben: int) -> Callable[[float, dict], None]:
    def pruefe(wert: float, extra: dict) -> None:
        if wert < aufgaben * MIN_MS_JE_AUFGABE or wert > MAX_MS:
            raise HTTPException(400, "Diese Zeit ist nicht plausibel.")
    return pruefe


def _markieren_extra(extra: dict) -> dict:
    return {"aktionen": _ganz(extra, "aktionen", 10000)}


# ── Maus-Führerschein: alle vier Modi »mehr ist besser« ─────────────────────
# Modus → Obergrenze; spiegelt GRENZEN in frontend/src/lib/maus/ergebnis.ts.
MAUS_GRENZEN = {"klick": 24000, "doppelklick": 13500, "ziehen": 6000, "gesamt": 80000}


def _maus_pruefe(grenze: float) -> Callable[[float, dict], None]:
    def pruefe(wert: float, extra: dict) -> None:
        if wert <= 0 or wert > grenze:
            raise _unplausibel()
    return pruefe


def _maus_extra(extra: dict) -> dict:
    hilfe = extra.get("hilfe", False)
    if not isinstance(hilfe, bool):
        raise HTTPException(422, "Ungültiges Feld: hilfe")
    return {"dauer_ms": _ganz(extra, "dauer_ms"), "kontext": _text(extra, "kontext"), "hilfe": hilfe}


# ── Schreibübung (tippen): drei Modi, Tastenjagd »weniger ist besser« ───────
# Obergrenzen für plausible Werte; 600 A/min wären Weltklasse, darüber hat jemand nachgeholfen.
TIPPEN_GRENZEN = {"lektionen": 600, "wortregen": 10000, "tastenjagd": 5000}
# Unter 80 ms ist keine menschliche Reaktion mehr.
UNTERGRENZE_TASTENJAGD = 80


def _tippen_pruefe(modus: str) -> Callable[[float, dict], None]:
    def pruefe(wert: float, extra: dict) -> None:
        if wert <= 0 or wert > TIPPEN_GRENZEN[modus]:
            raise _unplausibel()
        if modus == "tastenjagd" and wert < UNTERGRENZE_TASTENJAGD:
            raise _unplausibel()
        if extra["fehler"] > extra["anschlaege"]:
            raise HTTPException(400, "Mehr Fehler als Anschläge — das passt nicht zusammen.")
    return pruefe


def _tippen_extra(extra: dict) -> dict:
    return {
        "anschlaege": _ganz(extra, "anschlaege"), "fehler": _ganz(extra, "fehler"),
        "dauer_ms": _ganz(extra, "dauer_ms"), "kontext": _text(extra, "kontext"),
    }


def tippen_wertung(modus: str, wert: float, extra: dict) -> float:
    """Sortierwert. Lektionen: A/min × (1 − Fehlerquote)² — 5 % Fehler kosten
    rund 10 % der Punkte. Dieselbe Formel wie beim Wettschreiben. Das reine
    Tempo bleibt als ``extra['tempo']`` stehen."""
    if modus != "lektionen":
        return wert
    anschlaege, fehler = extra.get("anschlaege", 0), extra.get("fehler", 0)
    quote = min(1.0, fehler / anschlaege) if anschlaege else 0.0
    return round(wert * (1 - quote) ** 2, 1)


REGELN: dict[str, Werkzeug] = {
    "markieren": Werkzeug(
        modi={m: Modus("min", _markieren_pruefe(n)) for m, n in MARKIEREN_AUFGABEN.items()},
        bereinige=_markieren_extra,
    ),
    "maus": Werkzeug(
        modi={m: Modus("max", _maus_pruefe(g)) for m, g in MAUS_GRENZEN.items()},
        bereinige=_maus_extra,
        sitzung_filter="teilnehmer",
    ),
    "tippen": Werkzeug(
        modi={
            m: Modus("min" if m == "tastenjagd" else "max", _tippen_pruefe(m))
            for m in TIPPEN_GRENZEN
        },
        bereinige=_tippen_extra,
        nur_konten=True,
        rang=tippen_wertung,
    ),
}
