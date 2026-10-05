"""Länge des Gastfensters: Voreinstellung 90 Minuten, schulweit verstellbar.

Vorher stand die Stunde fest im Code (60 Minuten) — zu kurz für eine
Doppelstunde, und niemand konnte sie ändern, ohne neu zu deployen. Jetzt steht
sie in ``school_settings.guest_token_minutes`` und gilt ab dem nächsten
Beitritt; bereits ausgegebene Token tragen ihr Ablaufdatum im JWT.
"""
from datetime import datetime, timezone

import jwt

from api.auth import GUEST_MINUTES_MAX, GUEST_MINUTES_MIN, create_guest_token
from api.config import settings
from api.models import ExitTicketSession, SchoolSettings
from .conftest import auth


def _exit_ticket(db, teacher, code="ET9001") -> ExitTicketSession:
    s = ExitTicketSession(code=code, title="T", question="Q?", created_by=teacher.id, allow_guests=True)
    db.add(s); db.flush()
    return s


def _minutes_until_exp(token: str) -> float:
    exp = jwt.decode(token, settings.secret_key, algorithms=["HS256"])["exp"]
    return (datetime.fromtimestamp(exp, timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 60


# ── Voreinstellung ──────────────────────────────────────────────────────────

def test_default_window_is_90_minutes(client, db, teacher):
    _exit_ticket(db, teacher)
    r = client.post("/api/guest/join", json={"code": "ET9001", "tool": "exit-ticket", "name": "Bob"})
    assert r.status_code == 200
    assert r.json()["expires_in_minutes"] == 90
    # Die Zahl ist nicht nur Beschriftung — sie steht auch im Token.
    assert 89 < _minutes_until_exp(r.json()["token"]) <= 90


def test_join_reports_the_window_the_browser_must_use(client, db, teacher, admin_token):
    """Der Browser rät die Länge nicht selbst; sonst zeigt er den
    Abgelaufen-Schirm, während das Token noch gilt (oder umgekehrt)."""
    _exit_ticket(db, teacher)
    client.put("/api/school/guest-settings", json={"guest_minutes": 45}, headers=auth(admin_token))

    r = client.post("/api/guest/join", json={"code": "ET9001", "tool": "exit-ticket", "name": "Bob"})
    assert r.json()["expires_in_minutes"] == 45
    assert 44 < _minutes_until_exp(r.json()["token"]) <= 45


# ── Admin-Einstellung ───────────────────────────────────────────────────────

def test_admin_sets_the_window(client, db, admin_token):
    r = client.get("/api/school/guest-settings", headers=auth(admin_token))
    assert r.status_code == 200 and r.json()["guest_minutes"] == 90

    r = client.put("/api/school/guest-settings", json={"guest_minutes": 120}, headers=auth(admin_token))
    assert r.status_code == 200 and r.json()["guest_minutes"] == 120
    assert db.get(SchoolSettings, 1).guest_token_minutes == 120


def test_teacher_may_read_but_not_set(client, db, teacher_token):
    # Die Hostansicht schreibt die Zahl an den Schalter »Gäste erlauben«.
    assert client.get("/api/school/guest-settings", headers=auth(teacher_token)).status_code == 200
    r = client.put("/api/school/guest-settings", json={"guest_minutes": 480}, headers=auth(teacher_token))
    assert r.status_code == 403


def test_window_outside_the_bounds_is_refused(client, db, admin_token):
    for minutes in (GUEST_MINUTES_MIN - 1, GUEST_MINUTES_MAX + 1, 0, -5):
        r = client.put("/api/school/guest-settings", json={"guest_minutes": minutes}, headers=auth(admin_token))
        assert r.status_code == 422, minutes


# ── Bestandsschutz ──────────────────────────────────────────────────────────

def test_running_guests_keep_their_window(client, db, teacher, admin_token):
    """Eine Umstellung kürzt niemanden mitten in der Stunde: das Ablaufdatum
    steht im ausgegebenen Token. Wer laufende Gäste loswerden will, startet den
    Gastzugang der Sitzung neu."""
    _exit_ticket(db, teacher)
    tok = client.post(
        "/api/guest/join", json={"code": "ET9001", "tool": "exit-ticket", "name": "Bob"}
    ).json()["token"]

    client.put("/api/school/guest-settings", json={"guest_minutes": 15}, headers=auth(admin_token))
    assert 89 < _minutes_until_exp(tok) <= 90


def test_status_carries_the_window_for_the_host_view(client, db, teacher, admin_token):
    _exit_ticket(db, teacher)
    client.put("/api/school/guest-settings", json={"guest_minutes": 45}, headers=auth(admin_token))
    r = client.get("/api/guest/status", params={"tool": "exit-ticket", "code": "ET9001"})
    assert r.status_code == 200 and r.json()["guest_minutes"] == 45


def test_token_without_db_falls_back_to_the_configured_default():
    """Aufrufer ohne DB-Sitzung bekommen die Voreinstellung, kein 0-Minuten-Token."""
    assert 89 < _minutes_until_exp(create_guest_token("ABC123", "Alice")) <= 90
