"""
Schémas Pydantic pour la gestion des utilisateurs et des rôles RBAC
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    description: Optional[str] = None
    module: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    permissions: List[PermissionOut] = []


class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    full_name: str
    role_name: str  # 'Administrator', 'Analyst', 'Observer'
    password: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    role_name: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    permissions: List[str]
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
