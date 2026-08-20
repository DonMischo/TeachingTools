"""Permission resolution for Fragment collections.

A collection's access is derived from its FragmentCollectionGrant rows plus its
owner. One function — ``resolve_permission`` — is the single source of truth,
used by every fragments/research endpoint. Guests are handled here too, but a
guest token is only ever accepted through a code-scoped dependency (see the
guest endpoints), never via get_current_user.

Permission ladder (ascending):
    none < read < contribute < manage
  * read       — view cards
  * contribute — add cards, edit/delete only one's own cards
  * manage     — edit/delete any card + change collection settings/grants
The owner (and admins) always resolve to 'manage'.
"""
from __future__ import annotations

from typing import Optional, Union

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .auth import Guest, bearer, get_current_user_optional, guest_from_credentials
from .database import get_db
from .models import Teacher, Student, FragmentCollection

Principal = Union[Teacher, Student, Guest]

PERMISSIONS = ("none", "read", "contribute", "manage")
_ORDER = {p: i for i, p in enumerate(PERMISSIONS)}


def _max(a: str, b: str) -> str:
    return a if _ORDER[a] >= _ORDER[b] else b


def at_least(perm: str, needed: str) -> bool:
    """True if ``perm`` meets or exceeds ``needed`` on the ladder."""
    return _ORDER.get(perm, 0) >= _ORDER[needed]


def resolve_permission(user: Principal, collection: FragmentCollection) -> str:
    """Return the effective permission of ``user`` on ``collection``.

    Grants are read off the (relationship-loaded) collection; no extra query.
    """
    if isinstance(user, Teacher):
        # Owner and admins always have full control.
        if user.role == "admin" or user.id == collection.owner_teacher_id:
            return "manage"
        best = "none"
        for g in collection.grants:
            if g.grantee_type == "all_teachers":
                best = _max(best, g.permission)
            elif g.grantee_type == "teacher" and g.teacher_id == user.id:
                best = _max(best, g.permission)
        return best

    if isinstance(user, Student):
        if user.class_id is None:
            return "none"
        best = "none"
        for g in collection.grants:
            if g.grantee_type == "class" and g.class_id == user.class_id:
                best = _max(best, g.permission)
        return best

    if isinstance(user, Guest):
        # Token/scope binding to this collection's guest_code is enforced by the
        # calling endpoint; here we only map the collection's guest policy.
        return collection.guest_permission if collection.allow_guests else "none"

    return "none"


def load_collection(db: Session, collection_id: int) -> FragmentCollection:
    coll = db.get(FragmentCollection, collection_id)
    if not coll:
        raise HTTPException(404, "Sammlung nicht gefunden")
    return coll


def require_permission(
    db: Session, user: Principal, collection_id: int, needed: str
) -> tuple[FragmentCollection, str]:
    """Load a collection and assert ``user`` has at least ``needed`` on it.

    Returns (collection, effective_permission). Raises 404 if the collection
    doesn't exist, 403 if the permission is insufficient.
    """
    coll = load_collection(db, collection_id)
    perm = resolve_permission(user, coll)
    if not at_least(perm, needed):
        raise HTTPException(403, "Keine Berechtigung für diese Sammlung")
    return coll, perm


def can_edit_card(
    perm: str, user: Principal, author_kind: str | None, author_id: int | None
) -> bool:
    """Whether ``user`` (with effective ``perm``) may edit/delete a specific card.

    'manage' edits anything; 'contribute' edits only the caller's own cards
    (matched by author kind+id); 'read'/'none' edit nothing.
    """
    # Guests have no stable per-person id (all share author_id=NULL/kind='guest'),
    # so "edit-own" can't be attributed safely — guest contributions are add-only.
    if isinstance(user, Guest):
        return False
    if at_least(perm, "manage"):
        return True
    if not at_least(perm, "contribute"):
        return False
    kind, uid = author_of(user)
    return kind is not None and kind == author_kind and uid == author_id


def author_of(user: Principal) -> tuple[str | None, int | None]:
    """Author (kind, id) tuple to stamp on cards this user creates."""
    if isinstance(user, Teacher):
        return "teacher", user.id
    if isinstance(user, Student):
        return "student", user.id
    if isinstance(user, Guest):
        return "guest", None
    return None, None


def author_name_of(user: Principal) -> str | None:
    if isinstance(user, Teacher):
        return f"{user.first_name} {user.last_name}".strip()
    if isinstance(user, Student):
        return (user.alias or user.vorname or user.nachname or "").strip() or None
    if isinstance(user, Guest):
        return user.name
    return None


def collection_principal(
    collection_id: int,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Principal:
    """Resolve the caller for a collection-scoped endpoint.

    A logged-in Teacher/Student (cookie/bearer) wins. Otherwise, if the collection
    opts into guests, a guest token scoped to *this collection's* guest_code is
    accepted. Guest tokens are only ever honoured through this collection-bound
    path — never via get_current_user — so a guest can't reach other boards.
    """
    user = get_current_user_optional(request, credentials, db)
    if user is not None:
        return user
    coll = db.get(FragmentCollection, collection_id)
    if coll and coll.allow_guests and coll.guest_code:
        guest = guest_from_credentials(credentials, coll.guest_code)
        if guest is not None:
            return guest
    raise HTTPException(401, "Nicht authentifiziert")
