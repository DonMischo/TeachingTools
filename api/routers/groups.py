from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StudentGroup, StudentGroupMember, Student, Transaction, Teacher
from ..auth import get_current_teacher
from ..display_names import NameScope

router = APIRouter(prefix="/api/groups", tags=["groups"])

VALID_GROUP_TYPES = {"kurs", "wahlpflicht", "ab_gruppe"}


class GroupOut(BaseModel):
    id: int
    group_type: str
    name: str
    class_id: int | None
    grade: int | None
    member_ids: list[int]
    member_class_ids: list[int]

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    group_type: str
    name: str
    class_id: int | None = None
    # Klassenstufe for cross-class groups: "Kurs I" exists once per Jahrgang.
    grade: int | None = None


class GroupUpdate(BaseModel):
    name: str


class MemberAdd(BaseModel):
    student_id: int


class RosterEntry(BaseModel):
    id: int
    # Kurzform (»Anna B.«), ausser fuer die Klassenleitung dieser Klasse.
    vorname: str
    nachname: str
    alias: str | None = None


class AwardIn(BaseModel):
    points: int
    reason: str | None = None


def _out(g: StudentGroup) -> GroupOut:
    member_ids = [m.student_id for m in g.members]
    class_ids = sorted({m.student.class_id for m in g.members if m.student.class_id is not None})
    return GroupOut(
        id=g.id,
        group_type=g.group_type,
        name=g.name,
        class_id=g.class_id,
        grade=g.grade,
        member_ids=member_ids,
        member_class_ids=class_ids,
    )


@router.get("", response_model=list[GroupOut])
def list_groups(
    group_type: str | None = None,
    class_id: int | None = None,
    grade: int | None = None,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    q = db.query(StudentGroup)
    if group_type:
        q = q.filter(StudentGroup.group_type == group_type)
    if class_id is not None:
        q = q.filter(StudentGroup.class_id == class_id)
    if grade is not None:
        q = q.filter(StudentGroup.grade == grade)
    return [_out(g) for g in q.order_by(StudentGroup.grade, StudentGroup.name).all()]


@router.post("", response_model=GroupOut, status_code=201)
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    if body.group_type not in VALID_GROUP_TYPES:
        raise HTTPException(400, f"Unknown group_type. Valid: {', '.join(sorted(VALID_GROUP_TYPES))}")
    # Picking "Kurs I" in 10a means *this* Kurs — the one Jahrgang 10 already has,
    # if it exists. A plain insert would quietly make a second one (the unique
    # constraint cannot catch it: class_id is NULL for cross-class groups, and
    # NULLs never collide in Postgres), splitting the course in two.
    existing = (
        db.query(StudentGroup)
        .filter_by(group_type=body.group_type, name=body.name, class_id=body.class_id, grade=body.grade)
        .first()
    )
    if existing:
        return _out(existing)
    g = StudentGroup(group_type=body.group_type, name=body.name, class_id=body.class_id, grade=body.grade)
    db.add(g)
    db.commit()
    db.refresh(g)
    return _out(g)


@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    return _out(g)


@router.patch("/{group_id}", response_model=GroupOut)
def rename_group(
    group_id: int,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name darf nicht leer sein.")
    g.name = name
    db.commit()
    db.refresh(g)
    return _out(g)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    db.delete(g)
    db.commit()


@router.get("/{group_id}/roster", response_model=list[RosterEntry])
def group_roster(
    group_id: int,
    db: Session = Depends(get_db),
    viewer: Teacher = Depends(get_current_teacher),
):
    """Member students of a group (name + alias), sorted — enough to render and
    export a printable list for a Kurs / Wahlpflicht group."""
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    rows = (
        db.query(Student)
        .join(StudentGroupMember, StudentGroupMember.student_id == Student.id)
        .filter(StudentGroupMember.group_id == group_id, Student.active == True)  # noqa: E712
        .order_by(Student.nachname, Student.vorname)
        .all()
    )
    scope = NameScope(db, viewer)
    return [
        RosterEntry(
            id=s.id,
            vorname=s.vorname if scope.full(s) else (s.alias or s.vorname or ""),
            nachname=(s.nachname or "") if scope.full(s) else f"{(s.nachname or '')[:1]}.",
            alias=s.alias,
        )
        for s in rows
    ]


@router.post("/{group_id}/members", response_model=GroupOut)
def add_member(
    group_id: int,
    body: MemberAdd,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    student = db.get(Student, body.student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    exists = db.query(StudentGroupMember).filter_by(group_id=group_id, student_id=body.student_id).first()
    if not exists:
        db.add(StudentGroupMember(group_id=group_id, student_id=body.student_id))
        db.commit()
        db.refresh(g)
    return _out(g)


@router.delete("/{group_id}/members/{student_id}", response_model=GroupOut)
def remove_member(
    group_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    db.query(StudentGroupMember).filter_by(group_id=group_id, student_id=student_id).delete()
    db.commit()
    db.refresh(g)
    return _out(g)


@router.post("/{group_id}/award", response_model=list[dict])
def award_group(
    group_id: int,
    body: AwardIn,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Award points to a cross-class group; splits equally across all classes
    that have at least one member in this group."""
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    class_ids = sorted({m.student.class_id for m in g.members if m.student.class_id is not None})
    if not class_ids:
        raise HTTPException(400, "Group has no members assigned to a class")

    n = len(class_ids)
    base = body.points // n
    remainder = body.points - base * n
    reason = body.reason or f"Kurs/Gruppe: {g.name}"

    results = []
    for i, class_id in enumerate(class_ids):
        pts = base + (1 if i < remainder else 0)
        tx = Transaction(teacher_id=current.id, class_id=class_id, points=pts, reason=reason)
        db.add(tx)
        results.append({"class_id": class_id, "points": pts})
    db.commit()
    return results
