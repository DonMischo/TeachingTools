"""Geheimpost — in der Geheimbotschaft (Simulation »stellenwert«) einen Code an
jemanden schicken, der gerade in derselben Sitzung ist.

- Wer gerade da ist, merkt sich der Server im Speicher: jede Abfrage von
  ``GET /geheimpost`` zählt als »bin noch da«. Wer länger als ANWESEND nichts
  von sich hören lässt, verschwindet aus der Liste. (Die API läuft mit einem
  Worker; ein Neustart leert die Liste, die Seiten melden sich gleich wieder.)
- Der Empfänger muss annehmen. Vorher sieht er nur, wer schickt — nicht was.
- Je Absender und Sitzung höchstens eine Botschaft alle SPERRE.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import Guest, get_player
from ..database import get_db
from ..models import GeheimPost, Student, Teacher, ToolSession

router = APIRouter(prefix="/api/tool-sessions", tags=["geheimpost"])

SPERRE = timedelta(minutes=3)
ANWESEND = timedelta(seconds=20)
MAX_BYTES = 60

# session_id -> schluessel -> (name, zuletzt gesehen)
_anwesend: dict[int, dict[str, tuple[str, datetime]]] = {}

Spieler = Union[Teacher, Student, Guest]


def _jetzt() -> datetime:
    return datetime.now(timezone.utc)


def _schluessel(spieler: Spieler) -> str:
    if isinstance(spieler, Student):
        return f"s:{spieler.id}"
    if isinstance(spieler, Teacher):
        return f"t:{spieler.id}"
    return f"g:{spieler.id}"


def _name(spieler: Spieler) -> str:
    if isinstance(spieler, Student):
        return spieler.display_name
    if isinstance(spieler, Teacher):
        return f"{spieler.first_name} {spieler.last_name}".strip()
    return spieler.name or "Gast"


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "stellenwert":
        raise HTTPException(400, "Geheimpost gibt es nur in den Stellenwerttafeln.")
    return session


def _da(session_id: int) -> dict[str, tuple[str, datetime]]:
    """Wer gerade da ist — Abgelaufene fliegen dabei raus."""
    raum = _anwesend.setdefault(session_id, {})
    grenze = _jetzt() - ANWESEND
    for k in [k for k, (_, t) in raum.items() if t < grenze]:
        del raum[k]
    return raum


def _gueltiger_inhalt(inhalt: str, basis: int) -> str:
    teile = inhalt.split()
    muster = re.compile(r"^[01]{1,8}$" if basis == 2 else r"^[0-9a-fA-F]{1,2}$")
    if not teile or len(teile) > MAX_BYTES or not all(muster.match(t) for t in teile):
        raise HTTPException(422, "Das ist kein gültiger Code.")
    # nur druckbare ASCII-Zeichen — sonst wäre die Botschaft nicht zu knacken
    if not all(32 <= int(t, basis) <= 126 for t in teile):
        raise HTTPException(422, "Der Code enthält Zeichen, die nicht in der ASCII-Tafel stehen.")
    return " ".join(t.upper() for t in teile)


def _sperre_rest(session_id: int, von: str, db: Session) -> int:
    """Sekunden, bis dieser Absender wieder schicken darf (0 = jetzt)."""
    letzte = (
        db.query(GeheimPost.erstellt_am)
        .filter_by(session_id=session_id, von=von)
        .order_by(GeheimPost.erstellt_am.desc())
        .first()
    )
    if not letzte:
        return 0
    zeit = letzte[0] if letzte[0].tzinfo else letzte[0].replace(tzinfo=timezone.utc)
    return max(0, int((zeit + SPERRE - _jetzt()).total_seconds() + 0.999))


class Person(BaseModel):
    schluessel: str
    name: str


class PostOut(BaseModel):
    id: int
    von_name: str
    an_name: str
    basis: int
    status: str
    # nur für den Absender und — nach dem Annehmen — für den Empfänger
    inhalt: str | None


class StandOut(BaseModel):
    ich: Person
    anwesend: list[Person]
    eingang: list[PostOut]
    gesendet: list[PostOut]
    sperre_sekunden: int


class SendenIn(BaseModel):
    an: str
    inhalt: str
    basis: int


class AntwortIn(BaseModel):
    annehmen: bool


def _out(p: GeheimPost, ich: str) -> PostOut:
    sichtbar = p.von == ich or (p.an == ich and p.status == "angenommen")
    return PostOut(id=p.id, von_name=p.von_name, an_name=p.an_name, basis=p.basis,
                   status=p.status, inhalt=p.inhalt if sichtbar else None)


@router.get("/{code}/geheimpost", response_model=StandOut)
def stand(code: str, db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Wer ist da, was liegt für mich bereit, was habe ich verschickt — und
    zugleich das Lebenszeichen, das mich in der Liste der Anwesenden hält."""
    session = _sitzung(code, db)
    ich = _schluessel(spieler)
    raum = _da(session.id)
    raum[ich] = (_name(spieler), _jetzt())
    eingang = (
        db.query(GeheimPost)
        .filter_by(session_id=session.id, an=ich, status="offen")
        .order_by(GeheimPost.id)
        .all()
    )
    gesendet = (
        db.query(GeheimPost)
        .filter_by(session_id=session.id, von=ich)
        .order_by(GeheimPost.id.desc())
        .limit(5)
        .all()
    )
    return StandOut(
        ich=Person(schluessel=ich, name=raum[ich][0]),
        anwesend=sorted(
            (Person(schluessel=k, name=n) for k, (n, _) in raum.items() if k != ich),
            key=lambda p: p.name.lower(),
        ),
        eingang=[_out(p, ich) for p in eingang],
        gesendet=[_out(p, ich) for p in gesendet],
        sperre_sekunden=_sperre_rest(session.id, ich, db),
    )


@router.post("/{code}/geheimpost", response_model=PostOut, status_code=201)
def senden(code: str, body: SendenIn, db: Session = Depends(get_db), spieler=Depends(get_player)):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if body.basis not in (2, 16):
        raise HTTPException(422, "Nur Binär- oder Hex-Code.")
    ich = _schluessel(spieler)
    if body.an == ich:
        raise HTTPException(422, "An dich selbst geht das nicht.")
    raum = _da(session.id)
    if body.an not in raum:
        raise HTTPException(404, "Diese Person ist gerade nicht in der Sitzung.")
    inhalt = _gueltiger_inhalt(body.inhalt, body.basis)
    rest = _sperre_rest(session.id, ich, db)
    if rest:
        raise HTTPException(429, f"Noch {rest} Sekunden bis zur nächsten Botschaft.")
    post = GeheimPost(
        session_id=session.id, von=ich, von_name=_name(spieler)[:100],
        an=body.an, an_name=raum[body.an][0][:100],
        inhalt=inhalt, basis=body.basis, status="offen", erstellt_am=_jetzt(),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _out(post, ich)


@router.post("/{code}/geheimpost/{post_id}/antwort", response_model=PostOut)
def antworten(code: str, post_id: int, body: AntwortIn,
              db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Annehmen oder ablehnen — nur der Empfänger, und nur einmal."""
    session = _sitzung(code, db)
    ich = _schluessel(spieler)
    post = db.query(GeheimPost).filter_by(id=post_id, session_id=session.id).first()
    if not post or post.an != ich:
        raise HTTPException(404, "Diese Botschaft gibt es für dich nicht.")
    if post.status != "offen":
        raise HTTPException(409, "Schon beantwortet.")
    post.status = "angenommen" if body.annehmen else "abgelehnt"
    db.commit()
    db.refresh(post)
    return _out(post, ich)
