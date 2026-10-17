"""Eine Lehrkraft spielt selbst mit.

Sie tritt mit ihrem Konto bei, findet nach einem Abstecher ins Dashboard ihren
Platz wieder und taucht nirgends auf, wo Schueler:innen hinsehen: keine
Rangliste, keine Lobby am Beamer, keine Hauspunkte.
"""
import asyncio

import pytest

import api.routers.bingo as bingo_router
from api.models import (
    BingoCard, BingoSession, ChallengeStand, ExitGameAttempt, LueckentextParticipant, LueckentextSession, LueckentextSet,
    Quiz, QuizParticipant, QuizQuestion, QuizResponse, QuizSession, Transaction,
)
from api.routers.capuths import _build_ranking, _score_by_class, _state_msg
from api.routers.exitgame import _participant_key
from api.routers.lueckentexte import _build_ranking as lt_ranking
from .conftest import auth
from .test_challenge import _h, _schueler, _sitzung, _start, _tok


@pytest.fixture(autouse=True)
def _bingo_leer():
    bingo_router._mgr.clear()
    yield
    bingo_router._mgr.clear()


# ── Caputh ──────────────────────────────────────────────────────────────────

def _quiz(db, klass, teacher) -> QuizSession:
    quiz = Quiz(title="Q", max_points=100, time_limit_default=20)
    db.add(quiz); db.flush()
    db.add(QuizQuestion(quiz_id=quiz.id, order=0, type="single", question_text="?")); db.flush()
    s = QuizSession(quiz_id=quiz.id, class_id=klass.id, teacher_id=teacher.id, join_code="LK1")
    db.add(s); db.flush()
    return s


def test_caputh_lehrkraft_tritt_mit_konto_bei_und_findet_ihren_platz_wieder(client, db, klass, teacher, teacher_token):
    s = _quiz(db, klass, teacher)
    a = client.post("/api/sessions/LK1/join", json={"name": "Spitzname", "avatar": "cat"}, headers=_h(client, teacher_token))
    b = client.post("/api/sessions/LK1/join", json={"name": "anders", "avatar": "dog"}, headers=_h(client, teacher_token))
    assert a.status_code == 201
    assert a.json()["participant_id"] == b.json()["participant_id"] and b.json()["rejoined"] is True
    p = db.get(QuizParticipant, a.json()["participant_id"])
    assert p.teacher_id == teacher.id and p.class_id is None
    assert p.name == "Anna Müller"  # Kontoname, nicht der getippte
    assert db.query(QuizParticipant).filter_by(session_id=s.id).count() == 1


def test_caputh_lehrkraft_nicht_in_rangliste_lobby_und_klassenpunkten(db, klass, teacher):
    s = _quiz(db, klass, teacher)
    kim = QuizParticipant(session_id=s.id, name="Kim T.", class_id=klass.id)
    lk = QuizParticipant(session_id=s.id, name="Anna Müller", teacher_id=teacher.id)
    db.add_all([kim, lk]); db.flush()
    q = s.quiz.questions[0]
    db.add_all([QuizResponse(session_id=s.id, participant_id=p.id, question_id=q.id, chosen_answer_ids=[], is_correct=ok)
                for p, ok in ((kim, False), (lk, True))])
    db.flush(); db.refresh(s)

    assert [r["name"] for r in _build_ranking(s, {kim.id: 1.0, lk.id: 5.0}, {})] == ["Kim T."]
    assert [p["name"] for p in _state_msg(s, db)["participants"]] == ["Kim T."]
    # Die richtige Antwort der Lehrkraft hebt die Quote der Klasse nicht
    assert _score_by_class(s)[klass.id]["participants"] == 1
    assert _score_by_class(s)[klass.id]["correct"] == 0


def test_caputh_bericht_markiert_die_lehrkraft(client, db, klass, teacher, teacher_token):
    s = _quiz(db, klass, teacher)
    db.add(QuizParticipant(session_id=s.id, name="Anna Müller", teacher_id=teacher.id)); db.flush()
    zeilen = client.get("/api/sessions/LK1/report", headers=_h(client, teacher_token)).json()["participants"]
    assert zeilen[0]["class_code"] == "Lehrkraft"


# ── Bingo ───────────────────────────────────────────────────────────────────

def _bingo(client, token) -> str:
    r = client.post("/api/bingo", json={"title": "B", "grid_size": 3, "grid_cols": 3, "max_points": 10,
                                        "pairs": [{"caller": f"F{i}", "answer": f"A{i}"} for i in range(15)]},
                    headers=_h(client, token))
    return r.json()["code"]


