"""
School-year math for deriving stable "Abschlussklasse" (AK) codes from
grade-based class labels like "7a", so a class keeps a stable identity
across the yearly grade bump (Stichtag: 1. August -> new school year).

AK-code format: AK<abschlussjahr><letter>, where abschlussjahr is the START
year of the school year in which the class reaches grade TOTAL_GRADES:
"7a" in school year 2025/2026 -> grade 13 in 2031/2032 -> "AK2031a".
"""
import re
from datetime import date

TOTAL_GRADES = 13

_KLASSE_RE = re.compile(r"^(\d{1,2})\s*([a-zA-ZäöüÄÖÜ]*)$")
_AK_RE = re.compile(r"^AK(\d{4})([a-zA-Z0-9]*)$", re.IGNORECASE)


def get_school_year_start(today: date | None = None) -> int:
    """Return the start year of the current school year (Stichtag 1. August)."""
    today = today or date.today()
    return today.year if today.month >= 8 else today.year - 1


def get_school_year_label(today: date | None = None) -> str:
    """Return the current school year as 'YYYY/YYYY'."""
    start = get_school_year_start(today)
    return f"{start}/{start + 1}"


def klasse_to_ak_code(klasse: str, today: date | None = None) -> str:
    """Convert a grade-based class label ('7a') to a stable AK-code ('AK2029a')."""
    m = _KLASSE_RE.match(klasse.strip())
    if not m:
        raise ValueError(f"Ungültiges Klassenformat: {klasse!r}")
    grade = int(m.group(1))
    letter = m.group(2).lower()
    start = get_school_year_start(today)
    abschlussjahr = start + (TOTAL_GRADES - grade)
    return f"AK{abschlussjahr}{letter}"


def ak_code_to_klasse(ak_code: str, today: date | None = None) -> str:
    """Convert a stable AK-code ('AK2029a') back to the current grade-based label ('7a')."""
    m = _AK_RE.match(ak_code.strip())
    if not m:
        raise ValueError(f"Ungültiger AK-Code: {ak_code!r}")
    abschlussjahr = int(m.group(1))
    letter = m.group(2)
    start = get_school_year_start(today)
    grade = TOTAL_GRADES - (abschlussjahr - start)
    return f"{grade}{letter}"
