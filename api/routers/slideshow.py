"""
Startseiten-Slideshow — kiosk-style rotation shown on the school's front
display: uploaded files (image/pdf/video), external links, a calendar-tag
feed, the current Wochenspruch (fetched from wochenspruch.pfarr.tools, data by
kirchenjahr-evangelisch.de), Hauspunkte and a clock. Hauspunkte, Termine
(calendar), Wochenspruch and the clock are built-in rows that always exist once
and can only be deactivated; the clock starts at 3 seconds and, unlike the
others, ignores its list position — the display shows it after every two other
slides (see lib/slideshow.ts), because a screen in a hallway is looked at for
the time first. A time slot pins an item while it is active; outside the slot
the item rotates like any other. `/public` serves the rotation filtered
by viewer audience level; the rest are admin-feature-gated management
endpoints (create/patch/reorder/delete/upload) plus a pure `compute_warnings`
helper that flags broken/overlapping items for the admin UI.
"""
import logging
import re
import time
import uuid
from datetime import date
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CalendarEntry, CalendarTag, SlideshowItem, Student, Teacher
from ..schemas import (
    SlideshowBulkPatchIn, SlideshowDeleteIn, SlideshowEventOut, SlideshowItemIn, SlideshowItemOut,
    SlideshowItemPatch, SlideshowOrderIn, SlideshowWochenspruchOut,
)
from ..auth import get_current_user_optional
from ..admin_access import require_admin_feature
from .calendar import CATEGORIES, STUDENT_VISIBLE_CATEGORIES, _stufe_category

router = APIRouter(prefix="/api/slideshow", tags=["slideshow"])

SLIDESHOW_DIR = Path(__file__).parent.parent.parent / "data" / "slideshow"
SLIDESHOW_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 100 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image",
    ".pdf": "pdf",
    ".mp4": "video", ".webm": "video",
}
AUDIENCE_LEVELS = {"guest": 0, "student": 1, "teacher": 2}
# kind -> default title; created on demand, never deletable
BUILTIN_KINDS = {
    "hauspunkte": "Hauspunkte", "calendar": "Termine",
    "wochenspruch": "Wochenspruch", "clock": "Uhr",
}
# Abweichende Standdauer beim Anlegen. Die Uhr steht kurz: sie kommt oft dran
# und hat nichts zu lesen ausser Uhrzeit, Datum und A/B-Woche.
BUILTIN_SECONDS = {"clock": 3}
# categories the Termine slide may filter on — private entries never reach the display
SLIDE_CATEGORIES = [c for c in CATEGORIES if c != "Persönlich"]
WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

WOCHENSPRUCH_API = "https://wochenspruch.pfarr.tools/api/kirchenjahr/woche/{day}"
WOCHENSPRUCH_TTL_SECONDS = 6 * 3600
WOCHENSPRUCH_RETRY_SECONDS = 10 * 60  # after a failed fetch, don't block every poll on a timeout
# "value": (day, fetched_at, SlideshowWochenspruchOut) of the last good fetch; "failed_at": monotonic time
_WOCHENSPRUCH_CACHE: dict = {}

log = logging.getLogger(__name__)


def _load_wochenspruch(day: date) -> list[dict]:
    resp = httpx.get(WOCHENSPRUCH_API.format(day=day.isoformat()), timeout=5)
    resp.raise_for_status()
    return resp.json()


def _map_wochenspruch(e: dict) -> SlideshowWochenspruchOut:
    return SlideshowWochenspruchOut(
        sunday=e["Titel"], season=e.get("Festzeit"), date_label=e.get("Datum formatiert"),
        text=e["Wochenspruch-Text"], reference=e.get("Wochenspruch"), psalm=e.get("Wochenpsalm"),
        color=e.get("Farbcode"), color_name=e.get("liturgische Farbe"),
        background_url=e.get("Hintergrundbild"), image_credit=e.get("Bildquelle"),
        hymns=[h for h in (e.get("Wochenlieder") or []) if isinstance(h, str)],
        source_url=e.get("Url"),
    )


