"""
Service d'Audit de Sécurité persistant pour OpenNDR V0.1
Enregistre immuablement dans PostgreSQL chaque action sensible.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

logger = logging.getLogger("openndr.audit")


class SecurityAuditError(RuntimeError):
    """Levée lorsqu'une action critique ne peut être persistée dans le journal d'audit."""
    pass


class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        action: str,
        resource_type: str,
        status: str,  # 'SUCCESS', 'DENIED', 'FAILURE'
        user_email: str = "system",
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: str = "127.0.0.1",
        details: Optional[Dict[str, Any]] = None,
        strict: bool = True,
    ) -> AuditLog:
        """
        Insère un événement d'audit dans PostgreSQL.
        Ne jamais inclure de mot de passe, de secret ou de jeton dans `details`.
        Si `strict=True` (par défaut pour les actions critiques), un échec d'insertion
        annule la transaction et lève une exception pour empêcher toute action silencieuse non auditée.
        """
        # Filtrage préventif strict de tout secret accidentel
        sanitized_details = None
        if details:
            cleaned = {}
            for k, v in details.items():
                if any(sec in k.lower() for sec in ["pass", "token", "secret", "key", "cred", "authorization"]):
                    cleaned[k] = "[REDACTED]"
                else:
                    cleaned[k] = v
            sanitized_details = json.dumps(cleaned)

        entry = AuditLog(
            timestamp=datetime.now(timezone.utc),
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details_json=sanitized_details,
            status=status,
        )
        try:
            db.add(entry)
            db.commit()
            db.refresh(entry)
            return entry
        except Exception as e:
            db.rollback()
            logger.error(f"Échec de l'enregistrement de l'audit log [{action}] : {e}")
            if strict:
                raise SecurityAuditError(
                    f"Échec critique de journalisation d'audit pour l'action '{action}'. Opération interrompue."
                ) from e
            return entry
