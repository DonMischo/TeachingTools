"""Sportfest Auswertung: rankings, the public view, and awarding class points.

The Auswertung boards are readable without logging in (they run on a beamer),
so the privacy contract is that names are only rendered for authenticated
callers. Awarding points, in contrast, books real Hauspokal Transactions and
must stay with teachers.
"""
import pytest

from api.auth import create_access_token
from api.models import (
    Class, SportfestDiscipline, SportfestResult, Student, Transaction,
)
from api.routers.sportfest.auswertung import KlasseEntry, _bayesian_normalize
from api.tests.conftest import auth

PREFIX = "/api/sportfest/auswertung"


@pytest.fixture()
def head(client, teacher) -> dict:
    client.cookies.clear()
    return auth(create_access_token({"sub": str(teacher.id), "type": "teacher"}))


@pytest.fixture()
def disciplines(db) -> None:
    db.add(SportfestDiscipline(id="sprint", name="Sprint", enabled=True))
    db.add(SportfestDiscipline(id="weitsprung", name="Weitsprung", enabled=True))
    db.add(SportfestDiscipline(id="ballwurf", name="Ballwurf", enabled=False))
    db.flush()


def _student(db, klass, vorname, *, jahrgang=2012, active=True, geschlecht="weiblich") -> Student:
    s = Student(nachname="Test", vorname=vorname, klasse=klass.code, class_id=klass.id,
                geschlecht=geschlecht, jahrgang=jahrgang, active=active)
    db.add(s)
    db.flush()
    return s


def _result(db, student, discipline_id, value, points) -> None:
    db.add(SportfestResult(student_id=student.id, discipline_id=discipline_id,
                           value=value, points=points))
    db.flush()


# ── Gesamtwertung ────────────────────────────────────────────────────────────

def test_gesamt_ranks_by_total_points(client, db, head, klass, disciplines):
    a = _student(db, klass, "Ada")
    b = _student(db, klass, "Bo")
    _result(db, a, "sprint", 7.0, 300)
    _result(db, a, "weitsprung", 4.0, 100)
    _result(db, b, "sprint", 6.5, 380)

    rows = client.get(f"{PREFIX}/gesamt", headers=head).json()
    assert [(r["rank"], r["name"], r["total_points"]) for r in rows] == [
        (1, "Ada T.", 400), (2, "Bo T.", 380),
    ]


def test_gesamt_ignores_disabled_disciplines(client, db, head, klass, disciplines):
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)
    _result(db, a, "ballwurf", 30.0, 500)      # discipline is disabled

    assert client.get(f"{PREFIX}/gesamt", headers=head).json()[0]["total_points"] == 300


def test_gesamt_lists_participants_without_results_and_skips_inactive(client, db, head, klass, disciplines):
    _student(db, klass, "Ada")
    _student(db, klass, "Weg", active=False)

    rows = client.get(f"{PREFIX}/gesamt", headers=head).json()
    assert [(r["name"], r["total_points"]) for r in rows] == [("Ada T.", 0)]


def test_gesamt_filters_by_jahrgang_and_geschlecht(client, db, head, klass, disciplines):
    _student(db, klass, "Ada", jahrgang=2012, geschlecht="weiblich")
    _student(db, klass, "Bo", jahrgang=2013, geschlecht="männlich")

    by_year = client.get(f"{PREFIX}/gesamt?jahrgang=2013", headers=head).json()
    assert [r["name"] for r in by_year] == ["Bo T."]

    by_gender = client.get(f"{PREFIX}/gesamt?geschlecht=weiblich", headers=head).json()
    assert [r["name"] for r in by_gender] == ["Ada T."]


def test_die_siegerehrung_laeuft_ohne_login_und_ohne_namen(client, db, klass, disciplines):
    """Die Disziplinauswertung ist die Beamer-Ansicht: kein Login, keine Namen."""
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)
    client.cookies.clear()

    disziplin = client.get(f"{PREFIX}/disziplin").json()
    assert disziplin[0]["name"] is None
    assert disziplin[0]["points"] == 300


def test_die_gesamtwertung_ist_lehrersache(client, db, klass, head, disciplines):
    """Anders als die Siegerehrung ist das eine vollstaendige Leistungsliste
    jedes Kindes der Schule — die gehoert nicht auf den Flur."""
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)

    client.cookies.clear()
    assert client.get(f"{PREFIX}/gesamt").status_code == 401

    gesamt = client.get(f"{PREFIX}/gesamt", headers=head).json()
    assert (gesamt[0]["name"], gesamt[0]["klasse"]) == ("Ada T.", "5a")


