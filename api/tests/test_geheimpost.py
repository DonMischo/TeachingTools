"""Geheimpost in der Simulation »stellenwert«: nur an Anwesende derselben
Sitzung, Inhalt erst nach dem Annehmen, höchstens eine Botschaft alle 3 Minuten."""
from datetime import timedelta

import pytest

from api.routers import geheimpost
from api.tests.conftest import auth

HI_HEX = "48 69"


@pytest.fixture(autouse=True)
def leerer_raum():
    geheimpost._anwesend.clear()
    yield
    geheimpost._anwesend.clear()


def _sitzung(client, teacher_token, slug="stellenwert") -> str:
    code = client.post("/api/tool-sessions", json={"tool_slug": slug}, headers=auth(teacher_token)).json()["code"]
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(teacher_token))
    return code


def _gast(client, code, name) -> str:
    client.cookies.clear()
    return client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]


def _stand(client, code, token):
    client.cookies.clear()
    r = client.get(f"/api/tool-sessions/{code}/geheimpost", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _senden(client, code, token, an, inhalt=HI_HEX, basis=16):
    client.cookies.clear()
    return client.post(f"/api/tool-sessions/{code}/geheimpost",
                       json={"an": an, "inhalt": inhalt, "basis": basis}, headers=auth(token))


def test_anwesende_sehen_sich_gegenseitig(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia, ben = _gast(client, code, "Mia"), _gast(client, code, "Ben")
    _stand(client, code, mia)
    stand = _stand(client, code, ben)
    assert [p["name"] for p in stand["anwesend"]] == ["Mia"]
    assert stand["ich"]["name"] == "Ben"


def test_senden_annehmen_und_erst_dann_lesen(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia, ben = _gast(client, code, "Mia"), _gast(client, code, "Ben")
    ben_schluessel = _stand(client, code, ben)["ich"]["schluessel"]
    _stand(client, code, mia)

    r = _senden(client, code, mia, ben_schluessel)
    assert r.status_code == 201, r.text
    assert r.json()["inhalt"] == HI_HEX  # der Absender sieht seinen Code

    eingang = _stand(client, code, ben)["eingang"]
    assert len(eingang) == 1
    assert eingang[0]["von_name"] == "Mia"
    assert eingang[0]["inhalt"] is None  # vor dem Annehmen verborgen

    client.cookies.clear()
    r = client.post(f"/api/tool-sessions/{code}/geheimpost/{eingang[0]['id']}/antwort",
                    json={"annehmen": True}, headers=auth(ben))
    assert r.status_code == 200
    assert r.json()["inhalt"] == HI_HEX
    assert _stand(client, code, ben)["eingang"] == []
    assert _stand(client, code, mia)["gesendet"][0]["status"] == "angenommen"

    # nur einmal beantworten
    client.cookies.clear()
    again = client.post(f"/api/tool-sessions/{code}/geheimpost/{eingang[0]['id']}/antwort",
                        json={"annehmen": False}, headers=auth(ben))
    assert again.status_code == 409


def test_ablehnen_haelt_den_inhalt_verborgen_und_fremde_duerfen_nicht_antworten(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia, ben, ida = _gast(client, code, "Mia"), _gast(client, code, "Ben"), _gast(client, code, "Ida")
    ben_schluessel = _stand(client, code, ben)["ich"]["schluessel"]
    _stand(client, code, mia)
    post_id = _senden(client, code, mia, ben_schluessel).json()["id"]

    client.cookies.clear()
    fremd = client.post(f"/api/tool-sessions/{code}/geheimpost/{post_id}/antwort",
                        json={"annehmen": True}, headers=auth(ida))
    assert fremd.status_code == 404

    client.cookies.clear()
    r = client.post(f"/api/tool-sessions/{code}/geheimpost/{post_id}/antwort",
                    json={"annehmen": False}, headers=auth(ben))
    assert r.json()["status"] == "abgelehnt" and r.json()["inhalt"] is None


def test_nur_an_anwesende(client, teacher_token, monkeypatch):
    code = _sitzung(client, teacher_token)
    mia, ben = _gast(client, code, "Mia"), _gast(client, code, "Ben")
    ben_schluessel = _stand(client, code, ben)["ich"]["schluessel"]
    _stand(client, code, mia)
    assert _senden(client, code, mia, "g:niemand").status_code == 404

    # Ben meldet sich nicht mehr: nach ANWESEND ist er aus der Liste
    jetzt = geheimpost._jetzt()
    monkeypatch.setattr(geheimpost, "_jetzt", lambda: jetzt + geheimpost.ANWESEND + timedelta(seconds=1))
    assert _senden(client, code, mia, ben_schluessel).status_code == 404


def test_drei_minuten_sperre(client, teacher_token, monkeypatch):
    code = _sitzung(client, teacher_token)
    mia, ben = _gast(client, code, "Mia"), _gast(client, code, "Ben")
    ben_schluessel = _stand(client, code, ben)["ich"]["schluessel"]
    _stand(client, code, mia)
    assert _senden(client, code, mia, ben_schluessel).status_code == 201

    zweiter = _senden(client, code, mia, ben_schluessel)
    assert zweiter.status_code == 429
    assert 170 <= _stand(client, code, mia)["sperre_sekunden"] <= 180

    jetzt = geheimpost._jetzt()
    monkeypatch.setattr(geheimpost, "_jetzt", lambda: jetzt + timedelta(minutes=3, seconds=1))
    _stand(client, code, ben)  # Ben meldet sich zur neuen Zeit wieder
    assert _stand(client, code, mia)["sperre_sekunden"] == 0
    assert _senden(client, code, mia, ben_schluessel).status_code == 201


@pytest.mark.parametrize("inhalt,basis", [
    ("48 6G", 16),       # keine Hex-Ziffer
    ("102", 2),          # keine Bits
    ("07", 16),          # Steuerzeichen, steht nicht in der Tafel
    ("41 " * 61, 16),    # zu lang
    ("", 16),
])
def test_ungueltiger_code_wird_abgewiesen(client, teacher_token, inhalt, basis):
    code = _sitzung(client, teacher_token)
    mia, ben = _gast(client, code, "Mia"), _gast(client, code, "Ben")
    ben_schluessel = _stand(client, code, ben)["ich"]["schluessel"]
    _stand(client, code, mia)
    assert _senden(client, code, mia, ben_schluessel, inhalt, basis).status_code == 422


def test_nur_in_den_stellenwerttafeln(client, teacher_token):
    code = _sitzung(client, teacher_token, slug="prozent")
    client.cookies.clear()
    assert client.get(f"/api/tool-sessions/{code}/geheimpost", headers=auth(teacher_token)).status_code == 400
