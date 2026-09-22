"""Bildpaare fuer »Echt oder KI?«.

Der Test, auf den es ankommt, ist der ueber das Durchsickern: Die Spielansicht
darf nirgends verraten, welches der beiden Bilder echt ist — weder im Feldnamen
noch im Dateinamen. Wer das einmal falsch baut, merkt es nie, weil das Spiel
trotzdem laeuft; nur die Klasse hat dann den Quelltext gelesen.
"""
import io

import pytest

from api.auth import hash_password
from api.models import Teacher
from api.tests.conftest import auth

# Ein winziges gueltiges PNG (1x1, transparent).
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000a49444154789c63000100000500010d0a2db4000000"
    "0049454e44ae426082"
)


@pytest.fixture()
def second_teacher_token(client, db) -> str:
    """Eine zweite Lehrkraft — fuer alles, was fremde Sammlungen angeht."""
    db.add(Teacher(first_name="Bea", last_name="Schmidt", active=True,
                   password_hash=hash_password("geheim"), role="teacher"))
    db.flush()
    r = client.post("/api/auth/login", json={"username": "Bea Schmidt", "password": "geheim"})
    token = r.json()["access_token"]
    client.cookies.clear()
    return token


def _bild(name="foto.png"):
    return (name, io.BytesIO(PNG), "image/png")


def _anlegen(client, token, titel="Katze", hinweis="Sieh dir die Pfoten an."):
    return client.post(
        "/api/bildpaare",
        files={"echt": _bild("echt.png"), "ki": _bild("ki.png")},
        data={"titel": titel, "hinweis": hinweis},
        headers=auth(token),
    )


def _sitzung(client, token):
    return client.post("/api/tool-sessions", json={"tool_slug": "ki"},
                       headers=auth(token)).json()["code"]


def _gast(client, token, code):
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(token))
    gast = client.post("/api/guest/join",
                       json={"code": code, "tool": "simulation", "name": "Mia"}).json()["token"]
    # Sonst traegt der TestClient weiter den Lehrer-Cookie mit sich herum.
    client.cookies.clear()
    return gast


def test_lehrkraft_legt_ein_paar_an(client, teacher_token):
    r = _anlegen(client, teacher_token)
    assert r.status_code == 201, r.text
    paar = r.json()
    assert paar["titel"] == "Katze"
    # Die Dateinamen verraten die Rolle nicht.
    assert "echt" not in paar["echt_url"].rsplit("/", 1)[-1]
    assert "ki" not in paar["ki_url"].rsplit("/", 1)[-1]
    assert paar["echt_url"] != paar["ki_url"]


def test_sammlung_zeigt_nur_die_eigenen_paare(client, teacher_token, second_teacher_token):
    _anlegen(client, teacher_token, titel="Meins")
    _anlegen(client, second_teacher_token, titel="Fremd")
    meine = client.get("/api/bildpaare", headers=auth(teacher_token)).json()
    assert [p["titel"] for p in meine] == ["Meins"]


def test_spielansicht_verraet_die_antwort_nicht(client, teacher_token):
    _anlegen(client, teacher_token)
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)

    paare = client.get("/api/bildpaare/spiel", params={"code": code}, headers=auth(gast)).json()
    assert len(paare) == 1
    paar = paare[0]
    # Nur a und b, kein Hinweis auf echt/ki und kein Loesungsfeld.
    assert set(paar) == {"id", "titel", "a_url", "b_url"}
    assert "hinweis" not in paar


def test_aufloesung_passt_zur_spielansicht(client, teacher_token):
    angelegt = _anlegen(client, teacher_token).json()
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)

    paar = client.get("/api/bildpaare/spiel", params={"code": code}, headers=auth(gast)).json()[0]
    loesung = client.get(f"/api/bildpaare/{paar['id']}/aufloesung", params={"code": code},
                         headers=auth(gast)).json()
    # Die genannte Seite muss wirklich das echte Bild zeigen.
    gemeint = paar["a_url"] if loesung["echt"] == "a" else paar["b_url"]
    assert gemeint == angelegt["echt_url"]
    assert loesung["hinweis"] == "Sieh dir die Pfoten an."


def test_gast_ohne_code_kommt_nicht_an_die_paare(client, teacher_token):
    _anlegen(client, teacher_token)
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    # Ein anderer Code — der Token gilt nur fuer seinen eigenen.
    r = client.get("/api/bildpaare/spiel", params={"code": "XXXX"}, headers=auth(gast))
    assert r.status_code in (401, 403, 404)
    assert client.get("/api/bildpaare/spiel", params={"code": code}).status_code == 401


def test_fremdes_paar_laesst_sich_nicht_aufloesen(client, teacher_token, second_teacher_token):
    fremd = _anlegen(client, second_teacher_token).json()
    code = _sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = client.get(f"/api/bildpaare/{fremd['id']}/aufloesung", params={"code": code},
                   headers=auth(gast))
    assert r.status_code == 404


def test_nur_bilder_werden_angenommen(client, teacher_token):
    r = client.post(
        "/api/bildpaare",
        files={"echt": ("text.txt", io.BytesIO(b"kein Bild"), "text/plain"),
               "ki": _bild()},
        headers=auth(teacher_token),
    )
    assert r.status_code == 400


def test_svg_wird_abgelehnt(client, teacher_token):
    r = client.post(
        "/api/bildpaare",
        files={"echt": ("bild.svg", io.BytesIO(b"<svg/>"), "image/svg+xml"), "ki": _bild()},
        headers=auth(teacher_token),
    )
    assert r.status_code == 400


def test_loeschen_nur_durch_die_eigene_lehrkraft(client, teacher_token, second_teacher_token):
    paar = _anlegen(client, teacher_token).json()
    assert client.delete(f"/api/bildpaare/{paar['id']}",
                         headers=auth(second_teacher_token)).status_code == 403
    assert client.delete(f"/api/bildpaare/{paar['id']}",
                         headers=auth(teacher_token)).status_code == 204
    assert client.get("/api/bildpaare", headers=auth(teacher_token)).json() == []
