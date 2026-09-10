"""Barometer live: Gaeste ueber den QR bekommen jede Frage.

WS connections are driven through ws_test_helper so every handler shares one
event loop and cross-socket broadcasts really happen.
"""
import asyncio

import pytest

from api.auth import create_guest_token
from api.main import app
from api.models import BarometerQuestion, BarometerSession
import api.routers.barometer as baro
from api.tests.ws_test_helper import bearer_headers, connect_ws

CODE = "BARO01"


@pytest.fixture(autouse=True)
def clear_ws_state():
    baro.mgr.clear()
    yield
    baro.mgr.clear()


@pytest.fixture()
def umfrage(db, teacher) -> BarometerSession:
    s = BarometerSession(code=CODE, title="Stimmung", created_by=teacher.id, allow_guests=True)
    db.add(s)
    db.flush()
    db.add(BarometerQuestion(session_id=s.id, order=0, text="Wie geht es dir?"))
    db.flush()
    return s


def _scope(query: str, headers=None, code: str = CODE) -> dict:
    path = f"/api/barometer/{code}/ws"
    return {
        "type": "websocket",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": query.encode(),
        "headers": headers or [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


def _gast(name: str) -> dict:
    return _scope(f"role=student&guest_token={create_guest_token(CODE, name)}")


def test_jeder_gast_bekommt_die_frage(client, teacher, umfrage):
    """Gaeste haben keine student_id. Unter dem gemeinsamen Platz 0 verdraengte
    jeder neue Gast den vorigen im Raum — die Frage kam nur beim zuletzt
    verbundenen an, alle anderen sahen weiter die Lobby."""
    async def run():
        async with connect_ws(app, _scope("role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast("Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                async with connect_ws(app, _gast("Ben")) as ben:
                    await ben.receive_json()  # state
                    assert await host.receive_json() == {"event": "participant_joined", "count": 2}

                    await host.send_json({"action": "show_question", "index": 0})
                    for gast in (ada, ben):
                        msg = await asyncio.wait_for(gast.receive_json(), timeout=2)
                        assert msg["event"] == "question"
    asyncio.run(run())


def test_unbekannter_code_kommt_als_4004_im_browser_an(client, teacher):
    async def run():
        async with connect_ws(app, _scope("role=teacher", bearer_headers(teacher.id), code="NOPE99")) as ws:
            with pytest.raises(ConnectionError, match="4004"):
                await ws.receive_json()
    asyncio.run(run())
