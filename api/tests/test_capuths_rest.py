"""
REST endpoint tests for Caputh (upload, list, get, delete, create session).
"""
import io
import json
import zipfile

import pytest

from api.models import Quiz, QuizQuestion, QuizAnswer, QuizSession, QuizParticipant


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_zip(quiz_dict: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("quiz.json", json.dumps(quiz_dict))
    return buf.getvalue()


MINIMAL_QUIZ = {
    "title": "Miniquiz",
    "max_points": 4,
    "time_limit_default": 20,
    "settings": {"randomize_answer_order": False},
    "questions": [
        {
            "type": "single",
            "question": "Was ist 1+1?",
            "answers": [
                {"text": "1", "correct": False},
                {"text": "2", "correct": True},
            ],
        },
        {
            "type": "single",
            "question": "Was ist 2+2?",
            "answers": [
                {"text": "3", "correct": False},
                {"text": "4", "correct": True},
            ],
        },
    ],
}


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

class TestUpload:
    def test_upload_zip_creates_caputh(self, client, teacher_token):
        data = _make_zip(MINIMAL_QUIZ)
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.zip", data, "application/zip")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["title"] == "Miniquiz"
        assert body["question_count"] == 2
        assert body["max_points"] == 4

    def test_upload_json_directly(self, client, teacher_token):
        raw = json.dumps(MINIMAL_QUIZ).encode()
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.json", raw, "application/json")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        assert r.json()["title"] == "Miniquiz"

    def test_upload_requires_auth(self, client):
        data = _make_zip(MINIMAL_QUIZ)
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.zip", data, "application/zip")},
        )
        assert r.status_code == 401

    def test_upload_bad_zip_returns_400(self, client, teacher_token):
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.zip", b"notazip", "application/zip")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 400

    def test_upload_missing_title_returns_422(self, client, teacher_token):
        bad = {**MINIMAL_QUIZ}
        del bad["title"]
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.json", json.dumps(bad).encode(), "application/json")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 422

    def test_max_points_capped_at_questions_times_two(self, client, teacher_token):
        """2 scored questions → max allowed = 4. JSON says 999 → capped."""
        over = {**MINIMAL_QUIZ, "max_points": 999}
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.json", json.dumps(over).encode(), "application/json")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["max_points"] == 4
        assert body["warning"] is not None
        assert "999" in body["warning"]

    def test_max_points_within_limit_no_warning(self, client, teacher_token):
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.json", json.dumps(MINIMAL_QUIZ).encode(), "application/json")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        assert r.json()["warning"] is None

    def test_survey_questions_not_counted_in_cap(self, client, teacher_token):
        """1 scored + 1 survey → max = 2. Survey doesn't contribute to cap."""
        mixed = {
            "title": "Mixed",
            "max_points": 2,
            "time_limit_default": 20,
            "settings": {},
            "questions": [
                {"type": "single", "question": "Q1", "answers": [{"text": "A", "correct": True}]},
                {"type": "survey", "question": "Umfrage", "answers": [{"text": "Ja"}, {"text": "Nein"}]},
            ],
        }
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.json", json.dumps(mixed).encode(), "application/json")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        assert r.json()["max_points"] == 2
        assert r.json()["warning"] is None


# ---------------------------------------------------------------------------
# List / Get / Delete
# ---------------------------------------------------------------------------

class TestCRUD:
    @pytest.fixture()
    def uploaded(self, client, teacher_token):
        r = client.post(
            "/api/capuths/upload",
            files={"file": ("quiz.json", json.dumps(MINIMAL_QUIZ).encode(), "application/json")},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        return r.json()

    def test_list_returns_uploaded(self, client, uploaded):
        r = client.get("/api/capuths")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert uploaded["id"] in ids

    def test_get_detail_includes_questions(self, client, uploaded):
        r = client.get(f"/api/capuths/{uploaded['id']}")
        assert r.status_code == 200
        body = r.json()
        assert "questions" in body
        assert len(body["questions"]) == 2

    def test_get_nonexistent_returns_404(self, client):
        r = client.get("/api/capuths/99999")
        assert r.status_code == 404

    def test_delete_removes_caputh(self, client, teacher_token, uploaded):
        r = client.delete(
            f"/api/capuths/{uploaded['id']}",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 204
        r2 = client.get(f"/api/capuths/{uploaded['id']}")
        assert r2.status_code == 404

    def test_delete_requires_auth(self, client, uploaded):
        r = client.delete(f"/api/capuths/{uploaded['id']}")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Session creation
# ---------------------------------------------------------------------------

class TestCreateSession:
    @pytest.fixture()
    def caputh(self, db, klass, teacher):
        quiz = Quiz(title="Quiz", max_points=4, time_limit_default=20)
        db.add(quiz)
        db.flush()
        q = QuizQuestion(quiz_id=quiz.id, order=0, type="single", question_text="Q?", time_limit=10)
        db.add(q)
        db.flush()
        db.add(QuizAnswer(question_id=q.id, order=0, text="A", correct=True))
        db.flush()
        return quiz

    def test_create_session_returns_join_code(self, client, teacher_token, caputh, klass):
        r = client.post(
            f"/api/capuths/{caputh.id}/sessions",
            json={"class_id": klass.id, "max_points": 4},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        body = r.json()
        assert "join_code" in body
        assert len(body["join_code"]) == 6

    def test_duplicate_class_returns_existing_session(self, client, teacher_token, caputh, klass):
        """Same quiz+class combo returns the existing session instead of a new one."""
        r1 = client.post(
            f"/api/capuths/{caputh.id}/sessions",
            json={"class_id": klass.id, "max_points": 4},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        r2 = client.post(
            f"/api/capuths/{caputh.id}/sessions",
            json={"class_id": klass.id, "max_points": 4},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r1.json()["join_code"] == r2.json()["join_code"]
