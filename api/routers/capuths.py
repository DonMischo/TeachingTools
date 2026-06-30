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
import math
import random
import re
import string
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Quiz, QuizQuestion, QuizAnswer, QuizSession, QuizParticipant, QuizResponse, Transaction, Teacher, Class
)
from ..schemas import QuizOut, QuizDetailOut, QuizQuestionOut, QuizAnswerOut, SessionCreate, SessionOut, ParticipantJoin
from ..auth import get_current_teacher

router = APIRouter(tags=["capuths"])

QUIZ_DATA_ROOT = Path(__file__).parent.parent.parent / "data" / "quizzes"


def _parse_grades(raw) -> list[int]:
    """
    Parse grade field from JSON into a sorted list of ints.
    Accepts: int, "7", "5,6,7", "5-10", [5,6,7].
    Values are clamped to 1–13.
    """
    if raw is None:
        return []
    if isinstance(raw, int):
        return [raw] if 1 <= raw <= 13 else []
    if isinstance(raw, list):
        return sorted({int(v) for v in raw if str(v).isdigit() and 1 <= int(v) <= 13})
    s = str(raw).strip()
    # Range: "5-10"
    range_m = re.fullmatch(r'(\d+)\s*[-–]\s*(\d+)', s)
    if range_m:
        lo, hi = int(range_m.group(1)), int(range_m.group(2))
        return [g for g in range(min(lo, hi), max(lo, hi) + 1) if 1 <= g <= 13]
    # Comma-separated: "5,6,7"
    parts = re.split(r'[,;\s]+', s)
    result = []
    for p in parts:
        if p.isdigit() and 1 <= int(p) <= 13:
            result.append(int(p))
    return sorted(set(result))


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

class _SessionManager:
    def __init__(self):
        self._rooms: dict[str, dict] = {}

    def _room(self, code: str) -> dict:
        if code not in self._rooms:
            self._rooms[code] = {"teacher": None, "students": {}}
        return self._rooms[code]

    def add_teacher(self, code: str, ws: WebSocket):
        self._room(code)["teacher"] = ws
        _empty_since.pop(code, None)

    def add_student(self, code: str, pid: int, ws: WebSocket):
        self._room(code)["students"][pid] = ws
        _empty_since.pop(code, None)

    def remove(self, code: str, pid: int | None):
        r = self._rooms.get(code)
        if not r:
            return
        if pid is None:
            r["teacher"] = None
        else:
            r["students"].pop(pid, None)
        # Track when the room becomes fully empty for inactivity timeout
        if not r.get("teacher") and not r.get("students"):
            _empty_since.setdefault(code, time.time())
        else:
            _empty_since.pop(code, None)

    async def broadcast(self, code: str, msg: dict, exclude_pid: int | None = None):
        r = self._rooms.get(code, {})
        targets = list(r.get("students", {}).items())
        if r.get("teacher"):
            targets.append((-1, r["teacher"]))  # -1 sentinel for teacher (never a real pid)
        for pid, ws in targets:
            if exclude_pid is not None and pid == exclude_pid:
                continue
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def send_teacher(self, code: str, msg: dict):
        r = self._rooms.get(code, {})
        if ws := r.get("teacher"):
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def send_student(self, code: str, pid: int, msg: dict):
        ws = self._rooms.get(code, {}).get("students", {}).get(pid)
        if ws:
            try:
                await ws.send_json(msg)
            except Exception:
                pass

    async def kick_student(self, code: str, pid: int):
        ws = self._rooms.get(code, {}).get("students", {}).get(pid)
        if ws:
            try:
                await ws.close(code=4000)
            except Exception:
                pass
            self._rooms.get(code, {}).get("students", {}).pop(pid, None)


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
        r = mgr._rooms.get(code, {})
        if r.get("teacher") or r.get("students"):
            _empty_since.pop(code, None)
            continue
        s = db.query(QuizSession).filter_by(join_code=code).first()
        if s and s.status != "finished":
            s.status = "finished"
            s.finished_at = datetime.now(timezone.utc)
            db.commit()
        _empty_since.pop(code, None)
        _phases.pop(code, None)
        mgr._rooms.pop(code, None)


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

