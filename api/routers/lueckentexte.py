"""
Lückentext — standalone tool for cloze/fill-in-the-blank texts.

Content lives in LueckentextSet (JSON-blob pattern like BingoSet/TimelineSet):
a text template with gaps. The library is open to every teacher; students may
READ a set. Validation and scoring helpers live in api/lueckentext_engine.py.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import LueckentextSet, LueckentextSession, LueckentextParticipant, LueckentextResponse, LueckentextErrorPattern, Teacher
from ..auth import get_current_teacher, get_current_user
from ..availability import require_capability
from ..authorship import author_fields, scope_to_student_pool, can_modify
from ..lueckentext_engine import validate_set_payload, sanitized_board, fuzzy_match, reveal_state, normalize_name
from ..lueckentext_export import export_pdf
from ..utils import gen_code
from ..ws_manager import RoomManager
from ..ws_auth import ws_teacher

router = APIRouter(prefix="/api/lueckentexte", tags=["lueckentexte"])

_mgr = RoomManager()


class LueckentextSetOut(BaseModel):
    id: int
    title: str
    description: str | None
    tags: list
    grades: list
    gap_count: int
    created_by: int | None
    created_by_student: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LueckentextSetDetail(LueckentextSetOut):
    text: str
    gaps: list
    distractors: list


def _to_out(s: LueckentextSet) -> LueckentextSetOut:
    return LueckentextSetOut(
        id=s.id, title=s.title, description=s.description, tags=s.tags,
        grades=s.grades, gap_count=len(s.gaps), created_by=s.created_by,
        created_by_student=s.created_by_student, created_at=s.created_at,
    )


def _to_detail(s: LueckentextSet) -> LueckentextSetDetail:
    return LueckentextSetDetail(**_to_out(s).model_dump(), text=s.text, gaps=s.gaps, distractors=s.distractors)


def _build_set(data: dict, current) -> LueckentextSet:
    errors = validate_set_payload(data)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Lückentext-Format", "errors": errors})
    return LueckentextSet(
        title=data["title"].strip(),
        description=data.get("description"),
        tags=[str(t) for t in data.get("tags") or []],
        grades=[g for g in data.get("grades") or [] if isinstance(g, int)],
        text=data["text"],
        gaps=data.get("gaps") or [],
        distractors=[str(d) for d in data.get("distractors") or []],
        **author_fields(current),
    )


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------

@router.get("", response_model=list[LueckentextSetOut])
def list_sets(db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = scope_to_student_pool(db.query(LueckentextSet), LueckentextSet, current)
    sets = q.order_by(LueckentextSet.created_at.desc()).all()
    return [_to_out(s) for s in sets]


@router.post("", response_model=LueckentextSetDetail, status_code=201, dependencies=[Depends(require_capability("lueckentext", "create"))])
def create_set(data: dict, db: Session = Depends(get_db), current=Depends(get_current_user)):
    s = _build_set(data, current)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_detail(s)


@router.post("/upload", response_model=LueckentextSetDetail, status_code=201, dependencies=[Depends(require_capability("lueckentext", "upload"))])
def upload_set(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    try:
        raw = json.loads(file.file.read())
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Ungültiges JSON: {e}")
    s = _build_set(raw, current)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_detail(s)


@router.get("/template")
def download_template(_: Teacher = Depends(get_current_teacher)):
    return {
        "_ai_instructions": (
            "Erstelle einen Lückentext-Datensatz im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- title, text, gaps. "
            "--- TEXT --- text: der Lückentext als Fließtext mit Platzhaltern der Form "
            "'{{gap_id}}' — für jede id in gaps muss genau ein Platzhalter im Text vorkommen, "
            "und es dürfen keine Platzhalter auf unbekannte ids verweisen. "
            "--- LÜCKEN (gaps) --- [{id (eindeutig), answer (die richtige Lösung), "
            "type ('word_bank' — Antwort kommt aus einer Wortliste, die dem Schüler angezeigt "
            "wird; 'free_type' — Schüler tippt die Antwort frei ein, Tippfehler werden großzügig "
            "verziehen; 'multiple_choice' — Schüler wählt aus 2-4 Optionen), "
            "difficulty ('easy'|'medium'|'hard', Standard 'medium'), hint? (optionaler Tipp-Text), "
            "choices? (nur bei type 'multiple_choice': Liste aus 2-4 eindeutigen Texten, die die "
            "richtige 'answer' enthalten muss)}]. "
            "--- DISTRACTORS --- distractors: optionale Liste zusätzlicher Wörter für die Wortliste "
            "der 'word_bank'-Lücken, die selbst nie eine richtige Antwort sind (erschweren die Auswahl). "
            "--- REGELN --- ids eindeutig, deutsche Formulierungen, keine Lösungshinweise außerhalb von 'hint'."
        ),
        "title": "Der Wasserkreislauf",
        "description": "Grundbegriffe des Wasserkreislaufs.",
        "tags": ["erdkunde", "wasser"],
        "grades": [5, 6],
        "text": (
            "Die Sonne erwärmt das Wasser in Seen und Meeren, dabei entsteht {{verdunstung}}. "
            "Der Wasserdampf steigt auf und kühlt ab, es bildet sich eine {{wolke}}. "
            "Wenn die Tropfen zu schwer werden, fallen sie als {{niederschlag}} zurück auf die Erde."
        ),
        "gaps": [
            {"id": "verdunstung", "answer": "Verdunstung", "type": "word_bank", "difficulty": "easy", "hint": None, "choices": None},
            {"id": "wolke", "answer": "Wolke", "type": "free_type", "difficulty": "medium", "hint": "Sammelt sich am Himmel", "choices": None},
            {"id": "niederschlag", "answer": "Niederschlag", "type": "multiple_choice", "difficulty": "hard", "hint": None, "choices": ["Niederschlag", "Verdunstung", "Gezeiten"]},
        ],
        "distractors": ["Gezeiten"],
    }


# ---------------------------------------------------------------------------
# Single set
# ---------------------------------------------------------------------------

@router.get("/{set_id}", response_model=LueckentextSetDetail)
def get_set(set_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Read access for every logged-in user — students open the viewer when a
    teacher shares/launches a set."""
    s = db.get(LueckentextSet, set_id)
    if not s:
        raise HTTPException(404, "Lückentext nicht gefunden")
    return _to_detail(s)


