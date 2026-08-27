"""Small shared helpers used across routers."""
import random
import re
import string

from sqlalchemy.orm import Session


def gen_code(db: Session, model, field: str = "code", length: int = 6) -> str:
    """Generate a join code for `model.field` that no tool is already using.

    Uniqueness is checked across every tool in the join-code registry, not just
    this one table: /play resolves a bare code to a session, so two tools
    sharing a code would make that lookup ambiguous.
    """
    # Lokal importiert, damit api.utils ein Blattmodul ohne DB-Engine bleibt.
    from .join_codes import code_taken

    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = "".join(random.choices(chars, k=length))
        if not db.query(model).filter_by(**{field: code}).first() and not code_taken(db, code):
            return code
    raise RuntimeError("Could not generate unique code")


def parse_grades(raw) -> list[int]:
    """
    Parse grade field from JSON into a sorted list of ints.
    Accepts: int, "7", "5,6,7", "5-10", [5,6,7].
    Values are clamped to 1–13.
    """
    if raw is None:
        return []
    if isinstance(raw, int):
        return [raw] if 1 <= raw <= 13 else []
    if isinstance(raw, list):
        return sorted({int(v) for v in raw if str(v).isdigit() and 1 <= int(v) <= 13})
    s = str(raw).strip()
    # Range: "5-10"
    range_m = re.fullmatch(r'(\d+)\s*[-–]\s*(\d+)', s)
    if range_m:
        lo, hi = int(range_m.group(1)), int(range_m.group(2))
        return [g for g in range(min(lo, hi), max(lo, hi) + 1) if 1 <= g <= 13]
    # Comma-separated: "5,6,7"
    parts = re.split(r'[,;\s]+', s)
    result = []
    for p in parts:
        if p.isdigit() and 1 <= int(p) <= 13:
            result.append(int(p))
    return sorted(set(result))


def grade_of_class_code(code: str | None) -> int | None:
    """Klassenstufe from a class code: "9a" -> 9, "10b" -> 10, "Vorkurs" -> None."""
    m = re.match(r"\s*(\d{1,2})", code or "")
    if not m:
        return None
    g = int(m.group(1))
    return g if 1 <= g <= 13 else None
