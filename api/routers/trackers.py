from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClassTracker, ClassTrackerCheck, Teacher
from ..auth import get_current_teacher, require_class_teacher

router = APIRouter(prefix="/api/trackers", tags=["trackers"])


class TrackerOut(BaseModel):
    id: int
    class_id: int
    name: str
    checked_student_ids: list[int]

    model_config = {"from_attributes": True}


class TrackerCreate(BaseModel):
    class_id: int
    name: str


def _out(t: ClassTracker) -> TrackerOut:
    return TrackerOut(
        id=t.id,
        class_id=t.class_id,
        name=t.name,
        checked_student_ids=[c.student_id for c in t.checks],
    )


@router.get("", response_model=list[TrackerOut])
def list_trackers(class_id: int, db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    return [_out(t) for t in db.query(ClassTracker).filter_by(class_id=class_id).order_by(ClassTracker.created_at).all()]


@router.post("", response_model=TrackerOut, status_code=201)
def create_tracker(
    body: TrackerCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    require_class_teacher(current, body.class_id)
    t = ClassTracker(class_id=body.class_id, name=body.name, created_by=current.id)
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
    require_class_teacher(current, t.class_id)
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
    require_class_teacher(current, t.class_id)
    existing = db.query(ClassTrackerCheck).filter_by(tracker_id=tracker_id, student_id=student_id).first()
    if existing:
        db.delete(existing)
    else:
        db.add(ClassTrackerCheck(tracker_id=tracker_id, student_id=student_id))
    db.commit()
    db.refresh(t)
    return _out(t)
