import unittest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    revoke_token,
    validate_password_strength,
)


class TestSecurityV01(unittest.TestCase):
    def test_argon2id_password_hashing_and_verification(self):
        raw_secret = "UltraSecurePassword2026!"
        hashed = hash_password(raw_secret)
        self.assertTrue(hashed.startswith("$argon2id$") or hashed.startswith("pbkdf2:"))
        is_valid, needs_rehash = verify_password(raw_secret, hashed)
        self.assertTrue(is_valid)
        self.assertFalse(verify_password("WrongPassword!", hashed)[0])

    def test_legacy_pbkdf2_migration_to_argon2(self):
        # Condensat PBKDF2 simulé pour tester la migration progressive
        import hashlib, secrets
        salt = secrets.token_bytes(16)
        raw_pass = "MigrationTestPass123!"
        key = hashlib.pbkdf2_hmac("sha256", raw_pass.encode("utf-8"), salt, 100_000)
        legacy_hash = f"pbkdf2:sha256:100000${salt.hex()}${key.hex()}"

        is_valid, needs_rehash = verify_password(raw_pass, legacy_hash)
        self.assertTrue(is_valid)
        self.assertTrue(needs_rehash, "Un condensat PBKDF2 doit déclencher needs_rehash=True pour migrer vers Argon2id")

    def test_password_strength_policy(self):
        # Trop court (< 12)
        valid, err = validate_password_strength("Short1!")
        self.assertFalse(valid)
        self.assertIn("12 caractères", err)

        # Pas de chiffre
        valid, err = validate_password_strength("NoDigitsHere!!")
        self.assertFalse(valid)
        self.assertIn("chiffre", err)

        # Pas de caractère spécial
        valid, err = validate_password_strength("NoSpecialChar123")
        self.assertFalse(valid)
        self.assertIn("spécial", err)

        # Valide
        valid, err = validate_password_strength("SuperStrongPass2026!")
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_jwt_token_creation_and_expiration(self):
        payload = {"sub": "usr-12345", "email": "admin@openndr.local", "role": "Administrator"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["sub"], "usr-12345")
        self.assertEqual(decoded["email"], "admin@openndr.local")
        self.assertEqual(decoded["role"], "Administrator")
        self.assertIn("exp", decoded)
        self.assertIn("jti", decoded)

    def test_jwt_tampering_detection(self):
        payload = {"sub": "usr-9999", "email": "analyst@openndr.local", "role": "Analyst"}
        token = create_access_token(payload)
        tampered = token[:-4] + "xxxx"
        self.assertIsNone(decode_token(tampered))

    def test_jwt_revocation(self):
        payload = {"sub": "usr-revoke-test", "role": "Observer"}
        token = create_access_token(payload)
        self.assertIsNotNone(decode_token(token))
        revoked = revoke_token(token)
        self.assertTrue(revoked)
        self.assertIsNone(decode_token(token), "Un jeton révoqué ne doit plus être décodable")


if __name__ == "__main__":
    unittest.main()
