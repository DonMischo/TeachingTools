from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session
from pathlib import Path
import shutil, uuid

from ..database import get_db
from ..models import Class, Teacher, Transaction
from ..schemas import ClassOut, ClassSymbolUpdate, ClassNameUpdate
from ..auth import get_current_teacher, get_current_user

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
