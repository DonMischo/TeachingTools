"""Ausbau des »Maus-Führerscheins«: Hilfe-Modus, Filter der Bestenliste,
Fortschritt je Sitzung (auch für Gäste) und die Abschlussprüfung mit
Hauspunkten.

Baut auf ``test_maus.py`` auf und übernimmt dessen Hilfsfunktionen
(``schueler``, ``als``, ``_eintrag``, ``_sitzung``, ``_gast``) — siehe dort für
die Begründung des Gast-über-Code-Musters. Modelle, die es vor der
Implementierung noch nicht gibt (``MausFortschritt``, ``MausPruefung``,
sowie das neue Feld ``hilfe`` auf ``MausBestenliste``), werden erst in den
einzelnen Tests importiert, damit die Sammlung (Collection) nicht an einem
fehlenden Symbol scheitert.
"""
import pytest

from api.auth import create_access_token, hash_password
from api.models import Class, Haus, HausMember, Student, Teacher, ToolAvailability, Transaction
from api.tests.conftest import auth
from api.tests.test_maus import als, schueler, _eintrag, _gast, _sitzung

HAUSPUNKTE_JE_TEIL = 5

TEIL_1_STUFEN = ["klick", "doppelklick", "rechtsklick", "ziehen", "markieren", "kopieren"]
TEIL_2_STUFEN = ["scrollen", "tastatur", "explorer", "fenster", "screenshot"]


def _stufen(teil: int) -> dict:
    """Ein vollständiger ``stufen``-Block für Teil 1 oder Teil 2 — jede Stufe
    bestanden (punkte > 0)."""
    ids = TEIL_1_STUFEN if teil == 1 else TEIL_2_STUFEN
    return {sid: {"punkte": 900, "sterne": 2, "dauer_ms": 40000} for sid in ids}


def _schueler_mit_klasse(db, klass: Class, vorname="Ada", nachname="Lovelace") -> Student:
    s = Student(vorname=vorname, nachname=nachname, klasse=klass.code, class_id=klass.id,
                active=True, username=f"{vorname}.{nachname}.{klass.code}".lower(),
                password_hash=hash_password("x"))
    db.add(s)
    db.flush()
    return s


def _haus(db, *klassen: Class, name="Haus Nord") -> Haus:
    h = Haus(name=name)
    db.add(h)
    db.flush()
    for k in klassen:
        db.add(HausMember(haus_id=h.id, class_id=k.id))
    db.flush()
    return h


def _zweite_lehrkraft(db, vorname="Bert", nachname="Bauer", klasse_id=None) -> Teacher:
    t = Teacher(first_name=vorname, last_name=nachname, active=True,
                password_hash=hash_password("secret"), role="teacher", klasse_id=klasse_id)
    db.add(t)
    db.flush()
    return t


# ── A) Bestenliste: Hilfe-Modus und Filter ──────────────────────────────────

def test_hilfe_flag_wird_gespeichert_und_zurueckgegeben(client, db):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(hilfe=True), headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["hilfe"] is True

    liste = client.get("/api/maus/bestenliste?modus=klick", headers=als(ada)).json()
    assert liste[0]["hilfe"] is True


def test_hilfe_flag_ohne_angabe_ist_false(client, db):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["hilfe"] is False


def test_klasse_filter_zeigt_nur_die_eigene_klasse(client, db):
    ada = schueler(db, "Ada", "L", klasse="7a")
    ben = schueler(db, "Ben", "K", klasse="7b")
    client.post("/api/maus/bestenliste", json=_eintrag(wert=100), headers=als(ada))
    client.post("/api/maus/bestenliste", json=_eintrag(wert=200), headers=als(ben))

    liste = client.get("/api/maus/bestenliste?modus=klick&klasse=7a", headers=als(ada)).json()
    assert len(liste) == 1
    assert liste[0]["klasse"] == "7a"


