import json
import random
import string
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import BingoCard, BingoSession, Student, Transaction

if TYPE_CHECKING:
    pass

router = APIRouter(prefix="/api/bingo", tags=["bingo"])


def _code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


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

class _BingoManager:
    def __init__(self):
        self._teachers: dict[str, list[WebSocket]] = {}
        self._students: dict[str, dict[int, WebSocket]] = {}
        self._player_info: dict[str, dict[int, dict]] = {}

    def add_teacher(self, code: str, ws: WebSocket):
        self._teachers.setdefault(code, []).append(ws)

    def remove_teacher(self, code: str, ws: WebSocket):
        self._teachers[code] = [w for w in self._teachers.get(code, []) if w is not ws]

    def add_student(self, code: str, student_id: int, ws: WebSocket, *, name: str = "", avatar: str = ""):
        self._students.setdefault(code, {})[student_id] = ws
        self._player_info.setdefault(code, {})[student_id] = {"name": name, "avatar": avatar}

    def remove_student(self, code: str, student_id: int):
        self._students.get(code, {}).pop(student_id, None)
        self._player_info.get(code, {}).pop(student_id, None)

    def player_list(self, code: str) -> list[dict]:
        return list(self._player_info.get(code, {}).values())

    async def broadcast_all(self, code: str, msg: dict):
        for ws in list(self._teachers.get(code, [])):
            try:
                await ws.send_json(msg)
            except Exception:
                pass
        for ws in list(self._students.get(code, {}).values()):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def broadcast_teachers(self, code: str, msg: dict):
        for ws in list(self._teachers.get(code, [])):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def send_student(self, code: str, student_id: int, msg: dict):
        ws = self._students.get(code, {}).get(student_id)
        if ws:
            try:
                await ws.send_json(msg)
            except Exception:
                pass


_mgr = _BingoManager()


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

    class Config:
        from_attributes = True


_EXAMPLES_DIR = Path(__file__).parent.parent.parent / "data" / "bingo_examples"


@router.get("/template")
def download_template():
    example_file = _EXAMPLES_DIR / "animals_en_de.json"
    data = example_file.read_text(encoding="utf-8") if example_file.exists() else "{}"
    return Response(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="bingo_vorlage.json"'},
    )


@router.get("", response_model=list[BingoOut])
def list_sessions(db: Session = Depends(get_db), current=Depends(get_current_user)):
    sessions = db.query(BingoSession).order_by(BingoSession.created_at.desc()).all()
    return [
        BingoOut(
            id=s.id, code=s.code, title=s.title,
            subject=s.subject, tags=s.tags or [], description=s.description, max_points=s.max_points,
            grid_size=s.grid_size,
            grid_cols=s.grid_cols if s.grid_cols > 0 else s.grid_size,
            status=s.status, total_pairs=len(s.pairs), created_at=s.created_at,
        )
        for s in sessions
    ]


