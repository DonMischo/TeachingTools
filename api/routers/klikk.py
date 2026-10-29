"""Werbeauktion zu »Klikk«: die Klasse versteigert ihre eigenen Werbe-Profile.

Ablauf: Wer im Datenspiegel zustimmt, gibt sein Profil anonym ab
(``PUT /profil``) und spielt dafür eine Werbefirma mit 100 Talern Budget. Die
Lehrkraft ruft Profil für Profil auf (``POST /steuern``: naechstes, zuschlag,
zuruecksetzen); alle bieten (``POST /gebot``), das höchste Gebot gewinnt. Den
Stand holen alle per ``GET /auktion`` (Polling) — ohne Namen: auch die
Lehrkraft sieht nur Profilnummern.

Der Auktionsstand liegt in ``ToolSession.settings["auktion"]``.
"""
from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import Guest, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import KlikkGebot, KlikkProfil, Student, Teacher, ToolSession

router = APIRouter(prefix="/api/klikk/sitzung", tags=["klikk"])

BUDGET = 100
# Firma → Merkmal, auf das sie es abgesehen hat (Titel aus lib/klikk/profil.ts)
FIRMEN: list[tuple[str, str]] = [
    ("SlimFast Pro", "Körperbild"),
    ("VOLT Energy", "Schlafrhythmus"),
    ("Sneakr", "Kaufinteresse"),
    ("Pizza Blitz", "Orte"),
    ("LernTurbo", "Erreichbarkeit"),
    ("Candy Blast", "Stimmung"),
]
SUCHT = dict(FIRMEN)


class Merkmal(BaseModel):
    titel: str = Field(max_length=40)
    wert: str = Field(max_length=120)
    heikel: bool = False


class ProfilIn(BaseModel):
    merkmale: list[Merkmal] = Field(max_length=15)


class Ich(BaseModel):
    nr: int
    firma: str
    sucht: str
    budget: int


class Verkauft(BaseModel):
    nr: int
    merkmale: list[Merkmal]
    preis: int
    firma: str | None
    gebote: int
    selbst_gekauft: bool = False
    eigenes: bool = False


class Aktuell(BaseModel):
    nr: int
    merkmale: list[Merkmal]
    offen: bool
    gebote: int
    hoechstes: int | None
    eigenes: bool
    mein_gebot: int | None


class AuktionOut(BaseModel):
    profile: int
    lehrkraft: bool
    ich: Ich | None
    aktuell: Aktuell | None
    verkauft: list[Verkauft]


class GebotIn(BaseModel):
    betrag: int = Field(ge=1, le=BUDGET)


class SteuernIn(BaseModel):
    aktion: Literal["naechstes", "zuschlag", "zuruecksetzen"]


def _teilnehmer(spieler: Union[Teacher, Student, Guest]) -> dict:
    if isinstance(spieler, Student):
        return {"student_id": spieler.id}
    if isinstance(spieler, Teacher):
        return {"teacher_id": spieler.id}
    return {"guest_id": spieler.id}


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "klikk":
        raise HTTPException(400, "Diese Sitzung gehört nicht zu »Klikk«.")
    return session


def _darf_mitmachen(db: Session, session: ToolSession, spieler) -> None:
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, "klikk", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (klikk/use).")


def _ist_leitung(session: ToolSession, spieler) -> bool:
    return isinstance(spieler, Teacher) and (spieler.id == session.created_by or spieler.role == "admin")


def _stand(session: ToolSession) -> dict:
    a = (session.settings or {}).get("auktion") or {}
    return {"aktuell": a.get("aktuell"), "offen": bool(a.get("offen")), "verkauft": list(a.get("verkauft") or [])}


def _speichern(session: ToolSession, stand: dict) -> None:
    # Neues dict zuweisen, sonst bemerkt SQLAlchemy die Änderung am JSON nicht
    session.settings = {**(session.settings or {}), "auktion": stand}


def _ausgegeben(stand: dict, profil_id: int) -> int:
    return sum(v["preis"] for v in stand["verkauft"] if v.get("bieter_id") == profil_id)


