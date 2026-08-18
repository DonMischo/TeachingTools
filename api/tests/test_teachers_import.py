"""
Tests for the Lehrerdaten CSV preview/apply import (number, name, email,
Klasse, role) — mirrors the Schülerdaten import in test_students.py.
"""
import io
import pytest
from api.models import Teacher, TeacherRole


@pytest.fixture()
def teacher_roles(db):
    lehrer = TeacherRole(name="Lehrer", counts_as_teacher=True)
    spf = TeacherRole(name="SPF", counts_as_teacher=False)
    db.add_all([lehrer, spf])
    db.flush()
    return {"Lehrer": lehrer, "SPF": spf}


def _csv(rows: str) -> io.BytesIO:
    return io.BytesIO(rows.encode("utf-8"))


def test_preview_marks_new_teachers(client, db, admin, admin_token, teacher_roles, klass):
    csv = _csv("#;Nachname;Vorname;E-Mail;Klasse;Rolle\n101;Müller;Anna;a@x.de;5a;Lehrer\n")
    r = client.post("/api/teachers/preview", files={"file": ("t.csv", csv, "text/csv")},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["new"] == 1
    assert body["diff"][0]["csv_data"]["klasse"] == "5a"


def test_apply_creates_klassenlehrer_team_of_two(client, db, admin, admin_token, teacher_roles, klass):
    csv = _csv(
        "#;Nachname;Vorname;E-Mail;Klasse;Rolle\n"
        "101;Müller;Anna;a@x.de;5a;Lehrer\n"
        "102;Krause;Ben;b@x.de;5a;SPF\n"
    )
    preview = client.post("/api/teachers/preview", files={"file": ("t.csv", csv, "text/csv")},
                           headers={"Authorization": f"Bearer {admin_token}"}).json()
    keys = [row["key"] for row in preview["diff"]]
    csv_data = {row["key"]: row["csv_data"] for row in preview["diff"]}

    r = client.post("/api/teachers/apply",
                     json={"selected_keys": keys, "csv_data": csv_data},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["applied"] == 2

    mueller = db.query(Teacher).filter_by(last_name="Müller").first()
    krause = db.query(Teacher).filter_by(last_name="Krause").first()
    assert mueller.klasse_id == klass.id
    assert krause.klasse_id == klass.id
    assert mueller.teacher_role.name == "Lehrer"
    assert krause.teacher_role.name == "SPF"


def test_apply_defaults_blank_role_to_lehrer(client, db, admin, admin_token, teacher_roles):
    csv = _csv("#;Nachname;Vorname;E-Mail;Klasse;Rolle\n106;Hoffmann;Felix;f@x.de;;\n")
    preview = client.post("/api/teachers/preview", files={"file": ("t.csv", csv, "text/csv")},
                           headers={"Authorization": f"Bearer {admin_token}"}).json()
    keys = [row["key"] for row in preview["diff"]]
    csv_data = {row["key"]: row["csv_data"] for row in preview["diff"]}
    client.post("/api/teachers/apply", json={"selected_keys": keys, "csv_data": csv_data},
                headers={"Authorization": f"Bearer {admin_token}"})

    teacher = db.query(Teacher).filter_by(last_name="Hoffmann").first()
    assert teacher.teacher_role.name == "Lehrer"
    assert teacher.klasse_id is None


def test_apply_reports_unknown_class_and_role(client, db, admin, admin_token, teacher_roles):
    csv = _csv("#;Nachname;Vorname;E-Mail;Klasse;Rolle\n108;Schwarz;Hans;h@x.de;13z;Hausmeister\n")
    preview = client.post("/api/teachers/preview", files={"file": ("t.csv", csv, "text/csv")},
                           headers={"Authorization": f"Bearer {admin_token}"}).json()
    keys = [row["key"] for row in preview["diff"]]
    csv_data = {row["key"]: row["csv_data"] for row in preview["diff"]}
    r = client.post("/api/teachers/apply", json={"selected_keys": keys, "csv_data": csv_data},
                     headers={"Authorization": f"Bearer {admin_token}"})

    body = r.json()
    assert body["applied"] == 1
    assert any("13z" in e for e in body["errors"])
    assert any("Hausmeister" in e for e in body["errors"])
    teacher = db.query(Teacher).filter_by(last_name="Schwarz").first()
    assert teacher.klasse_id is None
    assert teacher.teacher_role.name == "Lehrer"  # fell back to default


def test_apply_matches_existing_teacher_by_nummer(client, db, admin, admin_token, teacher_roles):
    existing = Teacher(first_name="Anna", last_name="Müller", active=True, nummer=101)
    db.add(existing)
    db.flush()

    csv = _csv("#;Nachname;Vorname;E-Mail;Klasse;Rolle\n101;Müller;Anna;new@x.de;;Lehrer\n")
    preview = client.post("/api/teachers/preview", files={"file": ("t.csv", csv, "text/csv")},
                           headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert preview["diff"][0]["action"] == "update"

    keys = [row["key"] for row in preview["diff"]]
    csv_data = {row["key"]: row["csv_data"] for row in preview["diff"]}
    client.post("/api/teachers/apply", json={"selected_keys": keys, "csv_data": csv_data},
                headers={"Authorization": f"Bearer {admin_token}"})

    assert db.query(Teacher).filter_by(nummer=101).count() == 1
    assert db.get(Teacher, existing.id).email == "new@x.de"


def test_preview_requires_admin(client, teacher_token):
    csv = _csv("#;Nachname;Vorname;E-Mail;Klasse;Rolle\n101;Müller;Anna;a@x.de;;Lehrer\n")
    r = client.post("/api/teachers/preview", files={"file": ("t.csv", csv, "text/csv")},
                     headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 403


def test_set_teacher_username(client, db, admin, admin_token):
    t = Teacher(first_name="Bea", last_name="Klein", active=True, role="teacher")
    db.add(t)
    db.flush()
    r = client.patch(f"/api/teachers/{t.id}/username", json={"username": "b.klein"},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "b.klein"
    db.refresh(t)
    assert t.username == "b.klein"


def test_set_teacher_username_rejects_duplicate(client, db, admin, admin_token):
    a = Teacher(first_name="A", last_name="A", active=True, role="teacher", username="taken")
    b = Teacher(first_name="B", last_name="B", active=True, role="teacher")
    db.add_all([a, b])
    db.flush()
    r = client.patch(f"/api/teachers/{b.id}/username", json={"username": "taken"},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 409
