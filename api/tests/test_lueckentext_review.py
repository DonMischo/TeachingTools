"""Tests for Lückentext Stage 3: GET /sessions/{code}/review."""
import pytest

from api.tests.conftest import auth
from api.auth import create_guest_token
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
    r = client.post(f"/api/lueckentexte/sessions/{session_code}/join", json={"name": "Max", "avatar": "cat"}, headers={"Authorization": f"Bearer {create_guest_token(session_code, 'Max')}"})
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


class TestSessionList:
    def test_lists_own_sessions_newest_first(self, client, teacher_token, set_id, session_code):
        second = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token)).json()["join_code"]

        r = client.get(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert [s["join_code"] for s in rows] == [second, session_code]
        assert rows[0]["status"] == "waiting"
        assert rows[0]["participant_count"] == 0
        assert rows[0]["created_at"] is not None

    def test_counts_participants(self, client, teacher_token, set_id, session_code, participant_id):
        rows = client.get(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token)).json()
        assert rows[0]["participant_count"] == 1

    def test_hides_other_teachers_sessions(self, client, other_teacher_token, set_id, session_code):
        """The set is shared, the sessions are not — a colleague sees an empty list."""
        r = client.get(f"/api/lueckentexte/{set_id}/sessions", headers=auth(other_teacher_token))
        assert r.status_code == 200
        assert r.json() == []


class TestSessionDelete:
    def test_delete_takes_participants_and_responses(self, client, db, teacher_token, session_code, participant_id):
        from api.models import LueckentextParticipant, LueckentextResponse, LueckentextSession

        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        client.post(f"/api/lueckentexte/sessions/{session_code}/gaps/a/attempt",
                    json={"participant_id": participant_id, "text": "Verdunstung"})
        assert db.query(LueckentextResponse).filter_by(participant_id=participant_id).count() == 1

        r = client.delete(f"/api/lueckentexte/sessions/{session_code}", headers=auth(teacher_token))
        assert r.status_code == 204, r.text
        assert db.query(LueckentextSession).filter_by(join_code=session_code).count() == 0
        assert db.get(LueckentextParticipant, participant_id) is None
        assert db.query(LueckentextResponse).filter_by(participant_id=participant_id).count() == 0

    def test_delete_403_for_non_owner_teacher(self, client, other_teacher_token, session_code):
        r = client.delete(f"/api/lueckentexte/sessions/{session_code}", headers=auth(other_teacher_token))
        assert r.status_code == 403

    def test_delete_unknown_session_404(self, client, teacher_token):
        assert client.delete("/api/lueckentexte/sessions/NOPE1234", headers=auth(teacher_token)).status_code == 404

    def test_deleted_session_leaves_the_list(self, client, teacher_token, set_id, session_code):
        client.delete(f"/api/lueckentexte/sessions/{session_code}", headers=auth(teacher_token))
        rows = client.get(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token)).json()
        assert rows == []


class TestReport:
    def _play(self, client, teacher_token, session_code, participant_id):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        for text in ("falsch", "Verdunstung"):
            client.post(f"/api/lueckentexte/sessions/{session_code}/gaps/a/attempt",
                        json={"participant_id": participant_id, "text": text})

    def test_report_summarizes_per_student(self, client, teacher_token, session_code, participant_id):
        self._play(client, teacher_token, session_code, participant_id)

        r = client.get(f"/api/lueckentexte/sessions/{session_code}/report", headers=auth(teacher_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["lueckentext_title"] == "Wasserkreislauf"
        row = body["participants"][0]
        assert row["name"] == "Max"
        assert row["gaps_solved"] == 1        # "a" solved, "b" never touched
        assert row["gaps_total"] == 2
        assert row["attempts_total"] == 2     # one wrong, one right
        # Gap "a" is "easy": the reveal ladder opens it up on the second attempt,
        # so the miss is counted as scaffolded — that's what the column is for.
        assert row["revealed_total"] == 1

    def test_report_as_csv(self, client, teacher_token, session_code, participant_id):
        self._play(client, teacher_token, session_code, participant_id)

        r = client.get(f"/api/lueckentexte/sessions/{session_code}/report?fmt=csv", headers=auth(teacher_token))
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("text/csv")
        assert f'filename="lueckentext_{session_code}.csv"' in r.headers["content-disposition"]
        text = r.content.decode("utf-8-sig")   # BOM so Excel gets the umlauts right
        lines = text.strip().splitlines()
        assert lines[0].split(",")[:3] == ["Name", "Gelöst", "Lücken gesamt"]
        assert lines[1].startswith("Max,1,2,2,")

    def test_report_403_for_non_owner_teacher(self, client, other_teacher_token, session_code):
        r = client.get(f"/api/lueckentexte/sessions/{session_code}/report", headers=auth(other_teacher_token))
        assert r.status_code == 403


class TestQueryBatching:
    """Review, report and live ranking load all responses of a session in one query,
    not one per participant."""

    def _three_players(self, client, teacher_token, session_code):
        client.post(f"/api/lueckentexte/sessions/{session_code}/start", headers=auth(teacher_token))
        pids = []
        for name in ("Ada", "Ben", "Cem"):
            r = client.post(f"/api/lueckentexte/sessions/{session_code}/join", json={"name": name, "avatar": "cat"},
                            headers={"Authorization": f"Bearer {create_guest_token(session_code, name)}"})
            pids.append(r.json()["id"])
        # Ada loest beide Luecken, Ben eine, Cem keine.
        for pid, gaps in zip(pids, (("a", "b"), ("a",), ())):
            for gap, text in (("a", "Verdunstung"), ("b", "Wolke")):
                if gap in gaps:
                    client.post(f"/api/lueckentexte/sessions/{session_code}/gaps/{gap}/attempt",
                                json={"participant_id": pid, "text": text})
        return pids

    def test_review_uses_one_response_query(self, client, teacher_token, session_code, count_selects):
        self._three_players(client, teacher_token, session_code)
        before = count_selects("lueckentext_responses")
        r = client.get(f"/api/lueckentexte/sessions/{session_code}/review", headers=auth(teacher_token))
        assert r.status_code == 200
        assert count_selects("lueckentext_responses") - before == 1
        solved = {e["name"]: sum(g["solved"] for g in e["gaps"]) for e in r.json()}
        assert solved == {"Ada": 2, "Ben": 1, "Cem": 0}

    def test_ranking_uses_one_response_query(self, client, db, teacher_token, session_code, count_selects):
        from api.models import LueckentextSession
        from api.routers.lueckentexte import _build_ranking
        self._three_players(client, teacher_token, session_code)
        s = db.query(LueckentextSession).filter_by(join_code=session_code).one()
        before = count_selects("lueckentext_responses")
        ranking = _build_ranking(s, db)
        assert count_selects("lueckentext_responses") - before == 1
        assert [e["name"] for e in ranking][:2] == ["Ada", "Ben"]
