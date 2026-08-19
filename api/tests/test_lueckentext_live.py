"""Tests for Lückentext Stage 3: live ranking (_build_ranking + teacher WS)."""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from api.tests.conftest import auth
from api.auth import create_guest_token
from api.tests.ws_test_helper import bearer_headers, connect_ws
from api.tests.test_lueckentexte import token_for
from api.main import app
from api.models import LueckentextSet, LueckentextSession, LueckentextParticipant, LueckentextResponse
import api.routers.lueckentexte as lueckentexte_router
from api.routers.lueckentexte import _build_ranking


@pytest.fixture(autouse=True)
def clear_mgr_state():
    lueckentexte_router._mgr.clear()
    yield
    lueckentexte_router._mgr.clear()


def _make_set(db, teacher, n_gaps=2) -> LueckentextSet:
    ids = [f"g{i}" for i in range(1, n_gaps + 1)]
    text = "Text " + " ".join(f"{{{{{gid}}}}}" for gid in ids)
    gaps = [{"id": gid, "answer": "Antwort", "type": "free_type", "difficulty": "medium", "hint": None, "choices": None} for gid in ids]
    s = LueckentextSet(title="T", text=text, gaps=gaps, distractors=[], created_by=teacher.id)
    db.add(s)
    db.flush()
    return s


def _make_session(db, lt: LueckentextSet, teacher) -> LueckentextSession:
    s = LueckentextSession(lueckentext_id=lt.id, teacher_id=teacher.id, join_code="LIVE0001", status="active")
    db.add(s)
    db.flush()
    return s


def _make_participant(db, session: LueckentextSession, name: str) -> LueckentextParticipant:
    p = LueckentextParticipant(session_id=session.id, name=name, avatar="cat")
    db.add(p)
    db.flush()
    return p


def _response(db, p: LueckentextParticipant, session: LueckentextSession, gap_id: str, match: str | None, solved_at=None):
    r = LueckentextResponse(
        session_id=session.id, participant_id=p.id, gap_id=gap_id,
        given_text="x", match=match, attempts=1,
        first_attempt_at=datetime.now(timezone.utc), solved_at=solved_at,
    )
    db.add(r)
    db.flush()
    return r


