"""Gemeinsame Bestenliste aller Werkzeuge (Markieren, Maus-Führerschein, Schreibübung).

Eine Tabelle (``bestenlisten``), ein Router. Was je Werkzeug gilt — Modi,
Sortierrichtung, Plausibilitätsgrenzen, Zusatzfelder — steht in
``bestenliste_regeln.py``. Je Person, Werkzeug und Modus gibt es genau eine
Zeile: die beste. Name und Klasse kommen aus dem Konto bzw. Gast-Token, nie
aus dem Browser. Konten gehen über ``/{werkzeug}``, Gäste (und Konten in einer
Sitzung) über ``/{werkzeug}/code/{code}``.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_user, get_player, require_admin
from ..availability import is_allowed
from ..bestenliste_regeln import REGELN, Modus, Werkzeug
from ..database import get_db
from ..models import Bestenliste, SitzungStand, Student, Teacher, ToolSession
from ..sitzung import anzeigename, sitzung_fuer, teilnehmer

router = APIRouter(prefix="/api/bestenlisten", tags=["bestenlisten"])

TOP = 100


class EintragIn(BaseModel):
    modus: str
    wert: float
    extra: dict = {}


class EintragOut(BaseModel):
    id: int
    platz: int
    name: str
    klasse: str | None
    gast: bool
    wert: float
    extra: dict
    selbst: bool


def _regeln(werkzeug: str) -> Werkzeug:
    regeln = REGELN.get(werkzeug)
    if regeln is None:
        raise HTTPException(404, f"Unbekanntes Werkzeug: {werkzeug}")
    return regeln


def _modus(werkzeug: str, modus: str) -> Modus:
    regel = _regeln(werkzeug).modi.get(modus)
    if regel is None:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    return regel


def _sitzung(werkzeug: str, code: str, db: Session) -> ToolSession:
    if _regeln(werkzeug).nur_konten:
        raise HTTPException(400, "Dieses Werkzeug hat keine Sitzungen mit Gästen.")
    return sitzung_fuer(db, code, werkzeug, "Diese Sitzung gehört nicht zu diesem Werkzeug.")


def _darf(db: Session, user: Union[Teacher, Student], werkzeug: str) -> bool:
    if isinstance(user, Teacher) and user.role == "admin":
        return True
    return is_allowed(db, user, werkzeug, "use")


def _besser(regel: Modus, neu: float, alt: float) -> bool:
    return neu < alt if regel.richtung == "min" else neu > alt


def _ausgabe(z: Bestenliste, platz: int, wer: dict) -> EintragOut:
    return EintragOut(
        id=z.id, platz=platz, name=z.name, klasse=z.klasse, gast=z.gast, wert=z.wert, extra=z.extra or {},
        selbst=all(getattr(z, spalte) == wert for spalte, wert in wer.items()),
    )


def _sitzung_teilnehmer(db: Session, session_id: int):
    """Bedingung: wer in dieser Sitzung einen Stand gemeldet hat; ``None``, wenn niemand."""
    zeilen = db.query(SitzungStand).filter_by(session_id=session_id).all()
    ids = {
        "student_id": [z.student_id for z in zeilen if z.student_id is not None],
        "teacher_id": [z.teacher_id for z in zeilen if z.teacher_id is not None],
        "guest_id": [z.guest_id for z in zeilen if z.guest_id is not None],
    }
    bedingungen = [getattr(Bestenliste, spalte).in_(werte) for spalte, werte in ids.items() if werte]
    return or_(*bedingungen) if bedingungen else None


def _liste(
    db: Session, werkzeug: str, modus: str, wer: dict, klasse: str | None, sitzung: str | None,
) -> list[EintragOut]:
    regel = _modus(werkzeug, modus)
    query = db.query(Bestenliste).filter(Bestenliste.werkzeug == werkzeug, Bestenliste.modus == modus)
    if klasse is not None:
        query = query.filter(Bestenliste.klasse == klasse)
    if sitzung is not None:
        s = _sitzung(werkzeug, sitzung, db)
        if _regeln(werkzeug).sitzung_filter == "teilnehmer":
            bedingung = _sitzung_teilnehmer(db, s.id)
            if bedingung is None:
                return []
            query = query.filter(bedingung)
        else:
            query = query.filter(Bestenliste.session_id == s.id)
    reihenfolge = Bestenliste.wert.asc() if regel.richtung == "min" else Bestenliste.wert.desc()
    zeilen = query.order_by(reihenfolge, Bestenliste.erreicht_am.asc()).limit(TOP).all()
    return [_ausgabe(z, i, wer) for i, z in enumerate(zeilen, start=1)]


def _eintragen(
    db: Session, werkzeug: str, body: EintragIn,
    spieler: Union[Teacher, Student, Guest], session_id: int | None,
) -> EintragOut:
    """Ein Ergebnis melden. Nur eine Verbesserung wird übernommen."""
    regeln = _regeln(werkzeug)
    regel = _modus(werkzeug, body.modus)
    extra = regeln.bereinige(body.extra)
    regel.pruefe(body.wert, extra)
    wert = body.wert
    if regeln.rang:
        wert = regeln.rang(body.modus, body.wert, extra)
        extra = {**extra, "roh": body.wert}

    name, klasse, gast = anzeigename(spieler)
    wer = teilnehmer(spieler)
    zeile = db.query(Bestenliste).filter_by(werkzeug=werkzeug, modus=body.modus, **wer).first()
    if zeile is None:
        zeile = Bestenliste(
            werkzeug=werkzeug, modus=body.modus, wert=wert, extra=extra,
            name=name, klasse=klasse, gast=gast, session_id=session_id, **wer,
        )
        db.add(zeile)
    elif _besser(regel, wert, zeile.wert):
        zeile.wert, zeile.extra, zeile.session_id = wert, extra, session_id
        # Der Name kann sich geändert haben (Heirat, Klassenwechsel).
        zeile.name, zeile.klasse = name, klasse
    db.commit()
    db.refresh(zeile)

    besser = Bestenliste.wert < zeile.wert if regel.richtung == "min" else Bestenliste.wert > zeile.wert
    davor = db.query(Bestenliste).filter(
        Bestenliste.werkzeug == werkzeug, Bestenliste.modus == body.modus, besser,
    ).count()
    return _ausgabe(zeile, davor + 1, wer)


@router.delete("/eintrag/{eintrag_id}", status_code=204)
def eintrag_loeschen(
    eintrag_id: int,
    db: Session = Depends(get_db),
    _admin: Teacher = Depends(require_admin),
):
    """Einen Eintrag entfernen — für unangemessene Gastnamen."""
    zeile = db.get(Bestenliste, eintrag_id)
    if not zeile:
        raise HTTPException(404, "Eintrag nicht gefunden")
    db.delete(zeile)
    db.commit()


@router.get("/{werkzeug}", response_model=list[EintragOut])
def liste(
    werkzeug: str,
    modus: str,
    klasse: str | None = None,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    return _liste(db, werkzeug, modus, teilnehmer(user), klasse, sitzung)


@router.post("/{werkzeug}", response_model=EintragOut)
def eintragen(
    werkzeug: str,
    body: EintragIn,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    _regeln(werkzeug)
    if not _darf(db, user, werkzeug):
        raise HTTPException(403, f"Dieses Werkzeug ist für dich nicht freigeschaltet ({werkzeug}/use).")
    session_id = _sitzung(werkzeug, sitzung, db).id if sitzung else None
    return _eintragen(db, werkzeug, body, user, session_id)


@router.get("/{werkzeug}/code/{code}", response_model=list[EintragOut])
def liste_ueber_code(
    werkzeug: str,
    code: str,
    modus: str,
    klasse: str | None = None,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    _sitzung(werkzeug, code, db)
    return _liste(db, werkzeug, modus, teilnehmer(spieler), klasse, sitzung)


@router.post("/{werkzeug}/code/{code}", response_model=EintragOut)
def eintragen_ueber_code(
    werkzeug: str,
    code: str,
    body: EintragIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(werkzeug, code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest) and not _darf(db, spieler, werkzeug):
        raise HTTPException(403, f"Dieses Werkzeug ist für dich nicht freigeschaltet ({werkzeug}/use).")
    return _eintragen(db, werkzeug, body, spieler, session.id)
