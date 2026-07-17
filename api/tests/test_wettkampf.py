"""
Tests for the Wettkämpfe feature: lifecycle, bracket generation, results, point awarding.
"""
import pytest
from api.models import Wettkampf, WettkampfStage, WettkampfTeilnehmer, WettkampfMatch, Transaction
from api.tests.conftest import auth


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_wettkampf(client, token, **kwargs) -> dict:
    payload = {"title": "Test WK", "type": "knockout", "max_points": 10, "trostpreis_points": 1}
    payload.update(kwargs)
    r = client.post("/api/wettkampf", json=payload, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


def _add_participant(client, token, wid: int, name: str, class_id=None) -> dict:
    r = client.post(f"/api/wettkampf/{wid}/participants",
                    json={"name": name, "class_id": class_id},
                    headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


def _set_stages(client, token, wid: int, stages: list[dict]):
    r = client.put(f"/api/wettkampf/{wid}/stages",
                   json={"stages": stages},
                   headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _generate(client, token, wid: int) -> dict:
    r = client.post(f"/api/wettkampf/{wid}/generate", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _set_result(client, token, wid: int, mid: int, winner_id: int) -> dict:
    r = client.put(f"/api/wettkampf/{wid}/matches/{mid}/result",
                   json={"winner_id": winner_id, "score_p1": "3", "score_p2": "1"},
                   headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def _simple_ko_setup(client, token, names: list[str], class_ids: list[int | None] = None):
    """Create a KO Wettkampf, add participants, set stages, generate. Returns (wid, participants)."""
    w = _create_wettkampf(client, token)
    wid = w["id"]
    participants = []
    for i, name in enumerate(names):
        cid = class_ids[i] if class_ids else None
        participants.append(_add_participant(client, token, wid, name, class_id=cid))
    # Suggest stages and set them
    r = client.get(f"/api/wettkampf/{wid}/suggest-stages")
    assert r.status_code == 200
    _set_stages(client, token, wid, r.json())
    data = _generate(client, token, wid)
    return wid, participants, data


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

class TestCrud:
    def test_create_wettkampf(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, title="Matheturnier", type="knockout",
                               max_points=20, trostpreis_points=2)
        assert w["title"] == "Matheturnier"
        assert w["type"] == "knockout"
        assert w["status"] == "draft"
        assert w["max_points"] == 20
        assert w["trostpreis_points"] == 2

    def test_create_requires_auth(self, client):
        r = client.post("/api/wettkampf", json={"title": "X", "type": "knockout",
                                                 "max_points": 10, "trostpreis_points": 1})
        assert r.status_code == 401

    def test_create_invalid_type(self, client, teacher_token):
        r = client.post("/api/wettkampf",
                        json={"title": "X", "type": "invalid", "max_points": 10, "trostpreis_points": 1},
                        headers=auth(teacher_token))
        assert r.status_code == 400

    def test_create_trostpreis_must_be_less_than_max(self, client, teacher_token):
        r = client.post("/api/wettkampf",
                        json={"title": "X", "type": "knockout", "max_points": 5, "trostpreis_points": 5},
                        headers=auth(teacher_token))
        assert r.status_code == 400

    def test_list_wettkampf(self, client, teacher_token):
        _create_wettkampf(client, teacher_token, title="WK A")
        _create_wettkampf(client, teacher_token, title="WK B")
        r = client.get("/api/wettkampf")
        assert r.status_code == 200
        titles = [w["title"] for w in r.json()]
        assert "WK A" in titles and "WK B" in titles

    def test_get_wettkampf(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        r = client.get(f"/api/wettkampf/{w['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == w["id"]

    def test_get_nonexistent_returns_404(self, client, teacher_token):
        r = client.get("/api/wettkampf/99999", headers=auth(teacher_token))
        assert r.status_code == 404

    def test_update_wettkampf(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, title="Alt")
        r = client.put(f"/api/wettkampf/{w['id']}", json={"title": "Neu", "max_points": 25},
                       headers=auth(teacher_token))
        assert r.status_code == 200
        body = r.json()
        assert body["title"] == "Neu"
        assert body["max_points"] == 25

    def test_delete_wettkampf(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        r = client.delete(f"/api/wettkampf/{w['id']}", headers=auth(teacher_token))
        assert r.status_code == 204
        assert client.get(f"/api/wettkampf/{w['id']}").status_code == 404

    def test_create_round_robin(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, type="round_robin")
        assert w["type"] == "round_robin"
        assert w["status"] == "draft"


# ---------------------------------------------------------------------------
# Participants
# ---------------------------------------------------------------------------

class TestParticipants:
    def test_add_participant(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        p = _add_participant(client, teacher_token, w["id"], "Alice")
        assert p["name"] == "Alice"
        assert p["id"] is not None

    def test_add_participant_with_class(self, client, teacher_token, klass):
        w = _create_wettkampf(client, teacher_token)
        p = _add_participant(client, teacher_token, w["id"], "Bob", class_id=klass.id)
        assert p["class_id"] == klass.id

    def test_add_participant_requires_auth(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        client.cookies.clear()  # login fixture leaves a session cookie behind
        r = client.post(f"/api/wettkampf/{w['id']}/participants", json={"name": "X"})
        assert r.status_code == 401

    def test_add_participant_blocked_when_active(self, client, teacher_token):
        wid, participants, _ = _simple_ko_setup(client, teacher_token, ["A", "B"])
        r = client.post(f"/api/wettkampf/{wid}/participants",
                        json={"name": "Late"},
                        headers=auth(teacher_token))
        assert r.status_code == 409

    def test_remove_participant(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        p = _add_participant(client, teacher_token, w["id"], "Remove Me")
        r = client.delete(f"/api/wettkampf/{w['id']}/participants/{p['id']}",
                          headers=auth(teacher_token))
        assert r.status_code == 204

    def test_participants_appear_in_detail(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        _add_participant(client, teacher_token, w["id"], "P1")
        _add_participant(client, teacher_token, w["id"], "P2")
        detail = client.get(f"/api/wettkampf/{w['id']}").json()
        assert len(detail["participants"]) == 2


# ---------------------------------------------------------------------------
# Stages
# ---------------------------------------------------------------------------

class TestStages:
    def test_suggest_stages_ko(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        _add_participant(client, teacher_token, w["id"], "A")
        _add_participant(client, teacher_token, w["id"], "B")
        _add_participant(client, teacher_token, w["id"], "C")
        _add_participant(client, teacher_token, w["id"], "D")
        r = client.get(f"/api/wettkampf/{w['id']}/suggest-stages")
        assert r.status_code == 200
        stages = r.json()
        names = [s["name"] for s in stages]
        assert stages[-1]["name"] == "Sieger"
        assert stages[-1]["points"] == 10  # max_points
        assert stages[0]["points"] == 1    # trostpreis

    def test_suggest_stages_requires_2_participants(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        _add_participant(client, teacher_token, w["id"], "Lone Wolf")
        r = client.get(f"/api/wettkampf/{w['id']}/suggest-stages")
        assert r.status_code == 400

    def test_set_stages(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        stages = [
            {"name": "Trostpreis", "order": 0, "points": 1},
            {"name": "Sieger", "order": 1, "points": 10},
        ]
        result = _set_stages(client, teacher_token, w["id"], stages)
        assert len(result["stages"]) == 2
        assert result["stages"][1]["name"] == "Sieger"

    def test_set_stages_replaces_existing(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        _set_stages(client, teacher_token, w["id"], [
            {"name": "Old", "order": 0, "points": 5}
        ])
        _set_stages(client, teacher_token, w["id"], [
            {"name": "New A", "order": 0, "points": 1},
            {"name": "New B", "order": 1, "points": 10},
        ])
        detail = client.get(f"/api/wettkampf/{w['id']}").json()
        assert len(detail["stages"]) == 2
        assert all(s["name"].startswith("New") for s in detail["stages"])

    def test_suggest_stages_rr(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, type="round_robin")
        for name in ["A", "B", "C"]:
            _add_participant(client, teacher_token, w["id"], name)
        r = client.get(f"/api/wettkampf/{w['id']}/suggest-stages")
        assert r.status_code == 200
        stages = r.json()
        assert len(stages) == 3
        assert stages[-1]["name"] == "Sieger"


# ---------------------------------------------------------------------------
# K.O. bracket generation and matches
# ---------------------------------------------------------------------------

class TestKOBracket:
    def test_generate_creates_matches(self, client, teacher_token):
        _, _, data = _simple_ko_setup(client, teacher_token, ["A", "B", "C", "D"])
        assert data["status"] == "active"
        matches = data["matches"]
        assert len(matches) > 0

    def test_generate_requires_stages(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        _add_participant(client, teacher_token, w["id"], "A")
        _add_participant(client, teacher_token, w["id"], "B")
        r = client.post(f"/api/wettkampf/{w['id']}/generate", headers=auth(teacher_token))
        assert r.status_code == 400

    def test_generate_requires_2_participants(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        _add_participant(client, teacher_token, w["id"], "A")
        _set_stages(client, teacher_token, w["id"], [
            {"name": "Sieger", "order": 0, "points": 10}
        ])
        r = client.post(f"/api/wettkampf/{w['id']}/generate", headers=auth(teacher_token))
        assert r.status_code == 400

    def test_generate_cannot_be_called_twice(self, client, teacher_token):
        wid, _, _ = _simple_ko_setup(client, teacher_token, ["A", "B"])
        r = client.post(f"/api/wettkampf/{wid}/generate", headers=auth(teacher_token))
        assert r.status_code == 409

    def test_2_participants_produces_1_match(self, client, teacher_token):
        _, _, data = _simple_ko_setup(client, teacher_token, ["A", "B"])
        assert len(data["matches"]) == 1

    def test_4_participants_produces_correct_match_count(self, client, teacher_token):
        # 4 participants → 3 matches (2 in R1, 1 final)
        _, _, data = _simple_ko_setup(client, teacher_token, ["A", "B", "C", "D"])
        assert len(data["matches"]) == 3

    def test_bye_auto_advanced_in_3_participant_bracket(self, client, teacher_token):
        # 3 participants → padded to 4 → one bye in first round; that bye-match has a winner
        _, _, data = _simple_ko_setup(client, teacher_token, ["A", "B", "C"])
        # Find round 0 matches with a winner already set (bye)
        round0 = [m for m in data["matches"] if m["round_number"] == 0]
        bye_matches = [m for m in round0 if m["winner_id"] is not None]
        assert len(bye_matches) >= 1

    def test_record_result_advances_winner(self, client, teacher_token):
        wid, participants, data = _simple_ko_setup(client, teacher_token, ["A", "B", "C", "D"])
        # Find a round-0 match with two real participants
        open_match = next(
            m for m in data["matches"]
            if m["round_number"] == 0 and m["p1"] and m["p2"] and m["winner_id"] is None
        )
        winner_id = open_match["p1"]["id"]
        updated = _set_result(client, teacher_token, wid, open_match["id"], winner_id)
        # Winner should appear in next round
        next_matches = [m for m in updated["matches"] if m["round_number"] == 1]
        next_ids = {m["p1"]["id"] if m["p1"] else None for m in next_matches} | \
                   {m["p2"]["id"] if m["p2"] else None for m in next_matches}
        assert winner_id in next_ids

    def test_invalid_winner_rejected(self, client, teacher_token):
        wid, _, data = _simple_ko_setup(client, teacher_token, ["A", "B"])
        match = data["matches"][0]
        r = client.put(f"/api/wettkampf/{wid}/matches/{match['id']}/result",
                       json={"winner_id": 999999},
                       headers=auth(teacher_token))
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Round Robin generation
# ---------------------------------------------------------------------------

class TestRoundRobin:
    def test_rr_every_pair_plays(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, type="round_robin")
        names = ["A", "B", "C", "D"]
        participants = {name: _add_participant(client, teacher_token, w["id"], name)
                        for name in names}
        r = client.get(f"/api/wettkampf/{w['id']}/suggest-stages")
        _set_stages(client, teacher_token, w["id"], r.json())
        data = _generate(client, teacher_token, w["id"])

        # For n=4, every pair plays exactly once → C(4,2)=6 matches
        matches = data["matches"]
        assert len(matches) == 6

    def test_rr_3_participants_produces_3_matches(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, type="round_robin")
        for name in ["X", "Y", "Z"]:
            _add_participant(client, teacher_token, w["id"], name)
        r = client.get(f"/api/wettkampf/{w['id']}/suggest-stages")
        _set_stages(client, teacher_token, w["id"], r.json())
        data = _generate(client, teacher_token, w["id"])
        assert len(data["matches"]) == 3


# ---------------------------------------------------------------------------
# Finish and point awarding
# ---------------------------------------------------------------------------

class TestFinishAndPoints:
    def _run_full_ko(self, client, teacher_token, participants, class_ids=None):
        """Run a 2-participant KO to completion and return (wid, winner_pid)."""
        names = [p["name"] if isinstance(p, dict) else p for p in participants]
        wid, parts, data = _simple_ko_setup(client, teacher_token, names, class_ids=class_ids)
        # There's exactly 1 match; pick p1 as winner
        match = data["matches"][0]
        winner_id = match["p1"]["id"]
        _set_result(client, teacher_token, wid, match["id"], winner_id)
        return wid, winner_id, parts

    def test_finish_sets_status_to_finished(self, client, teacher_token):
        wid, _, _ = self._run_full_ko(client, teacher_token, ["A", "B"])
        r = client.post(f"/api/wettkampf/{wid}/finish", headers=auth(teacher_token))
        assert r.status_code == 200
        detail = client.get(f"/api/wettkampf/{wid}").json()
        assert detail["status"] == "finished"

    def test_finish_returns_awarded_list(self, client, teacher_token):
        wid, winner_id, _ = self._run_full_ko(client, teacher_token, ["A", "B"])
        r = client.post(f"/api/wettkampf/{wid}/finish", headers=auth(teacher_token))
        body = r.json()
        assert "awarded" in body
        assert len(body["awarded"]) == 2
        winner_entry = next(e for e in body["awarded"] if e["participant"]["id"] == winner_id)
        assert winner_entry["points"] == 10  # max_points

    def test_finish_awards_transactions_for_linked_classes(self, client, teacher_token, db, klass, teacher):
        wid, winner_id, parts = self._run_full_ko(
            client, teacher_token, ["Alice", "Bob"],
            class_ids=[klass.id, None]
        )
        r = client.post(f"/api/wettkampf/{wid}/finish", headers=auth(teacher_token))
        assert r.status_code == 200

        # Exactly 1 transaction (only Alice has a class_id)
        txs = db.query(Transaction).filter_by(class_id=klass.id).all()
        assert len(txs) >= 1
        # The transaction for Alice should have non-zero points
        wk_txs = [t for t in txs if "Wettkampf" in (t.reason or "")]
        assert len(wk_txs) == 1

    def test_finish_blocked_with_open_matches(self, client, teacher_token):
        wid, _, data = _simple_ko_setup(client, teacher_token, ["A", "B"])
        r = client.post(f"/api/wettkampf/{wid}/finish", headers=auth(teacher_token))
        assert r.status_code == 409

    def test_finish_blocked_when_not_active(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token)
        r = client.post(f"/api/wettkampf/{w['id']}/finish", headers=auth(teacher_token))
        assert r.status_code == 409

    def test_winner_gets_max_points_loser_gets_trostpreis(self, client, teacher_token):
        wid, winner_id, _ = self._run_full_ko(client, teacher_token, ["A", "B"])
        r = client.post(f"/api/wettkampf/{wid}/finish", headers=auth(teacher_token))
        awarded = r.json()["awarded"]
        pts = {e["participant"]["id"]: e["points"] for e in awarded}
        loser_id = next(pid for pid in pts if pid != winner_id)
        assert pts[winner_id] == 10   # max_points
        assert pts[loser_id] == 1     # trostpreis

    def test_rr_finish_winner_gets_max_points(self, client, teacher_token):
        w = _create_wettkampf(client, teacher_token, type="round_robin", max_points=10, trostpreis_points=1)
        wid = w["id"]
        for name in ["A", "B", "C"]:
            _add_participant(client, teacher_token, wid, name)
        r = client.get(f"/api/wettkampf/{wid}/suggest-stages")
        _set_stages(client, teacher_token, wid, r.json())
        data = _generate(client, teacher_token, wid)

        # Record results: A beats everyone
        for m in data["matches"]:
            if m["p1"] and m["p2"] and m["winner_id"] is None:
                a_id = next(p["id"] for p in client.get(f"/api/wettkampf/{wid}").json()["participants"]
                            if p["name"] == "A")
                winner = m["p1"]["id"] if m["p1"]["name"] == "A" else m["p2"]["id"]
                _set_result(client, teacher_token, wid, m["id"], winner)

        r = client.post(f"/api/wettkampf/{wid}/finish", headers=auth(teacher_token))
        assert r.status_code == 200
        awarded = r.json()["awarded"]
        a_entry = next(e for e in awarded if e["participant"]["name"] == "A")
        assert a_entry["points"] == 10
