import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_player, Guest
from ..availability import require_capability
from ..authorship import author_fields, scope_to_student_pool, is_student
from ..database import get_db
from ..utils import gen_code, parse_grades
from ..ws_auth import ws_identity, ws_guest
from ..ws_manager import RoomManager
from ..models import BingoCard, BingoSession, BingoSet, Student, Transaction

if TYPE_CHECKING:
    pass

router = APIRouter(prefix="/api/bingo", tags=["bingo"])


def _dims(session: "BingoSession") -> tuple[int, int]:
    """Return (rows, cols) for a session, handling legacy square sessions."""
    cols = session.grid_cols if session.grid_cols > 0 else session.grid_size
    rows = session.grid_size
    return rows, cols


def _check_bingo(marked: list[int], rows: int, cols: int) -> bool:
    m = set(marked)
    for r in range(rows):
        if all(r * cols + c in m for c in range(cols)):
            return True
    for c in range(cols):
        if all(r * cols + c in m for r in range(rows)):
            return True
    mn = min(rows, cols)
    if all(i * cols + i in m for i in range(mn)):
        return True
    if all(i * cols + (cols - 1 - i) in m for i in range(mn)):
        return True
    return False


def _completed_lines(marked: list[int], rows: int, cols: int) -> set[str]:
    m = set(marked)
    lines: set[str] = set()
    for r in range(rows):
        if all(r * cols + c in m for c in range(cols)):
            lines.add(f"Reihe {r + 1}")
    for c in range(cols):
        if all(r * cols + c in m for r in range(rows)):
            lines.add(f"Spalte {c + 1}")
    mn = min(rows, cols)
    if all(i * cols + i in m for i in range(mn)):
        lines.add("Hauptdiagonale")
    if all(i * cols + (cols - 1 - i) in m for i in range(mn)):
        lines.add("Nebendiagonale")
    return lines


def _card_dict(card: BingoCard, session: BingoSession) -> dict:
    rows, cols = _dims(session)
    cells = [
        {"pair_index": idx, "answer": session.pairs[idx]["answer"] if idx < len(session.pairs) else "?"}
        for idx in card.grid_indices
    ]
    return {
        "id": card.id,
        "student_id": card.student_id,
        "student_name": card.student_name,
        "grid_size": session.grid_size,
        "grid_cols": cols,
        "cells": cells,
        "marked_positions": card.marked_positions,
        "has_bingo": card.has_bingo,
    }


def _session_state(session: BingoSession, db: Session, players: list | None = None) -> dict:
    rows, cols = _dims(session)
    last_called = None
    if session.called_indices:
        idx = session.called_indices[-1]
        if idx < len(session.pairs):
            last_called = {"index": idx, **session.pairs[idx]}
    return {
        "event": "state",
        "status": session.status,
        "title": session.title,
        "grid_size": session.grid_size,
        "grid_cols": cols,
        "total_pairs": len(session.pairs),
        "called_count": len(session.called_indices),
        "called_indices": session.called_indices,
        "last_called": last_called,
        "bingo_count": sum(1 for c in session.cards if c.has_bingo),
        "players": players if players is not None else [],
        "called_pairs": [
            {"index": idx, **session.pairs[idx]}
            for idx in session.called_indices
            if idx < len(session.pairs)
        ],
    }


# ── Manager ───────────────────────────────────────────────────────────────────

_mgr = RoomManager()


# ── REST ──────────────────────────────────────────────────────────────────────

class PairIn(BaseModel):
    caller: str
    answer: str


class BingoCreate(BaseModel):
    title: str
    subject: str | None = None
    tags: list[str] = []
    description: str | None = None
    max_points: int = 0
    grid_size: int = 5   # rows
    grid_cols: int = 4   # cols (0 = square fallback)
    grade: str | int | list[int] | None = None  # e.g. 5, "5,6,7", "5-10" — parsed via parse_grades
    pairs: list[PairIn]


class BingoOut(BaseModel):
    id: int
    code: str
    title: str
    subject: str | None
    tags: list
    description: str | None
    max_points: int
    grid_size: int
    grid_cols: int
    status: str
    total_pairs: int
    created_at: datetime
    class_id: int | None = None
    # Ausgewertet = endgueltig zu; die Oberflaeche blendet "Wieder oeffnen" aus.
    awarded: bool = False

    class Config:
        from_attributes = True


