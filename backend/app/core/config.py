"""
Configuration centrale de l'application OpenNDR V0.1
"""
import os
import json
from typing import List, Union


class Settings:
    PROJECT_NAME: str = "OpenNDR"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Environnement
    OPENNDR_ENV: str = os.getenv("OPENNDR_ENV", "development")

    # Sécurité & Chiffrement
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "openndr-v0.1-default-insecure-secret-change-in-prod-minimum-32-chars",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Paramètres Argon2id
    ARGON2_TIME_COST: int = int(os.getenv("ARGON2_TIME_COST", "3"))
    ARGON2_MEMORY_COST: int = int(os.getenv("ARGON2_MEMORY_COST", "65536"))  # 64 Mo
    ARGON2_PARALLELISM: int = int(os.getenv("ARGON2_PARALLELISM", "4"))

    # Base de données PostgreSQL / SQLite
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        ""
        if os.getenv("OPENNDR_ENV") == "production"
        else "sqlite:///./openndr.db",
    )
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))

    # Interfaces réseau par défaut
    ADMIN_INTERFACE: str = os.getenv("ADMIN_INTERFACE", "eth0")
    CAPTURE_INTERFACE: str = os.getenv("CAPTURE_INTERFACE", "eth1")

    # Moteur Rust Socket
    ENGINE_SOCKET_PATH: str = os.getenv("ENGINE_SOCKET_PATH", "/run/openndr/engine.sock")

    # Rétention et stockage
    PCAP_STORAGE_PATH: str = os.getenv("PCAP_STORAGE_PATH", "/var/lib/openndr/captures")
    MAX_PCAP_STORAGE_GB: int = int(os.getenv("MAX_PCAP_STORAGE_GB", "500"))
    PCAP_RETENTION_DAYS: int = int(os.getenv("PCAP_RETENTION_DAYS", "30"))
    LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", "90"))

    # CORS restrictif par défaut
    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [orig.strip() for orig in raw.split(",") if orig.strip()]
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]

    def validate_production_invariants(self) -> None:
        """
        Vérification stricte de non-démarrage si la sécurité est compromise en production.
        """
        if self.OPENNDR_ENV.lower() == "production":
            insecure_defaults = [
                "openndr-v0.1-default-insecure-secret-change-in-prod-minimum-32-chars",
                "change-this-in-production-use-a-strong-random-key-min-32-chars",
                "secret",
                "admin",
                "password",
            ]
            if not self.SECRET_KEY or self.SECRET_KEY in insecure_defaults:
                raise ValueError(
                    "[FATAL SÉCURITÉ] Démarrage refusé en mode PRODUCTION : "
                    "SECRET_KEY est manquant, faible ou correspond à une valeur de démonstration par défaut. "
                    "Définissez une clé cryptographique aléatoire d'au moins 32 caractères dans /etc/openndr/backend.env."
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "[FATAL SÉCURITÉ] SECRET_KEY trop courte en production (minimum 32 caractères requis)."
                )
            if not self.DATABASE_URL:
                raise ValueError(
                    "[FATAL SÉCURITÉ] Démarrage refusé en mode PRODUCTION : "
                    "DATABASE_URL est manquant. Définissez la chaîne de connexion PostgreSQL dans /etc/openndr/backend.env."
                )
            if "openndr_secure_password" in self.DATABASE_URL or "postgres:postgres" in self.DATABASE_URL:
                raise ValueError(
                    "[FATAL SÉCURITÉ] Démarrage refusé en mode PRODUCTION : "
                    "DATABASE_URL contient des identifiants par défaut insécurisés. "
                    "Configurez des identifiants PostgreSQL dédiés dans /etc/openndr/backend.env."
                )


settings = Settings()
