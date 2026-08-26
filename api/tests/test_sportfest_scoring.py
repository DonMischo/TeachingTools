"""DLV Nationale Punktwertung — the formulas behind every Sportfest result.

Wrong coefficients or a flipped branch here do not crash anything, they just
hand out wrong points, so the tests pin both the invariants (better result →
more points, class/gender pick the right table) and concrete anchor values.

The anchors were computed from the current implementation and are here to
catch drift; the coefficient table itself is the DLV's (see scoring.py).
"""
import math

import pytest

from api.routers.sportfest.scoring import (
    COEFFICIENTS, _ausdauer_distance, _ballwurf_key, _sprint_distance,
    _sprint_key, _zuschlag, calculate_points, parse_value,
)


# ── value parsing ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("195.4", 195.4),
    ("  7.2  ", 7.2),
    ("12", 12.0),
    ("3:15.4", 195.4),          # mm:ss
    ("0:59", 59.0),
    ("10:00", 600.0),
    ("4.35", 4.35),             # metres
])
def test_parse_value_accepts_seconds_metres_and_mmss(raw, expected):
    assert parse_value(raw) == pytest.approx(expected)


@pytest.mark.parametrize("raw", ["", "abc", "3:xx", "x:15", "1:2:3", "3,15"])
def test_parse_value_rejects_junk(raw):
    assert parse_value(raw) is None


# ── discipline selection by class ────────────────────────────────────────────

@pytest.mark.parametrize("klasse_nr,key,dist", [
    (1, "50m", 50), (5, "50m", 50),
    (6, "75m", 75), (8, "75m", 75),
    (9, "100m", 100), (12, "100m", 100),
])
def test_sprint_distance_steps_at_classes_5_and_8(klasse_nr, key, dist):
    assert _sprint_key(klasse_nr) == key
    assert _sprint_distance(klasse_nr) == dist


@pytest.mark.parametrize("klasse_nr,geschlecht,dist", [
    (1, "männlich", 400), (2, "weiblich", 400),
    (3, "männlich", 800), (6, "weiblich", 800),
    (7, "weiblich", 800),        # girls stay on 800 m ...
    (7, "männlich", 1000),       # ... boys move up to 1000 m
])
def test_ausdauer_distance_depends_on_class_and_gender(klasse_nr, geschlecht, dist):
    assert _ausdauer_distance(klasse_nr, geschlecht) == dist


@pytest.mark.parametrize("klasse_nr,key", [
    (1, "80g Schlagballwurf"), (6, "80g Schlagballwurf"),
    (7, "200g Ballwurf"), (10, "200g Ballwurf"),
])
def test_ballwurf_switches_ball_after_class_6(klasse_nr, key):
    assert _ballwurf_key(klasse_nr) == key


@pytest.mark.parametrize("dist,zuschlag", [
    (50, 0.24), (100, 0.24), (300, 0.24),      # hand timing up to 300 m
    (301, 0.14), (400, 0.14),
    (401, 0.0), (800, 0.0), (1000, 0.0),
])
def test_hand_timing_zuschlag_boundaries(dist, zuschlag):
    assert _zuschlag(dist) == zuschlag


def test_every_ausdauer_distance_has_coefficients():
    """A class/gender combination that resolves to a missing table entry would
    silently score None for that child."""
    for klasse_nr in range(1, 14):
        for geschlecht in ("männlich", "weiblich"):
            key = f"{_ausdauer_distance(klasse_nr, geschlecht)}m"
            assert key in COEFFICIENTS[geschlecht], (klasse_nr, geschlecht, key)
            assert _sprint_key(klasse_nr) in COEFFICIENTS[geschlecht]
            assert _ballwurf_key(klasse_nr) in COEFFICIENTS[geschlecht]


# ── points ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("discipline,value,klasse,geschlecht,points", [
    ("sprint", 7.0, "5a", "männlich", 451),
    ("sprint", 7.0, "5a", "weiblich", 493),
    ("sprint", 11.0, "6a", "männlich", 387),
    ("sprint", 13.5, "10b", "weiblich", 498),
    ("ausdauerlauf", 90.0, "2a", "männlich", 205),
    ("ausdauerlauf", 200.0, "6a", "weiblich", 305),
    ("ausdauerlauf", 260.0, "9a", "männlich", 281),
    ("weitsprung", 4.20, "7a", "männlich", 410),
    ("weitsprung", 4.20, "7a", "weiblich", 459),
    ("ballwurf", 30.0, "5a", "männlich", 243),
    ("ballwurf", 30.0, "8a", "männlich", 285),
])
def test_anchor_values(discipline, value, klasse, geschlecht, points):
    assert calculate_points(discipline, value, klasse, geschlecht) == points


def test_points_are_floored_never_rounded_up():
    """floor, not round — a result must never be credited points it missed."""
    coeff = COEFFICIENTS["männlich"]["Weitsprung"]
    # Pick a jump landing just under a whole point.
    target = 400
    value = ((target + 0.99) * coeff["c"] + coeff["a"]) ** 2
    assert calculate_points("weitsprung", value, "7a", "männlich") == target


def test_a_bad_result_clamps_to_zero_instead_of_going_negative():
    assert calculate_points("sprint", 60.0, "5a", "männlich") == 0
    assert calculate_points("weitsprung", 0.5, "7a", "männlich") == 0


@pytest.mark.parametrize("discipline,worse,better", [
    ("sprint", 9.0, 8.0),               # running: less time is better
    ("ausdauerlauf", 300.0, 250.0),
    ("weitsprung", 3.5, 4.5),           # jumping/throwing: more distance is better
    ("ballwurf", 20.0, 35.0),
])
def test_better_results_score_more_points(discipline, worse, better):
    lo = calculate_points(discipline, worse, "7a", "männlich")
    hi = calculate_points(discipline, better, "7a", "männlich")
    assert lo < hi


def test_class_number_is_read_out_of_the_label():
    for label in ["10", "10a", "10 b", "Klasse 10"]:
        assert calculate_points("sprint", 13.0, label, "weiblich") == \
               calculate_points("sprint", 13.0, "10a", "weiblich")


def test_class_labels_without_digits_score_nothing():
    assert calculate_points("sprint", 7.0, "Vorkurs", "männlich") is None


@pytest.mark.parametrize("discipline,klasse,geschlecht", [
    ("hochsprung", "7a", "männlich"),        # unknown discipline
    ("sprint", "7a", "divers"),              # gender outside the DLV tables
    ("sprint", "7a", "m"),                   # unnormalised import value
])
def test_unknown_inputs_score_none_rather_than_raising(discipline, klasse, geschlecht):
    assert calculate_points(discipline, 7.0, klasse, geschlecht) is None


def test_a_zero_time_scores_none_instead_of_dividing_by_zero():
    # 0.0 s is impossible, but a typo must not 500 the result upsert.
    assert calculate_points("sprint", -0.24, "5a", "männlich") is None


def test_a_negative_jump_scores_none_instead_of_raising():
    assert calculate_points("weitsprung", -1.0, "7a", "männlich") is None


def test_sprint_formula_matches_the_documented_shape():
    """P = floor((D / (M + Zuschlag) - a) / c) for a run."""
    value, klasse, geschlecht = 8.5, "6a", "weiblich"
    coeff = COEFFICIENTS[geschlecht]["75m"]
    expected = math.floor((75 / (value + 0.24) - coeff["a"]) / coeff["c"])
    assert calculate_points("sprint", value, klasse, geschlecht) == expected
