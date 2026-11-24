"""Wettschreiben — das Tipp-Rennen der Klasse.

Alle tippen denselben Text, die Balken laufen live nebeneinander. Die Lehrkraft
legt ein Rennen an, teilt Code/QR, und startet, wenn alle da sind.

**Der laufende Fortschritt geht nicht in die Datenbank.** Er kommt über den
WebSocket und liegt in `_stand` im Speicher; erst wer ins Ziel kommt (oder das
Rennen beendet vorfindet), bekommt sein Ergebnis in die Zeile geschrieben.
Sonst schriebe eine Klasse von dreissig Kindern bei jedem Anschlag in SQLite.

Folge davon, bewusst in Kauf genommen: Stürzt der Server mitten im Rennen ab,
sind die Zwischenstände weg. Ein Rennen dauert eine Minute — das ist zu
verschmerzen.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import Guest, get_current_teacher, get_player
from ..availability import require_capability
from ..models import Student, Teacher, WettschreibenSession, WettschreibenTeilnehmer
from ..display_names import abbreviate_stored, short_name
from ..tipp_text import pruefe_tippbar
from ..utils import gen_code
from ..ws_auth import ws_identity, ws_guest
from ..ws_manager import RoomManager, receive_json, reject

router = APIRouter(prefix="/api/wettschreiben", tags=["wettschreiben"])

mgr = RoomManager()

# code → {teilnehmer_id: {"name", "pos", "anschlaege", "fehler", "dauer_ms"}}
_stand: dict[str, dict[int, dict]] = {}

MAX_TEXT = 5000


# ── Schemata ────────────────────────────────────────────────────────────────

class RennenIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1)


class TeilnehmerOut(BaseModel):
    id: int
    name: str
    pos: int
    anschlaege: int
    fehler: int
    dauer_ms: int | None


class RennenOut(BaseModel):
    code: str
    title: str
    text: str
    status: str
    allow_guests: bool
    teilnehmer: list[TeilnehmerOut]


class BeitrittIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BeitrittOut(BaseModel):
    teilnehmer_id: int
    name: str


# ── Helfer ──────────────────────────────────────────────────────────────────

def _rennen(code: str, db: Session) -> WettschreibenSession:
    s = db.query(WettschreibenSession).filter_by(code=code.upper()).first()
    if not s:
        raise HTTPException(404, "Rennen nicht gefunden")
    return s


def _besitzer(s: WettschreibenSession, teacher: Teacher) -> None:
    if s.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Nur wer das Rennen angelegt hat, darf es steuern.")


def _to_out(s: WettschreibenSession) -> RennenOut:
    lauf = _stand.get(s.code, {})
    teilnehmer = []
    for t in s.teilnehmer:
        live = lauf.get(t.id)
        teilnehmer.append(TeilnehmerOut(
            id=t.id, name=t.name,
            pos=live["pos"] if live else t.pos,
            anschlaege=live["anschlaege"] if live else t.anschlaege,
            fehler=live["fehler"] if live else t.fehler,
            dauer_ms=(live or {}).get("dauer_ms", t.dauer_ms),
        ))
    return RennenOut(code=s.code, title=s.title, text=s.text, status=s.status,
                     allow_guests=s.allow_guests, teilnehmer=teilnehmer)


def wertung(pos: int, anschlaege: int, fehler: int, dauer_ms: int | None) -> float | None:
    """Punkte im Ziel: Anschläge/Minute, durch die Fehlerquote gedämpft.

    Faktor (1 − Fehlerquote)²: 5 % Fehler kosten rund 10 % der Punkte, 10 %
    Fehler knapp 20 %. Wer schnell, aber schlampig tippt, landet so hinter
    jemandem, der etwas langsamer und sauber ist.
    """
    if dauer_ms is None or dauer_ms <= 0:
        return None
    tempo = pos / (dauer_ms / 60000)
    quote = min(1.0, fehler / anschlaege) if anschlaege else 0.0
    return round(tempo * (1 - quote) ** 2, 1)


def _rangliste(code: str) -> list[dict]:
    """Wer im Ziel ist, zuerst — nach Wertung (Tempo × Sauberkeit); danach die Übrigen nach Fortschritt."""
    eintraege = [{"id": tid, **d, "wertung": wertung(d["pos"], d["anschlaege"], d["fehler"], d.get("dauer_ms"))}
                 for tid, d in _stand.get(code, {}).items()]
    def schluessel(d):
        fertig = d["wertung"] is not None
        return (0 if fertig else 1, -d["wertung"] if fertig else -d["pos"])
    return sorted(eintraege, key=schluessel)


async def _sende_stand(code: str) -> None:
    await mgr.broadcast(code, {"typ": "stand", "teilnehmer": _rangliste(code)})


# ── REST ────────────────────────────────────────────────────────────────────

@router.post("", status_code=201, response_model=RennenOut,
             dependencies=[Depends(require_capability("tippen", "host"))])
def anlegen(body: RennenIn, db: Session = Depends(get_db),
            teacher: Teacher = Depends(get_current_teacher)):
    if len(body.text) > MAX_TEXT:
        raise HTTPException(400, f"Der Text ist länger als {MAX_TEXT} Zeichen.")
    pruefe_tippbar(body.text, "Der Renntext")

    s = WettschreibenSession(
        code=gen_code(db, WettschreibenSession),
        title=body.title.strip()[:200],
        text=body.text,
        created_by=teacher.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    _stand[s.code] = {}
    return _to_out(s)


@router.get("/{code}", response_model=RennenOut)
def lesen(code: str, db: Session = Depends(get_db), _=Depends(get_player)):
    """Spieler und Host lesen denselben Stand — Gäste über ihren Sitzungs-Token."""
    return _to_out(_rennen(code, db))


@router.post("/{code}/join", response_model=BeitrittOut)
def beitreten(code: str, body: BeitrittIn, db: Session = Depends(get_db),
              spieler=Depends(get_player)):
    s = _rennen(code, db)
    if s.status == "fertig":
        raise HTTPException(409, "Dieses Rennen ist schon gelaufen.")

    student_id = spieler.id if isinstance(spieler, Student) else None
    guest_id = spieler.id if isinstance(spieler, Guest) else None

    # Wer schon drin ist, kommt nicht doppelt hinein (Neuladen der Seite).
    vorhanden = None
    if student_id is not None:
        vorhanden = next((t for t in s.teilnehmer if t.student_id == student_id), None)
    elif guest_id is not None:
        vorhanden = next((t for t in s.teilnehmer if t.guest_id == guest_id), None)
    if vorhanden:
        return BeitrittOut(teilnehmer_id=vorhanden.id, name=vorhanden.name)

    # Der Name steht waehrend des Rennens fuer alle auf der Bahn — Kurzform.
    angezeigt = short_name(spieler) if isinstance(spieler, Student)         else abbreviate_stored(body.name)[:100]
    t = WettschreibenTeilnehmer(
        session_id=s.id, name=angezeigt,
        student_id=student_id, guest_id=guest_id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    _stand.setdefault(s.code, {})[t.id] = {
        "name": t.name, "pos": 0, "anschlaege": 0, "fehler": 0, "dauer_ms": None,
    }
    return BeitrittOut(teilnehmer_id=t.id, name=t.name)


@router.post("/{code}/start", response_model=RennenOut)
async def starten(code: str, db: Session = Depends(get_db),
            teacher: Teacher = Depends(get_current_teacher)):
    s = _rennen(code, db)
    _besitzer(s, teacher)
    if s.status != "lobby":
        raise HTTPException(409, "Das Rennen läuft schon oder ist vorbei.")
    s.status = "laeuft"
    s.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    # Der Server schickt den Start selbst an alle (wie bei Caputh) — nicht der
    # Host-Socket, der in einem Hintergrund-Tab gerade getrennt sein kann.
    await mgr.broadcast(s.code, {"typ": "start"})
    return _to_out(s)


@router.post("/{code}/ende", response_model=RennenOut)
async def beenden(code: str, db: Session = Depends(get_db),
            teacher: Teacher = Depends(get_current_teacher)):
    """Rennen schliessen und die Zwischenstände als Ergebnis festschreiben."""
    s = _rennen(code, db)
    _besitzer(s, teacher)
    s.status = "fertig"
    lauf = _stand.get(s.code, {})
    for t in s.teilnehmer:
        d = lauf.get(t.id)
        if d:
            t.pos, t.anschlaege, t.fehler = d["pos"], d["anschlaege"], d["fehler"]
            t.dauer_ms = d.get("dauer_ms")
    db.commit()
    db.refresh(s)
    await mgr.broadcast(s.code, {"typ": "status", "status": "fertig", "text": s.text})
    return _to_out(s)


# ── WebSocket ───────────────────────────────────────────────────────────────

@router.websocket("/{code}/ws")
async def wettschreiben_ws(code: str, websocket: WebSocket, role: str = "student",
                           teilnehmer_id: int = 0, db: Session = Depends(get_db)):
    s = db.query(WettschreibenSession).filter_by(code=code.upper()).first()
    if not s:
        await reject(websocket, 4004)
        return

    # Identität nur aus der Verbindung selbst — ein mitgeschicktes role=teacher
    # wäre aus den Entwicklerwerkzeugen heraus frei erfunden.
    identity = ws_identity(websocket, db)
    guest = ws_guest(websocket, code, db) if not identity else None
    if not identity and not guest:
        await reject(websocket, 4001)
        return

    if role == "teacher":
        teacher = db.get(Teacher, identity[1]) if identity and identity[0] == "teacher" else None
        if not teacher or (s.created_by != teacher.id and teacher.role != "admin"):
            await reject(websocket, 4003)
            return
    else:
        # Der Platz im Rennen muss wirklich diesem Spieler gehören.
        t = db.get(WettschreibenTeilnehmer, teilnehmer_id)
        eigen = t is not None and t.session_id == s.id and (
            (guest is not None and t.guest_id == guest.id)
            or (identity is not None and identity[0] == "student" and t.student_id == identity[1])
        )
        if not eigen:
            await reject(websocket, 4003)
            return

    await websocket.accept()

    if role == "teacher":
        mgr.add_teacher(code, websocket)
    else:
        mgr.add_student(code, teilnehmer_id, websocket)

    await websocket.send_json({"typ": "status", "status": s.status, "text": s.text})
    await _sende_stand(code)

    try:
        while True:
            nachricht = await receive_json(websocket, db)
            if nachricht.get("typ") != "fortschritt" or role == "teacher":
                continue

            eintrag = _stand.setdefault(code, {}).setdefault(
                teilnehmer_id, {"name": "", "pos": 0, "anschlaege": 0, "fehler": 0, "dauer_ms": None}
            )
            eintrag["pos"] = max(0, min(int(nachricht.get("pos", 0)), len(s.text)))
            eintrag["anschlaege"] = max(0, int(nachricht.get("anschlaege", 0)))
            eintrag["fehler"] = max(0, int(nachricht.get("fehler", 0)))
            if not eintrag["name"]:
                mitglied = db.get(WettschreibenTeilnehmer, teilnehmer_id)
                eintrag["name"] = mitglied.name if mitglied else "?"

            if eintrag["pos"] >= len(s.text) and eintrag["dauer_ms"] is None:
                eintrag["dauer_ms"] = max(0, int(nachricht.get("dauer_ms", 0)))
                _schreibe_ergebnis(db, teilnehmer_id, eintrag)

            await _sende_stand(code)
    except WebSocketDisconnect:
        pass
    finally:
        if role == "teacher":
            mgr.remove_teacher(code, websocket)
        else:
            mgr.remove_student(code, teilnehmer_id, websocket)


def _schreibe_ergebnis(db: Session, teilnehmer_id: int, eintrag: dict) -> None:
    """Ein Ziel-Ergebnis festhalten — einmal je Teilnehmer und Rennen.

    Nimmt die Sitzung des Sockets: die lebt ohnehin so lange wie die
    Verbindung, und eine zweite aufzumachen würde in Tests an einer anderen
    Datenbank landen als der, die der Test sieht.
    """
    t = db.get(WettschreibenTeilnehmer, teilnehmer_id)
    if t:
        t.pos, t.anschlaege = eintrag["pos"], eintrag["anschlaege"]
        t.fehler, t.dauer_ms = eintrag["fehler"], eintrag["dauer_ms"]
        db.commit()
