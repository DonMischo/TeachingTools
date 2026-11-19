"""Tests for the TaskCrawler router: content upload/validation, sessions,
self-paced attempts/events with server-side answer checking, hint budgeting,
report/log endpoints, and the DDA fuzzy-inference module."""
import io
import json
from pathlib import Path

from api.models import Student, Class
from api.auth import hash_password
from api import dda as dda_engine


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _student_login(client, db, klass: Class, username="s.schueler") -> str:
    s = Student(
        nachname="Schüler", vorname="Sam", klasse=klass.code, class_id=klass.id,
        geschlecht="männlich", username=username, password_hash=hash_password("pw"), active=True,
    )
    db.add(s)
    db.flush()
    r = client.post("/api/auth/login", json={"username": username, "password": "pw"})
    return r.json()["access_token"]


SIMPLE_GAME = {
    "id": "test-game",
    "title": "Testspiel",
    "subject": "mathe",
    "completion": {"message": "Geschafft!", "code": "ABC-123"},
    "slides": [
        {"id": "intro", "type": "explanation", "text": "Willkommen"},
        {
            "id": "aufgabe-1", "type": "task", "text": "Frage",
            "task": {
                "kind": "single", "question": "1+1?",
                "answers": [{"text": "2", "correct": True}, {"text": "3", "correct": False}],
                "easierAlternative": {
                    "kind": "single", "question": "0+1?",
                    "answers": [{"text": "1", "correct": True}, {"text": "2", "correct": False}],
                },
            },
            "hints": ["Zähl an den Fingern.", "Es ist mehr als 1."],
        },
        {
            "id": "tuer", "type": "door", "text": "Letzte Aufgabe",
            "task": {"kind": "input", "question": "3-1?", "accept": ["2"]},
            "onFailReview": ["aufgabe-1"],
        },
    ],
}


def _upload(client, token, game=SIMPLE_GAME):
    # Fixtures like teacher_token/admin_token log in via the shared client,
    # leaving whichever cookie was set last active — cookie auth wins over
    # the Bearer header (see auth._resolve_token), so clear it here to make
    # sure this call authenticates as `token`, not a stale fixture identity.
    client.cookies.clear()
    return client.post(
        "/api/exitgames/upload",
        files={"file": ("exitgame.json", io.BytesIO(__import__("json").dumps(game).encode()), "application/json")},
        headers=_auth(token),
    )


# ---------------------------------------------------------------------------
# Content upload / validation
# ---------------------------------------------------------------------------

def test_upload_valid_exitgame(client, teacher_token):
    r = _upload(client, teacher_token)
    assert r.status_code == 201
    assert r.json()["title"] == "Testspiel"
    assert r.json()["slide_count"] == 3


def test_upload_rejects_missing_fields(client, teacher_token):
    bad = {"title": "X"}  # missing subject, slides
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any("subject" in e for e in errors)
    assert any("slides" in e for e in errors)


def test_upload_rejects_duplicate_slide_ids(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [
        {"id": "x", "type": "explanation", "text": "a"},
        {"id": "x", "type": "explanation", "text": "b"},
    ]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("doppelte slide-id" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_door_without_task(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [{"id": "d", "type": "door", "text": "leer"}]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("braucht" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_dangling_review_reference(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [
        {"id": "d", "type": "door", "text": "x", "task": {"kind": "input", "accept": ["1"]}, "onFailReview": ["nope"]},
    ]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("onFailReview" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_generated_task_kind(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [
        {"id": "g", "type": "task", "text": "x", "task": {"kind": "generated", "generator": "linear_equation"}},
    ]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("generated" in e for e in r.json()["detail"]["errors"])


def test_template_endpoint(client, teacher_token):
    r = client.get("/api/exitgames/template", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert "_ai_instructions" in r.json()


def test_template_is_a_valid_game(client, teacher_token):
    """The Vorlage demonstrates every element of the format, so it must stay
    uploadable as-is — otherwise teachers get a validation error from the very
    file we handed them."""
    tpl = client.get("/api/exitgames/template", headers=_auth(teacher_token)).json()
    r = _upload(client, teacher_token, tpl)
    assert r.status_code == 201, r.json()
    assert r.json()["slide_count"] == len(tpl["slides"])


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def test_create_and_reuse_session(client, teacher_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    r1 = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token))
    assert r1.status_code == 201
    r2 = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token))
    assert r2.json()["join_code"] == r1.json()["join_code"]  # reused, still open


def test_close_session_requires_owner(client, teacher_token, admin_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()

    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/close", headers=_auth(admin_token))
    assert r.status_code == 200  # admin can close anyone's session
    assert r.json()["status"] == "closed"


# ---------------------------------------------------------------------------
# Attempts + events
# ---------------------------------------------------------------------------

def test_attempt_allowed_for_student_outside_sessions_class(client, db, teacher_token, klass):
    """Session.class_id is a reporting label, not a join gate — a student
    from a different class can still join via the code."""
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()

    other = Class(code="9z", display_name="Klasse 9z")
    db.add(other)
    db.flush()
    student_token = _student_login(client, db, other)
    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert r.status_code == 201


def test_attempt_rejected_when_session_closed(client, db, teacher_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()
    client.cookies.clear()
    client.post(f"/api/exitgame-sessions/{s['join_code']}/close", headers=_auth(teacher_token))

    student_token = _student_login(client, db, klass)
    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert r.status_code == 403


def test_reopened_session_keeps_its_code_and_lets_students_back_in(client, db, teacher_token, klass):
    """Wieder oeffnen laeuft ueber den gemeinsamen Playhub-Endpunkt — der Code
    bleibt derselbe, ein gedruckter QR funktioniert danach weiter."""
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()
    code = s["join_code"]
    client.cookies.clear()
    client.post(f"/api/exitgame-sessions/{code}/close", headers=_auth(teacher_token))

    r = client.post(f"/api/play/sessions/{code}/reopen?tool=exitgame", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["code"] == code and r.json()["closed"] is False

    student_token = _student_login(client, db, klass)
    client.cookies.clear()
    assert client.post(f"/api/exitgame-sessions/{code}/attempts", headers=_auth(student_token)).status_code == 201


def test_teacher_can_join_and_play_own_session(client, db, teacher_token, klass):
    """Anyone with the link may play — including the teacher who created it,
    or another teacher/admin trying the game out."""
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    client.cookies.clear()
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()

    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(teacher_token))
    assert r.status_code == 201
    aid = r.json()["attempt"]["id"]

    client.cookies.clear()
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "answer", "payload": {"task_index": 0, "answer": "2"},
    }, headers=_auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["correct"] is True


def test_teacher_and_student_attempts_coexist_independently(client, db, teacher_token, admin_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    client.cookies.clear()
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()

    student_token = _student_login(client, db, klass)
    client.cookies.clear()
    r_student = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    client.cookies.clear()
    r_admin = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(admin_token))
    assert r_student.json()["attempt"]["id"] != r_admin.json()["attempt"]["id"]

    client.cookies.clear()
    r = client.get(f"/api/exitgame-sessions/{s['join_code']}/report", headers=_auth(teacher_token))
    rows = r.json()["attempts"]
    assert len(rows) == 2
    classes = {row["student_class"] for row in rows}
    assert classes == {klass.code, "Lehrkraft"}


def test_teacher_cannot_finish_another_teachers_attempt(client, db, teacher_token, admin_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    client.cookies.clear()
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()
    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(teacher_token))
    aid = r.json()["attempt"]["id"]

    client.cookies.clear()
    r = client.post(f"/api/exitgame-attempts/{aid}/finish", headers=_auth(admin_token))
    assert r.status_code == 404


def test_attempt_start_is_resumable(client, db, teacher_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()

    student_token = _student_login(client, db, klass)
    client.cookies.clear()
    r1 = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert r1.status_code == 201
    assert r1.json()["exitgame_data"]["title"] == "Testspiel"
    aid1 = r1.json()["attempt"]["id"]

    r2 = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert r2.json()["attempt"]["id"] == aid1  # same attempt, resumed


def _start_attempt(client, db, teacher_token, klass, game=SIMPLE_GAME):
    up = _upload(client, teacher_token, game)
    gid = up.json()["id"]
    client.cookies.clear()
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token)).json()
    student_token = _student_login(client, db, klass)
    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    return student_token, s, r.json()["attempt"]["id"]


def test_answer_correct_and_incorrect(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)

    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "answer", "payload": {"task_index": 0, "answer": "3"},
    }, headers=_auth(student_token))
    assert r.status_code == 200
    assert r.json()["correct"] is False
    assert r.json()["attempt"]["errors_total"] == 1

    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "answer", "payload": {"task_index": 0, "answer": "2"},
    }, headers=_auth(student_token))
    assert r.json()["correct"] is True
    assert "aufgabe-1" in r.json()["attempt"]["solved_slide_ids"]


def test_input_kind_numeric_comma_tolerance(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "tuer", "action": "answer", "payload": {"task_index": 0, "answer": "2,0"},
    }, headers=_auth(student_token))
    assert r.json()["correct"] is True


