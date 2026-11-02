"""Gaeste sind eigenstaendige Spieler, auch bei gleichem Namen.

Zwei Kinder tippen "Max" ein — frueher erkannte Caputh den Wiedereinstieg allein
am Namen und steckte beide auf denselben Teilnehmer: geteilte Punkte, geteilte
Antworten, und der zweite Avatar verschwand. Massgeblich ist jetzt die Id im
Gast-Token, die pro Beitritt neu vergeben wird.

Der Lueckentext hatte das umgekehrte Problem: gar keine Wiedererkennung, jedes
Neuladen legte einen weiteren Teilnehmer an.
"""
from api.auth import create_guest_token
from api.models import (
    LueckentextParticipant, LueckentextSession, LueckentextSet,
    Quiz, QuizParticipant, QuizSession,
)


def _guest(code: str, name: str) -> dict:
    return {"Authorization": f"Bearer {create_guest_token(code, name)}"}


# ── Caputh ──────────────────────────────────────────────────────────────────

def _quiz_session(db, klass, teacher, code="GUEST1") -> QuizSession:
    quiz = Quiz(title="Testquiz", max_points=100, time_limit_default=20)
    db.add(quiz); db.flush()
    s = QuizSession(quiz_id=quiz.id, class_id=klass.id, teacher_id=teacher.id,
                    join_code=code, allow_guests=True)
    db.add(s); db.flush()
    return s


def test_two_guests_with_the_same_name_stay_apart(client, db, klass, teacher):
    s = _quiz_session(db, klass, teacher)
    body = lambda avatar: {"name": "Max", "avatar": avatar}

    client.cookies.clear()
    a = client.post("/api/sessions/GUEST1/join", json=body("cat"), headers=_guest("GUEST1", "Max"))
    client.cookies.clear()
    b = client.post("/api/sessions/GUEST1/join", json=body("dog"), headers=_guest("GUEST1", "Max"))

    assert a.status_code == 201 and b.status_code == 201
    assert a.json()["participant_id"] != b.json()["participant_id"]
    assert b.json()["rejoined"] is False
    # Jeder behaelt seinen eigenen Avatar.
    assert a.json()["avatar"] == "cat" and b.json()["avatar"] == "dog"
    assert db.query(QuizParticipant).filter_by(session_id=s.id).count() == 2


def test_same_guest_token_rejoins_instead_of_duplicating(client, db, klass, teacher):
    s = _quiz_session(db, klass, teacher)
    headers = _guest("GUEST1", "Max")

    client.cookies.clear()
    a = client.post("/api/sessions/GUEST1/join", json={"name": "Max", "avatar": "cat"}, headers=headers)
    client.cookies.clear()
    b = client.post("/api/sessions/GUEST1/join", json={"name": "Max", "avatar": "dog"}, headers=headers)

    assert a.json()["participant_id"] == b.json()["participant_id"]
    assert b.json()["rejoined"] is True
    # Beim Wiedereinstieg zaehlt die frische Wahl.
    assert b.json()["avatar"] == "dog"
    assert db.query(QuizParticipant).filter_by(session_id=s.id).count() == 1


def test_logged_in_players_still_rejoin_by_name(client, db, klass, teacher, teacher_token):
    """Angemeldete haben einen stabilen Namen — ihr Wiedereinstieg bleibt wie er war."""
    s = _quiz_session(db, klass, teacher)
    payload = {"name": "Anna Müller", "avatar": "cat"}

    a = client.post("/api/sessions/GUEST1/join", json=payload)
    b = client.post("/api/sessions/GUEST1/join", json=payload)

    assert a.json()["participant_id"] == b.json()["participant_id"]
    assert b.json()["rejoined"] is True
    assert db.query(QuizParticipant).filter_by(session_id=s.id).count() == 1


# ── Lueckentext ─────────────────────────────────────────────────────────────

def _lt_session(db, teacher, code="GUEST2") -> LueckentextSession:
    lt = LueckentextSet(title="LT", text="Es {{a}}.")
    db.add(lt); db.flush()
    s = LueckentextSession(lueckentext_id=lt.id, join_code=code, teacher_id=teacher.id,
                           allow_guests=True)
    db.add(s); db.flush()
    return s


def test_lueckentext_guest_rejoin_does_not_duplicate(client, db, teacher):
    s = _lt_session(db, teacher)
    headers = _guest("GUEST2", "Max")

    client.cookies.clear()
    a = client.post("/api/lueckentexte/sessions/GUEST2/join", json={"name": "Max", "avatar": "cat"}, headers=headers)
    client.cookies.clear()
    b = client.post("/api/lueckentexte/sessions/GUEST2/join", json={"name": "Max", "avatar": "dog"}, headers=headers)

    assert a.status_code == 201 and b.status_code == 201
    assert a.json()["id"] == b.json()["id"]
    assert db.query(LueckentextParticipant).filter_by(session_id=s.id).count() == 1


def test_lueckentext_two_guests_same_name_stay_apart(client, db, teacher):
    s = _lt_session(db, teacher)

    client.cookies.clear()
    a = client.post("/api/lueckentexte/sessions/GUEST2/join", json={"name": "Max", "avatar": "cat"}, headers=_guest("GUEST2", "Max"))
    client.cookies.clear()
    b = client.post("/api/lueckentexte/sessions/GUEST2/join", json={"name": "Max", "avatar": "dog"}, headers=_guest("GUEST2", "Max"))

    assert a.json()["id"] != b.json()["id"]
    assert db.query(LueckentextParticipant).filter_by(session_id=s.id).count() == 2


# ── Spielstand nach Namen (TaskCrawler, Challenge) ─────────────────────────

def _tool_session(db, teacher, code="NAME01"):
    from datetime import datetime, timezone
    from api.models import ToolSession
    s = ToolSession(code=code, tool_slug="challenge", created_by=teacher.id, allow_guests=True)
    db.add(s); db.flush()
    s.guests_opened_at = datetime.now(timezone.utc)
    db.flush()
    return s


def _sub(token: str) -> str:
    import jwt
    return jwt.decode(token, options={"verify_signature": False})["sub"]


def _join(client, name, previous=None, code="NAME01"):
    r = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name, "previous_token": previous})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_rejoin_with_the_same_name_keeps_the_guest_id(client, db, teacher):
    _tool_session(db, teacher)
    alt = _join(client, "Max Muster")
    assert _sub(_join(client, " max  muster ", previous=alt)) == _sub(alt)


def test_previous_token_of_another_name_or_code_is_ignored(client, db, teacher):
    _tool_session(db, teacher)
    alt = _join(client, "Max")
    assert _sub(_join(client, "Moritz", previous=alt)) != _sub(alt)
    fremd = create_guest_token("ANDERS", "Max")
    assert _sub(_join(client, "Max", previous=fremd)) != _sub(fremd)
    assert _sub(_join(client, "Max", previous="kaputt")) != _sub(alt)


def test_expired_previous_token_still_resumes(client, db, teacher):
    _tool_session(db, teacher)
    alt = create_guest_token("NAME01", "Max", minutes=-5)
    assert _sub(_join(client, "Max", previous=alt)) == _sub(alt)
