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
        (1, "Ada Test", 400), (2, "Bo Test", 380),
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
    assert [(r["name"], r["total_points"]) for r in rows] == [("Ada Test", 0)]


def test_gesamt_filters_by_jahrgang_and_geschlecht(client, db, head, klass, disciplines):
    _student(db, klass, "Ada", jahrgang=2012, geschlecht="weiblich")
    _student(db, klass, "Bo", jahrgang=2013, geschlecht="männlich")

    by_year = client.get(f"{PREFIX}/gesamt?jahrgang=2013", headers=head).json()
    assert [r["name"] for r in by_year] == ["Bo Test"]

    by_gender = client.get(f"{PREFIX}/gesamt?geschlecht=weiblich", headers=head).json()
    assert [r["name"] for r in by_gender] == ["Ada Test"]


def test_public_boards_show_ranks_but_never_names(client, db, klass, disciplines):
    """The board runs on a beamer — no login, so no names."""
    a = _student(db, klass, "Ada")
    _result(db, a, "sprint", 7.0, 300)
    client.cookies.clear()

    gesamt = client.get(f"{PREFIX}/gesamt").json()
    assert gesamt[0]["name"] is None
    assert (gesamt[0]["klasse"], gesamt[0]["total_points"]) == ("5a", 300)

    disziplin = client.get(f"{PREFIX}/disziplin").json()
    assert disziplin[0]["name"] is None
    assert disziplin[0]["points"] == 300


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
    assert sprint == [(1, "Bo Test"), (2, "Ada Test")]
    assert weit == [(1, "Ada Test")]


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
    assert [r["name"] for r in one_year] == ["Ada Test"]

    overall = client.get(f"{PREFIX}/disziplin?overall=true&jahrgang=2012", headers=head).json()
    assert [r["name"] for r in overall] == ["Bo Test", "Ada Test"]


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