# ── Disziplinwertung ─────────────────────────────────────────────────────────

def test_disziplin_ranks_within_each_discipline(client, db, head, klass, disciplines):
    a = _student(db, klass, "Ada")
    b = _student(db, klass, "Bo")
    _result(db, a, "sprint", 7.0, 300)
    _result(db, b, "sprint", 6.5, 380)
    _result(db, a, "weitsprung", 4.0, 250)

    rows = client.get(f"{PREFIX}/disziplin", headers=head).json()
    sprint = [(r["rank"], r["name"]) for r in rows if r["discipline_id"] == "sprint"]
    weit = [(r["rank"], r["name"]) for r in rows if r["discipline_id"] == "weitsprung"]
    assert sprint == [(1, "Bo T."), (2, "Ada T.")]
    assert weit == [(1, "Ada T.")]


def test_disziplin_skips_unscored_results_and_disabled_disciplines(client, db, head, klass, disciplines):
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, None)         # e.g. unknown gender → no points
    _result(db, a, "ballwurf", 30.0, 400)       # disabled discipline

    assert client.get(f"{PREFIX}/disziplin", headers=head).json() == []


def test_disziplin_jahrgang_filter_can_be_widened_to_overall(client, db, head, klass, disciplines):
    a = _student(db, klass, "Ada", jahrgang=2012)
    b = _student(db, klass, "Bo", jahrgang=2013)
    _result(db, a, "sprint", 7.0, 300)
    _result(db, b, "sprint", 6.5, 380)

    one_year = client.get(f"{PREFIX}/disziplin?jahrgang=2012", headers=head).json()
    assert [r["name"] for r in one_year] == ["Ada T."]

    overall = client.get(f"{PREFIX}/disziplin?overall=true&jahrgang=2012", headers=head).json()
    assert [r["name"] for r in overall] == ["Bo T.", "Ada T."]


# ── Klassenwertung ───────────────────────────────────────────────────────────

def test_klassen_aggregates_per_class_and_skips_pointless_ones(client, db, head, klass, disciplines):
    other = Class(code="6b", display_name="Klasse 6b")
    db.add(other)
    db.flush()

    a = _student(db, klass, "Ada")
    b = _student(db, klass, "Bo")
    _result(db, a, "sprint", 7.0, 300)
    _result(db, b, "sprint", 6.5, 380)
    _student(db, other, "Cem")                  # no results at all

    rows = client.get(f"{PREFIX}/klassen", headers=head).json()
    assert len(rows) == 1
    assert rows[0]["klasse"] == "5a"
    assert rows[0]["raw_total"] == 680
    assert rows[0]["participant_count"] == 2
    assert rows[0]["class_id"] == klass.id


def test_bayesian_normalize_pulls_small_classes_towards_the_mean():
    """A 2-child class with a lucky total must not beat a whole class."""
    small = KlasseEntry(klasse="5a", jahrgang=2012, class_id=1, participant_count=2, raw_total=1000)
    big = KlasseEntry(klasse="6b", jahrgang=2011, class_id=2, participant_count=20, raw_total=900)

    small_adj, big_adj = _bayesian_normalize([small, big], prior_strength=10.0)
    prior = (1000 + 900) / 2

    assert small_adj.adjusted == pytest.approx((2 * 1000 + 10 * prior) / 12)
    assert big_adj.adjusted == pytest.approx((20 * 900 + 10 * prior) / 30)
    # The small class is dragged down towards the prior, the big one barely moves.
    assert small_adj.adjusted < small.raw_total
    assert abs(big_adj.adjusted - big.raw_total) < abs(small_adj.adjusted - small.raw_total)
    assert small_adj.awarded == round(small_adj.adjusted / 10)


def test_bayesian_normalize_without_a_prior_leaves_a_lone_class_untouched():
    only = KlasseEntry(klasse="5a", jahrgang=2012, class_id=1, participant_count=5, raw_total=500)
    (adj,) = _bayesian_normalize([only], prior_strength=10.0)
    assert adj.adjusted == pytest.approx(500.0)
    assert adj.awarded == 50


def test_bayesian_normalize_handles_an_empty_field():
    assert _bayesian_normalize([], prior_strength=10.0) == []


