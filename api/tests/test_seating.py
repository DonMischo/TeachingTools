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


def test_additional_plans_open_to_any_teacher_default_stays_locked(client, klass, admin_token, teacher):
    # admin (bypasses) creates the default "Klassenraum" plan
    r = client.post(f"/api/classes/{klass.id}/seating", json={"name": "Klassenraum"}, headers=auth(admin_token))
    assert r.status_code == 200
    default_id = r.json()["id"]

    # a non-Klassenlehrer teacher may ADD and edit an additional room…
    client.cookies.clear()
    from api.tests.test_lueckentexte import token_for
    ttoken = token_for(teacher)
    r2 = client.post(f"/api/classes/{klass.id}/seating", json={"name": "Kunstraum"}, headers=auth(ttoken))
    assert r2.status_code == 200
    extra_id = r2.json()["id"]
    r3 = client.put(f"/api/seating/{extra_id}",
                    json={"name": "Kunstraum", "orientation": "landscape", "items": []},
                    headers=auth(ttoken))
    assert r3.status_code == 200

    # …but must not touch the default Klassenraum.
    r4 = client.put(f"/api/seating/{default_id}",
                    json={"name": "X", "orientation": "landscape", "items": []},
                    headers=auth(ttoken))
    assert r4.status_code == 403


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
    # filename is "<Klasse>_<YYYYMMDD>.pdf"
    import re as _re
    cd = r.headers.get("content-disposition", "")
    assert _re.search(rf"filename=\"?{klass.code}_\d{{8}}\.pdf", cd), cd


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


# ── Wer einen Sitzplan lesen darf ────────────────────────────────────────────
#
# Der Plan ist Lehrkraftsache. Einzige Ausnahme sind Klassensprecher mit
# Bearbeitungsfreigabe, und die nur fuer die eigene Klasse. Vorher hing an den
# Leseendpunkten nur `get_current_user`: mit fortlaufenden Plan-Ids liess sich
# der Sitzplan jeder Klasse abrufen, im PDF samt Namen.

from api.auth import create_access_token
from api.models import Class as _Class, StudentRole


def _student_head(db, klass, *, ksprecher: bool, freigeschaltet: bool = True) -> dict:
    s = Student(nachname="Sprecher", vorname="Kim", klasse=klass.code,
                class_id=klass.id, active=True)
    db.add(s)
    db.flush()
    if ksprecher:
        db.add(StudentRole(student_id=s.id, role_type="Klassensprecher", scope_id=klass.id))
        klass.ksprecher_can_edit = freigeschaltet
    db.flush()
    return auth(create_access_token({"sub": str(s.id), "type": "student"}))


def _plan_of(client, klass, admin_token) -> int:
    r = client.post(f"/api/classes/{klass.id}/seating", json={}, headers=auth(admin_token))
    return r.json()["id"]


def test_gewoehnlicher_schueler_kommt_nicht_an_den_sitzplan(client, db, klass, admin_token):
    plan_id = _plan_of(client, klass, admin_token)
    head = _student_head(db, klass, ksprecher=False)
    client.cookies.clear()
    assert client.get(f"/api/seating/{plan_id}", headers=head).status_code == 403
    assert client.get(f"/api/seating/{plan_id}/export.pdf", headers=head).status_code == 403
    assert client.get(f"/api/classes/{klass.id}/seating", headers=head).status_code == 403


def test_freigeschalteter_klassensprecher_darf_die_eigene_klasse(client, db, klass, admin_token):
    plan_id = _plan_of(client, klass, admin_token)
    head = _student_head(db, klass, ksprecher=True)
    client.cookies.clear()
    assert client.get(f"/api/seating/{plan_id}", headers=head).status_code == 200
    assert client.get(f"/api/classes/{klass.id}/seating", headers=head).status_code == 200


def test_klassensprecher_ohne_freigabe_bleibt_draussen(client, db, klass, admin_token):
    plan_id = _plan_of(client, klass, admin_token)
    head = _student_head(db, klass, ksprecher=True, freigeschaltet=False)
    client.cookies.clear()
    assert client.get(f"/api/seating/{plan_id}", headers=head).status_code == 403


def test_klassensprecher_kommt_nicht_an_fremde_klassen(client, db, klass, admin_token):
    fremd = _Class(code="9z", display_name="Klasse 9z")
    db.add(fremd)
    db.flush()
    fremder_plan = _plan_of(client, fremd, admin_token)
    head = _student_head(db, klass, ksprecher=True)
    client.cookies.clear()
    assert client.get(f"/api/seating/{fremder_plan}", headers=head).status_code == 403
    assert client.get(f"/api/seating/{fremder_plan}/export.pdf", headers=head).status_code == 403


