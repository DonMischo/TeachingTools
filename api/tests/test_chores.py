"""Klassendienste: assignment, the 4-day completion rule, stats and shuffling.

A chore counts as *completed* once the same student has held it for
COMPLETION_DAYS. That is logged lazily — whenever the assignment changes
(reassign, clear, random, delete) — so the tests move `assigned_at` into the
past instead of waiting.

Who may edit is covered in test_class_edit_lock.py; here the acting teacher is
always the class's Klassenlehrer.
"""
from datetime import datetime, timezone, timedelta

import pytest

from api.auth import create_access_token
from api.models import ClassChore, ClassChoreHistory, Student
from api.routers.chores import COMPLETION_DAYS, DEFAULT_CHORE_NAMES
from api.tests.conftest import auth

PREFIX = "/api/chores"


@pytest.fixture()
def klassenlehrer(db, teacher, klass):
    teacher.klasse_id = klass.id
    db.flush()
    return teacher


@pytest.fixture()
def head(client, klassenlehrer) -> dict:
    client.cookies.clear()
    return auth(create_access_token({"sub": str(klassenlehrer.id), "type": "teacher"}))


@pytest.fixture()
def students(db, klass) -> list[Student]:
    rows = []
    for i, name in enumerate(["Ada", "Bo", "Cem", "Dana"]):
        s = Student(nachname=f"N{i}", vorname=name, klasse=klass.code,
                    class_id=klass.id, geschlecht="w", active=True)
        db.add(s)
        rows.append(s)
    db.flush()
    return rows


def _age(db, chore_id: int, days: float) -> None:
    """Backdate a chore's assignment so the completion rule can fire."""
    c = db.get(ClassChore, chore_id)
    c.assigned_at = datetime.now(timezone.utc) - timedelta(days=days)
    db.flush()


def _create(client, head, klass, name: str, student_id=None, enabled=True):
    r = client.post(PREFIX, headers=head, json={
        "class_id": klass.id, "chore_name": name,
        "student_id": student_id, "enabled": enabled,
    })
    assert r.status_code == 201, r.text
    return r.json()


# ── upsert ───────────────────────────────────────────────────────────────────

def test_create_then_update_the_same_chore_name(client, db, head, klass, students):
    created = _create(client, head, klass, "Tafeldienst", students[0].id)
    assert created["student_name"] == "Ada N0"
    assert created["enabled"] is True

    updated = _create(client, head, klass, "Tafeldienst", students[1].id, enabled=False)
    assert updated["id"] == created["id"]          # upsert, not a second row
    assert updated["student_name"] == "Bo N1"
    assert updated["enabled"] is False
    assert db.query(ClassChore).filter_by(class_id=klass.id).count() == 1


def test_listing_returns_the_classes_chores(client, head, klass, students):
    _create(client, head, klass, "Tafeldienst", students[0].id)
    _create(client, head, klass, "Fensterdienst")
    listed = client.get(f"{PREFIX}?class_id={klass.id}", headers=head).json()
    assert {c["chore_name"]: c["student_name"] for c in listed} == {
        "Tafeldienst": "Ada N0", "Fensterdienst": None,
    }


def test_all_names_merges_defaults_with_custom_ones(client, head, klass):
    _create(client, head, klass, "Kaninchendienst")
    names = client.get(f"{PREFIX}/all-names", headers=head).json()
    assert names[:len(DEFAULT_CHORE_NAMES)] == DEFAULT_CHORE_NAMES
    assert "Kaninchendienst" in names
    # A default that is also used in a class must not be listed twice.
    _create(client, head, klass, "Tafeldienst")
    assert client.get(f"{PREFIX}/all-names", headers=head).json().count("Tafeldienst") == 1


# ── the completion rule ──────────────────────────────────────────────────────

def test_reassigning_an_old_chore_logs_a_completion_and_resets_the_clock(client, db, head, klass, students):
    chore = _create(client, head, klass, "Tafeldienst", students[0].id)
    _age(db, chore["id"], COMPLETION_DAYS + 1)

    _create(client, head, klass, "Tafeldienst", students[1].id)

    hist = db.query(ClassChoreHistory).filter_by(class_id=klass.id).all()
    assert [(h.student_id, h.chore_name) for h in hist] == [(students[0].id, "Tafeldienst")]
    # The new holder starts from zero.
    row = db.get(ClassChore, chore["id"])
    assert (datetime.now(timezone.utc) - row.assigned_at.replace(tzinfo=timezone.utc)) < timedelta(minutes=1)