def test_prior_strength_zero_awards_the_raw_average(client, db, head, klass, disciplines):
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)

    rows = client.get(f"{PREFIX}/klassen-punkte/preview?prior_strength=0", headers=head).json()
    assert rows[0]["adjusted"] == pytest.approx(300.0)
    assert rows[0]["awarded"] == 30


# ── committing the points ────────────────────────────────────────────────────

def test_commit_books_one_transaction_per_class(client, db, head, teacher, klass, disciplines):
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)

    r = client.post(f"{PREFIX}/klassen-punkte/commit", headers=head,
                    json={"reason": "Sportfest 2026"})
    assert r.status_code == 200
    awarded = r.json()[0]["awarded"]

    txs = db.query(Transaction).all()
    assert [(t.teacher_id, t.class_id, t.points, t.reason) for t in txs] == [
        (teacher.id, klass.id, awarded, "Sportfest 2026"),
    ]


def test_commit_skips_classes_without_points_or_without_a_class_row(client, db, head, klass, disciplines):
    ghost = _student(db, klass, "Geist")
    ghost.klasse = "7z"                          # a label with no Class row
    ghost.class_id = None
    db.flush()
    _result(db, ghost, "sprint", 7.0, 300)

    r = client.post(f"{PREFIX}/klassen-punkte/commit", headers=head, json={})
    assert r.status_code == 200
    assert [e["klasse"] for e in r.json()] == ["7z"]
    assert db.query(Transaction).count() == 0    # nothing to book it against


def test_commit_is_teacher_only(client, db, klass, disciplines):
    """Regression: the guard used to accept any authenticated user, so a student
    could award class points — booked under an unrelated teacher's id."""
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)
    client.cookies.clear()

    student_head = auth(create_access_token({"sub": str(a.id), "type": "student"}))
    r = client.post(f"{PREFIX}/klassen-punkte/commit", headers=student_head, json={})
    assert r.status_code == 403
    assert db.query(Transaction).count() == 0

    assert client.post(f"{PREFIX}/klassen-punkte/commit", json={}).status_code == 401
    assert db.query(Transaction).count() == 0


# ── Siegerehrung statt Rangliste ─────────────────────────────────────────────

def test_disziplin_zeigt_nur_die_ersten_drei_je_geschlecht(client, db, head, klass, disciplines):
    """Die Disziplinauswertung ist eine Siegerehrung: drei Plaetze je Geschlecht.

    Vorher stand dort jede Leistung jedes Kindes der Schule — mit Namen, fuer
    jeden Angemeldeten lesbar.
    """
    for i, punkte in enumerate([500, 400, 300, 200]):
        _result(db, _student(db, klass, f"Junge{i}", geschlecht="männlich"), "sprint", 7.0 + i, punkte)
    for i, punkte in enumerate([550, 450, 350, 250]):
        _result(db, _student(db, klass, f"Maedchen{i}", geschlecht="weiblich"), "sprint", 6.0 + i, punkte)

    rows = client.get(f"{PREFIX}/disziplin", headers=head).json()
    sprint = [r for r in rows if r["discipline_id"] == "sprint"]

    jungen = [r for r in sprint if r["geschlecht"] == "männlich"]
    maedchen = [r for r in sprint if r["geschlecht"] == "weiblich"]
    assert len(jungen) == 3 and len(maedchen) == 3

    # Der Platz zaehlt je Geschlecht neu, nicht durch die ganze Disziplin.
    assert [r["rank"] for r in jungen] == [1, 2, 3]
    assert [r["rank"] for r in maedchen] == [1, 2, 3]

    # Die Vierten tauchen gar nicht mehr auf.
    assert [r["points"] for r in jungen] == [500, 400, 300]
    assert [r["points"] for r in maedchen] == [550, 450, 350]

    # Und die drei, die drinstehen, mit Kurzname, Klasse und Wert.
    erster = jungen[0]
    assert erster["name"] == "Junge0 T."
    assert erster["klasse"] == klass.code
    assert erster["value"] == 7.0


def test_disziplin_ohne_anmeldung_weiter_ohne_namen(client, db, klass, disciplines):
    _result(db, _student(db, klass, "Ada"), "sprint", 7.0, 300)
    client.cookies.clear()
    rows = client.get(f"{PREFIX}/disziplin").json()
    assert rows and all(r["name"] is None for r in rows)


