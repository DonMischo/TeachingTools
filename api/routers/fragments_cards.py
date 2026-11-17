"""Card CRUD for fragment collections: text fragments + research clippings.

Ported from foliantica (fragments.py + research.py), re-scoped from project_id
to collection_id and wrapped in the collection permission model
(api/fragment_access.py):
  * read       — list/view cards
  * contribute — create cards; edit/delete only one's own
  * manage     — edit/delete any card; manage tabs
URL metadata scraping is SSRF-guarded because contributors may be students/guests.
"""
import ipaddress
import re
import socket
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Literal, Optional, Union
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, selectinload

from .. import exitgame_katalog
from ..database import get_db
from ..auth import get_current_user, get_current_user_optional, guest_from_credentials, bearer, Guest
from ..models import (
    Teacher, Student,
    FragmentCollection, Fragment, ResearchItem, ResearchMedia,
)
from ..fragment_access import (
    require_permission, resolve_permission, at_least, can_edit_card,
    author_of, author_name_of, collection_principal,
)

router = APIRouter(prefix="/api/fragments", tags=["fragments"])

# Tab order: Schnipsel is always first, Archiv always last, custom tabs between.
# Both card kinds (fragments + clippings) may live in ANY tab.
LEADING_TABS = ["snippets"]
TRAILING_TABS = ["archive"]
BUILTIN_TABS = LEADING_TABS + TRAILING_TABS  # reserved names (can't be custom)

MEDIA_BASE = Path(__file__).parent.parent.parent / "data" / "fragments"
_MEDIA_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}
_MEDIA_PDF_EXT = {".pdf"}
# Textdokumente: werden nur als Datei angehängt (Download), nie im Board gerendert.
# Kein .html/.svg — die würden vom selben Ursprung ausgeliefert Skripte ausführen.
_MEDIA_DOC_EXT = {
    ".txt", ".md", ".csv", ".rtf", ".tex",
    ".doc", ".docx", ".odt", ".ott",
    ".xls", ".xlsx", ".ods", ".ppt", ".pptx", ".odp", ".odg",
}

# ── Abuse limits ─────────────────────────────────────────────────────────────
# Per-hour creation caps to blunt spam:
#   * PER_COLLECTION_HOURLY — each kind (fragment/research/media), per board, per
#     student (by author id) or per board across all guests (shared identity).
#   * GLOBAL_STUDENT_HOURLY — a student's total creations (all kinds, all boards).
# Teachers are uncapped.
PER_COLLECTION_HOURLY = 5
GLOBAL_STUDENT_HOURLY = 20
STUDENT_MAX_BYTES = 5 * 1024 * 1024   # 5 MB — students & guests
TEACHER_MAX_BYTES = 15 * 1024 * 1024  # 15 MB — teachers


def _row_count(db, Model, since, *, collection_id=None, author_id=None, guest=False) -> int:
    q = db.query(Model).filter(Model.created_at >= since)
    if collection_id is not None:
        q = q.filter(Model.collection_id == collection_id)
    if author_id is not None:
        q = q.filter(Model.author_kind == "student", Model.author_id == author_id)
    if guest:
        q = q.filter(Model.author_kind == "guest")
    return q.count()


def _media_count(db, since, *, collection_id=None, author_id=None, guest=False) -> int:
    q = (db.query(ResearchMedia)
         .join(ResearchItem, ResearchMedia.research_item_id == ResearchItem.id)
         .filter(ResearchMedia.created_at >= since))
    if collection_id is not None:
        q = q.filter(ResearchItem.collection_id == collection_id)
    if author_id is not None:
        q = q.filter(ResearchItem.author_kind == "student", ResearchItem.author_id == author_id)
    if guest:
        q = q.filter(ResearchItem.author_kind == "guest")
    return q.count()


