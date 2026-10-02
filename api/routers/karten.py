"""Kartentool: liefert die Kartenebenen aus data/karten/ und speichert Kartensätze.

Die Ebenen erzeugt ``frontend/scripts/fetch-karten.mjs`` (BKG + Natural
Earth) und bleiben hier unangetastet. Mit Konto sieht man alles samt Namen;
Gäste bekommen Karten nur über ein Quiz, und dort ohne Namen.

Ein Kartensatz ist die Auswahl einer Lehrkraft: Kartenart, Ebenen, je Ebene
die gezeigten/nummerierten Objekte (ids) und das Nummernschema.
"""
import base64
import gzip
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal, Union
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_teacher, get_current_user
from ..database import get_db
from ..karten_quiz import ankerpunkt, normalisiere
from ..karten_eigene import MAX_BYTES, UploadFehler, geometrie_von, lies_upload, mit_namen
from ..karten_export import MEDIENTYP, exportiere
from ..models import KartenEbeneEigen, KartenSatz, Student, Teacher

router = APIRouter(prefix="/api/karten", tags=["karten"])

DATEN = Path(__file__).resolve().parents[2] / "data" / "karten"


@lru_cache(maxsize=64)
def _gzip(pfad: Path, stand: float) -> bytes:
    """Gepackte Ebene, je Datei und Änderungszeit einmal (GeoJSON schrumpft auf ein Fünftel)."""
    return gzip.compress(pfad.read_bytes(), compresslevel=6)


def geojson_antwort(pfad: Path, request: Request, cache: str) -> Response:
    """Ebene ausliefern — gepackt, wenn der Browser es kann (de-orte: 9 MB → 1,2 MB)."""
    if "gzip" in request.headers.get("accept-encoding", ""):
        return Response(_gzip(pfad, pfad.stat().st_mtime), media_type="application/geo+json",
                        headers={"Content-Encoding": "gzip", "Cache-Control": cache, "Vary": "Accept-Encoding"})
    return FileResponse(pfad, media_type="application/geo+json", headers={"Cache-Control": cache})


@lru_cache(maxsize=1)
def katalog() -> dict:
    return json.loads((DATEN / "ebenen.json").read_text(encoding="utf-8"))


EIGENE = DATEN / "eigene"
EIGEN_PRAEFIX = "eigen-"


def _sichtbare_eigene(db: Session, wer: Union[Teacher, Student]):
    """Eigene Ebenen, die jemand sehen darf: die eigenen und alle geteilten."""
    q = db.query(KartenEbeneEigen)
    if isinstance(wer, Teacher):
        q = q.filter(or_(KartenEbeneEigen.created_by == wer.id, KartenEbeneEigen.geteilt.is_(True)))
    else:
        q = q.filter(KartenEbeneEigen.geteilt.is_(True))
    return q.order_by(KartenEbeneEigen.titel).all()


def _eigen_eintrag(e: KartenEbeneEigen, wer: Union[Teacher, Student]) -> dict:
    autor = f"{e.autor.first_name} {e.autor.last_name}".strip() if e.autor else ""
    return {
        "id": f"{EIGEN_PRAEFIX}{e.id}", "name": e.titel, "gruppe": "eigen", "bereich": "eigen",
        "geometrie": e.geometrie, "quiz": True, "anzahl": e.anzahl, "bytes": 0,
        "quelle": {"name": f"Eigene Daten ({autor})" if autor else "Eigene Daten", "lizenz": "", "url": ""},
        "eigen": {"id": e.id, "eigen": isinstance(wer, Teacher) and e.created_by == wer.id, "geteilt": e.geteilt,
                  "namensfeld": e.namensfeld, "felder": e.felder, "dateiname": e.dateiname},
    }


def _eigene_ebene(db: Session, ebene_id: str, wer: Union[Teacher, Student]) -> KartenEbeneEigen:
    nummer = ebene_id.removeprefix(EIGEN_PRAEFIX)
    e = db.get(KartenEbeneEigen, int(nummer)) if nummer.isdigit() else None
    if e is None or e not in _sichtbare_eigene(db, wer):
        raise HTTPException(404, "Unbekannte Ebene")
    return e


