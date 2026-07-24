"""Sitzplan — seating plans per class.

Each class can hold several named room layouts (default "Klassenraum", plus
custom rooms like Kunstraum/Musikraum on demand). The whole layout lives in a
JSON blob (`items`) loaded/saved as a unit by the canvas editor — the JSON-blob
pattern used by LessonPlan/BingoSet. Writes require admin or the class's
Klassenlehrer (assert_class_editor, shared with the classes router).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SeatingPlan, Class, Student, Teacher
from ..auth import get_current_teacher, get_current_user
from ..seating_export import export_pdf, ITEM_SIZES
from .classes import assert_class_editor

router = APIRouter(prefix="/api", tags=["seating"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class SeatIn(BaseModel):
    id: str
    student_id: int | None = None
    # non-student occupant tag (e.g. "Schulbegleiter"); shown when student_id is None
    label: str | None = None
    locked: bool = False


class SeatingItem(BaseModel):
    id: str
    kind: str
    x: float = 0
    y: float = 0
    rotation: float = 0
    # per-axis size multipliers (inventory/chairs; tables stay 1) — lets e.g. a
    # Schrank become a wide sideboard vs a tall cabinet independently
    scaleX: float = 1.0
    scaleY: float = 1.0
    locked: bool = False
    label: str | None = None
    seats: list[SeatIn] = []

    @field_validator("kind")
    @classmethod
    def _known_kind(cls, v: str) -> str:
        if v not in ITEM_SIZES:
            raise ValueError(f"Unbekannter Möbeltyp: {v!r}")
        return v


class SeatingPlanCreate(BaseModel):
    name: str = "Klassenraum"
    orientation: str = "landscape"

    @field_validator("orientation")
    @classmethod
    def _orient(cls, v: str) -> str:
        if v not in ("landscape", "portrait"):
            raise ValueError("orientation must be 'landscape' or 'portrait'")
        return v


class SeatingPlanUpdate(SeatingPlanCreate):
    items: list[SeatingItem] = []


class SeatingPlanSummary(BaseModel):
    id: int
    class_id: int
    name: str
    orientation: str
    model_config = {"from_attributes": True}


class SeatingPlanDetail(SeatingPlanSummary):
    items: list


def _detail(p: SeatingPlan) -> SeatingPlanDetail:
    out = SeatingPlanDetail.model_validate(p)
    out.items = p.items or []
    return out


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/classes/{class_id}/seating", response_model=list[SeatingPlanSummary])
def list_plans(class_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.get(Class, class_id):
        raise HTTPException(404, "Klasse nicht gefunden")
    return (
        db.query(SeatingPlan)
        .filter(SeatingPlan.class_id == class_id)
        .order_by(SeatingPlan.id)
        .all()
    )


@router.post("/classes/{class_id}/seating", response_model=SeatingPlanDetail)
def create_plan(
    class_id: int,
    body: SeatingPlanCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if not db.get(Class, class_id):
        raise HTTPException(404, "Klasse nicht gefunden")
    assert_class_editor(current, class_id)
    plan = SeatingPlan(
        class_id=class_id,
        name=body.name.strip() or "Klassenraum",
        orientation=body.orientation,
        items=[],
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _detail(plan)


def _get_plan_or_404(plan_id: int, db: Session) -> SeatingPlan:
    plan = db.get(SeatingPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Sitzplan nicht gefunden")
    return plan


@router.get("/seating/{plan_id}", response_model=SeatingPlanDetail)
def get_plan(plan_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _detail(_get_plan_or_404(plan_id, db))


@router.put("/seating/{plan_id}", response_model=SeatingPlanDetail)
def update_plan(
    plan_id: int,
    body: SeatingPlanUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    plan = _get_plan_or_404(plan_id, db)
    assert_class_editor(current, plan.class_id)
    plan.name = body.name.strip() or "Klassenraum"
    plan.orientation = body.orientation
    plan.items = [it.model_dump() for it in body.items]
    db.commit()
    db.refresh(plan)
    return _detail(plan)


@router.delete("/seating/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    plan = _get_plan_or_404(plan_id, db)
    assert_class_editor(current, plan.class_id)
    db.delete(plan)
    db.commit()


@router.get("/seating/{plan_id}/export.pdf")
def export_plan_pdf(plan_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    plan = _get_plan_or_404(plan_id, db)
    # Resolve the student_ids referenced by seats to display names.
    ids = {
        seat["student_id"]
        for it in (plan.items or [])
        for seat in (it.get("seats") or [])
        if seat.get("student_id") is not None
    }
    names: dict[int, str] = {}
    short: dict[int, str] = {}
    if ids:
        for s in db.query(Student).filter(Student.id.in_(ids)).all():
            names[s.id] = f"{s.vorname} {s.nachname}".strip()
            short[s.id] = f"{s.vorname} {s.nachname[0]}." if s.nachname else s.vorname
    pdf_path = export_pdf(plan, names, short)
    if pdf_path is None:
        raise HTTPException(503, "PDF-Export momentan nicht verfügbar")
    cls = db.get(Class, plan.class_id)
    klasse = cls.code if cls else str(plan.class_id)
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"Sitzplan_{klasse}_{plan.name}.pdf")
