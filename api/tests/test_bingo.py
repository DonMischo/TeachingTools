"""
Tests for the Bingo router — REST endpoints and WebSocket game flow.

Run with:  pytest api/tests/test_bingo.py -v
"""
import asyncio
import pytest

from api.tests.ws_test_helper import connect_ws
from api.main import app
import api.routers.bingo as bingo_router
from api.models import BingoSession, BingoCard
from api.routers.bingo import _check_bingo, _completed_lines


# ── WS state cleanup between tests ───────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_bingo_state():
    bingo_router._mgr._teachers.clear()
    bingo_router._mgr._students.clear()
    bingo_router._mgr._player_info.clear()
    yield
    bingo_router._mgr._teachers.clear()
    bingo_router._mgr._students.clear()
    bingo_router._mgr._player_info.clear()


# ── Helpers ───────────────────────────────────────────────────────────────────

PAIRS_3x3 = [
    {"caller": f"Frage {i}", "answer": f"Antwort {i}"}
    for i in range(15)
]


def _teacher_scope(code: str) -> dict:
    return {
        "type": "websocket",
        "path": f"/api/bingo/{code}/ws",
        "raw_path": f"/api/bingo/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": b"role=teacher",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


def _student_scope(code: str, token: str = "tok1", name: str = "Alex") -> dict:
    qs = f"role=student&token={token}&name={name}".encode()
    return {
        "type": "websocket",
        "path": f"/api/bingo/{code}/ws",
        "raw_path": f"/api/bingo/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": qs,
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


def _create_session(client, teacher_token, *, grid_size=3, pairs=None, max_points=0) -> str:
    pairs = pairs or PAIRS_3x3
    r = client.post("/api/bingo", json={
        "title": "Test Bingo",
        "grid_size": grid_size,
        "grid_cols": grid_size,
        "pairs": pairs,
        "max_points": max_points,
    }, headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 201, r.text
    return r.json()["code"]


async def _drain_until(ws, event: str, max_messages: int = 20) -> dict:
    for _ in range(max_messages):
        msg = await ws.receive_json()
        if msg.get("event") == event:
            return msg
    raise AssertionError(f"Event '{event}' not received within {max_messages} messages")


# ── Unit tests: pure logic ─────────────────────────────────────────────────────

class TestCheckBingo:
    def test_row_0(self):
        assert _check_bingo([0, 1, 2], 3, 3) is True

    def test_row_1(self):
        assert _check_bingo([3, 4, 5], 3, 3) is True

    def test_column(self):
        # Column 1: positions 1, 4, 7
        assert _check_bingo([1, 4, 7], 3, 3) is True

    def test_main_diagonal(self):
        assert _check_bingo([0, 4, 8], 3, 3) is True

    def test_anti_diagonal(self):
        assert _check_bingo([2, 4, 6], 3, 3) is True

    def test_incomplete(self):
        assert _check_bingo([0, 1], 3, 3) is False

    def test_empty(self):
        assert _check_bingo([], 3, 3) is False

    def test_4x4_row(self):
        assert _check_bingo([0, 1, 2, 3], 4, 4) is True

    def test_4x4_incomplete_row(self):
        assert _check_bingo([0, 1, 2], 4, 4) is False


class TestCompletedLines:
    def test_row_label(self):
        assert "Reihe 1" in _completed_lines([0, 1, 2], 3, 3)

    def test_column_label(self):
        # Column 3: positions 2, 5, 8
        assert "Spalte 3" in _completed_lines([2, 5, 8], 3, 3)

    def test_main_diagonal_label(self):
        assert "Hauptdiagonale" in _completed_lines([0, 4, 8], 3, 3)

    def test_anti_diagonal_label(self):
        assert "Nebendiagonale" in _completed_lines([2, 4, 6], 3, 3)

    def test_multiple_lines_at_once(self):
        # Row 0 + main diagonal both complete
        lines = _completed_lines([0, 1, 2, 4, 8], 3, 3)
        assert "Reihe 1" in lines
        assert "Hauptdiagonale" in lines

    def test_no_lines_when_incomplete(self):
        assert _completed_lines([0, 3], 3, 3) == set()

    def test_new_lines_via_set_diff(self):
        before = _completed_lines([0, 1], 3, 3)
        after = _completed_lines([0, 1, 2], 3, 3)
        new = after - before
        assert "Reihe 1" in new
        assert len(new) == 1


# ── REST endpoint tests ────────────────────────────────────────────────────────

class TestRestEndpoints:
    def test_create_requires_auth(self, client):
        r = client.post("/api/bingo", json={"title": "T", "grid_size": 3, "grid_cols": 3, "pairs": PAIRS_3x3})
        assert r.status_code == 401

    def test_create_and_list(self, client, teacher_token):
        _create_session(client, teacher_token)
        r = client.get("/api/bingo", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_create_rejects_too_few_pairs(self, client, teacher_token):
        r = client.post("/api/bingo", json={
            "title": "Bad", "grid_size": 4, "grid_cols": 4, "pairs": PAIRS_3x3[:5],
        }, headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 400

    def test_metadata_stored_and_returned(self, client, teacher_token):
        r = client.post("/api/bingo", json={
            "title": "Meta", "subject": "Englisch", "tags": ["A1", "Tiere"],
            "description": "Test", "max_points": 20,
            "grid_size": 3, "grid_cols": 3, "pairs": PAIRS_3x3,
        }, headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 201
        code = r.json()["code"]

        sessions = client.get("/api/bingo", headers={"Authorization": f"Bearer {teacher_token}"}).json()
        s = next(x for x in sessions if x["code"] == code)
        assert s["subject"] == "Englisch"
        assert s["tags"] == ["A1", "Tiere"]
        assert s["max_points"] == 20

    def test_delete_session(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        r = client.delete(f"/api/bingo/{code}", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 204
        assert client.get("/api/bingo", headers={"Authorization": f"Bearer {teacher_token}"}).json() == []

    def test_close_endpoint(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        r = client.post(f"/api/bingo/{code}/close", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 204

    def test_close_idempotent(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        h = {"Authorization": f"Bearer {teacher_token}"}
        client.post(f"/api/bingo/{code}/close", headers=h)
        assert client.post(f"/api/bingo/{code}/close", headers=h).status_code == 204

    def test_reset_endpoint(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        h = {"Authorization": f"Bearer {teacher_token}"}
        client.post(f"/api/bingo/{code}/close", headers=h)
        assert client.post(f"/api/bingo/{code}/reset", headers=h).status_code == 204

    def test_info_endpoint(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        r = client.get(f"/api/bingo/info?code={code}")
        assert r.json()["game"] == "bingo"

    def test_info_unknown_code_is_404(self, client):
        assert client.get("/api/bingo/info?code=XXXXXXXX").status_code == 404


# ── WebSocket game-flow tests ──────────────────────────────────────────────────

class TestWebSocketFlow:

    def test_teacher_receives_initial_state(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as ws:
                msg = await ws.receive_json()
                assert msg["event"] == "state"
                assert msg["status"] == "waiting"
                assert msg["title"] == "Test Bingo"

        asyncio.run(run())

    def test_student_receives_state_then_card(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _student_scope(code)) as ws:
                state = await ws.receive_json()
                assert state["event"] == "state"
                card = await ws.receive_json()
                assert card["event"] == "card"
                assert len(card["cells"]) == 9  # 3×3

        asyncio.run(run())

    def test_card_cells_are_valid_pair_answers(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        valid = {p["answer"] for p in PAIRS_3x3}

        async def run():
            async with connect_ws(app, _student_scope(code)) as ws:
                await ws.receive_json()  # state
                card = await ws.receive_json()  # card
                for cell in card["cells"]:
                    assert cell["answer"] in valid

        asyncio.run(run())

    def test_start_broadcasts_started_event(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                async with connect_ws(app, _student_scope(code)) as s:
                    await s.receive_json()  # state
                    await s.receive_json()  # card
                    await s.receive_json()  # players

                    await t.send_json({"action": "start"})
                    msg = await _drain_until(s, "started")
                    assert msg["event"] == "started"

        asyncio.run(run())

    def test_call_next_produces_called_event(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                await t.send_json({"action": "start"})
                await t.receive_json()  # started
                await t.send_json({"action": "call_next"})
                called = await _drain_until(t, "called")
                assert "caller" in called
                assert "index" in called

        asyncio.run(run())

    def test_mark_called_cell_is_acknowledged(self, client, teacher_token, db):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                async with connect_ws(app, _student_scope(code, "tok1", "Alex")) as s:
                    await s.receive_json()  # state
                    card_msg = await s.receive_json()  # card
                    await s.receive_json()  # players

                    # Start
                    await t.send_json({"action": "start"})
                    await _drain_until(s, "started")
                    await t.receive_json()  # started (broadcast to teacher too)

                    # Call a term
                    await t.send_json({"action": "call_next"})
                    called = await _drain_until(t, "called")
                    called_idx = called["index"]

                    # Consume called on student side
                    await _drain_until(s, "called")

                    # Find the card position for this called pair
                    pos = next(
                        i for i, cell in enumerate(card_msg["cells"])
                        if cell["pair_index"] == called_idx
                    )

                    # Mark it
                    await s.send_json({"action": "mark", "position": pos})
                    ack = await s.receive_json()
                    assert ack["event"] in ("mark_ack", "bingo")
                    assert pos in ack["marked_positions"]

        asyncio.run(run())

    def test_mark_uncalled_cell_returns_wrong_mark(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                async with connect_ws(app, _student_scope(code, "tok1", "Alex")) as s:
                    await s.receive_json()  # state
                    await s.receive_json()  # card
                    await s.receive_json()  # players

                    # Start without calling anything
                    await t.send_json({"action": "start"})
                    await _drain_until(s, "started")

                    # Mark position 0 (nothing called → wrong)
                    await s.send_json({"action": "mark", "position": 0})
                    resp = await s.receive_json()
                    assert resp["event"] == "wrong_mark"
                    assert resp["position"] == 0

        asyncio.run(run())

    def test_wrong_mark_not_persisted_in_db(self, client, teacher_token, db):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()
                async with connect_ws(app, _student_scope(code, "tok1", "Alex")) as s:
                    await s.receive_json()
                    await s.receive_json()  # card
                    await s.receive_json()  # players
                    await t.send_json({"action": "start"})
                    await _drain_until(s, "started")
                    await s.send_json({"action": "mark", "position": 0})
                    await s.receive_json()  # wrong_mark

        asyncio.run(run())

        # DB should not have the position marked
        card = db.query(BingoCard).first()
        assert card is not None
        assert 0 not in card.marked_positions

    def test_reset_clears_called_indices(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                await t.send_json({"action": "start"})
                await t.receive_json()  # started
                await t.send_json({"action": "call_next"})
                await _drain_until(t, "called")
                await t.send_json({"action": "reset"})
                await _drain_until(t, "reset")
                state = await _drain_until(t, "state")
                assert state["status"] == "waiting"
                assert state["called_indices"] == []

        asyncio.run(run())

    def test_close_ends_game(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()
                await t.send_json({"action": "start"})
                await t.receive_json()  # started
                await t.send_json({"action": "close"})
                msg = await _drain_until(t, "closed")
                assert msg["event"] == "closed"

        asyncio.run(run())

    def test_players_list_updates_on_join(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                async with connect_ws(app, _student_scope(code, "tok1", "Alex")):
                    msg = await _drain_until(t, "players")
                    names = [p["name"] for p in msg["players"]]
                    assert "Alex" in names

        asyncio.run(run())

    def test_reconnect_restores_same_card(self, client, teacher_token):
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _student_scope(code, "tok-x", "Bob")) as s:
                await s.receive_json()  # state
                first_card = await s.receive_json()  # card

            async with connect_ws(app, _student_scope(code, "tok-x", "Bob")) as s:
                await s.receive_json()  # state
                second_card = await s.receive_json()  # card

            assert first_card["cells"] == second_card["cells"]

        asyncio.run(run())

    def test_line_event_sent_to_teacher_on_row_completion(self, client, teacher_token, db):
        """Completing row 0 of a student's card notifies the teacher."""
        code = _create_session(client, teacher_token)

        async def run():
            async with connect_ws(app, _teacher_scope(code)) as t:
                await t.receive_json()  # state
                async with connect_ws(app, _student_scope(code, "tok1", "Alex")) as s:
                    await s.receive_json()  # state
                    card_msg = await s.receive_json()  # card
                    await s.receive_json()  # players
                    await t.receive_json()  # players update

                    await t.send_json({"action": "start"})
                    await _drain_until(s, "started")
                    await t.receive_json()  # started

                    # Call pairs until all 3 in row 0 of the student card are called
                    row0_pairs = {card_msg["cells"][pos]["pair_index"] for pos in range(3)}
                    called = set()
                    while not row0_pairs.issubset(called):
                        await t.send_json({"action": "call_next"})
                        ev = await _drain_until(t, "called")
                        await _drain_until(s, "called")
                        called.add(ev["index"])

                    # Mark all 3 cells in row 0
                    line_event = None
                    for pos in range(3):
                        await s.send_json({"action": "mark", "position": pos})
                        await s.receive_json()  # mark_ack or bingo
                        # Collect any events sent to teacher
                        try:
                            msg = await asyncio.wait_for(t.receive_json(), timeout=0.5)
                            if msg.get("event") == "line":
                                line_event = msg
                        except asyncio.TimeoutError:
                            pass

                    assert line_event is not None, "Teacher should receive a 'line' event"
                    assert line_event["student_name"] == "Alex"
                    assert "Reihe" in line_event["line"] or "Diagonale" in line_event["line"]

        asyncio.run(run())
