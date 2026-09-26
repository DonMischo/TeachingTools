"""»Rock your Life«: Lehrer-Übersicht für die Lebenssimulation.

Das Spiel rechnet komplett im Browser; der Spielstand selbst liegt dort (bzw.
als JSON-Download bei den Schüler:innen). Hierher meldet der Browser nur eine
Zusammenfassung (Spielmonat, Konto, Job, Wohnung …) und die neuen Zeilen des
Protokolls. Die Lehrkraft sieht je Sitzung eine Zeile pro Person und kann das
Protokoll als CSV herunterladen.

Gäste melden sich wie beim Maus-Führerschein über den Sitzungscode und ihre
Gast-Id (siehe ``routers/maus.py``).
"""
import csv
import io
from datetime import datetime
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_teacher, get_player
from ..availability import is_allowed
from ..database import get_db
from ..display_names import abbreviate_parts, abbreviate_stored, short_name
from ..models import LebenStand, Student, Teacher, ToolSession

router = APIRouter(prefix="/api/leben", tags=["leben"])

# Obergrenzen, damit ein manipulierter Browser die Datenbank nicht flutet.
MAX_NEUE_ZEILEN = 400
MAX_PROTOKOLL = 6000
MAX_TEXT = 400


class LogZeile(BaseModel):
    tag: int = Field(ge=0, le=4000)
    stunde: float = Field(ge=0, le=24)
    datum: str = Field(default="", max_length=20)
    art: str = Field(max_length=20)
    text: str = Field(max_length=MAX_TEXT)
    betrag: float | None = None


class StandIn(BaseModel):
    spiel_id: str = Field(max_length=60)
    figur: str = Field(max_length=80)
    zusammenfassung: dict
    neu: list[LogZeile] = []
    # Neustart: altes Protokoll verwerfen
    neustart: bool = False


class StandOut(BaseModel):
    name: str
    klasse: str | None
    gast: bool
    figur: str
    zusammenfassung: dict
    protokoll_zeilen: int
    aktualisiert_am: datetime


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "leben":
        raise HTTPException(400, "Diese Sitzung gehört nicht zu »Rock your Life«.")
    return session


def _anzeigename(spieler: Union[Teacher, Student, Guest]) -> tuple[str, str | None, bool]:
    if isinstance(spieler, Student):
        return (short_name(spieler), spieler.klasse, False)
    if isinstance(spieler, Teacher):
        return (abbreviate_parts(spieler.first_name or "", spieler.last_name or ""), None, False)
    return (abbreviate_stored(spieler.name)[:120], None, True)


def _teilnehmer(spieler: Union[Teacher, Student, Guest]) -> dict:
    if isinstance(spieler, Student):
        return {"student_id": spieler.id}
    if isinstance(spieler, Teacher):
        return {"teacher_id": spieler.id}
    return {"guest_id": spieler.id}


def _zusammenfassung_kuerzen(z: dict) -> dict:
    """Nur flache, kurze Werte übernehmen — die Übersicht braucht nicht mehr."""
    aus: dict = {}
    for k, v in list(z.items())[:40]:
        if not isinstance(k, str) or len(k) > 40:
            continue
        if isinstance(v, (int, float, bool)) or v is None:
            aus[k] = v
        elif isinstance(v, str):
            aus[k] = v[:200]
        elif isinstance(v, dict):
            aus[k] = {str(a)[:30]: b for a, b in list(v.items())[:12] if isinstance(b, (int, float))}
    return aus


@router.put("/sitzung/{code}/stand")
def stand_melden(
    code: str,
    body: StandIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, "leben", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (leben/use).")
    if len(body.neu) > MAX_NEUE_ZEILEN:
        raise HTTPException(400, "Zu viele Protokollzeilen auf einmal.")

    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)
    zeile = db.query(LebenStand).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = LebenStand(session_id=session.id, name=name, klasse=klasse, gast=gast, protokoll=[], **wer)
        db.add(zeile)
    protokoll = [] if body.neustart or zeile.spiel_id != body.spiel_id else list(zeile.protokoll or [])
    protokoll.extend(z.model_dump() for z in body.neu)
    zeile.name, zeile.klasse, zeile.gast = name, klasse, gast
    zeile.figur = body.figur[:80]
    zeile.spiel_id = body.spiel_id
    zeile.zusammenfassung = _zusammenfassung_kuerzen(body.zusammenfassung)
    zeile.protokoll = protokoll[-MAX_PROTOKOLL:]
    db.commit()
    return {"ok": True, "zeilen": len(zeile.protokoll)}


def _lehrkraft_sitzung(code: str, db: Session, teacher: Teacher) -> ToolSession:
    session = _sitzung(code, db)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    return session


@router.get("/sitzung/{code}/uebersicht", response_model=list[StandOut])
def uebersicht(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _lehrkraft_sitzung(code, db, teacher)
    zeilen = db.query(LebenStand).filter_by(session_id=session.id).all()
    zeilen.sort(key=lambda z: z.name.lower())
    return [
        StandOut(name=z.name, klasse=z.klasse, gast=z.gast, figur=z.figur, zusammenfassung=z.zusammenfassung or {},
                 protokoll_zeilen=len(z.protokoll or []), aktualisiert_am=z.aktualisiert_am)
        for z in zeilen
    ]


@router.get("/sitzung/{code}/protokoll")
def protokoll(code: str, name: str | None = None, db: Session = Depends(get_db),
              teacher: Teacher = Depends(get_current_teacher)):
    """Protokoll aller (oder einer) Person(en) als JSON."""
    session = _lehrkraft_sitzung(code, db, teacher)
    zeilen = db.query(LebenStand).filter_by(session_id=session.id).all()
    return [
        {"name": z.name, "figur": z.figur, "protokoll": z.protokoll or []}
        for z in zeilen if name is None or z.name == name
    ]


@router.get("/sitzung/{code}/protokoll.csv")
def protokoll_csv(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _lehrkraft_sitzung(code, db, teacher)
    zeilen = db.query(LebenStand).filter_by(session_id=session.id).all()
    puffer = io.StringIO()
    # Semikolon + BOM: so öffnet Excel die Datei in deutscher Einstellung direkt richtig
    puffer.write("﻿")
    w = csv.writer(puffer, delimiter=";")
    w.writerow(["Name", "Klasse", "Figur", "Spieltag", "Datum", "Uhrzeit", "Art", "Ereignis", "Betrag (€)"])
    for z in sorted(zeilen, key=lambda x: x.name.lower()):
        for e in z.protokoll or []:
            stunde = float(e.get("stunde", 0))
            w.writerow([z.name, z.klasse or "", z.figur, e.get("tag", ""), e.get("datum", ""),
                        f"{int(stunde):02d}:{int((stunde % 1) * 60):02d}", e.get("art", ""), e.get("text", ""),
                        "" if e.get("betrag") is None else f"{e['betrag']:.2f}".replace(".", ",")])
    puffer.seek(0)
    return StreamingResponse(iter([puffer.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="rock-your-life-{session.code}.csv"'})
