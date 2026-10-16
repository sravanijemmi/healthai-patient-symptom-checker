from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    groq_api_key: str = ""
    llm_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    llm_timeout_seconds: float = 1.7
    llm_temperature: float = 0.2
    log_raw_input: bool = False
    cors_origins: str = "http://localhost:8000,http://127.0.0.1:8000"
    max_input_length: int = 2000
    max_symptoms: int = 15
    rate_limit_per_minute: int = 10

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
