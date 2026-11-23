"""Wettschreiben — das Tipp-Rennen: anlegen, beitreten, live tippen, Ergebnis.

Der laufende Stand liegt im Speicher (`_stand`), nur das Ziel-Ergebnis geht in
die Datenbank. Beides wird hier geprüft — sonst fiele erst im Unterricht auf,
dass die Rangliste nach dem Rennen leer ist.
"""
import asyncio

import pytest

from api.main import app
from api.auth import create_guest_token
from api.models import ToolAvailability, WettschreibenSession
from api.routers import wettschreiben
from .conftest import auth
from .ws_test_helper import bearer_headers, connect_ws

TEXT = "die zeit ist um"


@pytest.fixture(autouse=True)
def sauberer_stand():
    """Der Zwischenstand ist Modulzustand — zwischen Tests aufräumen."""
    wettschreiben._stand.clear()
    wettschreiben.mgr.clear()
    yield
    wettschreiben._stand.clear()
    wettschreiben.mgr.clear()


def _rennen(client, token, text=TEXT):
    r = client.post("/api/wettschreiben", json={"title": "Runde 1", "text": text},
                    headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


def gast(token: str) -> dict:
    """Ein Gast ist sein Token: jeder neue Token ist eine neue Person. Im Browser
    liegt er in localStorage und überlebt das Neuladen — hier also einen Token je
    Person anlegen und überall wiederverwenden."""
    return {"Authorization": f"Bearer {token}"}


def spieler_query(tid: int, token: str) -> bytes:
    """Der Gast-Token reist beim WebSocket in der Query — JS kann bei einer
    WS-Verbindung keine Header setzen, der Browser macht es also genauso."""
    return f"role=student&teilnehmer_id={tid}&guest_token={token}".encode()


def _scope(code: str, headers, query: bytes = b"") -> dict:
    # root_path gehört dazu — ohne den Schlüssel bricht Starlette beim Routing ab,
    # der WS-Helfer schluckt die Ausnahme und der Test wartet ewig.
    return {
        "type": "websocket",
        "path": f"/api/wettschreiben/{code}/ws",
        "raw_path": f"/api/wettschreiben/{code}/ws".encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": query,
        "headers": headers,
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


# ── Anlegen ─────────────────────────────────────────────────────────────────

def test_rennen_anlegen(client, teacher_token):
    r = _rennen(client, teacher_token)
    assert r["status"] == "lobby"
    assert r["text"] == TEXT
    assert r["teilnehmer"] == []
    assert len(r["code"]) == 6


def test_tottasten_im_renntext_werden_abgelehnt(client, teacher_token):
    r = client.post("/api/wettschreiben", json={"title": "X", "text": "a^b"},
                    headers=auth(teacher_token))
    assert r.status_code == 400
    assert "Tottasten" in r.json()["detail"]


def test_altgr_zeichen_im_renntext_werden_abgelehnt(client, teacher_token):
    r = client.post("/api/wettschreiben", json={"title": "X", "text": "3 € pro Heft"},
                    headers=auth(teacher_token))
    assert r.status_code == 400
    assert "AltGr" in r.json()["detail"]


def test_hosten_folgt_der_freigabe(client, db, teacher, teacher_token):
    db.add(ToolAvailability(tool_slug="tippen", capability="host", audience="teacher",
                            class_id=None, allowed=False))
    db.flush()
    r = client.post("/api/wettschreiben", json={"title": "X", "text": TEXT},
                    headers=auth(teacher_token))
    assert r.status_code == 403


# ── Beitreten ───────────────────────────────────────────────────────────────

def test_gast_tritt_bei_und_bleibt_derselbe(client, db, teacher, teacher_token):
    code = _rennen(client, teacher_token)["code"]
    client.cookies.clear()  # sonst schlägt der Lehrer-Cookie den Gast-Token

    token = create_guest_token(code, "Bo")
    erst = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"}, headers=gast(token))
    assert erst.status_code == 200, erst.text

    # Neu geladene Seite: derselbe Token, derselbe Platz, kein zweiter Teilnehmer.
    wieder = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"}, headers=gast(token))
    assert wieder.json()["teilnehmer_id"] == erst.json()["teilnehmer_id"]

    s = db.query(WettschreibenSession).filter_by(code=code).first()
    assert len(s.teilnehmer) == 1


def test_gelaufenes_rennen_nimmt_niemanden_mehr_auf(client, db, teacher, teacher_token):
    code = _rennen(client, teacher_token)["code"]
    client.post(f"/api/wettschreiben/{code}/ende", headers=auth(teacher_token))
    client.cookies.clear()
    r = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"},
                    headers=gast(create_guest_token(code, "Bo")))
    assert r.status_code == 409


# ── Steuerung ───────────────────────────────────────────────────────────────

def test_nur_der_besitzer_startet(client, db, teacher_token, admin_token):
    code = _rennen(client, teacher_token)["code"]
    # Der Admin darf (er darf überall), ein Rennen startet aber nur einmal.
    assert client.post(f"/api/wettschreiben/{code}/start", headers=auth(admin_token)).status_code == 200
    assert client.post(f"/api/wettschreiben/{code}/start", headers=auth(admin_token)).status_code == 409


def test_start_setzt_den_status(client, teacher_token):
    code = _rennen(client, teacher_token)["code"]
    r = client.post(f"/api/wettschreiben/{code}/start", headers=auth(teacher_token))
    assert r.json()["status"] == "laeuft"


def test_ende_schreibt_den_zwischenstand_fest(client, db, teacher, teacher_token):
    code = _rennen(client, teacher_token)["code"]
    client.cookies.clear()
    tid = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"},
                      headers=gast(create_guest_token(code, "Bo"))).json()["teilnehmer_id"]

    # Stand, wie ihn der WebSocket hinterlassen hätte.
    wettschreiben._stand[code][tid] = {
        "name": "Bo", "pos": 7, "anschlaege": 9, "fehler": 2, "dauer_ms": None,
    }

    r = client.post(f"/api/wettschreiben/{code}/ende", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["status"] == "fertig"

    s = db.query(WettschreibenSession).filter_by(code=code).first()
    assert (s.teilnehmer[0].pos, s.teilnehmer[0].fehler) == (7, 2)


# ── Live ────────────────────────────────────────────────────────────────────

class TestLive:
    def test_fortschritt_erreicht_den_host(self, client, db, teacher, teacher_token):
        code = _rennen(client, teacher_token)["code"]
        client.cookies.clear()
        token = create_guest_token(code, "Bo")
        tid = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"},
                          headers=gast(token)).json()["teilnehmer_id"]
        spieler_query_string = spieler_query(tid, token)

        async def lauf():
            async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"),
                                              b"role=teacher")) as host:
                assert (await host.receive_json())["typ"] == "status"
                assert (await host.receive_json())["typ"] == "stand"

                async with connect_ws(app, _scope(code, [], spieler_query_string)) as spieler:
                    await spieler.receive_json()  # status
                    await spieler.receive_json()  # stand
                    await host.receive_json()     # der Beitritt des Spielers

                    await spieler.send_json({"typ": "fortschritt", "pos": 4, "anschlaege": 5, "fehler": 1})

                    stand = await host.receive_json()
                    assert stand["typ"] == "stand"
                    assert stand["teilnehmer"][0]["pos"] == 4
                    assert stand["teilnehmer"][0]["fehler"] == 1
                    assert stand["teilnehmer"][0]["name"] == "Bo"

        asyncio.run(lauf())

    def test_ziel_wird_gespeichert(self, client, db, teacher, teacher_token):
        code = _rennen(client, teacher_token)["code"]
        client.cookies.clear()
        token = create_guest_token(code, "Bo")
        tid = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"},
                          headers=gast(token)).json()["teilnehmer_id"]
        spieler_query_string = spieler_query(tid, token)

        async def lauf():
            async with connect_ws(app, _scope(code, [], spieler_query_string)) as spieler:
                await spieler.receive_json()
                await spieler.receive_json()
                await spieler.send_json({
                    "typ": "fortschritt", "pos": len(TEXT),
                    "anschlaege": len(TEXT) + 2, "fehler": 2, "dauer_ms": 12345,
                })
                await spieler.receive_json()  # Stand nach dem Zieleinlauf

        asyncio.run(lauf())

        s = db.query(WettschreibenSession).filter_by(code=code).first()
        t = s.teilnehmer[0]
        assert (t.pos, t.fehler, t.dauer_ms) == (len(TEXT), 2, 12345)

    def test_fremder_platz_wird_abgewiesen(self, client, db, teacher, teacher_token):
        """Ein Gast darf nicht unter der Teilnehmer-Nummer eines anderen tippen."""
        code = _rennen(client, teacher_token)["code"]
        client.cookies.clear()
        tid = client.post(f"/api/wettschreiben/{code}/join", json={"name": "Bo"},
                          headers=gast(create_guest_token(code, "Bo"))).json()["teilnehmer_id"]
        fremd = spieler_query(tid, create_guest_token(code, "Eve"))

        # Abgewiesen wird nach dem accept(): nur so kommt der Code im Browser an.
        async def lauf():
            async with connect_ws(app, _scope(code, [], fremd)) as ws:
                with pytest.raises(ConnectionError, match="4003"):
                    await ws.receive_json()

        asyncio.run(lauf())

    def test_spieler_kann_sich_nicht_zum_host_erklaeren(self, client, db, teacher, teacher_token):
        code = _rennen(client, teacher_token)["code"]
        client.cookies.clear()
        als_host = f"role=teacher&guest_token={create_guest_token(code, 'Bo')}".encode()

        async def lauf():
            async with connect_ws(app, _scope(code, [], als_host)) as ws:
                with pytest.raises(ConnectionError, match="4003"):
                    await ws.receive_json()

        asyncio.run(lauf())


