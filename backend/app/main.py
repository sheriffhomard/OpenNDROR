"""
Point d'entrée principal de l'API OpenNDR V0.1
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, decode_token

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API REST de gestion et d'orchestration pour la plateforme OpenNDR",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Données en mémoire représentatives des modèles V0.1 ---
MOCK_USERS = {
    "admin@openndr.local": {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "admin@openndr.local",
        "hashed_password": hash_password("OpenNDR-Admin-2026!"),
        "full_name": "Administrateur SOC OpenNDR",
        "role": "Administrator",
        "permissions": ["system:view", "system:manage", "interfaces:view", "interfaces:manage", "users:view", "users:manage", "audit:view", "storage:manage"],
        "is_active": True,
    },
    "analyst@openndr.local": {
        "id": "22222222-2222-2222-2222-222222222222",
        "email": "analyst@openndr.local",
        "hashed_password": hash_password("OpenNDR-Analyst-2026!"),
        "full_name": "Analyste Cybersécurité N2",
        "role": "Analyst",
        "permissions": ["system:view", "interfaces:view", "users:view", "audit:view"],
        "is_active": True,
    },
    "observer@openndr.local": {
        "id": "33333333-3333-3333-3333-333333333333",
        "email": "observer@openndr.local",
        "hashed_password": hash_password("OpenNDR-Observer-2026!"),
        "full_name": "Observateur Audit & Conformité",
        "role": "Observer",
        "permissions": ["system:view", "interfaces:view"],
        "is_active": True,
    },
}

MOCK_AUDIT_LOGS = [
    {
        "id": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_email": "admin@openndr.local",
        "action": "SYSTEM_STARTUP",
        "resource_type": "DAEMON",
        "resource_id": "openndr-backend",
        "details": {"version": "0.1.0", "target_os": "Debian 13"},
        "status": "SUCCESS",
    },
    {
        "id": 2,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_email": "system",
        "action": "INTERFACE_VALIDATION",
        "resource_type": "NETWORK_INTERFACE",
        "resource_id": "eth1",
        "details": {"mode": "PASSIVE_CAPTURE", "ip_assigned": False, "promisc": True},
        "status": "SUCCESS",
    }
]

# --- Schemas ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    full_name: str
    permissions: List[str]

class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    permissions: List[str]
    is_active: bool

class HealthResponse(BaseModel):
    status: str
    version: str
    target_platform: str
    database: str
    capture_engine: str
    timestamp: str

# --- Dépendances Sécurité ---
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification manquant ou format invalide.",
        )
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée ou signature du jeton non valide.",
        )
    email = payload.get("sub")
    user = MOCK_USERS.get(email)
    if not user or not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte utilisateur introuvable ou désactivé.",
        )
    return user

def require_permission(perm: str):
    def checker(user: dict = Depends(get_current_user)):
        if perm not in user.get("permissions", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Privilège insuffisant. Permission requise : {perm}",
            )
        return user
    return checker

# --- Routes API ---
@app.get("/api/v1/health", response_model=HealthResponse)
def get_health():
    """Vérification de l'état de santé général de la sonde OpenNDR."""
    return {
        "status": "HEALTHY",
        "version": settings.VERSION,
        "target_platform": "Debian 13 (Trixie)",
        "database": "CONNECTED",
        "capture_engine": "STANDBY_READY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/api/v1/auth/login", response_model=TokenResponse)
def login(creds: LoginRequest):
    """Authentification locale et délivrance d'un jeton JWT sécurisé."""
    user = MOCK_USERS.get(creds.email)
    if not user or not verify_password(creds.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants d'accès invalides.",
        )
    
    token = create_access_token({"sub": user["email"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "email": user["email"],
        "full_name": user["full_name"],
        "permissions": user["permissions"],
    }

@app.get("/api/v1/auth/me", response_model=UserProfile)
def get_current_profile(user: dict = Depends(get_current_user)):
    """Retourne le profil de l'utilisateur authentifié."""
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "permissions": user["permissions"],
        "is_active": user["is_active"],
    }

@app.get("/api/v1/system/status")
def get_system_status(user: dict = Depends(require_permission("system:view"))):
    """Fournit les métriques d'état du système, services et interfaces."""
    return {
        "services": [
            {"name": "openndr-backend", "status": "active", "description": "API REST & Orchestration"},
            {"name": "openndr-engine", "status": "ready", "description": "Moteur Réseau Natif Rust"},
            {"name": "openndr-web", "status": "active", "description": "Interface SOC Web"},
            {"name": "postgresql", "status": "active", "description": "Base Relationnelle & Schémas V0.1"},
        ],
        "network_interfaces": [
            {
                "name": settings.ADMIN_INTERFACE,
                "role": "ADMINISTRATION",
                "ip": "192.168.10.15/24",
                "promisc": False,
                "is_stealth": False,
                "compliant": True,
            },
            {
                "name": settings.CAPTURE_INTERFACE,
                "role": "CAPTURE_PASSIVE",
                "ip": None,
                "promisc": True,
                "is_stealth": True,
                "compliant": True,
            }
        ],
        "storage": {
            "pcap_path": settings.PCAP_STORAGE_PATH,
            "max_storage_gb": settings.MAX_PCAP_STORAGE_GB,
            "retention_days": settings.PCAP_RETENTION_DAYS,
            "used_gb": 12.4,
            "free_gb": 487.6,
        }
    }

@app.get("/api/v1/system/audit")
def get_audit_logs(user: dict = Depends(require_permission("audit:view"))):
    """Consulte le journal d'audit de sécurité des actions de la sonde."""
    return MOCK_AUDIT_LOGS

@app.get("/api/v1/users")
def list_users(user: dict = Depends(require_permission("users:view"))):
    """Liste les comptes d'accès avec leurs rôles respectifs."""
    return [
        {
            "id": u["id"],
            "email": u["email"],
            "full_name": u["full_name"],
            "role": u["role"],
            "permissions": u["permissions"],
            "is_active": u["is_active"],
        }
        for u in MOCK_USERS.values()
    ]
