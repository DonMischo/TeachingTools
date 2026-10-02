"""Kartenquiz: Engine (Nummern, Namensabgleich, Entschärfen) und Spiel per Code mit Hauspunkten."""
import json

from api import karten_quiz as engine
from api.auth import create_access_token
from api.models import Student, Transaction
from .conftest import auth

# ── Engine ───────────────────────────────────────────────────────────


def test_nummern_wie_im_frontend():
    n = engine.vergib_nummern({
        "de-seen": {"objekte": ["see1"], "nummerierung": "zahl"},
        "de-staedte": {"objekte": ["erfurt", "jena"], "nummerierung": "zahl"},
        "de-fluesse": {"objekte": ["saale", "ilm"], "nummerierung": "klein"},
    }, ["de-staedte", "de-fluesse", "de-seen"])
    assert n == {"de-staedte": {"erfurt": "1", "jena": "2"}, "de-fluesse": {"saale": "a", "ilm": "b"}, "de-seen": {"see1": "3"}}
    assert [engine.marke("roemisch", i) for i in (4, 9, 14)] == ["IV", "IX", "XIV"]
    assert engine.marke("klein", 27) == "aa"


def test_name_passt_tolerant():
    a = {"name": "Thüringer Wald", "alternativen": []}
    assert engine.name_passt("thueringer wald", a)
    assert engine.name_passt("Der Thüringer Wald", a)
    assert engine.name_passt("Thüringer Wlad", a)  # Buchstabendreher zählt als ein Fehler
    assert not engine.name_passt("Bayerischer Wald", a)
    assert engine.name_passt("Rhone", {"name": "Rhône", "alternativen": []})
    assert not engine.name_passt("Ilz", {"name": "Ilm", "alternativen": []})  # kurz: kein Tippfehler erlaubt


def test_entschaerfte_ebene_ohne_namen_und_ids():
    sammlung = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [11, 51]},
         "properties": {"id": "16051000", "name": "Erfurt", "land": "Thüringen", "rang": "landeshauptstadt", "ew": 1}}]}
    aus = engine.entschaerfe_ebene(sammlung, "de-staedte", "geheim")
    p = aus["features"][0]["properties"]
    assert "name" not in p and "land" not in p and p["rang"] == "landeshauptstadt"
    assert p["id"] == engine.token("geheim", "de-staedte", "16051000") != "16051000"


# ── Spiel ────────────────────────────────────────────────────────────

SATZ = {"titel": "Thüringen", "inhalt": {
    "art": "stumm", "region": "thueringen", "ebenen": ["de-laender", "de-staedte", "de-fluesse"], "beschriftung": False,
    "auswahl": {"de-staedte": {"objekte": ["16051000", "16053000"], "nummerierung": "zahl"},
                "de-fluesse": {"objekte": ["saale-56"], "nummerierung": "klein"}}}}


def _quiz(client, token, **einstellungen):
    satz = client.post("/api/karten/saetze", json=SATZ, headers=auth(token)).json()
    code = client.post("/api/tool-sessions", json={"tool_slug": "karten", "ref_id": satz["id"]}, headers=auth(token)).json()["code"]
    if einstellungen:
        client.put(f"/api/tool-sessions/{code}/settings", json=einstellungen, headers=auth(token))
    return code


def _gast(client, token, code, name="Mia"):
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    gast = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return gast


def test_benennen_gast_sieht_keine_namen_und_bekommt_loesung_nach_zwei_fehlern(client, teacher_token):
    code = _quiz(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    spiel = client.get(f"/api/karten/quiz/{code}", headers=auth(gast)).json()
    roh = json.dumps(spiel["spiel"])
    assert "Erfurt" not in roh and "Saale" not in roh and "16051000" not in roh
    assert [a["marke"] for a in spiel["spiel"]["aufgaben"]] == ["1", "2", "a"]
    assert {k["id"] for k in spiel["katalog"]} == {"de-laender", "de-staedte", "de-fluesse"}

    ebene = client.get(f"/api/karten/quiz/{code}/ebene/de-staedte", headers=auth(gast)).json()
    assert all("name" not in f["properties"] for f in ebene["features"])
    assert client.get(f"/api/karten/quiz/{code}/ebene/de-gipfel", headers=auth(gast)).status_code == 404

    r = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 1, "antwort": "erfurt"}, headers=auth(gast)).json()
    assert r["richtig"] and r["stand"]["richtig"] == 1
    r = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 3, "antwort": "Elbe"}, headers=auth(gast)).json()
    assert not r["richtig"] and "loesung" not in r
    r = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 3, "antwort": "Werra"}, headers=auth(gast)).json()
    assert r["loesung"] == "Saale"


def test_finden_klick_mit_token_und_erfolg(client, teacher_token):
    code = _quiz(client, teacher_token, modus="finden")
    gast = _gast(client, teacher_token, code)
    spiel = client.get(f"/api/karten/quiz/{code}", headers=auth(gast)).json()
    saale = next(a for a in spiel["spiel"]["aufgaben"] if a["name"] == "Saale")
    token_saale = spiel["spiel"]["auswahl"]["de-fluesse"][0]
    falsch = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": saale["nr"], "antwort": "abc"}, headers=auth(gast)).json()
    assert not falsch["richtig"]
    r = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": saale["nr"], "antwort": token_saale}, headers=auth(gast)).json()
    assert r["richtig"]
    assert r["neue_erfolge"] == ["alle-de-fluesse"]  # die einzige Fluss-Aufgabe gelöst


def test_uebersicht_und_hauspunkte_nur_einmal(client, db, teacher_token, klass):
    code = _quiz(client, teacher_token, max_punkte=10)
    schueler = Student(vorname="Kim", nachname="Test", klasse="5a", class_id=klass.id, active=True)
    db.add(schueler)
    db.flush()
    st = auth(create_access_token({"sub": str(schueler.id), "type": "student"}))
    client.cookies.clear()
    client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 1, "antwort": "Erfurt"}, headers=st)
    client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 2, "antwort": "Jena"}, headers=st)

    lk = auth(teacher_token)
    ueb = client.get(f"/api/karten/quiz/{code}/uebersicht", headers=lk).json()
    assert ueb["teilnehmer"][0]["richtig"] == 2 and ueb["teilnehmer"][0]["klasse"] == "5a"
    assert ueb["punkte"] == [{"class_id": klass.id, "klasse": "5a", "teilnehmer": 1, "quote": 0.667, "punkte": 7}]

    assert client.post(f"/api/karten/quiz/{code}/punkte", headers=lk).status_code == 200
    assert db.query(Transaction).filter_by(class_id=klass.id).one().points == 7
    assert client.post(f"/api/karten/quiz/{code}/punkte", headers=lk).status_code == 409


def test_fremde_lehrkraft_sieht_keine_uebersicht(client, teacher_token, admin_token):
    client.cookies.clear()
    code = _quiz(client, teacher_token)
    assert client.get(f"/api/karten/quiz/{code}/uebersicht", headers=auth(admin_token)).status_code == 403
    assert client.post(f"/api/karten/quiz/{code}/punkte", headers=auth(admin_token)).status_code == 403
