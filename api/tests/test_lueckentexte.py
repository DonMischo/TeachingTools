"""REST tests for the Lückentext tool (api/routers/lueckentexte.py).

Tokens are minted directly (create_access_token) instead of via the login
endpoint: login also sets the hp_session cookie on the shared TestClient,
and cookie auth beats the Bearer header — which silently turns "request as
teacher B" into "request as whoever logged in last".
"""
import pytest

from api.tests.conftest import auth
from api.models import Teacher
from api.auth import create_access_token


def token_for(t: Teacher) -> str:
    return create_access_token({"sub": str(t.id), "type": "teacher"})


def sample_payload(**over):
    payload = {
        "title": "Wasserkreislauf",
        "description": "Test",
        "tags": ["erdkunde"],
        "grades": [5, 6],
        "text": "Es entsteht {{a}} und {{b}} und {{c}}.",
        "gaps": [
            {"id": "a", "answer": "Verdunstung", "type": "word_bank", "difficulty": "easy", "hint": None, "choices": None},
            {"id": "b", "answer": "Wolke", "type": "free_type", "difficulty": "medium", "hint": None, "choices": None},
            {"id": "c", "answer": "Regen", "type": "multiple_choice", "difficulty": "hard", "hint": None, "choices": ["Regen", "Schnee"]},
        ],
        "distractors": ["Gezeiten"],
    }
    payload.update(over)
    return payload


@pytest.fixture()
def teacher_token(teacher):  # shadows conftest's login-based fixture (no cookie)
    return token_for(teacher)


@pytest.fixture()
def admin_token(admin):  # shadows conftest's login-based fixture (no cookie)
    return token_for(admin)


@pytest.fixture()
def other_teacher_token(db):
    t = Teacher(first_name="Ben", last_name="Schulz", active=True,
                password_hash=None, role="teacher")
    db.add(t)
    db.flush()
    return token_for(t)


class TestCrud:
    def test_requires_auth(self, client):
        assert client.get("/api/lueckentexte").status_code == 401

    def test_create_and_list(self, client, teacher_token):
        r = client.post("/api/lueckentexte", json=sample_payload(), headers=auth(teacher_token))
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["title"] == "Wasserkreislauf"
        assert body["gap_count"] == 3
        assert body["gaps"][0]["answer"] == "Verdunstung"

        r = client.get("/api/lueckentexte", headers=auth(teacher_token))
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert "gaps" not in r.json()[0]  # list view is the summary shape

    def test_create_invalid_payload_422(self, client, teacher_token):
        bad = sample_payload()
        del bad["title"]
        bad["text"] = "Es entsteht {{a}} und {{b}}."  # missing placeholder for c
        r = client.post("/api/lueckentexte", json=bad, headers=auth(teacher_token))
        assert r.status_code == 422
        errors = r.json()["detail"]["errors"]
        assert any("title" in e for e in errors)
        assert any("Platzhalter" in e for e in errors)

    def test_get_update_delete(self, client, teacher_token):
        sid = client.post("/api/lueckentexte", json=sample_payload(), headers=auth(teacher_token)).json()["id"]

        r = client.get(f"/api/lueckentexte/{sid}", headers=auth(teacher_token))
        assert r.status_code == 200
        assert len(r.json()["gaps"]) == 3

        updated = sample_payload(title="Wasserkreislauf Neu")
        r = client.put(f"/api/lueckentexte/{sid}", json=updated, headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["title"] == "Wasserkreislauf Neu"

        assert client.delete(f"/api/lueckentexte/{sid}", headers=auth(teacher_token)).status_code == 204
        assert client.get(f"/api/lueckentexte/{sid}", headers=auth(teacher_token)).status_code == 404

    def test_foreign_set_protected(self, client, teacher_token, other_teacher_token):
        sid = client.post("/api/lueckentexte", json=sample_payload(), headers=auth(teacher_token)).json()["id"]
        # Another teacher may read (open library) but not modify or delete.
        assert client.get(f"/api/lueckentexte/{sid}", headers=auth(other_teacher_token)).status_code == 200
        r = client.put(f"/api/lueckentexte/{sid}", json=sample_payload(), headers=auth(other_teacher_token))
        assert r.status_code == 403
        assert client.delete(f"/api/lueckentexte/{sid}", headers=auth(other_teacher_token)).status_code == 403

    def test_admin_may_delete_foreign(self, client, teacher_token, admin_token):
        sid = client.post("/api/lueckentexte", json=sample_payload(), headers=auth(teacher_token)).json()["id"]
        assert client.delete(f"/api/lueckentexte/{sid}", headers=auth(admin_token)).status_code == 204

    def test_get_missing_404(self, client, teacher_token):
        assert client.get("/api/lueckentexte/999999", headers=auth(teacher_token)).status_code == 404


class TestTemplateAndUpload:
    def test_template_is_valid_payload(self, client, teacher_token):
        r = client.get("/api/lueckentexte/template", headers=auth(teacher_token))
        assert r.status_code == 200
        tpl = r.json()
        assert "_ai_instructions" in tpl
        # The template itself must pass our own validation.
        r = client.post("/api/lueckentexte", json=tpl, headers=auth(teacher_token))
        assert r.status_code == 201, r.text

    def test_upload_json_file(self, client, teacher_token):
        import json as json_mod
        content = json_mod.dumps(sample_payload(title="Upload-Test")).encode()
        r = client.post(
            "/api/lueckentexte/upload",
            files={"file": ("lueckentext.json", content, "application/json")},
            headers=auth(teacher_token),
        )
        assert r.status_code == 201
        assert r.json()["title"] == "Upload-Test"

    def test_upload_invalid_json(self, client, teacher_token):
        r = client.post(
            "/api/lueckentexte/upload",
            files={"file": ("lueckentext.json", b"{not json", "application/json")},
            headers=auth(teacher_token),
        )
        assert r.status_code == 400
