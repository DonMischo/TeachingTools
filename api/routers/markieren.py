"""Bestenliste der Challenge in »Markieren & Bearbeiten«.

Gebaut wie die Bestenliste des Maus-Führerscheins (``maus.py``): Konten über
``/api/markieren/bestenliste``, Gäste über den Sitzungscode
(``/api/markieren/bestenliste/{code}``), eine Zeile je Person und Modus,
Name und Klasse aus dem Konto bzw. Gast-Token. Anders als dort gewinnt die
kleinste Zeit.

Die Zeiten meldet der Browser; geschützt sind sie nur durch eine
Plausibilitätsgrenze — eine Klassenliste, keine Wertung mit Konsequenzen.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import Guest, get_current_user, get_player, require_admin
from ..availability import is_allowed, require_capability
from ..models import MarkierBestenliste, Student, Teacher, ToolSession
from ..display_names import abbreviate_parts, abbreviate_stored, short_name

router = APIRouter(prefix="/api/markieren/bestenliste", tags=["markieren"])

# Modus → Zahl der Aufgaben; spiegelt MODI in frontend/src/lib/markieren/aufgaben.ts.
MODI: dict[str, int] = {"markieren": 10, "bearbeiten": 8, "gemischt": 12}
# Schneller als eine Sekunde je Aufgabe geht es nicht: allein das grüne
# »Geschafft« steht 0,7 s.
MIN_MS_JE_AUFGABE = 1000
MAX_MS = 60 * 60 * 1000
TOP = 100


class EintragIn(BaseModel):
    modus: str
    zeit_ms: int = Field(ge=0)
    aktionen: int = Field(ge=0, le=10000)


class EintragOut(BaseModel):
    id: int
    platz: int
    name: str
    klasse: str | None
    gast: bool
    zeit_ms: int
    aktionen: int
    selbst: bool


def _pruefe(body: EintragIn) -> None:
    if body.modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {body.modus}")
    if body.zeit_ms < MODI[body.modus] * MIN_MS_JE_AUFGABE or body.zeit_ms > MAX_MS:
        raise HTTPException(400, "Diese Zeit ist nicht plausibel.")


def _anzeigename(spieler: Union[Teacher, Student, Guest]) -> tuple[str, str | None, bool]:
    """Name, Klasse und Gast-Kennzeichen aus dem Konto bzw. dem Gast-Token —
    nie aus dem Browser."""
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


def _ausgabe(z: MarkierBestenliste, platz: int, wer: dict) -> EintragOut:
    return EintragOut(
        id=z.id, platz=platz, name=z.name, klasse=z.klasse, gast=z.gast,
        zeit_ms=z.zeit_ms, aktionen=z.aktionen,
        selbst=all(getattr(z, spalte) == wert for spalte, wert in wer.items()),
    )


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "markieren":
        raise HTTPException(400, "Diese Sitzung gehört nicht zu »Markieren & Bearbeiten«.")
    return session


def _liste(db: Session, modus: str, wer: dict, klasse: str | None, sitzung: str | None) -> list[EintragOut]:
    if modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    query = db.query(MarkierBestenliste).filter(MarkierBestenliste.modus == modus)
    if klasse is not None:
        query = query.filter(MarkierBestenliste.klasse == klasse)
    if sitzung is not None:
        query = query.filter(MarkierBestenliste.session_id == _sitzung(sitzung, db).id)
    zeilen = query.order_by(MarkierBestenliste.zeit_ms.asc(), MarkierBestenliste.erreicht_am.asc()).limit(TOP).all()
    return [_ausgabe(z, i, wer) for i, z in enumerate(zeilen, start=1)]


def _eintragen(
    db: Session, body: EintragIn, spieler: Union[Teacher, Student, Guest], session_id: int | None,
) -> EintragOut:
    """Ein Ergebnis melden. Nur eine Verbesserung wird übernommen."""
    _pruefe(body)
    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)

    zeile = db.query(MarkierBestenliste).filter_by(modus=body.modus, **wer).first()
    if zeile is None:
        zeile = MarkierBestenliste(
            modus=body.modus, zeit_ms=body.zeit_ms, aktionen=body.aktionen,
            name=name, klasse=klasse, gast=gast, session_id=session_id, **wer,
        )
        db.add(zeile)
    elif body.zeit_ms < zeile.zeit_ms:
        zeile.zeit_ms, zeile.aktionen, zeile.session_id = body.zeit_ms, body.aktionen, session_id
        zeile.name, zeile.klasse = name, klasse
    db.commit()
    db.refresh(zeile)

    davor = (
        db.query(MarkierBestenliste)
        .filter(MarkierBestenliste.modus == body.modus, MarkierBestenliste.zeit_ms < zeile.zeit_ms)
        .count()
    )
    return _ausgabe(zeile, davor + 1, wer)


@router.get("", response_model=list[EintragOut])
def liste(
    modus: str,
    klasse: str | None = None,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    return _liste(db, modus, _teilnehmer(user), klasse, sitzung)


@router.post("", response_model=EintragOut,
             dependencies=[Depends(require_capability("markieren", "use"))])
def eintragen(
    body: EintragIn,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    return _eintragen(db, body, user, None)


@router.get("/{code}", response_model=list[EintragOut])
def liste_ueber_code(
    code: str,
    modus: str,
    klasse: str | None = None,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    _sitzung(code, db)
    return _liste(db, modus, _teilnehmer(spieler), klasse, sitzung)


@router.post("/{code}", response_model=EintragOut)
def eintragen_ueber_code(
    code: str,
    body: EintragIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, "markieren", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (markieren/use).")
    return _eintragen(db, body, spieler, session.id)


@router.delete("/eintrag/{eintrag_id}", status_code=204)
def eintrag_loeschen(
    eintrag_id: int,
    db: Session = Depends(get_db),
    _admin: Teacher = Depends(require_admin),
):
    """Einen Eintrag entfernen — für unangemessene Gastnamen."""
    zeile = db.get(MarkierBestenliste, eintrag_id)
    if not zeile:
        raise HTTPException(404, "Eintrag nicht gefunden")
    db.delete(zeile)
    db.commit()
