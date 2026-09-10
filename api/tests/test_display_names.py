"""display_names: Kurzform, Geburtstagsfenster, Sichtbarkeit."""
from datetime import date

import pytest

from api.display_names import (
    NameScope, abbreviate_parts, abbreviate_stored, birthday_soon, full_name,
    rufname, short_name, student_out,
)
from api.models import Student, Teacher


def _s(**kw) -> Student:
    base = dict(id=1, vorname="Anna", nachname="Bauer", klasse="7a", class_id=5,
                alias=None, geburtsdatum=None, nta=[], username=None,
                password_hash=None, nummer=None, jahrgang=7, active=True)
    base.update(kw)
    return Student(**base)


class TestKurzform:
    def test_vorname_plus_initiale(self):
        assert short_name(_s()) == "Anna B."

    def test_alias_schlaegt_vorname(self):
        assert short_name(_s(alias="Ann")) == "Ann B."
        assert rufname(_s(alias="Ann")) == "Ann"

    def test_voller_name_bleibt_voll(self):
        assert full_name(_s()) == "Anna Bauer"

    @pytest.mark.parametrize("vor,nach,erwartet", [
        ("Anna", "Bauer", "Anna B."),
        ("Anna", "", "Anna"),
        ("", "Bauer", "B."),
        ("Anna Maria", "von Bauer", "Anna Maria v."),
    ])
    def test_zusammensetzen(self, vor, nach, erwartet):
        assert abbreviate_parts(vor, nach) == erwartet


class TestGespeicherteNamen:
    @pytest.mark.parametrize("roh,erwartet", [
        ("Anna Bauer", "Anna B."),
        ("Anna B.", "Anna B."),          # idempotent
        ("Anna", "Anna"),                 # ein Wort bleibt
        ("Gast", "Gast"),
        ("  Anna   Bauer  ", "Anna B."),
        ("", ""),
        ("Anna Maria Bauer", "Anna Maria B."),
    ])
    def test_kuerzen(self, roh, erwartet):
        assert abbreviate_stored(roh) == erwartet


class TestGeburtstagsfenster:
    HEUTE = date(2026, 6, 15)

    @pytest.mark.parametrize("tag,drin", [
        (date(2010, 6, 15), True),    # heute
        (date(2010, 6, 20), True),    # +5
        (date(2010, 6, 10), True),    # -5
        (date(2010, 6, 21), False),   # +6
        (date(2010, 6, 9), False),    # -6
    ])
    def test_fenster(self, tag, drin):
        assert birthday_soon(tag, today=self.HEUTE) is drin

    def test_ueber_den_jahreswechsel(self):
        assert birthday_soon(date(2010, 12, 30), today=date(2027, 1, 3)) is True
        assert birthday_soon(date(2010, 1, 2), today=date(2026, 12, 29)) is True

    def test_29_februar_im_normaljahr(self):
        # zaehlt als 1.3.
        assert birthday_soon(date(2008, 2, 29), today=date(2026, 3, 2)) is True
        assert birthday_soon(date(2008, 2, 29), today=date(2026, 4, 2)) is False

    def test_ohne_datum(self):
        assert birthday_soon(None, today=self.HEUTE) is False