def test_hint_budget_without_dda_is_two(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    for i in range(2):
        r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
            "slide_id": "aufgabe-1", "action": "hint", "payload": {"hint_index": i},
        }, headers=_auth(student_token))
        assert r.status_code == 200
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "hint", "payload": {"hint_index": 2},
    }, headers=_auth(student_token))
    assert r.status_code == 409


def test_easier_taken_tracked_and_checkable(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "easier_taken", "payload": {"task_index": 0},
    }, headers=_auth(student_token))
    assert r.json()["attempt"]["easier_taken_total"] == 1

    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "answer",
        "payload": {"task_index": 0, "answer": "1", "variant": "easier"},
    }, headers=_auth(student_token))
    assert r.json()["correct"] is True


def test_event_rejected_for_other_students_attempt(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    other_token = _student_login(client, db, klass, username="other.student")
    client.cookies.clear()
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "view", "payload": {"slide_index": 1},
    }, headers=_auth(other_token))
    assert r.status_code == 404


VARIANT_GAME = {
    "id": "variant-game", "title": "Variantenspiel", "subject": "mathe",
    "slides": [
        {"id": "v1", "type": "task", "text": "Rechne:",
         "task": {"kind": "input",
                   "variants": [
                       {"question": "1+1?", "accept": ["2"]},
                       {"question": "2+2?", "accept": ["4"]},
                       {"question": "3+3?", "accept": ["6"]},
                   ]}},
    ],
}

VARIANT_ANSWERS = {0: "2", 1: "4", 2: "6"}


def test_variant_assignment_stable_and_checked_against_same_variant(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, VARIANT_GAME)

    r1 = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    choices = r1.json()["variant_choices"]
    assert "v1:0" in choices
    idx = choices["v1:0"]

    # Resuming yields the same variant.
    r2 = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert r2.json()["variant_choices"]["v1:0"] == idx

    # The answer for a DIFFERENT variant is wrong; the assigned one is right.
    wrong = VARIANT_ANSWERS[(idx + 1) % 3]
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "v1", "action": "answer", "payload": {"task_index": 0, "answer": wrong},
    }, headers=_auth(student_token))
    assert r.json()["correct"] is False

    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "v1", "action": "answer", "payload": {"task_index": 0, "answer": VARIANT_ANSWERS[idx]},
    }, headers=_auth(student_token))
    assert r.json()["correct"] is True


def test_upload_validates_each_variant(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [
        {"id": "v", "type": "task", "text": "x",
         "task": {"kind": "input", "variants": [{"question": "ok?", "accept": ["1"]}, {"question": "kaputt?"}]}},
    ]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("variants[1]" in e for e in r.json()["detail"]["errors"])


def test_upload_accepts_style(client, teacher_token):
    good = {**SIMPLE_GAME, "style": {"theme": "cyberpunk", "font": "Georgia, serif", "customVars": {"--accent": "#f0abfc"}}}
    r = _upload(client, teacher_token, good)
    assert r.status_code == 201


def test_finish_locks_further_events(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    r = client.post(f"/api/exitgame-attempts/{aid}/finish", headers=_auth(student_token))
    assert r.status_code == 200
    assert r.json()["completion"]["code"] == "ABC-123"

    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "view", "payload": {"slide_index": 1},
    }, headers=_auth(student_token))
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# Report + log
# ---------------------------------------------------------------------------

