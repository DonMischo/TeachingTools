"""Kartenquiz als Spiel: Lehrkraft teilt einen Kartensatz per Code/QR (ToolSession »karten«,
ref_id → KartenSatz), Schüler:innen und Gäste spielen, Hauspunkte je Klasse.

Spieler bekommen die Ebenen nur entschärft (ohne Namen, Token statt id) über
``/api/karten/quiz/{code}/ebene/…`` — die Kartenebenen-API selbst bleibt für
Konten. Prüfen geschieht ausschließlich hier auf dem Server (api/karten_quiz.py).

Einstellungen der Sitzung (ToolSession.settings, öffentlich lesbar):
  modus "benennen" | "finden", wortbank bool, max_punkte int, ueben bool (Lernhelfer erlaubt),
  punkte_vergeben (Zeitstempel, verhindert doppelte Buchung)

Lernhelfer (»Üben«, api/karten_lernen.py): stellt einzeln, was noch nicht sitzt,
mit Ablenkern; zählt nicht für Punkte, füllt aber den Lernstand (je Person und
Kartensatz, über Sitzungen hinweg). Quiz-Antworten fließen dort ebenfalls ein.
"""
import gzip
import hashlib
import json
import random
import secrets
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import karten_lernen as lernen
from .. import karten_quiz as engine
from ..auth import get_current_teacher, get_player
from ..config import settings
from ..database import get_db
from ..display_names import short_name
from ..models import Class, KartenBrett, KartenEbeneEigen, KartenLernstand, KartenQuizStand, KartenSatz, Student, Teacher, ToolSession, Transaction
from .karten import DATEN, EIGEN_PRAEFIX, EIGENE, katalog

router = APIRouter(prefix="/api/karten/quiz", tags=["karten-quiz"])

STANDARD_MAX_PUNKTE = 10
VERSUCHE_BIS_LOESUNG = 2


# ── Laden ────────────────────────────────────────────────────────────

def _sitzung(db: Session, code: str) -> ToolSession:
    s = db.query(ToolSession).filter_by(code=code.upper(), tool_slug="karten").first()
    if s is None:
        raise HTTPException(404, "Kartenquiz nicht gefunden")
    return s


def _satz(db: Session, s: ToolSession) -> KartenSatz:
    satz = db.get(KartenSatz, s.ref_id) if s.ref_id else None
    if satz is None:
        raise HTTPException(404, "Der Kartensatz zu diesem Quiz fehlt")
    return satz


def _geheim(s: ToolSession) -> str:
    return f"{settings.secret_key}:karten:{s.code}"


def _sammlung(ebene: str) -> dict:
    if ebene.startswith(EIGEN_PRAEFIX):
        pfad = EIGENE / f"{ebene.removeprefix(EIGEN_PRAEFIX)}.geojson"
    else:
        pfad = DATEN / "ebenen" / f"{ebene}.geojson"
    if not pfad.is_file():
        raise HTTPException(404, "Ebene fehlt")
    return json.loads(pfad.read_text(encoding="utf-8"))


def _ebenen_namen(db: Session) -> dict[str, str]:
    namen = {e["id"]: e["name"] for e in katalog()["ebenen"]}
    namen.update({f"{EIGEN_PRAEFIX}{e.id}": e.titel for e in db.query(KartenEbeneEigen).all()})
    return namen


def _reihenfolge(inhalt: dict) -> list[str]:
    basis = [e["id"] for e in katalog()["ebenen"]]
    return basis + [e for e in inhalt.get("auswahl", {}) if e not in basis]


def aufgaben(db: Session, satz: KartenSatz) -> list[dict]:
    cache: dict[str, dict] = {}

    def features_von(ebene: str) -> dict:
        if ebene not in cache:
            cache[ebene] = {f["properties"]["id"]: f for f in _sammlung(ebene)["features"]}
        return cache[ebene]
    return engine.aufgaben_aus_satz(satz.inhalt, _reihenfolge(satz.inhalt), features_von, _ebenen_namen(db))


def _einstellungen(s: ToolSession) -> dict:
    e = s.settings or {}
    return {"modus": e.get("modus") if e.get("modus") in engine.MODI else "benennen",
            "wortbank": bool(e.get("wortbank", False)),
            "max_punkte": int(e.get("max_punkte", STANDARD_MAX_PUNKTE)),
            "ueben": bool(e.get("ueben", True))}