def _gen_code(db: Session, length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = "".join(random.choices(chars, k=length))
        if not db.query(QuizSession).filter_by(join_code=code).first():
            return code
    raise RuntimeError("Could not generate unique join code")


def _parse_caputh_json(data: dict) -> tuple[dict, list[dict]]:
    if "title" not in data:
        raise ValueError("Missing 'title'")
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ValueError("Missing or invalid 'questions'")

    VALID_TYPES = {"single", "multi", "survey", "true_false", "sort", "umrechnung"}
    questions = []
    for i, q in enumerate(data["questions"]):
        qtype = q.get("type", "single")
        if qtype not in VALID_TYPES:
            raise ValueError(f"Question {i}: unknown type '{qtype}'")
        if not q.get("question") and not q.get("question_text"):
            raise ValueError(f"Question {i}: missing 'question'")
        answers = []
        for j, a in enumerate(q.get("answers", [])):
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

    grades = _parse_grades(data.get("grade") or data.get("grades"))

    return {
        "title": data["title"],
        "description": data.get("description"),
        "max_points": requested,
        "time_limit_default": data.get("time_limit_default", 20),
        "randomize_answers": settings.get("randomize_answer_order", False),
        "quiz_type": quiz_type,
        "tags": tags,
        "grades": grades,
        "warning": warning,
    }, questions


def _create_caputh_from_parsed(db: Session, quiz_fields: dict, questions: list[dict]) -> Quiz:
    fields = {k: v for k, v in quiz_fields.items() if k not in ("warning",)}
    quiz = Quiz(**fields)
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


def _score_session(session: QuizSession) -> int:
    scored_questions = [q for q in session.quiz.questions if q.type != "survey"]
    n_q = len(scored_questions)
    n_p = len(session.participants)
    if n_q == 0 or n_p == 0:
        return 0
    correct = sum(1 for r in session.responses if r.is_correct is True)
    ratio = correct / (n_p * n_q)
    return math.floor(ratio * session.quiz.max_points)


def _question_preview_msg(q: QuizQuestion, idx: int, total: int, time_limit: int, participant_count: int = 0) -> dict:
    return {
        "event": "question_preview",
        "question_id": q.id,
        "question_idx": idx,
        "total_questions": total,
        "question_text": q.question_text,
        "image_path": q.image_path,
        "time_limit": time_limit,
        "preview_time": q.preview_time,
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
    return {
        "event": "question_answering",
        "question_id": q.id,
        "question_type": q.type,
        "time_limit": time_limit,
        "answers": answers,
        "participant_count": participant_count,
    }


def _answer_counts(s: QuizSession, q: QuizQuestion, db: Session) -> dict:
    responses = db.query(QuizResponse).filter_by(session_id=s.id, question_id=q.id).all()
    counts: dict[int, int] = {a.id: 0 for a in q.answers}
    for r in responses:
        for aid in r.chosen_answer_ids:
            if aid in counts:
                counts[aid] += 1
    return counts


def _build_ranking(s: QuizSession, scores: dict, last_delta: dict) -> list:
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
    }


# ---------------------------------------------------------------------------
# Quiz CRUD
# ---------------------------------------------------------------------------

@router.get("/api/capuths", response_model=list[QuizOut])
def list_capuths(db: Session = Depends(get_db)):
    capuths = db.query(Quiz).order_by(Quiz.created_at.desc()).all()
    out = []
    for qz in capuths:
        o = QuizOut.model_validate(qz)
        o.question_count = len(qz.questions)
        out.append(o)
    return out


@router.get("/api/capuths/template")
def download_template():
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
            "'umrechnung' (Zahlenwert tippen, 1 Antwort: 'text' = Zahl + Leerzeichen + Zieleinheit z.B. '30000 cm'). "
            "Umrechnung: Anzeige lautet 'Rechne um: [Frage] = [Eingabefeld] [Einheit]'. Schüler tippen die Zahl, Einheit wird automatisch daneben gezeigt. "
            "--- PUNKTE --- "
            "max_points darf maximal Anzahl_Aufgaben × 2 betragen (Umfragen/sort zählen nicht). "
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
        ],
    })


