"""Bestenliste des »Maus-Führerscheins«.

Anders als bei der Schreibübung (``bestenliste.py``) dürfen hier auch Gäste
ohne Konto mitspielen: sie kommen über den Sitzungscode (wie die Beiträge der
KI-Werkstatt, ``routers/tool_sessions.py``) und tragen sich über ihre
Gast-Id ein, nicht über eine Fremdschlüssel-Beziehung auf ein Konto.

Alle vier Modi sind »mehr ist besser«; die Obergrenze ist eine reine
Plausibilitätsgrenze gegen frisierte Werte aus den Entwicklerwerkzeugen des
Browsers, siehe ``bestenliste.py`` für die Begründung.
"""
from datetime import datetime
from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import Guest, get_current_teacher, get_current_user, get_player, require_admin
from ..availability import is_allowed, require_capability
from ..models import (
    Haus, HausMember, MausBestenliste, MausFortschritt, MausPruefung, Student, Teacher,
    ToolSession, Transaction,
)
from ..display_names import abbreviate_parts, abbreviate_stored, short_name

router = APIRouter(prefix="/api/maus/bestenliste", tags=["maus"])

# Modus → Obergrenze für plausible Werte. Alle vier sind "mehr ist besser";
# spiegelt GRENZEN in frontend/src/lib/maus/ergebnis.ts.
MODI: dict[str, float] = {"klick": 24000, "doppelklick": 13500, "ziehen": 6000, "gesamt": 80000}
TOP = 100


class EintragIn(BaseModel):
    modus: str
    wert: float
    dauer_ms: int = Field(ge=0)
    kontext: str | None = None
    hilfe: bool = False


class EintragOut(BaseModel):
    id: int
    platz: int
    name: str
    klasse: str | None
    gast: bool
    wert: float
    dauer_ms: int
    kontext: str | None
    selbst: bool
    hilfe: bool


def _pruefe(body: EintragIn) -> None:
    if body.modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {body.modus}")
    if body.wert <= 0 or body.wert > MODI[body.modus]:
        raise HTTPException(400, "Dieser Wert ist nicht plausibel.")


def _anzeigename(spieler: Union[Teacher, Student, Guest]) -> tuple[str, str | None, bool]:
    """Name, Klasse und Gast-Kennzeichen aus dem Konto bzw. dem Gast-Token —
    nie aus dem Browser."""
    if isinstance(spieler, Student):
        return (short_name(spieler), spieler.klasse, False)
    if isinstance(spieler, Teacher):
        return (abbreviate_parts(spieler.first_name or "", spieler.last_name or ""), None, False)
    return (abbreviate_stored(spieler.name)[:120], None, True)


def _teilnehmer(spieler: Union[Teacher, Student, Guest]) -> dict:
    """Die Spalte, in der dieser Teilnehmer steht — wie in routers/tool_sessions.py."""
    if isinstance(spieler, Student):
        return {"student_id": spieler.id}
    if isinstance(spieler, Teacher):
        return {"teacher_id": spieler.id}
    return {"guest_id": spieler.id}


def _selbst(zeile: MausBestenliste, wer: dict) -> bool:
    return all(getattr(zeile, spalte) == wert for spalte, wert in wer.items())


def _sitzung_teilnehmer_ids(db: Session, session_id: int) -> dict[str, list]:
    """Wer in dieser Sitzung Fortschritt gemeldet hat — je Spalte ihre Ids."""
    zeilen = db.query(MausFortschritt).filter_by(session_id=session_id).all()
    return {
        "student_id": [z.student_id for z in zeilen if z.student_id is not None],
        "teacher_id": [z.teacher_id for z in zeilen if z.teacher_id is not None],
        "guest_id": [z.guest_id for z in zeilen if z.guest_id is not None],
    }


