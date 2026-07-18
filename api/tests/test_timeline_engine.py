"""Unit tests for api/timeline_engine.py — validation and scoring."""
import pytest

from api.timeline_engine import (
    validate_axis, validate_game_spec, validate_set_payload,
    score_answer, check_answer, default_tolerance,
    sanitized_board, solution_payload,
)


def sort_spec(**over):
    spec = {
        "mode": "sort",
        "axis": {"kind": "year", "min": -800, "max": 2000},
        "items": [
            {"id": "rom", "label": "Gründung Roms", "value": -753},
            {"id": "karl", "label": "Krönung Karls des Großen", "value": 800},
            {"id": "mauer", "label": "Mauerfall", "value": 1989},
        ],
    }
    spec.update(over)
    return spec


def spot_spec(**over):
    spec = {
        "mode": "spot",
        "axis": {"kind": "number", "min": 0, "max": 100},
        "items": [
            {"id": "a", "label": "25", "value": 25},
            {"id": "b", "label": "50", "value": 80, "actual": 50},
            {"id": "c", "label": "75", "value": 75},
        ],
    }
    spec.update(over)
    return spec


# ── validation ─────────────────────────────────────────────────────────────

class TestValidation:
    def test_valid_specs_pass(self):
        assert validate_game_spec(sort_spec()) == []
        assert validate_game_spec(spot_spec()) == []

    def test_axis_errors(self):
        assert validate_axis({"kind": "banana", "min": 0, "max": 10})
        assert validate_axis({"kind": "number", "min": 10, "max": 10})
        assert validate_axis({"kind": "number", "min": 0, "max": 10, "step": 0})
        assert validate_axis({"kind": "number", "min": True, "max": 10})
        assert validate_axis(None)

    def test_unknown_mode(self):
        errors = validate_game_spec(sort_spec(mode="shuffle"))
        assert any("mode" in e for e in errors)

    def test_duplicate_item_ids(self):
        spec = sort_spec()
        spec["items"][1]["id"] = "rom"
        assert any("doppelte id" in e for e in validate_game_spec(spec))

    def test_value_outside_axis(self):
        spec = sort_spec()
        spec["items"][0]["value"] = -5000
        assert any("außerhalb" in e for e in validate_game_spec(spec))

    def test_spot_requires_misplaced_item(self):
        spec = spot_spec()
        spec["items"][1].pop("actual")
        assert any("spot" in e for e in validate_game_spec(spec))

    def test_spot_actual_equal_value_not_misplaced(self):
        spec = spot_spec()
        spec["items"][1]["actual"] = 80  # same as displayed → not misplaced
        assert any("spot" in e for e in validate_game_spec(spec))

    def test_bad_tolerance_and_scoring(self):
        assert any("tolerance" in e for e in validate_game_spec(sort_spec(tolerance=-1)))
        assert any("scoring" in e for e in validate_game_spec(sort_spec(scoring="fuzzy")))

    def test_set_payload(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 0, "max": 100},
            "lanes": [{"id": "a", "label": "A"}],
            "events": [{"id": "e1", "label": "E", "value": 10, "end": 20, "lane": "a"}],
        }
        assert validate_set_payload(payload) == []

    def test_exact_date_is_optional_and_display_only(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 0, "max": 100},
            "events": [
                {"id": "e1", "label": "E", "value": 10, "exact_date": "20. Januar 1942"},
                {"id": "e2", "label": "F", "value": 20},  # no exact_date — still valid
            ],
        }
        assert validate_set_payload(payload) == []

    def test_exact_date_must_be_string(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 0, "max": 100},
            "events": [{"id": "e1", "label": "E", "value": 10, "exact_date": 1942}],
        }
        assert any("exact_date" in e for e in validate_set_payload(payload))

    def test_iso_exact_date_in_range_and_consistent_passes(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 1900, "max": 2000},
            "events": [{"id": "e1", "label": "Wannsee", "value": 1942, "exact_date": "1942-01-20"}],
        }
        assert validate_set_payload(payload) == []

    def test_iso_exact_date_outside_axis_range_rejected(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 1950, "max": 2000},
            "events": [{"id": "e1", "label": "E", "value": 1950, "exact_date": "1942-01-20"}],
        }
        errors = validate_set_payload(payload)
        assert any("exact_date" in e and "außerhalb" in e for e in errors)

    def test_iso_exact_date_inconsistent_with_value_rejected(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 1900, "max": 2000},
            "events": [{"id": "e1", "label": "E", "value": 1942, "exact_date": "1918-11-11"}],
        }
        errors = validate_set_payload(payload)
        assert any("exact_date" in e and "passt nicht" in e for e in errors)

    def test_iso_exact_date_end_checked_against_end_not_value(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 1900, "max": 2000},
            "events": [{
                "id": "e1", "label": "Erster Weltkrieg", "value": 1914, "end": 1918,
                "exact_date": "1914-07-28", "exact_date_end": "1918-11-11",
            }],
        }
        assert validate_set_payload(payload) == []

    def test_iso_exact_date_end_inconsistent_with_end_rejected(self):
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": 1900, "max": 2000},
            "events": [{
                "id": "e1", "label": "E", "value": 1914, "end": 1918,
                "exact_date_end": "1942-01-20",
            }],
        }
        errors = validate_set_payload(payload)
        assert any("exact_date_end" in e and "passt nicht" in e for e in errors)

    def test_non_iso_exact_date_skips_range_and_consistency_checks(self):
        # A legendary/BCE freeform label must never be range/consistency
        # checked against `value` — it's display-only by design.
        payload = {
            "title": "Test",
            "axis": {"kind": "year", "min": -800, "max": 600},
            "events": [{
                "id": "e1", "label": "Gründung Roms", "value": -753,
                "exact_date": "21. April 753 v. Chr. (Überlieferung)",
            }],
        }
        assert validate_set_payload(payload) == []

    def test_set_payload_errors(self):
        payload = {
            "axis": {"kind": "year", "min": 0, "max": 100},
            "lanes": [{"id": "a", "label": "A"}, {"id": "a", "label": "B"}],
            "events": [
                {"id": "e1", "label": "E", "value": 10, "end": 5},
                {"id": "e1", "label": "F", "value": 10, "lane": "zzz"},
            ],
        }
        errors = validate_set_payload(payload)
        assert any("title" in e for e in errors)
        assert any("doppelte id 'a'" in e for e in errors)
        assert any("end" in e for e in errors)
        assert any("doppelte id 'e1'" in e for e in errors)
        assert any("unbekannte lane" in e for e in errors)


