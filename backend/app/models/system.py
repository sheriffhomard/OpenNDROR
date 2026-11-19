"""
SQLAlchemy models for Network Interfaces and System Settings (OpenNDR V0.2).
Fields representing uncollected telemetry/hardware properties remain NULL rather than defaulting to fake values.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
)
from app.core.database import Base


class NetworkInterface(Base):
    __tablename__ = "network_interfaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(32), unique=True, nullable=False, index=True)
    role = Column(String(16), nullable=False)  # 'ADMINISTRATION' or 'CAPTURE_PASSIVE'
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(17), nullable=True)
    is_promiscuous = Column(Boolean, default=False, nullable=False)
    is_up = Column(Boolean, default=False, nullable=False)
    mtu = Column(Integer, nullable=True)
    speed_mbps = Column(Integer, nullable=True)
    rx_dropped = Column(Integer, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @property
    def is_stealth_compliant(self) -> bool:
        if self.role == "CAPTURE_PASSIVE":
            return self.ip_address is None and self.is_promiscuous
        return True


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(64), primary_key=True, index=True)
    value_json = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by = Column(String(36), nullable=True)