# ── Wertung und Start-Push ─────────────────────────────────────────────────

def test_wertung_daempft_fehler():
    sauber = wettschreiben.wertung(300, 300, 0, 60000)
    schlampig = wettschreiben.wertung(300, 330, 30, 60000)
    assert sauber == 300.0
    assert schlampig is not None and schlampig < 300 * 0.85
    assert wettschreiben.wertung(10, 10, 0, None) is None


def test_rangliste_nach_wertung_statt_zeit():
    """Schneller im Ziel, aber viele Fehler: landet hinter dem sauberen Läufer."""
    wettschreiben._stand["X"] = {
        1: {"name": "Flink", "pos": 100, "anschlaege": 140, "fehler": 40, "dauer_ms": 20000},
        2: {"name": "Sorgfalt", "pos": 100, "anschlaege": 101, "fehler": 1, "dauer_ms": 24000},
        3: {"name": "Unterwegs", "pos": 50, "anschlaege": 50, "fehler": 0, "dauer_ms": None},
    }
    namen = [d["name"] for d in wettschreiben._rangliste("X")]
    assert namen == ["Sorgfalt", "Flink", "Unterwegs"]


def test_start_wird_vom_server_gesendet(client, teacher_token, monkeypatch):
    """Der Start geht vom Server an alle — auch wenn der Host-Socket gerade fehlt."""
    gesendet = []

    async def merken(code, msg):
        gesendet.append((code, msg))

    monkeypatch.setattr(wettschreiben.mgr, "broadcast", merken)
    code = _rennen(client, teacher_token)["code"]
    assert client.post(f"/api/wettschreiben/{code}/start", headers=auth(teacher_token)).status_code == 200
    assert (code, {"typ": "start"}) in gesendet
    client.post(f"/api/wettschreiben/{code}/ende", headers=auth(teacher_token))
    assert any(m.get("status") == "fertig" for _, m in gesendet)
