"""KI-Kompass: Kompetenzraster-Selbsteinschätzung und KI-Führerschein.

- ``GET/PUT /api/kikompass/stand``: der eigene Stand eines Kontos, über alle
  Sitzungen hinweg (Zeile ohne ``session_id``).
- ``PUT /api/kikompass/sitzung/{code}/stand``: spiegelt den Stand in eine
  Sitzung, auch für Gäste über den Code. Daraus liest die Lehrkraft.
- ``GET /api/kikompass/sitzung/{code}/uebersicht``: nur für die Lehrkraft, der
  die Sitzung gehört (oder Admin). Reflexionen sind wie Umfrage-Freitext nur
  für die Lehrkraft sichtbar.
- ``POST /api/kikompass/pruefung``: ein Modul des Führerscheins bestanden.
  Schüler·innen bekommen einmal Hauspunkte, geprüft wird der gespeicherte
  Stand, nicht das, was der Browser behauptet.

Die Station-Ids je Modul spiegeln ``frontend/src/lib/kikompass/stationen.ts``.
"""
import re
from datetime import datetime
from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import Guest, get_current_teacher, get_current_user, get_player
from ..availability import is_allowed, require_capability
from ..database import get_db
from ..display_names import short_name
from ..models import KiKompassMaterial, KiKompassPruefung, KiKompassStand, Student, Teacher, ToolSession, Transaction
from .maus import _anzeigename, _buchende_lehrkraft, _haus_name, _teilnehmer

router = APIRouter(prefix="/api/kikompass", tags=["kikompass"])

SLUG = "kikompass"

MODULE: dict[str, list[str]] = {
    "verstehen": ["v-mensch-maschine", "v-daten", "v-naechstes-wort", "v-fachwoerter"],
    "anwenden": ["a-datenschutz", "a-erster-prompt", "a-prompt-formel", "a-lernhelfer"],
    "reflektieren": ["r-echt-oder-ki", "r-ki-irrt", "r-fair"],
    "mitgestalten": ["m-ideen", "m-regeln", "m-verbessern"],
}
STATIONEN: set[str] = {sid for ids in MODULE.values() for sid in ids}
QUIZ_MIN = 2          # von 3 Fragen, spiegelt QUIZ_SCHWELLE
REFLEXION_MIN = 20    # Zeichen je Antwort, spiegelt REFLEXION_MIN
HAUSPUNKTE_JE_MODUL = 5

SATZ_ID = re.compile(r"^[varm]-(0|Ia|Ib|II|III)-\d{1,2}$")
DATUM = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Einschaetzung(BaseModel):
    datum: str
    haken: list[str] = Field(max_length=120)

    @field_validator("datum")
    @classmethod
    def _datum(cls, v: str) -> str:
        if not DATUM.match(v):
            raise ValueError("Datum im Format JJJJ-MM-TT")
        return v

    @field_validator("haken")
    @classmethod
    def _haken(cls, v: list[str]) -> list[str]:
        for h in v:
            if not SATZ_ID.match(h):
                raise ValueError(f"Unbekannter Satz: {h}")
        return sorted(set(v))


class StationStand(BaseModel):
    quiz: int = Field(ge=0, le=10)
    reflexion: list[str] = Field(default_factory=list, max_length=4)
    erledigt_am: str | None = None

    @field_validator("reflexion")
    @classmethod
    def _laenge(cls, v: list[str]) -> list[str]:
        return [t[:2000] for t in v]


class StandIn(BaseModel):
    einschaetzungen: list[Einschaetzung] = Field(default_factory=list, max_length=60)
    stationen: dict[str, StationStand] = Field(default_factory=dict)

    @field_validator("stationen")
    @classmethod
    def _stationen(cls, v: dict) -> dict:
        unbekannt = set(v) - STATIONEN
        if unbekannt:
            raise ValueError(f"Unbekannte Station: {', '.join(sorted(unbekannt))}")
        return v


class StandOut(BaseModel):
    einschaetzungen: list
    stationen: dict


class UebersichtZeile(BaseModel):
    name: str
    klasse: str | None
    gast: bool
    einschaetzungen: list
    stationen: dict


def _speichern(zeile: KiKompassStand, body: StandIn) -> None:
    zeile.einschaetzungen = [e.model_dump() for e in body.einschaetzungen]
    zeile.stationen = {sid: s.model_dump() for sid, s in body.stationen.items()}


def _darf(db: Session, spieler) -> None:
    if isinstance(spieler, Guest):
        return
    if isinstance(spieler, Teacher) and spieler.role == "admin":
        return
    if not is_allowed(db, spieler, SLUG, "use"):
        raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (kikompass/use).")


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != SLUG:
        raise HTTPException(400, "Diese Sitzung gehört nicht zum KI-Kompass.")
    return session


def _eigene_zeile(db: Session, user: Union[Teacher, Student]) -> KiKompassStand | None:
    return (
        db.query(KiKompassStand)
        .filter(KiKompassStand.session_id.is_(None))
        .filter_by(**_teilnehmer(user))
        .first()
    )


