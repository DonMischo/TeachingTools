"""
Klassenbezeichnungen zum Schuljahreswechsel (1. August) weiterruecken.

Die Bezeichnung (»7a«) steht in Class.code und Student.klasse und wird sonst nur
beim CSV-Import erneuert. Der AK-Code (»AK2031a«, siehe api/schoolyear.py) aendert
sich nie — aus ihm ergibt sich zu jedem Datum die aktuelle Bezeichnung. So zeigt die
Oberflaeche ab dem Stichtag »8a«, auch wenn die neue Schuelerliste noch fehlt.

Angefasst wird nur, was nach Jahrgang+Buchstabe aussieht und zum AK-Code passt;
von Hand benannte Klassen (»Bili-7«) und Abgaenger jenseits von TOTAL_GRADES bleiben.
"""
import logging
from datetime import date

from sqlalchemy.orm import Session

from .models import Class, Student
from .schoolyear import _KLASSE_RE, TOTAL_GRADES, ak_code_to_klasse


def _aktuell(bezeichnung: str, ak_code: str | None, today: date | None) -> tuple[str, int] | None:
    """(neue Bezeichnung, Jahrgang), wenn `bezeichnung` per AK-Code weiterruecken soll."""
    if not ak_code:
        return None
    m = _KLASSE_RE.match(bezeichnung.strip())
    if not m:
        return None
    try:
        neu = ak_code_to_klasse(ak_code, today)
    except ValueError:
        return None
    n = _KLASSE_RE.match(neu)
    if not n or n.group(2).lower() != m.group(2).lower() or not 1 <= int(n.group(1)) <= TOTAL_GRADES:
        return None
    return (neu, int(n.group(1))) if neu != bezeichnung else None


def klassen_weiterruecken(db: Session, today: date | None = None) -> int:
    """Bringt Klassen- und Schuelerbezeichnungen auf den Stand von `today`.
    Idempotent. Gibt die Zahl der umbenannten Klassen zurueck."""
    klassen = db.query(Class).all()
    plan = {c.id: neu for c in klassen if (neu := _aktuell(c.code, c.ak_code, today))}

    # Ziel schon von einer Klasse belegt, die stehen bleibt? Dann bleibt auch diese
    # stehen — und kann ihrerseits eine andere blockieren, also bis nichts mehr faellt.
    while True:
        bleibt = {c.code for c in klassen if c.id not in plan}
        blockiert = [cid for cid, (code, _) in plan.items() if code in bleibt]
        if not blockiert:
            break
        for cid in blockiert:
            logging.getLogger(__name__).warning("Klasse %s nicht weitergerueckt: %s ist belegt", cid, plan.pop(cid)[0])

    alt: dict[int, str] = {}
    # code ist unique: erst alle auf einen Platzhalter, dann auf das Ziel (7a->8a, 8a->9a ...)
    for c in klassen:
        if c.id in plan:
            alt[c.id] = c.code
            c.code = f"~{c.id}"
    db.flush()
    for c in klassen:
        if c.id in plan:
            c.code = plan[c.id][0]
            c.display_name = f"Klasse {c.code}"

    for s in db.query(Student).all():
        if neu := _aktuell(s.klasse, s.ak_code, today):
            s.klasse, s.jahrgang = neu
        elif not s.ak_code and s.class_id in plan and s.klasse == alt[s.class_id]:
            s.klasse, s.jahrgang = plan[s.class_id]
    db.commit()
    return len(plan)