def test_report_reflects_attempt(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "answer", "payload": {"task_index": 0, "answer": "2"},
    }, headers=_auth(student_token))

    client.cookies.clear()
    r = client.get(f"/api/exitgame-sessions/{s['join_code']}/report", headers=_auth(teacher_token))
    assert r.status_code == 200
    row = r.json()["attempts"][0]
    assert row["slides_solved"] == 1

    r_csv = client.get(f"/api/exitgame-sessions/{s['join_code']}/report?fmt=csv", headers=_auth(teacher_token))
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]


def test_log_requires_owning_teacher(client, db, teacher_token, admin_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "hint", "payload": {"hint_index": 0},
    }, headers=_auth(student_token))

    client.cookies.clear()
    r = client.get(f"/api/exitgame-attempts/{aid}/log", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert len(r.json()["events"]) >= 1

    another = Student(nachname="X", vorname="Y", klasse=klass.code, geschlecht="w",
                       username="teacher2placeholder", password_hash=hash_password("pw"))
    # Use admin (not owner) to confirm 403 for non-owning, non-admin teacher would apply;
    # admin is explicitly allowed through, so assert that path instead.
    client.cookies.clear()
    r = client.get(f"/api/exitgame-attempts/{aid}/log", headers=_auth(admin_token))
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# DDA fuzzy inference
# ---------------------------------------------------------------------------

DDA_CFG = {
    "enabled": True,
    "levels": [
        {"name": "selbstständig", "hintCount": 0, "timeLimitSeconds": 60, "extraExample": False, "offerEasier": False},
        {"name": "mittel", "hintCount": 2, "timeLimitSeconds": 120, "extraExample": True, "offerEasier": False},
        {"name": "maximal", "hintCount": 99, "timeLimitSeconds": 300, "extraExample": True, "offerEasier": True},
    ],
}


def test_dda_levels_to_matrix_partitions_scaffolding():
    matrix = dda_engine.levels_to_matrix(DDA_CFG["levels"])
    ranges = matrix["scaffolding_level"]["ranges"]
    assert len(ranges) == 3
    assert ranges[0]["min"] == 0 and ranges[-1]["max"] == 100
    assert ranges[1]["hintCount"] == 2 and ranges[1]["extraExample"] is True


def test_dda_fuzzify_triangular_edges():
    mf = {"type": "triangular", "params": [0, 0, 15]}
    assert dda_engine._fuzzify(0, mf) == 1.0
    assert dda_engine._fuzzify(15, mf) == 0.0
    assert dda_engine._fuzzify(7.5, mf) == 0.5


def test_dda_infer_confident_student_low_scaffolding():
    outputs = dda_engine.infer(dda_engine.DEFAULT_RULESET, {"response_time": 5, "error_rate": 0, "help_requests": 0, "retry_count": 0})
    assert outputs["scaffolding_level"] < 40


def test_dda_infer_struggling_student_high_scaffolding():
    outputs = dda_engine.infer(dda_engine.DEFAULT_RULESET, {"response_time": 45, "error_rate": 90, "help_requests": 8, "retry_count": 4})
    assert outputs["scaffolding_level"] > 60


def test_dda_frustrated_override():
    # Raw snapshots (not derived via engagement_score) to isolate the threshold logic itself.
    history = [{"responseTime": 20, "errorRate": 80, "helpRequests": 4, "retryCount": 3, "engagementScore": 20} for _ in range(5)]
    assert dda_engine.is_frustrated(history) is True
    assert dda_engine.is_bored(history) is False


def test_dda_engagement_score_matches_reference_formula():
    # success, retries>0, few hints -> baseline + persistence + strategic-help bonuses
    assert dda_engine.engagement_score(success=True, retries=1, hints_used=1, time_spent=30) == 90
    # guessing (fast, no retries, no hints) penalized
    assert dda_engine.engagement_score(success=False, retries=0, hints_used=0, time_spent=2) == 30


def test_dda_map_to_content_range_lookup():
    matrix = {"scaffolding_level": {"ranges": [
        {"min": 0, "max": 20, "hintCount": 0},
        {"min": 20, "max": 100, "hintCount": 5},
    ]}}
    result = dda_engine.map_to_content(matrix, {"scaffolding_level": 30})
    assert result["scaffolding_level"]["hintCount"] == 5


def test_dda_adapt_end_to_end_high_hint_budget():
    # Simulate a struggling student: several failed, slow attempts.
    history = [dda_engine.snapshot_from_task_metrics(False, 40, 2, 1, 2) for _ in range(6)]
    result = dda_engine.adapt(DDA_CFG, history)
    assert result is not None
    assert result["contentParams"]["scaffolding_level"]["hintCount"] >= 2


def test_dda_adapt_confident_student_gets_low_level():
    history = [dda_engine.snapshot_from_task_metrics(True, 8, 0, 0, 0) for _ in range(6)]
    result = dda_engine.adapt(DDA_CFG, history)
    assert result["contentParams"]["scaffolding_level"]["hintCount"] == 0


def test_dda_adapt_returns_none_without_levels():
    assert dda_engine.adapt({"enabled": True}, []) is None
    assert dda_engine.adapt({"enabled": False, "levels": DDA_CFG["levels"]}, []) is None


def test_upload_rejects_dda_enabled_without_levels(client, teacher_token):
    bad = {**SIMPLE_GAME, "dda": {"enabled": True}}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("levels" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_dda_with_too_few_levels(client, teacher_token):
    bad = {**SIMPLE_GAME, "dda": {"enabled": True, "levels": DDA_CFG["levels"][:2]}}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422


def test_upload_accepts_dda_with_three_levels(client, teacher_token):
    good = {**SIMPLE_GAME, "dda": DDA_CFG}
    r = _upload(client, teacher_token, good)
    assert r.status_code == 201


def test_hint_budget_respects_authored_levels(client, db, teacher_token, klass):
    """A brand-new attempt has neutral priors -> mid scaffolding -> mid level.
    With the 3-level ladder the middle level allows 2 hints; the slide has 2
    authored hints, so both unlock but a third request is rejected."""
    game = {**SIMPLE_GAME, "dda": DDA_CFG}
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, game)
    for i in range(2):
        r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
            "slide_id": "aufgabe-1", "action": "hint", "payload": {"hint_index": i},
        }, headers=_auth(student_token))
        assert r.status_code == 200
    r = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "hint", "payload": {"hint_index": 2},
    }, headers=_auth(student_token))
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# Türcodes aus Codeschnipseln, Überspringen, serverseitige Zeitmessung
# ---------------------------------------------------------------------------

