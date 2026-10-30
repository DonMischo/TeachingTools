"""Werbeauktion zu »Klikk«: die Klasse versteigert ihre eigenen Werbe-Profile.

Ablauf: Wer im Datenspiegel zustimmt, gibt sein Profil anonym ab
(``PUT /profil``) und spielt dafür eine Werbefirma mit 100 Talern Budget. Die
Lehrkraft ruft Profil für Profil auf (``POST /steuern``: naechstes, zuschlag,
zuruecksetzen); alle bieten (``POST /gebot``), das höchste Gebot gewinnt. Den
Stand holen alle per ``GET /auktion`` (Polling) — ohne Namen: auch die
Lehrkraft sieht nur Profilnummern.

Der Auktionsstand liegt in ``ToolSession.settings["auktion"]``.
"""
import re
from typing import Literal, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import Guest, get_player
from ..availability import is_allowed
from ..database import get_db
from ..models import KlikkBeitrag, KlikkGebot, KlikkProfil, KlikkReaktion, KlikkSpielstand, KlikkWoche, Student, Teacher, ToolSession

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


# ───────── Geteilter Klassen-Feed ─────────
#
# Alle, die mit demselben Code spielen, sehen die Beiträge der anderen und
# können liken und kommentieren — Kommentare nur aus einer festen Liste, Namen
# nur generiert. Freitext gibt es allein für die Lehrkraft (Nachrichten).

KOMMENTARE: dict[str, str] = {
    "krass": "Krass 🔥", "lol": "😂😂", "suess": "Süß 🥹", "cool": "Cool 😎", "stark": "Stark von dir 💪",
    "fake": "Fake 🤡", "cringe": "Cringe 😬", "mehr": "Mach's krasser!", "vorsicht": "Pass auf dich auf 🙏",
    "loeschen": "Lösch das lieber",
    # nur unter Beiträgen von jemandem mit niedriger Hygiene (Spielwert) – Mobbing mit Folgen im Spiel
    "stinkt": "Riecht man bis hier 🤢",
}
SPIELE_TEILEN = {"klick", "doppelklick", "bloecke", "sprung", "logik", "candy", "quiz"}
MOTIVE = {"selfie", "essen", "tier", "himmel"}
TRENDS = {"spiegel", "mehl", "eis", "zitrone", "gleis", "nosleep", "hotchip", "dach"}
NAME = re.compile(r"^[a-zäöü]{3,12}\.[a-zäöü]{3,12}\.\d{1,2}$")


class BeitragIn(BaseModel):
    name: str = Field(max_length=40)
    art: Literal["foto", "video", "news", "spiel"]
    tag: int = Field(ge=0, le=6)
    motiv: str | None = None
    trend: str | None = None
    fake: bool = False
    # Spielwerte: Hygiene des Postenden (0–100), geteiltes Spielergebnis
    hygiene: int | None = Field(default=None, ge=0, le=100)
    spiel: str | None = None
    punkte: int | None = Field(default=None, ge=0, le=1_000_000)
    # nur Lehrkraft: Nachricht mit Bild aus den Galerien
    schlagzeile: str | None = Field(default=None, max_length=120)
    unterzeile: str | None = Field(default=None, max_length=300)
    bild: str | None = Field(default=None, max_length=80)


class KommentarOut(BaseModel):
    name: str
    kommentar: str


class BeitragOut(BaseModel):
    id: int
    name: str
    art: str
    inhalt: dict
    tag: int
    likes: int
    kommentare: list[KommentarOut]
    eigener: bool
    gelikt: bool
    mein_kommentar: str | None
    lehrkraft: bool


class ReaktionIn(BaseModel):
    name: str = Field(max_length=40)
    like: bool | None = None
    kommentar: str | None = None


def _wer_gleich(zeile, wer: dict) -> bool:
    return all(getattr(zeile, k) == v for k, v in wer.items())


def _beitrag_out(b: KlikkBeitrag, reaktionen: list[KlikkReaktion], wer: dict) -> BeitragOut:
    meine = next((r for r in reaktionen if _wer_gleich(r, wer)), None)
    return BeitragOut(
        id=b.id, name=b.name, art=b.art, inhalt=b.inhalt, tag=b.tag,
        likes=sum(1 for r in reaktionen if r.like),
        kommentare=[KommentarOut(name=r.name, kommentar=r.kommentar) for r in reaktionen if r.kommentar],
        eigener=_wer_gleich(b, wer), gelikt=bool(meine and meine.like),
        mein_kommentar=meine.kommentar if meine else None, lehrkraft=b.teacher_id is not None,
    )


