from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_url: str = "http://localhost:3000"

    database_url: str = "sqlite:///./data/granola.db"
    storage_dir: str = "./storage"

    whisper_model: str = "small"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_language: str = "tr"

    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    enable_external_ai: bool = True

    # 0 means "no application-level size limit" (still streamed to disk in chunks).
    max_upload_size_mb: int = 0

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def recordings_path(self) -> Path:
        path = self.storage_path / "recordings"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def uploads_path(self) -> Path:
        path = self.storage_path / "uploads"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def ai_enabled(self) -> bool:
        return self.enable_external_ai and bool(self.openrouter_api_key.strip())


settings = Settings()
