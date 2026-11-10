"""Live-Raum »Geschichte der Medien«: Nummern, Nachrichten, Höhlenwand, Raten, Löschen."""
import asyncio

import pytest

from api.main import app
from api.auth import create_guest_token
from api.routers import medien_live
from .conftest import auth
from .ws_test_helper import bearer_headers, connect_ws

BILD = "data:image/png;base64,AAAA"


@pytest.fixture(autouse=True)
def leerer_raum():
    medien_live._raeume.clear()
    yield
    medien_live._raeume.clear()


def _code(client, teacher_token) -> str:
    r = client.post("/api/tool-sessions", json={"tool_slug": "medien"}, headers=auth(teacher_token))
    assert r.status_code in (200, 201), r.text
    return r.json()["code"]


def _scope(code: str, headers, query: bytes = b"") -> dict:
    return {
        "type": "websocket", "path": f"/api/medien/{code}/ws", "raw_path": f"/api/medien/{code}/ws".encode(),
        "root_path": "", "scheme": "ws", "query_string": query, "headers": headers,
        "client": ("127.0.0.1", 1234), "server": ("127.0.0.1", 8000), "subprotocols": [],
    }


def _gast(code: str, name: str) -> dict:
    return _scope(code, [], f"guest_token={create_guest_token(code, name)}".encode())


async def bis(ws, typ: str, wo=lambda n: True, max_n: int = 30) -> dict:
    for _ in range(max_n):
        n = await ws.receive_json()
        if n.get("typ") == typ and wo(n):
            return n
    raise AssertionError(f"kein {typ}")


def test_unbekannter_code_wird_abgewiesen(client):
    async def lauf():
        # reject() nimmt an und schließt sofort mit 4004.
        with pytest.raises(ConnectionError, match="4004"):
            async with connect_ws(app, _scope("ZZZZZZ", [])) as ws:
                await ws.receive_json()

    asyncio.run(lauf())


def test_zwei_sehen_sich_mit_verschiedenen_nummern(client, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()

    async def lauf():
        async with connect_ws(app, _gast(code, "Bo")) as a:
            wa = await bis(a, "willkommen")
            async with connect_ws(app, _gast(code, "Ida")) as b:
                wb = await bis(b, "willkommen")
                assert len(wb["spieler"]) == 2
                assert wa["nummer"] != wb["nummer"]
                for nr in (wa["nummer"], wb["nummer"]):
                    assert len(nr) == 4 and nr.isdigit() and "0" not in nr
                liste = await bis(a, "spieler", lambda n: len(n["spieler"]) == 2)
                assert {s["name"] for s in liste["spieler"]} == {"Bo", "Ida"}

    asyncio.run(lauf())


def test_nachricht_kommt_an_und_fehler_bei_sich_selbst_und_offline(client, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()

    async def lauf():
        async with connect_ws(app, _gast(code, "Bo")) as a:
            wa = await bis(a, "willkommen")
            async with connect_ws(app, _gast(code, "Ida")) as b:
                wb = await bis(b, "willkommen")
                await a.send_json({"typ": "senden", "an": wa["du"], "art": "morse", "inhalt": "x"})
                assert (await bis(a, "fehler"))["grund"] == "offline"
                await a.send_json({"typ": "senden", "an": "gXXX", "art": "morse", "inhalt": "x"})
                assert (await bis(a, "fehler"))["grund"] == "offline"
                await a.send_json({"typ": "senden", "an": wb["du"], "art": "morse", "inhalt": ".-"})
                m = await bis(b, "nachricht")
                assert m["vonNummer"] == wa["nummer"] and m["art"] == "morse" and m["inhalt"] == ".-"
                assert m["von"] == wa["du"] and m["vonName"] == "Bo"
                ack = await bis(a, "gesendet")
                assert ack["id"] == m["id"] and ack["an"] == wb["du"]
                # Zu schnell hintereinander.
                await a.send_json({"typ": "senden", "an": wb["du"], "art": "sms", "inhalt": "hi"})
                assert (await bis(a, "fehler"))["grund"] == "zu_schnell"

    asyncio.run(lauf())


def test_malen_raten_und_loeschen(client, teacher, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            assert (await bis(lk, "willkommen"))["lehrkraft"] is True
            async with connect_ws(app, _gast(code, "Bo")) as a:
                await bis(a, "willkommen")
                async with connect_ws(app, _gast(code, "Ida")) as b:
                    await bis(b, "willkommen")
                    await a.send_json({"typ": "malen", "bild": BILD, "loesung": "Mammut"})
                    von_a = (await bis(a, "bild"))["bild"]
                    von_b = (await bis(b, "bild"))["bild"]
                    von_l = (await bis(lk, "bild"))["bild"]
                    assert von_a["loesung"] == "Mammut" and von_a["meins"] is True
                    assert von_b["loesung"] is None and von_b["meins"] is False
                    assert von_l["loesung"] == "Mammut"

                    await b.send_json({"typ": "raten", "id": von_b["id"], "text": "mammut"})
                    r = await bis(b, "aufloesung")
                    assert r["richtig"] is True and r["loesung"] == "Mammut"
                    g = await bis(a, "geraten")
                    assert g["name"] == "Ida" and g["richtig"] is True
                    z = await bis(a, "zaehler")
                    assert z["geraten"] == 1 and z["richtig"] == 1

                    await lk.send_json({"typ": "loeschen", "id": von_b["id"]})
                    assert (await bis(b, "weg"))["id"] == von_b["id"]

    asyncio.run(lauf())


def test_taskcrawler_sitzung_oeffnet_eigenen_raum(client, teacher_token, klass):
    """Die Sim an einer TaskCrawler-Station: alle aus demselben Lauf treffen sich im Raum des TaskCrawler-Codes."""
    from .test_exitgame import _upload
    gid = _upload(client, teacher_token).json()["id"]
    s = client.post(f"/api/exitgames/{gid}/sessions", json={"class_id": klass.id}, headers=auth(teacher_token)).json()
    code = s["join_code"]
    client.cookies.clear()

    async def lauf():
        async with connect_ws(app, _gast(code, "Bo")) as a:
            await bis(a, "willkommen")
            async with connect_ws(app, _gast(code, "Ida")) as b:
                wb = await bis(b, "willkommen")
                ziel = next(x["key"] for x in wb["spieler"] if x["name"] == "Bo")
                await b.send_json({"typ": "senden", "an": ziel, "art": "sms", "inhalt": {"text": "hdl"}})
                n = await bis(a, "nachricht")
                assert n["vonName"] == "Ida" and n["inhalt"] == {"text": "hdl"}
        assert f"tc:{code}" not in medien_live._raeume  # Raum weg, als alle gingen

    asyncio.run(lauf())
