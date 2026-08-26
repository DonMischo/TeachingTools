"""Checklisten (Materialgeld, Einverstaendnis ...) over a class or a Kurs/WPF.

A tracker is scoped to exactly one of class_id / group_id. Class trackers stay
locked to the Klassenlehrer; a Kurs/WPF has no owning class, so any teacher may
manage its trackers.
"""
import pytest

from api.auth import create_access_token
from api.models import ClassTracker, ClassTrackerCheck, Student, StudentGroup, Teacher
from api.auth import hash_password
from api.tests.conftest import auth

PREFIX = "/api/trackers"


def _head(t: Teacher) -> dict:
    return auth(create_access_token({"sub": str(t.id), "type": "teacher"}))


@pytest.fixture()
def head(client, db, teacher, klass) -> dict:
    teacher.klasse_id = klass.id
    db.flush()
    client.cookies.clear()
    return _head(teacher)


@pytest.fixture()
def other_teacher(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Schmidt", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def students(db, klass) -> list[Student]:
    rows = []
    for i, name in enumerate(["Ada", "Bo"]):
        s = Student(nachname=f"N{i}", vorname=name, klasse=klass.code,
                    class_id=klass.id, geschlecht="w", active=True)
        db.add(s)
        rows.append(s)
    db.flush()
    return rows


@pytest.fixture()
def group(db) -> StudentGroup:
    g = StudentGroup(name="Kurs I", group_type="kurs")
    db.add(g)
    db.flush()
    return g


# ── scope validation ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("body", [
    {"name": "Materialgeld"},                                  # no scope
    {"name": "Materialgeld", "class_id": 1, "group_id": 1},    # both scopes
])
def test_create_requires_exactly_one_scope(client, head, body):
    assert client.post(PREFIX, headers=head, json=body).status_code == 422


@pytest.mark.parametrize("query", ["", "?class_id=1&group_id=1"])
def test_list_requires_exactly_one_scope(client, head, query):
    assert client.get(f"{PREFIX}{query}", headers=head).status_code == 400


def test_create_404_for_an_unknown_group(client, head):
    r = client.post(PREFIX, headers=head, json={"name": "Materialgeld", "group_id": 9999})
    assert r.status_code == 404


# ── class trackers ───────────────────────────────────────────────────────────

def test_class_tracker_lifecycle(client, db, head, klass, students):
    created = client.post(PREFIX, headers=head, json={"name": "Materialgeld", "class_id": klass.id})
    assert created.status_code == 201
    tid = created.json()["id"]
    assert created.json() == {"id": tid, "class_id": klass.id, "group_id": None,
                              "name": "Materialgeld", "checked_student_ids": []}

    listed = client.get(f"{PREFIX}?class_id={klass.id}", headers=head).json()
    assert [t["id"] for t in listed] == [tid]

    assert client.delete(f"{PREFIX}/{tid}", headers=head).status_code == 204
    assert db.get(ClassTracker, tid) is None
    assert client.delete(f"{PREFIX}/{tid}", headers=head).status_code == 404


def test_toggle_checks_and_unchecks_a_student(client, db, head, klass, students):
    tid = client.post(PREFIX, headers=head,
                      json={"name": "Materialgeld", "class_id": klass.id}).json()["id"]

    on = client.post(f"{PREFIX}/{tid}/toggle?student_id={students[0].id}", headers=head)
    assert on.status_code == 200
    assert on.json()["checked_student_ids"] == [students[0].id]

    client.post(f"{PREFIX}/{tid}/toggle?student_id={students[1].id}", headers=head)
    off = client.post(f"{PREFIX}/{tid}/toggle?student_id={students[0].id}", headers=head)
    assert off.json()["checked_student_ids"] == [students[1].id]
    assert db.query(ClassTrackerCheck).filter_by(tracker_id=tid).count() == 1


def test_toggle_404_for_an_unknown_tracker(client, head, students):
    assert client.post(f"{PREFIX}/9999/toggle?student_id={students[0].id}",
                       headers=head).status_code == 404


def test_deleting_a_tracker_takes_its_checks_with_it(client, db, head, klass, students):
    tid = client.post(PREFIX, headers=head,
                      json={"name": "Materialgeld", "class_id": klass.id}).json()["id"]
    client.post(f"{PREFIX}/{tid}/toggle?student_id={students[0].id}", headers=head)

    client.delete(f"{PREFIX}/{tid}", headers=head)
    assert db.query(ClassTrackerCheck).filter_by(tracker_id=tid).count() == 0


def test_a_foreign_teacher_may_not_edit_a_class_tracker(client, db, head, klass, students, other_teacher):
    tid = client.post(PREFIX, headers=head,
                      json={"name": "Materialgeld", "class_id": klass.id}).json()["id"]
    foreign = _head(other_teacher)

    # Reading stays open to every teacher ...
    assert client.get(f"{PREFIX}?class_id={klass.id}", headers=foreign).status_code == 200
    # ... editing does not.
    assert client.post(f"{PREFIX}/{tid}/toggle?student_id={students[0].id}",
                       headers=foreign).status_code == 403
    assert client.delete(f"{PREFIX}/{tid}", headers=foreign).status_code == 403


# ── group trackers ───────────────────────────────────────────────────────────

def test_any_teacher_may_manage_a_group_tracker(client, db, head, group, students, other_teacher):
    created = client.post(PREFIX, headers=head, json={"name": "Mappe", "group_id": group.id})
    assert created.status_code == 201
    tid = created.json()["id"]
    assert created.json()["class_id"] is None

    foreign = _head(other_teacher)
    toggled = client.post(f"{PREFIX}/{tid}/toggle?student_id={students[0].id}", headers=foreign)
    assert toggled.status_code == 200
    assert toggled.json()["checked_student_ids"] == [students[0].id]
    assert client.delete(f"{PREFIX}/{tid}", headers=foreign).status_code == 204


def test_class_and_group_trackers_do_not_leak_into_each_others_lists(client, head, klass, group):
    client.post(PREFIX, headers=head, json={"name": "Materialgeld", "class_id": klass.id})
    client.post(PREFIX, headers=head, json={"name": "Mappe", "group_id": group.id})

    by_class = client.get(f"{PREFIX}?class_id={klass.id}", headers=head).json()
    by_group = client.get(f"{PREFIX}?group_id={group.id}", headers=head).json()
    assert [t["name"] for t in by_class] == ["Materialgeld"]
    assert [t["name"] for t in by_group] == ["Mappe"]
