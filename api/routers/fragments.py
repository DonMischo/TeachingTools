"""Fragment collections + access grants.

A collection is a TaskCards-style board owned by a teacher. Who else may see or
edit it is governed by grant rows; all permission checks funnel through
api/fragment_access.py. Card CRUD (text fragments + research clippings) lives in
the sibling routers; this module owns the collection and its ACL.
"""
import secrets
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..auth import get_current_user, get_current_teacher, create_guest_token, guest_token_minutes
from ..availability import require_capability
from ..models import (
    Teacher, Student, Class, StudentGroup,
    FragmentCollection, FragmentCollectionGrant, Fragment, ResearchItem,
)
from ..fragment_access import (
    resolve_permission, at_least, require_permission, collection_principal,
)

router = APIRouter(prefix="/api/fragments", tags=["fragments"])

_GRANTEE_TYPES = ("all_teachers", "class", "group", "teacher")
_GRANTABLE_PERMS = ("read", "contribute", "manage")
_GUEST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I


# ── Schemas ───────────────────────────────────────────────────────────────────

class GrantIn(BaseModel):
    grantee_type: str
    class_id: int | None = None
    teacher_id: int | None = None
    group_id: int | None = None
    permission: str

    def validate_self(self):
        if self.grantee_type not in _GRANTEE_TYPES:
            raise HTTPException(400, f"Ungültiger grantee_type: {self.grantee_type}")
        if self.permission not in _GRANTABLE_PERMS:
            raise HTTPException(400, f"Ungültige Berechtigung: {self.permission}")
        if self.grantee_type == "class":
            if self.class_id is None:
                raise HTTPException(400, "class-Grant braucht eine class_id")
            self.teacher_id = self.group_id = None
        elif self.grantee_type == "group":
            if self.group_id is None:
                raise HTTPException(400, "group-Grant braucht eine group_id")
            self.class_id = self.teacher_id = None
        elif self.grantee_type == "teacher":
            if self.teacher_id is None:
                raise HTTPException(400, "teacher-Grant braucht eine teacher_id")
            self.class_id = self.group_id = None
        else:  # all_teachers
            self.class_id = self.teacher_id = self.group_id = None


class GrantOut(BaseModel):
    grantee_type: str
    class_id: int | None = None
    class_code: str | None = None
    teacher_id: int | None = None
    teacher_name: str | None = None
    group_id: int | None = None
    group_name: str | None = None
    permission: str


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    subject: str | None = None
    grants: list[GrantIn] = []


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    subject: str | None = None
    allow_guests: bool | None = None
    guest_permission: str | None = None


class CollectionOut(BaseModel):
    id: int
    name: str
    description: str | None
    subject: str | None
    owner_teacher_id: int
    owner_name: str | None
    allow_guests: bool
    guest_code: str | None
    guest_permission: str
    my_permission: str
    is_owner: bool
    grants: list[GrantOut]
    fragment_count: int
    research_count: int


# ── Serialization ───────────────────────────────────────────────────────────────

def _grant_out(g: FragmentCollectionGrant) -> GrantOut:
    # Eine A/B-Gruppe gehoert zu einer Klasse. Die wird mitgeschickt (rein zur
    # Anzeige — gespeichert ist bei einem group-Grant nur die group_id), damit
    # die Sammlung in der Klassen-Filterleiste auftaucht.
    cls = g.class_ or (g.group.class_ if g.group else None)
    return GrantOut(
        grantee_type=g.grantee_type,
        class_id=cls.id if cls else None,
        class_code=cls.code if cls else None,
        teacher_id=g.teacher_id,
        teacher_name=f"{g.teacher.first_name} {g.teacher.last_name}".strip() if g.teacher else None,
        group_id=g.group_id,
        group_name=_group_label(g.group) if g.group else None,
        permission=g.permission,
    )


def _group_label(g: StudentGroup) -> str:
    """»9a – Gruppe A« bzw. »9 NaT« — der blosse Name »A« sagt nichts."""
    if g.class_ is not None:
        return f"{g.class_.display_name} – Gruppe {g.name}"
    return f"{g.grade} {g.name}" if g.grade else g.name


