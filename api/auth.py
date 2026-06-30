import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
import bcrypt as _bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models import Teacher, Student, RevokedToken
from .config import settings

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {**data, "exp": expire, "jti": jti}
    # Enforce HS256 — never accept algorithm substitution
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def _resolve_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> str | None:
    """Return raw JWT string from cookie (preferred) or Authorization header."""
    token = request.cookies.get("hp_session")
    if not token and credentials:
        token = credentials.credentials
    return token


def _decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload


def _check_revocation(jti: str | None, db: Session) -> None:
    if not jti:
        return
    if db.get(RevokedToken, jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Union[Teacher, Student]:
    token = _resolve_token(request, credentials)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = _decode_token(token)
    _check_revocation(payload.get("jti"), db)

    user_type = payload.get("type", "teacher")  # default "teacher" for legacy tokens
    sub = int(payload["sub"])

    if user_type == "student":
        user = db.get(Student, sub)
        if not user or not user.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Student not found")
        return user
    else:
        user = db.get(Teacher, sub)
        if not user or not user.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Teacher not found")
        return user


def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Union[Teacher, Student, None]:
    try:
        return get_current_user(request, credentials, db)
    except HTTPException:
        return None


def get_current_teacher(
    user: Union[Teacher, Student] = Depends(get_current_user),
) -> Teacher:
    if not isinstance(user, Teacher):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return user


def require_admin(
    user: Union[Teacher, Student] = Depends(get_current_user),
) -> Teacher:
    if not isinstance(user, Teacher) or user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user


def revoke_token_from_request(request: Request, db: Session) -> None:
    """Extract token from request (cookie or header), add jti to blocklist."""
    token = request.cookies.get("hp_session")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            if not db.get(RevokedToken, jti):
                db.add(RevokedToken(jti=jti, expires_at=expires_at))
                db.commit()
    except JWTError:
        pass
