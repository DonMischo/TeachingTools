"""Live-Raum der Verkehrs-Simulation: Beitritt, Taktgeber, Stände, Strafe, Einstellungen."""
import asyncio

import pytest

from api.main import app
from api.auth import create_guest_token
from api.routers import verkehr
from .conftest import auth
from .ws_test_helper import bearer_headers, connect_ws


@pytest.fixture(autouse=True)
def leerer_raum():
    verkehr._raeume.clear()
    verkehr.mgr.clear()
    yield
    verkehr._raeume.clear()
    verkehr.mgr.clear()


def _code(client, teacher_token) -> str:
    r = client.post("/api/tool-sessions", json={"tool_slug": "verkehr"}, headers=auth(teacher_token))
    assert r.status_code in (200, 201), r.text
    return r.json()["code"]


def _scope(code: str, headers, query: bytes = b"") -> dict:
    return {
        "type": "websocket", "path": f"/api/verkehr/{code}/ws", "raw_path": f"/api/verkehr/{code}/ws".encode(),
        "root_path": "", "scheme": "ws", "query_string": query, "headers": headers,
        "client": ("127.0.0.1", 1234), "server": ("127.0.0.1", 8000), "subprotocols": [],
    }


async def bis(ws, typ: str, wo=lambda n: True, max_n: int = 60) -> dict:
    """Nachrichten lesen, bis eine vom gewünschten Typ kommt — dazwischen laufen Stände."""
    for _ in range(max_n):
        n = await ws.receive_json()
        if n.get("typ") == typ and wo(n):
            return n
    raise AssertionError(f"kein {typ}")