def _rate_check(db: Session, user, collection_id: int, kind: str):
    """Raise 429 if `user` exceeded a cap for `kind` ('fragment'|'research'|'media').
    No-op for teachers."""
    if isinstance(user, Teacher):
        return
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    is_student = isinstance(user, Student)
    who = {"author_id": user.id} if is_student else {"guest": True}

    # Per-collection, per-kind cap.
    if kind == "media":
        n = _media_count(db, since, collection_id=collection_id, **who)
    else:
        n = _row_count(db, Fragment if kind == "fragment" else ResearchItem, since,
                       collection_id=collection_id, **who)
    if n >= PER_COLLECTION_HOURLY:
        raise HTTPException(429, f"Limit erreicht: höchstens {PER_COLLECTION_HOURLY} pro Stunde in dieser Sammlung.")

    # Global cap across all boards (students only — guests are collection-scoped).
    if is_student:
        total = (_row_count(db, Fragment, since, author_id=user.id)
                 + _row_count(db, ResearchItem, since, author_id=user.id)
                 + _media_count(db, since, author_id=user.id))
        if total >= GLOBAL_STUDENT_HOURLY:
            raise HTTPException(429, f"Limit erreicht: höchstens {GLOBAL_STUDENT_HOURLY} Beiträge pro Stunde.")


# ── Tabs ────────────────────────────────────────────────────────────────────────

def _custom_tabs(coll: FragmentCollection) -> list[str]:
    return list(coll.fragment_tabs or [])


def _all_tabs(coll: FragmentCollection) -> list[str]:
    return LEADING_TABS + _custom_tabs(coll) + TRAILING_TABS


def _valid_write_tabs(coll: FragmentCollection) -> list[str]:
    return _all_tabs(coll)


class TabsUpdate(BaseModel):
    custom_tabs: list[str]


@router.get("/collections/{collection_id}/tabs")
def get_tabs(
    collection_id: int,
    db: Session = Depends(get_db),
    user=Depends(collection_principal),
):
    coll, _ = require_permission(db, user, collection_id, "read")
    return {"builtin": BUILTIN_TABS, "custom": _custom_tabs(coll), "all": _all_tabs(coll)}


