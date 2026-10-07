"""Der Gastzugang schliesst von selbst, wenn sein Fenster abgelaufen ist.

Gemeldet wurde der Dauerzustand: ein paar Sitzungen laufen noch, »Gäste
erlauben« steht seit Tagen an — und damit kommt jeder hinein, der den Code
kennt (bequemer als die eigene Anmeldung). Das Opt-in gilt deshalb nur so lange
wie das eingestellte Gastfenster, gerechnet ab dem Einschalten.

Sitzungen werden direkt über die db-Fixture angelegt, damit der TestClient kein
Login-Cookie mitschleppt: das Cookie würde den Bearer-Header schlagen.
"""
from datetime import datetime, timedelta, timezone

import jwt

from api.auth import guest_minutes_left
from api.config import settings
from api.models import ExitTicketSession, FragmentCollection, ToolSession
from .conftest import auth


def _exit_ticket(db, teacher, code="ET7001", allow=True, vor_minuten=0) -> ExitTicketSession:
    s = ExitTicketSession(code=code, title="T", question="Q?", created_by=teacher.id, allow_guests=allow)
    db.add(s); db.flush()
    s.guests_opened_at = datetime.now(timezone.utc) - timedelta(minutes=vor_minuten)
    db.flush()
    return s


def _join(client, code="ET7001", name="Bob"):
    return client.post("/api/guest/join", json={"code": code, "tool": "exit-ticket", "name": name})


def _status(client, code="ET7001"):
    return client.get(f"/api/guest/status?tool=exit-ticket&code={code}").json()


def _minuten_bis_exp(token: str) -> float:
    exp = jwt.decode(token, settings.secret_key, algorithms=["HS256"])["exp"]
    return (datetime.fromtimestamp(exp, timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 60


# ── offenes Fenster ─────────────────────────────────────────────────────────

def test_join_works_inside_the_window(client, db, teacher):
    _exit_ticket(db, teacher, vor_minuten=30)
    assert _join(client).status_code == 200
    assert _status(client)["guest_minutes_left"] == 60


def test_enabling_starts_the_window(client, db, teacher, teacher_token):
    _exit_ticket(db, teacher, allow=False, vor_minuten=500)
    r = client.patch("/api/guest/allow", json={"code": "ET7001", "tool": "exit-ticket", "allow": True},
                     headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    # Nicht der alte Zeitstempel, sondern jetzt — sonst wäre das Fenster beim
    # Einschalten schon abgelaufen.
    assert r.json()["guest_minutes_left"] == 90
    assert _join(client).status_code == 200


# ── abgelaufenes Fenster ────────────────────────────────────────────────────

def test_join_denied_once_the_window_elapsed(client, db, teacher):
    _exit_ticket(db, teacher, vor_minuten=91)
    assert _join(client).status_code == 403


def test_elapsed_window_switches_the_opt_in_off(client, db, teacher):
    """Der Schalter soll nicht nur wirkungslos, sondern sichtbar aus sein — die
    Hostansicht und die Sitzungslisten lesen `allow_guests` direkt."""
    s = _exit_ticket(db, teacher, vor_minuten=91)
    st = _status(client)
    assert st["allow_guests"] is False and st["guest_minutes_left"] == 0
    assert s.allow_guests is False


def test_session_without_a_timestamp_counts_as_closed(client, db, teacher):
    """Altbestand von vor dieser Spalte: genau die seit Tagen offenen
    Sitzungen, um die es geht."""
    s = _exit_ticket(db, teacher)
    s.guests_opened_at = None
    db.flush()
    assert _join(client).status_code == 403


def test_re_enabling_opens_a_fresh_window(client, db, teacher, teacher_token):
    _exit_ticket(db, teacher, vor_minuten=91)
    assert _join(client).status_code == 403
    client.patch("/api/guest/allow", json={"code": "ET7001", "tool": "exit-ticket", "allow": True},
                 headers=auth(teacher_token))
    assert _join(client).status_code == 200


def test_restart_opens_a_fresh_window(client, db, teacher, teacher_token):
    """»Neu starten« ist für den nächsten Kurs am selben gedruckten QR — der
    fängt bei voller Zeit an."""
    _exit_ticket(db, teacher, vor_minuten=91)
    r = client.post("/api/guest/restart", json={"code": "ET7001", "tool": "exit-ticket"},
                    headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert r.json()["allow_guests"] is True and r.json()["guest_minutes_left"] == 90
    assert _join(client).status_code == 200


# ── Fensterlänge ────────────────────────────────────────────────────────────

def test_window_follows_the_school_setting(client, db, teacher, admin_token):
    client.put("/api/school/guest-settings", json={"guest_minutes": 45}, headers=auth(admin_token))
    _exit_ticket(db, teacher, vor_minuten=50)
    assert _join(client).status_code == 403


def test_token_never_outlives_the_window(client, db, teacher):
    """Wer in der letzten Minute beitritt, bekommt nicht noch einmal 90 — sonst
    liefe der Gastzugang doppelt so lang wie eingestellt."""
    _exit_ticket(db, teacher, vor_minuten=85)
    r = _join(client)
    assert r.json()["expires_in_minutes"] == 5
    assert 4 < _minuten_bis_exp(r.json()["token"]) <= 5


def test_tool_session_window_closes_too(client, db, teacher):
    """Zustandslose Werkzeuge haben absichtlich stabile Codes — dort ist ein
    offen stehendes Opt-in am gefährlichsten."""
    s = ToolSession(code="WAAGE8", tool_slug="gleichungswaage", created_by=teacher.id, allow_guests=True)
    db.add(s); db.flush()
    s.guests_opened_at = datetime.now(timezone.utc) - timedelta(minutes=91)
    db.flush()
    r = client.post("/api/guest/join", json={"code": "WAAGE8", "tool": "simulation", "name": "Gast"})
    assert r.status_code == 403


def test_pinboard_keeps_its_permanent_guest_code():
    """Pinnwände sind keine Sitzung: ihr Gastcode soll über Wochen gelten, und
    sie haben eigene Endpunkte. Ohne die Spalte bleibt das Opt-in unbefristet."""
    assert guest_minutes_left(FragmentCollection(), 90) == 90
