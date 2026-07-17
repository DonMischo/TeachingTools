"""REST tests for the Zeitstrahl tool (api/routers/timelines.py).

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
        "title": "Römische Geschichte",
        "description": "Test",
        "tags": ["geschichte"],
        "grades": [5, 6],
        "axis": {"kind": "year", "min": -800, "max": 600},
        "lanes": [{"id": "politik", "label": "Politik", "color": "#60a5fa"}],
        "events": [
            {"id": "rom", "label": "Gründung Roms", "value": -753, "end": None, "lane": "politik", "info": None},
            {"id": "rep", "label": "Republik", "value": -509, "end": -27, "lane": "politik", "info": None},
        ],
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
        assert client.get("/api/timelines").status_code == 401

    def test_create_and_list(self, client, teacher_token):
        r = client.post("/api/timelines", json=sample_payload(), headers=auth(teacher_token))
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["title"] == "Römische Geschichte"
        assert body["event_count"] == 2 and body["lane_count"] == 1
        assert body["events"][0]["value"] == -753

        r = client.get("/api/timelines", headers=auth(teacher_token))
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert "events" not in r.json()[0]  # list view is the summary shape

    def test_create_invalid_payload_422(self, client, teacher_token):
        bad = sample_payload()
        bad["events"][0]["lane"] = "zzz"
        del bad["title"]
        r = client.post("/api/timelines", json=bad, headers=auth(teacher_token))
        assert r.status_code == 422
        errors = r.json()["detail"]["errors"]
        assert any("title" in e for e in errors)
        assert any("unbekannte lane" in e for e in errors)

    def test_get_update_delete(self, client, teacher_token):
        sid = client.post("/api/timelines", json=sample_payload(), headers=auth(teacher_token)).json()["id"]

        r = client.get(f"/api/timelines/{sid}", headers=auth(teacher_token))
        assert r.status_code == 200
        assert len(r.json()["events"]) == 2

        updated = sample_payload(title="Rom Neu")
        updated["events"].append({"id": "ende", "label": "Untergang", "value": 476, "end": None, "lane": "politik", "info": None})
        r = client.put(f"/api/timelines/{sid}", json=updated, headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["title"] == "Rom Neu" and r.json()["event_count"] == 3

        assert client.delete(f"/api/timelines/{sid}", headers=auth(teacher_token)).status_code == 204
        assert client.get(f"/api/timelines/{sid}", headers=auth(teacher_token)).status_code == 404

    def test_foreign_set_protected(self, client, teacher_token, other_teacher_token):
        sid = client.post("/api/timelines", json=sample_payload(), headers=auth(teacher_token)).json()["id"]
        # Another teacher may read (open library) but not modify or delete.
        assert client.get(f"/api/timelines/{sid}", headers=auth(other_teacher_token)).status_code == 200
        r = client.put(f"/api/timelines/{sid}", json=sample_payload(), headers=auth(other_teacher_token))
        assert r.status_code == 403
        assert client.delete(f"/api/timelines/{sid}", headers=auth(other_teacher_token)).status_code == 403

    def test_admin_may_delete_foreign(self, client, teacher_token, admin_token):
        sid = client.post("/api/timelines", json=sample_payload(), headers=auth(teacher_token)).json()["id"]
        assert client.delete(f"/api/timelines/{sid}", headers=auth(admin_token)).status_code == 204


class TestTemplateAndExamples:
    def test_template_is_valid_payload(self, client, teacher_token):
        r = client.get("/api/timelines/template", headers=auth(teacher_token))
        assert r.status_code == 200
        tpl = r.json()
        assert "_ai_instructions" in tpl
        # The template itself must pass our own validation.
        r = client.post("/api/timelines", json=tpl, headers=auth(teacher_token))
        assert r.status_code == 201, r.text

    def test_examples_import_and_dedupe(self, client, teacher_token):
        r = client.post("/api/timelines/examples", headers=auth(teacher_token))
        assert r.status_code == 201, r.text
        created = r.json()
        # erdgeschichte / fruehe_menschen / antike / moderne_geschichte
        assert len(created) >= 4
        titles = {s["title"] for s in created}
        assert any("Antike" in t for t in titles)

        # Second import must not duplicate anything.
        r = client.post("/api/timelines/examples", headers=auth(teacher_token))
        assert r.status_code == 201
        assert r.json() == []

    def test_upload_json_file(self, client, teacher_token):
        import json as json_mod
        content = json_mod.dumps(sample_payload(title="Upload-Test")).encode()
        r = client.post(
            "/api/timelines/upload",
            files={"file": ("timeline.json", content, "application/json")},
            headers=auth(teacher_token),
        )
        assert r.status_code == 201
        assert r.json()["title"] == "Upload-Test"
