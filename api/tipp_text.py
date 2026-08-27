"""Welche Zeichen die Schreibübung überhaupt erzeugen kann.

Die Übung liest rohe Tastenanschläge und rückt bei einem falschen nicht vor
(Fehlersperre). Ein Zeichen, das sich am deutschen Keyboard nicht mit einem
Anschlag — höchstens mit Umschalt — tippen lässt, hängt den Schüler deshalb
endgültig auf: er kann die Stelle nie richtig treffen.

Darum werden solche Zeichen abgelehnt, wo Text von aussen hereinkommt: beim
Hochladen eigener Sammlungen und beim Anlegen eines Wettschreiben-Rennens.
"""
from fastapi import HTTPException

# ^ ´ ` sind Tottasten: sie erscheinen erst zusammen mit dem nächsten Anschlag.
TOTTASTEN = "^´`"

# Dritte Belegungsebene. Der Eingabe-Hook der Übung verwirft Anschläge mit
# Strg/Alt (und AltGr meldet sich unter Windows als Strg+Alt), diese Zeichen
# kommen also gar nicht erst an.
ALTGR_ZEICHEN = "@€[]{}\\~|²³µ"


def pruefe_tippbar(text: str, wo: str) -> None:
    """Wirft 400, wenn `text` Zeichen enthält, die die Übung nicht annimmt."""
    tot = sorted({c for c in text if c in TOTTASTEN})
    if tot:
        raise HTTPException(
            400,
            f"{wo}: Der Text enthält Tottasten ({' '.join(tot)}). Diese Zeichen entstehen "
            "am deutschen Keyboard erst zusammen mit dem nächsten Anschlag und lassen sich "
            "in der Übung nicht tippen — bitte ersetzen.",
        )

    altgr = sorted({c for c in text if c in ALTGR_ZEICHEN})
    if altgr:
        raise HTTPException(
            400,
            f"{wo}: Der Text enthält Zeichen, die AltGr brauchen ({' '.join(altgr)}). "
            "Die Übung nimmt keine Anschläge mit Strg/Alt an — bitte ersetzen "
            "(zum Beispiel »at« statt @ oder »Euro« statt €).",
        )