def _collection_out(coll: FragmentCollection, user, db: Session) -> CollectionOut:
    perm = resolve_permission(user, coll)
    owner = coll.owner
    frag_n = db.query(Fragment).filter(Fragment.collection_id == coll.id).count()
    res_n = db.query(ResearchItem).filter(ResearchItem.collection_id == coll.id).count()
    return CollectionOut(
        id=coll.id,
        name=coll.name,
        description=coll.description,
        subject=coll.subject,
        owner_teacher_id=coll.owner_teacher_id,
        owner_name=f"{owner.first_name} {owner.last_name}".strip() if owner else None,
        allow_guests=coll.allow_guests,
        # Only expose the join code to those who manage the board.
        guest_code=coll.guest_code if at_least(perm, "manage") else None,
        guest_permission=coll.guest_permission,
        my_permission=perm,
        is_owner=isinstance(user, Teacher) and user.id == coll.owner_teacher_id,
        grants=[_grant_out(g) for g in coll.grants] if at_least(perm, "manage") else [],
        fragment_count=frag_n,
        research_count=res_n,
    )


def _apply_grants(coll: FragmentCollection, grants: list[GrantIn], db: Session):
    """Replace a collection's grant set wholesale (deduplicated)."""
    seen: set[tuple[str, int | None, int | None, int | None]] = set()
    coll.grants.clear()
    db.flush()  # emit the deletes before re-inserting (respects the unique constraint)
    for gi in grants:
        gi.validate_self()
        if gi.grantee_type == "class" and not db.get(Class, gi.class_id):
            raise HTTPException(400, f"Klasse {gi.class_id} nicht gefunden")
        if gi.grantee_type == "group" and not db.get(StudentGroup, gi.group_id):
            raise HTTPException(400, f"Gruppe {gi.group_id} nicht gefunden")
        if gi.grantee_type == "teacher":
            t = db.get(Teacher, gi.teacher_id)
            if not t:
                raise HTTPException(400, f"Lehrer {gi.teacher_id} nicht gefunden")
            if gi.teacher_id == coll.owner_teacher_id:
                continue  # owner already has full rights; skip redundant grant
        key = (gi.grantee_type, gi.class_id, gi.teacher_id, gi.group_id)
        if key in seen:
            continue
        seen.add(key)
        coll.grants.append(FragmentCollectionGrant(
            grantee_type=gi.grantee_type,
            class_id=gi.class_id,
            teacher_id=gi.teacher_id,
            group_id=gi.group_id,
            permission=gi.permission,
        ))


# ── Collection CRUD ─────────────────────────────────────────────────────────────

