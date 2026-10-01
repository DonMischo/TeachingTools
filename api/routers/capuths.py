"""
Caputh management: upload, list, run live sessions.

Live session flow (Kahoot-style):
  1. Teacher POSTs /api/capuths/{id}/sessions  → gets join_code
  2. Students POST /api/sessions/{code}/join   → register, get participant_id
  3. Everyone connects WS /api/sessions/{code}/ws
  4. Teacher: start → show_answers → next (reveal) → next (advance) → ...
"""
import asyncio
import io
import json
import logging
import math
import random
import re
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import timeline_engine
from ..database import get_db
from ..models import (
    Quiz, QuizQuestion, QuizAnswer, QuizSession, QuizParticipant, QuizResponse, QuizTeam, Transaction, Teacher, Class,
    Student
)
from ..schemas import QuizOut, QuizDetailOut, QuizQuestionOut, QuizAnswerOut, SessionCreate, SessionOut, ParticipantJoin
from ..auth import get_current_teacher, get_current_user, get_player, Guest, is_session_owner, require_session_owner
from ..availability import require_capability
from ..authorship import scope_to_student_pool, is_student
from ..upload_utils import save_image
from .. import scoping
from ..utils import gen_code, parse_grades
from ..ws_auth import ws_teacher, ws_identity, ws_guest
from ..ws_manager import RoomManager, receive_json, reject
from ..display_names import abbreviate_stored, short_name

router = APIRouter(tags=["capuths"])
logger = logging.getLogger(__name__)

QUIZ_DATA_ROOT = Path(__file__).parent.parent.parent / "data" / "quizzes"



def _extract_class_grade(code: str) -> int | None:
    """Extract leading numeric grade from a class code like '5A' → 5, '10C' → 10."""
    m = re.match(r'^(\d+)', code or "")
    return int(m.group(1)) if m else None


def _grade_multiplier(class_grade: int | None, quiz_grades: list[int]) -> float:
    """
    Returns a points multiplier (0–1) for a class doing a quiz below their grade level.
    Uses the highest grade in the quiz's grade range as the reference.
    If class grade is within the range or grades is empty → no penalty.
    Otherwise: 0.85 per grade above the top of the range.
    """
    if class_grade is None or not quiz_grades:
        return 1.0
    max_quiz_grade = max(quiz_grades)
    gap = class_grade - max_quiz_grade
    if gap <= 0:
        return 1.0
    return max(0.1, 0.85 ** gap)

# ---------------------------------------------------------------------------
# In-memory WebSocket connection manager
# ---------------------------------------------------------------------------

class _SessionManager(RoomManager):
    """RoomManager that tracks when rooms become empty (inactivity timeout)."""

    def add_teacher(self, code: str, ws: WebSocket):
        super().add_teacher(code, ws)
        _empty_since.pop(code, None)

    def add_student(self, code: str, key, ws: WebSocket, info: dict | None = None):
        super().add_student(code, key, ws, info)
        _empty_since.pop(code, None)

    def remove_teacher(self, code: str, ws: WebSocket):
        super().remove_teacher(code, ws)
        self._track_empty(code)

    def remove_student(self, code: str, key, ws: WebSocket | None):
        super().remove_student(code, key, ws)
        self._track_empty(code)

    def _track_empty(self, code: str):
        if self.is_empty(code):
            _empty_since.setdefault(code, time.time())
        else:
            _empty_since.pop(code, None)


mgr = _SessionManager()

# ---------------------------------------------------------------------------
# In-memory per-session phase state (ephemeral, not persisted)
# ---------------------------------------------------------------------------

# code → {
#   phase: "preview" | "answering" | "revealed" | "ranking",
#   answer_start_time: float | None,
#   time_limit: int,
#   scores: {pid: float},       cumulative in-game score
#   last_delta: {pid: float},   this question's score gain
#   answer_times: {pid: float}, seconds to answer (from answering phase start)
#   answered_pids: set[int],
# }
_phases: dict[str, dict] = {}

# code → unix timestamp of last disconnect (set when room becomes empty)
_empty_since: dict[str, float] = {}

INACTIVITY_TIMEOUT = 15 * 60  # 15 minutes in seconds


def _expire_stale_sessions(db) -> None:
    """Mark sessions with no connections for >= INACTIVITY_TIMEOUT as finished."""
    now = time.time()
    stale = [code for code, t in list(_empty_since.items()) if now - t >= INACTIVITY_TIMEOUT]
    for code in stale:
        if not mgr.is_empty(code):
            _empty_since.pop(code, None)
            continue
        s = db.query(QuizSession).filter_by(join_code=code).first()
        if s and s.status != "finished":
            s.status = "finished"
            s.finished_at = datetime.now(timezone.utc)
            db.commit()
        _empty_since.pop(code, None)
        _phases.pop(code, None)
        mgr.drop_room(code)


async def _inactivity_watchdog(get_db_fn):
    """Background task: call _expire_stale_sessions every minute."""
    while True:
        await asyncio.sleep(60)
        db = next(get_db_fn())
        try:
            _expire_stale_sessions(db)
        finally:
            db.close()


async def _auto_show_answers(code: str, delay: int, db: Session):
    """Auto-transition preview → answering after preview_time seconds."""
    await asyncio.sleep(delay)
    ph = _phases.get(code)
    if not ph or ph.get("phase") != "preview":
        return
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s or s.status != "active":
        return
    q = s.quiz.questions[s.current_question_idx]
    tl = q.time_limit or s.quiz.time_limit_default
    ph["phase"] = "answering"
    ph["answer_start_time"] = time.time()
    ph["time_limit"] = tl
    msg = _question_answering_msg(q, tl, len(s.participants))
    ph["answer_order"] = [a["id"] for a in msg["answers"]]
    await mgr.broadcast(code, msg)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_caputh_json(data: dict) -> tuple[dict, list[dict]]:
    if "title" not in data:
        raise ValueError("Missing 'title'")
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ValueError("Missing or invalid 'questions'")

    VALID_TYPES = {"single", "multi", "survey", "true_false", "sort", "umrechnung", "timeline"}
    questions = []
    for i, q in enumerate(data["questions"]):
        qtype = q.get("type", "single")
        if qtype not in VALID_TYPES:
            raise ValueError(f"Question {i}: unknown type '{qtype}'")
        if not q.get("question") and not q.get("question_text"):
            raise ValueError(f"Question {i}: missing 'question'")
        content = None
        if qtype == "timeline":
            content = q.get("timeline")
            spec_errors = timeline_engine.validate_game_spec(content, f"Question {i}.timeline")
            if spec_errors:
                raise ValueError("; ".join(spec_errors))
        answers = []
        for j, a in enumerate(q.get("answers", []) if qtype != "timeline" else []):
            answers.append({
                "order": j,
                "text": a.get("text", ""),
                "correct": a.get("correct") if qtype != "survey" else None,
            })
        questions.append({
            "order": i,
            "type": qtype,
            "question_text": q.get("question") or q.get("question_text"),
            "image_path": q.get("image"),
            "time_limit": q.get("time_limit"),
            "preview_time": q.get("preview_time"),
            "content": content,
            "answers": answers,
        })

    settings = data.get("settings", {})
    n_scored = sum(1 for q in questions if q["type"] != "survey")
    max_allowed = n_scored * 2
    requested = data.get("max_points", 100)
    warning: str | None = None
    if requested > max_allowed:
        warning = f"max_points {requested} überschreitet das Limit ({n_scored} Aufgaben × 2 = {max_allowed}). Wurde auf {max_allowed} gesetzt."
        requested = max_allowed

    VALID_QUIZ_TYPES = {"classic", "tue", "test", "assignment", "competition", "custom"}
    raw_type = data.get("type", data.get("quiz_type", "classic"))
    quiz_type = raw_type if raw_type in VALID_QUIZ_TYPES else "classic"

    raw_tags = data.get("tags", [])
    tags = [str(t) for t in raw_tags] if isinstance(raw_tags, list) else []

    grades = parse_grades(data.get("grade") or data.get("grades"))

    return {
        "title": data["title"],
        "description": data.get("description"),
        "max_points": requested,
        "time_limit_default": data.get("time_limit_default", 20),
        "preview_time_default": data.get("preview_time_default", 3),
        "randomize_answers": settings.get("randomize_answer_order", False),
        "quiz_type": quiz_type,
        "tags": tags,
        "grades": grades,
        "warning": warning,
    }, questions


def _create_caputh_from_parsed(db: Session, quiz_fields: dict, questions: list[dict], author_kwargs: dict | None = None) -> Quiz:
    fields = {k: v for k, v in quiz_fields.items() if k not in ("warning",)}
    quiz = Quiz(**fields, **(author_kwargs or {}))
    db.add(quiz)
    db.flush()
    for qd in questions:
        answers_data = qd.pop("answers")
        q = QuizQuestion(quiz_id=quiz.id, **qd)
        db.add(q)
        db.flush()
        for ad in answers_data:
            db.add(QuizAnswer(question_id=q.id, **ad))
    db.commit()
    db.refresh(quiz)
    return quiz


