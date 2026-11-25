"""»Rock your Life«: Lehrer-Übersicht für die Lebenssimulation.

Das Spiel rechnet komplett im Browser; der Spielstand selbst liegt dort (bzw.
als JSON-Download bei den Schüler:innen). Hierher meldet der Browser nur eine
Zusammenfassung (Spielmonat, Konto, Job, Wohnung …) und die neuen Zeilen des
Protokolls. Die Lehrkraft sieht je Sitzung eine Zeile pro Person (Übersicht über
/api/sitzungen, Zusammenfassung dort in ``daten``) und kann das Protokoll
als CSV herunterladen; das Protokoll selbst bleibt in ``LebenStand``.

Gäste melden sich wie beim Maus-Führerschein über den Sitzungscode und ihre
Gast-Id (siehe ``routers/maus.py``).
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_teacher, get_player
from ..availability import is_allowed
from ..database import get_db
from ..sitzung import anzeigename, csv_antwort, sitzung_fuer, teilnehmer
from ..models import LebenStand, SitzungStand, Student, Teacher, ToolSession

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


def _sitzung(code: str, db: Session) -> ToolSession:
    return sitzung_fuer(db, code, "leben", "Diese Sitzung gehört nicht zu »Rock your Life«.")


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

    name, klasse, gast = anzeigename(spieler)
    wer = teilnehmer(spieler)
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
    # Die Übersicht liest den Sitzungsstand (api/routers/sitzungen.py); das lange Protokoll bleibt hier.
    stand = db.query(SitzungStand).filter_by(session_id=session.id, **wer).first()
    if stand is None:
        stand = SitzungStand(session_id=session.id, **wer)
        db.add(stand)
    stand.name, stand.klasse, stand.gast = name, klasse, gast
    stand.daten = {"figur": zeile.figur, "spiel_id": zeile.spiel_id, "zusammenfassung": zeile.zusammenfassung,
                   "protokoll_zeilen": len(zeile.protokoll)}
    db.commit()
    return {"ok": True, "zeilen": len(zeile.protokoll)}


def _lehrkraft_sitzung(code: str, db: Session, teacher: Teacher) -> ToolSession:
    session = _sitzung(code, db)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    return session


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
    kopf = ["Name", "Klasse", "Figur", "Spieltag", "Datum", "Uhrzeit", "Art", "Ereignis", "Betrag (€)"]
    ausgabe = []
    for z in sorted(zeilen, key=lambda x: x.name.lower()):
        for e in z.protokoll or []:
            stunde = float(e.get("stunde", 0))
            ausgabe.append([z.name, z.klasse or "", z.figur, e.get("tag", ""), e.get("datum", ""),
                            f"{int(stunde):02d}:{int((stunde % 1) * 60):02d}", e.get("art", ""), e.get("text", ""),
                            "" if e.get("betrag") is None else f"{e['betrag']:.2f}".replace(".", ",")])
    return csv_antwort(kopf, ausgabe, f"rock-your-life-{session.code}.csv", trenner=";")
