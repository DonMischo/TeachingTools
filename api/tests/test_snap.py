"""Snap!-Bibliothek: Speichern/Öffnen der Programme aus dem eingebetteten Editor.

Der Schwerpunkt liegt auf der Sichtbarkeit: anders als die geteilten
Inhaltsbibliotheken ist ein Snap!-Programm persönliche Arbeit. Ein Schüler darf
weder das Programm eines Mitschülers noch die Klassenvorlage überschreiben —
sonst geht bei der ersten Doppelstunde im Rechnerraum Arbeit verloren.
"""
import pytest

from api.auth import hash_password
from api.models import SnapProject, Student, ToolAvailability
from api.tests.conftest import auth

XML = '<project name="Test" app="Snap! 12" version="2"><notes></notes></project>'


@pytest.fixture()
def student_token(client, db, klass) -> str:
    s = Student(nachname="Schueler", vorname="Sam", klasse=klass.code, class_id=klass.id,
                username="s.sam", password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    # Snap! ist wie alle Tools per Default lehrerseitig — für die Schülertests
    # global freischalten.
    for cap in ("use", "create"):
        db.add(ToolAvailability(tool_slug="snap", capability=cap,
                                audience="student", class_id=None, allowed=True))
    db.flush()
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "s.sam", "password": "pw"})
    return r.json()["access_token"]


def _create(client, token, title="Quadrat", xml=XML, **extra):
    client.cookies.clear()
    return client.post("/api/snap", json={"title": title, "xml": xml, **extra}, headers=auth(token))


# ── Speichern & Öffnen ───────────────────────────────────────────────────────

def test_teacher_saves_and_reopens_a_project(client, teacher_token):
    r = _create(client, teacher_token)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    got = client.get(f"/api/snap/{pid}", headers=auth(teacher_token))
    assert got.status_code == 200
    # Das XML muss unverändert zurückkommen — Snap! lädt es wörtlich wieder ein.
    assert got.json()["xml"] == XML
    assert got.json()["mine"] is True


