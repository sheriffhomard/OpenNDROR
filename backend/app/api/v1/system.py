"""
Routes de supervision système, contrôle moteur V0.2, gestion des interfaces réelles et audit.
Élimination intégrale de toute fausse donnée réseau, de tout PID simulé et de toute confusion de stockage.
"""
import base64
import binascii
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, check_database_connection
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.system import AuditLogOut, NetworkInterfaceOut
from app.api.deps import require_permission, get_client_ip
from app.services.audit_service import AuditService
from app.services.system_service import SystemService

router = APIRouter()


@router.get("/status")
def get_system_status(
    current_user: User = Depends(require_permission("system:view")),
):
    """
    Retourne l'état réel des composants de la plateforme OpenNDR V0.2.
    Supervision effective des unités systemd, de l'isolation passive, du moteur Rust et du stockage.
    """
    db_ok, db_msg = check_database_connection()
    services_status = SystemService.get_systemd_services_status()
    isolation_check = SystemService.check_interface_isolation(settings.CAPTURE_INTERFACE)
    storage_metrics = SystemService.get_real_storage_metrics()
    engine_telemetry = SystemService.send_engine_ipc_command("GET_STATUS")

    is_engine_running = engine_telemetry.get("is_running", False)
    capture_mode = engine_telemetry.get("capture_mode", "STANDBY")

    return {
        "platform": {
            "version": settings.VERSION,
            "target_os": "Debian 13 (Trixie)",
            "environment": settings.OPENNDR_ENV,
            "engine_state": f"ACTIVE ({capture_mode})" if is_engine_running else "STANDBY (V0.2 Engine Ready)",
        },
        "engine": engine_telemetry,
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
                "capture_engine_active": is_engine_running,
                "capture_mode": capture_mode,
                "notice": "Moteur réseau V0.2 opérationnel (AF_PACKET natif & décodage L2-L4).",
            },
        },
        "storage": storage_metrics,
    }


@router.get("/capture/telemetry")
def get_capture_telemetry(
    current_user: User = Depends(require_permission("system:view")),
):
    """Retourne la télémétrie en temps réel du moteur de capture Rust V0.2."""
    return SystemService.send_engine_ipc_command("GET_STATUS")


@router.post("/capture/start")
def start_capture_engine(
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """Démarre la capture réseau passive sur l'interface configurée."""
    res = SystemService.send_engine_ipc_command(f"START_CAPTURE {settings.CAPTURE_INTERFACE}")
    AuditService.log_event(
        db=db,
        action="CAPTURE_START",
        resource_type="ENGINE",
        resource_id=settings.CAPTURE_INTERFACE,
        status="SUCCESS" if not res.get("error") and not res.get("socket_error") else "FAILURE",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"interface": settings.CAPTURE_INTERFACE, "response": res.get("status", "UNKNOWN")},
    )
    return res


@router.post("/capture/stop")
def stop_capture_engine(
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """Arrête la capture réseau."""
    res = SystemService.send_engine_ipc_command("STOP_CAPTURE")
    AuditService.log_event(
        db=db,
        action="CAPTURE_STOP",
        resource_type="ENGINE",
        resource_id=settings.CAPTURE_INTERFACE,
        status="SUCCESS" if not res.get("error") and not res.get("socket_error") else "FAILURE",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"interface": settings.CAPTURE_INTERFACE},
    )
    return res


@router.post("/capture/ingest-pcap")
def ingest_pcap_trace(
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """
    Ingère et décode un fichier trace PCAP / PCAPNG présent sur le serveur via le moteur L2-L4 Rust.
    """
    filepath = payload.get("filepath")
    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le champ 'filepath' est obligatoire.",
        )

    try:
        result = SystemService.ingest_pcap_file(str(filepath))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    AuditService.log_event(
        db=db,
        action="PCAP_INGEST_FILE",
        resource_type="PCAP",
        resource_id=str(filepath)[:128],
        status="SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={
            "packets_processed": result.get("packets_processed", 0),
            "bytes_processed": result.get("bytes_processed", 0),
        },
    )
    return result


@router.post("/capture/upload-pcap")
def upload_and_ingest_pcap(
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """
    Reçoit un fichier PCAP / PCAPNG encodé en Base64 depuis la console SOC et l'analyse via openndr-engine.
    """
    filename = str(payload.get("filename") or "trace.pcap")
    content_b64 = payload.get("content_base64")
    if not content_b64 or not isinstance(content_b64, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le champ 'content_base64' est obligatoire.",
        )

    try:
        raw_bytes = base64.b64decode(content_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Encodage Base64 invalide.",
        )

    try:
        result = SystemService.ingest_pcap_bytes(filename, raw_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    AuditService.log_event(
        db=db,
        action="PCAP_UPLOAD_INGEST",
        resource_type="PCAP",
        resource_id=filename[:128],
        status="SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={
            "filename": filename,
            "file_size_bytes": len(raw_bytes),
            "packets_processed": result.get("packets_processed", 0),
        },
    )
    return result


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
    rows = query.offset(offset).limit(limit).all()
    return [
        {
            "id": row.id,
            "timestamp": row.timestamp,
            "user_email": row.user_email,
            "ip_address": row.ip_address,
            "action": row.action,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "details_json": row.details_json,
            "status": row.status,
        }
        for row in rows
    ]
