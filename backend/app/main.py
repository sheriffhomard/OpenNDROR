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
    # Validation des invariants de production
    settings.validate_production_invariants()
    logger.info(f"Démarrage d'OpenNDR Backend v{settings.VERSION} en environnement [{settings.OPENNDR_ENV}]")

    # Contrôle de la connectivité base de données au démarrage
    from app.core.database import check_database_connection
    db_ok, db_msg = check_database_connection()
    if not db_ok and settings.OPENNDR_ENV.lower() == "production":
        raise RuntimeError(f"[FATAL SÉCURITÉ] Base de données inaccessible en production : {db_msg}")
    logger.info(f"Connectivité base de données : {db_msg}")

    # En environnement de développement local / tests uniquement (hors production)
    if settings.OPENNDR_ENV.lower() != "production" and "sqlite" in settings.DATABASE_URL:
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            logger.warning(f"Initialisation dev SQLite : {e}")

    yield
    logger.info("Arrêt d'OpenNDR Backend")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API REST de gestion et d'orchestration pour la plateforme OpenNDR",
    docs_url="/api/docs" if settings.OPENNDR_ENV != "production" else None,
    redoc_url="/api/redoc" if settings.OPENNDR_ENV != "production" else None,
    lifespan=lifespan,
)

# Configuration CORS restrictive conforme aux règles OWASP (aucun wildcard avec credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=3600,
)

# Inclusion des routes versionnées V1
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


# Gestionnaire global d'exceptions pour éviter toute fuite de secrets ou de traces internes
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erreur non gérée sur {request.method} {request.url.path} : {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Une erreur interne est survenue. L'incident a été consigné pour investigation."},
    )