@router.post("", status_code=201)
def create_session(body: BingoCreate, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    cols = body.grid_cols if body.grid_cols > 0 else body.grid_size
    cells = body.grid_size * cols
    if len(body.pairs) < cells:
        raise HTTPException(400, f"Mindestens {cells} Paare für ein {body.grid_size}×{cols} Bingo benötigt")
    session = BingoSession(
        code=_code(), title=body.title,
        subject=body.subject, tags=body.tags, description=body.description, max_points=body.max_points,
        grid_size=body.grid_size, grid_cols=cols,
        pairs=[p.model_dump() for p in body.pairs],
        created_by=current.id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "code": session.code}


@router.delete("/{code}", status_code=204)
def delete_session(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    db.delete(s)
    db.commit()


@router.post("/{code}/close", status_code=204)
async def close_session_rest(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    if s.status == "closed":
        return
    s.status = "closed"
    called_set = set(s.called_indices)
    db.commit()
    await _mgr.broadcast_all(code, {"event": "closed"})
    if s.max_points > 0 and called_set:
        for card in s.cards:
            called_positions = [i for i, pair_idx in enumerate(card.grid_indices) if pair_idx in called_set]
            if not called_positions:
                continue
            correctly_marked = len(set(card.marked_positions) & set(called_positions))
            ratio = correctly_marked / len(called_positions)
            pts = round(ratio * s.max_points)
            mgr_key = card.student_id if card.student_id else card.id
            await _mgr.send_student(code, mgr_key, {
                "event": "score", "points": pts, "ratio": ratio,
                "max_points": s.max_points, "correct": correctly_marked, "total_called": len(called_positions),
            })
            if pts > 0 and card.student_id:
                student = db.get(Student, card.student_id)
                if student and student.class_id:
                    db.add(Transaction(teacher_id=s.created_by, class_id=student.class_id, points=pts,
                                      reason=f"Bingo: {s.title} ({round(ratio * 100)}%)"))
        db.commit()


@router.post("/{code}/reset", status_code=204)
async def reset_session_rest(code: str, db: Session = Depends(get_db), current=Depends(get_current_user)):
    if current.role not in ("teacher", "admin"):
        raise HTTPException(403)
    s = db.query(BingoSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    s.called_indices = []
    s.status = "waiting"
    for card in s.cards:
        card.marked_positions = []
        card.has_bingo = False
    db.commit()
    db.refresh(s)
    await _mgr.broadcast_all(code, {"event": "reset"})
    await _mgr.broadcast_all(code, _session_state(s, db, players=_mgr.player_list(code)))


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
def get_or_create_card_rest(code: str, student_id: int, db: Session = Depends(get_db)):
    session = db.query(BingoSession).filter_by(code=code).first()
    if not session:
        raise HTTPException(404)
    card = _find_or_create_card(session, db, student_id=student_id)
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
    await ws.accept()
    session = db.query(BingoSession).filter_by(code=code).first()
    if not session:
        await ws.close(code=4004)
        return

    card: BingoCard | None = None

    if role == "student":
        if token:
            card = _find_or_create_card(session, db, anon_token=token, name=name)
            _mgr.add_student(code, card.id, ws, name=card.student_name, avatar=avatar)
        elif student_id:
            card = _find_or_create_card(session, db, student_id=student_id)
            _mgr.add_student(code, student_id, ws, name=card.student_name, avatar=avatar)
        db.refresh(session)
        await ws.send_json(_session_state(session, db, players=_mgr.player_list(code)))
        if card:
            await ws.send_json({"event": "card", **_card_dict(card, session)})
        await _mgr.broadcast_all(code, {"event": "players", "players": _mgr.player_list(code)})
    else:
        _mgr.add_teacher(code, ws)
        await ws.send_json(_session_state(session, db, players=_mgr.player_list(code)))

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
                    await _mgr.broadcast_all(code, {"event": "started"})

                elif action == "call_next" and session.status == "active":
                    remaining = [i for i in range(len(session.pairs)) if i not in session.called_indices]
                    if not remaining:
                        continue
                    idx = random.choice(remaining)
                    session.called_indices = session.called_indices + [idx]
                    db.commit()
                    pair = session.pairs[idx]
                    await _mgr.broadcast_all(code, {
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
                    await _mgr.broadcast_all(code, {"event": "reset"})
                    await _mgr.broadcast_all(code, _session_state(session, db, players=_mgr.player_list(code)))

                elif action == "close":
                    session.status = "closed"
                    called_set = set(session.called_indices)
                    db.commit()
                    await _mgr.broadcast_all(code, {"event": "closed"})
                    # Award points per student card based on % correctly marked
                    if session.max_points > 0 and called_set:
                        for card in session.cards:
                            called_positions = [
                                i for i, pair_idx in enumerate(card.grid_indices) if pair_idx in called_set
                            ]
                            if not called_positions:
                                continue
                            correctly_marked = len(set(card.marked_positions) & set(called_positions))
                            ratio = correctly_marked / len(called_positions)
                            pts = round(ratio * session.max_points)
                            mgr_key = card.student_id if card.student_id else card.id
                            await _mgr.send_student(code, mgr_key, {
                                "event": "score", "points": pts, "ratio": ratio,
                                "max_points": session.max_points,
                                "correct": correctly_marked, "total_called": len(called_positions),
                            })
                            if pts > 0 and card.student_id:
                                student = db.get(Student, card.student_id)
                                if student and student.class_id:
                                    db.add(Transaction(
                                        teacher_id=session.created_by, class_id=student.class_id,
                                        points=pts,
                                        reason=f"Bingo: {session.title} ({round(ratio * 100)}%)",
                                    ))
                        db.commit()

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
                            await _mgr.broadcast_teachers(code, {
                                "event": "line",
                                "student_name": card.student_name,
                                "line": line,
                            })
                        if not card.has_bingo and _check_bingo(card.marked_positions, rows, cols):
                            card.has_bingo = True
                            db.commit()
                            await ws.send_json({"event": "bingo", "marked_positions": card.marked_positions})
                            await _mgr.broadcast_teachers(code, {
                                "event": "player_bingo",
                                "student_name": card.student_name,
                            })
                            await _mgr.broadcast_all(code, {
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
            await _mgr.broadcast_all(code, {"event": "players", "players": _mgr.player_list(code)})
        else:
            _mgr.remove_teacher(code, ws)
