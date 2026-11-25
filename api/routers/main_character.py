"""Main Character: Lebenssimulation bis zum Abschluss, mit anonymer Klassenübersicht.

Fragebogen, Charakterbogen und Simulation laufen ganz im Browser. In eine
Sitzung geht nur, was die Übersicht am Beamer braucht:

- ``PUT /api/main-character/sitzung/{code}/stand``: Klasse, Woche und die fünf
  Werte einer Figur, auch für Gäste über den Code. Keine Namen, keine Antworten.
- ``GET /api/main-character/sitzung/{code}/uebersicht``: nur für die Lehrkraft
  der Sitzung (oder Admin). Liefert Anzahl, Anzahl je Klasse und Durchschnitte —
  Durchschnitte erst ab ``MIN_FUER_SCHNITT`` Figuren, damit niemand einzeln
  erkennbar ist. Zeilen von Lehrkräften zählen nicht mit.

Die Klassen-Ids spiegeln ``frontend/src/lib/mainCharacter.ts``.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_teacher, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import MainCharacterStand, Student, Teacher, ToolSession
from ..sitzung import sitzung_fuer, teilnehmer

router = APIRouter(prefix="/api/main-character", tags=["main-character"])

SLUG = "main-character"
KLASSEN = {"styler", "mitlaeufer", "hoodie", "kuemmerer", "nerd", "gamer", "bored", "streber",
           "checker", "sportler", "npc"}
WERTE = ("W", "Z", "S", "M", "E")
MIN_FUER_SCHNITT = 3
ABSCHLUSS = 85


class StandIn(BaseModel):
    klasse: str
    woche: int = Field(ge=0, le=ABSCHLUSS)
    werte: dict[str, float]

    @field_validator("klasse")
    @classmethod
    def _klasse(cls, v: str) -> str:
        if v not in KLASSEN:
            raise ValueError(f"Unbekannte Klasse: {v}")
        return v

    @field_validator("werte")
    @classmethod
    def _werte(cls, v: dict[str, float]) -> dict[str, float]:
        if set(v) != set(WERTE):
            raise ValueError("Es braucht genau die Werte W, Z, S, M, E.")
        return {k: round(max(0.0, min(100.0, float(x))), 1) for k, x in v.items()}


class Uebersicht(BaseModel):
    anzahl: int
    je_klasse: dict[str, int]
    # erst ab MIN_FUER_SCHNITT Figuren, sonst None
    schnitt: dict[str, float] | None
    woche_schnitt: float | None
    min_fuer_schnitt: int = MIN_FUER_SCHNITT


def _sitzung(code: str, db: Session) -> ToolSession:
    return sitzung_fuer(db, code, SLUG, "Diese Sitzung gehört nicht zu Main Character.")


def _darf(db: Session, spieler) -> None:
    if isinstance(spieler, Guest):
        return
    if isinstance(spieler, Teacher) and spieler.role == "admin":
        return
    if not is_allowed(db, spieler, SLUG, "use"):
        raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (main-character/use).")


@router.put("/sitzung/{code}/stand")
def sitzung_stand(
    code: str,
    body: StandIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    _darf(db, spieler)
    wer = teilnehmer(spieler)
    zeile = db.query(MainCharacterStand).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = MainCharacterStand(session_id=session.id, **wer)
        db.add(zeile)
    zeile.klasse, zeile.woche, zeile.werte = body.klasse, body.woche, body.werte
    db.commit()
    return {"ok": True}


@router.get("/sitzung/{code}/uebersicht", response_model=Uebersicht)
def uebersicht(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _sitzung(code, db)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    zeilen = (
        db.query(MainCharacterStand)
        .filter_by(session_id=session.id)
        .filter(MainCharacterStand.teacher_id.is_(None))
        .all()
    )
    je_klasse: dict[str, int] = {}
    for z in zeilen:
        je_klasse[z.klasse] = je_klasse.get(z.klasse, 0) + 1
    schnitt = woche_schnitt = None
    if len(zeilen) >= MIN_FUER_SCHNITT:
        schnitt = {w: round(sum(z.werte.get(w, 0) for z in zeilen) / len(zeilen), 1) for w in WERTE}
        woche_schnitt = round(sum(z.woche for z in zeilen) / len(zeilen), 1)
    return Uebersicht(anzahl=len(zeilen), je_klasse=je_klasse, schnitt=schnitt, woche_schnitt=woche_schnitt)