def _liste(
    db: Session, modus: str, wer: dict, klasse: str | None = None, sitzung_id: int | None = None,
) -> list[EintragOut]:
    query = db.query(MausBestenliste).filter(MausBestenliste.modus == modus)
    if klasse is not None:
        query = query.filter(MausBestenliste.klasse == klasse)
    if sitzung_id is not None:
        ids = _sitzung_teilnehmer_ids(db, sitzung_id)
        bedingungen = [
            getattr(MausBestenliste, spalte).in_(werte) for spalte, werte in ids.items() if werte
        ]
        if not bedingungen:
            return []
        query = query.filter(or_(*bedingungen))
    zeilen = query.order_by(MausBestenliste.wert.desc(), MausBestenliste.erreicht_am.asc()).limit(TOP).all()
    return [
        EintragOut(
            id=z.id, platz=i, name=z.name, klasse=z.klasse, gast=z.gast,
            wert=z.wert, dauer_ms=z.dauer_ms, kontext=z.kontext,
            selbst=_selbst(z, wer), hilfe=z.hilfe,
        )
        for i, z in enumerate(zeilen, start=1)
    ]


def _eintragen(db: Session, body: EintragIn, spieler: Union[Teacher, Student, Guest]) -> EintragOut:
    """Ein Ergebnis melden. Nur eine Verbesserung wird übernommen."""
    _pruefe(body)
    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)

    zeile = db.query(MausBestenliste).filter_by(modus=body.modus, **wer).first()
    if zeile is None:
        zeile = MausBestenliste(
            modus=body.modus, wert=body.wert, dauer_ms=body.dauer_ms,
            kontext=body.kontext, name=name, klasse=klasse, gast=gast, hilfe=body.hilfe, **wer,
        )
        db.add(zeile)
    elif body.wert > zeile.wert:
        zeile.wert = body.wert
        zeile.dauer_ms, zeile.kontext = body.dauer_ms, body.kontext
        zeile.hilfe = body.hilfe
        # Der Name kann sich geändert haben (Heirat, Klassenwechsel).
        zeile.name, zeile.klasse = name, klasse
    db.commit()
    db.refresh(zeile)

    davor = (
        db.query(MausBestenliste)
        .filter(MausBestenliste.modus == body.modus, MausBestenliste.wert > zeile.wert)
        .count()
    )
    return EintragOut(
        id=zeile.id, platz=davor + 1, name=zeile.name, klasse=zeile.klasse, gast=zeile.gast,
        wert=zeile.wert, dauer_ms=zeile.dauer_ms, kontext=zeile.kontext, selbst=True, hilfe=zeile.hilfe,
    )


