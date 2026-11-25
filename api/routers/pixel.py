"""Pixel-Studio: Bibliothek von Pixel-Art-Projekten je Konto, Gäste über Sitzungscode."""
import json
from datetime import datetime
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_user, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import PixelProjekt, Student, Teacher, ToolSession
from ..sitzung import anzeigename, sitzung_fuer, teilnehmer

router = APIRouter(prefix="/api/pixel", tags=["pixel"])

MAX_KONTO = 300
MAX_GAST = 40
MAX_JSON = 1_500_000
MAX_VORSCHAU = 150_000
PNG_PREFIX = "data:image/png;base64,"


class ProjektKurz(BaseModel):
    id: int
    name: str
    breite: int
    hoehe: int
    bilder: int
    vorschau: str | None = None
    geteilt: bool
    aktualisiert_am: datetime | None = None
    besitzer: str | None = None


class Projekt(ProjektKurz):
    daten: dict


class ProjektIn(BaseModel):
    name: str
    daten: dict
    vorschau: str | None = None


class ProjektUpdate(BaseModel):
    name: str | None = None
    daten: dict | None = None
    vorschau: str | None = None
    geteilt: bool | None = None


def _pruefe(daten) -> tuple[int, int, int]:
    if not isinstance(daten, dict):
        raise HTTPException(400, "Ungültiges Projekt")
    b, h, bilder = daten.get("breite"), daten.get("hoehe"), daten.get("bilder")
    ok = all(isinstance(x, int) and not isinstance(x, bool) and 1 <= x <= 256 for x in (b, h))
    if not ok or not isinstance(bilder, list) or not 1 <= len(bilder) <= 64:
        raise HTTPException(400, "Ungültige Größe oder Bilderzahl")
    if len(json.dumps(daten)) > MAX_JSON:
        raise HTTPException(413, "Projekt zu groß")
    return b, h, len(bilder)


def _name(name: str) -> str:
    name = (name or "").strip()
    if not 1 <= len(name) <= 80:
        raise HTTPException(400, "Name muss 1 bis 80 Zeichen lang sein")
    return name


def _vorschau(v: str | None) -> str | None:
    if v is not None and (not v.startswith(PNG_PREFIX) or len(v) > MAX_VORSCHAU):
        raise HTTPException(400, "Ungültige Vorschau")
    return v


def _admin(spieler) -> bool:
    return isinstance(spieler, Teacher) and spieler.role == "admin"


def _pruefe_recht(db: Session, spieler):
    if not isinstance(spieler, Guest) and not _admin(spieler) and not is_allowed(db, spieler, "pixel", "use"):
        raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (pixel/use).")


def _sitzung(code: str, db: Session) -> ToolSession:
    return sitzung_fuer(db, code, "pixel", "Diese Sitzung gehört nicht zum Pixel-Studio.")


def _eigene(db: Session, spieler, session: ToolSession | None):
    q = db.query(PixelProjekt).filter_by(**teilnehmer(spieler))
    if isinstance(spieler, Guest):
        q = q.filter(PixelProjekt.session_id == session.id)
    return q


def _kurz(db: Session, p: PixelProjekt, voll: bool = False):
    besitzer = None
    if p.teacher_id:
        t = db.get(Teacher, p.teacher_id)
        if t:
            besitzer = anzeigename(t)[0]
    felder = dict(id=p.id, name=p.name, breite=p.breite, hoehe=p.hoehe, bilder=p.bilder,
                  vorschau=p.vorschau, geteilt=p.geteilt, aktualisiert_am=p.aktualisiert_am, besitzer=besitzer)
    return Projekt(daten=p.daten, **felder) if voll else ProjektKurz(**felder)


def _schreib_check(session, spieler):
    # nur Gäste hängen an der Sitzung; Konten speichern auch nach dem Schließen am Konto weiter
    if isinstance(spieler, Guest) and session is not None and session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")


def _liste(db, spieler, session):
    _pruefe_recht(db, spieler)
    rows = _eigene(db, spieler, session).order_by(PixelProjekt.aktualisiert_am.desc(), PixelProjekt.id.desc()).all()
    return [_kurz(db, p) for p in rows]


def _vorlagen(db, spieler):
    _pruefe_recht(db, spieler)
    rows = db.query(PixelProjekt).filter_by(geteilt=True).order_by(PixelProjekt.aktualisiert_am.desc()).all()
    return [_kurz(db, p) for p in rows]


def _anlegen(db, spieler, session, body: ProjektIn):
    _pruefe_recht(db, spieler)
    _schreib_check(session, spieler)
    b, h, n = _pruefe(body.daten)
    name, vorschau = _name(body.name), _vorschau(body.vorschau)
    grenze = MAX_GAST if isinstance(spieler, Guest) else MAX_KONTO
    if _eigene(db, spieler, session).count() >= grenze:
        raise HTTPException(400, "Zu viele Projekte")
    p = PixelProjekt(name=name, breite=b, hoehe=h, bilder=n, daten=body.daten, vorschau=vorschau,
                     session_id=session.id if isinstance(spieler, Guest) else None, **teilnehmer(spieler))
    db.add(p)
    db.commit()
    db.refresh(p)
    return _kurz(db, p, True)


