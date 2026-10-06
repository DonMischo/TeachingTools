"""Algorithmen-Werkstatt: Fortschritt je Person und Lehrer-Übersicht.

Der Browser meldet Level (Sterne/Blöcke), fertige Flussdiagramme und Automaten.
Gäste melden sich wie bei »Rock your Life« über Sitzungscode und Gast-Token.
"""
from datetime import datetime
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_teacher, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import AlgoFortschritt, Student, Teacher, ToolSession
from .leben import _anzeigename, _teilnehmer

router = APIRouter(prefix="/api/algo", tags=["algo"])

MAX_LEVEL = 100
MAX_LEVEL_ID = 10
MAX_FLUSS = 50
MAX_AUTOMAT = 20
MAX_TEXT = 40
MAX_WERTUNG = 50


class LevelStand(BaseModel):
    sterne: int = Field(ge=0, le=3)
    bloecke: int = Field(ge=0, le=999)
    punkte: int = Field(default=0, ge=0, le=2000)


class WertungStand(BaseModel):
    sterne: int = Field(ge=0, le=3)
    punkte: int = Field(ge=0, le=2000)


class FortschrittIn(BaseModel):
    level: dict[str, LevelStand]
    fluss: list[str]
    automat: list[str]
    wertung: dict[str, WertungStand] = {}


class UebersichtZeile(BaseModel):
    name: str
    klasse: str | None
    gast: bool
    level: dict
    fluss: list
    automat: list
    wertung: dict = {}
    aktualisiert_am: datetime


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "algo":
        raise HTTPException(400, "Diese Sitzung gehört nicht zur Algorithmen-Werkstatt.")
    return session


@router.put("/sitzung/{code}/fortschritt")
def fortschritt_melden(
    code: str,
    body: FortschrittIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, "algo", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (algo/use).")
    if (len(body.level) > MAX_LEVEL or any(len(k) > MAX_LEVEL_ID for k in body.level)
            or len(body.fluss) > MAX_FLUSS or len(body.automat) > MAX_AUTOMAT
            or any(len(t) > MAX_TEXT for t in body.fluss + body.automat)
            or len(body.wertung) > MAX_WERTUNG or any(len(k) > MAX_TEXT for k in body.wertung)):
        raise HTTPException(400, "Fortschritt zu groß.")

    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)
    zeile = db.query(AlgoFortschritt).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = AlgoFortschritt(session_id=session.id, name=name, klasse=klasse, gast=gast, **wer)
        db.add(zeile)
    zeile.name, zeile.klasse, zeile.gast = name, klasse, gast
    zeile.level = {k: v.model_dump() for k, v in body.level.items()}
    zeile.fluss = list(body.fluss)
    zeile.automat = list(body.automat)
    zeile.wertung = {k: v.model_dump() for k, v in body.wertung.items()}
    db.commit()
    return {"ok": True}


@router.get("/sitzung/{code}/uebersicht", response_model=list[UebersichtZeile])
def uebersicht(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _sitzung(code, db)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    zeilen = db.query(AlgoFortschritt).filter_by(session_id=session.id).all()
    zeilen.sort(key=lambda z: z.name.lower())
    return [
        UebersichtZeile(name=z.name, klasse=z.klasse, gast=z.gast, level=z.level or {}, fluss=z.fluss or [],
                        automat=z.automat or [], wertung=z.wertung or {}, aktualisiert_am=z.aktualisiert_am)
        for z in zeilen
    ]
