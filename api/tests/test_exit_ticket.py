"""Exit Ticket — anonymous quick feedback after a lesson.

REST is creator-only (an exit ticket is never shared), and the WebSocket is
where the actual feedback flows: students submit, the host sees each response
live, and closing the session stops further submissions.

WS connections are driven through ws_test_helper so every handler shares one
event loop and cross-socket broadcasts really happen.
"""
import asyncio

import pytest

from api.auth import create_access_token, create_guest_token, hash_password
from api.main import app
from api.models import ExitTicketResponse, ExitTicketSession, Student, Teacher
import api.routers.exit_ticket as et
from api.tests.conftest import auth
from api.tests.ws_test_helper import bearer_headers, connect_ws

PREFIX = "/api/exit-ticket"


@pytest.fixture(autouse=True)
def clear_ws_state():
    et.mgr.clear()
    yield
    et.mgr.clear()


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Schmidt", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def student(db, klass) -> Student:
    s = Student(nachname="Schueler", vorname="Sam", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    return s


def head(t: Teacher) -> dict:
    return auth(create_access_token({"sub": str(t.id), "type": "teacher"}))


@pytest.fixture()
def session(client, db, teacher) -> dict:
    client.cookies.clear()
    r = client.post(PREFIX, headers=head(teacher),
                    json={"title": "Stunde 3", "question": "Was hast du gelernt?"})
    assert r.status_code == 201, r.text
    return r.json()


# ── REST ─────────────────────────────────────────────────────────────────────

def test_create_and_list_own_sessions(client, db, teacher, teacher2, session):
    listed = client.get(PREFIX, headers=head(teacher)).json()
    assert len(listed) == 1
    assert listed[0]["code"] == session["code"]
    assert listed[0]["title"] == "Stunde 3"
    assert listed[0]["status"] == "open"
    assert listed[0]["response_count"] == 0
    assert listed[0]["rating_enabled"] is True

    # Another teacher's list stays empty — exit tickets are creator-only.
    assert client.get(PREFIX, headers=head(teacher2)).json() == []


def test_list_counts_responses(client, db, teacher, session):
    s = db.query(ExitTicketSession).filter_by(code=session["code"]).one()
    db.add(ExitTicketResponse(session_id=s.id, student_name="Anonym", rating=4))
    db.flush()
    assert client.get(PREFIX, headers=head(teacher)).json()[0]["response_count"] == 1


def test_get_session_is_open_to_everyone(client, teacher, session):
    client.cookies.clear()
    r = client.get(f"{PREFIX}/{session['code']}")     # students scan the QR unauthenticated
    assert r.status_code == 200
    assert r.json()["question"] == "Was hast du gelernt?"
    assert r.json()["status"] == "open"
    assert client.get(f"{PREFIX}/NOPE12").status_code == 404


def test_clone_copies_the_question_into_a_fresh_session(client, db, teacher, teacher2, session):
    r = client.post(f"{PREFIX}/{session['code']}/clone", headers=head(teacher))
    assert r.status_code == 201
    assert r.json()["code"] != session["code"]

    clone = db.query(ExitTicketSession).filter_by(code=r.json()["code"]).one()
    assert (clone.title, clone.question, clone.rating_enabled) == ("Stunde 3", "Was hast du gelernt?", True)
    assert clone.status == "open"

    # Cloning someone else's exit ticket is refused; unknown codes 404.
    assert client.post(f"{PREFIX}/{session['code']}/clone", headers=head(teacher2)).status_code == 403
    assert client.post(f"{PREFIX}/NOPE12/clone", headers=head(teacher)).status_code == 404


def test_delete_is_creator_or_admin_only(client, db, teacher, teacher2, admin, session):
    assert client.delete(f"{PREFIX}/{session['code']}", headers=head(teacher2)).status_code == 403
    assert client.delete(f"{PREFIX}/{session['code']}", headers=head(admin)).status_code == 204
    assert db.query(ExitTicketSession).filter_by(code=session["code"]).first() is None
    assert client.delete(f"{PREFIX}/{session['code']}", headers=head(teacher)).status_code == 404


def test_delete_takes_the_responses_with_it(client, db, teacher, session):
    s = db.query(ExitTicketSession).filter_by(code=session["code"]).one()
    db.add(ExitTicketResponse(session_id=s.id, student_name="Anonym", rating=3))
    db.flush()
    sid = s.id

    assert client.delete(f"{PREFIX}/{session['code']}", headers=head(teacher)).status_code == 204
    assert db.query(ExitTicketResponse).filter_by(session_id=sid).count() == 0


# ── WebSocket ────────────────────────────────────────────────────────────────

def _scope(code: str, query: str, headers=None) -> dict:
    path = f"{PREFIX}/{code}/ws"
    return {
        "type": "websocket",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": query.encode(),
        "headers": headers or [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


def _teacher_scope(code: str, teacher: Teacher) -> dict:
    return _scope(code, "role=teacher", bearer_headers(teacher.id, "teacher"))


def _student_scope(code: str, student: Student, name="Sam Schueler") -> dict:
    return _scope(code, f"role=student&student_id={student.id}&student_name={name}",
                  bearer_headers(student.id, "student"))


def _guest_scope(code: str, name="Gast") -> dict:
    return _scope(code, f"role=student&guest_token={create_guest_token(code, name)}&student_name={name}")


def test_ws_rejects_unknown_session(client, teacher, session):
    """Abgewiesen wird nach dem accept(): vorher geschlossen, sieht der Browser
    statt 4004 nur einen Abbruch — und die Seite verbindet endlos neu."""
    async def run():
        async with connect_ws(app, _teacher_scope("NOPE12", teacher)) as ws:
            with pytest.raises(ConnectionError, match="4004"):
                await ws.receive_json()
    asyncio.run(run())


def test_ws_host_view_requires_a_teacher(client, student, session):
    """role=teacher off a student token must not open — responses carry names."""
    async def run():
        async with connect_ws(app, _scope(session["code"], "role=teacher",
                                          bearer_headers(student.id, "student"))) as ws:
            with pytest.raises(ConnectionError, match="4003"):
                await ws.receive_json()
    asyncio.run(run())


def test_ws_anonymous_student_without_a_guest_token_is_rejected(client, session):
    async def run():
        async with connect_ws(app, _scope(session["code"], "role=student")) as ws:
            with pytest.raises(ConnectionError, match="4001"):
                await ws.receive_json()
    asyncio.run(run())


def test_ws_teacher_gets_the_state_including_earlier_responses(client, db, teacher, session):
    s = db.query(ExitTicketSession).filter_by(code=session["code"]).one()
    db.add(ExitTicketResponse(session_id=s.id, student_name="Frueher", rating=5, comment="gut"))
    db.flush()

    async def run():
        async with connect_ws(app, _teacher_scope(session["code"], teacher)) as ws:
            msg = await ws.receive_json()
            assert msg["event"] == "state"
            assert msg["status"] == "open"
            assert msg["question"] == "Was hast du gelernt?"
            assert [r["student_name"] for r in msg["responses"]] == ["Frueher"]
            assert msg["participant_count"] == 0
    asyncio.run(run())


def test_ws_submit_reaches_the_host_live(client, db, teacher, student, session):
    async def run():
        async with connect_ws(app, _teacher_scope(session["code"], teacher)) as host:
            await host.receive_json()                       # initial state
            async with connect_ws(app, _student_scope(session["code"], student)) as ws:
                assert (await ws.receive_json())["event"] == "state"
                joined = await host.receive_json()
                assert joined == {"event": "participant_joined", "count": 1}

                await ws.send_json({"action": "submit", "rating": 4, "comment": "  Alles klar  "})
                assert (await ws.receive_json())["event"] == "submitted"

                new = await host.receive_json()
                assert new["event"] == "new_response"
                assert new["total"] == 1
                # Der Name kommt aus dem Konto in der Kurzform — nicht aus der
                # Query, die ihn frueher frei setzen konnte.
                assert new["response"]["student_name"] == "Sam S."
                assert new["response"]["rating"] == 4
                assert new["response"]["comment"] == "Alles klar"      # trimmed
    asyncio.run(run())

    stored = db.query(ExitTicketResponse).all()
    assert [(r.student_id, r.rating, r.comment) for r in stored] == [(student.id, 4, "Alles klar")]


def test_ws_resubmitting_updates_the_same_response(client, db, teacher, student, session):
    async def run():
        async with connect_ws(app, _student_scope(session["code"], student)) as ws:
            await ws.receive_json()
            await ws.send_json({"action": "submit", "rating": 2, "comment": "naja"})
            await ws.receive_json()
            await ws.send_json({"action": "submit", "rating": 5, "comment": "doch gut"})
            await ws.receive_json()
    asyncio.run(run())

    stored = db.query(ExitTicketResponse).all()
    assert len(stored) == 1
    assert (stored[0].rating, stored[0].comment) == (5, "doch gut")


def test_ws_rating_is_clamped_and_an_empty_comment_becomes_null(client, db, teacher, student, session):
    async def run():
        async with connect_ws(app, _student_scope(session["code"], student)) as ws:
            await ws.receive_json()
            await ws.send_json({"action": "submit", "rating": 99, "comment": "   "})
            await ws.receive_json()
    asyncio.run(run())

    r = db.query(ExitTicketResponse).one()
    assert r.rating == 5
    assert r.comment is None


def test_ws_guest_submits_anonymously(client, db, session):
    async def run():
        async with connect_ws(app, _guest_scope(session["code"])) as ws:
            await ws.receive_json()
            await ws.send_json({"action": "submit", "rating": 3, "comment": "ok"})
            assert (await ws.receive_json())["event"] == "submitted"
    asyncio.run(run())

    r = db.query(ExitTicketResponse).one()
    assert r.student_id is None
    assert r.student_name == "Gast"


def test_ws_close_stops_further_submissions(client, db, teacher, student, session):
    async def run():
        async with connect_ws(app, _teacher_scope(session["code"], teacher)) as host:
            await host.receive_json()
            await host.send_json({"action": "close"})
            assert (await host.receive_json()) == {"event": "closed"}

            async with connect_ws(app, _student_scope(session["code"], student)) as ws:
                state = await ws.receive_json()
                assert state["status"] == "closed"
                await host.receive_json()                   # participant_joined
                await ws.send_json({"action": "submit", "rating": 5})
                # Nothing is echoed back; give the handler a moment to prove it.
                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(ws.receive_json(), timeout=0.3)
    asyncio.run(run())

    assert db.query(ExitTicketResponse).count() == 0
    assert db.query(ExitTicketSession).filter_by(code=session["code"]).one().status == "closed"


def test_ws_students_cannot_close_a_session(client, db, teacher, student, session):
    async def run():
        async with connect_ws(app, _student_scope(session["code"], student)) as ws:
            await ws.receive_json()
            await ws.send_json({"action": "close"})
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(ws.receive_json(), timeout=0.3)
    asyncio.run(run())

    assert db.query(ExitTicketSession).filter_by(code=session["code"]).one().status == "open"


def test_fremde_lehrkraft_kommt_nicht_an_die_hostansicht(client, teacher2, session):
    """Die Rueckmeldungen sind namentlich und handeln von der Stunde *einer*
    Lehrkraft. Die Klasse schreibt sie in der Erwartung, dass genau sie sie
    liest — nicht das ganze Kollegium mit dem Code."""
    async def run():
        async with connect_ws(app, _teacher_scope(session["code"], teacher2)) as ws:
            with pytest.raises(ConnectionError, match="4003"):
                await ws.receive_json()
    asyncio.run(run())


def test_jeder_gast_zaehlt_als_eigener_teilnehmer(client, teacher, session):
    """Gaeste haben keine student_id. Unter dem gemeinsamen Platz 0 verdraengte
    jeder neue Gast den vorigen, und die Lehrkraft sah dauerhaft »1 Teilnehmer«."""
    async def run():
        async with connect_ws(app, _teacher_scope(session["code"], teacher)) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _guest_scope(session["code"], "Ada")) as ada:
                await ada.receive_json()
                assert await host.receive_json() == {"event": "participant_joined", "count": 1}
                async with connect_ws(app, _guest_scope(session["code"], "Ben")) as ben:
                    await ben.receive_json()
                    assert await host.receive_json() == {"event": "participant_joined", "count": 2}
    asyncio.run(run())


def test_die_eigene_lehrkraft_kommt_weiterhin_rein(client, teacher, session):
    async def run():
        async with connect_ws(app, _teacher_scope(session["code"], teacher)) as ws:
            state = await ws.receive_json()
            assert state["event"] == "state"
            assert state["responses"] == []
    asyncio.run(run())
