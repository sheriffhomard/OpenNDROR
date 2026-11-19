"""
Cryptographic security module for OpenNDR V0.2.
Mandatory Argon2id password hashing, strict JWT validation, and fail-closed DB revocation.
"""
import base64
import hashlib
import hmac
import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerificationError, VerifyMismatchError

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


class DatabaseSecurityError(Exception):
    """Raised when database verification fails during a security-critical check."""
    pass


def _require_argon2() -> PasswordHasher:
    if not HAS_NATIVE_ARGON2 or _argon2_hasher is None:
        raise RuntimeError(
            "[FATAL SECURITY] Argon2id is mandatory, but argon2-cffi is not available."
        )
    return _argon2_hasher


def _require_secret_key() -> str:
    secret = settings.SECRET_KEY
    if not secret or len(secret) < 32 or secret.strip() in settings.INSECURE_SECRET_VALUES:
        raise RuntimeError(
            "[FATAL SECURITY] SECRET_KEY is missing, weaker than 32 characters, or uses a forbidden placeholder."
        )
    return secret


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    OpenNDR strict password policy:
    - Minimum 12 characters
    - At least one uppercase, one lowercase, one digit, and one special character
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+/\\\[\]~`]", password):
        return False, "Password must contain at least one special character."
    return True, None


def hash_password(password: str) -> str:
    """Hashes passwords exclusively using Argon2id. No fallback permitted."""
    hasher = _require_argon2()
    return hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> Tuple[bool, bool]:
    """
    Verifies a password in constant time exclusively against Argon2id digests.
    Returns (is_valid, needs_rehash). Non-Argon2id hashes are strictly rejected.
    """
    if not hashed_password or not plain_password:
        return False, False

    if not hashed_password.startswith("$argon2id$"):
        return False, False

    hasher = _require_argon2()
    try:
        is_valid = hasher.verify(hashed_password, plain_password)
        needs_rehash = hasher.check_needs_rehash(hashed_password)
        return bool(is_valid), bool(needs_rehash)
    except (VerifyMismatchError, VerificationError):
        return False, False
    except Exception:
        return False, False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generates an HMAC-SHA256 JWT token with full claim set."""
    secret = _require_secret_key()
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
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def is_token_revoked(jti: str, db: Optional[Session] = None) -> bool:
    """
    Checks persistent token revocation in `revoked_tokens`.
    Strict FAIL-CLOSED behavior across ALL environments: a missing or failing DB
    session ALWAYS raises DatabaseSecurityError.
    """
    if db is None:
        raise DatabaseSecurityError(
            "Security check failed: database session is mandatory to verify token revocation."
        )

    try:
        from app.models.user import RevokedToken
        rev = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
        return rev is not None
    except Exception as e:
        raise DatabaseSecurityError(
            f"Critical failure during JWT revocation check in database: {e}"
        )


def revoke_token(token: str, db: Optional[Session] = None) -> bool:
    """
    Revokes an active token and persists invalidation in the relational database.
    Strict FAIL-CLOSED behavior across ALL environments: raises DatabaseSecurityError
    whenever persistence cannot be guaranteed.
    """
    if db is None:
        raise DatabaseSecurityError(
            "Unable to revoke token without an active database session."
        )

    payload = decode_token(token, db=db, check_revocation=False)
    if not payload or "jti" not in payload:
        return False

    jti = payload["jti"]
    user_id = payload.get("sub")
    exp_ts = payload.get("exp")
    expires_at = (
        datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        if exp_ts
        else datetime.now(timezone.utc)
    )

    try:
        from app.models.user import RevokedToken
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

        now = datetime.now(timezone.utc)
        db.query(RevokedToken).filter(RevokedToken.expires_at < now).delete()
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise DatabaseSecurityError(
            f"Failed to persist token revocation in database: {e}"
        )


def decode_token(
    token: str,
    db: Optional[Session] = None,
    check_revocation: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Strict JWT decoding & validation (alg HS256, HMAC signature, exp, iat, sub, iss, aud, jti,
    and persistent FAIL-CLOSED revocation check).
    """
    secret = _require_secret_key()
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts

        header_padding = "=" * (-len(header_b64) % 4)
        header = json.loads(base64.urlsafe_b64decode(header_b64 + header_padding).decode())
        if header.get("alg") != "HS256" or header.get("typ") != "JWT":
            return None

        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()

        sig_padding = "=" * (-len(sig_b64) % 4)
        actual_sig = base64.urlsafe_b64decode(sig_b64 + sig_padding)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + payload_padding).decode())

        now = datetime.now(timezone.utc).timestamp()
        exp = payload.get("exp")
        if exp is None or exp < now:
            return None

        iat = payload.get("iat")
        if iat is None or iat > now + 60:
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

        if check_revocation and is_token_revoked(jti, db):
            return None

        return payload
    except DatabaseSecurityError:
        raise
    except Exception:
        return None