@router.get("/ebenen")
def ebenen(db: Session = Depends(get_db), wer: Union[Teacher, Student] = Depends(get_current_user)):
    basis = katalog()
    return {**basis, "ebenen": basis["ebenen"] + [_eigen_eintrag(e, wer) for e in _sichtbare_eigene(db, wer)]}


@router.get("/ebenen/{ebene_id}")
def ebene(ebene_id: str, request: Request, db: Session = Depends(get_db), wer: Union[Teacher, Student] = Depends(get_current_user)):
    if ebene_id.startswith(EIGEN_PRAEFIX):
        e = _eigene_ebene(db, ebene_id, wer)
        return geojson_antwort(EIGENE / f"{e.id}.geojson", request, "no-cache")
    eintrag = next((e for e in katalog()["ebenen"] if e["id"] == ebene_id), None)
    if eintrag is None or eintrag["geometrie"] == "raster":
        raise HTTPException(404, "Unbekannte Ebene")
    return geojson_antwort(DATEN / "ebenen" / f"{ebene_id}.geojson", request, "private, max-age=86400")


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
    # Region aus frontend/src/lib/karten/stil.ts::REGIONEN (Deutschland, Europa, Welt …)
    region: str = Field(default="deutschland", max_length=30, pattern=r"^[a-z]+$")
    ebenen: list[str] = Field(max_length=50)
    beschriftung: bool = True
    ausschnitt: Ausschnitt | None = None
    auswahl: dict[str, EbenenAuswahl] = Field(default_factory=dict)
    # Größenklassen-Filter je Ebene (Siedlungen: welche »rang«-Werte gezeigt werden)
    filter: dict[str, list[str]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _ids_pruefen(self):
        # Eigene Ebenen (»eigen-…«) prüft _pruefe_eigene mit Datenbank und Rechten
        bekannt = {e["id"]: e for e in katalog()["ebenen"]}
        for e in self.ebenen:
            if e not in bekannt and not e.startswith(EIGEN_PRAEFIX):
                raise ValueError(f"Unbekannte Ebene: {e}")
        for e, wahl in self.auswahl.items():
            if len(set(wahl.objekte)) != len(wahl.objekte):
                raise ValueError(f"{e}: Objekt doppelt gewählt")
            if e.startswith(EIGEN_PRAEFIX):
                continue
            if e not in bekannt or bekannt[e]["geometrie"] == "raster":
                raise ValueError(f"Unbekannte Ebene: {e}")
            fremd = set(wahl.objekte) - objekt_ids(e)
            if fremd:
                raise ValueError(f"{e}: unbekannte Objekte {sorted(fremd)[:3]}")
        return self


class SatzIn(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    geteilt: bool = False
    inhalt: SatzInhalt


def _pruefe_eigene(inhalt: SatzInhalt, db: Session, ich: Teacher) -> None:
    for e in {*inhalt.ebenen, *inhalt.auswahl} - {k["id"] for k in katalog()["ebenen"]}:
        try:
            eigen = _eigene_ebene(db, e, ich)
        except HTTPException:
            raise HTTPException(422, f"Unbekannte Ebene: {e}") from None
        if e in inhalt.auswahl:
            ids = {f["properties"]["id"] for f in json.loads((EIGENE / f"{eigen.id}.geojson").read_text(encoding="utf-8"))["features"]}
            fremd = set(inhalt.auswahl[e].objekte) - ids
            if fremd:
                raise HTTPException(422, f"{e}: unbekannte Objekte {sorted(fremd)[:3]}")


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
    _pruefe_eigene(body.inhalt, db, ich)
    s = KartenSatz(titel=body.titel.strip(), geteilt=body.geteilt, inhalt=body.inhalt.model_dump(), created_by=ich.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {**_kurz(s, ich), "inhalt": s.inhalt}


@router.put("/saetze/{satz_id}")
def satz_aendern(satz_id: int, body: SatzIn, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    s = _lade_satz(db, satz_id, ich, schreiben=True)
    _pruefe_eigene(body.inhalt, db, ich)
    s.titel, s.geteilt, s.inhalt = body.titel.strip(), body.geteilt, body.inhalt.model_dump()
    db.commit()
    db.refresh(s)
    return {**_kurz(s, ich), "inhalt": s.inhalt}


@router.delete("/saetze/{satz_id}", status_code=204)
def satz_loeschen(satz_id: int, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    db.delete(_lade_satz(db, satz_id, ich, schreiben=True))
    db.commit()


# ── Arbeitsblatt-Export ──────────────────────────────────────────────

MAX_BILD = 12 * 1024 * 1024


class ExportEintrag(BaseModel):
    marke: str = Field(max_length=12)
    name: str = Field(max_length=200)


class ExportGruppe(BaseModel):
    name: str = Field(max_length=100)
    eintraege: list[ExportEintrag] = Field(max_length=MAX_OBJEKTE)


class ExportIn(BaseModel):
    format: Literal["pdf", "docx", "odt", "tex"]
    variante: Literal["aufgabe", "loesung", "beide"] = "aufgabe"
    titel: str = Field(min_length=1, max_length=200)
    aufgabe: str = Field(max_length=1000)
    gruppen: list[ExportGruppe] = Field(max_length=30)
    # MapLibre-Canvas als data:image/png;base64,…
    karte: str = Field(max_length=MAX_BILD * 4 // 3 + 100)


@router.post("/export")
def export(body: ExportIn, _: Teacher = Depends(get_current_teacher)):
    treffer = re.fullmatch(r"data:image/png;base64,([A-Za-z0-9+/=]+)", body.karte)
    if not treffer:
        raise HTTPException(422, "Kartenbild fehlt oder ist kein PNG")
    png = base64.b64decode(treffer.group(1))
    if not png.startswith(b"\x89PNG"):
        raise HTTPException(422, "Kartenbild ist kein PNG")
    quelle = " · ".join(dict.fromkeys(e["quelle"]["name"] for e in katalog()["ebenen"]))
    ergebnis = exportiere(body.format, body.titel, body.aufgabe, [g.model_dump() for g in body.gruppen],
                          body.variante, png, quelle)
    if ergebnis is None:
        raise HTTPException(503, "Umwandlung fehlgeschlagen (LibreOffice/pandoc)")
    inhalt, endung = ergebnis
    datei = re.sub(r"[^A-Za-z0-9ÄÖÜäöüß_-]+", "_", body.titel).strip("_") or "karte"
    return Response(inhalt, media_type=MEDIENTYP[body.format],
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(datei)}.{endung}"})


# ── Eigene Ebenen (Upload) ───────────────────────────────────────────

def _schreibe_eigene(e: KartenEbeneEigen, features: list[dict]) -> None:
    EIGENE.mkdir(parents=True, exist_ok=True)
    (EIGENE / f"{e.id}.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": mit_namen(features, e.namensfeld)}, ensure_ascii=False),
        encoding="utf-8")


def _meine_eigene(db: Session, eigen_id: int, ich: Teacher) -> KartenEbeneEigen:
    e = db.get(KartenEbeneEigen, eigen_id)
    if e is None or (e.created_by != ich.id and not e.geteilt):
        raise HTTPException(404, "Ebene nicht gefunden")
    if e.created_by != ich.id:
        raise HTTPException(403, "Nur die Ersteller:in darf die Ebene ändern")
    return e


@router.post("/eigene", status_code=201)
async def eigene_hochladen(datei: UploadFile = File(...), titel: str = Form("", max_length=200),
                           db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    roh = await datei.read(MAX_BYTES + 1)
    try:
        features, felder, namensfeld = lies_upload(datei.filename or "", roh)
    except UploadFehler as fehler:
        raise HTTPException(422, str(fehler)) from None
    name = (datei.filename or "Ebene")[:200]
    e = KartenEbeneEigen(titel=(titel.strip() or name.rsplit(".", 1)[0])[:200], dateiname=name, namensfeld=namensfeld,
                         felder=felder, geometrie=geometrie_von(features), anzahl=len(features), created_by=ich.id)
    db.add(e)
    db.flush()
    _schreibe_eigene(e, features)
    db.commit()
    db.refresh(e)
    return _eigen_eintrag(e, ich)


class EigeneIn(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    geteilt: bool = False
    namensfeld: str = Field(default="", max_length=60)


@router.put("/eigene/{eigen_id}")
def eigene_aendern(eigen_id: int, body: EigeneIn, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    e = _meine_eigene(db, eigen_id, ich)
    if body.namensfeld and body.namensfeld not in e.felder:
        raise HTTPException(422, "Dieses Feld gibt es in der Datei nicht")
    e.titel, e.geteilt = body.titel.strip(), body.geteilt
    if body.namensfeld != e.namensfeld:
        e.namensfeld = body.namensfeld
        features = json.loads((EIGENE / f"{e.id}.geojson").read_text(encoding="utf-8"))["features"]
        _schreibe_eigene(e, features)
    db.commit()
    db.refresh(e)
    return _eigen_eintrag(e, ich)


@router.delete("/eigene/{eigen_id}", status_code=204)
def eigene_loeschen(eigen_id: int, db: Session = Depends(get_db), ich: Teacher = Depends(get_current_teacher)):
    e = _meine_eigene(db, eigen_id, ich)
    (EIGENE / f"{e.id}.geojson").unlink(missing_ok=True)
    db.delete(e)
    db.commit()


# ── Ortssuche ────────────────────────────────────────────────────────

def _suchname(s: str) -> str:
    return normalisiere(s)


@lru_cache(maxsize=1)
def _suchindex() -> list[tuple[str, dict]]:
    """Alle benannten Objekte der Grundebenen (Quiz-Ebenen): (Suchname, Treffer)."""
    index = []
    for e in katalog()["ebenen"]:
        if e["geometrie"] == "raster" or not e.get("quiz"):
            continue
        for f in json.loads((DATEN / "ebenen" / f"{e['id']}.geojson").read_text(encoding="utf-8"))["features"]:
            p = f["properties"]
            if not p.get("name"):
                continue
            zusatz = p.get("gemeinde") or p.get("land") or (f"{p['hoehe']} m" if p.get("hoehe") else "")
            index.append((_suchname(p["name"]), {
                "ebene": e["id"], "ebene_name": e["name"], "bereich": e["bereich"], "id": p["id"], "name": p["name"],
                "zusatz": zusatz, "rang": p.get("rang"), "_geometrie": f["geometry"],
                "_gemeinde": _suchname(p.get("gemeinde") or ""), "_ew": p.get("ew") or 0,
            }))
    return index


@router.get("/suche")
def suche(q: str, bereich: str | None = None, _: Union[Teacher, Student] = Depends(get_current_user)):
    """Orte, Flüsse, Berge … nach Namen. Ortsteile werden auch über ihre Gemeinde gefunden
    (»Trusetal« → Brotterode-Trusetal mit Trusen, Elmenthal …)."""
    n = _suchname(q)
    if len(n) < 2:
        return []
    treffer = []
    for name, t in _suchindex():
        if bereich and t["bereich"] != bereich:
            continue
        if name.startswith(n):
            treffer.append((0, -t["_ew"], t))
        elif n in name:
            treffer.append((1, -t["_ew"], t))
        elif n in t["_gemeinde"]:
            treffer.append((2, -t["_ew"], t))
    treffer.sort(key=lambda x: (x[0], x[1], x[2]["name"]))
    # Ankerpunkt nur für die gezeigten Treffer (bei Staaten teuer)
    return [{**{k: v for k, v in t.items() if not k.startswith("_")}, "punkt": ankerpunkt(t["_geometrie"])} for _, _, t in treffer[:15]]