def test_lehrkraft_ist_taktgeber_und_sieht_den_gast(client, teacher, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()
    token = create_guest_token(code, "Bo")

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            w = await bis(lk, "willkommen")
            assert w["lehrkraft"] is True
            assert (await bis(lk, "taktgeber"))["key"] == w["du"]
            async with connect_ws(app, _scope(code, [], f"guest_token={token}".encode())) as gast:
                g = await bis(gast, "willkommen")
                assert g["lehrkraft"] is False
                assert (await bis(gast, "taktgeber"))["key"] == w["du"]
                await gast.send_json({"typ": "ich", "x": 12.5, "y": -3, "w": 1})
                stand = await bis(lk, "stand", lambda n: any(s["key"] == g["du"] and s["x"] == 12.5 for s in n["spieler"]))
                bo = next(s for s in stand["spieler"] if s["key"] == g["du"])
                assert bo["name"] == "Bo"

    asyncio.run(lauf())


def test_nur_der_taktgeber_verteilt_den_verkehr(client, teacher, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()
    token = create_guest_token(code, "Bo")

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            await bis(lk, "willkommen")
            async with connect_ws(app, _scope(code, [], f"guest_token={token}".encode())) as gast:
                await bis(gast, "willkommen")
                # Der Gast ist nicht Taktgeber: seine Liste wird verworfen.
                await gast.send_json({"typ": "verkehr", "f": [[99, 0, 0, 0, 0, 0, 0, -1, -1]]})
                await lk.send_json({"typ": "verkehr", "f": [[1, 0, 0, 1, 2, 0, 5, -1, -1]]})
                v = await bis(gast, "verkehr")
                assert v["f"][0][0] == 1

    asyncio.run(lauf())


def test_schimpfen_bringt_die_polizei_und_laesst_sich_abschalten(client, teacher, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()
    token = create_guest_token(code, "Bo")

    async def lauf():
        async with connect_ws(app, _scope(code, bearer_headers(teacher.id, "teacher"))) as lk:
            await bis(lk, "willkommen")
            async with connect_ws(app, _scope(code, [], f"guest_token={token}".encode())) as gast:
                g = await bis(gast, "willkommen")
                await gast.send_json({"typ": "geste", "id": "schimpfen"})
                strafe = await bis(gast, "strafe")
                assert strafe["key"] == g["du"]
                assert strafe["bis"] > strafe["karmaBis"] - verkehr.KARMA

                # Der Gast darf nicht umschalten, die Lehrkraft schon.
                await gast.send_json({"typ": "einstellungen", "beleidigungen": False})
                await lk.send_json({"typ": "einstellungen", "beleidigungen": False})
                e = await bis(gast, "einstellungen")
                assert e["beleidigungen"] is False
                assert verkehr._raeume[code].beleidigungen is False

                verkehr._raeume[code].spieler[g["du"]].strafe_bis = 0
                await gast.send_json({"typ": "geste", "id": "schimpfen"})
                await gast.send_json({"typ": "geste", "id": "laecheln"})
                # Bis zum Lächeln lesen: das erste Schimpfen (vor dem Abschalten) kam an, das zweite nicht.
                gesehen = []
                while not gesehen or gesehen[-1] != "laecheln":
                    gesehen.append((await bis(lk, "geste"))["id"])
                assert gesehen == ["schimpfen", "laecheln"]
                assert verkehr._raeume[code].spieler[g["du"]].strafe_bis == 0

    asyncio.run(lauf())


def test_meldungen_zaehlen_punkte_und_verstoesse(client, teacher, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()
    token = create_guest_token(code, "Bo")

    async def lauf():
        async with connect_ws(app, _scope(code, [], f"guest_token={token}".encode())) as gast:
            g = await bis(gast, "willkommen")
            await gast.send_json({"typ": "meldung", "id": "rot", "punkte": -20})
            await gast.send_json({"typ": "meldung", "id": "gruenGequert", "punkte": 10})
            await gast.send_json({"typ": "meldung", "id": "frisiert", "punkte": 5000})
            stand = await bis(gast, "stand", lambda n: n["spieler"][0]["punkte"] == -10)
            assert stand["spieler"][0]["verstoesse"] == {"rot": 1}
            assert g["du"].startswith("g")

    asyncio.run(lauf())


def test_ohne_zugang_kein_eintritt(client, teacher_token):
    code = _code(client, teacher_token)
    client.cookies.clear()

    async def lauf():
        async with connect_ws(app, _scope(code, [])) as ws:
            await ws.receive_json()

    with pytest.raises(ConnectionError, match="4001"):
        asyncio.run(lauf())


# ── Führerschein ────────────────────────────────────────────────────────────

from api.models import Transaction, VerkehrPruefung  # noqa: E402
from api.tests.test_maus import als  # noqa: E402
from api.tests.test_maus_ausbau import _haus, _schueler_mit_klasse  # noqa: E402

ALLE = sorted(verkehr.PFLICHT["fuss"])


def test_fuehrerschein_vergibt_einmal_hauspunkte(client, db, teacher, teacher_token, klass):
    _haus(db, klass, name="Haus Süd")
    ada = _schueler_mit_klasse(db, klass)
    code = _code(client, teacher_token)
    client.cookies.clear()

    r = client.post("/api/verkehr/pruefung", json={"erledigt": ALLE, "schwere": 1, "code": code}, headers=als(ada))
    assert r.status_code == 200, r.text
    assert r.json() == {"bestanden": True, "punkte": verkehr.HAUSPUNKTE, "schon_vergeben": False, "haus": "Haus Süd"}
    tx = db.query(Transaction).one()
    assert tx.teacher_id == teacher.id and tx.class_id == klass.id and "Fußgänger" in tx.reason

    r = client.post("/api/verkehr/pruefung", json={"erledigt": ALLE, "schwere": 0, "code": code}, headers=als(ada))
    assert r.json()["schon_vergeben"] is True
    assert db.query(Transaction).count() == 1
    assert db.query(VerkehrPruefung).count() == 1


def test_fuehrerschein_braucht_alle_pflichtauftraege(client, db, klass):
    ada = _schueler_mit_klasse(db, klass)
    r = client.post("/api/verkehr/pruefung", json={"erledigt": ALLE[1:], "schwere": 0}, headers=als(ada))
    assert r.status_code == 400


def test_fuehrerschein_zu_viele_schwere_verstoesse(client, db, klass):
    ada = _schueler_mit_klasse(db, klass)
    r = client.post("/api/verkehr/pruefung", json={"erledigt": ALLE, "schwere": verkehr.MAX_SCHWERE + 1}, headers=als(ada))
    assert r.status_code == 400
