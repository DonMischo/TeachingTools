"""Schuljahresbereinigung: Sitzungen aus abgelaufenen Schuljahren loeschen.

Eine Spielsitzung ist ein Stundenprotokoll — wer mitgespielt hat, was er
geantwortet hat, wie lange er gebraucht hat. Das ist fuer die Auswertung der
Stunde da und nicht laenger; Art. 5 (1)(e) DSGVO verlangt eine Frist, und die
natuerliche Frist einer Schule ist das Schuljahr.

Stichtag ist der 1. August (derselbe wie in api/schoolyear.py fuer die
AK-Codes): beim ersten Start im neuen Schuljahr faellt alles aus den
vorherigen. Der Lauf ist wiederholbar — laeuft er zweimal, findet er beim
zweiten Mal nichts mehr.

**Was bleibt:** vergebene Punkte. Transaction haengt an Klasse und Lehrkraft,
nicht an der Sitzung — der Hauspokal-Stand ueberlebt die Bereinigung. Ebenso
bleiben die Inhalte (Quizze, TaskCrawler, Lueckentexte): die sind Material, keine
Schuelerdaten.

**Was mitgeht:** alles unterhalb einer Sitzung. Teilnehmer, Antworten,
Versuche, Ereignisprotokolle haengen per ``ON DELETE CASCADE`` an ihrer
Sitzung, ein Loeschen der Sitzungszeile nimmt sie also mit.

**Das Audit-Log hat eine eigene, lange Frist:** zehn Schuljahre. Es haelt
keine Schuelerdaten, sondern belegt, wer wann auf welche Art von Daten
zugegriffen hat (Rechenschaftspflicht, Art. 5 (2) DSGVO) — das muss auch
Jahre spaeter noch nachweisbar sein.
"""
import logging
from datetime import date, datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from .join_codes import JOIN_CODE_TOOLS
from .models import AuditLog, QuizSession, SchreibraumRoom
from .schoolyear import get_school_year_start

log = logging.getLogger(__name__)

AUDIT_RETENTION_YEARS = 10


def school_year_cutoff(today: date | None = None) -> datetime:
    """Beginn des laufenden Schuljahres — alles davor ist vom letzten."""
    return datetime(get_school_year_start(today), 8, 1, tzinfo=timezone.utc)


def purge_old_sessions(db: Session, *, today: date | None = None) -> dict[str, int]:
    """Sitzungen aus abgelaufenen Schuljahren loeschen. Gibt die Anzahl je Werkzeug.

    Der Aufrufer committet.
    """
    cutoff = school_year_cutoff(today)
    geloescht: dict[str, int] = {}

    for tool in JOIN_CODE_TOOLS:
        model = tool.model
        q = db.query(model)

        if model is QuizSession:
            # Caputh bekam sein created_at erst spaeter; Altbestaende sind
            # ueber den Spielverlauf datierbar. Wo alle drei fehlen, wird
            # nicht geraten — die Zeile bleibt.
            q = q.filter(or_(
                model.created_at < cutoff,
                (model.created_at.is_(None)) & (model.finished_at < cutoff),
                (model.created_at.is_(None)) & (model.finished_at.is_(None)) & (model.started_at < cutoff),
            ))
        elif not hasattr(model, "created_at"):
            continue
        else:
            q = q.filter(model.created_at < cutoff)

        if model is SchreibraumRoom:
            # Ein Dauerraum ist bewusst kein Stundenprotokoll.
            q = q.filter(model.is_permanent == False)  # noqa: E712

        # Bewusst als Massenloeschung statt Zeile fuer Zeile ueber die ORM:
        # `Session.delete()` wuerde erst versuchen, die Kinder abzuhaengen
        # (session_id = NULL) und an deren NOT NULL scheitern. Ein schlichtes
        # DELETE ueberlaesst das dem ON DELETE CASCADE der Datenbank, das an
        # jeder dieser Kindtabellen deklariert ist.
        anzahl = q.delete(synchronize_session=False)
        if anzahl:
            geloescht[tool.key] = anzahl

    db.expire_all()
    return geloescht


def audit_cutoff(today: date | None = None) -> datetime:
    """Stichtag fuer das Audit-Log: zehn Schuljahre vor dem laufenden."""
    return datetime(get_school_year_start(today) - AUDIT_RETENTION_YEARS, 8, 1, tzinfo=timezone.utc)


def purge_old_audit(db: Session, *, today: date | None = None) -> int:
    """Audit-Eintraege loeschen, die aelter als zehn Schuljahre sind. Der Aufrufer committet."""
    return db.query(AuditLog).filter(AuditLog.ts < audit_cutoff(today)).delete(synchronize_session=False)
