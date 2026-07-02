from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str

    # Segurança
    worker_secret: str

    # Storage Cloudflare R2 (bucket privado — obrigatório para
    # filmstrip/render; token com escopo Object Read & Write no bucket)
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None

    # Ambiente
    environment: str = "development"

    # URL do Next.js (usado pelo subtitle renderer via rota /render/[id])
    next_app_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()
