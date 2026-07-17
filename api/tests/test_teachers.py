"""
Tests for teacher management and CSV import.
"""
import io
import pytest
from api.models import Teacher
from api.auth import hash_password


def test_only_active_teachers_are_listed(client, db, teacher_token):
    db.add(Teacher(first_name="Active", last_name="One", active=True,
                   password_hash=hash_password("pw")))
    db.add(Teacher(first_name="Inactive", last_name="Two", active=False,
                   password_hash=hash_password("pw")))
    db.flush()

    r = client.get("/api/teachers", headers={"Authorization": f"Bearer {teacher_token}"})

    names = [t["last_name"] for t in r.json()]
    assert "One" in names
    assert "Two" not in names


def test_teachers_are_sorted_alphabetically(client, db, teacher_token):
    db.add_all([
        Teacher(first_name="Z", last_name="Zett", active=True),
        Teacher(first_name="A", last_name="Amann", active=True),
        Teacher(first_name="M", last_name="Meyer", active=True),
    ])
    db.flush()

    r = client.get("/api/teachers", headers={"Authorization": f"Bearer {teacher_token}"})

    last_names = [t["last_name"] for t in r.json()]
    assert last_names == sorted(last_names)


def test_csv_import_creates_new_teachers(client, db, admin, admin_token):
    csv = b"first_name,last_name,active\nBerta,Schmidt,1\nCarl,Jung,1\n"

    r = client.post(
        "/api/teachers/import",
        files={"file": ("teachers.csv", io.BytesIO(csv), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert r.status_code == 200
    last_names = [t["last_name"] for t in r.json()]
    assert "Schmidt" in last_names
    assert "Jung" in last_names


def test_csv_import_updates_existing_teacher_active_flag(client, db, admin, admin_token):
    db.add(Teacher(first_name="Old", last_name="Teacher", active=True))
    db.flush()
    csv = b"first_name,last_name,active\nOld,Teacher,0\n"

    client.post(
        "/api/teachers/import",
        files={"file": ("teachers.csv", io.BytesIO(csv), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    updated = db.query(Teacher).filter(Teacher.last_name == "Teacher").first()
    assert updated.active is False


def test_csv_import_requires_admin_role(client, teacher_token):
    csv = b"first_name,last_name,active\nEva,Test,1\n"

    r = client.post(
        "/api/teachers/import",
        files={"file": ("teachers.csv", io.BytesIO(csv), "text/csv")},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.status_code == 403


def test_csv_import_rejects_file_with_missing_columns(client, admin, admin_token):
    csv = b"vorname,nachname\nEva,Test\n"

    r = client.post(
        "/api/teachers/import",
        files={"file": ("teachers.csv", io.BytesIO(csv), "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert r.status_code == 422


def test_teacher_can_set_their_own_password(client, teacher, teacher_token):
    r = client.post(
        f"/api/teachers/{teacher.id}/set-password",
        json={"password": "newpassword"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.status_code == 204
    # Verify new password works for login
    login = client.post("/api/auth/login",
                        json={"username": "Anna Müller", "password": "newpassword"})
    assert login.status_code == 200


def test_teacher_cannot_change_another_teachers_password(client, db, teacher_token):
    other = Teacher(first_name="Other", last_name="Person", active=True,
                    password_hash=hash_password("theirpw"))
    db.add(other)
    db.flush()

    r = client.post(
        f"/api/teachers/{other.id}/set-password",
        json={"password": "hacked"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.status_code == 403


def test_password_shorter_than_6_chars_is_rejected(client, teacher, teacher_token):
    r = client.post(
        f"/api/teachers/{teacher.id}/set-password",
        json={"password": "abc"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.status_code == 422
