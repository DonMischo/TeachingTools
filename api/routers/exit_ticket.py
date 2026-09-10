"""
Exit Ticket — anonymous quick feedback after a lesson.

Flow:
  1. Teacher POST /api/exit-ticket  → session with code
  2. Students scan QR → connect WS as student and submit
  3. Teacher sees responses live via WS
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ExitTicketSession, ExitTicketResponse, Student, Teacher
from ..auth import get_current_teacher, get_current_user_optional, is_session_owner
from ..availability import require_capability
from ..utils import gen_code
from ..ws_auth import ws_teacher, ws_identity, ws_guest
from ..ws_manager import RoomManager
from ..display_names import abbreviate_stored, short_name

router = APIRouter(prefix="/api/exit-ticket", tags=["exit-ticket"])

mgr = RoomManager()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _response_dict(r: ExitTicketResponse) -> dict:
    return {
        "id": r.id,
        # Auch der Altbestand, der noch ausgeschrieben in der Tabelle steht.
        "student_name": abbreviate_stored(r.student_name),
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


@router.post("", status_code=201, dependencies=[Depends(require_capability("exit-ticket", "host"))])
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = ExitTicketSession(
        code=gen_code(db, ExitTicketSession),
        title=body.title,
        question=body.question,
        rating_enabled=body.rating_enabled,
        created_by=current.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "code": s.code}


def clone_session_impl(db: Session, code: str, teacher: Teacher) -> ExitTicketSession:
    """Start a fresh session by copying an own exit-ticket's question — shared
    by the REST endpoint and the Stundenplaner tool registry. Exit-tickets are
    creator-only (no sharing), so cloning someone else's is not allowed."""
    template = db.query(ExitTicketSession).filter_by(code=code).first()
    if not template:
        raise HTTPException(404, "Session not found")
    if template.created_by != teacher.id:
        raise HTTPException(403)

    s = ExitTicketSession(
        code=gen_code(db, ExitTicketSession),
        title=template.title,
        question=template.question,
        rating_enabled=template.rating_enabled,
        created_by=teacher.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.post("/{code}/clone", status_code=201, dependencies=[Depends(require_capability("exit-ticket", "host"))])
def clone_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = clone_session_impl(db, code, current)
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

    # Host view requires a verified teacher (responses contain student names) —
    # und zwar die Lehrkraft, der die Sitzung gehoert. Die Rueckmeldungen sind
    # namentlich und handeln von *ihrer* Stunde; die Klasse schreibt sie in der
    # Erwartung, dass genau sie sie liest. Besitzerspalte hier: created_by.
    if role == "teacher":
        host = ws_teacher(websocket, db)
        if host is None or not is_session_owner(s, host, owner_attr="created_by"):
            await websocket.close(code=4003)
            return

    # Unauthenticated students must hold a live guest token scoped to this code
    # (only issued when the teacher opted in — enforces opt-in + 60-min expiry).
    if role != "teacher":
        identity = ws_identity(websocket, db)
        if identity is None and ws_guest(websocket, code, db) is None:
            await websocket.close(code=4001)
            return
        # `student_id` aus der Query ist eine Behauptung des Browsers. Die
        # Rueckmeldung wird darunter gespeichert — mit der Nummer eines
        # Mitschuelers liesse sich also in seinem Namen abgeben oder seine
        # Antwort ueberschreiben. Es zaehlt nur die Anmeldung.
        student_id = identity[1] if identity and identity[0] == "student" else 0

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
        await mgr.send_teachers(code, {"event": "participant_joined", "count": mgr.student_count(code)})

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
                    await mgr.send_teachers(code, {"event": "closed"})

            else:
                if action == "submit" and s.status == "open":
                    rating = data.get("rating")
                    comment = (data.get("comment") or "").strip()[:2000] or None
                    if rating is not None:
                        rating = max(1, min(5, int(rating)))

                    # Wer angemeldet ist, erscheint unter dem Namen seines
                    # Kontos in der Kurzform — nicht unter dem, den die Query
                    # behauptet. Gaeste behalten ihren getippten Namen, gekuerzt.
                    ich = db.get(Student, student_id) if student_id else None
                    name = short_name(ich) if ich else (abbreviate_stored(student_name)[:100] or "Anonym")

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
                    await mgr.send_teachers(code, {
                        "event": "new_response",
                        "response": _response_dict(existing),
                        "total": db.query(ExitTicketResponse).filter_by(session_id=s.id).count(),
                    })

    except WebSocketDisconnect:
        pass
    finally:
        if role == "teacher":
            mgr.remove_teacher(code, websocket)
        else:
            mgr.remove_student(code, student_id)
