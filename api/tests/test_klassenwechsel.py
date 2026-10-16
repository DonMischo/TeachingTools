"""Klassenbezeichnungen ruecken zum 1. August von selbst weiter (aus dem AK-Code),
nicht erst mit dem naechsten CSV-Import."""
from datetime import date

from api.klassenwechsel import klassen_weiterruecken
from api.models import Class, Student

SCHULJAHR_2026 = date(2026, 9, 1)   # AK2031a ist 2025/26 die 7a, 2026/27 die 8a


def _klasse(db, code, ak):
    c = Class(code=code, display_name=f"Klasse {code}", ak_code=ak)
    db.add(c)
    db.flush()
    return c


def _schueler(db, klasse, ak, cls=None):
    s = Student(nachname="Test", vorname=klasse, klasse=klasse, ak_code=ak, class_id=cls.id if cls else None,
                jahrgang=int("".join(ch for ch in klasse if ch.isdigit()) or 0) or None)
    db.add(s)
    db.flush()
    return s


def test_klasse_und_schueler_ruecken_weiter(db):
    c = _klasse(db, "7a", "AK2031a")
    mit_ak = _schueler(db, "7a", "AK2031a", c)
    ohne_ak = _schueler(db, "7a", None, c)       # z.B. Testzugang: folgt seiner Klasse

    assert klassen_weiterruecken(db, SCHULJAHR_2026) == 1
    assert (c.code, c.display_name) == ("8a", "Klasse 8a")
    assert (mit_ak.klasse, mit_ak.jahrgang) == ("8a", 8)
    assert (ohne_ak.klasse, ohne_ak.jahrgang) == ("8a", 8)


def test_ganze_schule_rueckt_ohne_zusammenstoss(db):
    """7a -> 8a, waehrend die alte 8a gleichzeitig 9a wird (code ist unique)."""
    a = _klasse(db, "7a", "AK2031a")
    b = _klasse(db, "8a", "AK2030a")
    assert klassen_weiterruecken(db, SCHULJAHR_2026) == 2
    assert (a.code, b.code) == ("8a", "9a")


def test_zweiter_lauf_aendert_nichts(db):
    _klasse(db, "7a", "AK2031a")
    klassen_weiterruecken(db, SCHULJAHR_2026)
    assert klassen_weiterruecken(db, SCHULJAHR_2026) == 0


def test_vor_dem_stichtag_bleibt_alles(db):
    c = _klasse(db, "7a", "AK2031a")
    assert klassen_weiterruecken(db, date(2026, 7, 31)) == 0
    assert c.code == "7a"


def test_eigene_bezeichnungen_und_abgaenger_bleiben(db):
    bili = _klasse(db, "Bili-7", "AK2031b")        # von Hand benannt: kein Klasse+Buchstabe
    abgang = _klasse(db, "13a", "AK2025a")         # waere »14a«
    s = _schueler(db, "13a", "AK2025a", abgang)
    assert klassen_weiterruecken(db, SCHULJAHR_2026) == 0
    assert (bili.code, abgang.code, s.klasse) == ("Bili-7", "13a", "13a")


def test_belegte_bezeichnung_wird_uebersprungen(db):
    """Haelt eine Klasse ohne AK-Code schon »8a«, bleibt die 7a stehen statt zu kollidieren."""
    c = _klasse(db, "7a", "AK2031a")
    _klasse(db, "8a", None)
    assert klassen_weiterruecken(db, SCHULJAHR_2026) == 0
    assert c.code == "7a"