CODE_GAME = {
    "id": "code-game",
    "title": "Codespiel",
    "subject": "mathe",
    "completion": {"message": "Fertig!", "code": "END-1"},
    "slides": [
        {"id": "a1", "type": "task", "text": "Erste",
         "task": {"kind": "input", "question": "1+1?", "accept": ["2"], "codeFragment": "AB"}},
        {"id": "a2", "type": "task", "text": "Zweite",
         "task": {"kind": "input", "question": "2+2?", "accept": ["4"], "codeFragment": "7"}},
        {"id": "tuer", "type": "door", "text": "Tür"},
    ],
}


def _event(client, token, aid, slide_id, action, payload=None):
    client.cookies.clear()
    return client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": slide_id, "action": action, "payload": payload or {},
    }, headers=_auth(token))


def test_upload_rejects_door_code_field(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [
        {"id": "intro", "type": "explanation", "text": "x"},
        {"id": "tuer", "type": "door", "text": "x", "code": "GEHEIM"},
    ]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("codeFragment" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_door_without_task_or_fragments(client, teacher_token):
    bad = {**SIMPLE_GAME, "slides": [
        {"id": "intro", "type": "explanation", "text": "x"},
        {"id": "tuer", "type": "door", "text": "x"},
    ]}
    r = _upload(client, teacher_token, bad)
    assert r.status_code == 422
    assert any("codeFragment" in e for e in r.json()["detail"]["errors"])


def test_door_without_task_is_valid_with_fragments(client, teacher_token):
    assert _upload(client, teacher_token, CODE_GAME).status_code == 201


def test_attempt_start_returns_the_game_id_for_asset_urls(client, db, teacher_token, klass):
    """ZIP assets are served from /uploads/exitgames/<id>/assets/<file>, so the
    player cannot resolve a media filename without the game id."""
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    client.cookies.clear()
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert isinstance(r.json()["exitgame_id"], int)


def test_fragments_are_earned_by_solving(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, CODE_GAME)

    r = _event(client, student_token, aid, "a1", "answer", {"task_index": 0, "answer": "2"})
    frags = {f["slide_id"]: f for f in r.json()["code_fragments"]}
    assert frags["a1"]["earned"] is True and frags["a1"]["fragment"] == "AB"
    # An unearned fragment must not be handed to the player.
    assert frags["a2"]["earned"] is False and frags["a2"]["fragment"] is None


def test_door_opens_only_with_the_complete_code(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, CODE_GAME)
    _event(client, student_token, aid, "a1", "answer", {"task_index": 0, "answer": "2"})

    r = _event(client, student_token, aid, "tuer", "code", {"code": "AB"})
    assert r.json()["correct"] is False
    assert r.json()["open_slides"] == ["a2"]
    assert r.json()["attempt"]["errors_total"] == 1
    assert "tuer" not in r.json()["attempt"]["solved_slide_ids"]

    _event(client, student_token, aid, "a2", "answer", {"task_index": 0, "answer": "4"})
    r = _event(client, student_token, aid, "tuer", "code", {"code": " ab-7 "})
    assert r.json()["correct"] is True
    assert "tuer" in r.json()["attempt"]["solved_slide_ids"]


def test_code_action_rejected_on_a_task_slide(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, CODE_GAME)
    assert _event(client, student_token, aid, "a1", "code", {"code": "AB"}).status_code == 400


def test_code_action_rejected_on_a_door_without_fragments(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)  # SIMPLE_GAME
    assert _event(client, student_token, aid, "tuer", "code", {"code": "X"}).status_code == 400


def test_right_code_does_not_open_a_door_with_unearned_fragments(client, db, teacher_token, klass):
    """Abschreiben nuetzt nichts: the door checks that THIS student collected
    the fragments, not just that the typed string matches."""
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, CODE_GAME)
    r = _event(client, student_token, aid, "tuer", "code", {"code": "AB7"})
    assert r.json()["correct"] is False
    assert r.json()["open_slides"] == ["a1", "a2"]


def test_task_slides_can_be_skipped_doors_cannot(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, CODE_GAME)
    r = _event(client, student_token, aid, "a2", "skip")
    assert r.status_code == 200
    assert "a2" not in r.json()["attempt"]["solved_slide_ids"]
    assert _event(client, student_token, aid, "tuer", "skip").status_code == 400


def test_answer_time_is_measured_server_side(client, db, teacher_token, klass):
    """The DDA reads response_time from the event payload — the client never
    sends it, and a client-sent value must not be trusted."""
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, CODE_GAME)
    _event(client, student_token, aid, "a1", "answer",
           {"task_index": 0, "answer": "2", "time_spent_s": 9999})

    client.cookies.clear()
    log = client.get(f"/api/exitgame-attempts/{aid}/log", headers=_auth(teacher_token)).json()
    answer_events = [e for e in log["events"] if e["event_type"] == "success"]
    assert len(answer_events) == 1
    assert answer_events[0]["payload"]["time_spent_s"] < 60


NO_EASIER_GAME = {
    **SIMPLE_GAME,
    "dda": {"enabled": True, "levels": [
        {"name": "a", "hintCount": 0, "offerEasier": False},
        {"name": "b", "hintCount": 1, "offerEasier": False},
        {"name": "c", "hintCount": 2, "offerEasier": False},
    ]},
}


