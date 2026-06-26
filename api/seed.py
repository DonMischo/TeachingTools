from .database import SessionLocal
from .models import Class

CLASS_CODES = [f"{grade}{section}" for grade in range(5, 11) for section in ("a", "b", "c")]


def ensure_classes():
    db = SessionLocal()
    try:
        for code in CLASS_CODES:
            exists = db.query(Class).filter(Class.code == code).first()
            if not exists:
                db.add(Class(code=code, display_name=f"Klasse {code}"))
        db.commit()
    finally:
        db.close()
