import unittest
from app.core.security import hash_password, verify_password, create_access_token, decode_token


class TestSecurityV01(unittest.TestCase):
    def test_password_hashing_and_verification(self):
        raw_secret = "UltraSecurePassword2026!"
        hashed = hash_password(raw_secret)
        self.assertTrue(hashed.startswith("pbkdf2:sha256:100000$"))
        self.assertTrue(verify_password(raw_secret, hashed))
        self.assertFalse(verify_password("WrongPassword!", hashed))

    def test_jwt_token_creation_and_expiration(self):
        payload = {"sub": "admin@openndr.local", "role": "Administrator"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["sub"], "admin@openndr.local")
        self.assertEqual(decoded["role"], "Administrator")
        self.assertIn("exp", decoded)

    def test_jwt_tampering_detection(self):
        payload = {"sub": "analyst@openndr.local", "role": "Analyst"}
        token = create_access_token(payload)
        tampered = token[:-4] + "xxxx"
        self.assertIsNone(decode_token(tampered))


if __name__ == "__main__":
    unittest.main()
