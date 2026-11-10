"""Live-Raum der Simulation »Geschichte der Medien«.

Alle Personen einer Sitzung bekommen eine vierstellige Telefonnummer (nur die
Ziffern 1–9, damit sie auf der Wählscheibe schnell gewählt ist) und können sich
gegenseitig Nachrichten in historischen Medien schicken: Morse, Fax, Telefon,
Pager und SMS. Der Server reicht sie nur durch — gespeichert wird nichts.

Dazu gibt es die »Höhlenwand«: Wer ein Bild malt, hängt es mit einer Lösung an
die Wand; die anderen raten (wie bei Gartic Phone). Die Lösung sieht nur, wer
das Bild gemalt hat, jede Lehrkraft und wer schon geraten hat.

Der Raum lebt im Speicher und ist mit der letzten Verbindung weg. Mehrere Tabs
derselben Person zählen als eine Person; alle Tabs bekommen die Nachrichten.
"""
import json
import random
import re
import time
import uuid
from dataclasses import dataclass, field

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..database import get_db
from ..display_names import short_name
from ..models import ExitGameSession, Student, Teacher, ToolSession
from ..ws_auth import ws_guest, ws_identity
from ..ws_manager import receive_json, reject

router = APIRouter(prefix="/api/medien", tags=["medien-live"])

ARTEN = {"morse", "fax", "telefon", "pager", "sms"}
INHALT_MAX = 20_000
BILD_MAX = 200_000
BILD_PRAEFIX = ("data:image/png;base64,", "data:image/webp;base64,")
WAND_MAX = 60
TEXT_MAX = 40
SENDE_ABSTAND = 1.0
MAL_ABSTAND = 5.0


@dataclass
class Bild:
    id: str
    von: str
    von_name: str
    bild: str
    loesung: str
    t: float
    # key → (Tipp, richtig)
    tipps: dict = field(default_factory=dict)


@dataclass
class Raum:
    # key → Anzeigename / Nummer / Lehrkraft-Flag / Sockets
    namen: dict = field(default_factory=dict)
    nummern: dict = field(default_factory=dict)
    lehrkraefte: dict = field(default_factory=dict)
    verbindungen: dict = field(default_factory=dict)
    wand: list = field(default_factory=list)
    zuletzt_gesendet: dict = field(default_factory=dict)
    zuletzt_gemalt: dict = field(default_factory=dict)


_raeume: dict[str, Raum] = {}


def _normal(s: str) -> str:
    """Zum Vergleichen: klein, Umlaute aufgelöst, nur Buchstaben und Ziffern."""
    s = s.strip().lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]", "", s)


def _richtig(tipp: str, loesung: str) -> bool:
    a, b = _normal(tipp), _normal(loesung)
    if not a or not b:
        return False
    if a == b:
        return True
    kurz, lang = (a, b) if len(a) <= len(b) else (b, a)
    return len(kurz) >= 4 and kurz in lang


def _neue_nummer(raum: Raum) -> str:
    vergeben = set(raum.nummern.values())
    while True:
        n = "".join(random.choice("123456789") for _ in range(4))
        if n not in vergeben:
            return n


def _spieler(raum: Raum) -> list[dict]:
    return [
        {"key": k, "name": raum.namen[k], "nummer": raum.nummern[k], "lehrkraft": raum.lehrkraefte[k]}
        for k in raum.verbindungen
    ]


def _sicht(raum: Raum, b: Bild, key: str) -> dict:
    """Das Bild, wie `key` es sehen darf."""
    tipp = b.tipps.get(key)
    sieht_loesung = b.von == key or raum.lehrkraefte.get(key, False) or tipp is not None
    return {
        "id": b.id, "von": b.von, "vonName": b.von_name, "bild": b.bild, "t": b.t,
        "geraten": len(b.tipps), "richtig": sum(1 for _, r in b.tipps.values() if r),
        "meins": b.von == key,
        "loesung": b.loesung if sieht_loesung else None,
        "meinTipp": tipp[0] if tipp else None,
        "meinRichtig": tipp[1] if tipp else None,
    }


async def _senden(ws: WebSocket, msg: dict) -> None:
    try:
        await ws.send_json(msg)
    except Exception:
        pass


async def _an_key(raum: Raum, key: str, msg: dict) -> None:
    for ws in list(raum.verbindungen.get(key, [])):
        await _senden(ws, msg)


async def _an_alle(raum: Raum, msg: dict) -> None:
    for key in list(raum.verbindungen):
        await _an_key(raum, key, msg)


