from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Teacher, Student
from ..schemas import LoginRequest, TokenOut, TeacherOut, StudentOut, MeOut
from ..auth import (
    verify_password, create_access_token, get_current_user,
    revoke_token_from_request
)
from ..config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE_NAME = "hp_session"
_COOKIE_MAX_AGE = settings.access_token_expire_minutes * 60


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
        # secure=True  # enable behind HTTPS in production
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    teacher = _find_teacher(body.username, db)
    if teacher:
        if not teacher.password_hash or not verify_password(body.password, teacher.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = create_access_token({"sub": str(teacher.id), "type": "teacher"})
        _set_auth_cookie(response, token)
        return TokenOut(access_token=token, teacher=TeacherOut.model_validate(teacher))

    # Try student login
    student = db.query(Student).filter(
        Student.username == body.username.strip(),
        Student.active == True,
    ).first()
    if student and student.password_hash and verify_password(body.password, student.password_hash):
        token = create_access_token({"sub": str(student.id), "type": "student"})
        _set_auth_cookie(response, token)
        # Return a TokenOut with a synthetic TeacherOut so legacy clients keep working
        fake_teacher = TeacherOut(
            id=student.id,
            first_name=student.vorname,
            last_name=student.nachname,
            active=student.active,
            role="student",
        )
        return TokenOut(access_token=token, teacher=fake_teacher)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    revoke_token_from_request(request, db)
    response.delete_cookie(_COOKIE_NAME)


@router.get("/me", response_model=MeOut)
def me(user=Depends(get_current_user)):
    if isinstance(user, Teacher):
        return MeOut(user_type="teacher", teacher=TeacherOut.model_validate(user))
    student_out = StudentOut.model_validate(user)
    student_out.has_credentials = bool(user.username and user.password_hash)
    return MeOut(user_type="student", student=student_out)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _find_teacher(username: str, db: Session) -> Teacher | None:
    parts = username.strip().split(" ", 1)
    if len(parts) == 2:
        return db.query(Teacher).filter(
            Teacher.first_name == parts[0],
            Teacher.last_name == parts[1],
            Teacher.active == True,
        ).first()
    return db.query(Teacher).filter(
        Teacher.last_name == parts[0],
        Teacher.active == True,
    ).first()
