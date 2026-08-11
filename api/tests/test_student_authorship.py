"""
Cross-cutting tests for the "shared student pool" authorship model on the
reusable-content libraries (Caputh, Bingo, Exitgame, Lückentext, Zeitstrahl).

Rules under test:
  - Students may CREATE content; it is tagged with created_by_student.
  - Students LIST/SEE only student-authored content (the shared pool).
  - Teachers see everything (teacher-authored + student-authored).

Tokens are minted directly (create_access_token) rather than via the login
endpoint, because login sets the hp_session cookie on the shared TestClient and
cookie auth beats the Bearer header (auth._resolve_token).
"""
import io
import json
import zipfile

import pytest

from api.models import Student
from api.auth import create_access_token, hash_password
from api.tests.test_capuths_rest import MINIMAL_QUIZ
from api.tests.test_exitgame import SIMPLE_GAME


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def teacher_token(teacher):
    return create_access_token({"sub": str(teacher.id), "type": "teacher"})


@pytest.fixture()
def student_token(db, klass):
    s = Student(
        nachname="Schüler", vorname="Sam", klasse=klass.code, class_id=klass.id,
        geschlecht="männlich", username="sam.pool", password_hash=hash_password("pw"), active=True,
    )
    db.add(s)
    db.flush()
    return create_access_token({"sub": str(s.id), "type": "student"})


# ── Zeitstrahl (timeline_sets) ──────────────────────────────────────────────

TIMELINE = {
    "title": "Zeitstrahl",
    "axis": {"kind": "number", "min": 0, "max": 10},
    "events": [{"id": "e1", "label": "A", "value": 5}],
}


def test_timeline_shared_pool(client, teacher_token, student_token):
    client.cookies.clear()
    client.post("/api/timelines", json={**TIMELINE, "title": "Lehrer-TL"}, headers=_auth(teacher_token))
    client.post("/api/timelines", json={**TIMELINE, "title": "Schüler-TL"}, headers=_auth(student_token))

    teacher_titles = {s["title"] for s in client.get("/api/timelines", headers=_auth(teacher_token)).json()}
    student_titles = {s["title"] for s in client.get("/api/timelines", headers=_auth(student_token)).json()}

    assert {"Lehrer-TL", "Schüler-TL"} <= teacher_titles
    assert student_titles == {"Schüler-TL"}


# ── Lückentext (lueckentext_sets) ───────────────────────────────────────────

LUECKENTEXT = {
    "title": "Lückentext",
    "text": "Ein {{g1}} Satz.",
    "gaps": [{"id": "g1", "answer": "schöner", "type": "free_type", "difficulty": "easy", "hint": None, "choices": None}],
}


def test_lueckentext_shared_pool(client, teacher_token, student_token):
    client.cookies.clear()
    client.post("/api/lueckentexte", json={**LUECKENTEXT, "title": "Lehrer-LT"}, headers=_auth(teacher_token))
    student_set = client.post("/api/lueckentexte", json={**LUECKENTEXT, "title": "Schüler-LT"}, headers=_auth(student_token)).json()

    teacher_titles = {s["title"] for s in client.get("/api/lueckentexte", headers=_auth(teacher_token)).json()}
    student_list = client.get("/api/lueckentexte", headers=_auth(student_token)).json()

    assert {"Lehrer-LT", "Schüler-LT"} <= teacher_titles
    assert {s["title"] for s in student_list} == {"Schüler-LT"}
    assert student_set["created_by_student"] is not None
    assert student_set["created_by"] is None


# ── Bingo (bingo_sets) ──────────────────────────────────────────────────────

def _bingo_body(title: str) -> dict:
    return {
        "title": title, "grid_size": 2, "grid_cols": 2,
        "pairs": [{"caller": f"c{i}", "answer": f"a{i}"} for i in range(4)],
    }


def test_bingo_set_shared_pool(client, teacher_token, student_token):
    client.cookies.clear()
    client.post("/api/bingo/sets", json=_bingo_body("Lehrer-Bingo"), headers=_auth(teacher_token))
    r = client.post("/api/bingo/sets", json=_bingo_body("Schüler-Bingo"), headers=_auth(student_token))
    assert r.status_code == 201

    teacher_titles = {s["title"] for s in client.get("/api/bingo/sets", headers=_auth(teacher_token)).json()}
    student_titles = {s["title"] for s in client.get("/api/bingo/sets", headers=_auth(student_token)).json()}

    assert {"Lehrer-Bingo", "Schüler-Bingo"} <= teacher_titles
    assert student_titles == {"Schüler-Bingo"}


def test_bingo_student_cannot_host_session(client, student_token):
    client.cookies.clear()
    r = client.post("/api/bingo", json=_bingo_body("Kein Hosting"), headers=_auth(student_token))
    assert r.status_code == 403


# ── Exitgame (exitgames) ────────────────────────────────────────────────────

def _upload_exitgame(client, token, title):
    client.cookies.clear()
    game = {**SIMPLE_GAME, "title": title}
    return client.post(
        "/api/exitgames/upload",
        files={"file": ("exitgame.json", json.dumps(game).encode(), "application/json")},
        headers=_auth(token),
    )


def test_exitgame_shared_pool(client, teacher_token, student_token):
    _upload_exitgame(client, teacher_token, "Lehrer-Exit")
    student_game = _upload_exitgame(client, student_token, "Schüler-Exit").json()

    teacher_titles = {g["title"] for g in client.get("/api/exitgames", headers=_auth(teacher_token)).json()}
    student_games = client.get("/api/exitgames", headers=_auth(student_token)).json()

    assert {"Lehrer-Exit", "Schüler-Exit"} <= teacher_titles
    assert {g["title"] for g in student_games} == {"Schüler-Exit"}

    # A student may open their own pool game but not a teacher game.
    teacher_game_id = next(g["id"] for g in client.get("/api/exitgames", headers=_auth(teacher_token)).json() if g["title"] == "Lehrer-Exit")
    assert client.get(f"/api/exitgames/{teacher_game_id}", headers=_auth(student_token)).status_code == 404
    assert client.get(f"/api/exitgames/{student_game['id']}", headers=_auth(student_token)).status_code == 200


# ── Caputh (quizzes — student authorship only, no teacher owner) ─────────────

def _upload_quiz(client, token, title):
    client.cookies.clear()
    quiz = {**MINIMAL_QUIZ, "title": title}
    return client.post(
        "/api/capuths/upload",
        files={"file": ("quiz.json", json.dumps(quiz).encode(), "application/json")},
        headers=_auth(token),
    )


def test_caputh_shared_pool(client, teacher_token, student_token):
    assert _upload_quiz(client, teacher_token, "Lehrer-Quiz").status_code == 201
    assert _upload_quiz(client, student_token, "Schüler-Quiz").status_code == 201

    teacher_titles = {q["title"] for q in client.get("/api/capuths", headers=_auth(teacher_token)).json()}
    student_titles = {q["title"] for q in client.get("/api/capuths", headers=_auth(student_token)).json()}

    assert {"Lehrer-Quiz", "Schüler-Quiz"} <= teacher_titles
    assert student_titles == {"Schüler-Quiz"}
