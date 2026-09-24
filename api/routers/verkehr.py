"""Live-Raum der Verkehrs-Simulation.

Alle Spieler einer Sitzung laufen durch dieselbe Stadt. Jeder Browser rechnet
seine eigene Figur und meldet sie ~10-mal je Sekunde; der Server sammelt und
verteilt alle Stände im selben Takt. Ampeln und Bahnen hängen nur an der
gemeinsamen Uhr (``uhr`` = Serverzeit), rechnen also überall gleich. Die Autos
rechnet genau ein Browser, der *Taktgeber* (die Lehrkraft, sonst wer zuerst
kam); seine Fahrzeuglisten gehen unverändert an alle anderen.

Nichts davon landet in der Datenbank — der Raum lebt im Speicher und ist mit
dem letzten Spieler weg. Nur die Lehrkraft-Einstellung (Beleidigungen an/aus)
überdauert den Raum nicht; das ist bewusst so, sie ist eine Sache der Stunde.
"""
import asyncio
import time
from dataclasses import dataclass, field

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..database import get_db
from ..display_names import short_name
from ..models import Student, Teacher, ToolSession
from ..ws_auth import ws_guest, ws_identity
from ..ws_manager import RoomManager, receive_json, reject

router = APIRouter(prefix="/api/verkehr", tags=["verkehr"])
mgr = RoomManager()

TAKT = 0.1
STRAFE = 8.0
KARMA = 60.0
GESTEN = {"laecheln", "hand", "danke", "schimpfen"}
MELDUNG_GRENZE = 50


@dataclass
class Spieler:
    name: str
    lehrkraft: bool
    x: float = 0.0
    y: float = 0.0
    w: float = 0.0
    farbe: int = 0x2F6FD6
    mitfahrt: bool = False
    punkte: int = 0
    verstoesse: dict = field(default_factory=dict)
    strafe_bis: float = 0.0
    karma_bis: float = 0.0
    hand: float = 0.0


@dataclass
class Raum:
    spieler: dict[str, Spieler] = field(default_factory=dict)
    reihenfolge: list[str] = field(default_factory=list)
    taktgeber: str | None = None
    beleidigungen: bool = True
    taster: dict[int, float] = field(default_factory=dict)
    schleife: asyncio.Task | None = None


_raeume: dict[str, Raum] = {}


def uhr() -> float:
    return time.time()


def _stand(raum: Raum) -> dict:
    return {
        "typ": "stand",
        "uhr": uhr(),
        "spieler": [
            {"key": k, "name": s.name, "x": round(s.x, 2), "y": round(s.y, 2), "w": round(s.w, 2),
             "farbe": s.farbe, "punkte": s.punkte, "strafeBis": s.strafe_bis, "karmaBis": s.karma_bis,
             "hand": s.hand, "mitfahrt": s.mitfahrt, "lehrkraft": s.lehrkraft, "verstoesse": s.verstoesse}
            for k, s in raum.spieler.items()
        ],
    }


async def _schleife(code: str) -> None:
    """Verteilt die Stände, solange jemand im Raum ist."""
    while code in _raeume and _raeume[code].spieler:
        await mgr.broadcast(code, _stand(_raeume[code]))
        await asyncio.sleep(TAKT)


async def _neuer_taktgeber(code: str, raum: Raum) -> None:
    lehrkraefte = [k for k in raum.reihenfolge if raum.spieler[k].lehrkraft]
    neu = (lehrkraefte or raum.reihenfolge or [None])[0]
    if neu != raum.taktgeber:
        raum.taktgeber = neu
        await mgr.broadcast(code, {"typ": "taktgeber", "key": neu})