@router.put("/{set_id}", response_model=LueckentextSetDetail)
def update_set(set_id: int, data: dict, db: Session = Depends(get_db), current=Depends(get_current_user)):
    s = db.get(LueckentextSet, set_id)
    if not s:
        raise HTTPException(404, "Lückentext nicht gefunden")
    if not can_modify(s, current):
        raise HTTPException(403)
    errors = validate_set_payload(data)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Lückentext-Format", "errors": errors})
    s.title = data["title"].strip()
    s.description = data.get("description")
    s.tags = [str(t) for t in data.get("tags") or []]
    s.grades = [g for g in data.get("grades") or [] if isinstance(g, int)]
    s.text = data["text"]
    s.gaps = data.get("gaps") or []
    s.distractors = [str(d) for d in data.get("distractors") or []]
    db.commit()
    db.refresh(s)
    return _to_detail(s)


@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    s = db.get(LueckentextSet, set_id)
    if not s:
        raise HTTPException(404, "Lückentext nicht gefunden")
    if not can_modify(s, current):
        raise HTTPException(403)
    db.delete(s)
    db.commit()


# ---------------------------------------------------------------------------
# Sessions (live play)
# ---------------------------------------------------------------------------

class SessionOut(BaseModel):
    id: int
    join_code: str
    status: str
    lueckentext_id: int
    lueckentext_title: str

    model_config = {"from_attributes": True}


class ParticipantOut(BaseModel):
    id: int
    name: str
    avatar: str

    model_config = {"from_attributes": True}


class JoinIn(BaseModel):
    name: str
    avatar: str = "cat"


class AttemptIn(BaseModel):
    participant_id: int
    text: str


class AttemptResult(BaseModel):
    match: str
    revealed: bool
    hint: str | None
    attempts: int
    solved: bool


def _session_out(s: LueckentextSession) -> SessionOut:
    return SessionOut(
        id=s.id, join_code=s.join_code, status=s.status,
        lueckentext_id=s.lueckentext_id, lueckentext_title=s.lueckentext.title,
    )


