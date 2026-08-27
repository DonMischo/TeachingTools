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