def test_sitzung_filter_zeigt_nur_teilnehmer_mit_fortschritt_in_der_sitzung(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    ada = schueler(db, "Ada", "L")
    gast_token = _gast(client, teacher_token, code, name="Mia")

    # Ada postet nur an die globale Bestenliste, nie an diese Sitzung.
    client.post("/api/maus/bestenliste", json=_eintrag(wert=100), headers=als(ada))
    # Der Gast meldet Fortschritt in der Sitzung (Abschnitt B) und trägt sich
    # zusätzlich in die Bestenliste der Sitzung ein.
    client.put(f"/api/maus/sitzung/{code}/fortschritt",
               json={"stufen": {"klick": {"punkte": 500, "sterne": 1, "dauer_ms": 1000}},
                     "hilfe": False, "bestanden": []},
               headers=auth(gast_token))
    client.post(f"/api/maus/bestenliste/{code}", json=_eintrag(wert=300), headers=auth(gast_token))

    liste = client.get(f"/api/maus/bestenliste?modus=klick&sitzung={code}", headers=als(ada)).json()
    namen = [e["name"] for e in liste]
    assert "Mia" in namen
    assert not any(e["wert"] == 100 for e in liste)  # Ada hat keinen Fortschritt in der Sitzung
    assert [e["platz"] for e in liste] == list(range(1, len(liste) + 1))


def test_sitzung_filter_unbekannter_code(client, db, teacher_token):
    r = client.get("/api/maus/bestenliste?modus=klick&sitzung=NOPECODE", headers=auth(teacher_token))
    assert r.status_code == 404


def test_sitzung_filter_falsches_werkzeug(client, teacher_token):
    abacus_code = _sitzung(client, teacher_token, "abacus")
    r = client.get(f"/api/maus/bestenliste?modus=klick&sitzung={abacus_code}", headers=auth(teacher_token))
    assert r.status_code == 400


@pytest.mark.parametrize("wert,status", [(60000, 200), (60001, 400)])
def test_gesamt_obergrenze_ist_jetzt_60000(client, db, wert, status):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag("gesamt", wert), headers=als(ada))
    assert r.status_code == status, r.text


# ── B) Fortschritt je Sitzung ───────────────────────────────────────────────

def _fortschritt_body(teil=1, hilfe=False, bestanden=None) -> dict:
    return {"stufen": _stufen(teil), "hilfe": hilfe, "bestanden": bestanden or []}


def test_gast_meldet_fortschritt_und_lehrkraft_sieht_ihn_in_der_uebersicht(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code, name="Mia Schulz")

    r = client.put(f"/api/maus/sitzung/{code}/fortschritt",
                   json=_fortschritt_body(teil=1, bestanden=[1]),
                   headers=auth(gast_token))
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}

    uebersicht = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert len(uebersicht) == 1
    zeile = uebersicht[0]
    assert zeile["name"] == "Mia S."  # abgekürzt wie in api.display_names.abbreviate_stored
    assert zeile["gast"] is True
    assert zeile["klasse"] is None
    assert zeile["bestanden"] == [1]
    assert set(zeile["stufen"].keys()) == set(TEIL_1_STUFEN)
    assert isinstance(zeile["aktualisiert_am"], str)


def test_student_meldet_fortschritt_mit_klasse(client, db, teacher_token):
    ada = schueler(db, "Ada", "L", klasse="7a")
    code = _sitzung(client, teacher_token)

    # Der teacher_token-Login hinterliess einen Cookie, der die Schueler-Identitaet
    # aus als(ada) sonst schlagen wuerde.
    client.cookies.clear()
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(), headers=als(ada))
    assert r.status_code == 200, r.text

    uebersicht = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert uebersicht[0]["name"] == "Ada L."
    assert uebersicht[0]["klasse"] == "7a"
    assert uebersicht[0]["gast"] is False


def test_zweiter_put_ersetzt_statt_eine_zweite_zeile_anzulegen(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code, name="Max")

    client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(hilfe=False),
               headers=auth(gast_token))
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(hilfe=True, bestanden=[1]),
                   headers=auth(gast_token))
    assert r.status_code == 200, r.text

    uebersicht = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert len(uebersicht) == 1
    assert uebersicht[0]["hilfe"] is True
    assert uebersicht[0]["bestanden"] == [1]


def test_unbekannte_stufe_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)

    body = _fortschritt_body()
    body["stufen"]["fliegen"] = {"punkte": 100, "sterne": 1, "dauer_ms": 100}
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=body, headers=auth(gast_token))
    assert r.status_code == 400


def test_sterne_ausserhalb_0_bis_3_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)

    body = _fortschritt_body()
    body["stufen"]["klick"]["sterne"] = 4
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=body, headers=auth(gast_token))
    assert r.status_code == 422


def test_bestanden_teil_1_ohne_alle_stufen_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)

    body = {"stufen": {"klick": {"punkte": 900, "sterne": 2, "dauer_ms": 1000}},
            "hilfe": False, "bestanden": [1]}
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=body, headers=auth(gast_token))
    assert r.status_code == 400