class BingoSetOut(BaseModel):
    id: int
    title: str
    subject: str | None
    tags: list
    description: str | None
    max_points: int
    grid_size: int
    grid_cols: int
    grades: list[int] = []
    total_pairs: int
    created_at: datetime

    class Config:
        from_attributes = True


_EXAMPLES_DIR = Path(__file__).parent.parent.parent / "data" / "bingo_examples"


@router.get("/template")
def download_template():
    from fastapi.responses import JSONResponse
    example_file = _EXAMPLES_DIR / "animals_en_de.json"
    example = json.loads(example_file.read_text(encoding="utf-8")) if example_file.exists() else {}
    example.setdefault("grade", "1-4")
    example = {
        "_ai_instructions": (
            "Erstelle ein Bingo-Set im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- "
            "title (string), pairs (Liste von {caller, answer}). "
            "--- SPIELPRINZIP --- "
            "Lehrer ruft 'caller' auf, Schüler markieren 'answer' auf ihrer Karte (zufällig verteilte Zellen). "
            "--- RASTERGRÖSSE --- "
            "grid_size (Zeilen) × grid_cols (Spalten, 0 = quadratisch wie grid_size). "
            "Mindestens grid_size × grid_cols Paare nötig, mehr Paare = mehr Variation zwischen den Karten. "
            "--- KLASSENSTUFEN (grade-Feld) --- "
            "Einzelne Zahl: 5 | Liste: '5,6,7' | Bereich: '5-10' | Alle Klassen: weglassen oder leer lassen. "
            "--- PUNKTE --- "
            "max_points wird anteilig zur Korrektheit der markierten Felder beim Schließen vergeben. "
            "--- TAGS --- "
            "Freitextliste zur Einordnung in der Bibliothek, z.B. ['Vokabeln', 'A1']."
        ),
        **example,
    }
    return JSONResponse(example, headers={"Content-Disposition": 'attachment; filename="bingo_vorlage.json"'})


