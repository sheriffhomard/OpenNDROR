"""
Module de sécurité cryptographique pour OpenNDR V0.1
Hachage Argon2id, vérification de politiques de mot de passe et gestion des jetons JWT.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any, Set
from sqlalchemy.orm import Session

from app.core.config import settings

# Registre cache en mémoire des jetons révoqués (accélérateur de requêtes)
REVOKED_TOKENS: Set[str] = set()

# Tentative d'import d'Argon2id natif via argon2-cffi
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError, VerificationError

    _argon2_hasher = PasswordHasher(
        time_cost=settings.ARGON2_TIME_COST,
        memory_cost=settings.ARGON2_MEMORY_COST,
        parallelism=settings.ARGON2_PARALLELISM,
        hash_len=32,
        salt_len=16,
    )
    HAS_NATIVE_ARGON2 = True
except ImportError:
    _argon2_hasher = None
    HAS_NATIVE_ARGON2 = False


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Politique stricte de mot de passe OpenNDR V0.1 :
    - Minimum 12 caractères
    - Au moins une majuscule
    - Au moins une minuscule
    - Au moins un chiffre
    - Au moins un caractère spécial
    """
    if len(password) < 12:
        return False, "Le mot de passe doit comporter au moins 12 caractères."
    if not re.search(r"[A-Z]", password):
        return False, "Le mot de passe doit contenir au moins une lettre majuscule."
    if not re.search(r"[a-z]", password):
        return False, "Le mot de passe doit contenir au moins une lettre minuscule."
    if not re.search(r"\d", password):
        return False, "Le mot de passe doit contenir au moins un chiffre."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+/\\\[\]~`]", password):
        return False, "Le mot de passe doit contenir au moins un caractère spécial."
    return True, None


def hash_password(password: str) -> str:
    """
    Hache le mot de passe avec Argon2id obligatoirement en production.
    Tout fallback vers PBKDF2 est strictement interdit en production.
    """
    if HAS_NATIVE_ARGON2 and _argon2_hasher is not None:
        return _argon2_hasher.hash(password)

    if settings.OPENNDR_ENV.lower() == "production":
        raise RuntimeError(
            "[FATAL SÉCURITÉ] Argon2id est obligatoire en production mais argon2-cffi n'est pas disponible. "
            "Le démarrage est interrompu pour prévenir toute faiblesse cryptographique."
        )

    # Fallback sécurisé standard PBKDF2 pour tests/développement local
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"pbkdf2:sha256:100000${salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> Tuple[bool, bool]:
    """
    Vérifie un mot de passe à temps constant.
    Retourne (is_valid: bool, needs_rehash: bool).
    Permet la migration transparente des anciens condensats PBKDF2 vers Argon2id lors de la connexion.
    """
    if not hashed_password or not plain_password:
        return False, False

    # 1. Vérification Argon2id
    if hashed_password.startswith("$argon2"):
        if HAS_NATIVE_ARGON2 and _argon2_hasher is not None:
            try:
                is_valid = _argon2_hasher.verify(hashed_password, plain_password)
                needs_rehash = _argon2_hasher.check_needs_rehash(hashed_password)
                return bool(is_valid), bool(needs_rehash)
            except (VerifyMismatchError, VerificationError):
                return False, False
            except Exception:
                return False, False
        else:
            return False, False

    # 2. Vérification Legacy PBKDF2 avec demande de re-hachage vers Argon2id
    if hashed_password.startswith("pbkdf2:"):
        try:
            parts = hashed_password.split("$")
            if len(parts) != 3:
                return False, False
            algo_iterations = parts[0]
            salt = bytes.fromhex(parts[1])
            expected_key = bytes.fromhex(parts[2])
            iterations = int(algo_iterations.split(":")[2])
            actual_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
            is_valid = hmac.compare_digest(actual_key, expected_key)
            # Dès que l'utilisateur s'authentifie, on signale qu'il faut migrer vers Argon2id
            return is_valid, True
        except Exception:
            return False, False

    return False, False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Génération d'un jeton JWT signé par HMAC-SHA256 avec validation complète des claims."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = secrets.token_hex(16)
    to_encode.update({
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": jti,
        "iss": "openndr",
        "aud": "openndr-api",
        "typ": "Bearer",
    })

    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def is_token_revoked(jti: str, db: Optional[Session] = None) -> bool:
    """Vérifie si un jeton a été révoqué en mémoire ou dans PostgreSQL."""
    if jti in REVOKED_TOKENS:
        return True
    if db is not None:
        try:
            from app.models.user import RevokedToken
            rev = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
            if rev:
                REVOKED_TOKENS.add(jti)
                return True
        except Exception:
            pass
    return False


def revoke_token(token: str, db: Optional[Session] = None) -> bool:
    """Révoque un jeton actif et enregistre l'invalidation dans PostgreSQL."""
    payload = decode_token(token)
    if payload and "jti" in payload:
        jti = payload["jti"]
        REVOKED_TOKENS.add(jti)
        if db is not None:
            try:
                from app.models.user import RevokedToken
                user_id = payload.get("sub")
                exp_ts = payload.get("exp")
                expires_at = (
                    datetime.fromtimestamp(exp_ts, tz=timezone.utc)
                    if exp_ts
                    else datetime.now(timezone.utc)
                )

                existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
                if not existing:
                    entry = RevokedToken(
                        jti=jti,
                        user_id=user_id,
                        revoked_at=datetime.now(timezone.utc),
                        expires_at=expires_at,
                    )
                    db.add(entry)
                    db.commit()

                # Nettoyage opportuniste des anciens jetons révoqués dont l'expiration naturelle est dépassée
                now = datetime.now(timezone.utc)
                db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
                db.commit()
            except Exception:
                db.rollback()
        return True
    return False


def decode_token(token: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    """
    Décodage et vérification stricte d'un jeton JWT :
    - Algorithme autorisé ('HS256')
    - Signature HMAC-SHA256
    - Expiration 'exp'
    - Date d'émission 'iat'
    - Identifiant unique 'jti'
    - Émetteur 'iss' ('openndr')
    - Audience 'aud' ('openndr-api')
    - Sujet 'sub'
    - Vérification de non-révocation persistante
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        # Décodage et contrôle du Header
        header_padding = "=" * (-len(header_b64) % 4)
        header = json.loads(base64.urlsafe_b64decode(header_b64 + header_padding).decode())
        if header.get("alg") != "HS256" or header.get("typ") != "JWT":
            return None

        # Vérification cryptographique à temps constant de la signature
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()

        sig_padding = "=" * (-len(sig_b64) % 4)
        actual_sig = base64.urlsafe_b64decode(sig_b64 + sig_padding)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + payload_padding).decode())

        # Contrôle des claims obligatoires
        now = datetime.now(timezone.utc).timestamp()
        exp = payload.get("exp")
        if exp is None or exp < now:
            return None

        iat = payload.get("iat")
        if iat is None or iat > now + 60:  # Tolérance horloge max 60s
            return None

        sub = payload.get("sub")
        if not sub:
            return None

        iss = payload.get("iss")
        if iss != "openndr":
            return None

        aud = payload.get("aud")
        if aud != "openndr-api":
            return None

        jti = payload.get("jti")
        if not jti:
            return None

        # Contrôle de révocation persistante
        if is_token_revoked(jti, db):
            return None

        return payload
    except Exception:
        return None
