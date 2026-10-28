"""Kartentool per Code zum Erkunden: eine Karten-Sitzung ohne Kartensatz gibt
Schüler:innen und Gästen das ganze Kartentool — Gäste aber ohne die eigenen
Ebenen der Lehrkräfte."""
import json

import pytest

from .conftest import auth
from .test_karten import _satz

GEOJSON = json.dumps({"type": "FeatureCollection", "features": [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [11.03, 50.98]}, "properties": {"titel": "Schule"}},
]}).encode()


@pytest.fixture(autouse=True)
def eigener_ordner(tmp_path, monkeypatch):
    """Nie in data/karten/eigene schreiben — dort liegen echte Uploads."""
    monkeypatch.setattr("api.routers.karten.EIGENE", tmp_path)


def _erkunden_code(client, token) -> str:
    r = client.post("/api/tool-sessions", json={"tool_slug": "karten"}, headers=auth(token))
    assert r.status_code == 201, r.text
    assert r.json()["ref_id"] is None
    code = r.json()["code"]
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    return code


def _gast(client, code) -> str:
    client.cookies.clear()
    return client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": "Gast"}).json()["token"]


def test_code_ohne_kartensatz_ist_stabil(client, teacher_token):
    assert _erkunden_code(client, teacher_token) == _erkunden_code(client, teacher_token)


def test_gast_sieht_katalog_ebene_und_suche(client, teacher_token):
    code = _erkunden_code(client, teacher_token)
    gast = _gast(client, code)
    kat = client.get(f"/api/karten/sitzung/{code}/ebenen", headers=auth(gast))
    assert kat.status_code == 200
    assert any(e["id"] == "de-laender" for e in kat.json()["ebenen"])
    r = client.get(f"/api/karten/sitzung/{code}/ebenen/de-laender", headers=auth(gast))
    assert r.status_code == 200 and r.json()["type"] == "FeatureCollection"
    # mit Namen, anders als im Quiz
    assert any(f["properties"].get("name") for f in r.json()["features"])
    treffer = client.get(f"/api/karten/sitzung/{code}/suche", params={"q": "Erfurt"}, headers=auth(gast)).json()
    assert any(t["name"] == "Erfurt" for t in treffer)


def test_gast_bekommt_keine_eigenen_ebenen(client, teacher_token):
    hoch = client.post("/api/karten/eigene", files={"datei": ("orte.geojson", GEOJSON)},
                       data={"titel": "Unsere Orte"}, headers=auth(teacher_token)).json()
    client.put(f"/api/karten/eigene/{hoch['eigen']['id']}", json={"titel": "Unsere Orte", "geteilt": True}, headers=auth(teacher_token))
    code = _erkunden_code(client, teacher_token)
    gast = _gast(client, code)
    kat = client.get(f"/api/karten/sitzung/{code}/ebenen", headers=auth(gast)).json()
    assert not any(e["id"].startswith("eigen-") for e in kat["ebenen"])
    assert client.get(f"/api/karten/sitzung/{code}/ebenen/{hoch['id']}", headers=auth(gast)).status_code == 404
    # mit Konto sind sie da
    client.cookies.clear()
    mit_konto = client.get(f"/api/karten/sitzung/{code}/ebenen", headers=auth(teacher_token)).json()
    assert any(e["id"] == hoch["id"] for e in mit_konto["ebenen"])


def test_ohne_gueltigen_zugang_oder_mit_quiz_code_nichts(client, teacher_token):
    code = _erkunden_code(client, teacher_token)
    client.cookies.clear()
    assert client.get(f"/api/karten/sitzung/{code}/ebenen").status_code == 401
    # ein Quiz-Code (mit Kartensatz) öffnet nicht das ganze Kartentool
    satz = client.post("/api/karten/saetze", headers=auth(teacher_token), json=_satz()).json()
    quiz = client.post("/api/tool-sessions", json={"tool_slug": "karten", "ref_id": satz["id"]}, headers=auth(teacher_token)).json()["code"]
    assert quiz != code
    client.cookies.clear()
    assert client.get(f"/api/karten/sitzung/{quiz}/ebenen", headers=auth(teacher_token)).status_code == 404
    gast = _gast(client, code)
    assert client.get(f"/api/karten/sitzung/{quiz}/ebenen", headers=auth(gast)).status_code == 401
