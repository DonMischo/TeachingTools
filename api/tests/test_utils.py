"""api/utils.py — small helpers, but every router leans on them.

`parse_grades` reads the Klassenstufe field of imported content in whatever
shape the author typed it ("7", "5,6,7", "5-10", [5,6,7]), and a
misinterpretation silently offers material to the wrong year group.
"""
import pytest

from api.models import ExitTicketSession
from api.utils import gen_code, grade_of_class_code, parse_grades


# ── parse_grades ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    (None, []),
    (7, [7]),
    (0, []),                    # outside 1..13
    (14, []),
    ([5, 6, 7], [5, 6, 7]),
    ([7, 5, 5, 6], [5, 6, 7]),  # sorted + deduped
    (["5", "6"], [5, 6]),
    ([5, "x", None, 99, -3], [5]),
    ("7", [7]),
    ("5,6,7", [5, 6, 7]),
    ("5;6 7", [5, 6, 7]),
    (" 5 , 7 ", [5, 7]),
    ("5-10", [5, 6, 7, 8, 9, 10]),
    ("10-5", [5, 6, 7, 8, 9, 10]),      # reversed range
    ("5–7", [5, 6, 7]),                 # en dash
    ("7-7", [7]),
    ("0-20", list(range(1, 14))),       # clamped to 1..13
    ("Vorkurs", []),
    ("", []),
    ("5, Vorkurs, 9", [5, 9]),
])
def test_parse_grades(raw, expected):
    assert parse_grades(raw) == expected


def test_parse_grades_always_returns_sorted_unique_ints():
    out = parse_grades("9,7,7,5-6")
    assert out == sorted(set(out))
    assert all(isinstance(g, int) for g in out)


# ── grade_of_class_code ──────────────────────────────────────────────────────

@pytest.mark.parametrize("code,expected", [
    ("9a", 9),
    ("10b", 10),
    ("13", 13),
    (" 7c", 7),
    ("07a", 7),
    ("Vorkurs", None),
    ("", None),
    (None, None),
    ("0a", None),               # out of range
    ("14a", None),
    ("99", None),
])
def test_grade_of_class_code(code, expected):
    assert grade_of_class_code(code) == expected


# ── gen_code ─────────────────────────────────────────────────────────────────

def test_gen_code_shape_and_uniqueness(db):
    codes = {gen_code(db, ExitTicketSession) for _ in range(50)}
    assert all(len(c) == 6 for c in codes)
    assert all(c.isalnum() and c.isupper() for c in codes)
    assert len(codes) > 40          # random, but collisions must be rare


def test_gen_code_skips_codes_already_taken(db, teacher, monkeypatch):
    import api.utils as utils
    taken = "AAAAAA"
    db.add(ExitTicketSession(code=taken, title="T", question="Q?", created_by=teacher.id))
    db.flush()

    # First draw collides with the existing row, second one is free.
    draws = iter([list(taken), list("BBBBBB")])
    monkeypatch.setattr(utils.random, "choices", lambda *a, **kw: next(draws))
    assert gen_code(db, ExitTicketSession) == "BBBBBB"


def test_gen_code_gives_up_rather_than_looping_forever(db, teacher, monkeypatch):
    import api.utils as utils
    db.add(ExitTicketSession(code="AAAAAA", title="T", question="Q?", created_by=teacher.id))
    db.flush()
    monkeypatch.setattr(utils.random, "choices", lambda *a, **kw: list("AAAAAA"))

    with pytest.raises(RuntimeError, match="Could not generate unique code"):
        gen_code(db, ExitTicketSession)
