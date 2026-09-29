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
from .routers import classes, teachers, transactions, auth as auth_router, setup as setup_router, capuths as capuths_router, wettkampf as wettkampf_router, haeuser as haeuser_router, students as students_router, style as style_router, roles as roles_router, barometer as barometer_router, auction as auction_router, bingo as bingo_router, exit_ticket as exit_ticket_router, chores as chores_router, trackers as trackers_router, stundenplaner as stundenplaner_router, groups as groups_router, calendar as calendar_router, exitgame as exitgame_router, practice as practice_router, generators as generators_router, timelines as timelines_router, lueckentexte as lueckentexte_router, seating as seating_router, availability as availability_router, tipptexte as tipptexte_router, wettschreiben as wettschreiben_router, bestenliste as bestenliste_router
from .routers.sportfest import disciplines as sf_disciplines, results as sf_results, auswertung as sf_auswertung
from .routers.schreibraum import rooms as schreibraum_rooms, collab as schreibraum_collab
from .routers.capuths import _inactivity_watchdog
from .seed import ensure_classes, ensure_sportfest_disciplines, ensure_teacher_roles, ensure_wochenstunden, ensure_calendar_tags, ensure_school_settings

app = FastAPI(title="TT - Teaching Tools API")

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
app.include_router(lueckentexte_router.router)
app.include_router(tipptexte_router.router)
app.include_router(wettschreiben_router.router)
app.include_router(bestenliste_router.router)
app.include_router(seating_router.router)
app.include_router(availability_router.router)
from .routers import admin_access as admin_access_router
app.include_router(admin_access_router.router)
from .routers import guest as guest_router
app.include_router(guest_router.router)

from .routers import tool_sessions as tool_sessions_router
app.include_router(tool_sessions_router.router)
from .routers import standalone as standalone_router
app.include_router(standalone_router.router)
from .routers import fragments as fragments_router
app.include_router(fragments_router.router)
from .routers import fragments_cards as fragments_cards_router
app.include_router(fragments_cards_router.router)
from .routers import snap as snap_router
app.include_router(snap_router.router)
from .routers import play as play_router
app.include_router(play_router.router)
from .routers import school as school_router
app.include_router(school_router.router)
from .routers import twofa as twofa_router
app.include_router(twofa_router.router)
from .routers import maus as maus_router
app.include_router(maus_router.router)
app.include_router(maus_router.router_sitzung)
from .routers import verkehr as verkehr_router
app.include_router(verkehr_router.router)
from .routers import leben as leben_router
app.include_router(leben_router.router)

from .routers import slideshow as slideshow_router
app.include_router(slideshow_router.router)

from .routers import bildpaare as bildpaare_router
app.include_router(bildpaare_router.router)

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

FRAGMENTS_FILES_DIR = Path(__file__).parent.parent / "data" / "fragments"
FRAGMENTS_FILES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/fragments", StaticFiles(directory=str(FRAGMENTS_FILES_DIR)), name="fragment_media")

STUNDENPLANER_FILES_DIR = Path(__file__).parent.parent / "data" / "stundenplaner"
STUNDENPLANER_FILES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/stundenplaner", StaticFiles(directory=str(STUNDENPLANER_FILES_DIR)), name="stundenplaner_files")

STYLE_PACK_DIR = Path(__file__).parent.parent / "data" / "style-pack"
STYLE_PACK_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/style-pack", StaticFiles(directory=str(STYLE_PACK_DIR)), name="style_pack")

EXITGAME_ASSETS_DIR = Path(__file__).parent.parent / "data" / "exitgames"
EXITGAME_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/exitgames", StaticFiles(directory=str(EXITGAME_ASSETS_DIR)), name="exitgame_assets")

app.mount("/uploads/slideshow", StaticFiles(directory=str(slideshow_router.SLIDESHOW_DIR)), name="slideshow_assets")

