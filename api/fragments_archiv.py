"""Fragmente sichern und umziehen.

* ZIP-Export/Import einer Sammlung (wie TaskCrawler/Caputh): ``fragmente.json`` mit
  Sammlung, Tabs, Kategorien, Karten und Clippings/Workflows, dazu ``assets/`` mit
  allen Bildern, PDFs und Dokumenten. Zugriffsrechte, Gastcodes und Ids bleiben
  draußen — beim Import gehört alles der importierenden Lehrkraft.
* Laufende Sicherung: bei jedem Anlegen, Ändern und Löschen schreibt ein
  SQLAlchemy-Ereignis eine JSON je Sammlung, Karte, Clipping und Anhang nach
  ``data/fragments_backup/<Sammlung>/``. Gelöschtes bleibt als ``*.geloescht.json``
  liegen. Zusammen mit ``data/fragments/`` (die Dateien selbst) lässt sich so jede
  Pinnwand auch ohne Datenbank wiederherstellen.
"""
from __future__ import annotations

import io
import json
import logging
import os
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import event, inspect

from .models import Fragment, FragmentCollection, ResearchItem, ResearchMedia

log = logging.getLogger(__name__)

DATA = Path(__file__).parent.parent / "data"
MEDIA_BASE = DATA / "fragments"
BACKUP_BASE = Path(os.environ.get("FRAGMENTE_BACKUP_DIR") or DATA / "fragments_backup")

FORMAT = "tt-fragmente/1"
MAX_GESAMT = 300 * 1024 * 1024   # entpackt höchstens 300 MB
MAX_DATEI = 50 * 1024 * 1024     # je Datei
ERLAUBT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".pdf", ".txt", ".md", ".csv", ".rtf", ".tex",
           ".doc", ".docx", ".odt", ".ott", ".xls", ".xlsx", ".ods", ".ppt", ".pptx", ".odp", ".odg"}

KARTE_FELDER = ("tab", "title", "content", "category", "klasse", "einheit", "order_index")
CLIP_FELDER = ("art", "tab", "title", "url", "url_title", "url_description", "url_image", "text_content",
               "tags", "klasse", "einheit", "sim", "d2", "links")


class ArchivFehler(ValueError):
    pass


# ── Export ────────────────────────────────────────────────────────────────────

def _datei(pfad: str) -> Path | None:
    """/uploads/fragments/<cid>/<name> → Datei auf der Platte (nur innerhalb von MEDIA_BASE)."""
    teile = pfad.strip("/").split("/")
    if len(teile) < 2:
        return None
    p = (MEDIA_BASE / teile[-2] / teile[-1]).resolve()
    return p if MEDIA_BASE.resolve() in p.parents and p.is_file() else None


def export_zip(coll: FragmentCollection) -> bytes:
    puffer = io.BytesIO()
    with zipfile.ZipFile(puffer, "w", zipfile.ZIP_DEFLATED) as zf:
        clips = []
        for r in coll.research_items:
            media = []
            for m in r.media:
                datei = _datei(m.path)
                if not datei:
                    continue
                ziel = f"assets/{datei.name}"
                zf.write(datei, ziel)
                media.append({"kind": m.kind, "name": m.name, "datei": ziel})
            clips.append({**{f: getattr(r, f) for f in CLIP_FELDER}, "author_name": r.author_name, "media": media})
        daten = {
            "format": FORMAT,
            "exportiert": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sammlung": {"name": coll.name, "description": coll.description, "subject": coll.subject,
                         "art": coll.art, "kategorien": coll.kategorien or [], "fragment_tabs": coll.fragment_tabs or []},
            "karten": [{**{f: getattr(f_, f) for f in KARTE_FELDER}, "author_name": f_.author_name}
                       for f_ in sorted(coll.fragments, key=lambda x: (x.tab, x.order_index))],
            "clippings": clips,
        }
        zf.writestr("fragmente.json", json.dumps(daten, ensure_ascii=False, indent=1))
    return puffer.getvalue()


# ── Import ────────────────────────────────────────────────────────────────────

def lies_zip(inhalt: bytes) -> tuple[dict, zipfile.ZipFile]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(inhalt))
    except zipfile.BadZipFile:
        raise ArchivFehler("Keine gültige ZIP-Datei")
    if sum(i.file_size for i in zf.infolist()) > MAX_GESAMT:
        raise ArchivFehler("ZIP ist entpackt zu groß")
    namen = [n for n in zf.namelist() if n.endswith("fragmente.json")]
    if not namen:
        raise ArchivFehler("ZIP muss fragmente.json enthalten")
    try:
        daten = json.loads(zf.read(namen[0]))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ArchivFehler(f"fragmente.json ist kein gültiges JSON: {e}")
    if not isinstance(daten, dict) or daten.get("format") != FORMAT:
        raise ArchivFehler(f"Unbekanntes Format, erwartet {FORMAT}")
    return daten, zf