def _score_by_class(session: QuizSession) -> dict[int, dict]:
    """Trefferquote und Rohpunkte je beteiligter Klasse.

    Jede Klasse wird fuer sich bewertet: die 9a an ihren eigenen Teilnehmern,
    die 9b an ihren. 60 % richtig heisst 60 % der Maximalpunktzahl — fuer jede
    Klasse einzeln, nicht als Anteil an einem geteilten Topf. Bei einer
    Klassensitzung bleibt genau ein Eintrag uebrig, also unveraendertes
    Verhalten.

    Teilnehmer ohne eigene Klasse zaehlen in einer Klassensitzung fuer deren
    Klasse — dort gibt es nur eine, und genau so war es vor dieser Aufteilung.
    In einer Kurs/WPF-Sitzung fehlt diese Rueckfallebene: ein Gast, der keine
    Klasse gewaehlt hat, zaehlt nirgends mit, weder als Zaehler noch als
    Nenner, statt einer fremden Klasse angerechnet zu werden.
    """
    scored_questions = [q for q in session.quiz.questions if q.type != "survey"]
    n_q = len(scored_questions)
    if n_q == 0:
        return {}

    def class_of(p: QuizParticipant) -> int | None:
        return p.class_id if p.class_id is not None else session.class_id

    per_class: dict[int, dict] = {}
    for p in session.participants:
        cid = class_of(p)
        if cid is None:
            continue
        per_class.setdefault(cid, {"participants": 0, "correct": 0})
        per_class[cid]["participants"] += 1

    by_participant = {p.id: class_of(p) for p in session.participants}
    for r in session.responses:
        if r.is_correct is not True:
            continue
        cid = by_participant.get(r.participant_id)
        if cid is not None and cid in per_class:
            per_class[cid]["correct"] += 1

    for cid, d in per_class.items():
        d["ratio"] = d["correct"] / (d["participants"] * n_q)
        d["raw_points"] = math.floor(d["ratio"] * session.quiz.max_points)
    return per_class



def _question_preview_msg(q: QuizQuestion, idx: int, total: int, time_limit: int, participant_count: int = 0) -> dict:
    return {
        "event": "question_preview",
        "question_id": q.id,
        "question_idx": idx,
        "total_questions": total,
        "question_text": q.question_text,
        "image_path": q.image_path,
        "time_limit": time_limit,
        "preview_time": q.preview_time if q.preview_time is not None else q.quiz.preview_time_default,
        "question_type": q.type,
        "participant_count": participant_count,
    }


def _question_answering_msg(
    q: QuizQuestion, time_limit: int, participant_count: int = 0, answer_order: list[int] | None = None
) -> dict:
    answers = [{"id": a.id, "text": a.text, "order": a.order} for a in q.answers]
    if answer_order is not None:
        # Restore previously-shuffled order so reconnecting clients see the same sequence
        id_to_ans = {a["id"]: a for a in answers}
        answers = [id_to_ans[aid] for aid in answer_order if aid in id_to_ans]
    elif q.type == "sort" or q.quiz.randomize_answers:
        # Sort questions always shuffled (showing correct order gives the answer away);
        # other types shuffled when the quiz flag is set.
        random.shuffle(answers)
    msg = {
        "event": "question_answering",
        "question_id": q.id,
        "question_type": q.type,
        "time_limit": time_limit,
        "answers": answers,
        "participant_count": participant_count,
    }
    if q.type == "timeline" and q.content:
        # Students get the board without solutions (sort: values stripped,
        # spot: displayed positions only, never which are misplaced).
        msg["timeline"] = timeline_engine.sanitized_board(q.content)
    return msg


def _answer_counts(s: QuizSession, q: QuizQuestion, db: Session) -> dict:
    if q.type == "timeline":
        # Timeline responses store the board answer payload, not answer ids.
        return {}
    responses = db.query(QuizResponse).filter_by(session_id=s.id, question_id=q.id).all()
    counts: dict[int, int] = {a.id: 0 for a in q.answers}
    for r in responses:
        for aid in r.chosen_answer_ids:
            if aid in counts:
                counts[aid] += 1
    return counts


def _build_ranking(s: QuizSession, scores: dict, last_delta: dict) -> list:
    if s.team_mode:
        # Aggregate by team
        team_scores: dict[int, float] = {}
        team_deltas: dict[int, float] = {}
        team_names: dict[int, str] = {}
        team_colors: dict[int, str | None] = {}
        no_team_score = 0.0
        for p in s.participants:
            if p.team_id is not None:
                team_scores[p.team_id] = team_scores.get(p.team_id, 0.0) + scores.get(p.id, 0.0)
                team_deltas[p.team_id] = team_deltas.get(p.team_id, 0.0) + last_delta.get(p.id, 0.0)
                if p.team_id not in team_names and p.team is not None:
                    # Der bei der Anlage eingegebene Name — »Jungen«, »Mädchen« —,
                    # nicht »Team 3«.
                    team_names[p.team_id] = p.team.name
                    team_colors[p.team_id] = p.team.color
        result = []
        for tid, score in team_scores.items():
            result.append({
                "pid": -tid,
                "name": team_names.get(tid, f"Team {tid}"),
                "avatar": "cat",
                "color": team_colors.get(tid),
                "score": score,
                "delta": team_deltas.get(tid, 0.0),
                "team_id": tid,
            })
    else:
        result = []
        for p in s.participants:
            result.append({
                "pid": p.id,
                "name": p.name,
                "avatar": p.avatar,
                "score": scores.get(p.id, 0.0),
                "delta": last_delta.get(p.id, 0.0),
            })
    result.sort(key=lambda x: x["score"], reverse=True)
    for i, entry in enumerate(result):
        entry["rank"] = i + 1
    return result


def _state_msg(s: QuizSession, db: Session) -> dict:
    """Initial state for teacher in waiting room."""
    questions = s.quiz.questions
    q = questions[s.current_question_idx] if s.current_question_idx < len(questions) else None
    return {
        "event": "state",
        "status": s.status,
        "team_mode": s.team_mode,
        "current_question_idx": s.current_question_idx,
        "total_questions": len(questions),
        "question": {
            "id": q.id,
            "order": q.order,
            "type": q.type,
            "question_text": q.question_text,
            "image_path": q.image_path,
            "time_limit": q.time_limit,
            "answers": [{"id": a.id, "text": a.text, "order": a.order} for a in q.answers],
        } if q else None,
        "participant_count": len(s.participants),
        # Die Lobby der Lehrkraft baut sich beim Neuladen daraus wieder auf —
        # sonst stuende dort die Zahl, aber kein einziger Avatar.
        "participants": [{"id": p.id, "name": p.name, "avatar": p.avatar} for p in s.participants],
    }


# ---------------------------------------------------------------------------
# Quiz CRUD
# ---------------------------------------------------------------------------

@router.get("/api/capuths", response_model=list[QuizOut])
def list_capuths(db: Session = Depends(get_db), current=Depends(get_current_user)):
    capuths = scope_to_student_pool(db.query(Quiz), Quiz, current).order_by(Quiz.created_at.desc()).all()
    out = []
    for qz in capuths:
        o = QuizOut.model_validate(qz)
        o.question_count = len(qz.questions)
        out.append(o)
    return out