BILDPAARE_DIR = Path(__file__).parent.parent / "data" / "bildpaare"
BILDPAARE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/bildpaare", StaticFiles(directory=str(BILDPAARE_DIR)), name="bildpaare")


def _run_migrations(db_engine):
    """Apply additive schema changes that create_all cannot handle (new columns on existing tables)."""
    migrations = [
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_name VARCHAR(100)",
        "ALTER TABLE slideshow_items ADD COLUMN IF NOT EXISTS calendar_categories JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE schreibraum_rooms ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'next-free-line'",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS extra_fields JSON NOT NULL DEFAULT '{}'",
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS team_mode BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES quiz_teams(id) ON DELETE SET NULL",
        "ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open'",
        "ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS ref_id INTEGER",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ",
        "ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "CREATE INDEX IF NOT EXISTS ix_quiz_participants_guest_id ON quiz_participants (guest_id)",
        "ALTER TABLE lueckentext_participants ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "CREATE INDEX IF NOT EXISTS ix_lueckentext_participants_guest_id ON lueckentext_participants (guest_id)",
        "ALTER TABLE class_chores ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS grid_cols INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS anon_token VARCHAR(36)",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS subject VARCHAR(100)",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS tags JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS description VARCHAR(500)",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS max_points INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS ak_code VARCHAR(20)",
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS ksprecher_can_edit BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE classes ADD COLUMN IF NOT EXISTS role_types JSON",
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
        # Üben über den QR einer Werkzeug-Sitzung: der Teilnehmer kann auch ein
        # Gast ohne Konto sein, erkannt an der Id seines Gast-Tokens.
        "ALTER TABLE practice_progress ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "ALTER TABLE practice_tasks ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_practice_guest_topic ON practice_progress (guest_id, topic)",
        "CREATE INDEX IF NOT EXISTS ix_practice_tasks_guest_id ON practice_tasks (guest_id)",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS av_stunden INTEGER",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS username VARCHAR(100)",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password_seed INTEGER",
        # Rename the student password-seed column (formerly pokedex_number) to
        # match Teacher.password_seed. Wrapped in a conditional DO block so it is
        # idempotent — a plain RENAME has no IF EXISTS and would raise on a fresh
        # DB (create_all already made password_seed) or on every restart after
        # the first rename, which previously aborted the whole migration batch.
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'students' AND column_name = 'pokedex_number')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_name = 'students' AND column_name = 'password_seed')
          THEN
            ALTER TABLE students RENAME COLUMN pokedex_number TO password_seed;
          END IF;
        END $$;
        """,
        "ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS content JSON",
        "ALTER TABLE practice_tasks ADD COLUMN IF NOT EXISTS board JSON",
        # Student authorship (shared student pool) on reusable content tables.
        "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_by_student INTEGER REFERENCES students(id) ON DELETE SET NULL",
        "ALTER TABLE bingo_sets ADD COLUMN IF NOT EXISTS created_by_student INTEGER REFERENCES students(id) ON DELETE SET NULL",
        "ALTER TABLE bingo_sets ALTER COLUMN created_by DROP NOT NULL",
        "ALTER TABLE exitgames ADD COLUMN IF NOT EXISTS created_by_student INTEGER REFERENCES students(id) ON DELETE SET NULL",
        "ALTER TABLE exitgames ALTER COLUMN created_by DROP NOT NULL",
        "ALTER TABLE timeline_sets ADD COLUMN IF NOT EXISTS created_by_student INTEGER REFERENCES students(id) ON DELETE SET NULL",
        "ALTER TABLE timeline_sets ALTER COLUMN created_by DROP NOT NULL",
        "ALTER TABLE lueckentext_sets ADD COLUMN IF NOT EXISTS created_by_student INTEGER REFERENCES students(id) ON DELETE SET NULL",
        "ALTER TABLE lueckentext_sets ALTER COLUMN created_by DROP NOT NULL",
        # Student display alias (Sitzplan) + Nachteilsausgleich flags.
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS alias VARCHAR(100)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS nta JSON NOT NULL DEFAULT '[]'",
        # Encrypted-at-rest login password for re-display (externally reused passwords).
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS password_enc TEXT",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password_enc TEXT",
        # Geschlecht is optional — CSV imports may omit it.
        "ALTER TABLE students ALTER COLUMN geschlecht DROP NOT NULL",
        # QR/join-link guest access: per-session opt-in + guest-keyed exitgame attempts.
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE exit_ticket_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE barometer_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE exitgame_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE lueckentext_sessions ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE schreibraum_rooms ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE schreibraum_participants ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "ALTER TABLE barometer_responses ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "ALTER TABLE exitgame_attempts ADD COLUMN IF NOT EXISTS guest_id VARCHAR(36)",
        "ALTER TABLE exitgame_attempts ADD COLUMN IF NOT EXISTS guest_name VARCHAR(100)",
        # Fragments: specific-teacher grants und Freigaben an eine A/B-Gruppe.
        # Spalten anlegen und das alte Unique fallen lassen, damit das breitere
        # (unten) an seine Stelle treten kann.
        "ALTER TABLE fragment_collection_grants ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE",
        "ALTER TABLE fragment_collection_grants ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE CASCADE",
        "ALTER TABLE fragment_collection_grants DROP CONSTRAINT IF EXISTS uq_fragment_grant",
        # Verfuegbarkeit auch fuer eine A/B-Gruppe statt nur fuer eine ganze Klasse.
        "ALTER TABLE tool_availability ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_tool_availability_group_id ON tool_availability (group_id)",
        "ALTER TABLE tool_availability DROP CONSTRAINT IF EXISTS uq_tool_availability_scope",
        # Kurse/WPF exist once per Jahrgang ("10 K1" != "9 K1"). Drop the old
        # 3-column unique so the 4-column one (below) can replace it.
        "ALTER TABLE student_groups ADD COLUMN IF NOT EXISTS grade INTEGER",
        "ALTER TABLE student_groups DROP CONSTRAINT IF EXISTS uq_group_type_class_name",
        # Tracking + Sitzplan gained a second scope: a Kurs/WPF instead of a Klasse.
        "ALTER TABLE class_trackers ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE CASCADE",
        "ALTER TABLE class_trackers ALTER COLUMN class_id DROP NOT NULL",
        "ALTER TABLE seating_plans ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE CASCADE",
        "ALTER TABLE seating_plans ALTER COLUMN class_id DROP NOT NULL",
        # Lückentext-Sitzungen tauchen jetzt in einer Liste auf und brauchen dafür
        # ein Datum. Alte Zeilen bleiben leer statt falsch datiert zu werden.
        # Ohne DEFAULT anlegen (sonst füllt Postgres die Altbestände mit dem
        # Migrationszeitpunkt), den DEFAULT erst danach für neue Zeilen setzen.
        "ALTER TABLE lueckentext_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ",
        "ALTER TABLE lueckentext_sessions ALTER COLUMN created_at SET DEFAULT NOW()",
        # Spiel-Sitzungen bekommen denselben zweiten Geltungsbereich wie Tracking
        # und Sitzplan: ein Kurs/WPF statt einer Klasse. Kurse sind
        # klassenuebergreifend, deshalb haelt points_by_class die Aufteilung.
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE RESTRICT",
        "ALTER TABLE quiz_sessions ALTER COLUMN class_id DROP NOT NULL",
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS points_by_class JSON",
        "ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL",
        "ALTER TABLE quiz_participants ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE SET NULL",
        "ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS points_by_class JSON",
        "ALTER TABLE exitgame_sessions ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES student_groups(id) ON DELETE RESTRICT",
        "ALTER TABLE exitgame_sessions ALTER COLUMN class_id DROP NOT NULL",
        # Altbestand nachziehen: vor dem Kurs/WPF-Geltungsbereich gehoerte jeder
        # Teilnehmer der Klasse seiner Sitzung. Ohne das bekaeme eine Runde, die
        # ueber das Deployment hinweg laeuft, am Ende null Punkte — ihre
        # Teilnehmer haetten gar keine Klasse.
        "UPDATE quiz_participants p SET class_id = s.class_id FROM quiz_sessions s "
        "WHERE p.session_id = s.id AND p.class_id IS NULL AND s.class_id IS NOT NULL",
        "UPDATE quiz_sessions SET points_by_class = json_build_object(class_id::text, points_awarded) "
        "WHERE points_by_class IS NULL AND points_awarded IS NOT NULL AND class_id IS NOT NULL",
        # "Gastzugang neu starten": entzieht bereits ausgegebene Gast-Token,
        # damit die naechste Klasse denselben gedruckten QR nutzen kann, ohne
        # dass die vorige noch Zugang hat.
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE exit_ticket_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE barometer_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE exitgame_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE lueckentext_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE schreibraum_rooms ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE wettschreiben_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS guest_epoch INTEGER NOT NULL DEFAULT 0",
        # Caputh-Sitzungen bekommen ein Anlagedatum fuer die Schuljahres-
        # bereinigung. Ohne DEFAULT anlegen, damit Postgres die Altbestaende
        # nicht auf den Migrationszeitpunkt datiert; DEFAULT danach fuer neue.
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ",
        "ALTER TABLE quiz_sessions ALTER COLUMN created_at SET DEFAULT NOW()",
        # Zwei-Faktor fuer Lehrkraefte (Klarpasswort-Zugriffe, siehe api/totp.py).
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS totp_confirmed BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS totp_last_counter INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS recovery_codes TEXT NOT NULL DEFAULT '[]'",
        # Geschlecht wird nur noch ausgeliefert, wenn ein Admin es einschaltet.
        "ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS show_geschlecht BOOLEAN NOT NULL DEFAULT FALSE",
        # Der eigene PDF-Download am Ende einer Lueckentext-Runde haengt nicht
        # mehr an der fortlaufenden Teilnehmer-Id. Erst nullable anlegen und die
        # Altbestaende fuellen, dann NOT NULL setzen — sonst scheitert die
        # Migration an bereits vorhandenen Zeilen.
        "ALTER TABLE lueckentext_participants ADD COLUMN IF NOT EXISTS export_token VARCHAR(36)",
        "UPDATE lueckentext_participants SET export_token = gen_random_uuid()::text WHERE export_token IS NULL",
        "ALTER TABLE lueckentext_participants ALTER COLUMN export_token SET NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_lueckentext_participants_export_token ON lueckentext_participants (export_token)",
        "ALTER TABLE barometer_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'live'",
        "ALTER TABLE barometer_sessions ADD COLUMN IF NOT EXISTS results_public BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'scale'",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS options JSON NOT NULL DEFAULT '[]'",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS chart VARCHAR(20)",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS analysis JSON",
        "ALTER TABLE barometer_responses ADD COLUMN IF NOT EXISTS text TEXT",
        "ALTER TABLE barometer_responses ALTER COLUMN value DROP NOT NULL",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS same_slide BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS block VARCHAR(20)",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS intro TEXT",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS show_if JSON",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS scale_style VARCHAR(20) NOT NULL DEFAULT 'zahlen'",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS max_choices INTEGER",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS num_min DOUBLE PRECISION",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS num_max DOUBLE PRECISION",
        "ALTER TABLE barometer_questions ADD COLUMN IF NOT EXISTS unit VARCHAR(20)",
        "ALTER TABLE barometer_responses ADD COLUMN IF NOT EXISTS number DOUBLE PRECISION",
        "ALTER TABLE barometer_responses ADD COLUMN IF NOT EXISTS choices JSON",
        "ALTER TABLE maus_bestenliste ADD COLUMN IF NOT EXISTS hilfe BOOLEAN NOT NULL DEFAULT FALSE",
        # Laenge des Gastfensters, schulweit einstellbar (vorher fest 60 Minuten).
        "ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS guest_token_minutes INTEGER NOT NULL DEFAULT 90",
        "ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS tool_faecher JSON NOT NULL DEFAULT '{}'",
        "ALTER TABLE sim_beitraege ADD COLUMN IF NOT EXISTS art VARCHAR(20) NOT NULL DEFAULT 'text'",
        # New tables in models.py need nothing here — Base.metadata.create_all()
        # (above) creates any table that doesn't exist yet. Only add a line here
        # for a genuinely new *column* on a table that may already exist from an
        # earlier run (create_all never alters existing tables).
    ]
    def add_unique(table: str, name: str, columns: str) -> str:
        # Postgres kennt kein ADD CONSTRAINT IF NOT EXISTS. Ungeschuetzt scheiterte
        # das ALTER bei jedem Start am schon vorhandenen Constraint — harmlos,
        # aber Postgres schrieb dafuer jedes Mal ein ERROR ins Log. to_regclass
        # findet den Namen, weil ein UNIQUE-Constraint seinen Index gleich nennt.
        return (f"DO $$ BEGIN IF to_regclass('{name}') IS NULL THEN "
                f"ALTER TABLE {table} ADD CONSTRAINT {name} UNIQUE ({columns}); END IF; END $$")

    constraints = [
        add_unique("classes", "uq_classes_ak_code", "ak_code"),
        "CREATE INDEX IF NOT EXISTS ix_students_ak_code ON students (ak_code)",
        add_unique("exitgame_attempts", "uq_exitgame_attempt_teacher", "session_id, teacher_id"),
        add_unique("exitgame_attempts", "uq_exitgame_attempt_guest", "session_id, guest_id"),
        add_unique("barometer_responses", "uq_baro_guest_question", "session_id, question_id, guest_id"),
        add_unique("practice_progress", "uq_practice_teacher_topic", "teacher_id, topic"),
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_teachers_username ON teachers (username)",
        add_unique("fragment_collection_grants", "uq_fragment_grant", "collection_id, grantee_type, class_id, teacher_id, group_id"),
        add_unique("tool_availability", "uq_tool_availability_scope", "tool_slug, capability, audience, class_id, group_id"),
        # NULL-safe: class_id/grade are NULL for cross-class groups, and NULLs
        # never collide in a plain UNIQUE — so a second "10 Kurs I" would slip in.
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_group_scope_name ON student_groups "
        "(group_type, COALESCE(class_id, -1), COALESCE(grade, -1), name)",
        # Ein Kurs/WPF verdient an einem Quiz genauso nur einmal Punkte wie eine Klasse.
        add_unique("quiz_sessions", "uq_quiz_group", "quiz_id, group_id"),
    ]
    # Each statement runs in its OWN transaction (commit on success, rollback on
    # failure). These migrations are best-effort and idempotent: any one may fail
    # because it was already applied or doesn't apply to this DB's history. On
    # Postgres a failed statement aborts the current transaction and every later
    # statement in it errors with "current transaction is aborted …", so a shared
    # transaction would let one failure silently skip all migrations after it.
    with db_engine.connect() as conn:
        for sql in migrations + constraints:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as e:
                conn.rollback()
                logging.getLogger(__name__).warning("Migration skipped: %s — %s", sql, e)


def _backfill_encrypted_passwords():
    """One-time (idempotent) production migration: encrypt existing seed-based
    student passwords at rest and drop the recoverable seed. See
    students.encrypt_seed_passwords."""
    from .database import SessionLocal
    from .routers.students import encrypt_seed_passwords
    from .routers.teachers import encrypt_seed_passwords_teachers

    db = SessionLocal()
    try:
        migrated = encrypt_seed_passwords(db) + encrypt_seed_passwords_teachers(db)
        if migrated:
            db.commit()
            logging.getLogger(__name__).info("Encrypted %d seed-based passwords", migrated)
    except Exception as e:
        db.rollback()
        logging.getLogger(__name__).warning("Password encryption backfill skipped: %s", e)
    finally:
        db.close()


def _repair_calendar_tags():
    """Idempotent: clean tags broken by the old ICS import (see calendar.repair_calendar_tags)."""
    from .database import SessionLocal
    from .routers.calendar import repair_calendar_tags

    db = SessionLocal()
    try:
        changed = repair_calendar_tags(db)
        if changed:
            logging.getLogger(__name__).info("Kalender-Tags repariert: %d Termine", changed)
    finally:
        db.close()


def _backfill_group_grades():
    """One-time (idempotent) migration: give every cross-class Kurs/WPF its Jahrgang.

    Kurse used to be global, so a single "Kurs I" could hold 9th and 10th graders
    at once. Such a group is split by grade: the lowest grade keeps the existing
    row, every other grade gets its own group and its members move over. Groups
    whose grade cannot be derived (no members, or members without a class) keep
    grade NULL and are simply skipped on the next start."""
    from .database import SessionLocal
    from .models import StudentGroup, Student, Class
    from .utils import grade_of_class_code

    db = SessionLocal()
    try:
        stale = (
            db.query(StudentGroup)
            .filter(StudentGroup.grade.is_(None), StudentGroup.class_id.is_(None))
            .all()
        )
        if not stale:
            return
        class_grade = {c.id: grade_of_class_code(c.code) for c in db.query(Class).all()}
        split = 0
        for g in stale:
            by_grade: dict[int, list] = {}
            for m in g.members:
                s: Student = m.student
                grade = class_grade.get(s.class_id) if s.class_id else None
                if grade is None:
                    grade = s.jahrgang
                if grade is not None:
                    by_grade.setdefault(grade, []).append(m)
            if not by_grade:
                continue
            keep, *rest = sorted(by_grade)
            g.grade = keep
            for grade in rest:
                sibling = StudentGroup(group_type=g.group_type, name=g.name, class_id=None, grade=grade)
                db.add(sibling)
                db.flush()
                for m in by_grade[grade]:
                    m.group_id = sibling.id
                split += 1
        db.commit()
        logging.getLogger(__name__).info(
            "Backfilled Jahrgang on %d groups (%d split off)", len(stale), split
        )
    except Exception as e:
        db.rollback()
        logging.getLogger(__name__).warning("Group grade backfill skipped: %s", e)
    finally:
        db.close()


def _purge_last_school_year():
    """Beim ersten Start im neuen Schuljahr die Sitzungen der vergangenen
    Jahre loeschen. Siehe api/retention.py — wiederholbar, findet beim
    zweiten Lauf nichts mehr."""
    from .database import SessionLocal
    from .retention import purge_old_sessions, school_year_cutoff

    db = SessionLocal()
    try:
        geloescht = purge_old_sessions(db)
        if geloescht:
            db.commit()
            logging.getLogger(__name__).info(
                "Schuljahresbereinigung (vor %s): %s",
                school_year_cutoff().date(),
                ", ".join(f"{k}={v}" for k, v in sorted(geloescht.items())),
            )
    except Exception as e:
        db.rollback()
        logging.getLogger(__name__).warning("Schuljahresbereinigung uebersprungen: %s", e)
    finally:
        db.close()


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)
    _backfill_encrypted_passwords()
    _backfill_group_grades()
    _purge_last_school_year()
    ensure_classes()
    ensure_sportfest_disciplines()
    ensure_teacher_roles()
    ensure_wochenstunden()
    ensure_calendar_tags()
    _repair_calendar_tags()
    ensure_school_settings()
    asyncio.create_task(_inactivity_watchdog(get_db))
