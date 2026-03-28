from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CodeGuard AI"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str = "postgresql+psycopg://CHANGE_ME_USER:CHANGE_ME_PASSWORD@localhost:5432/codeguard"
    redis_url: str = "redis://localhost:6379/0"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "CHANGE_ME_ACCESS_KEY"
    minio_secret_key: str = "CHANGE_ME_SECRET_KEY"
    minio_bucket: str = "scans"

    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""

    max_upload_bytes: int = 524288000
    rate_limit_per_minute: int = 60
    presigned_upload_expiry_seconds: int = 900
    captcha_secret_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
