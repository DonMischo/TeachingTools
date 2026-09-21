"""Guest join for QR / join-link players.

An unauthenticated user who scans a session's QR code (or opens its join link)
posts here with the code + the tool it belongs to and a chosen username. If the
session exists and its teacher has opted in (``allow_guests``), we hand back a
signed, session-scoped, short-lived guest token — wie lange es gilt, stellt ein
Admin schulweit ein (``school_settings.guest_token_minutes``). That token is the
ONLY thing that lets a guest reach the player endpoints of that one session (see
``auth.player_identity`` / ``ws_auth.ws_guest``); it is never a site-wide login.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import create_guest_token, get_current_teacher, guest_token_minutes
from ..models import Teacher
from ..join_codes import BY_KEY

router = APIRouter(prefix="/api/guest", tags=["guest"])


class GuestJoinIn(BaseModel):
    code: str
    tool: str
    name: str = Field(min_length=1, max_length=100)


class GuestJoinOut(BaseModel):
    token: str
    name: str
    # Laenge des Gastfensters. Der Browser laeuft danach ab, statt eine eigene
    # Zahl zu raten — sonst zeigt er den Abgelaufen-Schirm, waehrend das Token
    # noch gilt (oder umgekehrt).
    expires_in_minutes: int


class GuestStatusOut(BaseModel):
    allow_guests: bool
    # Wie lange ein Gast drinbleibt (Admin › Gastzugang). Die Hostansicht
    # schreibt die Zahl an den Schalter.
    guest_minutes: int = 0
    # Wie oft der Gastzugang neu gestartet wurde. Jeder Neustart entwertet die
    # bis dahin ausgegebenen Gast-Token.
    guest_epoch: int = 0


class GuestAllowIn(BaseModel):
    code: str
    tool: str
    allow: bool


class GuestRestartIn(BaseModel):
    code: str
    tool: str


def _resolve_session(tool: str, code: str, db: Session):
    entry = BY_KEY.get(tool)
    if not entry:
        raise HTTPException(400, "Unbekanntes Tool")
    session = db.query(entry.model).filter(getattr(entry.model, entry.column) == code).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    return session


@router.post("/join", response_model=GuestJoinOut)
def guest_join(body: GuestJoinIn, db: Session = Depends(get_db)):
    session = _resolve_session(body.tool, body.code, db)
    if not session.allow_guests:
        raise HTTPException(403, "Gäste sind für diese Sitzung nicht freigeschaltet")
    # Geschlossen heisst geschlossen — der Code bleibt gueltig, damit die
    # Lehrkraft ihn spaeter wieder oeffnen kann, aber jetzt kommt niemand rein.
    entry = BY_KEY[body.tool]
    if entry.closable and getattr(session, "status", None) == entry.closed_status:
        raise HTTPException(403, "Diese Sitzung ist geschlossen")

    name = body.name.strip()[:100]
    if not name:
        raise HTTPException(422, "Bitte einen Namen angeben")

    minutes = guest_token_minutes(db)
    return GuestJoinOut(
        token=create_guest_token(
            body.code, name, getattr(session, "guest_epoch", 0) or 0, minutes
        ),
        name=name,
        expires_in_minutes=minutes,
    )


@router.get("/status", response_model=GuestStatusOut)
def guest_status(tool: str, code: str, db: Session = Depends(get_db)):
    """Whether this session accepts guests. Public — the join screen and the host
    toggle both read it; it reveals nothing sensitive beyond the opt-in flag."""
    session = _resolve_session(tool, code, db)
    return GuestStatusOut(
        allow_guests=session.allow_guests,
        guest_epoch=session.guest_epoch,
        guest_minutes=guest_token_minutes(db),
    )


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
    return GuestStatusOut(
        allow_guests=body.allow,
        guest_epoch=session.guest_epoch,
        guest_minutes=guest_token_minutes(db),
    )


@router.post("/restart", response_model=GuestStatusOut)
def restart_guest_access(
    body: GuestRestartIn,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Bereits ausgegebene Gast-Token dieser Sitzung entziehen.

    Gedacht fuer den gedruckten QR, der mehrere Klassen ueberlebt: die vorige
    Gruppe haette sonst bis zum Ende ihres Gastfensters weiter Zugang. Nach dem
    Neustart muss jeder Gast erneut beitreten — der Code selbst bleibt derselbe,
    damit der Aushang weiter stimmt.

    Angemeldete Schueler sind nicht betroffen; sie haengen nicht am Gast-Token.
    """
    session = _resolve_session(body.tool, body.code, db)
    entry = BY_KEY[body.tool]
    owner = getattr(session, entry.owner_column, None)
    if owner != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Das ist nicht deine Sitzung")
    session.guest_epoch = (session.guest_epoch or 0) + 1
    db.commit()
    db.refresh(session)
    return GuestStatusOut(
        allow_guests=session.allow_guests,
        guest_epoch=session.guest_epoch,
        guest_minutes=guest_token_minutes(db),
    )
