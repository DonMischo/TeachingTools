"""
Tests for awarding and deducting points.

All tests verify the observable outcome (class total, response body)
rather than internal implementation details.
"""
import pytest
from api.models import Teacher, Class
from api.auth import hash_password


def _award(client, token, class_id, teacher_id, points, reason=""):
    return client.post(
        "/api/transactions",
        json={"teacher_id": teacher_id, "class_id": class_id,
              "points": points, "reason": reason},
        headers={"Authorization": f"Bearer {token}"},
    )


def _totals(client):
    return {c["code"]: c["total_points"] for c in client.get("/api/classes").json()}


# ---------------------------------------------------------------------------
# Core point mechanics
# ---------------------------------------------------------------------------

def test_awarding_points_increases_class_total(client, teacher, teacher_token, klass):
    _award(client, teacher_token, klass.id, teacher.id, 10)

    assert _totals(client)[klass.code] == 10


def test_multiple_awards_accumulate(client, teacher, teacher_token, klass):
    _award(client, teacher_token, klass.id, teacher.id, 5)
    _award(client, teacher_token, klass.id, teacher.id, 15)

    assert _totals(client)[klass.code] == 20


def test_deducting_points_decreases_class_total(client, teacher, teacher_token, klass):
    _award(client, teacher_token, klass.id, teacher.id, 30)
    _award(client, teacher_token, klass.id, teacher.id, -10)

    assert _totals(client)[klass.code] == 20


def test_class_total_can_go_negative(client, teacher, teacher_token, klass):
    _award(client, teacher_token, klass.id, teacher.id, -25)

    assert _totals(client)[klass.code] == -25


def test_points_for_one_class_do_not_affect_another(client, db, teacher, teacher_token, klass):
    other = Class(code="7b", display_name="Klasse 7b")
    db.add(other)
    db.flush()

    _award(client, teacher_token, klass.id, teacher.id, 50)

    totals = _totals(client)
    assert totals[klass.code] == 50
    assert totals["7b"] == 0


# ---------------------------------------------------------------------------
# Response body
# ---------------------------------------------------------------------------

def test_response_contains_class_code_and_teacher_name(client, teacher, teacher_token, klass):
    r = _award(client, teacher_token, klass.id, teacher.id, 5, reason="Gute Mitarbeit")

    assert r.status_code == 201
    body = r.json()
    assert body["class_code"] == klass.code
    assert "Müller" in body["teacher_name"]
    assert body["points"] == 5
    assert body["reason"] == "Gute Mitarbeit"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def test_zero_points_are_rejected(client, teacher, teacher_token, klass):
    r = _award(client, teacher_token, klass.id, teacher.id, 0)

    assert r.status_code == 422


def test_transaction_for_nonexistent_class_returns_404(client, teacher, teacher_token):
    r = _award(client, teacher_token, 99999, teacher.id, 10)

    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

def test_teacher_can_record_transaction_for_themselves(client, teacher, teacher_token, klass):
    r = _award(client, teacher_token, klass.id, teacher.id, 5)

    assert r.status_code == 201


def test_teacher_cannot_record_transaction_as_another_teacher(client, db, teacher_token, klass):
    other = Teacher(first_name="Other", last_name="Guy", active=True,
                    password_hash=hash_password("pw"))
    db.add(other)
    db.flush()

    r = _award(client, teacher_token, klass.id, other.id, 10)

    assert r.status_code == 403


def test_admin_can_record_transaction_as_any_teacher(client, db, admin, admin_token, klass):
    other = Teacher(first_name="Some", last_name="Teacher", active=True,
                    password_hash=hash_password("pw"))
    db.add(other)
    db.flush()

    r = _award(client, admin_token, klass.id, other.id, 10)

    assert r.status_code == 201


def test_unauthenticated_request_is_rejected(client, klass, teacher):
    r = client.post(
        "/api/transactions",
        json={"teacher_id": teacher.id, "class_id": klass.id, "points": 5, "reason": ""},
    )

    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Transaction history
# ---------------------------------------------------------------------------

def test_transaction_history_is_ordered_newest_first(client, teacher, teacher_token, klass):
    _award(client, teacher_token, klass.id, teacher.id, 5, reason="first")
    _award(client, teacher_token, klass.id, teacher.id, 10, reason="second")

    r = client.get("/api/transactions")

    reasons = [t["reason"] for t in r.json()]
    assert reasons.index("second") < reasons.index("first")


def test_transaction_history_can_be_filtered_by_class(client, db, teacher, teacher_token):
    cls_x = Class(code="8a", display_name="Klasse 8a")
    cls_y = Class(code="8b", display_name="Klasse 8b")
    db.add_all([cls_x, cls_y])
    db.flush()

    _award(client, teacher_token, cls_x.id, teacher.id, 10, reason="for 8a")
    _award(client, teacher_token, cls_y.id, teacher.id, 20, reason="for 8b")

    r = client.get(f"/api/transactions?class_id={cls_x.id}")

    assert all(t["class_code"] == "8a" for t in r.json())
