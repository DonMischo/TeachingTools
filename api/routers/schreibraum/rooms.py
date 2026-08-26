import io
import logging
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from ...database import get_db
from ...models import (
    SchreibraumRoom, SchreibraumParticipant, SchreibraumDocument,
    SchreibraumActionLog, SchreibraumAccess, Teacher, Student, Class,
)
from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials
from ...auth import (
    get_current_user, get_current_teacher, require_admin,
    get_player, get_current_user_optional, guest_from_credentials, bearer, Guest,
)
from ...availability import require_capability
from ...utils import gen_code
from .colors import pick_color
from .schemas import (
    RoomCreate, RoomOut, RoomPatch, ParticipantOut,
    AccessGrantIn, AccessGrantOut, ActionLogOut,
)

router = APIRouter(prefix="/api/schreibraum", tags=["schreibraum"])


def _room_out(room: SchreibraumRoom, db: Session) -> RoomOut:
    creator = db.get(Teacher, room.created_by)
    grants = db.query(SchreibraumAccess).filter_by(room_id=room.id).all()
    access = []
    for g in grants:
        if g.student_id:
            s = db.get(Student, g.student_id)
            access.append(AccessGrantOut(
                id=g.id, room_id=room.id,
                student_id=g.student_id,
                label=f"{s.vorname} {s.nachname}" if s else str(g.student_id),
            ))
        elif g.class_id:
            c = db.get(Class, g.class_id)
            access.append(AccessGrantOut(
                id=g.id, room_id=room.id,
                class_id=g.class_id,
                label=c.code if c else str(g.class_id),
            ))
    return RoomOut(
        id=room.id,
        code=room.code,
        title=room.title,
        mode=room.mode,
        is_permanent=room.is_permanent,
        allow_guests=room.allow_guests,
        created_by=room.created_by,
        creator_name=f"{creator.first_name} {creator.last_name}" if creator else "",
        created_at=room.created_at,
        access=access,
    )


# ---------------------------------------------------------------------------
# Room CRUD
# ---------------------------------------------------------------------------

@router.post("/rooms", response_model=RoomOut, dependencies=[Depends(require_capability("schreibraum", "create"))])
def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    code = gen_code(db, SchreibraumRoom)

    room = SchreibraumRoom(
        code=code,
        title=body.title,
        mode=body.mode,
        is_permanent=body.is_permanent,
        created_by=teacher.id,
    )
    db.add(room)
    db.flush()

    # Create teacher participant record so they can immediately join via WS
    teacher_p = SchreibraumParticipant(
        room_id=room.id,
        teacher_id=teacher.id,
        name=f"{teacher.first_name} {teacher.last_name}",
        color="#374151",
        is_teacher=True,
    )
    db.add(teacher_p)
    db.add(SchreibraumDocument(room_id=room.id))
    db.commit()
    db.refresh(room)
    return _room_out(room, db)


