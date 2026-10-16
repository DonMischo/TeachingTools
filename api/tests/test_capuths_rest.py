"""
REST endpoint tests for Caputh (upload, list, get, delete, create session).
"""
import io
import json
import zipfile

import pytest

from api.models import Quiz, QuizQuestion, QuizAnswer, QuizSession, QuizParticipant, Teacher
from api.tests.conftest import auth


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

    def test_get_nonexistent_returns_404(self, client, teacher_token):
        r = client.get("/api/capuths/99999", headers={"Authorization": f"Bearer {teacher_token}"})
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
        # The upload fixture logged in via cookie — clear it so this request
        # is genuinely unauthenticated (shared TestClient cookie jar).
        client.cookies.clear()
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


# ---------------------------------------------------------------------------
# Session delete / clear
# ---------------------------------------------------------------------------

class TestDeleteSessions:
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

    def _create(self, client, teacher_token, caputh, klass) -> str:
        r = client.post(
            f"/api/capuths/{caputh.id}/sessions",
            json={"class_id": klass.id, "max_points": 4},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        return r.json()["join_code"]

    def test_delete_session(self, client, teacher_token, caputh, klass):
        code = self._create(client, teacher_token, caputh, klass)
        r = client.delete(f"/api/sessions/{code}", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 204
        sessions = client.get(f"/api/capuths/{caputh.id}/sessions").json()
        assert sessions == []

    def test_delete_session_keeps_awarded_points(self, client, db, teacher, teacher_token, caputh, klass):
        from api.models import Transaction

        code = self._create(client, teacher_token, caputh, klass)
        # Simulate a scored session: award points via a transaction (as the
        # finish flow does — transactions have no session FK).
        db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=42, reason=f"Caputh: {caputh.title}"))
        db.flush()

        r = client.delete(f"/api/sessions/{code}", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 204
        assert db.query(Transaction).filter_by(class_id=klass.id).count() == 1

    def test_delete_session_requires_auth(self, client, teacher_token, caputh, klass):
        code = self._create(client, teacher_token, caputh, klass)
        client.cookies.clear()
        r = client.delete(f"/api/sessions/{code}")
        assert r.status_code == 401

    def test_delete_unknown_session_404(self, client, teacher_token):
        r = client.delete("/api/sessions/XXXXXX", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 404

    def test_clear_sessions(self, client, db, teacher_token, caputh, klass):
        from api.models import Class

        klass2 = Class(code="6z", display_name="Klasse 6z")
        db.add(klass2)
        db.flush()
        self._create(client, teacher_token, caputh, klass)
        r = client.post(
            f"/api/capuths/{caputh.id}/sessions",
            json={"class_id": klass2.id, "max_points": 4},
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert r.status_code == 201
        assert len(client.get(f"/api/capuths/{caputh.id}/sessions").json()) == 2

        r = client.delete(f"/api/capuths/{caputh.id}/sessions", headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 204
        assert client.get(f"/api/capuths/{caputh.id}/sessions").json() == []


# ── Sitzungsschloss ──────────────────────────────────────────────────────────
#
# Eine Sitzung ist die Stunde einer bestimmten Lehrkraft. Dass jemand *eine*
# Lehrkraft ist, hat frueher gereicht, um die Auswertung der Kollegin zu lesen,
# ihre Runde fernzusteuern oder sie zu loeschen — und die Codes dafuer standen
# in der Sitzungsliste des gemeinsamen Capuths.

class TestSessionLock:
    @pytest.fixture()
    def fremde(self, db):
        from api.auth import hash_password
        t = Teacher(first_name="Fremde", last_name="Kollegin", active=True,
                    role="teacher", password_hash=hash_password("x"))
        db.add(t)
        db.flush()
        return t

    @pytest.fixture()
    def fremd_head(self, fremde):
        from api.auth import create_access_token
        return {"Authorization": f"Bearer {create_access_token({'sub': str(fremde.id), 'type': 'teacher'})}"}

    @pytest.fixture()
    def sitzung(self, db, klass, teacher):
        quiz = Quiz(title="Quiz", max_points=4, time_limit_default=20)
        db.add(quiz)
        db.flush()
        db.add(QuizQuestion(quiz_id=quiz.id, order=0, type="single", question_text="Q?", time_limit=10))
        s = QuizSession(quiz_id=quiz.id, class_id=klass.id, teacher_id=teacher.id, join_code="LOCK01")
        db.add(s)
        db.flush()
        return s

    def test_fremde_lehrkraft_sieht_die_auswertung_nicht(self, client, sitzung, fremd_head):
        client.cookies.clear()
        assert client.get("/api/sessions/LOCK01/report", headers=fremd_head).status_code == 403

    def test_die_eigene_lehrkraft_schon(self, client, sitzung, teacher_token):
        r = client.get("/api/sessions/LOCK01/report", headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["session_code"] == "LOCK01"

    def test_admin_darf_auch(self, client, sitzung, admin_token):
        assert client.get("/api/sessions/LOCK01/report", headers=auth(admin_token)).status_code == 200

    def test_fremde_darf_nicht_loeschen_zuruecksetzen_oder_teams_bauen(self, client, sitzung, fremd_head):
        client.cookies.clear()
        assert client.post("/api/sessions/LOCK01/reset", headers=fremd_head).status_code == 403
        assert client.post("/api/sessions/LOCK01/teams", json={"name": "A", "color": "#fff"},
                           headers=fremd_head).status_code == 403
        assert client.delete("/api/sessions/LOCK01", headers=fremd_head).status_code == 403

    def test_die_sitzungsliste_verraet_fremde_codes_nicht(self, client, db, sitzung, fremd_head):
        """Ohne diesen Filter braucht es kein Raten: die Liste des gemeinsamen
        Capuths lieferte den Beitrittscode gleich mit."""
        client.cookies.clear()
        r = client.get(f"/api/capuths/{sitzung.quiz_id}/sessions", headers=fremd_head)
        assert r.status_code == 200
        assert [z["join_code"] for z in r.json()] == []

    def test_aufraeumen_nimmt_die_runde_der_kollegin_nicht_mit(self, client, db, sitzung, fremd_head):
        client.cookies.clear()
        r = client.delete(f"/api/capuths/{sitzung.quiz_id}/sessions", headers=fremd_head)
        assert r.status_code == 204
        assert db.query(QuizSession).filter_by(join_code="LOCK01").first() is not None


# ---------------------------------------------------------------------------
# Bearbeiten (Export im Upload-Format + PUT)
# ---------------------------------------------------------------------------

class TestEdit:
    def _upload(self, client, token):
        client.cookies.clear()
        r = client.post("/api/capuths/upload",
                        files={"file": ("quiz.json", json.dumps(MINIMAL_QUIZ).encode(), "application/json")},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def test_export_roundtrips_and_update_keeps_ids(self, client, db, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        qid = self._upload(client, teacher_token)
        exported = client.get(f"/api/capuths/{qid}/export", headers=h).json()
        assert exported["title"] == "Miniquiz"
        assert exported["questions"][1]["answers"][1] == {"text": "4", "correct": True}

        old_ids = [q.id for q in db.get(Quiz, qid).questions]
        exported["title"] = "Neu"
        exported["questions"][0]["question"] = "Was ist 1+2?"
        exported["questions"].append({"type": "true_false", "question": "Wahr?",
                                      "answers": [{"text": "Wahr", "correct": True}, {"text": "Falsch", "correct": False}]})
        r = client.put(f"/api/capuths/{qid}", json=exported, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["question_count"] == 3
        db.expire_all()
        quiz = db.get(Quiz, qid)
        assert quiz.title == "Neu"
        assert [q.id for q in quiz.questions][:2] == old_ids
        assert quiz.questions[0].question_text == "Was ist 1+2?"

    def test_update_invalid_is_422(self, client, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        qid = self._upload(client, teacher_token)
        r = client.put(f"/api/capuths/{qid}", json={"title": "x"}, headers=h)
        assert r.status_code == 422

    def test_update_blocked_while_session_running(self, client, db, teacher, teacher_token):
        h = {"Authorization": f"Bearer {teacher_token}"}
        qid = self._upload(client, teacher_token)
        db.add(QuizSession(quiz_id=qid, teacher_id=teacher.id, join_code="EDIT01", status="active"))
        db.commit()
        r = client.put(f"/api/capuths/{qid}", json=MINIMAL_QUIZ, headers=h)
        assert r.status_code == 409


class TestAssets:
    def test_upload_image_lands_in_gfx(self, client, db, teacher_token, tmp_path, monkeypatch):
        import api.routers.capuths as cap
        monkeypatch.setattr(cap, "QUIZ_DATA_ROOT", tmp_path)
        h = {"Authorization": f"Bearer {teacher_token}"}
        qid = TestEdit()._upload(client, teacher_token)
        r = client.post(f"/api/capuths/{qid}/assets", files={"file": ("Mein Bild.png", b"\x89PNG", "image/png")}, headers=h)
        assert r.status_code == 201, r.text
        assert r.json()["path"] == f"{qid}/gfx/Mein_Bild.png"
        assert (tmp_path / str(qid) / "gfx" / "Mein_Bild.png").read_bytes() == b"\x89PNG"
        # Gleicher Name überschreibt nicht.
        r2 = client.post(f"/api/capuths/{qid}/assets", files={"file": ("Mein Bild.png", b"x", "image/png")}, headers=h)
        assert r2.json()["path"] == f"{qid}/gfx/Mein_Bild-2.png"

    def test_rejects_non_images(self, client, teacher_token, tmp_path, monkeypatch):
        import api.routers.capuths as cap
        monkeypatch.setattr(cap, "QUIZ_DATA_ROOT", tmp_path)
        qid = TestEdit()._upload(client, teacher_token)
        r = client.post(f"/api/capuths/{qid}/assets", files={"file": ("x.exe", b"MZ", "application/octet-stream")},
                        headers={"Authorization": f"Bearer {teacher_token}"})
        assert r.status_code == 400


class TestReportQueryBatching:
    def test_report_loads_responses_once(self, client, db, klass, teacher, teacher_token, count_selects):
        from api.models import QuizResponse
        quiz = Quiz(title="Quiz", max_points=4, time_limit_default=20)
        db.add(quiz)
        db.flush()
        q1 = QuizQuestion(quiz_id=quiz.id, order=0, type="single", question_text="Q1?", time_limit=10)
        q2 = QuizQuestion(quiz_id=quiz.id, order=1, type="survey", question_text="Q2?", time_limit=10)
        db.add_all([q1, q2])
        s = QuizSession(quiz_id=quiz.id, class_id=klass.id, teacher_id=teacher.id, join_code="BATCH1")
        db.add(s)
        db.flush()
        ps = [QuizParticipant(session_id=s.id, name=n, class_id=klass.id) for n in ("Ada", "Ben", "Cem")]
        db.add_all(ps)
        db.flush()
        db.add_all([
            QuizResponse(session_id=s.id, participant_id=ps[0].id, question_id=q1.id, chosen_answer_ids=[], is_correct=True),
            QuizResponse(session_id=s.id, participant_id=ps[0].id, question_id=q2.id, chosen_answer_ids=[], is_correct=None),
            QuizResponse(session_id=s.id, participant_id=ps[1].id, question_id=q1.id, chosen_answer_ids=[], is_correct=False),
        ])
        db.flush()

        before = count_selects("quiz_responses")
        r = client.get("/api/sessions/BATCH1/report", headers=auth(teacher_token))
        assert r.status_code == 200
        assert count_selects("quiz_responses") - before == 1

        rows = {row["name"]: row for row in r.json()["participants"]}
        assert [rows[n]["correct"] for n in ("Ada", "Ben", "Cem")] == [1, 0, 0]
        assert [q["answered"] for q in rows["Ada"]["questions"]] == [True, True]
        assert [q["answered"] for q in rows["Ben"]["questions"]] == [True, False]
        assert rows["Cem"]["questions"][0] == {"question": "Q1?", "type": "single", "answered": False, "correct": False}
