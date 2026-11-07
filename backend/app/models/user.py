"""
Modèles SQLAlchemy pour les Utilisateurs, Rôles et Permissions (RBAC) OpenNDR V0.1
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Integer,
    ForeignKey,
    Table,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


# Table d'association Many-to-Many Rôles <-> Permissions
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

# Table d'association Many-to-Many Utilisateurs <-> Rôles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
)


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    module = Column(String(32), nullable=False)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users = relationship("User", secondary=user_roles, back_populates="roles")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="joined")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    def has_permission(self, perm_code: str) -> bool:
        """Vérifie si l'utilisateur possède une permission spécifique via l'un de ses rôles."""
        for role in self.roles:
            for perm in role.permissions:
                if perm.code == perm_code:
                    return True
        return False

    @property
    def primary_role(self) -> str:
        if any(r.name == "Administrator" for r in self.roles):
            return "Administrator"
        if any(r.name == "Analyst" for r in self.roles):
            return "Analyst"
        if any(r.name == "Observer" for r in self.roles):
            return "Observer"
        return "Observer"

    @property
    def all_permissions(self) -> list:
        perms = set()
        for r in self.roles:
            for p in r.permissions:
                perms.add(p.code)
        return sorted(list(perms))


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    revoked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

