"""
Meinungsbarometer — live scale-question sessions.

Flow:
  1. Teacher POST /api/barometer  → session with questions, gets code
  2. Students scan QR → GET /api/barometer/{code} to verify, then connect WS
  3. WS /api/barometer/{code}/ws?role=teacher|student (identity from session cookie)
  4. Teacher sends: show_question / show_results / next / close
  5. Students send: respond {question_id, value}
"""
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BarometerSession, BarometerQuestion, BarometerResponse, Student, Teacher
from ..auth import get_current_teacher, get_current_user_optional
from ..utils import gen_code
from ..ws_auth import ws_identity
from ..ws_manager import RoomManager

router = APIRouter(prefix="/api/barometer", tags=["barometer"])

mgr = RoomManager()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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
    shared: bool = False


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
    shared: bool
    questions: list[QuestionOut]

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    id: int
    code: str
    title: str
    status: str
    question_count: int
    created_at: datetime
    shared: bool
    created_by: int
    created_by_name: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SessionSummary])
def list_sessions(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    q = db.query(BarometerSession)
    if current.role != "admin":
        q = q.filter(or_(BarometerSession.created_by == current.id, BarometerSession.shared == True))  # noqa: E712
    sessions = q.order_by(BarometerSession.created_at.desc()).all()
    return [
        SessionSummary(
            id=s.id, code=s.code, title=s.title, status=s.status,
            question_count=len(s.questions), created_at=s.created_at,
            shared=s.shared, created_by=s.created_by,
            created_by_name=f"{s.creator.first_name} {s.creator.last_name}" if s.creator else "?",
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
        code=gen_code(db, BarometerSession),
        title=body.title,
        created_by=current.id,
        shared=body.shared,
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


def clone_session_impl(db: Session, code: str, teacher: Teacher) -> BarometerSession:
    """Start a fresh session by copying an existing (own or shared) one's
    questions — shared by the REST endpoint and the Stundenplaner tool
    registry. Permission check (owner or shared) lives here."""
    template = db.query(BarometerSession).filter_by(code=code).first()
    if not template:
        raise HTTPException(404, "Session not found")
    if template.created_by != teacher.id and not template.shared:
        raise HTTPException(403)

    session = BarometerSession(
        code=gen_code(db, BarometerSession),
        title=template.title,
        created_by=teacher.id,
        shared=False,
    )
    db.add(session)
    db.flush()
    for q in template.questions:
        db.add(BarometerQuestion(
            session_id=session.id,
            order=q.order,
            text=q.text,
            scale_min=q.scale_min,
            scale_max=q.scale_max,
            scale_min_label=q.scale_min_label,
            scale_max_label=q.scale_max_label,
        ))
    db.commit()
    db.refresh(session)
    return session


@router.post("/{code}/clone", response_model=SessionOut, status_code=201)
def clone_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    return clone_session_impl(db, code, current)


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


@router.patch("/{code}", response_model=SessionOut)
def update_session(
    code: str,
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Replace title/questions/shared of an existing session (creator or admin only).
    Existing responses are dropped since they're keyed to the old question rows."""
    if not body.questions:
        raise HTTPException(400, "At least one question required")
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)

    s.title = body.title
    s.shared = body.shared
    for q in list(s.questions):
        db.delete(q)
    db.flush()
    for i, q in enumerate(body.questions):
        db.add(BarometerQuestion(
            session_id=s.id, order=i, text=q.text,
            scale_min=q.scale_min, scale_max=q.scale_max,
            scale_min_label=q.scale_min_label, scale_max_label=q.scale_max_label,
        ))
    s.current_question_idx = -1
    s.results_visible = False
    db.commit()
    db.refresh(s)
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
    db: Session = Depends(get_db),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        await websocket.close(code=4004)
        return

    # Identity comes from the connection's own session cookie/token, never
    # from client-supplied query params — otherwise a participant could
    # spoof another student_id (or reuse several) to vote more than once.
    identity = ws_identity(websocket, db)
    if not identity:
        await websocket.close(code=4001)
        return
    ident_role, ident_id = identity

    if role == "teacher":
        teacher = db.get(Teacher, ident_id) if ident_role == "teacher" else None
        if not teacher or (s.created_by != teacher.id and teacher.role != "admin"):
            await websocket.close(code=4003)
            return
        student_id = 0
    else:
        if ident_role != "student":
            await websocket.close(code=4003)
            return
        student_id = ident_id

    await websocket.accept()

    if role == "teacher":
        mgr.add_teacher(code, websocket)
        await websocket.send_json({**_state_msg(s), "participants": mgr.student_count(code)})
    else:
        mgr.add_student(code, student_id, websocket)
        await websocket.send_json(_state_msg(s))
        await mgr.send_teachers(code, {"event": "participant_joined", "count": mgr.student_count(code)})

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

                elif action == "restart":
                    s.status = "active"
                    s.current_question_idx = -1
                    s.results_visible = False
                    db.query(BarometerResponse).filter_by(session_id=s.id).delete()
                    db.commit()
                    db.refresh(s)
                    await mgr.broadcast(code, {**_state_msg(s), "reset": True})

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
                    await mgr.send_teachers(code, {
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
            mgr.remove_teacher(code, websocket)
        else:
            mgr.remove_student(code, student_id)