@router.get("", response_model=list[EintragOut])
def liste(
    modus: str,
    klasse: str | None = None,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    if modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    sitzung_id = _sitzung(sitzung, db).id if sitzung else None
    return _liste(db, modus, _teilnehmer(user), klasse=klasse, sitzung_id=sitzung_id)


@router.post("", response_model=EintragOut,
             dependencies=[Depends(require_capability("maus", "use"))])
def eintragen(
    body: EintragIn,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    return _eintragen(db, body, user)


def _sitzung(code: str, db: Session) -> ToolSession:
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug != "maus":
        raise HTTPException(400, "Diese Sitzung gehört nicht zum Maus-Führerschein.")
    return session


@router.get("/{code}", response_model=list[EintragOut])
def liste_ueber_code(
    code: str,
    modus: str,
    klasse: str | None = None,
    sitzung: str | None = None,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    _sitzung(code, db)
    if modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    sitzung_id = _sitzung(sitzung, db).id if sitzung else None
    return _liste(db, modus, _teilnehmer(spieler), klasse=klasse, sitzung_id=sitzung_id)


@router.post("/{code}", response_model=EintragOut)
def eintragen_ueber_code(
    code: str,
    body: EintragIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, "maus", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (maus/use).")
    return _eintragen(db, body, spieler)


@router.delete("/eintrag/{eintrag_id}", status_code=204)
def eintrag_loeschen(
    eintrag_id: int,
    db: Session = Depends(get_db),
    _admin: Teacher = Depends(require_admin),
):
    """Einen Eintrag entfernen — für unangemessene Gastnamen."""
    zeile = db.get(MausBestenliste, eintrag_id)
    if not zeile:
        raise HTTPException(404, "Eintrag nicht gefunden")
    db.delete(zeile)
    db.commit()


# ───────────────────────────────────────────── Fortschritt & Prüfung ──
# Zweiter Router mit eigenem Prefix, damit /api/maus/sitzung/... nicht mit den
# /{code}-Routen der Bestenliste (Prefix /api/maus/bestenliste) kollidiert.

router_sitzung = APIRouter(prefix="/api/maus", tags=["maus"])

# Stufen je Teil des Führerscheins.
TEILE: dict[int, list[str]] = {
    1: ["klick", "doppelklick", "rechtsklick", "ziehen", "markieren", "kopieren"],
    2: ["scrollen", "tastatur", "explorer", "fenster", "datei"],
    3: ["suche", "apps", "screenshot", "aussehen", "bedienhilfe", "taskleiste", "profil"],
    4: ["handy", "appstore", "berechtigungen", "privatsphaere", "risiken"],
}
STUFEN: set[str] = {sid for ids in TEILE.values() for sid in ids}

HAUSPUNKTE_JE_TEIL = 5


class StufeStand(BaseModel):
    punkte: int = Field(ge=0, le=60000)
    sterne: int = Field(ge=0, le=3)
    dauer_ms: int = Field(ge=0)


class FortschrittIn(BaseModel):
    stufen: dict[str, StufeStand]
    hilfe: bool = False
    bestanden: list[int] = []


class FortschrittOut(BaseModel):
    name: str
    klasse: str | None
    gast: bool
    hilfe: bool
    stufen: dict
    bestanden: list[int]
    aktualisiert_am: datetime


def _pruefe_fortschritt(body: FortschrittIn) -> None:
    unbekannt = set(body.stufen) - STUFEN
    if unbekannt:
        raise HTTPException(400, f"Unbekannte Stufe: {', '.join(sorted(unbekannt))}")
    for teil in body.bestanden:
        if teil not in TEILE:
            raise HTTPException(400, f"Unbekannter Teil: {teil}")
        for sid in TEILE[teil]:
            stand = body.stufen.get(sid)
            if stand is None or stand.punkte <= 0:
                raise HTTPException(400, f"Teil {teil} ist noch nicht vollständig bestanden.")


@router_sitzung.put("/sitzung/{code}/fortschritt")
def fortschritt_melden(
    code: str,
    body: FortschrittIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Fortschritt in dieser Sitzung melden — je Teilnehmer bleibt eine Zeile stehen."""
    session = _sitzung(code, db)
    if session.status == "closed":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    if not isinstance(spieler, Guest):
        admin = isinstance(spieler, Teacher) and spieler.role == "admin"
        if not admin and not is_allowed(db, spieler, "maus", "use"):
            raise HTTPException(403, "Dieses Werkzeug ist für dich nicht freigeschaltet (maus/use).")
    _pruefe_fortschritt(body)

    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)
    zeile = db.query(MausFortschritt).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = MausFortschritt(session_id=session.id, name=name, klasse=klasse, gast=gast, **wer)
        db.add(zeile)
    zeile.name, zeile.klasse, zeile.gast = name, klasse, gast
    zeile.stufen = {sid: stand.model_dump() for sid, stand in body.stufen.items()}
    zeile.hilfe = body.hilfe
    zeile.bestanden = body.bestanden
    db.commit()
    return {"ok": True}


@router_sitzung.get("/sitzung/{code}/uebersicht", response_model=list[FortschrittOut])
def fortschritt_uebersicht(
    code: str,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    """Fortschritt aller Teilnehmer dieser Sitzung — nur für die Lehrkraft, der
    die Sitzung gehört, oder einen Admin."""
    session = _sitzung(code, db)
    if session.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Diese Sitzung gehört jemand anderem.")
    zeilen = (
        db.query(MausFortschritt)
        .filter_by(session_id=session.id)
        .all()
    )
    zeilen.sort(key=lambda z: z.name.lower())
    return [
        FortschrittOut(
            name=z.name, klasse=z.klasse, gast=z.gast, hilfe=z.hilfe,
            stufen=z.stufen, bestanden=z.bestanden, aktualisiert_am=z.aktualisiert_am,
        )
        for z in zeilen
    ]


def _haus_name(db: Session, class_id: int | None) -> str | None:
    if class_id is None:
        return None
    member = db.query(HausMember).filter_by(class_id=class_id).first()
    if not member:
        return None
    haus = db.get(Haus, member.haus_id)
    return haus.name if haus else None


def _buchende_lehrkraft(db: Session, student: Student, code: str | None, slug: str = "maus") -> Teacher | None:
    """Wer die Hauspunkte für diese Prüfung bucht: die Lehrkraft der Sitzung,
    sonst die Klassenlehrkraft, sonst ein Admin."""
    if code:
        session = db.query(ToolSession).filter_by(code=code.upper()).first()
        if session and session.tool_slug == slug:
            lehrer = db.get(Teacher, session.created_by)
            if lehrer:
                return lehrer
    lehrer = (
        db.query(Teacher)
        .filter(Teacher.klasse_id == student.class_id, Teacher.active == True)  # noqa: E712
        .order_by(Teacher.id)
        .first()
    )
    if lehrer:
        return lehrer
    return (
        db.query(Teacher)
        .filter(Teacher.role == "admin", Teacher.active == True)  # noqa: E712
        .order_by(Teacher.id)
        .first()
    )


class PruefungIn(BaseModel):
    teil: Literal[1, 2, 3, 4]
    stufen: dict[str, StufeStand]
    hilfe: bool = False
    code: str | None = None


class PruefungOut(BaseModel):
    bestanden: bool
    punkte: int
    schon_vergeben: bool
    haus: str | None


@router_sitzung.post("/pruefung", response_model=PruefungOut,
                      dependencies=[Depends(require_capability("maus", "use"))])
def pruefung(
    body: PruefungIn,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Abschlussprüfung eines Teils — Schüler:innen bekommen dafür einmalig
    Hauspunkte über ihre Klasse und ihr Haus, Lehrkräfte nur die Bestätigung."""
    for sid in TEILE[body.teil]:
        stand = body.stufen.get(sid)
        if stand is None or stand.punkte <= 0:
            raise HTTPException(400, f"Nicht bestanden – Teil {body.teil} ist nicht vollständig.")

    if not isinstance(user, Student):
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    vorhanden = db.query(MausPruefung).filter_by(student_id=user.id, teil=body.teil).first()
    if vorhanden is not None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=True, haus=_haus_name(db, user.class_id))

    if user.class_id is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    buchende = _buchende_lehrkraft(db, user, body.code)
    if buchende is None:
        return PruefungOut(bestanden=True, punkte=0, schon_vergeben=False, haus=None)

    db.add(Transaction(
        teacher_id=buchende.id, class_id=user.class_id, points=HAUSPUNKTE_JE_TEIL,
        reason=f"Maus-Führerschein Teil {body.teil} bestanden: {short_name(user)}",
    ))
    db.add(MausPruefung(student_id=user.id, teil=body.teil, punkte=HAUSPUNKTE_JE_TEIL, class_id=user.class_id))
    db.commit()
    return PruefungOut(
        bestanden=True, punkte=HAUSPUNKTE_JE_TEIL, schon_vergeben=False, haus=_haus_name(db, user.class_id),
    )
