"""Zwei-Faktor fuer Lehrkraftkonten — Einrichtung und Step-up.

Angemeldet bleibt man hier wie bisher mit Benutzername und Passwort: der zweite
Faktor haengt nicht am Login, sondern an zwei einzelnen Handgriffen, bei denen
ein Klarpasswort ueber die Leitung geht.

  * **Step-up** — ``require_totp``: das Passwort einer Lehrkraft ansehen. Bei
    *jedem* Abruf ein frischer Code. Eine uebernommene Sitzung reicht dann
    nicht mehr, es braucht auch das Telefon.
  * **Voraussetzung** — ``has_totp``: eine Klassenleitung, die die Zugangsdaten
    ihrer Klasse exportieren will, muss Zwei-Faktor eingerichtet haben. Hier
    genuegt die eingerichtete Einrichtung; einen Code pro Abruf zu verlangen
    waere fuer eine Liste, die man am Elternabend austeilt, unverhaeltnismaessig.

Die Kryptografie steckt in api/totp.py (aus dem Werkstatt-Tool uebernommen).
"""
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import totp as totp_lib
from ..audit import audit
from ..auth import get_current_teacher, verify_password
from ..database import get_db
from ..models import Teacher

router = APIRouter(prefix="/api/2fa", tags=["2fa"])


# ── Bausteine fuer andere Router ───────────────────────────────────────────

def has_totp(user) -> bool:
    """Hat dieses Konto Zwei-Faktor scharf geschaltet?"""
    return isinstance(user, Teacher) and bool(user.totp_confirmed and user.totp_secret)


# Fehlversuche je Konto, fuer die Bremse unten. Im Prozess statt in der DB:
# der Zaehler darf einen Neustart vergessen, und ein Schreibzugriff pro
# Fehlversuch waere selbst ein kleiner Hebel.
_FEHLVERSUCHE: dict[int, list[float]] = {}
MAX_FEHLVERSUCHE = 5
FENSTER_SEKUNDEN = 300


def _bremse(teacher_id: int) -> None:
    """Wirft 429, wenn zuletzt zu oft ein falscher Code kam.

    Sechs Stellen sind eine Million Moeglichkeiten, aber es gilt immer nur ein
    Zeitfenster: ohne Bremse waere das Raten mit genug Anfragen pro Minute eine
    reale Option. Mit ihr ist es keine.
    """
    jetzt = time.time()
    versuche = [t for t in _FEHLVERSUCHE.get(teacher_id, []) if jetzt - t < FENSTER_SEKUNDEN]
    _FEHLVERSUCHE[teacher_id] = versuche
    if len(versuche) >= MAX_FEHLVERSUCHE:
        wartezeit = int(FENSTER_SEKUNDEN - (jetzt - versuche[0]))
        raise HTTPException(429, f"Zu viele Fehlversuche. Bitte {wartezeit} Sekunden warten.")


def require_totp(db: Session, user: Teacher, code: str | None) -> None:
    """Step-up: einen frischen Code verlangen und verbrauchen.

    Der angenommene Zeitschritt wird festgehalten, damit derselbe Code kein
    zweites Mal geht — auch nicht innerhalb der 30 Sekunden, in denen er
    rechnerisch noch gueltig waere.
    """
    if not has_totp(user):
        raise HTTPException(
            403,
            "Dafür braucht dein Konto Zwei-Faktor. Einzurichten unter »Konto → Zwei-Faktor«.",
        )
    _bremse(user.id)
    counter = totp_lib.verify(user.totp_secret, code or "", user.totp_last_counter)
    if counter is None:
        _FEHLVERSUCHE.setdefault(user.id, []).append(time.time())
        raise HTTPException(403, "Der Code stimmt nicht (oder wurde schon benutzt).")
    _FEHLVERSUCHE.pop(user.id, None)   # gelungen: Zaehler zurueck auf null
    user.totp_last_counter = counter
    db.commit()


# ── Schemas ────────────────────────────────────────────────────────────────

class StatusOut(BaseModel):
    confirmed: bool
    # Wie viele Wiederherstellungscodes noch ungebraucht sind.
    recovery_left: int


