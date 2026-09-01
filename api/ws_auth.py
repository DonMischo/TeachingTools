"""Server-side identity resolution for WebSocket connections.

WebSockets can't use FastAPI's Depends-based auth, so each game/tool WS
handler calls ws_identity() to resolve who is actually connected from the
session cookie / bearer token — never from client-supplied query params
like role= or student_id=, which are trivially spoofable from dev tools.

Guests (QR join) legitimately have no identity; handlers that support
guest play treat a None result as "anonymous player", but must NEVER
grant teacher/host control without a verified Teacher identity.
"""
from fastapi import HTTPException, WebSocket
from sqlalchemy.orm import Session

from .auth import Guest, _check_revocation, _decode_token, decode_guest_token
from .models import Student, Teacher


def ws_identity(websocket: WebSocket, db: Session) -> tuple[str, int] | None:
    """Resolve ("teacher"|"student", id) from the connection's own session
    cookie or Authorization header. Returns None if not logged in or the
    token is invalid/revoked."""
    token = websocket.cookies.get("hp_session")
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = _decode_token(token)
        _check_revocation(payload.get("jti"), db)
    except HTTPException:
        return None
    # Gast-Token sind keine Anmeldung. Sie tragen eine UUID als `sub`, an der
    # das int() unten zerbräche — und eine unbehandelte Ausnahme im WS-Handler
    # bedeutet: kein accept, kein close, der Client wartet ewig.
    if payload.get("type") == "guest":
        return None
    sub = int(payload["sub"])
    if payload.get("type", "teacher") == "student":
        student = db.get(Student, sub)
        return ("student", student.id) if student and student.active else None
    teacher = db.get(Teacher, sub)
    return ("teacher", teacher.id) if teacher and teacher.active else None


def ws_teacher(websocket: WebSocket, db: Session) -> Teacher | None:
    """Return the verified Teacher for this connection, or None."""
    identity = ws_identity(websocket, db)
    if not identity or identity[0] != "teacher":
        return None
    return db.get(Teacher, identity[1])


def ws_guest(websocket: WebSocket, code: str, db: Session | None = None) -> Guest | None:
    """Return the Guest for a valid, unexpired guest token scoped to `code`, else
    None. The token comes from the `guest_token` query param (preferred, since JS
    can't set WS headers) or an Authorization: Bearer header.

    `db` mitgeben, damit ein von der Lehrkraft neugestarteter Gastzugang auch
    hier greift — sonst bliebe eine offene Verbindung ueber den Neustart hinweg
    per Wiederverbinden erneuerbar."""
    token = websocket.query_params.get("guest_token")
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:]
    if not token:
        return None
    return decode_guest_token(token, code, db)