class TestNameScope:
    """Wer sieht wen ausgeschrieben. `db` ist nur fuer die Rechteabfrage noetig."""

    def test_klassenleitung_sieht_voll(self, db):
        kl = Teacher(first_name="Kim", last_name="Klein", role="teacher", klasse_id=5, active=True)
        scope = NameScope(db, kl)
        assert scope.full(_s(class_id=5)) is True
        assert scope.name(_s(class_id=5)) == "Anna Bauer"

    def test_fremde_klasse_nur_kurz(self, db):
        kl = Teacher(first_name="Kim", last_name="Klein", role="teacher", klasse_id=9, active=True)
        scope = NameScope(db, kl)
        assert scope.full(_s(class_id=5)) is False
        assert scope.name(_s(class_id=5)) == "Anna B."

    def test_admin_sieht_voll(self, db):
        scope = NameScope(db, Teacher(first_name="A", last_name="D", role="admin", active=True))
        assert scope.name(_s()) == "Anna Bauer"

    def test_schueler_sieht_mitschueler_kurz_sich_selbst_voll(self, db):
        ich = _s(id=1)
        scope = NameScope(db, ich)
        assert scope.name(ich) == "Anna Bauer"
        assert scope.name(_s(id=2, vorname="Ben", nachname="Cruz")) == "Ben C."

    def test_geburtstag_nur_klassenleitung_und_nur_im_fenster(self, db):
        heute = date.today()
        bald = _s(class_id=5, geburtsdatum=date(2010, heute.month, heute.day))
        fern = _s(id=2, class_id=5, geburtsdatum=date(2010, 1, 1) if heute.month != 1 else date(2010, 7, 1))

        kl = Teacher(first_name="Kim", last_name="Klein", role="teacher", klasse_id=5, active=True)
        assert NameScope(db, kl).birthday(bald) == bald.geburtsdatum
        assert NameScope(db, kl).birthday(fern) is None

        fremd = Teacher(first_name="F", last_name="F", role="teacher", klasse_id=9, active=True)
        assert NameScope(db, fremd).birthday(bald) is None
        assert NameScope(db, _s(id=99)).birthday(bald) is None


class TestStudentOut:
    def test_kurzform_und_kein_geburtstag_fuer_fremde(self, db):
        fremd = Teacher(first_name="F", last_name="F", role="teacher", klasse_id=9, active=True)
        out = student_out(_s(geburtsdatum=date(2010, 6, 15)), NameScope(db, fremd))
        assert (out.vorname, out.nachname) == ("Anna", "B.")
        assert out.display_name == "Anna B."
        assert out.geburtsdatum is None

    def test_klassenleitung_bekommt_den_datensatz(self, db):
        kl = Teacher(first_name="K", last_name="K", role="teacher", klasse_id=5, active=True)
        out = student_out(_s(), NameScope(db, kl))
        assert (out.vorname, out.nachname) == ("Anna", "Bauer")
        # display_name bleibt die Kurzform — es ist das Feld zum Anzeigen.
        assert out.display_name == "Anna B."

    def test_alias_ersetzt_den_vornamen_in_der_kurzform(self, db):
        fremd = Teacher(first_name="F", last_name="F", role="teacher", klasse_id=9, active=True)
        out = student_out(_s(alias="Ann"), NameScope(db, fremd))
        assert out.vorname == "Ann"
        assert out.display_name == "Ann B."


class TestGeschlechtSchalter:
    """Schulweiter Schalter: aus heisst, das Geschlecht steht in keiner Antwort."""

    def _schalter(self, db, an: bool):
        from api.models import SchoolSettings
        row = db.get(SchoolSettings, 1)
        if row is None:
            row = SchoolSettings(id=1)
            db.add(row)
        row.show_geschlecht = an
        db.flush()

    def test_aus_ist_die_voreinstellung(self, db):
        kl = Teacher(first_name="K", last_name="K", role="teacher", klasse_id=5, active=True)
        assert NameScope(db, kl).geschlecht(_s(geschlecht="weiblich")) is None

    def test_auch_die_klassenleitung_bekommt_nichts(self, db):
        self._schalter(db, False)
        kl = Teacher(first_name="K", last_name="K", role="teacher", klasse_id=5, active=True)
        out = student_out(_s(class_id=5, geschlecht="weiblich"), NameScope(db, kl))
        assert out.geschlecht is None

    def test_angeschaltet_kommt_es_wieder_durch(self, db):
        self._schalter(db, True)
        kl = Teacher(first_name="K", last_name="K", role="teacher", klasse_id=5, active=True)
        assert NameScope(db, kl).geschlecht(_s(geschlecht="weiblich")) == "weiblich"
        assert student_out(_s(class_id=5, geschlecht="weiblich"), NameScope(db, kl)).geschlecht == "weiblich"
