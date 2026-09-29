"""Schulweite Schalter fuer die Datenanzeige.

Bisher gab es nur eine Schuleinstellung (das Bundesland fuer die Ferien), und
die haengt am Kalender-Router. Was hier liegt, ist etwas anderes: Schalter
darueber, welche Schuelerdaten das Backend ueberhaupt herausgibt.

Deshalb ein eigener Ort und eine eigene Rechteregel — Lesen darf jeder
Angemeldete (der Sitzplan muss wissen, ob er das Kaestchen
»Junge/Mädchen abwechselnd« zeigen darf, und den bedient auch ein
freigeschalteter Klassensprecher), Setzen nur ein Admin. Nicht das
delegierbare Recht »Kalender-Einstellungen«: wer Ferientermine pflegen darf,
soll damit nicht die Offenlegung personenbezogener Daten umschalten koennen.

Nach derselben Regel liegt hier auch die Laenge des Gastfensters: wie lange ein
unangemeldeter QR-Zugang gilt, ist eine Sicherheitsentscheidung der Schule, kein
Knopf der einzelnen Lehrkraft. Lesen darf sie trotzdem jede — die Hostansicht
schreibt die Zahl an den Schalter »Gäste erlauben«.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import GUEST_MINUTES_MAX, GUEST_MINUTES_MIN, get_current_user, require_admin
from ..database import get_db
from ..models import SchoolSettings
from ..tool_catalog import CATALOG

router = APIRouter(prefix="/api/school", tags=["school"])


class DisplaySettingsOut(BaseModel):
    # Aus heisst: `geschlecht` steht in keiner Antwort, und der Sitzplan
    # blendet das Mischen nach Geschlecht aus.
    show_geschlecht: bool


class DisplaySettingsIn(BaseModel):
    show_geschlecht: bool


def _settings(db: Session) -> SchoolSettings:
    """Die Singleton-Zeile, notfalls angelegt (wie in seed.ensure_school_settings)."""
    row = db.get(SchoolSettings, 1)
    if row is None:
        row = SchoolSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/display-settings", response_model=DisplaySettingsOut)
def get_display_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return DisplaySettingsOut(show_geschlecht=_settings(db).show_geschlecht)


@router.put("/display-settings", response_model=DisplaySettingsOut)
def set_display_settings(
    body: DisplaySettingsIn,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    row = _settings(db)
    row.show_geschlecht = body.show_geschlecht
    db.commit()
    return DisplaySettingsOut(show_geschlecht=row.show_geschlecht)


class GuestSettingsOut(BaseModel):
    """Wie lange ein QR/Join-Link-Gast drinbleibt, schulweit in Minuten."""
    guest_minutes: int
    min_minutes: int = GUEST_MINUTES_MIN
    max_minutes: int = GUEST_MINUTES_MAX


class GuestSettingsIn(BaseModel):
    guest_minutes: int = Field(ge=GUEST_MINUTES_MIN, le=GUEST_MINUTES_MAX)


@router.get("/guest-settings", response_model=GuestSettingsOut)
def get_guest_settings(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Lesen darf jede Lehrkraft — die Hostansicht schreibt die Zahl an den
    Schalter »Gäste erlauben«."""
    return GuestSettingsOut(guest_minutes=_settings(db).guest_token_minutes)


@router.put("/guest-settings", response_model=GuestSettingsOut)
def set_guest_settings(
    body: GuestSettingsIn,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Setzen nur ein Admin: die Zahl entscheidet, wie lange ein unangemeldeter
    Zugang gilt. Bereits ausgegebene Token behalten ihre alte Laufzeit — das
    Ablaufdatum steht im JWT; wer sie sofort loswerden will, startet den
    Gastzugang der Sitzung neu.
    """
    row = _settings(db)
    row.guest_token_minutes = body.guest_minutes
    db.commit()
    return GuestSettingsOut(guest_minutes=row.guest_token_minutes)


# ── Fächer je Werkzeug ──────────────────────────────────────────────────────
# Die Übersichten (z. B. /simulationen) filtern nach Fach. Voreinstellungen
# stehen im Frontend; hier liegen nur die Abweichungen, die ein Admin von Hand
# gesetzt hat — schulweit, damit alle Lehrkräfte dieselben Fächer sehen.

FAECHER_MAX = 8
FACH_LAENGE_MAX = 30


class ToolFaecherOut(BaseModel):
    faecher: dict[str, list[str]]


class ToolFaecherIn(BaseModel):
    # None heißt: zurück zur Voreinstellung.
    faecher: list[str] | None


@router.get("/tool-faecher", response_model=ToolFaecherOut)
def get_tool_faecher(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return ToolFaecherOut(faecher=_settings(db).tool_faecher or {})


@router.put("/tool-faecher/{slug}", response_model=ToolFaecherOut)
def set_tool_faecher(
    slug: str,
    body: ToolFaecherIn,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    if slug not in {t.slug for t in CATALOG}:
        raise HTTPException(404, "Unbekanntes Werkzeug")
    row = _settings(db)
    neu = dict(row.tool_faecher or {})
    if body.faecher is None:
        neu.pop(slug, None)
    else:
        sauber: list[str] = []
        for f in body.faecher:
            f = " ".join(str(f).split())
            if not f:
                continue
            if len(f) > FACH_LAENGE_MAX:
                raise HTTPException(422, f"Fach zu lang (höchstens {FACH_LAENGE_MAX} Zeichen)")
            if f.casefold() not in {x.casefold() for x in sauber}:
                sauber.append(f)
        if len(sauber) > FAECHER_MAX:
            raise HTTPException(422, f"Höchstens {FAECHER_MAX} Fächer je Werkzeug")
        neu[slug] = sauber
    # Neues Objekt zuweisen — eine geänderte JSON-Spalte merkt SQLAlchemy sonst nicht.
    row.tool_faecher = neu
    db.commit()
    return ToolFaecherOut(faecher=row.tool_faecher)
