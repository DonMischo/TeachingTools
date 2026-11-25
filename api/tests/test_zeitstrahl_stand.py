"""Übungsstand im geteilten Zeitstrahl (``/api/sitzungen/{code}/stand``):
Gäste und Lernende melden ihre Runden, die Lehrkraft sieht sie; kaputte
Zähler oder Ereignisse lehnt ``_pruefe_zeitstrahl`` ab.
"""
import pytest

from .conftest import auth
from .test_markieren import _gast, als, schueler


def _zeitstrahl_sitzung(client, token) -> str:
    events = [{"id": "rom", "label": "Gründung Roms", "value": -753},
              {"id": "rep", "label": "Republik", "value": -509, "end": -27}]
    tl = client.post("/api/timelines", json={"title": "Rom", "axis": {"kind": "year", "min": -800, "max": 600},
                                             "lanes": [], "events": events}, headers=auth(token))
    assert tl.status_code == 201, tl.text
    r = client.post("/api/tool-sessions", json={"tool_slug": "zeitstrahl", "ref_id": tl.json()["id"]},
                    headers=auth(token))
    assert r.status_code in (200, 201), r.text
    return r.json()["code"]


GUT = {"runden": 2, "richtig": 7, "gesamt": 10, "ereignisse": {"rom": True, "rep": False}}


def test_gast_meldet_runden_und_lehrkraft_sieht(client, db, teacher_token):
    code = _zeitstrahl_sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    r = client.put(f"/api/sitzungen/{code}/stand", json={"daten": GUT}, headers=auth(gast))
    assert r.status_code == 200, r.text
    [z] = client.get(f"/api/sitzungen/{code}/uebersicht", headers=auth(teacher_token)).json()["zeilen"]
    assert z["gast"] is True and z["daten"] == GUT


def test_schueler_meldet_runden(client, db, teacher_token):
    code = _zeitstrahl_sitzung(client, teacher_token)
    ada = schueler(db)
    client.cookies.clear()
    assert client.put(f"/api/sitzungen/{code}/stand", json={"daten": GUT}, headers=als(ada)).status_code == 200


@pytest.mark.parametrize("daten", [
    {"runden": -1},
    {"runden": "2"},
    {"runden": True},
    {"richtig": 5, "gesamt": 3},
    {"ereignisse": ["rom"]},
    {"ereignisse": {"rom": 1}},
    {"ereignisse": {"x" * 81: True}},
])
def test_kaputter_stand_400(client, db, teacher_token, daten):
    code = _zeitstrahl_sitzung(client, teacher_token)
    gast = _gast(client, teacher_token, code)
    assert client.put(f"/api/sitzungen/{code}/stand", json={"daten": daten}, headers=auth(gast)).status_code == 400
