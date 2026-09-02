"""
Resolution + enforcement for tool availability.

Resolution order for one (user, tool, capability):
  1. per-group override for a group the user belongs to (A/B-Gruppe — students
     only; widersprechen sich mehrere Gruppen, gilt das Verbot),
  2. per-class override matching the user's class (if the user has a class),
  3. global override (class_id and group_id NULL),
  4. catalog default (api/tool_catalog.py).

Use `resolve_user` for the whole map (drives the frontend gate) and
`require_capability` as a route dependency for backend enforcement.
"""
from typing import Union

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .auth import get_current_user
from .models import Teacher, Student, ToolAvailability
from . import tool_catalog


def audience_of(user: Union[Teacher, Student]) -> str:
    """Which availability lane a user falls into. Klassensprecher — a StudentRole
    — are plain students here; their extra rights live in the class settings."""
    return "student" if isinstance(user, Student) else "teacher"


def class_id_of(user: Union[Teacher, Student]) -> int | None:
    """The class that scopes per-class overrides for this user: a student's own
    class, or a teacher's Klassenleitung (may be None)."""
    if isinstance(user, Student):
        return user.class_id
    return user.klasse_id


def group_ids_of(user: Union[Teacher, Student]) -> list[int]:
    """Gruppen, deren Regeln fuer diesen Nutzer gelten.

    Nur Schueler sind Gruppenmitglieder — die Verfuegbarkeit einer Lehrkraft
    wird nie von einer A/B-Gruppe eingeengt."""
    if isinstance(user, Student):
        return [m.group_id for m in user.group_memberships]
    return []


Overrides = dict[tuple[str, str, int | None, int | None], bool]


def _resolve(
    overrides: Overrides,
    slug: str,
    capability: str,
    audience: str,
    class_id: int | None,
    group_ids: list[int],
) -> bool:
    # Die Gruppenregel schlaegt die Klassenregel — sie ist die engere Auswahl.
    # Steht ein Schueler in mehreren Gruppen mit widerspruechlichen Regeln, gilt
    # das Verbot: eine Sperre soll sich nicht durch eine zweite Gruppe aushebeln.
    hits = [overrides[(slug, capability, None, gid)]
            for gid in group_ids if (slug, capability, None, gid) in overrides]
    if hits:
        return all(hits)
    if class_id is not None and (slug, capability, class_id, None) in overrides:
        return overrides[(slug, capability, class_id, None)]
    if (slug, capability, None, None) in overrides:
        return overrides[(slug, capability, None, None)]
    return tool_catalog.default_allowed(slug, capability, audience)


def _load_overrides(
    db: Session, audience: str, class_id: int | None, group_ids: list[int]
) -> Overrides:
    """Global + this-class + this-user's-group rows for one audience,
    keyed by (slug, cap, class_id, group_id)."""
    q = db.query(ToolAvailability).filter(ToolAvailability.audience == audience)
    scope = ToolAvailability.class_id.is_(None) & ToolAvailability.group_id.is_(None)
    if class_id is not None:
        scope = scope | (ToolAvailability.class_id == class_id)
    if group_ids:
        scope = scope | (ToolAvailability.group_id.in_(group_ids))
    q = q.filter(scope)
    return {(r.tool_slug, r.capability, r.class_id, r.group_id): r.allowed for r in q.all()}


def resolve_user(db: Session, user: Union[Teacher, Student]) -> dict[str, dict[str, bool]]:
    """Resolved {slug: {capability: allowed}} for every catalog tool/capability."""
    audience = audience_of(user)
    class_id = class_id_of(user)
    group_ids = group_ids_of(user)
    overrides = _load_overrides(db, audience, class_id, group_ids)
    result: dict[str, dict[str, bool]] = {}
    for tool in tool_catalog.CATALOG:
        result[tool.slug] = {
            cap: _resolve(overrides, tool.slug, cap, audience, class_id, group_ids)
            for cap in tool.capabilities
        }
    return result


def is_allowed(db: Session, user: Union[Teacher, Student], slug: str, capability: str) -> bool:
    audience = audience_of(user)
    class_id = class_id_of(user)
    group_ids = group_ids_of(user)
    overrides = _load_overrides(db, audience, class_id, group_ids)
    return _resolve(overrides, slug, capability, audience, class_id, group_ids)


def require_capability(slug: str, capability: str):
    """FastAPI dependency: 403 unless the caller may use `capability` on `slug`.

    Admins bypass the gate — they configure availability and must never lock
    themselves out."""
    def _guard(
        user: Union[Teacher, Student] = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Union[Teacher, Student]:
        if isinstance(user, Teacher) and user.role == "admin":
            return user
        if not is_allowed(db, user, slug, capability):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Dieses Werkzeug ist für dich nicht freigeschaltet ({slug}/{capability}).",
            )
        return user
    return _guard
