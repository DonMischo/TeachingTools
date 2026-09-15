"""Admin-feature grants: resolution + grant management API + enforcement."""
from api import admin_access
from api.models import TeacherRole, AdminFeatureGrant
from api.tests.conftest import auth

ALL = {"students", "teachers", "generators", "style_pack", "calendar_settings", "slideshow"}


def _role(db, name="Lehrer"):
    r = db.query(TeacherRole).filter_by(name=name).first()
    if not r:
        r = TeacherRole(name=name, counts_as_teacher=True)
        db.add(r)
        db.flush()
    return r


# ── resolution ───────────────────────────────────────────────────────────────

def test_admin_has_every_feature(db, admin):
    assert all(admin_access.has_admin_feature(db, admin, s) for s in ALL)
    assert set(admin_access.resolve_admin_features(db, admin)) == ALL


def test_plain_teacher_has_none(db, teacher):
    assert admin_access.resolve_admin_features(db, teacher) == []


def test_role_grant_gives_one_feature(db, teacher):
    role = _role(db)
    teacher.teacher_role_id = role.id
    db.add(AdminFeatureGrant(feature_slug="generators", teacher_role_id=role.id))
    db.flush()
    assert admin_access.has_admin_feature(db, teacher, "generators")
    assert not admin_access.has_admin_feature(db, teacher, "students")


def test_individual_grant(db, teacher):
    db.add(AdminFeatureGrant(feature_slug="style_pack", teacher_id=teacher.id))
    db.flush()
    assert admin_access.resolve_admin_features(db, teacher) == ["style_pack"]


# ── API ──────────────────────────────────────────────────────────────────────

def test_me_admin_lists_all(client, admin_token):
    r = client.get("/api/admin-access/me", headers=auth(admin_token))
    assert r.json()["is_admin"] is True
    assert set(r.json()["features"]) == ALL


def test_me_teacher_empty(client, teacher_token):
    r = client.get("/api/admin-access/me", headers=auth(teacher_token))
    assert r.json() == {"is_admin": False, "features": []}


def test_catalog_requires_admin(client, teacher_token, admin_token):
    client.cookies.clear()
    assert client.get("/api/admin-access/catalog", headers=auth(teacher_token)).status_code == 403
    client.cookies.clear()
    assert client.get("/api/admin-access/catalog", headers=auth(admin_token)).status_code == 200


def test_grant_needs_exactly_one_target(client, admin_token):
    r = client.put("/api/admin-access/grant", headers=auth(admin_token),
                   json={"feature_slug": "generators", "teacher_role_id": 1, "teacher_id": 2})
    assert r.status_code == 422


def test_grant_flow_enables_feature(client, db, admin_token, teacher_token, teacher):
    client.cookies.clear()
    r = client.put("/api/admin-access/grant", headers=auth(admin_token),
                   json={"feature_slug": "generators", "teacher_id": teacher.id})
    assert r.status_code == 201, r.text
    client.cookies.clear()
    feats = client.get("/api/admin-access/me", headers=auth(teacher_token)).json()["features"]
    assert feats == ["generators"]


def test_granted_teacher_reaches_gated_endpoint(client, db, admin_token, teacher_token, teacher):
    # Before the grant the teacher is blocked from the generators-admin list…
    client.cookies.clear()
    assert client.get("/api/admin/generators", headers=auth(teacher_token)).status_code == 403
    client.cookies.clear()
    client.put("/api/admin-access/grant", headers=auth(admin_token),
               json={"feature_slug": "generators", "teacher_id": teacher.id})
    # …and reaches it afterwards.
    client.cookies.clear()
    assert client.get("/api/admin/generators", headers=auth(teacher_token)).status_code == 200
