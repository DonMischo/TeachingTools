"""Algorithmen-Werkstatt: Fortschritt melden (Konto und Gast), Lehrer-Übersicht."""
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
    r = client.put(f"/api/algo/sitzung/{code}/fortschritt", json=_fortschritt(1), headers=auth(tok))
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    r = client.put(f"/api/algo/sitzung/{code}/fortschritt", json=_fortschritt(3), headers=auth(tok))
    assert r.status_code == 200
    liste = client.get(f"/api/algo/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert len(liste) == 1
    assert liste[0]["level"]["L1"] == {"sterne": 3, "bloecke": 5}
    assert liste[0]["fluss"] == ["f1"] and liste[0]["automat"] == ["a1"]
    assert liste[0]["gast"] is False and liste[0]["klasse"] == "9b"


def test_gast_meldet(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = client.put(f"/api/algo/sitzung/{code}/fortschritt", json=_fortschritt(), headers=auth(gast))
    assert r.status_code == 200, r.text
    liste = client.get(f"/api/algo/sitzung/{code}/uebersicht", headers=auth(teacher_token)).json()
    assert len(liste) == 1 and liste[0]["gast"] is True


def test_falsches_werkzeug_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token, tool="leben")
    r = client.put(f"/api/algo/sitzung/{code}/fortschritt", json=_fortschritt(), headers=auth(teacher_token))
    assert r.status_code == 400
    assert client.put("/api/algo/sitzung/ZZZZZZ/fortschritt", json=_fortschritt(), headers=auth(teacher_token)).status_code == 404


def test_fremde_lehrkraft_sieht_uebersicht_nicht(client, db, teacher_token):
    from api.models import Teacher
    code = _sitzung(client, teacher_token)
    andere = Teacher(username="fremd", first_name="Frieda", last_name="Fremd", password_hash=hash_password("x"),
                     role="teacher")
    db.add(andere)
    db.flush()
    tok = create_access_token({"sub": str(andere.id), "type": "teacher"})
    client.cookies.clear()
    r = client.get(f"/api/algo/sitzung/{code}/uebersicht", headers=auth(tok))
    assert r.status_code == 403


def test_zu_grosse_nutzlast_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    url = f"/api/algo/sitzung/{code}/fortschritt"
    zu_viele_level = {f"L{i}": {"sterne": 1, "bloecke": 1} for i in range(101)}
    assert client.put(url, json=_fortschritt(level=zu_viele_level), headers=auth(gast)).status_code == 400
    assert client.put(url, json=_fortschritt(level={"x" * 11: {"sterne": 1, "bloecke": 1}}), headers=auth(gast)).status_code == 400
    assert client.put(url, json=_fortschritt(fluss=["f"] * 51), headers=auth(gast)).status_code == 400
    assert client.put(url, json=_fortschritt(automat=["a"] * 21), headers=auth(gast)).status_code == 400
    assert client.put(url, json=_fortschritt(automat=["a" * 41]), headers=auth(gast)).status_code == 400


def test_geschlossene_sitzung_ist_403(client, db, teacher_token):
    from api.models import ToolSession
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    db.query(ToolSession).filter_by(code=code).update({"status": "closed"})
    db.flush()
    r = client.put(f"/api/algo/sitzung/{code}/fortschritt", json=_fortschritt(), headers=auth(gast))
    assert r.status_code == 403
