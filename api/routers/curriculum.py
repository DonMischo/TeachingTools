"""Curriculum-Abgleich: schulinternes Curriculum gegen alten und neuen Lehrplan.

Ein Plan gehört der Fachschaft: jede Lehrkraft liest und bearbeitet ihn.
Kolleg·innen ohne Konto kommen per QR/Beitrittslink als Gast dazu
(``guest_permission`` read oder edit). Geändert wird nur über
``POST /{id}/ops`` — die Operationen stehen in api/curriculum_ops.py.
"""
import json
import secrets
from copy import deepcopy
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import (
    Guest, bearer, create_guest_token, get_current_teacher, get_current_user_optional,
    guest_from_credentials, guest_token_minutes,
)
from ..availability import require_capability
from ..curriculum_ops import OpFehler, anwenden, leer, pruefen
from ..database import get_db
from ..join_codes import code_taken
from ..models import CurriculumPlan, Teacher

router = APIRouter(prefix="/api/curriculum", tags=["curriculum"])

_GUEST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # ohne 0/O/1/I
DATA_MAX_BYTES = 3_000_000


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlanKurz(BaseModel):
    id: int
    name: str
    fach: str
    owner_teacher_id: int
    owner_name: str
    version: int
    zuletzt_von: str | None
    updated_at: str | None


class PlanOut(PlanKurz):
    data: dict
    allow_guests: bool
    guest_code: str | None
    guest_permission: str
    darf_verwalten: bool
    darf_bearbeiten: bool


class PlanIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    fach: str = Field(default="Mathematik", max_length=100)
    data: dict | None = None


class PlanPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    allow_guests: bool | None = None
    guest_permission: str | None = None


class OpsIn(BaseModel):
    ops: list[dict] = Field(min_length=1, max_length=200)


class VersionOut(BaseModel):
    version: int


# ── Zugriff ───────────────────────────────────────────────────────────────────

Principal = Union[Teacher, Guest]


def plan_principal(
    plan_id: int,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Principal:
    """Lehrkraft per Anmeldung, sonst Gast mit Token genau dieses Plans."""
    user = get_current_user_optional(request, credentials, db)
    if isinstance(user, Teacher):
        return user
    if user is not None:
        raise HTTPException(403, "Nur für Lehrkräfte")
    plan = db.get(CurriculumPlan, plan_id)
    if plan and plan.allow_guests and plan.guest_code:
        guest = guest_from_credentials(credentials, plan.guest_code, db)
        if guest is not None:
            return guest
    raise HTTPException(401, "Nicht authentifiziert")


def _plan(db: Session, plan_id: int) -> CurriculumPlan:
    plan = db.get(CurriculumPlan, plan_id)
    if not plan:
        raise HTTPException(404, "Plan nicht gefunden")
    return plan


def _verwalten(plan: CurriculumPlan, who: Principal) -> bool:
    return isinstance(who, Teacher) and (who.id == plan.owner_teacher_id or who.role == "admin")


def _bearbeiten(plan: CurriculumPlan, who: Principal) -> bool:
    return isinstance(who, Teacher) or plan.guest_permission == "edit"


def _name(who: Principal) -> str:
    if isinstance(who, Teacher):
        return f"{who.first_name} {who.last_name}".strip()
    return f"{who.name} (Gast)"


def _kurz(plan: CurriculumPlan) -> dict:
    o = plan.owner
    return dict(
        id=plan.id, name=plan.name, fach=plan.fach, owner_teacher_id=plan.owner_teacher_id,
        owner_name=f"{o.first_name} {o.last_name}".strip() if o else "",
        version=plan.version, zuletzt_von=plan.zuletzt_von,
        updated_at=plan.updated_at.isoformat() if plan.updated_at else None,
    )


def _out(plan: CurriculumPlan, who: Principal) -> PlanOut:
    verwalten = _verwalten(plan, who)
    return PlanOut(
        **_kurz(plan), data=plan.data,
        allow_guests=plan.allow_guests,
        guest_code=plan.guest_code if isinstance(who, Teacher) else None,
        guest_permission=plan.guest_permission,
        darf_verwalten=verwalten, darf_bearbeiten=_bearbeiten(plan, who),
    )


def _new_guest_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_GUEST_CODE_ALPHABET) for _ in range(6))
        if not code_taken(db, code):  # über alle Werkzeuge eindeutig (/play)
            return code
    raise HTTPException(500, "Konnte keinen Gastcode erzeugen")


