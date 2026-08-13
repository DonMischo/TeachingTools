"""
Resolution + enforcement for admin-feature grants.

A teacher may reach an admin feature if they are an admin, or if a grant matches
their teacher group (TeacherRole) or names them individually. Use
`resolve_admin_features` for the whole set (drives the Sidebar + /admin cards)
and `require_admin_feature` as a route dependency (replaces `require_admin` on
the grantable routers).
"""
from typing import Union

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .auth import get_current_user
from .models import Teacher, Student, AdminFeatureGrant
from . import admin_features


def has_admin_feature(db: Session, user: Union[Teacher, Student], slug: str) -> bool:
    if not isinstance(user, Teacher):
        return False
    if user.role == "admin":
        return True
    grants = db.query(AdminFeatureGrant).filter(AdminFeatureGrant.feature_slug == slug).all()
    for g in grants:
        if g.teacher_id is not None and g.teacher_id == user.id:
            return True
        if (g.teacher_role_id is not None
                and user.teacher_role_id is not None
                and g.teacher_role_id == user.teacher_role_id):
            return True
    return False


def resolve_admin_features(db: Session, user: Union[Teacher, Student]) -> list[str]:
    """Slugs the user may access. Admins get all; students get none."""
    if isinstance(user, Teacher) and user.role == "admin":
        return [f.slug for f in admin_features.FEATURES]
    if not isinstance(user, Teacher):
        return []
    return [f.slug for f in admin_features.FEATURES if has_admin_feature(db, user, f.slug)]


def require_admin_feature(slug: str):
    """FastAPI dependency: 403 unless the caller may reach admin feature `slug`
    (admin, or granted by role/individually). Returns the Teacher."""
    def _guard(
        user: Union[Teacher, Student] = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Teacher:
        if not has_admin_feature(db, user, slug):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kein Zugriff auf diesen Admin-Bereich.",
            )
        return user  # type: ignore[return-value]
    return _guard
