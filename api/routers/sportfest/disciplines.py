from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import SportfestDiscipline
from ...schemas import SportfestDisciplineOut
from ...auth import require_admin, get_current_teacher

router = APIRouter(prefix="/api/sportfest/disciplines", tags=["sportfest"])


@router.get("", response_model=list[SportfestDisciplineOut])
def list_disciplines(db: Session = Depends(get_db)):
    return db.query(SportfestDiscipline).order_by(SportfestDiscipline.id).all()


@router.put("/{discipline_id}/enabled", response_model=SportfestDisciplineOut)
def set_enabled(
    discipline_id: str,
    enabled: bool,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    disc = db.get(SportfestDiscipline, discipline_id)
    if not disc:
        raise HTTPException(404, "Discipline not found")
    disc.enabled = enabled
    db.commit()
    db.refresh(disc)
    return disc
