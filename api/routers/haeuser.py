import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Haus, HausMember, Class, Transaction
from ..auth import get_current_teacher

router = APIRouter(prefix="/api/haeuser", tags=["haeuser"])

LOGO_ROOT = Path(__file__).parent.parent.parent / "data" / "haeuser"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class HausCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class HausMembersUpdate(BaseModel):
    class_ids: list[int]


class HausOut(BaseModel):
    id: int
    name: str
    color: str
    logo_path: str | None
    class_ids: list[int]
    total_points: int


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _haus_out(h: Haus, db: Session) -> HausOut:
    class_ids = [m.class_id for m in h.members]
    total_points = 0
    if class_ids:
        row = db.query(func.coalesce(func.sum(Transaction.points), 0)).filter(
            Transaction.class_id.in_(class_ids)
        ).scalar()
        total_points = int(row)
    return HausOut(
        id=h.id,
        name=h.name,
        color=h.color,
        logo_path=h.logo_path,
        class_ids=class_ids,
        total_points=total_points,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[HausOut])
def list_haeuser(db: Session = Depends(get_db)):
    haeuser = db.query(Haus).order_by(Haus.id).all()
    return [_haus_out(h, db) for h in haeuser]


@router.post("", response_model=HausOut, status_code=201)
def create_haus(
    body: HausCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_teacher),
):
    h = Haus(name=body.name.strip(), color=body.color)
    db.add(h)
    db.commit()
    db.refresh(h)
    return _haus_out(h, db)


@router.put("/{haus_id}", response_model=HausOut)
def update_haus(
    haus_id: int,
    body: HausCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_teacher),
):
    h = db.get(Haus, haus_id)
    if not h:
        raise HTTPException(404, "Haus not found")
    h.name = body.name.strip()
    h.color = body.color
    db.commit()
    db.refresh(h)
    return _haus_out(h, db)


@router.delete("/{haus_id}", status_code=204)
def delete_haus(
    haus_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_teacher),
):
    h = db.get(Haus, haus_id)
    if not h:
        raise HTTPException(404, "Haus not found")
    db.delete(h)
    db.commit()


@router.post("/{haus_id}/logo", response_model=HausOut)
def upload_logo(
    haus_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_teacher),
):
    h = db.get(Haus, haus_id)
    if not h:
        raise HTTPException(404, "Haus not found")
    logo_dir = LOGO_ROOT / str(haus_id)
    logo_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "logo.png").suffix or ".png"
    dest = logo_dir / f"logo{ext}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    h.logo_path = f"/uploads/haeuser/{haus_id}/logo{ext}"
    db.commit()
    db.refresh(h)
    return _haus_out(h, db)


@router.put("/{haus_id}/members", response_model=HausOut)
def set_members(
    haus_id: int,
    body: HausMembersUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_teacher),
):
    h = db.get(Haus, haus_id)
    if not h:
        raise HTTPException(404, "Haus not found")
    for cid in body.class_ids:
        if not db.get(Class, cid):
            raise HTTPException(400, f"Class {cid} not found")
    db.query(HausMember).filter_by(haus_id=haus_id).delete()
    for cid in body.class_ids:
        db.add(HausMember(haus_id=haus_id, class_id=cid))
    db.commit()
    db.refresh(h)
    return _haus_out(h, db)
