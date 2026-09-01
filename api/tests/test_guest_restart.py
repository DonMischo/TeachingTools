"""»Gastzugang neu starten«: bereits ausgegebene Gast-Token entziehen.

Ein gedruckter QR überlebt mehrere Klassen — der Code bleibt derselbe, damit
der Aushang weiter stimmt. Ohne diesen Schalter hätte die vorige Gruppe aber
bis zu 60 Minuten weiter Zugang, während die nächste denselben Code scannt.

Sitzungen werden direkt über die db-Fixture angelegt, damit der TestClient kein
Login-Cookie mitschleppt: das Cookie würde den Bearer-Header schlagen.
"""
from datetime import datetime, timedelta, timezone

from jose import jwt

from api.config import settings
from api.auth import create_guest_token, decode_guest_token, guest_access_restarted
from api.models import ExitTicketSession, Teacher, ToolSession
from api.auth import hash_password
from .conftest import auth


def guest_auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _exit_ticket(db, teacher, code="ET9001", allow=True) -> ExitTicketSession:
    s = ExitTicketSession(code=code, title="T", question="Q?", created_by=teacher.id, allow_guests=allow)
    db.add(s); db.flush()
    return s


# ── Token-Ebene ─────────────────────────────────────────────────────────────

def test_token_valid_before_restart(db, teacher):
    _exit_ticket(db, teacher)
    tok = create_guest_token("ET9001", "Alice")
    assert decode_guest_token(tok, "ET9001", db) is not None


def test_token_dead_after_restart(db, teacher):
    s = _exit_ticket(db, teacher)
    tok = create_guest_token("ET9001", "Alice", s.guest_epoch)
    s.guest_epoch += 1
    db.flush()
    assert decode_guest_token(tok, "ET9001", db) is None
    # Ohne DB-Sitzung bleibt es bei der reinen Token-Prüfung.
    assert decode_guest_token(tok, "ET9001") is not None


def test_token_issued_after_restart_still_works(db, teacher):
    s = _exit_ticket(db, teacher)
    s.guest_epoch = 3
    db.flush()
    fresh = create_guest_token("ET9001", "Bob", s.guest_epoch)
    assert decode_guest_token(fresh, "ET9001", db) is not None


def test_legacy_token_without_gen_is_cleared_by_restart(db, teacher):
    """Token aus der Zeit vor dem gen-Feld sind genau die, die weg sollen."""
    s = _exit_ticket(db, teacher)
    legacy = jwt.encode(
        {"sub": "g1", "type": "guest", "name": "Alt", "scope": "ET9001",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        settings.secret_key, algorithm="HS256",
    )
    assert decode_guest_token(legacy, "ET9001", db) is not None
    s.guest_epoch += 1
    db.flush()
    assert decode_guest_token(legacy, "ET9001", db) is None


def test_unknown_code_is_never_rejected(db):
    """Fragment-Sammlungen haben eigene guest_codes ausserhalb der Registry."""
    assert guest_access_restarted(db, "NOTACODE", None) is False


# ── Endpunkt ────────────────────────────────────────────────────────────────

def test_restart_bumps_epoch_and_keeps_opt_in(client, db, teacher, teacher_token):
    _exit_ticket(db, teacher)
    r = client.post("/api/guest/restart", json={"code": "ET9001", "tool": "exit-ticket"},
                    headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["guest_epoch"] == 1
    # Neu starten heisst nicht abschalten — der Code bleibt offen für Gäste.
    assert body["allow_guests"] is True


def test_status_reports_restart(client, db, teacher, teacher_token):
    _exit_ticket(db, teacher)
    assert client.get("/api/guest/status?tool=exit-ticket&code=ET9001").json()["guest_epoch"] == 0
    client.post("/api/guest/restart", json={"code": "ET9001", "tool": "exit-ticket"},
                headers=auth(teacher_token))
    assert client.get("/api/guest/status?tool=exit-ticket&code=ET9001").json()["guest_epoch"] == 1


def test_restart_is_owner_only(client, db, teacher, teacher_token):
    """Eine fremde Lehrkraft wirft niemanden aus meiner Sitzung."""
    other = Teacher(first_name="Bea", last_name="Fremd", active=True,
                    password_hash=hash_password("secret"), role="teacher")
    db.add(other); db.flush()
    _exit_ticket(db, other)  # gehört Bea, nicht der Fixture-Lehrkraft
    r = client.post("/api/guest/restart", json={"code": "ET9001", "tool": "exit-ticket"},
                    headers=auth(teacher_token))
    assert r.status_code == 403


def test_restart_requires_a_teacher(client, db, teacher):
    _exit_ticket(db, teacher)
    assert client.post("/api/guest/restart", json={"code": "ET9001", "tool": "exit-ticket"}).status_code == 401


def test_guest_can_rejoin_after_restart(client, db, teacher, teacher_token):
    """Der Weg zurück bleibt offen: neu beitreten geht sofort wieder."""
    _exit_ticket(db, teacher)
    old = client.post("/api/guest/join", json={"code": "ET9001", "tool": "exit-ticket", "name": "Alice"})
    assert old.status_code == 200
    client.post("/api/guest/restart", json={"code": "ET9001", "tool": "exit-ticket"},
                headers=auth(teacher_token))

    assert decode_guest_token(old.json()["token"], "ET9001", db) is None
    again = client.post("/api/guest/join", json={"code": "ET9001", "tool": "exit-ticket", "name": "Alice"})
    assert again.status_code == 200
    assert decode_guest_token(again.json()["token"], "ET9001", db) is not None


def test_restart_works_for_a_tool_session(client, db, teacher, teacher_token):
    """Der gemeldete Fall: Gleichungswaage, stabiler Code, neue Klasse."""
    s = ToolSession(code="WAAGE7", tool_slug="gleichungswaage", created_by=teacher.id, allow_guests=True)
    db.add(s); db.flush()
    tok = client.post("/api/guest/join", json={"code": "WAAGE7", "tool": "simulation", "name": "Gast"}).json()["token"]
    assert decode_guest_token(tok, "WAAGE7", db) is not None

    r = client.post("/api/guest/restart", json={"code": "WAAGE7", "tool": "simulation"},
                    headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert decode_guest_token(tok, "WAAGE7", db) is None
