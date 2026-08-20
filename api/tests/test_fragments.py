"""Fragments (TaskCards-style boards): collection ACL + card authorship.

Permission ladder (api/fragment_access.py): none < read < contribute < manage.
  - Owner teacher and admins always resolve to 'manage'.
  - No grants  -> private to the owner.
  - grantee_type='all_teachers' grants apply to every teacher.
  - grantee_type='class' grants apply to students of that class only
    (a class never sees an all_teachers grant, and vice versa).
  - 'contribute' may create cards and edit/delete only its OWN cards
    (author-stamped via author_kind/author_id).
  - Guests are add-only: they may never edit an existing card, even one they
    authored themselves.

Tokens are minted directly (create_access_token) rather than via the login
endpoint, because login sets the hp_session cookie on the shared TestClient
and cookie auth beats the Bearer header (auth._resolve_token) -- see
test_student_authorship.py for the same pattern. client.cookies.clear() is
called defensively at the top of every test.
"""
from api.auth import create_access_token, hash_password
from api.models import Teacher, Class, Student
from api.tests.conftest import auth

PREFIX = "/api/fragments"


def _teacher_token(t: Teacher) -> str:
    return create_access_token({"sub": str(t.id), "type": "teacher"})


def _student_token(s: Student) -> str:
    return create_access_token({"sub": str(s.id), "type": "student"})


def teacher_auth(t: Teacher) -> dict:
    return auth(_teacher_token(t))


def student_auth(s: Student) -> dict:
    return auth(_student_token(s))


# ── fixtures ─────────────────────────────────────────────────────────────────

import pytest


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Schmidt", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def student(db, klass) -> Student:
    s = Student(nachname="Schüler", vorname="Sam", klasse=klass.code, class_id=klass.id,
                geschlecht="männlich", username="sam.frag", password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    return s


# ── 1. owner: full CRUD ──────────────────────────────────────────────────────

def test_owner_can_crud_own_collection(client, teacher):
    client.cookies.clear()
    h = teacher_auth(teacher)

    r = client.post(f"{PREFIX}/collections", json={"name": "Mathe-Board"}, headers=h)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["is_owner"] is True
    assert body["my_permission"] == "manage"
    cid = body["id"]

    assert client.get(f"{PREFIX}/collections/{cid}", headers=h).status_code == 200

    p = client.patch(f"{PREFIX}/collections/{cid}", json={"name": "Neuer Name"}, headers=h)
    assert p.status_code == 200
    assert p.json()["name"] == "Neuer Name"

    d = client.delete(f"{PREFIX}/collections/{cid}", headers=h)
    assert d.status_code == 204
    assert client.get(f"{PREFIX}/collections/{cid}", headers=h).status_code == 404


# ── 2. admin manages/reads another teacher's private collection ─────────────

def test_admin_can_manage_and_read_private_collection(client, teacher, admin):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={"name": "Privat"}, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    g = client.get(f"{PREFIX}/collections/{cid}", headers=teacher_auth(admin))
    assert g.status_code == 200
    assert g.json()["my_permission"] == "manage"

    p = client.patch(f"{PREFIX}/collections/{cid}", json={"description": "von Admin"}, headers=teacher_auth(admin))
    assert p.status_code == 200
    assert p.json()["description"] == "von Admin"


# ── 3. student cannot create a collection ────────────────────────────────────

def test_student_cannot_create_collection(client, student):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={"name": "X"}, headers=student_auth(student))
    assert r.status_code == 403


# ── 4. private collection (no grants) is invisible to another teacher ───────

def test_private_collection_hidden_from_other_teacher(client, teacher, teacher2):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={"name": "Geheim"}, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    assert client.get(f"{PREFIX}/collections/{cid}", headers=teacher_auth(teacher2)).status_code == 403

    listing = client.get(f"{PREFIX}/collections", headers=teacher_auth(teacher2)).json()
    assert cid not in {c["id"] for c in listing}


# ── 5. all_teachers grant: read allows viewing, blocks contribute ───────────

