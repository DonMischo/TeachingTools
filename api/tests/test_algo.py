"""Algorithmen-Werkstatt: Fortschritt melden (Konto und Gast) über /api/sitzungen, Lehrer-Übersicht."""
from api.auth import create_access_token, hash_password
from api.models import Student
from .conftest import auth


def _sitzung(client, token, tool="algo") -> str:
    return client.post("/api/tool-sessions", json={"tool_slug": tool}, headers=auth(token)).json()["code"]


def _gast(client, token, code, name="Mia") -> str:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    gast = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return gast


def _fortschritt(sterne=2, **kw) -> dict:
    return {"level": {"L1": {"sterne": sterne, "bloecke": 5}}, "fluss": ["f1"], "automat": ["a1"], **kw}


def _melde(client, code, body, **kw):
    """Stand über den gemeinsamen Sitzungsstand melden (api/routers/sitzungen.py)."""
    return client.put(f"/api/sitzungen/{code}/stand", json={"daten": body}, **kw)


def _zeilen(client, code, **kw) -> list[dict]:
    """Übersichtszeilen, ``daten`` flach neben Name/Klasse/Gast."""
    r = client.get(f"/api/sitzungen/{code}/uebersicht", **kw)
    assert r.status_code == 200, r.text
    return [{**{k: z[k] for k in ("name", "klasse", "gast")}, **z["daten"]} for z in r.json()["zeilen"]]


def _schueler(db, name="Ada") -> str:
    s = Student(vorname=name, nachname="Lovelace", klasse="9b", active=True, username=f"{name.lower()}.l",
                password_hash=hash_password("x"))
    db.add(s)
    db.flush()
    return create_access_token({"sub": str(s.id), "type": "student"})


def test_schueler_meldet_und_zweites_put_aktualisiert(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    tok = _schueler(db)
    client.cookies.clear()
    r = _melde(client, code, _fortschritt(1), headers=auth(tok))
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    r = _melde(client, code, _fortschritt(3), headers=auth(tok))
    assert r.status_code == 200
    liste = _zeilen(client, code, headers=auth(teacher_token))
    assert len(liste) == 1
    assert liste[0]["level"]["L1"] == {"sterne": 3, "bloecke": 5}
    assert liste[0]["fluss"] == ["f1"] and liste[0]["automat"] == ["a1"]
    assert liste[0]["gast"] is False and liste[0]["klasse"] == "9b"


def test_gast_meldet(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = _melde(client, code, _fortschritt(), headers=auth(gast))
    assert r.status_code == 200, r.text
    liste = _zeilen(client, code, headers=auth(teacher_token))
    assert len(liste) == 1 and liste[0]["gast"] is True


def test_unbekannter_code_ist_404(client, teacher_token):
    assert _melde(client, "ZZZZZZ", _fortschritt(), headers=auth(teacher_token)).status_code == 404


def test_fremde_lehrkraft_sieht_uebersicht_nicht(client, db, teacher_token):
    from api.models import Teacher
    code = _sitzung(client, teacher_token)
    andere = Teacher(username="fremd", first_name="Frieda", last_name="Fremd", password_hash=hash_password("x"),
                     role="teacher")
    db.add(andere)
    db.flush()
    tok = create_access_token({"sub": str(andere.id), "type": "teacher"})
    client.cookies.clear()
    r = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(tok))
    assert r.status_code == 403


def test_zu_grosse_nutzlast_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    zu_viele_level = {f"L{i}": {"sterne": 1, "bloecke": 1} for i in range(101)}
    assert _melde(client, code, _fortschritt(level=zu_viele_level), headers=auth(gast)).status_code == 400
    assert _melde(client, code, _fortschritt(level={"x" * 11: {"sterne": 1, "bloecke": 1}}), headers=auth(gast)).status_code == 400
    assert _melde(client, code, _fortschritt(fluss=["f"] * 51), headers=auth(gast)).status_code == 400
    assert _melde(client, code, _fortschritt(automat=["a"] * 21), headers=auth(gast)).status_code == 400
    assert _melde(client, code, _fortschritt(automat=["a" * 41]), headers=auth(gast)).status_code == 400


def test_punkte_und_wertung_laufen_durch(client, teacher_token):
    code = _sitzung(client, teacher_token)
    body = _fortschritt(level={"L1": {"sterne": 2, "bloecke": 5, "punkte": 120}},
                        wertung={"duell": {"sterne": 3, "punkte": 450}})
    assert _melde(client, code, body, headers=auth(teacher_token)).status_code == 200
    zeile = _zeilen(client, code, headers=auth(teacher_token))[0]
    assert zeile["level"]["L1"] == {"sterne": 2, "bloecke": 5, "punkte": 120}
    assert zeile["wertung"] == {"duell": {"sterne": 3, "punkte": 450}}


def test_zu_viele_wertungen_und_ohne_wertung(client, teacher_token):
    code = _sitzung(client, teacher_token)
    viele = {f"w{i}": {"sterne": 1, "punkte": 1} for i in range(51)}
    assert _melde(client, code, _fortschritt(wertung=viele), headers=auth(teacher_token)).status_code == 400
    assert _melde(client, code, _fortschritt(), headers=auth(teacher_token)).status_code == 200
    zeile = _zeilen(client, code, headers=auth(teacher_token))[0]
    assert zeile.get("wertung", {}) == {}


def test_geschlossene_sitzung_ist_403(client, db, teacher_token):
    from api.models import ToolSession
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    db.query(ToolSession).filter_by(code=code).update({"status": "closed"})
    db.flush()
    r = _melde(client, code, _fortschritt(), headers=auth(gast))
    assert r.status_code == 403


def test_mein_stand_kommt_zurueck_konto_ueber_sitzungen(client, db, teacher_token):
    from api.models import ToolSession
    eins = _sitzung(client, teacher_token)
    erste = db.query(ToolSession).filter_by(code=eins).first()
    zweite = ToolSession(code="ALGO22", tool_slug="algo", created_by=erste.created_by, status="open")
    db.add(zweite)
    db.flush()
    zwei = zweite.code
    tok = _schueler(db)
    client.cookies.clear()
    _melde(client, eins, _fortschritt(3, fluss=["f1"]), headers=auth(tok))
    _melde(client, zwei, {"level": {"L1": {"sterne": 1, "bloecke": 4}, "L2": {"sterne": 2, "bloecke": 7}}, "fluss": ["f2"], "automat": []},
               headers=auth(tok))
    r = client.get(f"/api/algo/sitzung/{zwei}/mein", headers=auth(tok))
    assert r.status_code == 200, r.text
    mein = r.json()
    assert mein["level"]["L1"] == {"sterne": 3, "bloecke": 4, "punkte": 0}
    assert mein["level"]["L2"]["sterne"] == 2
    assert sorted(mein["fluss"]) == ["f1", "f2"] and mein["automat"] == ["a1"]


def test_mein_stand_gast_nur_eigene_zeile(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia, tom = _gast(client, teacher_token, code, "Mia"), _gast(client, teacher_token, code, "Tom")
    _melde(client, code, _fortschritt(2), headers=auth(mia))
    assert client.get(f"/api/algo/sitzung/{code}/mein", headers=auth(tom)).json()["level"] == {}
    assert client.get(f"/api/algo/sitzung/{code}/mein", headers=auth(mia)).json()["level"]["L1"]["sterne"] == 2
