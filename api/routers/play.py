"""Der Playhub: ein Beitrittscode, egal welches Werkzeug ihn ausgibt.

Schüler bekommen einen Code an die Tafel geschrieben, nicht den Namen des
Werkzeugs. ``/play`` fragt hier nach, welches Werkzeug den Code kennt, und
schickt sie an dessen Spielerseite weiter. Bewusst ohne Login — der Code *ist*
die Eintrittskarte, genau wie bei den Spielerseiten selbst.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, object_session

from ..database import get_db
from ..auth import get_current_teacher
from ..join_codes import BY_KEY, JoinCodeTool, find_sessions
from ..models import Class, Teacher
from .. import scoping

router = APIRouter(prefix="/api/play", tags=["play"])


class PlayMatch(BaseModel):
    tool: str
    label: str
    code: str
    join_url: str
    # Werkzeuge ohne Statusspalte (Schreibraum, Simulationen) liefern None.
    status: str | None = None
    # "none" | "guests" | "always" - wer im Hub einen Avatar waehlt.
    avatar: str = "none"


class PlayResolveOut(BaseModel):
    code: str
    matches: list[PlayMatch]


def normalize_code(raw: str) -> str:
    """Wie Schüler tippen (Leerzeichen, Bindestriche, klein) auf die Codeform bringen."""
    return "".join(c for c in raw.upper() if c.isalnum())


@router.get("/resolve/{code}", response_model=PlayResolveOut)
def resolve(code: str, db: Session = Depends(get_db)):
    clean = normalize_code(code)
    if not clean:
        raise HTTPException(422, "Bitte einen Code eingeben")

    hits = find_sessions(db, clean)
    if not hits:
        raise HTTPException(404, "Kein Spiel mit diesem Code gefunden")

    return PlayResolveOut(
        code=clean,
        matches=[
            PlayMatch(
                tool=tool.key,
                label=tool.label,
                code=clean,
                join_url=tool.join_url(clean),
                status=getattr(session, "status", None),
                avatar=tool.avatar,
            )
            for tool, session in hits
        ],
    )


# ── Geltungsbereich einer Sitzung ───────────────────────────────────────────


class ScopeClass(BaseModel):
    id: int
    code: str
    display_name: str


class ScopeOut(BaseModel):
    code: str
    # "class" | "group" | "none"
    scope: str
    # »9a« bzw. »9 NaT«
    label: str
    # Ein Kurs/WPF ist klassenübergreifend: wer sich ohne Konto anmeldet, muss
    # sagen, für welche Klasse er spielt — sonst zählt seine Leistung nirgends.
    # Bei nur einer beteiligten Klasse (A/B-Gruppe) entfällt die Frage.
    needs_class_choice: bool = False
    classes: list[ScopeClass] = []


@router.get("/scope/{code}", response_model=ScopeOut)
def session_scope(code: str, db: Session = Depends(get_db)):
    """Für welche Klasse bzw. welchen Kurs eine Sitzung läuft.

    Öffentlich wie ``/resolve`` — die Spielerseite braucht es, bevor irgendwer
    angemeldet ist, und mehr als Klassenkürzel steht nicht darin. Ein Code kann
    zu mehreren Werkzeugen passen; genommen wird die erste Sitzung, die
    überhaupt einen Geltungsbereich kennt.
    """
    clean = normalize_code(code)
    hits = find_sessions(db, clean) if clean else []
    if not hits:
        raise HTTPException(404, "Kein Spiel mit diesem Code gefunden")

    for _tool, session in hits:
        class_id = getattr(session, "class_id", None)
        group_id = getattr(session, "group_id", None)
        if class_id is None and group_id is None:
            continue
        label = scoping.scope_label(db, class_id, group_id)
        if group_id is None:
            return ScopeOut(code=clean, scope="class", label=label)
        ids = scoping.scope_class_ids(db, None, group_id)
        rows = db.query(Class).filter(Class.id.in_(ids)).order_by(Class.code).all() if ids else []
        return ScopeOut(
            # Nur bei mehreren Klassen gibt es etwas zu waehlen: eine A/B-Gruppe
            # gehoert zu genau einer Klasse.
            code=clean, scope="group", label=label, needs_class_choice=len(ids) > 1,
            classes=[ScopeClass(id=c.id, code=c.code, display_name=c.display_name) for c in rows],
        )

    return ScopeOut(code=clean, scope="none", label="Ohne Klasse")


# ── Sitzungsuebersicht ──────────────────────────────────────────────────────
#
# Eine Liste statt zehn: welche Sitzungen laufen gerade, und wer darf sie
# schliessen. Die Werkzeuge mit eigenem Spielverlauf (Caputh, Bingo, Auktion,
# Lueckentext, Wettschreiben) bleiben bei ihren eigenen Endpunkten — bei ihnen
# ist der Status Spielstand, und Bingo verteilt beim Schliessen Punkte.


class SessionRow(BaseModel):
    tool: str
    label: str
    code: str
    join_url: str
    status: str | None = None
    closed: bool = False
    mine: bool = True
    created_at: str | None = None
    # Nur bei den zustandslosen Werkzeugen belegt: welches Werkzeug genau
    # (Abakus, Tippen, Zeitstrahl …) und welchen Inhalt es teilt.
    tool_slug: str | None = None
    ref_id: int | None = None
    ref_title: str | None = None
    owner: str | None = None


def _row(tool: JoinCodeTool, session, teacher: Teacher) -> SessionRow:
    status = getattr(session, "status", None)
    created = getattr(session, "created_at", None)
    return SessionRow(
        tool=tool.key,
        label=tool.label,
        code=getattr(session, tool.column),
        join_url=tool.join_url(getattr(session, tool.column)),
        status=status,
        closed=tool.closable and status == tool.closed_status,
        mine=getattr(session, tool.owner_column, None) == teacher.id,
        created_at=created.isoformat() if created else None,
        tool_slug=getattr(session, "tool_slug", None),
        ref_id=getattr(session, "ref_id", None),
        ref_title=_ref_title(session),
        owner=_owner_name(session, tool),
    )


def _ref_title(session) -> str | None:
    """Titel des geteilten Inhalts — sonst stuenden in der Liste nur nackte Ids."""
    from .tool_sessions import REF_TOOLS

    model = REF_TOOLS.get(getattr(session, "tool_slug", "") or "")
    ref_id = getattr(session, "ref_id", None)
    if model is None or ref_id is None:
        return None
    row = object_session(session).get(model, ref_id)
    return row.title if row else None


def _owner_name(session, tool: JoinCodeTool) -> str | None:
    """Wem die Sitzung gehoert — Admins sehen fremde und sollen wissen wessen."""
    owner = getattr(session, "creator", None) or getattr(session, "teacher", None)
    if owner is None:
        return None
    return f"{owner.first_name} {owner.last_name}"


def _tool_or_400(key: str) -> JoinCodeTool:
    tool = BY_KEY.get(key)
    if not tool:
        raise HTTPException(400, "Unbekanntes Werkzeug")
    return tool


@router.get("/sessions", response_model=list[SessionRow])
def list_sessions(
    tool: str,
    slug: str | None = None,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Laufende Sitzungen eines Werkzeugs — die eigenen, fuer Admins alle.

    `slug` grenzt die zustandslosen Werkzeuge weiter ein: sie teilen sich das
    Modell ToolSession, "welche Tipp-Sitzungen laufen" braucht also noch den
    Werkzeug-Slug.
    """
    entry = _tool_or_400(tool)
    q = db.query(entry.model)
    if current.role != "admin":
        q = q.filter(getattr(entry.model, entry.owner_column) == current.id)
    if slug is not None:
        if not hasattr(entry.model, "tool_slug"):
            raise HTTPException(400, f"{entry.label} kennt keine Slugs")
        q = q.filter(entry.model.tool_slug == slug)
    rows = q.all()
    if hasattr(entry.model, "created_at"):
        rows.sort(key=lambda r: r.created_at or "", reverse=True)
    return [_row(entry, r, current) for r in rows]


