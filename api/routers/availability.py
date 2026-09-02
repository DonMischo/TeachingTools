"""
Tool-availability configuration + resolution API.

  GET  /api/availability/me                 resolved caps for the caller (any user)
  GET  /api/availability/catalog            tool/capability structure for the grids
  GET  /api/availability/overrides          raw override rows for a scope (admin/class teacher)
  PUT  /api/availability/override           upsert one override
  DELETE /api/availability/override         reset one override to its default/global fallback

Ein Geltungsbereich ist global (weder class_id noch group_id), eine Klasse oder
eine Gruppe dieser Klasse (A/B-Gruppe). Admins bearbeiten alles; Klassenlehrer
nur ihre eigene Klasse (Teacher.klasse_id) und deren Gruppen.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user, get_current_teacher
from ..models import Teacher, Student, ToolAvailability, StudentGroup
from .. import tool_catalog, availability

router = APIRouter(prefix="/api/availability", tags=["availability"])


# ── schemas ─────────────────────────────────────────────────────────────────

class CapabilityDefault(BaseModel):
    capability: str
    label: str
    teacher_default: bool
    student_default: bool


class CatalogToolOut(BaseModel):
    slug: str
    label: str
    icon: str
    surface: str
    capabilities: list[CapabilityDefault]


class OverrideRow(BaseModel):
    tool_slug: str
    capability: str
    audience: str
    class_id: int | None
    group_id: int | None = None
    allowed: bool


class OverrideIn(BaseModel):
    tool_slug: str
    capability: str
    audience: str  # teacher | student
    class_id: int | None = None
    group_id: int | None = None
    allowed: bool


# ── permission helper ───────────────────────────────────────────────────────

def _scope_class_id(db: Session, class_id: int | None, group_id: int | None) -> int | None:
    """Die Klasse, an der ein Geltungsbereich haengt — bei einer Gruppe ihre eigene.

    Nur klassengebundene Gruppen (A/B-Gruppen) taugen als Geltungsbereich: ein
    Kurs/WPF geht ueber Klassen hinweg, da gaebe es keine zustaendige Lehrkraft."""
    if class_id is not None and group_id is not None:
        raise HTTPException(400, "Entweder eine Klasse oder eine Gruppe, nicht beides.")
    if group_id is None:
        return class_id
    g = db.get(StudentGroup, group_id)
    if not g:
        raise HTTPException(404, f"Gruppe {group_id} nicht gefunden")
    if g.class_id is None:
        raise HTTPException(400, "Nur klassengebundene Gruppen (A/B) können einen eigenen Geltungsbereich haben.")
    return g.class_id


def _require_edit(user: Teacher, scope_class_id: int | None) -> None:
    """Admins may edit any scope; class teachers only their own class (never global)."""
    if user.role == "admin":
        return
    if scope_class_id is not None and user.klasse_id == scope_class_id:
        return
    raise HTTPException(403, "Du darfst nur die Einstellungen deiner eigenen Klasse ändern.")


def _validate(tool_slug: str, capability: str, audience: str) -> None:
    tool = tool_catalog.BY_SLUG.get(tool_slug)
    if not tool:
        raise HTTPException(404, f"Unbekanntes Werkzeug: {tool_slug}")
    if capability not in tool.capabilities:
        raise HTTPException(400, f"{tool_slug} hat keine Fähigkeit '{capability}'")
    if audience not in ("teacher", "student"):
        raise HTTPException(400, "audience muss 'teacher' oder 'student' sein")


# ── routes ──────────────────────────────────────────────────────────────────

@router.get("/me")
def get_my_availability(
    user: Union[Teacher, Student] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, dict[str, bool]]:
    return availability.resolve_user(db, user)


@router.get("/catalog", response_model=list[CatalogToolOut])
def get_catalog(_: Teacher = Depends(get_current_teacher)):
    out: list[CatalogToolOut] = []
    for tool in tool_catalog.CATALOG:
        caps = [
            CapabilityDefault(
                capability=cap,
                label=tool_catalog.CAPABILITY_LABELS.get(cap, cap),
                teacher_default=defs.get("teacher", False),
                student_default=defs.get("student", False),
            )
            for cap, defs in tool.capabilities.items()
        ]
        out.append(CatalogToolOut(
            slug=tool.slug, label=tool.label, icon=tool.icon,
            surface=tool.surface, capabilities=caps,
        ))
    return out


@router.get("/overrides", response_model=list[OverrideRow])
def list_overrides(
    class_id: int | None = None,
    group_id: int | None = None,
    user: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Rows for one scope. Both omitted = global.

    Global rows are readable by any teacher (they need the baseline to show what
    a per-class 'Standard' resolves to); a specific class's (or group's) rows only
    by an admin or that class's teacher. Editing is gated separately in set/clear."""
    scope_class = _scope_class_id(db, class_id, group_id)
    if scope_class is not None and user.role != "admin" and user.klasse_id != scope_class:
        raise HTTPException(403, "Du darfst nur die Einstellungen deiner eigenen Klasse sehen.")
    q = db.query(ToolAvailability)
    if group_id is not None:
        q = q.filter(ToolAvailability.group_id == group_id)
    elif class_id is not None:
        q = q.filter(ToolAvailability.class_id == class_id, ToolAvailability.group_id.is_(None))
    else:
        q = q.filter(ToolAvailability.class_id.is_(None), ToolAvailability.group_id.is_(None))
    return [
        OverrideRow(
            tool_slug=r.tool_slug, capability=r.capability, audience=r.audience,
            class_id=r.class_id, group_id=r.group_id, allowed=r.allowed,
        )
        for r in q.all()
    ]


@router.put("/override", response_model=OverrideRow)
def set_override(
    body: OverrideIn,
    user: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    _validate(body.tool_slug, body.capability, body.audience)
    _require_edit(user, _scope_class_id(db, body.class_id, body.group_id))
    row = (
        db.query(ToolAvailability)
        .filter_by(
            tool_slug=body.tool_slug, capability=body.capability,
            audience=body.audience, class_id=body.class_id, group_id=body.group_id,
        )
        .first()
    )
    if row:
        row.allowed = body.allowed
        row.updated_by = user.id
    else:
        row = ToolAvailability(
            tool_slug=body.tool_slug, capability=body.capability,
            audience=body.audience, class_id=body.class_id, group_id=body.group_id,
            allowed=body.allowed, updated_by=user.id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return OverrideRow(
        tool_slug=row.tool_slug, capability=row.capability, audience=row.audience,
        class_id=row.class_id, group_id=row.group_id, allowed=row.allowed,
    )


@router.delete("/override", status_code=204)
def clear_override(
    tool_slug: str,
    capability: str,
    audience: str,
    class_id: int | None = None,
    group_id: int | None = None,
    user: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Remove one override so the scope falls back to its default/global value."""
    _require_edit(user, _scope_class_id(db, class_id, group_id))
    db.query(ToolAvailability).filter_by(
        tool_slug=tool_slug, capability=capability,
        audience=audience, class_id=class_id, group_id=group_id,
    ).delete()
    db.commit()
