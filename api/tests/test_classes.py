"""
Tests for class listing and symbol management.
"""
import pytest
from api.models import Class, Transaction


def test_class_list_returns_all_seeded_classes(client, klass):
    r = client.get("/api/classes")

    assert r.status_code == 200
    codes = [c["code"] for c in r.json()]
    assert "5a" in codes


def test_class_with_no_transactions_shows_zero_points(client, klass):
    r = client.get("/api/classes")

    entry = next(c for c in r.json() if c["code"] == "5a")
    assert entry["total_points"] == 0


def test_class_total_reflects_awarded_points(client, db, klass, teacher):
    db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=30, reason="Fleißig"))
    db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=10, reason=""))
    db.flush()

    r = client.get("/api/classes")

    entry = next(c for c in r.json() if c["code"] == "5a")
    assert entry["total_points"] == 40


def test_class_total_accounts_for_deductions(client, db, klass, teacher):
    db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=50, reason=""))
    db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=-20, reason="Störung"))
    db.flush()

    r = client.get("/api/classes")

    entry = next(c for c in r.json() if c["code"] == "5a")
    assert entry["total_points"] == 30


def test_classes_from_different_classes_do_not_bleed(client, db, teacher):
    cls_a = Class(code="6a", display_name="Klasse 6a")
    cls_b = Class(code="6b", display_name="Klasse 6b")
    db.add_all([cls_a, cls_b])
    db.flush()

    db.add(Transaction(teacher_id=teacher.id, class_id=cls_a.id, points=100, reason=""))
    db.flush()

    r = client.get("/api/classes")
    data = {c["code"]: c["total_points"] for c in r.json()}

    assert data["6a"] == 100
    assert data["6b"] == 0


def test_teacher_can_set_emoji_symbol_for_their_class(client, klass, teacher_token):
    r = client.patch(
        f"/api/classes/{klass.id}/symbol",
        json={"symbol_emoji": "🦁"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.status_code == 200
    assert r.json()["symbol_emoji"] == "🦁"
    assert r.json()["symbol_image"] is None


def test_setting_emoji_clears_any_existing_image(client, db, klass, teacher_token):
    klass.symbol_image = "/uploads/gfx/custom_abc.png"
    db.flush()

    r = client.patch(
        f"/api/classes/{klass.id}/symbol",
        json={"symbol_emoji": "🐉"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.json()["symbol_image"] is None
    assert r.json()["symbol_emoji"] == "🐉"


def test_symbol_update_on_nonexistent_class_returns_404(client, teacher_token):
    r = client.patch(
        "/api/classes/99999/symbol",
        json={"symbol_emoji": "?"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert r.status_code == 404
