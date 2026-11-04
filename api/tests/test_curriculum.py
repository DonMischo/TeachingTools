"""Curriculum-Abgleich: Operationen auf dem Dokument + Zugriff (Fachschaft, Gäste).

Tokens werden direkt erzeugt (wie in test_fragments.py), weil der Login das
Cookie auf dem geteilten TestClient setzt und Cookies den Bearer schlagen.
"""
import pytest

from api.auth import create_access_token, hash_password
from api.curriculum_ops import OpFehler, anwenden, leer
from api.models import Student, Teacher
from api.tests.conftest import auth

PREFIX = "/api/curriculum"


def t_auth(t: Teacher) -> dict:
    return auth(create_access_token({"sub": str(t.id), "type": "teacher"}))


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Beispiel", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


def _doc():
    d = leer()
    d["lehrplaene"] = [{"id": "rs2011", "rolle": "alt", "schulart": "RS", "karten": [
        {"id": "rs2011-56-zahl-01", "block": "5/6", "niveaus": {"R": "Primzahlen", "H": "Primzahlen"}},
    ]}]
    d["curriculum"]["klassen"] = [
        {"klasse": 5, "wochen_verfuegbar": 36, "themen": [
            {"id": "a", "titel": "A", "wochen": 2}, {"id": "b", "titel": "B", "wochen": 3}]},
        {"klasse": 6, "wochen_verfuegbar": 36, "themen": [{"id": "c", "titel": "C", "wochen": 4}]},
    ]
    return d


def _ids(doc, klasse):
    return [t["id"] for k in doc["curriculum"]["klassen"] if k["klasse"] == klasse for t in k["themen"]]


# ── Operationen ──────────────────────────────────────────────────────────────

def test_thema_verschieben_in_andere_klasse_an_stelle():
    d = anwenden(_doc(), {"op": "thema", "klasse": 6, "pos": 0, "thema": {"id": "b", "titel": "B", "wochen": 3}})
    assert _ids(d, 5) == ["a"]
    assert _ids(d, 6) == ["b", "c"]


def test_thema_aendern_behaelt_stelle():
    d = anwenden(_doc(), {"op": "thema", "klasse": 5, "thema": {"id": "a", "titel": "A2", "wochen": 5}})
    assert _ids(d, 5) == ["a", "b"]
    assert d["curriculum"]["klassen"][0]["themen"][0]["wochen"] == 5


def test_thema_in_neue_klasse_legt_klasse_sortiert_an():
    d = anwenden(_doc(), {"op": "thema", "klasse": 7, "thema": {"id": "n", "titel": "Neu"}})
    d = anwenden(d, {"op": "thema", "klasse": 4, "thema": {"id": "m", "titel": "Vor"}})
    assert [k["klasse"] for k in d["curriculum"]["klassen"]] == [4, 5, 6, 7]


def test_anwenden_aendert_das_original_nicht():
    orig = _doc()
    anwenden(orig, {"op": "thema_loeschen", "id": "a"})
    assert _ids(orig, 5) == ["a", "b"]


def test_karte_bearbeiten_ergaenzt_niveau():
    karte = {"id": "rs2011-56-zahl-01", "block": "5/6",
             "niveaus": {"R": "Primzahlen", "H": "Primzahlen", "LB": "Primzahlen bis 20"}}
    d = anwenden(_doc(), {"op": "karte", "lehrplan": "rs2011", "karte": karte})
    assert d["lehrplaene"][0]["karten"] == [karte]


def test_paar_ohne_id_bekommt_eine():
    d = anwenden(_doc(), {"op": "paar", "paar": {"alt": ["x"], "neu": [], "status": "entfallen"}})
    d = anwenden(d, {"op": "paar", "paar": {"alt": [], "neu": ["y"], "status": "neu"}})
    assert [p["id"] for p in d["abgleich"]] == ["p1", "p2"]


def test_import_ersetzt_nur_mitgeschickte_teile():
    neu = {"format": "tt-curriculum/1", "lehrplaene": [{"id": "rs2026", "rolle": "neu", "karten": []}],
           "abgleich": [{"alt": ["rs2011-56-zahl-01"], "neu": [], "status": "entfallen"}]}
    d = anwenden(_doc(), {"op": "import", "daten": neu})
    assert [lp["id"] for lp in d["lehrplaene"]] == ["rs2011", "rs2026"]
    assert d["abgleich"][0]["id"] == "p1"
    assert _ids(d, 5) == ["a", "b"]  # Curriculum nicht mitgeschickt → bleibt


@pytest.mark.parametrize("op", [
    {"op": "gibtsnicht"},
    {"op": "thema", "klasse": 5, "thema": {"titel": "ohne id"}},
    {"op": "karte", "lehrplan": "unbekannt", "karte": {"id": "k"}},
    {"op": "import", "daten": {"format": "anderes/2"}},
    {"op": "import", "daten": {"lehrplaene": [{"id": "x", "rolle": "mittel"}]}},
])
def test_ungueltige_operationen(op):
    with pytest.raises(OpFehler):
        anwenden(_doc(), op)


