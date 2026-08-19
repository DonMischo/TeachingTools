"""Tests for cross-session adaptive scaffolding (LueckentextErrorPattern)."""
from datetime import datetime, timedelta, timezone

import pytest

from api.tests.conftest import auth
from api.auth import create_guest_token
from api.tests.test_lueckentexte import token_for
from api.lueckentext_engine import reveal_state, normalize_name, _ESCALATE
from api.models import LueckentextResponse


@pytest.fixture()
def teacher_token(teacher):
    return token_for(teacher)


def gap_payload():
    return {
        "title": "Wasserkreislauf",
        "text": "Es entsteht {{hard1}}.",
        "gaps": [
            {"id": "hard1", "answer": "Grün", "type": "free_type", "difficulty": "hard", "hint": "Tipp H", "choices": None},
        ],
        "distractors": [],
    }


@pytest.fixture()
def set_id(client, teacher_token):
    r = client.post("/api/lueckentexte", json=gap_payload(), headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _start_session(client, teacher_token, set_id):
    r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    code = r.json()["join_code"]
    r = client.post(f"/api/lueckentexte/sessions/{code}/start", headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    return code


def _join(client, code, name):
    r = client.post(f"/api/lueckentexte/sessions/{code}/join", json={"name": name, "avatar": "cat"}, headers={"Authorization": f"Bearer {create_guest_token(code, name)}"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# a) Unit test: reveal_state escalation ladder
# ---------------------------------------------------------------------------

class TestRevealStateEscalation:
    @pytest.mark.parametrize("tier", ["hard", "medium"])
    def test_escalates_to_more_generous_ladder(self, tier):
        seconds, attempts = 12.0, 2
        escalated = reveal_state(tier, seconds, attempts, miss_count=2)
        expected = reveal_state(_ESCALATE[tier], seconds, attempts, miss_count=0)
        assert escalated == expected

    def test_easy_unaffected_by_escalation(self):
        seconds, attempts = 12.0, 2
        base = reveal_state("easy", seconds, attempts, miss_count=0)
        escalated = reveal_state("easy", seconds, attempts, miss_count=2)
        assert escalated == base


# ---------------------------------------------------------------------------
# c) normalize_name case/umlaut insensitivity
# ---------------------------------------------------------------------------

def test_normalize_name_case_and_umlaut_insensitive():
    assert normalize_name("Max") == normalize_name("max")
    assert normalize_name("Müller") == normalize_name("Mueller")


# ---------------------------------------------------------------------------
# b) Integration: cross-session miss history biases reveal_state
# ---------------------------------------------------------------------------

class TestCrossSessionAdaptiveScaffolding:
    def test_repeat_offender_gets_more_scaffolding_than_fresh_name(self, client, teacher_token, set_id, db):
        # Session 1: Max misses hard1 repeatedly -> miss_count reaches 2.
        code1 = _start_session(client, teacher_token, set_id)
        max_pid_1 = _join(client, code1, "Max")
        for _ in range(2):
            r = client.post(
                f"/api/lueckentexte/sessions/{code1}/gaps/hard1/attempt",
                json={"participant_id": max_pid_1, "text": "falsch"},
            )
            assert r.status_code == 200, r.text
            assert r.json()["match"] == "wrong"

        r = client.post(f"/api/lueckentexte/sessions/{code1}/finish", headers=auth(teacher_token))
        assert r.status_code == 200, r.text

        # Session 2: same set, "Max" (repeat offender) vs. "Fresh" (no history).
        code2 = _start_session(client, teacher_token, set_id)
        max_pid_2 = _join(client, code2, "Max")
        fresh_pid = _join(client, code2, "Fresh")

        # "hard1" never reveals for a fresh (miss_count=0) student, no matter
        # how many wrong attempts: the "hard" ladder's reveal is always False.
        fresh_revealed = False
        for _ in range(6):
            r = client.post(
                f"/api/lueckentexte/sessions/{code2}/gaps/hard1/attempt",
                json={"participant_id": fresh_pid, "text": "falsch"},
            )
            assert r.status_code == 200, r.text
            fresh_revealed = fresh_revealed or r.json()["revealed"]
        assert fresh_revealed is False

        # Max's history (miss_count=2) escalates hard -> medium, whose last
        # rung does reveal -> eventually revealed becomes True. Backdate the
        # response's last_attempt_at between attempts to simulate a slow,
        # struggling student (the DDA snapshot factors in elapsed time).
        max_revealed = False
        for i in range(6):
            r = client.post(
                f"/api/lueckentexte/sessions/{code2}/gaps/hard1/attempt",
                json={"participant_id": max_pid_2, "text": "falsch"},
            )
            assert r.status_code == 200, r.text
            max_revealed = max_revealed or r.json()["revealed"]
            resp = db.query(LueckentextResponse).filter_by(participant_id=max_pid_2, gap_id="hard1").first()
            resp.last_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=50)
            db.flush()
        assert max_revealed is True
