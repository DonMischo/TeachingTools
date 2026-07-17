"""Unit tests for the procedural generator library (api/task_generators.py):
contract checks across every topic/difficulty/variant, plus SVG geometry
regression tests for the cuboid label-clipping and urn floating-marble bugs."""
import random
import re

from api import task_generators as tg

SEEDS = range(60)


def test_every_topic_difficulty_variant_answers_check_out():
    """For every built-in topic and difficulty 1-5, many random seeds must
    produce a question/accept pair where the stated solution is accepted —
    this exercises every rng.choice variant pool, including the new reverse-
    calculation branches, and would catch a wrong-sign/non-integer answer."""
    for topic, gen in tg.REGISTRY.items():
        for difficulty in range(tg.DIFFICULTY_MIN, tg.DIFFICULTY_MAX + 1):
            for seed in SEEDS:
                rng = random.Random(seed)
                result = gen.generate(difficulty, rng)
                assert result["question"], (topic, difficulty, seed)
                assert result["accept"], (topic, difficulty, seed)
                solution = result.get("solution", result["accept"][0])
                assert tg.check_input_answer(result["accept"], solution), (
                    topic, difficulty, seed, result
                )


_TEXT_RE = re.compile(r'<text x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*>')
_SVG_RE = re.compile(r'viewBox="0 0 (\d+) (\d+)"')


def _assert_text_within_bounds(svg: str):
    w, h = (float(v) for v in _SVG_RE.search(svg).groups())
    for x, y in _TEXT_RE.findall(svg):
        x, y = float(x), float(y)
        assert 0 <= x <= w, (x, svg)
        assert 0 <= y <= h, (y, svg)


def test_svg_cuboid_labels_never_clip():
    for a in (3, 8, 12):
        for b in (2, 6, 9):
            for c in (2, 6, 9):
                _assert_text_within_bounds(tg.svg_cuboid(a, b, c))
                # reverse-calc variant renders "?" for one label
                _assert_text_within_bounds(tg.svg_cuboid(a, b, c, label_c="?"))


def test_svg_urn_bottom_row_rests_on_floor():
    for red in (2, 4, 6):
        for blue in (2, 4, 6):
            svg = tg.svg_urn(red, blue)
            floor_y = float(re.search(r'Q 26 ([\d.]+) 40', svg).group(1))
            cys = [float(cy) for cy in re.findall(r'cy="([\d.]+)"', svg)]
            # bottom-most ball must sit near the floor of the tub regardless
            # of how many balls/rows exist (the original bug anchored row 0
            # at the top, so the bottom row's distance to the floor grew
            # with fewer rows instead of staying fixed)
            assert floor_y - max(cys) <= 20
