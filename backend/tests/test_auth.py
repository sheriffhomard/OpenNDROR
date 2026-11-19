import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("OPENNDR_ENV", "development")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-min-32-chars!!")

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.security import (
    DatabaseSecurityError,
    create_access_token,
    decode_token,
    hash_password,
    is_token_revoked,
    revoke_token,
    validate_password_strength,
    verify_password,
)


def _run_alembic_upgrade(db_url: str) -> Config:
    backend_dir = Path(__file__).resolve().parents[1]
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    old_db_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = db_url
    try:
        command.upgrade(alembic_cfg, "head")
    finally:
        if old_db_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = old_db_url
    return alembic_cfg


class TestSecurityV02(unittest.TestCase):
    def test_argon2id_only_hashing_and_verification(self):
        raw_secret = "UltraSecurePassword2026!"
        hashed = hash_password(raw_secret)
        self.assertTrue(hashed.startswith("$argon2id$"))
        is_valid, needs_rehash = verify_password(raw_secret, hashed)
        self.assertTrue(is_valid)
        self.assertFalse(needs_rehash)
        self.assertFalse(verify_password("WrongPassword!", hashed)[0])
        self.assertFalse(verify_password(raw_secret, "not-an-argon2-hash")[0])

    def test_legacy_pbkdf2_hashes_are_strictly_rejected(self):
        import hashlib
        import secrets

        salt = secrets.token_bytes(16)
        raw_pass = "LegacyPassTest123!"
        key = hashlib.pbkdf2_hmac("sha256", raw_pass.encode("utf-8"), salt, 100_000)
        legacy_hash = f"pbkdf2:sha256:100000${salt.hex()}${key.hex()}"

        is_valid, needs_rehash = verify_password(raw_pass, legacy_hash)
        self.assertFalse(is_valid, "Legacy PBKDF2 fallback must be completely removed in V0.2")
        self.assertFalse(needs_rehash)

    def test_password_strength_policy(self):
        valid, err = validate_password_strength("Short1!")
        self.assertFalse(valid)
        self.assertIn("12 characters", err)

        valid, err = validate_password_strength("NoDigitsHere!!")
        self.assertFalse(valid)
        self.assertIn("digit", err)

        valid, err = validate_password_strength("NoSpecialChar123")
        self.assertFalse(valid)
        self.assertIn("special character", err)

        valid, err = validate_password_strength("SuperStrongPass2026!")
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_jwt_validation_requires_db_session_fail_closed(self):
        payload = {"sub": "usr-12345", "email": "admin@openndr.local", "role": "Administrator"}
        token = create_access_token(payload)

        with self.assertRaises(DatabaseSecurityError):
            decode_token(token, db=None)

        with self.assertRaises(DatabaseSecurityError):
            is_token_revoked("any-jti", db=None)

        with self.assertRaises(DatabaseSecurityError):
            revoke_token(token, db=None)

    def test_jwt_tampering_expired_and_wrong_audience_rejected(self):
        from datetime import timedelta

        payload = {"sub": "usr-9999", "email": "analyst@openndr.local", "role": "Analyst"}
        token = create_access_token(payload)
        tampered = token[:-4] + "xxxx"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        decoded = decode_token(token, db=mock_db)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["sub"], "usr-9999")
        self.assertEqual(decoded["aud"], "openndr-api")
        self.assertEqual(decoded["iss"], "openndr")

        self.assertIsNone(decode_token(tampered, db=mock_db))

        expired = create_access_token(payload, expires_delta=timedelta(seconds=-10))
        self.assertIsNone(decode_token(expired, db=mock_db))

    def test_jwt_revocation_with_alembic_schema(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            db_path = tmp.name
        db_url = f"sqlite:///{db_path}"
        test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
        try:
            _run_alembic_upgrade(db_url)
            TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
            db = TestingSessionLocal()
            try:
                payload = {"sub": "usr-revoke-test", "role": "Observer"}
                token = create_access_token(payload)
                self.assertIsNotNone(decode_token(token, db=db))
                revoked = revoke_token(token, db=db)
                self.assertTrue(revoked)
                self.assertIsNone(
                    decode_token(token, db=db),
                    "A revoked token persisted in revoked_tokens must be rejected",
                )
            finally:
                db.close()
        finally:
            test_engine.dispose()
            if os.path.exists(db_path):
                os.remove(db_path)

    def test_alembic_upgrade_downgrade_roundtrip_and_nullable_metrics(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            db_path = tmp.name
        db_url = f"sqlite:///{db_path}"
        test_engine = create_engine(db_url, connect_args={"check_same_thread": False})
        try:
            cfg = _run_alembic_upgrade(db_url)
            inspector = inspect(test_engine)
            tables = set(inspector.get_table_names())
            self.assertTrue({"users", "roles", "permissions", "revoked_tokens", "audit_logs", "network_interfaces", "system_settings"}.issubset(tables))

            cols = {c["name"]: c for c in inspector.get_columns("network_interfaces")}
            for nullable_col in ("mac_address", "mtu", "speed_mbps", "rx_dropped"):
                self.assertTrue(cols[nullable_col]["nullable"], f"{nullable_col} must be nullable")

            old_db_url = os.environ.get("DATABASE_URL")
            os.environ["DATABASE_URL"] = db_url
            try:
                command.downgrade(cfg, "base")
                command.upgrade(cfg, "head")
            finally:
                if old_db_url is None:
                    os.environ.pop("DATABASE_URL", None)
                else:
                    os.environ["DATABASE_URL"] = old_db_url
        finally:
            test_engine.dispose()
            if os.path.exists(db_path):
                os.remove(db_path)

    def test_fail_closed_token_revocation_on_db_error(self):
        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("PostgreSQL connection lost (OperationalError)")

        with self.assertRaises(DatabaseSecurityError):
            is_token_revoked("test-jti-12345", db=mock_db)

        payload = {"sub": "usr-failclosed-test", "role": "Observer"}
        token = create_access_token(payload)
        with self.assertRaises(DatabaseSecurityError):
            decode_token(token, db=mock_db)

        with self.assertRaises(DatabaseSecurityError):
            revoke_token(token, db=mock_db)

    def test_production_invariants_reject_weak_secrets_and_sqlite(self):
        env_cases = [
            {
                "OPENNDR_ENV": "production",
                "SECRET_KEY": "",
                "DATABASE_URL": "postgresql+psycopg2://u:strongpass@127.0.0.1:5432/openndr_db",
            },
            {
                "OPENNDR_ENV": "production",
                "SECRET_KEY": "too-short",
                "DATABASE_URL": "postgresql+psycopg2://u:strongpass@127.0.0.1:5432/openndr_db",
            },
            {
                "OPENNDR_ENV": "production",
                "SECRET_KEY": "__GENERATE_WITH_SECRETS_TOKEN_URLSAFE_48__",
                "DATABASE_URL": "postgresql+psycopg2://u:strongpass@127.0.0.1:5432/openndr_db",
            },
            {
                "OPENNDR_ENV": "production",
                "SECRET_KEY": "x" * 48,
                "DATABASE_URL": "sqlite:///./openndr.db",
            },
            {
                "OPENNDR_ENV": "production",
                "SECRET_KEY": "x" * 48,
                "DATABASE_URL": "postgresql+psycopg2://openndr:__CHANGE_ME_DB_PASSWORD__@127.0.0.1:5432/openndr_db",
            },
        ]
        for bad_env in env_cases:
            with patch.dict(os.environ, bad_env, clear=False):
                s = Settings()
                with self.assertRaises(ValueError):
                    s.validate_production_invariants()

    def test_cli_bootstrap_refuses_unmigrated_db(self):
        from app.cli import check_database_migrated

        with patch("app.cli.inspect") as mock_inspect:
            mock_inspector = mock_inspect.return_value
            mock_inspector.get_table_names.return_value = ["some_other_table"]

            with self.assertRaises(SystemExit) as cm:
                check_database_migrated()
            self.assertEqual(cm.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