@router.get("/api/capuths/template")
def download_template(_: Teacher = Depends(get_current_teacher)):
    from fastapi.responses import JSONResponse
    return JSONResponse({
        "_ai_instructions": (
            "Erstelle ein Caputh-Quiz im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- "
            "title (string), type, grade, tags, max_points, time_limit_default, questions. "
            "--- TYPEN (type-Feld) --- "
            "'classic' (normales Quiz), 'tue' (Tägliche Übung, kurz & häufig), "
            "'test' (Klassenarbeitsvorbereitung), 'assignment' (Aufgabenblatt), "
            "'competition' (Wettbewerb), 'custom' (sonstiges). "
            "--- KLASSENSTUFEN (grade-Feld) --- "
            "Einzelne Zahl: 7 | Liste: '5,6,7' | Bereich: '5-10' | Alle Klassen: weglassen oder leer lassen. "
            "--- TAGS --- "
            "Freitextliste, z.B. ['mathe', 'erdkunde', 'sport', 'deutsch', 'biologie', 'physik', 'chemie', 'fun', 'geschichte', 'informatik']. "
            "--- FRAGETYPEN --- "
            "'single' (1 richtige Antwort), 'multi' (mehrere richtig, Teilpunkte), "
            "'true_false' (Wahr/Falsch), 'survey' (keine Wertung), 'sort' (Reihenfolge sortieren, 'order' beginnt bei 1), "
            "'umrechnung' (Zahlenwert tippen, 1 Antwort: 'text' = Zahl + Leerzeichen + Zieleinheit z.B. '30000 cm'), "
            "'timeline' (Zeitstrahl/Zahlenstrahl: statt 'answers' ein Feld 'timeline' = {mode, axis, items}). "
            "Umrechnung: Anzeige lautet 'Rechne um: [Frage] = [Eingabefeld] [Einheit]'. Schüler tippen die Zahl, Einheit wird automatisch daneben gezeigt. "
            "--- TIMELINE-FRAGEN --- timeline.mode 'sort': Schüler ziehen die items an die richtige Stelle "
            "(items [{id, label, value}]; value = korrekte Position, wird Schülern NICHT gezeigt). "
            "timeline.mode 'spot': items werden bei 'value' angezeigt; falsch platzierte tragen ihren wahren Wert "
            "zusätzlich in 'actual' — Schüler markieren die Fehler. axis: {kind: 'year'|'number', min, max, step?, "
            "unit?}; Jahre v. Chr. negativ (-753 = 753 v. Chr.). scoring 'position' (Standard) wertet die Stelle "
            "mit einer wählbaren tolerance = erlaubte Abweichung in Achseneinheiten (Jahren): 0 = exakt (Jahr bzw. "
            "exact_date muss genau stimmen), sonst z.B. 1, 2, 5, 10, 15, 100 (Jahrhundert), 1000 (Jahrtausend) oder "
            "1000000 (1 Mio. Jahre, für erdgeschichtliche Achsen). scoring 'order' wertet nur die Reihenfolge (fair "
            "bei unsicheren Jahreszahlen; tolerance wird dann ignoriert). "
            "Teilpunkte gibt es pro richtig platziertem/markiertem Item. "
            "--- GENAUE DATEN IN TIMELINE-FRAGEN --- Ein item darf zusätzlich 'exact_date' tragen (ISO-8601 "
            "n. Chr.: 'JJJJ', 'JJJJ-MM' oder 'JJJJ-MM-TT', z.B. '1914-07-28'); das Jahr darin muss zu 'value' "
            "passen. Damit wird das item taggenau positioniert und bewertet — PFLICHT, sobald zwei items im "
            "selben Jahr liegen (z.B. Attentat von Sarajevo 1914-06-28 und Kriegserklärung 1914-07-28), sonst "
            "sitzen sie exakt übereinander und sind weder sortierbar noch bewertbar. Bei mode 'spot' gibt "
            "'exact_date' die ANGEZEIGTE (evtl. falsche) Stelle an; die wahre Stelle kommt in 'actual' + "
            "optional 'exact_date_actual' — so lässt sich ein Fehler auch innerhalb desselben Jahres verstecken. "
            "Achse eng wählen (z.B. min 1914, max 1919), damit Tage sichtbar werden. "
            "--- PUNKTE --- "
            "max_points darf maximal Anzahl_Aufgaben × 2 betragen (Umfragen/sort zählen nicht). "
            "--- VORSCHAUZEIT (preview_time_default, preview_time) --- "
            "preview_time_default (Quiz-Ebene, Sekunden) gilt für jede Frage ohne eigenes 'preview_time'. "
            "Während der Vorschauzeit sehen Schüler nur die Frage (ohne Antwortoptionen); danach wird automatisch "
            "zu 'answering' gewechselt. 0 oder weglassen = kein automatischer Wechsel (Lehrer muss manuell weiterklicken). "
            "'preview_time' pro Frage überschreibt den Default für diese eine Frage. "
            "--- MATHEMATISCHE FORMELN --- "
            "Inline-Formeln: $\\frac{a}{b}$, $x^2$, $3 \\cdot 4 =$. "
            "Abgesetzte Formel (zentriert, groß): $$u = 2 \\cdot (a + b)$$. "
            "KaTeX-Syntax. Einheiten: $\\text{mm}$, $\\text{cm}^2$. Dezimalkomma: $3{,}14$. "
            "--- BILDER --- "
            "Bilder liegen in gfx/ (z.B. 'gfx/karte.svg'). "
            "WICHTIG: Keine Hinweise auf die richtige Antwort in Bildern, Fragen oder Antwortoptionen. "
            "Bilder dienen nur der Illustration des Themas, nicht als Lösungshilfe."
        ),
        "title": "Beispiel Caputh",
        "description": "Ein Beispiel-Caputh mit allen Fragetypen",
        "type": "classic",
        "grade": "5-10",
        "tags": ["mathe", "fun"],
        "max_points": 100,
        "time_limit_default": 20,
        "preview_time_default": 3,
        "settings": {"randomize_answer_order": True},
        "questions": [
            {
                "type": "single",
                "question": "Welche Stadt ist die Hauptstadt von Deutschland?",
                "image": None,
                "time_limit": 15,
                "answers": [
                    {"text": "Berlin", "correct": True},
                    {"text": "Hamburg", "correct": False},
                    {"text": "München", "correct": False},
                    {"text": "Köln", "correct": False},
                ],
            },
            {
                "type": "multi",
                "question": "Welche davon sind Planeten in unserem Sonnensystem?",
                "image": "gfx/planeten.png",
                "time_limit": 30,
                "answers": [
                    {"text": "Mars", "correct": True},
                    {"text": "Mond", "correct": False},
                    {"text": "Venus", "correct": True},
                    {"text": "Pluto", "correct": False},
                ],
            },
            {
                "type": "true_false",
                "question": "Die Erde ist flach.",
                "image": None,
                "time_limit": 10,
                "answers": [
                    {"text": "Wahr", "correct": False},
                    {"text": "Falsch", "correct": True},
                ],
            },
            {
                "type": "survey",
                "question": "Was ist dein Lieblingsfach?",
                "image": None,
                "time_limit": 20,
                "answers": [
                    {"text": "Mathe"},
                    {"text": "Deutsch"},
                    {"text": "Sport"},
                    {"text": "Kunst"},
                ],
            },
            {
                "type": "umrechnung",
                "question": "300 m",
                "time_limit": 20,
                "answers": [
                    {"text": "30000 cm", "correct": True},
                ],
            },
            {
                "type": "timeline",
                "question": "Ordne die Ereignisse auf dem Zeitstrahl zu.",
                "time_limit": 60,
                "timeline": {
                    "mode": "sort",
                    "scoring": "position",
                    "tolerance": 100,
                    "axis": {"kind": "year", "min": -800, "max": 2000},
                    "items": [
                        {"id": "rom", "label": "Gründung Roms", "value": -753},
                        {"id": "karl", "label": "Krönung Karls des Großen", "value": 800},
                        {"id": "buchdruck", "label": "Gutenbergs Buchdruck", "value": 1440},
                        {"id": "mauerfall", "label": "Mauerfall", "value": 1989},
                    ],
                },
            },
            {
                # Alle drei Ereignisse liegen 1914/1918 — ohne exact_date säßen
                # die beiden von 1914 exakt übereinander.
                "type": "timeline",
                "question": "Ordne den Beginn des Ersten Weltkriegs taggenau.",
                "time_limit": 60,
                "timeline": {
                    "mode": "sort",
                    "scoring": "order",
                    "axis": {"kind": "year", "min": 1914, "max": 1919},
                    "items": [
                        {"id": "sarajevo", "label": "Attentat von Sarajevo", "value": 1914,
                         "exact_date": "1914-06-28"},
                        {"id": "kriegserklaerung", "label": "Kriegserklärung an Serbien", "value": 1914,
                         "exact_date": "1914-07-28"},
                        {"id": "waffenstillstand", "label": "Waffenstillstand von Compiègne", "value": 1918,
                         "exact_date": "1918-11-11"},
                    ],
                },
            },
        ],
    })


