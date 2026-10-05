"""Schlüsselwechsel: Mit SECRET_KEY_ALT bleiben gespeicherte Passwörter lesbar und
werden mit dem neuen Schlüssel neu verschlüsselt (pw_crypto.rotate)."""
from api import pw_crypto
from api.config import settings


def test_alter_schluessel_bleibt_lesbar_und_rotate_verschluesselt_neu(monkeypatch):
    monkeypatch.setattr(settings, "secret_key", "alter-schluessel")
    monkeypatch.setattr(settings, "secret_key_alt", "")
    alt = pw_crypto.encrypt("Sonne42")

    monkeypatch.setattr(settings, "secret_key", "neuer-schluessel-mit-mindestens-32-zeichen")
    assert pw_crypto.decrypt(alt) == ""  # ohne alten Schlüssel nicht lesbar
    monkeypatch.setattr(settings, "secret_key_alt", "alter-schluessel")
    assert pw_crypto.decrypt(alt) == "Sonne42"

    neu = pw_crypto.rotate(alt)
    assert neu != alt
    monkeypatch.setattr(settings, "secret_key_alt", "")
    assert pw_crypto.decrypt(neu) == "Sonne42"  # jetzt auch ohne den alten
    assert pw_crypto.rotate("klartext") == "klartext"