# ── API ──────────────────────────────────────────────────────────────────────

def _anlegen(client, t, data=None):
    r = client.post(PREFIX, json={"name": "Mathe Sek I", "data": data or _doc()}, headers=t_auth(t))
    assert r.status_code == 201, r.text
    return r.json()


def test_fachschaft_bearbeitet_gemeinsam(client, teacher, teacher2):
    client.cookies.clear()
    plan = _anlegen(client, teacher)
    assert plan["version"] == 1 and plan["darf_verwalten"]

    r = client.post(f"{PREFIX}/{plan['id']}/ops", headers=t_auth(teacher2), json={"ops": [
        {"op": "thema", "klasse": 6, "pos": 0, "thema": {"id": "b", "titel": "B", "wochen": 3}}]})
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2
    assert r.json()["zuletzt_von"] == "Bea Beispiel"
    assert r.json()["darf_verwalten"] is False

    # Abfrage mit aktueller Version liefert nur die Nummer
    r = client.get(f"{PREFIX}/{plan['id']}?seit=2", headers=t_auth(teacher))
    assert r.json() == {"version": 2}
    assert "data" in client.get(f"{PREFIX}/{plan['id']}?seit=1", headers=t_auth(teacher)).json()

    # Löschen nur durch die anlegende Lehrkraft
    assert client.delete(f"{PREFIX}/{plan['id']}", headers=t_auth(teacher2)).status_code == 403
    assert client.delete(f"{PREFIX}/{plan['id']}", headers=t_auth(teacher)).status_code == 204


def test_kaputte_op_aendert_nichts(client, teacher):
    client.cookies.clear()
    plan = _anlegen(client, teacher)
    r = client.post(f"{PREFIX}/{plan['id']}/ops", headers=t_auth(teacher), json={"ops": [
        {"op": "thema_loeschen", "id": "a"}, {"op": "gibtsnicht"}]})
    assert r.status_code == 422
    r = client.get(f"{PREFIX}/{plan['id']}", headers=t_auth(teacher)).json()
    assert r["version"] == 1 and _ids(r["data"], 5) == ["a", "b"]


def test_schueler_kommen_nicht_rein(client, db, teacher, klass):
    client.cookies.clear()
    plan = _anlegen(client, teacher)
    s = Student(nachname="Muster", vorname="Max", klasse=klass.code, class_id=klass.id, geschlecht="männlich",
                username="max.cur", password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    h = auth(create_access_token({"sub": str(s.id), "type": "student"}))
    assert client.get(f"{PREFIX}/{plan['id']}", headers=h).status_code == 403
    assert client.get(PREFIX, headers=h).status_code == 403


def test_gast_per_qr_lesen_und_bearbeiten(client, teacher):
    client.cookies.clear()
    plan = _anlegen(client, teacher)
    pid = plan["id"]
    assert client.get(f"{PREFIX}/guest/status", params={"code": "XXXXXX"}).json() == {"allow_guests": False}

    r = client.patch(f"{PREFIX}/{pid}", json={"allow_guests": True}, headers=t_auth(teacher)).json()
    code = r["guest_code"]
    assert code and r["guest_permission"] == "read"

    join = client.post(f"{PREFIX}/guest/join", json={"code": code.lower(), "name": "Gast Greta"})
    assert join.status_code == 200, join.text
    g = auth(join.json()["token"])

    lesen = client.get(f"{PREFIX}/{pid}", headers=g)
    assert lesen.status_code == 200
    assert lesen.json()["guest_code"] is None  # Gäste sehen den Code nicht
    op = {"ops": [{"op": "thema_loeschen", "id": "a"}]}
    assert client.post(f"{PREFIX}/{pid}/ops", json=op, headers=g).status_code == 403

    client.patch(f"{PREFIX}/{pid}", json={"guest_permission": "edit"}, headers=t_auth(teacher))
    r = client.post(f"{PREFIX}/{pid}/ops", json=op, headers=g)
    assert r.status_code == 200
    assert r.json()["zuletzt_von"] == "Gast Greta (Gast)"

    # Gast-Token gilt nur für diesen Plan
    other = _anlegen(client, teacher)
    assert client.get(f"{PREFIX}/{other['id']}", headers=g).status_code == 401

    # Neuer Code macht den alten QR ungültig
    client.post(f"{PREFIX}/{pid}/guest-code", headers=t_auth(teacher))
    assert client.get(f"{PREFIX}/{pid}", headers=g).status_code == 401


def test_gastzugang_stellt_nur_besitzer_ein(client, teacher, teacher2):
    client.cookies.clear()
    plan = _anlegen(client, teacher)
    r = client.patch(f"{PREFIX}/{plan['id']}", json={"allow_guests": True}, headers=t_auth(teacher2))
    assert r.status_code == 403
