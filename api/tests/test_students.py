"""Tests for student import, credential generation, and auth."""
import io
import pytest
from fastapi.testclient import TestClient

from api.models import Student, Class, SportfestDiscipline
from api.auth import hash_password
from api.pokemon import pokemon_password, POKEMON_DE

# ---------------------------------------------------------------------------
# Pokémon password algorithm
# ---------------------------------------------------------------------------

def test_pokemon_password_format():
    pw = pokemon_password(4)  # Glumanda
    assert pw.startswith("004")
    assert pw.endswith("#!")
    # 'a' at end of Glumanda → '4'
    assert "Glumand4" in pw


def test_pokemon_password_leet_substitution():
    # All names: last substitutable char gets replaced
    for num in range(1, len(POKEMON_DE)):
        pw = pokemon_password(num)
        assert pw.startswith(f"{num:03d}")
        assert pw.endswith("#!")
        # At least 10 chars total
        assert len(pw) >= 8


def test_pokemon_password_deterministic():
    assert pokemon_password(25) == pokemon_password(25)
    assert pokemon_password(1) == pokemon_password(1)


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------

VALID_CSV = """#,Nachname,Vorname,Klasse,Geschlecht,Geburtsdatum
1,Müller,Max,5a,männlich,15.03.2013
2,Fischer,Emma,5a,weiblich,22.07.2013
3,Bauer,Jonas,6b,m,2012-04-10
"""

INVALID_GENDER_CSV = """#,Nachname,Vorname,Klasse,Geschlecht,Geburtsdatum
1,Test,Person,5a,unknown,01.01.2013
"""

MISSING_FIELDS_CSV = """#,Nachname,Vorname,Klasse,Geschlecht
1,,Max,5a,männlich
"""


@pytest.fixture()
def klass_5a(db) -> Class:
    c = Class(code="5a", display_name="Klasse 5a")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def klass_6b(db) -> Class:
    c = Class(code="6b", display_name="Klasse 6b")
    db.add(c)
    db.flush()
    return c


def _csv_file(content: str):
    return ("file", ("students.csv", io.BytesIO(content.encode("utf-8")), "text/csv"))


def test_import_students_requires_admin(client, teacher_token, klass_5a):
    r = client.post(
        "/api/students/import",
        files=[_csv_file(VALID_CSV)],
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 403


def test_import_students_success(client, admin_token, klass_5a, klass_6b, db):
    r = client.post(
        "/api/students/import",
        files=[_csv_file(VALID_CSV)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["imported"] == 3
    assert "errors" not in body

    students = db.query(Student).all()
    assert len(students) == 3
    nachnamen = {s.nachname for s in students}
    assert "Müller" in nachnamen
    assert "Fischer" in nachnamen


def test_import_sets_class_id(client, admin_token, klass_5a, db):
    csv = "#,Nachname,Vorname,Klasse,Geschlecht\n1,Test,Person,5a,männlich\n"
    client.post(
        "/api/students/import",
        files=[_csv_file(csv)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    student = db.query(Student).first()
    assert student.class_id == klass_5a.id
    assert student.jahrgang == 5


def test_import_parses_birthday(client, admin_token, klass_5a, db):
    csv = "#,Nachname,Vorname,Klasse,Geschlecht,Geburtsdatum\n1,Test,A,5a,männlich,15.03.2013\n"
    client.post(
        "/api/students/import",
        files=[_csv_file(csv)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    s = db.query(Student).first()
    assert s.geburtsdatum is not None
    assert s.geburtsdatum.year == 2013
    assert s.geburtsdatum.month == 3
    assert s.geburtsdatum.day == 15


def test_import_replaces_all(client, admin_token, klass_5a, db):
    # First import
    client.post(
        "/api/students/import",
        files=[_csv_file(VALID_CSV)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert db.query(Student).count() == 3

    # Second import (smaller list)
    csv2 = "#,Nachname,Vorname,Klasse,Geschlecht\n1,Neu,Mensch,5a,weiblich\n"
    client.post(
        "/api/students/import",
        files=[_csv_file(csv2)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert db.query(Student).count() == 1


def test_import_partial_errors(client, admin_token, klass_5a, db):
    r = client.post(
        "/api/students/import",
        files=[_csv_file(INVALID_GENDER_CSV)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["imported"] == 0
    assert len(body["errors"]) > 0


# ---------------------------------------------------------------------------
# Credential generation
# ---------------------------------------------------------------------------

def _seed_student(db, nachname, vorname, klasse, geschlecht="männlich") -> Student:
    s = Student(nachname=nachname, vorname=vorname, klasse=klasse, geschlecht=geschlecht)
    db.add(s)
    db.flush()
    return s


def test_generate_credentials_requires_admin(client, teacher_token):
    r = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 403


def test_generate_credentials_creates_usernames(client, admin_token, db):
    _seed_student(db, "Müller", "Max", "5a")
    _seed_student(db, "Fischer", "Emma", "5a", "weiblich")

    r = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 2

    for row in rows:
        assert row["username"]
        assert row["password"]
        pw = row["password"]
        # Must be 3-digit prefix + name + #!
        assert pw.endswith("#!")
        assert pw[:3].isdigit()

    # Usernames must be unique
    usernames = [row["username"] for row in rows]
    assert len(set(usernames)) == len(usernames)


def test_generate_credentials_idempotent(client, admin_token, db):
    _seed_student(db, "Test", "Person", "7b")
    r1 = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    first = r1.json()[0]

    # Second call should return same credentials (deterministic)
    r2 = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    second = r2.json()[0]

    assert first["username"] == second["username"]
    assert first["password"] == second["password"]


# ---------------------------------------------------------------------------
# Student login
# ---------------------------------------------------------------------------

def test_student_can_login(client, admin_token, db):
    # Create + generate credentials
    _seed_student(db, "Login", "Test", "5a")
    r = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    cred = r.json()[0]

    r2 = client.post("/api/auth/login", json={"username": cred["username"], "password": cred["password"]})
    assert r2.status_code == 200
    body = r2.json()
    assert body["access_token"]
    assert body["teacher"]["role"] == "student"


def test_student_cannot_award_points(client, admin_token, db, klass):
    _seed_student(db, "NoPoints", "Student", "5a")
    r = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    cred = r.json()[0]
    r2 = client.post("/api/auth/login", json={"username": cred["username"], "password": cred["password"]})
    student_token = r2.json()["access_token"]

    r3 = client.post(
        "/api/transactions",
        json={"teacher_id": 1, "class_id": klass.id, "points": 5, "reason": ""},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert r3.status_code in (403, 401)


# ---------------------------------------------------------------------------
# List students
# ---------------------------------------------------------------------------

def test_list_students_requires_teacher(client):
    r = client.get("/api/students")
    assert r.status_code == 401


def test_list_students_filterable(client, teacher_token, db, klass_5a):
    _seed_student(db, "A", "X", "5a")
    _seed_student(db, "B", "Y", "6b")
    r = client.get(
        "/api/students?klasse=5a",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["nachname"] == "A"
