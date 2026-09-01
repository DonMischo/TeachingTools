"""Punktevergabe je Klasse, wenn eine Sitzung an einem Kurs/WPF hängt.

Kurse und Wahlpflichtgruppen sind klassenübergreifend. Erreichen die 9a
zusammen 60 % und die 9b 45 %, bekommt die 9a 60 % und die 9b 45 % der
Maximalpunktzahl — jede Klasse ihren eigenen vollen Anteil.
"""
import pytest

from api.models import (
    Class, Quiz, QuizAnswer, QuizParticipant, QuizQuestion, QuizResponse, QuizSession,
    Student, StudentGroup, StudentGroupMember, Transaction,
)
from api.routers.capuths import _award_points, _class_breakdown, _score_by_class


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def klasse_9a(db) -> Class:
    c = Class(code="9a", display_name="Klasse 9a")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def klasse_9b(db) -> Class:
    c = Class(code="9b", display_name="Klasse 9b")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def wpf(db, klasse_9a, klasse_9b) -> StudentGroup:
    """WPF »NaT« der Jahrgangsstufe 9 mit Mitgliedern aus 9a und 9b."""
    g = StudentGroup(group_type="wahlpflicht", name="NaT", grade=9)
    db.add(g)
    db.flush()
    for cls, vorname in ((klasse_9a, "Ada"), (klasse_9b, "Bo")):
        s = Student(vorname=vorname, nachname="Test", klasse=cls.code, class_id=cls.id, active=True)
        db.add(s)
        db.flush()
        db.add(StudentGroupMember(group_id=g.id, student_id=s.id))
    db.flush()
    return g


@pytest.fixture()
def quiz_2q(db):
    """Ein Quiz mit zwei bewerteten Fragen und 100 Maximalpunkten."""
    quiz = Quiz(title="Zellbiologie", max_points=100, grades=[9])
    db.add(quiz)
    db.flush()
    questions = []
    for i in range(2):
        q = QuizQuestion(quiz_id=quiz.id, question_text=f"Frage {i + 1}", type="single", order=i)
        db.add(q)
        db.flush()
        right = QuizAnswer(question_id=q.id, text="richtig", correct=True, order=0)
        wrong = QuizAnswer(question_id=q.id, text="falsch", correct=False, order=1)
        db.add_all([right, wrong])
        db.flush()
        questions.append((q, right, wrong))
    return {"quiz": quiz, "questions": questions}


def _session(db, quiz, teacher, *, class_id=None, group_id=None, code="GRP001") -> QuizSession:
    s = QuizSession(quiz_id=quiz.id, class_id=class_id, group_id=group_id,
                    teacher_id=teacher.id, join_code=code, status="active")
    db.add(s)
    db.flush()
    return s


def _participant(db, session, name, class_id) -> QuizParticipant:
    p = QuizParticipant(session_id=session.id, name=name, avatar="cat", class_id=class_id)
    db.add(p)
    db.flush()
    return p


def _answer(db, session, participant, question, correct: bool):
    q, right, wrong = question
    db.add(QuizResponse(session_id=session.id, participant_id=participant.id, question_id=q.id,
                        chosen_answer_ids=[right.id if correct else wrong.id], is_correct=correct))
    db.flush()


# ---------------------------------------------------------------------------
# Trefferquote je Klasse
# ---------------------------------------------------------------------------

class TestScoreByClass:
    def test_each_class_scored_on_its_own_participants(self, db, quiz_2q, teacher, wpf, klasse_9a, klasse_9b):
        """9a: 3 von 4 richtig = 75 %. 9b: 1 von 4 = 25 %."""
        quiz = quiz_2q["quiz"]
        q1, q2 = quiz_2q["questions"]
        s = _session(db, quiz, teacher, group_id=wpf.id)

        a1 = _participant(db, s, "Ada", klasse_9a.id)
        a2 = _participant(db, s, "Ali", klasse_9a.id)
        b1 = _participant(db, s, "Bo", klasse_9b.id)
        b2 = _participant(db, s, "Ben", klasse_9b.id)

        for p, results in ((a1, (True, True)), (a2, (True, False)),
                           (b1, (True, False)), (b2, (False, False))):
            for question, ok in zip((q1, q2), results):
                _answer(db, s, p, question, ok)
        db.refresh(s)

        per_class = _score_by_class(s)
        assert per_class[klasse_9a.id]["ratio"] == pytest.approx(0.75)
        assert per_class[klasse_9b.id]["ratio"] == pytest.approx(0.25)
        # 75 % bzw. 25 % von 100 Punkten — jede Klasse ihr eigener voller Anteil.
        assert per_class[klasse_9a.id]["raw_points"] == 75
        assert per_class[klasse_9b.id]["raw_points"] == 25

    def test_participant_without_class_is_ignored_in_group_session(self, db, quiz_2q, teacher, wpf, klasse_9a):
        """Ein Gast ohne Klassenwahl verwässert keine fremde Quote."""
        quiz = quiz_2q["quiz"]
        q1, q2 = quiz_2q["questions"]
        s = _session(db, quiz, teacher, group_id=wpf.id)

        ada = _participant(db, s, "Ada", klasse_9a.id)
        gast = _participant(db, s, "Gast", None)
        for question in (q1, q2):
            _answer(db, s, ada, question, True)
            _answer(db, s, gast, question, False)
        db.refresh(s)

        per_class = _score_by_class(s)
        assert list(per_class) == [klasse_9a.id]
        assert per_class[klasse_9a.id]["ratio"] == pytest.approx(1.0)

    def test_class_session_falls_back_to_its_own_class(self, db, quiz_2q, teacher, klasse_9a):
        """In einer Klassensitzung zählt auch ein Teilnehmer ohne eigene Klasse."""
        quiz = quiz_2q["quiz"]
        q1, q2 = quiz_2q["questions"]
        s = _session(db, quiz, teacher, class_id=klasse_9a.id)

        p = _participant(db, s, "Namenlos", None)
        _answer(db, s, p, q1, True)
        _answer(db, s, p, q2, False)
        db.refresh(s)

        per_class = _score_by_class(s)
        assert per_class[klasse_9a.id]["ratio"] == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# Buchung
