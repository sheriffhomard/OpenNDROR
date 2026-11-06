"""
Modèle SQLAlchemy pour le Journal d'Audit de Sécurité OpenNDR V0.1
Persistance PostgreSQL immuable de toutes les actions sensibles.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Integer,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False)
    action = Column(String(64), nullable=False, index=True)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(128), nullable=True)
    details_json = Column(Text, nullable=True)
    status = Column(String(16), nullable=False)  # 'SUCCESS', 'DENIED', 'FAILURE'

    user = relationship("User", back_populates="audit_logs")
