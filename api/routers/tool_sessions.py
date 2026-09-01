"""Join sessions for tools that keep no state of their own.

Abakus, Gleichungswaage, Bildformate and the Tippen trainer run entirely in the
browser: there is nothing to host, no answers to collect, no live state. A ToolSession exists only so the
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
from ..auth import get_current_teacher, get_player
from ..models import Teacher, TimelineSet, ToolSession
from ..utils import gen_code
from .. import availability, tool_catalog

router = APIRouter(prefix="/api/tool-sessions", tags=["tool-sessions"])

# Tools that can be joined this way — everything that runs purely client-side.
SESSION_TOOLS = ("abacus", "gleichungswaage", "bildformate", "tippen", "zeitstrahl",
                 "vierecke", "binaerrechner", "funktionen")

# Werkzeuge, die einen konkreten Inhalt teilen statt nur sich selbst. Der
# Zeitstrahl ist eine Bibliothek: geteilt wird immer *eine* Zeitleiste, also
# gehoert ihre Id zur Sitzung — und je Zeitleiste gibt es einen eigenen Code.
REF_TOOLS = {"zeitstrahl": TimelineSet}


class ToolSessionOut(BaseModel):
    code: str
    tool_slug: str
    allow_guests: bool
    status: str = "open"
    ref_id: int | None = None
    ref_title: str | None = None


class ToolSessionIn(BaseModel):
    tool_slug: str
    ref_id: int | None = None


def _check_slug(slug: str) -> None:
    if slug not in SESSION_TOOLS:
        raise HTTPException(400, f"Für »{slug}« gibt es keine Beitritts-Sitzung.")
    if slug not in tool_catalog.BY_SLUG:
        raise HTTPException(404, f"Unbekanntes Werkzeug: {slug}")


def _ref_title(session: ToolSession, db: Session) -> str | None:
    """Titel des geteilten Inhalts, damit die Sitzungsliste nicht nur Ids zeigt."""
    model = REF_TOOLS.get(session.tool_slug)
    if not model or session.ref_id is None:
        return None
    row = db.get(model, session.ref_id)
    return row.title if row else None


def _out(session: ToolSession, db: Session) -> ToolSessionOut:
    return ToolSessionOut(
        code=session.code,
        tool_slug=session.tool_slug,
        allow_guests=session.allow_guests,
        status=session.status,
        ref_id=session.ref_id,
        ref_title=_ref_title(session, db),
    )


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

    ref_model = REF_TOOLS.get(body.tool_slug)
    if ref_model is not None:
        if body.ref_id is None:
            raise HTTPException(422, "Für dieses Werkzeug fehlt der Inhalt.")
        if db.get(ref_model, body.ref_id) is None:
            raise HTTPException(404, "Inhalt nicht gefunden")
    ref_id = body.ref_id if ref_model is not None else None

    session = (
        db.query(ToolSession)
        .filter_by(created_by=teacher.id, tool_slug=body.tool_slug, ref_id=ref_id)
        .order_by(ToolSession.created_at.desc())
        .first()
    )
    if not session:
        session = ToolSession(
            code=gen_code(db, ToolSession),
            tool_slug=body.tool_slug,
            created_by=teacher.id,
            ref_id=ref_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    return _out(session, db)


@router.get("/{code}", response_model=ToolSessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    """Public: the join screen has to read this before anyone is logged in. It
    reveals only which tool the code opens and whether guests are let in."""
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    return _out(session, db)


@router.get("/{code}/content")
def session_content(code: str, db: Session = Depends(get_db), _player=Depends(get_player)):
    """Der geteilte Inhalt einer Sitzung — fuer Gaeste der einzige Weg dorthin.

    `/api/timelines/{id}` bleibt angemeldeten Nutzern vorbehalten; wer per QR
    kommt, hat kein Konto und kommt nur ueber diesen Code an genau die eine
    Zeitleiste, die die Lehrkraft geteilt hat.
    """
    from .timelines import _to_detail

    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")

    model = REF_TOOLS.get(session.tool_slug)
    if model is None or session.ref_id is None:
        raise HTTPException(404, "Diese Sitzung teilt keinen Inhalt")
    row = db.get(model, session.ref_id)
    if row is None:
        raise HTTPException(404, "Inhalt nicht gefunden")
    return _to_detail(row)
