"""Tests for the Übungsseite: generator library, task flow, streak-based
difficulty progression, and per-student tracking."""
import random

from api.models import Student
from api.auth import hash_password
from api import task_generators


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _student_login(client, db, username="p.uebt") -> str:
    s = Student(nachname="Übt", vorname="Paula", klasse="7a", geschlecht="weiblich",
                username=username, password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    r = client.post("/api/auth/login", json={"username": username, "password": "pw"})
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# Generator library
# ---------------------------------------------------------------------------

def test_linear_equation_all_difficulties_have_integer_solutions():
    rng = random.Random(42)
    for difficulty in range(1, 6):
        for _ in range(20):
            t = task_generators.generate_task("linear_equation", difficulty, rng)
            assert t["question"]
            assert len(t["accept"]) == 1
            assert t["accept"][0].lstrip("-").isdigit()


def _answer_is_clean(a: str) -> bool:
    """Integer, short decimal (point or comma), or fraction a/b."""
    a = a.strip()
    if "/" in a:
        n, _, d = a.partition("/")
        return n.lstrip("-").isdigit() and d.isdigit() and int(d) > 0
    try:
        float(a.replace(",", "."))
        return True
    except ValueError:
        return False


def test_all_generators_produce_clean_answers_at_every_difficulty():
    rng = random.Random(7)
    for gen_id in task_generators.REGISTRY:
        for difficulty in range(1, 6):
            for _ in range(15):
                t = task_generators.generate_task(gen_id, difficulty, rng)
                assert t["question"], f"{gen_id} d{difficulty}: leere Frage"
                assert t["accept"], f"{gen_id} d{difficulty}: keine akzeptierten Antworten"
                for a in t["accept"]:
                    assert _answer_is_clean(a), f"{gen_id} d{difficulty}: unsaubere Antwort {a!r}"
                for dstr in t.get("distractors", []):
                    assert dstr not in t["accept"], f"{gen_id} d{difficulty}: Distraktor == Antwort"


def test_geometrie_and_stochastik_include_svg():
    rng = random.Random(3)
    for gen_id in ("geometrie", "stochastik"):
        for difficulty in (1, 2, 3):
            t = task_generators.generate_task(gen_id, difficulty, rng)
            if gen_id == "geometrie" or difficulty <= 3:
                assert t.get("image_svg", "").startswith("<svg"), f"{gen_id} d{difficulty}: kein SVG"
                assert "currentColor" in t["image_svg"]


def test_fraction_answers_are_reduced():
    rng = random.Random(11)
    for _ in range(30):
        t = task_generators.generate_task("brueche", 3, rng)  # kürzen level
        main = t["accept"][0]
        if "/" in main:
            n, d = main.split("/")
            from math import gcd
            assert gcd(int(n), int(d)) == 1, f"nicht gekürzt: {main}"


def test_registry_grades_cover_1_to_7():
    covered = set()
    for g in task_generators.REGISTRY.values():
        covered.update(g.grades)
    assert covered >= {1, 2, 3, 4, 5, 6, 7}


def test_sample_endpoint_returns_instances(client, teacher_token):
    client.cookies.clear()
    r = client.get("/api/generators/geometrie/sample?difficulty=2&count=3", headers=_auth(teacher_token))
    assert r.status_code == 200
    body = r.json()
    assert len(body["tasks"]) == 3
    for t in body["tasks"]:
        assert t["question"] and t["accept"] and t["solution"]
        assert t["image_svg"].startswith("<svg")
        assert isinstance(t["distractors"], list)


def test_sample_endpoint_unknown_generator_404(client, teacher_token):
    client.cookies.clear()
    r = client.get("/api/generators/nope/sample", headers=_auth(teacher_token))
    assert r.status_code == 404


def test_practice_task_with_svg_stored_and_returned(client, db):
    token = _student_login(client, db, "svg.schueler")
    client.cookies.clear()
    t = client.post("/api/practice/geometrie/task", headers=_auth(token)).json()
    assert t["image_svg"].startswith("<svg")
    from api.models import PracticeTask
    row = db.get(PracticeTask, t["task_id"])
    assert row.image_svg == t["image_svg"]


def test_generate_task_clamps_difficulty():
    rng = random.Random(1)
    assert task_generators.generate_task("linear_equation", 99, rng)["question"]
    assert task_generators.generate_task("linear_equation", -1, rng)["question"]


def test_check_input_answer_comma_and_tolerance():
    assert task_generators.check_input_answer(["2.5"], "2,5") is True
    assert task_generators.check_input_answer(["8"], " 8 ") is True
    assert task_generators.check_input_answer(["8"], "9") is False
    assert task_generators.check_input_answer(["acht"], "ACHT") is True


# ---------------------------------------------------------------------------
# Practice flow
# ---------------------------------------------------------------------------

def test_topics_listed_with_progress_null_initially(client, db):
    token = _student_login(client, db)
    client.cookies.clear()
    r = client.get("/api/practice/topics", headers=_auth(token))
    assert r.status_code == 200
    topics = {t["id"]: t for t in r.json()}
    assert "linear_equation" in topics
    assert topics["linear_equation"]["progress"] is None


def test_practice_open_to_teachers_with_own_progress(client, db, teacher_token):
    """Üben steht allen offen — Lehrkräfte üben mit eigenem, getrenntem Fortschritt."""
    client.cookies.clear()
    r = client.post("/api/practice/linear_equation/task", headers=_auth(teacher_token))
    assert r.status_code == 201
    t = r.json()

    from api.models import PracticeTask
    row = db.get(PracticeTask, t["task_id"])
    assert row.teacher_id is not None and row.student_id is None

    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer",
                    json={"answer": row.accept[0]}, headers=_auth(teacher_token))
    assert r.json()["correct"] is True
    assert r.json()["progress"]["tasks_done"] == 1

    # A student cannot answer the teacher's task.
    student_token = _student_login(client, db, "fremd.schueler")
    client.cookies.clear()
    t2 = client.post("/api/practice/linear_equation/task", headers=_auth(teacher_token)).json()
    r = client.post(f"/api/practice/tasks/{t2['task_id']}/answer",
                    json={"answer": "1"}, headers=_auth(student_token))
    assert r.status_code == 404


