"""Authorship rules for the reusable content libraries.

Every content library (Caputh quizzes, Bingo sets, TaskCrawler, Lückentexte,
Zeitstrahl) shares these helpers, so one wrong branch would open teacher-only
material to students — or hand a student edit rights on someone else's quiz —
in five features at once.
"""
import pytest

from api.authorship import (
    author_fields, author_name, can_modify, is_student, scope_to_student_pool,
)
from api.auth import hash_password
from api.models import BingoSet, Student, Teacher


@pytest.fixture()
def student(db, klass) -> Student:
    s = Student(nachname="Schueler", vorname="Sam", klasse=klass.code, class_id=klass.id,
                geschlecht="männlich", active=True)
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def student2(db, klass) -> Student:
    s = Student(nachname="Zweit", vorname="Zoe", klasse=klass.code, class_id=klass.id,
                geschlecht="weiblich", active=True)
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Schmidt", active=True,
                password_hash=hash_password("s2"), role="teacher")
    db.add(t)
    db.flush()
    return t


def _set(db, *, teacher_id=None, student_id=None) -> BingoSet:
    row = BingoSet(title="Vokabeln", created_by=teacher_id, created_by_student=student_id)
    db.add(row)
    db.flush()
    return row


# ── author stamping ──────────────────────────────────────────────────────────

def test_is_student_separates_the_two_identities(teacher, student, admin):
    assert is_student(student) is True
    assert is_student(teacher) is False
    assert is_student(admin) is False


def test_author_fields_fill_exactly_one_column(teacher, student):
    assert author_fields(teacher) == {"created_by": teacher.id}
    assert author_fields(student) == {"created_by_student": student.id}


def test_a_row_is_never_stamped_with_both_authors(db, teacher, student):
    for current in (teacher, student):
        row = BingoSet(title="X", **author_fields(current))
        db.add(row)
        db.flush()
        assert (row.created_by is None) != (row.created_by_student is None)


# ── visibility ───────────────────────────────────────────────────────────────

def test_students_only_see_the_shared_student_pool(db, teacher, student, student2):
    mine = _set(db, student_id=student.id)
    classmates = _set(db, student_id=student2.id)
    teachers = _set(db, teacher_id=teacher.id)

    q = db.query(BingoSet)
    visible = {r.id for r in scope_to_student_pool(q, BingoSet, student).all()}
    assert visible == {mine.id, classmates.id}
    assert teachers.id not in visible


def test_teachers_and_admins_see_everything(db, teacher, admin, student):
    a = _set(db, student_id=student.id)
    b = _set(db, teacher_id=teacher.id)

    q = db.query(BingoSet)
    for current in (teacher, admin):
        assert {r.id for r in scope_to_student_pool(q, BingoSet, current).all()} == {a.id, b.id}


# ── edit rights ──────────────────────────────────────────────────────────────

def test_a_student_may_edit_any_student_authored_row(db, student, student2):
    assert can_modify(_set(db, student_id=student.id), student) is True
    # The pool is shared — a classmate's row is editable too.
    assert can_modify(_set(db, student_id=student2.id), student) is True


def test_a_student_may_never_edit_teacher_material(db, teacher, student):
    assert can_modify(_set(db, teacher_id=teacher.id), student) is False


def test_a_teacher_may_edit_own_rows_and_moderate_student_ones(db, teacher, teacher2, student):
    assert can_modify(_set(db, teacher_id=teacher.id), teacher) is True
    assert can_modify(_set(db, student_id=student.id), teacher) is True
    # ... but not a colleague's material.
    assert can_modify(_set(db, teacher_id=teacher2.id), teacher) is False


def test_an_admin_may_edit_anything(db, teacher, admin, student):
    assert can_modify(_set(db, teacher_id=teacher.id), admin) is True
    assert can_modify(_set(db, student_id=student.id), admin) is True


# ── author label ─────────────────────────────────────────────────────────────

def test_author_name_renders_the_right_identity(db, teacher, student):
    # Lehrkraefte stehen ausgeschrieben in der Bibliothek, Schueler in der
    # Kurzform — den Pool sehen alle Schueler, nicht nur die eigene Klasse.
    assert author_name(_set(db, teacher_id=teacher.id), db) == "Anna Müller"
    assert author_name(_set(db, student_id=student.id), db) == "Sam S."


def test_author_name_survives_a_deleted_author(db, teacher, student):
    orphan_student = _set(db, student_id=student.id)
    orphan_teacher = _set(db, teacher_id=teacher.id)
    db.delete(student)
    db.delete(teacher)
    db.flush()

    assert author_name(orphan_student, db) == "Schüler:in"
    assert author_name(orphan_teacher, db) is None


def test_author_name_of_an_unowned_row(db):
    assert author_name(_set(db), db) is None
