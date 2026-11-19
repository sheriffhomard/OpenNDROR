"""
SQLAlchemy persistence layer for OpenNDR V0.2.
PostgreSQL in production; explicit DATABASE_URL required for runtime and migrations.
"""
import logging
from typing import Generator, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("openndr.database")

Base = declarative_base()


def _resolve_database_url() -> str:
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    if settings.OPENNDR_ENV.lower() == "production":
        raise RuntimeError(
            "[FATAL SECURITY] DATABASE_URL must be configured in production mode."
        )
    # Isolated in-memory engine only when imported outside runtime DB context (e.g. pure unit tests)
    return "sqlite:///:memory:"


_db_url = _resolve_database_url()
is_sqlite = _db_url.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}
pool_kwargs = (
    {}
    if is_sqlite
    else {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_pre_ping": True,
    }
)

engine = create_engine(
    _db_url,
    connect_args=connect_args,
    **pool_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency providing a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> Tuple[bool, str]:
    """Real connectivity probe executing 'SELECT 1' against configured DB."""
    if not settings.DATABASE_URL:
        return False, "DATABASE_URL is not configured"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Connected and operational"
    except Exception as exc:
        logger.warning(f"Database connection test failed: {exc}")
        return False, str(exc)
