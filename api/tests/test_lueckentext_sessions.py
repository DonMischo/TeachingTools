"""REST tests for Lückentext live sessions (api/routers/lueckentexte.py Stage 2)."""
import pytest

from api.tests.conftest import auth
from api.tests.test_lueckentexte import sample_payload, token_for
from api.models import Teacher


@pytest.fixture()
def teacher_token(teacher):
    return token_for(teacher)


def gap_payload():
    return {
        "title": "Wasserkreislauf",
        "text": "Es entsteht {{easy1}} und {{hard1}}.",
        "gaps": [
            {"id": "easy1", "answer": "Verdunstung", "type": "free_type", "difficulty": "easy", "hint": "Tipp E", "choices": None},
            {"id": "hard1", "answer": "Grün", "type": "free_type", "difficulty": "hard", "hint": "Tipp H", "choices": None},
        ],
        "distractors": [],
    }


@pytest.fixture()
def set_id(client, teacher_token):
    r = client.post("/api/lueckentexte", json=gap_payload(), headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture()
def session_code(client, teacher_token, set_id):
    r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    return r.json()["join_code"]


@pytest.fixture()
def participant_id(client, session_code):
    r = client.post(f"/api/lueckentexte/sessions/{session_code}/join", json={"name": "Max", "avatar": "cat"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


class TestSessionLifecycle:
    def test_join_and_state_before_after_start(self, client, teacher_token, session_code, participant_id):
        r = client.get(f"/api/lueckentexte/sessions/{session_code}/state")
        assert r.status_code == 200
        assert r.json()["status"] == "waiting"
        assert r.json()["board"] is None

        r = client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["status"] == "active"

        r = client.get(f"/api/lueckentexte/sessions/{session_code}/state")
        assert r.json()["status"] == "active"
        assert r.json()["board"] is not None
        assert r.json()["board"]["text"]

    def test_unknown_join_code_404(self, client):
        assert client.post("/api/lueckentexte/sessions/XXXXXXXX/join", json={"name": "A"}).status_code == 404
        assert client.get("/api/lueckentexte/sessions/XXXXXXXX/state").status_code == 404

    def test_unknown_gap_id_404(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        r = client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/nope/attempt",
            json={"participant_id": participant_id, "text": "x"},
        )
        assert r.status_code == 404


class TestAttempts:
    def test_exact_correct_answer(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        r = client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/easy1/attempt",
            json={"participant_id": participant_id, "text": "Verdunstung"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["match"] == "exact"
        assert body["solved"] is True

    def test_typo_is_near(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        r = client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/easy1/attempt",
            json={"participant_id": participant_id, "text": "Verdunstunk"},
        )
        assert r.json()["match"] == "near"

    def test_unrelated_is_wrong(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        r = client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/easy1/attempt",
            json={"participant_id": participant_id, "text": "Bananenschale"},
        )
        assert r.json()["match"] == "wrong"
        assert r.json()["solved"] is False

    def test_umlaut_variant_is_exact(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        r = client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/hard1/attempt",
            json={"participant_id": participant_id, "text": "Gruen"},
        )
        assert r.json()["match"] == "exact"

    def test_hard_gap_repeated_wrong_never_reveals(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        for _ in range(3):
            r = client.post(
                f"/api/lueckentexte/sessions/{session_code}/gaps/hard1/attempt",
                json={"participant_id": participant_id, "text": "falsch"},
            )
            assert r.json()["revealed"] is False

    def test_easy_gap_repeated_wrong_eventually_reveals(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        revealed = False
        for _ in range(3):
            r = client.post(
                f"/api/lueckentexte/sessions/{session_code}/gaps/easy1/attempt",
                json={"participant_id": participant_id, "text": "falsch"},
            )
            revealed = revealed or r.json()["revealed"]
        assert revealed is True

    def test_participant_from_other_session_403(self, client, teacher_token, set_id, session_code, participant_id):
        r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
        other_code = r.json()["join_code"]
        client.post(f"/api/lueckentexte/sessions/{other_code}/start", headers=auth(teacher_token))
        r = client.post(
            f"/api/lueckentexte/sessions/{other_code}/gaps/easy1/attempt",
            json={"participant_id": participant_id, "text": "Verdunstung"},
        )
        assert r.status_code == 403