@router.get("/rooms", response_model=list[RoomOut])
def list_rooms(
    created_by: int | None = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if isinstance(user, Teacher):
        # Teachers see all rooms; optionally filter by creator
        q = db.query(SchreibraumRoom)
        if created_by:
            q = q.filter_by(created_by=created_by)
        rooms = q.order_by(SchreibraumRoom.created_at.desc()).all()
    else:
        # Students only see rooms they have explicit access to
        student: Student = user
        class_id = student.class_id
        grants = db.query(SchreibraumAccess).filter(
            or_(
                SchreibraumAccess.student_id == student.id,
                SchreibraumAccess.class_id == class_id,
            )
        ).all()
        room_ids = {g.room_id for g in grants}
        rooms = db.query(SchreibraumRoom).filter(
            SchreibraumRoom.id.in_(room_ids)
        ).order_by(SchreibraumRoom.created_at.desc()).all()

    return [_room_out(r, db) for r in rooms]


@router.get("/rooms/by-code/{code}", response_model=RoomOut)
def get_room_by_code(
    code: str,
    db: Session = Depends(get_db),
    user=Depends(get_player),
):
    room = db.query(SchreibraumRoom).filter_by(code=code.upper()).first()
    if not room:
        raise HTTPException(404, "Room not found")
    _assert_access(room, user, db)
    return _room_out(room, db)


@router.get("/rooms/{room_id}", response_model=RoomOut)
def get_room(
    room_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    _assert_access(room, user, db)
    return _room_out(room, db)


@router.patch("/rooms/{room_id}", response_model=RoomOut)
def patch_room(
    room_id: str,
    body: RoomPatch,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if body.title is not None:
        room.title = body.title
    if body.mode is not None:
        room.mode = body.mode
    if body.is_permanent is not None:
        room.is_permanent = body.is_permanent
    db.commit()
    db.refresh(room)
    return _room_out(room, db)


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(
    room_id: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if room.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "You can only delete your own rooms")
    db.delete(room)
    db.commit()


# ---------------------------------------------------------------------------
# Access grants
# ---------------------------------------------------------------------------

@router.get("/rooms/{room_id}/access", response_model=list[AccessGrantOut])
def list_access(
    room_id: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    grants = db.query(SchreibraumAccess).filter_by(room_id=room_id).all()
    result = []
    for g in grants:
        label = ""
        if g.student_id:
            s = db.get(Student, g.student_id)
            label = f"{s.vorname} {s.nachname}" if s else str(g.student_id)
        elif g.class_id:
            c = db.get(Class, g.class_id)
            label = c.code if c else str(g.class_id)
        result.append(AccessGrantOut(
            id=g.id, room_id=room_id,
            student_id=g.student_id, class_id=g.class_id, label=label,
        ))
    return result


@router.post("/rooms/{room_id}/access", response_model=AccessGrantOut, status_code=201)
def add_access(
    room_id: str,
    body: AccessGrantIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    if not body.student_id and not body.class_id:
        raise HTTPException(422, "Provide student_id or class_id")
    grant = SchreibraumAccess(
        room_id=room_id,
        student_id=body.student_id,
        class_id=body.class_id,
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    label = ""
    if grant.student_id:
        s = db.get(Student, grant.student_id)
        label = f"{s.vorname} {s.nachname}" if s else str(grant.student_id)
    elif grant.class_id:
        c = db.get(Class, grant.class_id)
        label = c.code if c else str(grant.class_id)
    return AccessGrantOut(
        id=grant.id, room_id=room_id,
        student_id=grant.student_id, class_id=grant.class_id, label=label,
    )


@router.delete("/rooms/{room_id}/access/{grant_id}", status_code=204)
def remove_access(
    room_id: str,
    grant_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    grant = db.get(SchreibraumAccess, grant_id)
    if not grant or grant.room_id != room_id:
        raise HTTPException(404)
    db.delete(grant)
    db.commit()


# ---------------------------------------------------------------------------
# Join — issues a session_token for the WS connection
# ---------------------------------------------------------------------------

@router.post("/rooms/{room_id}/join", response_model=ParticipantOut)
def join_room(
    room_id: str,
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    # Path carries room_id, not the code, so resolve identity manually: a logged-in
    # user, or a guest whose token is scoped to this room's code.
    user = get_current_user_optional(request, credentials, db)
    if user is None:
        user = guest_from_credentials(credentials, room.code)
    if user is None:
        raise HTTPException(401, "Not authenticated")
    _assert_access(room, user, db)

    is_teacher = isinstance(user, Teacher)
    is_guest = isinstance(user, Guest)
    teacher_id = user.id if is_teacher else None
    student_id = user.id if isinstance(user, Student) else None
    guest_id = user.id if is_guest else None
    name = (
        user.name if is_guest
        else f"{user.first_name} {user.last_name}" if is_teacher
        else f"{user.vorname} {user.nachname}"
    )

    # Reuse existing participant if already joined this room
    existing = db.query(SchreibraumParticipant).filter_by(
        room_id=room_id,
        teacher_id=teacher_id,
        student_id=student_id,
        guest_id=guest_id,
    ).first()

    if existing:
        if existing.is_kicked:
            now = datetime.now(timezone.utc)
            if existing.kicked_at and now - existing.kicked_at.replace(tzinfo=timezone.utc) < timedelta(minutes=2):
                secs = int((timedelta(minutes=2) - (now - existing.kicked_at.replace(tzinfo=timezone.utc))).total_seconds())
                raise HTTPException(403, f"Warte noch {secs} Sekunden")
            if not existing.rejoin_allowed:
                raise HTTPException(403, "Du wurdest gekickt")
            existing.is_kicked = False
            existing.kicked_at = None
            db.commit()
        return ParticipantOut.model_validate(existing)

    used = [p.color for p in db.query(SchreibraumParticipant).filter_by(room_id=room_id).all()]
    color = "#374151" if is_teacher else pick_color(used)

    p = SchreibraumParticipant(
        room_id=room_id,
        teacher_id=teacher_id,
        student_id=student_id,
        guest_id=guest_id,
        name=name,
        color=color,
        is_teacher=is_teacher,
    )
    db.add(p)
    db.add(SchreibraumActionLog(room_id=room_id, participant_name=name, action="join"))
    db.commit()
    db.refresh(p)
    return ParticipantOut.model_validate(p)


# ---------------------------------------------------------------------------
# Participants list + kick + rejoin-toggle
# ---------------------------------------------------------------------------

@router.get("/rooms/{room_id}/participants", response_model=list[ParticipantOut])
def list_participants(
    room_id: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    participants = db.query(SchreibraumParticipant).filter_by(room_id=room_id).all()
    return [ParticipantOut.model_validate(p) for p in participants]


@router.post("/rooms/{room_id}/participants/{participant_id}/kick", status_code=204)
async def kick_participant(
    room_id: str,
    participant_id: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    # async because closing the participant's socket needs the running event
    # loop — a sync route runs in a worker thread, where there is none.
    p = db.get(SchreibraumParticipant, participant_id)
    if not p or p.room_id != room_id:
        raise HTTPException(404)
    if p.is_teacher:
        raise HTTPException(400, "Cannot kick a teacher")
    p.is_kicked = True
    p.kicked_at = datetime.now(timezone.utc)
    db.commit()
    # Signal the WS handler to close this connection
    from .collab import kick_ws
    await kick_ws(participant_id)


@router.post("/rooms/{room_id}/participants/{participant_id}/rejoin-toggle", status_code=204)
def rejoin_toggle(
    room_id: str,
    participant_id: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    p = db.get(SchreibraumParticipant, participant_id)
    if not p or p.room_id != room_id:
        raise HTTPException(404)
    p.rejoin_allowed = not p.rejoin_allowed
    db.commit()


# ---------------------------------------------------------------------------
# Action log
# ---------------------------------------------------------------------------

@router.get("/rooms/{room_id}/log", response_model=list[ActionLogOut])
def get_log(
    room_id: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    logs = (
        db.query(SchreibraumActionLog)
        .filter_by(room_id=room_id)
        .order_by(SchreibraumActionLog.ts.desc())
        .limit(200)
        .all()
    )
    return [ActionLogOut.model_validate(l) for l in logs]


# ---------------------------------------------------------------------------
# Document save/load
# ---------------------------------------------------------------------------

@router.post("/rooms/{room_id}/document/save", status_code=204)
def save_document(
    room_id: str,
    ydoc_state: bytes,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not isinstance(user, Teacher):
        raise HTTPException(403)
    doc = db.query(SchreibraumDocument).filter_by(room_id=room_id).first()
    if not doc:
        raise HTTPException(404)
    doc.ydoc_state = ydoc_state
    db.commit()


@router.get("/rooms/{room_id}/document")
def get_document(
    room_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    _assert_access(room, user, db)
    doc = db.query(SchreibraumDocument).filter_by(room_id=room_id).first()
    if not doc or not doc.ydoc_state:
        return {"ydoc_state": None}
    import base64
    return {"ydoc_state": base64.b64encode(doc.ydoc_state).decode()}


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------

from ...upload_utils import ALLOWED_MIMES, ALLOWED_EXTENSIONS, MAX_FILE_BYTES

FILES_BASE = Path(__file__).parent.parent.parent.parent / "data" / "schreibraum"


@router.post("/rooms/{room_id}/files")
async def upload_file(
    room_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    _assert_access(room, user, db)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Dateityp nicht erlaubt: {ext}")
    if file.content_type and file.content_type not in ALLOWED_MIMES:
        raise HTTPException(400, f"MIME-Typ nicht erlaubt: {file.content_type}")

    data = await file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(413, "Datei zu groß (max 20 MB)")

    dest_dir = FILES_BASE / room_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = uuid.uuid4().hex + ext
    (dest_dir / safe_name).write_bytes(data)

    url = f"/uploads/schreibraum/{room_id}/{safe_name}"
    return {
        "url": url,
        "filename": file.filename,
        "content_type": file.content_type,
        "is_image": file.content_type.startswith("image/") if file.content_type else ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"},
    }


# ---------------------------------------------------------------------------
# Export (DOCX / TeX via pandoc)
# ---------------------------------------------------------------------------

class ExportBody(BaseModel):
    html: str
    title: str = "Dokument"


_EXPORT_FORMATS = {
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
    "tex":  ("application/x-tex", ".tex"),
    "latex": ("application/x-tex", ".tex"),
}


@router.post("/rooms/{room_id}/export/{fmt}")
async def export_document(
    room_id: str,
    fmt: str,
    body: ExportBody,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if fmt not in _EXPORT_FORMATS:
        raise HTTPException(400, f"Format nicht unterstützt: {fmt}. Erlaubt: docx, tex")

    room = db.get(SchreibraumRoom, room_id)
    if not room:
        raise HTTPException(404)
    _assert_access(room, user, db)

    mime, ext = _EXPORT_FORMATS[fmt]
    is_latex = fmt in ("tex", "latex")
    extra_args = ["--standalone", f"--metadata=title:{body.title}"]

    try:
        import pypandoc
        if is_latex:
            data = pypandoc.convert_text(body.html, "latex", format="html",
                                         extra_args=extra_args).encode("utf-8")
        else:
            # pypandoc refuses binary targets without an outputfile, so docx has
            # to go through a temp file and be read back.
            import tempfile
            with tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / f"export{ext}"
                pypandoc.convert_text(body.html, "docx", format="html",
                                      outputfile=str(out), extra_args=extra_args)
                data = out.read_bytes()
    except Exception as exc:
        logging.getLogger(__name__).error("Export failed: %s", exc)
        raise HTTPException(500, "Export fehlgeschlagen — pandoc nicht verfügbar?")

    safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in body.title)[:60] or "dokument"
    filename = f"{safe_title}{ext}"

    return StreamingResponse(
        io.BytesIO(data),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _assert_access(room: SchreibraumRoom, user, db: Session) -> None:
    """Raise 403 if user is not allowed in this room."""
    if isinstance(user, Teacher):
        return  # all teachers can enter all rooms
    if isinstance(user, Guest):
        if room.allow_guests:
            return
        raise HTTPException(403, "Gäste sind für diesen Raum nicht freigeschaltet")
    student: Student = user
    class_id = student.class_id
    grant = db.query(SchreibraumAccess).filter(
        SchreibraumAccess.room_id == room.id,
        or_(
            SchreibraumAccess.student_id == student.id,
            SchreibraumAccess.class_id == class_id,
        )
    ).first()
    if not grant:
        raise HTTPException(403, "Kein Zugang zu diesem Raum")