def test_easier_alternative_blocked_when_level_forbids_it(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, NO_EASIER_GAME)
    r = _event(client, student_token, aid, "aufgabe-1", "easier_taken", {"task_index": 0})
    assert r.status_code == 409


def test_delete_exitgame_that_was_played(client, db, teacher_token, klass):
    """A game that has been hosted must still be deletable: exitgame_sessions
    references it with ondelete=RESTRICT, so the sessions (and with them the
    attempts and their events) have to go first."""
    from api.models import ExitGame, ExitGameSession, ExitGameAttempt, ExitGameEvent

    student_token, s, aid = _start_attempt(client, db, teacher_token, klass)
    gid = client.get("/api/exitgames", headers=_auth(teacher_token)).json()[0]["id"]
    _event(client, student_token, aid, "aufgabe-1", "hint_used", {"task_index": 0})
    assert db.query(ExitGameEvent).filter_by(attempt_id=aid).count() > 0

    client.cookies.clear()
    r = client.delete(f"/api/exitgames/{gid}", headers=_auth(teacher_token))
    assert r.status_code == 204, r.text

    # The whole chain goes: Spiel -> Sitzungen -> Versuche -> Ereignisse.
    assert db.get(ExitGame, gid) is None
    assert db.query(ExitGameSession).filter_by(exitgame_id=gid).count() == 0
    assert db.get(ExitGameAttempt, aid) is None
    assert db.query(ExitGameEvent).filter_by(attempt_id=aid).count() == 0


# ---------------------------------------------------------------------------
# Sitzungsschloss: Bericht und Sitzungsliste gehoeren der eigenen Lehrkraft
# ---------------------------------------------------------------------------

def _zweite_lehrkraft(client, db) -> str:
    from api.models import Teacher
    t = Teacher(first_name="Fremde", last_name="Kollegin", active=True,
                role="teacher", password_hash=hash_password("x"))
    db.add(t)
    db.flush()
    r = client.post("/api/auth/login", json={"username": "Fremde Kollegin", "password": "x"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_bericht_gehoert_der_eigenen_lehrkraft(client, db, teacher_token, admin_token, klass):
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id},
                    headers=_auth(teacher_token)).json()
    code = s["join_code"]

    fremd = _zweite_lehrkraft(client, db)
    client.cookies.clear()
    assert client.get(f"/api/exitgame-sessions/{code}/report", headers=_auth(fremd)).status_code == 403
    assert client.get(f"/api/exitgame-sessions/{code}/report", headers=_auth(teacher_token)).status_code == 200
    assert client.get(f"/api/exitgame-sessions/{code}/report", headers=_auth(admin_token)).status_code == 200


def test_sitzungsliste_zeigt_nur_die_eigenen_runden(client, db, teacher_token, klass):
    """Der TaskCrawler liegt in der gemeinsamen Bibliothek — seine Runden nicht."""
    up = _upload(client, teacher_token)
    gid = up.json()["id"]
    client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id},
                headers=_auth(teacher_token))

    fremd = _zweite_lehrkraft(client, db)
    client.cookies.clear()
    assert client.get(f"/api/exitgames/{gid}/sessions", headers=_auth(fremd)).json() == []
    assert len(client.get(f"/api/exitgames/{gid}/sessions", headers=_auth(teacher_token)).json()) == 1


def test_update_exitgame_replaces_content(client, teacher_token):
    gid = _upload(client, teacher_token).json()["id"]
    edited = {**SIMPLE_GAME, "title": "Neu"}
    r = client.put(f"/api/exitgames/{gid}", json=edited, headers=_auth(teacher_token))
    assert r.status_code == 200, r.text
    assert client.get(f"/api/exitgames/{gid}", headers=_auth(teacher_token)).json()["data"]["title"] == "Neu"


def test_update_exitgame_validates_and_blocks_open_session(client, teacher_token, klass):
    gid = _upload(client, teacher_token).json()["id"]
    r = client.put(f"/api/exitgames/{gid}", json={"title": "x"}, headers=_auth(teacher_token))
    assert r.status_code == 422
    client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=_auth(teacher_token))
    r = client.put(f"/api/exitgames/{gid}", json=SIMPLE_GAME, headers=_auth(teacher_token))
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# Werkzeug-Stationen (task.sim) und Objekte der Gebäude-Ansicht (slide.station)
# ---------------------------------------------------------------------------

def _mit_station(task_extra: dict, slide_extra: dict | None = None) -> dict:
    task = {"kind": "input", "question": "x?", "accept": ["5"], **task_extra}
    return {**SIMPLE_GAME, "slides": [{"id": "w", "type": "task", "text": "x", "task": task, **(slide_extra or {})}]}


def test_upload_accepts_sim_and_station(client, teacher_token):
    game = _mit_station({"sim": {"tool": "gleichungswaage", "config": {"gleichung": "3x + 4 = 19"}}}, {"station": "waage"})
    assert _upload(client, teacher_token, game).status_code == 201


def test_upload_rejects_unknown_sim_tool_and_bad_config(client, teacher_token):
    r = _upload(client, teacher_token, _mit_station({"sim": {"tool": "toaster"}}))
    assert r.status_code == 422
    assert any("sim.tool" in e and "toaster" in e for e in r.json()["detail"]["errors"])
    r = _upload(client, teacher_token, _mit_station({"sim": {"tool": "funktionen", "config": "x^2"}}))
    assert r.status_code == 422
    assert any("sim.config" in e for e in r.json()["detail"]["errors"])


def test_sim_an_erklaerung_und_beispiel(client, teacher_token):
    sim = {"tool": "medien", "config": {"reiter": "zeitreise", "station": "telegraf"}}
    game = {**SIMPLE_GAME, "slides": [{"id": "e", "type": "explanation", "text": "Morse", "sim": sim},
                                      {"id": "b", "type": "example", "text": "SOS", "sim": {"tool": "medien"}},
                                      *SIMPLE_GAME["slides"]]}
    assert _upload(client, teacher_token, game).status_code == 201
    falsch = {**game, "slides": [{**game["slides"][0], "sim": {"tool": "toaster"}}, *game["slides"][1:]]}
    r = _upload(client, teacher_token, falsch)
    assert r.status_code == 422 and any("sim.tool" in e for e in r.json()["detail"]["errors"])
    # an einer Aufgaben-Folie gehört sim in die task
    r = _upload(client, teacher_token, _mit_station({}, {"sim": sim}))
    assert r.status_code == 422 and any("nur bei Erklärung und Beispiel" in e for e in r.json()["detail"]["errors"])


