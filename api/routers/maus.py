"""»Maus-Führerschein«: Fortschritt und Prüfung.

Die Bestenliste liegt seit Phase 8 im gemeinsamen Router ``bestenlisten.py``
(Regeln in ``bestenliste_regeln.py``).
"""
from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..availability import require_capability
from ..models import Haus, HausMember, MausPruefung, Student, Teacher, ToolSession, Transaction
from ..display_names import short_name

router_sitzung = APIRouter(prefix="/api/maus", tags=["maus"])

# Stufen je Teil des Führerscheins.
TEILE: dict[int, list[str]] = {
    1: ["klick", "doppelklick", "rechtsklick", "ziehen", "markieren", "kopieren"],
    2: ["scrollen", "tastatur", "explorer", "fenster", "datei"],
    3: ["suche", "apps", "screenshot", "aussehen", "bedienhilfe", "taskleiste", "profil"],
    4: ["handy", "appstore", "berechtigungen", "privatsphaere", "risiken"],
}
STUFEN: set[str] = {sid for ids in TEILE.values() for sid in ids}

HAUSPUNKTE_JE_TEIL = 5


class StufeStand(BaseModel):
    punkte: int = Field(ge=0, le=60000)
    sterne: int = Field(ge=0, le=3)
    dauer_ms: int = Field(ge=0)


def pruefe_stand(daten: dict) -> None:
    """Regeln für den gemeldeten Stand (PUT /api/sitzungen/{code}/stand, siehe PRUEFUNGEN)."""
    stufen = daten.get("stufen", {})
    bestanden = daten.get("bestanden", [])
    if not isinstance(stufen, dict) or not isinstance(bestanden, list):
        raise HTTPException(400, "Stand ungültig.")
    unbekannt = set(stufen) - STUFEN
    if unbekannt:
        raise HTTPException(400, f"Unbekannte Stufe: {', '.join(sorted(unbekannt))}")
    for stand in stufen.values():
        try:
            StufeStand(**stand)
        except (TypeError, ValueError):
            raise HTTPException(400, "Stufe ungültig.")
    for teil in bestanden:
        if teil not in TEILE:
            raise HTTPException(400, f"Unbekannter Teil: {teil}")
        for sid in TEILE[teil]:
            stand = stufen.get(sid)
            if stand is None or stand.get("punkte", 0) <= 0:
                raise HTTPException(400, f"Teil {teil} ist noch nicht vollständig bestanden.")


def _haus_name(db: Session, class_id: int | None) -> str | None:
    if class_id is None:
        return None
    member = db.query(HausMember).filter_by(class_id=class_id).first()
    if not member:
        return None
    haus = db.get(Haus, member.haus_id)
    return haus.name if haus else None


def _buchende_lehrkraft(db: Session, student: Student, code: str | None, slug: str = "maus") -> Teacher | None:
    """Wer die Hauspunkte für diese Prüfung bucht: die Lehrkraft der Sitzung,
    sonst die Klassenlehrkraft, sonst ein Admin."""
    if code:
        session = db.query(ToolSession).filter_by(code=code.upper()).first()
        if session and session.tool_slug == slug:
            lehrer = db.get(Teacher, session.created_by)
            if lehrer:
                return lehrer
    lehrer = (
        db.query(Teacher)
        .filter(Teacher.klasse_id == student.class_id, Teacher.active == True)  # noqa: E712
        .order_by(Teacher.id)
        .first()
    )
    if lehrer:
        return lehrer
    return (
        db.query(Teacher)
        .filter(Teacher.role == "admin", Teacher.active == True)  # noqa: E712
        .order_by(Teacher.id)
        .first()
    )


class PruefungIn(BaseModel):
    teil: Literal[1, 2, 3, 4]
    stufen: dict[str, StufeStand]
    hilfe: bool = False
    code: str | None = None


class PruefungOut(BaseModel):
    bestanden: bool
    punkte: int
    schon_vergeben: bool
    haus: str | None


@router_sitzung.post("/pruefung", response_model=PruefungOut,
                      dependencies=[Depends(require_capability("maus", "use"))])
def pruefung(
    body: PruefungIn,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Abschlussprüfung eines Teils — Schüler:innen bekommen dafür einmalig
    Hauspunkte über ihre Klasse und ihr Haus, Lehrkräfte nur die Bestätigung."""
    for sid in TEILE[body.teil]:
        stand = body.stufen.get(sid)
        if stand is None or stand.punkte <= 0:
            raise HTTPException(400, f"Nicht bestanden – Teil {body.teil} ist nicht vollständig.")

    if not isinstance(user, Student):
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    vorhanden = db.query(MausPruefung).filter_by(student_id=user.id, teil=body.teil).first()
    if vorhanden is not None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=True, haus=_haus_name(db, user.class_id))

    if user.class_id is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    buchende = _buchende_lehrkraft(db, user, body.code)
    if buchende is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    db.add(Transaction(
        teacher_id=buchende.id, class_id=user.class_id, points=HAUSPUNKTE_JE_TEIL,
        reason=f"Maus-Führerschein Teil {body.teil} bestanden: {short_name(user)}",
    ))
    db.add(MausPruefung(student_id=user.id, teil=body.teil, punkte=HAUSPUNKTE_JE_TEIL, class_id=user.class_id))
    db.commit()
    return PruefungOut(
        bestanden=True, punkte=HAUSPUNKTE_JE_TEIL, schon_vergeben=False, haus=_haus_name(db, user.class_id),
    )
