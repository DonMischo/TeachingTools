"""Kartentool: liefert die Kartenebenen aus data/karten/ und speichert Kartensätze.

Die Ebenen erzeugt ``frontend/scripts/fetch-karten.mjs`` (BKG + Natural
Earth) und bleiben hier unangetastet. Mit Konto sieht man alles samt Namen;
Gäste bekommen Karten nur über ein Quiz, und dort ohne Namen.

Ein Kartensatz ist die Auswahl einer Lehrkraft: Kartenart, Ebenen, je Ebene
die gezeigten/nummerierten Objekte (ids) und das Nummernschema.
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_teacher, get_current_user
from ..database import get_db
from ..models import KartenSatz, Student, Teacher

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


# ── Kartensätze ──────────────────────────────────────────────────────

MAX_OBJEKTE = 300  # je Ebene


@lru_cache(maxsize=32)
def objekt_ids(ebene_id: str) -> frozenset[str]:
    sammlung = json.loads((DATEN / "ebenen" / f"{ebene_id}.geojson").read_text(encoding="utf-8"))
    return frozenset(f["properties"]["id"] for f in sammlung["features"])


class EbenenAuswahl(BaseModel):
    # »alle«: die ganze Ebene, ausgewählte Objekte bekommen Nummern;
    # »auswahl«: nur die ausgewählten Objekte sind zu sehen
    zeigen: Literal["alle", "auswahl"] = "alle"
    objekte: list[str] = Field(default_factory=list, max_length=MAX_OBJEKTE)
    nummerierung: Literal["keine", "zahl", "klein", "gross", "roemisch"] = "keine"


class Ausschnitt(BaseModel):
    west: float = Field(ge=-180, le=180)
    sued: float = Field(ge=-90, le=90)
    ost: float = Field(ge=-180, le=180)
    nord: float = Field(ge=-90, le=90)


class SatzInhalt(BaseModel):
    art: Literal["politisch", "topographisch", "stumm"]
    ebenen: list[str] = Field(max_length=50)
    beschriftung: bool = True
    ausschnitt: Ausschnitt | None = None
    auswahl: dict[str, EbenenAuswahl] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _ids_pruefen(self):
        bekannt = {e["id"]: e for e in katalog()["ebenen"]}
        for e in self.ebenen:
            if e not in bekannt:
                raise ValueError(f"Unbekannte Ebene: {e}")
        for e, wahl in self.auswahl.items():
            if e not in bekannt or bekannt[e]["geometrie"] == "raster":
                raise ValueError(f"Unbekannte Ebene: {e}")
            if len(set(wahl.objekte)) != len(wahl.objekte):
                raise ValueError(f"{e}: Objekt doppelt gewählt")
            fremd = set(wahl.objekte) - objekt_ids(e)
            if fremd:
                raise ValueError(f"{e}: unbekannte Objekte {sorted(fremd)[:3]}")
        return self


class SatzIn(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    geteilt: bool = False
    inhalt: SatzInhalt


def _kurz(s: KartenSatz, ich: Teacher) -> dict:
    return {
        "id": s.id, "titel": s.titel, "geteilt": s.geteilt, "eigen": s.created_by == ich.id,
        "autor": f"{s.autor.first_name} {s.autor.last_name}".strip() if s.autor else "",
        "aktualisiert_am": s.aktualisiert_am,
    }


def _lade_satz(db: Session, satz_id: int, ich: Teacher, *, schreiben: bool) -> KartenSatz:
    s = db.get(KartenSatz, satz_id)
    if s is None or (s.created_by != ich.id and not s.geteilt):
        raise HTTPException(404, "Kartensatz nicht gefunden")
    if schreiben and s.created_by != ich.id:
        raise HTTPException(403, "Nur die Ersteller:in darf den Kartensatz ändern")
    return s


@router.get("/saetze")
def saetze(db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    alle = (db.query(KartenSatz)
            .filter(or_(KartenSatz.created_by == ich.id, KartenSatz.geteilt.is_(True)))
            .order_by(KartenSatz.titel).all())
    return [_kurz(s, ich) for s in alle]


@router.get("/saetze/{satz_id}")
def satz(satz_id: int, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    s = _lade_satz(db, satz_id, ich, schreiben=False)
    return {**_kurz(s, ich), "inhalt": s.inhalt}


@router.post("/saetze", status_code=201)
def satz_anlegen(body: SatzIn, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    s = KartenSatz(titel=body.titel.strip(), geteilt=body.geteilt, inhalt=body.inhalt.model_dump(), created_by=ich.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {**_kurz(s, ich), "inhalt": s.inhalt}


@router.put("/saetze/{satz_id}")
def satz_aendern(satz_id: int, body: SatzIn, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    s = _lade_satz(db, satz_id, ich, schreiben=True)
    s.titel, s.geteilt, s.inhalt = body.titel.strip(), body.geteilt, body.inhalt.model_dump()
    db.commit()
    db.refresh(s)
    return {**_kurz(s, ich), "inhalt": s.inhalt}


@router.delete("/saetze/{satz_id}", status_code=204)
def satz_loeschen(satz_id: int, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    db.delete(_lade_satz(db, satz_id, ich, schreiben=True))
    db.commit()
