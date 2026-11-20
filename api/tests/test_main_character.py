"""Main Character: Figuren spiegeln nur Klasse, Woche und Werte in die Sitzung
(auch Gäste), die Lehrkraft sieht nur Anzahlen und Durchschnitte — und die
Durchschnitte erst ab drei Figuren. Lehrkraft-Zeilen zählen nicht mit."""
from api.models import MainCharacterStand, ToolAvailability
from api.routers.main_character import MIN_FUER_SCHNITT
from api.tests.conftest import auth
from api.tests.test_maus import als, schueler, _gast, _sitzung
from api.tests.test_maus_ausbau import _zweite_lehrkraft


def _stand(klasse="nerd", woche=10, w=50.0) -> dict:
    return {"klasse": klasse, "woche": woche, "werte": {"W": w, "Z": w, "S": w, "M": w, "E": w}}


def _uebersicht(client, code, token):
    return client.get(f"/api/main-character/sitzung/{code}/uebersicht", headers=auth(token))


def test_gast_spiegelt_stand_ohne_namen(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="main-character")
    gast = _gast(client, teacher_token, code, name="Mia")
    r = client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand(), headers=auth(gast))
    assert r.status_code == 200, r.text
    # Zweites Speichern überschreibt.
    client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand("gamer", 20), headers=auth(gast))
    zeilen = db.query(MainCharacterStand).all()
    assert len(zeilen) == 1 and zeilen[0].klasse == "gamer" and zeilen[0].woche == 20
    u = _uebersicht(client, code, teacher_token).json()
    assert u["anzahl"] == 1
    assert u["je_klasse"] == {"gamer": 1}
    assert "Mia" not in str(u)


def test_schnitt_erst_ab_drei_figuren(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="main-character")
    client.cookies.clear()
    schueler_ = [schueler(db, vorname=n, nachname="Test") for n in ("Ada", "Ben", "Cem")]
    for i, s in enumerate(schueler_[: MIN_FUER_SCHNITT - 1]):
        client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand(w=40 + 20 * i), headers=als(s))
    u = _uebersicht(client, code, teacher_token).json()
    assert u["anzahl"] == MIN_FUER_SCHNITT - 1 and u["schnitt"] is None and u["woche_schnitt"] is None
    client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand(w=90), headers=als(schueler_[2]))
    u = _uebersicht(client, code, teacher_token).json()
    assert u["schnitt"]["W"] == round((40 + 60 + 90) / 3, 1)
    assert u["woche_schnitt"] == 10


def test_lehrkraft_zaehlt_nicht_mit(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="main-character")
    r = client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand(), headers=auth(teacher_token))
    assert r.status_code == 200
    assert _uebersicht(client, code, teacher_token).json()["anzahl"] == 0


def test_werte_werden_geprueft(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="main-character")
    client.cookies.clear()
    ada = schueler(db)
    url = f"/api/main-character/sitzung/{code}/stand"
    assert client.put(url, json=_stand(klasse="hacker"), headers=als(ada)).status_code == 422
    assert client.put(url, json={"klasse": "nerd", "woche": 3, "werte": {"W": 1}}, headers=als(ada)).status_code == 422
    assert client.put(url, json=_stand(woche=999), headers=als(ada)).status_code == 422
    # Werte über 100 werden auf 100 begrenzt.
    client.put(url, json=_stand(w=250), headers=als(ada))
    assert db.query(MainCharacterStand).one().werte["W"] == 100.0


def test_uebersicht_nur_fuer_eigene_sitzung(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="main-character")
    client.cookies.clear()
    bert = _zweite_lehrkraft(db)
    assert client.get(f"/api/main-character/sitzung/{code}/uebersicht", headers=als(bert, "teacher")).status_code == 403
    ada = schueler(db)
    assert client.get(f"/api/main-character/sitzung/{code}/uebersicht", headers=als(ada)).status_code in (401, 403)


def test_fremde_und_geschlossene_sitzung(client, db, teacher_token):
    fremd = _sitzung(client, teacher_token, slug="maus")
    code = _sitzung(client, teacher_token, slug="main-character")
    client.post(f"/api/play/sessions/{code}/close?tool=simulation", headers=auth(teacher_token))
    client.cookies.clear()
    ada = schueler(db)
    assert client.put(f"/api/main-character/sitzung/{fremd}/stand", json=_stand(), headers=als(ada)).status_code == 400
    assert client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand(), headers=als(ada)).status_code == 403


def test_gesperrt_fuer_schueler(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="main-character")
    client.cookies.clear()
    ada = schueler(db)
    db.add(ToolAvailability(tool_slug="main-character", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    assert client.put(f"/api/main-character/sitzung/{code}/stand", json=_stand(), headers=als(ada)).status_code == 403
