"""
Tests for the Bingo router — REST endpoints and WebSocket game flow.

Run with:  pytest api/tests/test_bingo.py -v
"""
import asyncio
import pytest

from api.tests.ws_test_helper import bearer_headers, connect_ws
from api.main import app
import api.routers.bingo as bingo_router
from api.models import BingoSession, BingoCard, Teacher
from api.auth import hash_password
from api.routers.bingo import _check_bingo, _completed_lines


# ── WS state cleanup between tests ───────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_bingo_state():
    bingo_router._mgr.clear()
    yield
    bingo_router._mgr.clear()


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bernd", last_name="Koch", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def teacher2_token(client, teacher2) -> str:
    r = client.post("/api/auth/login", json={"username": "Bernd Koch", "password": "secret2"})
    client.cookies.clear()
    return r.json()["access_token"]


# ── Helpers ───────────────────────────────────────────────────────────────────

PAIRS_3x3 = [
    {"caller": f"Frage {i}", "answer": f"Antwort {i}"}
    for i in range(15)
]


# Teacher WS connections must carry a verified identity (role= alone no
# longer grants game control).
_TEACHER_HEADERS: list[tuple[bytes, bytes]] = []


@pytest.fixture(autouse=True)
def _ws_teacher_auth(teacher):
    global _TEACHER_HEADERS
    _TEACHER_HEADERS = bearer_headers(teacher.id)


