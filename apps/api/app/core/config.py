from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CodeGuard AI"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str = "sqlite:///./codeguard.db"
    redis_url: str = "redis://localhost:6379/0"

    scan_worker_mode: str = "thread"
    storage_backend: str = "local"
    local_storage_path: str = "./storage"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "CHANGE_ME_ACCESS_KEY"
    minio_secret_key: str = "CHANGE_ME_SECRET_KEY"
    minio_bucket: str = "scans"

    # LLM / AI triage settings
    # Supported providers: openai, groq
    # For Groq, set llm_base_url=https://api.groq.com/openai/v1
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_base_url: str = ""  # override base URL for compatible providers (e.g. Groq)

    # Scanner flags
    # Enable dynamic SQLite auto-migration for local dev only.
    # In production with PostgreSQL, use explicit Alembic migrations.
    enable_dev_auto_migration: bool = False
    # Enable TruffleHog-style live secret verification (opt-in).
    # When enabled, a short outgoing HTTP check is made to verify if a secret is active.
    secret_verify_enabled: bool = False

    max_upload_bytes: int = 524288000
    rate_limit_per_minute: int = 60
    presigned_upload_expiry_seconds: int = 900
    captcha_secret_key: str = ""
    
    # OAuth and JWT
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    jwt_secret: str = "secret"
    jwt_expires_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        case_sensitive=False,
        extra="ignore",  # ignore NEXT_PUBLIC_* and other frontend-only vars in shared .env
    )


settings = Settings()
