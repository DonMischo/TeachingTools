"""Auth security tests: jti revocation, algorithm pinning, cookie handling."""
import pytest
from jose import jwt

from api.config import settings
from api.auth import create_access_token, hash_password
from api.models import RevokedToken, Teacher


def test_login_sets_cookie(client, teacher):
    r = client.post("/api/auth/login", json={"username": "Anna Müller", "password": "secret"})
    assert r.status_code == 200
    assert "hp_session" in r.cookies


def test_logout_revokes_token(client, teacher, teacher_token, db):
    # Verify token works before logout
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 200

    # Logout (revokes the cookie / token)
    client.post("/api/auth/login", json={"username": "Anna Müller", "password": "secret"})
    client.post("/api/auth/logout")  # uses cookie set by login above

    # Token in DB revoked_tokens now (verified via DB directly)
    revoked_count = db.query(RevokedToken).count()
    assert revoked_count >= 1


def test_me_returns_user_type(client, teacher, teacher_token):
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["user_type"] == "teacher"
    assert body["teacher"]["role"] in ("teacher", "admin")


def test_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_algorithm_only_hs256_accepted(client, teacher):
    # Craft token with alg=none (classic attack)
    from jose.utils import base64url_encode
    import json, hmac, hashlib

    header = base64url_encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).decode()
    payload_data = base64url_encode(
        json.dumps({"sub": str(teacher.id), "type": "teacher"}).encode()
    ).decode()
    forged_token = f"{header}.{payload_data}."

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged_token}"})
    assert r.status_code == 401


def test_wrong_secret_rejected(client, teacher):
    token = jwt.encode(
        {"sub": str(teacher.id), "type": "teacher"},
        "wrong-secret",
        algorithm="HS256",
    )
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_revoked_token_rejected(client, teacher, teacher_token, db):
    # Manually revoke the token's jti
    payload = jwt.decode(teacher_token, settings.secret_key, algorithms=["HS256"])
    jti = payload["jti"]
    from datetime import datetime, timezone, timedelta
    db.add(RevokedToken(jti=jti, expires_at=datetime.now(timezone.utc) + timedelta(hours=8)))
    db.flush()

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 401


def test_token_contains_jti(teacher_token):
    payload = jwt.decode(teacher_token, settings.secret_key, algorithms=["HS256"])
    assert "jti" in payload
    assert len(payload["jti"]) == 36  # UUID4


def test_class_name_requires_auth(client, klass):
    r = client.patch(f"/api/classes/{klass.id}/name", json={"class_name": "Otter"})
    assert r.status_code == 401


def test_class_name_update(client, teacher_token, klass):
    r = client.patch(
        f"/api/classes/{klass.id}/name",
        json={"class_name": "Otter"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200
    assert r.json()["class_name"] == "Otter"


def test_class_name_clear(client, teacher_token, klass):
    client.patch(
        f"/api/classes/{klass.id}/name",
        json={"class_name": "Otter"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    r = client.patch(
        f"/api/classes/{klass.id}/name",
        json={"class_name": None},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200
    assert r.json()["class_name"] is None