@router.get("/stand", response_model=StandOut)
def stand_laden(db: Session = Depends(get_db), user: Union[Teacher, Student] = Depends(get_current_user)):
    zeile = _eigene_zeile(db, user)
    if zeile is None:
        return StandOut(einschaetzungen=[], stationen={})
    return StandOut(einschaetzungen=zeile.einschaetzungen, stationen=zeile.stationen)


@router.put("/stand")
def stand_speichern(
    body: StandIn, db: Session = Depends(get_db), user: Union[Teacher, Student] = Depends(get_current_user),
):
    _darf(db, user)
    zeile = _eigene_zeile(db, user)
    name, klasse, gast = _anzeigename(user)
    if zeile is None:
        zeile = KiKompassStand(session_id=None, name=name, klasse=klasse, gast=gast, **_teilnehmer(user))
        db.add(zeile)
    zeile.name, zeile.klasse = name, klasse
    _speichern(zeile, body)
    db.commit()
    return {"ok": True}


@router.put("/sitzung/{code}/stand")
def sitzung_stand(
    code: str,
    body: StandIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    _darf(db, spieler)
    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)
    zeile = db.query(KiKompassStand).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = KiKompassStand(session_id=session.id, name=name, klasse=klasse, gast=gast, **wer)
        db.add(zeile)
    zeile.name, zeile.klasse, zeile.gast = name, klasse, gast
    _speichern(zeile, body)
    db.commit()
    return {"ok": True}


