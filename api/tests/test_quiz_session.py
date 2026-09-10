"""
Tests for the real-time quiz session WebSocket flow.

Each test creates its own asyncio event loop via asyncio.run(), so all
WebSocket handlers share one event loop and cross-WS sends work correctly.
The ws_test_helper bypasses httpx/wsproto and directly exercises the ASGI interface.
"""
import asyncio
import pytest

from api.tests.ws_test_helper import bearer_headers, connect_ws
import api.routers.capuths as quiz_router
from api.database import get_db
from api.main import app
from api.models import Quiz, QuizQuestion, QuizAnswer, QuizSession, QuizParticipant, QuizResponse


# ---------------------------------------------------------------------------
# Reset module-level WS state between tests
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_ws_state():
    quiz_router._phases.clear()
    quiz_router.mgr.clear()
    quiz_router._empty_since.clear()
    yield
    quiz_router._phases.clear()
    quiz_router.mgr.clear()
    quiz_router._empty_since.clear()


# ---------------------------------------------------------------------------
# Data fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def two_question_quiz(db):
    """Q1=single-choice (correct answer: '4'), Q2=survey."""
    quiz = Quiz(title="Testquiz", max_points=100, time_limit_default=20)
    db.add(quiz)
    db.flush()

    q1 = QuizQuestion(quiz_id=quiz.id, order=0, type="single",
                      question_text="Was ist 2+2?", time_limit=10)
    db.add(q1)
    db.flush()

    a_wrong = QuizAnswer(question_id=q1.id, order=0, text="3", correct=False)
    a_right = QuizAnswer(question_id=q1.id, order=1, text="4", correct=True)
    db.add(a_wrong)
    db.add(a_right)
    db.flush()

    q2 = QuizQuestion(quiz_id=quiz.id, order=1, type="survey",
                      question_text="Lieblingsfach?")
    db.add(q2)
    db.flush()
    db.add(QuizAnswer(question_id=q2.id, order=0, text="Mathe"))
    db.add(QuizAnswer(question_id=q2.id, order=1, text="Sport"))
    db.flush()

    return {"quiz": quiz, "q1": q1, "correct_id": a_right.id, "wrong_id": a_wrong.id}


@pytest.fixture()
def game_session(db, two_question_quiz, klass, teacher):
    s = QuizSession(quiz_id=two_question_quiz["quiz"].id, class_id=klass.id,
                    teacher_id=teacher.id, join_code="GAME01")
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def p1(db, game_session):
    p = QuizParticipant(session_id=game_session.id, name="Lena", avatar="cat")
    db.add(p)
    db.flush()
    return p


@pytest.fixture()
def p2(db, game_session):
    p = QuizParticipant(session_id=game_session.id, name="Milo", avatar="dog")
    db.add(p)
    db.flush()
    return p


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Set per-test by the autouse fixture below — teacher WS connections must
# carry a verified identity since role= alone no longer grants control.
_TEACHER_HEADERS: list[tuple[bytes, bytes]] = []


@pytest.fixture(autouse=True)
def _ws_teacher_auth(teacher):
    global _TEACHER_HEADERS
    _TEACHER_HEADERS = bearer_headers(teacher.id)