@router.websocket("/{code}/ws")
async def medien_ws(code: str, websocket: WebSocket, db: Session = Depends(get_db)):
    code = code.upper()
    # Eine Medien-Sitzung (Lehrkraft startet die Sim) — oder eine TaskCrawler-Sitzung,
    # deren Station die Sim öffnet: dann treffen sich alle aus diesem TaskCrawler-Lauf.
    sitzung = db.query(ToolSession).filter_by(code=code, tool_slug="medien").first()
    taskcrawler = None if sitzung else db.query(ExitGameSession).filter_by(join_code=code).first()
    if not sitzung and not taskcrawler:
        await reject(websocket, 4004)
        return
    besitzer = sitzung.created_by if sitzung else taskcrawler.teacher_id
    status = sitzung.status if sitzung else taskcrawler.status
    # Codes beider Sorten könnten gleich sein — die Räume bleiben getrennt
    raum_id = code if sitzung else f"tc:{code}"
    identity = ws_identity(websocket, db)
    guest = ws_guest(websocket, code, db) if not identity else None
    if not identity and not guest:
        await reject(websocket, 4001)
        return
    if status == "closed" and not identity:
        await reject(websocket, 4003)
        return

    lehrkraft = False
    if identity and identity[0] == "teacher":
        teacher = db.get(Teacher, identity[1])
        lehrkraft = bool(teacher and (besitzer == teacher.id or teacher.role == "admin"))
        key = f"l{identity[1]}"
        name = (" ".join(x for x in [f"{teacher.first_name[:1]}." if teacher.first_name else "", teacher.last_name] if x)
                if teacher else "Lehrkraft")
    elif identity:
        student = db.get(Student, identity[1])
        key, name = f"s{identity[1]}", short_name(student) if student else "?"
    else:
        key, name = f"g{guest.id}", guest.name

    await websocket.accept()
    raum = _raeume.setdefault(raum_id, Raum())
    raum.namen[key] = name
    raum.lehrkraefte[key] = lehrkraft
    if key not in raum.nummern:
        raum.nummern[key] = _neue_nummer(raum)
    raum.verbindungen.setdefault(key, []).append(websocket)
    await _senden(websocket, {
        "typ": "willkommen", "du": key, "nummer": raum.nummern[key], "lehrkraft": lehrkraft,
        "spieler": _spieler(raum), "wand": [_sicht(raum, b, key) for b in raum.wand],
    })
    await _an_alle(raum, {"typ": "spieler", "spieler": _spieler(raum)})

    try:
        while True:
            n = await receive_json(websocket, db)
            if not isinstance(n, dict):
                continue
            typ = n.get("typ")
            jetzt = time.time()
            if typ == "ping":
                await _senden(websocket, {"typ": "pong", "c": n.get("c")})
            elif typ == "senden":
                an, art, inhalt = n.get("an"), n.get("art"), n.get("inhalt")
                if art not in ARTEN or not isinstance(an, str):
                    continue
                try:
                    if len(json.dumps(inhalt)) > INHALT_MAX:
                        continue
                except (TypeError, ValueError):
                    continue
                if an == key:
                    await _senden(websocket, {"typ": "fehler", "grund": "offline"})
                    continue
                if jetzt - raum.zuletzt_gesendet.get(key, 0) < SENDE_ABSTAND:
                    await _senden(websocket, {"typ": "fehler", "grund": "zu_schnell"})
                    continue
                if an not in raum.verbindungen:
                    await _senden(websocket, {"typ": "fehler", "grund": "offline"})
                    continue
                raum.zuletzt_gesendet[key] = jetzt
                antwort = n.get("antwortAuf")
                mid = uuid.uuid4().hex
                await _an_key(raum, an, {
                    "typ": "nachricht", "id": mid, "von": key, "vonName": name,
                    "vonNummer": raum.nummern[key], "art": art, "inhalt": inhalt,
                    "antwortAuf": antwort if isinstance(antwort, str) else None, "t": int(jetzt),
                })
                await _senden(websocket, {"typ": "gesendet", "id": mid, "an": an, "art": art})
            elif typ == "malen":
                bild, loesung = n.get("bild"), n.get("loesung")
                if not isinstance(bild, str) or not isinstance(loesung, str):
                    continue
                loesung = loesung.strip()
                if not bild.startswith(BILD_PRAEFIX) or len(bild) > BILD_MAX or not 1 <= len(loesung) <= TEXT_MAX:
                    continue
                if jetzt - raum.zuletzt_gemalt.get(key, 0) < MAL_ABSTAND:
                    await _senden(websocket, {"typ": "fehler", "grund": "zu_schnell"})
                    continue
                raum.zuletzt_gemalt[key] = jetzt
                b = Bild(uuid.uuid4().hex, key, name, bild, loesung, jetzt)
                raum.wand.append(b)
                del raum.wand[:-WAND_MAX]
                # Jede Person bekommt ihre eigene Sicht (Lösung nur für Urheber·in und Lehrkraft).
                for k in list(raum.verbindungen):
                    await _an_key(raum, k, {"typ": "bild", "bild": _sicht(raum, b, k)})
            elif typ == "raten":
                text = n.get("text")
                b = next((x for x in raum.wand if x.id == n.get("id")), None)
                if b is None or not isinstance(text, str):
                    continue
                text = text.strip()
                if not 1 <= len(text) <= TEXT_MAX or b.von == key or key in b.tipps:
                    continue
                ok = _richtig(text, b.loesung)
                b.tipps[key] = (text, ok)
                await _senden(websocket, {"typ": "aufloesung", "id": b.id, "richtig": ok, "loesung": b.loesung})
                await _an_key(raum, b.von, {"typ": "geraten", "id": b.id, "name": name, "text": text, "richtig": ok})
                await _an_alle(raum, {
                    "typ": "zaehler", "id": b.id, "geraten": len(b.tipps),
                    "richtig": sum(1 for _, r in b.tipps.values() if r),
                })
            elif typ == "loeschen":
                b = next((x for x in raum.wand if x.id == n.get("id")), None)
                if b is None or not (b.von == key or lehrkraft):
                    continue
                raum.wand.remove(b)
                await _an_alle(raum, {"typ": "weg", "id": b.id})
    except WebSocketDisconnect:
        pass
    finally:
        sockets = raum.verbindungen.get(key, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets:
            raum.verbindungen.pop(key, None)
            if not raum.verbindungen:
                # Letzte Person weg: der Raum ist weg, mitsamt Wand und Nummern.
                if _raeume.get(raum_id) is raum:
                    _raeume.pop(raum_id, None)
            else:
                await _an_alle(raum, {"typ": "spieler", "spieler": _spieler(raum)})
