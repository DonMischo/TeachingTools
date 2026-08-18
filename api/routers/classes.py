from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from pathlib import Path
import shutil, uuid

from ..database import get_db
from ..models import Class, Teacher, Transaction, Student, StudentRole
from ..schemas import ClassOut, ClassSymbolUpdate, ClassNameUpdate
from ..auth import get_current_teacher, get_current_user, require_class_manager

router = APIRouter(prefix="/api/classes", tags=["classes"])


def assert_class_editor(teacher: Teacher, class_id: int) -> None:
    """Class edits are allowed for admins and the class's Klassenlehrer
    (Teacher.klasse_id — a Klassenleitungsteam of two shares one klasse_id)."""
    if teacher.role == "admin":
        return
    if teacher.klasse_id == class_id:
        return
    raise HTTPException(status_code=403, detail="Nur Klassenlehrer dieser Klasse oder Admins")

UPLOAD_DIR = Path(__file__).parent.parent / "data" / "gfx"


def _with_totals(db: Session) -> list[ClassOut]:
    rows = (
        db.query(Class, func.coalesce(func.sum(Transaction.points), 0).label("total_points"))
        .outerjoin(Transaction, Transaction.class_id == Class.id)
        .group_by(Class.id)
        .order_by(Class.code)
        .all()
    )
    result = []
    for cls, total in rows:
        out = ClassOut.model_validate(cls)
        out.total_points = int(total)
        result.append(out)
    return result


@router.get("", response_model=list[ClassOut])
def list_classes(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _with_totals(db)


class RosterEntry(BaseModel):
    id: int
    vorname: str
    nachname: str
    geschlecht: str | None = None
    alias: str | None = None
    nta: list[int] = []


@router.get("/{class_id}/roster", response_model=list[RosterEntry])
def class_roster(class_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Minimal roster of a class's active students (name + Geschlecht) — enough
    for a granted Klassensprecher to assign Klassendienste and lay out a Sitzplan
    without the full teacher-only student list."""
    require_class_manager(db, current, class_id)
    rows = (
        db.query(Student)
        .filter(Student.class_id == class_id, Student.active == True)  # noqa: E712
        .order_by(Student.nachname, Student.vorname)
        .all()
    )
    return [
        RosterEntry(id=s.id, vorname=s.vorname, nachname=s.nachname, geschlecht=s.geschlecht,
                    alias=s.alias, nta=list(s.nta or []))
        for s in rows
    ]


@router.get("/my-management")
def my_management(db: Session = Depends(get_db), current=Depends(get_current_user)) -> dict:
    """The class a student may manage as a granted Klassensprecher (limited
    subset: Klassendienste + Sitzpläne), or null. Teachers manage via their
    normal role, so this returns null for them — drives the Sidebar icon and the
    /haeuser access for students."""
    if not isinstance(current, Student):
        return {"class_id": None}
    roles = (
        db.query(StudentRole)
        .filter(StudentRole.student_id == current.id,
                StudentRole.role_type.ilike("klassensprecher"))
        .all()
    )
    for r in roles:
        cls = db.get(Class, r.scope_id) if r.scope_id else None
        if cls and cls.ksprecher_can_edit:
            return {"class_id": cls.id}
    return {"class_id": None}


@router.patch("/{class_id}/symbol", response_model=ClassOut)
def update_symbol(
    class_id: int,
    body: ClassSymbolUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    assert_class_editor(current, class_id)
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    cls.symbol_emoji = body.symbol_emoji
    cls.symbol_image = None
    db.commit()
    db.refresh(cls)
    out = ClassOut.model_validate(cls)
    out.total_points = db.query(func.coalesce(func.sum(Transaction.points), 0)).filter(
        Transaction.class_id == class_id
    ).scalar()
    return out


@router.patch("/{class_id}/name", response_model=ClassOut)
def update_class_name(
    class_id: int,
    body: ClassNameUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    assert_class_editor(current, class_id)
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    cls.class_name = body.class_name
    db.commit()
    db.refresh(cls)
    out = ClassOut.model_validate(cls)
    out.total_points = db.query(func.coalesce(func.sum(Transaction.points), 0)).filter(
        Transaction.class_id == class_id
    ).scalar()
    return out


class KsprecherEditUpdate(BaseModel):
    enabled: bool


@router.patch("/{class_id}/ksprecher-edit", response_model=ClassOut)
def set_ksprecher_edit(
    class_id: int,
    body: KsprecherEditUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Toggle whether this class's Klassensprecher may edit the limited subset
    (Klassendienste + zusätzliche Sitzpläne). Only the Klassenlehrer or an admin."""
    assert_class_editor(current, class_id)
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    cls.ksprecher_can_edit = body.enabled
    db.commit()
    db.refresh(cls)
    out = ClassOut.model_validate(cls)
    out.total_points = db.query(func.coalesce(func.sum(Transaction.points), 0)).filter(
        Transaction.class_id == class_id
    ).scalar()
    return out


@router.post("/{class_id}/symbol/image", response_model=ClassOut)
def upload_symbol_image(
    class_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    assert_class_editor(current, class_id)
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix or ".png"
    filename = f"custom_{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    cls.symbol_image = f"/uploads/gfx/{filename}"
    cls.symbol_emoji = None
    db.commit()
    db.refresh(cls)
    out = ClassOut.model_validate(cls)
    out.total_points = db.query(func.coalesce(func.sum(Transaction.points), 0)).filter(
        Transaction.class_id == class_id
    ).scalar()
    return out