def importieren(db, coll: FragmentCollection, daten: dict, zf: zipfile.ZipFile, autor: dict) -> dict:
    """Karten und Clippings aus ``daten`` in ``coll`` anlegen. ``autor``: author_kind/_id/_name."""
    s = daten.get("sammlung") or {}
    # Fehlende eigene Tabs und (falls leer) die Kategorien übernehmen
    tabs = list(coll.fragment_tabs or [])
    for t in s.get("fragment_tabs") or []:
        if isinstance(t, str) and t not in tabs:
            tabs.append(t)
    coll.fragment_tabs = tabs
    if not coll.kategorien and isinstance(s.get("kategorien"), list):
        coll.kategorien = s["kategorien"]

    def text(v, n=None):
        return v[:n] if isinstance(v, str) and n else v if isinstance(v, str) else None

    karten = 0
    for k in daten.get("karten") or []:
        if not isinstance(k, dict):
            continue
        db.add(Fragment(collection_id=coll.id, tab=text(k.get("tab"), 100) or "snippets", title=text(k.get("title"), 255),
                        content=text(k.get("content")) or "", category=text(k.get("category"), 100),
                        klasse=k.get("klasse") if isinstance(k.get("klasse"), int) else None,
                        einheit=text(k.get("einheit"), 100),
                        order_index=k.get("order_index") if isinstance(k.get("order_index"), int) else 0, **autor))
        karten += 1

    ziel = MEDIA_BASE / str(coll.id)
    clips = dateien = 0
    for c in daten.get("clippings") or []:
        if not isinstance(c, dict):
            continue
        r = ResearchItem(collection_id=coll.id, art=c.get("art") if c.get("art") in ("clipping", "workflow") else "clipping",
                         tab=text(c.get("tab"), 100) or "snippets",
                         **{f: text(c.get(f)) for f in ("title", "url", "url_title", "url_description", "url_image", "text_content", "d2")},
                         tags=[t for t in c.get("tags") or [] if isinstance(t, str)][:30],
                         klasse=c.get("klasse") if isinstance(c.get("klasse"), int) else None,
                         einheit=text(c.get("einheit"), 100),
                         sim=c.get("sim") if isinstance(c.get("sim"), dict) else None,
                         links=c.get("links") if isinstance(c.get("links"), list) else None, **autor)
        db.add(r)
        db.flush()
        clips += 1
        for i, m in enumerate(c.get("media") or []):
            if not isinstance(m, dict) or not isinstance(m.get("datei"), str):
                continue
            endung = Path(m["datei"]).suffix.lower()
            if endung not in ERLAUBT or m.get("kind") not in ("image", "pdf", "file"):
                continue
            try:
                info = zf.getinfo(m["datei"])
            except KeyError:
                continue
            if info.file_size > MAX_DATEI:
                continue
            ziel.mkdir(parents=True, exist_ok=True)
            name = uuid.uuid4().hex + endung
            (ziel / name).write_bytes(zf.read(info))
            db.add(ResearchMedia(research_item_id=r.id, kind=m["kind"], path=f"/uploads/fragments/{coll.id}/{name}",
                                 name=text(m.get("name"), 255), order_index=i))
            dateien += 1
    return {"karten": karten, "clippings": clips, "dateien": dateien}


# ── Laufende Sicherung ────────────────────────────────────────────────────────

def _werte(obj) -> dict:
    aus = {}
    for spalte in inspect(obj).mapper.column_attrs:
        v = getattr(obj, spalte.key)
        aus[spalte.key] = v.isoformat() if isinstance(v, datetime) else v
    return aus


def _ordner_und_name(obj) -> tuple[Path, str] | None:
    if isinstance(obj, FragmentCollection):
        return BACKUP_BASE / str(obj.id), "sammlung"
    if isinstance(obj, Fragment):
        return BACKUP_BASE / str(obj.collection_id), f"karte-{obj.id}"
    if isinstance(obj, ResearchItem):
        return BACKUP_BASE / str(obj.collection_id), f"clipping-{obj.id}"
    if isinstance(obj, ResearchMedia):
        cid = obj.path.strip("/").split("/")[-2] if obj.path else "ohne"
        return BACKUP_BASE / cid, f"anhang-{obj.id}"
    return None


def _schreiben(obj, geloescht: bool = False) -> None:
    try:
        ort = _ordner_und_name(obj)
        if not ort:
            return
        ordner, name = ort
        ordner.mkdir(parents=True, exist_ok=True)
        ziel = ordner / f"{name}.json"
        if geloescht:
            if ziel.exists():
                ziel.replace(ordner / f"{name}.geloescht.json")
            return
        tmp = ziel.with_suffix(".tmp")
        tmp.write_text(json.dumps({"art": type(obj).__name__, "gesichert": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                   "daten": _werte(obj)}, ensure_ascii=False, indent=1, default=str), encoding="utf8")
        tmp.replace(ziel)
    except Exception:  # Sicherung darf nie einen Speichervorgang scheitern lassen
        log.exception("Fragmente-Sicherung fehlgeschlagen")


for _klasse in (FragmentCollection, Fragment, ResearchItem, ResearchMedia):
    event.listen(_klasse, "after_insert", lambda _m, _c, obj: _schreiben(obj))
    event.listen(_klasse, "after_update", lambda _m, _c, obj: _schreiben(obj))
    event.listen(_klasse, "after_delete", lambda _m, _c, obj: _schreiben(obj, geloescht=True))
