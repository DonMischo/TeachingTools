"""Umfrage (barometer) template download + JSON upload."""
import io
import json


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _upload(client, token, payload):
    client.cookies.clear()
    return client.post(
        "/api/barometer/upload",
        files={"file": ("umfrage.json", io.BytesIO(json.dumps(payload).encode()), "application/json")},
        headers=_auth(token),
    )


def test_template_is_uploadable_as_is(client, teacher_token):
    client.cookies.clear()
    r = client.get("/api/barometer/template", headers=_auth(teacher_token))
    assert r.status_code == 200
    tpl = r.json()
    assert "_ai_instructions" in tpl

    up = _upload(client, teacher_token, tpl)
    assert up.status_code == 201, up.json()
    created = up.json()
    assert created["title"] == tpl["title"]
    assert len(created["questions"]) == len(tpl["questions"])
    assert created["questions"][0]["scale_min_label"] == "trifft voll zu"


def test_upload_reports_all_problems_at_once(client, teacher_token):
    r = _upload(client, teacher_token, {"questions": [
        {"text": "", "scale_min": 1, "scale_max": 6},
        {"text": "Skala verdreht", "scale_min": 6, "scale_max": 1},
        {"text": "Zu viele Stufen", "scale_min": 0, "scale_max": 50},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any("title" in e for e in errors)
    assert any("questions[0]" in e and "text" in e for e in errors)
    assert any("questions[1]" in e for e in errors)
    assert any("questions[2]" in e and "Stufen" in e for e in errors)


def test_upload_needs_questions(client, teacher_token):
    r = _upload(client, teacher_token, {"title": "Leer", "questions": []})
    assert r.status_code == 422
    assert any("questions" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_broken_json(client, teacher_token):
    client.cookies.clear()
    r = client.post(
        "/api/barometer/upload",
        files={"file": ("umfrage.json", io.BytesIO(b"{nope"), "application/json")},
        headers=_auth(teacher_token),
    )
    assert r.status_code == 400
    assert "JSON" in r.json()["detail"]


def test_uploaded_umfrage_is_hostable(client, teacher_token):
    up = _upload(client, teacher_token, {
        "title": "Stimmungsbild",
        "questions": [{"text": "Wie geht es dir?", "scale_min": 1, "scale_max": 4,
                       "scale_min_label": "super", "scale_max_label": "mies"}],
    })
    code = up.json()["code"]
    client.cookies.clear()
    r = client.get(f"/api/barometer/{code}", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["questions"][0]["text"] == "Wie geht es dir?"