def _own_session(tool: str, code: str, db: Session, current: Teacher):
    entry = _tool_or_400(tool)
    if not entry.closable:
        raise HTTPException(400, f"{entry.label} kennt kein einfaches Schliessen")
    session = db.query(entry.model).filter(getattr(entry.model, entry.column) == code).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if getattr(session, entry.owner_column, None) != current.id and current.role != "admin":
        raise HTTPException(403, "Das ist nicht deine Sitzung")
    return entry, session


@router.post("/sessions/{code}/close", response_model=SessionRow)
def close_session(code: str, tool: str, db: Session = Depends(get_db),
                  current: Teacher = Depends(get_current_teacher)):
    entry, session = _own_session(tool, code, db, current)
    session.status = entry.closed_status
    db.commit()
    db.refresh(session)
    return _row(entry, session, current)


@router.post("/sessions/{code}/reopen", response_model=SessionRow)
def reopen_session(code: str, tool: str, db: Session = Depends(get_db),
                   current: Teacher = Depends(get_current_teacher)):
    """Der Code bleibt derselbe — ein gedruckter QR funktioniert danach weiter."""
    entry, session = _own_session(tool, code, db, current)
    session.status = entry.open_status
    db.commit()
    db.refresh(session)
    return _row(entry, session, current)
