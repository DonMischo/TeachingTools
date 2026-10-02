"""Kartenquiz als Spiel: Lehrkraft teilt einen Kartensatz per Code/QR (ToolSession »karten«,
ref_id → KartenSatz), Schüler:innen und Gäste spielen, Hauspunkte je Klasse.

Spieler bekommen die Ebenen nur entschärft (ohne Namen, Token statt id) über
``/api/karten/quiz/{code}/ebene/…`` — die Kartenebenen-API selbst bleibt für
Konten. Prüfen geschieht ausschließlich hier auf dem Server (api/karten_quiz.py).

Einstellungen der Sitzung (ToolSession.settings, öffentlich lesbar):
  modus "benennen" | "finden", wortbank bool, max_punkte int,
  punkte_vergeben (Zeitstempel, verhindert doppelte Buchung)
"""
import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import karten_quiz as engine
from ..auth import get_current_teacher, get_player
from ..config import settings
from ..database import get_db
from ..display_names import short_name
from ..models import Class, KartenEbeneEigen, KartenQuizStand, KartenSatz, Student, Teacher, ToolSession, Transaction
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
            "max_punkte": int(e.get("max_punkte", STANDARD_MAX_PUNKTE))}


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
        st = KartenQuizStand(session_id=s.id, name=_anzeigename(spieler)[:100], antworten={}, erfolge=[],
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


def _neue_erfolge(st: KartenQuizStand, vorgaben: list[dict], aufgaben_liste: list[dict]) -> list[str]:
    neu = []
    for v in vorgaben:
        teil = [a for a in aufgaben_liste if a["ebene"] in v.get("ebenen", [])]
        if not teil or v["id"] in st.erfolge:
            continue
        richtig = sum(1 for a in teil if st.antworten.get(str(a["nr"]), {}).get("richtig"))
        if richtig / len(teil) >= float(v.get("schwelle", 1.0)):
            neu.append(v["id"])
    return neu


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
    namen = _ebenen_namen(db)
    return {
        "titel": satz.titel, "einstellungen": e,
        "karte": {"art": inhalt["art"], "region": inhalt.get("region", "deutschland"), "ebenen": inhalt["ebenen"],
                  "ausschnitt": inhalt.get("ausschnitt"), "auswahl": {k: {"zeigen": v.get("zeigen", "alle")} for k, v in inhalt.get("auswahl", {}).items()},
                  # Eigene Ebenen haben keinen Katalogeintrag beim Gast — Name und Geometrie mitgeben
                  "eigene": {k: {"name": namen.get(k, k)} for k in inhalt["ebenen"] if k.startswith(EIGEN_PRAEFIX)}},
        "spiel": engine.fuer_spieler(liste, e["modus"], _geheim(s), wortbank=e["wortbank"], mischen=mischen),
        "erfolge": [{k: v[k] for k in ("id", "name", "icon")} for v in erfolge_fuer(inhalt, liste)],
        "stand": _stand_out(_stand(db, s, spieler, anlegen=False)),
    }


@router.get("/{code}/ebene/{ebene_id}")
def ebene(code: str, ebene_id: str, db: Session = Depends(get_db), _spieler=Depends(get_player)):
    s = _sitzung(db, code)
    satz = _satz(db, s)
    if ebene_id not in satz.inhalt.get("ebenen", []):
        raise HTTPException(404, "Diese Ebene gehört nicht zum Quiz")
    return JSONResponse(engine.entschaerfe_ebene(_sammlung(ebene_id), ebene_id, _geheim(s)),
                        media_type="application/geo+json")


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
    neu = {"richtig": richtig, "versuche": alt["versuche"] + 1}
    st.antworten = {**st.antworten, str(body.nr): neu}
    st.richtig = sum(1 for a in st.antworten.values() if a["richtig"])
    neue = _neue_erfolge(st, erfolge_fuer(satz.inhalt, liste), liste)
    if neue:
        st.erfolge = [*st.erfolge, *neue]
    db.commit()
    aus = {"richtig": richtig, "versuche": neu["versuche"], "neue_erfolge": neue, "stand": _stand_out(st)}
    if not richtig and neu["versuche"] >= VERSUCHE_BIS_LOESUNG:
        # Nach zwei Fehlversuchen die Lösung zeigen (benennen: Name, finden: das Objekt)
        aus["loesung"] = aufgabe["name"] if e["modus"] == "benennen" else engine.token(_geheim(s), aufgabe["ebene"], aufgabe["id"])
    return aus


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
    je_aufgabe = [{"nr": a["nr"], "name": a["name"], "kategorie": a["kategorie"], "marke": a["marke"],
                   "richtig": sum(1 for st in staende if st.antworten.get(str(a["nr"]), {}).get("richtig")),
                   "versucht": sum(1 for st in staende if str(a["nr"]) in st.antworten)} for a in liste]
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