# ── tolerance ──────────────────────────────────────────────────────────────

class TestTolerance:
    def test_explicit_tolerance_wins(self):
        assert default_tolerance(sort_spec(tolerance=25)) == 25

    def test_zero_tolerance_is_preserved(self):
        # 0 = "exact"; it must not fall through to the span default.
        assert default_tolerance(sort_spec(tolerance=0)) == 0

    def test_step_used_when_no_tolerance(self):
        spec = sort_spec()
        spec["axis"]["step"] = 10
        assert default_tolerance(spec) == 10

    def test_fallback_is_five_percent_of_span(self):
        assert default_tolerance(sort_spec()) == pytest.approx(2800 * 0.05)


# ── sort scoring ───────────────────────────────────────────────────────────

class TestSortScoring:
    def test_perfect_placement(self):
        answer = {"placements": {"rom": -753, "karl": 800, "mauer": 1989}}
        ratio, results = score_answer(sort_spec(), answer)
        assert ratio == 1.0
        assert all(results.values())
        assert check_answer(sort_spec(), answer)

    def test_within_tolerance_counts(self):
        spec = sort_spec(tolerance=50)
        answer = {"placements": {"rom": -720, "karl": 843, "mauer": 1949}}
        ratio, results = score_answer(spec, answer)
        assert results == {"rom": True, "karl": True, "mauer": True}
        assert ratio == 1.0

    def test_outside_tolerance_partial_credit(self):
        spec = sort_spec(tolerance=50)
        answer = {"placements": {"rom": -753, "karl": 1200, "mauer": 1989}}
        ratio, results = score_answer(spec, answer)
        assert results == {"rom": True, "karl": False, "mauer": True}
        assert ratio == pytest.approx(2 / 3)
        assert not check_answer(spec, answer)

    def test_missing_placement_is_wrong(self):
        ratio, results = score_answer(sort_spec(), {"placements": {"rom": -753}})
        assert results["rom"] is True
        assert results["karl"] is False and results["mauer"] is False

    def test_order_scoring_ignores_distance(self):
        spec = sort_spec(scoring="order")
        # Wildly wrong values but correct relative order → all correct.
        answer = {"placements": {"rom": 0, "karl": 1, "mauer": 2}}
        ratio, _ = score_answer(spec, answer)
        assert ratio == 1.0

    def test_order_scoring_swapped_pair(self):
        spec = sort_spec(scoring="order")
        answer = {"placements": {"rom": 5, "karl": 3, "mauer": 10}}  # rom/karl swapped
        ratio, results = score_answer(spec, answer)
        assert results == {"rom": False, "karl": False, "mauer": True}
        assert ratio == pytest.approx(1 / 3)

    def test_malformed_answers_score_zero(self):
        for bad in (None, [], "x", {"placements": "x"}, {"placements": {"rom": "abc"}}, {}):
            ratio, _ = score_answer(sort_spec(), bad)
            assert ratio == 0.0


