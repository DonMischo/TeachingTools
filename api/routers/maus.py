"""Bestenliste des »Maus-Führerscheins«.

Anders als bei der Schreibübung (``bestenliste.py``) dürfen hier auch Gäste
ohne Konto mitspielen: sie kommen über den Sitzungscode (wie die Beiträge der
KI-Werkstatt, ``routers/tool_sessions.py``) und tragen sich über ihre
Gast-Id ein, nicht über eine Fremdschlüssel-Beziehung auf ein Konto.

Alle vier Modi sind »mehr ist besser«; die Obergrenze ist eine reine
Plausibilitätsgrenze gegen frisierte Werte aus den Entwicklerwerkzeugen des
Browsers, siehe ``bestenliste.py`` für die Begründung.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import Guest, get_current_user, get_player, require_admin
from ..availability import is_allowed, require_capability
from ..models import MausBestenliste, Student, Teacher, ToolSession
from ..display_names import abbreviate_parts, abbreviate_stored, short_name

router = APIRouter(prefix="/api/maus/bestenliste", tags=["maus"])

# Modus → Obergrenze für plausible Werte. Alle vier sind "mehr ist besser";
# spiegelt GRENZEN in frontend/src/lib/maus/ergebnis.ts.
MODI: dict[str, float] = {"klick": 24000, "doppelklick": 13500, "ziehen": 6000, "gesamt": 50000}
TOP = 100


class EintragIn(BaseModel):
    modus: str
    wert: float
    dauer_ms: int = Field(ge=0)
    kontext: str | None = None


class EintragOut(BaseModel):
    id: int
    platz: int
    name: str
    klasse: str | None
    gast: bool
    wert: float
    dauer_ms: int
    kontext: str | None
    selbst: bool


def _pruefe(body: EintragIn) -> None:
    if body.modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {body.modus}")
    if body.wert <= 0 or body.wert > MODI[body.modus]:
        raise HTTPException(400, "Dieser Wert ist nicht plausibel.")


def _anzeigename(spieler: Union[Teacher, Student, Guest]) -> tuple[str, str | None, bool]:
    """Name, Klasse und Gast-Kennzeichen aus dem Konto bzw. dem Gast-Token —
    nie aus dem Browser."""
    if isinstance(spieler, Student):
        return (short_name(spieler), spieler.klasse, False)
    if isinstance(spieler, Teacher):
        return (abbreviate_parts(spieler.first_name or "", spieler.last_name or ""), None, False)
    return (abbreviate_stored(spieler.name)[:120], None, True)


def _teilnehmer(spieler: Union[Teacher, Student, Guest]) -> dict:
    """Die Spalte, in der dieser Teilnehmer steht — wie in routers/tool_sessions.py."""
    if isinstance(spieler, Student):
        return {"student_id": spieler.id}
    if isinstance(spieler, Teacher):
        return {"teacher_id": spieler.id}
    return {"guest_id": spieler.id}


def _selbst(zeile: MausBestenliste, wer: dict) -> bool:
    return all(getattr(zeile, spalte) == wert for spalte, wert in wer.items())


def _liste(db: Session, modus: str, wer: dict) -> list[EintragOut]:
    zeilen = (
        db.query(MausBestenliste)
        .filter(MausBestenliste.modus == modus)
        .order_by(MausBestenliste.wert.desc(), MausBestenliste.erreicht_am.asc())
        .limit(TOP)
        .all()
    )
    return [
        EintragOut(
            id=z.id, platz=i, name=z.name, klasse=z.klasse, gast=z.gast,
            wert=z.wert, dauer_ms=z.dauer_ms, kontext=z.kontext,
            selbst=_selbst(z, wer),
        )
        for i, z in enumerate(zeilen, start=1)
    ]


def _eintragen(db: Session, body: EintragIn, spieler: Union[Teacher, Student, Guest]) -> EintragOut:
    """Ein Ergebnis melden. Nur eine Verbesserung wird übernommen."""
    _pruefe(body)
    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)

    zeile = db.query(MausBestenliste).filter_by(modus=body.modus, **wer).first()
    if zeile is None:
        zeile = MausBestenliste(
            modus=body.modus, wert=body.wert, dauer_ms=body.dauer_ms,
            kontext=body.kontext, name=name, klasse=klasse, gast=gast, **wer,
        )
        db.add(zeile)
    elif body.wert > zeile.wert:
        zeile.wert = body.wert
        zeile.dauer_ms, zeile.kontext = body.dauer_ms, body.kontext
        # Der Name kann sich geändert haben (Heirat, Klassenwechsel).
        zeile.name, zeile.klasse = name, klasse
    db.commit()
    db.refresh(zeile)

    davor = (
        db.query(MausBestenliste)
        .filter(MausBestenliste.modus == body.modus, MausBestenliste.wert > zeile.wert)
        .count()
    )
    return EintragOut(
        id=zeile.id, platz=davor + 1, name=zeile.name, klasse=zeile.klasse, gast=zeile.gast,
        wert=zeile.wert, dauer_ms=zeile.dauer_ms, kontext=zeile.kontext, selbst=True,
    )


@router.get("", response_model=list[EintragOut])
def liste(
    modus: str,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    if modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    return _liste(db, modus, _teilnehmer(user))


@router.post("", response_model=EintragOut,
             dependencies=[Depends(require_capability("maus", "use"))])
def eintragen(
    body: EintragIn,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    return _eintragen(db, body, user)


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "maus":
        raise HTTPException(400, "Diese Sitzung gehört nicht zum Maus-Führerschein.")
    return session


@router.get("/{code}", response_model=list[EintragOut])
def liste_ueber_code(
    code: str,
    modus: str,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    _sitzung(code, db)
    if modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    return _liste(db, modus, _teilnehmer(spieler))


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
        if not admin and not is_allowed(db, spieler, "maus", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (maus/use).")
    return _eintragen(db, body, spieler)


@router.delete("/eintrag/{eintrag_id}", status_code=204)
def eintrag_loeschen(
    eintrag_id: int,
    db: Session = Depends(get_db),
    _admin: Teacher = Depends(require_admin),
):
    """Einen Eintrag entfernen — für unangemessene Gastnamen."""
    zeile = db.get(MausBestenliste, eintrag_id)
    if not zeile:
        raise HTTPException(404, "Eintrag nicht gefunden")
    db.delete(zeile)
    db.commit()
