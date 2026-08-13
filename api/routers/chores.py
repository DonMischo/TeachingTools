import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassChore, ClassChoreHistory, Student, Teacher
from ..auth import (
    get_current_teacher, get_current_user, require_class_teacher,
    require_class_manager,
)

router = APIRouter(prefix="/api/chores", tags=["chores"])

DEFAULT_CHORE_NAMES = [
    "Tafeldienst", "Pflanzendienst", "Austeildienst",
    "Fensterdienst", "Computerdienst",
]

COMPLETION_DAYS = 4


class ChoreOut(BaseModel):
    id: int
    class_id: int
    chore_name: str
    enabled: bool
    student_id: int | None
    student_name: str | None
    assigned_at: datetime | None

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
        assigned_at=c.assigned_at,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _maybe_complete(chore: ClassChore, db: Session) -> None:
    """If the current student has held this chore for ≥ COMPLETION_DAYS, log it."""
    if chore.student_id is None or chore.assigned_at is None:
        return
    assigned = chore.assigned_at
    if assigned.tzinfo is None:
        assigned = assigned.replace(tzinfo=timezone.utc)
    if (_now() - assigned) >= timedelta(days=COMPLETION_DAYS):
        db.add(ClassChoreHistory(
            class_id=chore.class_id,
            chore_name=chore.chore_name,
            student_id=chore.student_id,
            assigned_at=assigned,
            completed_at=_now(),
        ))


@router.get("/all-names", response_model=list[str])
def all_chore_names(db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    """Return all known chore names: defaults + any custom names used across all classes."""
    custom = [row[0] for row in db.query(ClassChore.chore_name).distinct().all()]
    all_names: list[str] = list(DEFAULT_CHORE_NAMES)
    for name in custom:
        if name not in all_names:
            all_names.append(name)
    return all_names


@router.get("/stats")
def chore_stats(class_id: int, db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)) -> dict[int, dict[str, int]]:
    """
    Returns {student_id: {chore_name: count}} — number of times each student has
    completed each chore (held ≥ COMPLETION_DAYS days).
    Includes historical completions + currently active assignments already ≥ COMPLETION_DAYS.
    """
    stats: dict[int, dict[str, int]] = {}

    # Logged historical completions
    for h in db.query(ClassChoreHistory).filter_by(class_id=class_id).all():
        stats.setdefault(h.student_id, {})
        stats[h.student_id][h.chore_name] = stats[h.student_id].get(h.chore_name, 0) + 1

    # Currently active assignments that qualify (≥ COMPLETION_DAYS days old)
    now = _now()
    for c in (
        db.query(ClassChore)
        .filter_by(class_id=class_id, enabled=True)
        .filter(ClassChore.student_id.isnot(None))
        .all()
    ):
        assigned = c.assigned_at
        if assigned is None:
            continue
        if assigned.tzinfo is None:
            assigned = assigned.replace(tzinfo=timezone.utc)
        if (now - assigned) >= timedelta(days=COMPLETION_DAYS):
            sid = c.student_id
            stats.setdefault(sid, {})
            stats[sid][c.chore_name] = stats[sid].get(c.chore_name, 0) + 1

    return stats


@router.get("", response_model=list[ChoreOut])
def list_chores(class_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    # Any teacher may view; a student only if a granted Klassensprecher of this class.
    if not isinstance(current, Teacher):
        require_class_manager(db, current, class_id)
    return [_out(c) for c in db.query(ClassChore).filter_by(class_id=class_id).all()]


@router.post("", response_model=ChoreOut, status_code=201)
def upsert_chore(
    body: ChoreUpsert,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    require_class_manager(db, current, body.class_id)
    # assigned_by references teachers; a Klassensprecher editing leaves it null.
    editor_id = current.id if isinstance(current, Teacher) else None
    existing = db.query(ClassChore).filter_by(class_id=body.class_id, chore_name=body.chore_name).first()
    if existing:
        # If student is changing, potentially log the old assignment
        if existing.student_id != body.student_id:
            _maybe_complete(existing, db)
            existing.assigned_at = _now()  # reset clock for new student
        existing.student_id = body.student_id
        existing.enabled = body.enabled
        existing.assigned_by = editor_id
        db.commit()
        db.refresh(existing)
        return _out(existing)
    chore = ClassChore(
        class_id=body.class_id,
        chore_name=body.chore_name,
        enabled=body.enabled,
        student_id=body.student_id,
        assigned_by=editor_id,
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
    require_class_teacher(current, chore.class_id)
    _maybe_complete(chore, db)
    db.delete(chore)
    db.commit()


@router.post("/clear", status_code=204)
def clear_chores(
    class_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    """Clear student assignments from all enabled chores; log any that qualify."""
    require_class_manager(db, current, class_id)
    chores = db.query(ClassChore).filter_by(class_id=class_id, enabled=True).all()
    for c in chores:
        _maybe_complete(c, db)
        c.student_id = None
        c.assigned_at = _now()
    db.commit()


@router.post("/random", response_model=list[ChoreOut])
def random_assign(
    class_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    """Randomly assign students to all enabled chores; log any qualifying old assignments."""
    require_class_manager(db, current, class_id)
    editor_id = current.id if isinstance(current, Teacher) else None
    chores = db.query(ClassChore).filter_by(class_id=class_id, enabled=True).all()
    if not chores:
        return []
    students = db.query(Student).filter_by(class_id=class_id, active=True).all()
    if not students:
        return [_out(c) for c in chores]
    shuffled = random.sample(students, len(students))
    for i, chore in enumerate(chores):
        new_sid = shuffled[i % len(shuffled)].id
        if chore.student_id != new_sid:
            _maybe_complete(chore, db)
            chore.assigned_at = _now()
        chore.student_id = new_sid
        chore.assigned_by = editor_id
    db.commit()
    for c in chores:
        db.refresh(c)
    return [_out(c) for c in chores]
