"""
Main FastAPI entrypoint for OpenNDR V0.2.
Schema lifecycle is exclusively governed by Alembic (no create_all fallback).
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.core.config import settings
from app.core.database import check_database_connection, engine
from app.api.v1 import api_v1_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("openndr.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_production_invariants()
    logger.info(f"Starting OpenNDR Backend v{settings.VERSION} in [{settings.OPENNDR_ENV}] environment")

    db_ok, db_msg = check_database_connection()
    if not db_ok and settings.OPENNDR_ENV.lower() == "production":
        raise RuntimeError(f"[FATAL SECURITY] Database unreachable in production: {db_msg}")
    logger.info(f"Database connectivity: {db_msg}")

    if db_ok:
        try:
            existing_tables = set(inspect(engine).get_table_names())
            required = {"users", "roles", "permissions", "revoked_tokens", "audit_logs", "alembic_version"}
            missing = required - existing_tables
            if missing:
                msg = (
                    f"Database schema not migrated (missing tables: {', '.join(sorted(missing))}). "
                    "Run `alembic upgrade head` before starting the API."
                )
                if settings.OPENNDR_ENV.lower() == "production":
                    raise RuntimeError(f"[FATAL SECURITY] {msg}")
                logger.warning(msg)
        except RuntimeError:
            raise
        except Exception as exc:
            logger.warning(f"Schema readiness check warning: {exc}")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=3600,
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. The incident has been logged for investigation."},
    )