def test_kurssitzplaene_bleiben_lehrkraeften_vorbehalten(client, db, klass, teacher_token, admin_token):
    from api.models import StudentGroup
    g = StudentGroup(group_type="kurs", name="Kurs I", grade=9)
    db.add(g)
    db.flush()
    r = client.post(f"/api/groups/{g.id}/seating", json={}, headers=auth(admin_token))
    plan_id = r.json()["id"]

    head = _student_head(db, klass, ksprecher=True)
    client.cookies.clear()
    assert client.get(f"/api/seating/{plan_id}", headers=head).status_code == 403
    assert client.get(f"/api/groups/{g.id}/seating", headers=head).status_code == 403
    # Jede Lehrkraft schon.
    assert client.get(f"/api/seating/{plan_id}", headers=auth(teacher_token)).status_code == 200


# ── Namen auf dem Plan ───────────────────────────────────────────────────────

def test_sitzplan_beschriftet_mit_rufnamen_initiale_nur_bei_gleichem_namen(db, klass):
    from api.display_names import seat_labels
    anna = Student(id=1, nachname="Bauer", vorname="Anna", klasse=klass.code, class_id=klass.id)
    anna2 = Student(id=2, nachname="Conrad", vorname="Anna", klasse=klass.code, class_id=klass.id)
    ben = Student(id=3, nachname="Dorn", vorname="Ben", klasse=klass.code, class_id=klass.id)
    labels = seat_labels([anna, anna2, ben])
    # Zwei Annas — nur die bekommen die Initiale dazu.
    assert labels[1] == "Anna B."
    assert labels[2] == "Anna C."
    assert labels[3] == "Ben"


def test_sitzplan_nimmt_den_alias(db, klass):
    from api.display_names import seat_labels
    s = Student(id=1, nachname="Bauer", vorname="Annalena", alias="Ann",
                klasse=klass.code, class_id=klass.id)
    assert seat_labels([s])[1] == "Ann"


def test_klassensprecher_bekommt_kein_nta(client, db, klass, admin_token):
    """Nachteilsausgleich ist Gesundheitsdatum — es geht an die Klassenleitung
    und an sonst niemanden, auch nicht an den Klassensprecher, der denselben
    Sitzplan bearbeiten darf."""
    betroffen = Student(nachname="Bauer", vorname="Anna", klasse=klass.code,
                        class_id=klass.id, active=True, nta=[1, 3])
    db.add(betroffen)
    db.flush()

    head = _student_head(db, klass, ksprecher=True)
    client.cookies.clear()
    r = client.get(f"/api/classes/{klass.id}/roster", headers=head)
    assert r.status_code == 200, r.text
    zeile = next(z for z in r.json() if z["id"] == betroffen.id)
    assert zeile["nta"] == []
    # Und der Name steht auch fuer ihn nur in der Kurzform.
    assert (zeile["vorname"], zeile["nachname"]) == ("Anna", "B.")


def test_klassenleitung_sieht_nta_weiterhin(client, db, klass, teacher, teacher_token):
    betroffen = Student(nachname="Bauer", vorname="Anna", klasse=klass.code,
                        class_id=klass.id, active=True, nta=[1, 3])
    db.add(betroffen)
    teacher.klasse_id = klass.id
    db.flush()

    r = client.get(f"/api/classes/{klass.id}/roster", headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    zeile = next(z for z in r.json() if z["id"] == betroffen.id)
    assert zeile["nta"] == [1, 3]
    assert (zeile["vorname"], zeile["nachname"]) == ("Anna", "Bauer")


def test_geschlecht_haengt_am_schulschalter(client, db, klass, teacher, teacher_token):
    from api.models import SchoolSettings
    s = Student(nachname="Bauer", vorname="Anna", klasse=klass.code,
                class_id=klass.id, active=True, geschlecht="weiblich")
    db.add(s)
    teacher.klasse_id = klass.id
    db.flush()

    # Voreinstellung: aus.
    zeile = client.get(f"/api/classes/{klass.id}/roster", headers=auth(teacher_token)).json()[0]
    assert zeile["geschlecht"] is None

    row = db.get(SchoolSettings, 1) or SchoolSettings(id=1)
    row.show_geschlecht = True
    db.add(row)
    db.flush()
    zeile = client.get(f"/api/classes/{klass.id}/roster", headers=auth(teacher_token)).json()[0]
    assert zeile["geschlecht"] == "weiblich"
