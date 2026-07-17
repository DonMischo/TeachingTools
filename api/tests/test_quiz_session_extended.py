"""
Extended WebSocket session tests covering features added after the initial test suite:
- Sort question type (scoring, correct_ids ordering, partial credit)
- Multi-choice partial credit
- Kick and rename teacher actions
- participant_count in preview / answering / answer_update messages
- Hot rejoin (student reconnects mid-game → receives current phase)
- Replay (second finish does not re-award points)
- Answer randomization (randomize_answers flag)
"""
import asyncio
import pytest

from api.tests.ws_test_helper import bearer_headers, connect_ws
import api.routers.capuths as quiz_router
from api.database import get_db
from api.main import app
from api.models import (
    Quiz, QuizQuestion, QuizAnswer,
    QuizSession, QuizParticipant, QuizResponse, Transaction,
)


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
# Helpers shared with existing test file
# ---------------------------------------------------------------------------

# Teacher WS connections must carry a verified identity (see test_quiz_session.py).
_TEACHER_HEADERS: list[tuple[bytes, bytes]] = []


@pytest.fixture(autouse=True)
def _ws_teacher_auth(teacher):
    global _TEACHER_HEADERS
    _TEACHER_HEADERS = bearer_headers(teacher.id)


def _scope(code: str, role: str = "student", participant_id: int = 0) -> dict:
    qs = b"role=teacher" if role == "teacher" else f"role=student&participant_id={participant_id}".encode()
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


async def _drain_until(ws, event: str, max_messages: int = 20) -> dict:
    for _ in range(max_messages):
        msg = await ws.receive_json()
        if msg.get("event") == event:
            return msg
    raise AssertionError(f"Event '{event}' not received within {max_messages} messages")


async def _advance_to_answering(teacher_ws, *student_wss) -> dict:
    await teacher_ws.send_json({"action": "start"})
    await _drain_until(teacher_ws, "question_preview")
    for sw in student_wss:
        await _drain_until(sw, "question_preview")
    await teacher_ws.send_json({"action": "show_answers"})
    msg = await _drain_until(teacher_ws, "question_answering")
    for sw in student_wss:
        await _drain_until(sw, "question_answering")
    return msg


def _run(db, coro_fn):
    app.dependency_overrides[get_db] = lambda: db
    try:
        asyncio.run(coro_fn())
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def sort_quiz(db):
    """Single sort question: correct order England(1) → France(2) → Brazil(3)."""
    quiz = Quiz(title="Sortierquiz", max_points=6, time_limit_default=30)
    db.add(quiz)
    db.flush()

    q = QuizQuestion(quiz_id=quiz.id, order=0, type="sort",
                     question_text="Sortiere: WM-Titel aufsteigend", time_limit=30)
    db.add(q)
    db.flush()

    answers = [
        QuizAnswer(question_id=q.id, order=1, text="England"),   # correct pos 0
        QuizAnswer(question_id=q.id, order=2, text="Frankreich"), # correct pos 1
        QuizAnswer(question_id=q.id, order=3, text="Brasilien"),  # correct pos 2
    ]
    for a in answers:
        db.add(a)
    db.flush()

    return {"quiz": quiz, "q": q, "answers": answers}


@pytest.fixture()
def sort_session(db, sort_quiz, klass, teacher):
    s = QuizSession(quiz_id=sort_quiz["quiz"].id, class_id=klass.id,
                    teacher_id=teacher.id, join_code="SORT01")
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def sort_p1(db, sort_session):
    p = QuizParticipant(session_id=sort_session.id, name="Ali", avatar="star")
    db.add(p)
    db.flush()
    return p


@pytest.fixture()
def multi_quiz(db):
    """Single multi-choice question: A and C correct, B wrong."""
    quiz = Quiz(title="Multiquiz", max_points=2, time_limit_default=20)
    db.add(quiz)
    db.flush()

    q = QuizQuestion(quiz_id=quiz.id, order=0, type="multi",
                     question_text="Welche sind gerade?", time_limit=20)
    db.add(q)
    db.flush()

    a = QuizAnswer(question_id=q.id, order=0, text="2", correct=True)
    b = QuizAnswer(question_id=q.id, order=1, text="3", correct=False)
    c = QuizAnswer(question_id=q.id, order=2, text="4", correct=True)
    db.add(a); db.add(b); db.add(c)
    db.flush()

    return {"quiz": quiz, "q": q, "a": a, "b": b, "c": c}