def test_unknown_topic_404(client, db):
    token = _student_login(client, db)
    client.cookies.clear()
    r = client.post("/api/practice/nope/task", headers=_auth(token))
    assert r.status_code == 404


def test_answer_flow_and_tracking(client, db):
    token = _student_login(client, db)
    client.cookies.clear()

    t = client.post("/api/practice/linear_equation/task", headers=_auth(token)).json()
    assert t["difficulty"] == 1
    assert "question" in t and "accept" not in t  # answers never reach the client

    from api.models import PracticeTask
    row = db.get(PracticeTask, t["task_id"])
    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer",
                    json={"answer": row.accept[0]}, headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["correct"] is True
    assert body["progress"]["tasks_done"] == 1
    assert body["progress"]["tasks_correct"] == 1

    # Answering twice is rejected.
    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer",
                    json={"answer": row.accept[0]}, headers=_auth(token))
    assert r.status_code == 409


def test_difficulty_levels_up_after_three_correct(client, db):
    token = _student_login(client, db)
    client.cookies.clear()
    from api.models import PracticeTask

    last = None
    for _ in range(3):
        t = client.post("/api/practice/linear_equation/task", headers=_auth(token)).json()
        row = db.get(PracticeTask, t["task_id"])
        last = client.post(f"/api/practice/tasks/{t['task_id']}/answer",
                           json={"answer": row.accept[0]}, headers=_auth(token)).json()
    assert last["leveled"] == "up"
    assert last["progress"]["difficulty"] == 2


