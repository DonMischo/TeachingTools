"""Live-Raum des Sonnensystem-Flugs: mehrere Schiffe im selben All.

Jeder Browser fliegt sein Schiff selbst und meldet ~10-mal je Sekunde, wo es
ist — als Versatz zum nächsten Himmelskörper (``bei`` + ``p``), nicht in
absoluten Koordinaten: mit Zeitraffer stehen die Planeten bei jedem woanders,
ein Schiff »neben der Erde« soll aber überall neben der Erde auftauchen.
Der Server sammelt und verteilt nur; Zusammenstöße erkennt jeder Browser selbst.

Nichts davon landet in der Datenbank — der Raum lebt im Speicher und ist mit
dem letzten Spieler weg (wie im Verkehrs-Raum, verkehr.py).
"""
import asyncio
import math
import re
import time
from dataclasses import dataclass, field

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..database import get_db
from ..display_names import short_name
from ..models import Student, Teacher, ToolSession
from ..ws_auth import ws_guest, ws_identity
from ..ws_manager import RoomManager, receive_json, reject

router = APIRouter(prefix="/api/sonnensystem", tags=["sonnensystem"])
mgr = RoomManager()

TAKT = 0.1
# Wer 20 s nichts schickt, ist weg (abgerissene Verbindung, zugeklappter Laptop).
STILL = 20.0
KOERPER_ID = re.compile(r"^[a-z0-9-]{1,24}$")


@dataclass
class Spieler:
    name: str
    lehrkraft: bool
    bei: str = "erde"
    p: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])
    q: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0, 1.0])
    v: float = 0.0
    zuletzt: float = field(default_factory=time.time)


@dataclass
class Raum:
    spieler: dict[str, Spieler] = field(default_factory=dict)
    schleife: asyncio.Task | None = None


_raeume: dict[str, Raum] = {}


def _zahlen(roh, n: int) -> list[float] | None:
    if not isinstance(roh, list) or len(roh) != n:
        return None
    try:
        werte = [float(x) for x in roh]
    except (TypeError, ValueError):
        return None
    return werte if all(math.isfinite(x) for x in werte) else None


def _stand(raum: Raum) -> dict:
    return {
        "typ": "stand",
        "spieler": [
            {"key": k, "name": s.name, "lehrkraft": s.lehrkraft, "bei": s.bei,
             "p": [round(x, 4) for x in s.p], "q": [round(x, 4) for x in s.q], "v": round(s.v, 4)}
            for k, s in raum.spieler.items()
        ],
    }


async def _schleife(code: str) -> None:
    """Verteilt die Stände, solange jemand im Raum ist."""
    while code in _raeume and _raeume[code].spieler:
        raum = _raeume[code]
        jetzt = time.time()
        for k in [k for k, s in raum.spieler.items() if jetzt - s.zuletzt > STILL]:
            raum.spieler.pop(k, None)
            # 1012 statt 4xxx: lebt der Browser doch noch (Hintergrund-Tab), verbindet er sich neu.
            await mgr.close_student(code, k, 1012)
        if not raum.spieler:
            _raeume.pop(code, None)
            break
        await mgr.broadcast(code, _stand(raum))
        await asyncio.sleep(TAKT)


@router.websocket("/{code}/ws")
async def sonnensystem_ws(code: str, websocket: WebSocket, db: Session = Depends(get_db)):
    code = code.upper()
    sitzung = db.query(ToolSession).filter_by(code=code, tool_slug="sonnensystem").first()
    if not sitzung:
        await reject(websocket, 4004)
        return
    identity = ws_identity(websocket, db)
    guest = ws_guest(websocket, code, db) if not identity else None
    if not identity and not guest:
        await reject(websocket, 4001)
        return
    if sitzung.status == "closed" and not identity:
        await reject(websocket, 4003)
        return

    lehrkraft = False
    if identity and identity[0] == "teacher":
        teacher = db.get(Teacher, identity[1])
        lehrkraft = bool(teacher and (sitzung.created_by == teacher.id or teacher.role == "admin"))
        key, name = f"l{identity[1]}", (" ".join(x for x in [f"{teacher.first_name[:1]}." if teacher.first_name else "", teacher.last_name] if x) if teacher else "Lehrkraft")
    elif identity:
        student = db.get(Student, identity[1])
        key, name = f"s{identity[1]}", short_name(student) if student else "?"
    else:
        key, name = f"g{guest.id}", guest.name

    await websocket.accept()
    raum = _raeume.setdefault(code, Raum())
    raum.spieler[key] = raum.spieler.get(key) or Spieler(name=name, lehrkraft=lehrkraft)
    mgr.add_student(code, key, websocket)
    await websocket.send_json({"typ": "willkommen", "du": key})
    if raum.schleife is None or raum.schleife.done():
        raum.schleife = asyncio.create_task(_schleife(code))

    try:
        while True:
            n = await receive_json(websocket, db)
            ich = raum.spieler.get(key)
            if ich is None:
                # Als Geist entfernt, aber doch noch da: wieder aufnehmen.
                ich = raum.spieler[key] = Spieler(name=name, lehrkraft=lehrkraft)
            ich.zuletzt = time.time()
            if n.get("typ") == "ich":
                p, q = _zahlen(n.get("p"), 3), _zahlen(n.get("q"), 4)
                bei = n.get("bei")
                if p is None or q is None or not isinstance(bei, str) or not KOERPER_ID.match(bei):
                    continue
                ich.bei, ich.p, ich.q = bei, p, q
                v = n.get("v", 0)
                ich.v = float(v) if isinstance(v, (int, float)) and math.isfinite(v) else 0.0
    except WebSocketDisconnect:
        pass
    finally:
        mgr.remove_student(code, key, websocket)
        # Nur gehen lassen, wenn nicht schon eine neuere Verbindung desselben Spielers da ist.
        if key not in mgr.student_keys(code):
            raum.spieler.pop(key, None)
            if not raum.spieler:
                _raeume.pop(code, None)