def _holen(db, spieler, session, pid: int):
    _pruefe_recht(db, spieler)
    p = _eigene(db, spieler, session).filter(PixelProjekt.id == pid).first()
    if p is None:
        p = db.get(PixelProjekt, pid)
        if p is None or not (p.geteilt or (_admin(spieler) and not p.guest_id)):
            raise HTTPException(404, "Projekt nicht gefunden")
    return _kurz(db, p, True)


def _aendern(db, spieler, session, pid: int, body: ProjektUpdate):
    _pruefe_recht(db, spieler)
    _schreib_check(session, spieler)
    if body.geteilt and not isinstance(spieler, Teacher):
        raise HTTPException(403, "Nur Lehrkräfte dürfen Vorlagen teilen")
    p = _eigene(db, spieler, session).filter(PixelProjekt.id == pid).first()
    if p is None:
        raise HTTPException(404, "Projekt nicht gefunden")
    if body.name is not None:
        p.name = _name(body.name)
    if body.daten is not None:
        p.breite, p.hoehe, p.bilder = _pruefe(body.daten)
        p.daten = body.daten
    if "vorschau" in body.model_fields_set:
        p.vorschau = _vorschau(body.vorschau)
    if body.geteilt is not None:
        p.geteilt = body.geteilt
    db.commit()
    db.refresh(p)
    return _kurz(db, p, True)


def _loeschen(db, spieler, session, pid: int):
    _pruefe_recht(db, spieler)
    _schreib_check(session, spieler)
    p = _eigene(db, spieler, session).filter(PixelProjekt.id == pid).first()
    if p is None:
        raise HTTPException(404, "Projekt nicht gefunden")
    db.delete(p)
    db.commit()
    return {"ok": True}


Konto = Union[Teacher, Student]
Spieler = Union[Teacher, Student, Guest]


@router.get("/projekte", response_model=list[ProjektKurz])
def konto_liste(db: Session = Depends(get_db), u: Konto = Depends(get_current_user)):
    return _liste(db, u, None)


@router.post("/projekte", response_model=Projekt)
def konto_neu(body: ProjektIn, db: Session = Depends(get_db), u: Konto = Depends(get_current_user)):
    return _anlegen(db, u, None, body)


@router.get("/vorlagen", response_model=list[ProjektKurz])
def konto_vorlagen(db: Session = Depends(get_db), u: Konto = Depends(get_current_user)):
    return _vorlagen(db, u)


@router.get("/projekte/{pid}", response_model=Projekt)
def konto_holen(pid: int, db: Session = Depends(get_db), u: Konto = Depends(get_current_user)):
    return _holen(db, u, None, pid)


@router.put("/projekte/{pid}", response_model=Projekt)
def konto_aendern(pid: int, body: ProjektUpdate, db: Session = Depends(get_db),
                  u: Konto = Depends(get_current_user)):
    return _aendern(db, u, None, pid, body)


@router.delete("/projekte/{pid}")
def konto_loeschen(pid: int, db: Session = Depends(get_db), u: Konto = Depends(get_current_user)):
    return _loeschen(db, u, None, pid)


@router.get("/sitzung/{code}/projekte", response_model=list[ProjektKurz])
def sitz_liste(code: str, db: Session = Depends(get_db), s: Spieler = Depends(get_player)):
    return _liste(db, s, _sitzung(code, db))


@router.post("/sitzung/{code}/projekte", response_model=Projekt)
def sitz_neu(code: str, body: ProjektIn, db: Session = Depends(get_db), s: Spieler = Depends(get_player)):
    return _anlegen(db, s, _sitzung(code, db), body)


@router.get("/sitzung/{code}/vorlagen", response_model=list[ProjektKurz])
def sitz_vorlagen(code: str, db: Session = Depends(get_db), s: Spieler = Depends(get_player)):
    _sitzung(code, db)
    return _vorlagen(db, s)


@router.get("/sitzung/{code}/projekte/{pid}", response_model=Projekt)
def sitz_holen(code: str, pid: int, db: Session = Depends(get_db), s: Spieler = Depends(get_player)):
    return _holen(db, s, _sitzung(code, db), pid)


@router.put("/sitzung/{code}/projekte/{pid}", response_model=Projekt)
def sitz_aendern(code: str, pid: int, body: ProjektUpdate, db: Session = Depends(get_db),
                 s: Spieler = Depends(get_player)):
    return _aendern(db, s, _sitzung(code, db), pid, body)


@router.delete("/sitzung/{code}/projekte/{pid}")
def sitz_loeschen(code: str, pid: int, db: Session = Depends(get_db), s: Spieler = Depends(get_player)):
    return _loeschen(db, s, _sitzung(code, db), pid)
