from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async engine for the Schreibraum WebSocket (Yjs collab handler must be async).
# Only created for PostgreSQL — SQLite (used in tests) has no async driver.
_async_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
if _async_url.startswith("postgresql"):
    async_engine = create_async_engine(_async_url, pool_pre_ping=True)
    AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)
else:
    async_engine = None  # type: ignore[assignment]
    AsyncSessionLocal = None  # type: ignore[assignment]


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
