"""Join sessions for tools that keep no state of their own.

Abakus and Gleichungswaage run entirely in the browser: there is nothing to
host, no answers to collect, no live state. A ToolSession exists only so the
teacher can hand out a code/QR — and so the usual per-session guest opt-in
applies to these tools too (see routers/guest.py, which resolves the key
"simulation" to this model).

The code is stable per teacher and tool: creating twice returns the same
session, so a QR printed for the wall keeps working.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_teacher
from ..models import Teacher, ToolSession
from ..utils import gen_code
from .. import availability, tool_catalog

router = APIRouter(prefix="/api/tool-sessions", tags=["tool-sessions"])

# Tools that can be joined this way — everything that runs purely client-side.
SESSION_TOOLS = ("abacus", "gleichungswaage")


class ToolSessionOut(BaseModel):
    code: str
    tool_slug: str
    allow_guests: bool


class ToolSessionIn(BaseModel):
    tool_slug: str


def _check_slug(slug: str) -> None:
    if slug not in SESSION_TOOLS:
        raise HTTPException(400, f"Für »{slug}« gibt es keine Beitritts-Sitzung.")
    if slug not in tool_catalog.BY_SLUG:
        raise HTTPException(404, f"Unbekanntes Werkzeug: {slug}")


@router.post("", status_code=201, response_model=ToolSessionOut)
def create_or_get(
    body: ToolSessionIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    """The teacher's session for one tool — created on first call, reused after."""
    _check_slug(body.tool_slug)
    if not availability.is_allowed(db, teacher, body.tool_slug, "use"):
        raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigegeben.")

    session = (
        db.query(ToolSession)
        .filter_by(created_by=teacher.id, tool_slug=body.tool_slug)
        .order_by(ToolSession.created_at.desc())
        .first()
    )
    if not session:
        session = ToolSession(
            code=gen_code(db, ToolSession),
            tool_slug=body.tool_slug,
            created_by=teacher.id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    return ToolSessionOut(code=session.code, tool_slug=session.tool_slug, allow_guests=session.allow_guests)


@router.get("/{code}", response_model=ToolSessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    """Public: the join screen has to read this before anyone is logged in. It
    reveals only which tool the code opens and whether guests are let in."""
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    return ToolSessionOut(code=session.code, tool_slug=session.tool_slug, allow_guests=session.allow_guests)
