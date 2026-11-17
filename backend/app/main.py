"""
Point d'entrée principal de l'API OpenNDR V0.1
Architecture sécurisée, persistance PostgreSQL, RBAC strict et sans données fictives.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1 import api_v1_router

# Configuration des logs applicatifs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("openndr.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Production invariant validation
    settings.validate_production_invariants()
    logger.info(f"Starting OpenNDR Backend v{settings.VERSION} in [{settings.OPENNDR_ENV}] environment")

    # Startup database connectivity check
    from app.core.database import check_database_connection
    db_ok, db_msg = check_database_connection()
    if not db_ok and settings.OPENNDR_ENV.lower() == "production":
        raise RuntimeError(f"[FATAL SECURITY] Database unreachable in production: {db_msg}")
    logger.info(f"Database connectivity: {db_msg}")

    # Local dev / test environment only (non-production)
    if settings.OPENNDR_ENV.lower() != "production" and "sqlite" in settings.DATABASE_URL:
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logger.warning(f"SQLite dev initialization: {e}")

    yield
    logger.info("Shutting down OpenNDR Backend")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="REST API for OpenNDR platform management and orchestration",
    docs_url="/api/docs" if settings.OPENNDR_ENV != "production" else None,
    redoc_url="/api/redoc" if settings.OPENNDR_ENV != "production" else None,
    lifespan=lifespan,
)

# Restrictive CORS configuration compliant with OWASP rules (no wildcard with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=3600,
)

# V1 versioned routes
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


# Global exception handler to prevent leaking secrets or internal stack traces
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. The incident has been logged for investigation."},
    )
