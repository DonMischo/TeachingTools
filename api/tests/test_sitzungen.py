"""Gemeinsamer Sitzungsstand (``/api/sitzungen``): Lernende und Gäste melden
ihren Stand, die Lehrkraft der Sitzung sieht alle Zeilen, fremde Lehrkräfte
nicht; Größengrenze, geschlossene Sitzung, Werkzeugprüfung und neue Runde.
"""
from api.auth import hash_password
from api.models import Teacher
from .conftest import auth
from .test_markieren import _gast, _sitzung, als, schueler


def _daten(**kw) -> dict:
    daten = {"lektionen": ["doppelklick"], "quellen": {"q1": 52000},
             "challenge": {"markieren": {"best_ms": 41000, "runden": 2}}}
    daten.update(kw)
    return daten


def test_schueler_meldet_und_lehrkraft_sieht(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    ada = schueler(db)
    client.cookies.clear()
    url = f"/api/sitzungen/{code}/stand"
    assert client.put(url, json={"daten": _daten(), "aktuell": "Lektion 1"}, headers=als(ada)).json() == {"ok": True}
    assert client.put(url, json={"daten": _daten(lektionen=["doppelklick", "drag"])},
                      headers=als(ada)).status_code == 200
    client.cookies.clear()
    r = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert r["tool_slug"] == "markieren" and r["code"] == code
    [z] = r["zeilen"]
    assert z["klasse"] == "7a" and z["gast"] is False and z["aktuell"] is None
    assert z["daten"]["lektionen"] == ["doppelklick", "drag"]
    assert z["fertig_am"] is None


def test_gast_meldet_ueber_den_code(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="maus")
    gast = _gast(client, teacher_token, code)
    assert client.put(f"/api/sitzungen/{code}/stand", json={"daten": {"stufe": 2}},
                      headers=auth(gast)).status_code == 200
    zeilen = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()["zeilen"]
    assert [(z["gast"], z["name"]) for z in zeilen] == [(True, "Mia")]


def test_fertig_wird_einmal_gesetzt(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="maus")
    ada = schueler(db)
    client.cookies.clear()
    url = f"/api/sitzungen/{code}/stand"
    client.put(url, json={"daten": {}, "fertig": True}, headers=als(ada))
    client.put(url, json={"daten": {}}, headers=als(ada))
    client.cookies.clear()
    [z] = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()["zeilen"]
    assert z["fertig_am"] is not None


def test_fremde_lehrkraft_403(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    andere = Teacher(first_name="Bea", last_name="Berg", active=True,
                     password_hash=hash_password("x"), role="teacher")
    db.add(andere)
    db.flush()
    client.cookies.clear()
    assert client.get(f"/api/sitzungen/{code}/uebersicht", headers=als(andere, "teacher")).status_code == 403
    assert client.delete(f"/api/sitzungen/{code}/staende", headers=als(andere, "teacher")).status_code == 403


def test_zu_gross_und_unbekannter_modus_400(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    ada = schueler(db)
    client.cookies.clear()
    url = f"/api/sitzungen/{code}/stand"
    assert client.put(url, json={"daten": {"x": "a" * 17000}}, headers=als(ada)).status_code == 400
    assert client.put(url, json={"daten": {}, "aktuell": "a" * 121}, headers=als(ada)).status_code == 400
    assert client.put(url, json={"daten": _daten(challenge={"zauber": {}})}, headers=als(ada)).status_code == 400


def test_geschlossene_sitzung_403_und_unbekannt_404(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    client.post(f"/api/play/sessions/{code}/close?tool=simulation", headers=auth(teacher_token))
    ada = schueler(db)
    client.cookies.clear()
    assert client.put(f"/api/sitzungen/{code}/stand", json={"daten": {}}, headers=als(ada)).status_code == 403
    assert client.put("/api/sitzungen/NIXDA/stand", json={"daten": {}}, headers=als(ada)).status_code == 404


def test_neue_runde_loescht_staende(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    ada = schueler(db)
    client.cookies.clear()
    client.put(f"/api/sitzungen/{code}/stand", json={"daten": _daten()}, headers=als(ada))
    client.cookies.clear()
    assert client.delete(f"/api/sitzungen/{code}/staende", headers=auth(teacher_token)).status_code == 204
    assert client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()["zeilen"] == []


def test_jedes_werkzeug_bekommt_je_klasse_eine_eigene_sitzung(client, db, teacher_token, klass):
    """Früher nur Challenge und Markieren — die Algorithmen-Werkstatt bot die Klassenwahl an,
    bekam aber stillschweigend die offene Sitzung."""
    ohne = _sitzung(client, teacher_token, slug="algo")
    mit = client.post("/api/tool-sessions", json={"tool_slug": "algo", "class_id": klass.id},
                      headers=auth(teacher_token)).json()
    assert mit["code"] != ohne and mit["class_id"] == klass.id