@router.get("/sitzung/{code}/uebersicht", response_model=list[UebersichtZeile])
def uebersicht(code: str, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    session = _sitzung(code, db)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    zeilen = db.query(KiKompassStand).filter_by(session_id=session.id).all()
    zeilen.sort(key=lambda z: z.name.lower())
    return [
        UebersichtZeile(name=z.name, klasse=z.klasse, gast=z.gast,
                        einschaetzungen=z.einschaetzungen, stationen=z.stationen)
        for z in zeilen
    ]


class MeineSitzungOut(BaseModel):
    code: str
    settings: dict


@router.get("/meine-sitzung", response_model=MeineSitzungOut | None)
def meine_sitzung(db: Session = Depends(get_db), user: Union[Teacher, Student] = Depends(get_current_user)):
    """Die zuletzt genutzte offene KI-Kompass-Sitzung dieses Kontos, also
    die, in die es zuletzt über den Code seinen Stand gespiegelt hat. So sehen
    Lernende den AIS.chat-Link der Lehrkraft auch, wenn sie den KI-Kompass
    direkt öffnen statt über den Code."""
    zeile = (
        db.query(KiKompassStand, ToolSession)
        .join(ToolSession, ToolSession.id == KiKompassStand.session_id)
        .filter(ToolSession.tool_slug == SLUG, ToolSession.status != "closed")
        .filter(*[getattr(KiKompassStand, k) == v for k, v in _teilnehmer(user).items()])
        .order_by(KiKompassStand.aktualisiert_am.desc(), KiKompassStand.id.desc())
        .first()
    )
    if zeile is None:
        return None
    return MeineSitzungOut(code=zeile[1].code, settings=zeile[1].settings or {})


def _modul_fertig(stationen: dict, modul: str) -> bool:
    for sid in MODULE[modul]:
        s = stationen.get(sid)
        if not s or s.get("quiz", 0) < QUIZ_MIN:
            return False
        texte = s.get("reflexion") or []
        if not texte or any(len((t or "").strip()) < REFLEXION_MIN for t in texte):
            return False
    return True


class PruefungIn(BaseModel):
    modul: Literal["verstehen", "anwenden", "reflektieren", "mitgestalten"]
    code: str | None = None


class PruefungOut(BaseModel):
    bestanden: bool
    punkte: int
    schon_vergeben: bool
    haus: str | None


@router.post("/pruefung", response_model=PruefungOut, dependencies=[Depends(require_capability(SLUG, "use"))])
def pruefung(
    body: PruefungIn, db: Session = Depends(get_db), user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Ein Modul ist bestanden, wenn der gespeicherte eigene Stand alle Stationen
    vollständig hat. Nur Schülerkonten bekommen Hauspunkte, einmal je Modul."""
    zeile = _eigene_zeile(db, user)
    if zeile is None or not _modul_fertig(zeile.stationen, body.modul):
        raise HTTPException(400, "Dieses Modul ist noch nicht vollständig.")
    if not isinstance(user, Student):
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)
    if db.query(KiKompassPruefung).filter_by(student_id=user.id, modul=body.modul).first():
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=True, haus=_haus_name(db, user.class_id))
    if user.class_id is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)
    buchende = _buchende_lehrkraft(db, user, body.code, slug=SLUG)
    if buchende is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)
    db.add(Transaction(
        teacher_id=buchende.id, class_id=user.class_id, points=HAUSPUNKTE_JE_MODUL,
        reason=f"KI-Führerschein Modul {body.modul.capitalize()} bestanden: {short_name(user)}",
    ))
    db.add(KiKompassPruefung(student_id=user.id, modul=body.modul,
                             punkte=HAUSPUNKTE_JE_MODUL, class_id=user.class_id))
    db.commit()
    return PruefungOut(bestanden=True, punkte=HAUSPUNKTE_JE_MODUL, schon_vergeben=False,
                       haus=_haus_name(db, user.class_id))


# ───────────────────────────────────────────────────────── Materialpool ──
# Für alle Lehrkräfte sichtbar, nicht für Schüler·innen oder Gäste.

BEREICHE = {"verstehen", "anwenden", "reflektieren", "mitgestalten"}
STUFEN = {"0", "Ia", "Ib", "II", "III"}
DIMENSIONEN = {"mit", "ueber", "durch", "trotz", "ohne"}


class MaterialIn(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    text: str = Field(default="", max_length=20000)
    fach: str = Field(default="", max_length=60)
    klassen: str = Field(default="", max_length=20)
    bereich: str
    stufe: str
    dimension: str
    art: str = Field(default="", max_length=80)
    link: str | None = Field(default=None, max_length=500)

    @field_validator("titel")
    @classmethod
    def _titel(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Titel fehlt")
        return v

    @field_validator("bereich")
    @classmethod
    def _bereich(cls, v: str) -> str:
        if v not in BEREICHE:
            raise ValueError("Unbekannter Bereich")
        return v

    @field_validator("stufe")
    @classmethod
    def _stufe(cls, v: str) -> str:
        if v not in STUFEN:
            raise ValueError("Unbekannte Stufe")
        return v

    @field_validator("dimension")
    @classmethod
    def _dimension(cls, v: str) -> str:
        if v not in DIMENSIONEN:
            raise ValueError("Unbekannte Dimension")
        return v

    @field_validator("link")
    @classmethod
    def _link(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if not v:
            return None
        if not re.match(r"^https?://\S+$", v):
            raise ValueError("Link muss mit http:// oder https:// beginnen")
        return v


class MaterialOut(BaseModel):
    id: int
    titel: str
    text: str
    fach: str
    klassen: str
    bereich: str
    stufe: str
    dimension: str
    art: str
    link: str | None
    autor: str
    eigen: bool
    erstellt_am: datetime


def _material_out(m: KiKompassMaterial, teacher: Teacher) -> MaterialOut:
    return MaterialOut(
        id=m.id, titel=m.titel, text=m.text, fach=m.fach, klassen=m.klassen, bereich=m.bereich,
        stufe=m.stufe, dimension=m.dimension, art=m.art, link=m.link, autor=m.autor,
        eigen=m.teacher_id == teacher.id, erstellt_am=m.erstellt_am,
    )


def _lehrkraft_darf(db: Session, teacher: Teacher) -> None:
    if teacher.role != "admin" and not is_allowed(db, teacher, SLUG, "use"):
        raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (kikompass/use).")


def _eigenes_material(db: Session, material_id: int, teacher: Teacher) -> KiKompassMaterial:
    m = db.get(KiKompassMaterial, material_id)
    if m is None:
        raise HTTPException(404, "Material nicht gefunden")
    if m.teacher_id != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Nur wer das Material eingestellt hat, darf es ändern.")
    return m


@router.get("/material", response_model=list[MaterialOut])
def material_liste(
    bereich: str | None = None,
    stufe: str | None = None,
    dimension: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    _lehrkraft_darf(db, teacher)
    query = db.query(KiKompassMaterial)
    if bereich:
        query = query.filter(KiKompassMaterial.bereich == bereich)
    if stufe:
        query = query.filter(KiKompassMaterial.stufe == stufe)
    if dimension:
        query = query.filter(KiKompassMaterial.dimension == dimension)
    if q and q.strip():
        muster = f"%{q.strip()[:100]}%"
        query = query.filter(or_(
            KiKompassMaterial.titel.ilike(muster), KiKompassMaterial.text.ilike(muster),
            KiKompassMaterial.fach.ilike(muster),
        ))
    zeilen = query.order_by(KiKompassMaterial.erstellt_am.desc(), KiKompassMaterial.id.desc()).limit(500).all()
    return [_material_out(m, teacher) for m in zeilen]


@router.post("/material", response_model=MaterialOut, status_code=201)
def material_anlegen(body: MaterialIn, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    _lehrkraft_darf(db, teacher)
    autor, _, _ = _anzeigename(teacher)
    m = KiKompassMaterial(teacher_id=teacher.id, autor=autor, **body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return _material_out(m, teacher)


@router.put("/material/{material_id}", response_model=MaterialOut)
def material_aendern(
    material_id: int, body: MaterialIn, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher),
):
    m = _eigenes_material(db, material_id, teacher)
    for k, v in body.model_dump().items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _material_out(m, teacher)


@router.delete("/material/{material_id}", status_code=204)
def material_loeschen(material_id: int, db: Session = Depends(get_db), teacher: Teacher = Depends(get_current_teacher)):
    db.delete(_eigenes_material(db, material_id, teacher))
    db.commit()