# ---------------------------------------------------------------------------

class TestAwardPerClass:
    def test_one_transaction_per_class(self, db, quiz_2q, teacher, wpf, klasse_9a, klasse_9b):
        quiz = quiz_2q["quiz"]
        q1, q2 = quiz_2q["questions"]
        s = _session(db, quiz, teacher, group_id=wpf.id)

        ada = _participant(db, s, "Ada", klasse_9a.id)
        bo = _participant(db, s, "Bo", klasse_9b.id)
        for question in (q1, q2):
            _answer(db, s, ada, question, True)
        _answer(db, s, bo, q1, True)
        _answer(db, s, bo, q2, False)
        db.refresh(s)

        total, rows = _award_points(s, db)
        db.flush()

        assert total == 150  # 100 % für die 9a + 50 % für die 9b
        assert {r["class_code"]: r["points"] for r in rows} == {"9a": 100, "9b": 50}

        txs = db.query(Transaction).all()
        assert {t.class_id: t.points for t in txs} == {klasse_9a.id: 100, klasse_9b.id: 50}
        assert all("NaT" in t.reason for t in txs)

    def test_zero_scoring_class_gets_no_transaction(self, db, quiz_2q, teacher, wpf, klasse_9a, klasse_9b):
        quiz = quiz_2q["quiz"]
        q1, q2 = quiz_2q["questions"]
        s = _session(db, quiz, teacher, group_id=wpf.id)

        ada = _participant(db, s, "Ada", klasse_9a.id)
        bo = _participant(db, s, "Bo", klasse_9b.id)
        for question in (q1, q2):
            _answer(db, s, ada, question, True)
            _answer(db, s, bo, question, False)
        db.refresh(s)

        _award_points(s, db)
        db.flush()
        assert [(t.class_id, t.points) for t in db.query(Transaction).all()] == [(klasse_9a.id, 100)]

    def test_grade_multiplier_is_per_class(self, db, quiz_2q, teacher, klasse_9a):
        """Eine 10. Klasse an einem Quiz für Jahrgang 9 bekommt ihren eigenen Faktor."""
        klasse_10a = Class(code="10a", display_name="Klasse 10a")
        db.add(klasse_10a)
        db.flush()
        group = StudentGroup(group_type="kurs", name="Kurs I", grade=9)
        db.add(group)
        db.flush()
        for cls in (klasse_9a, klasse_10a):
            st = Student(vorname=f"S{cls.code}", nachname="T", klasse=cls.code, class_id=cls.id, active=True)
            db.add(st)
            db.flush()
            db.add(StudentGroupMember(group_id=group.id, student_id=st.id))
        db.flush()

        quiz = quiz_2q["quiz"]  # grades=[9]
        q1, q2 = quiz_2q["questions"]
        s = _session(db, quiz, teacher, group_id=group.id)
        neunte = _participant(db, s, "Neun", klasse_9a.id)
        zehnte = _participant(db, s, "Zehn", klasse_10a.id)
        for question in (q1, q2):
            _answer(db, s, neunte, question, True)
            _answer(db, s, zehnte, question, True)
        db.refresh(s)

        rows = {r["class_code"]: r for r in _class_breakdown(s, db)}
        assert rows["9a"]["multiplier"] == 1.0
        assert rows["9a"]["points"] == 100
        # Eine Klassenstufe über dem Quiz: 0.85
        assert rows["10a"]["multiplier"] == pytest.approx(0.85)
        assert rows["10a"]["points"] == 85


# ---------------------------------------------------------------------------
# Sitzung anlegen
# ---------------------------------------------------------------------------

