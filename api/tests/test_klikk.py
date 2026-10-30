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


def test_klassenfeed_feste_kommentare_und_nur_generierte_namen(client, teacher_token):
    code = _sitzung(client, teacher_token)
    lehrer = auth(teacher_token)
    mia, ben = (_gast(client, teacher_token, code, n) for n in ("Mia", "Ben"))
    url = f"/api/klikk/sitzung/{code}/beitraege"

    # Freitext-Namen und unbekannte Inhalte gehen nicht
    assert client.post(url, json={"name": "Mia Muster", "art": "foto", "tag": 0, "motiv": "selfie"}, headers=mia).status_code == 400
    assert client.post(url, json={"name": "blauer.otter.17", "art": "video", "tag": 0, "trend": "quatsch"}, headers=mia).status_code == 400
    r = client.post(url, json={"name": "blauer.otter.17", "art": "video", "tag": 2, "trend": "gleis", "fake": False}, headers=mia)
    assert r.status_code == 201, r.text
    bid = r.json()["id"]

    # Ben liked und kommentiert – nur aus der Liste
    assert client.post(f"{url}/{bid}/reaktion", json={"name": "rote.ente.4", "kommentar": "du bist doof"}, headers=ben).status_code == 400
    r = client.post(f"{url}/{bid}/reaktion", json={"name": "rote.ente.4", "like": True, "kommentar": "mehr"}, headers=ben).json()
    assert r["likes"] == 1 and r["kommentare"] == [{"name": "rote.ente.4", "kommentar": "Mach's krasser!"}]

    feed = client.get(url, headers=mia).json()
    assert feed[0]["eigener"] is True and feed[0]["likes"] == 1
    assert client.get(url, headers=ben).json()[0]["gelikt"] is True

    # Nachrichten nur von der Lehrkraft, mit Freitext
    assert client.post(url, json={"name": "x", "art": "news", "tag": 1, "schlagzeile": "Hallo"}, headers=mia).status_code == 403
    r = client.post(url, json={"name": "", "art": "news", "tag": 1, "schlagzeile": "Schule fällt aus!", "bild": "weltall:pale-blue-dot", "fake": True}, headers=lehrer)
    assert r.status_code == 201 and r.json()["lehrkraft"] is True

    # Fremde Beiträge löschen darf nur die Lehrkraft
    assert client.delete(f"{url}/{bid}", headers=ben).status_code == 403
    assert client.delete(f"{url}/{bid}", headers=lehrer).status_code == 204


def test_uebersicht_erst_ab_drei_und_nur_summen(client, teacher_token):
    code = _sitzung(client, teacher_token)
    gaeste = [_gast(client, teacher_token, code, n) for n in ("A", "B", "C")]
    url = f"/api/klikk/sitzung/{code}"
    werte = [{"mitgemacht": 2, "geholfen": True, "emma": "weiter"}, {"mitgemacht": 0, "geholfen": False, "emma": "melden"}]
    for g, w in zip(gaeste, werte):
        assert client.put(f"{url}/woche", json={"werte": w}, headers=g).status_code == 200
    assert client.get(f"{url}/uebersicht", headers=auth(teacher_token)).json() == {"anzahl": 2, "werte": {}}
    assert client.get(f"{url}/uebersicht", headers=gaeste[0]).status_code == 403
    client.put(f"{url}/woche", json={"werte": {"mitgemacht": 1, "geholfen": True, "emma": "melden"}}, headers=gaeste[2])
    u = client.get(f"{url}/uebersicht", headers=auth(teacher_token)).json()
    assert u["anzahl"] == 3
    assert u["werte"]["geholfen"] == {"art": "ja", "ja": 2, "von": 3}
    assert u["werte"]["mitgemacht"]["schnitt"] == 1.0
    assert u["werte"]["emma"]["zaehlung"] == {"weiter": 1, "melden": 2}


def test_spiele_bestenliste_mehr_ist_besser(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia = _gast(client, teacher_token, code, "Mia")
    url = f"/api/klikk/spiele/bloecke/{code}"
    assert client.post(url, json={"wert": 300}, headers=mia).json()["platz"] == 1
    client.post(url, json={"wert": 200}, headers=mia)  # schlechter: bleibt 300
    assert client.post(url, json={"wert": 999999}, headers=mia).status_code == 400
    assert client.post("/api/klikk/spiele/quatsch/" + code, json={"wert": 1}, headers=mia).status_code == 400
    liste = client.get(url, headers=mia).json()
    assert [(e["wert"], e["gast"], e["selbst"]) for e in liste] == [(300, True, True)]


def test_spiel_teilen_und_geruchs_kommentar_nur_bei_niedriger_hygiene(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia, ben = (_gast(client, teacher_token, code, n) for n in ("Mia", "Ben"))
    url = f"/api/klikk/sitzung/{code}/beitraege"
    r = client.post(url, json={"name": "blauer.otter.17", "art": "spiel", "tag": 0, "spiel": "sprung", "punkte": 812, "hygiene": 20}, headers=mia)
    assert r.status_code == 201 and r.json()["inhalt"] == {"spiel": "sprung", "punkte": 812, "hygiene": 20}
    sauber = client.post(url, json={"name": "blauer.otter.17", "art": "foto", "tag": 0, "motiv": "selfie", "hygiene": 90}, headers=mia).json()
    assert client.post(f"{url}/{r.json()['id']}/reaktion", json={"name": "rote.ente.4", "kommentar": "stinkt"}, headers=ben).status_code == 200
    assert client.post(f"{url}/{sauber['id']}/reaktion", json={"name": "rote.ente.4", "kommentar": "stinkt"}, headers=ben).status_code == 400
    assert client.post(url, json={"name": "blauer.otter.17", "art": "spiel", "tag": 0, "spiel": "quatsch", "punkte": 1}, headers=mia).status_code == 400


def test_klassen_uhr_start_pause_weiter_stopp(client, teacher_token):
    code = _sitzung(client, teacher_token)
    mia = _gast(client, teacher_token, code, "Mia")
    url = f"/api/klikk/sitzung/{code}/uhr"
    assert client.get(url, headers=mia).json()["laeuft"] is False
    assert client.post(url, json={"aktion": "start"}, headers=mia).status_code == 403
    u = client.post(url, json={"aktion": "start", "minuten_pro_tag": 6}, headers=auth(teacher_token)).json()
    assert u["laeuft"] and u["minuten_pro_tag"] == 6 and u["pausiert"] is False
    p = client.post(url, json={"aktion": "pause"}, headers=auth(teacher_token)).json()
    assert p["pausiert"] is True
    w = client.post(url, json={"aktion": "weiter"}, headers=auth(teacher_token)).json()
    assert w["pausiert"] is False and w["start_ms"] >= u["start_ms"]
    assert client.get(url, headers=mia).json()["laeuft"] is True
    assert client.post(url, json={"aktion": "stopp"}, headers=auth(teacher_token)).json()["laeuft"] is False
