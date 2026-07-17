"""
Tests for the first-run setup flow.
"""
from api.models import Teacher
from api.auth import hash_password


def test_setup_is_needed_when_no_admin_exists(client):
    r = client.get("/api/setup/status")

    assert r.status_code == 200
    assert r.json()["needs_setup"] is True


def test_setup_is_not_needed_when_an_admin_exists(client, db):
    db.add(Teacher(first_name="A", last_name="B", active=True, role="admin",
                   password_hash=hash_password("pw")))
    db.flush()

    r = client.get("/api/setup/status")

    assert r.json()["needs_setup"] is False


def test_create_admin_succeeds_on_fresh_install(client):
    r = client.post("/api/setup/create-admin", json={
        "username": "admin", "password": "secure123",
    })

    assert r.status_code == 200
    assert "access_token" in r.json()
    assert r.json()["teacher"]["role"] == "admin"


def test_create_admin_logs_the_new_admin_in(client):
    r = client.post("/api/setup/create-admin", json={
        "username": "admin", "password": "secure123",
    })
    token = r.json()["access_token"]

    # Token should grant access to protected endpoints
    classes = client.get("/api/classes", headers={"Authorization": f"Bearer {token}"})
    assert classes.status_code == 200


def test_create_admin_is_blocked_once_an_admin_exists(client, db):
    db.add(Teacher(first_name="", last_name="existing", active=True, role="admin",
                   password_hash=hash_password("pw")))
    db.flush()

    r = client.post("/api/setup/create-admin", json={
        "username": "second", "password": "secure123",
    })

    assert r.status_code == 403


def test_create_admin_rejects_short_password(client):
    r = client.post("/api/setup/create-admin", json={
        "username": "admin", "password": "abc",
    })

    assert r.status_code == 422
