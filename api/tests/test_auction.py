"""Tests for the Auction router's content/session split (AuctionSet library
+ AuctionSession instances) — mirrors api/tests/test_bingo.py::TestBingoSets."""
import pytest

from api.models import Teacher
from api.auth import hash_password


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


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_auction(client, token, title="Kuchen"):
    r = client.post("/api/auction", json={"title": title, "description": "Ein Kuchen", "prize_description": "1x Kuchen"}, headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()["code"]


class TestRestEndpoints:
    def test_create_requires_auth(self, client):
        r = client.post("/api/auction", json={"title": "T"})
        assert r.status_code == 401

    def test_create_and_list(self, client, teacher_token):
        _create_auction(client, teacher_token)
        r = client.get("/api/auction", headers=_auth(teacher_token))
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["title"] == "Kuchen"

    def test_delete_session(self, client, teacher_token):
        code = _create_auction(client, teacher_token)
        r = client.delete(f"/api/auction/{code}", headers=_auth(teacher_token))
        assert r.status_code == 204
        assert client.get("/api/auction", headers=_auth(teacher_token)).json() == []


class TestAuctionSets:
    def test_create_also_creates_reusable_set(self, client, teacher_token):
        _create_auction(client, teacher_token)
        h = _auth(teacher_token)
        sets = client.get("/api/auction/sets", headers=h).json()
        assert len(sets) == 1
        assert sets[0]["title"] == "Kuchen"

        sessions = client.get("/api/auction", headers=h).json()
        assert sessions[0]["title"] == "Kuchen"
        assert sessions[0]["prize_description"] == "1x Kuchen"

    def test_sets_open_to_other_teachers(self, client, teacher_token, teacher2_token):
        _create_auction(client, teacher_token)
        r = client.get("/api/auction/sets", headers=_auth(teacher2_token))
        assert len(r.json()) == 1

    def test_start_session_from_set(self, client, teacher_token):
        h = _auth(teacher_token)
        _create_auction(client, teacher_token)
        set_id = client.get("/api/auction/sets", headers=h).json()[0]["id"]

        r = client.post(f"/api/auction/sets/{set_id}/sessions", headers=h)
        assert r.status_code == 201
        assert r.json()["title"] == "Kuchen"

        sessions = client.get("/api/auction", headers=h).json()
        assert len(sessions) == 2

    def test_start_session_from_unknown_set_404(self, client, teacher_token):
        r = client.post("/api/auction/sets/999999/sessions", headers=_auth(teacher_token))
        assert r.status_code == 404

    def test_start_session_requires_auth(self, client, teacher_token):
        h = _auth(teacher_token)
        _create_auction(client, teacher_token)
        set_id = client.get("/api/auction/sets", headers=h).json()[0]["id"]
        client.cookies.clear()
        r = client.post(f"/api/auction/sets/{set_id}/sessions")
        assert r.status_code == 401

    def test_list_filters_by_set_id(self, client, teacher_token):
        h = _auth(teacher_token)
        _create_auction(client, teacher_token, title="A")
        set_id = client.get("/api/auction/sets", headers=h).json()[0]["id"]
        client.post(f"/api/auction/sets/{set_id}/sessions", headers=h)

        other_code = _create_auction(client, teacher_token, title="B")
        other_set_id = next(s["id"] for s in client.get("/api/auction/sets", headers=h).json() if s["id"] != set_id)

        filtered = client.get(f"/api/auction?set_id={set_id}", headers=h).json()
        assert len(filtered) == 2
        assert other_code not in [s["code"] for s in filtered]

        other_filtered = client.get(f"/api/auction?set_id={other_set_id}", headers=h).json()
        assert len(other_filtered) == 1
        assert other_filtered[0]["code"] == other_code
