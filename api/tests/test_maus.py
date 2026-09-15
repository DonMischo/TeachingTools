"""Bestenliste des »Maus-Führerscheins«: eintragen, Rangfolge, Grenzen — und,
anders als bei der Schreibübung, auch Gäste ohne Konto.

Der Unterschied zu ``test_bestenliste.py`` ist genau der Punkt, um den es hier
geht: ein QR-Gast hat kein Konto, an das ein Name hängen könnte, deshalb trägt
er sich über den Sitzungscode ein (wie die Beiträge der KI-Werkstatt,
``test_sim_beitraege.py``) und bekommt seine Zeile über die Gast-Id, nicht
über eine Fremdschlüssel-Beziehung auf ein Konto.

Alle vier Modi sind »mehr ist besser«; die Obergrenze ist eine reine
Plausibilitätsgrenze gegen frisierte Werte aus den Entwicklerwerkzeugen des
Browsers, siehe ``test_bestenliste.py`` für die Begründung.
"""
import pytest

from api.auth import create_access_token, hash_password
from api.models import Student, ToolAvailability
from .conftest import auth

MODI_CAPS = {"klick": 24000, "doppelklick": 13500, "ziehen": 6000, "gesamt": 70000}


def schueler(db, vorname="Ada", nachname="Lovelace", klasse="7a") -> Student:
    s = Student(vorname=vorname, nachname=nachname, klasse=klasse, active=True,
                username=f"{vorname}.{nachname}".lower(), password_hash=hash_password("x"))
    db.add(s)
    db.flush()
    return s


def als(user, typ="student") -> dict:
    """Token direkt prägen — ein Login setzt einen Cookie, der bei mehreren
    Identitäten im selben Test den Bearer-Header schlagen würde."""
    return auth(create_access_token({"sub": str(user.id), "type": typ}))


def _eintrag(modus="klick", wert=100.0, **rest) -> dict:
    daten = {"modus": modus, "wert": wert, "dauer_ms": 500, "kontext": None}
    daten.update(rest)
    return daten


def _sitzung(client, token, slug="maus") -> str:
    return client.post("/api/tool-sessions", json={"tool_slug": slug}, headers=auth(token)).json()["code"]


def _gast(client, token, code, name="Mia") -> str:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(token))
    gast_token = client.post("/api/guest/join",
                             json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    # Der TestClient traegt sonst weiter den Lehrer-Cookie mit sich herum, und
    # der Gast waere in Wahrheit die Lehrkraft.
    client.cookies.clear()
    return gast_token


# ── Eintragen (Konto) ───────────────────────────────────────────────────────

def test_eintragen_und_wiederfinden(client, db, teacher_token):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["platz"] == 1
    assert r.json()["gast"] is False

    liste = client.get("/api/maus/bestenliste?modus=klick", headers=als(ada)).json()
    assert len(liste) == 1
    assert liste[0]["wert"] == 100
    assert liste[0]["selbst"] is True


def test_name_und_klasse_kommen_aus_dem_konto_nicht_aus_dem_browser(client, db):
    ada = schueler(db, "Ada", "Lovelace", "7a")
    # Der Browser schickt gar keinen Namen; er wird abgekürzt aus dem Konto gebildet.
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.json()["name"] == "Ada L."
    assert r.json()["klasse"] == "7a"


def test_nur_die_beste_leistung_bleibt_stehen(client, db):
    ada = schueler(db)
    client.post("/api/maus/bestenliste", json=_eintrag(wert=200), headers=als(ada))
    client.post("/api/maus/bestenliste", json=_eintrag(wert=260), headers=als(ada))
    client.post("/api/maus/bestenliste", json=_eintrag(wert=180), headers=als(ada))

    liste = client.get("/api/maus/bestenliste?modus=klick", headers=als(ada)).json()
    assert len(liste) == 1          # eine Zeile je Person
    assert liste[0]["wert"] == 260  # die beste, nicht die letzte


def test_rangfolge_ueber_mehrere_koepfe(client, db):
    kinder = [schueler(db, f"Kind{i}", "X") for i in range(3)]
    for i, kind in enumerate(kinder):
        client.post("/api/maus/bestenliste", json=_eintrag(wert=100 + i * 50), headers=als(kind))

    liste = client.get("/api/maus/bestenliste?modus=klick", headers=als(kinder[0])).json()
    assert [e["platz"] for e in liste] == [1, 2, 3]
    assert [e["wert"] for e in liste] == [200, 150, 100]
    # »selbst« markiert nur die eigene Zeile.
    assert [e["selbst"] for e in liste] == [False, False, True]


def test_die_modi_haben_getrennte_listen(client, db):
    ada = schueler(db)
    p1 = client.post("/api/maus/bestenliste", json=_eintrag("klick", 100), headers=als(ada))
    p2 = client.post("/api/maus/bestenliste", json=_eintrag("ziehen", 300), headers=als(ada))
    assert p1.status_code == 200, p1.text
    assert p2.status_code == 200, p2.text

    r1 = client.get("/api/maus/bestenliste?modus=klick", headers=als(ada))
    r2 = client.get("/api/maus/bestenliste?modus=ziehen", headers=als(ada))
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert len(r1.json()) == 1
    assert len(r2.json()) == 1


def test_liste_bleibt_bei_hundert(client, db):
    for i in range(105):
        kind = schueler(db, f"K{i}", "X")
        client.post("/api/maus/bestenliste", json=_eintrag(wert=100 + i), headers=als(kind))

    ada = schueler(db, "Ada", "L")
    liste = client.get("/api/maus/bestenliste?modus=klick", headers=als(ada)).json()
    assert len(liste) == 100
    assert liste[0]["wert"] == 204  # die besten hundert, nicht die ersten hundert


def test_lehrkraft_darf_auch(client, db, teacher, teacher_token):
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Anna M."
    assert r.json()["klasse"] is None
    assert r.json()["gast"] is False

    from api.models import MausBestenliste  # existiert erst nach der Implementierung
    zeile = db.query(MausBestenliste).one()
    assert zeile.teacher_id == teacher.id and zeile.student_id is None


# ── Grenzen ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("modus,cap", list(MODI_CAPS.items()))
def test_wert_an_der_obergrenze_ist_gerade_noch_plausibel(client, db, modus, cap):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(modus, cap), headers=als(ada))
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("modus,cap", list(MODI_CAPS.items()))
def test_wert_ueber_der_obergrenze_wird_abgelehnt(client, db, modus, cap):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(modus, cap + 1), headers=als(ada))
    assert r.status_code == 400