def _scope(code: str, role: str = "student", participant_id: int = 0) -> dict:
    if role == "teacher":
        qs = b"role=teacher"
    else:
        # Unauthenticated players now need a live guest token scoped to this code.
        from api.auth import create_guest_token
        gt = create_guest_token(code, "Gast")
        qs = f"role=student&participant_id={participant_id}&guest_token={gt}".encode()
    return {
        "type": "websocket",
        "path": f"/api/sessions/{code}/ws",
        "raw_path": f"/api/sessions/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": qs,
        "headers": _TEACHER_HEADERS if role == "teacher" else [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


async def _drain_until(ws, event: str, max_messages: int = 15) -> dict:
    """Read messages from ws until one with the given event type is found."""
    for _ in range(max_messages):
        msg = await ws.receive_json()
        if msg.get("event") == event:
            return msg
    raise AssertionError(f"Event '{event}' not received within {max_messages} messages")


async def _advance_to_answering(teacher_ws, *student_wss) -> dict:
    """Drive from 'waiting' through question_preview to question_answering."""
    await teacher_ws.send_json({"action": "start"})
    await _drain_until(teacher_ws, "question_preview")
    for sw in student_wss:
        await _drain_until(sw, "question_preview")

    await teacher_ws.send_json({"action": "show_answers"})
    answering_msg = await _drain_until(teacher_ws, "question_answering")
    for sw in student_wss:
        await _drain_until(sw, "question_answering")

    return answering_msg


def _run(db, coro_fn):
    """Run an async test coroutine with the test DB injected."""
    app.dependency_overrides[get_db] = lambda: db
    try:
        asyncio.run(coro_fn())
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_teacher_receives_waiting_state_on_connect(db, game_session):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as ws:
            msg = await ws.receive_json()
            assert msg["event"] == "state"
            assert msg["status"] == "waiting"
    _run(db, run)


def test_student_receives_joined_event_on_connect(db, game_session, p1):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                msg = await student_ws.receive_json()
                assert msg["event"] == "joined"
                assert msg["name"] == "Lena"
    _run(db, run)


def test_teacher_notified_when_student_joins(db, game_session, p1):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                msg = await _drain_until(teacher_ws, "participant_joined")
                assert msg["name"] == "Lena"
    _run(db, run)


def test_question_preview_has_no_answers_field(db, game_session, p1):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                await teacher_ws.send_json({"action": "start"})
                preview = await _drain_until(student_ws, "question_preview")

                assert "answers" not in preview
                assert "question_text" in preview
                assert "question_idx" in preview
                assert "total_questions" in preview
                assert "time_limit" in preview
                assert "question_type" in preview
    _run(db, run)


def test_question_answering_has_question_type(db, game_session, p1):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                answering_msg = await _advance_to_answering(teacher_ws, student_ws)

                assert "question_type" in answering_msg
                assert "answers" in answering_msg
                assert "question_id" in answering_msg
                assert "time_limit" in answering_msg
    _run(db, run)


def test_student_answer_is_acknowledged(db, game_session, p1, two_question_quiz):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")
                await _advance_to_answering(teacher_ws, student_ws)

                await student_ws.send_json({"action": "answer",
                                            "answer_ids": [two_question_quiz["correct_id"]]})

                ack = await _drain_until(student_ws, "answer_received")
                assert ack["event"] == "answer_received"
    _run(db, run)


def test_teacher_receives_answer_update_when_student_answers(db, game_session, p1, two_question_quiz):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")
                await _advance_to_answering(teacher_ws, student_ws)

                await student_ws.send_json({"action": "answer",
                                            "answer_ids": [two_question_quiz["correct_id"]]})

                update = await _drain_until(teacher_ws, "answer_update")
                assert update["event"] == "answer_update"
    _run(db, run)


def test_answer_during_preview_phase_is_ignored(db, game_session, p1, two_question_quiz):
    """Students cannot answer during preview phase — counts stay 0 after reveal."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                await teacher_ws.send_json({"action": "start"})
                await _drain_until(teacher_ws, "question_preview")
                await _drain_until(student_ws, "question_preview")

                await student_ws.send_json({"action": "answer",
                                            "answer_ids": [two_question_quiz["correct_id"]]})

                await teacher_ws.send_json({"action": "show_answers"})
                await _drain_until(teacher_ws, "question_answering")
                await _drain_until(student_ws, "question_answering")

                await teacher_ws.send_json({"action": "next"})
                reveal = await _drain_until(teacher_ws, "reveal")

                total_answers = sum(reveal["answer_counts"].values())
                assert total_answers == 0
    _run(db, run)


def test_reveal_has_ranking_and_correct_answer_ids(db, game_session, p1, two_question_quiz):
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")
                await _advance_to_answering(teacher_ws, student_ws)

                await student_ws.send_json({"action": "answer",
                                            "answer_ids": [two_question_quiz["correct_id"]]})
                await _drain_until(student_ws, "answer_received")
                await _drain_until(teacher_ws, "answer_update")

                await teacher_ws.send_json({"action": "next"})
                reveal = await _drain_until(teacher_ws, "reveal")

                assert "correct_answer_ids" in reveal
                assert "answer_counts" in reveal

                # Ranking now comes as its own slide after the reveal
                await teacher_ws.send_json({"action": "next"})
                ranking_msg = await _drain_until(teacher_ws, "ranking")
                assert len(ranking_msg["ranking"]) >= 1
                entry = ranking_msg["ranking"][0]
                assert "pid" in entry
                assert "name" in entry
                assert "score" in entry
                assert "delta" in entry
                assert "rank" in entry
    _run(db, run)


def test_survey_reveal_has_null_correct_answer_ids(db, game_session, p1, two_question_quiz):
    """Survey questions have correct_answer_ids: null in the reveal."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                await _advance_to_answering(teacher_ws, student_ws)
                await teacher_ws.send_json({"action": "next"})  # reveal Q1
                reveal1 = await _drain_until(teacher_ws, "reveal")
                await _drain_until(student_ws, "reveal")
                assert reveal1["is_last"] is False

                await teacher_ws.send_json({"action": "next"})  # ranking slide
                await _drain_until(teacher_ws, "ranking")

                await teacher_ws.send_json({"action": "next"})
                await _drain_until(teacher_ws, "question_preview")
                await _drain_until(student_ws, "question_preview")
                await teacher_ws.send_json({"action": "show_answers"})
                await _drain_until(teacher_ws, "question_answering")
                await _drain_until(student_ws, "question_answering")

                await teacher_ws.send_json({"action": "next"})
                reveal2 = await _drain_until(teacher_ws, "reveal")

                assert reveal2["correct_answer_ids"] is None
                assert reveal2["is_last"] is True
    _run(db, run)


def test_speed_bonus_first_correct_answerer_gets_higher_delta(db, game_session, p1, p2, two_question_quiz):
    """First correct answerer earns more points than the second."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as ws1:
                await ws1.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                async with connect_ws(app, _scope("GAME01", participant_id=p2.id)) as ws2:
                    await ws2.receive_json()  # joined
                    await _drain_until(teacher_ws, "participant_joined")

                    await _advance_to_answering(teacher_ws, ws1, ws2)

                    await ws1.send_json({"action": "answer",
                                         "answer_ids": [two_question_quiz["correct_id"]]})
                    await _drain_until(ws1, "answer_received")
                    await _drain_until(teacher_ws, "answer_update")

                    await ws2.send_json({"action": "answer",
                                         "answer_ids": [two_question_quiz["correct_id"]]})
                    await _drain_until(ws2, "answer_received")
                    await _drain_until(teacher_ws, "answer_update")

                    await teacher_ws.send_json({"action": "next"})
                    await _drain_until(teacher_ws, "reveal")
                    await teacher_ws.send_json({"action": "next"})  # ranking slide
                    ranking_msg = await _drain_until(teacher_ws, "ranking")

                    deltas = {entry["name"]: entry["delta"] for entry in ranking_msg["ranking"]}
                    assert deltas["Lena"] > deltas["Milo"], (
                        "First correct answerer (Lena) should get higher delta than second (Milo)"
                    )
    _run(db, run)


def test_finished_event_includes_final_ranking_and_title(db, game_session, p1, two_question_quiz):
    """After the last question's reveal, next → finished with final_ranking."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                await _advance_to_answering(teacher_ws, student_ws)
                await teacher_ws.send_json({"action": "next"})
                await _drain_until(teacher_ws, "reveal")
                await _drain_until(student_ws, "reveal")
                await teacher_ws.send_json({"action": "next"})  # ranking slide
                await _drain_until(teacher_ws, "ranking")

                await teacher_ws.send_json({"action": "next"})
                await _drain_until(teacher_ws, "question_preview")
                await _drain_until(student_ws, "question_preview")
                await teacher_ws.send_json({"action": "show_answers"})
                await _drain_until(teacher_ws, "question_answering")
                await _drain_until(student_ws, "question_answering")
                await teacher_ws.send_json({"action": "next"})
                reveal2 = await _drain_until(teacher_ws, "reveal")
                await _drain_until(student_ws, "reveal")
                assert reveal2["is_last"] is True
                await teacher_ws.send_json({"action": "next"})  # ranking slide
                await _drain_until(teacher_ws, "ranking")

                await teacher_ws.send_json({"action": "next"})
                finished = await _drain_until(teacher_ws, "finished")

                assert finished["event"] == "finished"
                assert "final_ranking" in finished
                assert "quiz_title" in finished
                assert finished["quiz_title"] == "Testquiz"
    _run(db, run)


def test_teacher_reconnect_to_active_session_resyncs_state(db, game_session, p1, two_question_quiz):
    """A teacher who reconnects mid-game should receive current phase state, not 'waiting'."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                await teacher_ws.send_json({"action": "start"})
                await _drain_until(teacher_ws, "question_preview")
                await _drain_until(student_ws, "question_preview")
            # teacher_ws exits → disconnects

        # Teacher reconnects
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws2:
            resync = await teacher_ws2.receive_json()
            assert resync["event"] != "state" or resync.get("status") != "waiting", (
                "Reconnecting teacher should receive current phase state, not 'waiting'"
            )
    _run(db, run)


def test_restart_resets_session_to_waiting(db, game_session, p1, two_question_quiz):
    """Teacher can restart an active session; all connected clients receive state=waiting."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await student_ws.receive_json()  # joined
                await _drain_until(teacher_ws, "participant_joined")

                await _advance_to_answering(teacher_ws, student_ws)

                # Submit an answer so there's data to clear
                await student_ws.send_json({"action": "answer",
                                            "answer_ids": [two_question_quiz["correct_id"]]})
                await _drain_until(student_ws, "answer_received")
                await _drain_until(teacher_ws, "answer_update")

                # Restart
                await teacher_ws.send_json({"action": "restart"})
                teacher_reset = await _drain_until(teacher_ws, "state")
                student_reset = await _drain_until(student_ws, "state")

                assert teacher_reset["status"] == "waiting"
                assert student_reset["status"] == "waiting"

                # Phase state cleared
                assert "GAME01" not in quiz_router._phases

                # Responses cleared from DB
                from api.models import QuizResponse
                responses = db.query(QuizResponse).filter_by(session_id=game_session.id).all()
                assert responses == []
    _run(db, run)


def test_inactivity_watchdog_cancels_empty_session(db, game_session):
    """A session with no connections for >= INACTIVITY_TIMEOUT seconds gets marked finished."""
    import time as _time

    def run():
        # Simulate: everyone disconnected long ago
        quiz_router._empty_since["GAME01"] = _time.time() - quiz_router.INACTIVITY_TIMEOUT - 1

        quiz_router._expire_stale_sessions(db)

        db.expire_all()
        s = db.query(QuizSession).filter_by(join_code="GAME01").first()
        assert s.status == "finished"
        assert "GAME01" not in quiz_router._empty_since

    app.dependency_overrides[get_db] = lambda: db
    try:
        run()
    finally:
        app.dependency_overrides.clear()

# ── Kein fremder Platz ───────────────────────────────────────────────────────

def _student_scope(code: str, student_id: int, participant_id: int) -> dict:
    """Verbindung eines *angemeldeten* Schuelers, mit behaupteter Teilnehmernummer."""
    sc = _scope(code, "student", participant_id)
    sc["query_string"] = f"role=student&participant_id={participant_id}".encode()
    sc["headers"] = bearer_headers(student_id, "student")
    return sc


def test_ein_schueler_kann_den_platz_eines_anderen_nicht_uebernehmen(db, game_session, klass):
    """Die participant_id kommt aus dem Browser. Ohne Pruefung liesse sich damit
    der Platz des Nachbarn belegen: seine Rueckmeldungen mitlesen und unter
    seinem Namen antworten."""
    from api.models import Student

    a = Student(nachname="Aal", vorname="Anna", klasse=klass.code, class_id=klass.id, active=True)
    b = Student(nachname="Bär", vorname="Ben", klasse=klass.code, class_id=klass.id, active=True)
    db.add_all([a, b])
    db.flush()
    platz_b = QuizParticipant(session_id=game_session.id, name="Ben B.", avatar="cat", student_id=b.id)
    db.add(platz_b)
    db.flush()

    async def run():
        # Anna behauptet, Bens Teilnehmer zu sein — sie hat selbst keinen Platz.
        # Der Handler nimmt die Verbindung an und schliesst dann; der Abbruch
        # zeigt sich also beim ersten Lesen, nicht schon beim Verbinden.
        async with connect_ws(app, _student_scope(game_session.join_code, a.id, platz_b.id)) as ws:
            with pytest.raises(ConnectionError):
                await ws.receive_json()
    _run(db, run)


def test_der_eigene_platz_wird_an_der_anmeldung_erkannt(db, game_session, klass):
    """Und zwar auch dann, wenn der Browser eine falsche Nummer mitschickt."""
    from api.models import Student

    a = Student(nachname="Aal", vorname="Anna", klasse=klass.code, class_id=klass.id, active=True)
    db.add(a)
    db.flush()
    platz_a = QuizParticipant(session_id=game_session.id, name="Anna A.", avatar="cat", student_id=a.id)
    db.add(platz_a)
    db.flush()

    async def run():
        async with connect_ws(app, _student_scope(game_session.join_code, a.id, 99999)) as ws:
            joined = await ws.receive_json()
            assert joined["event"] == "joined"
            assert joined["name"] == "Anna A."
    _run(db, run)


# ── Wiederverbinden ──────────────────────────────────────────────────────────

def test_alter_socket_traegt_beim_schliessen_den_neuen_nicht_aus(db, game_session, p1):
    """Das Handy wacht auf und verbindet neu — erst danach merkt der Server, dass
    der alte Socket weg ist. Dessen Aufraeumen trug frueher den *neuen* aus: der
    Gast bekam keine Nachricht mehr und die erste Frage erst nach dem Neuladen."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            alt_cm = connect_ws(app, _scope("GAME01", participant_id=p1.id))
            alt = await alt_cm.__aenter__()
            await _drain_until(alt, "joined")
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as neu:
                await _drain_until(neu, "joined")
                await alt_cm.__aexit__(None, None, None)

                await teacher_ws.send_json({"action": "start"})
                preview = await asyncio.wait_for(_drain_until(neu, "question_preview"), timeout=2)
                assert preview["question_idx"] == 0
    _run(db, run)


def test_state_bringt_die_lobby_mit(db, game_session, p1, p2):
    """Die Lehrkraft laedt neu: ohne Liste stuende dort »2 Teilnehmer« ohne Namen."""
    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            state = await teacher_ws.receive_json()
            assert state["event"] == "state"
            assert sorted(p["name"] for p in state["participants"]) == ["Lena", "Milo"]
    _run(db, run)


def test_verbindung_beendet_ihre_transaktion_vor_dem_warten(db, game_session, p1):
    """Jede offene Verbindung hielt ihre Datenbankverbindung, solange sie bestand:
    der Pool hat 15, eine Klasse mehr Kinder — danach stand die ganze App.

    Beobachtet wird das Commit, nicht der Pool: die Test-Session committet nie
    wirklich (conftest macht daraus ein flush), eine Pool-Belegung ist hier also
    nicht messbar."""
    commits = []
    flush = db.commit

    def spy():
        commits.append(1)
        flush()
    db.commit = spy

    async def run():
        async with connect_ws(app, _scope("GAME01", role="teacher")) as teacher_ws:
            await teacher_ws.receive_json()  # state
            await asyncio.sleep(0.05)
            vorher = len(commits)
            async with connect_ws(app, _scope("GAME01", participant_id=p1.id)) as student_ws:
                await _drain_until(student_ws, "joined")
                await _drain_until(teacher_ws, "participant_joined")
                await asyncio.sleep(0.05)
                assert len(commits) > vorher, "Schueler-Verbindung wartet mit offener Transaktion"
    _run(db, run)
