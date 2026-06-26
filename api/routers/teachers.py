import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Teacher
from ..schemas import TeacherOut
from ..auth import get_current_teacher, hash_password, require_admin

router = APIRouter(prefix="/api/teachers", tags=["teachers"])

_TRUTHY = {"1", "true", "ja", "yes"}


@router.get("", response_model=list[TeacherOut])
def list_teachers(db: Session = Depends(get_db)):
    return db.query(Teacher).filter(Teacher.active == True).order_by(Teacher.last_name, Teacher.first_name).all()


@router.post("/import", response_model=list[TeacherOut])
def import_teachers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    content = file.file.read().decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(content))
    # Normalize column names
    reader.fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
    required = {"first_name", "last_name"}
    missing = required - set(reader.fieldnames)
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing CSV columns: {missing}")

    for row in reader:
        first = row.get("first_name", "").strip()
        last = row.get("last_name", "").strip()
        if not first or not last:
            continue
        active = row.get("active", "1").strip().lower() in _TRUTHY
        existing = db.query(Teacher).filter(Teacher.first_name == first, Teacher.last_name == last).first()
        if existing:
            existing.active = active
        else:
            db.add(Teacher(first_name=first, last_name=last, active=active))
    db.commit()
    return db.query(Teacher).filter(Teacher.active == True).order_by(Teacher.last_name, Teacher.first_name).all()


@router.post("/{teacher_id}/set-password", status_code=204)
def set_password(
    teacher_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    # Teachers can set their own password; admins can set any
    if current.id != teacher_id and current.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    teacher = db.get(Teacher, teacher_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    password = body.get("password", "")
    if len(password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    teacher.password_hash = hash_password(password)
    db.commit()
