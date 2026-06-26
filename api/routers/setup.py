from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Teacher
from ..schemas import TeacherOut, TokenOut
from ..auth import hash_password, create_access_token

router = APIRouter(prefix="/api/setup", tags=["setup"])


class CreateAdminRequest(BaseModel):
    username: str
    password: str


def _admin_exists(db: Session) -> bool:
    return db.query(Teacher).filter(Teacher.role == "admin").first() is not None


@router.get("/status")
def setup_status(db: Session = Depends(get_db)):
    return {"needs_setup": not _admin_exists(db)}


@router.post("/create-admin", response_model=TokenOut)
def create_admin(body: CreateAdminRequest, db: Session = Depends(get_db)):
    if _admin_exists(db):
        raise HTTPException(status_code=403, detail="Setup already complete")
    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    admin = Teacher(
        first_name="",
        last_name=body.username.strip(),
        active=True,
        role="admin",
        password_hash=hash_password(body.password),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    token = create_access_token({"sub": str(admin.id)})
    return TokenOut(access_token=token, teacher=TeacherOut.model_validate(admin))
