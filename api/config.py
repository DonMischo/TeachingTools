from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://hauspokal:hauspokal@localhost:5435/hauspokal"
    secret_key: str = "change-me-in-production"
    # Beim Schlüsselwechsel: der bisherige SECRET_KEY. Gespeicherte Passwörter
    # bleiben lesbar und werden beim Start mit dem neuen Schlüssel neu verschlüsselt
    # (pw_crypto.rotate); danach kann der Eintrag wieder weg.
    secret_key_alt: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8 hours
    # Fallback-Laenge des Gastfensters. Der tatsaechliche Wert steht in
    # school_settings.guest_token_minutes und ist im Admin einstellbar; diese
    # Zahl gilt nur, solange es die Zeile noch nicht gibt.
    guest_token_expire_minutes: int = 90  # QR/join-link guests: one session

    class Config:
        env_file = ".env"


settings = Settings()