@router.put("/{code}/profil", response_model=Ich)
def profil_abgeben(
    code: str, body: ProfilIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Das eigene Profil anonym abgeben. Ein zweites Abgeben ersetzt die Merkmale,
    Nummer und Firma bleiben."""
    session = _sitzung(code, db)
    _darf_mitmachen(db, session, spieler)
    wer = _teilnehmer(spieler)
    profil = db.query(KlikkProfil).filter_by(session_id=session.id, **wer).first()
    if profil is None:
        nr = (db.query(func.max(KlikkProfil.nr)).filter_by(session_id=session.id).scalar() or 0) + 1
        profil = KlikkProfil(session_id=session.id, nr=nr, firma=FIRMEN[(nr - 1) % len(FIRMEN)][0], **wer)
        db.add(profil)
    profil.merkmale = [m.model_dump() for m in body.merkmale]
    db.commit()
    db.refresh(profil)
    stand = _stand(session)
    return Ich(nr=profil.nr, firma=profil.firma, sucht=SUCHT[profil.firma], budget=BUDGET - _ausgegeben(stand, profil.id))


@router.get("/{code}/auktion", response_model=AuktionOut)
def auktion(
    code: str,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    stand = _stand(session)
    profile = {p.nr: p for p in db.query(KlikkProfil).filter_by(session_id=session.id).all()}
    ich_profil = db.query(KlikkProfil).filter_by(session_id=session.id, **_teilnehmer(spieler)).first()
    ich = ich_profil and Ich(
        nr=ich_profil.nr, firma=ich_profil.firma, sucht=SUCHT[ich_profil.firma],
        budget=BUDGET - _ausgegeben(stand, ich_profil.id),
    )

    aktuell = None
    if stand["aktuell"] in profile:
        nr = stand["aktuell"]
        gebote = db.query(KlikkGebot).filter_by(session_id=session.id, nr=nr).all()
        mein = next((g.betrag for g in gebote if ich_profil and g.bieter_id == ich_profil.id), None)
        aktuell = Aktuell(
            nr=nr, merkmale=profile[nr].merkmale, offen=stand["offen"], gebote=len(gebote),
            # Das Höchstgebot ist erst nach dem Zuschlag zu sehen, sonst bietet jeder +1
            hoechstes=None if stand["offen"] else max((g.betrag for g in gebote), default=None),
            eigenes=bool(ich_profil and ich_profil.nr == nr), mein_gebot=mein,
        )

    verkauft = [
        Verkauft(
            nr=v["nr"], merkmale=profile[v["nr"]].merkmale if v["nr"] in profile else [],
            preis=v["preis"], firma=v.get("firma"), gebote=v["gebote"],
            selbst_gekauft=bool(ich_profil and v.get("bieter_id") == ich_profil.id),
            eigenes=bool(ich_profil and ich_profil.nr == v["nr"]),
        )
        for v in stand["verkauft"]
    ]
    return AuktionOut(profile=len(profile), lehrkraft=_ist_leitung(session, spieler), ich=ich, aktuell=aktuell, verkauft=verkauft)


@router.post("/{code}/gebot", response_model=Ich)
def bieten(
    code: str, body: GebotIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    _darf_mitmachen(db, session, spieler)
    stand = _stand(session)
    if not stand["offen"] or stand["aktuell"] is None:
        raise HTTPException(409, "Gerade läuft keine Versteigerung.")
    ich = db.query(KlikkProfil).filter_by(session_id=session.id, **_teilnehmer(spieler)).first()
    if ich is None:
        raise HTTPException(403, "Nur wer sein Profil abgegeben hat, bietet mit.")
    if ich.nr == stand["aktuell"]:
        raise HTTPException(400, "Auf dein eigenes Profil kannst du nicht bieten.")
    budget = BUDGET - _ausgegeben(stand, ich.id)
    if body.betrag > budget:
        raise HTTPException(400, f"Dein Budget reicht nur für {budget} Taler.")
    gebot = db.query(KlikkGebot).filter_by(session_id=session.id, nr=stand["aktuell"], bieter_id=ich.id).first()
    if gebot is None:
        db.add(KlikkGebot(session_id=session.id, nr=stand["aktuell"], bieter_id=ich.id, betrag=body.betrag))
    else:
        gebot.betrag = body.betrag
    db.commit()
    return Ich(nr=ich.nr, firma=ich.firma, sucht=SUCHT[ich.firma], budget=budget)


@router.post("/{code}/steuern", response_model=AuktionOut)
def steuern(
    code: str, body: SteuernIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Nur die Lehrkraft der Sitzung (oder ein Admin) führt die Auktion."""
    session = _sitzung(code, db)
    if not _ist_leitung(session, spieler):
        raise HTTPException(403, "Die Auktion führt die Lehrkraft dieser Sitzung.")
    stand = _stand(session)

    if body.aktion == "zuruecksetzen":
        db.query(KlikkGebot).filter_by(session_id=session.id).delete()
        stand = {"aktuell": None, "offen": False, "verkauft": []}

    elif body.aktion == "naechstes":
        weg = {v["nr"] for v in stand["verkauft"]}
        frei = sorted(p.nr for p in db.query(KlikkProfil).filter_by(session_id=session.id).all() if p.nr not in weg)
        if not frei:
            raise HTTPException(409, "Alle Profile sind versteigert.")
        stand["aktuell"], stand["offen"] = frei[0], True

    elif body.aktion == "zuschlag":
        if not stand["offen"]:
            raise HTTPException(409, "Gerade läuft keine Versteigerung.")
        nr = stand["aktuell"]
        gebote = (
            db.query(KlikkGebot).filter_by(session_id=session.id, nr=nr)
            .order_by(KlikkGebot.betrag.desc(), KlikkGebot.abgegeben_am.asc(), KlikkGebot.id.asc()).all()
        )
        # Wer sein Budget inzwischen anderswo verbraucht hat, fällt heraus
        sieger = next((g for g in gebote if g.betrag <= BUDGET - _ausgegeben(stand, g.bieter_id)), None)
        firma = db.get(KlikkProfil, sieger.bieter_id).firma if sieger else None
        stand["verkauft"].append({
            "nr": nr, "preis": sieger.betrag if sieger else 0, "firma": firma,
            "bieter_id": sieger.bieter_id if sieger else None, "gebote": len(gebote),
        })
        stand["offen"] = False

    _speichern(session, stand)
    db.commit()
    return auktion(code, db, spieler)