# ── Pläne ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PlanKurz])
def plaene(db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    return [_kurz(p) for p in db.query(CurriculumPlan).order_by(CurriculumPlan.fach, CurriculumPlan.name)]


@router.post("", response_model=PlanOut, status_code=201,
             dependencies=[Depends(require_capability("curriculum", "use"))])
def anlegen(body: PlanIn, db: Session = Depends(get_db), t: Teacher = Depends(get_current_teacher)):
    data = leer(body.fach)
    if body.data:
        try:
            data = anwenden(data, {"op": "import", "daten": pruefen(body.data)})
        except OpFehler as e:
            raise HTTPException(422, str(e))
    plan = CurriculumPlan(name=body.name.strip(), fach=body.fach, owner_teacher_id=t.id,
                          data=data, version=1, zuletzt_von=_name(t))
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _out(plan, t)


@router.get("/{plan_id}", response_model=Union[PlanOut, VersionOut])
def lesen(plan_id: int, seit: int | None = None, db: Session = Depends(get_db),
          who: Principal = Depends(plan_principal)):
    """Mit ``?seit=<version>`` nur die Versionsnummer, solange sich nichts geändert hat."""
    plan = _plan(db, plan_id)
    if seit is not None and seit == plan.version:
        return VersionOut(version=plan.version)
    return _out(plan, who)


@router.post("/{plan_id}/ops", response_model=PlanOut)
def aendern(plan_id: int, body: OpsIn, db: Session = Depends(get_db),
            who: Principal = Depends(plan_principal)):
    plan = db.query(CurriculumPlan).filter(CurriculumPlan.id == plan_id).with_for_update().first()
    if not plan:
        raise HTTPException(404, "Plan nicht gefunden")
    if not _bearbeiten(plan, who):
        raise HTTPException(403, "Nur lesen")
    doc = plan.data
    try:
        for op in body.ops:
            doc = anwenden(doc, op)
    except (OpFehler, KeyError, TypeError) as e:
        raise HTTPException(422, f"Änderung abgelehnt: {e}")
    if len(json.dumps(doc, ensure_ascii=False).encode()) > DATA_MAX_BYTES:
        raise HTTPException(413, "Plan zu groß")
    plan.data = doc
    plan.version += 1
    plan.zuletzt_von = _name(who)
    db.commit()
    db.refresh(plan)
    return _out(plan, who)


@router.patch("/{plan_id}", response_model=PlanOut)
def einstellen(plan_id: int, body: PlanPatch, db: Session = Depends(get_db),
               t: Teacher = Depends(get_current_teacher)):
    plan = _plan(db, plan_id)
    if body.name is not None:
        plan.name = body.name.strip()
    if body.allow_guests is not None or body.guest_permission is not None:
        if not _verwalten(plan, t):
            raise HTTPException(403, "Gastzugang stellt nur die anlegende Lehrkraft ein")
        if body.guest_permission is not None:
            if body.guest_permission not in ("read", "edit"):
                raise HTTPException(422, "guest_permission: read oder edit")
            plan.guest_permission = body.guest_permission
        if body.allow_guests is not None:
            plan.allow_guests = body.allow_guests
            if body.allow_guests and not plan.guest_code:
                plan.guest_code = _new_guest_code(db)
    db.commit()
    db.refresh(plan)
    return _out(plan, t)


@router.post("/{plan_id}/guest-code", response_model=PlanOut)
def neuer_gastcode(plan_id: int, db: Session = Depends(get_db), t: Teacher = Depends(get_current_teacher)):
    """Neuen Code erzeugen — der alte QR-Code gilt dann nicht mehr."""
    plan = _plan(db, plan_id)
    if not _verwalten(plan, t):
        raise HTTPException(403, "Nur die anlegende Lehrkraft")
    plan.guest_code = _new_guest_code(db)
    plan.allow_guests = True
    db.commit()
    db.refresh(plan)
    return _out(plan, t)


@router.post("/{plan_id}/kopie", response_model=PlanOut, status_code=201)
def kopieren(plan_id: int, db: Session = Depends(get_db), t: Teacher = Depends(get_current_teacher)):
    """Eigene Kopie, z. B. um eine Umstellung erst durchzuspielen."""
    src = _plan(db, plan_id)
    plan = CurriculumPlan(name=f"{src.name} (Kopie)"[:200], fach=src.fach, owner_teacher_id=t.id,
                          data=deepcopy(src.data), version=1, zuletzt_von=_name(t))
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _out(plan, t)


@router.delete("/{plan_id}", status_code=204)
def loeschen(plan_id: int, db: Session = Depends(get_db), t: Teacher = Depends(get_current_teacher)):
    plan = _plan(db, plan_id)
    if not _verwalten(plan, t):
        raise HTTPException(403, "Nur die anlegende Lehrkraft")
    db.delete(plan)
    db.commit()


# ── Gastbeitritt (QR / Link) ─────────────────────────────────────────────────

class GuestJoinIn(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=100)


class GuestJoinOut(BaseModel):
    token: str
    name: str
    plan_id: int
    plan_name: str
    permission: str


def _plan_by_code(code: str, db: Session) -> CurriculumPlan | None:
    return db.query(CurriculumPlan).filter(CurriculumPlan.guest_code == code.strip().upper()).first()


@router.get("/guest/status")
def guest_status(code: str, db: Session = Depends(get_db)):
    plan = _plan_by_code(code, db)
    if not plan or not plan.allow_guests:
        return {"allow_guests": False}
    return {"allow_guests": True, "plan_id": plan.id, "plan_name": plan.name,
            "permission": plan.guest_permission}


@router.post("/guest/join", response_model=GuestJoinOut)
def guest_join(body: GuestJoinIn, db: Session = Depends(get_db)):
    plan = _plan_by_code(body.code, db)
    if not plan or not plan.allow_guests:
        raise HTTPException(403, "Gäste sind für diesen Plan nicht freigeschaltet")
    name = body.name.strip()[:100]
    if not name:
        raise HTTPException(422, "Bitte einen Namen angeben")
    return GuestJoinOut(
        token=create_guest_token(plan.guest_code, name, minutes=guest_token_minutes(db)),
        name=name, plan_id=plan.id, plan_name=plan.name, permission=plan.guest_permission,
    )
