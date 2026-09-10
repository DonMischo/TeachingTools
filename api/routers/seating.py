"""Sitzplan — seating plans per class.

Each class can hold several named room layouts (default "Klassenraum", plus
custom rooms like Kunstraum/Musikraum on demand). The whole layout lives in a
JSON blob (`items`) loaded/saved as a unit by the canvas editor — the JSON-blob
pattern used by LessonPlan/BingoSet. Writes require admin or the class's
Klassenlehrer (assert_class_editor, shared with the classes router).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SeatingPlan, Class, Student, StudentGroup, Teacher
from ..auth import get_current_user, require_class_teacher, is_granted_klassensprecher
from ..display_names import seat_labels
from ..seating_export import export_pdf, ITEM_SIZES

router = APIRouter(prefix="/api", tags=["seating"])


def _assert_group_editor(current) -> None:
    """A Kurs/WPF has no owning Klassenlehrer, so every teacher may manage its
    rooms — the same rule the groups router uses. Students never may."""
    if not isinstance(current, Teacher):
        raise HTTPException(403, "Keine Berechtigung für diesen Sitzplan.")


def _assert_class_plan_reader(current, class_id: int | None, db: Session) -> None:
    """Wer einen Klassen-Sitzplan ueberhaupt sehen darf: jede Lehrkraft, und von
    den Schuelern nur ein freigeschalteter Klassensprecher *dieser* Klasse.

    Bis hierher hing an den Leseendpunkten nur `get_current_user` — mit
    fortlaufenden Plan-Ids liess sich damit der Sitzplan jeder Klasse abrufen,
    im PDF samt Namen.
    """
    if isinstance(current, Teacher):
        return
    if class_id is not None and is_granted_klassensprecher(db, current, class_id):
        return
    raise HTTPException(403, "Keine Berechtigung für diesen Sitzplan.")


def _assert_plan_reader(plan: SeatingPlan, current, db: Session) -> None:
    """Wie oben, fuer einen konkreten Plan. Kurs/WPF-Plaene haben keine
    Klassensprecher — die bleiben den Lehrkraeften vorbehalten."""
    if plan.group_id is not None:
        _assert_group_editor(current)
        return
    _assert_class_plan_reader(current, plan.class_id, db)


def _assert_additional_editor(current, class_id: int, db: Session) -> None:
    """Additional (non-default) rooms may be managed by any teacher or by a
    granted Klassensprecher of the class — the default 'Klassenraum' stays
    locked to the Klassenlehrer (require_class_teacher)."""
    if isinstance(current, Teacher) or is_granted_klassensprecher(db, current, class_id):
        return
    raise HTTPException(403, "Keine Berechtigung für diesen Sitzplan.")


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
    class_id: int | None
    group_id: int | None
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
def list_plans(class_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if not db.get(Class, class_id):
        raise HTTPException(404, "Klasse nicht gefunden")
    _assert_class_plan_reader(current, class_id, db)
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
    current=Depends(get_current_user),
):
    if not db.get(Class, class_id):
        raise HTTPException(404, "Klasse nicht gefunden")
    # The first plan is the default "Klassenraum" and belongs to the class
    # teacher; any teacher (or a granted Klassensprecher) may add further rooms.
    if db.query(SeatingPlan).filter_by(class_id=class_id).count() == 0:
        require_class_teacher(current, class_id)
    else:
        _assert_additional_editor(current, class_id, db)
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


@router.get("/groups/{group_id}/seating", response_model=list[SeatingPlanSummary])
def list_group_plans(group_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if not db.get(StudentGroup, group_id):
        raise HTTPException(404, "Kurs nicht gefunden")
    _assert_group_editor(current)
    return (
        db.query(SeatingPlan)
        .filter(SeatingPlan.group_id == group_id)
        .order_by(SeatingPlan.id)
        .all()
    )


@router.post("/groups/{group_id}/seating", response_model=SeatingPlanDetail)
def create_group_plan(
    group_id: int,
    body: SeatingPlanCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not db.get(StudentGroup, group_id):
        raise HTTPException(404, "Kurs nicht gefunden")
    _assert_group_editor(current)
    plan = SeatingPlan(
        group_id=group_id,
        name=body.name.strip() or "Kursraum",
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


def _is_default_plan(plan: SeatingPlan, db: Session) -> bool:
    """The default "Klassenraum" = the first (lowest-id) plan of the class. It
    stays locked to the class teacher; additional rooms are open to any teacher."""
    scope = {"class_id": plan.class_id} if plan.class_id is not None else {"group_id": plan.group_id}
    min_id = db.query(func.min(SeatingPlan.id)).filter_by(**scope).scalar()
    return plan.id == min_id


def _assert_plan_editor(plan: SeatingPlan, current, db: Session) -> None:
    if plan.group_id is not None:
        _assert_group_editor(current)
    elif _is_default_plan(plan, db):
        require_class_teacher(current, plan.class_id)
    else:
        _assert_additional_editor(current, plan.class_id, db)


@router.get("/seating/{plan_id}", response_model=SeatingPlanDetail)
def get_plan(plan_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    plan = _get_plan_or_404(plan_id, db)
    _assert_plan_reader(plan, current, db)
    return _detail(plan)


@router.put("/seating/{plan_id}", response_model=SeatingPlanDetail)
def update_plan(
    plan_id: int,
    body: SeatingPlanUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_plan_editor(plan, current, db)
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
    current=Depends(get_current_user),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_plan_editor(plan, current, db)
    db.delete(plan)
    db.commit()


@router.get("/seating/{plan_id}/export.pdf")
def export_plan_pdf(plan_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    plan = _get_plan_or_404(plan_id, db)
    _assert_plan_reader(plan, current, db)
    # Resolve the student_ids referenced by seats to display names.
    ids = {
        seat["student_id"]
        for it in (plan.items or [])
        for seat in (it.get("seats") or [])
        if seat.get("student_id") is not None
    }
    # Auf dem Sitzplan steht der Rufname, sonst nichts — die Initiale des
    # Nachnamens nur dort, wo zwei denselben Rufnamen tragen. Gleiche Regel wie
    # auf dem Bildschirm (seatNameById in SeatingEditor.tsx), auch fuer die
    # Klassenleitung: ein ausgedruckter Plan haengt an der Wand.
    labels: dict[int, str] = {}
    if ids:
        labels = seat_labels(db.query(Student).filter(Student.id.in_(ids)).all())
    names, short = labels, labels
    pdf_path = export_pdf(plan, names, short)
    if pdf_path is None:
        raise HTTPException(503, "PDF-Export momentan nicht verfügbar")
    if plan.group_id is not None:
        grp = db.get(StudentGroup, plan.group_id)
        scope = f"{grp.grade} {grp.name}" if grp and grp.grade else (grp.name if grp else str(plan.group_id))
    else:
        cls = db.get(Class, plan.class_id)
        scope = cls.code if cls else str(plan.class_id)
    stamp = datetime.now().strftime("%Y%m%d")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{scope}_{stamp}.pdf")
