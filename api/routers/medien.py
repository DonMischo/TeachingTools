"""Fortschritt der Simulation »Geschichte der Medien« am Server.

Wie beim TaskCrawler hängt der Stand an der Person, nicht am Browser:
Angemeldete über ihr Konto (``GET/PUT /api/medien/stand``), Gäste über den
Beitritts-Code und ihr Gast-Token (``GET/PUT /api/medien/sitzung/{code}/stand``).

Speichern vereinigt: geschaffte Stationen kommen nur dazu, Bestwerte steigen
nur — zwei offene Tabs oder ein alter Stand im Browser löschen nichts. Nur
``zuruecksetzen: true`` ersetzt den Stand (Knopf »Fortschritt zurücksetzen«).
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_user, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import MedienStand, Student, Teacher, ToolSession
from ..sitzung import teilnehmer

router = APIRouter(prefix="/api/medien", tags=["medien"])
SLUG = "medien"


class StandOut(BaseModel):
    geschafft: list[str]
    erprobt: list[str] = Field(default_factory=list)
    eilbote: int
    sortieren: int


class StandIn(BaseModel):
    geschafft: list[str] = Field(default_factory=list, max_length=200)
    erprobt: list[str] = Field(default_factory=list, max_length=100)
    eilbote: int = Field(default=0, ge=0, le=100_000)
    sortieren: int = Field(default=0, ge=0, le=100_000)
    zuruecksetzen: bool = False


def _darf(db: Session, spieler) -> None:
    if isinstance(spieler, Guest) or (isinstance(spieler, Teacher) and spieler.role == "admin"):
        return
    if not is_allowed(db, spieler, SLUG, "use"):
        raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (medien/use).")


def _aus(zeile: MedienStand | None) -> StandOut:
    if zeile is None:
        return StandOut(geschafft=[], erprobt=[], eilbote=0, sortieren=0)
    return StandOut(geschafft=list(zeile.geschafft or []), erprobt=list(zeile.erprobt or []), eilbote=zeile.eilbote, sortieren=zeile.sortieren)


def _laden(db: Session, spieler) -> MedienStand | None:
    return db.query(MedienStand).filter_by(**teilnehmer(spieler)).first()


def _speichern(db: Session, spieler, body: StandIn) -> StandOut:
    _darf(db, spieler)
    ids = [i[:40] for i in dict.fromkeys(x.strip() for x in body.geschafft) if i]
    zeile = _laden(db, spieler)
    if zeile is None:
        zeile = MedienStand(geschafft=[], erprobt=[], eilbote=0, sortieren=0, **teilnehmer(spieler))
        db.add(zeile)
    erprobt = [i[:40] for i in dict.fromkeys(x.strip() for x in body.erprobt) if i]
    if body.zuruecksetzen:
        zeile.geschafft, zeile.erprobt, zeile.eilbote, zeile.sortieren = ids, erprobt, body.eilbote, body.sortieren
    else:
        alt = list(zeile.geschafft or [])
        zeile.geschafft = alt + [i for i in ids if i not in alt]
        schon = list(zeile.erprobt or [])
        zeile.erprobt = schon + [i for i in erprobt if i not in schon]
        zeile.eilbote = max(zeile.eilbote or 0, body.eilbote)
        zeile.sortieren = max(zeile.sortieren or 0, body.sortieren)
    db.commit()
    return _aus(zeile)


def _gast_sitzung(db: Session, code: str, spieler) -> None:
    """Gäste nur in einer offenen Medien-Sitzung (der Code steckt im Token)."""
    if not isinstance(spieler, Guest):
        return
    s = db.query(ToolSession).filter_by(code=code.upper()).first()
    if s is None or s.tool_slug != SLUG:
        raise HTTPException(404, "Sitzung nicht gefunden")


@router.get("/stand", response_model=StandOut)
def stand_laden(db: Session = Depends(get_db), user: Union[Teacher, Student] = Depends(get_current_user)):
    return _aus(_laden(db, user))


@router.put("/stand", response_model=StandOut)
def stand_speichern(body: StandIn, db: Session = Depends(get_db), user: Union[Teacher, Student] = Depends(get_current_user)):
    return _speichern(db, user, body)


@router.get("/sitzung/{code}/stand", response_model=StandOut)
def sitzung_laden(code: str, db: Session = Depends(get_db), spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    _gast_sitzung(db, code, spieler)
    return _aus(_laden(db, spieler))


@router.put("/sitzung/{code}/stand", response_model=StandOut)
def sitzung_speichern(code: str, body: StandIn, db: Session = Depends(get_db), spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    _gast_sitzung(db, code, spieler)
    return _speichern(db, spieler, body)
