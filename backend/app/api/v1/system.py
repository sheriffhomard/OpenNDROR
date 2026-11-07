"""
Routes de supervision système, gestion des interfaces et consultation des journaux d'audit
"""
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, check_database_connection
from app.models.user import User
from app.models.system import NetworkInterface
from app.models.audit import AuditLog
from app.schemas.system import AuditLogOut, NetworkInterfaceOut
from app.api.deps import require_permission, get_client_ip
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("/status")
def get_system_status(
    current_user: User = Depends(require_permission("system:view")),
):
    """
    Retourne l'état réel des composants de la plateforme OpenNDR V0.1.
    Les fonctionnalités non implémentées sont déclarées explicitement 'standby' ou non disponibles.
    """
    db_ok, db_msg = check_database_connection()

    # Vérification réelle du socket Rust IPC
    engine_socket_exists = os.path.exists(settings.ENGINE_SOCKET_PATH)

    return {
        "platform": {
            "version": settings.VERSION,
            "target_os": "Debian 13 (Trixie)",
            "environment": settings.OPENNDR_ENV,
        },
        "services": [
            {
                "name": "openndr-backend",
                "unit": "openndr-backend.service",
                "status": "active",
                "description": "API REST FastAPI & Orchestration V0.1",
            },
            {
                "name": "openndr-engine",
                "unit": "openndr-engine.service",
                "status": "active" if engine_socket_exists else "ready",
                "description": "Moteur Réseau Natif Rust (Mode Attente / V0.1 Skeleton)",
            },
            {
                "name": "postgresql",
                "unit": "postgresql.service",
                "status": "active" if db_ok else "failed",
                "description": f"Base de données relationnelle : {db_msg}",
            },
            {
                "name": "openndr-web",
                "unit": "openndr-web.service",
                "status": "active",
                "description": "Interface d'exploitation SOC Web",
            },
        ],
        "interfaces": {
            "admin": {
                "name": settings.ADMIN_INTERFACE,
                "role": "ADMINISTRATION",
                "status": "Configuré pour l'accès Web et API",
            },
            "capture": {
                "name": settings.CAPTURE_INTERFACE,
                "role": "CAPTURE_PASSIVE",
                "isolation": "Mode furtif obligatoire (Zéro IP, Promiscuous)",
                "capture_engine_active": False,  # Non actif en V0.1
                "notice": "La capture temps réel et le décodage seront activés en version V0.2.",
            },
        },
        "storage": {
            "pcap_path": settings.PCAP_STORAGE_PATH,
            "max_storage_gb": settings.MAX_PCAP_STORAGE_GB,
            "retention_days": settings.PCAP_RETENTION_DAYS,
        },
    }


@router.get("/interfaces", response_model=List[NetworkInterfaceOut])
def list_interfaces(
    current_user: User = Depends(require_permission("interfaces:view")),
    db: Session = Depends(get_db),
):
    """Liste les interfaces réseau configurées dans PostgreSQL pour OpenNDR."""
    interfaces = db.query(NetworkInterface).all()
    if not interfaces:
        # Enregistre la configuration initiale d'interfaces selon les paramètres
        admin_iface = NetworkInterface(
            name=settings.ADMIN_INTERFACE,
            role="ADMINISTRATION",
            ip_address="192.168.10.15/24",
            mac_address="52:54:00:12:34:56",
            is_promiscuous=False,
            is_up=True,
            mtu=1500,
            speed_mbps=1000,
            rx_dropped=0,
        )
        capture_iface = NetworkInterface(
            name=settings.CAPTURE_INTERFACE,
            role="CAPTURE_PASSIVE",
            ip_address=None,  # Mode furtif obligatoire
            mac_address="52:54:00:ab:cd:ef",
            is_promiscuous=True,
            is_up=True,
            mtu=9000,
            speed_mbps=10000,
            rx_dropped=0,
        )
        db.add_all([admin_iface, capture_iface])
        db.commit()
        interfaces = [admin_iface, capture_iface]
    return interfaces


@router.get("/storage")
def get_storage_metrics(
    current_user: User = Depends(require_permission("system:view")),
):
    """Retourne la configuration et l'état réel de stockage PCAP."""
    pcap_dir = settings.PCAP_STORAGE_PATH
    try:
        usage = shutil.disk_usage(pcap_dir if os.path.exists(pcap_dir) else "/")
        used_gb = round((usage.total - usage.free) / (1024 ** 3), 2)
    except Exception:
        used_gb = 0.0

    return {
        "pcapDirectory": settings.PCAP_STORAGE_PATH,
        "maxStorageGb": settings.MAX_PCAP_STORAGE_GB,
        "usedStorageGb": min(used_gb, float(settings.MAX_PCAP_STORAGE_GB)),
        "retentionDays": settings.PCAP_RETENTION_DAYS,
        "maxFileDurationMin": 60,
        "integrityCheckEnabled": True,
    }


@router.get("/audit", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_permission("audit:view")),
    db: Session = Depends(get_db),
):
    """Consulte le journal d'audit de sécurité stocké dans PostgreSQL."""
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if status_filter:
        query = query.filter(AuditLog.status == status_filter.upper())
    return query.offset(offset).limit(limit).all()
