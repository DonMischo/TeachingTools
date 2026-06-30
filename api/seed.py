from pathlib import Path
from .database import SessionLocal
from .models import Class, SportfestDiscipline

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