# ── spot scoring ───────────────────────────────────────────────────────────

class TestSpotScoring:
    def test_exact_flagging(self):
        ratio, results = score_answer(spot_spec(), {"flagged": ["b"]})
        assert ratio == 1.0 and all(results.values())
        assert check_answer(spot_spec(), {"flagged": ["b"]})

    def test_flagging_nothing_gets_partial_credit(self):
        ratio, results = score_answer(spot_spec(), {"flagged": []})
        assert results == {"a": True, "b": False, "c": True}
        assert ratio == pytest.approx(2 / 3)

    def test_flagging_everything_penalized(self):
        ratio, results = score_answer(spot_spec(), {"flagged": ["a", "b", "c"]})
        assert results == {"a": False, "b": True, "c": False}
        assert ratio == pytest.approx(1 / 3)

    def test_unknown_ids_ignored(self):
        ratio, _ = score_answer(spot_spec(), {"flagged": ["b", "zzz"]})
        assert ratio == 1.0


# ── client payloads ────────────────────────────────────────────────────────

class TestPayloads:
    def test_sort_board_hides_values(self):
        board = sanitized_board(sort_spec())
        assert all("value" not in it and "actual" not in it for it in board["items"])
        assert board["mode"] == "sort"
        assert board["axis"]["min"] == -800

    def test_spot_board_shows_displayed_value_but_not_actual(self):
        board = sanitized_board(spot_spec())
        by_id = {it["id"]: it for it in board["items"]}
        assert by_id["b"]["value"] == 80
        assert all("actual" not in it and "misplaced" not in it for it in board["items"])

    def test_solution_reveals_everything(self):
        sol = solution_payload(spot_spec())
        by_id = {it["id"]: it for it in sol["items"]}
        assert by_id["b"]["misplaced"] is True and by_id["b"]["actual"] == 50
        assert by_id["a"]["misplaced"] is False

    def test_sort_solution_has_tolerance(self):
        sol = solution_payload(sort_spec(tolerance=42))
        assert sol["tolerance"] == 42
        assert {it["id"]: it["value"] for it in sol["items"]}["rom"] == -753


# ── day-precision game items ───────────────────────────────────────────────

