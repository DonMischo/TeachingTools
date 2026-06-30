from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StudentRole, Student, Teacher
from ..auth import get_current_teacher

router = APIRouter(prefix="/api/roles", tags=["roles"])

VALID_ROLES = {"klassensprecher", "haussprecher"}


class RoleOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    role_type: str
    scope_id: int | None
    assigned_by: int | None

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    student_id: int
    role_type: str
    scope_id: int | None = None


def _out(r: StudentRole) -> RoleOut:
    return RoleOut(
        id=r.id,
        student_id=r.student_id,
        student_name=f"{r.student.vorname} {r.student.nachname}",
        role_type=r.role_type,
        scope_id=r.scope_id,
        assigned_by=r.assigned_by,
    )


@router.get("", response_model=list[RoleOut])
def list_roles(
    role_type: str | None = None,
    scope_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(StudentRole)
    if role_type:
        q = q.filter(StudentRole.role_type == role_type)
    if scope_id is not None:
        q = q.filter(StudentRole.scope_id == scope_id)
    return [_out(r) for r in q.all()]


@router.post("", response_model=RoleOut, status_code=201)
def assign_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if body.role_type not in VALID_ROLES:
        raise HTTPException(400, f"Unknown role. Valid: {', '.join(sorted(VALID_ROLES))}")
    student = db.get(Student, body.student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    # Remove any existing role of same type+scope
    db.query(StudentRole).filter_by(
        role_type=body.role_type, scope_id=body.scope_id
    ).delete()

    role = StudentRole(
        student_id=body.student_id,
        role_type=body.role_type,
        scope_id=body.scope_id,
        assigned_by=current.id,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return _out(role)


@router.delete("/{role_id}", status_code=204)
def remove_role(
    role_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    role = db.get(StudentRole, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    db.delete(role)
    db.commit()
