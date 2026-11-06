"""
Service d'authentification et de gestion des identités OpenNDR V0.1
Hachage Argon2id, vérification de politique de mot de passe, migration et délivrance JWT.
"""
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Role
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    validate_password_strength,
)
from app.services.audit_service import AuditService


class AuthService:
    @staticmethod
    def authenticate_user(
        db: Session,
        email: str,
        password: str,
        ip_address: str = "127.0.0.1",
    ) -> Tuple[User, str]:
        """
        Authentifie l'utilisateur contre la base PostgreSQL.
        Gère la migration transparente vers Argon2id si l'ancien hachage était PBKDF2.
        Rejette toute tentative si le compte est inactif ou inexistant.
        """
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if not user:
            AuditService.log_event(
                db=db,
                action="AUTH_LOGIN_FAILED",
                resource_type="AUTH",
                resource_id=email,
                status="FAILURE",
                user_email=email,
                ip_address=ip_address,
                details={"reason": "Compte introuvable"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants d'accès invalides.",
            )

        if not user.is_active:
            AuditService.log_event(
                db=db,
                action="AUTH_LOGIN_BLOCKED",
                resource_type="AUTH",
                resource_id=user.id,
                status="DENIED",
                user_email=user.email,
                user_id=user.id,
                ip_address=ip_address,
                details={"reason": "Compte désactivé"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Compte utilisateur désactivé. Contactez l'administrateur.",
            )

        is_valid, needs_rehash = verify_password(password, user.hashed_password)
        if not is_valid:
            AuditService.log_event(
                db=db,
                action="AUTH_LOGIN_FAILED",
                resource_type="AUTH",
                resource_id=user.id,
                status="FAILURE",
                user_email=user.email,
                user_id=user.id,
                ip_address=ip_address,
                details={"reason": "Mot de passe incorrect"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants d'accès invalides.",
            )

        # Migration transparente vers Argon2id si nécessaire
        if needs_rehash:
            user.hashed_password = hash_password(password)

        user.last_login_at = datetime.now(timezone.utc)
        db.commit()

        token = create_access_token({
            "sub": user.id,
            "email": user.email,
            "role": user.primary_role,
        })

        AuditService.log_event(
            db=db,
            action="AUTH_LOGIN_SUCCESS",
            resource_type="AUTH",
            resource_id=user.id,
            status="SUCCESS",
            user_email=user.email,
            user_id=user.id,
            ip_address=ip_address,
            details={"role": user.primary_role},
        )

        return user, token

    @staticmethod
    def change_password(
        db: Session,
        user: User,
        current_password: str,
        new_password: str,
        ip_address: str = "127.0.0.1",
    ) -> None:
        """Procédure de changement de mot de passe par l'utilisateur connecté."""
        is_valid, _ = verify_password(current_password, user.hashed_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le mot de passe actuel est incorrect.",
            )

        is_strong, err_msg = validate_password_strength(new_password)
        if not is_strong:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nouveau mot de passe non conforme : {err_msg}",
            )

        user.hashed_password = hash_password(new_password)
        db.commit()

        AuditService.log_event(
            db=db,
            action="AUTH_PASSWORD_CHANGED",
            resource_type="USER",
            resource_id=user.id,
            status="SUCCESS",
            user_email=user.email,
            user_id=user.id,
            ip_address=ip_address,
        )