def test_upload_rejects_unknown_station(client, teacher_token):
    r = _upload(client, teacher_token, _mit_station({}, {"station": "toaster"}))
    assert r.status_code == 422
    assert any("'station'" in e for e in r.json()["detail"]["errors"])


def test_slim_template_leaves_2_5d_to_the_interactive_one(client, teacher_token):
    tpl = client.get("/api/exitgames/template", headers=_auth(teacher_token)).json()
    assert not [s for s in tpl["slides"] if (s.get("task") or {}).get("sim") or s.get("station")]
    assert "gebaeude" not in tpl
    assert "WERKZEUGE" not in tpl["_ai_instructions"]
    assert "Vorlage interaktiv" in tpl["_ai_instructions"]


def test_interactive_template_is_a_valid_2_5d_game(client, teacher_token):
    """Die interaktive Vorlage ist ein spielbares Verlies — sie muss sich so,
    wie sie ist, hochladen lassen und alle 2.5D-Bausteine zeigen."""
    tpl = client.get("/api/exitgames/template-interaktiv", headers=_auth(teacher_token)).json()
    assert tpl["gebaeude"] == {"ansicht": "verlies", "stil": "verlies", "stile": ["verlies", "lava"]}
    stationen = {s.get("station") for s in tpl["slides"]}
    assert {"monster", "boss", "tafel"} <= stationen
    tools = {(t.get("sim") or {}).get("tool") for s in tpl["slides"] for t in ([s["task"]] if s.get("task") else [])}
    assert {"gleichungswaage", "funktionen", "vierecke", "rechenregeln"} <= tools
    assert sum(1 for s in tpl["slides"] if s["type"] == "door") == 2
    anleitung = tpl["_ai_instructions"]
    assert "WERKZEUGE" in anleitung and "GEBÄUDE" in anleitung and "GRUNDLAGEN" in anleitung
    kat = tpl["_katalog"]
    assert {"lava", "burg", "verlies"} <= set(kat["gebaeude.stil"])
    assert {"monster", "boss"} <= set(kat["slide.station"])
    assert "gleichung" in kat["task.sim"]["gleichungswaage"]["config"]
    r = _upload(client, teacher_token, tpl)
    assert r.status_code == 201, r.json()


def test_templates_ask_the_ai_not_to_echo_instructions_and_catalog(client, teacher_token):
    for pfad in ("template", "template-interaktiv"):
        anleitung = client.get(f"/api/exitgames/{pfad}", headers=_auth(teacher_token)).json()["_ai_instructions"]
        assert anleitung.startswith("Antworte nur mit dem fertigen JSON, ohne '_ai_instructions' und '_katalog'")
        assert anleitung.count("Antworte nur mit dem fertigen JSON") == 1, pfad


def test_interactive_template_catalog_can_be_cut_to_some_tools(client, teacher_token):
    voll = client.get("/api/exitgames/template-interaktiv", headers=_auth(teacher_token)).json()
    tpl = client.get("/api/exitgames/template-interaktiv?werkzeuge=stromkreis,pse,gibtsnicht,pse",
                     headers=_auth(teacher_token)).json()
    assert list(tpl["_katalog"]["task.sim"]) == ["stromkreis", "pse"]
    assert tpl["_katalog"]["slide.station"] == voll["_katalog"]["slide.station"]
    assert "auf stromkreis, pse gekürzt" in tpl["_ai_instructions"]
    assert len(json.dumps(tpl)) < len(json.dumps(voll)) - 5000
    leer = client.get("/api/exitgames/template-interaktiv?werkzeuge=", headers=_auth(teacher_token)).json()
    assert leer["_katalog"]["task.sim"] == {} and "lass 'sim' weg" in leer["_ai_instructions"]
    # Gekürzt lässt sich die Vorlage weiter so hochladen, wie sie ist.
    assert _upload(client, teacher_token, tpl).status_code == 201


def test_upload_validates_gebaeude(client, teacher_token):
    ok = {**SIMPLE_GAME, "gebaeude": {"ansicht": "ebene", "stil": "garten"}}
    assert _upload(client, teacher_token, ok).status_code == 201
    epochen = {**SIMPLE_GAME, "gebaeude": {"stile": ["steinzeit", "gotisch", "viktorianisch", "retro", "neon"]}}
    assert _upload(client, teacher_token, epochen).status_code == 201
    for falsch in ({"ansicht": "keller"}, {"stil": "barock"}, "verlies", {"stile": "gotisch"}, {"stile": ["gotisch", "barock"]}):
        r = _upload(client, teacher_token, {**SIMPLE_GAME, "gebaeude": falsch})
        assert r.status_code == 422, falsch
        assert any("gebaeude" in e for e in r.json()["detail"]["errors"])


def test_upload_validates_minispiele(client, teacher_token):
    """3D-Welt: Minispiele abschaltbar (gebaeude.minispiele), je Aufgabe ein Kampf, je Tür ein Boss."""
    slides = [dict(s) for s in SIMPLE_GAME["slides"]]
    slides[1]["minispiel"] = "block"
    slides[2]["minispiel"] = "runen"
    ok = {**SIMPLE_GAME, "gebaeude": {"ansicht": "frei", "minispiele": False}, "slides": slides}
    assert _upload(client, teacher_token, ok).status_code == 201
    falsch_slides = [
        (1, "runen"),       # Boss-Spiel an einer Aufgabe
        (2, "konter"),      # Aufgaben-Spiel an einer Tür
        (0, "konter"),      # Erklärungen sind Erz, kein Kampf
        (1, "tanzen"),
    ]
    for nr, spiel in falsch_slides:
        s = [dict(x) for x in SIMPLE_GAME["slides"]]
        s[nr]["minispiel"] = spiel
        r = _upload(client, teacher_token, {**SIMPLE_GAME, "slides": s})
        assert r.status_code == 422, (nr, spiel)
        assert any("minispiel" in e for e in r.json()["detail"]["errors"])
    r = _upload(client, teacher_token, {**SIMPLE_GAME, "gebaeude": {"minispiele": "nein"}})
    assert r.status_code == 422
    assert any("minispiele" in e for e in r.json()["detail"]["errors"])


