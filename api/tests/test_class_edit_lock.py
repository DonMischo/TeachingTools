"""Klassenverwaltung edit-lock: only a class's Klassenlehrer (or an admin) may
edit its chores, trackers and roles. Any teacher may still read. A granted
Klassensprecher may edit the limited subset (Dienste + additional Sitzpläne)."""
from api.auth import create_access_token
from api.models import Student, StudentRole
from api.tests.conftest import auth


def _ksprecher(db, klass, granted: bool):
    s = Student(nachname="Klassen", vorname="Sprecher", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    db.add(StudentRole(student_id=s.id, role_type="Klassensprecher", scope_id=klass.id))
    klass.ksprecher_can_edit = granted
    db.flush()
    return s, create_access_token({"sub": str(s.id), "type": "student"})


def _student(db, klass):
    s = Student(nachname="Sch", vorname="Ueler", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    return s


def test_chores_edit_requires_class_teacher(client, db, teacher, klass, teacher_token):
    # Anna is not 5a's Klassenlehrer → 403.
    r = client.post("/api/chores", headers=auth(teacher_token),
                    json={"class_id": klass.id, "chore_name": "Tafeldienst"})
    assert r.status_code == 403
    # Make her the Klassenlehrer → allowed.
    teacher.klasse_id = klass.id
    db.flush()
    r2 = client.post("/api/chores", headers=auth(teacher_token),
                     json={"class_id": klass.id, "chore_name": "Tafeldienst"})
    assert r2.status_code == 201


def test_trackers_edit_requires_class_teacher(client, db, teacher, klass, teacher_token):
    r = client.post("/api/trackers", headers=auth(teacher_token),
                    json={"class_id": klass.id, "name": "Materialgeld"})
    assert r.status_code == 403
    teacher.klasse_id = klass.id
    db.flush()
    r2 = client.post("/api/trackers", headers=auth(teacher_token),
                     json={"class_id": klass.id, "name": "Materialgeld"})
    assert r2.status_code == 201


def test_roles_assign_requires_class_teacher(client, db, teacher, klass, teacher_token):
    s = _student(db, klass)
    body = {"student_id": s.id, "role_type": "klassensprecher", "scope_id": klass.id}
    r = client.post("/api/roles", headers=auth(teacher_token), json=body)
    assert r.status_code == 403
    teacher.klasse_id = klass.id
    db.flush()
    r2 = client.post("/api/roles", headers=auth(teacher_token), json=body)
    assert r2.status_code == 201


def test_admin_may_edit_any_class(client, admin_token, klass):
    r = client.post("/api/chores", headers=auth(admin_token),
                    json={"class_id": klass.id, "chore_name": "Fensterdienst"})
    assert r.status_code == 201


def test_reads_stay_open_to_any_teacher(client, teacher_token, klass):
    # A non-Klassenlehrer may still view chores/trackers.
    assert client.get(f"/api/chores?class_id={klass.id}", headers=auth(teacher_token)).status_code == 200
    assert client.get(f"/api/trackers?class_id={klass.id}", headers=auth(teacher_token)).status_code == 200


# ── Klassensprecher edit-grant ─────────────────────────────────────────────────

def test_granted_klassensprecher_may_edit_chores(client, db, klass):
    _, tok = _ksprecher(db, klass, granted=True)
    client.cookies.clear()
    r = client.post("/api/chores", headers=auth(tok),
                    json={"class_id": klass.id, "chore_name": "Tafeldienst"})
    assert r.status_code == 201
    assert client.get(f"/api/chores?class_id={klass.id}", headers=auth(tok)).status_code == 200


def test_ungranted_klassensprecher_cannot_edit_chores(client, db, klass):
    _, tok = _ksprecher(db, klass, granted=False)
    client.cookies.clear()
    r = client.post("/api/chores", headers=auth(tok),
                    json={"class_id": klass.id, "chore_name": "Tafeldienst"})
    assert r.status_code == 403


def test_granted_klassensprecher_seating_additional_only(client, db, klass, admin_token):
    r = client.post(f"/api/classes/{klass.id}/seating",
                    json={"name": "Klassenraum"}, headers=auth(admin_token))
    default_id = r.json()["id"]
    _, tok = _ksprecher(db, klass, granted=True)
    client.cookies.clear()
    # May add an additional room…
    r2 = client.post(f"/api/classes/{klass.id}/seating",
                     json={"name": "Kunstraum"}, headers=auth(tok))
    assert r2.status_code == 200
    # …but not touch the default Klassenraum.
    r3 = client.put(f"/api/seating/{default_id}",
                    json={"name": "X", "orientation": "landscape", "items": []},
                    headers=auth(tok))
    assert r3.status_code == 403


def test_granted_klassensprecher_reads_roster(client, db, klass):
    db.add(Student(nachname="Aa", vorname="Bb", klasse=klass.code, class_id=klass.id,
                   geschlecht="weiblich", active=True))
    _, tok = _ksprecher(db, klass, granted=True)
    client.cookies.clear()
    r = client.get(f"/api/classes/{klass.id}/roster", headers=auth(tok))
    assert r.status_code == 200
    assert r.json() and all("geschlecht" in e for e in r.json())


def test_ungranted_student_cannot_read_roster(client, db, klass):
    _, tok = _ksprecher(db, klass, granted=False)
    client.cookies.clear()
    assert client.get(f"/api/classes/{klass.id}/roster", headers=auth(tok)).status_code == 403


def test_my_management_reports_granted_class(client, db, klass):
    _, tok = _ksprecher(db, klass, granted=True)
    client.cookies.clear()
    assert client.get("/api/classes/my-management", headers=auth(tok)).json()["class_id"] == klass.id


def test_my_management_null_when_not_granted(client, db, klass):
    _, tok = _ksprecher(db, klass, granted=False)
    client.cookies.clear()
    assert client.get("/api/classes/my-management", headers=auth(tok)).json()["class_id"] is None
