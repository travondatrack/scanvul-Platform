from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    app_name: str = "CodeGuard AI"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str = (
        "mysql://avnadmin:CHANGE_ME_AIVEN_PASSWORD@"
        "mysql-3ad09837-vlogsnqt720-e2a0.h.aivencloud.com:23011/defaultdb?ssl-mode=REQUIRED"
    )
    redis_url: str = ""
    upstash_redis_url: str = ""
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    @model_validator(mode="after")
    def resolve_redis(self) -> "Settings":
        if self.upstash_redis_url:
            self.redis_url = self.upstash_redis_url
        return self

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
    # Shared secret required by private FastAPI endpoints when the API is
    # reachable outside the Next.js server/proxy.
    internal_api_secret: str = ""
    
    # OAuth and JWT
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"
    jwt_secret: str = "secret"
    jwt_expires_minutes: int = 60

    # Scan safety limits
    # Seconds to wait for git clone before aborting (prevents infinite hang on large repos)
    git_clone_timeout_seconds: int = 120
    # Allowed URL prefixes for repo_url source type
    allowed_repo_url_prefixes: str = "https://github.com/,https://gitlab.com/,http://github.com/,http://gitlab.com/"
    # Max bytes accepted for paste/guest scan source value
    guest_scan_max_bytes: int = 524288  # 512 KB
    # Max bytes for project scan source value
    scan_source_max_bytes: int = 10485760  # 10 MB


    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        case_sensitive=False,
        extra="ignore",  # ignore NEXT_PUBLIC_* and other frontend-only vars in shared .env
    )


settings = Settings()
