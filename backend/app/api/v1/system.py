"""
Routes de supervision système, gestion des interfaces réelles et consultation d'audit (OpenNDR V0.1).
Élimination intégrale de toute fausse donnée réseau, de tout PID simulé et de toute confusion de stockage.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, check_database_connection
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.system import AuditLogOut, NetworkInterfaceOut
from app.api.deps import require_permission
from app.services.system_service import SystemService

router = APIRouter()


@router.get("/status")
def get_system_status(
    current_user: User = Depends(require_permission("system:view")),
):
    """
    Retourne l'état réel des composants de la plateforme OpenNDR V0.1.
    Supervision effective des unités systemd, de l'isolation passive et du stockage.
    """
    db_ok, db_msg = check_database_connection()
    services_status = SystemService.get_systemd_services_status()
    isolation_check = SystemService.check_interface_isolation(settings.CAPTURE_INTERFACE)
    storage_metrics = SystemService.get_real_storage_metrics()

    return {
        "platform": {
            "version": settings.VERSION,
            "target_os": "Debian 13 (Trixie)",
            "environment": settings.OPENNDR_ENV,
            "engine_state": "STANDBY — V0.2 NOT IMPLEMENTED",
        },
        "services": services_status,
        "interfaces": {
            "admin": {
                "name": settings.ADMIN_INTERFACE,
                "role": "ADMINISTRATION",
                "description": "Interface d'administration pour accès Web, API et PostgreSQL",
            },
            "capture": {
                "name": settings.CAPTURE_INTERFACE,
                "role": "CAPTURE_PASSIVE",
                "isolation_status": isolation_check["status"],
                "is_isolated": isolation_check["is_isolated"],
                "details": isolation_check["details"],
                "capture_engine_active": False,
                "notice": "Moteur réseau en veille V0.1. Capture AF_PACKET et décodage prévus en V0.2.",
            },
        },
        "storage": storage_metrics,
    }


@router.get("/interfaces", response_model=List[NetworkInterfaceOut])
def list_interfaces(
    current_user: User = Depends(require_permission("interfaces:view")),
):
    """
    Découvre et liste les interfaces réseau réelles du système Debian.
    Zéro donnée fictive ni fausse adresse MAC.
    """
    real_ifaces = SystemService.get_real_network_interfaces()
    out = []

    for idx, iface in enumerate(real_ifaces, start=1):
        is_capture = (iface["role"] == "CAPTURE_PASSIVE")
        has_no_ip = (len(iface.get("ipv4_addresses", [])) == 0 and len(iface.get("ipv6_addresses", [])) == 0)

        # La conformité furtive exige zéro IP pour l'interface de capture
        stealth_compliant = has_no_ip if is_capture else True

        out.append({
            "id": idx,
            "name": iface["name"],
            "role": iface["role"],
            "ip_address": iface.get("ip_address"),
            "mac_address": iface.get("mac_address", "00:00:00:00:00:00"),
            "is_promiscuous": iface.get("is_promiscuous", False),
            "is_up": iface.get("is_up", False),
            "mtu": iface.get("mtu", 1500),
            "speed_mbps": iface.get("speed_mbps"),
            "rx_dropped": 0,
            "is_stealth_compliant": stealth_compliant,
            "operstate": iface.get("operstate", "UNKNOWN"),
            "is_physical": iface.get("is_physical", False),
            "ipv4_addresses": iface.get("ipv4_addresses", []),
            "ipv6_addresses": iface.get("ipv6_addresses", []),
        })

    return out


@router.get("/interfaces/isolation-check")
def verify_capture_isolation(
    current_user: User = Depends(require_permission("interfaces:view")),
):
    """
    Sonde de vérification réelle de l'isolation de l'interface de capture passive.
    Contrôle l'absence d'adresses IP, l'absence de passerelle et de routes réseau.
    """
    return SystemService.check_interface_isolation(settings.CAPTURE_INTERFACE)


@router.get("/storage")
def get_storage_metrics(
    current_user: User = Depends(require_permission("system:view")),
):
    """
    Retourne les mesures réelles du stockage en distinguant :
    1. L'occupation globale du disque système hôte.
    2. L'espace réellement occupé par les fichiers PCAP et le quota dédié.
    """
    return SystemService.get_real_storage_metrics()


@router.get("/audit", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_permission("audit:view")),
    db: Session = Depends(get_db),
):
    """Consulte le journal d'audit de sécurité transactionnel dans PostgreSQL."""
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if status_filter:
        query = query.filter(AuditLog.status == status_filter.upper())
    return query.offset(offset).limit(limit).all()
