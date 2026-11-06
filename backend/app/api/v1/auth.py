"""
Routes d'authentification OpenNDR V0.1
Connexion, déconnexion, profil et changement de mot de passe.
"""
from fastapi import APIRouter, Depends, Request, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import revoke_token
from app.schemas.auth import LoginRequest, TokenResponse, PasswordChangeRequest
from app.schemas.user import UserOut
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.api.deps import get_current_user, get_client_ip
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    creds: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authentification locale et délivrance du jeton JWT."""
    ip_addr = get_client_ip(request)
    user, token = AuthService.authenticate_user(
        db=db,
        email=creds.email,
        password=creds.password,
        ip_address=ip_addr,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.primary_role,
        "email": user.email,
        "full_name": user.full_name,
        "permissions": user.all_permissions,
    }


@router.post("/logout")
def logout(
    request: Request,
    authorization: Optional[str] = Header(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Révocation du jeton et journalisation de la déconnexion."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        revoke_token(token)

    ip_addr = get_client_ip(request)
    AuditService.log_event(
        db=db,
        action="AUTH_LOGOUT",
        resource_type="AUTH",
        resource_id=current_user.id,
        status="SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=ip_addr,
    )
    return {"message": "Déconnexion réussie"}


@router.get("/me", response_model=UserOut)
def get_current_profile(current_user: User = Depends(get_current_user)):
    """Retourne les informations du compte actuellement authentifié."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.primary_role,
        "permissions": current_user.all_permissions,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at,
    }


@router.post("/change-password")
def change_password(
    req: PasswordChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Changement sécurisé de mot de passe avec validation de politique."""
    ip_addr = get_client_ip(request)
    AuthService.change_password(
        db=db,
        user=current_user,
        current_password=req.current_password,
        new_password=req.new_password,
        ip_address=ip_addr,
    )
    return {"message": "Mot de passe modifié avec succès"}
