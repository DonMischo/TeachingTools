"""KI-Kompass: eigener Stand am Konto, Spiegel in die Sitzung (auch für Gäste),
Übersicht nur für die Lehrkraft der Sitzung und Hauspunkte je Modul, geprüft
am gespeicherten Stand."""
from api.models import KiKompassPruefung, ToolAvailability, Transaction
from api.routers.kikompass import HAUSPUNKTE_JE_MODUL, MODULE
from api.tests.conftest import auth
from api.tests.test_maus import als, schueler, _gast, _sitzung
from api.tests.test_maus_ausbau import _haus, _schueler_mit_klasse, _zweite_lehrkraft

TEXT = "Ich habe gelernt, dass man KI-Antworten prüfen muss."


def _stand(*module: str, quiz: int = 3, text: str = TEXT) -> dict:
    stationen = {
        sid: {"quiz": quiz, "reflexion": [text, text]}
        for m in module for sid in MODULE[m]
    }
    return {"einschaetzungen": [{"datum": "2026-11-04", "haken": ["v-0-1", "v-0-2"]}], "stationen": stationen}


def test_eigener_stand_leer_dann_gespeichert(client, db):
    ada = schueler(db)
    assert client.get("/api/kikompass/stand", headers=als(ada)).json() == {"einschaetzungen": [], "stationen": {}}
    r = client.put("/api/kikompass/stand", json=_stand("verstehen"), headers=als(ada))
    assert r.status_code == 200, r.text
    daten = client.get("/api/kikompass/stand", headers=als(ada)).json()
    assert daten["einschaetzungen"][0]["haken"] == ["v-0-1", "v-0-2"]
    assert set(daten["stationen"]) == set(MODULE["verstehen"])
    # Zweites Speichern überschreibt, statt eine zweite Zeile anzulegen.
    client.put("/api/kikompass/stand", json={"einschaetzungen": [], "stationen": {}}, headers=als(ada))
    assert client.get("/api/kikompass/stand", headers=als(ada)).json()["stationen"] == {}


def test_unbekannte_station_und_satz_werden_abgelehnt(client, db):
    ada = schueler(db)
    r = client.put("/api/kikompass/stand", json={"stationen": {"x-gibtsnicht": {"quiz": 1}}}, headers=als(ada))
    assert r.status_code == 422
    r = client.put("/api/kikompass/stand",
                   json={"einschaetzungen": [{"datum": "2026-11-04", "haken": ["<script>"]}]}, headers=als(ada))
    assert r.status_code == 422


def test_anonym_darf_nicht(client):
    assert client.get("/api/kikompass/stand").status_code == 401


