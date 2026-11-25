"""Gemeinsame Bausteine für Werkzeugsitzungen (ToolSession).

Bisher hatte jeder Router seine eigene Kopie von »Sitzung zum Code holen«,
»in welcher Spalte steht dieser Teilnehmer« und »welcher Name kommt in die
Übersicht«. Die liegen jetzt hier; siehe docs/plan-sitzung-dashboard-auswertung.md.
"""
import csv
import io
from typing import Iterable, Union

from fastapi import HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .auth import Guest
from .display_names import abbreviate_parts, abbreviate_stored, short_name
from .models import Student, Teacher, ToolSession

Spieler = Union[Teacher, Student, Guest]


def sitzung_fuer(db: Session, code: str, slugs: str | tuple[str, ...], falsch: str) -> ToolSession:
    """Die Sitzung zum Code; 404, wenn es sie nicht gibt, 400 mit ``falsch``,
    wenn sie zu einem anderen Werkzeug gehört."""
    erlaubt = (slugs,) if isinstance(slugs, str) else slugs
    session = db.query(ToolSession).filter_by(code=code.upper()).first()
    if not session:
        raise HTTPException(404, "Sitzung nicht gefunden")
    if session.tool_slug not in erlaubt:
        raise HTTPException(400, falsch)
    return session


def teilnehmer(spieler: Spieler) -> dict:
    """Die Spalte, in der dieser Teilnehmer steht: student_id, teacher_id oder guest_id."""
    if isinstance(spieler, Student):
        return {"student_id": spieler.id}
    if isinstance(spieler, Teacher):
        return {"teacher_id": spieler.id}
    return {"guest_id": spieler.id}


def anzeigename(spieler: Spieler) -> tuple[str, str | None, bool]:
    """Name, Klasse und Gast-Kennzeichen aus dem Konto bzw. dem Gast-Token —
    nie aus dem Browser."""
    if isinstance(spieler, Student):
        return (short_name(spieler), spieler.klasse, False)
    if isinstance(spieler, Teacher):
        return (abbreviate_parts(spieler.first_name or "", spieler.last_name or ""), None, False)
    return (abbreviate_stored(spieler.name)[:120], None, True)


def csv_antwort(kopf: list[str], zeilen: Iterable[Iterable], dateiname: str, trenner: str = ",") -> Response:
    """CSV als Download. UTF-8 mit BOM, sonst zeigt Excel die Umlaute falsch."""
    puffer = io.StringIO()
    schreiber = csv.writer(puffer, delimiter=trenner)
    schreiber.writerow(kopf)
    schreiber.writerows(zeilen)
    return Response(
        puffer.getvalue().encode("utf-8-sig"), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{dateiname}"'},
    )
