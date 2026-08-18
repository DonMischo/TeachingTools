"""
Tests for the student groups router (Kurse, Wahlpflicht, Gruppen A/B).

Covers:
  - CRUD (create, list, delete)
  - Membership add/remove
  - Cross-class point splitting on award
  - Auth enforcement (teacher required for writes)
"""
import pytest

from api.models import Class, Student
from .conftest import auth


@pytest.fixture()
def klass_b(db) -> Class:
    c = Class(code="9b", display_name="Klasse 9b")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def student_a(db, klass) -> Student:
    s = Student(nachname="Meier", vorname="Tom", klasse=klass.code, class_id=klass.id, geschlecht="m")
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def student_b(db, klass_b) -> Student:
    s = Student(nachname="Schulz", vorname="Nina", klasse=klass_b.code, class_id=klass_b.id, geschlecht="w")
    db.add(s)
    db.flush()
    return s


class TestCreateAndList:
    def test_create_group(self, client, teacher_token):
        r = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == "Kurs I"
        assert body["group_type"] == "kurs"
        assert body["member_ids"] == []

    def test_create_requires_auth(self, client):
        r = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"})
        assert r.status_code == 401

    def test_create_rejects_unknown_type(self, client, teacher_token):
        r = client.post("/api/groups", json={"group_type": "bogus", "name": "X"}, headers=auth(teacher_token))
        assert r.status_code == 400

    def test_list_filters_by_type(self, client, teacher_token):
        client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        client.post("/api/groups", json={"group_type": "wahlpflicht", "name": "DuG"}, headers=auth(teacher_token))
        r = client.get("/api/groups", params={"group_type": "kurs"})
        assert r.status_code == 200
        names = [g["name"] for g in r.json()]
        assert names == ["Kurs I"]

    def test_ab_gruppe_scoped_to_class(self, client, teacher_token, klass, klass_b):
        client.post("/api/groups", json={"group_type": "ab_gruppe", "name": "A", "class_id": klass.id}, headers=auth(teacher_token))
        r = client.get("/api/groups", params={"group_type": "ab_gruppe", "class_id": klass.id})
        assert len(r.json()) == 1
        r2 = client.get("/api/groups", params={"group_type": "ab_gruppe", "class_id": klass_b.id})
        assert len(r2.json()) == 0

    def test_delete_group(self, client, teacher_token):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        r = client.delete(f"/api/groups/{gid}", headers=auth(teacher_token))
        assert r.status_code == 204
        assert client.get("/api/groups").json() == []


class TestMembership:
    def test_add_and_remove_member(self, client, teacher_token, student_a):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]

        r = client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["member_ids"] == [student_a.id]

        r2 = client.delete(f"/api/groups/{gid}/members/{student_a.id}", headers=auth(teacher_token))
        assert r2.status_code == 200
        assert r2.json()["member_ids"] == []

    def test_add_member_idempotent(self, client, teacher_token, student_a):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        r = client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        assert r.json()["member_ids"] == [student_a.id]

    def test_roster_returns_members_sorted(self, client, teacher_token, student_a, student_b):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_b.id}, headers=auth(teacher_token))

        r = client.get(f"/api/groups/{gid}/roster", headers=auth(teacher_token))
        assert r.status_code == 200, r.text
        # student_a = Meier, student_b = Schulz → sorted by Nachname
        names = [(e["nachname"], e["vorname"]) for e in r.json()]
        assert names == [("Meier", "Tom"), ("Schulz", "Nina")]

    def test_roster_requires_auth(self, client, teacher_token):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.cookies.clear()
        r = client.get(f"/api/groups/{gid}/roster")
        assert r.status_code == 401

    def test_member_class_ids_derived(self, client, teacher_token, student_a, student_b, klass, klass_b):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        r = client.post(f"/api/groups/{gid}/members", json={"student_id": student_b.id}, headers=auth(teacher_token))
        assert sorted(r.json()["member_class_ids"]) == sorted([klass.id, klass_b.id])


class TestAward:
    def test_award_splits_equally_across_classes(self, client, teacher_token, student_a, student_b, klass, klass_b):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_b.id}, headers=auth(teacher_token))

        r = client.post(f"/api/groups/{gid}/award", json={"points": 10, "reason": "Test"}, headers=auth(teacher_token))
        assert r.status_code == 200
        rows = r.json()
        assert sorted(row["class_id"] for row in rows) == sorted([klass.id, klass_b.id])
        assert sum(row["points"] for row in rows) == 10
        assert all(row["points"] == 5 for row in rows)

        classes = {c["id"]: c["total_points"] for c in client.get("/api/classes").json()}
        assert classes[klass.id] == 5
        assert classes[klass_b.id] == 5

    def test_award_distributes_remainder(self, client, teacher_token, student_a, student_b):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_b.id}, headers=auth(teacher_token))

        r = client.post(f"/api/groups/{gid}/award", json={"points": 11}, headers=auth(teacher_token))
        rows = sorted(row["points"] for row in r.json())
        assert rows == [5, 6]
        assert sum(rows) == 11

    def test_award_empty_group_fails(self, client, teacher_token):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        r = client.post(f"/api/groups/{gid}/award", json={"points": 10}, headers=auth(teacher_token))
        assert r.status_code == 400

    def test_award_requires_auth(self, client, teacher_token, student_a):
        create = client.post("/api/groups", json={"group_type": "kurs", "name": "Kurs I"}, headers=auth(teacher_token))
        gid = create.json()["id"]
        client.post(f"/api/groups/{gid}/members", json={"student_id": student_a.id}, headers=auth(teacher_token))
        client.cookies.clear()
        r = client.post(f"/api/groups/{gid}/award", json={"points": 10})
        assert r.status_code == 401
