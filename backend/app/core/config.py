"""
Central configuration for OpenNDR V0.2.
No hardcoded secrets or default production credentials.
"""
import json
import os
from typing import List, Optional


class Settings:
    PROJECT_NAME: str = "OpenNDR"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/api/v1"

    INSECURE_SECRET_VALUES = {
        "openndr-v0.1-default-insecure-secret-change-in-prod-minimum-32-chars",
        "openndr_auto_generated_secure_secret_key_2026_debian13",
        "change-this-in-production-use-a-strong-random-key-min-32-chars",
        "__GENERATE_WITH_SECRETS_TOKEN_URLSAFE_48__",
        "secret",
        "admin",
        "password",
        "changeme",
        "default",
        "openndr",
    }

    INSECURE_DB_FRAGMENTS = (
        "openndr_secure_password",
        "postgres:postgres",
        "__CHANGE_ME_DB_PASSWORD__",
    )

    def __init__(self) -> None:
        self.OPENNDR_ENV: str = os.getenv("OPENNDR_ENV", "development")
        self.RELEASE_DATE: Optional[str] = os.getenv("OPENNDR_RELEASE_DATE") or None

        # Cryptographic secret (must be supplied via environment; no insecure fallback)
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "")
        self.ALGORITHM: str = "HS256"
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        self.REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

        # Argon2id parameters
        self.ARGON2_TIME_COST: int = int(os.getenv("ARGON2_TIME_COST", "3"))
        self.ARGON2_MEMORY_COST: int = int(os.getenv("ARGON2_MEMORY_COST", "65536"))
        self.ARGON2_PARALLELISM: int = int(os.getenv("ARGON2_PARALLELISM", "4"))

        # Relational database (PostgreSQL mandatory in production; explicit env in dev/test)
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", "")
        self.DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
        self.DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
        self.DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))

        # Network interfaces
        self.ADMIN_INTERFACE: str = os.getenv("ADMIN_INTERFACE", "eth0")
        self.CAPTURE_INTERFACE: str = os.getenv("CAPTURE_INTERFACE", "eth1")

        # Rust engine UNIX IPC socket
        self.ENGINE_SOCKET_PATH: str = os.getenv("ENGINE_SOCKET_PATH", "/run/openndr/engine.sock")

        # Local retention & PCAP storage
        self.PCAP_STORAGE_PATH: str = os.getenv("PCAP_STORAGE_PATH", "/var/lib/openndr/captures")
        self.MAX_PCAP_STORAGE_GB: int = int(os.getenv("MAX_PCAP_STORAGE_GB", "500"))
        self.PCAP_RETENTION_DAYS: int = int(os.getenv("PCAP_RETENTION_DAYS", "30"))
        self.LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", "90"))

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
        Strict fail-closed validation on startup in production mode.
        Refuses missing/weak SECRET_KEY, placeholder credentials, SQLite, or missing Argon2id.
        """
        if self.OPENNDR_ENV.lower() == "production":
            if not self.SECRET_KEY or self.SECRET_KEY.strip() in self.INSECURE_SECRET_VALUES:
                raise ValueError(
                    "[FATAL SECURITY] Production startup aborted: "
                    "SECRET_KEY is missing or matches a known placeholder/insecure value. "
                    "Configure a random cryptographic key (>= 32 chars) in /etc/openndr/backend.env."
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "[FATAL SECURITY] SECRET_KEY too short in production (minimum 32 characters required)."
                )
            if not self.DATABASE_URL:
                raise ValueError(
                    "[FATAL SECURITY] Production startup aborted: "
                    "DATABASE_URL is missing. Configure PostgreSQL connection in /etc/openndr/backend.env."
                )
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError(
                    "[FATAL SECURITY] Production startup aborted: "
                    "SQLite is forbidden in production. Configure PostgreSQL via DATABASE_URL."
                )
            if any(frag in self.DATABASE_URL for frag in self.INSECURE_DB_FRAGMENTS):
                raise ValueError(
                    "[FATAL SECURITY] Production startup aborted: "
                    "DATABASE_URL contains default/placeholder credentials."
                )
            try:
                import argon2  # noqa: F401
            except ImportError as exc:
                raise ValueError(
                    "[FATAL SECURITY] Production startup aborted: argon2-cffi package is required."
                ) from exc


settings = Settings()
