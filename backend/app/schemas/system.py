"""
Schémas Pydantic pour la supervision système, interfaces et audit
"""
from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict


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
    mac_address: str
    is_promiscuous: bool
    is_up: bool
    mtu: int
    speed_mbps: Optional[int] = None
    rx_dropped: int = 0
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
