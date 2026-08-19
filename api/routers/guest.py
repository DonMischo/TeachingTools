"""Guest join for QR / join-link players.

An unauthenticated user who scans a session's QR code (or opens its join link)
posts here with the code + the tool it belongs to and a chosen username. If the
session exists and its teacher has opted in (``allow_guests``), we hand back a
signed, session-scoped, 60-minute guest token. That token is the ONLY thing that
lets a guest reach the player endpoints of that one session (see
``auth.player_identity`` / ``ws_auth.ws_guest``); it is never a site-wide login.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import create_guest_token, get_current_teacher
from ..models import (
    QuizSession, BingoSession, ExitTicketSession, BarometerSession,
    AuctionSession, ExitGameSession, LueckentextSession, Teacher,
)

router = APIRouter(prefix="/api/guest", tags=["guest"])

# tool key (as the frontend knows it) → (model, code column name)
_TOOLS = {
    "caputh": (QuizSession, "join_code"),
    "bingo": (BingoSession, "code"),
    "exit-ticket": (ExitTicketSession, "code"),
    "barometer": (BarometerSession, "code"),
    "auction": (AuctionSession, "code"),
    "exitgame": (ExitGameSession, "join_code"),
    "lueckentext": (LueckentextSession, "join_code"),
}


class GuestJoinIn(BaseModel):
    code: str
    tool: str
    name: str = Field(min_length=1, max_length=100)


class GuestJoinOut(BaseModel):
    token: str
    name: str


class GuestStatusOut(BaseModel):
    allow_guests: bool


class GuestAllowIn(BaseModel):
    code: str
    tool: str
    allow: bool


def _resolve_session(tool: str, code: str, db: Session):
    entry = _TOOLS.get(tool)
    if not entry:
        raise HTTPException(400, "Unbekanntes Tool")
    model, code_col = entry
    session = db.query(model).filter(getattr(model, code_col) == code).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    return session


@router.post("/join", response_model=GuestJoinOut)
def guest_join(body: GuestJoinIn, db: Session = Depends(get_db)):
    session = _resolve_session(body.tool, body.code, db)
    if not session.allow_guests:
        raise HTTPException(403, "Gäste sind für diese Sitzung nicht freigeschaltet")

    name = body.name.strip()[:100]
    if not name:
        raise HTTPException(422, "Bitte einen Namen angeben")

    return GuestJoinOut(token=create_guest_token(body.code, name), name=name)


@router.get("/status", response_model=GuestStatusOut)
def guest_status(tool: str, code: str, db: Session = Depends(get_db)):
    """Whether this session accepts guests. Public — the join screen and the host
    toggle both read it; it reveals nothing sensitive beyond the opt-in flag."""
    session = _resolve_session(tool, code, db)
    return GuestStatusOut(allow_guests=session.allow_guests)


@router.patch("/allow", response_model=GuestStatusOut)
def set_guest_allowed(
    body: GuestAllowIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Teacher opt-in toggle for guest access on one session."""
    session = _resolve_session(body.tool, body.code, db)
    session.allow_guests = body.allow
    db.commit()
    return GuestStatusOut(allow_guests=body.allow)
