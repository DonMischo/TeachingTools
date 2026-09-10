"""Die gemeinsame Schicht aller Live-Werkzeuge: Raum und Warten auf den Socket."""
import asyncio

from api.ws_manager import RoomManager, receive_json


def test_alter_socket_traegt_den_neu_verbundenen_nicht_aus():
    """Das Handy verbindet neu, erst danach meldet sich der alte Socket ab."""
    mgr = RoomManager()
    alt, neu = object(), object()
    mgr.add_student("CODE", 7, alt, info={"name": "Lena"})
    mgr.add_student("CODE", 7, neu, info={"name": "Lena"})

    mgr.remove_student("CODE", 7, alt)
    assert mgr.student_keys("CODE") == {7}
    assert mgr.infos("CODE") == [{"name": "Lena"}]

    mgr.remove_student("CODE", 7, neu)
    assert mgr.student_keys("CODE") == set()
    assert mgr.infos("CODE") == []


def test_receive_json_beendet_die_transaktion_vor_dem_warten():
    reihenfolge = []

    class Db:
        def commit(self):
            reihenfolge.append("commit")

    class Socket:
        async def receive_json(self):
            reihenfolge.append("warten")
            return {"action": "start"}

    assert asyncio.run(receive_json(Socket(), Db())) == {"action": "start"}
    assert reihenfolge == ["commit", "warten"]
