"""
Admin-feature access + grant management.

  GET  /api/admin-access/me            resolved features for the caller (any user)
  GET  /api/admin-access/catalog       grantable features (admin)
  GET  /api/admin-access/teacher-roles TeacherRole list for the grants UI (admin)
  GET  /api/admin-access/grants        all grants (admin)
  PUT  /api/admin-access/grant         add a grant (admin)
  DELETE /api/admin-access/grant       remove a grant (admin)
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user, require_admin
from ..models import Teacher, Student, TeacherRole, AdminFeatureGrant
from .. import admin_features, admin_access

router = APIRouter(prefix="/api/admin-access", tags=["admin-access"])


# ── schemas ─────────────────────────────────────────────────────────────────

class AdminAccessMe(BaseModel):
    is_admin: bool
    features: list[str]


class AdminFeatureOut(BaseModel):
    slug: str
    label: str
    icon: str


class TeacherRoleOut(BaseModel):
    id: int
    name: str


class GrantRow(BaseModel):
    feature_slug: str
    teacher_role_id: int | None
    teacher_id: int | None


class GrantIn(BaseModel):
    feature_slug: str
    teacher_role_id: int | None = None
    teacher_id: int | None = None

    @model_validator(mode="after")
    def _exactly_one_target(self):
        if (self.teacher_role_id is None) == (self.teacher_id is None):
            raise ValueError("Genau eines von teacher_role_id / teacher_id angeben")
        return self


# ── routes ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=AdminAccessMe)
def get_my_admin_access(
    user: Union[Teacher, Student] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_admin = isinstance(user, Teacher) and user.role == "admin"
    return AdminAccessMe(is_admin=is_admin, features=admin_access.resolve_admin_features(db, user))


@router.get("/catalog", response_model=list[AdminFeatureOut])
def get_catalog(_: Teacher = Depends(require_admin)):
    return [AdminFeatureOut(slug=f.slug, label=f.label, icon=f.icon) for f in admin_features.FEATURES]


@router.get("/teacher-roles", response_model=list[TeacherRoleOut])
def list_teacher_roles(db: Session = Depends(get_db), _: Teacher = Depends(require_admin)):
    return [TeacherRoleOut(id=r.id, name=r.name) for r in db.query(TeacherRole).order_by(TeacherRole.name).all()]


@router.get("/grants", response_model=list[GrantRow])
def list_grants(db: Session = Depends(get_db), _: Teacher = Depends(require_admin)):
    return [
        GrantRow(feature_slug=g.feature_slug, teacher_role_id=g.teacher_role_id, teacher_id=g.teacher_id)
        for g in db.query(AdminFeatureGrant).all()
    ]


@router.put("/grant", response_model=GrantRow, status_code=201)
def add_grant(body: GrantIn, db: Session = Depends(get_db), _: Teacher = Depends(require_admin)):
    if body.feature_slug not in admin_features.SLUGS:
        raise HTTPException(404, f"Unbekanntes Feature: {body.feature_slug}")
    existing = (
        db.query(AdminFeatureGrant)
        .filter_by(feature_slug=body.feature_slug,
                   teacher_role_id=body.teacher_role_id, teacher_id=body.teacher_id)
        .first()
    )
    if not existing:
        db.add(AdminFeatureGrant(
            feature_slug=body.feature_slug,
            teacher_role_id=body.teacher_role_id, teacher_id=body.teacher_id,
        ))
        db.commit()
    return GrantRow(feature_slug=body.feature_slug,
                    teacher_role_id=body.teacher_role_id, teacher_id=body.teacher_id)


@router.delete("/grant", status_code=204)
def remove_grant(
    feature_slug: str,
    teacher_role_id: int | None = None,
    teacher_id: int | None = None,
    db: Session = Depends(get_db),
    _: Teacher = Depends(require_admin),
):
    db.query(AdminFeatureGrant).filter_by(
        feature_slug=feature_slug, teacher_role_id=teacher_role_id, teacher_id=teacher_id,
    ).delete()
    db.commit()
