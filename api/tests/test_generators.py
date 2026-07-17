"""Tests for the restricted expression evaluator and admin-registered
declarative task generators."""
import pytest

from api.expr_eval import eval_expr, render_template
from api.models import Student
from api.auth import hash_password


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _student_login(client, db, username="gen.schueler") -> str:
    s = Student(nachname="Gen", vorname="Erik", klasse="7a", geschlecht="m",
                username=username, password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    r = client.post("/api/auth/login", json={"username": username, "password": "pw"})
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# expr_eval — the safety-critical piece
# ---------------------------------------------------------------------------

def test_eval_expr_basic_arithmetic():
    assert eval_expr("(c - b) / a", {"a": 2, "b": 3, "c": 11}) == 4


def test_eval_expr_rejects_function_calls():
    with pytest.raises(ValueError):
        eval_expr("__import__('os').system('echo pwned')", {})


def test_eval_expr_rejects_names_outside_variables():
    with pytest.raises(ValueError):
        eval_expr("os", {"a": 1})


def test_eval_expr_rejects_attribute_access():
    with pytest.raises(ValueError):
        eval_expr("a.__class__", {"a": 1})


def test_eval_expr_rejects_division_by_zero():
    with pytest.raises(ValueError):
        eval_expr("a / b", {"a": 1, "b": 0})


def test_eval_expr_rejects_huge_exponent():
    with pytest.raises(ValueError):
        eval_expr("a ** b", {"a": 2, "b": 999999})


def test_render_template_double_brace_vs_katex_single_brace():
    out = render_template(r"Löse: $\frac{a}{b} = {{c}}$", {"c": 4})
    assert out == r"Löse: $\frac{a}{b} = 4$"


def test_render_template_unknown_var_raises():
    with pytest.raises(ValueError):
        render_template("{{missing}}", {"a": 1})


# ---------------------------------------------------------------------------
# Admin CRUD
# ---------------------------------------------------------------------------

VALID_DEF = {
    "slug": "bruchrechnen",
    "label": "Bruchrechnen",
    "subject": "mathe",
    "description": "Brüche addieren",
    "levels": [
        {"template": "Rechne: $${{a}}/{{b}} + {{c}}/{{b}}$$ (als Bruch a+c über b, gib nur den Zähler an)",
         "vars": {"a": [1, 3], "b": [4, 4], "c": [1, 3]}, "answer_expr": "a + c", "hint": "Nenner bleibt gleich."},
    ],
}


def test_create_generator_requires_admin(client, teacher_token):
    client.cookies.clear()
    r = client.post("/api/admin/generators", json=VALID_DEF, headers=_auth(teacher_token))
    assert r.status_code == 403


def test_create_generator_success(client, admin_token):
    client.cookies.clear()
    r = client.post("/api/admin/generators", json=VALID_DEF, headers=_auth(admin_token))
    assert r.status_code == 201
    assert r.json()["slug"] == "bruchrechnen"


def test_create_generator_rejects_bad_answer_expr(client, admin_token):
    bad = {**VALID_DEF, "slug": "bad1", "levels": [{**VALID_DEF["levels"][0], "answer_expr": "a / 0"}]}
    client.cookies.clear()
    r = client.post("/api/admin/generators", json=bad, headers=_auth(admin_token))
    assert r.status_code == 422


def test_create_generator_rejects_collision_with_builtin(client, admin_token):
    collide = {**VALID_DEF, "slug": "linear_equation"}
    client.cookies.clear()
    r = client.post("/api/admin/generators", json=collide, headers=_auth(admin_token))
    assert r.status_code == 400


def test_create_generator_rejects_invalid_var_range(client, admin_token):
    bad = {**VALID_DEF, "slug": "bad2", "levels": [{**VALID_DEF["levels"][0], "vars": {"a": [5, 1]}}]}
    client.cookies.clear()
    r = client.post("/api/admin/generators", json=bad, headers=_auth(admin_token))
    assert r.status_code == 422


def test_delete_generator(client, admin_token):
    client.cookies.clear()
    client.post("/api/admin/generators", json=VALID_DEF, headers=_auth(admin_token))
    client.cookies.clear()
    r = client.delete("/api/admin/generators/bruchrechnen", headers=_auth(admin_token))
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# Public listing + practice integration
# ---------------------------------------------------------------------------

def test_public_list_includes_builtin_and_custom(client, admin_token, teacher_token):
    client.cookies.clear()
    client.post("/api/admin/generators", json=VALID_DEF, headers=_auth(admin_token))
    client.cookies.clear()
    r = client.get("/api/generators", headers=_auth(teacher_token))
    ids = {g["id"]: g["source"] for g in r.json()}
    assert ids.get("linear_equation") == "built-in"
    assert ids.get("bruchrechnen") == "custom"


def test_practice_generates_task_from_custom_generator(client, db, admin_token):
    client.cookies.clear()
    client.post("/api/admin/generators", json=VALID_DEF, headers=_auth(admin_token))

    token = _student_login(client, db)
    client.cookies.clear()
    r = client.post("/api/practice/bruchrechnen/task", headers=_auth(token))
    assert r.status_code == 201
    t = r.json()
    assert "{{" not in t["question"]  # placeholders resolved

    from api.models import PracticeTask
    row = db.get(PracticeTask, t["task_id"])
    r = client.post(f"/api/practice/tasks/{t['task_id']}/answer", json={"answer": row.accept[0]}, headers=_auth(token))
    assert r.json()["correct"] is True
