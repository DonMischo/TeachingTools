"""Bestenliste der Schreibübung: eintragen, verbessern, Rangfolge, Grenzen.

Der wichtigste Punkt hier ist die Sortierrichtung: bei der Tastenjagd gewinnt
die *kleinste* Zahl. Eine falsche Richtung fiele sonst erst auf, wenn die
langsamsten Kinder oben auf der Beamerwand stehen.
"""
import pytest

from api.models import Student, TippBestenliste, ToolAvailability
from api.auth import create_access_token, hash_password
from .conftest import auth


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


def _eintrag(modus="lektionen", wert=200.0, **rest) -> dict:
    daten = {"modus": modus, "wert": wert, "anschlaege": 100, "fehler": 2,
             "dauer_ms": 30000, "kontext": "Grundstellung"}
    daten.update(rest)
    return daten


# ── Eintragen ───────────────────────────────────────────────────────────────

def test_eintragen_und_wiederfinden(client, db, teacher_token):
    ada = schueler(db)
    r = client.post("/api/tippen/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json()["platz"] == 1

    liste = client.get("/api/tippen/bestenliste?modus=lektionen", headers=als(ada)).json()
    assert len(liste) == 1
    assert liste[0]["wert"] == 200
    assert liste[0]["selbst"] is True


def test_name_kommt_aus_dem_konto_nicht_aus_dem_browser(client, db):
    ada = schueler(db, "Ada", "Lovelace", "7a")
    # Der Browser schickt gar keinen Namen; er wird abgekürzt aus dem Konto gebildet.
    r = client.post("/api/tippen/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.json()["name"] == "Ada L."
    assert r.json()["klasse"] == "7a"


def test_nur_die_beste_leistung_bleibt_stehen(client, db):
    ada = schueler(db)
    client.post("/api/tippen/bestenliste", json=_eintrag(wert=200), headers=als(ada))
    client.post("/api/tippen/bestenliste", json=_eintrag(wert=260), headers=als(ada))
    client.post("/api/tippen/bestenliste", json=_eintrag(wert=180), headers=als(ada))

    liste = client.get("/api/tippen/bestenliste?modus=lektionen", headers=als(ada)).json()
    assert len(liste) == 1          # eine Zeile je Person
    assert liste[0]["wert"] == 260  # die beste, nicht die letzte


def test_bei_der_tastenjagd_gewinnt_die_kleinere_zahl(client, db):
    ada = schueler(db, "Ada", "L")
    bo = schueler(db, "Bo", "M")
    client.post("/api/tippen/bestenliste", json=_eintrag("tastenjagd", 420), headers=als(ada))
    client.post("/api/tippen/bestenliste", json=_eintrag("tastenjagd", 310), headers=als(bo))

    liste = client.get("/api/tippen/bestenliste?modus=tastenjagd", headers=als(ada)).json()
    assert [e["wert"] for e in liste] == [310, 420]
    assert liste[0]["name"] == "Bo M."

    # Und eine Verbesserung ist hier die kleinere Zahl.
    client.post("/api/tippen/bestenliste", json=_eintrag("tastenjagd", 500), headers=als(bo))
    liste = client.get("/api/tippen/bestenliste?modus=tastenjagd", headers=als(ada)).json()
    assert liste[0]["wert"] == 310


def test_rangfolge_ueber_mehrere_koepfe(client, db):
    namen = [schueler(db, f"Kind{i}", "X") for i in range(3)]
    for i, kind in enumerate(namen):
        client.post("/api/tippen/bestenliste", json=_eintrag(wert=100 + i * 50), headers=als(kind))

    liste = client.get("/api/tippen/bestenliste?modus=lektionen", headers=als(namen[0])).json()
    assert [e["platz"] for e in liste] == [1, 2, 3]
    assert [e["wert"] for e in liste] == [200, 150, 100]
    # »selbst« markiert nur die eigene Zeile.
    assert [e["selbst"] for e in liste] == [False, False, True]


def test_die_modi_haben_getrennte_listen(client, db):
    ada = schueler(db)
    client.post("/api/tippen/bestenliste", json=_eintrag("lektionen", 200), headers=als(ada))
    client.post("/api/tippen/bestenliste", json=_eintrag("wortregen", 90), headers=als(ada))

    assert len(client.get("/api/tippen/bestenliste?modus=lektionen", headers=als(ada)).json()) == 1
    assert len(client.get("/api/tippen/bestenliste?modus=wortregen", headers=als(ada)).json()) == 1


def test_liste_bleibt_bei_hundert(client, db):
    for i in range(105):
        kind = schueler(db, f"K{i}", "X")
        client.post("/api/tippen/bestenliste", json=_eintrag(wert=100 + i), headers=als(kind))

    ada = schueler(db, "Ada", "L")
    liste = client.get("/api/tippen/bestenliste?modus=lektionen", headers=als(ada)).json()
    assert len(liste) == 100
    assert liste[0]["wert"] == 204  # die schnellsten hundert, nicht die ersten hundert


# ── Grenzen ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("modus,wert", [
    ("lektionen", 5000),      # jenseits von Weltklasse
    ("lektionen", 0),
    ("tastenjagd", 5),        # schneller als eine menschliche Reaktion
])
def test_unplausible_werte_werden_abgelehnt(client, db, modus, wert):
    ada = schueler(db)
    r = client.post("/api/tippen/bestenliste", json=_eintrag(modus, wert), headers=als(ada))
    assert r.status_code == 400


