import base64
import os
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

DB_FILE = "./test_openndr_v02.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE}"
os.environ["OPENNDR_ENV"] = "development"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-only-min-32-chars!!"
os.environ.pop("OPENNDR_RELEASE_DATE", None)

from app.cli import init_roles_and_permissions
from app.core.database import SessionLocal, engine
from app.core.security import DatabaseSecurityError, hash_password
from app.main import app
from app.models.user import Role, User
from app.services.system_service import SystemService


def _run_migrations():
    backend_dir = Path(__file__).resolve().parents[1]
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{DB_FILE}")
    command.upgrade(alembic_cfg, "head")


class TestApiAndDatabaseV02(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists(DB_FILE):
            os.remove(DB_FILE)
        _run_migrations()

        cls.db = SessionLocal()
        init_roles_and_permissions(cls.db)

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
        cls.disabled_user = User(
            email="disabled@test.local",
            full_name="Disabled Test",
            hashed_password=hash_password("DisabledSecurePass2026!"),
            is_active=False,
            roles=[observer_role],
        )
        cls.db.add_all([cls.admin, cls.analyst, cls.observer, cls.disabled_user])
        cls.db.commit()

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        engine.dispose()
        if os.path.exists(DB_FILE):
            try:
                os.remove(DB_FILE)
            except OSError:
                pass

    def _login(self, email: str, password: str) -> str:
        res = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        self.assertEqual(res.status_code, 200)
        return res.json()["access_token"]

    def test_health_endpoints_and_honest_engine_reporting(self):
        res_live = self.client.get("/api/v1/health/live")
        self.assertEqual(res_live.status_code, 200)
        self.assertEqual(res_live.json()["status"], "UP")

        res_ready = self.client.get("/api/v1/health/ready")
        self.assertEqual(res_ready.status_code, 200)
        self.assertTrue(res_ready.json()["database_connected"])

        res_health = self.client.get("/api/v1/health")
        self.assertEqual(res_health.status_code, 200)
        health_json = res_health.json()
        self.assertTrue(health_json["database"]["connected"])
        self.assertEqual(health_json["database"]["status"], "CONNECTED")
        self.assertIn(
            health_json["capture_engine"]["engine_status"],
            ["OPERATIONAL", "DEGRADED", "STOPPED", "UNAVAILABLE", "UNKNOWN"],
        )

    def test_auth_login_and_disabled_user_rejection(self):
        res_fail = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.local", "password": "WrongPassword!"},
        )
        self.assertEqual(res_fail.status_code, 401)

        res_disabled = self.client.post(
            "/api/v1/auth/login",
            json={"email": "disabled@test.local", "password": "DisabledSecurePass2026!"},
        )
        self.assertEqual(res_disabled.status_code, 401)

        res_ok = self.client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.local", "password": "AdminSecurePass2026!"},
        )
        self.assertEqual(res_ok.status_code, 200)
        data = res_ok.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["role"], "Administrator")

    def test_rbac_access_control(self):
        token_admin = self._login("admin@test.local", "AdminSecurePass2026!")
        token_observer = self._login("observer@test.local", "ObserverSecurePass2026!")

        res_admin_list = self.client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        self.assertEqual(res_admin_list.status_code, 200)

        for method, path, body in [
            ("GET", "/api/v1/users", None),
            ("GET", "/api/v1/system/audit", None),
            ("POST", "/api/v1/system/capture/start", None),
            ("POST", "/api/v1/system/updates/check", None),
            ("POST", "/api/v1/system/updates/force", None),
            ("PUT", "/api/v1/system/updates/config", {"auto_update_enabled": True, "check_interval_minutes": 15}),
        ]:
            res = self.client.request(
                method,
                path,
                headers={"Authorization": f"Bearer {token_observer}"},
                json=body,
            )
            self.assertEqual(res.status_code, 403, f"Observer must get 403 on {method} {path}")

        self.assertEqual(self.client.get("/api/v1/users").status_code, 401)

    def test_system_updates_persistence_and_no_fake_release_date(self):
        token_admin = self._login("admin@test.local", "AdminSecurePass2026!")

        res_get = self.client.get("/api/v1/system/updates")
        self.assertEqual(res_get.status_code, 200)
        state = res_get.json()
        self.assertIsNone(state["release_date"], "Release date must remain None unless configured")

        res_cfg = self.client.put(
            "/api/v1/system/updates/config",
            headers={"Authorization": f"Bearer {token_admin}"},
            json={"auto_update_enabled": True, "check_interval_minutes": 30},
        )
        self.assertEqual(res_cfg.status_code, 200)
        self.assertTrue(res_cfg.json()["update_state"]["auto_update_enabled"])
        self.assertEqual(res_cfg.json()["update_state"]["check_interval_minutes"], 30)

        res_check = self.client.post(
            "/api/v1/system/updates/check",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        self.assertEqual(res_check.status_code, 200)
        self.assertIsNotNone(res_check.json()["update_state"]["last_checked_at"])

    def test_real_interfaces_and_uncollectable_sysfs_metrics_return_none(self):
        token_admin = self._login("admin@test.local", "AdminSecurePass2026!")

        res_ifaces = self.client.get(
            "/api/v1/system/interfaces",
            headers={"Authorization": f"Bearer {token_admin}"},
        )
        self.assertEqual(res_ifaces.status_code, 200)
        for iface in res_ifaces.json():
            self.assertNotEqual(iface["mac_address"], "00:00:00:00:00:00")
            self.assertNotEqual(iface["mac_address"], "52:54:00:12:34:56")
            self.assertNotEqual(iface["mac_address"], "52:54:00:ab:cd:ef")

        # Simulate uncollectable sysfs metrics -> MUST remain None, never synthetic defaults
        with patch.object(SystemService, "_read_sysfs_str", return_value=None), patch.object(
            SystemService, "_read_sysfs_int", return_value=None
        ):
            synthetic_free = SystemService._read_sysfs_int("/nonexistent")
            self.assertIsNone(synthetic_free)

        # Missing passive interface -> NOT_CONFIGURED
        with patch("app.services.system_service.settings.CAPTURE_INTERFACE", "nonexistent_nic9"):
            iso = SystemService.check_interface_isolation("nonexistent_nic9")
            self.assertEqual(iso["status"], "NOT_CONFIGURED")
            self.assertFalse(iso["is_isolated"])

        # Same admin and passive interface -> CONFIG_CONFLICT
        with patch("app.services.system_service.settings.ADMIN_INTERFACE", "lo"), patch(
            "app.services.system_service.settings.CAPTURE_INTERFACE", "lo"
        ):
            iso_conflict = SystemService.check_interface_isolation("lo")
            self.assertEqual(iso_conflict["status"], "CONFIG_CONFLICT")
            self.assertFalse(iso_conflict["is_isolated"])

    def test_storage_writability_and_missing_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("app.services.system_service.settings.PCAP_STORAGE_PATH", tmpdir):
                ok_metrics = SystemService.get_real_storage_metrics()
                self.assertEqual(ok_metrics["status"], "READY")
                self.assertTrue(ok_metrics["isWritable"])
                self.assertTrue(ok_metrics["pcap_storage"]["is_writable"])

        missing_path = "/tmp/openndr_nonexistent_pcap_dir_v02_test"
        with patch("app.services.system_service.settings.PCAP_STORAGE_PATH", missing_path):
            missing_metrics = SystemService.get_real_storage_metrics()
            self.assertEqual(missing_metrics["status"], "NOT_CREATED")
            self.assertFalse(missing_metrics["isWritable"])
            self.assertIsNone(missing_metrics["usedStorageGb"])

    def test_engine_ipc_unreachable_never_returns_operational(self):
        token_admin = self._login("admin@test.local", "AdminSecurePass2026!")

        with patch("app.services.system_service.settings.ENGINE_SOCKET_PATH", "/tmp/nonexistent_openndr.sock"):
            res_telem = self.client.get(
                "/api/v1/system/capture/telemetry",
                headers={"Authorization": f"Bearer {token_admin}"},
            )
            self.assertEqual(res_telem.status_code, 200)
            telem = res_telem.json()
            self.assertFalse(telem["ipc_reachable"])
            self.assertIn(telem["engine_status"], ["STOPPED", "UNAVAILABLE", "UNKNOWN", "DEGRADED"])
            self.assertNotEqual(telem["engine_status"], "OPERATIONAL")

            res_start = self.client.post(
                "/api/v1/system/capture/start",
                headers={"Authorization": f"Bearer {token_admin}"},
            )
            self.assertEqual(res_start.status_code, 503)

    def test_logout_revocation_and_fail_closed_503(self):
        token = self._login("analyst@test.local", "AnalystSecurePass2026!")

        res_me = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_me.status_code, 200)

        res_logout = self.client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(res_logout.status_code, 200)

        res_me_after = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_me_after.status_code, 401)

        token2 = self._login("analyst@test.local", "AnalystSecurePass2026!")
        with patch("app.core.security.is_token_revoked", side_effect=DatabaseSecurityError("DB down")):
            res_outage = self.client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token2}"},
            )
            self.assertEqual(res_outage.status_code, 503)

    def test_v02_pcap_ingestion_when_binary_available(self):
        token_admin = self._login("admin@test.local", "AdminSecurePass2026!")
        eth_hdr = bytes.fromhex("00112233445566778899aabb0800")
        ip_hdr = bytes.fromhex("450000280001000040060000c0a8010ac0a80114")
        tcp_hdr = bytes.fromhex("d43101bb00000001000000005002ffff00000000")
        frame = eth_hdr + ip_hdr + tcp_hdr
        pcap_global = struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
        pcap_pkt = struct.pack("<IIII", 1730000000, 123456, len(frame), len(frame)) + frame
        pcap_bytes = pcap_global + pcap_pkt

        if SystemService._find_engine_binary():
            b64_payload = base64.b64encode(pcap_bytes).decode("ascii")
            res_upload = self.client.post(
                "/api/v1/system/capture/upload-pcap",
                headers={"Authorization": f"Bearer {token_admin}"},
                json={"filename": "unit_test.pcap", "content_base64": b64_payload},
            )
            self.assertEqual(res_upload.status_code, 200)
            self.assertEqual(res_upload.json()["packets_processed"], 1)


if __name__ == "__main__":
    unittest.main()