# ── Teilnehmer ───────────────────────────────────────────────────────

def _wer(spieler) -> dict:
    if isinstance(spieler, Student):
        return {"student_id": spieler.id}
    if isinstance(spieler, Teacher):
        return {"teacher_id": spieler.id}
    return {"guest_id": spieler.id}


def _anzeigename(spieler) -> str:
    if isinstance(spieler, Student):
        return short_name(spieler)
    if isinstance(spieler, Teacher):
        return f"{spieler.first_name} {spieler.last_name}".strip()
    return spieler.name


def _stand(db: Session, s: ToolSession, spieler, anlegen: bool) -> KartenQuizStand | None:
    st = db.query(KartenQuizStand).filter_by(session_id=s.id, **_wer(spieler)).first()
    if st is None and anlegen:
        st = KartenQuizStand(session_id=s.id, name=_anzeigename(spieler)[:100], antworten={}, erfolge=[], verlauf={},
                             class_id=spieler.class_id if isinstance(spieler, Student) else None, **_wer(spieler))
        db.add(st)
        db.flush()
    return st


def _stand_out(st: KartenQuizStand | None) -> dict:
    if st is None:
        return {"antworten": {}, "richtig": 0, "erfolge": []}
    return {"antworten": st.antworten, "richtig": st.richtig, "erfolge": st.erfolge}


# ── Erfolge ──────────────────────────────────────────────────────────

ICON = {"fluesse": "🌊", "seen": "💧", "meere": "🌊", "staedte": "🏙️", "gipfel": "⛰️", "gebirge": "🏔️",
        "laender": "🗺️", "staaten": "🌍", "kontinente": "🌐", "landschaften": "🏜️"}


def erfolge_fuer(inhalt: dict, aufgaben_liste: list[dict]) -> list[dict]:
    """Vorgaben aus dem Kartensatz (inhalt.erfolge) — sonst je Ebene einer: alles richtig."""
    if inhalt.get("erfolge"):
        return inhalt["erfolge"]
    ebenen: dict[str, str] = {}
    for a in aufgaben_liste:
        ebenen.setdefault(a["ebene"], a["kategorie"])
    return [{"id": f"alle-{e}", "name": f"{name}-Profi",
             "icon": next((i for k, i in ICON.items() if k in e), "🏅"), "ebenen": [e], "schwelle": 1.0}
            for e, name in ebenen.items()]


def _neue_erfolge(st: KartenQuizStand, vorgaben: list[dict], aufgaben_liste: list[dict], lern: KartenLernstand | None) -> list[str]:
    """Neu erreichte Erfolge; »komplett« zuletzt, weil er von den anderen abhängt."""
    erreicht = set(st.erfolge)
    alle_ids = [v["id"] for v in vorgaben]
    neu = []
    for v in sorted(vorgaben, key=lambda v: v.get("art") == "komplett"):
        if v["id"] in erreicht:
            continue
        if lernen.erfolg_erreicht(v, aufgaben_liste, st.antworten, st.verlauf or {}, lern.objekte if lern else {},
                                  lern.tage if lern else [], erreicht, alle_ids):
            erreicht.add(v["id"])
            neu.append(v["id"])
    return neu


def _erfolge_out(vorgaben: list[dict], namen: dict[str, str]) -> list[dict]:
    return [{"id": v["id"], "name": v["name"], "icon": v.get("icon", "🏅"), "text": lernen.beschreibung(v, namen)} for v in vorgaben]


# ── Lernstand ────────────────────────────────────────────────────────

def _lernstand(db: Session, satz_id: int, spieler, anlegen: bool) -> KartenLernstand | None:
    ls = db.query(KartenLernstand).filter_by(satz_id=satz_id, **_wer(spieler)).first()
    if ls is None and anlegen:
        ls = KartenLernstand(satz_id=satz_id, objekte={}, tage=[], letzte=[], **_wer(spieler))
        db.add(ls)
        db.flush()
    return ls


def _verbuche(ls: KartenLernstand, a: dict, richtig: bool, art: str, verwechselt_mit: str | None) -> None:
    jetzt = datetime.now(timezone.utc)
    ls.objekte = {**ls.objekte, lernen.schluessel(a): lernen.verbuche(ls.objekte, a, richtig, art, jetzt, verwechselt_mit)}
    tag = lernen.heute(jetzt)
    if tag not in ls.tage:
        ls.tage = [*ls.tage, tag]