@router.post("/api/capuths/upload", response_model=QuizOut, status_code=201, dependencies=[Depends(require_capability("caputh", "upload"))])
def upload_caputh(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    content = file.file.read()
    # Quizzes have no teacher owner (shared teacher library); only student
    # authorship is tracked, for the shared student pool.
    author_kwargs = {"created_by_student": current.id} if is_student(current) else {}

    if file.filename and file.filename.endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile:
            raise HTTPException(400, "Invalid ZIP file")

        names = zf.namelist()
        json_candidates = [n for n in names if n.endswith("quiz.json") or n == "quiz.json"]
        if not json_candidates:
            raise HTTPException(400, "ZIP must contain quiz.json")
        raw = json.loads(zf.read(json_candidates[0]))

        try:
            quiz_fields, questions = _parse_caputh_json(raw)
        except ValueError as e:
            raise HTTPException(422, str(e))

        quiz = _create_caputh_from_parsed(db, quiz_fields, questions, author_kwargs)

        gfx_files = [n for n in names if "gfx/" in n and not n.endswith("/")]
        if gfx_files:
            asset_dir = QUIZ_DATA_ROOT / str(quiz.id) / "gfx"
            asset_dir.mkdir(parents=True, exist_ok=True)
            for name in gfx_files:
                fname = Path(name).name
                (asset_dir / fname).write_bytes(zf.read(name))
            quiz.asset_path = str(QUIZ_DATA_ROOT / str(quiz.id))
            # Rewrite image_path to include quiz id so static files resolve correctly
            for q in quiz.questions:
                if q.image_path and q.image_path.startswith("gfx/"):
                    q.image_path = f"{quiz.id}/{q.image_path}"
            db.commit()

    else:
        try:
            raw = json.loads(content)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid JSON")
        try:
            quiz_fields, questions = _parse_caputh_json(raw)
        except ValueError as e:
            raise HTTPException(422, str(e))
        quiz = _create_caputh_from_parsed(db, quiz_fields, questions, author_kwargs)

    o = QuizOut.model_validate(quiz)
    o.question_count = len(quiz.questions)
    o.warning = quiz_fields.get("warning")
    return o


@router.get("/api/capuths/{quiz_id}", response_model=QuizDetailOut)
def get_caputh(quiz_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
    # Students may only open quizzes from the shared student pool.
    if is_student(current) and caputh.created_by_student is None:
        raise HTTPException(404, "Caputh not found")
    o = QuizDetailOut.model_validate(caputh)
    o.question_count = len(caputh.questions)
    return o


def _caputh_to_json(quiz: Quiz) -> dict:
    """Das Caputh im Upload-Format — Grundlage fuer den Bearbeiten-Modus."""
    questions = []
    for q in quiz.questions:
        d: dict = {"type": q.type, "question": q.question_text}
        if q.image_path:
            d["image"] = q.image_path
        if q.time_limit is not None:
            d["time_limit"] = q.time_limit
        if q.preview_time is not None:
            d["preview_time"] = q.preview_time
        if q.type == "timeline":
            d["timeline"] = q.content
        else:
            d["answers"] = [
                {"text": a.text} if q.type == "survey" else {"text": a.text, "correct": bool(a.correct)}
                for a in q.answers
            ]
        questions.append(d)
    return {
        "title": quiz.title,
        "description": quiz.description,
        "type": quiz.quiz_type,
        "max_points": quiz.max_points,
        "time_limit_default": quiz.time_limit_default,
        "preview_time_default": quiz.preview_time_default,
        "settings": {"randomize_answer_order": quiz.randomize_answers},
        "tags": quiz.tags or [],
        "grades": quiz.grades or [],
        "questions": questions,
    }


@router.get("/api/capuths/{quiz_id}/export")
def export_caputh(quiz_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    caputh = db.get(Quiz, quiz_id)
    if not caputh or (is_student(current) and caputh.created_by_student is None):
        raise HTTPException(404, "Caputh not found")
    return _caputh_to_json(caputh)


@router.put("/api/capuths/{quiz_id}", response_model=QuizOut)
def update_caputh(quiz_id: int, raw: dict, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Bearbeiten im Upload-Format. Fragen und Antworten werden nach Position
    aktualisiert statt neu angelegt: gespeicherte Antworten frueherer Sessions
    zeigen per ID auf sie und bleiben so gueltig."""
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
    if is_student(current) and caputh.created_by_student is None:
        raise HTTPException(403)
    if any(s.status != "finished" for s in caputh.sessions):
        raise HTTPException(409, "Eine Session läuft noch — erst beenden, dann bearbeiten.")
    try:
        quiz_fields, questions = _parse_caputh_json(raw)
    except ValueError as e:
        raise HTTPException(422, str(e))

    existing = list(caputh.questions)
    for q in existing[len(questions):]:
        if q.responses:
            raise HTTPException(409, f"Frage {q.order + 1} wurde schon beantwortet und kann nicht entfernt werden.")

    for k, v in quiz_fields.items():
        if k != "warning":
            setattr(caputh, k, v)
    for qd in questions:
        answers = qd.pop("answers")
        # Wie beim ZIP-Upload: gfx/-Pfade liegen im Ordner dieses Capuths.
        if caputh.asset_path and qd["image_path"] and qd["image_path"].startswith("gfx/"):
            qd["image_path"] = f"{caputh.id}/{qd['image_path']}"
        if qd["order"] < len(existing):
            q = existing[qd["order"]]
            for k, v in qd.items():
                setattr(q, k, v)
        else:
            q = QuizQuestion(quiz_id=caputh.id, **qd)
            db.add(q)
            db.flush()
        old_answers = list(q.answers)
        for ad in answers:
            if ad["order"] < len(old_answers):
                a = old_answers[ad["order"]]
                a.text, a.correct = ad["text"], ad["correct"]
            else:
                db.add(QuizAnswer(question_id=q.id, **ad))
        for a in old_answers[len(answers):]:
            db.delete(a)
    for q in existing[len(questions):]:
        db.delete(q)
    db.commit()
    db.refresh(caputh)
    o = QuizOut.model_validate(caputh)
    o.question_count = len(caputh.questions)
    o.warning = quiz_fields.get("warning")
    return o


@router.post("/api/capuths/{quiz_id}/assets", status_code=201)
def upload_caputh_asset(quiz_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                        current=Depends(get_current_user)):
    """Bild für eine Frage hochladen — landet wie beim ZIP-Import unter
    data/quizzes/{id}/gfx/. Zurück kommt der Pfad fürs Feld »image«."""
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
    if is_student(current) and caputh.created_by_student is None:
        raise HTTPException(403)
    fname = save_image(file, QUIZ_DATA_ROOT / str(quiz_id) / "gfx")
    if not caputh.asset_path:
        caputh.asset_path = str(QUIZ_DATA_ROOT / str(quiz_id))
        db.commit()
    path = f"{quiz_id}/gfx/{fname}"
    return {"path": path, "url": f"/uploads/quizzes/{path}"}


@router.delete("/api/capuths/{quiz_id}", status_code=204)
def delete_caputh(
    quiz_id: int,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
    # Students may only delete quizzes from the shared student pool; quizzes have
    # no per-teacher owner, so any teacher/admin may delete any quiz (as before).
    if is_student(current) and caputh.created_by_student is None:
        raise HTTPException(403)
    # Delete sessions and their responses/participants before deleting the quiz
    for s in list(caputh.sessions):
        db.query(QuizResponse).filter_by(session_id=s.id).delete(synchronize_session=False)
        db.query(QuizParticipant).filter_by(session_id=s.id).delete(synchronize_session=False)
        db.delete(s)
    db.delete(caputh)
    db.commit()


# ---------------------------------------------------------------------------
# Gruppenauswertung
# ---------------------------------------------------------------------------

QUIZ_TYPE_LABELS = {
    "classic": "Klassisch",
    "tue": "Tägliche Übung",
    "test": "Test",
    "assignment": "Aufgabe",
    "competition": "Wettbewerb",
    "custom": "Benutzerdefiniert",
}


def _compute_gruppenauswertung(
    db: Session,
    quiz_type: str,
    min_sessions: int = 1,
    prior_strength: float = 3.0,
    tags: list[str] | None = None,
) -> dict:
    """
    Compute per-class statistics for all finished sessions of a given quiz_type.
    For TÜ: applies Bayesian averaging.
    For others: plain average.
    Returns a preview dict ready for the frontend.
    """
    quizzes = db.query(Quiz).filter_by(quiz_type=quiz_type).all()
    if tags:
        tag_set = set(tags)
        quizzes = [q for q in quizzes if tag_set.intersection(q.tags or [])]
    quiz_ids = {q.id: q for q in quizzes}
    if not quiz_ids:
        return {"quiz_type": quiz_type, "entries": [], "excluded": []}

    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.quiz_id.in_(quiz_ids.keys()), QuizSession.status == "finished")
        .all()
    )

    # Aggregate per class. Eine Kurs/WPF-Sitzung zaehlt fuer jede beteiligte
    # Klasse einzeln — mit deren eigener Quote, nicht mit der Summe der Runde
    # (die liegt bei mehreren Klassen ueber max_points).
    class_data: dict[int, dict] = {}
    for s in sessions:
        if s.points_awarded is None:
            continue
        quiz = quiz_ids[s.quiz_id]
        if quiz.max_points == 0:
            continue
        if s.points_by_class:
            per_class = [(int(cid), pts) for cid, pts in s.points_by_class.items()]
        elif s.class_id is not None:
            # Altbestand: vor points_by_class gab es nur die eine Klasse.
            per_class = [(s.class_id, s.points_awarded)]
        else:
            continue

        teacher_name = f"{s.teacher.first_name} {s.teacher.last_name}"
        for class_id, points in per_class:
            score_ratio = points / quiz.max_points  # 0–1
            if class_id not in class_data:
                class_data[class_id] = {"ratios": [], "teacher_counts": {}}
            class_data[class_id]["ratios"].append(score_ratio)
            class_data[class_id]["teacher_counts"][teacher_name] = (
                class_data[class_id]["teacher_counts"].get(teacher_name, 0) + 1
            )

    all_classes = {c.id: c for c in db.query(Class).all()}

    # Split included/excluded by min_sessions
    included: list[dict] = []
    excluded: list[dict] = []

    for class_id, data in class_data.items():
        n = len(data["ratios"])
        cls = all_classes.get(class_id)
        entry = {
            "class_id": class_id,
            "class_name": cls.display_name if cls else str(class_id),
            "sessions": n,
            "teacher_counts": data["teacher_counts"],
            "raw_avg": round(sum(data["ratios"]) / n * 10, 2),
        }
        # Suspicious: >60% of sessions by a single teacher
        max_by_one = max(data["teacher_counts"].values(), default=0)
        entry["suspicious"] = n >= 3 and (max_by_one / n) > 0.6

        if n >= min_sessions:
            included.append(entry)
        else:
            excluded.append(entry)

    # Classes with zero sessions
    for cls in all_classes.values():
        if cls.id not in class_data:
            excluded.append({"class_id": cls.id, "class_name": cls.display_name, "sessions": 0, "teacher_counts": {}, "raw_avg": None, "suspicious": False})

    if not included:
        return {"quiz_type": quiz_type, "entries": [], "excluded": excluded}

    # Compute adjusted score
    if quiz_type == "tue":
        mu = sum(e["raw_avg"] for e in included) / len(included)
        for e in included:
            n = e["sessions"]
            e["adjusted"] = round((prior_strength * mu + n * e["raw_avg"]) / (prior_strength + n), 2)
        included.sort(key=lambda e: -e["adjusted"])
    else:
        for e in included:
            e["adjusted"] = e["raw_avg"]
        included.sort(key=lambda e: -e["adjusted"])

    n_cls = len(included)
    for i, e in enumerate(included):
        e["rank"] = i + 1

    return {"quiz_type": quiz_type, "entries": included, "excluded": excluded}


@router.get("/api/capuths/gruppenauswertung/preview")
def gruppenauswertung_preview(
    quiz_type: str = "tue",
    min_sessions: int = 1,
    prior_strength: float = 3.0,
    tags: str = "",
    db: Session = Depends(get_db),
    _: Teacher = Depends(get_current_teacher),
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    return _compute_gruppenauswertung(db, quiz_type, min_sessions, prior_strength, tag_list)


class GruppenauswertungCommit(BaseModel):
    quiz_type: str = "tue"
    max_points: float = 10.0
    trostpreis_points: float = 1.0
    min_sessions: int = 1
    prior_strength: float = 3.0
    tags: list[str] = []


@router.post("/api/capuths/gruppenauswertung/commit", status_code=201)
def gruppenauswertung_commit(
    body: GruppenauswertungCommit,
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    tag_list = body.tags if body.tags else None
    preview = _compute_gruppenauswertung(db, body.quiz_type, body.min_sessions, body.prior_strength, tag_list)
    entries = preview["entries"]
    if not entries:
        raise HTTPException(400, "Keine Klassen qualifiziert")

    n_cls = len(entries)
    awarded = []
    for e in entries:
        rank = e["rank"]
        if n_cls == 1:
            pts = body.max_points
        else:
            t = (rank - 1) / (n_cls - 1)
            pts = round(body.max_points + t * (body.trostpreis_points - body.max_points), 1)

        type_label = QUIZ_TYPE_LABELS.get(body.quiz_type, body.quiz_type)
        db.add(Transaction(
            teacher_id=teacher.id,
            class_id=e["class_id"],
            points=int(round(pts)),
            reason=f"Gruppenauswertung {type_label} – Rang {rank}",
        ))
        awarded.append({**e, "points_awarded": int(round(pts))})

    db.commit()
    return {"awarded": awarded}


# ---------------------------------------------------------------------------
# Session lifecycle (REST)
# ---------------------------------------------------------------------------

def create_session_for_class(
    db: Session, quiz_id: int, class_id: int | None, teacher_id: int,
    max_points: int | None = None, team_mode: bool = False,
    group_id: int | None = None,
) -> QuizSession:
    """Create (or return the existing waiting/active) session for a quiz and one
    scope — either a Klasse or a Kurs/WPF. Shared by the REST endpoint and the
    Stundenplaner tool registry."""
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
    scoping.validate_scope(class_id, group_id)
    if group_id is not None:
        scoping.load_group(db, group_id)

    if class_id is not None:
        existing = db.query(QuizSession).filter_by(quiz_id=quiz_id, class_id=class_id).first()
        already = "Diese Klasse hat dieses Caputh bereits gespielt."
    else:
        existing = db.query(QuizSession).filter_by(quiz_id=quiz_id, group_id=group_id).first()
        already = "Dieser Kurs hat dieses Caputh bereits gespielt."
    if existing and existing.points_awarded is not None:
        raise HTTPException(409, already)
    if existing and existing.status in ("waiting", "active"):
        return existing

    if max_points is not None:
        caputh.max_points = max_points
    session = QuizSession(
        quiz_id=quiz_id,
        class_id=class_id,
        group_id=group_id,
        teacher_id=teacher_id,
        join_code=gen_code(db, QuizSession, "join_code"),
        team_mode=team_mode,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _session_out(s: QuizSession, db: Session) -> SessionOut:
    o = SessionOut.model_validate(s)
    o.participant_count = len(s.participants)
    o.scope_label = scoping.scope_label(db, s.class_id, s.group_id)
    return o


@router.post("/api/capuths/{quiz_id}/sessions", response_model=SessionOut, status_code=201, dependencies=[Depends(require_capability("caputh", "host"))])
def create_session(
    quiz_id: int,
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    session = create_session_for_class(
        db, quiz_id, body.class_id, current.id,
        max_points=body.max_points, team_mode=body.team_mode,
        group_id=body.group_id,
    )
    return _session_out(session, db)


@router.get("/api/sessions/{code}", response_model=SessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    return _session_out(s, db)


@router.get("/api/capuths/{quiz_id}/sessions")
def list_caputh_sessions(quiz_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    """Die eigenen Runden zu diesem Caputh (Admins sehen alle).

    Die Bibliothek ist gemeinsam, die Runden sind es nicht: hier stuenden sonst
    die Beitrittscodes der Kollegin, und mit einem Code steht die Tuer zu ihrer
    Auswertung offen."""
    sessions = [s for s in db.query(QuizSession).filter_by(quiz_id=quiz_id).all()
                if is_session_owner(s, current)]
    return [
        {
            "join_code": s.join_code,
            "status": s.status,
            "class_id": s.class_id,
            "group_id": s.group_id,
            "scope_label": scoping.scope_label(db, s.class_id, s.group_id),
            "participant_count": len(s.participants),
            "points_awarded": s.points_awarded,
            "points_by_class": _stored_breakdown(s, db),
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
        }
        for s in sessions
    ]


def _delete_session_rows(s: QuizSession, db: Session):
    """Remove a session and its participants/responses/teams. Awarded points
    (Transaction rows) reference only teacher/class — they are NOT touched."""
    _phases.pop(s.join_code, None)
    _empty_since.pop(s.join_code, None)
    db.query(QuizResponse).filter_by(session_id=s.id).delete()
    db.query(QuizParticipant).filter_by(session_id=s.id).delete()
    db.query(QuizTeam).filter_by(session_id=s.id).delete()
    db.delete(s)


@router.delete("/api/sessions/{code}", status_code=204)
def delete_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    require_session_owner(s, current)
    _delete_session_rows(s, db)
    db.commit()


@router.delete("/api/capuths/{quiz_id}/sessions", status_code=204)
def clear_sessions(quiz_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    """Delete all sessions of a quiz. Awarded points stay untouched.

    Nur die eigenen — ein Caputh liegt in der gemeinsamen Bibliothek, und
    »aufraeumen« darf nicht die Auswertung der Kollegin mitnehmen."""
    sessions = [s for s in db.query(QuizSession).filter_by(quiz_id=quiz_id).all()
                if is_session_owner(s, current)]
    for s in sessions:
        _delete_session_rows(s, db)
    db.commit()


@router.post("/api/sessions/{code}/reset", status_code=200)
def reset_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    require_session_owner(s, current)
    if s.points_awarded is not None:
        raise HTTPException(409, "Session already scored — create a new session to play again")
    _phases.pop(code, None)
    _empty_since.pop(code, None)
    s.status = "waiting"
    s.current_question_idx = 0
    s.started_at = None
    s.finished_at = None
    db.query(QuizResponse).filter_by(session_id=s.id).delete()
    db.commit()
    return {"join_code": code, "status": "waiting"}


@router.get("/api/sessions/{code}/report")
def get_session_report(code: str, fmt: str = "json", db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    import csv as csv_mod
    import io as io_mod
    from fastapi.responses import StreamingResponse

    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    require_session_owner(s, current)

    questions = s.quiz.questions
    scored_qs = [q for q in questions if q.type != "survey"]
    # In einer Kurs/WPF-Runde sagt der Name allein nicht, fuer welche Klasse
    # jemand gespielt hat.
    class_codes = {c.id: c.code for c in db.query(Class).all()}

    rows = []
    for p in sorted(s.participants, key=lambda x: x.name):
        q_results = []
        correct_count = 0
        for q in questions:
            resp = db.query(QuizResponse).filter_by(
                session_id=s.id, participant_id=p.id, question_id=q.id
            ).first()
            if q.type == "survey":
                q_results.append({"question": q.question_text, "type": q.type, "answered": resp is not None, "correct": None})
            elif resp is None:
                q_results.append({"question": q.question_text, "type": q.type, "answered": False, "correct": False})
            else:
                q_results.append({"question": q.question_text, "type": q.type, "answered": True, "correct": resp.is_correct})
                if resp.is_correct:
                    correct_count += 1
        n_scored = len(scored_qs)
        rows.append({
            "name": p.name,
            "avatar": p.avatar,
            "class_code": class_codes.get(p.class_id, "–"),
            "correct": correct_count,
            "total_scored": n_scored,
            "percent": round(correct_count / n_scored * 100) if n_scored else None,
            "questions": q_results,
        })

    if fmt == "csv":
        buf = io_mod.StringIO()
        writer = csv_mod.writer(buf)
        header = ["Name", "Klasse", "Richtig", "Gesamt", "%"] + [f"F{i+1}: {q.question_text[:40]}" for i, q in enumerate(questions)]
        writer.writerow(header)
        for r in rows:
            cells = [r["name"], r["class_code"], r["correct"], r["total_scored"],
                     f"{r['percent']}%" if r["percent"] is not None else "–"]
            for qr in r["questions"]:
                if qr["correct"] is None:
                    cells.append("–")
                elif qr["correct"]:
                    cells.append("✓")
                else:
                    cells.append("✗" if qr["answered"] else "–")
            writer.writerow(cells)
        buf.seek(0)
        filename = f"report_{code}.csv"
        return StreamingResponse(
            iter([buf.getvalue().encode("utf-8-sig")]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    return {
        "session_code": code,
        "quiz_title": s.quiz.title,
        "status": s.status,
        "scope_label": scoping.scope_label(db, s.class_id, s.group_id),
        "points_by_class": _stored_breakdown(s, db),
        "questions": [{"id": q.id, "text": q.question_text, "type": q.type} for q in questions],
        "participants": rows,
    }


@router.get("/api/sessions/{code}/teams")
def list_teams(code: str, db: Session = Depends(get_db)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404)
    teams = db.query(QuizTeam).filter_by(session_id=s.id).all()
    return [{"id": t.id, "name": t.name, "color": t.color} for t in teams]


class TeamCreate(BaseModel):
    name: str
    color: str | None = None


@router.post("/api/sessions/{code}/teams", status_code=201)
def create_team(
    code: str,
    body: TeamCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404)
    require_session_owner(s, current)
    t = QuizTeam(session_id=s.id, name=body.name.strip()[:50], color=body.color)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "color": t.color}


@router.delete("/api/sessions/{code}/teams/{team_id}", status_code=204)
def delete_team(
    code: str,
    team_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404)
    require_session_owner(s, current)
    t = db.query(QuizTeam).filter_by(id=team_id, session_id=s.id).first()
    if not t:
        raise HTTPException(404)
    db.delete(t)
    db.commit()


@router.post("/api/sessions/{code}/join", status_code=201)
def join_session(code: str, body: ParticipantJoin, db: Session = Depends(get_db), player=Depends(get_player)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.status == "finished":
        raise HTTPException(409, "Session already finished")
    # Der Name landet in der Rangliste am Beamer. Wer angemeldet ist, erscheint
    # unter dem Namen seines Kontos in der Kurzform — ein selbst getippter Name
    # war bisher zugleich ein freies Namensfeld fuer jeden Mitspieler.
    name = (short_name(player) if isinstance(player, Student)
            else abbreviate_stored(body.name)[:100])
    avatar = body.avatar[:50]

    # Wem die Leistung dieses Teilnehmers gutgeschrieben wird. In einer
    # Klassensitzung immer der Klasse der Sitzung; in einer Kurs/WPF-Sitzung
    # der eigenen Klasse des angemeldeten Schuelers, sonst der beim Beitritt
    # gewaehlten.
    student_id = player.id if isinstance(player, Student) else None
    target_class_id = scoping.participant_class_id(
        session_class_id=s.class_id,
        session_group_id=s.group_id,
        student_class_id=player.class_id if isinstance(player, Student) else None,
        chosen_class_id=body.class_id,
        allowed_class_ids=scoping.scope_class_ids(db, s.class_id, s.group_id) or None,
    )

    # Wiedereinstieg. Gaeste werden an ihrer Token-Id erkannt, nicht am Namen:
    # zwei Gaeste, die beide "Max" eintippen, sind zwei Spieler. Der Name allein
    # hat sie frueher zu einem einzigen Teilnehmer verschmolzen, samt geteilter
    # Punkte — und der zweite Avatar fiel stillschweigend unter den Tisch.
    guest_id = player.id if isinstance(player, Guest) else None
    if guest_id is not None:
        existing = db.query(QuizParticipant).filter_by(session_id=s.id, guest_id=guest_id).first()
    else:
        existing = db.query(QuizParticipant).filter_by(session_id=s.id, guest_id=None, name=name).first()

    if existing:
        # Beim Wiedereinstieg zaehlt die frische Wahl, nicht die von vorhin.
        existing.name = name
        existing.avatar = avatar
        if body.team_id is not None:
            existing.team_id = body.team_id
        existing.student_id = student_id
        if target_class_id is not None:
            existing.class_id = target_class_id
        db.commit()
        db.refresh(existing)
        return {"participant_id": existing.id, "name": existing.name, "avatar": existing.avatar,
                "team_id": existing.team_id, "class_id": existing.class_id, "rejoined": True}

    p = QuizParticipant(session_id=s.id, name=name, avatar=avatar, team_id=body.team_id, guest_id=guest_id,
                        student_id=student_id, class_id=target_class_id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"participant_id": p.id, "name": p.name, "avatar": p.avatar,
            "team_id": p.team_id, "class_id": p.class_id, "rejoined": False}


# ---------------------------------------------------------------------------
# WebSocket — real-time game bus
# ---------------------------------------------------------------------------

def _ws_participant(db: Session, s: QuizSession, websocket: WebSocket,
                    behauptet: int) -> QuizParticipant | None:
    """Der Teilnehmer, der zu *dieser* Verbindung gehoert.

    Die ``participant_id`` aus der Query ist eine Behauptung des Browsers. Wer
    angemeldet ist oder ein Gast-Token hat, wird an seiner Identitaet erkannt,
    nicht daran — sonst laesst sich mit der Nummer des Nachbarn dessen Platz
    uebernehmen: seine Rueckmeldungen mitlesen und unter seinem Namen antworten.

    Nur fuer eine Lehrkraft, die selbst mitspielt, bleibt die Nummer der einzige
    Anhaltspunkt (QuizParticipant kennt keine teacher_id) — die spielt in der
    eigenen Runde und hat nichts davon, jemanden zu verdraengen.
    """
    identity = ws_identity(websocket, db)
    if identity and identity[0] == "student":
        # Ein angemeldeter Schueler hat genau einen Platz: seinen.
        return db.query(QuizParticipant).filter_by(
            session_id=s.id, student_id=identity[1]).first()

    gast = ws_guest(websocket, s.join_code, db)
    if gast is not None:
        eigener = db.query(QuizParticipant).filter_by(
            session_id=s.id, guest_id=gast.id).first()
        if eigener is not None:
            return eigener

    p = db.get(QuizParticipant, behauptet)
    if p is None or p.session_id != s.id:
        return None
    # Ein Platz, der jemandem gehoert, laesst sich nicht per Nummer uebernehmen.
    # Uebrig bleiben herrenlose Plaetze: die mitspielende Lehrkraft (kein
    # teacher_id auf QuizParticipant) und Altbestaende von vor der Gast-Id.
    if p.student_id is not None or p.guest_id is not None:
        return None
    return p


@router.websocket("/api/sessions/{code}/ws")
async def session_ws(
    code: str,
    websocket: WebSocket,
    role: str = "student",
    participant_id: int = 0,
    db: Session = Depends(get_db),
):
    pid: int | None = None
    try:
        s = db.query(QuizSession).filter_by(join_code=code).first()
        if not s:
            logger.warning("Caputh-WS %s: Sitzung nicht gefunden (role=%s)", code, role)
            await reject(websocket, 4004)
            return

        # Host control requires a verified teacher identity from the session
        # cookie — role= is client-supplied and must not grant control alone.
        # Und nicht irgendeine Lehrkraft: die Steuerung (Frage weiter, Punkte
        # vergeben) gehoert der Lehrkraft, der die Sitzung gehoert.
        if role == "teacher":
            host = ws_teacher(websocket, db)
            if host is None or not is_session_owner(s, host):
                logger.warning("Caputh-WS %s: Host abgewiesen — %s", code,
                               "nicht als Lehrkraft angemeldet" if host is None
                               else f"Sitzung gehoert nicht Lehrkraft {host.id}")
                await reject(websocket, 4003)
                return

        await websocket.accept()

        if role == "teacher":
            mgr.add_teacher(code, websocket)
            if s.status == "waiting" or code not in _phases:
                await websocket.send_json(_state_msg(s, db))
            else:
                await _resync_teacher(s, db, code, websocket)
        else:
            # Unauthenticated players must hold a live guest token scoped to this
            # code (only issued when the teacher opted in — enforces opt-in +
            # 60-min expiry). Logged-in students/teachers pass freely.
            if ws_identity(websocket, db) is None and ws_guest(websocket, code, db) is None:
                logger.warning("Caputh-WS %s: Spieler ohne Anmeldung oder gueltiges Gast-Token", code)
                await websocket.close(code=4001)
                return
            p = _ws_participant(db, s, websocket, participant_id)
            if p is None:
                logger.warning("Caputh-WS %s: kein Platz fuer participant_id=%s", code, participant_id)
                await websocket.close(code=4003)
                return
            pid = p.id
            mgr.add_student(code, pid, websocket)
            await websocket.send_json({"event": "joined", "name": p.name, "avatar": p.avatar})
            await _resync_student(s, db, code, pid, websocket)
            await mgr.send_teachers(code, {
                "event": "participant_joined",
                "participant_id": p.id,
                "name": p.name,
                "avatar": p.avatar,
                "count": len(s.participants),
            })

        try:
            while True:
                data = await receive_json(websocket, db)
                action = data.get("action")

                db.expire_all()
                s = db.query(QuizSession).filter_by(join_code=code).first()

                try:
                    if role == "teacher":
                        await _handle_teacher_action(action, data, s, db, code, websocket)
                    else:
                        await _handle_student_action(action, data, s, db, code, pid)
                except Exception:
                    logger.exception("Caputh-WS %s: Aktion %r fehlgeschlagen (role=%s, pid=%s)",
                                     code, action, role, pid)
                    # Eine abgebrochene Transaktion vergiftete sonst die Session:
                    # jede weitere Aktion dieser Verbindung scheiterte mit.
                    db.rollback()

        except WebSocketDisconnect:
            pass
    except WebSocketDisconnect:
        pass
    except Exception:
        # Mit Code, Rolle und Platz ins Log: sonst sah die Lehrkraft nur
        # »Verbinde…«, und im Log stand ein Traceback ohne Sitzung.
        logger.exception("Caputh-WS %s: Verbindung abgebrochen (role=%s, pid=%s)", code, role, pid)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        if role == "student":
            mgr.remove_student(code, pid, websocket)
        else:
            mgr.remove_teacher(code, websocket)


async def _resync_teacher(s: QuizSession, db: Session, code: str, ws: WebSocket):
    """Restore teacher to current game state after reconnect."""
    ph = _phases.get(code)
    if not ph:
        await ws.send_json(_state_msg(s, db))
        return

    questions = s.quiz.questions
    q = questions[s.current_question_idx]
    tl = q.time_limit or s.quiz.time_limit_default

    n_participants = len(s.participants)

    if ph["phase"] == "preview":
        await ws.send_json(_question_preview_msg(q, s.current_question_idx, len(questions), tl, n_participants))

    elif ph["phase"] == "answering":
        await ws.send_json(_question_preview_msg(q, s.current_question_idx, len(questions), tl, n_participants))
        counts = _answer_counts(s, q, db)
        resp_count = db.query(QuizResponse).filter_by(session_id=s.id, question_id=q.id).count()
        await ws.send_json(_question_answering_msg(q, tl, n_participants, ph.get("answer_order")))
        await ws.send_json({
            "event": "answer_update",
            "question_id": q.id,
            "answer_counts": counts,
            "response_count": resp_count,
            "participant_count": n_participants,
        })

    elif ph["phase"] in ("revealed", "ranking"):
        if q.type == "sort":
            correct_ids = [a.id for a in sorted(q.answers, key=lambda a: a.order)]
        elif q.type == "umrechnung":
            correct_ids = [q.answers[0].id] if q.answers else None
        elif q.type not in ("survey", "timeline"):
            correct_ids = [a.id for a in q.answers if a.correct]
        else:
            correct_ids = None
        counts = _answer_counts(s, q, db)
        msg = {
            "event": "reveal",
            "question_id": q.id,
            "correct_answer_ids": correct_ids,
            "answer_counts": counts,
            "score_ratios": {},
            "is_last": s.current_question_idx + 1 >= len(questions),
        }
        if q.type == "timeline" and q.content:
            msg["timeline_solution"] = timeline_engine.solution_payload(q.content)
        await ws.send_json(msg)
        if ph["phase"] == "ranking":
            ranking = _build_ranking(s, ph.get("scores", {}), ph.get("last_delta", {}))
            await ws.send_json({
                "event": "ranking",
                "ranking": ranking,
                "is_last": s.current_question_idx + 1 >= len(questions),
            })


async def _resync_student(s: QuizSession, db: Session, code: str, pid: int, ws: WebSocket):
    """Restore a reconnecting student to the current game phase."""
    ph = _phases.get(code)
    if not ph:
        return  # still in waiting room — joined event is enough

    questions = s.quiz.questions
    q = questions[s.current_question_idx]
    tl = q.time_limit or s.quiz.time_limit_default

    if ph["phase"] == "preview":
        await ws.send_json(_question_preview_msg(q, s.current_question_idx, len(questions), tl))

    elif ph["phase"] == "answering":
        await ws.send_json(_question_preview_msg(q, s.current_question_idx, len(questions), tl))
        await ws.send_json(_question_answering_msg(q, tl, answer_order=ph.get("answer_order")))
        # If they already answered, acknowledge so client shows confirmed state
        already = db.query(QuizResponse).filter_by(session_id=s.id, question_id=q.id, participant_id=pid).first()
        if already:
            await ws.send_json({"event": "answer_received"})

    elif ph["phase"] in ("revealed", "ranking"):
        if q.type == "sort":
            correct_ids = [a.id for a in sorted(q.answers, key=lambda a: a.order)]
        elif q.type == "umrechnung":
            correct_ids = [q.answers[0].id] if q.answers else None
        elif q.type not in ("survey", "timeline"):
            correct_ids = [a.id for a in q.answers if a.correct]
        else:
            correct_ids = None
        counts = _answer_counts(s, q, db)
        scores = ph.get("scores", {})
        score_ratios = {str(p): round(v, 3) for p, v in scores.items()} if scores else {}
        await ws.send_json(_question_preview_msg(q, s.current_question_idx, len(questions), tl))
        await ws.send_json(_question_answering_msg(q, tl, answer_order=ph.get("answer_order")))
        msg = {
            "event": "reveal",
            "question_id": q.id,
            "correct_answer_ids": correct_ids,
            "answer_counts": counts,
            "score_ratios": score_ratios,
            "is_last": s.current_question_idx + 1 >= len(questions),
        }
        if q.type == "timeline" and q.content:
            msg["timeline_solution"] = timeline_engine.solution_payload(q.content)
        await ws.send_json(msg)
        if ph["phase"] == "ranking":
            ranking = _build_ranking(s, scores, ph.get("last_delta", {}))
            await ws.send_json({
                "event": "ranking",
                "ranking": ranking,
                "is_last": s.current_question_idx + 1 >= len(questions),
            })

    elif ph["phase"] == "finished":
        points = _compute_points(s)
        scores = ph.get("scores", {})
        final_ranking = _build_ranking(s, scores, {})
        scored_questions = [q2 for q2 in questions if q2.type != "survey"]
        n_q = len(scored_questions)
        n_p = max(len(s.participants), 1)
        max_possible = n_q * n_p
        score_ratio = sum(scores.values()) / max_possible if max_possible > 0 else 0
        await ws.send_json({
            "event": "finished",
            "points_awarded": points,
            "quiz_title": s.quiz.title,
            "final_ranking": final_ranking,
            "score_ratio": round(score_ratio, 3),
        })


async def _handle_teacher_action(action: str, data: dict, s: QuizSession, db: Session, code: str, ws: WebSocket):
    ph = _phases.get(code)
    questions = s.quiz.questions

    # ── start ──────────────────────────────────────────────────────────────
    if action == "start" and s.status == "waiting":
        _phases[code] = {
            "phase": "preview",
            "answer_start_time": None,
            "time_limit": 0,
            "scores": {},
            "last_delta": {},
            "answer_times": {},
            "answered_pids": set(),
        }
        s.status = "active"
        s.started_at = datetime.now(timezone.utc)
        s.current_question_idx = 0
        db.commit()
        db.expire_all()
        s = db.query(QuizSession).filter_by(join_code=code).first()
        q = s.quiz.questions[0]
        tl = q.time_limit or s.quiz.time_limit_default
        await mgr.broadcast(code, _question_preview_msg(q, 0, len(s.quiz.questions), tl, len(s.participants)))
        pt = q.preview_time if q.preview_time is not None else s.quiz.preview_time_default
        if pt:
            asyncio.create_task(_auto_show_answers(code, pt, db))

    # ── show_answers — preview → answering ─────────────────────────────────
    elif action == "show_answers" and s.status == "active" and ph and ph["phase"] == "preview":
        q = questions[s.current_question_idx]
        tl = q.time_limit or s.quiz.time_limit_default
        ph["phase"] = "answering"
        ph["answer_start_time"] = time.time()
        ph["time_limit"] = tl
        msg = _question_answering_msg(q, tl, len(s.participants))
        ph["answer_order"] = [a["id"] for a in msg["answers"]]
        await mgr.broadcast(code, msg)

    # ── next — handles all mid-game advances ───────────────────────────────
    elif action == "next" and s.status == "active" and ph:

        if ph["phase"] == "preview":
            # Skip preview, go straight to answering
            q = questions[s.current_question_idx]
            tl = q.time_limit or s.quiz.time_limit_default
            ph["phase"] = "answering"
            ph["answer_start_time"] = time.time()
            ph["time_limit"] = tl
            msg = _question_answering_msg(q, tl, len(s.participants))
            ph["answer_order"] = [a["id"] for a in msg["answers"]]
            await mgr.broadcast(code, msg)

        elif ph["phase"] == "answering":
            # Reveal answers (no ranking yet)
            await _do_reveal(s, db, code)

        elif ph["phase"] == "revealed":
            # Show ranking slide
            await _do_ranking(s, code)

        elif ph["phase"] == "ranking":
            # Advance to next question or finish
            next_idx = s.current_question_idx + 1
            if next_idx >= len(questions):
                await _finish_session(s, db, code)
            else:
                ph["phase"] = "preview"
                ph["answer_start_time"] = None
                ph["answer_times"] = {}
                ph["answered_pids"] = set()
                ph["last_delta"] = {}
                ph.pop("answer_order", None)
                s.current_question_idx = next_idx
                db.commit()
                db.expire_all()
                s = db.query(QuizSession).filter_by(join_code=code).first()
                q = s.quiz.questions[next_idx]
                tl = q.time_limit or s.quiz.time_limit_default
                await mgr.broadcast(code, _question_preview_msg(q, next_idx, len(s.quiz.questions), tl, len(s.participants)))
                if q.preview_time:
                    asyncio.create_task(_auto_show_answers(code, q.preview_time, db))

    # ── kick ───────────────────────────────────────────────────────────────
    elif action == "kick":
        pid_to_kick = data.get("participant_id")
        if pid_to_kick:
            await mgr.send_student(code, pid_to_kick, {"event": "kicked"})
            await mgr.close_student(code, pid_to_kick)
            p = db.get(QuizParticipant, pid_to_kick)
            if p and p.session_id == s.id:
                db.delete(p)
                db.commit()
            db.expire_all()
            s = db.query(QuizSession).filter_by(join_code=code).first()
            await mgr.send_teachers(code, {
                "event": "participant_left",
                "participant_id": pid_to_kick,
                "count": len(s.participants),
            })

    # ── rename ─────────────────────────────────────────────────────────────
    elif action == "rename":
        pid_to_rename = data.get("participant_id")
        new_name = (data.get("name") or "").strip()[:100]
        if pid_to_rename and new_name:
            p = db.get(QuizParticipant, pid_to_rename)
            if p and p.session_id == s.id:
                p.name = new_name
                db.commit()
                await mgr.send_student(code, pid_to_rename, {"event": "renamed", "name": new_name})
                await mgr.send_teachers(code, {"event": "participant_renamed", "participant_id": pid_to_rename, "name": new_name})

    # ── finish — early end ─────────────────────────────────────────────────
    elif action == "finish" and s.status == "active":
        await _finish_session(s, db, code)

    # ── restart — reset session back to waiting ─────────────────────────────
    elif action == "restart" and s.status in ("active", "finished"):
        _phases.pop(code, None)
        s.status = "waiting"
        s.current_question_idx = 0
        s.started_at = None
        s.finished_at = None
        # points_awarded intentionally kept — replay won't re-score
        db.query(QuizResponse).filter_by(session_id=s.id).delete()
        db.commit()
        db.expire_all()
        s = db.query(QuizSession).filter_by(join_code=code).first()
        await mgr.broadcast(code, _state_msg(s, db))

    else:
        await ws.send_json({"event": "error", "detail": f"Invalid action '{action}' in state '{s.status}'"})


def _score_ratio(q: QuizQuestion, resp: QuizResponse) -> float:
    """0.0–1.0 score ratio for a response. Multi/sort/timeline: partial credit."""
    if q.type == "survey":
        return 0.0
    if q.type == "timeline":
        answer = resp.chosen_answer_ids if isinstance(resp.chosen_answer_ids, dict) else {}
        ratio, _ = timeline_engine.score_answer(q.content or {}, answer)
        return ratio
    if q.type == "sort":
        correct_order = [a.id for a in sorted(q.answers, key=lambda a: a.order)]
        submitted = resp.chosen_answer_ids or []
        if not submitted:
            return 0.0
        matches = sum(1 for i, aid in enumerate(submitted) if i < len(correct_order) and aid == correct_order[i])
        return matches / len(correct_order)
    if q.type != "multi":
        return 1.0 if resp.is_correct else 0.0
    correct_ids = {a.id for a in q.answers if a.correct}
    wrong_ids = {a.id for a in q.answers if not a.correct}
    n_correct = len(correct_ids)
    if n_correct == 0:
        return 0.0
    chosen = set(resp.chosen_answer_ids)
    correct_selected = len(chosen & correct_ids)
    wrong_selected = len(chosen & wrong_ids)
    return max(0.0, (correct_selected - wrong_selected) / n_correct)


async def _do_reveal(s: QuizSession, db: Session, code: str):
    ph = _phases[code]
    ph["phase"] = "revealed"

    questions = s.quiz.questions
    q = questions[s.current_question_idx]
    if q.type in ("survey", "timeline"):
        correct_ids = None
    elif q.type == "sort":
        correct_ids = [a.id for a in sorted(q.answers, key=lambda a: a.order)]
    elif q.type == "umrechnung":
        correct_ids = [q.answers[0].id] if q.answers else None
    else:
        correct_ids = [a.id for a in q.answers if a.correct]
    counts = _answer_counts(s, q, db)

    n_players = max(len(s.participants), 1)
    max_bonus = round(n_players * 0.1, 2)
    answer_times = ph.get("answer_times", {})

    responses = db.query(QuizResponse).filter_by(session_id=s.id, question_id=q.id).all()
    # Build {pid: ratio}, only for scored questions
    pid_ratios: dict[int, float] = {}
    if q.type != "survey":
        for r in responses:
            ratio = _score_ratio(q, r)
            if ratio > 0:
                pid_ratios[r.participant_id] = ratio

    # Sort by answer speed for speed bonus
    sorted_scoring = sorted(pid_ratios.keys(), key=lambda p: answer_times.get(p, float("inf")))

    scores = ph.get("scores", {})
    last_delta: dict[int, float] = {}
    n_scoring = len(sorted_scoring)

    for i, pid in enumerate(sorted_scoring):
        ratio = pid_ratios[pid]
        if n_scoring == 1:
            bonus = max_bonus
        else:
            t = i / (n_scoring - 1)
            bonus = round(max_bonus + t * (0.01 - max_bonus), 2)
        delta = round(ratio * (1.0 + bonus), 2)
        scores[pid] = round(scores.get(pid, 0.0) + delta, 2)
        last_delta[pid] = delta

    ph["scores"] = scores
    ph["last_delta"] = last_delta

    # Per-participant feedback: include their ratio so frontend can show partial credit
    score_ratios = {str(pid): round(r, 3) for pid, r in pid_ratios.items()}

    msg = {
        "event": "reveal",
        "question_id": q.id,
        "correct_answer_ids": correct_ids,
        "answer_counts": counts,
        "score_ratios": score_ratios,
        "is_last": s.current_question_idx + 1 >= len(questions),
    }
    if q.type == "timeline" and q.content:
        msg["timeline_solution"] = timeline_engine.solution_payload(q.content)
    await mgr.broadcast(code, msg)


async def _do_ranking(s: QuizSession, code: str):
    ph = _phases[code]
    ph["phase"] = "ranking"
    ranking = _build_ranking(s, ph.get("scores", {}), ph.get("last_delta", {}))
    await mgr.broadcast(code, {
        "event": "ranking",
        "ranking": ranking,
        "is_last": s.current_question_idx + 1 >= len(s.quiz.questions),
    })


def _class_breakdown(s: QuizSession, db: Session) -> list[dict]:
    """Was jede beteiligte Klasse verdient hat — eine Zeile pro Klasse.

    Die Punkte einer Klasse sind ihre eigene Trefferquote mal die
    Maximalpunktzahl, danach ihr eigener Klassenstufen-Faktor: in einem Kurs
    koennen 9er und 10er sitzen, und dieselbe Aufgabe ist fuer sie nicht
    gleich viel wert.
    """
    per_class = _score_by_class(s)
    if not per_class:
        return []
    classes = {c.id: c for c in db.query(Class).filter(Class.id.in_(per_class.keys())).all()}
    rows = []
    for cid, d in per_class.items():
        cls = classes.get(cid)
        multiplier = _grade_multiplier(_extract_class_grade(cls.code) if cls else None, s.quiz.grades or [])
        rows.append({
            "class_id": cid,
            "class_code": cls.code if cls else str(cid),
            "class_name": cls.display_name if cls else str(cid),
            "participants": d["participants"],
            "ratio": d["ratio"],
            "multiplier": multiplier,
            "points": round(d["raw_points"] * multiplier),
        })
    rows.sort(key=lambda r: r["class_code"])
    return rows


def _award_points(s: QuizSession, db: Session) -> tuple[int, list[dict]]:
    """Je Klasse eine Buchung. Gibt (Summe, Aufschluesselung) zurueck."""
    rows = _class_breakdown(s, db)
    scope = scoping.scope_label(db, s.class_id, s.group_id)
    for r in rows:
        if r["points"] <= 0:
            continue
        reason = f"Caputh: {s.quiz.title}"
        if s.group_id is not None:
            reason += f" ({scope})"
        if r["multiplier"] < 1.0:
            reason += f" (×{r['multiplier']:.0%} Klassenstufen-Faktor)"
        db.add(Transaction(teacher_id=s.teacher_id, class_id=r["class_id"], points=r["points"], reason=reason))
    return sum(r["points"] for r in rows), rows


def _stored_breakdown(s: QuizSession, db: Session) -> list[dict]:
    """Die Aufschluesselung einer schon verpunkteten Sitzung, aus der DB."""
    stored = s.points_by_class or {}
    if not stored:
        return []
    ids = [int(k) for k in stored]
    classes = {c.id: c for c in db.query(Class).filter(Class.id.in_(ids)).all()}
    rows = [
        {
            "class_id": cid,
            "class_code": classes[cid].code if cid in classes else str(cid),
            "class_name": classes[cid].display_name if cid in classes else str(cid),
            "points": pts,
        }
        for cid, pts in ((int(k), v) for k, v in stored.items())
    ]
    rows.sort(key=lambda r: r["class_code"])
    return rows


async def _finish_session(s: QuizSession, db: Session, code: str):
    s.status = "finished"
    s.finished_at = datetime.now(timezone.utc)

    # Only award points once — replays don't re-score
    is_replay = s.points_awarded is not None
    if not is_replay:
        points, breakdown = _award_points(s, db)
        s.points_awarded = points
        s.points_by_class = {str(r["class_id"]): r["points"] for r in breakdown}
    else:
        points = s.points_awarded
        breakdown = _stored_breakdown(s, db)

    db.commit()

    ph = _phases.get(code, {})
    final_ranking = _build_ranking(s, ph.get("scores", {}), {})

    scored_questions = [q for q in s.quiz.questions if q.type != "survey"]
    n_q = len(scored_questions)
    n_p = len(s.participants)
    score_ratio = (sum(1 for r in s.responses if r.is_correct is True) / (n_p * n_q)) if n_q and n_p else 0.0

    await mgr.broadcast(code, {
        "event": "finished",
        "points_awarded": points,
        # Je Klasse eine Zeile — in einer Kurs/WPF-Runde mehr als eine.
        "points_by_class": [
            {k: v for k, v in r.items() if k in ("class_id", "class_code", "class_name", "points", "ratio")}
            for r in breakdown
        ],
        "scope_label": scoping.scope_label(db, s.class_id, s.group_id),
        "is_group_scope": s.group_id is not None,
        "quiz_title": s.quiz.title,
        "final_ranking": final_ranking,
        "score_ratio": score_ratio,
        "is_replay": is_replay,
    })
    _phases.pop(code, None)


async def _handle_student_action(action: str, data: dict, s: QuizSession, db: Session, code: str, pid: int):
    if action != "answer" or s.status != "active":
        return

    ph = _phases.get(code, {})
    if ph.get("phase") != "answering":
        return  # answers only accepted during answering phase

    if pid in ph.get("answered_pids", set()):
        return

    questions = s.quiz.questions
    if s.current_question_idx >= len(questions):
        return
    cur_q = questions[s.current_question_idx]

    existing = db.query(QuizResponse).filter_by(participant_id=pid, question_id=cur_q.id).first()
    if existing:
        return

    # Track how fast this student answered
    answer_time: float | None = None
    if ph.get("answer_start_time"):
        answer_time = time.time() - ph["answer_start_time"]

    ph.setdefault("answered_pids", set()).add(pid)
    if answer_time is not None:
        ph.setdefault("answer_times", {})[pid] = answer_time

    is_correct: bool | None = None

    if cur_q.type == "timeline":
        # The raw board answer ({placements} / {flagged}) is stored in
        # chosen_answer_ids; the JSON column takes the dict as-is and
        # _score_ratio re-scores it for partial credit at reveal time.
        payload = data.get("timeline_answer")
        if not isinstance(payload, dict):
            payload = {}
        ratio, _ = timeline_engine.score_answer(cur_q.content or {}, payload)
        is_correct = ratio >= 1.0
        chosen_ids = payload
    elif cur_q.type == "umrechnung":
        raw = str(data.get("answer_text", "")).replace(" ", "")
        correct_ans = cur_q.answers[0] if cur_q.answers else None
        if correct_ans:
            correct_val = correct_ans.text.rsplit(None, 1)[0].replace(" ", "")
            try:
                is_correct = int(raw) == int(correct_val)
            except (ValueError, TypeError):
                is_correct = False
        else:
            is_correct = False
        chosen_ids = [correct_ans.id] if is_correct and correct_ans else []
    else:
        chosen_ids = data.get("answer_ids", [])
        if cur_q.type == "sort":
            correct_order = [a.id for a in sorted(cur_q.answers, key=lambda a: a.order)]
            is_correct = chosen_ids == correct_order
        elif cur_q.type != "survey":
            correct_ids = {a.id for a in cur_q.answers if a.correct}
            is_correct = set(chosen_ids) == correct_ids

    resp = QuizResponse(
        session_id=s.id,
        participant_id=pid,
        question_id=cur_q.id,
        chosen_answer_ids=chosen_ids,
        is_correct=is_correct,
    )
    db.add(resp)
    db.commit()

    await mgr.send_student(code, pid, {
        "event": "answer_received",
        "is_correct": is_correct,
    })

    db.expire_all()
    s = db.query(QuizSession).filter_by(join_code=code).first()
    resp_count = db.query(QuizResponse).filter_by(session_id=s.id, question_id=cur_q.id).count()
    await mgr.send_teachers(code, {
        "event": "answer_update",
        "question_id": cur_q.id,
        "answer_counts": _answer_counts(s, cur_q, db),
        "response_count": resp_count,
        "participant_count": len(s.participants),
    })

    # Auto-reveal once every participant has answered
    n_participants = len(s.participants)
    if n_participants > 0 and resp_count >= n_participants:
        await _do_reveal(s, db, code)
