"""
Deterministic password generator.
Given an integer seed (e.g. a student's pokedex_number), always produces
the same password — making it reproducible for teacher lookups and CSV exports.

Format: {Adjective}{Noun}{3-digit-number}
Example: BlaueTiger042
"""
import random

_ADJECTIVES = [
    "Blaue", "Rote", "Grüne", "Schnelle", "Starke", "Wilde", "Helle", "Dunkle",
    "Große", "Kleine", "Mutige", "Kluge", "Freche", "Bunte", "Leise", "Laute",
    "Kalte", "Warme", "Neue", "Alte", "Sanfte", "Rasche", "Treue", "Freie",
    "Edle", "Kühne", "Stolze", "Wache", "Zarte", "Flinke",
]

_NOUNS = [
    "Tiger", "Adler", "Drache", "Wolf", "Fuchs", "Bär", "Löwe", "Falke",
    "Luchs", "Otter", "Igel", "Dachs", "Rabe", "Storch", "Elch", "Puma",
    "Panther", "Gepard", "Zebra", "Bison", "Wal", "Delfin", "Hai", "Möwe",
    "Biber", "Fink", "Specht", "Marder", "Wisent", "Kormoran",
]


def pokemon_password(seed: int) -> str:
    """Deterministic password from an integer seed."""
    rng = random.Random(seed)
    adj  = rng.choice(_ADJECTIVES)
    noun = rng.choice(_NOUNS)
    num  = rng.randint(0, 999)
    return f"{adj}{noun}{num:03d}"


# Kept for backwards compatibility with any code that referenced the list;
# the list itself is no longer stored in the repository.
POKEMON_DE: list[str] = []
