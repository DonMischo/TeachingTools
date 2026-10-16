"""
Kalender — school-year calendar (single dates + date spans).

category = single-select AUDIENCE tier (Kollegium/Primar/Sekundar/
Schulgemeinschaft/Ferien/Persönlich) that drives who can see the entry —
students see 'Schulgemeinschaft' and 'Ferien' plus the Stufe tier matching
their grade ('Primar' for grades 1–4, 'Sekundar' from grade 5 up), and
'Persönlich' entries are visible only to their own creator (private notes,
not shared with other teachers).
tags = free-form, colorable, multi-select descriptive labels (Dienstberatung,
Wandertag, …), managed via CalendarTag; teachers/admin can create new ones.

ICS import/export is hand-rolled (RFC 5545 subset: SUMMARY/DTSTART/DTEND/
DESCRIPTION/CATEGORIES/COLOR, all-day VALUE=DATE events, one VEVENT per
line-block) rather than pulling in a dependency — recurring events /
VTIMEZONE are not supported, which covers typical single-event exports from
Google/Outlook but not recurring series.

Feriendaten (school holidays) are pulled from the free OpenHolidaysAPI
(https://openholidaysapi.org, no key required) for the school's configured
Bundesland (SchoolSettings.bundesland) and imported as category='Ferien'
entries tagged 'Ferien'.
"""
import re
import uuid
from datetime import date, datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CalendarEntry, CalendarTag, SchoolSettings, Student, Teacher
from ..schemas import (
    CalendarEntryIn, CalendarEntryOut, CalendarTagIn, CalendarTagOut,
    SchoolSettingsIn, SchoolSettingsOut,
)
from ..auth import get_current_teacher, get_current_user
from ..admin_access import require_admin_feature
from ..schoolyear import get_school_year_start
from .students import _extract_jahrgang

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

CATEGORIES = ["Kollegium", "Primar", "Sekundar", "Schulgemeinschaft", "Ferien", "Persönlich"]
STUDENT_VISIBLE_CATEGORIES = {"Schulgemeinschaft", "Ferien"}
PRIMAR_MAX_GRADE = 4  # grades 1-4 = Primarstufe, grade 5 and up = Sekundarstufe
BUNDESLAENDER = {
    "BW": "Baden-Württemberg", "BY": "Bayern", "BE": "Berlin", "BB": "Brandenburg",
    "HB": "Bremen", "HH": "Hamburg", "HE": "Hessen", "MV": "Mecklenburg-Vorpommern",
    "NI": "Niedersachsen", "NW": "Nordrhein-Westfalen", "RP": "Rheinland-Pfalz",
    "SL": "Saarland", "SN": "Sachsen", "ST": "Sachsen-Anhalt", "SH": "Schleswig-Holstein",
    "TH": "Thüringen",
}


def _stufe_category(s: Student) -> str | None:
    """The audience tier ('Primar'/'Sekundar') a student's grade puts them in,
    or None when the grade is unknown (jahrgang unset and `klasse` unparsable)."""
    grade = s.jahrgang if s.jahrgang is not None else _extract_jahrgang(s.klasse or "")
    if grade is None:
        return None
    return "Primar" if grade <= PRIMAR_MAX_GRADE else "Sekundar"


def _out(e: CalendarEntry) -> CalendarEntryOut:
    return CalendarEntryOut(
        id=e.id, title=e.title, description=e.description, category=e.category,
        start_date=e.start_date, end_date=e.end_date,
        all_day=e.all_day, start_time=e.start_time, end_time=e.end_time,
        tags=e.tags or [],
        created_by=e.created_by, creator_name=f"{e.creator.first_name} {e.creator.last_name}",
    )


@router.get("/meta")
def get_meta(db: Session = Depends(get_db)):
    tags = db.query(CalendarTag).order_by(CalendarTag.name).all()
    return {
        "categories": CATEGORIES,
        "tags": [{"name": t.name, "color": t.color} for t in tags],
        "bundeslaender": BUNDESLAENDER,
    }