def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes for server_default=func.now(); Postgres
    returns aware ones for DateTime(timezone=True). Normalize to aware UTC
    before subtracting so this works under both test (SQLite) and prod."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _get_session_or_404(code: str, db: Session) -> LueckentextSession:
    s = db.query(LueckentextSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Sitzung nicht gefunden")
    return s


@router.post("/{set_id}/sessions", response_model=SessionOut, status_code=201, dependencies=[Depends(require_capability("lueckentext", "host"))])
def create_session(set_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    lt = db.get(LueckentextSet, set_id)
    if not lt:
        raise HTTPException(404, "Lückentext nicht gefunden")
    s = LueckentextSession(
        lueckentext_id=set_id,
        teacher_id=current.id,
        join_code=gen_code(db, LueckentextSession, "join_code", length=8),
        status="waiting",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _session_out(s)


@router.post("/sessions/{code}/join", response_model=ParticipantOut, status_code=201)
def join_session(code: str, data: JoinIn, db: Session = Depends(get_db)):
    s = _get_session_or_404(code, db)
    p = LueckentextParticipant(session_id=s.id, name=data.name, avatar=data.avatar)
    db.add(p)
    db.commit()
    db.refresh(p)
    return ParticipantOut.model_validate(p)


@router.get("/sessions/{code}/state")
def session_state(code: str, db: Session = Depends(get_db)):
    s = _get_session_or_404(code, db)
    return {
        "status": s.status,
        "join_code": s.join_code,
        "lueckentext_id": s.lueckentext_id,
        "board": sanitized_board(s.lueckentext) if s.status != "waiting" else None,
    }


@router.post("/sessions/{code}/start", response_model=SessionOut)
def start_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = _get_session_or_404(code, db)
    if s.teacher_id != current.id:
        raise HTTPException(403)
    s.status = "active"
    s.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return _session_out(s)


def _build_ranking(s: LueckentextSession, db: Session) -> list[dict]:
    gap_ids = [g["id"] for g in s.lueckentext.gaps]
    n_gaps = len(gap_ids)
    participants = s.participants

    raw_scores: dict[int, float] = {}
    finish_times: dict[int, datetime] = {}
    for p in participants:
        responses = db.query(LueckentextResponse).filter_by(participant_id=p.id).all()
        raw = sum(1.0 for r in responses if r.match == "exact") + sum(0.5 for r in responses if r.match == "near")
        raw_scores[p.id] = raw
        solved = {r.gap_id: r.solved_at for r in responses if r.solved_at is not None}
        if n_gaps > 0 and all(gid in solved for gid in gap_ids):
            finish_times[p.id] = max(_aware(t) for t in solved.values())

    n_players = max(len(participants), 1)
    max_bonus = round(n_players * 0.1, 2)
    finished_sorted = sorted(finish_times.keys(), key=lambda pid: finish_times[pid])
    n_finished = len(finished_sorted)

    bonuses: dict[int, float] = {}
    for i, pid in enumerate(finished_sorted):
        if n_finished == 1:
            bonuses[pid] = max_bonus
        else:
            t = i / (n_finished - 1)
            bonuses[pid] = round(max_bonus + t * (0.01 - max_bonus), 2)

    entries = []
    for p in participants:
        bonus = bonuses.get(p.id, 0)
        score = round(raw_scores.get(p.id, 0.0) * (1 + bonus), 2)
        entries.append({"pid": p.id, "name": p.name, "avatar": p.avatar, "score": score})

    entries.sort(key=lambda e: (-e["score"], e["pid"]))
    for i, e in enumerate(entries, start=1):
        e["rank"] = i
    return entries


@router.websocket("/sessions/{code}/ws")
async def session_ws(code: str, websocket: WebSocket, db: Session = Depends(get_db)):
    s = db.query(LueckentextSession).filter_by(join_code=code).first()
    if not s:
        await websocket.accept()
        await websocket.close(code=4004)
        return
    if ws_teacher(websocket, db) is None:
        await websocket.accept()
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _mgr.add_teacher(code, websocket)
    await websocket.send_json({"event": "ranking", "ranking": _build_ranking(s, db)})

    try:
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        pass
    finally:
        _mgr.remove_teacher(code, websocket)


@router.post("/sessions/{code}/gaps/{gap_id}/attempt", response_model=AttemptResult)
async def submit_attempt(code: str, gap_id: str, data: AttemptIn, db: Session = Depends(get_db)):
    s = _get_session_or_404(code, db)
    p = db.get(LueckentextParticipant, data.participant_id)
    if not p:
        raise HTTPException(404, "Teilnehmer nicht gefunden")
    if p.session_id != s.id:
        raise HTTPException(403)
    gap = next((g for g in s.lueckentext.gaps if g["id"] == gap_id), None)
    if not gap:
        raise HTTPException(404, "Lücke nicht gefunden")

    response = db.query(LueckentextResponse).filter_by(participant_id=p.id, gap_id=gap_id).first()
    if not response:
        response = LueckentextResponse(session_id=s.id, participant_id=p.id, gap_id=gap_id)
        db.add(response)
        db.flush()

    now = datetime.now(timezone.utc)
    last_progress = response.last_attempt_at or response.first_attempt_at or s.started_at
    seconds_since_progress = max(0.0, (now - _aware(last_progress)).total_seconds()) if last_progress else 0.0

    match = fuzzy_match(data.text, gap["answer"])
    response.attempts += 1
    response.given_text = data.text
    response.match = match
    if response.first_attempt_at is None:
        response.first_attempt_at = now
    response.last_attempt_at = now
    if match in ("exact", "near") and response.solved_at is None:
        response.solved_at = now

    normalized = normalize_name(p.name)
    pattern = db.query(LueckentextErrorPattern).filter_by(
        lueckentext_id=s.lueckentext_id, normalized_name=normalized, gap_id=gap_id
    ).first()

    state = reveal_state(gap.get("difficulty", "medium"), seconds_since_progress, response.attempts,
                          miss_count=pattern.miss_count if pattern else 0)
    if state.get("reveal"):
        response.revealed = True
    if state.get("hint") and not response.hint_shown:
        response.hint_shown = True
        response.hints_used += 1

    if match == "wrong":
        if pattern is None:
            pattern = LueckentextErrorPattern(
                lueckentext_id=s.lueckentext_id, normalized_name=normalized, gap_id=gap_id, miss_count=0,
            )
        pattern.miss_count += 1
        pattern.last_seen = datetime.now(timezone.utc)
        db.add(pattern)

    db.commit()
    await _mgr.send_teachers(code, {"event": "ranking", "ranking": _build_ranking(s, db)})
    return AttemptResult(
        match=match,
        revealed=response.revealed,
        hint=gap.get("hint") if response.hint_shown else None,
        attempts=response.attempts,
        solved=response.solved_at is not None,
    )


@router.get("/sessions/{code}/review")
def session_review(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = _get_session_or_404(code, db)
    if s.teacher_id != current.id:
        raise HTTPException(403)

    out = []
    for p in s.participants:
        responses = {r.gap_id: r for r in db.query(LueckentextResponse).filter_by(participant_id=p.id).all()}
        gaps = []
        for gap in s.lueckentext.gaps:
            r = responses.get(gap["id"])
            if r is None:
                gaps.append({
                    "gap_id": gap["id"], "attempts": 0, "hints_used": 0, "revealed": False,
                    "match": None, "solved": False, "time_spent_seconds": None,
                })
                continue
            time_spent = None
            if r.solved_at is not None and r.first_attempt_at is not None:
                time_spent = (_aware(r.solved_at) - _aware(r.first_attempt_at)).total_seconds()
            gaps.append({
                "gap_id": gap["id"], "attempts": r.attempts, "hints_used": r.hints_used,
                "revealed": r.revealed, "match": r.match, "solved": r.solved_at is not None,
                "time_spent_seconds": time_spent,
            })
        out.append({"pid": p.id, "name": p.name, "avatar": p.avatar, "gaps": gaps})
    return out


@router.post("/sessions/{code}/finish", response_model=SessionOut)
def finish_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = _get_session_or_404(code, db)
    if s.teacher_id != current.id:
        raise HTTPException(403)
    s.status = "finished"
    s.finished_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return _session_out(s)


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

@router.get("/{set_id}/export.pdf")
def export_set_pdf(set_id: int, filled: int = 0, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.get(LueckentextSet, set_id)
    if not s:
        raise HTTPException(404, "Lückentext nicht gefunden")
    pdf_path = export_pdf(s, filled=bool(filled))
    if pdf_path is None:
        raise HTTPException(503, "PDF-Export momentan nicht verfügbar")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{s.title}.pdf")


@router.get("/sessions/{code}/participants/{pid}/export.pdf")
def export_participant_pdf(code: str, pid: int, db: Session = Depends(get_db)):
    s = _get_session_or_404(code, db)
    p = db.get(LueckentextParticipant, pid)
    if not p or p.session_id != s.id:
        raise HTTPException(404, "Teilnehmer nicht gefunden")
    responses = db.query(LueckentextResponse).filter_by(participant_id=p.id).all()
    given_answers = {r.gap_id: r.given_text for r in responses if r.given_text}
    pdf_path = export_pdf(s.lueckentext, filled=True, given_answers=given_answers)
    if pdf_path is None:
        raise HTTPException(503, "PDF-Export momentan nicht verfügbar")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{s.lueckentext.title}_{p.name}.pdf")
