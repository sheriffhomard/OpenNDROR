import os

os.environ.setdefault("OPENNDR_ENV", "development")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-min-32-chars!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_openndr_suite.db")
