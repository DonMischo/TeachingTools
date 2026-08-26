"""Punkte-Auktion: bidding and awarding, where houses actually spend points.

Awarding books negative Transactions against every member class of the winning
house, so this is the one game whose bugs cost real Hauspokal points. The REST
library surface is covered in test_auction.py; this file drives the socket.
"""
import asyncio

import pytest

from api.auth import create_access_token, create_guest_token, hash_password
from api.main import app
from api.models import (
    AuctionBid, AuctionSession, AuctionSet, Class, Haus, HausMember, Student,
    StudentRole, Teacher, Transaction,
)
import api.routers.auction as auction
from api.routers.haeuser import haus_total_points
from api.tests.conftest import auth
from api.tests.ws_test_helper import bearer_headers, connect_ws

CODE = "AUCT0001"


@pytest.fixture(autouse=True)
def clear_ws_state():
    auction._mgr.clear()
    auction._spectators.clear()
    yield
    auction._mgr.clear()
    auction._spectators.clear()


@pytest.fixture()
def haus(db, teacher, klass) -> Haus:
    """A house with one member class holding 500 points.

    A decoy house is created first so that haus.id != klass.id — otherwise a
    house looked up by the wrong id would still accidentally be the right one.
    """
    db.add(Haus(name="Süd (Attrappe)", color="#000000"))
    db.flush()
    h = Haus(name="Nord", color="#123456")
    db.add(h)
    db.flush()
    assert h.id != klass.id
    db.add(HausMember(haus_id=h.id, class_id=klass.id))
    db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=500, reason="Startpunkte"))
    db.flush()
    return h


@pytest.fixture()
def haussprecher(db, klass, haus) -> Student:
    """A Haussprecher exactly as Klassenverwaltung stores one: the curated
    role label, scoped to the CLASS it was assigned in (api/routers/roles.py) —
    the house follows from that class's Haus membership."""
    s = Student(nachname="Sprecher", vorname="Hans", klasse=klass.code, class_id=klass.id,
                geschlecht="männlich", active=True)
    db.add(s)
    db.flush()
    db.add(StudentRole(student_id=s.id, role_type="Haussprecher", scope_id=klass.id))
    db.flush()
    return s


@pytest.fixture()
def session(db, teacher) -> AuctionSession:
    aset = AuctionSet(title="Kinoabend", description="Ein Abend im Kino",
                      prize_description="Popcorn inklusive", created_by=teacher.id)
    db.add(aset)
    db.flush()
    s = AuctionSession(set_id=aset.id, code=CODE, created_by=teacher.id)
    db.add(s)
    db.flush()
    return s


def _scope(query: str, headers=None) -> dict:
    path = f"/api/auction/{CODE}/ws"
    return {
        "type": "websocket", "path": path, "raw_path": path.encode(), "root_path": "",
        "scheme": "ws", "query_string": query.encode(), "headers": headers or [],
        "client": ("127.0.0.1", 1234), "server": ("127.0.0.1", 8000), "subprotocols": [],
    }


def _teacher_ws(teacher: Teacher) -> dict:
    return _scope("role=teacher", bearer_headers(teacher.id, "teacher"))


def _haussprecher_ws(student: Student) -> dict:
    return _scope("role=haussprecher", bearer_headers(student.id, "student"))


# ── connecting ───────────────────────────────────────────────────────────────

def test_teacher_receives_the_full_state(client, db, teacher, session):
    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as ws:
            state = await ws.receive_json()
            assert state["event"] == "state"
            assert state["status"] == "waiting"
            assert state["title"] == "Kinoabend"
            assert state["prize_description"] == "Popcorn inklusive"
            assert state["bids"] == []
            assert state["winner_house_id"] is None
    asyncio.run(run())


def test_haussprecher_sees_only_their_own_bid(client, db, teacher, session, haus, haussprecher):
    db.add(AuctionBid(session_id=session.id, house_id=haus.id, amount=120))
    other = Haus(name="Süd", color="#654321")
    db.add(other)
    db.flush()
    db.add(AuctionBid(session_id=session.id, house_id=other.id, amount=300))
    db.flush()

    async def run():
        async with connect_ws(app, _haussprecher_ws(haussprecher)) as ws:
            state = await ws.receive_json()
            assert state["my_bid"] == 120           # not the other house's 300
            assert "bids" not in state
    asyncio.run(run())


