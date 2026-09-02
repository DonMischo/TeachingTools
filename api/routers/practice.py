"""
Übungsseite — self-paced practice with procedurally generated tasks.

Anyone picks a topic from the generator library (api/task_generators.py),
gets one task at a time at their current difficulty (1-5), and answers it.
Difficulty climbs after 3 correct in a row, drops after 2 wrong in a row.
Every answered task is counted in PracticeProgress (per participant+topic),
so teachers can later see how much a student practiced. A participant is a
Student, a Teacher/admin trying topics out, or a guest who came in through
the QR of an Übung tool session — tracked separately, same pattern as
ExitGameAttempt.

Gäste bringen keinen Cookie mit, sondern den Gast-Token ihrer Sitzung. Er
gilt nur für genau einen Beitritts-Code, deshalb hängt an jedem Aufruf ein
``?code=``: ohne den passenden Code ist der Token wertlos, und angemeldete
Nutzer brauchen ihn gar nicht.

Answers are checked server-side against the accept list stored with the
generated PracticeTask row — the client only ever receives the question.
"""
import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import task_generators
from .generators import generate_from_def
from ..database import get_db
from ..models import (
    PracticeProgress, PracticeTask, Student, Teacher, TaskGeneratorDef, ToolSession,
)
from ..auth import Guest, bearer, get_current_user_optional, guest_from_credentials

router = APIRouter(prefix="/api/practice", tags=["practice"])

STREAK_UP = 3    # correct in a row to level up
STREAK_DOWN = 2  # wrong in a row to level down

Spieler = Teacher | Student | Guest


def _get_player(
    request: Request,
    code: str | None = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db),
) -> Spieler:
    """Üben steht allen offen — Schülern, Lehrkräften und Gästen mit Code.

    Wie ``auth.get_player``, nur dass der Code hier in der Query steht statt im
    Pfad: die Übungs-Routen gehören dem Thema, nicht der Sitzung.
    """
    user = get_current_user_optional(request, credentials, db)
    if user is not None:
        return user
    if code:
        guest = guest_from_credentials(credentials, code, db)
        # Der Code muss auch wirklich zu einer Übungs-Sitzung gehören: ein
        # Gast-Token aus einem anderen Werkzeug ist hier kein Ausweis.
        gehoert_hierher = db.query(ToolSession).filter_by(code=code, tool_slug="uebung").first()
        if guest is not None and gehoert_hierher:
            return guest
    raise HTTPException(401, "Not authenticated")


def _owner_filter(current: Spieler) -> dict:
    if isinstance(current, Student):
        return {"student_id": current.id}
    if isinstance(current, Guest):
        return {"guest_id": current.id}
    return {"teacher_id": current.id}


def _progress(db: Session, current: Spieler, topic: str) -> PracticeProgress:
    p = db.query(PracticeProgress).filter_by(topic=topic, **_owner_filter(current)).first()
    if not p:
        p = PracticeProgress(topic=topic, **_owner_filter(current))
        db.add(p)
        db.flush()
    return p


@router.get("/topics")
def list_topics(db: Session = Depends(get_db), current: Spieler = Depends(_get_player)):
    """Topic list plus the caller's own progress per topic."""
    rows = db.query(PracticeProgress).filter_by(**_owner_filter(current)).all()
    progress_by_topic = {p.topic: p for p in rows}
    def _row(gen_id: str, label: str, subject: str, description: str, grades: list[int]) -> dict:
        p = progress_by_topic.get(gen_id)
        return {
            "id": gen_id, "label": label, "subject": subject, "description": description,
            "grades": grades,
            "progress": {
                "difficulty": p.difficulty, "tasks_done": p.tasks_done,
                "tasks_correct": p.tasks_correct,
            } if p else None,
        }

    out = [_row(g.id, g.label, g.subject, g.description, g.grades) for g in task_generators.REGISTRY.values()]
    out += [
        _row(d.slug, d.label, d.subject, d.description, [])
        for d in db.query(TaskGeneratorDef).order_by(TaskGeneratorDef.label).all()
    ]
    return out


@router.post("/{topic}/task", status_code=201)
def new_task(topic: str, db: Session = Depends(get_db), current: Spieler = Depends(_get_player)):
    custom_def = None
    if topic not in task_generators.REGISTRY:
        custom_def = db.query(TaskGeneratorDef).filter_by(slug=topic).first()
        if not custom_def:
            raise HTTPException(404, "Unbekanntes Thema")
    progress = _progress(db, current, topic)
    generated = (
        generate_from_def(custom_def, progress.difficulty, random.Random())
        if custom_def else
        task_generators.generate_task(topic, progress.difficulty, random.Random())
    )
    task = PracticeTask(
        topic=topic, difficulty=progress.difficulty, **_owner_filter(current),
        question=generated["question"], accept=generated["accept"],
        hint=generated.get("hint"), image_svg=generated.get("image_svg"),
        board=generated.get("board"),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "task_id": task.id, "question": task.question, "difficulty": task.difficulty,
        "hint": task.hint, "image_svg": task.image_svg, "board": task.board,
        "progress": {"difficulty": progress.difficulty, "tasks_done": progress.tasks_done,
                      "tasks_correct": progress.tasks_correct, "streak_correct": progress.streak_correct},
    }


class AnswerIn(BaseModel):
    answer: str


@router.post("/tasks/{task_id}/answer")
def answer_task(task_id: int, body: AnswerIn, db: Session = Depends(get_db), current: Spieler = Depends(_get_player)):
    task = db.get(PracticeTask, task_id)
    owner = _owner_filter(current)
    is_owner = task and all(getattr(task, k) == v for k, v in owner.items())
    if not task or not is_owner:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if task.answered:
        raise HTTPException(409, "Aufgabe wurde bereits beantwortet")

    correct = task_generators.check_input_answer(task.accept, body.answer)
    task.answered = True
    task.correct = correct

    progress = _progress(db, current, task.topic)
    progress.tasks_done += 1
    leveled = None
    if correct:
        progress.tasks_correct += 1
        progress.streak_correct += 1
        progress.streak_wrong = 0
        if progress.streak_correct >= STREAK_UP and progress.difficulty < task_generators.DIFFICULTY_MAX:
            progress.difficulty += 1
            progress.streak_correct = 0
            leveled = "up"
    else:
        progress.streak_wrong += 1
        progress.streak_correct = 0
        if progress.streak_wrong >= STREAK_DOWN and progress.difficulty > task_generators.DIFFICULTY_MIN:
            progress.difficulty -= 1
            progress.streak_wrong = 0
            leveled = "down"
    db.commit()

    return {
        "correct": correct,
        "solution": None if correct else (task.accept[0] if task.accept else None),
        "leveled": leveled,
        "progress": {"difficulty": progress.difficulty, "tasks_done": progress.tasks_done,
                      "tasks_correct": progress.tasks_correct, "streak_correct": progress.streak_correct},
    }
