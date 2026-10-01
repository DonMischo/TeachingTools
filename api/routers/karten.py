"""Kartentool: liefert die Kartenebenen aus data/karten/.

Die Ebenen erzeugt ``frontend/scripts/fetch-karten.mjs`` (BKG + Natural
Earth). Mit Konto sieht man alles samt Namen; Gäste bekommen Karten nur über
ein Quiz, und dort ohne Namen.
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..auth import get_current_user
from ..models import Student, Teacher

router = APIRouter(prefix="/api/karten", tags=["karten"])

DATEN = Path(__file__).resolve().parents[2] / "data" / "karten"


@lru_cache(maxsize=1)
def katalog() -> dict:
    return json.loads((DATEN / "ebenen.json").read_text(encoding="utf-8"))


@router.get("/ebenen")
def ebenen(_: Union[Teacher, Student] = Depends(get_current_user)):
    return katalog()


@router.get("/ebenen/{ebene_id}")
def ebene(ebene_id: str, _: Union[Teacher, Student] = Depends(get_current_user)):
    eintrag = next((e for e in katalog()["ebenen"] if e["id"] == ebene_id), None)
    if eintrag is None or eintrag["geometrie"] == "raster":
        raise HTTPException(404, "Unbekannte Ebene")
    return FileResponse(
        DATEN / "ebenen" / f"{ebene_id}.geojson",
        media_type="application/geo+json",
        headers={"Cache-Control": "private, max-age=86400"},
    )
