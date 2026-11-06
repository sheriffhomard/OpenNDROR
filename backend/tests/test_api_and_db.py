import os
import unittest
from fastapi.testclient import TestClient

# Utiliser une base SQLite isolée pour les tests
os.environ["DATABASE_URL"] = "sqlite:///./test_openndr.db"
os.environ["OPENNDR_ENV"] = "development"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-only-min-32-chars!!"

from app.core.database import Base, engine, SessionLocal
from app.main import app
from app.models.user import User, Role, Permission
from app.cli import init_roles_and_permissions
from app.services.user_service import UserService
from app.schemas.user import UserCreate
from app.core.security import hash_password


class TestApiAndDatabaseV01(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        init_roles_and_permissions(cls.db)

        # Création des 3 utilisateurs de test en base
        admin_role = cls.db.query(Role).filter(Role.name == "Administrator").first()
        analyst_role = cls.db.query(Role).filter(Role.name == "Analyst").first()
        observer_role = cls.db.query(Role).filter(Role.name == "Observer").first()

        cls.admin = User(
            email="admin@test.local",
            full_name="Admin Test",
            hashed_password=hash_password("AdminSecurePass2026!"),
            is_active=True,
            roles=[admin_role],
        )
        cls.analyst = User(
            email="analyst@test.local",
            full_name="Analyst Test",
            hashed_password=hash_password("AnalystSecurePass2026!"),
            is_active=True,
            roles=[analyst_role],
        )
        cls.observer = User(
            email="observer@test.local",
            full_name="Observer Test",
            hashed_password=hash_password("ObserverSecurePass2026!"),
            is_active=True,
            roles=[observer_role],
        )
        cls.db.add_all([cls.admin, cls.analyst, cls.observer])
        cls.db.commit()

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("./test_openndr.db"):
            os.remove("./test_openndr.db")

    def test_health_endpoints(self):
        # Liveness
        res_live = self.client.get("/api/v1/health/live")
        self.assertEqual(res_live.status_code, 200)
        self.assertEqual(res_live.json()["status"], "UP")

        # Readiness
        res_ready = self.client.get("/api/v1/health/ready")
        self.assertEqual(res_ready.status_code, 200)
        self.assertTrue(res_ready.json()["database_connected"])

        # Health detailed
        res_health = self.client.get("/api/v1/health")
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.json()["database"]["status"], "CONNECTED")

    def test_auth_login_real_db(self):
        # Échec login mot de passe erroné
        res_fail = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.local", "password": "WrongPassword!"},
        )
        self.assertEqual(res_fail.status_code, 401)

        # Succès login
        res_ok = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.local", "password": "AdminSecurePass2026!"},
        )
        self.assertEqual(res_ok.status_code, 200)
        data = res_ok.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["role"], "Administrator")
        self.assertIn("users:manage", data["permissions"])

    def test_rbac_access_control(self):
        # Obtenir token pour admin
        token_admin = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.local", "password": "AdminSecurePass2026!"},
        ).json()["access_token"]

        # Obtenir token pour observer
        token_observer = self.client.post(
            "/api/v1/auth/login",
            json={"email": "observer@test.local", "password": "ObserverSecurePass2026!"},
        ).json()["access_token"]

        # 1. Admin peut lister les utilisateurs
        res_admin_list = self.client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        self.assertEqual(res_admin_list.status_code, 200)
        self.assertGreaterEqual(len(res_admin_list.json()), 3)

        # 2. Observer NE PEUT PAS lister les utilisateurs (requiert users:view)
        res_obs_list = self.client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token_observer}"},
        )
        self.assertEqual(res_obs_list.status_code, 403)

        # 3. Observer NE PEUT PAS créer un utilisateur (requiert users:manage)
        res_obs_create = self.client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token_observer}"},
            json={
                "email": "hacker@test.local",
                "full_name": "Hacker",
                "role_name": "Administrator",
                "password": "HackerPassword2026!",
            },
        )
        self.assertEqual(res_obs_create.status_code, 403)

        # 4. Requête sans token rejetée (401)
        res_no_auth = self.client.get("/api/v1/users")
        self.assertEqual(res_no_auth.status_code, 401)

    def test_audit_log_persistence(self):
        token_admin = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.local", "password": "AdminSecurePass2026!"},
        ).json()["access_token"]

        res_audit = self.client.get(
            "/api/v1/system/audit",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        self.assertEqual(res_audit.status_code, 200)
        logs = res_audit.json()
        self.assertGreaterEqual(len(logs), 1)
        self.assertEqual(logs[0]["status"], "SUCCESS")


if __name__ == "__main__":
    unittest.main()
