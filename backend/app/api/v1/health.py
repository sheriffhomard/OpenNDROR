"""
Sondes de Santé et Disponibilité OpenNDR V0.1
Distinction stricte entre Liveness (vie du processus) et Readiness (disponibilité dépendances).
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.core.database import check_database_connection
from app.schemas.system import HealthCheckOut, LivenessOut, ReadinessOut

router = APIRouter()


@router.get("/live", response_model=LivenessOut)
def liveness():
    """Vérifie que le processus HTTP backend est vivant."""
    return {
        "status": "UP",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready", response_model=ReadinessOut)
def readiness(response: Response):
    """
    Vérifie la disponibilité réelle des dépendances critiques (PostgreSQL).
    Retourne HTTP 503 si la base de données ne répond pas.
    """
    db_connected, db_msg = check_database_connection()
    now_iso = datetime.now(timezone.utc).isoformat()

    if not db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "NOT_READY",
            "database_connected": False,
            "details": f"Base de données inaccessible : {db_msg}",
            "timestamp": now_iso,
        }

    return {
        "status": "READY",
        "database_connected": True,
        "details": "Base de données relationnelle opérationnelle",
        "timestamp": now_iso,
    }


@router.get("", response_model=HealthCheckOut)
def health_detailed(response: Response):
    """
    Rapport d'état détaillé des composants.
    Vérification réelle de PostgreSQL et du socket du moteur Rust.
    """
    db_connected, db_msg = check_database_connection()
    engine_socket_exists = os.path.exists(settings.ENGINE_SOCKET_PATH)

    overall_status = "HEALTHY" if db_connected else "DEGRADED"
    if not db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": overall_status,
        "version": settings.VERSION,
        "target_platform": "Debian 13 (Trixie)",
        "database": {
            "status": "CONNECTED" if db_connected else "DISCONNECTED",
            "details": db_msg,
            "target": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "local_sqlite",
        },
        "capture_engine": {
            "version": "0.1.0",
            "mode": "STANDBY_READY",
            "ipc_socket": settings.ENGINE_SOCKET_PATH,
            "socket_present": engine_socket_exists,
            "capture_active": False,
            "notice": "Le décodage et la capture passive active débutent en V0.2.",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
