"""Challenge: Spielwerte (Edelsteine im Hüpfen) und Bestenliste."""
from .conftest import auth
from .test_challenge import ETAPPE_1, _antwort, _gast, _h, _schueler, _sitzung, _start, _tok


def _wert(client, code, token, edelsteine, max=20, etappe=1, spiel="huepfen"):
    return client.post(f"/api/challenge/{code}/spielwert", headers=_h(client, token),
                       json={"spiel": spiel, "etappe": etappe, "edelsteine": edelsteine, "max": max})


def _liste(client, code, token, spiel="huepfen"):
    return client.get(f"/api/challenge/{code}/bestenliste?spiel={spiel}", headers=_h(client, token))


def test_speichert_und_behaelt_den_besten_wert(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    assert _wert(client, code, tok, 5).json() == {"gesamt": 5, "max": 20}
    assert _wert(client, code, tok, 3).json() == {"gesamt": 5, "max": 20}  # schlechter: bleibt
    assert _wert(client, code, tok, 8, etappe=1).json() == {"gesamt": 8, "max": 20}
    assert _wert(client, code, tok, 4, max=10, etappe=2).json() == {"gesamt": 12, "max": 30}


def test_mehr_edelsteine_als_max_ist_422(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    assert _wert(client, code, tok, 21, max=20).status_code == 422
    assert _wert(client, code, tok, 1, max=501).status_code == 422
    assert _wert(client, code, tok, 1, spiel="quatsch").status_code == 422


def test_vor_dem_start_409(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    assert _wert(client, code, _tok(_schueler(db, klass)), 1).status_code == 409


def test_bestenliste_reihenfolge_ich_und_gast(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    anna, ben = _schueler(db, klass, "Anna"), _schueler(db, klass, "Ben")
    ta, tb = _tok(anna), _tok(ben)
    gast = _gast(client, teacher_token, code, "Mia")
    for t in (ta, tb, gast):
        _start(client, code, t)
    _start(client, code, _tok(_schueler(db, klass, "Cleo")))  # ohne Wert: nicht in der Liste
    _wert(client, code, ta, 5)
    _wert(client, code, tb, 9)
    _wert(client, code, gast, 5)  # gleichauf mit Anna, später gemeldet
    zeilen = _liste(client, code, ta).json()
    assert [z["edelsteine"] for z in zeilen] == [9, 5, 5]
    assert [z["platz"] for z in zeilen] == [1, 2, 3]
    assert [z["ich"] for z in zeilen] == [False, True, False]
    assert zeilen[2]["name"] == "Mia" and zeilen[0]["max"] == 20
    assert [z["ich"] for z in _liste(client, code, gast).json()] == [False, False, True]
    assert _liste(client, code, ta, spiel="turm").json() == []


def test_bestenliste_fuer_die_lehrkraft(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    _wert(client, code, tok, 2)
    r = client.get(f"/api/challenge/{code}/bestenliste", headers=_h(client, teacher_token))
    assert r.status_code == 200 and len(r.json()) == 1 and r.json()[0]["ich"] is False


def test_uebersicht_und_csv_haben_edelsteine_ohne_wirkung_aufs_ergebnis(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    a, b = _schueler(db, klass, "Anna"), _schueler(db, klass, "Ben")
    ta, tb = _tok(a), _tok(b)
    for t in (ta, tb):
        _start(client, code, t)
        for cid in ETAPPE_1:
            _antwort(client, code, t, cid)
    ergebnis_vorher = {z["name"]: z["ergebnis"] for z in
                       client.get(f"/api/challenge/{code}/uebersicht", headers=auth(teacher_token)).json()["teilnehmer"]}
    _wert(client, code, ta, 7)
    zeilen = client.get(f"/api/challenge/{code}/uebersicht", headers=auth(teacher_token)).json()["teilnehmer"]
    je_name = {z["name"]: z for z in zeilen}
    assert sorted(z["edelsteine"] for z in zeilen if z["edelsteine"] is not None) == [7]
    assert [z["edelsteine"] for z in zeilen if z["edelsteine"] is None] == [None]
    assert {n: z["ergebnis"] for n, z in je_name.items()} == ergebnis_vorher
    csv = client.get(f"/api/challenge/{code}/export.csv", headers=auth(teacher_token)).text
    assert csv.splitlines()[0].endswith(";edelsteine")
    assert any(z.endswith(";7") for z in csv.splitlines()[1:])