def _verwechselt(liste: list[dict], aufgabe: dict, art: str, antwort: str, geheim: str) -> str | None:
    """Welches andere Objekt des Satzes war gemeint? (benennen: Name passt; finden: dessen Token)."""
    for b in liste:
        if b is aufgabe:
            continue
        if (art == "benennen" and engine.name_passt(antwort, b)) or (art == "finden" and antwort == engine.token(geheim, b["ebene"], b["id"])):
            return lernen.schluessel(b)
    return None


def _lern_out(ls: KartenLernstand | None, liste: list[dict]) -> dict:
    """Für die Anzeige: Sicherheit je Aufgabennummer (0–1) und wie viele Objekte noch wackeln."""
    obj = ls.objekte if ls else {}
    sicher = {str(a["nr"]): round(lernen.sicherheit(obj.get(lernen.schluessel(a))), 2) for a in liste}
    return {"sicherheit": sicher, "schwach": sum(1 for v in sicher.values() if v < 0.5), "tage": len(ls.tage) if ls else 0}


def _katalog_meta(db: Session, inhalt: dict) -> list[dict]:
    """Ebenen-Metadaten für den Kartenstil (Gäste dürfen den Katalog sonst nicht lesen)."""
    meta = [k for k in katalog()["ebenen"] if k["id"] in inhalt["ebenen"]]
    for k in inhalt["ebenen"]:
        nummer = k.removeprefix(EIGEN_PRAEFIX)
        eigen = db.get(KartenEbeneEigen, int(nummer)) if k.startswith(EIGEN_PRAEFIX) and nummer.isdigit() else None
        if eigen:
            meta.append({"id": k, "name": eigen.titel, "gruppe": "eigen", "bereich": "eigen", "geometrie": eigen.geometrie,
                         "quiz": True, "bytes": 0, "quelle": {"name": "Eigene Daten", "lizenz": "", "url": ""}})
    return meta


def _karte(inhalt: dict) -> dict:
    """Was die Spielerkarte zeigt — ohne Objekt-ids (die stecken als Token in »spiel.auswahl«)."""
    return {"art": inhalt["art"], "region": inhalt.get("region", "deutschland"), "ebenen": inhalt["ebenen"],
            "ausschnitt": inhalt.get("ausschnitt"), "filter": inhalt.get("filter", {}),
            "auswahl": {k: {"zeigen": v.get("zeigen", "alle")} for k, v in inhalt.get("auswahl", {}).items()}}


# ── Spieler ──────────────────────────────────────────────────────────

@router.get("/{code}")
def spiel(code: str, db: Session = Depends(get_db), spieler=Depends(get_player)):
    s = _sitzung(db, code)
    if s.status == "closed":
        raise HTTPException(403, "Dieses Quiz ist geschlossen")
    satz = _satz(db, s)
    e = _einstellungen(s)
    liste = aufgaben(db, satz)
    mischen = int(hashlib.sha256(json.dumps(_wer(spieler)).encode()).hexdigest()[:8], 16)
    inhalt = satz.inhalt
    return {
        "titel": satz.titel, "einstellungen": e, "katalog": _katalog_meta(db, inhalt), "karte": _karte(inhalt),
        "spiel": engine.fuer_spieler(liste, e["modus"], _geheim(s), wortbank=e["wortbank"], mischen=mischen),
        "erfolge": _erfolge_out(erfolge_fuer(inhalt, liste), _ebenen_namen(db)),
        "stand": _stand_out(_stand(db, s, spieler, anlegen=False)),
        "lernen": _lern_out(_lernstand(db, satz.id, spieler, anlegen=False), liste),
    }


