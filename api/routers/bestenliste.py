"""Bestenliste der Schreibübung — die besten hundert je Modus.

Drei Ranglisten, weil die drei Modi drei verschiedene Dinge messen:

  lektionen   Anschläge/Minute — mehr ist besser
  wortregen   Punkte           — mehr ist besser
  tastenjagd  Reaktion in ms   — **weniger** ist besser

Je Person und Modus steht genau eine Zeile: die beste. Sonst belegte ein
einzelnes schnelles Kind die halbe Liste.

**Zur Ehrlichkeit der Zahlen:** Die Werte kommen aus dem Browser und liessen
sich mit den Entwicklerwerkzeugen frisieren. Dagegen hilft hier nur eine
Plausibilitätsgrenze (unten), nicht mehr — für eine Klassenbestenliste ist das
der richtige Aufwand, für eine Wertung mit Konsequenzen wäre es zu wenig.
Deshalb tragen sich auch nur Angemeldete ein: ein Name hängt dann an einem
Konto und die Lehrkraft sieht, wer da geschrieben hat.
"""
from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..availability import require_capability
from ..models import Student, Teacher, TippBestenliste
from ..display_names import abbreviate_parts, short_name

router = APIRouter(prefix="/api/tippen/bestenliste", tags=["tippen"])

# Modus → (mehr ist besser?, Obergrenze für plausible Werte)
MODI: dict[str, tuple[bool, float]] = {
    # 600 A/min wären Weltklasse; darüber hat jemand nachgeholfen.
    "lektionen": (True, 600),
    "wortregen": (True, 10000),
    # Unter 80 ms ist keine menschliche Reaktion mehr.
    "tastenjagd": (False, 5000),
}
UNTERGRENZE_TASTENJAGD = 80
TOP = 100


class EintragIn(BaseModel):
    modus: str
    wert: float
    anschlaege: int = Field(ge=0)
    fehler: int = Field(ge=0)
    dauer_ms: int = Field(ge=0)
    kontext: str | None = None


class EintragOut(BaseModel):
    platz: int
    name: str
    klasse: str | None
    wert: float
    anschlaege: int
    fehler: int
    dauer_ms: int
    kontext: str | None
    selbst: bool


def _anzeigename(user: Union[Teacher, Student]) -> tuple[str, str | None]:
    """Name und Klasse aus dem Konto — nie aus dem Browser.

    Nachnamen werden abgekürzt: die Liste hängt womöglich am Beamer. Das ist
    inzwischen die Hausregel für alle Werkzeuge, siehe api/display_names.py.
    """
    if isinstance(user, Student):
        return (short_name(user), user.klasse)
    return (abbreviate_parts(user.first_name or "", user.last_name or ""), None)


def _besser(modus: str, neu: float, alt: float) -> bool:
    mehr_ist_besser, _ = MODI[modus]
    return neu > alt if mehr_ist_besser else neu < alt


def _pruefe(body: EintragIn) -> None:
    if body.modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {body.modus}")
    _, obergrenze = MODI[body.modus]
    if body.wert <= 0 or body.wert > obergrenze:
        raise HTTPException(400, "Dieser Wert ist nicht plausibel.")
    if body.modus == "tastenjagd" and body.wert < UNTERGRENZE_TASTENJAGD:
        raise HTTPException(400, "Dieser Wert ist nicht plausibel.")
    if body.fehler > body.anschlaege:
        raise HTTPException(400, "Mehr Fehler als Anschläge — das passt nicht zusammen.")


@router.get("", response_model=list[EintragOut])
def liste(
    modus: str,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    if modus not in MODI:
        raise HTTPException(400, f"Unbekannter Modus: {modus}")
    mehr_ist_besser, _ = MODI[modus]
    spalte = TippBestenliste.wert.desc() if mehr_ist_besser else TippBestenliste.wert.asc()

    zeilen = (
        db.query(TippBestenliste)
        .filter(TippBestenliste.modus == modus)
        .order_by(spalte, TippBestenliste.erreicht_am.asc())
        .limit(TOP)
        .all()
    )
    ist_schueler = isinstance(user, Student)
    return [
        EintragOut(
            platz=i,
            name=z.name,
            klasse=z.klasse,
            wert=z.wert,
            anschlaege=z.anschlaege,
            fehler=z.fehler,
            dauer_ms=z.dauer_ms,
            kontext=z.kontext,
            selbst=(z.student_id == user.id) if ist_schueler else (z.teacher_id == user.id),
        )
        for i, z in enumerate(zeilen, start=1)
    ]


@router.post("", response_model=EintragOut,
             dependencies=[Depends(require_capability("tippen", "use"))])
def eintragen(
    body: EintragIn,
    db: Session = Depends(get_db),
    user: Union[Teacher, Student] = Depends(get_current_user),
):
    """Ein Ergebnis melden. Nur eine Verbesserung wird übernommen."""
    _pruefe(body)
    name, klasse = _anzeigename(user)
    ist_schueler = isinstance(user, Student)

    q = db.query(TippBestenliste).filter(TippBestenliste.modus == body.modus)
    q = q.filter(TippBestenliste.student_id == user.id) if ist_schueler \
        else q.filter(TippBestenliste.teacher_id == user.id)
    zeile = q.first()

    if zeile is None:
        zeile = TippBestenliste(
            modus=body.modus,
            student_id=user.id if ist_schueler else None,
            teacher_id=None if ist_schueler else user.id,
            wert=body.wert, anschlaege=body.anschlaege, fehler=body.fehler,
            dauer_ms=body.dauer_ms, kontext=body.kontext, name=name, klasse=klasse,
        )
        db.add(zeile)
    elif _besser(body.modus, body.wert, zeile.wert):
        zeile.wert = body.wert
        zeile.anschlaege, zeile.fehler = body.anschlaege, body.fehler
        zeile.dauer_ms, zeile.kontext = body.dauer_ms, body.kontext
        # Der Name kann sich geändert haben (Heirat, Klassenwechsel).
        zeile.name, zeile.klasse = name, klasse
    db.commit()
    db.refresh(zeile)

    # Der Platz, auf dem der Eintrag jetzt steht.
    mehr_ist_besser, _ = MODI[body.modus]
    vergleich = TippBestenliste.wert > zeile.wert if mehr_ist_besser \
        else TippBestenliste.wert < zeile.wert
    davor = (
        db.query(TippBestenliste)
        .filter(TippBestenliste.modus == body.modus, vergleich)
        .count()
    )
    return EintragOut(
        platz=davor + 1, name=zeile.name, klasse=zeile.klasse, wert=zeile.wert,
        anschlaege=zeile.anschlaege, fehler=zeile.fehler, dauer_ms=zeile.dauer_ms,
        kontext=zeile.kontext, selbst=True,
    )