def test_the_role_assigned_in_klassenverwaltung_grants_the_right_house(client, db, teacher, klass, haus, session):
    """Regression: the role is stored as "Haussprecher" scoped to the class, but
    the auction looked for role_type == "haussprecher" and read scope_id as a
    house id — so a real Haussprecher was refused, and a matching id would have
    resolved to the wrong house."""
    s = Student(nachname="Neu", vorname="Nina", klasse=klass.code, class_id=klass.id,
                geschlecht="weiblich", active=True)
    db.add(s)
    db.flush()
    teacher.klasse_id = klass.id
    db.flush()
    client.cookies.clear()
    head = auth(create_access_token({"sub": str(teacher.id), "type": "teacher"}))
    # Assign through the same endpoint the Häuser page calls.
    r = client.post("/api/roles", headers=head,
                    json={"student_id": s.id, "role_type": "Haussprecher", "scope_id": klass.id})
    assert r.status_code == 201
    session.status = "bidding"
    db.flush()

    async def run():
        async with connect_ws(app, _haussprecher_ws(s)) as ws:
            state = await ws.receive_json()
            assert state["event"] == "state"
            await ws.send_json({"action": "bid", "amount": 42})
            assert (await ws.receive_json()) == {"event": "bid_ack", "amount": 42}
    asyncio.run(run())

    bid = db.query(AuctionBid).one()
    assert bid.house_id == haus.id          # not klass.id, and not the decoy house
    assert bid.student_id == s.id


def test_a_haussprecher_whose_class_has_no_house_is_refused(client, db, klass, session):
    lonely_class = Class(code="9z", display_name="Klasse 9z")
    db.add(lonely_class)
    db.flush()
    s = Student(nachname="Ohne", vorname="Haus", klasse=lonely_class.code,
                class_id=lonely_class.id, geschlecht="weiblich", active=True)
    db.add(s)
    db.flush()
    db.add(StudentRole(student_id=s.id, role_type="Haussprecher", scope_id=lonely_class.id))
    db.flush()

    async def run():
        async with connect_ws(app, _haussprecher_ws(s)) as ws:
            msg = await ws.receive_json()
            assert msg["event"] == "error"
    asyncio.run(run())


def test_a_student_without_the_role_is_refused(client, db, klass, session):
    plain = Student(nachname="Ohne", vorname="Amt", klasse=klass.code, class_id=klass.id,
                    geschlecht="weiblich", active=True)
    db.add(plain)
    db.flush()

    async def run():
        async with connect_ws(app, _haussprecher_ws(plain)) as ws:
            msg = await ws.receive_json()
            assert msg["event"] == "error"
            assert "Haussprecher" in msg["message"]
    asyncio.run(run())


def test_auction_control_requires_a_teacher(client, db, session, haussprecher):
    async def run():
        # A student token on the control channel gets the teacher-only refusal.
        async with connect_ws(app, _scope("role=teacher",
                                          bearer_headers(haussprecher.id, "student"))) as ws:
            msg = await ws.receive_json()
            assert msg["event"] == "error"
            assert "Lehrkräfte" in msg["message"]
    asyncio.run(run())


def test_an_unknown_code_closes_the_socket(client, db, teacher, session):
    """This handler accepts first and closes with 4004 afterwards, so the close
    shows up on the first read rather than as a rejected handshake."""
    scope = _scope("role=teacher", bearer_headers(teacher.id, "teacher"))
    scope["path"] = "/api/auction/NOPE/ws"
    scope["raw_path"] = b"/api/auction/NOPE/ws"

    async def run():
        async with connect_ws(app, scope) as ws:
            with pytest.raises(ConnectionError, match="4004"):
                await ws.receive_json()
    asyncio.run(run())


# ── the QR lobby ─────────────────────────────────────────────────────────────

def _guest_ws(name: str) -> dict:
    return _scope(f"guest_token={create_guest_token(CODE, name)}&name={name}")


async def _join_lobby(ws) -> dict:
    """Lobby joiners get their state, then the players broadcast they triggered."""
    state = await ws.receive_json()
    players = await ws.receive_json()
    assert players["event"] == "players"
    return state


def test_a_guest_joins_as_a_spectator(client, db, session, haus):
    async def run():
        async with connect_ws(app, _guest_ws("Gast")) as ws:
            state = await _join_lobby(ws)
            assert state["is_haussprecher"] is False
            assert state["players"] == ["Gast"]
    asyncio.run(run())


def test_a_guest_can_never_bid_even_under_a_haussprechers_name(client, db, session, haus, haussprecher):
    """Guests are spectators, full stop — the Haussprecher role is assigned in
    Klassenverwaltung and read from the database, so typing someone's name into
    the join screen grants nothing. (It used to.)"""
    session.status = "bidding"
    db.flush()

    async def run():
        async with connect_ws(app, _guest_ws("Hans Sprecher")) as ws:
            state = await _join_lobby(ws)
            assert state["is_haussprecher"] is False
            await ws.send_json({"action": "bid", "amount": 100})
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(ws.receive_json(), timeout=0.3)
    asyncio.run(run())

    assert db.query(AuctionBid).count() == 0


