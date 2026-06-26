from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Teacher
from ..schemas import LoginRequest, TokenOut, TeacherOut
from ..auth import verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    # Support "Firstname Lastname" or just "Lastname"
    parts = body.username.strip().split(" ", 1)
    if len(parts) == 2:
        teacher = db.query(Teacher).filter(
            Teacher.first_name == parts[0],
            Teacher.last_name == parts[1],
            Teacher.active == True,
        ).first()
    else:
        teacher = db.query(Teacher).filter(
            Teacher.last_name == parts[0],
            Teacher.active == True,
        ).first()

    if not teacher or not teacher.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(body.password, teacher.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": str(teacher.id)})
    return TokenOut(access_token=token, teacher=TeacherOut.model_validate(teacher))
