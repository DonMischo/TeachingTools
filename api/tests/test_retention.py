"""Schuljahresbereinigung: was beim Jahreswechsel geht und was bleibt."""
from datetime import date, datetime, timedelta, timezone

import pytest

from api.models import (
    ExitTicketResponse, ExitTicketSession, Quiz, QuizParticipant, QuizResponse,
    QuizQuestion, QuizSession, SchreibraumRoom, Transaction,
)
from api.retention import purge_old_sessions, school_year_cutoff


def _quiz(db) -> Quiz:
    q = Quiz(title="Q", max_points=4, time_limit_default=20)
    db.add(q)
    db.flush()
    db.add(QuizQuestion(quiz_id=q.id, order=0, type="single", question_text="?", time_limit=10))
    db.flush()
    return q


class TestStichtag:
    @pytest.mark.parametrize("heute,erwartet", [
        (date(2026, 8, 1), 2026),    # erster Tag des neuen Schuljahrs
        (date(2026, 7, 31), 2025),   # letzter Tag des alten
        (date(2026, 12, 24), 2026),
        (date(2026, 3, 1), 2025),
    ])
    def test_cutoff_folgt_dem_ersten_august(self, heute, erwartet):
        assert school_year_cutoff(heute) == datetime(erwartet, 8, 1, tzinfo=timezone.utc)


class TestWasGeht:
    def test_alte_sitzung_geht_mit_teilnehmern_und_antworten(self, db, klass, teacher):
        q = _quiz(db)
        alt = QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                          join_code="ALT001",
                          created_at=school_year_cutoff() - timedelta(days=1))
        db.add(alt)
        db.flush()
        p = QuizParticipant(session_id=alt.id, name="Anna B.", avatar="cat")
        db.add(p)
        db.flush()
        db.add(QuizResponse(session_id=alt.id, participant_id=p.id,
                            question_id=q.questions[0].id, is_correct=True,
                            chosen_answer_ids=[]))
        db.flush()

        assert purge_old_sessions(db) == {"caputh": 1}
        assert db.query(QuizSession).filter_by(join_code="ALT001").first() is None


    def test_exit_ticket_rueckmeldungen_gehen_mit(self, db, teacher):
        s = ExitTicketSession(code="ALT002", title="Stunde", question="Und?",
                              created_by=teacher.id,
                              created_at=school_year_cutoff() - timedelta(days=30))
        db.add(s)
        db.flush()
        db.add(ExitTicketResponse(session_id=s.id, student_name="Anna B.", comment="war gut"))
        db.flush()

        purge_old_sessions(db)
        assert db.query(ExitTicketSession).filter_by(code="ALT002").first() is None

    def test_ein_altes_caputh_ohne_created_at_wird_ueber_den_verlauf_datiert(self, db, klass, teacher):
        """Caputh bekam sein created_at erst spaeter — Altbestaende sind ueber
        started_at/finished_at datierbar."""
        q = _quiz(db)
        db.add(QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                           join_code="ALT003", created_at=None,
                           finished_at=school_year_cutoff() - timedelta(days=5)))
        db.flush()
        assert purge_old_sessions(db).get("caputh") == 1


def test_die_kindtabellen_haengen_per_cascade_an_der_sitzung():
    """Die Bereinigung loescht nur die Sitzungszeile und verlaesst sich darauf,
    dass Teilnehmer, Antworten und Protokolle mitgehen. Diese Zusage steht in
    den Fremdschluesseln — SQLite erzwingt sie ohne PRAGMA nicht, also wird
    hier die Deklaration geprueft und nicht ihre Wirkung im Testtreiber.
    """
    from api.models import (
        AuctionBid, BarometerResponse, BingoCard, ExitGameAttempt,
        LueckentextParticipant, LueckentextResponse, SimBeitrag,
    )
    kinder = [
        (QuizParticipant, "quiz_sessions"), (QuizResponse, "quiz_sessions"),
        (ExitTicketResponse, "exit_ticket_sessions"), (BingoCard, "bingo_sessions"),
        (BarometerResponse, "barometer_sessions"), (AuctionBid, "auction_sessions"),
        (ExitGameAttempt, "exitgame_sessions"), (SimBeitrag, "tool_sessions"),
        (LueckentextParticipant, "lueckentext_sessions"),
        (LueckentextResponse, "lueckentext_sessions"),
    ]
    for model, eltern in kinder:
        fks = [fk for fk in model.__table__.foreign_keys if fk.column.table.name == eltern]
        assert fks, f"{model.__name__} hat keinen Fremdschluessel auf {eltern}"
        assert all(fk.ondelete == "CASCADE" for fk in fks),             f"{model.__name__} -> {eltern} loescht nicht kaskadierend"


class TestWasBleibt:
    def test_die_laufende_sitzung_bleibt(self, db, klass, teacher):
        q = _quiz(db)
        db.add(QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                           join_code="NEU001",
                           created_at=school_year_cutoff() + timedelta(days=1)))
        db.flush()
        assert purge_old_sessions(db) == {}
        assert db.query(QuizSession).filter_by(join_code="NEU001").first() is not None

    def test_vergebene_punkte_ueberleben(self, db, klass, teacher):
        """Der Hauspokal-Stand haengt an Klasse und Lehrkraft, nicht an der
        Sitzung — eine Bereinigung darf ihn nicht mitnehmen."""
        q = _quiz(db)
        db.add(QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                           join_code="ALT004", points_awarded=40,
                           created_at=school_year_cutoff() - timedelta(days=2)))
        db.add(Transaction(teacher_id=teacher.id, class_id=klass.id, points=40, reason="Caputh"))
        db.flush()

        purge_old_sessions(db)
        assert db.query(Transaction).filter_by(class_id=klass.id).count() == 1

    def test_das_material_ueberlebt(self, db, klass, teacher):
        """Geloescht wird das Stundenprotokoll, nicht das Quiz."""
        q = _quiz(db)
        db.add(QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                           join_code="ALT005",
                           created_at=school_year_cutoff() - timedelta(days=2)))
        db.flush()
        purge_old_sessions(db)
        assert db.get(Quiz, q.id) is not None

    def test_dauerraeume_bleiben(self, db, teacher):
        alt = school_year_cutoff() - timedelta(days=100)
        db.add(SchreibraumRoom(id="r-dauer", code="DAUER1", title="Dauerraum",
                               created_by=teacher.id, is_permanent=True, created_at=alt))
        db.add(SchreibraumRoom(id="r-stunde", code="STUND1", title="Einzelstunde",
                               created_by=teacher.id, is_permanent=False, created_at=alt))
        db.flush()

        purge_old_sessions(db)
        assert db.get(SchreibraumRoom, "r-dauer") is not None
        assert db.get(SchreibraumRoom, "r-stunde") is None

    def test_ein_zweiter_lauf_findet_nichts_mehr(self, db, klass, teacher):
        q = _quiz(db)
        db.add(QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                           join_code="ALT006",
                           created_at=school_year_cutoff() - timedelta(days=2)))
        db.flush()
        assert purge_old_sessions(db) == {"caputh": 1}
        assert purge_old_sessions(db) == {}

    def test_undatierbare_zeilen_werden_nicht_geraten(self, db, klass, teacher):
        """Weder created_at noch started_at noch finished_at: dann bleibt sie."""
        q = _quiz(db)
        db.add(QuizSession(quiz_id=q.id, class_id=klass.id, teacher_id=teacher.id,
                           join_code="OHNE01", created_at=None))
        db.flush()
        assert purge_old_sessions(db) == {}
        assert db.query(QuizSession).filter_by(join_code="OHNE01").first() is not None