class TestSessionScope:
    def _quiz_id(self, db, teacher):
        quiz = Quiz(title="Kurz", max_points=10, grades=[9])
        db.add(quiz)
        db.flush()
        q = QuizQuestion(quiz_id=quiz.id, question_text="F", type="single", order=0)
        db.add(q)
        db.flush()
        db.add(QuizAnswer(question_id=q.id, text="r", correct=True, order=0))
        db.flush()
        return quiz.id

    def test_create_session_for_group(self, client, db, teacher, teacher_token, wpf):
        from api.tests.conftest import auth
        quiz_id = self._quiz_id(db, teacher)
        r = client.post(f"/api/capuths/{quiz_id}/sessions",
                        json={"group_id": wpf.id, "max_points": 10}, headers=auth(teacher_token))
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["class_id"] is None
        assert body["group_id"] == wpf.id
        assert body["scope_label"] == "9 NaT"

    def test_both_scopes_rejected(self, client, db, teacher, teacher_token, wpf, klasse_9a):
        from api.tests.conftest import auth
        quiz_id = self._quiz_id(db, teacher)
        r = client.post(f"/api/capuths/{quiz_id}/sessions",
                        json={"group_id": wpf.id, "class_id": klasse_9a.id}, headers=auth(teacher_token))
        assert r.status_code == 422

    def test_no_scope_rejected(self, client, db, teacher, teacher_token):
        from api.tests.conftest import auth
        quiz_id = self._quiz_id(db, teacher)
        r = client.post(f"/api/capuths/{quiz_id}/sessions", json={}, headers=auth(teacher_token))
        assert r.status_code == 422

    def test_ab_gruppe_cannot_carry_a_session(self, client, db, teacher, teacher_token, klasse_9a):
        """A/B-Gruppen gehören zu einer Klasse — dafür wählt man die Klasse."""
        from api.tests.conftest import auth
        g = StudentGroup(group_type="ab_gruppe", name="A", class_id=klasse_9a.id)
        db.add(g)
        db.flush()
        quiz_id = self._quiz_id(db, teacher)
        r = client.post(f"/api/capuths/{quiz_id}/sessions",
                        json={"group_id": g.id}, headers=auth(teacher_token))
        assert r.status_code == 422

    def test_scope_endpoint_lists_member_classes(self, client, db, teacher, wpf, quiz_2q, klasse_9a, klasse_9b):
        _session(db, quiz_2q["quiz"], teacher, group_id=wpf.id, code="SCOPE1")
        r = client.get("/api/play/scope/SCOPE1")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["scope"] == "group"
        assert body["label"] == "9 NaT"
        assert body["needs_class_choice"] is True
        assert [c["code"] for c in body["classes"]] == ["9a", "9b"]

    def test_scope_endpoint_for_class_session(self, client, db, teacher, quiz_2q, klasse_9a):
        _session(db, quiz_2q["quiz"], teacher, class_id=klasse_9a.id, code="SCOPE2")
        body = client.get("/api/play/scope/SCOPE2").json()
        assert body["scope"] == "class"
        assert body["label"] == "9a"
        assert body["needs_class_choice"] is False
        assert body["classes"] == []


# ---------------------------------------------------------------------------
# Beitritt
# ---------------------------------------------------------------------------

class TestJoinClassAttribution:
    def test_guest_choice_is_honoured_in_group_session(self, client, db, teacher, quiz_2q, wpf, klasse_9b):
        from api.auth import create_guest_token
        s = _session(db, quiz_2q["quiz"], teacher, group_id=wpf.id, code="JOIN01")
        s.allow_guests = True
        db.flush()
        token = create_guest_token("JOIN01", "Gast")
        r = client.post("/api/sessions/JOIN01/join",
                        json={"name": "Gast", "avatar": "cat", "class_id": klasse_9b.id},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201, r.text
        assert r.json()["class_id"] == klasse_9b.id

    def test_class_outside_the_group_is_refused(self, client, db, teacher, quiz_2q, wpf):
        """Eine Klasse, die im Kurs gar nicht vertreten ist, zählt nicht."""
        from api.auth import create_guest_token
        fremd = Class(code="7c", display_name="Klasse 7c")
        db.add(fremd)
        db.flush()
        s = _session(db, quiz_2q["quiz"], teacher, group_id=wpf.id, code="JOIN02")
        s.allow_guests = True
        db.flush()
        token = create_guest_token("JOIN02", "Gast")
        r = client.post("/api/sessions/JOIN02/join",
                        json={"name": "Gast", "avatar": "cat", "class_id": fremd.id},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201, r.text
        assert r.json()["class_id"] is None

    def test_class_session_ignores_a_guest_choice(self, client, db, teacher, quiz_2q, klasse_9a, klasse_9b):
        from api.auth import create_guest_token
        s = _session(db, quiz_2q["quiz"], teacher, class_id=klasse_9a.id, code="JOIN03")
        s.allow_guests = True
        db.flush()
        token = create_guest_token("JOIN03", "Gast")
        r = client.post("/api/sessions/JOIN03/join",
                        json={"name": "Gast", "avatar": "cat", "class_id": klasse_9b.id},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201, r.text
        assert r.json()["class_id"] == klasse_9a.id