def test_gesperrt_fuer_schueler(client, db):
    ada = schueler(db)
    db.add(ToolAvailability(tool_slug="kikompass", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    assert client.put("/api/kikompass/stand", json=_stand(), headers=als(ada)).status_code == 403


def test_gast_spiegelt_in_sitzung_und_lehrkraft_sieht_es(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="kikompass")
    gast_token = _gast(client, teacher_token, code, name="Mia")
    r = client.put(f"/api/kikompass/sitzung/{code}/stand", json=_stand("anwenden"), headers=auth(gast_token))
    assert r.status_code == 200, r.text

    zeilen = client.get(f"/api/kikompass/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert len(zeilen) == 1
    assert zeilen[0]["gast"] is True
    assert zeilen[0]["stationen"]["a-datenschutz"]["reflexion"][0] == TEXT


def test_uebersicht_nur_fuer_eigene_sitzung(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="kikompass")
    client.cookies.clear()
    bert = _zweite_lehrkraft(db)
    r = client.get(f"/api/kikompass/sitzung/{code}/uebersicht", headers=als(bert, "teacher"))
    assert r.status_code == 403
    ada = schueler(db)
    assert client.get(f"/api/kikompass/sitzung/{code}/uebersicht", headers=als(ada)).status_code in (401, 403)


def test_fremde_sitzung_wird_abgelehnt(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="maus")
    client.cookies.clear()
    ada = schueler(db)
    r = client.put(f"/api/kikompass/sitzung/{code}/stand", json=_stand(), headers=als(ada))
    assert r.status_code == 400


def test_pruefung_vergibt_hauspunkte_einmal(client, db, teacher_token, klass):
    ada = _schueler_mit_klasse(db, klass)
    _haus(db, klass, name="Haus Süd")
    code = _sitzung(client, teacher_token, slug="kikompass")
    client.cookies.clear()
    client.put("/api/kikompass/stand", json=_stand("verstehen"), headers=als(ada))

    r = client.post("/api/kikompass/pruefung", json={"modul": "verstehen", "code": code}, headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["punkte"] == HAUSPUNKTE_JE_MODUL
    assert r.json()["haus"] == "Haus Süd"

    r = client.post("/api/kikompass/pruefung", json={"modul": "verstehen", "code": code}, headers=als(ada))
    assert r.json()["schon_vergeben"] is True
    assert db.query(KiKompassPruefung).filter_by(student_id=ada.id).count() == 1
    assert db.query(Transaction).filter_by(class_id=klass.id).count() == 1


def test_pruefung_prueft_gespeicherten_stand(client, db, klass):
    ada = _schueler_mit_klasse(db, klass)
    # Nichts gespeichert → abgelehnt.
    r = client.post("/api/kikompass/pruefung", json={"modul": "verstehen"}, headers=als(ada))
    assert r.status_code == 400
    # Quiz nicht bestanden.
    client.put("/api/kikompass/stand", json=_stand("verstehen", quiz=1), headers=als(ada))
    assert client.post("/api/kikompass/pruefung", json={"modul": "verstehen"}, headers=als(ada)).status_code == 400
    # Reflexion zu kurz.
    client.put("/api/kikompass/stand", json=_stand("verstehen", text="ok"), headers=als(ada))
    assert client.post("/api/kikompass/pruefung", json={"modul": "verstehen"}, headers=als(ada)).status_code == 400
    # Anderes Modul fertig hilft nicht.
    client.put("/api/kikompass/stand", json=_stand("anwenden"), headers=als(ada))
    assert client.post("/api/kikompass/pruefung", json={"modul": "verstehen"}, headers=als(ada)).status_code == 400


def test_pruefung_gast_darf_nicht(client, teacher_token):
    code = _sitzung(client, teacher_token, slug="kikompass")
    gast_token = _gast(client, teacher_token, code)
    r = client.post("/api/kikompass/pruefung", json={"modul": "verstehen", "code": code}, headers=auth(gast_token))
    assert r.status_code == 401


def test_lehrkraft_besteht_ohne_hauspunkte(client, db, teacher_token):
    client.put("/api/kikompass/stand", json=_stand("mitgestalten"), headers=auth(teacher_token))
    r = client.post("/api/kikompass/pruefung", json={"modul": "mitgestalten"}, headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert r.json() == {"bestanden": True, "punkte": 0, "schon_vergeben": False, "haus": None}


# ── Materialpool ────────────────────────────────────────────────────────────

def _material(**rest) -> dict:
    daten = {"titel": "Echt oder KI? Bildkarten", "text": "Acht Karten zum Sortieren.", "fach": "Deutsch",
             "klassen": "5-6", "bereich": "reflektieren", "stufe": "Ia", "dimension": "ueber",
             "art": "Sortieraufgabe", "link": "https://example.org/karten.pdf"}
    daten.update(rest)
    return daten


def test_material_anlegen_und_fuer_alle_lehrkraefte_sichtbar(client, db, teacher_token):
    r = client.post("/api/kikompass/material", json=_material(), headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    assert r.json()["eigen"] is True
    client.cookies.clear()
    bert = _zweite_lehrkraft(db)
    liste = client.get("/api/kikompass/material", headers=als(bert, "teacher")).json()
    assert len(liste) == 1
    assert liste[0]["eigen"] is False
    assert liste[0]["titel"] == "Echt oder KI? Bildkarten"


def test_material_filter_und_suche(client, teacher_token):
    client.post("/api/kikompass/material", json=_material(), headers=auth(teacher_token))
    client.post("/api/kikompass/material", json=_material(titel="Prompt-Formel", bereich="anwenden", stufe="Ib", dimension="mit"),
                headers=auth(teacher_token))
    h = auth(teacher_token)
    assert len(client.get("/api/kikompass/material?bereich=anwenden", headers=h).json()) == 1
    assert len(client.get("/api/kikompass/material?stufe=Ia&dimension=ueber", headers=h).json()) == 1
    assert [m["titel"] for m in client.get("/api/kikompass/material?q=formel", headers=h).json()] == ["Prompt-Formel"]


def test_material_nicht_fuer_schueler(client, db):
    ada = schueler(db)
    assert client.get("/api/kikompass/material", headers=als(ada)).status_code in (401, 403)
    assert client.post("/api/kikompass/material", json=_material(), headers=als(ada)).status_code in (401, 403)


def test_material_ungueltige_werte(client, teacher_token):
    h = auth(teacher_token)
    assert client.post("/api/kikompass/material", json=_material(bereich="x"), headers=h).status_code == 422
    assert client.post("/api/kikompass/material", json=_material(stufe="IV"), headers=h).status_code == 422
    assert client.post("/api/kikompass/material", json=_material(link="javascript:alert(1)"), headers=h).status_code == 422
    assert client.post("/api/kikompass/material", json=_material(titel="   "), headers=h).status_code == 422


def test_material_nur_eigenes_aendern_und_loeschen(client, db, teacher_token):
    mid = client.post("/api/kikompass/material", json=_material(), headers=auth(teacher_token)).json()["id"]
    client.cookies.clear()
    bert = _zweite_lehrkraft(db)
    assert client.put(f"/api/kikompass/material/{mid}", json=_material(titel="Fremd"), headers=als(bert, "teacher")).status_code == 403
    assert client.delete(f"/api/kikompass/material/{mid}", headers=als(bert, "teacher")).status_code == 403

    r = client.put(f"/api/kikompass/material/{mid}", json=_material(titel="Neu", link=""), headers=auth(teacher_token))
    assert r.json()["titel"] == "Neu"
    assert r.json()["link"] is None
    assert client.delete(f"/api/kikompass/material/{mid}", headers=auth(teacher_token)).status_code == 204
    assert client.get("/api/kikompass/material", headers=auth(teacher_token)).json() == []


def test_admin_darf_fremdes_material_loeschen(client, db, teacher_token, admin_token):
    mid = client.post("/api/kikompass/material", json=_material(), headers=auth(teacher_token)).json()["id"]
    client.cookies.clear()
    assert client.delete(f"/api/kikompass/material/{mid}", headers=auth(admin_token)).status_code == 204