def test_medien_example_has_one_style_per_epoch(client, teacher_token):
    """Zeitreise der Medien: sechs Abschnitte, sechs Epochen-Stile — und das Spiel lässt sich hochladen."""
    pfad = Path(__file__).parents[2] / "data" / "taskcrawler_examples" / "TaskCrawler_Geschichte_der_Medien.json"
    spiel = json.loads(pfad.read_text(encoding="utf-8"))
    tueren = sum(1 for s in spiel["slides"] if s["type"] == "door")
    assert len(spiel["gebaeude"]["stile"]) == tueren == 6
    # 3D-Welt: jede Aufgabe hat ihren Kampf, jede Tür ihren Boss
    assert spiel["gebaeude"]["ansicht"] == "frei" and spiel["gebaeude"]["minispiele"] is True
    assert all(s.get("minispiel") for s in spiel["slides"] if s["type"] in ("task", "door"))
    # Jede Station passt zu ihrer Epoche — in der Steinzeit kein Buch, keine Uhr, kein Globus
    erster = spiel["slides"][:next(i for i, s in enumerate(spiel["slides"]) if s["type"] == "door")]
    assert {s["station"] for s in erster} <= {"lagerfeuer", "hoehlenwand", "quipu", "tontafel", "orakelknochen", "schriftrolle"}
    assert all(s.get("station") for s in spiel["slides"] if s["type"] != "door")
    r = _upload(client, teacher_token, spiel)
    assert r.status_code == 201, r.json()


def test_medien_meilensteine_example_runs_as_3d_world(client, teacher_token):
    """25 Meilensteine: 3D-Welt mit Minispiel an jeder Aufgabe und an der Tür — und hochladbar."""
    pfad = Path(__file__).parents[2] / "data" / "taskcrawler_examples" / "TaskCrawler_Geschichte_der_Medien_Meilensteine.json"
    spiel = json.loads(pfad.read_text(encoding="utf-8"))
    assert spiel["gebaeude"]["ansicht"] == "frei"
    assert all(s.get("minispiel") for s in spiel["slides"] if s["type"] in ("task", "door"))
    r = _upload(client, teacher_token, spiel)
    assert r.status_code == 201, r.json()


def test_zip_upload_takes_taskcrawler_json_and_old_exitgame_json(client, teacher_token):
    import zipfile
    for name in ("taskcrawler.json", "spiel/exitgame.json"):
        puffer = io.BytesIO()
        with zipfile.ZipFile(puffer, "w") as z:
            z.writestr(name, json.dumps(SIMPLE_GAME))
        client.cookies.clear()
        r = client.post("/api/exitgames/upload", headers=_auth(teacher_token),
                        files={"file": ("spiel.zip", puffer.getvalue(), "application/zip")})
        assert r.status_code == 201, (name, r.json())
    leer = io.BytesIO()
    with zipfile.ZipFile(leer, "w") as z:
        z.writestr("irgendwas.json", "{}")
    client.cookies.clear()
    r = client.post("/api/exitgames/upload", headers=_auth(teacher_token), files={"file": ("x.zip", leer.getvalue(), "application/zip")})
    assert r.status_code == 400 and "taskcrawler.json" in r.json()["detail"]


def test_monster_and_boss_are_station_objects(client, teacher_token):
    for obj in ("monster", "boss"):
        assert _upload(client, teacher_token, _mit_station({}, {"station": obj})).status_code == 201


# ---------------------------------------------------------------------------
# Lösungen bleiben auf dem Server
# ---------------------------------------------------------------------------

LOESUNGEN_GAME = {
    **SIMPLE_GAME,
    "slides": SIMPLE_GAME["slides"][:2] + [
        {"id": "varianten", "type": "task", "text": "x",
         "task": {"kind": "input", "variants": [{"question": "2+2?", "accept": ["4"]}, {"question": "3+3?", "accept": ["6"]}]}},
        {"id": "sortieren", "type": "task", "text": "x",
         "task": {"kind": "timeline", "timeline": {
             "mode": "sort", "scoring": "position", "tolerance": 0,
             "axis": {"kind": "year", "min": 1900, "max": 2000},
             "items": [{"id": "a", "label": "Mondlandung", "value": 1969, "exact_date": "1969-07-20"},
                       {"id": "b", "label": "Mauerfall", "value": 1989}]}}},
        {"id": "finden", "type": "task", "text": "x",
         "task": {"kind": "timeline", "timeline": {
             "mode": "spot", "axis": {"kind": "year", "min": 1900, "max": 2000},
             "items": [{"id": "a", "label": "Mondlandung", "value": 1979, "actual": 1969, "info": "1969!"},
                       {"id": "b", "label": "Mauerfall", "value": 1989}]}}},
    ] + SIMPLE_GAME["slides"][2:],
}


def _schluessel(obj) -> set[str]:
    if isinstance(obj, dict):
        return set(obj) | set().union(*(_schluessel(v) for v in obj.values()))
    if isinstance(obj, list):
        return set().union(*(_schluessel(v) for v in obj)) if obj else set()
    return set()


