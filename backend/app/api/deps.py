"""
FastAPI dependencies for authentication and RBAC access control
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token, DatabaseSecurityError
from app.models.user import User


def get_client_ip(request: Request) -> str:
    """Extracts the real client IP address even behind an HTTPS reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Extracts and validates the JWT token.
    Verifies account existence and active status in PostgreSQL.
    FAIL-CLOSED behavior: on DB revocation check failure, access is denied with 503.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token or invalid format.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]
    try:
        payload = decode_token(token, db=db)
    except DatabaseSecurityError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable (unable to verify token revocation).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, revoked, or expired session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account disabled.",
        )

    return user


def require_permission(perm_code: str):
    """
    Strict server-side permission check.
    Rejects any unauthorized request with HTTP 403.
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        if not user.has_permission(perm_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient privilege. Required permission: {perm_code}",
            )
        return user
    return checker