def test_bestanden_unbekannter_teil_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)

    body = _fortschritt_body(teil=1)
    body["bestanden"] = [3]
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=body, headers=auth(gast_token))
    assert r.status_code == 400


def test_bestanden_teil_1_mit_allen_sechs_stufen_geht_durch(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)

    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(teil=1, bestanden=[1]),
                   headers=auth(gast_token))
    assert r.status_code == 200, r.text

    uebersicht = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert uebersicht[0]["bestanden"] == [1]


def test_geschlossene_sitzung_nimmt_keinen_fortschritt_mehr_an(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)
    assert client.post(f"/api/play/sessions/{code}/close", params={"tool": "simulation"},
                       headers=auth(teacher_token)).status_code == 200

    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(), headers=auth(gast_token))
    assert r.status_code == 403


def test_fortschritt_ueber_ein_anderes_werkzeug_wird_abgelehnt(client, teacher_token):
    abacus_code = _sitzung(client, teacher_token, "abacus")
    token = _gast(client, teacher_token, abacus_code)

    r = client.put(f"/api/maus/sitzung/{abacus_code}/fortschritt", json=_fortschritt_body(), headers=auth(token))
    assert r.status_code == 400


def test_fortschritt_unbekannter_code(client, teacher_token):
    r = client.put("/api/maus/sitzung/NOPECODE/fortschritt", json=_fortschritt_body(),
                   headers=auth(teacher_token))
    assert r.status_code == 404


def test_fortschritt_ohne_ausweis(client, teacher_token):
    code = _sitzung(client, teacher_token)
    client.cookies.clear()
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body())
    assert r.status_code == 401


def test_fortschritt_gesperrtes_werkzeug_fuer_schueler(client, db, teacher_token):
    ada = schueler(db)
    code = _sitzung(client, teacher_token)
    db.add(ToolAvailability(tool_slug="maus", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    client.cookies.clear()
    r = client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(), headers=als(ada))
    assert r.status_code == 403


def test_uebersicht_eigentuemer_darf(client, teacher_token):
    code = _sitzung(client, teacher_token)
    r = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(teacher_token))
    assert r.status_code == 200, r.text


def test_uebersicht_admin_darf(client, teacher_token, admin_token):
    # Zwei Logins hinterliessen zwei Cookies nacheinander; ab hier zaehlt nur
    # noch der explizite Header je Aufruf.
    client.cookies.clear()
    code = _sitzung(client, teacher_token)
    r = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(admin_token))
    assert r.status_code == 200, r.text


def test_uebersicht_andere_lehrkraft_darf_nicht(client, db, teacher_token):
    andere = _zweite_lehrkraft(db)
    code = _sitzung(client, teacher_token)
    client.cookies.clear()
    r = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=als(andere, "teacher"))
    assert r.status_code == 403


def test_uebersicht_schueler_darf_nicht(client, db, teacher_token):
    ada = schueler(db)
    code = _sitzung(client, teacher_token)
    client.cookies.clear()
    r = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=als(ada))
    assert r.status_code == 403


def test_uebersicht_anonym_darf_nicht(client, teacher_token):
    code = _sitzung(client, teacher_token)
    client.cookies.clear()
    r = client.get(f"/api/maus/sitzung/{code}/uebersicht")
    assert r.status_code == 401


def test_uebersicht_ist_nach_namen_sortiert(client, teacher_token):
    code = _sitzung(client, teacher_token)
    for name in ["Zoe", "anna", "Mona"]:
        gast_token = _gast(client, teacher_token, code, name=name)
        client.put(f"/api/maus/sitzung/{code}/fortschritt", json=_fortschritt_body(), headers=auth(gast_token))

    uebersicht = client.get(f"/api/maus/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    namen = [z["name"] for z in uebersicht]
    assert namen == sorted(namen, key=str.lower)


# ── C) Abschlussprüfung und Hauspunkte ──────────────────────────────────────

def test_bestehen_von_teil_1_vergibt_hauspunkte_ueber_die_sitzung(client, db, teacher, teacher_token, klass):
    haus = _haus(db, klass, name="Haus Nord")
    ada = _schueler_mit_klasse(db, klass)
    code = _sitzung(client, teacher_token)

    # Der teacher_token-Login hinterliess einen Cookie, der als(ada) sonst schlagen wuerde.
    client.cookies.clear()
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": code},
                    headers=als(ada))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["bestanden"] is True
    assert body["punkte"] == HAUSPUNKTE_JE_TEIL
    assert body["schon_vergeben"] is False
    assert body["haus"] == "Haus Nord"

    tx = db.query(Transaction).one()
    assert tx.class_id == klass.id
    assert tx.points == HAUSPUNKTE_JE_TEIL
    assert "Maus-Führerschein" in (tx.reason or "")
    assert tx.teacher_id == teacher.id  # Ersteller der Maus-Sitzung


