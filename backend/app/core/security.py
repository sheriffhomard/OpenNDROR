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

from app.core.config import settings

# Registre en mémoire des jetons révoqués (peut être synchronisé avec Redis/PostgreSQL)
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
    Hache le mot de passe avec Argon2id en priorité.
    Si la bibliothèque native C n'est pas installée, utilise PBKDF2-HMAC-SHA256 (100k itérations).
    """
    if HAS_NATIVE_ARGON2 and _argon2_hasher is not None:
        return _argon2_hasher.hash(password)
    
    # Fallback sécurisé standard PBKDF2
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
    """Génération d'un jeton JWT signé par HMAC-SHA256."""
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
    })
    
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def revoke_token(token: str) -> bool:
    """Révoque un jeton actif."""
    payload = decode_token(token)
    if payload and "jti" in payload:
        REVOKED_TOKENS.add(payload["jti"])
        return True
    return False


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Décodage et vérification de signature à temps constant d'un jeton JWT."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
        
        sig_padding = "=" * (-len(sig_b64) % 4)
        actual_sig = base64.urlsafe_b64decode(sig_b64 + sig_padding)
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
            
        payload_padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + payload_padding).decode())
        
        # Vérification expiration
        exp = payload.get("exp")
        if exp and exp < datetime.now(timezone.utc).timestamp():
            return None
            
        # Vérification révocation
        jti = payload.get("jti")
        if jti and jti in REVOKED_TOKENS:
            return None
            
        return payload
    except Exception:
        return None