def wk1_spec(**over):
    """Two events in the same year — only exact dates can separate them."""
    spec = {
        "mode": "sort",
        "scoring": "order",
        "axis": {"kind": "year", "min": 1910, "max": 1920},
        "items": [
            {"id": "sarajevo", "label": "Attentat von Sarajevo", "value": 1914, "exact_date": "1914-06-28"},
            {"id": "kriegserklaerung", "label": "Kriegserklärung", "value": 1914, "exact_date": "1914-07-28"},
            {"id": "waffenstillstand", "label": "Waffenstillstand", "value": 1918, "exact_date": "1918-11-11"},
        ],
    }
    spec.update(over)
    return spec


class TestExactDatesInGameSpecs:
    def test_valid_spec_passes(self):
        assert validate_game_spec(wk1_spec()) == []

    def test_exact_date_must_match_value_year(self):
        spec = wk1_spec()
        spec["items"][0]["exact_date"] = "1916-06-28"
        assert any("passt nicht" in e for e in validate_game_spec(spec))

    def test_order_scoring_separates_same_year_events(self):
        # Without exact dates both are 1914 and the ranking is a coin flip.
        spec = wk1_spec()
        ratio, results = score_answer(spec, {"placements": {
            "sarajevo": 1914.0, "kriegserklaerung": 1915.0, "waffenstillstand": 1918.0,
        }})
        assert ratio == 1.0, results

    def test_order_scoring_catches_swapped_same_year_events(self):
        spec = wk1_spec()
        ratio, results = score_answer(spec, {"placements": {
            "sarajevo": 1915.0, "kriegserklaerung": 1914.0, "waffenstillstand": 1918.0,
        }})
        assert results["sarajevo"] is False and results["kriegserklaerung"] is False
        assert results["waffenstillstand"] is True

    def test_position_scoring_uses_the_exact_date(self):
        spec = wk1_spec(scoring="position", tolerance=0.1)
        # ~28 July 1914 -> a placement at the plain year 1914 is >0.1 off.
        _, results = score_answer(spec, {"placements": {"kriegserklaerung": 1914.0}})
        assert results["kriegserklaerung"] is False
        _, results = score_answer(spec, {"placements": {"kriegserklaerung": 1914.57}})
        assert results["kriegserklaerung"] is True

    def test_sort_board_does_not_leak_exact_date(self):
        # exact_date is part of the answer in sort mode.
        board = sanitized_board(wk1_spec())
        assert all("value" not in it and "exact_date" not in it for it in board["items"])

    def test_spot_board_keeps_displayed_exact_date_but_hides_the_true_one(self):
        spec = {
            "mode": "spot",
            "axis": {"kind": "year", "min": 1910, "max": 1920},
            "items": [
                {"id": "a", "label": "A", "value": 1914, "exact_date": "1914-06-28"},
                {"id": "b", "label": "B", "value": 1916, "exact_date": "1916-01-01",
                 "actual": 1914, "exact_date_actual": "1914-07-28"},
            ],
        }
        assert validate_game_spec(spec) == []
        board = sanitized_board(spec)
        by_id = {it["id"]: it for it in board["items"]}
        assert by_id["b"]["exact_date"] == "1916-01-01"
        assert all("actual" not in it and "exact_date_actual" not in it for it in board["items"])
        # And the misplaced one is still detected via the effective positions.
        ratio, _ = score_answer(spec, {"flagged": ["b"]})
        assert ratio == 1.0

    def test_same_year_misplacement_is_detected(self):
        # value == actual == 1914, but different days: still misplaced.
        spec = {
            "mode": "spot",
            "axis": {"kind": "year", "min": 1910, "max": 1920},
            "items": [
                {"id": "a", "label": "A", "value": 1914, "exact_date": "1914-06-28"},
                {"id": "b", "label": "B", "value": 1914, "exact_date": "1914-12-01",
                 "actual": 1914, "exact_date_actual": "1914-07-28"},
            ],
        }
        ratio, results = score_answer(spec, {"flagged": ["b"]})
        assert results["b"] is True and ratio == 1.0

    def test_solution_exposes_effective_positions(self):
        sol = solution_payload(wk1_spec())
        by_id = {it["id"]: it for it in sol["items"]}
        assert by_id["sarajevo"]["value_effective"] < by_id["kriegserklaerung"]["value_effective"]
        assert by_id["sarajevo"]["exact_date"] == "1914-06-28"


