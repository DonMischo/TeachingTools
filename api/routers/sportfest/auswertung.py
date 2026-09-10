from typing import Union
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...database import get_db
from ...models import Teacher, Student, SportfestResult, SportfestDiscipline, Transaction
from ...schemas import AuswertungStudent, AuswertungDisciplineEntry
from ...auth import get_current_user_optional, get_current_teacher
from ...display_names import NameScope
from .klassen import class_index

router = APIRouter(prefix="/api/sportfest/auswertung", tags=["sportfest"])

# Wie viele je Disziplin und Geschlecht in der Disziplinauswertung stehen.
SIEGEREHRUNG_PLAETZE = 3


def _is_authenticated(user) -> bool:
    return user is not None


def _student_name(student: Student, scope: NameScope | None) -> str | None:
    """Ohne Anmeldung gar kein Name; mit Anmeldung die Kurzform, und nur fuer
    die Klassenleitung dieser Klasse der volle."""
    return scope.name(student) if scope is not None else None


@router.get("/gesamt", response_model=list[AuswertungStudent])
def gesamt(
    jahrgang: int | None = None,
    geschlecht: str | None = None,
    db: Session = Depends(get_db),
    user: Teacher = Depends(get_current_teacher),
):
    """Die Gesamtwertung — jedes Kind der Schule mit seiner Punktzahl.

    Anders als die Disziplinauswertung (Siegerehrung, drei Plaetze, laeuft am
    Beamer) ist das eine vollstaendige Leistungsliste. Die gehoert ins
    Lehrerzimmer, nicht auf den Flur: nur Lehrkraefte.
    """
    scope = NameScope(db, user)

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

    idx = class_index(db)
    result = []
    for rank, (student, total) in enumerate(rows, start=1):
        result.append(AuswertungStudent(
            rank=rank,
            name=_student_name(student, scope),
            klasse=idx.label(student),
            jahrgang=idx.grade(student),
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
    scope = NameScope(db, user) if _is_authenticated(user) else None

    disciplines = db.query(SportfestDiscipline).filter(SportfestDiscipline.enabled == True).all()

    idx = class_index(db)
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

        # Es ist eine Siegerehrung, keine Rangliste der ganzen Schule: je
        # Disziplin und Geschlecht die ersten drei. Wer weiter hinten steht,
        # erscheint gar nicht — seine Leistung geht niemanden sonst etwas an.
        platz: dict[str | None, int] = {}
        for student, res in rows:
            gruppe = student.geschlecht
            platz[gruppe] = platz.get(gruppe, 0) + 1
            if platz[gruppe] > SIEGEREHRUNG_PLAETZE:
                continue
            result.append(AuswertungDisciplineEntry(
                rank=platz[gruppe],
                name=_student_name(student, scope),
                klasse=idx.label(student),
                geschlecht=gruppe,
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
    """Punkte je Klasse — gebuendelt ueber den AK-Code, nicht ueber das Kuerzel.

    Frueher lief das als GROUP BY auf ``Student.klasse`` mit einem Textabgleich
    gegen ``Class.code``. Beides bricht am Jahrgangssprung: das Kuerzel wandert
    von »7a« auf »8a«, und wo es nicht zu einer Klasse passt, fiel die Zeile mit
    ``class_id = None`` heraus — die Klasse bekam ihre Punkte dann gar nicht.
    Jetzt bestimmt :mod:`.klassen` die Klasse je Schueler, ueber den stabilen
    Schluessel mit dem Kuerzel als zweitem Weg.
    """
    from sqlalchemy import func as f

    enabled_ids: set[str] = {
        d.id for d in db.query(SportfestDiscipline).filter(SportfestDiscipline.enabled == True).all()
    }

    rows = (
        db.query(Student, f.coalesce(f.sum(SportfestResult.points), 0).label("total"))
        .outerjoin(
            SportfestResult,
            (SportfestResult.student_id == Student.id) &
            (SportfestResult.discipline_id.in_(enabled_ids)) &
            (SportfestResult.points.isnot(None)),
        )
        .filter(Student.active == True)
        .group_by(Student.id)
        .all()
    )

    idx = class_index(db)
    # Schluessel ist die Klassen-Id; wer zu keiner Klasse findet, wird unter
    # seinem Kuerzel gesammelt und bleibt sichtbar — nur ohne Punktevergabe.
    eimer: dict[object, KlasseEntry] = {}
    for student, total in rows:
        cls = idx.of(student)
        key = cls.id if cls is not None else f"?{student.klasse or ''}"
        eintrag = eimer.get(key)
        if eintrag is None:
            eintrag = KlasseEntry(
                klasse=idx.label(student),
                jahrgang=idx.grade(student),
                class_id=cls.id if cls is not None else None,
                participant_count=0,
                raw_total=0,
            )
            eimer[key] = eintrag
        eintrag.participant_count += 1
        eintrag.raw_total += int(total)

    return [e for e in eimer.values() if e.raw_total > 0]


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
