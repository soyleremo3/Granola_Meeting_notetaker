from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "ai_enabled": settings.ai_enabled,
        "whisper_model": settings.whisper_model,
    }