class SetupOut(BaseModel):
    # Zum Abtippen, wenn die Kamera streikt.
    secret: str
    otpauth_uri: str
    qr_svg: str


class CodeIn(BaseModel):
    code: str


class ActivateOut(BaseModel):
    # Einmalig im Klartext — danach stehen nur noch bcrypt-Hashes in der DB.
    recovery_codes: list[str]


class DisableIn(BaseModel):
    password: str


# ── Endpunkte ──────────────────────────────────────────────────────────────

@router.get("/status", response_model=StatusOut)
def status(current: Teacher = Depends(get_current_teacher)):
    return StatusOut(
        confirmed=bool(current.totp_confirmed),
        recovery_left=totp_lib.recovery_codes_left(current.recovery_codes),
    )


@router.post("/setup", response_model=SetupOut)
def setup(db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    """Einrichtung beginnen: ein neues Geheimnis und der QR dazu.

    Solange nicht bestaetigt ist, darf das jederzeit neu angestossen werden —
    ein abgebrochener Versuch soll niemanden aussperren. Ist Zwei-Faktor schon
    scharf, muss es erst abgeschaltet werden.
    """
    if current.totp_confirmed:
        raise HTTPException(409, "Zwei-Faktor ist bereits eingerichtet.")
    secret = totp_lib.new_secret()
    current.totp_secret = secret
    db.commit()
    uri = totp_lib.provisioning_uri(secret, current.username or f"lehrkraft{current.id}")
    return SetupOut(secret=secret, otpauth_uri=uri, qr_svg=totp_lib.qr_svg(uri))


@router.post("/activate", response_model=ActivateOut)
def activate(
    body: CodeIn,
    request: Request,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Mit einem echten Code bestaetigen. Erst danach gilt Zwei-Faktor."""
    if not current.totp_secret:
        raise HTTPException(409, "Erst die Einrichtung starten.")
    counter = totp_lib.verify(current.totp_secret, body.code, current.totp_last_counter)
    if counter is None:
        raise HTTPException(400, "Der Code stimmt nicht.")
    codes = totp_lib.new_recovery_codes()
    current.totp_confirmed = True
    current.totp_last_counter = counter
    current.recovery_codes = totp_lib.hash_recovery_codes(codes)
    db.commit()
    audit("2fa.activate", current, target=current.username or str(current.id),
          request=request, db=db)
    return ActivateOut(recovery_codes=codes)


@router.post("/disable", status_code=204)
def disable(
    body: DisableIn,
    request: Request,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Abschalten — mit dem eigenen Passwort, nicht mit einem Code.

    Wer das Telefon verloren hat, kommt sonst nicht mehr heran; das Passwort
    hat er noch. Die Wiederherstellungscodes decken den umgekehrten Fall ab.
    """
    if not current.password_hash or not verify_password(body.password, current.password_hash):
        raise HTTPException(403, "Passwort stimmt nicht.")
    current.totp_secret = None
    current.totp_confirmed = False
    current.totp_last_counter = 0
    current.recovery_codes = "[]"
    db.commit()
    audit("2fa.disable", current, target=current.username or str(current.id),
          request=request, db=db)


@router.post("/recovery", response_model=ActivateOut)
def use_recovery(
    body: CodeIn,
    request: Request,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Einen Wiederherstellungscode einloesen — schaltet Zwei-Faktor ab.

    Danach ist das Konto wieder nur mit Passwort geschuetzt und die Einrichtung
    faengt von vorn an. Das ist Absicht: ein verlorenes Telefon soll den Zugang
    zurueckgeben, nicht die zweite Huerde still weiterlaufen lassen.
    """
    rest = totp_lib.consume_recovery_code(current.recovery_codes, body.code)
    if rest is None:
        raise HTTPException(403, "Dieser Wiederherstellungscode gilt nicht.")
    current.recovery_codes = rest
    current.totp_secret = None
    current.totp_confirmed = False
    current.totp_last_counter = 0
    db.commit()
    audit("2fa.recovery.used", current, target=current.username or str(current.id),
          request=request, db=db)
    return ActivateOut(recovery_codes=[])
