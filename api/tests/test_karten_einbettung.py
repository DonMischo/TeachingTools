"""Kartenquiz eingebettet in Caputh (type "karte") und TaskCrawler (kind "karte")."""
import io
import json

from api import karten_quiz as engine
from api.routers.capuths import _question_answering_msg, _score_ratio
from api.models import QuizQuestion, QuizResponse
from api.tests.conftest import auth
from api.tests.test_exitgame_timeline import make_game, start_attempt
from api.tests.test_exitgame_timeline import upload as upload_exitgame

SATZ = {"titel": "Thüringen", "inhalt": {
    "art": "stumm", "region": "thueringen", "ebenen": ["de-laender", "de-staedte"], "beschriftung": False,
    "auswahl": {"de-staedte": {"objekte": ["16051000", "16053000"], "nummerierung": "zahl"}}}}


def _satz(client, token, **anders) -> int:
    return client.post("/api/karten/saetze", json={**SATZ, **anders}, headers=auth(token)).json()["id"]


def _caputh(client, token, karte):
    quiz = {"title": "Karten-Quiz", "max_points": 2, "questions": [{"type": "karte", "question": "Benenne die Städte.", "karte": karte}]}
    return client.post("/api/capuths/upload", files={"file": ("quiz.json", io.BytesIO(json.dumps(quiz).encode()), "application/json")},
                       headers=auth(token))


class TestCaputh:
    def test_verweis_wird_aufgeloest_und_spieler_sehen_keine_namen(self, client, db, teacher_token):
        r = _caputh(client, teacher_token, {"satz": _satz(client, teacher_token), "modus": "benennen", "wortbank": False})
        assert r.status_code == 201, r.text
        q = db.query(QuizQuestion).filter_by(quiz_id=r.json()["id"]).one()
        assert [a["name"] for a in q.content["aufgaben"]] == ["Erfurt", "Jena"]

        msg = _question_answering_msg(q, 30)
        roh = json.dumps(msg["karte"])
        assert "Erfurt" not in roh and q.content["geheim"] not in roh and "16051000" not in roh
        assert [a["marke"] for a in msg["karte"]["spiel"]["aufgaben"]] == ["1", "2"]

        # Ebenen über das öffentliche Brett — ohne Namen
        ebene = client.get(f"/api/karten/quiz/brett/{msg['karte']['brett']}/ebene/de-staedte").json()
        assert all("name" not in f["properties"] for f in ebene["features"])
        assert client.get(f"/api/karten/quiz/brett/{msg['karte']['brett']}/ebene/de-gipfel").status_code == 404

    def test_teilpunkte(self, client, db, teacher_token):
        r = _caputh(client, teacher_token, {"satz": _satz(client, teacher_token)})
        q = db.query(QuizQuestion).filter_by(quiz_id=r.json()["id"]).one()
        resp = QuizResponse(chosen_answer_ids={"antworten": {"1": "erfurt", "2": "Weimar"}})
        assert _score_ratio(q, resp) == 0.5

    def test_fremder_privater_satz_wird_abgelehnt(self, client, teacher_token, admin_token):
        client.cookies.clear()
        satz = _satz(client, teacher_token)
        r = _caputh(client, admin_token, {"satz": satz})
        assert r.status_code == 422 and "nicht gefunden" in r.text

    def test_export_und_wieder_hochladen(self, client, db, teacher_token):
        quiz_id = _caputh(client, teacher_token, {"satz": _satz(client, teacher_token)}).json()["id"]
        export = client.get(f"/api/capuths/{quiz_id}/export", headers=auth(teacher_token))
        assert export.status_code == 200, export.text
        daten = export.json()
        assert daten["questions"][0]["karte"]["aufgaben"]
        r = client.post("/api/capuths/upload", files={"file": ("quiz.json", io.BytesIO(json.dumps(daten).encode()), "application/json")},
                        headers=auth(teacher_token))
        assert r.status_code == 201, r.text


class TestTaskCrawler:
    def _aufgabe(self, client, token, **karte):
        return {"kind": "karte", "question": "Finde die Städte.", "karte": {"satz": _satz(client, token), **karte}}

    def test_aufgabe_geloest_ab_mindestquote(self, client, db, teacher, teacher_token):
        r = upload_exitgame(client, teacher_token, make_game(self._aufgabe(client, teacher_token, mindestens=0.5)))
        assert r.status_code == 201, r.text
        attempt_id = start_attempt(client, teacher_token, db, teacher, r.json()["id"])
        antwort = {"antworten": {"1": "Erfurt", "2": "falsch"}}
        r = client.post(f"/api/exitgame-attempts/{attempt_id}/events",
                        json={"slide_id": "s1", "action": "answer", "payload": {"task_index": 0, "answer": antwort}}, headers=auth(teacher_token))
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is True

    def test_spielerdaten_ohne_geheimnis_und_namen(self, client, db, teacher, teacher_token):
        from api.routers.exitgame import _task_for_player
        r = upload_exitgame(client, teacher_token, make_game(self._aufgabe(client, teacher_token, modus="benennen")))
        from api.models import ExitGame
        task = db.get(ExitGame, r.json()["id"]).data["slides"][0]["task"]
        spieler = _task_for_player(task)
        roh = json.dumps(spieler)
        assert task["karte"]["geheim"] not in roh and "Erfurt" not in roh
        assert spieler["karte"]["spiel"]["modus"] == "benennen"

    def test_unaufgeloeste_karte_wird_abgelehnt(self, client, teacher_token):
        r = upload_exitgame(client, teacher_token, make_game({"kind": "karte", "karte": {"modus": "benennen"}}))
        assert r.status_code == 422


def test_engine_bewerte_finden_mit_token():
    spec = {"modus": "finden", "geheim": "g", "aufgaben": [
        {"nr": 1, "ebene": "e", "id": "x", "name": "X", "alternativen": [], "marke": "1"},
        {"nr": 2, "ebene": "e", "id": "y", "name": "Y", "alternativen": [], "marke": "2"}]}
    ratio, je = engine.bewerte(spec, {"antworten": {"1": engine.token("g", "e", "x"), "2": engine.token("g", "e", "x")}})
    assert ratio == 0.5 and je == {"1": True, "2": False}
    assert engine.loesung(spec)["2"]["token"] == engine.token("g", "e", "y")
