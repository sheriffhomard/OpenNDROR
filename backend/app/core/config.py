import os
from typing import List

try:
    from pydantic_settings import BaseSettings
except ImportError:
    class BaseSettings:  # type: ignore
        def __init__(self, **values):
            for k, v in self.__class__.__dict__.items():
                if not k.startswith("_") and not callable(v):
                    env_val = os.getenv(k)
                    setattr(self, k, env_val if env_val is not None else v)


class Settings(BaseSettings):
    PROJECT_NAME: str = "OpenNDR"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Sécurité
    SECRET_KEY: str = "openndr-v0.1-default-insecure-secret-change-in-prod-minimum-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Base de données (par défaut SQLite pour dev/test, PostgreSQL en prod)
    DATABASE_URL: str = "sqlite:///./openndr.db"

    # Interfaces réseau par défaut
    ADMIN_INTERFACE: str = "eth0"
    CAPTURE_INTERFACE: str = "eth1"

    # Moteur Rust Socket
    ENGINE_SOCKET_PATH: str = "/run/openndr/engine.sock"

    # Rétention et stockage
    PCAP_STORAGE_PATH: str = "/var/lib/openndr/captures"
    MAX_PCAP_STORAGE_GB: int = 500
    PCAP_RETENTION_DAYS: int = 30

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
