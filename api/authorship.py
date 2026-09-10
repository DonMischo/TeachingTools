"""
Shared authorship helpers for the reusable-content libraries (Caputh quizzes,
Bingo sets, Exitgames, Lückentexte, Zeitstrahl sets).

Content is authored by *either* a teacher (`created_by`) *or* a student
(`created_by_student`) — never both. Student-authored rows form a shared
"student pool": every student sees and may edit them; teacher-authored rows are
hidden from students. Teachers/admins see everything.
"""
from typing import Union

from .models import Teacher, Student


def is_student(current: Union[Teacher, Student]) -> bool:
    return isinstance(current, Student)


def author_fields(current: Union[Teacher, Student]) -> dict:
    """Kwargs setting the correct author column for a newly created content row."""
    if isinstance(current, Student):
        return {"created_by_student": current.id}
    return {"created_by": current.id}


def scope_to_student_pool(query, model, current: Union[Teacher, Student]):
    """Restrict a content-library query to the shared student pool when the
    caller is a student; teachers/admins get the unfiltered query."""
    if isinstance(current, Student):
        return query.filter(model.created_by_student.isnot(None))
    return query


def can_modify(row, current: Union[Teacher, Student]) -> bool:
    """May `current` edit/delete this content row?

    - Student: only shared-pool rows (any student-authored item).
    - Teacher: own rows, plus any student-authored row (moderation).
    - Admin: anything.
    """
    if isinstance(current, Student):
        return row.created_by_student is not None
    if getattr(current, "role", None) == "admin":
        return True
    return row.created_by == current.id or row.created_by_student is not None


def author_name(row, db) -> str | None:
    """Human-readable author label for a content row (teacher or student).

    Schuelerautoren erscheinen in der Kurzform (»Anna B.«) — die Bibliothek
    sehen alle Schueler des Pools, nicht nur die eigene Klasse."""
    from .display_names import short_name

    if row.created_by_student is not None:
        s = db.get(Student, row.created_by_student)
        return short_name(s) if s else "Schüler:in"
    if row.created_by is not None:
        t = db.get(Teacher, row.created_by)
        return f"{t.first_name} {t.last_name}" if t else None
    return None
