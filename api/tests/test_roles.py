"""Klassenaemter: the per-class role-type list and role assignment.

A class starts on DEFAULT_CLASS_ROLES (Class.role_types stays NULL) until its
Klassenlehrer curates the list; from then on the stored list is authoritative
and assignments of dropped types are removed with it.

The 403 side of the edit lock lives in test_class_edit_lock.py.
"""
import pytest

from api.auth import create_access_token
from api.models import Student, StudentRole
from api.routers.roles import DEFAULT_CLASS_ROLES
from api.tests.conftest import auth

PREFIX = "/api/roles"


@pytest.fixture()
def head(client, db, teacher, klass) -> dict:
    teacher.klasse_id = klass.id
    db.flush()
    client.cookies.clear()
    return auth(create_access_token({"sub": str(teacher.id), "type": "teacher"}))


@pytest.fixture()
def students(db, klass) -> list[Student]:
    rows = []
    for i, name in enumerate(["Ada", "Bo", "Cem"]):
        s = Student(nachname=f"N{i}", vorname=name, klasse=klass.code,
                    class_id=klass.id, geschlecht="w", active=True)
        db.add(s)
        rows.append(s)
    db.flush()
    return rows


def _assign(client, head, student, role_type, scope_id):
    return client.post(PREFIX, headers=head, json={
        "student_id": student.id, "role_type": role_type, "scope_id": scope_id,
    })


# ── role types ───────────────────────────────────────────────────────────────

def test_types_start_at_the_defaults(client, head, klass):
    assert client.get(f"{PREFIX}/types?class_id={klass.id}", headers=head).json() == DEFAULT_CLASS_ROLES


def test_types_include_extra_assigned_ones_while_uncurated(client, db, head, klass, students):
    db.add(StudentRole(student_id=students[0].id, role_type="Kummerkasten", scope_id=klass.id))
    # A default under a different casing must not show up twice.
    db.add(StudentRole(student_id=students[1].id, role_type="klassensprecher", scope_id=klass.id))
    db.flush()
    types = client.get(f"{PREFIX}/types?class_id={klass.id}", headers=head).json()
    assert types == DEFAULT_CLASS_ROLES + ["Kummerkasten"]


def test_types_404_for_an_unknown_class(client, head):
    assert client.get(f"{PREFIX}/types?class_id=9999", headers=head).status_code == 404


def test_setting_types_trims_dedupes_and_keeps_order(client, head, klass):
    r = client.put(f"{PREFIX}/types", headers=head, json={
        "class_id": klass.id,
        "role_types": ["  Klassensprecher ", "Blumendienst", "klassensprecher", "", "   "],
    })
    assert r.status_code == 200
    assert r.json() == ["Klassensprecher", "Blumendienst"]
    assert client.get(f"{PREFIX}/types?class_id={klass.id}", headers=head).json() == ["Klassensprecher", "Blumendienst"]


def test_setting_types_drops_assignments_of_removed_types(client, db, head, klass, students):
    _assign(client, head, students[0], "Klassensprecher", klass.id)
    _assign(client, head, students[1], "Schuelersprecher", klass.id)

    client.put(f"{PREFIX}/types", headers=head,
               json={"class_id": klass.id, "role_types": ["Klassensprecher"]})

    remaining = [r.role_type for r in db.query(StudentRole).filter_by(scope_id=klass.id).all()]
    assert remaining == ["Klassensprecher"]


def test_setting_types_404_for_an_unknown_class(client, head, admin, db):
    admin.klasse_id = None
    db.flush()
    admin_head = auth(create_access_token({"sub": str(admin.id), "type": "teacher"}))
    r = client.put(f"{PREFIX}/types", headers=admin_head,
                   json={"class_id": 9999, "role_types": ["X"]})
    assert r.status_code == 404


# ── assignment ───────────────────────────────────────────────────────────────

def test_assign_returns_the_students_name(client, head, klass, students):
    r = _assign(client, head, students[0], "Klassensprecher", klass.id)
    assert r.status_code == 201
    body = r.json()
    assert body["student_name"] == "Ada N0"
    assert body["role_type"] == "Klassensprecher"
    assert body["scope_id"] == klass.id


def test_a_role_is_unique_per_type_and_scope(client, db, head, klass, students):
    _assign(client, head, students[0], "Klassensprecher", klass.id)
    _assign(client, head, students[1], "Klassensprecher", klass.id)

    rows = db.query(StudentRole).filter_by(role_type="Klassensprecher", scope_id=klass.id).all()
    assert [r.student_id for r in rows] == [students[1].id]


def test_assigning_an_unlisted_type_extends_a_curated_list(client, db, head, klass, students):
    client.put(f"{PREFIX}/types", headers=head,
               json={"class_id": klass.id, "role_types": ["Klassensprecher"]})

    _assign(client, head, students[0], "Blumendienst", klass.id)
    assert client.get(f"{PREFIX}/types?class_id={klass.id}", headers=head).json() == [
        "Klassensprecher", "Blumendienst",
    ]
    # A type that only differs in case is not appended again.
    _assign(client, head, students[1], "klassensprecher", klass.id)
    assert client.get(f"{PREFIX}/types?class_id={klass.id}", headers=head).json() == [
        "Klassensprecher", "Blumendienst",
    ]


def test_assign_404_for_an_unknown_student(client, head, klass):
    r = client.post(PREFIX, headers=head, json={
        "student_id": 9999, "role_type": "Klassensprecher", "scope_id": klass.id,
    })
    assert r.status_code == 404


def test_list_roles_filters_by_type_and_scope(client, head, klass, students, db):
    _assign(client, head, students[0], "Klassensprecher", klass.id)
    _assign(client, head, students[1], "Schuelersprecher", klass.id)

    assert len(client.get(PREFIX, headers=head).json()) == 2
    by_type = client.get(f"{PREFIX}?role_type=Klassensprecher", headers=head).json()
    assert [r["student_id"] for r in by_type] == [students[0].id]
    assert len(client.get(f"{PREFIX}?scope_id={klass.id}", headers=head).json()) == 2
    assert client.get(f"{PREFIX}?scope_id=9999", headers=head).json() == []


def test_remove_role(client, db, head, klass, students):
    role = _assign(client, head, students[0], "Klassensprecher", klass.id).json()
    assert client.delete(f"{PREFIX}/{role['id']}", headers=head).status_code == 204
    assert db.get(StudentRole, role["id"]) is None
    assert client.delete(f"{PREFIX}/{role['id']}", headers=head).status_code == 404