def test_a_logged_in_student_cannot_borrow_a_name_either(client, db, klass, session, haus, haussprecher):
    """Same for the anon-token path: identity decides, the name query param does not."""
    other = Student(nachname="Beliebig", vorname="Bea", klasse=klass.code, class_id=klass.id,
                    geschlecht="weiblich", active=True)
    db.add(other)
    db.flush()
    session.status = "bidding"
    db.flush()

    scope = _scope("token=abc-123&name=Hans Sprecher", bearer_headers(other.id, "student"))

    async def run():
        async with connect_ws(app, scope) as ws:
            state = await _join_lobby(ws)
            assert state["is_haussprecher"] is False
            assert state["players"] == ["Bea Beliebig"]     # own name, not the typed one
            await ws.send_json({"action": "bid", "amount": 100})
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(ws.receive_json(), timeout=0.3)
    asyncio.run(run())

    assert db.query(AuctionBid).count() == 0


def test_a_logged_in_haussprecher_may_bid_from_the_lobby(client, db, session, haus, haussprecher):
    session.status = "bidding"
    db.flush()
    scope = _scope("token=abc-123", bearer_headers(haussprecher.id, "student"))

    async def run():
        async with connect_ws(app, scope) as ws:
            state = await _join_lobby(ws)
            assert state["is_haussprecher"] is True
            await ws.send_json({"action": "bid", "amount": 77})
            assert (await ws.receive_json()) == {"event": "bid_ack", "amount": 77}
    asyncio.run(run())

    bid = db.query(AuctionBid).one()
    assert (bid.house_id, bid.amount) == (haus.id, 77)


def test_an_anonymous_visitor_without_a_guest_token_is_closed_out(client, db, session):
    """No guest token means the teacher never opened this auction to guests."""
    async def run():
        async with connect_ws(app, _scope("token=abc-123&name=Wer")) as ws:
            with pytest.raises(ConnectionError, match="4001"):
                await ws.receive_json()
    asyncio.run(run())


# ── bidding ──────────────────────────────────────────────────────────────────

def test_bidding_only_counts_while_bidding_is_open(client, db, teacher, session, haus, haussprecher):
    async def run():
        async with connect_ws(app, _haussprecher_ws(haussprecher)) as ws:
            await ws.receive_json()
            # status is still "waiting" — the bid is ignored outright.
            await ws.send_json({"action": "bid", "amount": 50})
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(ws.receive_json(), timeout=0.3)
    asyncio.run(run())

    assert db.query(AuctionBid).count() == 0


def test_a_bid_reaches_the_teacher_and_can_be_raised(client, db, teacher, session, haus, haussprecher):
    session.status = "bidding"
    db.flush()

    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as host:
            await host.receive_json()
            async with connect_ws(app, _haussprecher_ws(haussprecher)) as ws:
                await ws.receive_json()

                await ws.send_json({"action": "bid", "amount": 120})
                assert await ws.receive_json() == {"event": "bid_ack", "amount": 120}
                update = await host.receive_json()
                assert update["event"] == "bid_update"
                assert update["bids"] == [
                    {"house_id": haus.id, "house_name": "Nord", "amount": 120,
                     "student_id": haussprecher.id},
                ]

                # A second bid replaces the first rather than adding one.
                await ws.send_json({"action": "bid", "amount": 200})
                await ws.receive_json()
                update2 = await host.receive_json()
                assert [b["amount"] for b in update2["bids"]] == [200]
    asyncio.run(run())

    assert db.query(AuctionBid).count() == 1


@pytest.mark.parametrize("amount", [0, -50])
def test_a_house_cannot_bid_zero_or_negative(client, db, teacher, session, haus, haussprecher, amount):
    session.status = "bidding"
    db.flush()

    async def run():
        async with connect_ws(app, _haussprecher_ws(haussprecher)) as ws:
            await ws.receive_json()
            await ws.send_json({"action": "bid", "amount": amount})
            msg = await ws.receive_json()
            assert msg["event"] == "error" and "> 0" in msg["message"]
    asyncio.run(run())

    assert db.query(AuctionBid).count() == 0


def test_a_house_cannot_bid_more_than_it_owns(client, db, teacher, session, haus, haussprecher):
    session.status = "bidding"
    db.flush()
    assert haus_total_points(db, haus.id) == 500

    async def run():
        async with connect_ws(app, _haussprecher_ws(haussprecher)) as ws:
            await ws.receive_json()
            await ws.send_json({"action": "bid", "amount": 501})
            msg = await ws.receive_json()
            assert msg["event"] == "error" and "500" in msg["message"]
            # Exactly the balance is fine.
            await ws.send_json({"action": "bid", "amount": 500})
            assert (await ws.receive_json())["event"] == "bid_ack"
    asyncio.run(run())

    assert [b.amount for b in db.query(AuctionBid).all()] == [500]


