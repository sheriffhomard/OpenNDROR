"""
Routes d'administration des utilisateurs et rôles OpenNDR V0.1
Contrôlées strictement par le RBAC côté serveur.
"""
from typing import List
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserCreateResponse
from app.services.user_service import UserService
from app.api.deps import require_permission, get_client_ip

router = APIRouter()


@router.get("", response_model=List[UserOut])
def list_users(
    current_user: User = Depends(require_permission("users:view")),
    db: Session = Depends(get_db),
):
    """Liste tous les comptes enregistrés dans PostgreSQL."""
    users = UserService.list_users(db)
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.primary_role,
            "permissions": u.all_permissions,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
        }
        for u in users
    ]


@router.post("", response_model=UserCreateResponse)
def create_user(
    user_in: UserCreate,
    request: Request,
    current_admin: User = Depends(require_permission("users:manage")),
    db: Session = Depends(get_db),
):
    """Création d'un nouvel utilisateur par un administrateur."""
    ip_addr = get_client_ip(request)
    new_user, raw_password = UserService.create_user(
        db=db,
        user_in=user_in,
        current_admin=current_admin,
        ip_address=ip_addr,
    )
    return {
        "id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": new_user.primary_role,
        "permissions": new_user.all_permissions,
        "is_active": new_user.is_active,
        "created_at": new_user.created_at,
        "last_login_at": new_user.last_login_at,
        "temporary_password": raw_password if not user_in.password else None,
    }


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    user_in: UserUpdate,
    request: Request,
    current_admin: User = Depends(require_permission("users:manage")),
    db: Session = Depends(get_db),
):
    """Mise à jour des informations d'un utilisateur."""
    target = UserService.get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    ip_addr = get_client_ip(request)
    updated = UserService.update_user(
        db=db,
        target_user=target,
        user_in=user_in,
        current_admin=current_admin,
        ip_address=ip_addr,
    )
    return {
        "id": updated.id,
        "email": updated.email,
        "full_name": updated.full_name,
        "role": updated.primary_role,
        "permissions": updated.all_permissions,
        "is_active": updated.is_active,
        "created_at": updated.created_at,
        "last_login_at": updated.last_login_at,
    }


@router.post("/{user_id}/toggle-active", response_model=UserOut)
def toggle_user_active(
    user_id: str,
    request: Request,
    current_admin: User = Depends(require_permission("users:manage")),
    db: Session = Depends(get_db),
):
    """Active ou désactive un compte utilisateur."""
    target = UserService.get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    ip_addr = get_client_ip(request)
    updated = UserService.update_user(
        db=db,
        target_user=target,
        user_in=UserUpdate(is_active=not target.is_active),
        current_admin=current_admin,
        ip_address=ip_addr,
    )
    return {
        "id": updated.id,
        "email": updated.email,
        "full_name": updated.full_name,
        "role": updated.primary_role,
        "permissions": updated.all_permissions,
        "is_active": updated.is_active,
        "created_at": updated.created_at,
        "last_login_at": updated.last_login_at,
    }


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    request: Request,
    current_admin: User = Depends(require_permission("users:manage")),
    db: Session = Depends(get_db),
):
    """Suppression définitive d'un compte utilisateur."""
    target = UserService.get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    ip_addr = get_client_ip(request)
    UserService.delete_user(
        db=db,
        target_user=target,
        current_admin=current_admin,
        ip_address=ip_addr,
    )
    return None
