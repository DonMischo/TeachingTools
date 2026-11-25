"""Stand, Übersicht und Auswertung für alle Werkzeugsitzungen.

Eine Tabelle (``SitzungStand``) und drei Wege für alle Simulationen statt je
Werkzeug eigener ``/fortschritt``- und ``/uebersicht``-Endpunkte:

- ``PUT  /api/sitzungen/{code}/stand``       Lernende melden ihren Stand (Konto oder Gast).
- ``GET  /api/sitzungen/{code}/uebersicht``  Lehrkraft: alle Zeilen der Sitzung, roh.
- ``DELETE /api/sitzungen/{code}/staende``   Lehrkraft: neue Runde.

Wie ``daten`` in Dashboard, Auswertung und Download erscheint, legt das
Frontend je Werkzeug fest (lib/sitzung/werkzeuge.ts). Hier wird nur geprüft
und gespeichert; strengere Regeln je Werkzeug stehen in ``PRUEFUNGEN``.
"""
import json
from datetime import datetime, timezone
from typing import Callable, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_teacher, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import SitzungStand, Student, Teacher, ToolSession
from ..sitzung import anzeigename, teilnehmer
from .tool_sessions import SESSION_TOOLS

router = APIRouter(prefix="/api/sitzungen", tags=["sitzungen"])

MAX_DATEN_BYTES = 16000
MAX_AKTUELL = 120


def _pruefe_markieren(daten: dict) -> None:
    from .markieren import MODI
    challenge = daten.get("challenge", {})
    if not isinstance(challenge, dict) or any(k not in MODI for k in challenge):
        raise HTTPException(400, "Unbekannter Modus.")


def _pruefe_maus(daten: dict) -> None:
    from .maus import pruefe_stand
    pruefe_stand(daten)


def _pruefe_algo(daten: dict) -> None:
    from .algo import pruefe_stand
    pruefe_stand(daten)


# Werkzeuge mit strengeren Regeln als der allgemeinen Größengrenze
PRUEFUNGEN: dict[str, Callable[[dict], None]] = {
    "markieren": _pruefe_markieren,
    "maus": _pruefe_maus,
    "algo": _pruefe_algo,
}


class StandIn(BaseModel):
    daten: dict = {}
    aktuell: str | None = None
    fertig: bool = False


class StandOut(BaseModel):
    name: str
    klasse: str | None
    gast: bool
    daten: dict
    aktuell: str | None
    beigetreten_am: datetime
    aktualisiert_am: datetime
    fertig_am: datetime | None


class UebersichtOut(BaseModel):
    code: str
    tool_slug: str
    status: str
    zeilen: list[StandOut]


def _sitzung(db: Session, code: str) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    return session


def _eigene_sitzung(db: Session, code: str, teacher: Teacher) -> ToolSession:
    session = _sitzung(db, code)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    return session


def _out(z: SitzungStand) -> StandOut:
    return StandOut(name=z.name, klasse=z.klasse, gast=z.gast, daten=z.daten or {}, aktuell=z.aktuell,
                    beigetreten_am=z.beigetreten_am, aktualisiert_am=z.aktualisiert_am, fertig_am=z.fertig_am)


@router.put("/{code}/stand")
def stand_melden(
    code: str,
    body: StandIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(db, code)
    if session.tool_slug not in SESSION_TOOLS:
        raise HTTPException(400, "Dieses Werkzeug sammelt keinen Stand.")
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, session.tool_slug, "use"):
            raise HTTPException(403, f"Dieses Werkzeug ist für dich nicht freigeschaltet ({session.tool_slug}/use).")
    if len(json.dumps(body.daten, ensure_ascii=False).encode()) > MAX_DATEN_BYTES:
        raise HTTPException(400, "Stand zu groß.")
    if body.aktuell is not None and len(body.aktuell) > MAX_AKTUELL:
        raise HTTPException(400, "Stand zu groß.")
    pruefe = PRUEFUNGEN.get(session.tool_slug)
    if pruefe:
        pruefe(body.daten)

    name, klasse, gast = anzeigename(spieler)
    wer = teilnehmer(spieler)
    zeile = db.query(SitzungStand).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = SitzungStand(session_id=session.id, **wer)
        db.add(zeile)
    zeile.name, zeile.klasse, zeile.gast = name, klasse, gast
    zeile.daten = dict(body.daten)
    zeile.aktuell = body.aktuell
    if body.fertig and zeile.fertig_am is None:
        zeile.fertig_am = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.get("/{code}/uebersicht", response_model=UebersichtOut)
def uebersicht(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _eigene_sitzung(db, code, teacher)
    zeilen = db.query(SitzungStand).filter_by(session_id=session.id).all()
    zeilen.sort(key=lambda z: z.name.lower())
    return UebersichtOut(code=session.code, tool_slug=session.tool_slug, status=session.status,
                         zeilen=[_out(z) for z in zeilen])


@router.delete("/{code}/staende", status_code=204)
def staende_loeschen(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _eigene_sitzung(db, code, teacher)
    db.query(SitzungStand).filter_by(session_id=session.id).delete()
    db.commit()

# Werkzeuge, die bewusst keine Einzelstände zeigen (nur anonyme Klassenwerte)
ANONYM = ("main-character", "kikompass")


@router.put("/{code}/da", status_code=204)
def anwesend(
    code: str,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Anwesenheit für Werkzeuge ohne eigenen Stand: legt die Zeile an bzw.
    frischt »zuletzt« auf, ohne ``daten`` anzufassen — ein Werkzeug, das
    selbst meldet, verliert dadurch nichts."""
    session = _sitzung(db, code)
    if session.tool_slug not in SESSION_TOOLS or session.tool_slug in ANONYM or session.status == "closed":
        return
    wer = teilnehmer(spieler)
    zeile = db.query(SitzungStand).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        name, klasse, gast = anzeigename(spieler)
        db.add(SitzungStand(session_id=session.id, name=name, klasse=klasse, gast=gast, daten={}, **wer))
    else:
        zeile.aktualisiert_am = datetime.now(timezone.utc)
    db.commit()
