import asyncio
import logging
from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .database import engine
from .models import Base
from .database import get_db
from .routers import classes, teachers, transactions, auth as auth_router, setup as setup_router, capuths as capuths_router, wettkampf as wettkampf_router, haeuser as haeuser_router, students as students_router, style as style_router, roles as roles_router, barometer as barometer_router, auction as auction_router, bingo as bingo_router, exit_ticket as exit_ticket_router, chores as chores_router
from .routers.sportfest import disciplines as sf_disciplines, results as sf_results, auswertung as sf_auswertung
from .routers.schreibraum import rooms as schreibraum_rooms, collab as schreibraum_collab
from .routers.capuths import _inactivity_watchdog
from .seed import ensure_classes, ensure_sportfest_disciplines

app = FastAPI(title="Hauspokal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1339"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup_router.router)
app.include_router(auth_router.router)
app.include_router(classes.router)
app.include_router(teachers.router)
app.include_router(transactions.router)
app.include_router(capuths_router.router)
app.include_router(wettkampf_router.router)
app.include_router(haeuser_router.router)
app.include_router(students_router.router)
app.include_router(style_router.router)
app.include_router(sf_disciplines.router)
app.include_router(sf_results.router)
app.include_router(sf_auswertung.router)
app.include_router(schreibraum_rooms.router)
app.include_router(schreibraum_collab.router)
app.include_router(roles_router.router)
app.include_router(barometer_router.router)
app.include_router(auction_router.router)
app.include_router(bingo_router.router)
app.include_router(exit_ticket_router.router)
app.include_router(chores_router.router)

HAUS_LOGO_DIR = Path(__file__).parent.parent / "data" / "haeuser"
HAUS_LOGO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/haeuser", StaticFiles(directory=str(HAUS_LOGO_DIR)), name="haus_logos")

GFX_DIR = Path(__file__).parent.parent / "data" / "gfx"
if GFX_DIR.exists():
    app.mount("/uploads/gfx", StaticFiles(directory=str(GFX_DIR)), name="gfx")

QUIZ_GFX_DIR = Path(__file__).parent.parent / "data" / "quizzes"
QUIZ_GFX_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/quizzes", StaticFiles(directory=str(QUIZ_GFX_DIR)), name="quiz_assets")

SCHREIBRAUM_FILES_DIR = Path(__file__).parent.parent / "data" / "schreibraum"
SCHREIBRAUM_FILES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/schreibraum", StaticFiles(directory=str(SCHREIBRAUM_FILES_DIR)), name="schreibraum_files")

STYLE_PACK_DIR = Path(__file__).parent.parent / "data" / "style-pack"
STYLE_PACK_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/style-pack", StaticFiles(directory=str(STYLE_PACK_DIR)), name="style_pack")


def _run_migrations(db_engine):
    """Apply additive schema changes that create_all cannot handle (new columns on existing tables)."""
    migrations = [
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_name VARCHAR(100)",
        "ALTER TABLE schreibraum_rooms ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'next-free-line'",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS extra_fields JSON NOT NULL DEFAULT '{}'",
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS team_mode BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES quiz_teams(id) ON DELETE SET NULL",
    ]
    with db_engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                logging.getLogger(__name__).warning("Migration skipped: %s — %s", sql, e)
        conn.commit()


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)
    ensure_classes()
    ensure_sportfest_disciplines()
    asyncio.create_task(_inactivity_watchdog(get_db))
