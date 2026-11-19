"""
System supervision, V0.2 engine control, real network interfaces, storage, updates, and audit routes.
No fake MAC addresses, no artificial MTU/drop defaults, and no synthetic standby states.
"""
import base64
import binascii
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import check_database_connection, get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.system import AuditLogOut, NetworkInterfaceOut, UpdateConfigIn
from app.api.deps import get_client_ip, require_permission
from app.services.audit_service import AuditService
from app.services.system_service import SystemService

router = APIRouter()


@router.get("/status")
def get_system_status(
    current_user: User = Depends(require_permission("system:view")),
):
    """Returns verified OS, systemd, passive isolation, storage, and Rust engine status."""
    db_ok, db_msg = check_database_connection()
    services_status = SystemService.get_systemd_services_status()
    isolation_check = SystemService.check_interface_isolation(settings.CAPTURE_INTERFACE)
    storage_metrics = SystemService.get_real_storage_metrics()
    engine_telemetry = SystemService.get_engine_status()

    is_engine_running = bool(engine_telemetry.get("is_running", False))
    engine_status = engine_telemetry.get("engine_status", "UNKNOWN")
    capture_mode = engine_telemetry.get("capture_mode")

    if is_engine_running and capture_mode:
        engine_state_label = f"ACTIVE ({capture_mode})"
    else:
        engine_state_label = engine_status

    return {
        "platform": {
            "version": settings.VERSION,
            "target_os": "Debian 13 (Trixie)",
            "environment": settings.OPENNDR_ENV,
            "engine_state": engine_state_label,
            "database_connected": db_ok,
            "database_details": db_msg,
        },
        "engine": engine_telemetry,
        "services": services_status,
        "interfaces": {
            "admin": {
                "name": settings.ADMIN_INTERFACE,
                "role": "ADMINISTRATION",
                "description": "Management interface for Web, API, and PostgreSQL access",
            },
            "capture": {
                "name": settings.CAPTURE_INTERFACE,
                "role": "CAPTURE_PASSIVE",
                "isolation_status": isolation_check["status"],
                "is_isolated": isolation_check["is_isolated"],
                "details": isolation_check["details"],
                "capture_engine_active": is_engine_running,
                "capture_mode": capture_mode,
                "engine_status": engine_status,
            },
        },
        "storage": storage_metrics,
    }


@router.get("/capture/telemetry")
def get_capture_telemetry(
    current_user: User = Depends(require_permission("system:view")),
):
    """Returns real-time Rust capture engine telemetry and IPC reachability status."""
    return SystemService.get_engine_status()


@router.post("/capture/start")
def start_capture_engine(
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """Starts passive network capture on the configured capture interface."""
    res = SystemService.send_engine_ipc_command(f"START_CAPTURE {settings.CAPTURE_INTERFACE}")
    failed = bool(res.get("error") or res.get("socket_error") or not res.get("ipc_reachable"))
    AuditService.log_event(
        db=db,
        action="CAPTURE_START",
        resource_type="ENGINE",
        resource_id=settings.CAPTURE_INTERFACE,
        status="FAILURE" if failed else "SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"interface": settings.CAPTURE_INTERFACE, "response": res.get("status", "IPC_ERROR")},
    )
    if failed:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=res.get("ipc_error") or res.get("error") or "Engine IPC unreachable",
        )
    return res


@router.post("/capture/stop")
def stop_capture_engine(
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """Stops passive network capture."""
    res = SystemService.send_engine_ipc_command("STOP_CAPTURE")
    failed = bool(res.get("error") or res.get("socket_error") or not res.get("ipc_reachable"))
    AuditService.log_event(
        db=db,
        action="CAPTURE_STOP",
        resource_type="ENGINE",
        resource_id=settings.CAPTURE_INTERFACE,
        status="FAILURE" if failed else "SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"interface": settings.CAPTURE_INTERFACE},
    )
    if failed:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=res.get("ipc_error") or res.get("error") or "Engine IPC unreachable",
        )
    return res


