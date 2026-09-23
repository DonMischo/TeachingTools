"""TOTP two-factor authentication (RFC 6238) — Google Authenticator, Authy, …

Self-hosted on purpose: no SMS gateway and no push provider, so no third party
ever learns who logs in and no Art. 28 processor agreement is needed.

Hier haengen zwei Dinge daran, beide aus einem Grund — Klarpasswoerter:

  * Ein Admin, der das Passwort einer Lehrkraft sehen will, gibt bei *jedem*
    Abruf einen frischen Code mit (Step-up, siehe routers/twofa.require_totp).
  * Eine Klassenleitung, die die Zugangsdaten ihrer Klasse exportieren will,
    muss Zwei-Faktor eingerichtet haben.

Uebernommen aus dem Werkstatt-Tool (backend/totp.py), unveraendert bis auf den
ISSUER — die Datei hat dort schon Tests und laeuft im Betrieb.

The shared secret is stored as-is, like the bcrypt password hashes beside it:
anyone who can read this column can already read those, so encrypting it with a
key that must itself live on the same host would add ceremony, not security.
"""
from __future__ import annotations

import json
import secrets
import time

import bcrypt
import pyotp
import qrcode
import qrcode.image.svg

ISSUER = "TT - Teaching Tools"

# One step either side of now, to tolerate clock drift between phone and server.
VALID_WINDOW = 1
STEP_SECONDS = 30

RECOVERY_CODE_COUNT = 8
_RECOVERY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"   # no l/o/0/1


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=ISSUER)


def qr_svg(uri: str) -> str:
    """Inline SVG for the enrolment QR code.

    Rendered here rather than in the browser so the frontend needs no QR
    library, and so the secret never has to be put into a URL.
    """
    img = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    return img.to_string(encoding="unicode")


def current_counter(at: float | None = None) -> int:
    return int((at if at is not None else time.time()) // STEP_SECONDS)


def verify(secret: str, code: str, last_counter: int = 0) -> int | None:
    """Check `code` against `secret`; returns the accepted counter, or None.

    A code is refused when its time step is not newer than `last_counter`, so
    the same code cannot be replayed inside its own validity window.
    """
    code = (code or "").strip().replace(" ", "")
    if not secret or not code.isdigit() or len(code) != 6:
        return None

    totp = pyotp.TOTP(secret)
    now = current_counter()
    for offset in range(-VALID_WINDOW, VALID_WINDOW + 1):
        counter = now + offset
        if counter <= last_counter:
            continue   # already used, or older than the last accepted code
        if secrets.compare_digest(totp.at(counter * STEP_SECONDS), code):
            return counter
    return None


# ---------------------------------------------------------------------------
# Recovery codes — the way back in when the phone is gone
# ---------------------------------------------------------------------------

def new_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> list[str]:
    def one() -> str:
        raw = "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(10))
        return f"{raw[:5]}-{raw[5:]}"
    return [one() for _ in range(count)]


def hash_recovery_codes(codes: list[str]) -> str:
    return json.dumps([
        bcrypt.hashpw(c.encode(), bcrypt.gensalt()).decode() for c in codes
    ])


def consume_recovery_code(stored: str | None, code: str) -> str | None:
    """Return the remaining codes as JSON if `code` matched, else None.

    Each code works once: a match is removed from the stored list.
    """
    code = (code or "").strip().lower()
    if not code:
        return None
    try:
        hashes = json.loads(stored or "[]")
    except (json.JSONDecodeError, TypeError):
        return None

    for h in hashes:
        try:
            matched = bcrypt.checkpw(code.encode(), h.encode())
        except ValueError:
            continue
        if matched:
            return json.dumps([x for x in hashes if x != h])
    return None


def recovery_codes_left(stored: str | None) -> int:
    try:
        return len(json.loads(stored or "[]"))
    except (json.JSONDecodeError, TypeError):
        return 0