@router.get("/collections", response_model=list[CollectionOut])
def list_collections(
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Collections the caller can see, most-recent first."""
    q = (
        db.query(FragmentCollection)
        .options(selectinload(FragmentCollection.grants).selectinload(FragmentCollectionGrant.class_),
                 selectinload(FragmentCollection.grants).selectinload(FragmentCollectionGrant.teacher),
                 selectinload(FragmentCollection.grants).selectinload(FragmentCollectionGrant.group),
                 selectinload(FragmentCollection.owner))
    )
    colls = q.order_by(FragmentCollection.updated_at.desc()).all()
    visible = [c for c in colls if at_least(resolve_permission(user, c), "read")]
    return [_collection_out(c, user, db) for c in visible]


@router.post("/collections", response_model=CollectionOut, status_code=201,
             dependencies=[Depends(require_capability("fragmente", "create"))])
def create_collection(
    body: CollectionCreate,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    coll = FragmentCollection(
        name=body.name.strip(),
        description=(body.description or None),
        subject=(body.subject or None),
        owner_teacher_id=teacher.id,
    )
    db.add(coll)
    db.flush()
    _apply_grants(coll, body.grants, db)
    db.commit()
    db.refresh(coll)
    return _collection_out(coll, teacher, db)


@router.get("/collections/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    user=Depends(collection_principal),
):
    coll, _ = require_permission(db, user, collection_id, "read")
    return _collection_out(coll, user, db)


@router.patch("/collections/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: int,
    body: CollectionUpdate,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    coll, _ = require_permission(db, user, collection_id, "manage")
    if body.name is not None:
        coll.name = body.name.strip()
    if body.description is not None:
        coll.description = body.description or None
    if body.subject is not None:
        coll.subject = body.subject or None
    if body.guest_permission is not None:
        if body.guest_permission not in ("read", "contribute"):
            raise HTTPException(400, "guest_permission muss 'read' oder 'contribute' sein")
        coll.guest_permission = body.guest_permission
    if body.allow_guests is not None:
        coll.allow_guests = body.allow_guests
        if body.allow_guests and not coll.guest_code:
            coll.guest_code = _new_guest_code(db)
    db.commit()
    db.refresh(coll)
    return _collection_out(coll, user, db)


@router.delete("/collections/{collection_id}", status_code=204)
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    coll = db.get(FragmentCollection, collection_id)
    if not coll:
        raise HTTPException(404, "Sammlung nicht gefunden")
    # Only the owner or an admin may delete a whole board.
    is_admin = isinstance(user, Teacher) and user.role == "admin"
    is_owner = isinstance(user, Teacher) and user.id == coll.owner_teacher_id
    if not (is_admin or is_owner):
        raise HTTPException(403, "Nur der Ersteller darf die Sammlung löschen")
    db.delete(coll)
    db.commit()


# ── Grants ──────────────────────────────────────────────────────────────────────

@router.put("/collections/{collection_id}/grants", response_model=CollectionOut)
def set_grants(
    collection_id: int,
    grants: list[GrantIn],
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Replace the collection's whole grant set (the UI sends the full list)."""
    coll, _ = require_permission(db, user, collection_id, "manage")
    _apply_grants(coll, grants, db)
    db.commit()
    db.refresh(coll)
    return _collection_out(coll, user, db)


# ── Guest code ────────────────────────────────────────────────────────────────

def _new_guest_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_GUEST_CODE_ALPHABET) for _ in range(6))
        if not db.query(FragmentCollection).filter(FragmentCollection.guest_code == code).first():
            return code
    raise HTTPException(500, "Konnte keinen Gastcode erzeugen")


@router.post("/collections/{collection_id}/guest-code", response_model=CollectionOut)
def regenerate_guest_code(
    collection_id: int,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Mint a fresh join code (invalidates the old QR link)."""
    coll, _ = require_permission(db, user, collection_id, "manage")
    coll.guest_code = _new_guest_code(db)
    coll.allow_guests = True
    db.commit()
    db.refresh(coll)
    return _collection_out(coll, user, db)


# ── Guest join (QR / join link) ─────────────────────────────────────────────────

class GuestJoinIn(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=100)


class GuestJoinOut(BaseModel):
    token: str
    name: str
    collection_id: int
    collection_name: str
    permission: str


class GuestStatusOut(BaseModel):
    allow_guests: bool
    collection_id: int | None = None
    collection_name: str | None = None
    permission: str | None = None


def _collection_by_guest_code(code: str, db: Session) -> FragmentCollection | None:
    return db.query(FragmentCollection).filter(FragmentCollection.guest_code == code).first()


@router.get("/guest/status", response_model=GuestStatusOut)
def guest_status(code: str, db: Session = Depends(get_db)):
    """Public: does this join code open a guest-enabled board? Used by the join screen."""
    coll = _collection_by_guest_code(code, db)
    if not coll or not coll.allow_guests:
        return GuestStatusOut(allow_guests=False)
    return GuestStatusOut(
        allow_guests=True, collection_id=coll.id,
        collection_name=coll.name, permission=coll.guest_permission,
    )


@router.post("/guest/join", response_model=GuestJoinOut)
def guest_join(body: GuestJoinIn, db: Session = Depends(get_db)):
    """Mint a collection-scoped guest token for a QR/join-link visitor."""
    coll = _collection_by_guest_code(body.code, db)
    if not coll or not coll.allow_guests:
        raise HTTPException(403, "Gäste sind für diese Sammlung nicht freigeschaltet")
    name = body.name.strip()[:100]
    if not name:
        raise HTTPException(422, "Bitte einen Namen angeben")
    return GuestJoinOut(
        token=create_guest_token(coll.guest_code, name, minutes=guest_token_minutes(db)),
        name=name,
        collection_id=coll.id, collection_name=coll.name, permission=coll.guest_permission,
    )