def _get_wochenspruch(today: date) -> SlideshowWochenspruchOut | None:
    """Current week's Wochenspruch, cached per day. On an outage the last good
    value is kept (None if there never was one)."""
    now = time.monotonic()
    cached = _WOCHENSPRUCH_CACHE.get("value")
    stale = cached[2] if cached else None
    if cached and cached[0] == today and now - cached[1] < WOCHENSPRUCH_TTL_SECONDS:
        return stale
    failed_at = _WOCHENSPRUCH_CACHE.get("failed_at")
    if failed_at is not None and now - failed_at < WOCHENSPRUCH_RETRY_SECONDS:
        return stale
    try:
        # Christnacht/Christvesper share a date — the Wochenspruch is the same, take the first
        value = _map_wochenspruch(_load_wochenspruch(today)[0])
    except Exception as exc:  # network, HTTP status, or unexpected payload shape
        log.warning("Wochenspruch nicht abrufbar: %s", exc)
        _WOCHENSPRUCH_CACHE["failed_at"] = now
        return stale
    _WOCHENSPRUCH_CACHE["value"] = (today, now, value)
    _WOCHENSPRUCH_CACHE.pop("failed_at", None)
    return value


def _next_position(db: Session) -> int:
    max_row = db.query(SlideshowItem.position).order_by(SlideshowItem.position.desc()).first()
    return (max_row[0] + 1) if max_row else 0


def _ensure_builtins(db: Session) -> None:
    existing = {k for (k,) in db.query(SlideshowItem.kind).filter(SlideshowItem.kind.in_(BUILTIN_KINDS)).distinct()}
    missing = [k for k in BUILTIN_KINDS if k not in existing]
    for kind in missing:
        row = SlideshowItem(position=0 if kind == "hauspunkte" else _next_position(db),
                            kind=kind, title=BUILTIN_KINDS[kind], active=True, audience="guest")
        if kind in BUILTIN_SECONDS:
            row.duration_seconds = BUILTIN_SECONDS[kind]
        db.add(row)
        db.flush()
    if missing:
        db.commit()


def _viewer_level(user) -> str:
    if user is None:
        return "guest"
    if isinstance(user, Teacher):
        return "teacher"
    return "student"


def _visible_categories(user) -> set[str] | None:
    """None means 'all categories except Persönlich' (teacher)."""
    if user is None or not isinstance(user, Teacher):
        if isinstance(user, Student):
            return STUDENT_VISIBLE_CATEGORIES | {_stufe_category(user)}
        return {"Schulgemeinschaft", "Ferien"}
    return None


def _matching_entries(db: Session, item: SlideshowItem, today: date) -> list[CalendarEntry]:
    """Upcoming entries matching the item's filters (tags: any of; categories: one of;
    an empty filter doesn't restrict). Never 'Persönlich'. Viewer visibility is applied
    by the caller."""
    until = today.fromordinal(today.toordinal() + item.calendar_days_ahead)
    entries = db.query(CalendarEntry).filter(
        CalendarEntry.end_date >= today,
        CalendarEntry.start_date <= until,
        CalendarEntry.category != "Persönlich",
    ).order_by(CalendarEntry.start_date).all()
    tags = set(item.calendar_tags or [])
    categories = set(item.calendar_categories or [])
    return [
        e for e in entries
        if (not tags or tags & set(e.tags or [])) and (not categories or e.category in categories)
    ]


def _event_out(e: CalendarEntry) -> SlideshowEventOut:
    return SlideshowEventOut(title=e.title, start_date=e.start_date, end_date=e.end_date,
                             all_day=e.all_day, start_time=e.start_time, end_time=e.end_time,
                             tags=e.tags or [], category=e.category)


def _events_for(db: Session, item: SlideshowItem, user, today: date) -> list[SlideshowEventOut]:
    if item.kind != "calendar":
        return []
    visible = _visible_categories(user)
    entries = [e for e in _matching_entries(db, item, today) if visible is None or e.category in visible]
    return [_event_out(e) for e in entries[:10]]


