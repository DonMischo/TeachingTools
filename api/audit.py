"""Fortgeschriebenes Protokoll sicherheitsrelevanter Zugriffe.

Uebernommen aus dem Werkstatt-Tool (backend/audit.py), auf die Konten hier
angepasst. Zwei Regeln daraus gelten unveraendert:

**Schreiben darf nie den Aufruf kippen.** Ein kaputtes Protokoll ist aergerlich,
ein abgebrochener Zugangsdaten-Export mitten in der Klassenleitung ist es mehr.
Deshalb ist jeder Schreibvorgang eingepackt.

**Mit `db` in derselben Transaktion, ohne `db` in einer eigenen.** Protokolliert
wird hier immer eine *gelungene* Aktion — dann gehoert die Zeile zur Aktion und
soll mit ihr stehen oder fallen. Fuer den anderen Fall (etwas festhalten, das
gerade gescheitert ist, oder aus einem Kontext ohne DB-Sitzung) bleibt der Weg
ueber eine eigene kurze Sitzung offen.

**Es steht nichts Personenbezogenes drin.** Wer hat wann *welche Art* von
Datensatz geholt — nicht, was drinstand. Siehe models.AuditLog.
"""
import logging
import os

from fastapi import Request
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import AuditLog, Student, Teacher

log = logging.getLogger(__name__)

# X-Forwarded-For ist faelschbar, solange kein Reverse Proxy den Kopf
# ueberschreibt. TRUST_PROXY_HEADERS=1 nur setzen, wenn einer davorsteht.
TRUST_PROXY_HEADERS = os.environ.get("TRUST_PROXY_HEADERS", "0") == "1"


def client_ip(request: Request | None) -> str:
    if request is None:
        return ""
    if TRUST_PROXY_HEADERS:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            # Links steht der echte Client — der Proxy ersetzt den Kopf, haengt
            # nicht an, es ist also genau ein Sprung drin.
            return fwd.split(",")[0].strip()[:45]
    return (request.client.host if request.client else "")[:45]


def actor_name(user) -> tuple[str | None, int | None]:
    """(Anzeigename, Id) fuer die Protokollzeile — nie der Klarname eines Kindes."""
    if isinstance(user, Teacher):
        return (user.username or f"{user.first_name} {user.last_name}".strip())[:100], user.id
    if isinstance(user, Student):
        # Schueler loesen keine dieser Aktionen aus; falls doch, reicht die Id.
        return (user.username or f"schueler#{user.id}")[:100], user.id
    return None, None


def audit(
    action: str,
    user=None,
    target: str = "",
    detail: str = "",
    request: Request | None = None,
    db: Session | None = None,
) -> None:
    """Eine Zeile schreiben. Fehler werden geschluckt und geloggt, nie geworfen.

    `db` mitgeben, wenn die protokollierte Aktion gerade gelungen ist: dann
    haengt die Zeile an derselben Transaktion. Ohne `db` wird eine eigene kurze
    Sitzung benutzt.
    """
    try:
        actor, actor_id = actor_name(user)
        zeile = AuditLog(
            actor=actor,
            actor_id=actor_id,
            action=action[:60],
            target=str(target)[:120],
            detail=str(detail)[:255],
            ip=client_ip(request),
        )
        if db is not None:
            db.add(zeile)
            db.commit()
            return
        with SessionLocal() as ses:
            ses.add(AuditLog(
                actor=actor,
                actor_id=actor_id,
                action=action[:60],
                target=str(target)[:120],
                detail=str(detail)[:255],
                ip=client_ip(request),
            ))
            ses.commit()
    except Exception:  # noqa: BLE001 — Protokollieren darf den Aufruf nie kippen
        log.exception("Audit-Eintrag fehlgeschlagen: %s", action)
