"""Umfrage-Einstellungen: anonym (kein Name) und eigene Gastfenster-Laenge.

``guest_minutes``: None = Schulvorgabe, 0 = bis die Umfrage geschlossen wird,
sonst 60 Minuten bis 30 Tage.
"""
from datetime import datetime, timedelta, timezone

import jwt

from api.config import settings
from api.models import BarometerSession
from .conftest import auth


def _umfrage(db, teacher, code="BA7001", vor_minuten=0, **kw) -> BarometerSession:
    s = BarometerSession(code=code, title="U", created_by=teacher.id, allow_guests=True, **kw)
    db.add(s); db.flush()
    s.guests_opened_at = datetime.now(timezone.utc) - timedelta(minutes=vor_minuten)
    db.flush()
    return s


def _join(client, code="BA7001", name="Bob"):
    return client.post("/api/guest/join", json={"code": code, "tool": "barometer", "name": name})


def _status(client, code="BA7001"):
    return client.get(f"/api/guest/status?tool=barometer&code={code}").json()


def _minuten_bis_exp(token: str) -> float:
    exp = jwt.decode(token, settings.secret_key, algorithms=["HS256"])["exp"]
    return (datetime.fromtimestamp(exp, timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 60


def _body(**kw):
    return {"title": "U", "questions": [{"text": "Wie?", "kind": "scale"}], **kw}


# ── anonym ──────────────────────────────────────────────────────────────────

def test_anonymous_survey_ignores_the_sent_name(client, db, teacher):
    _umfrage(db, teacher, anonymous=True)
    r = _join(client, name="Maxi Muster")
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Anonym"
    assert jwt.decode(r.json()["token"], settings.secret_key, algorithms=["HS256"])["name"] == "Anonym"


def test_named_survey_keeps_the_name(client, db, teacher):
    _umfrage(db, teacher)
    assert _join(client, name="Bob").json()["name"] == "Bob"


def test_hub_reports_anonymous(client, db, teacher):
    _umfrage(db, teacher, anonymous=True)
    m = client.get("/api/play/resolve/BA7001").json()["matches"]
    assert [x["anonymous"] for x in m if x["tool"] == "barometer"] == [True]


# ── eigene Fensterlaenge ────────────────────────────────────────────────────

def test_default_follows_the_school_setting(client, db, teacher):
    _umfrage(db, teacher, vor_minuten=91)
    assert _join(client).status_code == 403


def test_custom_window_outlasts_the_school_setting(client, db, teacher):
    _umfrage(db, teacher, vor_minuten=600, guest_minutes=24 * 60)
    st = _status(client)
    assert st["guest_minutes"] == 24 * 60 and st["guest_minutes_left"] == 24 * 60 - 600
    r = _join(client)
    assert r.status_code == 200
    assert 24 * 60 - 602 < _minuten_bis_exp(r.json()["token"]) <= 24 * 60 - 600


def test_custom_window_still_closes(client, db, teacher):
    s = _umfrage(db, teacher, vor_minuten=121, guest_minutes=120)
    assert _join(client).status_code == 403
    assert s.allow_guests is False


def test_open_until_closed_never_expires(client, db, teacher):
    _umfrage(db, teacher, vor_minuten=60 * 24 * 60, guest_minutes=0)
    st = _status(client)
    assert st["allow_guests"] is True and st["guest_minutes"] == 0
    r = _join(client)
    assert r.status_code == 200
    assert _minuten_bis_exp(r.json()["token"]) > 29 * 24 * 60


def test_open_until_closed_blocks_once_closed(client, db, teacher):
    _umfrage(db, teacher, guest_minutes=0, status="closed")
    assert _join(client).status_code == 403


# ── Anlegen, Bearbeiten, Klonen ─────────────────────────────────────────────

def test_create_update_clone_keep_the_settings(client, teacher_token):
    h = auth(teacher_token)
    r = client.post("/api/barometer", json=_body(anonymous=True, guest_minutes=0), headers=h)
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    assert r.json()["anonymous"] is True and r.json()["guest_minutes"] == 0

    r = client.patch(f"/api/barometer/{code}", json=_body(guest_minutes=7 * 24 * 60), headers=h)
    assert r.json()["anonymous"] is False and r.json()["guest_minutes"] == 7 * 24 * 60

    c = client.post(f"/api/barometer/{code}/clone", headers=h).json()
    assert c["guest_minutes"] == 7 * 24 * 60


def test_window_length_out_of_range_is_rejected(client, teacher_token):
    h = auth(teacher_token)
    for bad in (30, 30 * 24 * 60 + 1, -5):
        r = client.post("/api/barometer", json=_body(guest_minutes=bad), headers=h)
        assert r.status_code == 422, bad
