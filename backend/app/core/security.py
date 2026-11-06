"""
Utilitaires cryptographiques et de sécurité pour OpenNDR V0.1
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
import json
import base64

from app.core.config import settings


def hash_password(password: str) -> str:
    """
    Hachage sécurisé de mot de passe utilisant PBKDF2-HMAC-SHA256 avec sel aléatoire.
    Compatible nativement sans dépendances C externes complexes si Argon2 n'est pas présent.
    """
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"pbkdf2:sha256:100000${salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérification à temps constant d'un mot de passe contre son condensat."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        algo_iterations = parts[0]
        salt = bytes.fromhex(parts[1])
        expected_key = bytes.fromhex(parts[2])
        
        iterations = int(algo_iterations.split(":")[2])
        actual_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual_key, expected_key)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Génération d'un jeton JWT sécurisé signé par HMAC-SHA256."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": int(expire.timestamp())})
    header = {"alg": "HS256", "typ": "JWT"}
    
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip("=")
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_token(token: str) -> Optional[dict]:
    """Décodage et validation de signature à temps constant d'un jeton JWT."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
        
        # Décodage base64 padding safe
        sig_padding = "=" * (-len(sig_b64) % 4)
        actual_sig = base64.urlsafe_b64decode(sig_b64 + sig_padding)
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
            
        payload_padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + payload_padding).decode())
        
        exp = payload.get("exp")
        if exp and exp < datetime.now(timezone.utc).timestamp():
            return None  # Expiré
            
        return payload
    except Exception:
        return None
