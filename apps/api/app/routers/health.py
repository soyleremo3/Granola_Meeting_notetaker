from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    # Never return the API key itself — only whether external AI is configured/enabled.
    return {
        "status": "ok",
        "ai_enabled": settings.ai_enabled,
        "openrouter_model": settings.openrouter_model if settings.ai_enabled else None,
        "local_fallback_available": True,
        "whisper_model": settings.whisper_model,
    }
