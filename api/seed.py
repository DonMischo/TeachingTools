from pathlib import Path
from .database import SessionLocal
from .models import Class, SportfestDiscipline, TeacherRole, SubjectWochenstunden, CalendarTag, SchoolSettings

CLASS_CODES = [f"{grade}{section}" for grade in range(5, 11) for section in ("a", "b", "c")]
GFX_DIR = Path(__file__).parent.parent / "data" / "gfx"

_SF_DISCIPLINES = [
    ("sprint",       "Sprint"),
    ("ausdauerlauf", "Ausdauerlauf"),
    ("weitsprung",   "Weitsprung"),
    ("ballwurf",     "Ballwurf"),
]


def ensure_classes():
    db = SessionLocal()
    try:
        for code in CLASS_CODES:
            cls = db.query(Class).filter(Class.code == code).first()
            if not cls:
                # Set symbol_image from pre-existing gfx file if present
                img_path = GFX_DIR / f"{code}.png"
                symbol_image = f"/uploads/gfx/{code}.png" if img_path.exists() else None
                db.add(Class(code=code, display_name=f"Klasse {code}", symbol_image=symbol_image))
            elif cls.symbol_image is None and cls.symbol_emoji is None:
                # Backfill existing rows that have no icon yet
                img_path = GFX_DIR / f"{code}.png"
                if img_path.exists():
                    cls.symbol_image = f"/uploads/gfx/{code}.png"
        db.commit()
    finally:
        db.close()


def ensure_sportfest_disciplines():
    db = SessionLocal()
    try:
        for disc_id, name in _SF_DISCIPLINES:
            if not db.get(SportfestDiscipline, disc_id):
                db.add(SportfestDiscipline(id=disc_id, name=name, enabled=True))
        db.commit()
    finally:
        db.close()


_TEACHER_ROLES = [
    ("Lehrer", True),
    ("SPF", False),
]


def ensure_teacher_roles():
    db = SessionLocal()
    try:
        for name, counts_as_teacher in _TEACHER_ROLES:
            if not db.query(TeacherRole).filter_by(name=name).first():
                db.add(TeacherRole(name=name, counts_as_teacher=counts_as_teacher))
        db.commit()
    finally:
        db.close()


# Default weekly hours (Wochenstunden) per subject — editable afterward.
# Hauptfächer 4, Nebenfächer 1, Religion 2, Sport 2, Wahlpflicht 3.
SUBJECTS = ["Ma", "De", "En", "Bio", "Ph", "Ch", "Ge", "Geo", "Sp", "Mu", "Ku", "Inf", "WAT", "LER", "Re", "Wahlpflicht"]
_HAUPTFAECHER = {"Ma", "De", "En"}
_DEFAULT_HOURS = {"Re": 2, "Sp": 2, "Wahlpflicht": 3}
GRADES = list(range(5, 11))


def _default_hours(subject: str) -> int:
    if subject in _HAUPTFAECHER:
        return 4
    return _DEFAULT_HOURS.get(subject, 1)  # Nebenfächer default


def ensure_wochenstunden():
    db = SessionLocal()
    try:
        for subject in SUBJECTS:
            for grade in GRADES:
                if not db.query(SubjectWochenstunden).filter_by(subject=subject, grade=grade).first():
                    db.add(SubjectWochenstunden(subject=subject, grade=grade, hours=_default_hours(subject)))
        db.commit()
    finally:
        db.close()


# Default calendar tags (formerly the fixed "category" list) — teachers/admin
# can add more with their own color from the Kalender UI.
_DEFAULT_CALENDAR_TAGS = [
    ("Events", "#3b82f6"),
    ("Dienstberatung", "#8b5cf6"),
    ("Klassenfahrt", "#22c55e"),
    ("Wandertag", "#f97316"),
    ("Wichtig", "#ef4444"),
    ("Ferien", "#16a34a"),
]


def ensure_calendar_tags():
    db = SessionLocal()
    try:
        for name, color in _DEFAULT_CALENDAR_TAGS:
            if not db.query(CalendarTag).filter_by(name=name).first():
                db.add(CalendarTag(name=name, color=color))
        db.commit()
    finally:
        db.close()


def ensure_school_settings():
    db = SessionLocal()
    try:
        if not db.get(SchoolSettings, 1):
            db.add(SchoolSettings(id=1, bundesland="TH"))
            db.commit()
    finally:
        db.close()
