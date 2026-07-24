"""Unit tests for api/lueckentext_engine.py."""
from api.lueckentext_engine import validate_set_payload, fuzzy_match, normalize_de


def sample_payload(**over):
    payload = {
        "title": "Wasserkreislauf",
        "text": "Es entsteht {{a}} und {{b}} und {{c}}.",
        "gaps": [
            {"id": "a", "answer": "Verdunstung", "type": "word_bank", "difficulty": "easy"},
            {"id": "b", "answer": "Wolke", "type": "free_type"},
            {"id": "c", "answer": "Regen", "type": "multiple_choice", "choices": ["Regen", "Schnee"]},
        ],
        "distractors": ["Gezeiten"],
    }
    payload.update(over)
    return payload


class TestValidateSetPayload:
    def test_valid_payload_passes(self):
        assert validate_set_payload(sample_payload()) == []

    def test_missing_title(self):
        data = sample_payload()
        del data["title"]
        errors = validate_set_payload(data)
        assert any("title" in e for e in errors)

    def test_missing_text(self):
        data = sample_payload()
        del data["text"]
        errors = validate_set_payload(data)
        assert any("text" in e for e in errors)

    def test_missing_gaps(self):
        data = sample_payload(gaps=[])
        errors = validate_set_payload(data)
        assert any("gaps" in e for e in errors)

    def test_duplicate_gap_ids(self):
        data = sample_payload()
        data["gaps"][1]["id"] = "a"
        data["text"] = "Es entsteht {{a}} und {{c}}."
        errors = validate_set_payload(data)
        assert any("doppelte id" in e for e in errors)

    def test_unknown_placeholder(self):
        data = sample_payload(text="Es entsteht {{a}} und {{b}} und {{c}} und {{zzz}}.")
        errors = validate_set_payload(data)
        assert any("unbekannte gap-id" in e for e in errors)

    def test_missing_placeholder(self):
        data = sample_payload(text="Es entsteht {{a}} und {{b}}.")
        errors = validate_set_payload(data)
        assert any("Platzhalter" in e and "c" in e for e in errors)

    def test_multiple_choice_without_choices(self):
        data = sample_payload()
        del data["gaps"][2]["choices"]
        errors = validate_set_payload(data)
        assert any("choices" in e for e in errors)

    def test_multiple_choice_choices_missing_answer(self):
        data = sample_payload()
        data["gaps"][2]["choices"] = ["Schnee", "Hagel"]
        errors = validate_set_payload(data)
        assert any("choices" in e for e in errors)


class TestFuzzyMatch:
    def test_exact_match_case_insensitive(self):
        assert fuzzy_match("Wolke", "wolke") == "exact"

    def test_umlaut_variant(self):
        assert normalize_de("gruen") == normalize_de("grün")
        assert fuzzy_match("gruen", "grün") == "exact"

    def test_typo_is_near(self):
        assert fuzzy_match("Wolce", "Wolke") == "near"

    def test_different_word_is_wrong(self):
        assert fuzzy_match("Baum", "Wolke") == "wrong"
