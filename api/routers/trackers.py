from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassTracker, ClassTrackerCheck, StudentGroup, Teacher
from ..auth import get_current_teacher, require_class_teacher

router = APIRouter(prefix="/api/trackers", tags=["trackers"])


class TrackerOut(BaseModel):
    id: int
    class_id: int | None
    group_id: int | None
    name: str
    checked_student_ids: list[int]

    model_config = {"from_attributes": True}


class TrackerCreate(BaseModel):
    name: str
    class_id: int | None = None
    # A Kurs/WPF tracker instead of a class one — exactly one scope must be set.
    group_id: int | None = None

    @model_validator(mode="after")
    def _one_scope(self):
        if (self.class_id is None) == (self.group_id is None):
            raise ValueError("Genau eine Zuordnung angeben: class_id oder group_id.")
        return self


def _out(t: ClassTracker) -> TrackerOut:
    return TrackerOut(
        id=t.id,
        class_id=t.class_id,
        group_id=t.group_id,
        name=t.name,
        checked_student_ids=[c.student_id for c in t.checks],
    )


def _assert_editor(current: Teacher, t: ClassTracker) -> None:
    """Class trackers stay locked to the Klassenlehrer; a Kurs/WPF has no single
    owning class, so any teacher may manage its trackers (same as the groups router)."""
    if t.class_id is not None:
        require_class_teacher(current, t.class_id)


@router.get("", response_model=list[TrackerOut])
def list_trackers(
    class_id: int | None = None,
    group_id: int | None = None,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    if (class_id is None) == (group_id is None):
        raise HTTPException(400, "Genau eine Zuordnung angeben: class_id oder group_id.")
    q = db.query(ClassTracker)
    q = q.filter_by(class_id=class_id) if class_id is not None else q.filter_by(group_id=group_id)
    return [_out(t) for t in q.order_by(ClassTracker.created_at).all()]


@router.post("", response_model=TrackerOut, status_code=201)
def create_tracker(
    body: TrackerCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if body.class_id is not None:
        require_class_teacher(current, body.class_id)
    elif not db.get(StudentGroup, body.group_id):
        raise HTTPException(404, "Group not found")
    t = ClassTracker(class_id=body.class_id, group_id=body.group_id, name=body.name, created_by=current.id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _out(t)


@router.delete("/{tracker_id}", status_code=204)
def delete_tracker(
    tracker_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    t = db.get(ClassTracker, tracker_id)
    if not t:
        raise HTTPException(404, "Tracker not found")
    _assert_editor(current, t)
    db.delete(t)
    db.commit()


@router.post("/{tracker_id}/toggle", response_model=TrackerOut)
def toggle_student(
    tracker_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    t = db.get(ClassTracker, tracker_id)
    if not t:
        raise HTTPException(404, "Tracker not found")
    _assert_editor(current, t)
    existing = db.query(ClassTrackerCheck).filter_by(tracker_id=tracker_id, student_id=student_id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(ClassTrackerCheck(tracker_id=tracker_id, student_id=student_id))
    db.commit()
    db.refresh(t)
    return _out(t)
