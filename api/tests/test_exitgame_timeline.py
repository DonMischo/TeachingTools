"""Exitgame integration of the Zeitstrahl engine: task kind "timeline"."""
import io
import json

from api.tests.conftest import auth


def make_game(task):
    return {
        "id": "tl-test", "title": "Zeitstrahl-Test", "subject": "geschichte",
        "slides": [
            {"id": "s1", "type": "task", "title": "Aufgabe", "task": task},
        ],
    }


SORT_TASK = {
    "kind": "timeline",
    "timeline": {
        "mode": "sort",
        "axis": {"kind": "year", "min": -800, "max": 2000},
        "tolerance": 50,
        "items": [
            {"id": "rom", "label": "Gründung Roms", "value": -753},
            {"id": "mauer", "label": "Mauerfall", "value": 1989},
        ],
    },
}


def upload(client, token, game):
    return client.post(
        "/api/exitgames/upload",
        files={"file": ("exitgame.json", io.BytesIO(json.dumps(game).encode()), "application/json")},
        headers=auth(token),
    )


def start_attempt(client, token, db, teacher, game_id):
    r = client.post(f"/api/exitgames/{game_id}/sessions", json={"class_id": _class_id(db)}, headers=auth(token))
    assert r.status_code == 201, r.text
    code = r.json()["join_code"]
    r = client.post(f"/api/exitgame-sessions/{code}/attempts", headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()["attempt"]["id"]


def _class_id(db):
    from api.models import Class
    c = db.query(Class).first()
    if not c:
        c = Class(code="7b", display_name="Klasse 7b")
        db.add(c)
        db.flush()
    return c.id


class TestUploadValidation:
    def test_valid_timeline_task_accepted(self, client, teacher_token):
        r = upload(client, teacher_token, make_game(SORT_TASK))
        assert r.status_code == 201, r.text

    def test_invalid_spec_rejected(self, client, teacher_token):
        bad = {"kind": "timeline", "timeline": {"mode": "sort", "axis": {"kind": "year", "min": 5, "max": 5}, "items": []}}
        r = upload(client, teacher_token, make_game(bad))
        assert r.status_code == 422
        errors = r.json()["detail"]["errors"]
        assert any("timeline" in e for e in errors)

    def test_spot_without_misplaced_rejected(self, client, teacher_token):
        bad = {"kind": "timeline", "timeline": {
            "mode": "spot", "axis": {"kind": "number", "min": 0, "max": 10},
            "items": [{"id": "a", "label": "3", "value": 3}],
        }}
        r = upload(client, teacher_token, make_game(bad))
        assert r.status_code == 422


class TestAnswerCheck:
    def _answer(self, client, token, attempt_id, payload):
        return client.post(
            f"/api/exitgame-attempts/{attempt_id}/events",
            json={"slide_id": "s1", "action": "answer", "payload": {"task_index": 0, "answer": payload}},
            headers=auth(token),
        )

    def test_correct_placements_within_tolerance(self, client, db, teacher, teacher_token):
        game_id = upload(client, teacher_token, make_game(SORT_TASK)).json()["id"]
        attempt_id = start_attempt(client, teacher_token, db, teacher, game_id)
        r = self._answer(client, teacher_token, attempt_id, {"placements": {"rom": -760, "mauer": 2000}})
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is True
        assert "s1" in r.json()["attempt"]["solved_slide_ids"]

    def test_wrong_placement_rejected(self, client, db, teacher, teacher_token):
        game_id = upload(client, teacher_token, make_game(SORT_TASK)).json()["id"]
        attempt_id = start_attempt(client, teacher_token, db, teacher, game_id)
        r = self._answer(client, teacher_token, attempt_id, {"placements": {"rom": 500, "mauer": 1989}})
        assert r.status_code == 200
        assert r.json()["correct"] is False

    def test_spot_flagging(self, client, db, teacher, teacher_token):
        spot = {"kind": "timeline", "timeline": {
            "mode": "spot", "axis": {"kind": "number", "min": 0, "max": 100},
            "items": [
                {"id": "a", "label": "20", "value": 20},
                {"id": "b", "label": "50", "value": 90, "actual": 50},
            ],
        }}
        game_id = upload(client, teacher_token, make_game(spot)).json()["id"]
        attempt_id = start_attempt(client, teacher_token, db, teacher, game_id)
        r = self._answer(client, teacher_token, attempt_id, {"flagged": ["b"]})
        assert r.json()["correct"] is True