# ── Klassenzuordnung über den AK-Code ────────────────────────────────────────
#
# `Student.klasse` wandert beim Jahrgangssprung mit ("7a" -> "8a"). Frueher war
# genau dieser Text der Schluessel zur Klasse: passte er nicht, fiel die Zeile
# mit class_id=None heraus und die Klasse bekam ihre Hauspokal-Punkte nicht.

def _mit_ak(db, klass, vorname, ak_code, klasse_text, punkte):
    """Ein Schueler mit stabilem AK-Code, dessen Kuerzel-Text abweichen darf."""
    s = Student(nachname="Test", vorname=vorname, klasse=klasse_text,
                class_id=None, ak_code=ak_code, geschlecht="weiblich",
                jahrgang=None, active=True)
    db.add(s)
    db.flush()
    _result(db, s, "sprint", 7.0, punkte)
    return s


def test_veraltetes_kuerzel_findet_die_klasse_trotzdem(client, db, head, klass, disciplines):
    """Der Text am Schueler hinkt hinterher, der AK-Code stimmt — die Punkte
    muessen bei der Klasse ankommen."""
    klass.ak_code = "AK2034a"
    db.flush()
    _mit_ak(db, klass, "Ada", "AK2034a", klasse_text="4a", punkte=300)

    zeilen = client.get(f"{PREFIX}/klassen", headers=head).json()
    assert len(zeilen) == 1
    assert zeilen[0]["class_id"] == klass.id           # zugeordnet, nicht verloren
    assert zeilen[0]["klasse"] == klass.code           # angezeigt wird das heutige Kuerzel
    assert zeilen[0]["raw_total"] == 300


def test_ohne_ak_code_greift_das_kuerzel(client, db, head, klass, disciplines):
    """425 von 515 Schuelern hatten zuletzt einen AK-Code — die anderen duerfen
    nicht durchs Raster fallen."""
    klass.ak_code = "AK2034a"
    db.flush()
    s = Student(nachname="Test", vorname="Bo", klasse=klass.code, class_id=None,
                ak_code=None, geschlecht="männlich", active=True)
    db.add(s)
    db.flush()
    _result(db, s, "sprint", 7.0, 200)

    zeilen = client.get(f"{PREFIX}/klassen", headers=head).json()
    assert [(z["class_id"], z["raw_total"]) for z in zeilen] == [(klass.id, 200)]


def test_beide_wege_landen_im_selben_eimer(client, db, head, klass, disciplines):
    """Ein Schueler ueber den AK-Code, einer ueber das Kuerzel — eine Klasse."""
    klass.ak_code = "AK2034a"
    db.flush()
    _mit_ak(db, klass, "Ada", "AK2034a", klasse_text="4a", punkte=300)
    s = Student(nachname="Test", vorname="Bo", klasse=klass.code, ak_code=None,
                geschlecht="männlich", active=True)
    db.add(s)
    db.flush()
    _result(db, s, "sprint", 7.0, 200)

    zeilen = client.get(f"{PREFIX}/klassen", headers=head).json()
    assert len(zeilen) == 1
    assert zeilen[0]["raw_total"] == 500
    assert zeilen[0]["participant_count"] == 2


def test_ohne_zuordenbare_klasse_bleibt_die_zeile_sichtbar_ohne_punkte(client, db, head, disciplines):
    """Sichtbar statt still verschwunden — aber ohne class_id vergibt der
    Commit keine Punkte."""
    s = Student(nachname="Test", vorname="Cem", klasse="9z", ak_code=None,
                geschlecht="männlich", active=True)
    db.add(s)
    db.flush()
    _result(db, s, "sprint", 7.0, 150)

    zeilen = client.get(f"{PREFIX}/klassen", headers=head).json()
    assert [(z["klasse"], z["class_id"]) for z in zeilen] == [("9z", None)]

    vorher = db.query(Transaction).count()
    client.post(f"{PREFIX}/klassen-punkte/commit", json={}, headers=head)
    assert db.query(Transaction).count() == vorher


def test_die_punkte_gehen_an_die_klasse_hinter_dem_ak_code(client, db, head, klass, disciplines):
    klass.ak_code = "AK2034a"
    db.flush()
    _mit_ak(db, klass, "Ada", "AK2034a", klasse_text="4a", punkte=300)

    r = client.post(f"{PREFIX}/klassen-punkte/commit", json={}, headers=head)
    assert r.status_code == 200
    tx = db.query(Transaction).filter_by(class_id=klass.id).all()
    assert len(tx) == 1 and tx[0].points > 0
