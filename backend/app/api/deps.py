"""
Dépendances FastAPI pour l'authentification et le contrôle d'accès RBAC
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User


def get_client_ip(request: Request) -> str:
    """Extrait l'adresse IP cliente réelle même derrière un reverse-proxy HTTPS."""
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
    Extrait et valide le jeton JWT.
    Vérifie l'existence et l'état actif du compte dans PostgreSQL.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification manquant ou format invalide.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalide ou expirée.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Charge utile du jeton invalide.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte utilisateur introuvable.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte utilisateur désactivé.",
        )

    return user


def require_permission(perm_code: str):
    """
    Vérification stricte de permission côté serveur.
    Rejette toute requête non autorisée avec un code HTTP 403.
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        if not user.has_permission(perm_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Privilège insuffisant. Permission requise : {perm_code}",
            )
        return user
    return checker
