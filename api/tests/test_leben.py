"""»Rock your Life«: Stand melden (Konto und Gast), Lehrer-Übersicht, CSV."""
from api.auth import create_access_token, hash_password
from api.models import Student
from .conftest import auth


def _sitzung(client, token) -> str:
    return client.post("/api/tool-sessions", json={"tool_slug": "leben"}, headers=auth(token)).json()["code"]


def _gast(client, token, code, name="Mia") -> str:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    gast = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return gast


def _stand(spiel_id="abc", neu=None, **z) -> dict:
    return {
        "spiel_id": spiel_id, "figur": "Kim",
        "zusammenfassung": {"datum": "01.09.2026", "konto": 812.5, "job": "Maurer/in", "beduerfnisse": {"hunger": 80}, **z},
        "neu": neu if neu is not None else [{"tag": 3, "stunde": 9.5, "datum": "04.07.2026", "art": "geld", "text": "Einkauf Lidl", "betrag": -23.4}],
    }


def test_gast_meldet_und_lehrkraft_sieht_uebersicht_und_csv(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = client.put(f"/api/leben/sitzung/{code}/stand", json=_stand(), headers=auth(gast))
    assert r.status_code == 200, r.text
    r = client.put(f"/api/leben/sitzung/{code}/stand", json=_stand(neu=[{"tag": 4, "stunde": 8, "art": "arbeit", "text": "zu spät"}]), headers=auth(gast))
    assert r.json()["zeilen"] == 2

    liste = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()["zeilen"]
    assert len(liste) == 1
    assert liste[0]["gast"] is True
    assert liste[0]["daten"]["zusammenfassung"]["konto"] == 812.5
    assert liste[0]["daten"]["protokoll_zeilen"] == 2

    csv = client.get(f"/api/leben/sitzung/{code}/protokoll.csv", headers=auth(teacher_token))
    assert csv.status_code == 200
    assert "Einkauf Lidl" in csv.text
    assert "-23,40" in csv.text


def test_neues_spiel_ersetzt_das_protokoll(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    client.put(f"/api/leben/sitzung/{code}/stand", json=_stand(spiel_id="alt"), headers=auth(gast))
    client.put(f"/api/leben/sitzung/{code}/stand", json=_stand(spiel_id="neu"), headers=auth(gast))
    liste = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()["zeilen"]
    assert liste[0]["daten"]["protokoll_zeilen"] == 1


def test_schueler_mit_konto_und_fremde_lehrkraft(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    ada = Student(vorname="Ada", nachname="Lovelace", klasse="9b", active=True, username="ada.l", password_hash=hash_password("x"))
    db.add(ada)
    db.flush()
    client.cookies.clear()
    r = client.put(f"/api/leben/sitzung/{code}/stand", json=_stand(),
                   headers=auth(create_access_token({"sub": str(ada.id), "type": "student"})))
    assert r.status_code == 200, r.text
    # Schüler:innen sehen die Übersicht nicht
    r = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(create_access_token({"sub": str(ada.id), "type": "student"})))
    assert r.status_code in (401, 403)


def test_zu_viele_zeilen_werden_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    zeilen = [{"tag": 1, "stunde": 1, "art": "geld", "text": "x"}] * 401
    r = client.put(f"/api/leben/sitzung/{code}/stand", json=_stand(neu=zeilen), headers=auth(gast))
    assert r.status_code == 400
