"""Werbeauktion zu »Klikk«: Profile kommen anonym an, jeder spielt eine Firma
mit Budget, das eigene Profil ist tabu, nur die Lehrkraft führt die Auktion,
und das höchste bezahlbare Gebot bekommt den Zuschlag.
"""
from .conftest import auth

MERKMALE = [{"titel": "Körperbild", "wert": "vermutlich unzufrieden", "heikel": True},
            {"titel": "Interessen", "wert": "Fitness, Gaming", "heikel": False}]


def _sitzung(client, token) -> str:
    return client.post("/api/tool-sessions", json={"tool_slug": "klikk"}, headers=auth(token)).json()["code"]


def _gast(client, token, code, name) -> dict:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    t = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return auth(t)


def _abgeben(client, code, wer, merkmale=MERKMALE):
    return client.put(f"/api/klikk/sitzung/{code}/profil", json={"merkmale": merkmale}, headers=wer)


def test_ablauf_mit_geboten_budget_und_zuschlag(client, teacher_token):
    code = _sitzung(client, teacher_token)
    lehrer = auth(teacher_token)
    mia, ben, ali = (_gast(client, teacher_token, code, n) for n in ("Mia", "Ben", "Ali"))

    ich = _abgeben(client, code, mia).json()
    assert ich == {"nr": 1, "firma": "SlimFast Pro", "sucht": "Körperbild", "budget": 100}
    assert _abgeben(client, code, ben).json()["nr"] == 2
    assert _abgeben(client, code, ali).json()["nr"] == 3
    # Nochmal abgeben ersetzt, behält die Nummer
    assert _abgeben(client, code, mia, MERKMALE[:1]).json()["nr"] == 1

    # Ohne laufende Runde kein Gebot; Kinder steuern nicht
    assert client.post(f"/api/klikk/sitzung/{code}/gebot", json={"betrag": 5}, headers=ben).status_code == 409
    assert client.post(f"/api/klikk/sitzung/{code}/steuern", json={"aktion": "naechstes"}, headers=mia).status_code == 403

    r = client.post(f"/api/klikk/sitzung/{code}/steuern", json={"aktion": "naechstes"}, headers=lehrer)
    assert r.status_code == 200, r.text
    assert r.json()["aktuell"]["nr"] == 1 and r.json()["lehrkraft"] is True

    # Profil 1 gehört Mia: sie darf nicht bieten
    assert client.post(f"/api/klikk/sitzung/{code}/gebot", json={"betrag": 5}, headers=mia).status_code == 400
    client.post(f"/api/klikk/sitzung/{code}/gebot", json={"betrag": 30}, headers=ben)
    client.post(f"/api/klikk/sitzung/{code}/gebot", json={"betrag": 70}, headers=ali)
    client.post(f"/api/klikk/sitzung/{code}/gebot", json={"betrag": 40}, headers=ben)  # ersetzt 30

    sicht = client.get(f"/api/klikk/sitzung/{code}/auktion", headers=mia).json()
    assert sicht["aktuell"]["eigenes"] is True
    assert sicht["aktuell"]["gebote"] == 2 and sicht["aktuell"]["hoechstes"] is None  # verdeckt
    assert sicht["aktuell"]["merkmale"] == MERKMALE[:1]

    r = client.post(f"/api/klikk/sitzung/{code}/steuern", json={"aktion": "zuschlag"}, headers=lehrer).json()
    assert r["verkauft"][0] | {"merkmale": None} == {
        "nr": 1, "merkmale": None, "preis": 70, "firma": "Sneakr", "gebote": 2, "selbst_gekauft": False, "eigenes": False}
    assert r["aktuell"]["hoechstes"] == 70

    # Ali hat 70 ausgegeben: mehr als 30 geht nicht mehr
    client.post(f"/api/klikk/sitzung/{code}/steuern", json={"aktion": "naechstes"}, headers=lehrer)
    assert client.post(f"/api/klikk/sitzung/{code}/gebot", json={"betrag": 31}, headers=ali).status_code == 400
    ali_sicht = client.get(f"/api/klikk/sitzung/{code}/auktion", headers=ali).json()
    assert ali_sicht["ich"]["budget"] == 30 and ali_sicht["verkauft"][0]["selbst_gekauft"] is True

    # Zuschlag ohne Gebote: Preis 0, keine Firma
    r = client.post(f"/api/klikk/sitzung/{code}/steuern", json={"aktion": "zuschlag"}, headers=lehrer).json()
    assert r["verkauft"][1]["preis"] == 0 and r["verkauft"][1]["firma"] is None

    r = client.post(f"/api/klikk/sitzung/{code}/steuern", json={"aktion": "zuruecksetzen"}, headers=lehrer).json()
    assert r["verkauft"] == [] and r["aktuell"] is None and r["profile"] == 3


def test_falsche_sitzung_und_zu_viele_merkmale(client, teacher_token):
    andere = client.post("/api/tool-sessions", json={"tool_slug": "markieren"}, headers=auth(teacher_token)).json()["code"]
    assert _abgeben(client, andere, auth(teacher_token)).status_code == 400
    code = _sitzung(client, teacher_token)
    assert _abgeben(client, code, auth(teacher_token), MERKMALE * 8).status_code == 422
