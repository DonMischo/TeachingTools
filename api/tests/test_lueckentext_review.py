"""Tests for Lückentext Stage 3: GET /sessions/{code}/review."""
import pytest

from api.tests.conftest import auth
from api.tests.test_lueckentexte import token_for
from api.models import Teacher
from api.auth import hash_password


def gap_payload():
    return {
        "title": "Wasserkreislauf",
        "text": "Es entsteht {{a}} und {{b}}.",
        "gaps": [
            {"id": "a", "answer": "Verdunstung", "type": "free_type", "difficulty": "easy", "hint": None, "choices": None},
            {"id": "b", "answer": "Wolke", "type": "free_type", "difficulty": "medium", "hint": None, "choices": None},
        ],
        "distractors": [],
    }


@pytest.fixture()
def teacher_token(teacher):
    return token_for(teacher)


@pytest.fixture()
def other_teacher(db) -> Teacher:
    t = Teacher(first_name="Bernd", last_name="Koch", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def other_teacher_token(other_teacher):
    return token_for(other_teacher)


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


class TestReview:
    def test_review_reports_attempts_hints_and_time(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))

        # gap "a": one wrong attempt, then correct
        client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/a/attempt",
            json={"participant_id": participant_id, "text": "falsch"},
        )
        r = client.post(
            f"/api/lueckentexte/sessions/{session_code}/gaps/a/attempt",
            json={"participant_id": participant_id, "text": "Verdunstung"},
        )
        assert r.status_code == 200, r.text

        # gap "b": left untouched entirely

        r = client.get(f"/api/lueckentexte/sessions/{session_code}/review", headers=auth(teacher_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body) == 1
        entry = body[0]
        assert entry["name"] == "Max"

        gaps = {g["gap_id"]: g for g in entry["gaps"]}
        assert gaps["a"]["attempts"] == 2
        assert gaps["a"]["match"] == "exact"
        assert gaps["a"]["solved"] is True
        assert gaps["a"]["time_spent_seconds"] is not None
        assert gaps["a"]["time_spent_seconds"] >= 0

        assert gaps["b"]["attempts"] == 0
        assert gaps["b"]["solved"] is False
        assert gaps["b"]["time_spent_seconds"] is None

    def test_review_403_for_non_owner_teacher(self, client, other_teacher_token, session_code):
        r = client.get(f"/api/lueckentexte/sessions/{session_code}/review", headers=auth(other_teacher_token))
        assert r.status_code == 403
