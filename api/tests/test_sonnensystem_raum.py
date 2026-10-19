"""Live-Raum des Sonnensystem-Flugs: Beitritt, Stände, Prüfung der Lage."""
import asyncio

import pytest

from api.main import app
from api.auth import create_guest_token
from api.routers import sonnensystem
from .conftest import auth
from .ws_test_helper import bearer_headers, connect_ws


@pytest.fixture(autouse=True)
def leerer_raum():
    sonnensystem._raeume.clear()
    sonnensystem.mgr.clear()
    yield
    sonnensystem._raeume.clear()
    sonnensystem.mgr.clear()


def _code(client, teacher_token, tool="sonnensystem") -> str:
    r = client.post("/api/tool-sessions", json={"tool_slug": tool}, headers=auth(teacher_token))
    assert r.status_code in (200, 201), r.text
    return r.json()["code"]


def _scope(code: str, headers, query: bytes = b"") -> dict:
    pfad = f"/api/sonnensystem/{code}/ws"
    return {
        "type": "websocket", "path": pfad, "raw_path": pfad.encode(),
        "root_path": "", "scheme": "ws", "query_string": query, "headers": headers,
        "client": ("127.0.0.1", 1234), "server": ("127.0.0.1", 8000), "subprotocols": [],
    }


async def bis(ws, typ: str, wo=lambda n: True, max_n: int = 60) -> dict:
    for _ in range(max_n):
        n = await ws.receive_json()
        if n.get("typ") == typ and wo(n):
            return n
    raise AssertionError(f"kein {typ}")


def test_lehrkraft_sieht_das_schiff_des_gasts(client, teacher, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()
    token = create_guest_token(code, "Bo")

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            await bis(lk, "willkommen")
            async with connect_ws(app, _scope(code, [], f"guest_token={token}".encode())) as gast:
                g = await bis(gast, "willkommen")
                await gast.send_json({"typ": "ich", "bei": "mars", "p": [1.5, 2, -3], "q": [0, 0, 0, 1], "v": 4})
                stand = await bis(lk, "stand", lambda n: any(s["key"] == g["du"] and s["bei"] == "mars" for s in n["spieler"]))
                bo = next(s for s in stand["spieler"] if s["key"] == g["du"])
                assert bo["name"] == "Bo"
                assert bo["p"] == [1.5, 2.0, -3.0]
                assert bo["v"] == 4.0

    asyncio.run(lauf())


def test_unsinnige_lage_wird_verworfen(client, teacher, teacher_token):
    code = _code(client, teacher_token)

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            w = await bis(lk, "willkommen")
            for kaputt in (
                {"typ": "ich", "bei": "mars", "p": [1, 2], "q": [0, 0, 0, 1]},
                {"typ": "ich", "bei": "<script>", "p": [1, 2, 3], "q": [0, 0, 0, 1]},
                {"typ": "ich", "bei": "mars", "p": ["x", 2, 3], "q": [0, 0, 0, 1]},
            ):
                await lk.send_json(kaputt)
            await lk.send_json({"typ": "ich", "bei": "venus", "p": [9, 9, 9], "q": [0, 0, 0, 1]})
            stand = await bis(lk, "stand", lambda n: n["spieler"][0]["bei"] == "venus")
            assert stand["spieler"][0]["key"] == w["du"]

    asyncio.run(lauf())


def test_fremde_sitzung_wird_abgewiesen(client, teacher, teacher_token):
    code = _code(client, teacher_token, tool="verkehr")

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            with pytest.raises(ConnectionError, match="4004"):
                await lk.receive_json()

    asyncio.run(lauf())
