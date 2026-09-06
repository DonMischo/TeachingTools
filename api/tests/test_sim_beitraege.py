"""Die Tafel der KI-Werkstatt: Texte einer Sitzung nebeneinander.

Wichtig sind hier zwei Dinge, die man auf dem Bildschirm nicht sieht: dass ein
Gast-Token nur zu *seiner* Sitzung passt, und dass ein zweiter Durchgang den
eigenen ersten ersetzt statt die Tafel zu fluten.
"""
from api.tests.conftest import auth


def _sitzung(client, token, slug="ki"):
    return client.post("/api/tool-sessions", json={"tool_slug": slug}, headers=auth(token)).json()["code"]


def _gast(client, token, code):
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True},
                 headers=auth(token))
    token = client.post("/api/guest/join",
                        json={"code": code, "tool": "simulation", "name": "Mia"}).json()["token"]
    # Der TestClient traegt sonst weiter den Lehrer-Cookie mit sich herum, und
    # der Gast waere in Wahrheit die Lehrkraft.
    client.cookies.clear()
    return token


def _beitrag(name="Mia", text="Die Katze schläft.", wert=0.4, mut=3, thema="katze"):
    return {"name": name, "text": text, "wert": wert, "mut": mut, "thema": thema,
            "signatur": "AB1-C23"}


def test_lehrkraft_gibt_ab_und_sieht_sich_selbst(client, teacher_token):
    code = _sitzung(client, teacher_token)
    r = client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(),
                    headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    assert r.json()["selbst"] is True

    tafel = client.get(f"/api/tool-sessions/{code}/beitraege", headers=auth(teacher_token))
    assert [b["text"] for b in tafel.json()] == ["Die Katze schläft."]


def test_zweiter_durchgang_ersetzt_den_eigenen_ersten(client, teacher_token):
    code = _sitzung(client, teacher_token)
    client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(text="Erster."),
                headers=auth(teacher_token))
    client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(text="Zweiter."),
                headers=auth(teacher_token))
    tafel = client.get(f"/api/tool-sessions/{code}/beitraege", headers=auth(teacher_token)).json()
    assert [b["text"] for b in tafel] == ["Zweiter."]


def test_gast_gibt_ab_und_alle_sehen_beide(client, teacher_token):
    code = _sitzung(client, teacher_token)
    token = _gast(client, teacher_token, code)

    gast = client.post(f"/api/tool-sessions/{code}/beitraege",
                       json=_beitrag(name="Mia", text="Der Kater gähnt.", wert=0.2),
                       headers=auth(token))
    assert gast.status_code == 201, gast.text
    client.post(f"/api/tool-sessions/{code}/beitraege",
                json=_beitrag(name="Frau L.", text="Die Katze schläft.", wert=0.6),
                headers=auth(teacher_token))

    # Sortiert nach Erwartbarkeit: oben der Text, den die Maschine selbst
    # geschrieben hätte.
    tafel = client.get(f"/api/tool-sessions/{code}/beitraege", headers=auth(token)).json()
    assert [b["name"] for b in tafel] == ["Frau L.", "Mia"]
    assert [b["selbst"] for b in tafel] == [False, True]


def test_gast_token_einer_anderen_sitzung_kommt_nicht_hinein(client, teacher_token):
    fremd = _sitzung(client, teacher_token, "abacus")
    token = _gast(client, teacher_token, fremd)

    code = _sitzung(client, teacher_token)
    r = client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(), headers=auth(token))
    assert r.status_code == 401


def test_ohne_ausweis_geht_gar_nichts(client, teacher_token):
    code = _sitzung(client, teacher_token)
    client.cookies.clear()
    assert client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag()).status_code == 401
    assert client.get(f"/api/tool-sessions/{code}/beitraege").status_code == 401


def test_werkzeuge_ohne_tafel_sammeln_nichts(client, teacher_token):
    code = _sitzung(client, teacher_token, "abacus")
    r = client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(),
                    headers=auth(teacher_token))
    assert r.status_code == 400


def test_leerer_text_wird_abgelehnt(client, teacher_token):
    code = _sitzung(client, teacher_token)
    r = client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(text="   "),
                    headers=auth(teacher_token))
    assert r.status_code == 422


def test_lehrkraft_leert_die_runde(client, teacher_token):
    code = _sitzung(client, teacher_token)
    client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(),
                headers=auth(teacher_token))
    assert client.delete(f"/api/tool-sessions/{code}/beitraege",
                         headers=auth(teacher_token)).status_code == 204
    assert client.get(f"/api/tool-sessions/{code}/beitraege",
                      headers=auth(teacher_token)).json() == []


def test_gast_darf_die_runde_nicht_leeren(client, teacher_token):
    code = _sitzung(client, teacher_token)
    token = _gast(client, teacher_token, code)
    assert client.delete(f"/api/tool-sessions/{code}/beitraege",
                         headers=auth(token)).status_code in (401, 403)


def test_geschlossene_sitzung_nimmt_nichts_mehr_an(client, teacher_token):
    code = _sitzung(client, teacher_token)
    assert client.post(f"/api/play/sessions/{code}/close", params={"tool": "simulation"},
                       headers=auth(teacher_token)).status_code == 200
    r = client.post(f"/api/tool-sessions/{code}/beitraege", json=_beitrag(),
                    headers=auth(teacher_token))
    assert r.status_code == 403
