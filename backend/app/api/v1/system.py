"""
Routes de supervision système, gestion des interfaces et consultation des journaux d'audit
"""
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, check_database_connection
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.system import AuditLogOut, NetworkInterfaceOut
from app.api.deps import require_permission

router = APIRouter()


@router.get("/status")
def get_system_status(
    current_user: User = Depends(require_permission("system:view")),
):
    """
    Retourne l'état des composants de la plateforme OpenNDR V0.1.
    Les fonctionnalités non implémentées sont déclarées explicitement 'NON_DISPONIBLE_V01'.
    """
    db_ok, db_msg = check_database_connection()

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
                "status": "ready",
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