def test_difficulty_levels_down_after_two_wrong(client, db):
    token = _student_login(client, db)
    client.cookies.clear()
    from api.models import PracticeTask

    # Climb to level 2 first.
    for _ in range(3):
        t = client.post("/api/practice/linear_equation/task", headers=_auth(token)).json()
        row = db.get(PracticeTask, t["task_id"])
        client.post(f"/api/practice/tasks/{t['task_id']}/answer",
                    json={"answer": row.accept[0]}, headers=_auth(token))

    last = None
    for _ in range(2):
        t = client.post("/api/practice/linear_equation/task", headers=_auth(token)).json()
        last = client.post(f"/api/practice/tasks/{t['task_id']}/answer",
                           json={"answer": "0"}, headers=_auth(token)).json()
    assert last["leveled"] == "down"
    assert last["progress"]["difficulty"] == 1
    assert last["solution"] is not None  # wrong answers reveal the solution


def test_wrong_answer_from_other_student_rejected(client, db):
    token_a = _student_login(client, db, "a.schueler")
    client.cookies.clear()
    t = client.post("/api/practice/linear_equation/task", headers=_auth(token_a)).json()

    token_b = _student_login(client, db, "b.schueler")
    client.cookies.clear()
    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer", json={"answer": "1"}, headers=_auth(token_b))
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Gäste über den QR einer Übungs-Sitzung
# ---------------------------------------------------------------------------

def _uebung_gast(client, teacher_token, name="Gast"):
    """Übungs-Sitzung anlegen, Gäste erlauben, beitreten — gibt (code, token)."""
    from api.tests.conftest import auth
    code = client.post("/api/tool-sessions", json={"tool_slug": "uebung"},
                       headers=auth(teacher_token)).json()["code"]
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(teacher_token))
    client.cookies.clear()
    token = client.post("/api/guest/join",
                        json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    return code, token


def test_guest_can_practice_with_code_and_token(client, db, teacher_token):
    code, token = _uebung_gast(client, teacher_token)
    from api.models import PracticeTask

    r = client.get(f"/api/practice/topics?code={code}", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert any(t["id"] == "linear_equation" for t in r.json())

    t = client.post(f"/api/practice/linear_equation/task?code={code}", headers=_auth(token)).json()
    row = db.get(PracticeTask, t["task_id"])
    assert row.guest_id and row.student_id is None and row.teacher_id is None

    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer?code={code}",
                    json={"answer": row.accept[0]}, headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["progress"]["tasks_correct"] == 1


def test_guest_without_code_is_rejected(client, teacher_token):
    _, token = _uebung_gast(client, teacher_token)
    assert client.get("/api/practice/topics", headers=_auth(token)).status_code == 401


def test_guest_token_of_another_tool_does_not_open_practice(client, teacher_token):
    """Ein Gast-Token aus dem Abakus ist beim Üben kein Ausweis."""
    from api.tests.conftest import auth
    code = client.post("/api/tool-sessions", json={"tool_slug": "abacus"},
                       headers=auth(teacher_token)).json()["code"]
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(teacher_token))
    client.cookies.clear()
    token = client.post("/api/guest/join",
                        json={"code": code, "tool": "simulation", "name": "Gast"}).json()["token"]
    assert client.get(f"/api/practice/topics?code={code}", headers=_auth(token)).status_code == 401


def test_two_guests_are_counted_apart(client, db, teacher_token):
    code, a = _uebung_gast(client, teacher_token, "Anna")
    _, b = _uebung_gast(client, teacher_token, "Ben")
    from api.models import PracticeTask

    t = client.post(f"/api/practice/linear_equation/task?code={code}", headers=_auth(a)).json()
    row = db.get(PracticeTask, t["task_id"])
    client.post(f"/api/practice/tasks/{t['task_id']}/answer?code={code}",
                json={"answer": row.accept[0]}, headers=_auth(a))

    # Bens Zähler steht noch auf null, und Annas Aufgabe gehört ihm nicht.
    themen = client.get(f"/api/practice/topics?code={code}", headers=_auth(b)).json()
    assert next(x for x in themen if x["id"] == "linear_equation")["progress"] is None
    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer?code={code}",
                    json={"answer": "1"}, headers=_auth(b))
    assert r.status_code == 404
