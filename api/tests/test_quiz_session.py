"""
Tests for the real-time quiz session WebSocket flow.

Each test creates its own asyncio event loop via asyncio.run(), so all
WebSocket handlers share one event loop and cross-WS sends work correctly.
The ws_test_helper bypasses httpx/wsproto and directly exercises the ASGI interface.
"""
import asyncio
import pytest

from api.tests.ws_test_helper import connect_ws
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
    quiz_router.mgr._rooms.clear()
    quiz_router._empty_since.clear()
    yield
    quiz_router._phases.clear()
    quiz_router.mgr._rooms.clear()
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

def _scope(code: str, role: str = "student", participant_id: int = 0) -> dict:
    if role == "teacher":
        qs = b"role=teacher"
    else:
        qs = f"role=student&participant_id={participant_id}".encode()
    return {
        "type": "websocket",
        "path": f"/api/sessions/{code}/ws",
        "raw_path": f"/api/sessions/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": qs,
        "headers": [],
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
                assert "ranking" in reveal
                assert "answer_counts" in reveal
                assert len(reveal["ranking"]) >= 1
                entry = reveal["ranking"][0]
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
                    reveal = await _drain_until(teacher_ws, "reveal")

                    deltas = {entry["name"]: entry["delta"] for entry in reveal["ranking"]}
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
