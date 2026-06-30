"""
Exit Ticket — anonymous quick feedback after a lesson.

Flow:
  1. Teacher POST /api/exit-ticket  → session with code
  2. Students scan QR → connect WS as student and submit
  3. Teacher sees responses live via WS
"""
import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ExitTicketSession, ExitTicketResponse, Student, Teacher
from ..auth import get_current_teacher, get_current_user_optional

router = APIRouter(prefix="/api/exit-ticket", tags=["exit-ticket"])


# ---------------------------------------------------------------------------
# In-memory WS manager
# ---------------------------------------------------------------------------

class _Manager:
    def __init__(self):
        self._rooms: dict[str, dict] = {}

    def _room(self, code: str) -> dict:
        if code not in self._rooms:
            self._rooms[code] = {"teacher": None, "students": {}}
        return self._rooms[code]

    def add_teacher(self, code: str, ws: WebSocket):
        self._room(code)["teacher"] = ws

    def add_student(self, code: str, sid: int, ws: WebSocket):
        self._room(code)["students"][sid] = ws

    def remove_teacher(self, code: str):
        r = self._rooms.get(code)
        if r:
            r["teacher"] = None

    def remove_student(self, code: str, sid: int):
        r = self._rooms.get(code)
        if r:
            r["students"].pop(sid, None)

    async def send_teacher(self, code: str, msg: dict):
        r = self._rooms.get(code, {})
        if ws := r.get("teacher"):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    def student_count(self, code: str) -> int:
        return len(self._rooms.get(code, {}).get("students", {}))


mgr = _Manager()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gen_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        c = "".join(random.choices(chars, k=6))
        if not db.query(ExitTicketSession).filter_by(code=c).first():
            return c
    raise RuntimeError("Could not generate code")


def _response_dict(r: ExitTicketResponse) -> dict:
    return {
        "id": r.id,
        "student_name": r.student_name,
        "rating": r.rating,
        "comment": r.comment,
        "submitted_at": r.submitted_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    title: str
    question: str
    rating_enabled: bool = True


class SessionSummary(BaseModel):
    id: int
    code: str
    title: str
    question: str
    rating_enabled: bool
    status: str
    response_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# REST
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SessionSummary])
def list_sessions(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    sessions = (
        db.query(ExitTicketSession)
        .filter_by(created_by=current.id)
        .order_by(ExitTicketSession.created_at.desc())
        .all()
    )
    return [
        SessionSummary(
            id=s.id, code=s.code, title=s.title, question=s.question,
            rating_enabled=s.rating_enabled, status=s.status,
            response_count=len(s.responses), created_at=s.created_at,
        )
        for s in sessions
    ]


@router.post("", status_code=201)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = ExitTicketSession(
        code=_gen_code(db),
        title=body.title,
        question=body.question,
        rating_enabled=body.rating_enabled,
        created_by=current.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "code": s.code}


@router.get("/{code}")
def get_session(
    code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    s = db.query(ExitTicketSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    return {
        "id": s.id, "code": s.code, "title": s.title, "question": s.question,
        "rating_enabled": s.rating_enabled, "status": s.status,
    }


@router.delete("/{code}", status_code=204)
def delete_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(ExitTicketSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    db.delete(s)
    db.commit()


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@router.websocket("/{code}/ws")
async def exit_ticket_ws(
    code: str,
    websocket: WebSocket,
    role: str = "student",
    student_id: int = 0,
    student_name: str = "Anonym",
    db: Session = Depends(get_db),
):
    s = db.query(ExitTicketSession).filter_by(code=code).first()
    if not s:
        await websocket.close(code=4004)
        return

    await websocket.accept()

    if role == "teacher":
        mgr.add_teacher(code, websocket)
        db.expire_all()
        s = db.query(ExitTicketSession).filter_by(code=code).first()
        await websocket.send_json({
            "event": "state",
            "status": s.status,
            "title": s.title,
            "question": s.question,
            "rating_enabled": s.rating_enabled,
            "responses": [_response_dict(r) for r in s.responses],
            "participant_count": mgr.student_count(code),
        })
    else:
        mgr.add_student(code, student_id, websocket)
        await websocket.send_json({
            "event": "state",
            "status": s.status,
            "title": s.title,
            "question": s.question,
            "rating_enabled": s.rating_enabled,
        })
        await mgr.send_teacher(code, {"event": "participant_joined", "count": mgr.student_count(code)})

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            db.expire_all()
            s = db.query(ExitTicketSession).filter_by(code=code).first()
            if not s:
                break

            if role == "teacher":
                if action == "close":
                    s.status = "closed"
                    db.commit()
                    await mgr.send_teacher(code, {"event": "closed"})

            else:
                if action == "submit" and s.status == "open":
                    rating = data.get("rating")
                    comment = (data.get("comment") or "").strip()[:2000] or None
                    if rating is not None:
                        rating = max(1, min(5, int(rating)))

                    name = student_name.strip()[:100] or "Anonym"

                    # Upsert by student_id (or by name if anonymous)
                    existing = None
                    if student_id:
                        existing = db.query(ExitTicketResponse).filter_by(
                            session_id=s.id, student_id=student_id
                        ).first()
                    if existing:
                        existing.rating = rating
                        existing.comment = comment
                        existing.submitted_at = datetime.now(timezone.utc)
                    else:
                        existing = ExitTicketResponse(
                            session_id=s.id,
                            student_id=student_id or None,
                            student_name=name,
                            rating=rating,
                            comment=comment,
                        )
                        db.add(existing)
                    db.commit()
                    db.refresh(existing)

                    await websocket.send_json({"event": "submitted"})
                    await mgr.send_teacher(code, {
                        "event": "new_response",
                        "response": _response_dict(existing),
                        "total": db.query(ExitTicketResponse).filter_by(session_id=s.id).count(),
                    })

    except WebSocketDisconnect:
        pass
    finally:
        if role == "teacher":
            mgr.remove_teacher(code)
        else:
            mgr.remove_student(code, student_id)