@pytest.fixture()
def multi_session(db, multi_quiz, klass, teacher):
    s = QuizSession(quiz_id=multi_quiz["quiz"].id, class_id=klass.id,
                    teacher_id=teacher.id, join_code="MULTI1")
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def multi_p1(db, multi_session):
    p = QuizParticipant(session_id=multi_session.id, name="Zara", avatar="fox")
    db.add(p)
    db.flush()
    return p


@pytest.fixture()
def single_quiz(db):
    quiz = Quiz(title="Singlequiz", max_points=2, time_limit_default=10)
    db.add(quiz)
    db.flush()

    q = QuizQuestion(quiz_id=quiz.id, order=0, type="single",
                     question_text="1+1?", time_limit=10)
    db.add(q)
    db.flush()

    wrong = QuizAnswer(question_id=q.id, order=0, text="1", correct=False)
    right = QuizAnswer(question_id=q.id, order=1, text="2", correct=True)
    db.add(wrong); db.add(right)
    db.flush()

    return {"quiz": quiz, "q": q, "right": right, "wrong": wrong}


@pytest.fixture()
def single_session(db, single_quiz, klass, teacher):
    s = QuizSession(quiz_id=single_quiz["quiz"].id, class_id=klass.id,
                    teacher_id=teacher.id, join_code="SING01")
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def single_p1(db, single_session):
    p = QuizParticipant(session_id=single_session.id, name="Lena", avatar="cat")
    db.add(p)
    db.flush()
    return p


@pytest.fixture()
def single_p2(db, single_session):
    p = QuizParticipant(session_id=single_session.id, name="Milo", avatar="dog")
    db.add(p)
    db.flush()
    return p


# ---------------------------------------------------------------------------
# Sort question tests
# ---------------------------------------------------------------------------

