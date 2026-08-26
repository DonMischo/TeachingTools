"""Haeuser: CRUD, member classes and the live point total.

A house holds no point balance of its own — `total_points` is always summed
from its member classes' transactions, and other routers (Auktion) treat that
sum as the source of truth for what a house may spend.
"""
import pytest

from api.auth import create_access_token, hash_password
from api.models import Class, Haus, HausMember, Student, Transaction
from api.routers.haeuser import haus_total_points
from api.tests.conftest import auth

PREFIX = "/api/haeuser"


@pytest.fixture()
def head(client, teacher) -> dict:
    client.cookies.clear()
    return auth(create_access_token({"sub": str(teacher.id), "type": "teacher"}))


@pytest.fixture()
def klass2(db) -> Class:
    c = Class(code="6b", display_name="Klasse 6b")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def student(db, klass) -> Student:
    s = Student(nachname="Schueler", vorname="Sam", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True,
                username="sam.haus", password_hash=hash_password("pw"))
    db.add(s)
    db.flush()
    return s


def _points(db, teacher, klass, points: int) -> None:
    db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=points, reason="Test"))
    db.flush()


# ── CRUD ─────────────────────────────────────────────────────────────────────

def test_create_trims_the_name_and_defaults_the_color(client, head):
    r = client.post(PREFIX, headers=head, json={"name": "  Haus Nord  "})
    assert r.status_code == 201
    assert r.json()["name"] == "Haus Nord"
    assert r.json()["color"] == "#6366f1"
    assert r.json()["class_ids"] == []
    assert r.json()["total_points"] == 0
    assert r.json()["logo_path"] is None


def test_update_and_delete(client, db, head):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord", "color": "#ff0000"}).json()

    updated = client.put(f"{PREFIX}/{haus['id']}", headers=head,
                         json={"name": " Sued ", "color": "#00ff00"})
    assert updated.status_code == 200
    assert (updated.json()["name"], updated.json()["color"]) == ("Sued", "#00ff00")

    assert client.delete(f"{PREFIX}/{haus['id']}", headers=head).status_code == 204
    assert db.get(Haus, haus["id"]) is None


def test_unknown_house_is_404_everywhere(client, head, klass):
    assert client.put(f"{PREFIX}/9999", headers=head, json={"name": "X"}).status_code == 404
    assert client.delete(f"{PREFIX}/9999", headers=head).status_code == 404
    assert client.put(f"{PREFIX}/9999/members", headers=head,
                      json={"class_ids": [klass.id]}).status_code == 404


def test_listing_is_ordered_by_id(client, head):
    for name in ["Nord", "Sued", "Ost"]:
        client.post(PREFIX, headers=head, json={"name": name})
    assert [h["name"] for h in client.get(PREFIX, headers=head).json()] == ["Nord", "Sued", "Ost"]


def test_students_may_read_but_not_write(client, head, student):
    client.post(PREFIX, headers=head, json={"name": "Nord"})
    s_head = auth(create_access_token({"sub": str(student.id), "type": "student"}))

    assert len(client.get(PREFIX, headers=s_head).json()) == 1
    assert client.post(PREFIX, headers=s_head, json={"name": "Eigenes Haus"}).status_code == 403


# ── members + points ─────────────────────────────────────────────────────────

def test_members_replace_the_previous_set(client, db, head, klass, klass2):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()

    r = client.put(f"{PREFIX}/{haus['id']}/members", headers=head,
                   json={"class_ids": [klass.id, klass2.id]})
    assert sorted(r.json()["class_ids"]) == sorted([klass.id, klass2.id])

    r2 = client.put(f"{PREFIX}/{haus['id']}/members", headers=head, json={"class_ids": [klass2.id]})
    assert r2.json()["class_ids"] == [klass2.id]
    assert db.query(HausMember).filter_by(haus_id=haus["id"]).count() == 1


def test_members_reject_an_unknown_class_without_touching_the_old_set(client, db, head, klass):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()
    client.put(f"{PREFIX}/{haus['id']}/members", headers=head, json={"class_ids": [klass.id]})

    r = client.put(f"{PREFIX}/{haus['id']}/members", headers=head, json={"class_ids": [9999]})
    assert r.status_code == 400
    assert [m.class_id for m in db.query(HausMember).filter_by(haus_id=haus["id"]).all()] == [klass.id]


def test_total_points_sum_the_member_classes(client, db, head, teacher, klass, klass2):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()
    client.put(f"{PREFIX}/{haus['id']}/members", headers=head,
               json={"class_ids": [klass.id, klass2.id]})

    _points(db, teacher, klass, 30)
    _points(db, teacher, klass2, 12)
    _points(db, teacher, klass, -5)

    listed = client.get(PREFIX, headers=head).json()
    assert listed[0]["total_points"] == 37
    assert haus_total_points(db, haus["id"]) == 37


def test_points_of_a_non_member_class_do_not_count(client, db, head, teacher, klass, klass2):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()
    client.put(f"{PREFIX}/{haus['id']}/members", headers=head, json={"class_ids": [klass.id]})
    _points(db, teacher, klass2, 100)

    assert client.get(PREFIX, headers=head).json()[0]["total_points"] == 0


def test_a_house_without_members_has_no_points(client, db, head, teacher, klass):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()
    _points(db, teacher, klass, 50)
    assert client.get(PREFIX, headers=head).json()[0]["total_points"] == 0
    assert haus_total_points(db, haus["id"]) == 0


def test_deleting_a_house_removes_its_memberships(client, db, head, klass):
    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()
    client.put(f"{PREFIX}/{haus['id']}/members", headers=head, json={"class_ids": [klass.id]})

    client.delete(f"{PREFIX}/{haus['id']}", headers=head)
    assert db.query(HausMember).filter_by(haus_id=haus["id"]).count() == 0


# ── logo upload ──────────────────────────────────────────────────────────────

def test_logo_upload_stores_a_public_path(client, db, head, tmp_path, monkeypatch):
    from api.routers import haeuser as haeuser_router
    monkeypatch.setattr(haeuser_router, "LOGO_ROOT", tmp_path)

    haus = client.post(PREFIX, headers=head, json={"name": "Nord"}).json()
    r = client.post(f"{PREFIX}/{haus['id']}/logo", headers=head,
                    files={"file": ("wappen.png", b"\x89PNG-bytes", "image/png")})
    assert r.status_code == 200
    assert r.json()["logo_path"] == f"/uploads/haeuser/{haus['id']}/logo.png"
    assert (tmp_path / str(haus["id"]) / "logo.png").read_bytes() == b"\x89PNG-bytes"

    assert client.post(f"{PREFIX}/9999/logo", headers=head,
                       files={"file": ("x.png", b"x", "image/png")}).status_code == 404
