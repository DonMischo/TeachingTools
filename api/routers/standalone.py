"""Offline-Dateien: Werkzeuge als eine HTML-Datei zum Mitgeben.

Ein Bündel wird auf dem Host gebaut (`npm run build:standalone` im frontend/)
und liegt danach in data/standalone/. Hier steht nur, welche Bündel es gibt —
ein weiteres Werkzeug braucht einen Eintrag in BUNDLES und einen passenden
Build; an dieser Datei ändert sich sonst nichts.

Wer herunterladen darf, entscheidet die normale Werkzeug-Freigabe: wer keines
der enthaltenen Werkzeuge benutzen darf, bekommt die Datei auch nicht.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..models import Teacher, Student
from .. import availability

router = APIRouter(prefix="/api/standalone", tags=["standalone"])

STANDALONE_DIR = Path(__file__).parent.parent.parent / "data" / "standalone"


@dataclass(frozen=True)
class Bundle:
    name: str                  # Schlüssel in der URL
    filename: str              # Datei in data/standalone
    label: str                 # Anzeigename
    download_as: str           # Dateiname beim Herunterladen
    tools: tuple[str, ...]     # enthaltene Werkzeuge (für die Freigabe-Prüfung)
    note: str                  # ein Satz für die Oberfläche


BUNDLES: dict[str, Bundle] = {
    "simulationen": Bundle(
        name="simulationen",
        filename="simulationen.html",
        label="Simulationen",
        download_as="simulationen.html",
        tools=("gleichungswaage", "abacus", "bildformate"),
        note="Gleichungswaage, Abakus und Bildformate in einer Datei — Doppelklick genügt, "
             "kein Internet und keine Anmeldung nötig.",
    ),
}


class BundleOut(BaseModel):
    name: str
    label: str
    note: str
    tools: list[str]
    available: bool
    size_bytes: int | None
    built_at: datetime | None


def _describe(bundle: Bundle) -> BundleOut:
    path = STANDALONE_DIR / bundle.filename
    exists = path.is_file()
    stat = path.stat() if exists else None
    return BundleOut(
        name=bundle.name,
        label=bundle.label,
        note=bundle.note,
        tools=list(bundle.tools),
        available=exists,
        size_bytes=stat.st_size if stat else None,
        built_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc) if stat else None,
    )


def _allowed(db: Session, user: Union[Teacher, Student], bundle: Bundle) -> bool:
    """Ein Bündel darf haben, wer mindestens eines seiner Werkzeuge benutzen darf."""
    return any(availability.is_allowed(db, user, slug, "use") for slug in bundle.tools)


@router.get("", response_model=list[BundleOut])
def list_bundles(
    user: Union[Teacher, Student] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return [_describe(b) for b in BUNDLES.values() if _allowed(db, user, b)]


@router.get("/{name}")
def download_bundle(
    name: str,
    user: Union[Teacher, Student] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bundle = BUNDLES.get(name)
    if not bundle:
        raise HTTPException(404, f"Kein Bündel »{name}«")
    if not _allowed(db, user, bundle):
        raise HTTPException(403, "Diese Werkzeuge sind für dich nicht freigegeben.")

    path = STANDALONE_DIR / bundle.filename
    if not path.is_file():
        raise HTTPException(
            404,
            "Die Offline-Datei wurde noch nicht gebaut "
            "(im Ordner frontend/: npm run build:standalone).",
        )
    return FileResponse(path, media_type="text/html", filename=bundle.download_as)
