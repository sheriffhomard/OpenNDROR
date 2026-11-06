"""
Gestion de la persistance relationnelle SQLAlchemy pour OpenNDR V0.1
Supporte PostgreSQL (production) et SQLite (tests isolés).
"""
import logging
from typing import Generator, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("openndr.database")

Base = declarative_base()

# Configuration du moteur SQLAlchemy selon la cible
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}
pool_kwargs = {} if is_sqlite else {
    "pool_size": settings.DB_POOL_SIZE,
    "max_overflow": settings.DB_MAX_OVERFLOW,
    "pool_timeout": settings.DB_POOL_TIMEOUT,
    "pool_pre_ping": True,
}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **pool_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dépendance FastAPI fournissant une session de base de données transactionnelle."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> Tuple[bool, str]:
    """
    Vérification réelle de la connectivité à la base de données via une requête SQL 'SELECT 1'.
    Ne jamais déclarer la base connectée sans exécution réelle.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Connecté et opérationnel"
    except Exception as exc:
        logger.warning(f"Échec du test de connexion à la base de données : {exc}")
        return False, str(exc)