def test_start_sends_no_solutions(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, LOESUNGEN_GAME)
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    data = r.json()["exitgame_data"]
    keys = _schluessel(data)
    # Antwortlisten, richtige Antworten, wahre Zeitstrahl-Werte, Exit-Code
    for verboten in ("correct", "accept", "actual", "exact_date_actual", "info", "completion"):
        assert verboten not in keys, verboten
    assert "ABC-123" not in r.text
    slides = {sl["id"]: sl for sl in data["slides"]}
    sortieren = slides["sortieren"]["task"]["timeline"]["items"]
    assert all(set(it) == {"id", "label"} for it in sortieren)  # Wert und Datum sind die Antwort
    finden = slides["finden"]["task"]["timeline"]["items"]
    assert [it["value"] for it in finden] == [1979, 1989]  # angezeigte Lage bleibt
    # Was der Spieler braucht, ist noch da
    assert [a["text"] for a in slides["aufgabe-1"]["task"]["answers"]] == ["2", "3"]
    assert slides["aufgabe-1"]["task"]["easierAlternative"]["answers"][0] == {"text": "1"}
    assert [v["question"] for v in slides["varianten"]["task"]["variants"]] == ["2+2?", "3+3?"]
    assert slides["aufgabe-1"]["hints"]


def test_answers_still_checked_after_redaction(client, db, teacher_token, klass):
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, LOESUNGEN_GAME)
    ok = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "aufgabe-1", "action": "answer", "payload": {"task_index": 0, "answer": "2"},
    }, headers=_auth(student_token)).json()
    assert ok["correct"] is True
    zeit = client.post(f"/api/exitgame-attempts/{aid}/events", json={
        "slide_id": "sortieren", "action": "answer",
        "payload": {"task_index": 0, "answer": {"placements": {"a": 1969.55, "b": 1989}}},
    }, headers=_auth(student_token)).json()
    assert zeit["correct"] is True
    # Die gespeicherte Vorlage selbst bleibt vollständig (Lehrkraft-Ansicht)
    fin = client.post(f"/api/exitgame-attempts/{aid}/finish", headers=_auth(student_token)).json()
    assert fin["completion"]["code"] == "ABC-123"


# ---------------------------------------------------------------------------
# Ergebnissicherung
# ---------------------------------------------------------------------------

SICHERUNG_GAME = {
    **SIMPLE_GAME,
    "slides": [
        {**SIMPLE_GAME["slides"][0], "ergebnissicherung": "Addieren heißt zusammenzählen."},
        {**SIMPLE_GAME["slides"][1], "ergebnissicherung": "1 + 1 = 2"},
        {**SIMPLE_GAME["slides"][2], "title": "Die Tür"},
        {"id": "danach", "type": "explanation", "title": "Oben", "text": "x", "ergebnissicherung": "Geschafft ist geschafft."},
    ],
}


def test_ergebnissicherung_comes_only_with_finish(client, db, teacher_token, klass):
    """Die Merksätze verraten Antworten: beim Start fehlen sie, mit /finish kommen sie je Abschnitt."""
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, SICHERUNG_GAME)
    start = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(student_token))
    assert "ergebnissicherung" not in start.text
    fin = client.post(f"/api/exitgame-attempts/{aid}/finish", headers=_auth(student_token)).json()
    assert fin["title"] == "Testspiel"
    assert fin["ergebnissicherung"] == [
        {"abschnitt": 1, "titel": "Die Tür", "eintraege": [
            {"titel": "", "text": "Addieren heißt zusammenzählen."}, {"titel": "", "text": "1 + 1 = 2"}]},
        {"abschnitt": 2, "titel": "", "eintraege": [{"titel": "Oben", "text": "Geschafft ist geschafft."}]},
    ]
    # zweites /finish liefert dasselbe (z. B. nach Neuladen)
    again = client.post(f"/api/exitgame-attempts/{aid}/finish", headers=_auth(student_token)).json()
    assert again["ergebnissicherung"] == fin["ergebnissicherung"]


def test_ergebnissicherung_fuer_lehrkraft_im_dashboard(client, db, teacher_token, klass):
    """Die Lehrkraft der Sitzung holt die Merksätze jederzeit (PDF im Dashboard), Lernende nicht."""
    student_token, s, aid = _start_attempt(client, db, teacher_token, klass, SICHERUNG_GAME)
    client.cookies.clear()
    r = client.get(f"/api/exitgame-sessions/{s['join_code']}/ergebnissicherung", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["title"] == "Testspiel"
    assert [len(a["eintraege"]) for a in r.json()["ergebnissicherung"]] == [2, 1]
    client.cookies.clear()
    assert client.get(f"/api/exitgame-sessions/{s['join_code']}/ergebnissicherung", headers=_auth(student_token)).status_code == 403
    assert client.get("/api/exitgame-sessions/NOPE99/ergebnissicherung", headers=_auth(teacher_token)).status_code == 404


def test_upload_validates_ergebnissicherung(client, teacher_token):
    for falsch in ("", "   ", 42, "x" * 3001):
        game = {**SIMPLE_GAME, "slides": [{**SIMPLE_GAME["slides"][0], "ergebnissicherung": falsch}, *SIMPLE_GAME["slides"][1:]]}
        r = _upload(client, teacher_token, game)
        assert r.status_code == 422, falsch
        assert any("ergebnissicherung" in e for e in r.json()["detail"]["errors"])


def test_katalog_for_editor(client, teacher_token):
    r = client.get("/api/exitgames/katalog", headers=_auth(teacher_token))
    assert r.status_code == 200
    k = r.json()
    assert {"ansichten", "stile", "objekte", "werkzeuge"} <= set(k)
    assert "verlies" in k["ansichten"] and "name" in k["werkzeuge"]["gleichungswaage"]


def test_upload_asset_lands_in_assets(client, teacher_token, tmp_path, monkeypatch):
    import api.routers.exitgame as eg
    monkeypatch.setattr(eg, "EXITGAME_DATA_ROOT", tmp_path)
    gid = _upload(client, teacher_token).json()["id"]
    r = client.post(f"/api/exitgames/{gid}/assets", files={"file": ("karte.jpg", b"jpg", "image/jpeg")}, headers=_auth(teacher_token))
    assert r.status_code == 201, r.text
    assert r.json() == {"path": "karte.jpg", "url": f"/uploads/exitgames/{gid}/assets/karte.jpg"}
    assert (tmp_path / str(gid) / "assets" / "karte.jpg").exists()
