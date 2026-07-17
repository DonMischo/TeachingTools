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
from .routers import classes, teachers, transactions, auth as auth_router, setup as setup_router, capuths as capuths_router, wettkampf as wettkampf_router, haeuser as haeuser_router, students as students_router, style as style_router, roles as roles_router, barometer as barometer_router, auction as auction_router, bingo as bingo_router, exit_ticket as exit_ticket_router, chores as chores_router, trackers as trackers_router, stundenplaner as stundenplaner_router, groups as groups_router, calendar as calendar_router, exitgame as exitgame_router, practice as practice_router, generators as generators_router, timelines as timelines_router
from .routers.sportfest import disciplines as sf_disciplines, results as sf_results, auswertung as sf_auswertung
from .routers.schreibraum import rooms as schreibraum_rooms, collab as schreibraum_collab
from .routers.capuths import _inactivity_watchdog
from .seed import ensure_classes, ensure_sportfest_disciplines, ensure_teacher_roles, ensure_wochenstunden, ensure_calendar_tags, ensure_school_settings

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
app.include_router(trackers_router.router)
app.include_router(stundenplaner_router.router)
app.include_router(groups_router.router)
app.include_router(calendar_router.router)
app.include_router(exitgame_router.router)
app.include_router(practice_router.router)
app.include_router(generators_router.router)
app.include_router(timelines_router.router)

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

STUNDENPLANER_FILES_DIR = Path(__file__).parent.parent / "data" / "stundenplaner"
STUNDENPLANER_FILES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/stundenplaner", StaticFiles(directory=str(STUNDENPLANER_FILES_DIR)), name="stundenplaner_files")

STYLE_PACK_DIR = Path(__file__).parent.parent / "data" / "style-pack"
STYLE_PACK_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/style-pack", StaticFiles(directory=str(STYLE_PACK_DIR)), name="style_pack")

EXITGAME_ASSETS_DIR = Path(__file__).parent.parent / "data" / "exitgames"
EXITGAME_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/exitgames", StaticFiles(directory=str(EXITGAME_ASSETS_DIR)), name="exitgame_assets")


def _run_migrations(db_engine):
    """Apply additive schema changes that create_all cannot handle (new columns on existing tables)."""
    migrations = [
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_name VARCHAR(100)",
        "ALTER TABLE schreibraum_rooms ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'next-free-line'",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS extra_fields JSON NOT NULL DEFAULT '{}'",
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS team_mode BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES quiz_teams(id) ON DELETE SET NULL",
        "ALTER TABLE class_chores ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS grid_cols INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS anon_token VARCHAR(36)",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS subject VARCHAR(100)",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS tags JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS description VARCHAR(500)",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS max_points INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS ak_code VARCHAR(20)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS ak_code VARCHAR(20)",
        "ALTER TABLE barometer_sessions ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL",
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS preview_time_default INTEGER NOT NULL DEFAULT 3",
        "ALTER TABLE bingo_sets ADD COLUMN IF NOT EXISTS grades JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS nummer INTEGER",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS email VARCHAR(200)",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS teacher_role_id INTEGER REFERENCES teacher_roles(id) ON DELETE SET NULL",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS klasse_id INTEGER REFERENCES classes(id) ON DELETE SET NULL",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS korrektur INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS notiz VARCHAR(300)",
        "ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS start_time VARCHAR(5)",
        "ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)",
        "ALTER TABLE exitgame_attempts ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE",
        "ALTER TABLE exitgame_attempts ALTER COLUMN student_id DROP NOT NULL",
        "ALTER TABLE practice_tasks ADD COLUMN IF NOT EXISTS image_svg TEXT",
        "ALTER TABLE practice_progress ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE",
        "ALTER TABLE practice_progress ALTER COLUMN student_id DROP NOT NULL",
        "ALTER TABLE practice_tasks ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE",
        "ALTER TABLE practice_tasks ALTER COLUMN student_id DROP NOT NULL",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS av_stunden INTEGER",
        "ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS content JSON",
        "ALTER TABLE practice_tasks ADD COLUMN IF NOT EXISTS board JSON",
        # New tables in models.py need nothing here — Base.metadata.create_all()
        # (above) creates any table that doesn't exist yet. Only add a line here
        # for a genuinely new *column* on a table that may already exist from an
        # earlier run (create_all never alters existing tables).
    ]
    constraints = [
        "ALTER TABLE classes ADD CONSTRAINT uq_classes_ak_code UNIQUE (ak_code)",
        "CREATE INDEX IF NOT EXISTS ix_students_ak_code ON students (ak_code)",
        "ALTER TABLE exitgame_attempts ADD CONSTRAINT uq_exitgame_attempt_teacher UNIQUE (session_id, teacher_id)",
        "ALTER TABLE practice_progress ADD CONSTRAINT uq_practice_teacher_topic UNIQUE (teacher_id, topic)",
    ]
    with db_engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                logging.getLogger(__name__).warning("Migration skipped: %s — %s", sql, e)
        conn.commit()
        for sql in constraints:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                conn.rollback()
                logging.getLogger(__name__).warning("Migration skipped: %s — %s", sql, e)


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)
    ensure_classes()
    ensure_sportfest_disciplines()
    ensure_teacher_roles()
    ensure_wochenstunden()
    ensure_calendar_tags()
    ensure_school_settings()
    asyncio.create_task(_inactivity_watchdog(get_db))