def test_all_teachers_read_grant_allows_read_not_contribute(client, teacher, teacher2):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Team-Board",
        "grants": [{"grantee_type": "all_teachers", "permission": "read"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    assert client.get(f"{PREFIX}/collections/{cid}", headers=teacher_auth(teacher2)).status_code == 200
    listing = client.get(f"{PREFIX}/collections", headers=teacher_auth(teacher2)).json()
    assert cid in {c["id"] for c in listing}

    p = client.post(f"{PREFIX}/collections/{cid}/fragments", json={"tab": "snippets", "content": "x"},
                     headers=teacher_auth(teacher2))
    assert p.status_code == 403


# ── 6. all_teachers grant: contribute = create + edit-own only ──────────────

def test_all_teachers_contribute_grant_edit_own_only(client, teacher, teacher2):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Team-Board",
        "grants": [{"grantee_type": "all_teachers", "permission": "contribute"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    c2 = client.post(f"{PREFIX}/collections/{cid}/fragments",
                      json={"tab": "snippets", "content": "von t2"}, headers=teacher_auth(teacher2))
    assert c2.status_code == 201
    frag2_id = c2.json()["id"]

    c1 = client.post(f"{PREFIX}/collections/{cid}/fragments",
                      json={"tab": "snippets", "content": "vom Owner"}, headers=teacher_auth(teacher))
    frag1_id = c1.json()["id"]

    own_edit = client.patch(f"{PREFIX}/items/{frag2_id}", json={"content": "geändert"}, headers=teacher_auth(teacher2))
    assert own_edit.status_code == 200

    other_edit = client.patch(f"{PREFIX}/items/{frag1_id}", json={"content": "hack"}, headers=teacher_auth(teacher2))
    assert other_edit.status_code == 403

    grants_resp = client.put(f"{PREFIX}/collections/{cid}/grants", json=[], headers=teacher_auth(teacher2))
    assert grants_resp.status_code == 403

    own_delete = client.delete(f"{PREFIX}/items/{frag2_id}", headers=teacher_auth(teacher2))
    assert own_delete.status_code == 204


# ── 7. "public" (all_teachers grant) is teachers-only, not visible to a student ─

def test_all_teachers_grant_not_visible_to_student(client, teacher, student):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Lehrer-Only",
        "grants": [{"grantee_type": "all_teachers", "permission": "read"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    assert client.get(f"{PREFIX}/collections/{cid}", headers=student_auth(student)).status_code == 403
    listing = client.get(f"{PREFIX}/collections", headers=student_auth(student)).json()
    assert cid not in {c["id"] for c in listing}


# ── 8. class grant: read allows viewing, blocks contribute (student) ────────

def test_class_read_grant_blocks_student_contribute(client, teacher, klass, student):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Klassen-Board",
        "grants": [{"grantee_type": "class", "class_id": klass.id, "permission": "read"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    assert client.get(f"{PREFIX}/collections/{cid}", headers=student_auth(student)).status_code == 200
    listing = client.get(f"{PREFIX}/collections", headers=student_auth(student)).json()
    assert cid in {c["id"] for c in listing}

    p = client.post(f"{PREFIX}/collections/{cid}/fragments", json={"tab": "snippets", "content": "x"},
                     headers=student_auth(student))
    assert p.status_code == 403


# ── 9. class grant: contribute = create + edit-own only (student) ───────────

def test_class_contribute_grant_student_edit_own_only(client, teacher, klass, student):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Klassen-Board",
        "grants": [{"grantee_type": "class", "class_id": klass.id, "permission": "contribute"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    owner_card = client.post(f"{PREFIX}/collections/{cid}/fragments",
                              json={"tab": "snippets", "content": "vom Lehrer"}, headers=teacher_auth(teacher))
    owner_frag_id = owner_card.json()["id"]

    student_card = client.post(f"{PREFIX}/collections/{cid}/fragments",
                                json={"tab": "snippets", "content": "vom Schüler"}, headers=student_auth(student))
    assert student_card.status_code == 201
    student_frag_id = student_card.json()["id"]

    own_edit = client.patch(f"{PREFIX}/items/{student_frag_id}", json={"content": "geändert"},
                             headers=student_auth(student))
    assert own_edit.status_code == 200

    other_edit = client.patch(f"{PREFIX}/items/{owner_frag_id}", json={"content": "hack"},
                               headers=student_auth(student))
    assert other_edit.status_code == 403


# ── 10. a manage grant does not substitute for ownership on delete ──────────

def test_manage_grant_does_not_allow_delete(client, teacher, teacher2):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Team-Board",
        "grants": [{"grantee_type": "all_teachers", "permission": "manage"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    # teacher2 has 'manage' via the grant and may edit collection settings...
    patch = client.patch(f"{PREFIX}/collections/{cid}", json={"description": "ok"}, headers=teacher_auth(teacher2))
    assert patch.status_code == 200

    # ...but deleting the whole board is owner/admin-only.
    delr = client.delete(f"{PREFIX}/collections/{cid}", headers=teacher_auth(teacher2))
    assert delr.status_code == 403


# ── 11. guest flow: opt-in, status, join, read, add-only contribute ─────────

def test_guest_flow_add_only(client, teacher):
    client.cookies.clear()
    h = teacher_auth(teacher)

    r = client.post(f"{PREFIX}/collections", json={"name": "Gäste-Board"}, headers=h)
    cid = r.json()["id"]

    gc = client.post(f"{PREFIX}/collections/{cid}/guest-code", headers=h)
    assert gc.status_code == 200
    code = gc.json()["guest_code"]
    assert code

    status = client.get(f"{PREFIX}/guest/status", params={"code": code})
    assert status.status_code == 200
    status_body = status.json()
    assert status_body["allow_guests"] is True
    assert status_body["collection_id"] == cid
    assert status_body["permission"] == "read"  # default guest_permission

    join = client.post(f"{PREFIX}/guest/join", json={"code": code, "name": "Gast Greta"})
    assert join.status_code == 200
    guest_headers = auth(join.json()["token"])

    assert client.get(f"{PREFIX}/collections/{cid}", headers=guest_headers).status_code == 200
    assert client.get(f"{PREFIX}/collections/{cid}/fragments", headers=guest_headers).status_code == 200

    # guest_permission is still "read" -> may not contribute yet.
    denied = client.post(f"{PREFIX}/collections/{cid}/fragments",
                          json={"tab": "snippets", "content": "Gast-Notiz"}, headers=guest_headers)
    assert denied.status_code == 403

    # owner upgrades guests to contribute (existing guest token is unaffected —
    # the permission is looked up live off the collection, not embedded in the token).
    upgrade = client.patch(f"{PREFIX}/collections/{cid}", json={"guest_permission": "contribute"}, headers=h)
    assert upgrade.status_code == 200

    created = client.post(f"{PREFIX}/collections/{cid}/fragments",
                           json={"tab": "snippets", "content": "Gast-Notiz"}, headers=guest_headers)
    assert created.status_code == 201

    # Add-only: a guest can never edit an existing card, even with contribute.
    # Item-level endpoints depend on get_current_user, which rejects any
    # guest-typed token outright (401) before collection permission logic runs.
    owner_card = client.post(f"{PREFIX}/collections/{cid}/fragments",
                              json={"tab": "snippets", "content": "vom Lehrer"}, headers=h)
    owner_frag_id = owner_card.json()["id"]
    edit_attempt = client.patch(f"{PREFIX}/items/{owner_frag_id}", json={"content": "hack"}, headers=guest_headers)
    assert edit_attempt.status_code == 401


# ── 12. custom tabs: manage-only, unknown tab rejected on card create ───────

def test_custom_tabs_and_unknown_tab_rejected(client, teacher, teacher2):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/collections", json={
        "name": "Tab-Board",
        "grants": [{"grantee_type": "all_teachers", "permission": "read"}],
    }, headers=teacher_auth(teacher))
    cid = r.json()["id"]

    upd = client.patch(f"{PREFIX}/collections/{cid}/tabs", json={"custom_tabs": ["Recherche-Extra"]},
                        headers=teacher_auth(teacher))
    assert upd.status_code == 200
    assert "Recherche-Extra" in upd.json()["custom"]

    forbidden = client.patch(f"{PREFIX}/collections/{cid}/tabs", json={"custom_tabs": ["Noch einer"]},
                              headers=teacher_auth(teacher2))
    assert forbidden.status_code == 403

    bad_tab = client.post(f"{PREFIX}/collections/{cid}/fragments",
                           json={"tab": "does-not-exist", "content": "x"}, headers=teacher_auth(teacher))
    assert bad_tab.status_code == 400