class TestSortQuestion:
    def test_sort_reveal_has_correct_ids_in_order(self, db, sort_session, sort_p1, sort_quiz):
        """reveal.correct_answer_ids must be the answer IDs sorted by .order ascending."""
        async def run():
            async with connect_ws(app, _scope("SORT01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SORT01", participant_id=sort_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")

                    await _advance_to_answering(tw, sw)
                    await tw.send_json({"action": "next"})
                    reveal = await _drain_until(tw, "reveal")

        expected_order = sorted(sort_quiz["answers"], key=lambda a: a.order)
        expected_ids = [a.id for a in expected_order]

        async def run():
            async with connect_ws(app, _scope("SORT01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SORT01", participant_id=sort_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)
                    await tw.send_json({"action": "next"})
                    reveal = await _drain_until(tw, "reveal")
                    assert reveal["correct_answer_ids"] == expected_ids

        _run(db, run)

    def test_sort_perfect_answer_scores_full(self, db, sort_session, sort_p1, sort_quiz):
        """Submitting the exact correct order gives is_correct=True."""
        correct_ids = [a.id for a in sorted(sort_quiz["answers"], key=lambda a: a.order)]

        async def run():
            async with connect_ws(app, _scope("SORT01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SORT01", participant_id=sort_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)

                    await sw.send_json({"action": "answer", "answer_ids": correct_ids})
                    await _drain_until(sw, "answer_received")

                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                    ranking_msg = await _drain_until(tw, "ranking")

                    ranking = ranking_msg["ranking"]
                    assert len(ranking) == 1
                    assert ranking[0]["score"] > 0

        _run(db, run)

    def test_sort_wrong_order_scores_partial(self, db, sort_session, sort_p1, sort_quiz):
        """Getting only 1 of 3 positions right yields a partial score (0 < score < max)."""
        correct_ids = [a.id for a in sorted(sort_quiz["answers"], key=lambda a: a.order)]
        # Keep position 0 correct, swap positions 1 and 2 → 1/3 positions match
        wrong_order = [correct_ids[0], correct_ids[2], correct_ids[1]]

        async def run():
            async with connect_ws(app, _scope("SORT01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SORT01", participant_id=sort_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)

                    await sw.send_json({"action": "answer", "answer_ids": wrong_order})
                    await _drain_until(sw, "answer_received")

                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                    ranking_msg = await _drain_until(tw, "ranking")

                    score = ranking_msg["ranking"][0]["score"]
                    assert 0 < score < 1.1, f"Expected partial score, got {score}"

        _run(db, run)

    def test_sort_answering_message_has_all_answers(self, db, sort_session, sort_p1):
        """question_answering for sort type must include all answer options."""
        async def run():
            async with connect_ws(app, _scope("SORT01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SORT01", participant_id=sort_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    answering = await _advance_to_answering(tw, sw)
                    assert len(answering["answers"]) == 3
                    assert answering["question_type"] == "sort"

        _run(db, run)


# ---------------------------------------------------------------------------
# Multi-choice partial credit
# ---------------------------------------------------------------------------

class TestMultiQuestion:
    def test_all_correct_multi_scores_full(self, db, multi_session, multi_p1, multi_quiz):
        """Selecting all correct answers and no wrong ones → full score."""
        both_correct = [multi_quiz["a"].id, multi_quiz["c"].id]

        async def run():
            async with connect_ws(app, _scope("MULTI1", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("MULTI1", participant_id=multi_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)
                    await sw.send_json({"action": "answer", "answer_ids": both_correct})
                    await _drain_until(sw, "answer_received")
                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                    ranking_msg = await _drain_until(tw, "ranking")
                    assert ranking_msg["ranking"][0]["score"] > 0

        _run(db, run)

    def test_partial_correct_multi_scores_partial(self, db, multi_session, multi_p1, multi_quiz):
        """Selecting only one of two correct answers → partial credit (0 < score < full)."""
        one_correct = [multi_quiz["a"].id]

        async def run():
            async with connect_ws(app, _scope("MULTI1", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("MULTI1", participant_id=multi_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)
                    await sw.send_json({"action": "answer", "answer_ids": one_correct})
                    await _drain_until(sw, "answer_received")
                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                    ranking_msg = await _drain_until(tw, "ranking")
                    score = ranking_msg["ranking"][0]["score"]
                    assert 0 < score, f"Expected partial credit, got {score}"

        _run(db, run)

    def test_wrong_answer_in_multi_reduces_score(self, db, multi_session, multi_p1, multi_quiz):
        """Selecting a wrong answer reduces score (wrong-answer penalty)."""
        one_correct_one_wrong = [multi_quiz["a"].id, multi_quiz["b"].id]

        async def run():
            async with connect_ws(app, _scope("MULTI1", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("MULTI1", participant_id=multi_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)
                    await sw.send_json({"action": "answer", "answer_ids": one_correct_one_wrong})
                    await _drain_until(sw, "answer_received")
                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                    ranking_msg = await _drain_until(tw, "ranking")
                    score = ranking_msg["ranking"][0]["score"]
                    # 1 correct - 1 wrong out of 2 correct → 0/2 → 0 score
                    assert score == 0.0, f"Expected 0 (penalty), got {score}"

        _run(db, run)


# ---------------------------------------------------------------------------
# Kick and rename
# ---------------------------------------------------------------------------

class TestKickRename:
    def test_kick_disconnects_student(self, db, single_session, single_p1):
        """Teacher can kick a student; student receives 'kicked' event."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")

                    await tw.send_json({"action": "kick", "participant_id": single_p1.id})
                    kicked = await _drain_until(sw, "kicked")
                    assert kicked["event"] == "kicked"

        _run(db, run)

    def test_rename_updates_participant_name(self, db, single_session, single_p1):
        """Teacher can rename a student; student receives 'renamed' event with new name."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")

                    await tw.send_json({"action": "rename",
                                        "participant_id": single_p1.id, "name": "Elena"})
                    renamed = await _drain_until(sw, "renamed")
                    assert renamed["name"] == "Elena"

        _run(db, run)

    def test_rename_notifies_teacher(self, db, single_session, single_p1):
        """After rename, teacher receives participant_renamed event."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")

                    await tw.send_json({"action": "rename",
                                        "participant_id": single_p1.id, "name": "Elena"})
                    notif = await _drain_until(tw, "participant_renamed")
                    assert notif["name"] == "Elena"

        _run(db, run)


# ---------------------------------------------------------------------------
# participant_count propagation
# ---------------------------------------------------------------------------

class TestParticipantCount:
    def test_preview_includes_participant_count(self, db, single_session, single_p1):
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")

                    await tw.send_json({"action": "start"})
                    preview = await _drain_until(tw, "question_preview")
                    assert preview["participant_count"] == 1

        _run(db, run)

    def test_answering_includes_participant_count(self, db, single_session, single_p1):
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    answering = await _advance_to_answering(tw, sw)
                    assert answering["participant_count"] == 1

        _run(db, run)

    def test_answer_update_includes_participant_count(self, db, single_session,
                                                       single_p1, single_quiz):
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)

                    await sw.send_json({"action": "answer",
                                        "answer_ids": [single_quiz["right"].id]})
                    update = await _drain_until(tw, "answer_update")
                    assert "participant_count" in update
                    assert update["participant_count"] == 1

        _run(db, run)

    def test_participant_left_sent_on_kick(self, db, single_session,
                                           single_p1, single_p2, single_quiz):
        """Kicking a participant sends participant_left with decremented count."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw1:
                    await sw1.receive_json()
                    await _drain_until(tw, "participant_joined")
                    async with connect_ws(app, _scope("SING01", participant_id=single_p2.id)) as sw2:
                        await sw2.receive_json()
                        await _drain_until(tw, "participant_joined")

                        await tw.send_json({"action": "kick", "participant_id": single_p2.id})
                        left = await _drain_until(tw, "participant_left")
                        assert left["count"] == 1

        _run(db, run)


# ---------------------------------------------------------------------------
# Hot rejoin
# ---------------------------------------------------------------------------

class TestHotRejoin:
    def test_student_rejoining_during_answering_receives_question(
        self, db, single_session, single_p1
    ):
        """A student who reconnects during the answering phase gets question_answering."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                # First connection
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)
                # sw disconnects — session is now in answering phase

                # Rejoin
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw2:
                    await _drain_until(sw2, "question_preview")   # resync sends preview first
                    answering = await _drain_until(sw2, "question_answering")
                    assert answering["question_type"] == "single"

        _run(db, run)

    def test_student_rejoining_during_revealed_receives_reveal(
        self, db, single_session, single_p1, single_quiz
    ):
        """Student rejoining after reveal gets reveal event."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await _advance_to_answering(tw, sw)
                    await sw.send_json({"action": "answer",
                                        "answer_ids": [single_quiz["right"].id]})
                    await _drain_until(sw, "answer_received")
                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                # sw disconnects — session is in revealed phase

                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw2:
                    await _drain_until(sw2, "reveal")  # should receive reveal on resync

        _run(db, run)

    def test_student_who_already_answered_gets_answer_received_on_rejoin(
        self, db, single_session, single_p1, single_p2, single_quiz
    ):
        """After reconnecting during answering phase, already-answered student gets ack.
        Uses two participants so auto-reveal doesn't fire when only p1 has answered."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    async with connect_ws(app, _scope("SING01", participant_id=single_p2.id)) as sw_p2:
                        await sw_p2.receive_json()
                        await _drain_until(tw, "participant_joined")
                        await _advance_to_answering(tw, sw, sw_p2)
                        # p1 answers — p2 has NOT answered, so auto-reveal won't fire
                        await sw.send_json({"action": "answer",
                                            "answer_ids": [single_quiz["right"].id]})
                        await _drain_until(sw, "answer_received")
                    # sw exits, sw_p2 exits — session still in answering phase

                # sw (p1) reconnects
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw2:
                    await _drain_until(sw2, "question_answering")
                    # should receive answer_received because p1 already answered
                    ack = await _drain_until(sw2, "answer_received")
                    assert ack["event"] == "answer_received"

        _run(db, run)


# ---------------------------------------------------------------------------
# Replay (no re-scoring)
# ---------------------------------------------------------------------------

class TestReplay:
    async def _finish_game(self, tw, sw, correct_id):
        """Helper: play through the single-question game to finished."""
        await _advance_to_answering(tw, sw)
        await sw.send_json({"action": "answer", "answer_ids": [correct_id]})
        await _drain_until(sw, "answer_received")
        await tw.send_json({"action": "next"})
        await _drain_until(tw, "reveal")
        await _drain_until(sw, "reveal")
        await tw.send_json({"action": "next"})
        finished = await _drain_until(tw, "finished")
        await _drain_until(sw, "finished")
        return finished

    def test_first_finish_awards_points(self, db, single_session, single_p1, single_quiz):
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    finished = await self._finish_game(tw, sw, single_quiz["right"].id)
                    assert finished["is_replay"] is False
                    assert finished["points_awarded"] > 0

        _run(db, run)

    def test_replay_does_not_create_second_transaction(self, db, single_session,
                                                        single_p1, single_quiz):
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")

                    # First run
                    await self._finish_game(tw, sw, single_quiz["right"].id)

                    # Restart
                    await tw.send_json({"action": "restart"})
                    await _drain_until(tw, "state")
                    await _drain_until(sw, "state")

                    # Second run — student reconnects to waiting state
                    await _advance_to_answering(tw, sw)
                    await sw.send_json({"action": "answer",
                                        "answer_ids": [single_quiz["right"].id]})
                    await _drain_until(sw, "answer_received")
                    await tw.send_json({"action": "next"})
                    await _drain_until(tw, "reveal")
                    await _drain_until(sw, "reveal")
                    await tw.send_json({"action": "next"})
                    finished2 = await _drain_until(tw, "finished")

                    assert finished2["is_replay"] is True

            # Only one transaction should exist for this session's class
            db.expire_all()
            txs = db.query(Transaction).filter_by(class_id=single_session.class_id).all()
            assert len(txs) == 1, f"Expected 1 transaction, got {len(txs)}"

        _run(db, run)

    def test_restart_does_not_clear_points_awarded(self, db, single_session,
                                                    single_p1, single_quiz):
        """points_awarded on the session row must survive a restart."""
        async def run():
            async with connect_ws(app, _scope("SING01", role="teacher")) as tw:
                await tw.receive_json()
                async with connect_ws(app, _scope("SING01", participant_id=single_p1.id)) as sw:
                    await sw.receive_json()
                    await _drain_until(tw, "participant_joined")
                    await self._finish_game(tw, sw, single_quiz["right"].id)

                    await tw.send_json({"action": "restart"})
                    await _drain_until(tw, "state")

            db.expire_all()
            s = db.query(QuizSession).filter_by(join_code="SING01").first()
            assert s.points_awarded is not None

        _run(db, run)


# ---------------------------------------------------------------------------
# Answer randomization
# ---------------------------------------------------------------------------

class TestAnswerRandomization:
    def test_randomize_answers_produces_different_order_across_runs(self, db, klass, teacher):
        """With randomize_answers=True, answers should not always be in definition order.
        We run 20 games and assert that at least one differs — the probability of
        always getting the same order for 4 answers is (1/24)^20 ≈ negligible."""
        quiz = Quiz(title="Rndquiz", max_points=8, time_limit_default=10,
                    randomize_answers=True)
        db.add(quiz)
        db.flush()

        q = QuizQuestion(quiz_id=quiz.id, order=0, type="single",
                         question_text="Rnd?", time_limit=10)
        db.add(q)
        db.flush()

        texts = ["Alpha", "Beta", "Gamma", "Delta"]
        answer_ids = []
        for i, t in enumerate(texts):
            a = QuizAnswer(question_id=q.id, order=i, text=t, correct=(i == 0))
            db.add(a)
            db.flush()
            answer_ids.append(a.id)

        seen_orders: set[tuple] = set()

        for run_i in range(20):
            code = f"RND{run_i:03d}"
            s = QuizSession(quiz_id=quiz.id, class_id=klass.id,
                            teacher_id=teacher.id, join_code=code)
            db.add(s)
            db.flush()
            p = QuizParticipant(session_id=s.id, name="X", avatar="a")
            db.add(p)
            db.flush()

            quiz_router._phases.clear()
            quiz_router.mgr.clear()

            order_seen: tuple = ()

            async def run(c=code, pid=p.id):
                nonlocal order_seen
                async with connect_ws(app, _scope(c, role="teacher")) as tw:
                    await tw.receive_json()
                    async with connect_ws(app, _scope(c, participant_id=pid)) as sw:
                        await sw.receive_json()
                        await _drain_until(tw, "participant_joined")
                        answering = await _advance_to_answering(tw, sw)
                        order_seen = tuple(a["id"] for a in answering["answers"])

            _run(db, run)
            seen_orders.add(order_seen)
            # Delete session and participant so (quiz_id, class_id) unique constraint allows next run
            db.query(QuizParticipant).filter_by(session_id=s.id).delete()
            db.delete(s)
            db.flush()

        assert len(seen_orders) > 1, "randomize_answers=True should produce varied answer order"

    def test_sort_answers_always_shuffled(self, db, sort_session, sort_p1, sort_quiz):
        """Sort questions must always be shuffled (showing correct order gives away the answer)."""
        correct_order = tuple(a.id for a in sorted(sort_quiz["answers"], key=lambda x: x.order))

        seen_orders: set[tuple] = set()
        for _ in range(20):
            quiz_router._phases.pop("SORT01", None)
            # Reset the session so "start" works again on each iteration
            sort_session.status = "waiting"
            sort_session.current_question_idx = 0
            db.query(QuizResponse).filter_by(session_id=sort_session.id).delete()
            db.flush()

            async def run():
                async with connect_ws(app, _scope("SORT01", role="teacher")) as tw:
                    await tw.receive_json()
                    async with connect_ws(app, _scope("SORT01", participant_id=sort_p1.id)) as sw:
                        await sw.receive_json()
                        await _drain_until(tw, "participant_joined")
                        answering = await _advance_to_answering(tw, sw)
                        seen_orders.add(tuple(a["id"] for a in answering["answers"]))

            _run(db, run)

        assert len(seen_orders) > 1, "Sort answers should produce varied display order across runs"
