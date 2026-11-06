"""
Modèles SQLAlchemy pour les Interfaces Réseau et Paramètres Système OpenNDR V0.1
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Integer,
    Text,
)
from app.core.database import Base


class NetworkInterface(Base):
    __tablename__ = "network_interfaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(32), unique=True, nullable=False, index=True)
    role = Column(String(16), nullable=False)  # 'ADMINISTRATION' ou 'CAPTURE_PASSIVE'
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(17), nullable=False)
    is_promiscuous = Column(Boolean, default=False, nullable=False)
    is_up = Column(Boolean, default=True, nullable=False)
    mtu = Column(Integer, default=1500, nullable=False)
    speed_mbps = Column(Integer, default=1000, nullable=False)
    rx_dropped = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @property
    def is_stealth_compliant(self) -> bool:
        """
        En mode CAPTURE_PASSIVE, l'interface DOIT impérativement n'avoir AUCUNE adresse IP
        et être en mode PROMISCUOUS.
        """
        if self.role == "CAPTURE_PASSIVE":
            return self.ip_address is None and self.is_promiscuous
        return True


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(64), primary_key=True, index=True)
    value_json = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = Column(String(36), nullable=True)
