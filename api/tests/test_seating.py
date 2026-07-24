"""Tests for Sitzplan (seating plans per class): CRUD, permissions, PDF export."""
import re
import shutil

import pytest

from api.tests.conftest import auth
from api.models import Student
from api.seating_export import build_svg


def _mediabox(pdf: bytes) -> tuple[float, float]:
    m = re.search(rb"/MediaBox\s*\[([^\]]+)\]", pdf)
    assert m, "PDF has no MediaBox"
    n = [float(x) for x in m.group(1).split()]
    return n[2] - n[0], n[3] - n[1]  # width, height in points


def _sample_items():
    return [
        {
            "id": "t1", "kind": "table2", "x": 20, "y": 30, "rotation": 45,
            "locked": False, "label": None,
            "seats": [
                {"id": "s1", "student_id": None, "locked": False},
                {"id": "s2", "student_id": None, "locked": True},
            ],
        },
        {
            "id": "b1", "kind": "board", "x": 60, "y": 5, "rotation": 0,
            "locked": True, "label": None, "seats": [],
        },
    ]


# ── CRUD roundtrip ────────────────────────────────────────────────────────────

def test_create_list_get_roundtrip(client, klass, admin_token):
    r = client.post(
        f"/api/classes/{klass.id}/seating",
        json={"name": "Kunstraum", "orientation": "portrait"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200, r.text
    plan = r.json()
    assert plan["name"] == "Kunstraum"
    assert plan["orientation"] == "portrait"
    assert plan["items"] == []
    plan_id = plan["id"]

    r = client.get(f"/api/classes/{klass.id}/seating", headers=auth(admin_token))
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [plan_id]

    r = client.get(f"/api/seating/{plan_id}", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["name"] == "Kunstraum"


def test_create_defaults_to_klassenraum_landscape(client, klass, admin_token):
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Klassenraum"
    assert r.json()["orientation"] == "landscape"


def test_update_persists_items(client, db, klass, teacher, teacher_token):
    teacher.klasse_id = klass.id  # Klassenlehrer of this class
    db.flush()
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(teacher_token))
    plan_id = r.json()["id"]

    r = client.put(
        f"/api/seating/{plan_id}",
        json={"name": "Physikraum", "orientation": "landscape", "items": _sample_items()},
        headers=auth(teacher_token),
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 2
    assert items[0]["kind"] == "table2"
    assert items[0]["rotation"] == 45
    assert items[0]["seats"][1]["locked"] is True

    # Persisted across a fresh GET
    r = client.get(f"/api/seating/{plan_id}", headers=auth(teacher_token))
    assert r.json()["name"] == "Physikraum"
    assert len(r.json()["items"]) == 2


def test_delete_removes_plan(client, klass, admin_token):
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    plan_id = r.json()["id"]

    r = client.delete(f"/api/seating/{plan_id}", headers=auth(admin_token))
    assert r.status_code == 204

    r = client.get(f"/api/seating/{plan_id}", headers=auth(admin_token))
    assert r.status_code == 404


# ── Validation ────────────────────────────────────────────────────────────────

def test_unknown_kind_rejected(client, klass, admin_token):
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    plan_id = r.json()["id"]
    bad = [{"id": "x", "kind": "spaceship", "x": 0, "y": 0}]
    r = client.put(
        f"/api/seating/{plan_id}",
        json={"name": "X", "orientation": "landscape", "items": bad},
        headers=auth(admin_token),
    )
    assert r.status_code == 422


def test_create_on_missing_class_404(client, admin_token):
    r = client.post("/api/classes/99999/seating", json={}, headers=auth(admin_token))
    assert r.status_code == 404


# ── Permissions ───────────────────────────────────────────────────────────────

def test_non_editor_teacher_cannot_create(client, klass, teacher_token):
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(teacher_token))
    assert r.status_code == 403


def test_non_editor_teacher_cannot_update(client, klass, admin_token, db, teacher):
    # admin creates the plan; a non-Klassenlehrer teacher must not edit it
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    plan_id = r.json()["id"]
    client.cookies.clear()
    from api.tests.test_lueckentexte import token_for  # reuses login helper
    ttoken = token_for(teacher)
    r = client.put(
        f"/api/seating/{plan_id}",
        json={"name": "X", "orientation": "landscape", "items": []},
        headers=auth(ttoken),
    )
    assert r.status_code == 403


def test_list_requires_login(client, klass):
    client.cookies.clear()
    assert client.get(f"/api/classes/{klass.id}/seating").status_code == 401


# ── SVG builder (no LibreOffice needed) ───────────────────────────────────────

class _FakePlan:
    def __init__(self, orientation, items):
        self.orientation = orientation
        self.items = items


def test_build_svg_landscape_page_size():
    svg = build_svg(_FakePlan("landscape", []), {})
    assert 'width="297mm"' in svg and 'height="210mm"' in svg
    assert 'viewBox="0 0 297 210"' in svg


def test_build_svg_portrait_page_size():
    svg = build_svg(_FakePlan("portrait", []), {})
    assert 'width="210mm"' in svg and 'height="297mm"' in svg


def test_build_svg_renders_seat_names_and_rotation():
    items = [{
        "id": "t", "kind": "table1", "x": 10, "y": 10, "rotation": 45,
        "seats": [{"id": "s", "student_id": 7, "locked": False}],
    }]
    svg = build_svg(_FakePlan("landscape", items), {7: "Max Mustermann"})
    # table seats use short names (matches the web); full name is derived when
    # no short map is passed
    assert "Max M." in svg
    assert "Max Mustermann" not in svg
    assert "rotate(45" in svg


def test_build_svg_clips_seats_and_has_print_margin():
    items = [{
        "id": "t", "kind": "table2", "x": 10, "y": 10, "rotation": 0,
        "seats": [
            {"id": "s1", "student_id": None, "label": "Schulbegleiter", "locked": False},
            {"id": "s2", "student_id": None, "label": None, "locked": False},
        ],
    }]
    svg = build_svg(_FakePlan("landscape", items), {})
    # each seat's text is clipped so long labels don't overflow the cell
    assert "<clipPath" in svg and "clip-path=" in svg
    # a 5 mm dashed safe-area frame is drawn
    assert "stroke-dasharray" in svg


def test_build_svg_renders_seat_label_when_no_student():
    # A Schulbegleiter seat carries a label instead of a student_id.
    items = [{
        "id": "c", "kind": "chair", "x": 10, "y": 10, "rotation": 0,
        "seats": [{"id": "s", "student_id": None, "label": "Frau Klein", "locked": True}],
    }]
    svg = build_svg(_FakePlan("landscape", items), {})
    # chair names wrap into <tspan> lines, so the words appear split
    assert "Frau" in svg and "Klein" in svg


def test_chair_kind_and_seat_label_persist(client, klass, admin_token):
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    plan_id = r.json()["id"]
    items = [{
        "id": "c", "kind": "chair", "x": 5, "y": 5, "rotation": 0,
        "seats": [{"id": "s", "student_id": None, "label": "Schulbegleiter", "locked": True}],
    }]
    r = client.put(
        f"/api/seating/{plan_id}",
        json={"name": "Klassenraum", "orientation": "landscape", "items": items},
        headers=auth(admin_token),
    )
    assert r.status_code == 200, r.text
    seat = r.json()["items"][0]["seats"][0]
    assert seat["label"] == "Schulbegleiter"
    assert seat["locked"] is True


# ── PDF export (gated on LibreOffice) ─────────────────────────────────────────

@pytest.mark.skipif(shutil.which("soffice") is None, reason="LibreOffice not installed")
def test_export_pdf(client, db, klass, admin_token):
    db.add(Student(nachname="Mustermann", vorname="Max", klasse=klass.code,
                   class_id=klass.id, geschlecht="männlich"))
    db.flush()
    sid = db.query(Student).first().id

    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    plan_id = r.json()["id"]
    items = [{
        "id": "t", "kind": "table1", "x": 10, "y": 10, "rotation": 0,
        "seats": [{"id": "s", "student_id": sid, "locked": False}],
    }]
    client.put(
        f"/api/seating/{plan_id}",
        json={"name": "Klassenraum", "orientation": "landscape", "items": items},
        headers=auth(admin_token),
    )

    r = client.get(f"/api/seating/{plan_id}/export.pdf", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    # landscape plan → landscape A4 page (~842x595 pt), not the soffice default portrait
    w, h = _mediabox(r.content)
    assert w > h, f"expected landscape, got {w}x{h}"
    assert 835 < w < 848 and 590 < h < 600, f"not A4 landscape: {w}x{h}"
    # filename carries the class code
    assert f"Sitzplan_{klass.code}_" in r.headers.get("content-disposition", "")


@pytest.mark.skipif(shutil.which("soffice") is None, reason="LibreOffice not installed")
def test_export_pdf_portrait_orientation(client, klass, admin_token):
    r = client.post(f"/api/classes/{klass.id}/seating", json={"orientation": "portrait"}, headers=auth(admin_token))
    plan_id = r.json()["id"]
    r = client.get(f"/api/seating/{plan_id}/export.pdf", headers=auth(admin_token))
    assert r.status_code == 200
    w, h = _mediabox(r.content)
    assert h > w, f"expected portrait, got {w}x{h}"


def test_export_unknown_plan_404(client, admin_token):
    r = client.get("/api/seating/99999/export.pdf", headers=auth(admin_token))
    assert r.status_code == 404
