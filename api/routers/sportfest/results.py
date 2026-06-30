from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import SportfestResult, Student, SportfestDiscipline
from ...schemas import SportfestResultUpsert, SportfestResultOut
from ...auth import get_current_teacher
from .scoring import calculate_points, parse_value

router = APIRouter(prefix="/api/sportfest/results", tags=["sportfest"])


@router.get("", response_model=list[SportfestResultOut])
def list_results(
    klasse: str | None = None,
    jahrgang: int | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_teacher),
):
    q = db.query(SportfestResult).join(Student)
    if klasse:
        q = q.filter(Student.klasse == klasse)
    if jahrgang is not None:
        q = q.filter(Student.jahrgang == jahrgang)
    return q.all()


@router.put("/{student_id}/{discipline_id}", response_model=SportfestResultOut)
def upsert_result(
    student_id: int,
    discipline_id: str,
    body: SportfestResultUpsert,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_teacher),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    disc = db.get(SportfestDiscipline, discipline_id)
    if not disc:
        raise HTTPException(404, "Discipline not found")

    value = parse_value(body.value_raw)
    if value is None:
        raise HTTPException(422, f"Ungültiger Wert: {body.value_raw!r}")

    points = calculate_points(discipline_id, value, student.klasse, student.geschlecht)

    result = db.query(SportfestResult).filter(
        SportfestResult.student_id == student_id,
        SportfestResult.discipline_id == discipline_id,
    ).first()

    if result:
        result.value = value
        result.points = points
    else:
        result = SportfestResult(
            student_id=student_id,
            discipline_id=discipline_id,
            value=value,
            points=points,
        )
        db.add(result)

    db.commit()
    db.refresh(result)
    return result


@router.delete("/{student_id}/{discipline_id}", status_code=204)
def delete_result(
    student_id: int,
    discipline_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_teacher),
):
    result = db.query(SportfestResult).filter(
        SportfestResult.student_id == student_id,
        SportfestResult.discipline_id == discipline_id,
    ).first()
    if result:
        db.delete(result)
        db.commit()
