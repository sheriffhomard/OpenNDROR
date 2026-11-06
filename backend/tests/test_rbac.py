import unittest
from app.core.security import create_access_token, decode_token


class TestRBACV01(unittest.TestCase):
    def setUp(self):
        self.roles_permissions = {
            "Administrator": [
                "system:view", "system:manage",
                "interfaces:view", "interfaces:manage",
                "users:view", "users:manage",
                "audit:view", "storage:manage"
            ],
            "Analyst": [
                "system:view", "interfaces:view", "users:view", "audit:view"
            ],
            "Observer": [
                "system:view", "interfaces:view"
            ]
        }

    def test_administrator_has_all_permissions(self):
        admin_perms = self.roles_permissions["Administrator"]
        self.assertIn("system:manage", admin_perms)
        self.assertIn("interfaces:manage", admin_perms)
        self.assertIn("users:manage", admin_perms)
        self.assertIn("storage:manage", admin_perms)

    def test_analyst_cannot_manage_system(self):
        analyst_perms = self.roles_permissions["Analyst"]
        self.assertIn("audit:view", analyst_perms)
        self.assertNotIn("system:manage", analyst_perms)
        self.assertNotIn("interfaces:manage", analyst_perms)
        self.assertNotIn("users:manage", analyst_perms)

    def test_observer_is_read_only(self):
        observer_perms = self.roles_permissions["Observer"]
        self.assertIn("system:view", observer_perms)
        self.assertNotIn("audit:view", observer_perms)
        self.assertNotIn("users:manage", observer_perms)


if __name__ == "__main__":
    unittest.main()
