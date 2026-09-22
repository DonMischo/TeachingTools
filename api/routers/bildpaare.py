"""Bildpaare fuer die Station »Echt oder KI?« der KI-Werkstatt.

Eine Lehrkraft legt Paare an: zwei Bilder, davon eines echt. Die Klasse raet
sie spaeter ueber den Sitzungscode durch — auf dem eigenen Geraet.

Zwei Dinge sind hier wichtiger als der Rest:

**Die Antwort darf nicht aus der Seite ablesbar sein.** Die Spielansicht
liefert die beiden Bilder nur als »a« und »b«; welches echt ist, sagt erst
``/aufloesung``, und das auch erst, wenn geraten wurde. Deshalb bekommt jedes
Paar beim Anlegen ein gewuerfeltes ``gedreht``, und deshalb heissen die Dateien
nach einer zufaelligen Kennung statt nach ihrer Rolle.

**Gaeste kommen nur ueber ihren Code an die Bilder.** Gespielt wird mit den
Paaren der Lehrkraft, der die Sitzung gehoert — niemand sieht die Sammlung
einer fremden Lehrkraft, und ohne Sitzung sieht ein Gast gar nichts.
"""
import random
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_teacher, get_player
from ..models import BildPaar, Teacher, ToolSession
from ..upload_utils import IMAGE_EXTENSIONS, MAX_FILE_BYTES

router = APIRouter(prefix="/api/bildpaare", tags=["bildpaare"])

ORDNER = Path(__file__).parent.parent.parent / "data" / "bildpaare"
# Ein Bild je Seite, und Bilder fuers Ratespiel muessen nicht gross sein.
MAX_BILD_BYTES = min(MAX_FILE_BYTES, 8 * 1024 * 1024)


class PaarOut(BaseModel):
    """Die Sicht der Lehrkraft — mit Aufloesung, es ist ja ihre Sammlung."""
    id: int
    titel: str
    hinweis: str
    echt_url: str
    ki_url: str


class SpielPaarOut(BaseModel):
    """Die Sicht der Spielenden — ohne jeden Hinweis darauf, welches echt ist."""
    id: int
    titel: str
    a_url: str
    b_url: str


class AufloesungOut(BaseModel):
    id: int
    # "a" oder "b"
    echt: str
    hinweis: str


def _url(datei: str) -> str:
    return f"/uploads/bildpaare/{datei}"


def _paar_out(p: BildPaar) -> PaarOut:
    return PaarOut(id=p.id, titel=p.titel, hinweis=p.hinweis,
                   echt_url=_url(p.echt_datei), ki_url=_url(p.ki_datei))


def _spiel_out(p: BildPaar) -> SpielPaarOut:
    # `gedreht` entscheidet, auf welcher Seite das echte Bild landet.
    a, b = (p.ki_datei, p.echt_datei) if p.gedreht else (p.echt_datei, p.ki_datei)
    return SpielPaarOut(id=p.id, titel=p.titel, a_url=_url(a), b_url=_url(b))


async def _speichere(datei: UploadFile) -> str:
    """Ein Bild ablegen und seinen zufaelligen Dateinamen zurueckgeben."""
    ext = Path(datei.filename or "").suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Das ist kein Bild: {ext or datei.filename}")
    # SVG kann Skripte enthalten und waere hier ohnehin sinnlos.
    if ext == ".svg":
        raise HTTPException(400, "SVG geht hier nicht — bitte ein Foto oder PNG.")
    rohdaten = await datei.read(MAX_BILD_BYTES + 1)
    if len(rohdaten) > MAX_BILD_BYTES:
        raise HTTPException(413, "Bild zu groß (höchstens 8 MB).")
    if not rohdaten:
        raise HTTPException(422, "Die Datei ist leer.")
    ORDNER.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (ORDNER / name).write_bytes(rohdaten)
    return name


@router.post("", response_model=PaarOut, status_code=201)
async def anlegen(
    echt: UploadFile = File(...),
    ki: UploadFile = File(...),
    titel: str = Form(""),
    hinweis: str = Form(""),
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Ein Paar anlegen: das echte Bild zuerst, das erzeugte als zweites."""
    echt_datei = await _speichere(echt)
    try:
        ki_datei = await _speichere(ki)
    except HTTPException:
        # Das erste Bild liegt schon da — es waere sonst eine Waise.
        (ORDNER / echt_datei).unlink(missing_ok=True)
        raise

    paar = BildPaar(
        created_by=teacher.id,
        titel=titel.strip()[:120],
        hinweis=hinweis.strip()[:2000],
        echt_datei=echt_datei,
        ki_datei=ki_datei,
        gedreht=random.random() < 0.5,
    )
    db.add(paar)
    db.commit()
    db.refresh(paar)
    return _paar_out(paar)


@router.get("", response_model=list[PaarOut])
def meine(db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    """Die eigene Sammlung, neueste zuerst."""
    zeilen = (
        db.query(BildPaar)
        .filter_by(created_by=teacher.id)
        .order_by(BildPaar.id.desc())
        .all()
    )
    return [_paar_out(p) for p in zeilen]


@router.get("/spiel", response_model=list[SpielPaarOut])
def spiel(
    code: str,
    db: Session = Depends(get_db),
    _spieler=Depends(get_player),
):
    """Die Paare zum Raten — die der Lehrkraft, der die Sitzung gehoert."""
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session or session.tool_slug != "ki":
        raise HTTPException(404, "Zu diesem Code gibt es keine KI-Werkstatt.")
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    zeilen = (
        db.query(BildPaar)
        .filter_by(created_by=session.created_by)
        .order_by(BildPaar.id)
        .all()
    )
    return [_spiel_out(p) for p in zeilen]


@router.get("/{paar_id}/aufloesung", response_model=AufloesungOut)
def aufloesung(
    paar_id: int,
    code: str,
    db: Session = Depends(get_db),
    _spieler=Depends(get_player),
):
    """Welches Bild echt war — erst nach dem Raten abgefragt."""
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session or session.tool_slug != "ki":
        raise HTTPException(404, "Zu diesem Code gibt es keine KI-Werkstatt.")
    paar = db.get(BildPaar, paar_id)
    # Nur Paare dieser Sitzung: sonst liesse sich die Sammlung einer fremden
    # Lehrkraft Stueck fuer Stueck aufloesen.
    if not paar or paar.created_by != session.created_by:
        raise HTTPException(404, "Paar nicht gefunden")
    return AufloesungOut(id=paar.id, echt="b" if paar.gedreht else "a", hinweis=paar.hinweis)


@router.delete("/{paar_id}", status_code=204)
def loeschen(
    paar_id: int,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    paar = db.get(BildPaar, paar_id)
    if not paar:
        raise HTTPException(404, "Paar nicht gefunden")
    if paar.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Dieses Paar gehört jemand anderem.")
    for datei in (paar.echt_datei, paar.ki_datei):
        (ORDNER / datei).unlink(missing_ok=True)
    db.delete(paar)
    db.commit()