@router.post("/{code}/beitraege", response_model=BeitragOut, status_code=201)
def beitrag_posten(
    code: str, body: BeitragIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    _darf_mitmachen(db, session, spieler)
    if body.art == "news":
        if not _ist_leitung(session, spieler):
            raise HTTPException(403, "Nachrichten postet nur die Lehrkraft.")
        if not body.schlagzeile:
            raise HTTPException(400, "Eine Nachricht braucht eine Schlagzeile.")
        inhalt = {"schlagzeile": body.schlagzeile, "unterzeile": body.unterzeile or "", "bild": body.bild, "fake": body.fake}
        name = "klikk.news"
    else:
        if not NAME.match(body.name):
            raise HTTPException(400, "Unbekannter Klikk-Name.")
        if body.art == "foto" and body.motiv not in MOTIVE:
            raise HTTPException(400, "Unbekanntes Motiv.")
        if body.art == "video" and body.trend not in TRENDS:
            raise HTTPException(400, "Unbekannter Trend.")
        if body.art == "spiel" and (body.spiel not in SPIELE_TEILEN or body.punkte is None):
            raise HTTPException(400, "Unbekanntes Spiel.")
        inhalt = ({"motiv": body.motiv} if body.art == "foto" else {"trend": body.trend, "fake": body.fake} if body.art == "video"
                  else {"spiel": body.spiel, "punkte": body.punkte})
        if body.hygiene is not None:
            inhalt["hygiene"] = body.hygiene
        name = body.name
    b = KlikkBeitrag(session_id=session.id, name=name, art=body.art, inhalt=inhalt, tag=body.tag, **_teilnehmer(spieler))
    db.add(b)
    db.commit()
    db.refresh(b)
    return _beitrag_out(b, [], _teilnehmer(spieler))


@router.get("/{code}/beitraege", response_model=list[BeitragOut])
def beitraege(
    code: str,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    liste = db.query(KlikkBeitrag).filter_by(session_id=session.id).order_by(KlikkBeitrag.id.desc()).limit(100).all()
    ids = [b.id for b in liste]
    reaktionen = db.query(KlikkReaktion).filter(KlikkReaktion.beitrag_id.in_(ids)).all() if ids else []
    wer = _teilnehmer(spieler)
    return [_beitrag_out(b, [r for r in reaktionen if r.beitrag_id == b.id], wer) for b in liste]


@router.post("/{code}/beitraege/{beitrag_id}/reaktion", response_model=BeitragOut)
def reagieren(
    code: str, beitrag_id: int, body: ReaktionIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    _darf_mitmachen(db, session, spieler)
    b = db.get(KlikkBeitrag, beitrag_id)
    if not b or b.session_id != session.id:
        raise HTTPException(404, "Beitrag nicht gefunden")
    if body.kommentar is not None and body.kommentar not in KOMMENTARE:
        raise HTTPException(400, "Kommentare gibt es nur aus der Liste.")
    if body.kommentar == "stinkt" and (b.inhalt or {}).get("hygiene", 100) >= 35:
        raise HTTPException(400, "Diesen Kommentar gibt es hier nicht.")
    leitung = _ist_leitung(session, spieler)
    if not leitung and not NAME.match(body.name):
        raise HTTPException(400, "Unbekannter Klikk-Name.")
    wer = _teilnehmer(spieler)
    r = db.query(KlikkReaktion).filter_by(beitrag_id=b.id, **wer).first()
    if r is None:
        r = KlikkReaktion(beitrag_id=b.id, name="Lehrkraft" if leitung else body.name, **wer)
        db.add(r)
    if body.like is not None:
        r.like = body.like
    if body.kommentar is not None:
        r.kommentar = KOMMENTARE[body.kommentar]
    db.commit()
    reaktionen = db.query(KlikkReaktion).filter_by(beitrag_id=b.id).all()
    return _beitrag_out(b, reaktionen, wer)


@router.delete("/{code}/beitraege/{beitrag_id}", status_code=204)
def beitrag_loeschen(
    code: str, beitrag_id: int,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Eigene Beiträge löschen; die Lehrkraft darf alle löschen."""
    session = _sitzung(code, db)
    b = db.get(KlikkBeitrag, beitrag_id)
    if not b or b.session_id != session.id:
        raise HTTPException(404, "Beitrag nicht gefunden")
    if not (_ist_leitung(session, spieler) or _wer_gleich(b, _teilnehmer(spieler))):
        raise HTTPException(403, "Das ist nicht dein Beitrag.")
    db.delete(b)
    db.commit()


# ───────── Klassenübersicht: anonyme Wochen-Zusammenfassungen ─────────

class WocheIn(BaseModel):
    werte: dict[str, Union[bool, int, float, str]] = Field(max_length=60)


@router.put("/{code}/woche")
def woche_melden(
    code: str, body: WocheIn,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    session = _sitzung(code, db)
    _darf_mitmachen(db, session, spieler)
    werte = {k[:40]: (v[:30] if isinstance(v, str) else v) for k, v in body.werte.items()}
    wer = _teilnehmer(spieler)
    zeile = db.query(KlikkWoche).filter_by(session_id=session.id, **wer).first()
    if zeile is None:
        zeile = KlikkWoche(session_id=session.id, **wer)
        db.add(zeile)
    zeile.werte = werte
    db.commit()
    return {"ok": True}


@router.get("/{code}/uebersicht")
def uebersicht(
    code: str,
    db: Session = Depends(get_db),
    spieler: Union[Teacher, Student, Guest] = Depends(get_player),
):
    """Nur Summen und Anteile, nie einzelne Zeilen — und erst ab drei Wochen."""
    session = _sitzung(code, db)
    if not _ist_leitung(session, spieler):
        raise HTTPException(403, "Die Übersicht sieht nur die Lehrkraft dieser Sitzung.")
    zeilen = [z.werte for z in db.query(KlikkWoche).filter_by(session_id=session.id).all()]
    n = len(zeilen)
    if n < 3:
        return {"anzahl": n, "werte": {}}
    werte: dict[str, dict] = {}
    for schluessel in sorted({k for z in zeilen for k in z}):
        vorhanden = [z[schluessel] for z in zeilen if schluessel in z]
        if all(isinstance(v, bool) for v in vorhanden):
            werte[schluessel] = {"art": "ja", "ja": sum(vorhanden), "von": len(vorhanden)}
        elif all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vorhanden):
            werte[schluessel] = {"art": "zahl", "schnitt": round(sum(vorhanden) / len(vorhanden), 1), "min": min(vorhanden), "max": max(vorhanden)}
        else:
            zaehlung: dict[str, int] = {}
            for v in vorhanden:
                zaehlung[str(v)] = zaehlung.get(str(v), 0) + 1
            werte[schluessel] = {"art": "wahl", "zaehlung": zaehlung}
    return {"anzahl": n, "werte": werte}



# ───────── Klassen-Uhr: im Klassenmodus läuft die Spielzeit für alle gleich ─────────
#
# Die Lehrkraft startet die Woche; danach rechnet jeder Browser die Spielzeit
# aus der Serverzeit: ein Tag (6–24 Uhr) dauert `minuten_pro_tag` echte Minuten.
# Pausen verschieben den Start, damit die Zeit danach nahtlos weiterläuft.

import time  # noqa: E402


def _jetzt_ms() -> int:
    return int(time.time() * 1000)


class UhrIn(BaseModel):
    aktion: Literal["start", "pause", "weiter", "stopp"]
    minuten_pro_tag: int = Field(default=6, ge=2, le=30)


class UhrOut(BaseModel):
    laeuft: bool
    pausiert: bool
    start_ms: int | None
    minuten_pro_tag: int
    pausiert_ms: int | None
    jetzt_ms: int


def _uhr(session: ToolSession) -> UhrOut:
    u = (session.settings or {}).get("uhr") or {}
    return UhrOut(laeuft=bool(u.get("start_ms")), pausiert=u.get("pausiert_ms") is not None, start_ms=u.get("start_ms"),
                  minuten_pro_tag=u.get("minuten_pro_tag", 6), pausiert_ms=u.get("pausiert_ms"), jetzt_ms=_jetzt_ms())


@router.get("/{code}/uhr", response_model=UhrOut)
def uhr_lesen(code: str, db: Session = Depends(get_db), spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    return _uhr(_sitzung(code, db))


@router.post("/{code}/uhr", response_model=UhrOut)
def uhr_steuern(code: str, body: UhrIn, db: Session = Depends(get_db), spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    session = _sitzung(code, db)
    if not _ist_leitung(session, spieler):
        raise HTTPException(403, "Die Klassen-Uhr stellt die Lehrkraft.")
    u = dict((session.settings or {}).get("uhr") or {})
    jetzt = _jetzt_ms()
    if body.aktion == "start":
        u = {"start_ms": jetzt, "minuten_pro_tag": body.minuten_pro_tag, "pausiert_ms": None}
    elif body.aktion == "pause" and u.get("start_ms") and u.get("pausiert_ms") is None:
        u["pausiert_ms"] = jetzt
    elif body.aktion == "weiter" and u.get("pausiert_ms") is not None:
        u["start_ms"] += jetzt - u["pausiert_ms"]
        u["pausiert_ms"] = None
    elif body.aktion == "stopp":
        u = {}
    session.settings = {**(session.settings or {}), "uhr": u}
    db.commit()
    return _uhr(session)


# ───────── Bestenlisten der Handy-Spiele ─────────
#
# Klicker und Doppelklicker tragen in die Bestenliste des Maus-Führerscheins
# ein (routers/maus.py). Die drei Klikk-eigenen Spiele haben eine eigene Liste:
# eine Zeile je Person und Spiel, mehr ist besser, Namen wie beim
# Maus-Führerschein aus Konto bzw. Gast-Token.

from .maus import _anzeigename  # noqa: E402 — gleiche Namensregeln wie dort

router_spiele = APIRouter(prefix="/api/klikk/spiele", tags=["klikk"])

# Spiel → höchster plausibler Wert
SPIELE: dict[str, int] = {"bloecke": 20000, "sprung": 200000, "logik": 5000}


class SpielIn(BaseModel):
    wert: int = Field(ge=1)


class SpielEintrag(BaseModel):
    platz: int
    name: str
    klasse: str | None
    gast: bool
    wert: int
    selbst: bool


def _spiel_liste(db: Session, spiel: str, wer: dict, sitzung_id: int | None) -> list[SpielEintrag]:
    if spiel not in SPIELE:
        raise HTTPException(400, f"Unbekanntes Spiel: {spiel}")
    q = db.query(KlikkSpielstand).filter_by(spiel=spiel)
    if sitzung_id is not None:
        q = q.filter_by(session_id=sitzung_id)
    zeilen = q.order_by(KlikkSpielstand.wert.desc(), KlikkSpielstand.id.asc()).limit(50).all()
    return [SpielEintrag(platz=i, name=z.name, klasse=z.klasse, gast=z.gast, wert=z.wert, selbst=_wer_gleich(z, wer))
            for i, z in enumerate(zeilen, start=1)]


def _spiel_eintragen(db: Session, spiel: str, wert: int, spieler, session_id: int | None) -> SpielEintrag:
    if spiel not in SPIELE:
        raise HTTPException(400, f"Unbekanntes Spiel: {spiel}")
    if wert > SPIELE[spiel]:
        raise HTTPException(400, "Dieser Wert ist nicht plausibel.")
    name, klasse, gast = _anzeigename(spieler)
    wer = _teilnehmer(spieler)
    z = db.query(KlikkSpielstand).filter_by(spiel=spiel, **wer).first()
    if z is None:
        z = KlikkSpielstand(spiel=spiel, wert=wert, name=name, klasse=klasse, gast=gast, session_id=session_id, **wer)
        db.add(z)
    elif wert > z.wert:
        z.wert, z.session_id, z.name, z.klasse = wert, session_id, name, klasse
    db.commit()
    davor = db.query(KlikkSpielstand).filter(KlikkSpielstand.spiel == spiel, KlikkSpielstand.wert > z.wert).count()
    return SpielEintrag(platz=davor + 1, name=z.name, klasse=z.klasse, gast=z.gast, wert=z.wert, selbst=True)


@router_spiele.get("/{spiel}", response_model=list[SpielEintrag])
def spiel_liste(spiel: str, db: Session = Depends(get_db), spieler: Union[Teacher, Student] = Depends(get_player)):
    return _spiel_liste(db, spiel, _teilnehmer(spieler), None)


@router_spiele.post("/{spiel}", response_model=SpielEintrag)
def spiel_eintragen(spiel: str, body: SpielIn, db: Session = Depends(get_db), spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    if isinstance(spieler, Guest):
        raise HTTPException(403, "Gäste tragen sich über den Sitzungscode ein.")
    return _spiel_eintragen(db, spiel, body.wert, spieler, None)


@router_spiele.get("/{spiel}/{code}", response_model=list[SpielEintrag])
def spiel_liste_sitzung(spiel: str, code: str, nur_sitzung: bool = False, db: Session = Depends(get_db),
                        spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    session = _sitzung(code, db)
    return _spiel_liste(db, spiel, _teilnehmer(spieler), session.id if nur_sitzung else None)


@router_spiele.post("/{spiel}/{code}", response_model=SpielEintrag)
def spiel_eintragen_sitzung(spiel: str, code: str, body: SpielIn, db: Session = Depends(get_db),
                            spieler: Union[Teacher, Student, Guest] = Depends(get_player)):
    session = _sitzung(code, db)
    _darf_mitmachen(db, session, spieler)
    return _spiel_eintragen(db, spiel, body.wert, spieler, session.id)
