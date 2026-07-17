"""Caputh integration of the Zeitstrahl engine: question type "timeline"."""
import io
import json

from api.tests.conftest import auth
from api.routers.capuths import _score_ratio, _question_answering_msg
from api.models import Quiz, QuizQuestion, QuizResponse


TIMELINE_QUESTION = {
    "type": "timeline",
    "question": "Ordne die Ereignisse zu.",
    "timeline": {
        "mode": "sort",
        "axis": {"kind": "year", "min": -800, "max": 2000},
        "tolerance": 50,
        "items": [
            {"id": "rom", "label": "Gründung Roms", "value": -753},
            {"id": "karl", "label": "Krönung Karls", "value": 800},
            {"id": "mauer", "label": "Mauerfall", "value": 1989},
        ],
    },
}


def quiz_json(question):
    return {"title": "Zeitstrahl-Quiz", "max_points": 2, "questions": [question]}


def upload(client, token, data):
    return client.post(
        "/api/capuths/upload",
        files={"file": ("quiz.json", io.BytesIO(json.dumps(data).encode()), "application/json")},
        headers=auth(token),
    )


class TestUpload:
    def test_timeline_question_accepted_and_served(self, client, teacher_token):
        r = upload(client, teacher_token, quiz_json(TIMELINE_QUESTION))
        assert r.status_code == 201, r.text
        quiz_id = r.json()["id"]

        detail = client.get(f"/api/capuths/{quiz_id}", headers=auth(teacher_token)).json()
        q = detail["questions"][0]
        assert q["type"] == "timeline"
        assert q["content"]["mode"] == "sort"
        assert q["answers"] == []

    def test_invalid_spec_rejected(self, client, teacher_token):
        bad = dict(TIMELINE_QUESTION, timeline={"mode": "sort", "axis": {"kind": "year", "min": 0, "max": 0}, "items": []})
        r = upload(client, teacher_token, quiz_json(bad))
        assert r.status_code == 422
        assert "timeline" in r.text

    def test_template_round_trips(self, client, teacher_token):
        tpl = client.get("/api/capuths/template", headers=auth(teacher_token)).json()
        assert any(q["type"] == "timeline" for q in tpl["questions"])
        r = upload(client, teacher_token, tpl)
        assert r.status_code == 201, r.text


class TestScoring:
    def _question(self, db, teacher):
        quiz = Quiz(title="T", max_points=2)
        db.add(quiz)
        db.flush()
        q = QuizQuestion(quiz_id=quiz.id, order=0, type="timeline",
                         question_text="x", content=TIMELINE_QUESTION["timeline"])
        db.add(q)
        db.flush()
        return q

    def _resp(self, answer):
        return QuizResponse(session_id=1, participant_id=1, question_id=1,
                            chosen_answer_ids=answer, is_correct=None)

    def test_partial_credit(self, db, teacher):
        q = self._question(db, teacher)
        ratio = _score_ratio(q, self._resp({"placements": {"rom": -753, "karl": 1200, "mauer": 1989}}))
        assert abs(ratio - 2 / 3) < 1e-9

    def test_full_credit_and_zero(self, db, teacher):
        q = self._question(db, teacher)
        assert _score_ratio(q, self._resp({"placements": {"rom": -753, "karl": 800, "mauer": 1989}})) == 1.0
        assert _score_ratio(q, self._resp([1, 2])) == 0.0  # legacy list payload → no crash

    def test_answering_msg_strips_solutions(self, db, teacher):
        q = self._question(db, teacher)
        msg = _question_answering_msg(q, 30)
        assert msg["timeline"]["mode"] == "sort"
        assert all("value" not in it for it in msg["timeline"]["items"])
        assert msg["answers"] == []