def _out(item: SlideshowItem, warnings: list[str] | None = None,
         events: list[SlideshowEventOut] | None = None,
         wochenspruch: SlideshowWochenspruchOut | None = None) -> SlideshowItemOut:
    file_url = f"/uploads/slideshow/{item.stored_filename}" if item.stored_filename else None
    return SlideshowItemOut(
        id=item.id, position=item.position, kind=item.kind, title=item.title,
        active=item.active, audience=item.audience, duration_seconds=item.duration_seconds,
        media_type=item.media_type, file_url=file_url,
        original_filename=item.original_filename, url=item.url,
        calendar_tags=item.calendar_tags or [], calendar_categories=item.calendar_categories or [],
        calendar_days_ahead=item.calendar_days_ahead,
        slot_days=item.slot_days or [], slot_start=item.slot_start, slot_end=item.slot_end,
        slot_from=item.slot_from, slot_until=item.slot_until,
        warnings=warnings or [], events=events or [], wochenspruch=wochenspruch,
    )


# ---------------------------------------------------------------------------
# Warnings (pure)
# ---------------------------------------------------------------------------

def compute_warnings(items: list[SlideshowItem], today: date, file_exists) -> dict[int, list[str]]:
    result: dict[int, list[str]] = {item.id: [] for item in items}

    for item in items:
        w = result[item.id]
        slot_days = item.slot_days or []
        if slot_days and (not item.slot_start or not item.slot_end):
            w.append("Zeitfenster unvollständig")
        if item.slot_start and item.slot_end and item.slot_start >= item.slot_end:
            w.append("Zeitfenster: Ende liegt vor dem Beginn")
        if item.slot_from and item.slot_until and item.slot_until < item.slot_from:
            w.append("Zeitraum: Enddatum vor Startdatum")
        if item.slot_until and item.slot_until < today:
            w.append(f"Abgelaufen (Zeitfenster endete am {item.slot_until.strftime('%d.%m.%Y')})")
        if item.kind == "file" and (not item.stored_filename or not file_exists(item.stored_filename)):
            w.append("Datei fehlt")
        if item.kind == "link" and item.url and not (item.url.startswith("http://") or item.url.startswith("https://")):
            w.append("Ungültiger Link")

    # Overlap detection
    def _has_complete_slot(it: SlideshowItem) -> bool:
        return bool(it.slot_days) and bool(it.slot_start) and bool(it.slot_end) and it.slot_start < it.slot_end

    active_with_slot = [it for it in items if it.active and _has_complete_slot(it)]
    for i, a in enumerate(active_with_slot):
        for b in active_with_slot[i + 1:]:
            shared_days = [d for d in a.slot_days if d in (b.slot_days or [])]
            if not shared_days:
                continue
            if not (a.slot_start < b.slot_end and b.slot_start < a.slot_end):
                continue
            a_from, a_until = a.slot_from, a.slot_until
            b_from, b_until = b.slot_from, b.slot_until
            if a_until is not None and b_from is not None and a_until < b_from:
                continue
            if b_until is not None and a_from is not None and b_until < a_from:
                continue
            weekday_label = WEEKDAY_LABELS[min(shared_days)]
            overlap_start = max(a.slot_start, b.slot_start)
            overlap_end = min(a.slot_end, b.slot_end)
            result[a.id].append(f"Überschneidet sich mit „{b.title}“ ({weekday_label} {overlap_start}–{overlap_end})")
            result[b.id].append(f"Überschneidet sich mit „{a.title}“ ({weekday_label} {overlap_start}–{overlap_end})")

    return result


def _compute_warnings_with_db(db: Session, items: list[SlideshowItem]) -> dict[int, list[str]]:
    today = date.today()
    warnings = compute_warnings(items, today, lambda fn: (SLIDESHOW_DIR / fn).exists())
    for item in items:
        if item.kind == "calendar" and not _matching_entries(db, item, today):
            warnings[item.id].append("Keine anstehenden Termine")
        if item.kind == "wochenspruch" and _get_wochenspruch(today) is None:
            warnings[item.id].append("Wochenspruch nicht abrufbar")
    return warnings


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

