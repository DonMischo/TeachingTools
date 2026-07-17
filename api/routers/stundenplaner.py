"""
Stundenplaner — teacher-only lesson planning tool.

Features:
  - CRUD for lesson plans (owner only for writes)
  - Share plans with colleagues (read-only for shared users)
  - Import from JSON with strict validation and HTML stripping
  - Tool-refs endpoint to populate tool-link pickers in UI
"""
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    LessonPlan, LessonPlanShare, LessonSession, LessonMaterial, LessonPlanClassShare, Teacher, Class,
)
from ..auth import get_current_teacher
from ..tool_registry import REGISTRY
from ..upload_utils import ALLOWED_MIMES, ALLOWED_EXTENSIONS, MAX_FILE_BYTES, CONVERTIBLE_EXTENSIONS
from ..doc_convert import convert_to_pdf

MATERIALS_BASE = Path(__file__).parent.parent.parent / "data" / "stundenplaner"

router = APIRouter(prefix="/api/stundenplaner", tags=["stundenplaner"])

MAX_JSON_BYTES = 50 * 1024  # 50 KB
_HTML_RE = re.compile(r"<[^>]+>", re.IGNORECASE)
SOZIALFORM_VALUES = {"Plenum", "EA", "PA", "GA", "Gruppen"}


