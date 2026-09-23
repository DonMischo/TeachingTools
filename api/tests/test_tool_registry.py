"""Tests for the Stundenplanung tool registry (api/tool_registry.py) and the
generic POST /api/stundenplaner/tools/{type}/launch endpoint."""
import pytest

from api.models import (
    Teacher, Quiz, BingoSet, AuctionSet,
    BarometerSession, ExitTicketSession, SchreibraumRoom, SchreibraumAccess,
    BingoSession, QuizSession,
)
from api.auth import hash_password
from api.tool_registry import REGISTRY


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bernd", last_name="Koch", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def teacher_token(client, teacher) -> str:
    r = client.post("/api/auth/login", json={"username": "Anna Müller", "password": "secret"})
    client.cookies.clear()
    return r.json()["access_token"]


@pytest.fixture()
def teacher2_token(client, teacher2) -> str:
    r = client.post("/api/auth/login", json={"username": "Bernd Koch", "password": "secret2"})
    client.cookies.clear()
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _launch(client, token, tool_type, ref_id=None, klasse=None):
    return client.post(
        f"/api/stundenplaner/tools/{tool_type}/launch",
        json={"ref_id": ref_id, "klasse": klasse},
        headers=_auth(token),
    )


class TestRegistryShape:
    def test_every_descriptor_is_complete(self):
        for t, d in REGISTRY.items():
            assert d.type == t
            assert d.label
            assert callable(d.list_refs)
            assert callable(d.launch)

    def test_tool_link_validation_follows_registry(self, client, teacher_token):
        """ToolLinkIn accepts every registry type and rejects unknown ones."""
        for t in REGISTRY:
            body = {"title": "P", "phasen": [{"name": "E", "tool_link": {"type": t, "ref_id": "x1", "label": ""}}]}
            r = client.post("/api/stundenplaner", json=body, headers=_auth(teacher_token))
            assert r.status_code == 201, f"{t}: {r.text}"
        body = {"title": "P", "phasen": [{"name": "E", "tool_link": {"type": "bogus", "ref_id": "x1", "label": ""}}]}
        r = client.post("/api/stundenplaner", json=body, headers=_auth(teacher_token))
        assert r.status_code == 422


class TestLaunch:
    def test_unknown_type_404(self, client, teacher_token):
        r = _launch(client, teacher_token, "bogus")
        assert r.status_code == 404

    def test_requires_auth(self, client):
        r = client.post("/api/stundenplaner/tools/classroom/launch", json={})
        assert r.status_code == 401

    def test_classroom_static(self, client, teacher_token):
        r = _launch(client, teacher_token, "classroom")
        assert r.status_code == 200
        assert r.json() == {"host_url": "/classroom", "join_url": None, "code": None}

    def test_caputh_with_class(self, client, db, teacher, teacher_token, klass):
        quiz = Quiz(title="Q")
        db.add(quiz)
        db.flush()
        r = _launch(client, teacher_token, "caputh", ref_id=str(quiz.id), klasse=klass.code)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["host_url"].startswith("/aktivitaeten/caputh/host/")
        assert body["join_url"] == f"/play/{body['code']}"
        session = db.query(QuizSession).filter_by(join_code=body["code"]).one()
        assert session.class_id == klass.id

    def test_caputh_without_class_400(self, client, db, teacher_token):
        quiz = Quiz(title="Q")
        db.add(quiz)
        db.flush()
        r = _launch(client, teacher_token, "caputh", ref_id=str(quiz.id))
        assert r.status_code == 400

    def test_caputh_stale_ref_404(self, client, teacher_token, klass):
        r = _launch(client, teacher_token, "caputh", ref_id="ABC123", klasse=klass.code)
        assert r.status_code == 404
        assert "veraltet" in r.json()["detail"]

    def test_bingo_binds_class(self, client, db, teacher, teacher_token, klass):
        bset = BingoSet(title="B", created_by=teacher.id)
        db.add(bset)
        db.flush()
        r = _launch(client, teacher_token, "bingo", ref_id=str(bset.id), klasse=klass.code)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["host_url"] == f"/aktivitaeten/bingo/host/{body['code']}"
        session = db.query(BingoSession).filter_by(code=body["code"]).one()
        assert session.class_id == klass.id

    def test_bingo_without_class_unbound(self, client, db, teacher, teacher_token):
        bset = BingoSet(title="B", created_by=teacher.id)
        db.add(bset)
        db.flush()
        r = _launch(client, teacher_token, "bingo", ref_id=str(bset.id))
        assert r.status_code == 200
        session = db.query(BingoSession).filter_by(code=r.json()["code"]).one()
        assert session.class_id is None

    def test_auction_fresh_session_each_launch(self, client, db, teacher, teacher_token):
        aset = AuctionSet(title="A", created_by=teacher.id)
        db.add(aset)
        db.flush()
        r1 = _launch(client, teacher_token, "auction", ref_id=str(aset.id))
        r2 = _launch(client, teacher_token, "auction", ref_id=str(aset.id))
        assert r1.status_code == r2.status_code == 200
        assert r1.json()["code"] != r2.json()["code"]
        assert r1.json()["host_url"].startswith("/tools/auction/host/")

    def test_barometer_own_and_shared(self, client, db, teacher, teacher2, teacher2_token):
        shared = BarometerSession(code="SHR10001", title="Geteilt", created_by=teacher.id, shared=True)
        unshared = BarometerSession(code="OTH10001", title="Fremd", created_by=teacher.id, shared=False)
        db.add_all([shared, unshared])
        db.flush()

        r = _launch(client, teacher2_token, "barometer", ref_id="SHR10001")
        assert r.status_code == 200
        assert r.json()["host_url"].startswith("/tools/barometer/host/")

        r2 = _launch(client, teacher2_token, "barometer", ref_id="OTH10001")
        assert r2.status_code == 403

    def test_exit_ticket_creator_only(self, client, db, teacher, teacher2, teacher_token, teacher2_token):
        own = ExitTicketSession(code="OWN10002", title="Meins", question="Q?", created_by=teacher.id)
        db.add(own)
        db.flush()

        r = _launch(client, teacher_token, "exit-ticket", ref_id="OWN10002")
        assert r.status_code == 200
        assert r.json()["host_url"].startswith("/tools/exit-ticket/host/")

        r2 = _launch(client, teacher2_token, "exit-ticket", ref_id="OWN10002")
        assert r2.status_code == 403

    def test_schreibraum_grants_class_access(self, client, db, teacher, teacher_token, klass):
        room = SchreibraumRoom(code="ROOM01", title="R", created_by=teacher.id)
        db.add(room)
        db.flush()

        r = _launch(client, teacher_token, "schreibraum", ref_id="ROOM01", klasse=klass.code)
        assert r.status_code == 200
        assert r.json()["host_url"] == "/schreibraum/ROOM01"
        grants = db.query(SchreibraumAccess).filter_by(room_id=room.id, class_id=klass.id).all()
        assert len(grants) == 1

        # Idempotent: second launch doesn't duplicate the grant
        _launch(client, teacher_token, "schreibraum", ref_id="ROOM01", klasse=klass.code)
        grants = db.query(SchreibraumAccess).filter_by(room_id=room.id, class_id=klass.id).all()
        assert len(grants) == 1