@pytest.mark.parametrize("wert", [0, -5])
def test_null_und_negative_werte_werden_abgelehnt(client, db, wert):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag("klick", wert), headers=als(ada))
    assert r.status_code == 400


def test_negative_dauer_wird_abgelehnt(client, db):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(dauer_ms=-1), headers=als(ada))
    assert r.status_code == 422


def test_unbekannter_modus(client, db):
    ada = schueler(db)
    assert client.post("/api/maus/bestenliste", json=_eintrag("fliegen"),
                       headers=als(ada)).status_code == 400
    assert client.get("/api/maus/bestenliste?modus=fliegen",
                      headers=als(ada)).status_code == 400


# ── Zugriff ──────────────────────────────────────────────────────────────────

def test_ohne_anmeldung_geht_nichts(client, db):
    client.cookies.clear()
    assert client.post("/api/maus/bestenliste", json=_eintrag()).status_code == 401
    assert client.get("/api/maus/bestenliste?modus=klick").status_code == 401


def test_gesperrtes_werkzeug_traegt_nicht_ein(client, db):
    ada = schueler(db)
    db.add(ToolAvailability(tool_slug="maus", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.status_code == 403


# ── Gäste über den Sitzungscode ─────────────────────────────────────────────

def test_gast_traegt_ueber_code_ein_und_lehrkraft_sieht_ihn(client, teacher_token):
    code = _sitzung(client, teacher_token)
    token = _gast(client, teacher_token, code, name="Mia Schulz")

    r = client.post(f"/api/maus/bestenliste/{code}", json=_eintrag(), headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["gast"] is True
    assert r.json()["name"] == "Mia S."   # abgekürzt wie in api.display_names.abbreviate_stored
    assert r.json()["klasse"] is None

    eigene = client.get(f"/api/maus/bestenliste/{code}?modus=klick", headers=auth(token)).json()
    assert len(eigene) == 1
    assert eigene[0]["selbst"] is True

    # Dieselbe globale Liste je Modus — die Lehrkraft sieht die Gastzeile,
    # aber sie ist nicht ihre eigene.
    liste = client.get("/api/maus/bestenliste?modus=klick", headers=auth(teacher_token)).json()
    assert len(liste) == 1
    assert liste[0]["gast"] is True
    assert liste[0]["selbst"] is False


def test_zwei_gaeste_gleichen_namens_sind_zwei_zeilen(client, teacher_token):
    code = _sitzung(client, teacher_token)
    erster = _gast(client, teacher_token, code, name="Max")
    zweiter = _gast(client, teacher_token, code, name="Max")

    client.post(f"/api/maus/bestenliste/{code}", json=_eintrag(wert=100), headers=auth(erster))
    client.post(f"/api/maus/bestenliste/{code}", json=_eintrag(wert=200), headers=auth(zweiter))

    liste = client.get(f"/api/maus/bestenliste/{code}?modus=klick", headers=auth(zweiter)).json()
    assert len(liste) == 2
    assert [e["name"] for e in liste] == ["Max", "Max"]


def test_gast_token_einer_anderen_sitzung_kommt_nicht_hinein(client, teacher_token, admin_token):
    # Zwei verschiedene Lehrkräfte -> zwei verschiedene Codes fürs selbe Werkzeug.
    # Die Login-Fixtures hinterlassen einen Cookie, der den Bearer-Header schlägt —
    # ohne Löschen legte dieselbe Person beide Sitzungen an (ein Code für beide).
    client.cookies.clear()
    eigener_code = _sitzung(client, teacher_token)
    fremder_code = _sitzung(client, admin_token)
    assert eigener_code != fremder_code
    fremdes_token = _gast(client, admin_token, fremder_code)

    r = client.post(f"/api/maus/bestenliste/{eigener_code}", json=_eintrag(), headers=auth(fremdes_token))
    assert r.status_code == 401


def test_code_eines_anderen_werkzeugs(client, teacher_token):
    abacus_code = _sitzung(client, teacher_token, "abacus")
    token = _gast(client, teacher_token, abacus_code)

    r = client.post(f"/api/maus/bestenliste/{abacus_code}", json=_eintrag(), headers=auth(token))
    assert r.status_code == 400


def test_unbekannter_code(client, teacher_token):
    r = client.get("/api/maus/bestenliste/NOPECODE?modus=klick", headers=auth(teacher_token))
    assert r.status_code == 404


def test_geschlossene_sitzung_nimmt_nichts_mehr_an(client, teacher_token):
    code = _sitzung(client, teacher_token)
    assert client.post("/api/play/sessions/{}/close".format(code), params={"tool": "simulation"},
                       headers=auth(teacher_token)).status_code == 200
    r = client.post(f"/api/maus/bestenliste/{code}", json=_eintrag(), headers=auth(teacher_token))
    assert r.status_code == 403


def test_ohne_ausweis_geht_ueber_den_code_auch_nichts(client, teacher_token):
    code = _sitzung(client, teacher_token)
    client.cookies.clear()
    assert client.post(f"/api/maus/bestenliste/{code}", json=_eintrag()).status_code == 401
    assert client.get(f"/api/maus/bestenliste/{code}?modus=klick").status_code == 401


def test_gesperrtes_werkzeug_gilt_auch_fuer_ein_konto_ueber_den_code(client, db, teacher_token):
    ada = schueler(db)
    code = _sitzung(client, teacher_token)
    db.add(ToolAvailability(tool_slug="maus", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    # Sonst käme die Anfrage über den Lehrer-Cookie und nicht als Schülerin.
    client.cookies.clear()
    r = client.post(f"/api/maus/bestenliste/{code}", json=_eintrag(), headers=als(ada))
    assert r.status_code == 403


# ── Verwaltung ───────────────────────────────────────────────────────────────

def test_admin_loescht_einen_eintrag(client, teacher_token, admin_token):
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=auth(teacher_token))
    eintrag_id = r.json()["id"]

    d = client.delete(f"/api/maus/bestenliste/eintrag/{eintrag_id}", headers=auth(admin_token))
    assert d.status_code == 204

    liste = client.get("/api/maus/bestenliste?modus=klick", headers=auth(teacher_token)).json()
    assert liste == []


def test_lehrkraft_und_schueler_duerfen_nicht_loeschen(client, db, teacher_token):
    ada = schueler(db)
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=als(ada))
    eintrag_id = r.json()["id"]

    assert client.delete(f"/api/maus/bestenliste/eintrag/{eintrag_id}",
                         headers=auth(teacher_token)).status_code == 403
    assert client.delete(f"/api/maus/bestenliste/eintrag/{eintrag_id}",
                         headers=als(ada)).status_code == 403


def test_anonym_darf_nicht_loeschen(client, teacher_token):
    r = client.post("/api/maus/bestenliste", json=_eintrag(), headers=auth(teacher_token))
    eintrag_id = r.json()["id"]

    client.cookies.clear()
    assert client.delete(f"/api/maus/bestenliste/eintrag/{eintrag_id}").status_code == 401


def test_unbekannte_id_beim_loeschen(client, admin_token):
    r = client.delete("/api/maus/bestenliste/eintrag/999999", headers=auth(admin_token))
    assert r.status_code == 404


# ── Katalog ──────────────────────────────────────────────────────────────────

def test_katalog_und_sitzungswerkzeuge_kennen_maus():
    from api.routers.tool_sessions import SESSION_TOOLS
    from api.tool_catalog import BY_SLUG

    assert BY_SLUG["maus"].surface == "games"
    assert "maus" in SESSION_TOOLS