# ── explicit position tolerance ────────────────────────────────────────────

def pos_spec(items, lo, hi, **over):
    spec = {"mode": "sort", "scoring": "position", "axis": {"kind": "year", "min": lo, "max": hi}, "items": items}
    spec.update(over)
    return spec


def _score_one(spec, item_id, placed):
    ratio, results = score_answer(spec, {"placements": {item_id: placed}})
    return results[item_id]


class TestPositionTolerance:
    def test_zero_tolerance_requires_the_exact_year(self):
        spec = pos_spec([{"id": "a", "label": "A", "value": 1849}], 1000, 2000, tolerance=0)
        assert _score_one(spec, "a", 1849) is True
        assert _score_one(spec, "a", 1850) is False   # even 1 off fails

    def test_positive_tolerance_is_a_band(self):
        spec = pos_spec([{"id": "a", "label": "A", "value": 1500}], 1000, 2000, tolerance=15)
        assert _score_one(spec, "a", 1512) is True    # within 15
        assert _score_one(spec, "a", 1520) is False   # 20 off

    def test_century_and_millennium_tolerances(self):
        century = pos_spec([{"id": "a", "label": "A", "value": 1500}], 0, 2000, tolerance=100)
        assert _score_one(century, "a", 1580) is True
        assert _score_one(century, "a", 1650) is False
        millennium = pos_spec([{"id": "a", "label": "A", "value": 1500}], -3000, 2000, tolerance=1000)
        assert _score_one(millennium, "a", 900) is True     # within 1000
        assert _score_one(millennium, "a", 300) is False

    def test_millions_tolerance_on_deep_time_axis(self):
        spec = {
            "mode": "sort", "scoring": "position",
            "axis": {"kind": "year", "min": -600_000_000, "max": 0},
            "items": [{"id": "t", "label": "Trias", "value": -230_000_000}],
            "tolerance": 5_000_000,
        }
        assert _score_one(spec, "t", -233_000_000) is True   # within 5 Mio
        assert _score_one(spec, "t", -220_000_000) is False  # 10 Mio off

    def test_zero_tolerance_matches_the_month_on_a_short_round(self):
        spec = wk1_spec(scoring="position", tolerance=0, axis={"kind": "year", "min": 1912, "max": 1920})
        # Sarajevo 1914-06-28 -> June. Placing in June passes, July fails.
        june = 1914 + 5 / 12 + 0.01
        july = 1914 + 6 / 12 + 0.01
        assert _score_one(spec, "sarajevo", june) is True
        assert _score_one(spec, "sarajevo", july) is False

    def test_zero_tolerance_year_only_item_on_a_short_round(self):
        spec = pos_spec([{"id": "x", "label": "X", "value": 1916}], 1912, 1920, tolerance=0)
        assert _score_one(spec, "x", 1916 + 3 / 12) is True   # anywhere in 1916
        assert _score_one(spec, "x", 1917.0) is False

    def test_no_tolerance_falls_back_to_span_default(self):
        # No explicit tolerance -> 5% of span (legacy default): 50 on 1000y.
        spec = pos_spec([{"id": "a", "label": "A", "value": 1500}], 1000, 2000)
        assert _score_one(spec, "a", 1540) is True
        assert _score_one(spec, "a", 1560) is False

    def test_number_axis_unaffected(self):
        spec = {
            "mode": "sort", "scoring": "position",
            "axis": {"kind": "number", "min": 0, "max": 100, "step": 5},
            "items": [{"id": "a", "label": "50", "value": 50}],
        }
        assert _score_one(spec, "a", 52) is True   # within step 5
        assert _score_one(spec, "a", 60) is False
        assert _score_one(spec, "a", 60) is False
