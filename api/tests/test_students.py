"""Tests for student import, credential generation, and auth."""
import io
import pytest
from fastapi.testclient import TestClient

from api.models import Student, Class, SportfestDiscipline
from api.auth import hash_password
from api.password_gen import generate_password

# ---------------------------------------------------------------------------
# Password algorithm
# ---------------------------------------------------------------------------

def test_password_format():
    pw = generate_password(4)
    assert isinstance(pw, str)
    assert len(pw) >= 8


def test_password_deterministic():
    assert generate_password(25) == generate_password(25)
    assert generate_password(1) == generate_password(1)
    assert generate_password(1) != generate_password(2)


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
        assert len(row["password"]) >= 8

    # Usernames must be unique
    usernames = [row["username"] for row in rows]
    assert len(set(usernames)) == len(usernames)


def test_generate_credentials_heals_drifted_password(client, admin_token, db):
    """If a student's stored hash no longer matches the seed-derived plaintext
    (credentials from an older generator implementation), the endpoint must
    re-issue the password — otherwise it displays a password that can't log in."""
    from api.auth import hash_password, verify_password
    from api.password_gen import generate_password

    s = _seed_student(db, "Alt", "Anna", "6a", "weiblich")
    s.username = "a.alt"
    s.password_seed = 4711
    s.password_hash = hash_password("VeraltetesPasswort99")  # ≠ generate_password(4711)
    db.flush()

    r = client.post("/api/students/generate-credentials",
                    headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    row = next(x for x in r.json() if x["username"] == "a.alt")
    # The displayed password must actually verify against the stored hash now.
    db.refresh(s)
    assert verify_password(row["password"], s.password_hash)
    assert row["password"] == generate_password(s.password_seed)


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


# ---------------------------------------------------------------------------
# AK-code (Abschlussklasse) grade-bump matching via preview/apply
# ---------------------------------------------------------------------------

def _preview(client, admin_token, csv: str):
    return client.post(
        "/api/students/preview",
        files=[_csv_file(csv)],
        headers={"Authorization": f"Bearer {admin_token}"},
    )


def _apply(client, admin_token, selected_keys, csv_data):
    return client.post(
        "/api/students/apply",
        json={"selected_keys": selected_keys, "csv_data": csv_data},
        headers={"Authorization": f"Bearer {admin_token}"},
    )


def test_apply_sets_ak_code(client, admin_token, klass_5a, db):
    csv = "#,Nachname,Vorname,Klasse,Geschlecht\n1,Test,Person,5a,männlich\n"
    preview = _preview(client, admin_token, csv).json()
    row = preview["diff"][0]
    _apply(client, admin_token, [row["key"]], {row["key"]: row["csv_data"]})

    s = db.query(Student).filter(Student.nachname == "Test").one()
    assert s.ak_code is not None
    assert s.ak_code.startswith("AK")
    cls = db.query(Class).filter(Class.id == s.class_id).one()
    assert cls.ak_code == s.ak_code


def test_apply_recognizes_student_across_grade_bump(client, admin_token, klass_5a, db, monkeypatch):
    """A student promoted from 5a -> 6a in next year's import should be matched
    via AK-code (updated, not duplicated), even though their klasse label and
    grade changed — only the AK-code (graduation year) stays constant."""
    import api.schoolyear as schoolyear_mod
    from datetime import date as real_date

    class _FixedDate(real_date):
        _fixed = real_date(2025, 7, 1)  # school year 2024/2025, before Stichtag

        @classmethod
        def today(cls):
            return cls._fixed

    monkeypatch.setattr(schoolyear_mod, "date", _FixedDate)

    csv_year1 = "#,Nachname,Vorname,Klasse,Geschlecht\n1,Meier,Tom,5a,männlich\n"
    preview1 = _preview(client, admin_token, csv_year1).json()
    row1 = preview1["diff"][0]
    assert row1["action"] == "new"
    _apply(client, admin_token, [row1["key"]], {row1["key"]: row1["csv_data"]})
    assert db.query(Student).count() == 1

    # Next school year — after the 1. August Stichtag. No separate "6a" class is
    # seeded: the same class row (klass_5a) is expected to roll forward in place.
    _FixedDate._fixed = real_date(2025, 9, 1)

    csv_year2 = "#,Nachname,Vorname,Klasse,Geschlecht\n1,Meier,Tom,6a,männlich\n"
    preview2 = _preview(client, admin_token, csv_year2).json()
    row2 = preview2["diff"][0]
    assert row2["action"] == "update"
    assert "klasse" in row2["changed_fields"]
    _apply(client, admin_token, [row2["key"]], {row2["key"]: row2["csv_data"]})

    # Still exactly one student — matched, not duplicated
    assert db.query(Student).count() == 1
    s = db.query(Student).filter(Student.nachname == "Meier").one()
    assert s.klasse == "6a"
    assert s.class_id == klass_5a.id
    assert s.jahrgang == 6

    db.refresh(klass_5a)
    assert klass_5a.code == "6a"


def _apply_all(client, admin_token, preview):
    """Mirror the frontend: select every non-unchanged row, apply with its csv_data."""
    keys = [r["key"] for r in preview["diff"] if r["action"] != "unchanged"]
    csv_data = {r["key"]: r["csv_data"] for r in preview["diff"] if r["key"] in keys}
    return _apply(client, admin_token, keys, csv_data)


def test_apply_persists_realistic_csv(client, admin_token, klass_5a, db):
    """Semicolon-delimited export with an extra column — the full preview→apply
    round-trip must actually create the students in the DB."""
    csv = "#;Nachname;Vorname;Klasse;Geschlecht;Geburtsdatum;Förderschwerpunkt\n" \
          "1;Schäfer;Lea;5a;weiblich;03.09.2013;LRS\n" \
          "2;Wagner;Ben;5a;männlich;11.12.2013;\n"
    preview = _preview(client, admin_token, csv).json()
    assert preview["summary"]["new"] == 2
    resp = _apply_all(client, admin_token, preview)
    assert resp.status_code == 200
    assert resp.json()["applied"] == 2
    assert db.query(Student).count() == 2
    lea = db.query(Student).filter(Student.nachname == "Schäfer").one()
    assert lea.vorname == "Lea"
    assert lea.class_id == klass_5a.id
    assert lea.extra_fields.get("Förderschwerpunkt") == "LRS"


def test_apply_two_students_sharing_name(client, admin_token, klass_5a, db):
    """Two distinct students with the same Vor+Nachname in one class must BOTH be
    created — the diff key (nachname|vorname|klasse) collides for them."""
    csv = "#,Nachname,Vorname,Klasse,Geschlecht\n" \
          "1,Yilmaz,Ali,5a,männlich\n" \
          "2,Yilmaz,Ali,5a,männlich\n"
    preview = _preview(client, admin_token, csv).json()
    resp = _apply_all(client, admin_token, preview)
    assert resp.status_code == 200
    assert db.query(Student).filter(Student.nachname == "Yilmaz").count() == 2


# ---------------------------------------------------------------------------
# Alias / Nachteilsausgleich + username management
# ---------------------------------------------------------------------------

@pytest.fixture()
def student_5a(db, klass_5a) -> Student:
    s = Student(nachname="Meier", vorname="Anna Lena", klasse="5a",
                class_id=klass_5a.id, geschlecht="weiblich")
    db.add(s)
    db.flush()
    return s


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


def test_update_profile_sets_alias_and_nta(client, admin_token, student_5a, db):
    r = client.patch(f"/api/students/{student_5a.id}/profile",
                     json={"alias": "Lena", "nta": [1, 3, 5, 3, 9]}, headers=_hdr(admin_token))
    assert r.status_code == 200
    db.refresh(student_5a)
    assert student_5a.alias == "Lena"
    assert student_5a.nta == [1, 3, 5]  # deduped, sorted, out-of-range 9 dropped


def test_update_profile_empty_alias_clears(client, admin_token, student_5a, db):
    student_5a.alias = "X"
    db.flush()
    r = client.patch(f"/api/students/{student_5a.id}/profile",
                     json={"alias": "  ", "nta": []}, headers=_hdr(admin_token))
    assert r.status_code == 200
    db.refresh(student_5a)
    assert student_5a.alias is None


def test_update_profile_requires_class_editor(client, teacher_token, student_5a):
    """A teacher who is not this class's Klassenlehrer may not edit the profile."""
    r = client.patch(f"/api/students/{student_5a.id}/profile",
                     json={"alias": "Lena", "nta": []}, headers=_hdr(teacher_token))
    assert r.status_code == 403


def test_set_student_username(client, admin_token, student_5a, db):
    r = client.patch(f"/api/students/{student_5a.id}/username",
                     json={"username": "neu.name"}, headers=_hdr(admin_token))
    assert r.status_code == 200
    db.refresh(student_5a)
    assert student_5a.username == "neu.name"


def test_delete_student(client, admin_token, student_5a, db):
    sid = student_5a.id
    r = client.delete(f"/api/students/{sid}", headers=_hdr(admin_token))
    assert r.status_code == 204
    assert db.get(Student, sid) is None


def test_delete_student_requires_admin(client, teacher_token, student_5a, db):
    r = client.delete(f"/api/students/{student_5a.id}", headers=_hdr(teacher_token))
    assert r.status_code == 403
    assert db.get(Student, student_5a.id) is not None


def test_set_student_username_rejects_duplicate(client, admin_token, klass_5a, db):
    a = Student(nachname="A", vorname="A", klasse="5a", geschlecht="männlich", username="taken")
    b = Student(nachname="B", vorname="B", klasse="5a", geschlecht="männlich")
    db.add_all([a, b])
    db.flush()
    r = client.patch(f"/api/students/{b.id}/username",
                     json={"username": "taken"}, headers=_hdr(admin_token))
    assert r.status_code == 409