@router.get("/public", response_model=list[SlideshowItemOut])
def get_public(
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    _ensure_builtins(db)
    level = AUDIENCE_LEVELS[_viewer_level(user)]
    items = db.query(SlideshowItem).filter(SlideshowItem.active.is_(True)).order_by(
        SlideshowItem.position, SlideshowItem.id).all()
    items = [it for it in items if AUDIENCE_LEVELS[it.audience] <= level]
    today = date.today()
    return [
        _out(it, events=_events_for(db, it, user, today),
             wochenspruch=_get_wochenspruch(today) if it.kind == "wochenspruch" else None)
        for it in items
    ]


# ---------------------------------------------------------------------------
# Admin: list
# ---------------------------------------------------------------------------

@router.get("/items", response_model=list[SlideshowItemOut])
def list_items(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    _ensure_builtins(db)
    items = db.query(SlideshowItem).order_by(SlideshowItem.position, SlideshowItem.id).all()
    warnings = _compute_warnings_with_db(db, items)
    return [_out(it, warnings=warnings[it.id]) for it in items]


# ---------------------------------------------------------------------------
# Admin: upload
# ---------------------------------------------------------------------------

@router.post("/items/upload", response_model=list[SlideshowItemOut])
async def upload_items(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    validated = []
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Dateityp nicht erlaubt: {ext}")
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Datei zu groß (max 100 MB)")
        validated.append((file, ext, data))

    next_position = _next_position(db)

    created = []
    for file, ext, data in validated:
        stored_filename = uuid.uuid4().hex + ext
        (SLIDESHOW_DIR / stored_filename).write_bytes(data)
        item = SlideshowItem(
            position=next_position, kind="file", title=file.filename or stored_filename,
            active=True, audience="guest", media_type=ALLOWED_EXTENSIONS[ext],
            stored_filename=stored_filename, original_filename=file.filename,
        )
        next_position += 1
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return [_out(it) for it in created]


# ---------------------------------------------------------------------------
# Admin: create
# ---------------------------------------------------------------------------

@router.post("/items", response_model=SlideshowItemOut, status_code=201)
def create_item(
    body: SlideshowItemIn,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    # Files come via /items/upload; Hauspunkte, Termine, Wochenspruch and the clock are built in.
    if body.kind != "link":
        raise HTTPException(400, f"Kind nicht erstellbar: {body.kind}")
    if not body.url or not (body.url.startswith("http://") or body.url.startswith("https://")):
        raise HTTPException(400, "Ungültiger Link")

    item = SlideshowItem(
        position=_next_position(db), kind="link", title=body.title or body.url,
        active=True, audience="guest", url=body.url,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _out(item)


# ---------------------------------------------------------------------------
# Admin: patch
# ---------------------------------------------------------------------------

def _validate_days_ahead(value: int) -> None:
    if not (1 <= value <= 365):
        raise HTTPException(400, "calendar_days_ahead muss zwischen 1 und 365 liegen")


def _validate_time(value: str) -> None:
    if not TIME_RE.match(value):
        raise HTTPException(400, f"Ungültige Uhrzeit: {value}")


def _validated_patch(body: SlideshowItemPatch) -> dict:
    data = body.model_dump(exclude_unset=True)

    # null only makes sense for the optional slot/url fields; the rest are NOT NULL columns
    for field in ("title", "active", "audience", "duration_seconds", "calendar_tags",
                  "calendar_categories", "calendar_days_ahead"):
        if field in data and data[field] is None:
            raise HTTPException(400, f"{field} darf nicht leer sein")
    if "slot_days" in data and data["slot_days"] is None:
        data["slot_days"] = []
    if "calendar_days_ahead" in data:
        _validate_days_ahead(data["calendar_days_ahead"])

    if "audience" in data and data["audience"] not in AUDIENCE_LEVELS:
        raise HTTPException(400, f"Unbekannte Zielgruppe: {data['audience']}")
    if "duration_seconds" in data and not (3 <= data["duration_seconds"] <= 3600):
        raise HTTPException(400, "duration_seconds muss zwischen 3 und 3600 liegen")
    if "slot_days" in data:
        if any(d < 0 or d > 6 for d in data["slot_days"]):
            raise HTTPException(400, "slot_days außerhalb 0..6")
    if "slot_start" in data and data["slot_start"] is not None:
        _validate_time(data["slot_start"])
    if "slot_end" in data and data["slot_end"] is not None:
        _validate_time(data["slot_end"])
    if "calendar_categories" in data:
        unknown = [c for c in data["calendar_categories"] if c not in SLIDE_CATEGORIES]
        if unknown:
            raise HTTPException(400, f"Unbekannte Kategorie: {', '.join(unknown)}")
    return data


@router.patch("/items/{item_id}", response_model=SlideshowItemOut)
def patch_item(
    item_id: int,
    body: SlideshowItemPatch,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    item = db.query(SlideshowItem).filter_by(id=item_id).first()
    if item is None:
        raise HTTPException(404, "Nicht gefunden")
    for field, value in _validated_patch(body).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _out(item)


@router.patch("/items", response_model=list[SlideshowItemOut])
def patch_items(
    body: SlideshowBulkPatchIn,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    """Multi-select edit: the same change for every listed item, all or nothing."""
    data = _validated_patch(body.patch)
    items = db.query(SlideshowItem).filter(SlideshowItem.id.in_(body.ids)).all()
    if len(items) != len(set(body.ids)):
        raise HTTPException(404, "Nicht gefunden")
    for item in items:
        for field, value in data.items():
            setattr(item, field, value)
    db.commit()
    return [_out(it) for it in sorted(items, key=lambda it: (it.position, it.id))]


@router.get("/calendar-tags")
def calendar_tags(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    """Tags to filter Termine by: the CalendarTag table plus every tag used on an entry
    (imports like ICS/Ferien set tags that never get a CalendarTag row)."""
    colors = {t.name: t.color for t in db.query(CalendarTag).all()}
    names = set(colors)
    for (tags,) in db.query(CalendarEntry.tags).all():
        names.update(t for t in (tags or []) if isinstance(t, str) and t.strip())
    return [{"name": n, "color": colors.get(n)} for n in sorted(names, key=str.casefold)]


@router.get("/items/{item_id}/events", response_model=list[SlideshowEventOut])
def preview_events(
    item_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    """What the Termine slide matches with its current filters (before viewer visibility)."""
    item = db.query(SlideshowItem).filter_by(id=item_id).first()
    if item is None:
        raise HTTPException(404, "Nicht gefunden")
    if item.kind != "calendar":
        raise HTTPException(400, "Nur für Termine")
    return [_event_out(e) for e in _matching_entries(db, item, date.today())]


# ---------------------------------------------------------------------------
# Admin: order
# ---------------------------------------------------------------------------

@router.put("/order")
def set_order(
    body: SlideshowOrderIn,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    existing_ids = {i for (i,) in db.query(SlideshowItem.id).all()}
    if set(body.ids) != existing_ids or len(body.ids) != len(existing_ids):
        raise HTTPException(400, "IDs stimmen nicht mit vorhandenen Items überein")

    items_by_id = {it.id: it for it in db.query(SlideshowItem).all()}
    for position, item_id in enumerate(body.ids):
        items_by_id[item_id].position = position
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin: bulk delete
# ---------------------------------------------------------------------------

@router.post("/items/delete")
def delete_items(
    body: SlideshowDeleteIn,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_feature("slideshow")),
):
    items = db.query(SlideshowItem).filter(SlideshowItem.id.in_(body.ids)).all()
    if any(it.kind in BUILTIN_KINDS for it in items):
        raise HTTPException(400, "Hauspunkte, Termine, Wochenspruch und Uhr können nicht gelöscht werden, nur deaktiviert")

    for item in items:
        if item.stored_filename:
            (SLIDESHOW_DIR / item.stored_filename).unlink(missing_ok=True)
        db.delete(item)
    db.commit()
    return {"deleted": len(items)}
