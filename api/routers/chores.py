import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassChore, Student, Teacher
from ..auth import get_current_teacher

router = APIRouter(prefix="/api/chores", tags=["chores"])

DEFAULT_CHORE_NAMES = [
    "Tafeldienst", "Pflanzendienst", "Austeildienst",
    "Fensterdienst", "Computerdienst",
]


class ChoreOut(BaseModel):
    id: int
    class_id: int
    chore_name: str
    enabled: bool
    student_id: int | None
    student_name: str | None

    model_config = {"from_attributes": True}


class ChoreUpsert(BaseModel):
    class_id: int
    chore_name: str
    student_id: int | None = None
    enabled: bool = True


def _out(c: ClassChore) -> ChoreOut:
    name = None
    if c.student:
        name = f"{c.student.vorname} {c.student.nachname}"
    return ChoreOut(
        id=c.id,
        class_id=c.class_id,
        chore_name=c.chore_name,
        enabled=c.enabled,
        student_id=c.student_id,
        student_name=name,
    )


@router.get("/all-names", response_model=list[str])
def all_chore_names(db: Session = Depends(get_db)):
    """Return all known chore names: defaults + any custom names used across all classes."""
    custom = [row[0] for row in db.query(ClassChore.chore_name).distinct().all()]
    all_names: list[str] = list(DEFAULT_CHORE_NAMES)
    for name in custom:
        if name not in all_names:
            all_names.append(name)
    return all_names


@router.get("", response_model=list[ChoreOut])
def list_chores(class_id: int, db: Session = Depends(get_db)):
    return [_out(c) for c in db.query(ClassChore).filter_by(class_id=class_id).all()]


@router.post("", response_model=ChoreOut, status_code=201)
def upsert_chore(
    body: ChoreUpsert,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    existing = db.query(ClassChore).filter_by(class_id=body.class_id, chore_name=body.chore_name).first()
    if existing:
        existing.student_id = body.student_id
        existing.enabled = body.enabled
        existing.assigned_by = current.id
        db.commit()
        db.refresh(existing)
        return _out(existing)
    chore = ClassChore(
        class_id=body.class_id,
        chore_name=body.chore_name,
        enabled=body.enabled,
        student_id=body.student_id,
        assigned_by=current.id,
    )
    db.add(chore)
    db.commit()
    db.refresh(chore)
    return _out(chore)


@router.delete("/{chore_id}", status_code=204)
def delete_chore(
    chore_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    chore = db.get(ClassChore, chore_id)
    if not chore:
        raise HTTPException(404, "Chore not found")
    db.delete(chore)
    db.commit()


@router.post("/clear", status_code=204)
def clear_chores(
    class_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Clear student assignments from all enabled chores for the class."""
    db.query(ClassChore).filter_by(class_id=class_id, enabled=True).update({"student_id": None})
    db.commit()


@router.post("/random", response_model=list[ChoreOut])
def random_assign(
    class_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Randomly assign students to all enabled chores for the class."""
    chores = db.query(ClassChore).filter_by(class_id=class_id, enabled=True).all()
    if not chores:
        return []
    students = db.query(Student).filter_by(class_id=class_id, active=True).all()
    if not students:
        return [_out(c) for c in chores]
    shuffled = random.sample(students, len(students))
    for i, chore in enumerate(chores):
        chore.student_id = shuffled[i % len(shuffled)].id
        chore.assigned_by = current.id
    db.commit()
    for c in chores:
        db.refresh(c)
    return [_out(c) for c in chores]
