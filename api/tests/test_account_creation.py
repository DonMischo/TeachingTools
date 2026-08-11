"""
Tests for account/credential generation and manual user creation:
  - teacher credential generation (username + password) with login parity
  - manual creation of student / teacher / admin accounts with roles
"""
from api.models import Teacher, Student
from api.auth import hash_password, verify_password


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Teacher credential generation ──────────────────────────────────────────

def test_generate_credentials_mints_username_and_password(client, db, admin, admin_token):
    db.add(Teacher(first_name="Berta", last_name="Schmidt", active=True))
    db.flush()

    r = client.post("/api/teachers/generate-credentials", headers=_auth(admin_token))
    assert r.status_code == 200
    rows = {row["last_name"]: row for row in r.json()}

    berta = rows["Schmidt"]
    assert berta["username"]          # a username was generated
    assert berta["password"]          # a plaintext password was returned

    # The generated username + password can actually log in.
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
    assert refreshed.username                                   # username still gets minted
    assert verify_password("mypassword", refreshed.password_hash)  # password untouched


def test_generate_credentials_requires_admin(client, teacher_token):
    r = client.post("/api/teachers/generate-credentials", headers=_auth(teacher_token))
    assert r.status_code == 403


def test_name_login_still_works_after_generate(client, db, admin, admin_token):
    t = Teacher(first_name="Dora", last_name="Klein", active=True,
                password_hash=hash_password("secret"))
    db.add(t)
    db.flush()

    client.post("/api/teachers/generate-credentials", headers=_auth(admin_token))
    # Legacy name-based login remains valid.
    login = client.post("/api/auth/login", json={"username": "Dora Klein", "password": "secret"})
    assert login.status_code == 200


# ── Manual creation: teacher / admin ───────────────────────────────────────

def test_create_teacher_manually_returns_working_credentials(client, admin, admin_token):
    r = client.post("/api/teachers",
                    json={"first_name": "Eva", "last_name": "Weber", "role": "teacher"},
                    headers=_auth(admin_token))
    assert r.status_code == 201
    row = r.json()
    assert row["role"] == "teacher"
    assert row["username"] and row["password"]

    login = client.post("/api/auth/login",
                        json={"username": row["username"], "password": row["password"]})
    assert login.status_code == 200


def test_create_admin_manually_sets_admin_role(client, db, admin, admin_token):
    r = client.post("/api/teachers",
                    json={"first_name": "Frank", "last_name": "Boss", "role": "admin"},
                    headers=_auth(admin_token))
    assert r.status_code == 201
    assert r.json()["role"] == "admin"

    created = db.query(Teacher).filter(Teacher.last_name == "Boss").first()
    assert created.role == "admin"


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
    assert row["klasse"] == "5a"
    assert row["username"] and row["password"]

    login = client.post("/api/auth/login",
                        json={"username": row["username"], "password": row["password"]})
    assert login.status_code == 200


def test_create_student_links_class_and_gender(client, db, klass, admin, admin_token):
    client.post("/api/students",
                json={"vorname": "Mia", "nachname": "Lang", "klasse": "5a", "geschlecht": "w"},
                headers=_auth(admin_token))

    s = db.query(Student).filter(Student.nachname == "Lang").first()
    assert s.class_id == klass.id
    assert s.geschlecht == "weiblich"


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
