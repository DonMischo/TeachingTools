"""
Snap! — Bibliothek für die Programme, die im lokal eingebetteten Snap!-Editor
(frontend/public/snap) entstehen.

Der Editor kennt von Haus aus nur Datei-Export und die Berkeley-Cloud. Statt
beides zu benutzen, holt die Tool-Seite das Projekt-XML über die Snap!-API
(`getProjectXML()`) und legt es hier ab; beim Öffnen geht es unverändert an
`loadProjectXML()` zurück. Das XML wird deshalb absichtlich nicht geparst —
Hauspokal ist Ablage, nicht Interpret.

Sichtbarkeit, abweichend von den Inhaltsbibliotheken (Bingo, Zeitstrahl …):
ein Programm ist die persönliche Arbeit seines Autors, kein geteilter Fundus.
Schüler sehen ihre eigenen Programme plus die Vorlagen ihrer Klasse; Lehrer
sehen ihre eigenen plus die ihrer Schüler (Nachschauen/Helfen). Ändern darf
jede·r nur die eigenen — deshalb `_can_edit` statt authorship.can_modify, das
Schülerinhalte bewusst für alle Schüler freigibt.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SnapProject, Student, Teacher
from ..auth import get_current_user
from ..availability import require_capability
from ..authorship import author_fields, author_name

router = APIRouter(prefix="/api/snap", tags=["snap"])

# Projekte mit vielen Kostümen/Klängen tragen diese als base64 im XML. 10 MB
# reichen für Unterrichtsprojekte und halten einzelne Zeilen aus der Datenbank
# heraus, die sie nicht mehr sinnvoll ausliefern kann.
MAX_XML_BYTES = 10 * 1024 * 1024


class SnapProjectOut(BaseModel):
    id: int
    title: str
    class_id: int | None
    is_template: bool
    created_by: int | None
    created_by_student: int | None
    author: str | None
    mine: bool
    created_at: datetime
    updated_at: datetime


class SnapProjectDetail(SnapProjectOut):
    xml: str


class SnapProjectIn(BaseModel):
    title: str
    xml: str
    class_id: int | None = None


class SnapProjectUpdate(BaseModel):
    title: str | None = None
    xml: str | None = None
    class_id: int | None = None


def _is_mine(p: SnapProject, current) -> bool:
    if isinstance(current, Student):
        return p.created_by_student == current.id
    return p.created_by == current.id


def _can_edit(p: SnapProject, current) -> bool:
    """Nur der Autor — plus Admins, die aufräumen können müssen."""
    if isinstance(current, Teacher) and current.role == "admin":
        return True
    return _is_mine(p, current)


def _to_out(p: SnapProject, db: Session, current) -> SnapProjectOut:
    return SnapProjectOut(
        id=p.id, title=p.title, class_id=p.class_id,
        is_template=p.class_id is not None and p.created_by is not None,
        created_by=p.created_by, created_by_student=p.created_by_student,
        author=author_name(p, db), mine=_is_mine(p, current),
        created_at=p.created_at, updated_at=p.updated_at,
    )


def _visible(q, current):
    """Sichtbare Zeilen für den Aufrufer (siehe Modulkommentar)."""
    if isinstance(current, Teacher) and current.role == "admin":
        return q
    if isinstance(current, Student):
        own = SnapProject.created_by_student == current.id
        if current.class_id is None:
            return q.filter(own)
        vorlagen = (SnapProject.created_by.isnot(None)) & (SnapProject.class_id == current.class_id)
        return q.filter(own | vorlagen)
    return q.filter(
        (SnapProject.created_by == current.id) | (SnapProject.created_by_student.isnot(None))
    )


def _clean_title(title: str) -> str:
    t = (title or "").strip()
    if not t:
        raise HTTPException(422, "Titel darf nicht leer sein")
    return t[:200]


def _check_xml(xml: str) -> str:
    """Grobe Plausibilitätsprüfung — kein Parsen, nur Format und Größe."""
    if len(xml.encode("utf-8")) > MAX_XML_BYTES:
        raise HTTPException(413, "Projekt ist zu groß (max. 10 MB)")
    if not xml.lstrip().startswith("<project"):
        raise HTTPException(422, "Kein Snap!-Projekt (erwartet wird <project …>)")
    return xml


def _get(db: Session, project_id: int, current) -> SnapProject:
    p = _visible(db.query(SnapProject), current).filter(SnapProject.id == project_id).first()
    if not p:
        raise HTTPException(404, "Projekt nicht gefunden")
    return p


@router.get("", response_model=list[SnapProjectOut],
            dependencies=[Depends(require_capability("snap", "use"))])
def list_projects(db: Session = Depends(get_db), current=Depends(get_current_user)):
    projects = _visible(db.query(SnapProject), current).order_by(SnapProject.updated_at.desc()).all()
    return [_to_out(p, db, current) for p in projects]


@router.post("", response_model=SnapProjectDetail, status_code=201,
             dependencies=[Depends(require_capability("snap", "create"))])
def create_project(data: SnapProjectIn, db: Session = Depends(get_db), current=Depends(get_current_user)):
    p = SnapProject(
        title=_clean_title(data.title),
        xml=_check_xml(data.xml),
        # Nur Lehrer können eine Klassenvorlage anlegen.
        class_id=data.class_id if isinstance(current, Teacher) else None,
        **author_fields(current),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return SnapProjectDetail(**_to_out(p, db, current).model_dump(), xml=p.xml)


@router.get("/{project_id}", response_model=SnapProjectDetail,
            dependencies=[Depends(require_capability("snap", "use"))])
def get_project(project_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    p = _get(db, project_id, current)
    return SnapProjectDetail(**_to_out(p, db, current).model_dump(), xml=p.xml)


@router.get("/{project_id}/xml", dependencies=[Depends(require_capability("snap", "use"))])
def get_project_xml(project_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Rohes XML — das ist die URL, die Snap! selbst per `#open:` laden kann."""
    p = _get(db, project_id, current)
    return Response(content=p.xml, media_type="application/xml")


@router.put("/{project_id}", response_model=SnapProjectDetail,
            dependencies=[Depends(require_capability("snap", "create"))])
def update_project(project_id: int, data: SnapProjectUpdate,
                   db: Session = Depends(get_db), current=Depends(get_current_user)):
    p = _get(db, project_id, current)
    if not _can_edit(p, current):
        raise HTTPException(403, "Das ist nicht dein Programm — speichere es als eigene Kopie.")
    if data.title is not None:
        p.title = _clean_title(data.title)
    if data.xml is not None:
        p.xml = _check_xml(data.xml)
    # Ausdrücklich gesetztes null hebt die Vorlage wieder auf — deshalb
    # model_fields_set statt einer None-Prüfung.
    if "class_id" in data.model_fields_set and isinstance(current, Teacher):
        p.class_id = data.class_id
    db.commit()
    db.refresh(p)
    return SnapProjectDetail(**_to_out(p, db, current).model_dump(), xml=p.xml)


@router.delete("/{project_id}", status_code=204,
               dependencies=[Depends(require_capability("snap", "create"))])
def delete_project(project_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    p = _get(db, project_id, current)
    if not _can_edit(p, current):
        raise HTTPException(403, "Das ist nicht dein Programm.")
    db.delete(p)
    db.commit()
