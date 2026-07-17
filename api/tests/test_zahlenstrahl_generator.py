"""Zahlenstrahl practice generator: board + accept stay consistent."""
import random

from api.task_generators import generate_task, check_input_answer


class TestZahlenstrahlGenerator:
    def test_all_difficulties_produce_valid_boards(self):
        for difficulty in range(1, 6):
            for seed in range(20):
                t = generate_task("zahlenstrahl", difficulty, random.Random(seed))
                board = t["board"]
                axis = board["axis"]
                assert board["mode"] == "sort" and len(board["items"]) == 1
                # No solution leak: board items carry no value.
                assert "value" not in board["items"][0]

                value = float(t["accept"][0].replace(",", "."))
                assert axis["min"] < value < axis["max"]
                # Value sits on the snap grid, so a snapped placement matches exactly.
                steps = (value - axis["min"]) / axis["step"]
                assert abs(steps - round(steps)) < 1e-6

    def test_snapped_placement_is_accepted(self):
        t = generate_task("zahlenstrahl", 4, random.Random(7))
        value = t["accept"][0]
        # The board submits the placed number with a dot or comma — both pass.
        assert check_input_answer(t["accept"], value.replace(",", "."))
        assert check_input_answer(t["accept"], value)

    def test_registered_in_registry(self):
        from api.task_generators import REGISTRY
        assert "zahlenstrahl" in REGISTRY
