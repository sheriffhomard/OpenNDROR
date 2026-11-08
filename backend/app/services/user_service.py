import secrets
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Role
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password, validate_password_strength
from app.services.audit_service import AuditService


class UserService:
    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower().strip()).first()

    @staticmethod
    def list_users(db: Session) -> List[User]:
        return db.query(User).order_by(User.created_at.asc()).all()

    @staticmethod
    def create_user(
        db: Session,
        user_in: UserCreate,
        current_admin: User,
        ip_address: str = "127.0.0.1",
    ) -> Tuple[User, str]:
        """Création d'un nouvel utilisateur par un administrateur."""
        existing = UserService.get_user_by_email(db, user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un compte avec cette adresse e-mail existe déjà.",
            )

        role = db.query(Role).filter(Role.name == user_in.role_name).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rôle inexistant : {user_in.role_name}. Choisissez 'Administrator', 'Analyst' ou 'Observer'.",
            )

        # Mot de passe fourni ou généré aléatoirement
        raw_password = user_in.password
        if not raw_password:
            raw_password = f"OpenNDR-{secrets.token_hex(4).upper()}!2026"
        else:
            is_valid, err = validate_password_strength(raw_password)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Mot de passe non conforme : {err}",
                )

        new_user = User(
            email=user_in.email.lower().strip(),
            full_name=user_in.full_name.strip(),
            hashed_password=hash_password(raw_password),
            is_active=True,
            roles=[role],
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        AuditService.log_event(
            db=db,
            action="USER_CREATED",
            resource_type="USER",
            resource_id=new_user.id,
            status="SUCCESS",
            user_email=current_admin.email,
            user_id=current_admin.id,
            ip_address=ip_address,
            details={"email": new_user.email, "role": role.name},
        )

        return new_user, raw_password

    @staticmethod
    def update_user(
        db: Session,
        target_user: User,
        user_in: UserUpdate,
        current_admin: User,
        ip_address: str = "127.0.0.1",
    ) -> User:
        """Mise à jour des informations d'un utilisateur."""
        if user_in.full_name is not None:
            target_user.full_name = user_in.full_name.strip()

        if user_in.is_active is not None:
            # Empêcher l'auto-désactivation du dernier administrateur
            if target_user.id == current_admin.id and not user_in.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Impossible de désactiver votre propre compte administrateur.",
                )
            target_user.is_active = user_in.is_active

        if user_in.role_name is not None:
            new_role = db.query(Role).filter(Role.name == user_in.role_name).first()
            if not new_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Rôle inconnu : {user_in.role_name}",
                )
            target_user.roles = [new_role]

        db.commit()
        db.refresh(target_user)

        AuditService.log_event(
            db=db,
            action="USER_UPDATED",
            resource_type="USER",
            resource_id=target_user.id,
            status="SUCCESS",
            user_email=current_admin.email,
            user_id=current_admin.id,
            ip_address=ip_address,
            details={"updated_id": target_user.id, "active": target_user.is_active},
        )

        return target_user

    @staticmethod
    def delete_user(
        db: Session,
        target_user: User,
        current_admin: User,
        ip_address: str = "127.0.0.1",
    ) -> None:
        """Suppression d'un compte utilisateur avec audit."""
        if target_user.id == current_admin.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de supprimer votre propre compte administrateur.",
            )

        deleted_email = target_user.email
        deleted_id = target_user.id

        db.delete(target_user)
        db.commit()

        AuditService.log_event(
            db=db,
            action="USER_DELETED",
            resource_type="USER",
            resource_id=deleted_id,
            status="SUCCESS",
            user_email=current_admin.email,
            user_id=current_admin.id,
            ip_address=ip_address,
            details={"deleted_email": deleted_email, "deleted_id": deleted_id},
        )
