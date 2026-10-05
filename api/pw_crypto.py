"""Reversible at-rest encryption for *displayable* credentials — login passwords
and password-like custom fields — so a DB dump alone can't reveal them (the env
secret is also required).

This is intentionally reversible: login passwords must be reprintable on the
Zugangsdaten-CSV and student cards. Login *verification* still uses the one-way
bcrypt hash (see auth.hash_password); this module only concerns re-display.

Uses Fernet (AES-128-CBC + HMAC, from the `cryptography` package) with a key
derived from settings.secret_key. If that secret is left at its default the
encryption provides no protection — set a real SECRET_KEY in production.
"""
import base64
import hashlib
import logging
import re

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from .config import settings

_PREFIX = "enc:v1:"

# Custom-field keys whose values are password-like and must be encrypted at rest:
# password/Passwort/Passwörter/passwd, Kennwort, credential(s), secret, geheim, PIN.
_SENSITIVE_RE = re.compile(r"passw|kennwort|credential|secret|geheim|\bpwd\b|\bpin\b", re.IGNORECASE)

_log = logging.getLogger(__name__)


def _schluessel(geheim: str) -> Fernet:
    # A stable 32-byte urlsafe-base64 Fernet key derived from the app secret.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(geheim.encode()).digest()))


def _fernet() -> MultiFernet:
    """Encrypts with the current secret; decrypts with it or, during a key change,
    with the previous one (settings.secret_key_alt)."""
    keys = [_schluessel(settings.secret_key)]
    if settings.secret_key_alt and settings.secret_key_alt != settings.secret_key:
        keys.append(_schluessel(settings.secret_key_alt))
    return MultiFernet(keys)


def encrypt(plain: str) -> str:
    """Encrypt a plaintext for at-rest storage, tagged with a version prefix so
    reads can tell encrypted values from legacy plaintext. Empty stays empty."""
    if not plain:
        return plain
    return _PREFIX + _fernet().encrypt(plain.encode()).decode()


def decrypt(value: str) -> str:
    """Inverse of encrypt(); passes through anything without the prefix (legacy
    plaintext). Returns '' if a marked token can't be authenticated (e.g. the
    secret_key changed) so ciphertext is never shown to a user."""
    if not isinstance(value, str) or not value.startswith(_PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        _log.warning("Could not decrypt a stored credential (secret_key changed?)")
        return ""


def rotate(value: str) -> str:
    """Re-encrypt a stored value with the current secret (after a key change).
    Plaintext and undecryptable values are returned unchanged."""
    if not isinstance(value, str) or not value.startswith(_PREFIX):
        return value
    try:
        return _PREFIX + _fernet().rotate(value[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        return value


def display_password(obj) -> str:
    """Plaintext login password of a Student/Teacher for re-display: the decrypted
    stored value if present, else the seed-derived one (legacy rows), else empty."""
    enc = getattr(obj, "password_enc", None)
    if enc:
        return decrypt(enc)
    seed = getattr(obj, "password_seed", None)
    if seed:
        from .password_gen import generate_password
        return generate_password(seed)
    return ""


def is_sensitive_key(key: str) -> bool:
    """True for custom-field names that look like they hold a secret."""
    return bool(_SENSITIVE_RE.search(key or ""))


def encrypt_sensitive(extra: dict) -> dict:
    """Copy of `extra` with password-like values encrypted at rest (idempotent —
    already-encrypted values are left as-is)."""
    out: dict = {}
    for k, v in (extra or {}).items():
        if is_sensitive_key(k) and isinstance(v, str) and v and not v.startswith(_PREFIX):
            out[k] = encrypt(v)
        else:
            out[k] = v
    return out


def decrypt_extra(extra: dict) -> dict:
    """Copy of `extra` with any encrypted values decrypted for display."""
    return {k: (decrypt(v) if isinstance(v, str) else v) for k, v in (extra or {}).items()}
