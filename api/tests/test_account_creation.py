"""
Tests for account/credential generation, manual user creation, and password reset:
  - teacher credential generation (username + password) with login parity
  - manual creation of student / teacher / admin accounts with roles
  - admin password reset for a single student or teacher
"""
from api.models import Teacher, Student, TeacherRole
from api.auth import hash_password, verify_password


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Login serialization (regression) ───────────────────────────────────────

def test_login_teacher_with_professional_role(client, db):
    """A teacher with a teacher_role set must be able to log in. Regression:
    login/me serialized the Teacher via TeacherOut.model_validate(), which fed
    the ORM TeacherRole object into a `str` field and 500'd for every teacher
    that had a role assigned."""
    role = TeacherRole(name="Lehrer", counts_as_teacher=True)
    db.add(role)
    db.flush()
    t = Teacher(first_name="Rolf", last_name="Rolle", active=True, role="teacher",
                username="r.rolle10", password_hash=hash_password("secret123"),
                teacher_role_id=role.id)
    db.add(t)
    db.flush()

    r = client.post("/api/auth/login", json={"username": "r.rolle10", "password": "secret123"})
    assert r.status_code == 200, r.text
    assert r.json()["teacher"]["teacher_role"] == "Lehrer"

    # /me had the same bug — the login cookie is now set on the client.
    me = client.get("/api/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["teacher"]["teacher_role"] == "Lehrer"


# ── Teacher credential generation ──────────────────────────────────────────

def test_generate_credentials_mints_username_and_password(client, db, admin, admin_token):
    db.add(Teacher(first_name="Berta", last_name="Schmidt", active=True))
    db.flush()

    r = client.post("/api/teachers/generate-credentials", headers=_auth(admin_token))
    assert r.status_code == 200
    berta = {row["last_name"]: row for row in r.json()}["Schmidt"]
    assert berta["username"] and berta["password"]

    login = client.post("/api/auth/login",
                        json={"username": berta["username"], "password": berta["password"]})
    assert login.status_code == 200


def test_generate_credentials_does_not_clobber_manual_password(client, db, admin, admin_token):
    t = Teacher(first_name="Carl", last_name="Jung", active=True,
                password_hash=hash_password("mypassword"))  # manual pw, no seed
    db.add(t)
    db.flush()

    client.post("/api/teachers/generate-credentials", headers=_auth(admin_token))

    refreshed = db.query(Teacher).filter(Teacher.last_name == "Jung").first()
    assert refreshed.username
    assert verify_password("mypassword", refreshed.password_hash)  # password untouched


def test_generate_credentials_requires_admin(client, teacher_token):
    r = client.post("/api/teachers/generate-credentials", headers=_auth(teacher_token))
    assert r.status_code == 403


def test_name_login_still_works_after_generate(client, db, admin, admin_token):
    db.add(Teacher(first_name="Dora", last_name="Klein", active=True,
                   password_hash=hash_password("secret")))
    db.flush()

    client.post("/api/teachers/generate-credentials", headers=_auth(admin_token))
    login = client.post("/api/auth/login", json={"username": "Dora Klein", "password": "secret"})
    assert login.status_code == 200


# ── Manual creation: teacher / admin ───────────────────────────────────────

def test_create_teacher_manually_returns_working_credentials(client, admin, admin_token):
    r = client.post("/api/teachers",
                    json={"first_name": "Eva", "last_name": "Weber", "role": "teacher"},
                    headers=_auth(admin_token))
    assert r.status_code == 201
    row = r.json()
    assert row["role"] == "teacher" and row["username"] and row["password"]
    login = client.post("/api/auth/login",
                        json={"username": row["username"], "password": row["password"]})
    assert login.status_code == 200


def test_create_admin_manually_sets_admin_role(client, db, admin, admin_token):
    r = client.post("/api/teachers",
                    json={"first_name": "Frank", "last_name": "Boss", "role": "admin"},
                    headers=_auth(admin_token))
    assert r.status_code == 201
    assert r.json()["role"] == "admin"
    assert db.query(Teacher).filter(Teacher.last_name == "Boss").first().role == "admin"


def test_create_teacher_rejects_invalid_role(client, admin, admin_token):
    r = client.post("/api/teachers",
                    json={"first_name": "Bad", "last_name": "Role", "role": "superuser"},
                    headers=_auth(admin_token))
    assert r.status_code == 422


def test_create_teacher_requires_admin(client, teacher_token):
    r = client.post("/api/teachers",
                    json={"first_name": "No", "last_name": "Access", "role": "teacher"},
                    headers=_auth(teacher_token))
    assert r.status_code == 403


# ── Manual creation: student ───────────────────────────────────────────────

def test_create_student_manually_returns_working_credentials(client, klass, admin, admin_token):
    r = client.post("/api/students",
                    json={"vorname": "Max", "nachname": "Mustermann", "klasse": "5a", "geschlecht": "m"},
                    headers=_auth(admin_token))
    assert r.status_code == 201
    row = r.json()
    assert row["klasse"] == "5a" and row["username"] and row["password"]
    login = client.post("/api/auth/login",
                        json={"username": row["username"], "password": row["password"]})
    assert login.status_code == 200


def test_create_student_links_class_and_gender(client, db, klass, admin, admin_token):
    client.post("/api/students",
                json={"vorname": "Mia", "nachname": "Lang", "klasse": "5a", "geschlecht": "w"},
                headers=_auth(admin_token))
    s = db.query(Student).filter(Student.nachname == "Lang").first()
    assert s.class_id == klass.id and s.geschlecht == "weiblich"


def test_create_student_rejects_invalid_gender(client, klass, admin, admin_token):
    r = client.post("/api/students",
                    json={"vorname": "X", "nachname": "Y", "klasse": "5a", "geschlecht": "?"},
                    headers=_auth(admin_token))
    assert r.status_code == 422


def test_create_student_requires_admin(client, klass, teacher_token):
    r = client.post("/api/students",
                    json={"vorname": "No", "nachname": "Access", "klasse": "5a", "geschlecht": "m"},
                    headers=_auth(teacher_token))
    assert r.status_code == 403


# ── Password reset ─────────────────────────────────────────────────────────

def test_reset_teacher_password_issues_new_working_password(client, db, admin, admin_token):
    t = Teacher(first_name="Rita", last_name="Reset", active=True,
                password_hash=hash_password("oldpass"))
    db.add(t)
    db.flush()

    r = client.post(f"/api/teachers/{t.id}/reset-password", headers=_auth(admin_token))
    assert r.status_code == 200
    row = r.json()
    assert row["username"] and row["password"]

    # New password logs in; old one no longer works.
    assert client.post("/api/auth/login",
                       json={"username": row["username"], "password": row["password"]}).status_code == 200
    assert client.post("/api/auth/login",
                       json={"username": "Rita Reset", "password": "oldpass"}).status_code == 401


def test_reset_student_password_issues_new_working_password(client, db, klass, admin, admin_token):
    create = client.post("/api/students",
                         json={"vorname": "Tom", "nachname": "Turner", "klasse": "5a", "geschlecht": "m"},
                         headers=_auth(admin_token)).json()
    old_pw = create["password"]

    r = client.post(f"/api/students/{create['id']}/reset-password", headers=_auth(admin_token))
    assert r.status_code == 200
    new_pw = r.json()["password"]
    assert new_pw and new_pw != old_pw

    assert client.post("/api/auth/login",
                       json={"username": create["username"], "password": new_pw}).status_code == 200
    assert client.post("/api/auth/login",
                       json={"username": create["username"], "password": old_pw}).status_code == 401


def test_reset_password_requires_admin(client, db, teacher, teacher_token):
    r = client.post(f"/api/teachers/{teacher.id}/reset-password", headers=_auth(teacher_token))
    assert r.status_code == 403


def test_reset_password_unknown_id_404(client, admin, admin_token):
    assert client.post("/api/teachers/99999/reset-password", headers=_auth(admin_token)).status_code == 404
    assert client.post("/api/students/99999/reset-password", headers=_auth(admin_token)).status_code == 404