def test_bingo_lehrkraft_bekommt_eine_karte_und_dieselbe_wieder(client, db, teacher, teacher_token):
    code = _bingo(client, teacher_token)
    a = client.post(f"/api/bingo/{code}/card", headers=_h(client, teacher_token))
    b = client.post(f"/api/bingo/{code}/card", headers=_h(client, teacher_token))
    assert a.status_code == 200 and a.json()["id"] == b.json()["id"]
    card = db.get(BingoCard, a.json()["id"])
    assert card.anon_token == f"teacher-{teacher.id}" and card.student_name == "Anna Müller"


def test_bingo_lehrkraft_bekommt_keine_hauspunkte(client, db, klass, teacher, teacher_token):
    code = _bingo(client, teacher_token)
    s = db.query(BingoSession).filter_by(code=code).first()
    s.class_id = klass.id
    card_id = client.post(f"/api/bingo/{code}/card", headers=_h(client, teacher_token)).json()["id"]
    card = db.get(BingoCard, card_id)
    s.called_indices = list(card.grid_indices)
    card.marked_positions = list(range(len(card.grid_indices)))
    db.flush()
    asyncio.run(bingo_router._close_and_award(s, db))
    assert db.query(Transaction).filter_by(class_id=klass.id).count() == 0
    assert bingo_router._results(s)[0]["name"] == "Anna Müller (Lehrkraft)"


# ── Lückentext ──────────────────────────────────────────────────────────────

def test_lueckentext_lehrkraft_wird_wiedererkannt_und_steht_nicht_in_der_rangliste(client, db, teacher, teacher_token):
    lt = LueckentextSet(title="LT", text="Es {{a}}.")
    db.add(lt); db.flush()
    s = LueckentextSession(lueckentext_id=lt.id, join_code="LK2", teacher_id=teacher.id)
    db.add(s); db.flush()
    a = client.post("/api/lueckentexte/sessions/LK2/join", json={"name": "x", "avatar": "cat"}, headers=_h(client, teacher_token))
    b = client.post("/api/lueckentexte/sessions/LK2/join", json={"name": "y", "avatar": "cat"}, headers=_h(client, teacher_token))
    assert a.status_code == 201 and a.json()["id"] == b.json()["id"]
    assert db.get(LueckentextParticipant, a.json()["id"]).teacher_id == teacher.id
    db.add(LueckentextParticipant(session_id=s.id, name="Kim T.", avatar="cat")); db.flush(); db.refresh(s)
    assert [e["name"] for e in lt_ranking(s, db)] == ["Kim T."]
    report = client.get("/api/lueckentexte/sessions/LK2/report", headers=_h(client, teacher_token)).json()
    assert "Anna Müller (Lehrkraft)" in [z["name"] for z in report["participants"]]


# ── Challenge ───────────────────────────────────────────────────────────────

def test_challenge_bestenliste_zeigt_die_lehrkraft_nur_ihr_selbst(client, db, klass, teacher_token):
    code = _sitzung(client, teacher_token)
    kim = _tok(_schueler(db, klass))
    for t in (kim, teacher_token):
        _start(client, code, t)
        client.post(f"/api/challenge/{code}/spielwert", headers=_h(client, t),
                    json={"spiel": "huepfen", "etappe": 1, "edelsteine": 3, "max": 20})
    fuer_kim = client.get(f"/api/challenge/{code}/bestenliste", headers=_h(client, kim)).json()
    fuer_lk = client.get(f"/api/challenge/{code}/bestenliste", headers=_h(client, teacher_token)).json()
    assert len(fuer_kim) == 1 and fuer_kim[0]["ich"] is True
    assert len(fuer_lk) == 2 and sum(z["ich"] for z in fuer_lk) == 1


def test_challenge_lehrkraft_setzt_nach_dem_dashboard_fort(client, db, klass, teacher_token):
    code = _sitzung(client, teacher_token)
    erst = _start(client, code, teacher_token).json()
    wieder = _start(client, code, teacher_token).json()
    assert erst == wieder  # derselbe Stand, dieselbe gemischte Reihenfolge
    assert db.query(ChallengeStand).filter(ChallengeStand.teacher_id.isnot(None)).count() == 1


# ── TaskCrawler ─────────────────────────────────────────────────────────────

def test_taskcrawler_gaeste_teilen_sich_keinen_platz_im_live_ueberblick():
    a = ExitGameAttempt(guest_id="g-1")
    b = ExitGameAttempt(guest_id="g-2")
    lk = ExitGameAttempt(teacher_id=7)
    assert len({_participant_key(a), _participant_key(b), _participant_key(lk)}) == 3
