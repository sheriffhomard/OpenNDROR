from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.system import router as system_router
from app.api.v1.health import router as health_router

api_v1_router = APIRouter()

api_v1_router.include_router(health_router, prefix="/health", tags=["Santé"])
api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentification"])
api_v1_router.include_router(users_router, prefix="/users", tags=["Utilisateurs"])
api_v1_router.include_router(system_router, prefix="/system", tags=["Système"])
