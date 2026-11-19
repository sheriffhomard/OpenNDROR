"""
Health and readiness probes for OpenNDR V0.2.
Strictly distinguishes HTTP process liveness, PostgreSQL readiness, and Rust engine IPC health.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.core.database import check_database_connection
from app.schemas.system import HealthCheckOut, LivenessOut, ReadinessOut
from app.services.system_service import SystemService

router = APIRouter()


@router.get("/live", response_model=LivenessOut)
def liveness():
    """Verifies that the HTTP API worker process is alive."""
    return {
        "status": "UP",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready", response_model=ReadinessOut)
def readiness(response: Response):
    """
    Verifies real relational database connectivity.
    Returns HTTP 503 if PostgreSQL is unreachable.
    """
    db_connected, db_msg = check_database_connection()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "NOT_READY",
            "database_connected": False,
            "details": f"Database unreachable: {db_msg}",
            "timestamp": now_iso,
        }

    return {
        "status": "READY",
        "database_connected": True,
        "details": "Relational database operational",
        "timestamp": now_iso,
    }


@router.get("", response_model=HealthCheckOut)
def health_detailed(response: Response):
    """
    Detailed platform health report combining verified PostgreSQL status
    and real Rust engine verification (binary, systemd unit, socket, IPC).
    """
    db_connected, db_msg = check_database_connection()
    engine_info = SystemService.get_engine_status()

    engine_status = engine_info.get("engine_status", "UNKNOWN")
    is_running = bool(engine_info.get("is_running", False))
    ipc_reachable = bool(engine_info.get("ipc_reachable", False))
    binary_present = bool(engine_info.get("binary_present", False))
    socket_present = bool(engine_info.get("socket_present", False))

    overall_status = "HEALTHY" if db_connected else "DEGRADED"
    if not db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    if engine_status == "OPERATIONAL":
        notice = "Rust engine IPC verified and operational."
    elif engine_status == "STOPPED":
        notice = "Rust engine binary present; service is currently stopped."
    elif engine_status == "UNAVAILABLE":
        notice = "Rust engine binary not found on host."
    elif engine_status == "DEGRADED":
        notice = f"Rust engine degraded: {engine_info.get('ipc_error') or 'IPC unreachable'}"
    else:
        notice = "Rust engine state unknown (IPC socket absent and systemd unavailable)."

    return {
        "status": overall_status,
        "version": settings.VERSION,
        "target_platform": "Debian 13 (Trixie)",
        "database": {
            "connected": db_connected,
            "status": "CONNECTED" if db_connected else "DISCONNECTED",
            "details": db_msg,
            "target": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "local_sqlite",
        },
        "capture_engine": {
            "engine_status": engine_status,
            "service_status": engine_info.get("service_status"),
            "version": engine_info.get("engine_version"),
            "mode": engine_info.get("capture_mode"),
            "ipc_socket": settings.ENGINE_SOCKET_PATH,
            "binary_present": binary_present,
            "socket_present": socket_present,
            "ipc_reachable": ipc_reachable,
            "ipc_error": engine_info.get("ipc_error"),
            "capture_active": is_running,
            "active_interface": engine_info.get("active_interface"),
            "packets_received": engine_info.get("packets_received"),
            "notice": notice,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
