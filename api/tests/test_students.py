"""Tests for student import, credential generation, and auth."""
import io
import pytest
from fastapi.testclient import TestClient

from api.models import Student, Class, SportfestDiscipline, Teacher
from api.tests.conftest import auth
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
    rows = r.json()["rows"]
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
    row = next(x for x in r.json()["rows"] if x["username"] == "a.alt")
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
    first = r1.json()["rows"][0]

    # Second call should return same credentials (deterministic)
    r2 = client.post(
        "/api/students/generate-credentials",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    second = r2.json()["rows"][0]

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
    cred = r.json()["rows"][0]

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
    cred = r.json()["rows"][0]
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
    # Eine fachfremde Lehrkraft sieht die Kurzform, nicht den vollen Nachnamen.
    row = r.json()[0]
    assert row["nachname"] == "A."
    assert row["vorname"] == "X"
    assert row["display_name"] == "X A."


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


def test_apply_persists_without_geschlecht(client, admin_token, klass_5a, db):
    """Geschlecht is optional — a row without it must still be created (no NOT-NULL crash)."""
    csv = "#,Nachname,Vorname,Klasse,Geburtsdatum\n1,Beispiel,Mia,5a,01.01.2014\n"
    preview = _preview(client, admin_token, csv).json()
    resp = _apply_all(client, admin_token, preview)
    assert resp.status_code == 200
    s = db.query(Student).filter(Student.nachname == "Beispiel").one()
    assert s.geschlecht is None
    assert s.class_id == klass_5a.id


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


# ---------------------------------------------------------------------------
# Two-mode CSV import: roster mode (absent detection + scoped delete) and
# enrichment mode (fuzzy name match + known-field conflicts).
# ---------------------------------------------------------------------------

def _preview_mode(client, admin_token, csv: str, mode: str):
    return client.post(
        "/api/students/preview",
        files=[_csv_file(csv)],
        data={"mode": mode},
        headers={"Authorization": f"Bearer {admin_token}"},
    )


def _apply_body(client, admin_token, body: dict):
    return client.post(
        "/api/students/apply",
        json=body,
        headers={"Authorization": f"Bearer {admin_token}"},
    )


# --- roster mode ---

def test_preview_roster_mode_returns_absent(client, admin_token, klass_5a, klass_6b, db):
    """`absent` lists active students in a class present in the file who are not
    themselves in the file. Scope is per-class: a student in a class that never
    appears in the file (6b here) must never show up as absent."""
    kept = _seed_student(db, "A", "X", "5a")
    absent = _seed_student(db, "B", "Y", "5a")
    other_class = _seed_student(db, "C", "Z", "6b")

    csv = "#,Nachname,Vorname,Klasse,Geschlecht\n1,A,X,5a,männlich\n"
    r = _preview_mode(client, admin_token, csv, "roster")
    assert r.status_code == 200
    body = r.json()

    absent_ids = {row["id"] for row in body["absent"]}
    assert absent.id in absent_ids
    assert other_class.id not in absent_ids
    assert kept.id not in absent_ids

    row = next(x for x in body["absent"] if x["id"] == absent.id)
    assert row["nachname"] == "B"
    assert row["vorname"] == "Y"
    assert row["klasse"] == "5a"


def test_apply_roster_delete_ids(client, admin_token, klass_5a, klass_6b, db):
    """/apply in roster mode with delete_ids deletes exactly those students —
    everyone else (including other classes) is untouched."""
    kept = _seed_student(db, "A", "X", "5a")
    absent = _seed_student(db, "B", "Y", "5a")
    other_class = _seed_student(db, "C", "Z", "6b")

    r = _apply_body(client, admin_token, {
        "mode": "roster",
        "selected_keys": [],
        "csv_data": {},
        "delete_ids": [absent.id],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["deleted"] == 1

    assert db.get(Student, absent.id) is None
    assert db.get(Student, kept.id) is not None
    assert db.get(Student, other_class.id) is not None


def test_preview_default_mode_still_returns_diff(client, admin_token, klass_5a, db):
    """Backward-compat smoke test: without a mode field (or with mode='roster'),
    preview still behaves exactly as before — a new student shows action 'new'."""
    csv = "#,Nachname,Vorname,Klasse,Geschlecht\n1,Neu,Person,5a,männlich\n"
    body = _preview(client, admin_token, csv).json()
    assert "diff" in body
    assert "summary" in body
    row = next(x for x in body["diff"] if x["csv_data"]["nachname"] == "Neu")
    assert row["action"] == "new"


# --- enrichment mode ---

def test_enrich_matches_by_vorname_token_subset(client, admin_token, klass_5a, db):
    """File vorname 'Anna' matches DB student 'Anna Maria' (subset of given-name
    tokens); the extra 'Instrument' column is surfaced in extra_writes."""
    student = _seed_student(db, "Meier", "Anna Maria", "5a")
    csv = "Nachname,Vorname,Instrument\nMeier,Anna,Geige\n"
    r = _preview_mode(client, admin_token, csv, "enrichment")
    assert r.status_code == 200
    body = r.json()
    row = body["enrich"][0]
    assert row["status"] == "matched"
    assert row["match"]["id"] == student.id
    assert row["extra_writes"] == {"Instrument": "Geige"}


def test_enrich_matches_by_other_vorname_token(client, admin_token, klass_5a, db):
    """File vorname 'Maria' also matches DB student 'Anna Maria'."""
    student = _seed_student(db, "Meier", "Anna Maria", "5a")
    csv = "Nachname,Vorname\nMeier,Maria\n"
    body = _preview_mode(client, admin_token, csv, "enrichment").json()
    row = body["enrich"][0]
    assert row["status"] == "matched"
    assert row["match"]["id"] == student.id


def test_enrich_ambiguous_multiple_candidates(client, admin_token, db):
    """Two same-name students in different classes, no klasse in the file to
    narrow it down -> ambiguous, both listed as candidates, no single match."""
    s1 = _seed_student(db, "Schmidt", "Tom", "5a")
    s2 = _seed_student(db, "Schmidt", "Tom", "6a")
    csv = "Nachname,Vorname\nSchmidt,Tom\n"
    body = _preview_mode(client, admin_token, csv, "enrichment").json()
    row = body["enrich"][0]
    assert row["status"] == "ambiguous"
    candidate_ids = {c["id"] for c in row["candidates"]}
    assert candidate_ids == {s1.id, s2.id}
    assert row["match"] is None


def test_enrich_unmatched_unknown_nachname(client, admin_token, klass_5a, db):
    _seed_student(db, "Meier", "Anna", "5a")
    csv = "Nachname,Vorname\nUnknown,Person\n"
    body = _preview_mode(client, admin_token, csv, "enrichment").json()
    row = body["enrich"][0]
    assert row["status"] == "unmatched"
    assert row["match"] is None
    assert row["candidates"] == []


def test_enrich_known_field_conflict_not_auto_applied(client, admin_token, klass_5a, db):
    """A differing known field (geschlecht) is surfaced as a conflict for the
    user to resolve — never silently folded into extra_writes, and name/klasse
    are never conflict fields."""
    student = _seed_student(db, "Meier", "Anna", "5a", geschlecht="weiblich")
    csv = "Nachname,Vorname,Geschlecht,Instrument\nMeier,Anna,männlich,Geige\n"
    body = _preview_mode(client, admin_token, csv, "enrichment").json()
    row = body["enrich"][0]
    assert row["status"] == "matched"

    conflict = next(c for c in row["conflicts"] if c["field"] == "geschlecht")
    assert conflict["db_val"] == "weiblich"
    assert conflict["csv_val"] == "männlich"

    assert "geschlecht" not in row["extra_writes"]
    assert "geburtsdatum" not in row["extra_writes"]
    assert "nummer" not in row["extra_writes"]
    assert all(c["field"] not in ("nachname", "vorname", "klasse") for c in row["conflicts"])


def test_enrich_apply_take_fields_empty_only_writes_extras(client, admin_token, klass_5a, db):
    """With take_fields=[], only unknown/extra columns are written — known
    fields (geschlecht) and identity fields (nachname/vorname/klasse) are
    left exactly as they were in the DB, even though the CSV disagrees."""
    student = _seed_student(db, "Meier", "Anna", "5a", geschlecht="weiblich")
    key = "row1"
    csv_data = {key: {"nachname": "Meier", "vorname": "Anna", "klasse": "6z",
                       "geschlecht": "männlich", "Instrument": "Geige"}}
    r = _apply_body(client, admin_token, {
        "mode": "enrichment",
        "resolutions": [{"key": key, "student_id": student.id, "take_fields": []}],
        "csv_data": csv_data,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["applied"] == 1

    db.refresh(student)
    assert student.extra_fields.get("Instrument") == "Geige"
    assert student.geschlecht == "weiblich"
    assert student.nachname == "Meier"
    assert student.vorname == "Anna"
    assert student.klasse == "5a"


def test_enrich_apply_take_fields_overwrites_selected(client, admin_token, klass_5a, db):
    """take_fields=['geschlecht'] overwrites geschlecht from the CSV, but
    nachname/vorname/klasse are still never touched."""
    student = _seed_student(db, "Meier", "Anna", "5a", geschlecht="weiblich")
    key = "row1"
    csv_data = {key: {"nachname": "Meier", "vorname": "Anna", "klasse": "9z",
                       "geschlecht": "männlich"}}
    r = _apply_body(client, admin_token, {
        "mode": "enrichment",
        "resolutions": [{"key": key, "student_id": student.id, "take_fields": ["geschlecht"]}],
        "csv_data": csv_data,
    })
    assert r.status_code == 200
    db.refresh(student)
    assert student.geschlecht == "männlich"
    assert student.nachname == "Meier"
    assert student.vorname == "Anna"
    assert student.klasse == "5a"


def test_enrich_apply_ambiguous_resolved_to_chosen_student(client, admin_token, db):
    """Resolving an ambiguous row writes only to the explicitly chosen
    student_id — the other candidate must stay untouched."""
    s1 = _seed_student(db, "Schmidt", "Tom", "5a")
    s2 = _seed_student(db, "Schmidt", "Tom", "6a")
    key = "row1"
    csv_data = {key: {"nachname": "Schmidt", "vorname": "Tom", "Instrument": "Geige"}}
    r = _apply_body(client, admin_token, {
        "mode": "enrichment",
        "resolutions": [{"key": key, "student_id": s1.id, "take_fields": []}],
        "csv_data": csv_data,
    })
    assert r.status_code == 200
    db.refresh(s1)
    db.refresh(s2)
    assert s1.extra_fields.get("Instrument") == "Geige"
    assert s2.extra_fields.get("Instrument") is None


# --- outdated class / school-year conversion ---

def test_enrich_stale_class_disambiguates_via_list_year(client, admin_token, db):
    """Two same-name students in different current classes. An enrichment list from
    a PRIOR school year carries a stale Klasse; converting it to an AK-code with
    `list_year` picks the right student and flags the row outdated."""
    from api.schoolyear import get_school_year_start, klasse_to_ak_code
    start = get_school_year_start()
    a = _seed_student(db, "Schmidt", "Tom", "9a")
    a.ak_code = klasse_to_ak_code("9a")   # stable identity for current 9a
    b = _seed_student(db, "Schmidt", "Tom", "9b")
    b.ak_code = klasse_to_ak_code("9b")
    db.flush()

    # Last year Tom(A) was in 8a; 8a a year ago -> same AK-code as 9a now.
    csv = "Klasse,Vorname,Nachname,Office\n8a,Tom,Schmidt,tom@x\n"
    r = client.post(
        "/api/students/preview",
        files=[_csv_file(csv)], data={"mode": "enrichment", "list_year": str(start - 1)},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    row = r.json()["enrich"][0]
    assert row["status"] == "matched"
    assert row["match"]["id"] == a.id
    assert row["outdated"] is True
    assert row["extra_writes"] == {"Office": "tom@x"}


def test_enrich_outdated_flag_reflects_current_class(client, admin_token, db):
    """A unique name always matches; `outdated` is True only when the list's Klasse
    differs from the student's current one."""
    from api.schoolyear import get_school_year_start, klasse_to_ak_code
    start = get_school_year_start()
    s = _seed_student(db, "Meier", "Anna", "9a")
    s.ak_code = klasse_to_ak_code("9a")
    db.flush()

    # Same class, current year -> not outdated.
    same = client.post(
        "/api/students/preview",
        files=[_csv_file("Klasse,Vorname,Nachname,Office\n9a,Anna,Meier,a@x\n")],
        data={"mode": "enrichment"},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()["enrich"][0]
    assert same["status"] == "matched" and same["outdated"] is False

    # Stale class from last year -> outdated.
    old = client.post(
        "/api/students/preview",
        files=[_csv_file("Klasse,Vorname,Nachname,Office\n8a,Anna,Meier,a@x\n")],
        data={"mode": "enrichment", "list_year": str(start - 1)},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()["enrich"][0]
    assert old["status"] == "matched" and old["outdated"] is True


def test_enrich_autodetects_swapped_name_columns(client, admin_token, db):
    """A list whose header says 'Vorname, Nachname' but lists the surname first is
    auto-corrected: matching still works and `names_swapped` is reported."""
    _seed_student(db, "Sommer", "Kim", "3a")
    _seed_student(db, "Winter", "Lea", "3a", "weiblich")
    # Data is surname-first despite the header labels.
    csv = "Klasse,Vorname,Nachname,Office\n3a,Sommer,Kim,c@x\n3a,Winter,Lea,e@x\n"
    body = client.post(
        "/api/students/preview",
        files=[_csv_file(csv)], data={"mode": "enrichment"},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    assert body["names_swapped"] is True
    matched = [e for e in body["enrich"] if e["status"] == "matched"]
    assert len(matched) == 2
    assert {e["match"]["nachname"] for e in matched} == {"Sommer", "Winter"}


def test_enrich_correct_columns_not_swapped(client, admin_token, db):
    """A correctly-oriented list is left as-is (no false swap)."""
    _seed_student(db, "Meier", "Anna", "3a", "weiblich")
    csv = "Klasse,Vorname,Nachname,Office\n3a,Anna,Meier,a@x\n"
    body = client.post(
        "/api/students/preview",
        files=[_csv_file(csv)], data={"mode": "enrichment"},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    assert body["names_swapped"] is False
    assert body["enrich"][0]["status"] == "matched"


# --- auth ---

def test_enrich_preview_requires_admin(client, teacher_token, klass_5a):
    csv = "Nachname,Vorname\nMeier,Anna\n"
    r = client.post(
        "/api/students/preview",
        files=[_csv_file(csv)],
        data={"mode": "enrichment"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Credential generation from extra_fields + at-rest encryption
# ---------------------------------------------------------------------------

def _gen(client, admin_token, body=None):
    return client.post("/api/students/generate-credentials",
                       json=body, headers={"Authorization": f"Bearer {admin_token}"})


def test_generate_credentials_from_fields(client, admin_token, db):
    """username_field/password_field reuse the imported Office credentials; the
    student can log in with them, and the password is stored encrypted (not seed)."""
    from api.pw_crypto import decrypt
    s = _seed_student(db, "Sommer", "Kim", "3a")
    s.extra_fields = {"Office": "ksommer4711", "Passwort": "Beispiel4711!"}
    db.flush()

    r = _gen(client, admin_token, {"username_field": "Office", "password_field": "Passwort"})
    assert r.status_code == 200
    row = r.json()["rows"][0]
    assert row["username"] == "ksommer4711"
    assert row["password"] == "Beispiel4711!"

    # Stored: hash for login, encrypted plaintext for display, no seed.
    db.refresh(s)
    assert s.password_seed is None
    assert decrypt(s.password_enc) == "Beispiel4711!"

    # The reused credentials actually log in.
    login = client.post("/api/auth/login", json={"username": "ksommer4711", "password": "Beispiel4711!"})
    assert login.status_code == 200


def test_generate_credentials_username_clash_skips_with_error(client, admin_token, db):
    a = _seed_student(db, "Eins", "Anna", "3a", "weiblich")
    b = _seed_student(db, "Zwei", "Bea", "3a", "weiblich")
    a.extra_fields = {"Office": "dup.name"}
    b.extra_fields = {"Office": "dup.name"}
    db.flush()

    r = _gen(client, admin_token, {"username_field": "Office"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["errors"]) == 1
    db.refresh(a); db.refresh(b)
    usernames = {a.username, b.username}
    assert "dup.name" in usernames          # exactly one got it
    assert a.username != b.username


def test_generate_auto_does_not_clobber_field_password(client, admin_token, db):
    """A password set from a field (seed=None) must survive a later plain
    'generate' run — it is a valid credential, not a drifted one to reissue."""
    s = _seed_student(db, "Bleib", "Ben", "3a")
    s.extra_fields = {"Passwort": "MeinOffice1!"}
    db.flush()
    _gen(client, admin_token, {"password_field": "Passwort"})
    db.refresh(s)
    assert s.password_seed is None

    # Plain generate run (no fields) — must NOT overwrite the field password.
    r = _gen(client, admin_token, None)
    row = next(x for x in r.json()["rows"] if x["id"] == s.id)
    assert row["password"] == "MeinOffice1!"
    db.refresh(s)
    assert s.password_seed is None


def test_sensitive_extra_field_encrypted_at_rest(client, admin_token, db):
    """A password-like custom column is encrypted in the DB but shown decrypted
    on the card data; a non-sensitive column stays plaintext."""
    from api.pw_crypto import decrypt
    s = _seed_student(db, "Meier", "Anna", "3a", "weiblich")
    db.flush()
    csv = "Nachname,Vorname,Passwort,Instrument\nMeier,Anna,Geheim123,Geige\n"
    key = client.post(
        "/api/students/preview", files=[_csv_file(csv)], data={"mode": "enrichment"},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()["enrich"][0]["key"]
    client.post("/api/students/apply", json={
        "mode": "enrichment",
        "resolutions": [{"key": key, "student_id": s.id, "take_fields": []}],
        "csv_data": {key: {"Passwort": "Geheim123", "Instrument": "Geige"}},
    }, headers={"Authorization": f"Bearer {admin_token}"})

    db.refresh(s)
    assert s.extra_fields["Passwort"].startswith("enc:v1:")   # encrypted at rest
    assert decrypt(s.extra_fields["Passwort"]) == "Geheim123"
    assert s.extra_fields["Instrument"] == "Geige"            # non-sensitive stays plaintext

    # Card data shows the decrypted value.
    cards = client.get("/api/students/card-data",
                       headers={"Authorization": f"Bearer {admin_token}"}).json()
    fields = next(c for c in cards if c["id"] == s.id)["fields"]
    assert fields["Passwort"] == "Geheim123"


def test_field_keys_endpoint(client, admin_token, db):
    s = _seed_student(db, "Meier", "Anna", "3a", "weiblich")
    s.extra_fields = {"Office": "x", "Passwort": "y"}
    db.flush()
    r = client.get("/api/students/field-keys", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert set(r.json()) >= {"Office", "Passwort"}


def test_delete_student_field(client, admin_token, db):
    a = _seed_student(db, "Meier", "Anna", "3a", "weiblich")
    b = _seed_student(db, "Bauer", "Ben", "3a")
    a.extra_fields = {"Office": "x", "Passwort": "y"}
    b.extra_fields = {"Office": "z"}
    db.flush()
    r = client.request("DELETE", "/api/students/fields", params={"key": "Office"},
                       headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["removed"] == 2
    db.refresh(a); db.refresh(b)
    assert "Office" not in a.extra_fields and "Passwort" in a.extra_fields
    assert "Office" not in b.extra_fields


def test_encrypt_seed_passwords_migration(client, admin_token, db):
    """The production backfill encrypts seed-based passwords and drops the seed;
    a drifted row (hash != seed) is left intact for later healing."""
    from api.routers.students import encrypt_seed_passwords
    from api.pw_crypto import decrypt
    from api.password_gen import generate_password
    from api.auth import hash_password

    good = _seed_student(db, "Alt", "Anna", "3a", "weiblich")
    good.password_seed = 4711
    good.password_hash = hash_password(generate_password(4711))
    drift = _seed_student(db, "Drift", "Ben", "3a")
    drift.password_seed = 1234
    drift.password_hash = hash_password("etwas-anderes")
    db.flush()

    assert encrypt_seed_passwords(db) == 1
    db.flush()
    db.refresh(good); db.refresh(drift)
    assert good.password_seed is None
    assert decrypt(good.password_enc) == generate_password(4711)
    assert drift.password_seed == 1234 and drift.password_enc is None
    # Idempotent: a second run migrates nothing more.
    assert encrypt_seed_passwords(db) == 0


# ---------------------------------------------------------------------------
# Zugangsdaten: wer Klarpasswoerter ausgeben darf, und dass es protokolliert wird
# ---------------------------------------------------------------------------

class TestZugangsdatenAusgabe:
    """Klarpasswoerter gehen an genau zwei: den Admin und die Klassenleitung
    dieser einen Klasse. Das delegierbare Recht »Schülerdaten« reicht nicht —
    es traegt Import und Verwaltung, nicht den Griff auf die Passwoerter der
    ganzen Schule."""

    @pytest.fixture()
    def klassenlehrer(self, db, klass):
        """Klassenleitung *mit* eingerichtetem zweitem Faktor — ohne ihn ist der
        Export gesperrt, das prueft test_2fa.py eigens."""
        from api.auth import hash_password
        t = Teacher(first_name="Kim", last_name="Klassen", active=True, role="teacher",
                    klasse_id=klass.id, password_hash=hash_password("x"),
                    totp_secret="JBSWY3DPEHPK3PXP", totp_confirmed=True)
        db.add(t)
        db.flush()
        return t

    def _head(self, t):
        from api.auth import create_access_token
        return {"Authorization": f"Bearer {create_access_token({'sub': str(t.id), 'type': 'teacher'})}"}

    @pytest.fixture()
    def klassen(self, db, klass):
        from api.models import Class
        andere = Class(code="6b", display_name="Klasse 6b")
        db.add(andere)
        db.flush()
        # Der Export listet nur Konten mit Benutzernamen.
        a = _seed_student(db, "Aal", "Anna", klass.code)
        b = _seed_student(db, "Bär", "Ben", "6b")
        a.username, b.username = "a.aal10", "b.baer11"
        db.flush()
        return klass, andere

    def test_admin_bekommt_die_ganze_schule(self, client, admin_token, klassen):
        r = client.get("/api/students/credentials/download", headers=auth(admin_token))
        assert r.status_code == 200
        assert "5a" in r.text and "6b" in r.text

    def test_klassenleitung_bekommt_nur_die_eigene_klasse(self, client, db, klassenlehrer, klassen):
        client.cookies.clear()
        r = client.get("/api/students/credentials/download", headers=self._head(klassenlehrer))
        assert r.status_code == 200
        assert "Aal" in r.text
        assert "Bär" not in r.text          # 6b bleibt draussen, auch ohne Filter

    def test_klassenleitung_kommt_nicht_an_eine_fremde_klasse(self, client, db, klassenlehrer, klassen):
        client.cookies.clear()
        r = client.get("/api/students/credentials/download?klasse=6b",
                       headers=self._head(klassenlehrer))
        assert r.status_code == 403

    def test_lehrkraft_ohne_klassenleitung_bekommt_nichts(self, client, teacher_token, klassen):
        r = client.get("/api/students/credentials/download", headers=auth(teacher_token))
        assert r.status_code == 403

    def test_das_recht_schuelerdaten_allein_reicht_nicht(self, client, db, teacher, teacher_token, klassen):
        from api.models import AdminFeatureGrant
        db.add(AdminFeatureGrant(feature_slug="students", teacher_id=teacher.id))
        db.flush()
        # Import darf sie weiterhin …
        assert client.get("/api/students/field-keys", headers=auth(teacher_token)).status_code == 200
        # … die Klarpasswoerter der Schule nicht.
        assert client.get("/api/students/credentials/download",
                          headers=auth(teacher_token)).status_code == 403
        assert client.get("/api/students/card-data", headers=auth(teacher_token)).status_code == 403

    def test_der_export_steht_hinterher_im_protokoll(self, client, db, admin_token, klassen):
        from api.models import AuditLog
        client.get("/api/students/credentials/download?klasse=5a", headers=auth(admin_token))
        zeile = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        assert zeile is not None
        assert zeile.action == "students.credentials.download"
        assert zeile.target == "5a"
        # Im Protokoll steht, *dass* und *wie viel* — nie ein Name oder Passwort.
        assert "Aal" not in (zeile.detail + zeile.target)

    def test_passwort_zuruecksetzen_nur_fuer_die_eigene_klasse(self, client, db, klassenlehrer, klassen):
        eigenes = db.query(Student).filter_by(klasse="5a").first()
        fremdes = db.query(Student).filter_by(klasse="6b").first()
        client.cookies.clear()
        kopf = self._head(klassenlehrer)
        assert client.post(f"/api/students/{eigenes.id}/reset-password", headers=kopf).status_code == 200
        assert client.post(f"/api/students/{fremdes.id}/reset-password", headers=kopf).status_code == 403
