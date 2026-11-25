"""Algorithmen-Werkstatt: Regeln für den gemeldeten Stand und der eigene Stand.

Gemeldet wird über /api/sitzungen/{code}/stand (routers/sitzungen.py). Der Browser meldet Level (Sterne/Blöcke), fertige Flussdiagramme und Automaten.
Gäste melden sich wie bei »Rock your Life« über Sitzungscode und Gast-Token.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import Guest, get_player
from ..database import get_db
from ..models import SitzungStand, Student, Teacher, ToolSession
from ..sitzung import anzeigename, sitzung_fuer, teilnehmer

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


def _sitzung(code: str, db: Session) -> ToolSession:
    return sitzung_fuer(db, code, "algo", "Diese Sitzung gehört nicht zur Algorithmen-Werkstatt.")


def pruefe_stand(daten: dict) -> None:
    """Regeln für den gemeldeten Stand (PUT /api/sitzungen/{code}/stand, siehe PRUEFUNGEN)."""
    try:
        body = FortschrittIn(**daten)
    except (TypeError, ValueError):
        raise HTTPException(400, "Fortschritt ungültig.")
    if (len(body.level) > MAX_LEVEL or any(len(k) > MAX_LEVEL_ID for k in body.level)
            or len(body.fluss) > MAX_FLUSS or len(body.automat) > MAX_AUTOMAT
            or any(len(t) > MAX_TEXT for t in body.fluss + body.automat)
            or len(body.wertung) > MAX_WERTUNG or any(len(k) > MAX_TEXT for k in body.wertung)):
        raise HTTPException(400, "Fortschritt zu groß.")


@router.get("/sitzung/{code}/mein", response_model=FortschrittIn)
def mein_fortschritt(
    code: str,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Der eigene gemeldete Stand — damit er auf einem anderen Rechner oder nach
    gelöschtem Browser-Speicher wieder da ist. Konten bekommen das Beste aus all
    ihren Sitzungen, Gäste nur ihre Zeile in dieser Sitzung."""
    session = _sitzung(code, db)
    wer = teilnehmer(spieler)
    q = db.query(SitzungStand).join(ToolSession, ToolSession.id == SitzungStand.session_id).filter(
        ToolSession.tool_slug == "algo", *[getattr(SitzungStand, k) == v for k, v in wer.items()])
    zeilen = q.filter(SitzungStand.session_id == session.id).all() if isinstance(spieler, Guest) else q.all()
    level: dict = {}
    fluss: list = []
    automat: list = []
    wertung: dict = {}
    for z in zeilen:
        d = z.daten or {}
        for k, v in (d.get("level") or {}).items():
            alt = level.get(k)
            level[k] = v if alt is None else {
                "sterne": max(alt.get("sterne", 0), v.get("sterne", 0)),
                "bloecke": min(alt.get("bloecke", 999), v.get("bloecke", 999)),
                "punkte": max(alt.get("punkte", 0), v.get("punkte", 0)),
            }
        fluss += [x for x in (d.get("fluss") or []) if x not in fluss]
        automat += [x for x in (d.get("automat") or []) if x not in automat]
        for k, v in (d.get("wertung") or {}).items():
            alt = wertung.get(k)
            wertung[k] = v if alt is None else {"sterne": max(alt["sterne"], v["sterne"]), "punkte": max(alt["punkte"], v["punkte"])}
    return FortschrittIn(level=level, fluss=fluss, automat=automat, wertung=wertung)