@router.patch("/collections/{collection_id}/tabs")
def update_tabs(
    collection_id: int,
    body: TabsUpdate,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    coll, _ = require_permission(db, user, collection_id, "manage")
    custom = list(dict.fromkeys(
        t.strip() for t in body.custom_tabs
        if t.strip() and t.strip().lower() not in BUILTIN_TABS
    ))
    coll.fragment_tabs = custom
    db.commit()
    return {"builtin": BUILTIN_TABS, "custom": custom, "all": LEADING_TABS + custom + TRAILING_TABS}


# ── Fragment schemas ────────────────────────────────────────────────────────────

class FragmentCreate(BaseModel):
    tab: str = "snippets"
    title: Optional[str] = None
    content: Optional[str] = ""
    category: Optional[str] = None
    order_index: int = 0
    klasse: Optional[int] = None
    einheit: Optional[str] = Field(default=None, max_length=100)


class FragmentUpdate(BaseModel):
    tab: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    order_index: Optional[int] = None
    klasse: Optional[int] = None
    einheit: Optional[str] = Field(default=None, max_length=100)


class FragmentOut(BaseModel):
    id: int
    collection_id: int
    tab: str
    title: Optional[str]
    content: Optional[str]
    category: Optional[str]
    order_index: int
    klasse: Optional[int] = None
    einheit: Optional[str] = None
    author_kind: Optional[str]
    author_id: Optional[int]
    author_name: Optional[str]
    can_edit: bool = False

    model_config = {"from_attributes": True}


def _frag_out(frag: Fragment, perm: str, user) -> FragmentOut:
    out = FragmentOut.model_validate(frag)
    out.can_edit = can_edit_card(perm, user, frag.author_kind, frag.author_id)
    return out


# ── Fragment CRUD ────────────────────────────────────────────────────────────────

@router.get("/collections/{collection_id}/fragments", response_model=list[FragmentOut])
def list_fragments(
    collection_id: int,
    tab: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(collection_principal),
):
    coll, perm = require_permission(db, user, collection_id, "read")
    q = db.query(Fragment).filter(Fragment.collection_id == collection_id)
    if tab:
        q = q.filter(Fragment.tab == tab)
    rows = q.order_by(Fragment.tab, Fragment.order_index, Fragment.created_at).all()
    return [_frag_out(f, perm, user) for f in rows]


@router.post("/collections/{collection_id}/fragments", response_model=FragmentOut, status_code=201)
def create_fragment(
    collection_id: int,
    body: FragmentCreate,
    db: Session = Depends(get_db),
    user=Depends(collection_principal),
):
    coll, perm = require_permission(db, user, collection_id, "contribute")
    if body.tab not in _valid_write_tabs(coll):
        raise HTTPException(400, f"Unbekannter Tab '{body.tab}'")
    _rate_check(db, user, collection_id, "fragment")
    kind, uid = author_of(user)
    frag = Fragment(
        collection_id=collection_id,
        author_kind=kind, author_id=uid, author_name=author_name_of(user),
        **body.model_dump(),
    )
    db.add(frag)
    db.commit()
    db.refresh(frag)
    return _frag_out(frag, perm, user)


def _load_fragment_for_edit(db: Session, user, fragment_id: int) -> tuple[Fragment, FragmentCollection, str]:
    frag = db.get(Fragment, fragment_id)
    if not frag:
        raise HTTPException(404, "Fragment nicht gefunden")
    coll = db.get(FragmentCollection, frag.collection_id)
    perm = resolve_permission(user, coll)
    if not can_edit_card(perm, user, frag.author_kind, frag.author_id):
        raise HTTPException(403, "Keine Berechtigung, dieses Fragment zu bearbeiten")
    return frag, coll, perm


@router.patch("/items/{fragment_id}", response_model=FragmentOut)
def update_fragment(
    fragment_id: int,
    body: FragmentUpdate,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    frag, coll, perm = _load_fragment_for_edit(db, user, fragment_id)
    if body.tab is not None and body.tab not in _valid_write_tabs(coll):
        raise HTTPException(400, f"Unbekannter Tab '{body.tab}'")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(frag, k, v)
    # Klasse/Einheit lassen sich auch wieder leeren (null) — gesendet heißt gemeint.
    for k in ("klasse", "einheit"):
        if k in body.model_fields_set:
            setattr(frag, k, getattr(body, k))
    db.commit()
    db.refresh(frag)
    return _frag_out(frag, perm, user)


@router.delete("/items/{fragment_id}", status_code=204)
def delete_fragment(
    fragment_id: int,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    frag, _, _ = _load_fragment_for_edit(db, user, fragment_id)
    db.delete(frag)
    db.commit()


# ── Fragment import (YAML-frontmatter snippet files) ─────────────────────────────

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)", re.DOTALL)
_KV_RE = re.compile(r"^(\w+)\s*:\s*(.*)$")


def _parse_snippet_file(raw: str) -> dict:
    m = _FRONTMATTER_RE.match(raw.strip())
    if not m:
        return {"title": None, "tab": "snippets", "content": raw.strip()}
    frontmatter_str, body = m.group(1), m.group(2).strip()
    meta: dict = {}
    for line in frontmatter_str.splitlines():
        kv = _KV_RE.match(line.strip())
        if kv:
            meta[kv.group(1).lower()] = kv.group(2).strip()
    return {
        "title": meta.get("title") or None,
        "tab": meta.get("tab", "snippets").lower(),
        "content": body,
    }


@router.post("/collections/{collection_id}/fragments/import")
async def import_fragments(
    collection_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    coll, _ = require_permission(db, user, collection_id, "contribute")
    valid_tabs = _all_tabs(coll)
    kind, uid = author_of(user)
    name = author_name_of(user)
    created = skipped = 0
    for upload in files:
        if not upload.filename:
            skipped += 1
            continue
        raw = (await upload.read()).decode("utf-8", errors="replace")
        parsed = _parse_snippet_file(raw)
        if not parsed["title"]:
            stem = upload.filename.rsplit(".", 1)[0]
            parsed["title"] = stem or None
        tab = parsed["tab"] if parsed["tab"] in valid_tabs else "snippets"
        db.add(Fragment(
            collection_id=collection_id, tab=tab,
            title=parsed["title"], content=parsed["content"],
            author_kind=kind, author_id=uid, author_name=name,
        ))
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}


# ── URL metadata scraping (SSRF-guarded) ─────────────────────────────────────────

def _is_safe_public_url(url: str) -> bool:
    """Reject non-http(s) schemes and hosts that resolve to private/loopback IPs.
    Prevents a contributing student/guest from making the server hit internal hosts.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except Exception:
        return False
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return False
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast:
            return False
    return True


async def _fetch_url_meta(url: str) -> dict:
    """Scrape <title>, og:description, og:image. Fails soft to {}."""
    if not _is_safe_public_url(url):
        return {}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "TT-TeachingTools/1.0 (fragments-clipping)"})
            html = resp.text
    except Exception:
        return {}

    def _meta(name: str) -> Optional[str]:
        m = re.search(
            rf'<meta[^>]+(?:property|name)=["\']og:{name}["\'][^>]+content=["\']([^"\']+)["\']',
            html, re.IGNORECASE,
        ) or re.search(
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']og:{name}["\']',
            html, re.IGNORECASE,
        )
        return m.group(1).strip() if m else None

    tm = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    return {
        "url_title": _meta("title") or (tm.group(1).strip() if tm else None),
        "url_description": _meta("description"),
        "url_image": _meta("image"),
    }


# ── Research schemas ─────────────────────────────────────────────────────────────

class ResearchMediaOut(BaseModel):
    id: int
    kind: str
    path: str
    name: Optional[str] = None
    order_index: int

    model_config = {"from_attributes": True}


class ResearchLink(BaseModel):
    """Material wie im Curriculinator/Stundenplaner (ToolLink)."""
    type: str = Field(max_length=40)
    ref_id: Optional[str] = Field(default=None, max_length=100)
    url: Optional[str] = Field(default=None, max_length=2000)
    label: str = Field(max_length=300)

    @field_validator("url")
    @classmethod
    def _nur_web(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r"^https?://", v, re.I):
            raise ValueError("Links nur mit http(s)://")
        return v


class ResearchSim(BaseModel):
    """Werkzeug wie an einer TaskCrawler-Station (Werte: exitgame_katalog.WERKZEUGE)."""
    tool: str
    config: dict = {}

    @field_validator("tool")
    @classmethod
    def _bekannt(cls, v: str) -> str:
        if v not in exitgame_katalog.WERKZEUGE:
            raise ValueError(f"Unbekanntes Werkzeug: {v}")
        return v


class ResearchItemCreate(BaseModel):
    tab: str = "snippets"
    art: Literal["clipping", "workflow"] = "clipping"
    d2: Optional[str] = Field(default=None, max_length=50_000)
    title: Optional[str] = None
    url: Optional[str] = None
    text_content: Optional[str] = None
    tags: list[str] = []
    klasse: Optional[int] = None
    einheit: Optional[str] = Field(default=None, max_length=100)
    sim: Optional[ResearchSim] = None
    links: Optional[list[ResearchLink]] = Field(default=None, max_length=50)


class ResearchItemUpdate(BaseModel):
    tab: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    text_content: Optional[str] = None
    tags: Optional[list[str]] = None
    klasse: Optional[int] = None
    einheit: Optional[str] = Field(default=None, max_length=100)
    sim: Optional[ResearchSim] = None
    d2: Optional[str] = Field(default=None, max_length=50_000)
    links: Optional[list[ResearchLink]] = Field(default=None, max_length=50)


class ResearchItemOut(BaseModel):
    id: int
    collection_id: int
    tab: str
    title: Optional[str]
    url: Optional[str]
    url_title: Optional[str]
    url_description: Optional[str]
    url_image: Optional[str]
    text_content: Optional[str]
    tags: list[str]
    klasse: Optional[int] = None
    einheit: Optional[str] = None
    sim: Optional[dict] = None
    art: str = "clipping"
    d2: Optional[str] = None
    links: Optional[list[dict]] = None
    media: list[ResearchMediaOut]
    author_kind: Optional[str]
    author_id: Optional[int]
    author_name: Optional[str]
    can_edit: bool = False

    model_config = {"from_attributes": True}


def _research_out(item: ResearchItem, perm: str, user) -> ResearchItemOut:
    out = ResearchItemOut.model_validate(item)
    out.can_edit = can_edit_card(perm, user, item.author_kind, item.author_id)
    return out


# ── Research CRUD ────────────────────────────────────────────────────────────────

@router.get("/collections/{collection_id}/research", response_model=list[ResearchItemOut])
def list_research(
    collection_id: int,
    db: Session = Depends(get_db),
    user=Depends(collection_principal),
):
    coll, perm = require_permission(db, user, collection_id, "read")
    rows = (
        db.query(ResearchItem)
        .options(selectinload(ResearchItem.media))
        .filter(ResearchItem.collection_id == collection_id)
        .order_by(ResearchItem.created_at.desc())
        .all()
    )
    return [_research_out(r, perm, user) for r in rows]


@router.post("/collections/{collection_id}/research", response_model=ResearchItemOut, status_code=201)
async def create_research(
    collection_id: int,
    body: ResearchItemCreate,
    db: Session = Depends(get_db),
    user=Depends(collection_principal),
):
    coll, perm = require_permission(db, user, collection_id, "contribute")
    if body.tab not in _valid_write_tabs(coll):
        raise HTTPException(400, f"Unbekannter Tab '{body.tab}'")
    _rate_check(db, user, collection_id, "research")
    # Guests may not post URLs — prevents seeding phishing links behind a friendly
    # title/preview. Their clippings are text-only.
    url = None if isinstance(user, Guest) else body.url
    meta = await _fetch_url_meta(url) if url else {}
    kind, uid = author_of(user)
    item = ResearchItem(
        collection_id=collection_id,
        tab=body.tab, title=body.title, url=url,
        url_title=meta.get("url_title"), url_description=meta.get("url_description"),
        url_image=meta.get("url_image"),
        text_content=body.text_content, tags=body.tags, klasse=body.klasse, einheit=body.einheit,
        sim=body.sim.model_dump() if body.sim else None,
        art=body.art, d2=body.d2 if body.art == "workflow" else None,
        links=[l.model_dump() for l in body.links] if body.links else None,
        author_kind=kind, author_id=uid, author_name=author_name_of(user),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _research_out(item, perm, user)


def _load_research_for_edit(db: Session, user, item_id: int) -> tuple[ResearchItem, str]:
    item = db.get(ResearchItem, item_id)
    if not item:
        raise HTTPException(404, "Clipping nicht gefunden")
    coll = db.get(FragmentCollection, item.collection_id)
    perm = resolve_permission(user, coll)
    if not can_edit_card(perm, user, item.author_kind, item.author_id):
        raise HTTPException(403, "Keine Berechtigung, dieses Clipping zu bearbeiten")
    return item, perm


@router.patch("/research/{item_id}", response_model=ResearchItemOut)
async def update_research(
    item_id: int,
    body: ResearchItemUpdate,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    item, perm = _load_research_for_edit(db, user, item_id)
    data = body.model_dump(exclude_unset=True)
    url_changed = "url" in data and data["url"] != item.url
    for k, v in data.items():
        setattr(item, k, v)
    if url_changed:
        meta = await _fetch_url_meta(item.url) if item.url else {}
        item.url_title = meta.get("url_title")
        item.url_description = meta.get("url_description")
        item.url_image = meta.get("url_image")
    db.commit()
    db.refresh(item)
    return _research_out(item, perm, user)


@router.delete("/research/{item_id}", status_code=204)
def delete_research(
    item_id: int,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    item, _ = _load_research_for_edit(db, user, item_id)
    _delete_media_files(item.media)
    db.delete(item)
    db.commit()


@router.post("/research/{item_id}/fetch-url", response_model=ResearchItemOut)
async def refetch_url(
    item_id: int,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    item, perm = _load_research_for_edit(db, user, item_id)
    if not item.url:
        raise HTTPException(400, "Kein URL gesetzt")
    meta = await _fetch_url_meta(item.url)
    item.url_title = meta.get("url_title")
    item.url_description = meta.get("url_description")
    item.url_image = meta.get("url_image")
    db.commit()
    db.refresh(item)
    return _research_out(item, perm, user)


# ── Research media (image / PDF gallery) ─────────────────────────────────────────

def _media_url(collection_id: int, name: str) -> str:
    return f"/uploads/fragments/{collection_id}/{name}"


def _delete_media_files(media: list[ResearchMedia]):
    for m in media:
        name = m.path.rsplit("/", 1)[-1]
        # path is /uploads/fragments/<cid>/<name>; resolve back to disk.
        parts = m.path.strip("/").split("/")
        if len(parts) >= 3:
            (MEDIA_BASE / parts[-2] / name).unlink(missing_ok=True)


@router.post("/research/{item_id}/media", response_model=ResearchItemOut)
async def upload_research_media(
    item_id: int,
    request: Request,
    file: UploadFile = File(...),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
):
    # Media upload accepts a logged-in user OR a guest scoped to this item's
    # collection code. Logged-in users keep edit-own semantics; guests may only
    # ADD media and only at 'contribute' (they can't delete media or edit cards).
    item = db.get(ResearchItem, item_id)
    if not item:
        raise HTTPException(404, "Clipping nicht gefunden")
    coll = db.get(FragmentCollection, item.collection_id)
    user = get_current_user_optional(request, credentials, db)
    if user is None and coll.allow_guests and coll.guest_code:
        user = guest_from_credentials(credentials, coll.guest_code)
    if user is None:
        raise HTTPException(401, "Nicht authentifiziert")
    perm = resolve_permission(user, coll)
    allowed = at_least(perm, "contribute") if isinstance(user, Guest) \
        else can_edit_card(perm, user, item.author_kind, item.author_id)
    if not allowed:
        raise HTTPException(403, "Keine Berechtigung, Medien anzuhängen")
    _rate_check(db, user, item.collection_id, "media")

    ext = Path(file.filename or "").suffix.lower()
    if ext in _MEDIA_IMAGE_EXT:
        kind = "image"
    elif ext in _MEDIA_PDF_EXT:
        kind = "pdf"
    elif ext in _MEDIA_DOC_EXT:
        kind = "file"
    else:
        raise HTTPException(400, f"Dateityp nicht erlaubt: {ext}")
    max_bytes = TEACHER_MAX_BYTES if isinstance(user, Teacher) else STUDENT_MAX_BYTES
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"Datei zu groß (max {max_bytes // (1024 * 1024)} MB)")

    dest_dir = MEDIA_BASE / str(item.collection_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = uuid.uuid4().hex + ext
    (dest_dir / safe_name).write_bytes(data)

    next_idx = (max((m.order_index for m in item.media), default=-1)) + 1
    media = ResearchMedia(
        research_item_id=item.id, kind=kind,
        path=_media_url(item.collection_id, safe_name), order_index=next_idx,
        name=Path(file.filename or "").name[:255] or None,
    )
    db.add(media)
    db.commit()
    db.refresh(item)
    return _research_out(item, perm, user)


@router.delete("/media/{media_id}", status_code=204)
def delete_research_media(
    media_id: int,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    media = db.get(ResearchMedia, media_id)
    if not media:
        raise HTTPException(404, "Medium nicht gefunden")
    item = db.get(ResearchItem, media.research_item_id)
    coll = db.get(FragmentCollection, item.collection_id)
    perm = resolve_permission(user, coll)
    if not can_edit_card(perm, user, item.author_kind, item.author_id):
        raise HTTPException(403, "Keine Berechtigung")
    _delete_media_files([media])
    db.delete(media)
    db.commit()