@router.post("/api/capuths/upload", response_model=QuizOut, status_code=201)
def upload_caputh(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    content = file.file.read()

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

        quiz = _create_caputh_from_parsed(db, quiz_fields, questions)

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
        quiz = _create_caputh_from_parsed(db, quiz_fields, questions)

    o = QuizOut.model_validate(quiz)
    o.question_count = len(quiz.questions)
    o.warning = quiz_fields.get("warning")
    return o


@router.get("/api/capuths/{quiz_id}", response_model=QuizDetailOut)
def get_caputh(quiz_id: int, db: Session = Depends(get_db)):
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
    o = QuizDetailOut.model_validate(caputh)
    o.question_count = len(caputh.questions)
    return o


@router.delete("/api/capuths/{quiz_id}", status_code=204)
def delete_caputh(
    quiz_id: int,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")
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

    # Aggregate per class
    class_data: dict[int, dict] = {}
    for s in sessions:
        if s.points_awarded is None:
            continue
        quiz = quiz_ids[s.quiz_id]
        if quiz.max_points == 0:
            continue
        score_ratio = s.points_awarded / quiz.max_points  # 0–1

        if s.class_id not in class_data:
            class_data[s.class_id] = {"ratios": [], "teacher_counts": {}}
        class_data[s.class_id]["ratios"].append(score_ratio)
        teacher_name = f"{s.teacher.first_name} {s.teacher.last_name}"
        class_data[s.class_id]["teacher_counts"][teacher_name] = (
            class_data[s.class_id]["teacher_counts"].get(teacher_name, 0) + 1
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

@router.post("/api/capuths/{quiz_id}/sessions", response_model=SessionOut, status_code=201)
def create_session(
    quiz_id: int,
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    caputh = db.get(Quiz, quiz_id)
    if not caputh:
        raise HTTPException(404, "Caputh not found")

    existing = db.query(QuizSession).filter_by(quiz_id=quiz_id, class_id=body.class_id).first()
    if existing and existing.points_awarded is not None:
        raise HTTPException(409, "This class has already completed this quiz")
    if existing and existing.status in ("waiting", "active"):
        o = SessionOut.model_validate(existing)
        o.participant_count = len(existing.participants)
        return o

    caputh.max_points = body.max_points
    session = QuizSession(
        quiz_id=quiz_id,
        class_id=body.class_id,
        teacher_id=current.id,
        join_code=_gen_code(db),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    o = SessionOut.model_validate(session)
    o.participant_count = 0
    return o


@router.get("/api/sessions/{code}", response_model=SessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    o = SessionOut.model_validate(s)
    o.participant_count = len(s.participants)
    return o


@router.get("/api/capuths/{quiz_id}/sessions")
def list_caputh_sessions(quiz_id: int, db: Session = Depends(get_db)):
    sessions = db.query(QuizSession).filter_by(quiz_id=quiz_id).all()
    return [
        {
            "join_code": s.join_code,
            "status": s.status,
            "class_id": s.class_id,
            "participant_count": len(s.participants),
            "points_awarded": s.points_awarded,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
        }
        for s in sessions
    ]


@router.post("/api/sessions/{code}/reset", status_code=200)
def reset_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
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
def get_session_report(code: str, fmt: str = "json", db: Session = Depends(get_db)):
    import csv as csv_mod
    import io as io_mod
    from fastapi.responses import StreamingResponse

    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")

    questions = s.quiz.questions
    scored_qs = [q for q in questions if q.type != "survey"]

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
            "correct": correct_count,
            "total_scored": n_scored,
            "percent": round(correct_count / n_scored * 100) if n_scored else None,
            "questions": q_results,
        })

    if fmt == "csv":
        buf = io_mod.StringIO()
        writer = csv_mod.writer(buf)
        header = ["Name", "Richtig", "Gesamt", "%"] + [f"F{i+1}: {q.question_text[:40]}" for i, q in enumerate(questions)]
        writer.writerow(header)
        for r in rows:
            cells = [r["name"], r["correct"], r["total_scored"],
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
        "questions": [{"id": q.id, "text": q.question_text, "type": q.type} for q in questions],
        "participants": rows,
    }


@router.post("/api/sessions/{code}/join", status_code=201)
def join_session(code: str, body: ParticipantJoin, db: Session = Depends(get_db)):
    s = db.query(QuizSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.status == "finished":
        raise HTTPException(409, "Session already finished")
    name = body.name.strip()[:100]
    # Rejoin: return existing participant if same name already registered
    existing = db.query(QuizParticipant).filter_by(session_id=s.id, name=name).first()
    if existing:
        return {"participant_id": existing.id, "name": existing.name, "rejoined": True}
    p = QuizParticipant(session_id=s.id, name=name, avatar=body.avatar[:50])
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"participant_id": p.id, "name": p.name, "rejoined": False}


# ---------------------------------------------------------------------------
# WebSocket — real-time game bus
# ---------------------------------------------------------------------------

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
            await websocket.close(code=4004)
            return

        await websocket.accept()

        if role == "teacher":
            mgr.add_teacher(code, websocket)
            if s.status == "waiting" or code not in _phases:
                await websocket.send_json(_state_msg(s, db))
            else:
                await _resync_teacher(s, db, code, websocket)
        else:
            p = db.get(QuizParticipant, participant_id)
            if not p or p.session_id != s.id:
                await websocket.close(code=4003)
                return
            pid = p.id
            mgr.add_student(code, pid, websocket)
            await websocket.send_json({"event": "joined", "name": p.name, "avatar": p.avatar})
            await _resync_student(s, db, code, pid, websocket)
            await mgr.send_teacher(code, {
                "event": "participant_joined",
                "participant_id": p.id,
                "name": p.name,
                "avatar": p.avatar,
                "count": len(s.participants),
            })

        try:
            while True:
                data = await websocket.receive_json()
                action = data.get("action")

                db.expire_all()
                s = db.query(QuizSession).filter_by(join_code=code).first()

                try:
                    if role == "teacher":
                        await _handle_teacher_action(action, data, s, db, code, websocket)
                    else:
                        await _handle_student_action(action, data, s, db, code, pid)
                except Exception as e:
                    import traceback
                    print(f"ERROR handling action '{action}': {e}")
                    traceback.print_exc()

        except WebSocketDisconnect:
            pass
    finally:
        mgr.remove(code, pid if role == "student" else None)


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
        elif q.type != "survey":
            correct_ids = [a.id for a in q.answers if a.correct]
        else:
            correct_ids = None
        counts = _answer_counts(s, q, db)
        await ws.send_json({
            "event": "reveal",
            "question_id": q.id,
            "correct_answer_ids": correct_ids,
            "answer_counts": counts,
            "score_ratios": {},
            "is_last": s.current_question_idx + 1 >= len(questions),
        })
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
        elif q.type != "survey":
            correct_ids = [a.id for a in q.answers if a.correct]
        else:
            correct_ids = None
        counts = _answer_counts(s, q, db)
        scores = ph.get("scores", {})
        score_ratios = {str(p): round(v, 3) for p, v in scores.items()} if scores else {}
        await ws.send_json(_question_preview_msg(q, s.current_question_idx, len(questions), tl))
        await ws.send_json(_question_answering_msg(q, tl, answer_order=ph.get("answer_order")))
        await ws.send_json({
            "event": "reveal",
            "question_id": q.id,
            "correct_answer_ids": correct_ids,
            "answer_counts": counts,
            "score_ratios": score_ratios,
            "is_last": s.current_question_idx + 1 >= len(questions),
        })
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
        if q.preview_time:
            asyncio.create_task(_auto_show_answers(code, q.preview_time, db))

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
            await mgr.kick_student(code, pid_to_kick)
            p = db.get(QuizParticipant, pid_to_kick)
            if p and p.session_id == s.id:
                db.delete(p)
                db.commit()
            db.expire_all()
            s = db.query(QuizSession).filter_by(join_code=code).first()
            await mgr.send_teacher(code, {
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
                await mgr.send_teacher(code, {"event": "participant_renamed", "participant_id": pid_to_rename, "name": new_name})

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
    """0.0–1.0 score ratio for a response. Multi/sort: partial credit."""
    if q.type == "survey":
        return 0.0
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
    if q.type == "survey":
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

    await mgr.broadcast(code, {
        "event": "reveal",
        "question_id": q.id,
        "correct_answer_ids": correct_ids,
        "answer_counts": counts,
        "score_ratios": score_ratios,
        "is_last": s.current_question_idx + 1 >= len(questions),
    })


async def _do_ranking(s: QuizSession, code: str):
    ph = _phases[code]
    ph["phase"] = "ranking"
    ranking = _build_ranking(s, ph.get("scores", {}), ph.get("last_delta", {}))
    await mgr.broadcast(code, {
        "event": "ranking",
        "ranking": ranking,
        "is_last": s.current_question_idx + 1 >= len(s.quiz.questions),
    })


async def _finish_session(s: QuizSession, db: Session, code: str):
    s.status = "finished"
    s.finished_at = datetime.now(timezone.utc)

    # Only award points once — replays don't re-score
    is_replay = s.points_awarded is not None
    if not is_replay:
        raw_points = _score_session(s)
        class_grade = _extract_class_grade(s.class_.code) if s.class_ else None
        multiplier = _grade_multiplier(class_grade, s.quiz.grades or [])
        points = round(raw_points * multiplier)
        s.points_awarded = points
        if points > 0:
            reason = f"Caputh: {s.quiz.title}"
            if multiplier < 1.0:
                reason += f" (×{multiplier:.0%} Klassenstufen-Faktor)"
            tx = Transaction(
                teacher_id=s.teacher_id,
                class_id=s.class_id,
                points=points,
                reason=reason,
            )
            db.add(tx)
    else:
        points = s.points_awarded

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

    if cur_q.type == "umrechnung":
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
    await mgr.send_teacher(code, {
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
