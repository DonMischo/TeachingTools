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
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import SchoolSettings

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
