"""
Tests for authentication behavior.

We test what a user experiences, not the JWT implementation details.
"""
import pytest
from api.models import Teacher
from api.auth import hash_password


def test_teacher_can_log_in_with_correct_password(client, teacher):
    r = client.post("/api/auth/login", json={"username": "Anna Müller", "password": "secret"})

    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["teacher"]["first_name"] == "Anna"
    assert body["teacher"]["last_name"] == "Müller"


def test_login_also_works_with_last_name_only(client, teacher):
    r = client.post("/api/auth/login", json={"username": "Müller", "password": "secret"})

    assert r.status_code == 200


def test_wrong_password_is_rejected(client, teacher):
    r = client.post("/api/auth/login", json={"username": "Anna Müller", "password": "wrong"})

    assert r.status_code == 401


def test_unknown_teacher_is_rejected(client):
    r = client.post("/api/auth/login", json={"username": "Nobody Here", "password": "x"})

    assert r.status_code == 401


def test_teacher_without_a_password_cannot_log_in(client, db):
    db.add(Teacher(first_name="No", last_name="Password", active=True))
    db.flush()

    r = client.post("/api/auth/login", json={"username": "No Password", "password": ""})

    assert r.status_code == 401


def test_inactive_teacher_cannot_log_in(client, db):
    db.add(Teacher(first_name="Gone", last_name="Away", active=False,
                   password_hash=hash_password("pw")))
    db.flush()

    r = client.post("/api/auth/login", json={"username": "Gone Away", "password": "pw"})

    assert r.status_code == 401


def test_token_grants_access_to_protected_endpoints(client, teacher_token, klass, teacher):
    r = client.patch(
        f"/api/classes/{klass.id}/symbol",
        json={"symbol_emoji": "🦁"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200


def test_request_without_token_is_rejected_on_protected_endpoints(client, klass):
    r = client.patch(f"/api/classes/{klass.id}/symbol", json={"symbol_emoji": "🦁"})

    assert r.status_code == 401
