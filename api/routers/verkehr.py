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

from typing import Union

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..availability import require_capability
from ..database import get_db
from ..display_names import short_name
from ..models import Student, Teacher, ToolSession, Transaction, VerkehrPruefung
from .maus import _buchende_lehrkraft, _haus_name
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
    weste: bool = False
    # Letztes Lebenszeichen: Wer 20 s nichts schickt, ist weg (abgerissene
    # Verbindung ohne sauberes Schließen) — sonst bliebe ein Geist Taktgeber
    # und alle Autos stünden still.
    zuletzt: float = field(default_factory=time.time)
    # Letzte eigene Lage: kommt nur aus der Bildschleife. Ein Tab im Hintergrund
    # pingt weiter, zeichnet aber nicht — als Taktgeber stünden alle Autos still.
    bild_zuletzt: float = field(default_factory=time.time)


@dataclass
class Raum:
    spieler: dict[str, Spieler] = field(default_factory=dict)
    reihenfolge: list[str] = field(default_factory=list)
    taktgeber: str | None = None
    beleidigungen: bool = True
    # Sekunden, um die die Spieluhr von der echten abweicht — die Lehrkraft
    # stellt so etwa 7:30 Uhr (Berufsverkehr) oder 21 Uhr (Dunkelheit) ein.
    zeit_versatz: float = 0.0
    # Zeitraffer: ab `zeit_anker` (Server-Uhr) läuft die Spieluhr `zeit_faktor`-mal
    # so schnell. Spielzeit = t + versatz + (t - anker) * (faktor - 1).
    zeit_faktor: float = 1.0
    zeit_anker: float = 0.0
    taster: dict[int, float] = field(default_factory=dict)
    schleife: asyncio.Task | None = None


_raeume: dict[str, Raum] = {}

# Die Uhr darf so weit von der echten weg (Zeitraffer schiebt sie mit der Zeit weiter).
ZEIT_VERSATZ_GRENZE = 60 * 24 * 3600
ZEIT_FAKTOR_MAX = 10


def _uhr_stellung(raum: Raum) -> dict:
    return {"zeitVersatz": raum.zeit_versatz, "zeitFaktor": raum.zeit_faktor, "zeitAnker": raum.zeit_anker}


def uhr() -> float:
    return time.time()


def _stand(raum: Raum) -> dict:
    return {
        "typ": "stand",
        "uhr": uhr(),
        "spieler": [
            {"key": k, "name": s.name, "x": round(s.x, 2), "y": round(s.y, 2), "w": round(s.w, 2),
             "farbe": s.farbe, "punkte": s.punkte, "strafeBis": s.strafe_bis, "karmaBis": s.karma_bis,
             "hand": s.hand, "mitfahrt": s.mitfahrt, "weste": s.weste, "lehrkraft": s.lehrkraft, "verstoesse": s.verstoesse}
            for k, s in raum.spieler.items()
        ],
    }


STILL = 20.0


async def _raeume_geister(code: str, raum: Raum) -> None:
    jetzt = time.time()
    geister = [k for k, s in raum.spieler.items() if jetzt - s.zuletzt > STILL]
    for k in geister:
        raum.spieler.pop(k, None)
        if k in raum.reihenfolge:
            raum.reihenfolge.remove(k)
        # 1012 statt 4xxx: lebt der Browser doch noch (Hintergrund-Tab), verbindet er sich neu.
        await mgr.close_student(code, k, 1012)
    if geister and raum.spieler:
        await _neuer_taktgeber(code, raum)


async def _schleife(code: str) -> None:
    """Verteilt die Stände, solange jemand im Raum ist."""
    while code in _raeume and _raeume[code].spieler:
        raum = _raeume[code]
        await _raeume_geister(code, raum)
        if not raum.spieler:
            _raeume.pop(code, None)
            break
        # Zeichnet der Taktgeber nicht mehr (Tab im Hintergrund)? Dann ein anderer.
        tg = raum.spieler.get(raum.taktgeber or "")
        if tg is None or time.time() - tg.bild_zuletzt > BILD_STILL:
            await _neuer_taktgeber(code, raum)
        await mgr.broadcast(code, _stand(raum))
        await asyncio.sleep(TAKT)


BILD_STILL = 3.0


