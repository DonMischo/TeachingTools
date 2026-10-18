"""
Methoden-Kompendium — persönliche Markierungen je Methode und Konto.

Die Inhalte des Kompendiums sind statisch (frontend/public/kompendium); die API
speichert nur die Markierungen, damit sie auf jedem Gerät gleich sind.
"""
from typing import Literal, Union

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import KompendiumMarke, Student, Teacher
from ..auth import get_current_user
from ..availability import require_capability

router = APIRouter(prefix="/api/kompendium", tags=["kompendium"],
                   dependencies=[Depends(require_capability("kompendium", "use"))])

Marke = Literal["favorit", "einarbeiten", "unnoetig"]


class MarkeIn(BaseModel):
    marke: Marke | None  # None hebt die Markierung auf


def _eigene(db: Session, user: Union[Teacher, Student]):
    q = db.query(KompendiumMarke)
    if isinstance(user, Teacher):
        return q.filter(KompendiumMarke.teacher_id == user.id)
    return q.filter(KompendiumMarke.student_id == user.id)


@router.get("/marken")
def marken(db: Session = Depends(get_db), user=Depends(get_current_user)) -> dict[str, str]:
    return {m.methode_id: m.marke for m in _eigene(db, user)}


@router.put("/marken/{methode_id}")
def markieren(methode_id: str, body: MarkeIn, db: Session = Depends(get_db),
              user=Depends(get_current_user)) -> dict[str, str]:
    vorhanden = _eigene(db, user).filter(KompendiumMarke.methode_id == methode_id[:80]).first()
    if body.marke is None:
        if vorhanden:
            db.delete(vorhanden)
    elif vorhanden:
        vorhanden.marke = body.marke
    else:
        db.add(KompendiumMarke(
            methode_id=methode_id[:80], marke=body.marke,
            teacher_id=user.id if isinstance(user, Teacher) else None,
            student_id=user.id if isinstance(user, Student) else None,
        ))
    db.commit()
    return {m.methode_id: m.marke for m in _eigene(db, user)}
