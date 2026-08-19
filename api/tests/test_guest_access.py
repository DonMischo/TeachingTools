"""Guest (QR / join-link) access: opt-in, 60-min expiry, session scoping.

Sessions are seeded directly via the db fixture so the TestClient carries no
login cookie — guest requests then authenticate purely off the Bearer guest
token (a lingering teacher cookie would otherwise beat the header)."""
from datetime import datetime, timedelta, timezone

from jose import jwt

from api.config import settings
from api.auth import create_guest_token, decode_guest_token
from api.models import (
    ExitTicketSession, ExitGame, ExitGameSession, ExitGameAttempt, Class,
    SchreibraumRoom, SchreibraumParticipant, SchreibraumDocument,
)
from .conftest import auth


def guest_auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _expired_guest_token(code: str, name: str = "Gast") -> str:
    payload = {
        "sub": "guest-1", "type": "guest", "name": name, "scope": code,
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


# ── token unit behaviour ────────────────────────────────────────────────────

def test_token_roundtrip_and_scope():
    tok = create_guest_token("ABC123", "Alice")
    g = decode_guest_token(tok, "ABC123")
    assert g is not None and g.name == "Alice" and g.scope == "ABC123"
    # Wrong session code → rejected (scope binding)
    assert decode_guest_token(tok, "OTHER") is None


def test_expired_token_rejected():
    assert decode_guest_token(_expired_guest_token("ABC123"), "ABC123") is None


# ── opt-in on /api/guest/join ───────────────────────────────────────────────

def _exit_ticket(db, teacher, code="ET0001", allow=False) -> ExitTicketSession:
    s = ExitTicketSession(code=code, title="T", question="Q?", created_by=teacher.id, allow_guests=allow)
    db.add(s); db.flush()
    return s


def test_guest_join_denied_when_not_opted_in(client, db, teacher):
    _exit_ticket(db, teacher, allow=False)
    r = client.post("/api/guest/join", json={"code": "ET0001", "tool": "exit-ticket", "name": "Bob"})
    assert r.status_code == 403


def test_guest_join_issues_token_when_opted_in(client, db, teacher):
    _exit_ticket(db, teacher, allow=True)
    r = client.post("/api/guest/join", json={"code": "ET0001", "tool": "exit-ticket", "name": "Bob"})
    assert r.status_code == 200
    tok = r.json()["token"]
    assert decode_guest_token(tok, "ET0001") is not None


def test_guest_join_unknown_session_404(client, db, teacher):
    r = client.post("/api/guest/join", json={"code": "NOPE", "tool": "exit-ticket", "name": "Bob"})
    assert r.status_code == 404


def test_guest_join_unknown_tool_400(client, db, teacher):
    r = client.post("/api/guest/join", json={"code": "X", "tool": "nonsense", "name": "Bob"})
    assert r.status_code == 400


# ── teacher opt-in toggle ───────────────────────────────────────────────────

def test_teacher_can_toggle_allow_guests(client, db, teacher, teacher_token):
    _exit_ticket(db, teacher, allow=False)
    r = client.patch("/api/guest/allow", json={"code": "ET0001", "tool": "exit-ticket", "allow": True},
                     headers=auth(teacher_token))
    assert r.status_code == 200 and r.json()["allow_guests"] is True
    # Guest join now succeeds
    client.cookies.clear()
    assert client.post("/api/guest/join",
                       json={"code": "ET0001", "tool": "exit-ticket", "name": "Bob"}).status_code == 200


def test_guest_token_rejected_by_teacher_endpoint(client, db, teacher):
    """A guest token must never satisfy a teacher-only dependency."""
    _exit_ticket(db, teacher, allow=True)
    tok = create_guest_token("ET0001", "Bob")
    r = client.patch("/api/guest/allow", json={"code": "ET0001", "tool": "exit-ticket", "allow": True},
                     headers=guest_auth(tok))
    assert r.status_code == 401


# ── exitgame: the true hard-blocker, now guest-playable ─────────────────────

def _exitgame_session(db, teacher, code="EG0001", allow=True) -> ExitGameSession:
    cls = Class(code=f"cls-{code}", display_name=f"Klasse {code}"); db.add(cls); db.flush()
    game = ExitGame(title="Escape", subject="Mathe", created_by=teacher.id,
                    data={"slides": [{"id": "s1", "tasks": []}]})
    db.add(game); db.flush()
    s = ExitGameSession(exitgame_id=game.id, class_id=cls.id, teacher_id=teacher.id,
                        join_code=code, status="open", allow_guests=allow)
    db.add(s); db.flush()
    return s


def test_exitgame_attempt_requires_identity_or_guest_token(client, db, teacher):
    _exitgame_session(db, teacher)
    # No credentials at all → 401 (previously the endpoint required a logged-in user)
    assert client.post("/api/exitgame-sessions/EG0001/attempts").status_code == 401


def test_exitgame_guest_can_start_attempt(client, db, teacher):
    _exitgame_session(db, teacher)
    tok = create_guest_token("EG0001", "Gast Greta")
    r = client.post("/api/exitgame-sessions/EG0001/attempts", headers=guest_auth(tok))
    assert r.status_code == 201
    # Attempt is keyed to the guest, carrying the chosen name
    attempt = db.query(ExitGameAttempt).one()
    assert attempt.guest_id is not None and attempt.guest_name == "Gast Greta"
    assert attempt.student_id is None and attempt.teacher_id is None


def test_exitgame_expired_guest_token_blocked(client, db, teacher):
    _exitgame_session(db, teacher)
    r = client.post("/api/exitgame-sessions/EG0001/attempts",
                    headers=guest_auth(_expired_guest_token("EG0001")))
    assert r.status_code == 401


def test_exitgame_guest_token_wrong_session_blocked(client, db, teacher):
    _exitgame_session(db, teacher, code="EG0001")
    _exitgame_session(db, teacher, code="EG0002")
    tok = create_guest_token("EG0002", "Gast")  # scoped to the OTHER session
    r = client.post("/api/exitgame-sessions/EG0001/attempts", headers=guest_auth(tok))
    assert r.status_code == 401


# ── schreibraum: guest joins a room by code when opted in ───────────────────

def _schreibraum_room(db, teacher, code="SR0001", allow=True) -> SchreibraumRoom:
    room = SchreibraumRoom(code=code, title="Raum", created_by=teacher.id, allow_guests=allow)
    db.add(room); db.flush()
    db.add(SchreibraumDocument(room_id=room.id)); db.flush()
    return room


def test_schreibraum_guest_denied_when_not_opted_in(client, db, teacher):
    _schreibraum_room(db, teacher, allow=False)
    tok = create_guest_token("SR0001", "Gast")
    r = client.get("/api/schreibraum/rooms/by-code/SR0001", headers=guest_auth(tok))
    assert r.status_code == 403


def test_schreibraum_guest_can_join_when_opted_in(client, db, teacher):
    room = _schreibraum_room(db, teacher, allow=True)
    tok = create_guest_token("SR0001", "Gast Greta")
    r = client.get("/api/schreibraum/rooms/by-code/SR0001", headers=guest_auth(tok))
    assert r.status_code == 200 and r.json()["allow_guests"] is True
    j = client.post(f"/api/schreibraum/rooms/{room.id}/join", headers=guest_auth(tok))
    assert j.status_code == 200, j.text
    body = j.json()
    assert body["name"] == "Gast Greta" and not body["is_teacher"]
    guest_p = db.query(SchreibraumParticipant).filter(SchreibraumParticipant.guest_id.isnot(None)).one()
    assert guest_p.name == "Gast Greta" and guest_p.teacher_id is None and guest_p.student_id is None


def test_schreibraum_guest_no_token_rejected(client, db, teacher):
    _schreibraum_room(db, teacher, allow=True)
    assert client.get("/api/schreibraum/rooms/by-code/SR0001").status_code == 401