def _teacher_scope(code: str) -> dict:
    return {
        "type": "websocket",
        "path": f"/api/bingo/{code}/ws",
        "raw_path": f"/api/bingo/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": b"role=teacher",
        "headers": _TEACHER_HEADERS,
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


def _guest_token(code: str, name: str, sub: str) -> str:
    """A guest token with a caller-controlled `sub` so reconnecting with the same
    `token` key resolves to the same guest id → the same anon bingo card."""
    from datetime import datetime, timedelta, timezone
    import jwt
    from api.config import settings
    payload = {"sub": sub, "type": "guest", "name": name, "scope": code,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def _student_scope(code: str, token: str = "tok1", name: str = "Alex") -> dict:
    gt = _guest_token(code, name, sub=token)
    qs = f"role=student&guest_token={gt}".encode()
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


class TestBingoSets:
    """Content/session split: /api/bingo (unchanged contract) creates both a
    reusable BingoSet and its first BingoSession; /sets exposes the library
    (open to every teacher, like /api/capuths); /sets/{id}/sessions starts
    an additional session from existing content."""

    def test_create_also_creates_reusable_set(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        h = {"Authorization": f"Bearer {teacher_token}"}
        sets = client.get("/api/bingo/sets", headers=h).json()
        assert len(sets) == 1
        assert sets[0]["total_pairs"] == len(PAIRS_3x3)

        # The session created alongside it still reads title/pairs correctly
        # via the BingoSet passthrough.
        sessions = client.get("/api/bingo", headers=h).json()
        assert next(s for s in sessions if s["code"] == code)["title"]

    def test_sets_open_to_other_teachers(self, client, teacher_token, teacher2_token):
        _create_session(client, teacher_token)
        r = client.get("/api/bingo/sets", headers={"Authorization": f"Bearer {teacher2_token}"})
        assert len(r.json()) == 1

    def test_start_session_from_set(self, client, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        _create_session(client, teacher_token)
        set_id = client.get("/api/bingo/sets", headers=h).json()[0]["id"]

        r = client.post(f"/api/bingo/sets/{set_id}/sessions", headers=h)
        assert r.status_code == 201
        assert "code" in r.json()

        sessions = client.get("/api/bingo", headers=h).json()
        assert len(sessions) == 2  # original session from create + this new one

    def test_start_session_from_unknown_set_404(self, client, teacher_token):
        r = client.post("/api/bingo/sets/999999/sessions", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 404

    def test_start_session_requires_auth(self, client, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        _create_session(client, teacher_token)
        set_id = client.get("/api/bingo/sets", headers=h).json()[0]["id"]
        client.cookies.clear()
        r = client.post(f"/api/bingo/sets/{set_id}/sessions")
        assert r.status_code == 401

    def test_close_awards_anonymous_points_to_bound_class(self, client, db, klass, teacher_token):
        """Anonymous players' correctness points credit the session's bound
        class; without a bound class they are dropped (previous behavior)."""
        from api.models import Transaction

        h = {"Authorization": f"Bearer {teacher_token}"}
        client.post("/api/bingo", json={
            "title": "T", "max_points": 10, "grid_size": 3, "grid_cols": 3, "pairs": PAIRS_3x3,
        }, headers=h)
        set_id = client.get("/api/bingo/sets", headers=h).json()[0]["id"]

        r = client.post(f"/api/bingo/sets/{set_id}/sessions", json={"class_id": klass.id}, headers=h)
        assert r.json()["class_id"] == klass.id
        code = r.json()["code"]

        session = db.query(BingoSession).filter_by(code=code).one()
        session.called_indices = [0, 1]
        db.add(BingoCard(session_id=session.id, student_id=None, anon_token="tokX",
                         student_name="Gast", grid_indices=list(range(9)), marked_positions=[0, 1]))
        db.flush()

        client.post(f"/api/bingo/{code}/close", headers=h)
        tx = db.query(Transaction).filter_by(class_id=klass.id).all()
        assert len(tx) == 1
        assert tx[0].points == 10  # 2/2 called cells correctly marked → full ratio

    def test_close_drops_anonymous_points_without_bound_class(self, client, db, klass, teacher_token):
        from api.models import Transaction

        h = {"Authorization": f"Bearer {teacher_token}"}
        client.post("/api/bingo", json={
            "title": "T", "max_points": 10, "grid_size": 3, "grid_cols": 3, "pairs": PAIRS_3x3,
        }, headers=h)
        code = client.get("/api/bingo", headers=h).json()[0]["code"]

        session = db.query(BingoSession).filter_by(code=code).one()
        assert session.class_id is None
        session.called_indices = [0, 1]
        db.add(BingoCard(session_id=session.id, student_id=None, anon_token="tokY",
                         student_name="Gast", grid_indices=list(range(9)), marked_positions=[0, 1]))
        db.flush()

        client.post(f"/api/bingo/{code}/close", headers=h)
        assert db.query(Transaction).count() == 0

    def test_close_students_still_credit_own_class(self, client, db, klass, teacher_token):
        from api.models import Transaction, Student, Class

        other_class = Class(code="7z", display_name="Klasse 7z")
        db.add(other_class)
        db.flush()
        student = Student(nachname="M", vorname="T", klasse=other_class.code,
                          class_id=other_class.id, geschlecht="m")
        db.add(student)
        db.flush()

        h = {"Authorization": f"Bearer {teacher_token}"}
        client.post("/api/bingo", json={
            "title": "T", "max_points": 10, "grid_size": 3, "grid_cols": 3, "pairs": PAIRS_3x3,
        }, headers=h)
        set_id = client.get("/api/bingo/sets", headers=h).json()[0]["id"]
        code = client.post(f"/api/bingo/sets/{set_id}/sessions", json={"class_id": klass.id}, headers=h).json()["code"]

        session = db.query(BingoSession).filter_by(code=code).one()
        session.called_indices = [0, 1]
        db.add(BingoCard(session_id=session.id, student_id=student.id,
                         student_name="T M", grid_indices=list(range(9)), marked_positions=[0, 1]))
        db.flush()

        client.post(f"/api/bingo/{code}/close", headers=h)
        # Student's own class gets the points, not the session-bound class
        assert db.query(Transaction).filter_by(class_id=other_class.id).count() == 1
        assert db.query(Transaction).filter_by(class_id=klass.id).count() == 0

    def test_list_filters_by_set_id(self, client, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        _create_session(client, teacher_token)
        set_id = client.get("/api/bingo/sets", headers=h).json()[0]["id"]
        client.post(f"/api/bingo/sets/{set_id}/sessions", headers=h)

        other_code = _create_session(client, teacher_token)
        other_set_id = next(s["id"] for s in client.get("/api/bingo/sets", headers=h).json() if s["id"] != set_id)

        filtered = client.get(f"/api/bingo?set_id={set_id}", headers=h).json()
        assert len(filtered) == 2
        assert other_code not in [s["code"] for s in filtered]

        other_filtered = client.get(f"/api/bingo?set_id={other_set_id}", headers=h).json()
        assert len(other_filtered) == 1
        assert other_filtered[0]["code"] == other_code


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
        # Exactly 9 pairs for a 3x3 card so every called pair is on the card
        code = _create_session(client, teacher_token, pairs=PAIRS_3x3[:9])

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
                        # Collect any events sent to teacher (line, results, ...)
                        try:
                            while True:
                                msg = await asyncio.wait_for(t.receive_json(), timeout=0.5)
                                if msg.get("event") == "line":
                                    line_event = msg
                        except asyncio.TimeoutError:
                            pass

                    assert line_event is not None, "Teacher should receive a 'line' event"
                    assert line_event["student_name"] == "Alex"
                    assert "Reihe" in line_event["line"] or "Diagonale" in line_event["line"]

        asyncio.run(run())


# ── Wieder oeffnen ──────────────────────────────────────────────────────────
#
# Eine zu frueh beendete Runde soll zurueckkommen koennen. Sobald sie aber
# ausgewertet ist, waere ein zweites Schliessen eine zweite Punktevergabe fuer
# dieselbe Runde — ab da fuehrt nur noch Zuruecksetzen weiter.

class TestReopen:
    def _auth(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_reopens_a_round_closed_before_any_number_was_called(self, client, db, teacher_token):
        code = _create_session(client, teacher_token, max_points=10)
        assert client.post(f"/api/bingo/{code}/close", headers=self._auth(teacher_token)).status_code == 204

        s = db.query(BingoSession).filter_by(code=code).first()
        assert s.status == "closed" and s.awarded_at is None

        assert client.post(f"/api/bingo/{code}/reopen", headers=self._auth(teacher_token)).status_code == 204
        db.refresh(s)
        # Nichts gerufen -> die Runde wartet wieder auf den Start.
        assert s.status == "waiting"

    def test_reopen_keeps_a_started_round_running(self, client, db, teacher_token):
        code = _create_session(client, teacher_token)
        s = db.query(BingoSession).filter_by(code=code).first()
        s.called_indices = [0, 1]
        s.status = "closed"
        db.flush()

        client.post(f"/api/bingo/{code}/reopen", headers=self._auth(teacher_token))
        db.refresh(s)
        assert s.status == "active"
        assert s.called_indices == [0, 1]      # gezogene Zahlen bleiben stehen

    def test_an_evaluated_round_refuses_to_reopen(self, client, db, teacher_token):
        code = _create_session(client, teacher_token, max_points=10)
        s = db.query(BingoSession).filter_by(code=code).first()
        s.called_indices = [0]
        db.flush()

        # Schliessen wertet aus (max_points > 0 und es wurde gerufen).
        client.post(f"/api/bingo/{code}/close", headers=self._auth(teacher_token))
        db.refresh(s)
        assert s.awarded_at is not None

        r = client.post(f"/api/bingo/{code}/reopen", headers=self._auth(teacher_token))
        assert r.status_code == 409
        assert "zurücksetzen" in r.json()["detail"].lower()
        db.refresh(s)
        assert s.status == "closed"            # bleibt zu

    def test_resetting_starts_a_fresh_round_that_may_close_again(self, client, db, teacher_token):
        code = _create_session(client, teacher_token, max_points=10)
        s = db.query(BingoSession).filter_by(code=code).first()
        s.called_indices = [0]
        db.flush()
        client.post(f"/api/bingo/{code}/close", headers=self._auth(teacher_token))
        db.refresh(s)
        assert s.awarded_at is not None

        client.post(f"/api/bingo/{code}/reset", headers=self._auth(teacher_token))
        db.refresh(s)
        assert s.awarded_at is None and s.status == "waiting"

    def test_reopen_needs_a_teacher(self, client, teacher_token):
        code = _create_session(client, teacher_token)
        client.post(f"/api/bingo/{code}/close", headers=self._auth(teacher_token))
        client.cookies.clear()
        assert client.post(f"/api/bingo/{code}/reopen").status_code in (401, 403)

    def test_the_list_says_whether_a_round_is_evaluated(self, client, db, teacher_token):
        code = _create_session(client, teacher_token, max_points=10)
        rows = client.get("/api/bingo", headers=self._auth(teacher_token)).json()
        assert next(r for r in rows if r["code"] == code)["awarded"] is False

        s = db.query(BingoSession).filter_by(code=code).first()
        s.called_indices = [0]
        db.flush()
        client.post(f"/api/bingo/{code}/close", headers=self._auth(teacher_token))

        rows = client.get("/api/bingo", headers=self._auth(teacher_token)).json()
        assert next(r for r in rows if r["code"] == code)["awarded"] is True


# ── Bearbeiten, Neustart, Auswertung ─────────────────────────────────────────

class TestSetEditResetResults:
    def _set_id(self, client, h):
        return client.get("/api/bingo/sets", headers=h).json()[0]["id"]

    def _body(self, **kw):
        return {"title": "Neu", "grid_size": 3, "grid_cols": 3, "pairs": PAIRS_3x3, **kw}

    def test_get_and_update_set(self, client, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        _create_session(client, teacher_token)
        sid = self._set_id(client, h)
        r = client.get(f"/api/bingo/sets/{sid}", headers=h)
        assert r.status_code == 200
        assert r.json()["can_edit"] is True
        assert len(r.json()["pairs"]) == len(PAIRS_3x3)

        pairs = [{"caller": "Q", "answer": "A"}] + PAIRS_3x3[1:]
        r = client.put(f"/api/bingo/sets/{sid}", json=self._body(pairs=pairs, max_points=7, grade=[5, 6]), headers=h)
        assert r.status_code == 200, r.text
        d = client.get(f"/api/bingo/sets/{sid}", headers=h).json()
        assert d["title"] == "Neu" and d["max_points"] == 7 and d["grades"] == [5, 6]
        assert d["pairs"][0] == {"caller": "Q", "answer": "A"}

    def test_update_forbidden_for_other_teacher(self, client, teacher_token, teacher2_token):
        _create_session(client, teacher_token)
        sid = self._set_id(client, {"Authorization": f"Bearer {teacher_token}"})
        r = client.put(f"/api/bingo/sets/{sid}", json=self._body(),
                       headers={"Authorization": f"Bearer {teacher2_token}"})
        assert r.status_code == 403

    def test_update_rejects_shape_change_with_open_cards(self, client, db, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        code = _create_session(client, teacher_token)
        s = db.query(BingoSession).filter_by(code=code).first()
        db.add(BingoCard(session_id=s.id, anon_token="x", student_name="X", grid_indices=list(range(9))))
        db.commit()
        sid = self._set_id(client, h)
        pairs16 = [{"caller": f"F{i}", "answer": f"A{i}"} for i in range(16)]
        r = client.put(f"/api/bingo/sets/{sid}", json=self._body(grid_size=4, grid_cols=4, pairs=pairs16), headers=h)
        assert r.status_code == 409
        # Nach dem Beenden geht es.
        client.post(f"/api/bingo/{code}/close", headers=h)
        r = client.put(f"/api/bingo/sets/{sid}", json=self._body(grid_size=4, grid_cols=4, pairs=pairs16), headers=h)
        assert r.status_code == 200

    def test_full_reset_redeals_cards(self, client, db, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        code = _create_session(client, teacher_token)
        s = db.query(BingoSession).filter_by(code=code).first()
        card = BingoCard(session_id=s.id, anon_token="x", student_name="X",
                         grid_indices=list(range(9)), marked_positions=[0])
        db.add(card)
        s.called_indices = [0]
        db.commit()
        import random
        random.seed(1)
        r = client.post(f"/api/bingo/{code}/reset?full=true", headers=h)
        assert r.status_code == 204
        db.expire_all()
        card = db.get(BingoCard, card.id)
        assert card.marked_positions == []
        assert len(card.grid_indices) == 9 and len(set(card.grid_indices)) == 9
        assert card.grid_indices != list(range(9))

    def test_results_count_only_called_on_own_card(self, db, teacher_token, client):
        code = _create_session(client, teacher_token)
        s = db.query(BingoSession).filter_by(code=code).first()
        db.add(BingoCard(session_id=s.id, anon_token="a", student_name="A",
                         grid_indices=list(range(9)), marked_positions=[0, 1]))
        db.add(BingoCard(session_id=s.id, anon_token="b", student_name="B",
                         grid_indices=list(range(6, 15)), marked_positions=[]))
        s.called_indices = [0, 1, 2, 12]   # A: 3 auf der Karte, B: nur 12
        db.commit()
        db.refresh(s)
        res = {r["name"]: r for r in bingo_router._results(s)}
        assert (res["A"]["hits"], res["A"]["called_on_card"]) == (2, 3)
        assert (res["B"]["hits"], res["B"]["called_on_card"]) == (0, 1)
