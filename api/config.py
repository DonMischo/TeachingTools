from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://hauspokal:hauspokal@localhost:5435/hauspokal"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8 hours
    guest_token_expire_minutes: int = 60  # QR/join-link guests: one session, 60 min

    class Config:
        env_file = ".env"


settings = Settings()