@router.get("", response_model=list[CalendarEntryOut])
def list_entries(
    from_: date | None = None,
    to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    q = db.query(CalendarEntry)
    if from_ is not None:
        q = q.filter(CalendarEntry.end_date >= from_)
    if to is not None:
        q = q.filter(CalendarEntry.start_date <= to)
    entries = q.order_by(CalendarEntry.start_date).all()
    # Students (and any non-Teacher account) only see the Schulgemeinschaft/
    # Ferien audience tiers, plus the Stufe tier their grade puts them in — no
    # other entry's title/description reaches the browser. Filtered in Python
    # (list is small; keeps SQLite/Postgres parity).
    if not isinstance(current, Teacher):
        visible = STUDENT_VISIBLE_CATEGORIES | {_stufe_category(current)}
        entries = [e for e in entries if e.category in visible]
    else:
        # "Persönlich" entries are private to their creator, even from other teachers.
        entries = [e for e in entries if e.category != "Persönlich" or e.created_by == current.id]
    return [_out(e) for e in entries]


def _validate(body: CalendarEntryIn):
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Unbekannte Kategorie. Erlaubt: {', '.join(CATEGORIES)}")
    if body.end_date < body.start_date:
        raise HTTPException(400, "Enddatum darf nicht vor dem Startdatum liegen")
    if not body.all_day and body.start_date == body.end_date:
        if not body.start_time or not body.end_time:
            raise HTTPException(400, "Start- und Endzeit erforderlich für zeitgebundene Termine")


@router.post("", response_model=CalendarEntryOut, status_code=201)
def create_entry(
    body: CalendarEntryIn,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    _validate(body)
    e = CalendarEntry(
        title=body.title.strip(), description=body.description, category=body.category,
        start_date=body.start_date, end_date=body.end_date,
        all_day=body.all_day, start_time=body.start_time if not body.all_day else None,
        end_time=body.end_time if not body.all_day else None,
        tags=body.tags, created_by=current.id,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _out(e)


# ---------------------------------------------------------------------------
# Tags (colorable, custom-creatable) — static paths, must be registered
# before the /{entry_id} routes below or Starlette matches "/tags"/"/settings"
# etc. as an entry_id path param instead.
# ---------------------------------------------------------------------------

@router.get("/tags", response_model=list[CalendarTagOut])
def list_tags(db: Session = Depends(get_db), current=Depends(get_current_user)):
    return db.query(CalendarTag).order_by(CalendarTag.name).all()


@router.post("/tags", response_model=CalendarTagOut, status_code=201)
def create_tag(
    body: CalendarTagIn,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name fehlt")
    existing = db.query(CalendarTag).filter_by(name=name).first()
    if existing:
        existing.color = body.color
        db.commit()
        db.refresh(existing)
        return existing
    t = CalendarTag(name=name, color=body.color)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# ---------------------------------------------------------------------------
# School settings (Bundesland) + Feriendaten pull
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=SchoolSettingsOut)
def get_settings(db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.get(SchoolSettings, 1)
    if not s:
        s = SchoolSettings(id=1, bundesland="TH")
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.put("/settings", response_model=SchoolSettingsOut)
def set_settings(body: SchoolSettingsIn, db: Session = Depends(get_db), _: object = Depends(require_admin_feature("calendar_settings"))):
    if body.bundesland not in BUNDESLAENDER:
        raise HTTPException(400, f"Unbekanntes Bundesland. Erlaubt: {', '.join(BUNDESLAENDER)}")
    s = db.get(SchoolSettings, 1)
    if not s:
        s = SchoolSettings(id=1)
        db.add(s)
    s.bundesland = body.bundesland
    db.commit()
    db.refresh(s)
    return s


@router.post("/holidays/fetch")
def fetch_holidays(
    school_year_start: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(require_admin_feature("calendar_settings")),
):
    """Pull Feriendaten for the configured Bundesland from OpenHolidaysAPI and
    import them as category='Ferien' entries (deduped by title+dates)."""
    settings = db.get(SchoolSettings, 1)
    bundesland = settings.bundesland if settings else "TH"

    valid_from = f"{school_year_start}-08-01"
    valid_to = f"{school_year_start + 1}-07-31"
    try:
        resp = httpx.get(
            "https://openholidaysapi.org/SchoolHolidays",
            params={
                "countryIsoCode": "DE", "languageIsoCode": "DE",
                "validFrom": valid_from, "validTo": valid_to,
                "subdivisionCode": f"DE-{bundesland}",
            },
            timeout=10,
        )
        resp.raise_for_status()
        holidays = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Feriendaten konnten nicht geladen werden: {exc}")

    ferien_tag = db.query(CalendarTag).filter_by(name="Ferien").first()
    if not ferien_tag:
        ferien_tag = CalendarTag(name="Ferien", color="#16a34a")
        db.add(ferien_tag)
        db.flush()

    created = 0
    for h in holidays:
        title = next((n["text"] for n in h.get("name", []) if n.get("language") == "DE"), None) \
            or (h.get("name") or [{}])[0].get("text", "Ferien")
        start = date.fromisoformat(h["startDate"])
        end = date.fromisoformat(h["endDate"])
        exists = db.query(CalendarEntry).filter_by(
            title=title, start_date=start, end_date=end, category="Ferien",
        ).first()
        if exists:
            continue
        db.add(CalendarEntry(
            title=title, category="Ferien", start_date=start, end_date=end,
            all_day=True, tags=["Ferien"], created_by=current.id,
        ))
        created += 1
    db.commit()
    return {"created": created, "bundesland": bundesland}


# ---------------------------------------------------------------------------
# ICS export/import (teacher/admin only — the calendar's planning surface)
# ---------------------------------------------------------------------------

def _ics_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _ics_fold(line: str) -> str:
    """RFC 5545 line folding at 75 octets, continuation lines start with a space."""
    if len(line) <= 75:
        return line
    parts = [line[:75]]
    rest = line[75:]
    while rest:
        parts.append(" " + rest[:74])
        rest = rest[74:]
    return "\r\n".join(parts)


def _school_year_window(db: Session, today: date) -> tuple[date, date | None, int]:
    """Return (opens, closes, start_year) for the school year that `today` falls
    in, bounded by 'Sommerferien' entries.

    The school year flips the moment a Sommerferien begins: `opens` is the start
    of the most recent Sommerferien on/before `today`, `closes` is the start of
    the next Sommerferien after `today` (None if unknown, i.e. open-ended). When
    no Sommerferien data is present, falls back to the 1. August Stichtag.
    """
    starts = [
        r.start_date
        for r in db.query(CalendarEntry)
        .filter(
            CalendarEntry.category == "Ferien",
            CalendarEntry.title.ilike("%sommerferien%"),
        )
        .order_by(CalendarEntry.start_date)
        .all()
    ]
    opens = max((d for d in starts if d <= today), default=None)
    closes = min((d for d in starts if d > today), default=None)
    if opens is None:
        # No Sommerferien on/before today (unseeded, or before the first one):
        # fall back to the 1. August Stichtag for the lower bound.
        opens = date(get_school_year_start(today), 8, 1)
    return opens, closes, opens.year


@router.get("/export.ics")
def export_ics(
    tags: list[str] = Query(default=[]),
    categories: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Export entries as .ics, optionally filtered by tags and/or categories, one
    query parameter per value (?tags=A&tags=B) since tags may contain commas
    (empty = no filter on that dimension)."""
    wanted_tags = {t.strip() for t in tags if t.strip()}
    wanted_cats = {c.strip() for c in categories if c.strip()}
    entries = db.query(CalendarEntry).order_by(CalendarEntry.start_date).all()
    if wanted_tags:
        entries = [e for e in entries if wanted_tags & set(e.tags or [])]
    if wanted_cats:
        entries = [e for e in entries if e.category in wanted_cats]

    # Gate to the current school year: Sommerferien -> next Sommerferien. Once
    # the end-of-year Sommerferien begins, the window (and calendar name) flip
    # to the next school year, so the client downloads that year's file.
    opens, closes, start_year = _school_year_window(db, date.today())
    entries = [
        e for e in entries
        if e.end_date >= opens and (closes is None or e.start_date < closes)
    ]

    tag_colors = {t.name: t.color for t in db.query(CalendarTag).all()}

    cal_name = f"EGE{start_year}/{start_year + 1}"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TT - Teaching Tools//Kalender//DE",
        "METHOD:PUBLISH",
        # Calendar name: X-WR-CALNAME is the de-facto standard honored by Apple
        # and Google; NAME is the RFC 7986 equivalent. Clients that support it
        # will import into / create a distinct calendar rather than the default.
        _ics_fold(f"X-WR-CALNAME:{_ics_escape(cal_name)}"),
        _ics_fold(f"NAME:{_ics_escape(cal_name)}"),
        _ics_fold(f"X-WR-CALDESC:{_ics_escape('Termine aus dem TT-Kalender')}"),
        # Hint for subscription clients on how often to re-fetch.
        "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
        "X-PUBLISHED-TTL:PT12H",
    ]
    for e in entries:
        # All-day event: DTEND is exclusive per RFC 5545, so +1 day on a single date too.
        dtend_exclusive = date.fromordinal(e.end_date.toordinal() + 1)
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{e.id}-{uuid.uuid5(uuid.NAMESPACE_DNS, str(e.id))}@hauspokal")
        lines.append(f"DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}")
        if e.all_day:
            lines.append(f"DTSTART;VALUE=DATE:{e.start_date.strftime('%Y%m%d')}")
            lines.append(f"DTEND;VALUE=DATE:{dtend_exclusive.strftime('%Y%m%d')}")
        else:
            st = (e.start_time or "00:00").replace(":", "")
            en = (e.end_time or "23:59").replace(":", "")
            lines.append(f"DTSTART:{e.start_date.strftime('%Y%m%d')}T{st}00")
            lines.append(f"DTEND:{e.end_date.strftime('%Y%m%d')}T{en}00")
        lines.append(_ics_fold(f"SUMMARY:{_ics_escape(e.title)}"))
        if e.description:
            lines.append(_ics_fold(f"DESCRIPTION:{_ics_escape(e.description)}"))
        if e.tags:
            lines.append(_ics_fold("CATEGORIES:" + ",".join(_ics_escape(t) for t in e.tags)))
            # Best-effort color hint (RFC 7986 COLOR; not universally supported,
            # but harmless for clients that ignore unknown properties).
            first_color = next((tag_colors[t] for t in e.tags if t in tag_colors), None)
            if first_color:
                lines.append(f"COLOR:{first_color}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")

    body = "\r\n".join(lines) + "\r\n"
    return Response(
        content=body, media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="kalender.ics"'},
    )


def _unfold(raw: str) -> list[str]:
    """Reverse RFC 5545 line folding (continuation lines start with space/tab)."""
    lines: list[str] = []
    for line in raw.replace("\r\n", "\n").split("\n"):
        if line.startswith((" ", "\t")) and lines:
            lines[-1] += line[1:]
        elif line:
            lines.append(line)
    return lines


_ICS_ESCAPE = re.compile(r"\\(.)")


def _ics_unescape(text: str) -> str:
    """RFC 5545 TEXT in one pass: chained replace() would read the escaped
    backslash in "C:\\\\neu" as the start of a line break."""
    return _ICS_ESCAPE.sub(lambda m: "\n" if m.group(1) in "nN" else m.group(1), text)


def _ics_list(value: str) -> list[str]:
    r"""CATEGORIES split at commas, but not at escaped ones (\,). Splitting on every
    comma turned "Sport\, Spiel" into "Sport\" and " Spiel"."""
    items, current, i = [], "", 0
    while i < len(value):
        if value[i] == "\\" and i + 1 < len(value):
            current += value[i:i + 2]  # keep escaped, _ics_unescape resolves it
            i += 2
            continue
        if value[i] == ",":
            items.append(current)
            current = ""
        else:
            current += value[i]
        i += 1
    items.append(current)
    return [t for t in (_ics_unescape(x).strip() for x in items) if t]


def _parse_ics_date(value: str) -> date:
    value = value.split("T")[0]  # drop time component if present (treat as all-day)
    return datetime.strptime(value, "%Y%m%d").date()


@router.post("/import.ics")
def import_ics(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Imported events default to category='Kollegium' (the most restrictive
    tier) since the source calendar's intended audience is unknown — editable
    afterward from the Kalender UI."""
    raw = file.file.read().decode("utf-8", errors="replace")
    lines = _unfold(raw)

    created = 0
    errors: list[str] = []
    current_event: dict | None = None

    for line in lines:
        if line == "BEGIN:VEVENT":
            current_event = {}
            continue
        if line == "END:VEVENT":
            if current_event is not None:
                try:
                    if "DTSTART" not in current_event:
                        raise ValueError("Kein DTSTART")
                    start = _parse_ics_date(current_event["DTSTART"])
                    end = _parse_ics_date(current_event["DTEND"]) if "DTEND" in current_event else start
                    if end > start:
                        end = date.fromordinal(end.toordinal() - 1)  # DTEND is exclusive
                    db.add(CalendarEntry(
                        title=_ics_unescape(current_event.get("SUMMARY", "Ohne Titel")),
                        description=_ics_unescape(current_event["DESCRIPTION"]) if "DESCRIPTION" in current_event else None,
                        category="Kollegium",
                        start_date=start, end_date=end, all_day=True,
                        tags=_ics_list(current_event.get("CATEGORIES", "")),
                        created_by=current.id,
                    ))
                    created += 1
                except Exception as exc:
                    errors.append(str(exc))
            current_event = None
            continue
        if current_event is None:
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.split(";")[0]  # drop parameters like ;VALUE=DATE
        current_event[key] = value

    db.commit()
    return {"created": created, "errors": errors}


# ---------------------------------------------------------------------------
# Single-entry update/delete — registered LAST: /{entry_id} is a catch-all
# for its methods (PUT/DELETE) and must not shadow the static paths above
# (/tags, /settings, /holidays/fetch, /export.ics, /import.ics).
# ---------------------------------------------------------------------------

@router.put("/{entry_id}", response_model=CalendarEntryOut)
def update_entry(
    entry_id: int,
    body: CalendarEntryIn,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    e = db.get(CalendarEntry, entry_id)
    if not e:
        raise HTTPException(404, "Eintrag nicht gefunden")
    _validate(body)
    e.title = body.title.strip()
    e.description = body.description
    e.category = body.category
    e.start_date = body.start_date
    e.end_date = body.end_date
    e.all_day = body.all_day
    e.start_time = body.start_time if not body.all_day else None
    e.end_time = body.end_time if not body.all_day else None
    e.tags = body.tags
    db.commit()
    db.refresh(e)
    return _out(e)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    e = db.get(CalendarEntry, entry_id)
    if not e:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if e.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    db.delete(e)
    db.commit()