def test_mehr_fehler_als_anschlaege_ist_unmoeglich(client, db):
    ada = schueler(db)
    r = client.post("/api/tippen/bestenliste",
                    json=_eintrag(anschlaege=10, fehler=11), headers=als(ada))
    assert r.status_code == 400


def test_unbekannter_modus(client, db):
    ada = schueler(db)
    assert client.post("/api/tippen/bestenliste", json=_eintrag("fliegen"),
                       headers=als(ada)).status_code == 400
    assert client.get("/api/tippen/bestenliste?modus=fliegen",
                      headers=als(ada)).status_code == 400


def test_ohne_anmeldung_geht_nichts(client, db):
    """Gäste tragen sich nicht ein — eine Liste frei gewählter Namen wäre keine."""
    client.cookies.clear()
    assert client.post("/api/tippen/bestenliste", json=_eintrag()).status_code == 401
    assert client.get("/api/tippen/bestenliste?modus=lektionen").status_code == 401


def test_gesperrtes_werkzeug_traegt_nicht_ein(client, db):
    ada = schueler(db)
    db.add(ToolAvailability(tool_slug="tippen", capability="use", audience="student",
                            class_id=None, allowed=False))
    db.flush()
    r = client.post("/api/tippen/bestenliste", json=_eintrag(), headers=als(ada))
    assert r.status_code == 403


def test_lehrkraft_darf_auch(client, db, teacher, teacher_token):
    r = client.post("/api/tippen/bestenliste", json=_eintrag(), headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["name"] == "Anna M."
    assert r.json()["klasse"] is None
    zeile = db.query(TippBestenliste).one()
    assert zeile.teacher_id == teacher.id and zeile.student_id is None


def test_lektionen_nach_wertung_mit_fehlerquote(client, db):
    """Schneller, aber mit vielen Fehlern steht hinter etwas langsamer und sauber."""
    ada, bo = schueler(db, "Ada"), schueler(db, "Bo", "Brecht")
    client.post("/api/tippen/bestenliste", json=_eintrag("lektionen", 220, anschlaege=200, fehler=40), headers=als(ada))
    client.post("/api/tippen/bestenliste", json=_eintrag("lektionen", 200, anschlaege=200, fehler=0), headers=als(bo))
    liste = client.get("/api/tippen/bestenliste?modus=lektionen", headers=als(ada)).json()
    assert [e["wert"] for e in liste] == [200, 220]
    assert liste[1]["wertung"] < liste[0]["wertung"]