class TestBuildRanking:
    def test_fast_finisher_beats_slow_finisher(self, db, teacher):
        lt = _make_set(db, teacher, n_gaps=2)
        session = _make_session(db, lt, teacher)
        fast = _make_participant(db, session, "Fast")
        slow = _make_participant(db, session, "Slow")

        now = datetime.now(timezone.utc)
        _response(db, fast, session, "g1", "exact", solved_at=now)
        _response(db, fast, session, "g2", "exact", solved_at=now + timedelta(seconds=1))
        _response(db, slow, session, "g1", "exact", solved_at=now + timedelta(seconds=30))
        _response(db, slow, session, "g2", "exact", solved_at=now + timedelta(seconds=60))

        ranking = _build_ranking(session, db)
        by_name = {e["name"]: e for e in ranking}
        assert by_name["Fast"]["rank"] == 1
        assert by_name["Slow"]["rank"] == 2
        # same raw score (2.0 each), speed bonus must make Fast strictly higher
        assert by_name["Fast"]["score"] > by_name["Slow"]["score"]

    def test_near_match_counts_as_half(self, db, teacher):
        lt = _make_set(db, teacher, n_gaps=2)
        session = _make_session(db, lt, teacher)
        p = _make_participant(db, session, "Solo")
        now = datetime.now(timezone.utc)
        _response(db, p, session, "g1", "exact", solved_at=now)
        _response(db, p, session, "g2", "near", solved_at=now + timedelta(seconds=1))

        ranking = _build_ranking(session, db)
        entry = ranking[0]
        # raw = 1.0 (exact) + 0.5 (near) = 1.5; sole finisher gets max_bonus
        n_players = 1
        max_bonus = round(n_players * 0.1, 2)
        expected = round(1.5 * (1 + max_bonus), 2)
        assert entry["score"] == expected

    def test_finished_lower_raw_can_outrank_unfinished_via_speed_bonus(self, db, teacher):
        lt = _make_set(db, teacher, n_gaps=3)
        session = _make_session(db, lt, teacher)
        unfinished = _make_participant(db, session, "Unfinished")
        finisher = _make_participant(db, session, "Finisher")
        # three inert participants just to raise n_players -> raise max_bonus
        for i in range(3):
            _make_participant(db, session, f"Dummy{i}")

        now = datetime.now(timezone.utc)
        # Unfinished: 2 exact matches, third gap untouched -> raw 2.0, not finished
        _response(db, unfinished, session, "g1", "exact", solved_at=now)
        _response(db, unfinished, session, "g2", "exact", solved_at=now + timedelta(seconds=1))

        # Finisher: all three gaps answered "near" -> raw 1.5, but finishes (fastest, sole finisher)
        _response(db, finisher, session, "g1", "near", solved_at=now)
        _response(db, finisher, session, "g2", "near", solved_at=now + timedelta(seconds=1))
        _response(db, finisher, session, "g3", "near", solved_at=now + timedelta(seconds=2))

        ranking = _build_ranking(session, db)
        by_name = {e["name"]: e for e in ranking}

        n_players = 5
        max_bonus = round(n_players * 0.1, 2)
        assert max_bonus == 0.5
        expected_finisher = round(1.5 * (1 + max_bonus), 2)
        expected_unfinished = round(2.0 * (1 + 0), 2)
        assert by_name["Finisher"]["score"] == expected_finisher
        assert by_name["Unfinished"]["score"] == expected_unfinished
        assert expected_finisher > expected_unfinished
        assert by_name["Finisher"]["rank"] == 1
        assert by_name["Unfinished"]["rank"] == 2


# ---------------------------------------------------------------------------
# WebSocket push test
# ---------------------------------------------------------------------------

def _teacher_scope(code: str, headers: list[tuple[bytes, bytes]]) -> dict:
    return {
        "type": "websocket",
        "path": f"/api/lueckentexte/sessions/{code}/ws",
        "raw_path": f"/api/lueckentexte/sessions/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


class TestWebSocketPush:
    def test_teacher_gets_ranking_push_on_student_attempt(self, client, teacher, db):
        token = token_for(teacher)
        r = client.post("/api/lueckentexte", json={
            "title": "Wasserkreislauf",
            "text": "Es entsteht {{a}}.",
            "gaps": [{"id": "a", "answer": "Verdunstung", "type": "free_type", "difficulty": "easy", "hint": None, "choices": None}],
            "distractors": [],
        }, headers=auth(token))
        assert r.status_code == 201, r.text
        set_id = r.json()["id"]

        r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(token))
        assert r.status_code == 201, r.text
        code = r.json()["join_code"]

        r = client.post(f"/api/lueckentexte/sessions/{code}/join", json={"name": "Max", "avatar": "cat"}, headers={"Authorization": f"Bearer {create_guest_token(code, 'Max')}"})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]

        r = client.post(f"/api/lueckentexte/sessions/{code}/start", headers=auth(token))
        assert r.status_code == 200, r.text

        headers = bearer_headers(teacher.id, "teacher")

        async def run():
            async with connect_ws(app, _teacher_scope(code, headers)) as ws:
                initial = await ws.receive_json()
                assert initial["event"] == "ranking"
                assert initial["ranking"] == [{"pid": pid, "name": "Max", "avatar": "cat", "score": 0.0, "rank": 1}]

                r = client.post(
                    f"/api/lueckentexte/sessions/{code}/gaps/a/attempt",
                    json={"participant_id": pid, "text": "Verdunstung"},
                )
                assert r.status_code == 200, r.text

                update = await ws.receive_json()
                assert update["event"] == "ranking"
                assert len(update["ranking"]) == 1
                assert update["ranking"][0]["name"] == "Max"
                assert update["ranking"][0]["score"] > 0

        asyncio.run(run())
