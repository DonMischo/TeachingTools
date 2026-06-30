"""
Meinungsbarometer — live scale-question sessions.

Flow:
  1. Teacher POST /api/barometer  → session with questions, gets code
  2. Students scan QR → GET /api/barometer/{code} to verify, then connect WS
  3. WS /api/barometer/{code}/ws?role=teacher|student&student_id=N
  4. Teacher sends: show_question / show_results / next / close
  5. Students send: respond {question_id, value}
"""
import random
import string
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BarometerSession, BarometerQuestion, BarometerResponse, Student, Teacher
from ..auth import get_current_teacher, get_current_user_optional

router = APIRouter(prefix="/api/barometer", tags=["barometer"])


# ---------------------------------------------------------------------------
# In-memory WS manager
# ---------------------------------------------------------------------------

class _BarometerManager:
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

    async def broadcast(self, code: str, msg: dict):
        r = self._rooms.get(code, {})
        targets = list(r.get("students", {}).values())
        if t := r.get("teacher"):
            targets.append(t)
        for ws in targets:
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def send_teacher(self, code: str, msg: dict):
        r = self._rooms.get(code, {})
        if ws := r.get("teacher"):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    def student_count(self, code: str) -> int:
        return len(self._rooms.get(code, {}).get("students", {}))


mgr = _BarometerManager()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gen_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        c = "".join(random.choices(chars, k=6))
        if not db.query(BarometerSession).filter_by(code=c).first():
            return c
    raise RuntimeError("Could not generate code")


def _distribution(session: BarometerSession, question_id: int) -> dict[int, int]:
    dist: dict[int, int] = defaultdict(int)
    for r in session.responses:
        if r.question_id == question_id:
            dist[r.value] += 1
    return dict(dist)


def _question_msg(q: BarometerQuestion, idx: int, total: int) -> dict:
    return {
        "event": "question",
        "index": idx,
        "total": total,
        "question": {
            "id": q.id,
            "text": q.text,
            "scale_min": q.scale_min,
            "scale_max": q.scale_max,
            "scale_min_label": q.scale_min_label,
            "scale_max_label": q.scale_max_label,
        },
    }


def _results_msg(session: BarometerSession, question_id: int) -> dict:
    return {
        "event": "results",
        "question_id": question_id,
        "distribution": _distribution(session, question_id),
        "count": sum(_distribution(session, question_id).values()),
    }


def _state_msg(session: BarometerSession) -> dict:
    q_idx = session.current_question_idx
    total = len(session.questions)
    base: dict = {
        "event": "state",
        "status": session.status,
        "current_question_idx": q_idx,
        "results_visible": session.results_visible,
        "total_questions": total,
    }
    if q_idx >= 0 and q_idx < total:
        q = session.questions[q_idx]
        base["question"] = {
            "id": q.id,
            "text": q.text,
            "scale_min": q.scale_min,
            "scale_max": q.scale_max,
            "scale_min_label": q.scale_min_label,
            "scale_max_label": q.scale_max_label,
        }
        if session.results_visible:
            base["distribution"] = _distribution(session, q.id)
    return base


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class QuestionIn(BaseModel):
    text: str
    scale_min: int = 1
    scale_max: int = 6
    scale_min_label: str | None = None
    scale_max_label: str | None = None


class SessionCreate(BaseModel):
    title: str
    questions: list[QuestionIn]


class QuestionOut(BaseModel):
    id: int
    order: int
    text: str
    scale_min: int
    scale_max: int
    scale_min_label: str | None
    scale_max_label: str | None

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    code: str
    title: str
    status: str
    current_question_idx: int
    results_visible: bool
    questions: list[QuestionOut]

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    id: int
    code: str
    title: str
    status: str
    question_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SessionSummary])
def list_sessions(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    sessions = (
        db.query(BarometerSession)
        .filter_by(created_by=current.id)
        .order_by(BarometerSession.created_at.desc())
        .all()
    )
    return [
        SessionSummary(
            id=s.id, code=s.code, title=s.title, status=s.status,
            question_count=len(s.questions), created_at=s.created_at,
        )
        for s in sessions
    ]


@router.post("", response_model=SessionOut, status_code=201)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if not body.questions:
        raise HTTPException(400, "At least one question required")
    session = BarometerSession(
        code=_gen_code(db),
        title=body.title,
        created_by=current.id,
    )
    db.add(session)
    db.flush()
    for i, q in enumerate(body.questions):
        db.add(BarometerQuestion(
            session_id=session.id,
            order=i,
            text=q.text,
            scale_min=q.scale_min,
            scale_max=q.scale_max,
            scale_min_label=q.scale_min_label,
            scale_max_label=q.scale_max_label,
        ))
    db.commit()
    db.refresh(session)
    return session


@router.get("/{code}", response_model=SessionOut)
def get_session(
    code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.delete("/{code}", status_code=204)
def delete_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
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
async def barometer_ws(
    code: str,
    websocket: WebSocket,
    role: str = "student",
    student_id: int = 0,
    db: Session = Depends(get_db),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        await websocket.close(code=4004)
        return

    await websocket.accept()

    if role == "teacher":
        mgr.add_teacher(code, websocket)
        await websocket.send_json({**_state_msg(s), "participants": mgr.student_count(code)})
    else:
        student = db.get(Student, student_id) if student_id else None
        mgr.add_student(code, student_id, websocket)
        await websocket.send_json(_state_msg(s))
        await mgr.send_teacher(code, {"event": "participant_joined", "count": mgr.student_count(code)})

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            db.expire_all()
            s = db.query(BarometerSession).filter_by(code=code).first()
            if not s:
                break

            if role == "teacher":
                if action == "show_question":
                    idx = int(data.get("index", 0))
                    if 0 <= idx < len(s.questions):
                        s.current_question_idx = idx
                        s.results_visible = False
                        db.commit()
                        db.refresh(s)
                        await mgr.broadcast(code, _question_msg(s.questions[idx], idx, len(s.questions)))

                elif action == "show_results":
                    s.results_visible = True
                    db.commit()
                    db.refresh(s)
                    q = s.questions[s.current_question_idx]
                    await mgr.broadcast(code, _results_msg(s, q.id))

                elif action == "close":
                    s.status = "closed"
                    db.commit()
                    await mgr.broadcast(code, {"event": "closed"})

            else:
                if action == "respond":
                    qid = int(data.get("question_id", 0))
                    value = int(data.get("value", 1))
                    q = next((q for q in s.questions if q.id == qid), None)
                    if not q:
                        continue
                    value = max(q.scale_min, min(q.scale_max, value))
                    # Upsert response
                    existing = db.query(BarometerResponse).filter_by(
                        session_id=s.id, question_id=qid, student_id=student_id or None
                    ).first()
                    if existing:
                        existing.value = value
                    else:
                        db.add(BarometerResponse(
                            session_id=s.id,
                            question_id=qid,
                            student_id=student_id or None,
                            value=value,
                        ))
                    db.commit()
                    db.refresh(s)
                    # Notify teacher of updated distribution
                    await mgr.send_teacher(code, {
                        "event": "response_update",
                        "question_id": qid,
                        "distribution": _distribution(s, qid),
                        "count": sum(_distribution(s, qid).values()),
                    })
                    await websocket.send_json({"event": "response_ack", "question_id": qid, "value": value})

    except WebSocketDisconnect:
        pass
    finally:
        if role == "teacher":
            mgr.remove_teacher(code)
        else:
            mgr.remove_student(code, student_id)