@router.websocket("/{code}/ws")
async def verkehr_ws(code: str, websocket: WebSocket, db: Session = Depends(get_db)):
    code = code.upper()
    sitzung = db.query(ToolSession).filter_by(code=code, tool_slug="verkehr").first()
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
        key, name = f"l{identity[1]}", (f"{teacher.first_name[:1]}. {teacher.last_name}" if teacher else "Lehrkraft")
    elif identity:
        student = db.get(Student, identity[1])
        key, name = f"s{identity[1]}", short_name(student) if student else "?"
    else:
        key, name = f"g{guest.id}", guest.name

    await websocket.accept()
    raum = _raeume.setdefault(code, Raum())
    alt = raum.spieler.get(key)
    raum.spieler[key] = alt or Spieler(name=name, lehrkraft=lehrkraft)
    if key not in raum.reihenfolge:
        raum.reihenfolge.append(key)
    mgr.add_student(code, key, websocket)
    await websocket.send_json({
        "typ": "willkommen", "du": key, "uhr": uhr(), "lehrkraft": lehrkraft,
        "beleidigungen": raum.beleidigungen, "taster": {str(k): v for k, v in raum.taster.items()},
    })
    await _neuer_taktgeber(code, raum)
    await websocket.send_json({"typ": "taktgeber", "key": raum.taktgeber})
    if raum.schleife is None or raum.schleife.done():
        raum.schleife = asyncio.create_task(_schleife(code))

    try:
        while True:
            n = await receive_json(websocket, db)
            typ = n.get("typ")
            ich = raum.spieler[key]
            if typ == "ich":
                try:
                    ich.x, ich.y, ich.w = float(n["x"]), float(n["y"]), float(n.get("w", 0))
                except (KeyError, TypeError, ValueError):
                    continue
                ich.mitfahrt = bool(n.get("mitfahrt"))
                if isinstance(n.get("farbe"), int):
                    ich.farbe = n["farbe"] & 0xFFFFFF
            elif typ == "ping":
                await websocket.send_json({"typ": "pong", "c": n.get("c"), "uhr": uhr()})
            elif typ == "geste" and n.get("id") in GESTEN:
                gid = n["id"]
                if gid == "schimpfen" and not raum.beleidigungen:
                    continue
                jetzt = uhr()
                if gid == "hand":
                    ich.hand = jetzt
                await mgr.broadcast(code, {"typ": "geste", "key": key, "id": gid, "t": jetzt})
                if gid == "schimpfen":
                    ich.strafe_bis = jetzt + STRAFE
                    ich.karma_bis = jetzt + KARMA
                    await mgr.broadcast(code, {"typ": "strafe", "key": key, "bis": ich.strafe_bis, "karmaBis": ich.karma_bis})
            elif typ == "verkehr" and key == raum.taktgeber:
                await mgr.broadcast_students(code, {"typ": "verkehr", "f": n.get("f", []), "uhr": uhr()})
            elif typ == "taster":
                try:
                    anlage = int(n["anlage"])
                except (KeyError, TypeError, ValueError):
                    continue
                jetzt = uhr()
                # Ein laufender Umlauf lässt sich nicht neu starten.
                if jetzt - raum.taster.get(anlage, 0) > 25:
                    raum.taster[anlage] = jetzt
                    await mgr.broadcast(code, {"typ": "taster", "anlage": anlage, "t": jetzt})
            elif typ == "meldung":
                rid, punkte = str(n.get("id", ""))[:30], n.get("punkte", 0)
                if isinstance(punkte, int) and abs(punkte) <= MELDUNG_GRENZE:
                    ich.punkte += punkte
                    if punkte < 0:
                        ich.verstoesse[rid] = ich.verstoesse.get(rid, 0) + 1
            elif typ == "einstellungen" and lehrkraft:
                if isinstance(n.get("beleidigungen"), bool):
                    raum.beleidigungen = n["beleidigungen"]
                    await mgr.broadcast(code, {"typ": "einstellungen", "beleidigungen": raum.beleidigungen})
    except WebSocketDisconnect:
        pass
    finally:
        mgr.remove_student(code, key, websocket)
        # Nur gehen lassen, wenn nicht schon eine neuere Verbindung desselben Spielers da ist.
        if key not in mgr.student_keys(code):
            raum.spieler.pop(key, None)
            if key in raum.reihenfolge:
                raum.reihenfolge.remove(key)
            if not raum.spieler:
                _raeume.pop(code, None)
            else:
                await _neuer_taktgeber(code, raum)
