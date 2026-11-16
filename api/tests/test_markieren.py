"""Bestenliste der Challenge in »Markieren & Bearbeiten«: kleinste Zeit gewinnt,
nur Verbesserungen bleiben stehen, Gäste tragen sich über den Sitzungscode ein,
und »Diese Sitzung« zeigt, wer seine Bestzeit dort erzielt hat.
"""
from api.auth import create_access_token, hash_password
from api.models import Student, Teacher
from .conftest import auth


def schueler(db, vorname="Ada", nachname="Lovelace", klasse="7a") -> Student:
    s = Student(vorname=vorname, nachname=nachname, klasse=klasse, active=True,
                username=f"{vorname}.{nachname}".lower(), password_hash=hash_password("x"))
    db.add(s)
    db.flush()
    return s


def als(user, typ="student") -> dict:
    return auth(create_access_token({"sub": str(user.id), "type": typ}))


def _eintrag(modus="markieren", zeit_ms=40000, aktionen=12) -> dict:
    return {"modus": modus, "zeit_ms": zeit_ms, "aktionen": aktionen}


def _sitzung(client, token, slug="markieren") -> str:
    return client.post("/api/tool-sessions", json={"tool_slug": slug}, headers=auth(token)).json()["code"]


def _gast(client, token, code, name="Mia") -> str:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(token))
    gast_token = client.post("/api/guest/join",
                             json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return gast_token


def test_kleinste_zeit_gewinnt_und_nur_verbesserungen_bleiben(client, db):
    ada, bob = schueler(db), schueler(db, "Bob", "Builder", "7b")
    assert client.post("/api/markieren/bestenliste", json=_eintrag(zeit_ms=50000), headers=als(ada)).status_code == 200
    client.post("/api/markieren/bestenliste", json=_eintrag(zeit_ms=30000), headers=als(ada))
    client.post("/api/markieren/bestenliste", json=_eintrag(zeit_ms=45000), headers=als(ada))
    r = client.post("/api/markieren/bestenliste", json=_eintrag(zeit_ms=35000), headers=als(bob))
    assert r.json()["platz"] == 2

    liste = client.get("/api/markieren/bestenliste?modus=markieren", headers=als(ada)).json()
    assert [(e["name"], e["zeit_ms"], e["selbst"]) for e in liste] == [("Ada L.", 30000, True), ("Bob B.", 35000, False)]
    # Klassenfilter und getrennte Modi
    assert len(client.get("/api/markieren/bestenliste?modus=markieren&klasse=7b", headers=als(ada)).json()) == 1
    assert client.get("/api/markieren/bestenliste?modus=bearbeiten", headers=als(ada)).json() == []


def test_unplausible_zeiten_und_modi_werden_abgelehnt(client, db):
    ada = schueler(db)
    zu_schnell = _eintrag(zeit_ms=10 * 1000 - 1)
    assert client.post("/api/markieren/bestenliste", json=zu_schnell, headers=als(ada)).status_code == 400
    assert client.post("/api/markieren/bestenliste", json=_eintrag("quatsch"), headers=als(ada)).status_code == 400
    assert client.get("/api/markieren/bestenliste?modus=quatsch", headers=als(ada)).status_code == 400


def test_gast_traegt_sich_ueber_den_code_ein(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = client.post(f"/api/markieren/bestenliste/{code}", json=_eintrag(), headers=auth(gast))
    assert r.status_code == 200, r.text
    assert r.json()["gast"] is True and r.json()["name"].startswith("Mia")

    # »Diese Sitzung«: der Gast ja, ein Kind mit Bestzeit außerhalb nicht.
    client.post("/api/markieren/bestenliste", json=_eintrag(zeit_ms=20000), headers=als(schueler(db)))
    sitzung = client.get(f"/api/markieren/bestenliste/{code}?modus=markieren&sitzung={code}", headers=auth(gast)).json()
    assert [e["gast"] for e in sitzung] == [True]
    assert sitzung[0]["selbst"] is True
    alle = client.get(f"/api/markieren/bestenliste/{code}?modus=markieren", headers=auth(gast)).json()
    assert len(alle) == 2


def test_fremde_sitzung_und_ohne_token(client, db, teacher_token):
    code = _sitzung(client, teacher_token, "maus")
    gast = _gast(client, teacher_token, code)
    assert client.post(f"/api/markieren/bestenliste/{code}", json=_eintrag(), headers=auth(gast)).status_code == 400
    assert client.post("/api/markieren/bestenliste", json=_eintrag()).status_code == 401


def test_admin_loescht_eintrag(client, db, teacher_token, admin_token):
    ada = schueler(db)
    # Die Login-Fixtures hinterlassen ein Cookie, das den Bearer-Header schlüge.
    client.cookies.clear()
    eid = client.post("/api/markieren/bestenliste", json=_eintrag(), headers=als(ada)).json()["id"]
    assert client.delete(f"/api/markieren/bestenliste/eintrag/{eid}", headers=als(ada)).status_code in (401, 403)
    client.cookies.clear()
    assert client.delete(f"/api/markieren/bestenliste/eintrag/{eid}", headers=auth(teacher_token)).status_code == 403
    client.cookies.clear()
    assert client.delete(f"/api/markieren/bestenliste/eintrag/{eid}", headers=auth(admin_token)).status_code == 204
    assert client.get("/api/markieren/bestenliste?modus=markieren", headers=als(ada)).json() == []


# --- Fortschritt + Lehrer-Übersicht -----------------------------------------

def _stand(**kw) -> dict:
    body = {"lektionen": ["doppelklick"], "quellen": {"q1": 52000},
            "challenge": {"markieren": {"best_ms": 41000, "runden": 2}},
            "aktuell": "Lektion Doppelklick, Aufgabe 2/3"}
    body.update(kw)
    return body


def test_fortschritt_schueler_und_uebersicht(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    ada = schueler(db)
    client.cookies.clear()
    url = f"/api/markieren/sitzung/{code}/fortschritt"
    assert client.put(url, json=_stand(), headers=als(ada)).json() == {"ok": True}
    assert client.put(url, json=_stand(lektionen=["doppelklick", "drag"], aktuell=None),
                      headers=als(ada)).status_code == 200
    client.cookies.clear()
    zeilen = client.get(f"/api/markieren/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert len(zeilen) == 1
    z = zeilen[0]
    assert z["klasse"] == "7a" and z["gast"] is False
    assert z["lektionen"] == ["doppelklick", "drag"] and z["aktuell"] is None
    assert z["quellen"] == {"q1": 52000}
    assert z["challenge"]["markieren"] == {"best_ms": 41000, "runden": 2}


def test_fortschritt_gast(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = client.put(f"/api/markieren/sitzung/{code}/fortschritt", json=_stand(), headers=auth(gast))
    assert r.status_code == 200
    zeilen = client.get(f"/api/markieren/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert [z["gast"] for z in zeilen] == [True]


def test_uebersicht_fremde_lehrkraft_403(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    andere = Teacher(first_name="Bea", last_name="Berg", active=True,
                     password_hash=hash_password("x"), role="teacher")
    db.add(andere)
    db.flush()
    client.cookies.clear()
    r = client.get(f"/api/markieren/sitzung/{code}/uebersicht", headers=als(andere, "teacher"))
    assert r.status_code == 403


def test_fortschritt_unbekannter_modus_400(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    r = client.put(f"/api/markieren/sitzung/{code}/fortschritt",
                   json=_stand(challenge={"zauber": {"best_ms": 1, "runden": 1}}), headers=als(schueler(db)))
    assert r.status_code == 400


def test_sitzung_je_klasse_hat_eigenen_code(client, db, teacher_token, klass):
    ohne = _sitzung(client, teacher_token)
    mit = client.post("/api/tool-sessions", json={"tool_slug": "markieren", "class_id": klass.id},
                      headers=auth(teacher_token)).json()["code"]
    assert mit != ohne