@router.post("/capture/ingest-pcap")
def ingest_pcap_trace(
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(require_permission("interfaces:manage")),
    db: Session = Depends(get_db),
):
    """Ingests and decodes a server-local PCAP / PCAPNG file via openndr-engine."""
    filepath = payload.get("filepath")
    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'filepath' field is required.",
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
    """Receives a Base64-encoded PCAP/PCAPNG file and decodes it via openndr-engine."""
    filename = str(payload.get("filename") or "trace.pcap")
    content_b64 = payload.get("content_base64")
    if not content_b64 or not isinstance(content_b64, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'content_base64' field is required.",
        )

    try:
        raw_bytes = base64.b64decode(content_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Base64 encoding.",
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
    Lists real Debian host network interfaces.
    Uncollectable hardware attributes remain null rather than using synthetic fallbacks.
    """
    real_ifaces = SystemService.get_real_network_interfaces()
    out = []

    for idx, iface in enumerate(real_ifaces, start=1):
        is_capture = iface["role"] == "CAPTURE_PASSIVE"
        has_no_ip = (
            len(iface.get("ipv4_addresses", [])) == 0
            and len(iface.get("ipv6_addresses", [])) == 0
        )
        stealth_compliant = has_no_ip if is_capture else True

        out.append({
            "id": idx,
            "name": iface["name"],
            "role": iface["role"],
            "ip_address": iface.get("ip_address"),
            "mac_address": iface.get("mac_address"),
            "is_promiscuous": iface.get("is_promiscuous", False),
            "is_up": iface.get("is_up", False),
            "mtu": iface.get("mtu"),
            "speed_mbps": iface.get("speed_mbps"),
            "rx_packets": iface.get("rx_packets"),
            "tx_packets": iface.get("tx_packets"),
            "rx_bytes": iface.get("rx_bytes"),
            "tx_bytes": iface.get("tx_bytes"),
            "rx_dropped": iface.get("rx_dropped"),
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
    """Audits passive capture interface isolation (no IP, no routes, distinct from admin)."""
    return SystemService.check_interface_isolation(settings.CAPTURE_INTERFACE)


@router.get("/storage")
def get_storage_metrics(
    current_user: User = Depends(require_permission("system:view")),
):
    """Returns host filesystem usage, PCAP directory usage, and real write capability."""
    return SystemService.get_real_storage_metrics()


@router.get("/updates")
def get_system_updates(
    db: Session = Depends(get_db),
):
    """Returns persistent update/integrity metadata from PostgreSQL (without fake dates)."""
    try:
        return SystemService.get_update_state(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to read system update state from database: {exc}",
        )


@router.post("/updates/check")
def check_system_updates(
    request: Request,
    current_user: User = Depends(require_permission("system:manage")),
    db: Session = Depends(get_db),
):
    """Records a manual update/integrity verification in PostgreSQL."""
    state = SystemService.record_update_check(db=db, user_id=current_user.id, force=False)
    AuditService.log_event(
        db=db,
        action="SYSTEM_UPDATE_CHECK",
        resource_type="SYSTEM",
        resource_id="updates",
        status="SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"engine_integrity_ok": state.get("engine_integrity_ok")},
    )
    return {"message": "Verification completed.", "update_state": state}


@router.post("/updates/force")
def force_system_update(
    request: Request,
    current_user: User = Depends(require_permission("system:manage")),
    db: Session = Depends(get_db),
):
    """Forces a local platform synchronization and engine integrity check."""
    state = SystemService.record_update_check(db=db, user_id=current_user.id, force=True)
    AuditService.log_event(
        db=db,
        action="SYSTEM_UPDATE_FORCE",
        resource_type="SYSTEM",
        resource_id="updates",
        status="SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={"build_revision": state.get("build_revision")},
    )
    return {"message": "Platform synchronization completed.", "update_state": state}


@router.put("/updates/config")
def update_auto_config(
    payload: UpdateConfigIn,
    request: Request,
    current_user: User = Depends(require_permission("system:manage")),
    db: Session = Depends(get_db),
):
    """Persists automatic update check preferences in PostgreSQL."""
    state = SystemService.configure_updates(
        db=db,
        auto_update_enabled=payload.auto_update_enabled,
        check_interval_minutes=payload.check_interval_minutes,
        user_id=current_user.id,
    )
    AuditService.log_event(
        db=db,
        action="SYSTEM_UPDATE_CONFIG",
        resource_type="SYSTEM",
        resource_id="updates",
        status="SUCCESS",
        user_email=current_user.email,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details={
            "auto_update_enabled": payload.auto_update_enabled,
            "check_interval_minutes": payload.check_interval_minutes,
        },
    )
    return {"message": "Update configuration saved.", "update_state": state}


@router.get("/audit", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_permission("audit:view")),
    db: Session = Depends(get_db),
):
    """Queries transactional security audit logs in PostgreSQL."""
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
