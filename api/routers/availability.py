"""
Tool-availability configuration + resolution API.

  GET  /api/availability/me                 resolved caps for the caller (any user)
  GET  /api/availability/catalog            tool/capability structure for the grids
  GET  /api/availability/overrides          raw override rows for a scope (admin/class teacher)
  PUT  /api/availability/override           upsert one override
  DELETE /api/availability/override         reset one override to its default/global fallback

Admins edit global (class_id NULL) and any class. Class teachers edit only their
own Klassenleitung class (Teacher.klasse_id).
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user, get_current_teacher
from ..models import Teacher, Student, ToolAvailability
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
    allowed: bool


class OverrideIn(BaseModel):
    tool_slug: str
    capability: str
    audience: str  # teacher | student
    class_id: int | None = None
    allowed: bool


# ── permission helper ───────────────────────────────────────────────────────

def _require_edit(user: Teacher, class_id: int | None) -> None:
    """Admins may edit any scope; class teachers only their own class (never global)."""
    if user.role == "admin":
        return
    if class_id is not None and user.klasse_id == class_id:
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
    user: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Rows for one scope. class_id omitted = global.

    Global rows are readable by any teacher (they need the baseline to show what
    a per-class 'Standard' resolves to); a specific class's rows only by an admin
    or that class's teacher. Editing is gated separately in set/clear."""
    if class_id is not None and user.role != "admin" and user.klasse_id != class_id:
        raise HTTPException(403, "Du darfst nur die Einstellungen deiner eigenen Klasse sehen.")
    q = db.query(ToolAvailability)
    if class_id is None:
        q = q.filter(ToolAvailability.class_id.is_(None))
    else:
        q = q.filter(ToolAvailability.class_id == class_id)
    return [
        OverrideRow(
            tool_slug=r.tool_slug, capability=r.capability, audience=r.audience,
            class_id=r.class_id, allowed=r.allowed,
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
    _require_edit(user, body.class_id)
    row = (
        db.query(ToolAvailability)
        .filter_by(
            tool_slug=body.tool_slug, capability=body.capability,
            audience=body.audience, class_id=body.class_id,
        )
        .first()
    )
    if row:
        row.allowed = body.allowed
        row.updated_by = user.id
    else:
        row = ToolAvailability(
            tool_slug=body.tool_slug, capability=body.capability,
            audience=body.audience, class_id=body.class_id,
            allowed=body.allowed, updated_by=user.id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return OverrideRow(
        tool_slug=row.tool_slug, capability=row.capability, audience=row.audience,
        class_id=row.class_id, allowed=row.allowed,
    )


@router.delete("/override", status_code=204)
def clear_override(
    tool_slug: str,
    capability: str,
    audience: str,
    class_id: int | None = None,
    user: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Remove one override so the scope falls back to its default/global value."""
    _require_edit(user, class_id)
    db.query(ToolAvailability).filter_by(
        tool_slug=tool_slug, capability=capability,
        audience=audience, class_id=class_id,
    ).delete()
    db.commit()