def test_a_short_stint_is_not_logged(client, db, head, klass, students):
    chore = _create(client, head, klass, "Tafeldienst", students[0].id)
    _age(db, chore["id"], COMPLETION_DAYS - 1)
    _create(client, head, klass, "Tafeldienst", students[1].id)
    assert db.query(ClassChoreHistory).count() == 0


def test_reassigning_to_the_same_student_keeps_the_clock_running(client, db, head, klass, students):
    chore = _create(client, head, klass, "Tafeldienst", students[0].id)
    _age(db, chore["id"], COMPLETION_DAYS + 1)
    old = db.get(ClassChore, chore["id"]).assigned_at

    _create(client, head, klass, "Tafeldienst", students[0].id, enabled=True)

    assert db.query(ClassChoreHistory).count() == 0
    assert db.get(ClassChore, chore["id"]).assigned_at == old


def test_stats_count_history_plus_qualifying_current_assignments(client, db, head, klass, students):
    long_held = _create(client, head, klass, "Tafeldienst", students[0].id)
    _age(db, long_held["id"], COMPLETION_DAYS + 2)
    fresh = _create(client, head, klass, "Fensterdienst", students[0].id)
    _age(db, fresh["id"], 1)
    db.add(ClassChoreHistory(
        class_id=klass.id, chore_name="Tafeldienst", student_id=students[0].id,
        assigned_at=datetime.now(timezone.utc) - timedelta(days=30),
        completed_at=datetime.now(timezone.utc) - timedelta(days=26),
    ))
    db.flush()

    stats = client.get(f"{PREFIX}/stats?class_id={klass.id}", headers=head).json()
    # One logged completion + the still-running qualifying one.
    assert stats[str(students[0].id)] == {"Tafeldienst": 2}


def test_stats_ignore_disabled_chores(client, db, head, klass, students):
    chore = _create(client, head, klass, "Tafeldienst", students[0].id, enabled=False)
    _age(db, chore["id"], COMPLETION_DAYS + 5)
    assert client.get(f"{PREFIX}/stats?class_id={klass.id}", headers=head).json() == {}


# ── clear / random / delete ──────────────────────────────────────────────────

def test_clear_unassigns_enabled_chores_and_logs_the_qualifying_ones(client, db, head, klass, students):
    long_held = _create(client, head, klass, "Tafeldienst", students[0].id)
    _age(db, long_held["id"], COMPLETION_DAYS + 1)
    short = _create(client, head, klass, "Fensterdienst", students[1].id)
    _age(db, short["id"], 1)
    disabled = _create(client, head, klass, "Pflanzendienst", students[2].id, enabled=False)

    assert client.post(f"{PREFIX}/clear?class_id={klass.id}", headers=head).status_code == 204

    assert db.get(ClassChore, long_held["id"]).student_id is None
    assert db.get(ClassChore, short["id"]).student_id is None
    assert db.get(ClassChore, disabled["id"]).student_id == students[2].id   # untouched
    assert [h.student_id for h in db.query(ClassChoreHistory).all()] == [students[0].id]


def test_random_assign_fills_every_enabled_chore_without_repeats(client, db, head, klass, students):
    for name in ["Tafeldienst", "Fensterdienst", "Pflanzendienst"]:
        _create(client, head, klass, name)
    disabled = _create(client, head, klass, "Computerdienst", enabled=False)

    result = client.post(f"{PREFIX}/random?class_id={klass.id}", headers=head).json()
    assigned = [c["student_id"] for c in result]
    assert len(result) == 3
    assert all(sid is not None for sid in assigned)
    assert len(set(assigned)) == 3                      # 4 students, 3 chores
    assert db.get(ClassChore, disabled["id"]).student_id is None


def test_random_assign_without_chores_or_students(client, db, head, klass, students, klassenlehrer):
    assert client.post(f"{PREFIX}/random?class_id={klass.id}", headers=head).json() == []

    _create(client, head, klass, "Tafeldienst")
    for s in students:
        s.active = False
    db.flush()
    result = client.post(f"{PREFIX}/random?class_id={klass.id}", headers=head).json()
    assert [c["student_id"] for c in result] == [None]


def test_delete_logs_a_qualifying_assignment_and_removes_the_chore(client, db, head, klass, students):
    chore = _create(client, head, klass, "Tafeldienst", students[0].id)
    _age(db, chore["id"], COMPLETION_DAYS + 1)

    assert client.delete(f"{PREFIX}/{chore['id']}", headers=head).status_code == 204
    assert db.get(ClassChore, chore["id"]) is None
    assert db.query(ClassChoreHistory).count() == 1

    assert client.delete(f"{PREFIX}/9999", headers=head).status_code == 404
