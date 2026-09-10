from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StudentRole, Student, Teacher, Class
from ..auth import get_current_teacher, require_class_teacher
from ..display_names import NameScope

router = APIRouter(prefix="/api/roles", tags=["roles"])

VALID_ROLES: set[str] = set()  # empty = allow any role type

# Role types a class starts out with, until its Klassenlehrer curates the list
# (Class.role_types stays NULL until then).
DEFAULT_CLASS_ROLES = [
    "Klassensprecher",
    "Stellvertretender Klassensprecher",
    "Schülersprecher",
    "Haussprecher",
]


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


def _out(r: StudentRole, scope: NameScope) -> RoleOut:
    return RoleOut(
        id=r.id,
        student_id=r.student_id,
        student_name=scope.name(r.student),
        role_type=r.role_type,
        scope_id=r.scope_id,
        assigned_by=r.assigned_by,
    )


@router.get("", response_model=list[RoleOut])
def list_roles(
    role_type: str | None = None,
    scope_id: int | None = None,
    db: Session = Depends(get_db),
    viewer: Teacher = Depends(get_current_teacher),
):
    q = db.query(StudentRole)
    if role_type:
        q = q.filter(StudentRole.role_type == role_type)
    if scope_id is not None:
        q = q.filter(StudentRole.scope_id == scope_id)
    return [_out(r, NameScope(db, viewer)) for r in q.all()]


class RoleTypesUpdate(BaseModel):
    class_id: int
    role_types: list[str]


def _class_role_types(db: Session, class_id: int) -> list[str]:
    """The class's role types — its curated list, or the defaults plus whatever
    role types are already assigned in that class."""
    cls = db.get(Class, class_id)
    if not cls:
        raise HTTPException(404, "Class not found")
    if cls.role_types is not None:
        return list(cls.role_types)
    assigned = [r.role_type for r in db.query(StudentRole).filter_by(scope_id=class_id).all()]
    known = {t.lower() for t in DEFAULT_CLASS_ROLES}
    extra = [t for t in dict.fromkeys(assigned) if t.lower() not in known]
    return DEFAULT_CLASS_ROLES + extra


@router.get("/types", response_model=list[str])
def list_role_types(
    class_id: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    return _class_role_types(db, class_id)


@router.put("/types", response_model=list[str])
def set_role_types(
    body: RoleTypesUpdate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Replace the class's role types. Assignments of dropped types are removed."""
    require_class_teacher(current, body.class_id)
    cls = db.get(Class, body.class_id)
    if not cls:
        raise HTTPException(404, "Class not found")

    types: list[str] = []
    seen: set[str] = set()
    for t in body.role_types:
        t = t.strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            types.append(t)

    for role in db.query(StudentRole).filter_by(scope_id=body.class_id).all():
        if role.role_type.lower() not in seen:
            db.delete(role)

    cls.role_types = types
    db.commit()
    return types


@router.post("", response_model=RoleOut, status_code=201)
def assign_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if VALID_ROLES and body.role_type not in VALID_ROLES:
        raise HTTPException(400, f"Unknown role. Valid: {', '.join(sorted(VALID_ROLES))}")
    # Roles are assigned per class (scope_id = class id) from Klassenverwaltung —
    # only that class's Klassenlehrer (or an admin) may (un)assign them.
    require_class_teacher(current, body.scope_id)
    student = db.get(Student, body.student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    # Keep the class's curated role list in sync, so an assigned role is always listed.
    cls = db.get(Class, body.scope_id) if body.scope_id is not None else None
    if cls is not None and cls.role_types is not None:
        if body.role_type.lower() not in {t.lower() for t in cls.role_types}:
            cls.role_types = list(cls.role_types) + [body.role_type]

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
    return _out(role, NameScope(db, current))


@router.delete("/{role_id}", status_code=204)
def remove_role(
    role_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    role = db.get(StudentRole, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    require_class_teacher(current, role.scope_id)
    db.delete(role)
    db.commit()
