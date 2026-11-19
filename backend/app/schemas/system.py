"""
Pydantic schemas for system supervision, network interfaces, updates, and audit logs (OpenNDR V0.2).
Null values represent uncollected/unavailable metrics and are never substituted with artificial zeros.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class HealthCheckOut(BaseModel):
    status: str
    version: str
    target_platform: str
    database: Dict[str, Any]
    capture_engine: Dict[str, Any]
    timestamp: str


class LivenessOut(BaseModel):
    status: str = "UP"
    timestamp: str


class ReadinessOut(BaseModel):
    status: str
    database_connected: bool
    details: Optional[str] = None
    timestamp: str


class NetworkInterfaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    name: str
    role: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    is_promiscuous: bool = False
    is_up: bool = False
    mtu: Optional[int] = None
    speed_mbps: Optional[int] = None
    rx_packets: Optional[int] = None
    tx_packets: Optional[int] = None
    rx_bytes: Optional[int] = None
    tx_bytes: Optional[int] = None
    rx_dropped: Optional[int] = None
    is_stealth_compliant: bool = False
    operstate: Optional[str] = None
    is_physical: Optional[bool] = False
    ipv4_addresses: Optional[List[str]] = None
    ipv6_addresses: Optional[List[str]] = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    user_email: str
    ip_address: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details_json: Optional[str] = None
    status: str


class UpdateConfigIn(BaseModel):
    auto_update_enabled: bool
    check_interval_minutes: int = Field(..., ge=1, le=1440)