def test_xml_endpoint_serves_raw_xml_for_snaps_own_loader(client, teacher_token):
    pid = _create(client, teacher_token).json()["id"]
    r = client.get(f"/api/snap/{pid}/xml", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/xml")
    assert r.text == XML


def test_saving_again_overwrites_the_same_project(client, teacher_token):
    pid = _create(client, teacher_token).json()["id"]
    neu = XML.replace('name="Test"', 'name="Test 2"')
    r = client.put(f"/api/snap/{pid}", json={"xml": neu, "title": "Quadrat v2"},
                   headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["xml"] == neu
    assert client.get("/api/snap", headers=auth(teacher_token)).json()[0]["title"] == "Quadrat v2"


def test_delete_removes_the_project(client, teacher_token):
    pid = _create(client, teacher_token).json()["id"]
    assert client.delete(f"/api/snap/{pid}", headers=auth(teacher_token)).status_code == 204
    assert client.get(f"/api/snap/{pid}", headers=auth(teacher_token)).status_code == 404


# ── Eingaben ─────────────────────────────────────────────────────────────────

def test_non_snap_content_is_rejected(client, teacher_token):
    r = _create(client, teacher_token, xml="<html>kein Snap-Projekt</html>")
    assert r.status_code == 422


def test_oversized_project_is_rejected(client, teacher_token):
    fett = '<project name="X">' + "y" * (10 * 1024 * 1024) + "</project>"
    assert _create(client, teacher_token, xml=fett).status_code == 413


def test_empty_title_is_rejected(client, teacher_token):
    assert _create(client, teacher_token, title="   ").status_code == 422


# ── Sichtbarkeit & Rechte ────────────────────────────────────────────────────

def test_snap_is_teacher_only_by_default(client, db, klass):
    s = Student(nachname="Ohne", vorname="Recht", klasse=klass.code, class_id=klass.id,
                username="o.recht", password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    client.cookies.clear()
    token = client.post("/api/auth/login",
                        json={"username": "o.recht", "password": "pw"}).json()["access_token"]
    assert client.get("/api/snap", headers=auth(token)).status_code == 403


def test_student_saves_own_project(client, student_token):
    r = _create(client, student_token, title="Mein Spiel")
    assert r.status_code == 201, r.text
    assert r.json()["created_by_student"] is not None
    assert r.json()["created_by"] is None


def test_student_does_not_see_another_students_project(client, db, klass, student_token):
    other = Student(nachname="Andere", vorname="Alex", klasse=klass.code, class_id=klass.id,
                    active=True)
    db.add(other)
    db.flush()
    db.add(SnapProject(title="Fremd", xml=XML, created_by_student=other.id))
    db.flush()

    titel = [p["title"] for p in client.get("/api/snap", headers=auth(student_token)).json()]
    assert "Fremd" not in titel


def test_student_sees_the_class_template_but_cannot_overwrite_it(client, db, klass, teacher, student_token):
    vorlage = SnapProject(title="Vorlage Schleifen", xml=XML,
                          class_id=klass.id, created_by=teacher.id)
    db.add(vorlage)
    db.flush()

    liste = client.get("/api/snap", headers=auth(student_token)).json()
    eintrag = next(p for p in liste if p["title"] == "Vorlage Schleifen")
    assert eintrag["is_template"] is True
    assert eintrag["mine"] is False
    # Öffnen: ja. Überschreiben: nein — die Kopie ist der vorgesehene Weg.
    assert client.get(f"/api/snap/{vorlage.id}/xml", headers=auth(student_token)).status_code == 200
    assert client.put(f"/api/snap/{vorlage.id}", json={"xml": XML},
                      headers=auth(student_token)).status_code == 403


def test_template_of_another_class_stays_hidden(client, db, teacher, student_token):
    from api.models import Class
    andere = Class(code="9z", display_name="Klasse 9z")
    db.add(andere)
    db.flush()
    db.add(SnapProject(title="Fremde Vorlage", xml=XML, class_id=andere.id, created_by=teacher.id))
    db.flush()

    titel = [p["title"] for p in client.get("/api/snap", headers=auth(student_token)).json()]
    assert "Fremde Vorlage" not in titel


def test_teacher_sees_student_work_but_does_not_edit_it(client, db, klass, teacher_token, student_token):
    pid = _create(client, student_token, title="Schülerprojekt").json()["id"]

    client.cookies.clear()
    liste = client.get("/api/snap", headers=auth(teacher_token)).json()
    eintrag = next(p for p in liste if p["title"] == "Schülerprojekt")
    assert eintrag["mine"] is False
    # Kein Überschreiben fremder Arbeit — auch nicht durch die Lehrkraft.
    assert client.put(f"/api/snap/{pid}", json={"xml": XML},
                      headers=auth(teacher_token)).status_code == 403


def test_student_cannot_create_a_class_template(client, klass, student_token):
    r = _create(client, student_token, class_id=klass.id)
    assert r.status_code == 201
    assert r.json()["class_id"] is None


def test_admin_may_clean_up_any_project(client, db, admin_token, student_token):
    pid = _create(client, student_token).json()["id"]
    client.cookies.clear()
    assert client.delete(f"/api/snap/{pid}", headers=auth(admin_token)).status_code == 204


def test_teacher_marks_a_project_as_class_template_and_can_undo_it(client, klass, teacher_token):
    pid = _create(client, teacher_token).json()["id"]

    r = client.put(f"/api/snap/{pid}", json={"class_id": klass.id}, headers=auth(teacher_token))
    assert r.json()["is_template"] is True
    # Ausdrückliches null nimmt die Freigabe zurück (nicht "Feld weggelassen").
    r = client.put(f"/api/snap/{pid}", json={"class_id": None}, headers=auth(teacher_token))
    assert r.json()["class_id"] is None
    # Ein Speichern ohne class_id lässt die Freigabe unberührt.
    client.put(f"/api/snap/{pid}", json={"class_id": klass.id}, headers=auth(teacher_token))
    r = client.put(f"/api/snap/{pid}", json={"xml": XML}, headers=auth(teacher_token))
    assert r.json()["class_id"] == klass.id