# ── awarding ─────────────────────────────────────────────────────────────────

def test_awarding_charges_every_member_class(client, db, teacher, session, haus, klass):
    second = Class(code="6b", display_name="Klasse 6b")
    db.add(second)
    db.flush()
    db.add(HausMember(haus_id=haus.id, class_id=second.id))
    db.add(Transaction(teacher_id=teacher.id, class_id=second.id, points=500, reason="Startpunkte"))
    session.status = "closed"
    db.flush()

    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as host:
            await host.receive_json()
            await host.send_json({"action": "award", "house_id": haus.id, "amount": 200})
            msg = await host.receive_json()
            assert msg["event"] == "awarded"
            assert msg["winner_name"] == "Nord"
            assert msg["winning_bid"] == 200
    asyncio.run(run())

    charges = [t for t in db.query(Transaction).all() if t.points < 0]
    assert len(charges) == 2                       # one per member class
    assert {t.points for t in charges} == {-100}   # 200 split evenly
    assert all("Kinoabend" in t.reason for t in charges)
    db.refresh(session)
    assert (session.winner_house_id, session.winning_bid) == (haus.id, 200)
    assert haus_total_points(db, haus.id) == 800   # 1000 - 200


def test_awarding_twice_does_not_charge_twice(client, db, teacher, session, haus):
    """Regression: 'award' only checked the status, which stays "closed" after
    the first award — so a second click booked the charge all over again."""
    session.status = "closed"
    db.flush()

    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as host:
            await host.receive_json()
            await host.send_json({"action": "award", "house_id": haus.id, "amount": 100})
            assert (await host.receive_json())["event"] == "awarded"

            await host.send_json({"action": "award", "house_id": haus.id, "amount": 100})
            msg = await host.receive_json()
            assert msg["event"] == "error"
            assert "bereits vergeben" in msg["message"]
    asyncio.run(run())

    assert len([t for t in db.query(Transaction).all() if t.points < 0]) == 1
    assert haus_total_points(db, haus.id) == 400


def test_a_house_cannot_be_awarded_more_than_it_owns(client, db, teacher, session, haus):
    session.status = "closed"
    db.flush()

    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as host:
            await host.receive_json()
            await host.send_json({"action": "award", "house_id": haus.id, "amount": 501})
            msg = await host.receive_json()
            assert msg["event"] == "error" and "500" in msg["message"]
    asyncio.run(run())

    assert db.query(Transaction).filter(Transaction.points < 0).count() == 0
    db.refresh(session)
    assert session.winner_house_id is None


def test_awarding_a_house_without_member_classes_charges_nobody(client, db, teacher, session):
    empty = Haus(name="Leer", color="#000000")
    db.add(empty)
    session.status = "closed"
    db.flush()

    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as host:
            await host.receive_json()
            # A house with no classes has 0 points, so any amount is refused.
            await host.send_json({"action": "award", "house_id": empty.id, "amount": 10})
            assert (await host.receive_json())["event"] == "error"
    asyncio.run(run())

    assert db.query(Transaction).count() == 0


def test_the_bidding_lifecycle_broadcasts_each_step(client, db, teacher, session, haus, haussprecher):
    async def run():
        async with connect_ws(app, _teacher_ws(teacher)) as host:
            await host.receive_json()

            await host.send_json({"action": "open_bidding"})
            assert (await host.receive_json()) == {"event": "bidding_open"}
            state = await host.receive_json()
            assert state["status"] == "bidding"

            await host.send_json({"action": "close_bidding"})
            closed = await host.receive_json()
            assert closed["event"] == "bidding_closed"
            assert closed["status"] == "closed"

            # Re-opening a closed auction is not a thing.
            await host.send_json({"action": "open_bidding"})
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(host.receive_json(), timeout=0.3)
    asyncio.run(run())

    db.refresh(session)
    assert session.status == "closed"


# ── REST guards ──────────────────────────────────────────────────────────────

def test_students_cannot_delete_an_auction(client, db, teacher, session, haussprecher):
    """Regression: the guard read `current.role`, which a Student does not have,
    so the endpoint raised AttributeError (500) instead of refusing."""
    client.cookies.clear()
    student_head = auth(create_access_token({"sub": str(haussprecher.id), "type": "student"}))
    r = client.delete(f"/api/auction/{CODE}", headers=student_head)
    assert r.status_code == 403
    assert db.query(AuctionSession).filter_by(code=CODE).first() is not None
