"""Tests for teacher management: Klassenlehrer + teaching assignments."""
from api.models import StudentGroup, SubjectWochenstunden


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_set_and_clear_klassenlehrer(client, db, admin, admin_token, teacher, klass):
    r = client.patch(f"/api/teachers/{teacher.id}/klasse", json={"klasse_id": klass.id}, headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["klasse"] == "5a"
    assert r.json()["klasse_id"] == klass.id

    r = client.patch(f"/api/teachers/{teacher.id}/klasse", json={"klasse_id": None}, headers=_auth(admin_token))
    assert r.json()["klasse"] is None


def test_klassenlehrer_requires_admin(client, teacher, teacher_token, klass):
    r = client.patch(f"/api/teachers/{teacher.id}/klasse", json={"klasse_id": klass.id}, headers=_auth(teacher_token))
    assert r.status_code == 403


def test_add_class_subject_assignment(client, admin, admin_token, teacher, klass):
    r = client.post(f"/api/teachers/{teacher.id}/assignments",
                    json={"subject": "Ma", "class_id": klass.id}, headers=_auth(admin_token))
    assert r.status_code == 201
    a = r.json()["assignments"][0]
    assert a["label"] == "5a · Ma"
    assert a["class_code"] == "5a"


def test_add_kurs_group_assignment(client, db, admin, admin_token, teacher):
    g = StudentGroup(group_type="kurs", name="I")
    db.add(g)
    db.flush()

    r = client.post(f"/api/teachers/{teacher.id}/assignments",
                    json={"subject": "Ma", "group_id": g.id}, headers=_auth(admin_token))
    assert r.status_code == 201
    a = r.json()["assignments"][0]
    assert a["label"] == "Ma I"
    assert a["group_type"] == "kurs"


def test_assignment_rejects_both_or_neither_target(client, db, admin, admin_token, teacher, klass):
    g = StudentGroup(group_type="kurs", name="II")
    db.add(g)
    db.flush()

    r = client.post(f"/api/teachers/{teacher.id}/assignments",
                    json={"subject": "Ma"}, headers=_auth(admin_token))
    assert r.status_code == 422
    r = client.post(f"/api/teachers/{teacher.id}/assignments",
                    json={"subject": "Ma", "class_id": klass.id, "group_id": g.id}, headers=_auth(admin_token))
    assert r.status_code == 422


def test_assignment_rejects_ab_gruppe(client, db, admin, admin_token, teacher, klass):
    g = StudentGroup(group_type="ab_gruppe", name="A", class_id=klass.id)
    db.add(g)
    db.flush()

    r = client.post(f"/api/teachers/{teacher.id}/assignments",
                    json={"subject": "Ma", "group_id": g.id}, headers=_auth(admin_token))
    assert r.status_code == 422


def test_delete_assignment(client, admin, admin_token, teacher, klass):
    r = client.post(f"/api/teachers/{teacher.id}/assignments",
                    json={"subject": "En", "class_id": klass.id}, headers=_auth(admin_token))
    aid = r.json()["assignments"][0]["id"]

    r = client.delete(f"/api/teachers/assignments/{aid}", headers=_auth(admin_token))
    assert r.status_code == 204


def test_total_ws_sums_assignment_hours_plus_korrektur(client, db, admin, admin_token, teacher, klass):
    db.add(SubjectWochenstunden(subject="Ma", grade=5, hours=4))
    db.flush()

    client.post(f"/api/teachers/{teacher.id}/assignments",
               json={"subject": "Ma", "class_id": klass.id}, headers=_auth(admin_token))
    r = client.patch(f"/api/teachers/{teacher.id}/korrektur",
                     json={"korrektur": -1, "notiz": "Abminderung Fachleitung"}, headers=_auth(admin_token))

    assert r.status_code == 200
    assert r.json()["total_ws"] == 3  # 4 hours - 1 korrektur
    assert r.json()["notiz"] == "Abminderung Fachleitung"


def test_get_and_set_wochenstunden(client, db, admin, admin_token):
    db.add(SubjectWochenstunden(subject="Ma", grade=5, hours=4))
    db.flush()

    r = client.get("/api/teachers/wochenstunden", headers=_auth(admin_token))
    assert r.status_code == 200
    assert any(w["subject"] == "Ma" and w["grade"] == 5 for w in r.json())

    r = client.put("/api/teachers/wochenstunden",
                   json=[{"subject": "Ma", "grade": 5, "hours": 5}], headers=_auth(admin_token))
    assert r.status_code == 200
    updated = next(w for w in r.json() if w["subject"] == "Ma" and w["grade"] == 5)
    assert updated["hours"] == 5


def test_wochenstunden_requires_admin(client, teacher_token):
    r = client.get("/api/teachers/wochenstunden", headers=_auth(teacher_token))
    assert r.status_code == 403
