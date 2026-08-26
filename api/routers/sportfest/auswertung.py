from typing import Union
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...database import get_db
from ...models import Teacher, Student, SportfestResult, SportfestDiscipline, Class, Transaction
from ...schemas import AuswertungStudent, AuswertungDisciplineEntry
from ...auth import get_current_user_optional, get_current_teacher

router = APIRouter(prefix="/api/sportfest/auswertung", tags=["sportfest"])


def _is_authenticated(user) -> bool:
    return user is not None


def _student_name(student: Student, authenticated: bool) -> str | None:
    return f"{student.vorname} {student.nachname}" if authenticated else None


@router.get("/gesamt", response_model=list[AuswertungStudent])
def gesamt(
    jahrgang: int | None = None,
    geschlecht: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    authenticated = _is_authenticated(user)

    enabled_ids: set[str] = {
        d.id for d in db.query(SportfestDiscipline).filter(SportfestDiscipline.enabled == True).all()
    }

    # Aggregate total points per student
    from sqlalchemy import func
    q = (
        db.query(Student, func.coalesce(func.sum(SportfestResult.points), 0).label("total"))
        .outerjoin(
            SportfestResult,
            (SportfestResult.student_id == Student.id) &
            (SportfestResult.discipline_id.in_(enabled_ids)),
        )
        .filter(Student.active == True)
    )
    if jahrgang is not None:
        q = q.filter(Student.jahrgang == jahrgang)
    if geschlecht:
        q = q.filter(Student.geschlecht == geschlecht)

    rows = q.group_by(Student.id).order_by(func.coalesce(func.sum(SportfestResult.points), 0).desc()).all()

    result = []
    for rank, (student, total) in enumerate(rows, start=1):
        result.append(AuswertungStudent(
            rank=rank,
            name=_student_name(student, authenticated),
            klasse=student.klasse,
            jahrgang=student.jahrgang,
            total_points=int(total),
        ))
    return result


@router.get("/disziplin", response_model=list[AuswertungDisciplineEntry])
def disziplin(
    overall: bool = False,
    jahrgang: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    authenticated = _is_authenticated(user)

    disciplines = db.query(SportfestDiscipline).filter(SportfestDiscipline.enabled == True).all()

    result: list[AuswertungDisciplineEntry] = []

    for disc in disciplines:
        q = (
            db.query(Student, SportfestResult)
            .join(SportfestResult, SportfestResult.student_id == Student.id)
            .filter(
                SportfestResult.discipline_id == disc.id,
                Student.active == True,
                SportfestResult.points.isnot(None),
            )
        )
        if not overall and jahrgang is not None:
            q = q.filter(Student.jahrgang == jahrgang)
        rows = q.order_by(SportfestResult.points.desc()).all()

        for rank, (student, res) in enumerate(rows, start=1):
            result.append(AuswertungDisciplineEntry(
                rank=rank,
                name=_student_name(student, authenticated),
                klasse=student.klasse,
                discipline_id=disc.id,
                value=res.value,
                points=res.points,
            ))

    return result


# ---------------------------------------------------------------------------
# Class-level aggregation
# ---------------------------------------------------------------------------

class KlasseEntry(BaseModel):
    klasse: str
    jahrgang: int | None
    class_id: int | None
    participant_count: int
    raw_total: int


class KlassePunkteEntry(KlasseEntry):
    adjusted: float
    awarded: int


class KlassePunkteCommitBody(BaseModel):
    prior_strength: float = 10.0
    reason: str = "Sportfest DLV Punkte"


def _klassen_aggregate(db: Session) -> list[KlasseEntry]:
    from sqlalchemy import func as f

    enabled_ids: set[str] = {
        d.id for d in db.query(SportfestDiscipline).filter(SportfestDiscipline.enabled == True).all()
    }

    rows = (
        db.query(
            Student.klasse,
            Student.jahrgang,
            f.coalesce(f.sum(SportfestResult.points), 0).label("total"),
            f.count(Student.id).label("n"),
        )
        .outerjoin(
            SportfestResult,
            (SportfestResult.student_id == Student.id) &
            (SportfestResult.discipline_id.in_(enabled_ids)) &
            (SportfestResult.points.isnot(None)),
        )
        .filter(Student.active == True)
        .group_by(Student.klasse, Student.jahrgang)
        .all()
    )

    classes = {c.code: c.id for c in db.query(Class).all()}

    entries = []
    for row in rows:
        if int(row.total) == 0:
            continue
        entries.append(KlasseEntry(
            klasse=row.klasse,
            jahrgang=row.jahrgang,
            class_id=classes.get(row.klasse),
            participant_count=int(row.n),
            raw_total=int(row.total),
        ))
    return entries


def _bayesian_normalize(entries: list[KlasseEntry], prior_strength: float) -> list[KlassePunkteEntry]:
    if not entries:
        return []
    totals = [e.raw_total for e in entries]
    prior = sum(totals) / len(totals)
    result = []
    for e in entries:
        n = e.participant_count
        adj = (n * e.raw_total + prior_strength * prior) / (n + prior_strength)
        awarded = round(adj / 10)
        result.append(KlassePunkteEntry(**e.model_dump(), adjusted=adj, awarded=awarded))
    return result


@router.get("/klassen", response_model=list[KlasseEntry])
def klassen(db: Session = Depends(get_db), user=Depends(get_current_user_optional)):
    return _klassen_aggregate(db)


@router.get("/klassen-punkte/preview", response_model=list[KlassePunkteEntry])
def klassen_punkte_preview(
    prior_strength: float = 10.0,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    entries = _klassen_aggregate(db)
    return _bayesian_normalize(entries, prior_strength)


@router.post("/klassen-punkte/commit", response_model=list[KlassePunkteEntry])
def klassen_punkte_commit(
    body: KlassePunkteCommitBody,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    # Must be a Teacher, not just any authenticated user: the awarded points are
    # booked as that teacher's Transactions.
    teacher_id = teacher.id

    entries = _klassen_aggregate(db)
    normalized = _bayesian_normalize(entries, body.prior_strength)

    for e in normalized:
        if e.class_id is None or e.awarded <= 0:
            continue
        tx = Transaction(
            teacher_id=teacher_id,
            class_id=e.class_id,
            points=e.awarded,
            reason=body.reason,
        )
        db.add(tx)
    db.commit()
    return normalized
