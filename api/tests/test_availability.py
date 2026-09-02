"""Tool-availability resolution + config API."""
from api import availability
from api.models import ToolAvailability, Student, StudentGroup, StudentGroupMember
from api.tests.conftest import auth


def _student(db, klass):
    s = Student(nachname="Sch", vorname="Ueler", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    return s


# ── resolution ───────────────────────────────────────────────────────────────

def test_defaults_teacher_vs_student(db, teacher, klass):
    student = _student(db, klass)
    # Teacher may host a game by default; a student may play but not host.
    assert availability.is_allowed(db, teacher, "bingo", "host") is True
    assert availability.is_allowed(db, student, "bingo", "use") is True
    assert availability.is_allowed(db, student, "bingo", "host") is False
    # Tools surface is teacher-only by default.
    assert availability.is_allowed(db, teacher, "barometer", "use") is True
    assert availability.is_allowed(db, student, "barometer", "use") is False


def test_unknown_capability_is_denied(db, teacher):
    # Abakus has no create; asking is a clean False, not an error.
    assert availability.is_allowed(db, teacher, "abacus", "create") is False


def test_global_override_supersedes_default(db, teacher):
    db.add(ToolAvailability(tool_slug="caputh", capability="use",
                            audience="teacher", class_id=None, allowed=False))
    db.flush()
    assert availability.is_allowed(db, teacher, "caputh", "use") is False


def test_per_class_override_beats_global(db, klass):
    student = _student(db, klass)
    # Globally students may host bingo…
    db.add(ToolAvailability(tool_slug="bingo", capability="host",
                            audience="student", class_id=None, allowed=True))
    # …but not in this particular class.
    db.add(ToolAvailability(tool_slug="bingo", capability="host",
                            audience="student", class_id=klass.id, allowed=False))
    db.flush()
    assert availability.is_allowed(db, student, "bingo", "host") is False
    # A student from another (unscoped) class still inherits the global allow.
    other = Student(nachname="A", vorname="B", klasse="9z", class_id=None,
                    geschlecht="m", active=True)
    db.add(other)
    db.flush()
    assert availability.is_allowed(db, other, "bingo", "host") is True


def test_resolve_user_map_shape(db, teacher):
    m = availability.resolve_user(db, teacher)
    assert set(m["bingo"].keys()) == {"use", "host", "create"}
    assert m["abacus"] == {"use": True}


# ── config API ───────────────────────────────────────────────────────────────

def test_me_endpoint(client, teacher_token):
    r = client.get("/api/availability/me", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["bingo"]["host"] is True


def test_catalog_lists_tools(client, teacher_token):
    r = client.get("/api/availability/catalog", headers=auth(teacher_token))
    assert r.status_code == 200
    slugs = {t["slug"] for t in r.json()}
    assert {"bingo", "caputh", "barometer"} <= slugs


def test_admin_can_set_global_override(client, admin_token, db):
    r = client.put("/api/availability/override", headers=auth(admin_token), json={
        "tool_slug": "caputh", "capability": "use",
        "audience": "student", "class_id": None, "allowed": False,
    })
    assert r.status_code == 200
    assert db.query(ToolAvailability).filter_by(tool_slug="caputh").count() == 1


def test_set_override_rejects_unknown_capability(client, admin_token):
    r = client.put("/api/availability/override", headers=auth(admin_token), json={
        "tool_slug": "abacus", "capability": "host",
        "audience": "student", "class_id": None, "allowed": True,
    })
    assert r.status_code == 400


def test_class_teacher_scope_rules(client, db, teacher, klass, teacher_token):
    # Make Anna the Klassenlehrer of 5a.
    teacher.klasse_id = klass.id
    db.flush()
    # She may set overrides for her own class…
    ok = client.put("/api/availability/override", headers=auth(teacher_token), json={
        "tool_slug": "bingo", "capability": "host",
        "audience": "student", "class_id": klass.id, "allowed": True,
    })
    assert ok.status_code == 200
    # …but not global ones…
    glob = client.put("/api/availability/override", headers=auth(teacher_token), json={
        "tool_slug": "bingo", "capability": "host",
        "audience": "student", "class_id": None, "allowed": True,
    })
    assert glob.status_code == 403
    # …nor another class's.
    other = client.put("/api/availability/override", headers=auth(teacher_token), json={
        "tool_slug": "bingo", "capability": "host",
        "audience": "student", "class_id": klass.id + 999, "allowed": True,
    })
    assert other.status_code == 403


def test_clear_override_reverts_to_default(client, admin_token, db, teacher):
    client.put("/api/availability/override", headers=auth(admin_token), json={
        "tool_slug": "caputh", "capability": "use",
        "audience": "teacher", "class_id": None, "allowed": False,
    })
    assert availability.is_allowed(db, teacher, "caputh", "use") is False
    r = client.request("DELETE", "/api/availability/override", headers=auth(admin_token),
                       params={"tool_slug": "caputh", "capability": "use", "audience": "teacher"})
    assert r.status_code == 204
    assert availability.is_allowed(db, teacher, "caputh", "use") is True


# ── A/B-Gruppen als engster Geltungsbereich ──────────────────────────────────

def _ab_group(db, klass, name, *students):
    g = StudentGroup(group_type="ab_gruppe", name=name, class_id=klass.id)
    db.add(g)
    db.flush()
    for s in students:
        db.add(StudentGroupMember(group_id=g.id, student_id=s.id))
    db.flush()
    return g


def test_group_override_beats_class(db, klass):
    """Die Gruppenregel ist die engere Auswahl und sticht die Klassenregel."""
    in_a = _student(db, klass)
    in_b = _student(db, klass)
    group_a = _ab_group(db, klass, "A", in_a)
    _ab_group(db, klass, "B", in_b)
    # Für die ganze Klasse erlaubt …
    db.add(ToolAvailability(tool_slug="bingo", capability="host",
                            audience="student", class_id=klass.id, allowed=True))
    # … nur nicht für Gruppe A.
    db.add(ToolAvailability(tool_slug="bingo", capability="host",
                            audience="student", group_id=group_a.id, allowed=False))
    db.flush()
    assert availability.is_allowed(db, in_a, "bingo", "host") is False
    assert availability.is_allowed(db, in_b, "bingo", "host") is True


def test_group_override_does_not_touch_teachers(db, klass, teacher):
    """Lehrkräfte sind keine Gruppenmitglieder — eine Gruppensperre trifft sie nicht."""
    group = _ab_group(db, klass, "A")
    db.add(ToolAvailability(tool_slug="caputh", capability="use",
                            audience="teacher", group_id=group.id, allowed=False))
    db.flush()
    assert availability.is_allowed(db, teacher, "caputh", "use") is True


def test_group_scope_via_api(client, admin_token, db, klass):
    """Setzen, Lesen und Zurücknehmen einer Gruppenregel über die API."""
    student = _student(db, klass)
    group = _ab_group(db, klass, "A", student)
    r = client.put("/api/availability/override", headers=auth(admin_token), json={
        "tool_slug": "bingo", "capability": "host",
        "audience": "student", "group_id": group.id, "allowed": True,
    })
    assert r.status_code == 200, r.text
    assert r.json()["group_id"] == group.id
    assert availability.is_allowed(db, student, "bingo", "host") is True

    rows = client.get("/api/availability/overrides", headers=auth(admin_token),
                      params={"group_id": group.id}).json()
    assert [(x["tool_slug"], x["group_id"]) for x in rows] == [("bingo", group.id)]
    # Die Klassenebene bleibt davon unberührt.
    assert client.get("/api/availability/overrides", headers=auth(admin_token),
                      params={"class_id": klass.id}).json() == []

    d = client.request("DELETE", "/api/availability/override", headers=auth(admin_token),
                       params={"tool_slug": "bingo", "capability": "host",
                               "audience": "student", "group_id": group.id})
    assert d.status_code == 204
    assert availability.is_allowed(db, student, "bingo", "host") is False


def test_cross_class_group_cannot_be_a_scope(client, admin_token, db):
    """Ein Kurs/WPF geht über Klassen hinweg — dafür gibt es keinen Geltungsbereich."""
    kurs = StudentGroup(group_type="kurs", name="Kurs I", class_id=None, grade=10)
    db.add(kurs)
    db.flush()
    r = client.put("/api/availability/override", headers=auth(admin_token), json={
        "tool_slug": "bingo", "capability": "host",
        "audience": "student", "group_id": kurs.id, "allowed": True,
    })
    assert r.status_code == 400