def _strip(s: str) -> str:
    return _HTML_RE.sub("", s).strip()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ToolLinkIn(BaseModel):
    model_config = {"extra": "forbid"}

    type: str
    ref_id: str | None = None
    label: str = Field(default="", max_length=200)

    @field_validator("type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in REGISTRY:
            raise ValueError(f"type must be one of {sorted(REGISTRY)}")
        return v

    @field_validator("ref_id", mode="before")
    @classmethod
    def sanitize_ref(cls, v):
        if v is None:
            return v
        v = str(v)[:50]
        if not re.match(r"^[A-Za-z0-9_-]+$", v):
            raise ValueError("ref_id contains invalid characters")
        return v


class PhaseIn(BaseModel):
    model_config = {"extra": "forbid"}

    id: str | None = Field(default=None, max_length=40)
    name: str = Field(..., max_length=100)
    dauer_min: int = Field(default=5, ge=1, le=300)
    inhalt: str = Field(default="", max_length=2000)
    sozialform: str = Field(default="Plenum", max_length=20)
    methode: str = Field(default="", max_length=200)
    material: str = Field(default="", max_length=500)
    tool_link: ToolLinkIn | None = None

    @field_validator("sozialform")
    @classmethod
    def valid_sozialform(cls, v: str) -> str:
        if v not in SOZIALFORM_VALUES:
            raise ValueError(f"sozialform must be one of {sorted(SOZIALFORM_VALUES)}")
        return v

    @field_validator("id")
    @classmethod
    def valid_id(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.match(r"^[A-Za-z0-9_-]+$", v):
            raise ValueError("id contains invalid characters")
        return v

    @field_validator("name", "inhalt", "methode", "material", mode="before")
    @classmethod
    def strip_html(cls, v):
        return _strip(str(v)) if isinstance(v, str) else v


class LessonPlanIn(BaseModel):
    model_config = {"extra": "forbid"}

    title: str = Field(..., min_length=1, max_length=200)
    fach: str = Field(default="", max_length=100)
    klasse: str = Field(default="", max_length=50)
    datum: str | None = Field(default=None)
    dauer_min: int = Field(default=45, ge=1, le=300)
    lernziele: list[str] = Field(default_factory=list)
    phasen: list[PhaseIn] = Field(default_factory=list)
    hausaufgaben: str = Field(default="", max_length=1000)
    notizen: str = Field(default="", max_length=2000)

    @field_validator("lernziele")
    @classmethod
    def validate_lernziele(cls, v: list) -> list:
        if len(v) > 10:
            raise ValueError("max 10 Lernziele")
        return [_strip(str(s)[:300]) for s in v]

    @field_validator("phasen")
    @classmethod
    def validate_phasen(cls, v: list) -> list:
        if len(v) > 15:
            raise ValueError("max 15 Phasen")
        return v

    @field_validator("datum")
    @classmethod
    def validate_datum(cls, v):
        if v is None:
            return v
        try:
            d = datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("datum must be YYYY-MM-DD")
        if not (2015 <= d.year <= 2040):
            raise ValueError("Jahr außerhalb des erlaubten Bereichs (2015–2040)")
        return v

    @field_validator("title", "fach", "klasse", "hausaufgaben", "notizen", mode="before")
    @classmethod
    def strip_top(cls, v):
        return _strip(str(v)) if isinstance(v, str) else v


class ImportIn(LessonPlanIn):
    """Like LessonPlanIn but tool_links in phasen are always stripped."""
    pass


class ShareIn(BaseModel):
    teacher_id: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize(plan: LessonPlan, teacher_id: int) -> dict:
    shared_with = [
        {"teacher_id": s.teacher_id, "name": f"{s.teacher.first_name} {s.teacher.last_name}"}
        for s in plan.shares
    ]
    return {
        "id": plan.id,
        "title": plan.title,
        "fach": plan.fach,
        "klasse": plan.klasse,
        "datum": plan.datum,
        "dauer_min": plan.dauer_min,
        "lernziele": plan.lernziele,
        "phasen": [
            {k: v for k, v in p.items()} if isinstance(p, dict) else p
            for p in plan.phasen
        ],
        "hausaufgaben": plan.hausaufgaben,
        "notizen": plan.notizen,
        "created_at": plan.created_at.isoformat(),
        "updated_at": plan.updated_at.isoformat(),
        "owner_id": plan.teacher_id,
        "owner_name": f"{plan.teacher.first_name} {plan.teacher.last_name}",
        "is_owner": plan.teacher_id == teacher_id,
        "shared_with": shared_with,
    }


def _get_plan_or_404(plan_id: int, db: Session) -> LessonPlan:
    plan = db.query(LessonPlan).filter_by(id=plan_id).first()
    if not plan:
        raise HTTPException(404, "Stundenplanung nicht gefunden")
    return plan


def _assert_access(plan: LessonPlan, teacher_id: int):
    if plan.teacher_id == teacher_id:
        return
    if any(s.teacher_id == teacher_id for s in plan.shares):
        return
    raise HTTPException(403, "Kein Zugriff auf diese Stundenplanung")


def _assert_owner(plan: LessonPlan, teacher_id: int):
    if plan.teacher_id != teacher_id:
        raise HTTPException(403, "Nur der Ersteller kann diese Planung bearbeiten")


def _apply(plan: LessonPlan, data: LessonPlanIn):
    plan.title = data.title
    plan.fach = data.fach
    plan.klasse = data.klasse
    plan.datum = data.datum
    plan.dauer_min = data.dauer_min
    plan.lernziele = data.lernziele
    phasen = [p.model_dump() for p in data.phasen]
    for p in phasen:
        if not p.get("id"):
            p["id"] = uuid.uuid4().hex
    plan.phasen = phasen
    plan.hausaufgaben = data.hausaufgaben
    plan.notizen = data.notizen


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("")
def list_plans(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """All plans owned by or shared with the requesting teacher."""
    own = db.query(LessonPlan).filter_by(teacher_id=teacher.id).order_by(LessonPlan.updated_at.desc()).all()
    shared_ids = {s.plan_id for s in db.query(LessonPlanShare).filter_by(teacher_id=teacher.id).all()}
    shared = [
        p for p in db.query(LessonPlan).filter(LessonPlan.id.in_(shared_ids)).order_by(LessonPlan.updated_at.desc()).all()
    ] if shared_ids else []
    return {
        "own": [_serialize(p, teacher.id) for p in own],
        "shared": [_serialize(p, teacher.id) for p in shared],
    }


@router.post("", status_code=201)
def create_plan(
    body: LessonPlanIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = LessonPlan(teacher_id=teacher.id)
    _apply(plan, body)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _serialize(plan, teacher.id)


@router.post("/import", status_code=201)
async def import_plan(
    request: Request,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Import a plan from raw JSON. Tool links in phasen are stripped."""
    raw = await request.body()
    if len(raw) > MAX_JSON_BYTES:
        raise HTTPException(413, f"JSON zu groß (max {MAX_JSON_BYTES // 1024} KB)")

    try:
        import json as _json
        parsed = _json.loads(raw)
    except Exception:
        raise HTTPException(400, "Ungültiges JSON")

    try:
        data = ImportIn.model_validate(parsed)
    except Exception as e:
        raise HTTPException(422, str(e))

    # Strip tool_links on import — only settable via UI
    phasen_clean = [p.model_dump() for p in data.phasen]
    for p in phasen_clean:
        p["tool_link"] = None

    plan = LessonPlan(teacher_id=teacher.id)
    _apply(plan, data)
    plan.phasen = phasen_clean
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _serialize(plan, teacher.id)


@router.get("/tool-refs")
def tool_refs(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Self-describing tool list for the picker UI: every registered tool
    with its label, flags and linkable content pool. Driven entirely by
    api/tool_registry.py — new tools appear here automatically."""
    return [
        {
            "type": d.type,
            "label": d.label,
            "requires_ref": d.requires_ref,
            "uses_class": d.uses_class,
            "items": d.list_refs(db, teacher),
        }
        for d in REGISTRY.values()
    ]


class ToolLaunchIn(BaseModel):
    ref_id: str | None = None
    klasse: str | None = None


@router.post("/tools/{tool_type}/launch")
def launch_tool(
    tool_type: str,
    body: ToolLaunchIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Launch a tool from a lesson phase: creates a session/lobby where the
    tool needs one and returns the host/join URLs."""
    descriptor = REGISTRY.get(tool_type)
    if not descriptor:
        raise HTTPException(404, f"Unbekanntes Tool: {tool_type}")
    result = descriptor.launch(db, teacher, body.ref_id, body.klasse)
    return {"host_url": result.host_url, "join_url": result.join_url, "code": result.code}


def _session_out(s: LessonSession) -> dict:
    return {
        "id": s.id,
        "plan_id": s.plan_id,
        "started_at": s.started_at.isoformat(),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
    }


@router.get("/active")
def get_active_session(
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Must be declared before GET /{plan_id} — otherwise 'active' is parsed as plan_id."""
    session = (
        db.query(LessonSession)
        .filter_by(teacher_id=teacher.id, ended_at=None)
        .order_by(LessonSession.started_at.desc())
        .first()
    )
    if not session:
        return None
    plan = db.query(LessonPlan).filter_by(id=session.plan_id).first()
    if not plan:
        return None
    return {"session": _session_out(session), "plan": _serialize(plan, teacher.id)}


@router.get("/{plan_id}")
def get_plan(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_access(plan, teacher.id)
    return _serialize(plan, teacher.id)


@router.put("/{plan_id}")
def update_plan(
    plan_id: int,
    body: LessonPlanIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    _apply(plan, body)
    db.commit()
    db.refresh(plan)
    return _serialize(plan, teacher.id)


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    db.delete(plan)
    db.commit()


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------

@router.get("/{plan_id}/shares")
def list_shares(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    return [
        {"teacher_id": s.teacher_id, "name": f"{s.teacher.first_name} {s.teacher.last_name}"}
        for s in plan.shares
    ]


@router.post("/{plan_id}/shares", status_code=201)
def add_share(
    plan_id: int,
    body: ShareIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)

    if body.teacher_id == teacher.id:
        raise HTTPException(400, "Du kannst deine eigene Planung nicht mit dir selbst teilen")

    target = db.query(Teacher).filter_by(id=body.teacher_id).first()
    if not target:
        raise HTTPException(404, "Lehrkraft nicht gefunden")

    if any(s.teacher_id == body.teacher_id for s in plan.shares):
        raise HTTPException(409, "Bereits geteilt")

    share = LessonPlanShare(plan_id=plan_id, teacher_id=body.teacher_id)
    db.add(share)
    db.commit()
    return {"teacher_id": target.id, "name": f"{target.first_name} {target.last_name}"}


@router.delete("/{plan_id}/shares/{target_teacher_id}", status_code=204)
def remove_share(
    plan_id: int,
    target_teacher_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    share = db.query(LessonPlanShare).filter_by(plan_id=plan_id, teacher_id=target_teacher_id).first()
    if not share:
        raise HTTPException(404, "Freigabe nicht gefunden")
    db.delete(share)
    db.commit()


# ---------------------------------------------------------------------------
# Live lesson sessions (guide sidebar)
# ---------------------------------------------------------------------------

@router.post("/{plan_id}/start")
def start_session(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_access(plan, teacher.id)

    others = db.query(LessonSession).filter_by(teacher_id=teacher.id, ended_at=None).all()
    for o in others:
        o.ended_at = datetime.now(timezone.utc)

    session = LessonSession(plan_id=plan_id, teacher_id=teacher.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_out(session)


@router.post("/sessions/{session_id}/end")
def end_session(
    session_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    session = db.query(LessonSession).filter_by(id=session_id, teacher_id=teacher.id).first()
    if not session:
        raise HTTPException(404, "Session nicht gefunden")
    session.ended_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

def _material_out(m: LessonMaterial) -> dict:
    return {
        "id": m.id,
        "plan_id": m.plan_id,
        "phase_id": m.phase_id,
        "original_filename": m.original_filename,
        "content_type": m.content_type,
        "url": f"/uploads/stundenplaner/{m.plan_id}/{m.stored_filename}",
        "pdf_url": f"/uploads/stundenplaner/{m.plan_id}/{m.pdf_filename}" if m.pdf_filename else None,
        "size_bytes": m.size_bytes,
        "uploaded_at": m.uploaded_at.isoformat(),
    }


@router.get("/{plan_id}/materials")
def list_materials(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_access(plan, teacher.id)
    materials = db.query(LessonMaterial).filter_by(plan_id=plan_id).order_by(LessonMaterial.uploaded_at).all()
    return [_material_out(m) for m in materials]


@router.post("/{plan_id}/materials", status_code=201)
async def upload_material(
    plan_id: int,
    phase_id: str = Form(...),
    file: UploadFile = File(...),
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Dateityp nicht erlaubt: {ext}")
    if file.content_type and file.content_type not in ALLOWED_MIMES:
        raise HTTPException(400, f"MIME-Typ nicht erlaubt: {file.content_type}")

    data = await file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(413, "Datei zu groß (max 20 MB)")

    dest_dir = MATERIALS_BASE / str(plan_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = uuid.uuid4().hex + ext
    dest_path = dest_dir / stored_filename
    dest_path.write_bytes(data)

    pdf_filename = None
    if ext in CONVERTIBLE_EXTENSIONS:
        pdf_path = convert_to_pdf(dest_path, dest_dir)
        if pdf_path:
            pdf_filename = pdf_path.name

    material = LessonMaterial(
        plan_id=plan_id,
        phase_id=phase_id,
        original_filename=file.filename or stored_filename,
        stored_filename=stored_filename,
        content_type=file.content_type or "application/octet-stream",
        pdf_filename=pdf_filename,
        size_bytes=len(data),
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return _material_out(material)


@router.delete("/{plan_id}/materials/{material_id}", status_code=204)
def delete_material(
    plan_id: int,
    material_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    material = db.query(LessonMaterial).filter_by(id=material_id, plan_id=plan_id).first()
    if not material:
        raise HTTPException(404, "Material nicht gefunden")

    dest_dir = MATERIALS_BASE / str(plan_id)
    for fname in (material.stored_filename, material.pdf_filename):
        if fname:
            (dest_dir / fname).unlink(missing_ok=True)

    db.delete(material)
    db.commit()


# ---------------------------------------------------------------------------
# Class shares (scaffolding — no student-facing read access yet)
# ---------------------------------------------------------------------------

class ClassShareIn(BaseModel):
    class_id: int


def _class_share_out(c: Class) -> dict:
    return {"class_id": c.id, "code": c.code, "display_name": c.display_name}


@router.get("/{plan_id}/class-shares")
def list_class_shares(
    plan_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    shares = db.query(LessonPlanClassShare).filter_by(plan_id=plan_id).all()
    classes = {c.id: c for c in db.query(Class).filter(Class.id.in_([s.class_id for s in shares])).all()}
    return [_class_share_out(classes[s.class_id]) for s in shares if s.class_id in classes]


@router.post("/{plan_id}/class-shares", status_code=201)
def add_class_share(
    plan_id: int,
    body: ClassShareIn,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)

    cls = db.query(Class).filter_by(id=body.class_id).first()
    if not cls:
        raise HTTPException(404, "Klasse nicht gefunden")
    if db.query(LessonPlanClassShare).filter_by(plan_id=plan_id, class_id=body.class_id).first():
        raise HTTPException(409, "Bereits geteilt")

    db.add(LessonPlanClassShare(plan_id=plan_id, class_id=body.class_id))
    db.commit()
    return _class_share_out(cls)


@router.delete("/{plan_id}/class-shares/{class_id}", status_code=204)
def remove_class_share(
    plan_id: int,
    class_id: int,
    teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, db)
    _assert_owner(plan, teacher.id)
    share = db.query(LessonPlanClassShare).filter_by(plan_id=plan_id, class_id=class_id).first()
    if not share:
        raise HTTPException(404, "Freigabe nicht gefunden")
    db.delete(share)
    db.commit()