@router.get("/{code}/ebene/{ebene_id}")
def ebene(code: str, ebene_id: str, request: Request, db: Session = Depends(get_db), _spieler=Depends(get_player)):
    s = _sitzung(db, code)
    satz = _satz(db, s)
    if ebene_id not in satz.inhalt.get("ebenen", []):
        raise HTTPException(404, "Diese Ebene gehört nicht zum Quiz")
    daten = json.dumps(engine.entschaerfe_ebene(_sammlung(ebene_id), ebene_id, _geheim(s)), ensure_ascii=False).encode("utf-8")
    if "gzip" in request.headers.get("accept-encoding", ""):
        return Response(gzip.compress(daten, compresslevel=6), media_type="application/geo+json",
                        headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding"})
    return Response(daten, media_type="application/geo+json")


class AntwortIn(BaseModel):
    nr: int = Field(ge=1)
    antwort: str = Field(max_length=200)


@router.post("/{code}/antwort")
def antwort(code: str, body: AntwortIn, db: Session = Depends(get_db), spieler=Depends(get_player)):
    s = _sitzung(db, code)
    if s.status == "closed":
        raise HTTPException(403, "Dieses Quiz ist geschlossen")
    satz = _satz(db, s)
    e = _einstellungen(s)
    liste = aufgaben(db, satz)
    aufgabe = next((a for a in liste if a["nr"] == body.nr), None)
    if aufgabe is None:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    st = _stand(db, s, spieler, anlegen=True)
    alt = st.antworten.get(str(body.nr), {"richtig": False, "versuche": 0})
    if alt["richtig"]:
        return {"richtig": True, "versuche": alt["versuche"], "neue_erfolge": [], "stand": _stand_out(st)}
    richtig = engine.pruefe(aufgabe, e["modus"], body.antwort, _geheim(s))
    jetzt = datetime.now(timezone.utc)
    verlauf = dict(st.verlauf or {})
    verlauf.setdefault("beginn", jetzt.isoformat())
    verlauf["serie"] = verlauf.get("serie", 0) + 1 if richtig else 0
    verlauf["beste_serie"] = max(verlauf.get("beste_serie", 0), verlauf["serie"])
    st.verlauf = verlauf
    neu = {"richtig": richtig, "versuche": alt["versuche"] + 1,
           "t": round((jetzt - datetime.fromisoformat(verlauf["beginn"])).total_seconds())}
    st.antworten = {**st.antworten, str(body.nr): neu}
    st.richtig = sum(1 for a in st.antworten.values() if a["richtig"])
    ls = _lernstand(db, satz.id, spieler, anlegen=True)
    verwechselt = None if richtig else _verwechselt(liste, aufgabe, e["modus"], body.antwort, _geheim(s))
    _verbuche(ls, aufgabe, richtig, e["modus"], verwechselt)
    neue = _neue_erfolge(st, erfolge_fuer(satz.inhalt, liste), liste, ls)
    if neue:
        st.erfolge = [*st.erfolge, *neue]
    db.commit()
    aus = {"richtig": richtig, "versuche": neu["versuche"], "neue_erfolge": neue, "stand": _stand_out(st),
           "lernen": _lern_out(ls, liste)}
    if not richtig and neu["versuche"] >= VERSUCHE_BIS_LOESUNG:
        # Nach zwei Fehlversuchen die Lösung zeigen (benennen: Name, finden: das Objekt)
        aus["loesung"] = aufgabe["name"] if e["modus"] == "benennen" else engine.token(_geheim(s), aufgabe["ebene"], aufgabe["id"])
    return aus


# ── Üben (Lernhelfer) ────────────────────────────────────────────────

def _ueben_sitzung(db: Session, code: str) -> tuple[ToolSession, KartenSatz, list[dict]]:
    s = _sitzung(db, code)
    if s.status == "closed":
        raise HTTPException(403, "Dieses Quiz ist geschlossen")
    if not _einstellungen(s)["ueben"]:
        raise HTTPException(403, "Üben ist in diesem Quiz ausgeschaltet")
    satz = _satz(db, s)
    liste = aufgaben(db, satz)
    if not liste:
        raise HTTPException(404, "Keine Aufgaben")
    return s, satz, liste


def _pool(liste: list[dict], ziel: dict, rng: random.Random) -> list[dict]:
    """Ablenker-Kandidaten: die anderen Aufgaben, bei wenigen dazu Objekte derselben Ebene aus dem vollen Datensatz."""
    pool = [a for a in liste if a is not ziel]
    if sum(1 for a in pool if a["ebene"] == ziel["ebene"]) >= lernen.ABLENKER * 2:
        return pool
    namen = {a["name"] for a in liste}
    rest = [f for f in _sammlung(ziel["ebene"])["features"] if f["properties"].get("name") and f["properties"]["name"] not in namen]
    for f in rng.sample(rest, min(40, len(rest))):
        g = f["geometry"] or {}
        pool.append({"ebene": ziel["ebene"], "id": f["properties"]["id"], "name": f["properties"]["name"],
                     "anker": g["coordinates"][:2] if g.get("type") == "Point" else None})
    return pool


@router.get("/{code}/ueben")
def ueben_naechste(code: str, db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Nächste Übungsaufgabe: was am meisten Übung braucht; unsicher → Auswahl mit Ablenkern, sicher → frei."""
    s, satz, liste = _ueben_sitzung(db, code)
    ls = _lernstand(db, satz.id, spieler, anlegen=True)
    rng = random.Random()
    a = lernen.waehle(liste, ls.objekte, ls.letzte, datetime.now(timezone.utc), rng)
    ls.letzte = [*ls.letzte, lernen.schluessel(a)][-5:]
    db.commit()
    eintrag = ls.objekte.get(lernen.schluessel(a))
    art = lernen.richtung(eintrag, rng)
    hilfe = lernen.hilfe(eintrag, art)
    geheim = _geheim(s)
    aus = {"nr": a["nr"], "richtung": art, "hilfe": hilfe, "kategorie": a["kategorie"], "ebene": a["ebene"],
           "sicherheit": round(lernen.sicherheit(eintrag), 2)}
    if art == "benennen":
        aus |= {"anker": a["anker"], "token": engine.token(geheim, a["ebene"], a["id"])}
        if hilfe == "auswahl":
            optionen = [a["name"], *(c["name"] for c in lernen.ablenker(a, _pool(liste, a, rng), eintrag, rng))]
            rng.shuffle(optionen)
            aus["optionen"] = optionen
    else:
        aus["name"] = a["name"]
        if hilfe == "auswahl":
            # Nur Objekte, die auf der Karte sicher zu sehen sind: andere Aufgaben derselben Ebene
            gleiche = [b for b in liste if b["ebene"] == a["ebene"]]
            tokens = [engine.token(geheim, c["ebene"], c["id"]) for c in [a, *lernen.ablenker(a, gleiche, eintrag, rng)]]
            rng.shuffle(tokens)
            aus["kandidaten"] = tokens
    return aus


class UebenIn(BaseModel):
    nr: int = Field(ge=1)
    richtung: Literal["benennen", "finden"]
    antwort: str = Field(max_length=200)


@router.post("/{code}/ueben")
def ueben_antwort(code: str, body: UebenIn, db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Übungsantwort: zählt nicht fürs Quiz, aber für Lernstand und Erfolge; die Lösung kommt immer mit."""
    s, satz, liste = _ueben_sitzung(db, code)
    aufgabe = next((a for a in liste if a["nr"] == body.nr), None)
    if aufgabe is None:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    geheim = _geheim(s)
    richtig = engine.pruefe(aufgabe, body.richtung, body.antwort, geheim)
    ls = _lernstand(db, satz.id, spieler, anlegen=True)
    _verbuche(ls, aufgabe, richtig, body.richtung, None if richtig else _verwechselt(liste, aufgabe, body.richtung, body.antwort, geheim))
    st = _stand(db, s, spieler, anlegen=True)
    neue = _neue_erfolge(st, erfolge_fuer(satz.inhalt, liste), liste, ls)
    if neue:
        st.erfolge = [*st.erfolge, *neue]
    db.commit()
    return {"richtig": richtig, "name": aufgabe["name"], "token": engine.token(geheim, aufgabe["ebene"], aufgabe["id"]),
            "sicherheit": round(lernen.sicherheit(ls.objekte.get(lernen.schluessel(aufgabe))), 2),
            "neue_erfolge": neue, "stand": _stand_out(st), "lernen": _lern_out(ls, liste)}


# ── Lehrkraft ────────────────────────────────────────────────────────

def _eigene_sitzung(db: Session, code: str, lehrkraft: Teacher) -> ToolSession:
    s = _sitzung(db, code)
    if s.created_by != lehrkraft.id:
        raise HTTPException(403, "Das ist nicht deine Sitzung.")
    return s


@router.get("/{code}/uebersicht")
def uebersicht(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    s = _eigene_sitzung(db, code, lehrkraft)
    liste = aufgaben(db, _satz(db, s))
    staende = db.query(KartenQuizStand).filter_by(session_id=s.id).order_by(KartenQuizStand.name).all()
    klassen = {c.id: c.code for c in db.query(Class).all()}
    # Lernstand der Teilnehmenden: mittlere Sicherheit je Objekt (zeigt, wo es hakt)
    wer = {(st.student_id, st.teacher_id, st.guest_id) for st in staende}
    lern = [ls.objekte for ls in db.query(KartenLernstand).filter_by(satz_id=s.ref_id).all()
            if (ls.student_id, ls.teacher_id, ls.guest_id) in wer]
    def _sicherheit(a: dict) -> float | None:
        werte = [lernen.sicherheit(o.get(lernen.schluessel(a))) for o in lern if lernen.schluessel(a) in o]
        return round(sum(werte) / len(werte), 2) if werte else None
    je_aufgabe = [{"nr": a["nr"], "name": a["name"], "kategorie": a["kategorie"], "marke": a["marke"],
                   "richtig": sum(1 for st in staende if st.antworten.get(str(a["nr"]), {}).get("richtig")),
                   "versucht": sum(1 for st in staende if str(a["nr"]) in st.antworten),
                   "sicherheit": _sicherheit(a)} for a in liste]
    return {
        "aufgaben": len(liste), "einstellungen": _einstellungen(s), "je_aufgabe": je_aufgabe,
        "teilnehmer": [{"name": st.name, "klasse": klassen.get(st.class_id, "Gast" if st.guest_id else ""),
                        "richtig": st.richtig, "beantwortet": len(st.antworten), "erfolge": len(st.erfolge)} for st in staende],
        "punkte": vorschau_punkte(db, s, len(liste)),
    }


def vorschau_punkte(db: Session, s: ToolSession, anzahl: int) -> list[dict]:
    """Je Klasse: eigene Trefferquote × Höchstpunkte (nur Schüler:innen mit Klasse zählen)."""
    if anzahl == 0:
        return []
    max_punkte = _einstellungen(s)["max_punkte"]
    je: dict[int, list[int]] = {}
    for st in db.query(KartenQuizStand).filter(KartenQuizStand.session_id == s.id, KartenQuizStand.student_id.isnot(None)).all():
        if st.class_id is not None:
            je.setdefault(st.class_id, []).append(st.richtig)
    klassen = {c.id: c for c in db.query(Class).filter(Class.id.in_(je.keys())).all()} if je else {}
    zeilen = []
    for cid, werte in je.items():
        quote = sum(werte) / (len(werte) * anzahl)
        zeilen.append({"class_id": cid, "klasse": klassen[cid].code if cid in klassen else str(cid),
                       "teilnehmer": len(werte), "quote": round(quote, 3), "punkte": round(quote * max_punkte)})
    return sorted(zeilen, key=lambda z: z["klasse"])


@router.post("/{code}/punkte")
def punkte_vergeben(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    s = _eigene_sitzung(db, code, lehrkraft)
    if (s.settings or {}).get("punkte_vergeben"):
        raise HTTPException(409, "Für dieses Quiz wurden schon Punkte vergeben.")
    satz = _satz(db, s)
    zeilen = vorschau_punkte(db, s, len(aufgaben(db, satz)))
    for z in zeilen:
        if z["punkte"] > 0:
            db.add(Transaction(teacher_id=lehrkraft.id, class_id=z["class_id"], points=z["punkte"],
                               reason=f"Kartenquiz: {satz.titel}"[:200]))
    s.settings = {**(s.settings or {}), "punkte_vergeben": datetime.now(timezone.utc).isoformat()}
    db.commit()
    return {"vergeben": zeilen}


@router.delete("/{code}/staende", status_code=204)
def zuruecksetzen(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    """Neue Runde: alle Ergebnisse löschen; danach dürfen wieder Punkte vergeben werden."""
    s = _eigene_sitzung(db, code, lehrkraft)
    db.query(KartenQuizStand).filter_by(session_id=s.id).delete()
    s.settings = {k: v for k, v in (s.settings or {}).items() if k != "punkte_vergeben"}
    db.commit()



# ── Einbettung in Caputh und TaskCrawler ─────────────────────────────

def einbettung(db: Session, satz_id: int, wer: Teacher | Student, modus: str = "benennen", wortbank: bool = False,
               mindestens: float = 1.0) -> dict:
    """Schnappschuss eines Kartensatzes für eine Frage/Aufgabe (siehe karten_quiz.pruefe_einbettung).
    Lehrkräfte: eigene und geteilte Sätze; Schüler:innen (Caputh-Pool): nur geteilte."""
    satz = db.get(KartenSatz, satz_id)
    eigen = isinstance(wer, Teacher) and satz is not None and satz.created_by == wer.id
    if satz is None or not (eigen or satz.geteilt):
        raise ValueError(f"Kartensatz {satz_id} nicht gefunden (eigene oder geteilte Sätze)")
    liste = aufgaben(db, satz)
    if not liste:
        raise ValueError(f"Kartensatz »{satz.titel}« hat keine ausgewählten Objekte")
    geheim = secrets.token_hex(16)
    schluessel = secrets.token_hex(8)
    db.add(KartenBrett(schluessel=schluessel, geheim=geheim, ebenen=satz.inhalt["ebenen"]))
    return {"satz_id": satz.id, "titel": satz.titel, "modus": modus if modus in engine.MODI else "benennen",
            "wortbank": bool(wortbank), "mindestens": max(0.1, min(1.0, float(mindestens))),
            "geheim": geheim, "brett": schluessel, "katalog": _katalog_meta(db, satz.inhalt), "karte": _karte(satz.inhalt),
            "aufgaben": liste}


def loese_einbettungen(daten, db: Session, lehrkraft: Teacher | Student) -> None:
    """Ersetzt in hochgeladenem JSON jeden Verweis {"satz": id, "modus": …} unter »karte«
    (bei type/kind == "karte") durch den Schnappschuss. Schon aufgelöste bleiben, ihr Brett wird gesichert."""
    if isinstance(daten, list):
        for x in daten:
            loese_einbettungen(x, db, lehrkraft)
        return
    if not isinstance(daten, dict):
        return
    if "karte" in (daten.get("type"), daten.get("kind")) and isinstance(daten.get("karte"), dict):
        ref = daten["karte"]
        if "aufgaben" in ref and ref.get("brett") and ref.get("geheim"):
            if db.get(KartenBrett, ref["brett"]) is None:
                db.add(KartenBrett(schluessel=ref["brett"], geheim=ref["geheim"], ebenen=ref.get("karte", {}).get("ebenen", [])))
        elif "satz" in ref:
            daten["karte"] = einbettung(db, int(ref["satz"]), lehrkraft, ref.get("modus", "benennen"),
                                        ref.get("wortbank", False), ref.get("mindestens", 1.0))
    for wert in daten.values():
        loese_einbettungen(wert, db, lehrkraft)


@router.get("/brett/{schluessel}/ebene/{ebene_id}")
def brett_ebene(schluessel: str, ebene_id: str, request: Request, db: Session = Depends(get_db)):
    """Entschärfte Ebene (ohne Namen, Token statt id) für eine eingebettete Kartenfrage — öffentlich:
    wer in Caputh/TaskCrawler spielt, hat oft kein Konto, und ohne Namen verrät die Geometrie nichts."""
    brett = db.get(KartenBrett, schluessel)
    if brett is None or ebene_id not in brett.ebenen:
        raise HTTPException(404, "Ebene nicht gefunden")
    daten = json.dumps(engine.entschaerfe_ebene(_sammlung(ebene_id), ebene_id, brett.geheim), ensure_ascii=False).encode("utf-8")
    if "gzip" in request.headers.get("accept-encoding", ""):
        return Response(gzip.compress(daten, compresslevel=6), media_type="application/geo+json",
                        headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding", "Cache-Control": "public, max-age=3600"})
    return Response(daten, media_type="application/geo+json", headers={"Cache-Control": "public, max-age=3600"})


def karten_aufloesen(daten, db: Session, wer: Teacher | Student) -> None:
    """Für die Upload-Endpunkte von Caputh/TaskCrawler: Verweise auflösen, Fehler als 422."""
    try:
        loese_einbettungen(daten, db, wer)
    except (ValueError, TypeError) as fehler:
        raise HTTPException(422, f"Kartenfrage: {fehler}") from None
