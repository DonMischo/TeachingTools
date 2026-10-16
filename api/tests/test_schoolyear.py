"""School-year math: stable class identity across the yearly grade bump.

Every 1 August the whole school renames itself — today's 7a is next year's 8a.
AK-codes exist so a class keeps one identity through that, which means a bug
here does not throw, it silently merges or splits classes once a year.
"""
from datetime import date

import pytest

from api.schoolyear import (
    TOTAL_GRADES, ak_code_to_klasse, get_school_year_start, klasse_to_ak_code,
)


# ── the 1 August Stichtag ────────────────────────────────────────────────────

@pytest.mark.parametrize("today,start", [
    (date(2025, 7, 31), 2024),      # last day of the old school year
    (date(2025, 8, 1), 2025),       # Stichtag
    (date(2025, 12, 31), 2025),
    (date(2026, 1, 1), 2025),
    (date(2026, 7, 31), 2025),
])
def test_school_year_starts_on_the_first_of_august(today, start):
    assert get_school_year_start(today) == start


def test_defaults_to_today():
    assert get_school_year_start() == get_school_year_start(date.today())


# ── klasse → AK-code ─────────────────────────────────────────────────────────

def test_ak_code_names_the_year_the_class_reaches_the_final_grade():
    today = date(2025, 9, 1)              # school year 2025/2026
    # A 7th grader reaches grade 13 in 2031/2032.
    assert klasse_to_ak_code("7a", today) == "AK2031a"
    # A class already in the final grade carries this year.
    assert klasse_to_ak_code(f"{TOTAL_GRADES}c", today) == "AK2025c"


@pytest.mark.parametrize("klasse,expected", [
    ("7a", "AK2031a"),
    ("7A", "AK2031a"),        # letter is normalised to lower case
    (" 7a ", "AK2031a"),
    ("7 a", "AK2031a"),
    ("7", "AK2031"),          # a class without a letter
    ("07a", "AK2031a"),
    ("7ä", "AK2031ä"),        # umlaut suffixes exist in the wild
    ("10b", "AK2028b"),
])
def test_class_labels_are_parsed_leniently(klasse, expected):
    assert klasse_to_ak_code(klasse, date(2025, 9, 1)) == expected


@pytest.mark.parametrize("klasse", ["Vorkurs", "", "a", "abc", "7a1", "7-a"])
def test_labels_without_a_leading_grade_are_rejected(klasse):
    with pytest.raises(ValueError, match="Ungültiges Klassenformat"):
        klasse_to_ak_code(klasse, date(2025, 9, 1))


# ── AK-code → klasse ─────────────────────────────────────────────────────────

def test_round_trip_is_stable_within_a_school_year():
    today = date(2025, 9, 1)
    for klasse in ["5a", "7b", "10c", "13a"]:
        assert ak_code_to_klasse(klasse_to_ak_code(klasse, today), today) == klasse


def test_the_same_code_reads_one_grade_higher_after_the_bump():
    """The point of the whole module: one code, the class moves up by itself."""
    code = klasse_to_ak_code("7a", date(2025, 9, 1))
    assert ak_code_to_klasse(code, date(2025, 9, 1)) == "7a"
    assert ak_code_to_klasse(code, date(2026, 9, 1)) == "8a"
    assert ak_code_to_klasse(code, date(2030, 9, 1)) == "12a"


def test_a_class_that_has_already_graduated_reads_past_the_final_grade():
    """Not an error — callers filter on grade > TOTAL_GRADES themselves."""
    code = klasse_to_ak_code("13a", date(2025, 9, 1))
    assert ak_code_to_klasse(code, date(2026, 9, 1)) == "14a"


@pytest.mark.parametrize("code,expected", [
    ("AK2031a", "7a"),
    ("ak2031a", "7a"),          # case-insensitive prefix
    (" AK2031a ", "7a"),
    ("AK2031", "7"),            # no letter
    ("AK2031ab", "7ab"),
])
def test_ak_codes_are_parsed_leniently(code, expected):
    assert ak_code_to_klasse(code, date(2025, 9, 1)) == expected


@pytest.mark.parametrize("code", ["7a", "AK25a", "AKabcd", "", "2031a"])
def test_malformed_ak_codes_are_rejected(code):
    with pytest.raises(ValueError, match="Ungültiger AK-Code"):
        ak_code_to_klasse(code, date(2025, 9, 1))


def test_the_suffix_may_contain_digits_so_a_long_year_is_read_as_year_plus_suffix():
    """The suffix group is alphanumeric (codes like "AK2031K1" exist), so a
    five-digit year is not rejected — it splits after four digits. AK-codes are
    generated, never typed, so this only matters if one is hand-edited."""
    assert ak_code_to_klasse("AK20311a", date(2025, 9, 1)) == "71a"


def test_every_grade_survives_a_round_trip_in_any_month():
    for month in (1, 7, 8, 12):
        today = date(2025, month, 15)
        for grade in range(1, TOTAL_GRADES + 1):
            label = f"{grade}a"
            assert ak_code_to_klasse(klasse_to_ak_code(label, today), today) == label