@router.get("", response_model=list[BingoOut])
def list_sessions(set_id: int | None = None, db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = db.query(BingoSession)
    if set_id is not None:
        q = q.filter_by(set_id=set_id)
    sessions = q.order_by(BingoSession.created_at.desc()).all()
    return [
        BingoOut(
            id=s.id, code=s.code, title=s.title,
            subject=s.subject, tags=s.tags or [], description=s.description, max_points=s.max_points,
            grid_size=s.grid_size,
            grid_cols=s.grid_cols if s.grid_cols > 0 else s.grid_size,
            status=s.status, total_pairs=len(s.pairs), created_at=s.created_at,
            class_id=s.class_id, awarded=s.awarded_at is not None,
        )
        for s in sessions
    ]


@router.post("", status_code=201, dependencies=[Depends(require_capability("bingo", "host"))])
def create_session(body: BingoCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Creates a reusable BingoSet from the given content, then immediately
    starts a session from it — same request/response shape as before the
    library split, so existing callers (e.g. /bingo/new) need no changes."""
    if is_student(current):
        raise HTTPException(403)
    cols = body.grid_cols if body.grid_cols > 0 else body.grid_size
    cells = body.grid_size * cols
    if len(body.pairs) < cells:
        raise HTTPException(400, f"Mindestens {cells} Paare für ein {body.grid_size}×{cols} Bingo benötigt")
    bingo_set = BingoSet(
        title=body.title, subject=body.subject, tags=body.tags, description=body.description,
        max_points=body.max_points, grid_size=body.grid_size, grid_cols=cols,
        grades=parse_grades(body.grade),
        pairs=[p.model_dump() for p in body.pairs],
        created_by=current.id,
    )
    db.add(bingo_set)
    db.flush()
    session = BingoSession(set_id=bingo_set.id, code=gen_code(db, BingoSession, length=8), created_by=current.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "code": session.code}


@router.get("/sets", response_model=list[BingoSetOut])
def list_sets(db: Session = Depends(get_db), current=Depends(get_current_user)):
    """The Bingo content library — teachers see everything; students only the
    shared student pool (created_by_student set)."""
    q = scope_to_student_pool(db.query(BingoSet), BingoSet, current)
    sets = q.order_by(BingoSet.created_at.desc()).all()
    return [
        BingoSetOut(
            id=s.id, title=s.title, subject=s.subject, tags=s.tags or [], description=s.description,
            max_points=s.max_points, grid_size=s.grid_size,
            grid_cols=s.grid_cols if s.grid_cols > 0 else s.grid_size,
            grades=s.grades or [],
            total_pairs=len(s.pairs), created_at=s.created_at,
        )
        for s in sets
    ]


@router.post("/sets", response_model=BingoSetOut, status_code=201, dependencies=[Depends(require_capability("bingo", "create"))])
def create_set(body: BingoCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Create a reusable Bingo set without starting a session. This is the
    student authoring path (students may create content but not host live
    rounds); teachers may use it too."""
    cols = body.grid_cols if body.grid_cols > 0 else body.grid_size
    cells = body.grid_size * cols
    if len(body.pairs) < cells:
        raise HTTPException(400, f"Mindestens {cells} Paare für ein {body.grid_size}×{cols} Bingo benötigt")
    bingo_set = BingoSet(
        title=body.title, subject=body.subject, tags=body.tags, description=body.description,
        max_points=body.max_points, grid_size=body.grid_size, grid_cols=cols,
        grades=parse_grades(body.grade),
        pairs=[p.model_dump() for p in body.pairs],
        **author_fields(current),
    )
    db.add(bingo_set)
    db.commit()
    db.refresh(bingo_set)
    return BingoSetOut(
        id=bingo_set.id, title=bingo_set.title, subject=bingo_set.subject, tags=bingo_set.tags or [],
        description=bingo_set.description, max_points=bingo_set.max_points, grid_size=bingo_set.grid_size,
        grid_cols=bingo_set.grid_cols if bingo_set.grid_cols > 0 else bingo_set.grid_size,
        grades=bingo_set.grades or [], total_pairs=len(bingo_set.pairs), created_at=bingo_set.created_at,
    )


def create_session_from_set(db: Session, set_id: int, created_by: int, class_id: int | None = None) -> BingoSession:
    """Start a fresh session from a library set — shared by the REST endpoint
    and the Stundenplaner tool registry."""
    bingo_set = db.query(BingoSet).filter_by(id=set_id).first()
    if not bingo_set:
        raise HTTPException(404, "Bingo-Set nicht gefunden")
    session = BingoSession(
        set_id=bingo_set.id, code=gen_code(db, BingoSession, length=8),
        created_by=created_by, class_id=class_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


class SessionFromSetIn(BaseModel):
    class_id: int | None = None


@router.post("/sets/{set_id}/sessions", status_code=201, dependencies=[Depends(require_capability("bingo", "host"))])
def start_session_from_set(set_id: int, body: SessionFromSetIn | None = None, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if is_student(current):
        raise HTTPException(403)
    session = create_session_from_set(db, set_id, current.id, body.class_id if body else None)
    return {"id": session.id, "code": session.code, "class_id": session.class_id}


@router.delete("/{code}", status_code=204)
def delete_session(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if is_student(current):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    db.delete(s)
    db.commit()


async def _close_and_award(session: BingoSession, db: Session):
    """Close a session and award points per card based on % correctly marked.
    Logged-in students credit their own class; anonymous players credit the
    session's bound class (class_id), if any."""
    session.status = "closed"
    called_set = set(session.called_indices)
    db.commit()
    await _mgr.broadcast(session.code, {"event": "closed"})
    if session.max_points > 0 and called_set:
        # Ab hier kennen die Spieler ihr Ergebnis — die Runde ist gelaufen.
        session.awarded_at = datetime.now(timezone.utc)
        for card in session.cards:
            called_positions = [i for i, pair_idx in enumerate(card.grid_indices) if pair_idx in called_set]
            if not called_positions:
                continue
            correctly_marked = len(set(card.marked_positions) & set(called_positions))
            ratio = correctly_marked / len(called_positions)
            pts = round(ratio * session.max_points)
            mgr_key = card.student_id if card.student_id else card.id
            await _mgr.send_student(session.code, mgr_key, {
                "event": "score", "points": pts, "ratio": ratio,
                "max_points": session.max_points, "correct": correctly_marked, "total_called": len(called_positions),
            })
            student = db.get(Student, card.student_id) if card.student_id else None
            target_class_id = student.class_id if student and student.class_id else session.class_id
            if pts > 0 and target_class_id:
                db.add(Transaction(teacher_id=session.created_by, class_id=target_class_id, points=pts,
                                  reason=f"Bingo: {session.title} ({round(ratio * 100)}%)"))
        db.commit()


@router.post("/{code}/close", status_code=204)
async def close_session_rest(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if is_student(current):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    if s.status == "closed":
        return
    await _close_and_award(s, db)


@router.post("/{code}/reopen", status_code=204)
async def reopen_session_rest(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Eine zu frueh beendete Runde wieder oeffnen — Karten und Zuege bleiben.

    Nach der Auswertung geht das nicht mehr: die Punkte sind vergeben und die
    Spieler haben ihr Ergebnis gesehen; ein zweites Schliessen wuerde dieselbe
    Runde erneut verpunkten. Dafuer gibt es Zuruecksetzen, das eine neue Runde
    beginnt.
    """
    if is_student(current):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    if s.awarded_at is not None:
        raise HTTPException(409, "Diese Runde ist schon ausgewertet — zum Weiterspielen zurücksetzen.")
    if s.status != "closed":
        return
    # Waren schon Zahlen dran, lief die Runde bereits; sonst wartet sie noch.
    s.status = "active" if s.called_indices else "waiting"
    db.commit()
    db.refresh(s)
    await _mgr.broadcast(code, _session_state(s, db, players=_mgr.infos(code)))


@router.post("/{code}/reset", status_code=204)
async def reset_session_rest(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if is_student(current):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    s.called_indices = []
    s.status = "waiting"
    s.awarded_at = None      # frische Runde: darf spaeter neu ausgewertet werden
    for card in s.cards:
        card.marked_positions = []
        card.has_bingo = False
    db.commit()
    db.refresh(s)
    await _mgr.broadcast(code, {"event": "reset"})
    await _mgr.broadcast(code, _session_state(s, db, players=_mgr.infos(code)))


def _find_or_create_card(session: BingoSession, db: Session, *, student_id: int = 0, anon_token: str = "", name: str = "Anonym") -> BingoCard:
    """Find or create a bingo card for either an authenticated student or an anonymous participant."""
    rows, cols = _dims(session)
    cells = rows * cols
    if student_id:
        card = db.query(BingoCard).filter_by(session_id=session.id, student_id=student_id).first()
        if not card:
            student = db.query(Student).filter_by(id=student_id).first()
            sname = f"{student.vorname} {student.nachname}" if student else name or "Anonym"
            indices = random.sample(range(len(session.pairs)), cells)
            card = BingoCard(session_id=session.id, student_id=student_id, student_name=sname, grid_indices=indices)
            db.add(card)
            db.commit()
            db.refresh(card)
    else:
        card = db.query(BingoCard).filter_by(session_id=session.id, anon_token=anon_token).first()
        if not card:
            indices = random.sample(range(len(session.pairs)), cells)
            card = BingoCard(session_id=session.id, student_id=None, anon_token=anon_token, student_name=name or "Anonym", grid_indices=indices)
            db.add(card)
            db.commit()
            db.refresh(card)
    return card


@router.get("/info")
def game_info(code: str, db: Session = Depends(get_db)):
    """Resolve a code to its game type — used by the shared play lobby."""
    s = db.query(BingoSession).filter_by(code=code).first()
    if s:
        return {"game": "bingo", "title": s.title, "status": s.status}
    raise HTTPException(404, "Code not found")


@router.post("/{code}/card")
def get_or_create_card_rest(code: str, db: Session = Depends(get_db), current=Depends(get_player)):
    """Card for the calling player — identity comes from the session/guest token,
    never from a client-supplied student_id (that allowed fetching anyone's card)."""
    session = db.query(BingoSession).filter_by(code=code).first()
    if not session:
        raise HTTPException(404)
    if isinstance(current, Student):
        card = _find_or_create_card(session, db, student_id=current.id)
    elif isinstance(current, Guest):
        card = _find_or_create_card(session, db, anon_token=current.id, name=current.name)
    else:
        raise HTTPException(403, "Nur für Schüler")
    return _card_dict(card, session)


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/{code}/ws")
async def bingo_ws(
    code: str, ws: WebSocket,
    role: str = "teacher",
    student_id: int = 0,
    token: str = "",
    name: str = "",
    avatar: str = "",
    db: Session = Depends(get_db),
):
    session = db.query(BingoSession).filter_by(code=code).first()
    if not session:
        await ws.accept()
        await ws.close(code=4004)
        return

    # Verified identity from the session cookie; role=/student_id= query
    # params are client-supplied and never grant control on their own.
    identity = ws_identity(ws, db)
    if role != "student" and (not identity or identity[0] != "teacher"):
        await ws.accept()
        await ws.close(code=4003)
        return

    await ws.accept()

    card: BingoCard | None = None

    if role == "student":
        if identity and identity[0] == "student":
            # Logged-in students always play as themselves.
            card = _find_or_create_card(session, db, student_id=identity[1])
            student_id = identity[1]
            _mgr.add_student(code, student_id, ws, info={"name": card.student_name, "avatar": avatar})
        else:
            # QR/join-link guest: must hold a live guest token scoped to this code
            # (only issued when the teacher opted in — enforces opt-in + 60-min expiry).
            # A logged-in teacher may also test the student view.
            guest = ws_guest(ws, code)
            if guest:
                anon_key, anon_name = guest.id, guest.name
            elif identity and identity[0] == "teacher":
                anon_key, anon_name = f"teacher-{identity[1]}", (name or "Lehrkraft")
            else:
                await ws.close(code=4001)
                return
            card = _find_or_create_card(session, db, anon_token=anon_key, name=anon_name)
            _mgr.add_student(code, card.id, ws, info={"name": card.student_name, "avatar": avatar})
        db.refresh(session)
        await ws.send_json(_session_state(session, db, players=_mgr.infos(code)))
        if card:
            await ws.send_json({"event": "card", **_card_dict(card, session)})
        await _mgr.broadcast(code, {"event": "players", "players": _mgr.infos(code)})
    else:
        _mgr.add_teacher(code, ws)
        await ws.send_json(_session_state(session, db, players=_mgr.infos(code)))

    # For mark actions we need a stable card lookup key
    card_id = card.id if card else None

    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action")
            db.refresh(session)

            if role == "teacher":
                if action == "start" and session.status == "waiting":
                    session.status = "active"
                    db.commit()
                    await _mgr.broadcast(code, {"event": "started"})

                elif action == "call_next" and session.status == "active":
                    remaining = [i for i in range(len(session.pairs)) if i not in session.called_indices]
                    if not remaining:
                        continue
                    idx = random.choice(remaining)
                    session.called_indices = session.called_indices + [idx]
                    db.commit()
                    pair = session.pairs[idx]
                    await _mgr.broadcast(code, {
                        "event": "called",
                        "index": idx,
                        "caller": pair["caller"],
                        "answer": pair["answer"],
                        "called_count": len(session.called_indices),
                        "total_pairs": len(session.pairs),
                    })

                elif action == "reset":
                    session.called_indices = []
                    session.status = "waiting"
                    for card in session.cards:
                        card.marked_positions = []
                        card.has_bingo = False
                    db.commit()
                    db.refresh(session)
                    await _mgr.broadcast(code, {"event": "reset"})
                    await _mgr.broadcast(code, _session_state(session, db, players=_mgr.infos(code)))

                elif action == "close":
                    await _close_and_award(session, db)

            elif role == "student":
                if action == "mark" and session.status == "active":
                    pos = int(data.get("position", -1))
                    card = db.get(BingoCard, card_id) if card_id else None
                    rows, cols = _dims(session)
                    if not card or pos < 0 or pos >= rows * cols:
                        continue
                    if pos not in card.marked_positions:
                        pair_idx = card.grid_indices[pos] if pos < len(card.grid_indices) else -1
                        if pair_idx not in set(session.called_indices):
                            await ws.send_json({"event": "wrong_mark", "position": pos})
                            continue
                        old_lines = _completed_lines(card.marked_positions, rows, cols)
                        card.marked_positions = card.marked_positions + [pos]
                        rows, cols = _dims(session)
                        new_lines = _completed_lines(card.marked_positions, rows, cols) - old_lines
                        for line in new_lines:
                            await _mgr.send_teachers(code, {
                                "event": "line",
                                "student_name": card.student_name,
                                "line": line,
                            })
                        if not card.has_bingo and _check_bingo(card.marked_positions, rows, cols):
                            card.has_bingo = True
                            db.commit()
                            await ws.send_json({"event": "bingo", "marked_positions": card.marked_positions})
                            await _mgr.send_teachers(code, {
                                "event": "player_bingo",
                                "student_name": card.student_name,
                            })
                            await _mgr.broadcast(code, {
                                "event": "bingo_count",
                                "count": sum(1 for c in db.query(BingoCard).filter_by(session_id=session.id).all() if c.has_bingo),
                            })
                        else:
                            db.commit()
                            await ws.send_json({"event": "mark_ack", "marked_positions": card.marked_positions})

    except WebSocketDisconnect:
        pass
    finally:
        if role == "student":
            mgr_key = card_id if token else student_id
            _mgr.remove_student(code, mgr_key)
            await _mgr.broadcast(code, {"event": "players", "players": _mgr.infos(code)})
        else:
            _mgr.remove_teacher(code, ws)