async def _neuer_taktgeber(code: str, raum: Raum) -> None:
    # Nur wer gerade zeichnet, rechnet den Verkehr — Lehrkraft zuerst.
    jetzt = time.time()
    aktiv = [k for k in raum.reihenfolge if jetzt - raum.spieler[k].bild_zuletzt < BILD_STILL]
    wahl = aktiv or raum.reihenfolge
    lehrkraefte = [k for k in wahl if raum.spieler[k].lehrkraft]
    neu = (lehrkraefte or wahl or [None])[0]
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
        key, name = f"l{identity[1]}", (" ".join(x for x in [f"{teacher.first_name[:1]}." if teacher.first_name else "", teacher.last_name] if x) if teacher else "Lehrkraft")
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
        "beleidigungen": raum.beleidigungen, **_uhr_stellung(raum), "taster": {str(k): v for k, v in raum.taster.items()},
    })
    await _neuer_taktgeber(code, raum)
    await websocket.send_json({"typ": "taktgeber", "key": raum.taktgeber})
    if raum.schleife is None or raum.schleife.done():
        raum.schleife = asyncio.create_task(_schleife(code))

    try:
        while True:
            n = await receive_json(websocket, db)
            typ = n.get("typ")
            ich = raum.spieler.get(key)
            if ich is None:
                # Als Geist entfernt, aber doch noch da: wieder aufnehmen.
                ich = raum.spieler[key] = Spieler(name=name, lehrkraft=lehrkraft)
                raum.reihenfolge.append(key)
            ich.zuletzt = time.time()
            if typ == "ich":
                ich.bild_zuletzt = ich.zuletzt
                try:
                    ich.x, ich.y, ich.w = float(n["x"]), float(n["y"]), float(n.get("w", 0))
                except (KeyError, TypeError, ValueError):
                    continue
                ich.mitfahrt = bool(n.get("mitfahrt"))
                ich.weste = bool(n.get("weste"))
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
                    # Aufräumen macht das Schimpfen wieder gut: die Autos lassen einen wieder vor.
                    if rid == "karmaGeheilt":
                        ich.karma_bis = 0.0
                    if punkte < 0:
                        ich.verstoesse[rid] = ich.verstoesse.get(rid, 0) + 1
            elif typ == "einstellungen" and lehrkraft:
                if isinstance(n.get("beleidigungen"), bool):
                    raum.beleidigungen = n["beleidigungen"]
                versatz, faktor, anker = n.get("zeitVersatz"), n.get("zeitFaktor"), n.get("zeitAnker")
                if isinstance(versatz, (int, float)) and abs(versatz) <= ZEIT_VERSATZ_GRENZE:
                    raum.zeit_versatz = float(versatz)
                    # Der Anker ist »jetzt« beim Absender; weit daneben = Unsinn, dann unsere Uhr.
                    jetzt = uhr()
                    raum.zeit_anker = float(anker) if isinstance(anker, (int, float)) and abs(anker - jetzt) < 120 else jetzt
                    if isinstance(faktor, (int, float)) and 1 <= faktor <= ZEIT_FAKTOR_MAX:
                        raum.zeit_faktor = float(faktor)
                await mgr.broadcast(code, {"typ": "einstellungen", "beleidigungen": raum.beleidigungen,
                                           **_uhr_stellung(raum)})
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


# ── Führerschein ────────────────────────────────────────────────────────────

# Spiegelt die Pflichtaufträge in frontend/src/lib/verkehr/missionen.ts.
PFLICHT = {"fuss": {"lidl", "netto", "ampel", "taster", "zebra", "hand", "bus", "schilder"}}
MAX_SCHWERE = 2
HAUSPUNKTE = 5


class PruefungIn(BaseModel):
    stufe: str = "fuss"
    erledigt: list[str]
    schwere: int = Field(ge=0)
    code: str | None = None


class PruefungOut(BaseModel):
    bestanden: bool
    punkte: int
    schon_vergeben: bool
    haus: str | None


@router.post("/pruefung", response_model=PruefungOut, dependencies=[Depends(require_capability("verkehr", "use"))])
def pruefung(body: PruefungIn, db: Session = Depends(get_db),
             user: Union[Teacher, Student] = Depends(get_current_user)):
    """Fußgänger-Führerschein: alle Pflichtaufträge, höchstens zwei schwere
    Verstöße. Wie beim Maus-Führerschein clientgemeldet — es geht um eine
    Klassenrunde, nicht um eine Prüfung mit Folgen; die Hauspunkte gibt es je
    Schüler:in und Stufe genau einmal."""
    pflicht = PFLICHT.get(body.stufe)
    if pflicht is None:
        raise HTTPException(400, f"Unbekannte Stufe: {body.stufe}")
    fehlt = pflicht - set(body.erledigt)
    if fehlt:
        raise HTTPException(400, f"Noch nicht bestanden – es fehlen {len(fehlt)} Aufträge.")
    if body.schwere > MAX_SCHWERE:
        raise HTTPException(400, "Noch nicht bestanden – zu viele schwere Verstöße.")

    if not isinstance(user, Student):
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)
    if db.query(VerkehrPruefung).filter_by(student_id=user.id, stufe=body.stufe).first():
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=True, haus=_haus_name(db, user.class_id))
    if user.class_id is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)
    buchende = _buchende_lehrkraft(db, user, body.code, slug="verkehr")
    if buchende is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    db.add(Transaction(
        teacher_id=buchende.id, class_id=user.class_id, points=HAUSPUNKTE,
        reason=f"Fußgänger-Führerschein bestanden: {short_name(user)}",
    ))
    db.add(VerkehrPruefung(student_id=user.id, stufe=body.stufe, punkte=HAUSPUNKTE, class_id=user.class_id))
    db.commit()
    return PruefungOut(bestanden=True, punkte=HAUSPUNKTE, schon_vergeben=False, haus=_haus_name(db, user.class_id))