def test_zweiter_bestehensversuch_vergibt_keine_zweiten_punkte(client, db, teacher_token, klass):
    _haus(db, klass)
    ada = _schueler_mit_klasse(db, klass)
    code = _sitzung(client, teacher_token)

    # Der teacher_token-Login hinterliess einen Cookie, der als(ada) sonst schlagen wuerde.
    client.cookies.clear()
    client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": code},
                headers=als(ada))
    zweiter_code = _sitzung(client, teacher_token)
    r = client.post("/api/maus/pruefung",
                    json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": zweiter_code},
                    headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["schon_vergeben"] is True
    assert r.json()["punkte"] == 0

    assert db.query(Transaction).count() == 1


def test_teil_2_nach_teil_1_vergibt_erneut_punkte(client, db, teacher_token, klass):
    _haus(db, klass)
    ada = _schueler_mit_klasse(db, klass)
    code = _sitzung(client, teacher_token)

    # Der teacher_token-Login hinterliess einen Cookie, der als(ada) sonst schlagen wuerde.
    client.cookies.clear()
    client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": code},
                headers=als(ada))
    r = client.post("/api/maus/pruefung", json={"teil": 2, "stufen": _stufen(2), "hilfe": False, "code": code},
                    headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["punkte"] == HAUSPUNKTE_JE_TEIL
    assert r.json()["schon_vergeben"] is False

    assert db.query(Transaction).count() == 2


def test_ohne_code_bucht_die_klassenlehrkraft(client, db, klass):
    _haus(db, klass)
    klassenlehrer = _zweite_lehrkraft(db, "Kurt", "Klassenlehrer", klasse_id=klass.id)
    ada = _schueler_mit_klasse(db, klass)
    client.cookies.clear()

    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": None},
                    headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["punkte"] == HAUSPUNKTE_JE_TEIL

    tx = db.query(Transaction).one()
    assert tx.teacher_id == klassenlehrer.id


def test_ohne_code_und_ohne_klassenlehrkraft_bucht_ein_admin(client, db, admin, klass):
    _haus(db, klass)
    ada = _schueler_mit_klasse(db, klass)

    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": None},
                    headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["punkte"] == HAUSPUNKTE_JE_TEIL

    tx = db.query(Transaction).one()
    assert tx.teacher_id == admin.id


def test_schueler_ohne_klasse_bekommt_keine_punkte(client, db):
    ada = schueler(db)  # kein class_id gesetzt
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": None},
                    headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["bestanden"] is True
    assert r.json()["punkte"] == 0
    assert db.query(Transaction).count() == 0


def test_lehrkraft_besteht_ohne_hauspunkte(client, teacher, teacher_token, db):
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": None},
                    headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert r.json()["bestanden"] is True
    assert r.json()["punkte"] == 0
    assert db.query(Transaction).count() == 0


def test_unvollstaendige_stufen_gelten_als_nicht_bestanden(client, db):
    ada = schueler(db)
    unvollstaendig = _stufen(1)
    unvollstaendig["klick"]["punkte"] = 0
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": unvollstaendig, "hilfe": False, "code": None},
                    headers=als(ada))
    assert r.status_code == 400


def test_pruefung_teil_ausserhalb_1_2_wird_abgelehnt(client, db):
    ada = schueler(db)
    r = client.post("/api/maus/pruefung", json={"teil": 3, "stufen": _stufen(1), "hilfe": False, "code": None},
                    headers=als(ada))
    assert r.status_code == 422


def test_pruefung_gast_darf_nicht(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast_token = _gast(client, teacher_token, code)
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": code},
                    headers=auth(gast_token))
    assert r.status_code == 401


def test_pruefung_anonym_darf_nicht(client, db):
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": None})
    assert r.status_code == 401


def test_pruefung_gesperrtes_werkzeug_fuer_schueler(client, db):
    ada = schueler(db)
    db.add(ToolAvailability(tool_slug="maus", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    r = client.post("/api/maus/pruefung", json={"teil": 1, "stufen": _stufen(1), "hilfe": False, "code": None},
                    headers=als(ada))
    assert r.status_code == 403
