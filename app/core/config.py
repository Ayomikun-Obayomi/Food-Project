from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Recipe AI Backend"
    app_env: str = "development"
    secret_key: str = "change-me"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/recipes_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # AI
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "claude-sonnet-4-6"

    # Social OAuth
    instagram_client_id: str = ""
    instagram_client_secret: str = ""
    tiktok_client_id: str = ""
    tiktok_client_secret: str = ""

    # CORS
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,https://recipesearch-ai.netlify.app"

    @property
    def origins_list(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]
        return origins

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
