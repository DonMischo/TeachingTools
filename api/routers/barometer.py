"""
Umfrage (früher "Meinungsbarometer") — live scale-question sessions.

Flow:
  1. Teacher POST /api/barometer  → session with questions, gets code
  2. Students scan QR → GET /api/barometer/{code} to verify, then connect WS
  3. WS /api/barometer/{code}/ws?role=teacher|student (identity from session cookie)
  4. Teacher sends: show_question / show_results / next / close
  5. Students send: respond {question_id, value} (live) or submit {answers} (self)
"""
import json
import math
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BarometerSession, BarometerQuestion, BarometerResponse, Student, Teacher
from ..auth import get_current_teacher, get_current_user_optional
from ..availability import require_capability
from ..utils import gen_code
from ..ws_auth import ws_identity, ws_guest
from ..ws_manager import RoomManager, receive_json, reject

router = APIRouter(prefix="/api/barometer", tags=["barometer"])

mgr = RoomManager()

KINDS = ("scale", "choice", "multi", "text", "number")
MODES = ("live", "self")
CHARTS = {
    "scale": ("saeulen", "balken", "donut", "gestapelt", "flaeche"),
    "choice": ("balken", "saeulen", "donut", "kreis", "gestapelt"),
    "multi": ("balken", "saeulen"),
    "number": ("histogramm", "kennzahlen"),
    "text": ("liste", "wortwolke"),
}
BLOCK_CHARTS = ("likert", "mittelwerte")   # the ONLY valid charts for block members
SCALE_STYLES = ("zahlen", "smileys_auf", "smileys_ab")
MAX_SMILEY_STEPS = 7
MAX_BLOCK_ID_LEN = 20
MAX_INTRO_LEN = 500
MAX_UNIT_LEN = 20
MAX_OPTIONS = 20
MAX_OPTION_LEN = 100
MAX_TEXT_ANSWER = 1000
MAX_SCALE_STEPS = 12   # the student view renders one button per step


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _slides(s: BarometerSession) -> list[list[BarometerQuestion]]:
    """Group the ordered questions into slides — a new slide starts at every
    question with same_slide == False (the first question always is one,
    normalised by `_question_rows`)."""
    slides: list[list[BarometerQuestion]] = []
    for q in s.questions:
        if not q.same_slide or not slides:
            slides.append([])
        slides[-1].append(q)
    return slides


def _question_dict(q: BarometerQuestion) -> dict:
    show_if = None
    if q.show_if:
        parent_idx = q.show_if["question"]
        parent = q.session.questions[parent_idx]
        show_if = {"question": parent_idx, "options": q.show_if["options"], "parent_id": parent.id}
    return {
        "id": q.id,
        "text": q.text,
        "kind": q.kind,
        "options": q.options,
        "scale_min": q.scale_min,
        "scale_max": q.scale_max,
        "scale_min_label": q.scale_min_label,
        "scale_max_label": q.scale_max_label,
        "chart": q.chart,
        "same_slide": q.same_slide,
        "block": q.block,
        "intro": q.intro,
        "scale_style": q.scale_style,
        "max_choices": q.max_choices,
        "num_min": q.num_min,
        "num_max": q.num_max,
        "unit": q.unit,
        "show_if": show_if,
    }


def _num_key(n: float):
    return int(n) if float(n).is_integer() else n


def _distribution(session: BarometerSession, q: BarometerQuestion) -> dict:
    if q.kind == "text":
        return {}
    if q.kind == "multi":
        mdist: dict[int, int] = defaultdict(int)
        for r in session.responses:
            if r.question_id == q.id and r.choices:
                for c in r.choices:
                    if 0 <= c < len(q.options):
                        mdist[c] += 1
        return dict(mdist)
    if q.kind == "number":
        ndist: dict = defaultdict(int)
        for r in session.responses:
            if r.question_id == q.id and r.number is not None:
                ndist[_num_key(r.number)] += 1
        return dict(ndist)
    dist: dict[int, int] = defaultdict(int)
    for r in session.responses:
        if r.question_id == q.id and r.value is not None:
            dist[r.value] += 1
    return dict(dist)


def _question_results(session: BarometerSession, q: BarometerQuestion, include_texts: bool) -> dict:
    if q.kind == "text":
        texts = [r.text for r in sorted(
            (r for r in session.responses if r.question_id == q.id and r.text and r.text.strip()),
            key=lambda r: (r.answered_at, r.id),
        )]
        result: dict = {"distribution": {}, "count": len(texts)}
        if include_texts:
            result["texts"] = texts
        return result
    dist = _distribution(session, q)
    if q.kind == "multi":
        count = sum(1 for r in session.responses if r.question_id == q.id and r.choices)
    elif q.kind == "number":
        count = sum(1 for r in session.responses if r.question_id == q.id and r.number is not None)
    else:
        count = sum(dist.values())
    return {"distribution": dist, "count": count}


def _my_answers(session: BarometerSession, student_id: int, guest_id: str | None) -> dict:
    out: dict = {}
    for r in session.responses:
        if guest_id:
            if r.guest_id != guest_id:
                continue
        else:
            if r.guest_id is not None or r.student_id != (student_id or None):
                continue
        q = next((qq for qq in session.questions if qq.id == r.question_id), None)
        kind = q.kind if q else None
        if kind == "multi":
            out[str(r.question_id)] = r.choices
        elif kind == "number":
            out[str(r.question_id)] = _num_key(r.number) if r.number is not None else None
        else:
            out[str(r.question_id)] = r.value if r.text is None else r.text
    return out


def _get_response(db: Session, s: BarometerSession, q: BarometerQuestion, student_id: int,
                   guest_id: str | None) -> BarometerResponse | None:
    """Same upsert key as the vote today: guest_id for guests, else student_id."""
    if guest_id:
        return db.query(BarometerResponse).filter_by(
            session_id=s.id, question_id=q.id, guest_id=guest_id
        ).first()
    return db.query(BarometerResponse).filter_by(
        session_id=s.id, question_id=q.id, student_id=student_id or None, guest_id=None
    ).first()


def _condition_met(db: Session, s: BarometerSession, q: BarometerQuestion, student_id: int,
                    guest_id: str | None) -> bool:
    """Whether this player's saved answer to q's parent question satisfies q.show_if."""
    if not q.show_if:
        return True
    parent = s.questions[q.show_if["question"]]
    options = q.show_if["options"]
    parent_resp = _get_response(db, s, parent, student_id, guest_id)
    if not parent_resp:
        return False
    if parent.kind == "choice":
        return parent_resp.value in options
    if parent.kind == "multi":
        return bool(parent_resp.choices) and any(c in options for c in parent_resp.choices)
    return False


def _save_answer(db: Session, s: BarometerSession, q: BarometerQuestion, student_id: int,
                  guest_id: str | None, answer: dict) -> dict | None:
    """Validate + upsert one answer (`answer` carries value/text/choices).
    Returns the ack fields, or None when the answer is invalid or its
    show_if condition isn't met — in which case nothing is saved."""
    if not _condition_met(db, s, q, student_id, guest_id):
        return None

    save_value = save_text = save_number = save_choices = None
    if q.kind == "scale":
        value = answer.get("value")
        if not isinstance(value, int) or isinstance(value, bool):
            return None
        v = max(q.scale_min, min(q.scale_max, value))
        save_value, ack = v, {"value": v}
    elif q.kind == "choice":
        value = answer.get("value")
        if not isinstance(value, int) or isinstance(value, bool):
            return None
        if not (0 <= value < len(q.options)):
            return None
        save_value, ack = value, {"value": value}
    elif q.kind == "multi":
        choices = answer.get("choices")
        if not isinstance(choices, list) or not choices:
            return None
        if any(not isinstance(c, int) or isinstance(c, bool) for c in choices):
            return None
        if len(set(choices)) != len(choices) or any(not (0 <= c < len(q.options)) for c in choices):
            return None
        limit = q.max_choices or len(q.options)
        if not (1 <= len(choices) <= limit):
            return None
        save_choices = sorted(choices)
        ack = {"choices": save_choices}
    elif q.kind == "number":
        value = answer.get("value")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return None
        if not math.isfinite(value):
            return None
        if q.num_min is not None and value < q.num_min:
            return None
        if q.num_max is not None and value > q.num_max:
            return None
        save_number = value
        ack = {"value": _num_key(value)}
    elif q.kind == "text":
        text = answer.get("text")
        if not isinstance(text, str):
            return None
        t = text.strip()[:MAX_TEXT_ANSWER]
        if not t:
            return None
        save_text, ack = t, {"text": t}
    else:
        return None

    existing = _get_response(db, s, q, student_id, guest_id)
    if existing:
        existing.value = save_value
        existing.text = save_text
        existing.number = save_number
        existing.choices = save_choices
    else:
        db.add(BarometerResponse(
            session_id=s.id,
            question_id=q.id,
            student_id=student_id or None,
            guest_id=guest_id,
            value=save_value,
            text=save_text,
            number=save_number,
            choices=save_choices,
        ))
    db.flush()
    return ack


def _prune_followups(db: Session, s: BarometerSession, student_id: int, guest_id: str | None) -> list[int]:
    """Delete this player's response to any question whose show_if is no
    longer satisfied, walking questions in order so chains cascade."""
    responses = {q.id: _get_response(db, s, q, student_id, guest_id) for q in s.questions}
    deleted: list[int] = []
    for q in s.questions:
        if not q.show_if:
            continue
        r = responses.get(q.id)
        if not r:
            continue
        parent = s.questions[q.show_if["question"]]
        parent_r = responses.get(parent.id)
        options = q.show_if["options"]
        ok = False
        if parent_r:
            if parent.kind == "choice":
                ok = parent_r.value in options
            elif parent.kind == "multi":
                ok = bool(parent_r.choices) and any(c in options for c in parent_r.choices)
        if not ok:
            db.delete(r)
            responses[q.id] = None
            deleted.append(q.id)
    db.flush()
    return deleted


def _state_msg(session: BarometerSession) -> dict:
    slides = _slides(session)
    current_slide = session.current_question_idx
    total_slides = len(slides)
    base: dict = {
        "event": "state",
        "status": session.status,
        "mode": session.mode,
        "results_visible": session.results_visible,
        "current_slide": current_slide,
        "total_slides": total_slides,
    }
    if 0 <= current_slide < total_slides:
        base["slide"] = [_question_dict(q) for q in slides[current_slide]]
    if session.mode == "self":
        base["questions"] = [_question_dict(q) for q in session.questions]
    return base


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class QuestionIn(BaseModel):
    text: str
    kind: str = "scale"
    options: list[str] = []
    chart: str | None = None
    scale_min: int = 1
    scale_max: int = 6
    scale_min_label: str | None = None
    scale_max_label: str | None = None
    same_slide: bool = False
    block: str | None = None
    intro: str | None = None
    show_if: dict | None = None
    scale_style: str = "zahlen"
    max_choices: int | None = None
    num_min: float | None = None
    num_max: float | None = None
    unit: str | None = None


class SessionCreate(BaseModel):
    title: str
    questions: list[QuestionIn]
    shared: bool = False
    mode: str = "live"


class QuestionOut(BaseModel):
    id: int
    order: int
    text: str
    kind: str
    options: list[str]
    chart: str | None
    analysis: dict | None
    scale_min: int
    scale_max: int
    scale_min_label: str | None
    scale_max_label: str | None
    same_slide: bool
    block: str | None
    intro: str | None
    show_if: dict | None
    scale_style: str
    max_choices: int | None
    num_min: float | None
    num_max: float | None
    unit: str | None

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    code: str
    title: str
    status: str
    mode: str
    results_public: bool
    current_question_idx: int
    results_visible: bool
    shared: bool
    questions: list[QuestionOut]

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    id: int
    code: str
    title: str
    status: str
    question_count: int
    created_at: datetime
    shared: bool
    created_by: int
    created_by_name: str

    model_config = {"from_attributes": True}


class ChartIn(BaseModel):
    chart: str | None = None


class ResultsPublicIn(BaseModel):
    public: bool


# ---------------------------------------------------------------------------
# Validation — shared by create/update/upload
# ---------------------------------------------------------------------------

def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _validate_umfrage(data) -> list[str]:
    """Hand-rolled, German error list — same shape as the Caputh/Exitgame/
    Lückentext upload validators, so the frontend can show them all at once."""
    if not isinstance(data, dict):
        return ["Die Datei muss ein JSON-Objekt sein"]
    errors: list[str] = []
    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        errors.append("Pflichtfeld fehlt: 'title' (Titel der Umfrage)")

    mode = data.get("mode")
    if mode is not None and mode not in MODES:
        errors.append("'mode' muss 'live' oder 'self' sein")

    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        errors.append("'questions' muss eine nicht-leere Liste sein")
        return errors

    block_last_idx: dict[str, int] = {}
    block_first_q: dict[str, dict] = {}

    for i, q in enumerate(questions):
        where = f"questions[{i}]"
        if not isinstance(q, dict):
            errors.append(f"{where}: muss ein Objekt sein")
            continue
        if not isinstance(q.get("text"), str) or not q["text"].strip():
            errors.append(f"{where}: 'text' (die Frage bzw. Aussage) fehlt")

        kind = q.get("kind", "scale")
        if kind not in KINDS:
            errors.append(f"{where}: 'kind' muss 'scale', 'choice', 'multi', 'text' oder 'number' sein")
            continue

        opts = None
        if kind in ("choice", "multi"):
            opts = q.get("options")
            if not isinstance(opts, list) or not (2 <= len(opts) <= MAX_OPTIONS):
                errors.append(f"{where}.options: muss eine Liste mit 2 bis {MAX_OPTIONS} Einträgen sein")
                opts = None
            else:
                seen: set[str] = set()
                for opt in opts:
                    if not isinstance(opt, str) or not opt.strip():
                        errors.append(f"{where}.options: Einträge dürfen nicht leer sein")
                        continue
                    if len(opt) > MAX_OPTION_LEN:
                        errors.append(f"{where}.options: '{opt}' ist länger als {MAX_OPTION_LEN} Zeichen")
                        continue
                    key = opt.strip().lower()
                    if key in seen:
                        errors.append(f"{where}.options: doppelter Eintrag '{opt}'")
                    seen.add(key)

        if kind == "multi":
            max_choices = q.get("max_choices")
            n_opts = len(opts) if isinstance(opts, list) else None
            if max_choices is not None:
                if not isinstance(max_choices, int) or isinstance(max_choices, bool) or \
                        n_opts is None or not (1 <= max_choices <= n_opts):
                    errors.append(f"{where}.max_choices: muss eine ganze Zahl zwischen 1 und der Anzahl Optionen sein")

        if kind == "number":
            num_min, num_max = q.get("num_min"), q.get("num_max")
            if num_min is not None and not _is_num(num_min):
                errors.append(f"{where}.num_min: muss eine Zahl sein")
            elif num_max is not None and not _is_num(num_max):
                errors.append(f"{where}.num_min: muss eine Zahl sein")
            elif num_min is not None and num_max is not None and num_min >= num_max:
                errors.append(f"{where}.num_min: 'num_min' ({num_min}) muss kleiner als 'num_max' ({num_max}) sein")
            unit = q.get("unit")
            if unit is not None and (not isinstance(unit, str) or len(unit) > MAX_UNIT_LEN):
                errors.append(f"{where}.unit: darf höchstens {MAX_UNIT_LEN} Zeichen haben")

        lo = hi = None
        if kind == "scale":
            lo, hi = q.get("scale_min", 1), q.get("scale_max", 6)
            if not isinstance(lo, int) or isinstance(lo, bool) or not isinstance(hi, int) or isinstance(hi, bool):
                errors.append(f"{where}: 'scale_min' und 'scale_max' müssen ganze Zahlen sein")
                lo = hi = None
            else:
                if lo >= hi:
                    errors.append(f"{where}: 'scale_min' ({lo}) muss kleiner als 'scale_max' ({hi}) sein")
                elif hi - lo + 1 > MAX_SCALE_STEPS:
                    errors.append(f"{where}: die Skala hat {hi - lo + 1} Stufen — höchstens {MAX_SCALE_STEPS} sind sinnvoll darstellbar")
            for key in ("scale_min_label", "scale_max_label"):
                if q.get(key) is not None and not isinstance(q[key], str):
                    errors.append(f"{where}.{key}: muss ein Text sein")
            scale_style = q.get("scale_style", "zahlen")
            if scale_style not in SCALE_STYLES:
                errors.append(f"{where}.scale_style: muss 'zahlen', 'smileys_auf' oder 'smileys_ab' sein")
            elif scale_style in ("smileys_auf", "smileys_ab") and lo is not None and hi is not None \
                    and hi - lo + 1 > MAX_SMILEY_STEPS:
                errors.append(f"{where}.scale_style: Smileys gehen höchstens bis 7 Stufen")

        intro = q.get("intro")
        if intro is not None and (not isinstance(intro, str) or len(intro) > MAX_INTRO_LEN):
            errors.append(f"{where}.intro: darf höchstens {MAX_INTRO_LEN} Zeichen haben")

        block = q.get("block")
        if block is not None:
            if not isinstance(block, str) or not block.strip() or len(block) > MAX_BLOCK_ID_LEN:
                errors.append(f"{where}.block: muss ein nicht-leerer Text mit höchstens {MAX_BLOCK_ID_LEN} Zeichen sein")
            else:
                if block in block_last_idx and block_last_idx[block] != i - 1:
                    errors.append(f"{where}.block: '{block}' muss zusammenhängend sein")
                if kind != "scale":
                    errors.append(f"{where}.block: nur Skalenfragen können Teil eines Aussagen-Blocks sein")
                if block not in block_first_q:
                    block_first_q[block] = q
                else:
                    first_q = block_first_q[block]
                    if (q.get("scale_min", 1) != first_q.get("scale_min", 1) or
                            q.get("scale_max", 6) != first_q.get("scale_max", 6) or
                            q.get("scale_min_label") != first_q.get("scale_min_label") or
                            q.get("scale_max_label") != first_q.get("scale_max_label") or
                            q.get("scale_style", "zahlen") != first_q.get("scale_style", "zahlen")):
                        errors.append(f"{where}.block: gleiche Skala wie die erste Aussage nötig")
                block_last_idx[block] = i

        chart = q.get("chart")
        is_block_member = isinstance(block, str) and bool(block.strip())
        allowed_charts = BLOCK_CHARTS if is_block_member else CHARTS.get(kind, ())
        if chart is not None and chart not in allowed_charts:
            errors.append(f"{where}.chart: '{chart}' passt nicht zu '{kind}' — erlaubt: {', '.join(allowed_charts)}")

        show_if = q.get("show_if")
        if show_if is not None:
            if not isinstance(show_if, dict):
                errors.append(f"{where}.show_if: muss ein Objekt sein")
            else:
                pq_idx = show_if.get("question")
                opts_idx = show_if.get("options")
                if not isinstance(pq_idx, int) or isinstance(pq_idx, bool) or not (0 <= pq_idx < i):
                    errors.append(f"{where}.show_if: 'question' muss der Index einer früheren Frage sein")
                else:
                    parent_q = questions[pq_idx] if isinstance(questions[pq_idx], dict) else {}
                    parent_kind = parent_q.get("kind", "scale")
                    if parent_kind not in ("choice", "multi"):
                        errors.append(f"{where}.show_if: die Elternfrage muss vom Typ 'choice' oder 'multi' sein")
                    else:
                        parent_opts = parent_q.get("options")
                        n_parent_opts = len(parent_opts) if isinstance(parent_opts, list) else 0
                        if not isinstance(opts_idx, list) or not opts_idx:
                            errors.append(f"{where}.show_if: 'options' muss eine nicht-leere Liste sein")
                        else:
                            seen_o: set = set()
                            bad = False
                            for o in opts_idx:
                                if not isinstance(o, int) or isinstance(o, bool) or o in seen_o or not (0 <= o < n_parent_opts):
                                    bad = True
                                seen_o.add(o)
                            if bad:
                                errors.append(f"{where}.show_if: 'options' muss eindeutige, gültige Options-Indizes der Elternfrage enthalten")
    return errors


def _question_rows(session_id: int, questions: list) -> list[dict]:
    """Normalise QuestionIn entries into BarometerQuestion kwargs — shared by
    create, update and upload so the row-building logic lives in one place."""
    rows: list[dict] = []
    block_first: dict[str, dict] = {}
    for i, q in enumerate(questions):
        kind = q.kind
        options = [o.strip() for o in q.options] if kind in ("choice", "multi") else []
        max_choices = q.max_choices if kind == "multi" else None
        num_min = q.num_min if kind == "number" else None
        num_max = q.num_max if kind == "number" else None
        unit = (q.unit or None) if kind == "number" else None
        scale_style = q.scale_style or "zahlen"
        intro = q.intro.strip() or None if q.intro else None
        block = q.block
        chart = q.chart
        show_if = q.show_if
        same_slide = False if i == 0 else q.same_slide

        if block:
            first = block_first.get(block)
            if first is not None:
                same_slide = True
                chart = first["chart"]
                show_if = first["show_if"]

        row = {
            "session_id": session_id, "order": i, "text": q.text, "kind": kind,
            "options": options, "chart": chart,
            "scale_min": q.scale_min, "scale_max": q.scale_max,
            "scale_min_label": q.scale_min_label, "scale_max_label": q.scale_max_label,
            "same_slide": same_slide, "block": block, "intro": intro, "show_if": show_if,
            "scale_style": scale_style, "max_choices": max_choices,
            "num_min": num_min, "num_max": num_max, "unit": unit,
        }
        if block and block not in block_first:
            block_first[block] = row
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[SessionSummary])
def list_sessions(
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    q = db.query(BarometerSession)
    if current.role != "admin":
        q = q.filter(or_(BarometerSession.created_by == current.id, BarometerSession.shared == True))  # noqa: E712
    sessions = q.order_by(BarometerSession.created_at.desc()).all()
    return [
        SessionSummary(
            id=s.id, code=s.code, title=s.title, status=s.status,
            question_count=len(s.questions), created_at=s.created_at,
            shared=s.shared, created_by=s.created_by,
            created_by_name=f"{s.creator.first_name} {s.creator.last_name}" if s.creator else "?",
        )
        for s in sessions
    ]


@router.post("", response_model=SessionOut, status_code=201, dependencies=[Depends(require_capability("barometer", "host"))])
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    if not body.questions:
        raise HTTPException(400, "At least one question required")
    errors = _validate_umfrage(body.model_dump())
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Umfrage-Format", "errors": errors})
    session = BarometerSession(
        code=gen_code(db, BarometerSession),
        title=body.title,
        created_by=current.id,
        shared=body.shared,
        mode=body.mode,
    )
    db.add(session)
    db.flush()
    for row in _question_rows(session.id, body.questions):
        db.add(BarometerQuestion(**row))
    db.commit()
    db.refresh(session)
    return session


def clone_session_impl(db: Session, code: str, teacher: Teacher) -> BarometerSession:
    """Start a fresh session by copying an existing (own or shared) one's
    questions — shared by the REST endpoint and the Stundenplaner tool
    registry. Permission check (owner or shared) lives here."""
    template = db.query(BarometerSession).filter_by(code=code).first()
    if not template:
        raise HTTPException(404, "Session not found")
    if template.created_by != teacher.id and not template.shared:
        raise HTTPException(403)

    session = BarometerSession(
        code=gen_code(db, BarometerSession),
        title=template.title,
        created_by=teacher.id,
        shared=False,
        mode=template.mode,
    )
    db.add(session)
    db.flush()
    for q in template.questions:
        db.add(BarometerQuestion(
            session_id=session.id,
            order=q.order,
            text=q.text,
            kind=q.kind,
            options=list(q.options),
            chart=q.chart,
            scale_min=q.scale_min,
            scale_max=q.scale_max,
            scale_min_label=q.scale_min_label,
            scale_max_label=q.scale_max_label,
            same_slide=q.same_slide,
            block=q.block,
            intro=q.intro,
            show_if=q.show_if,
            scale_style=q.scale_style,
            max_choices=q.max_choices,
            num_min=q.num_min,
            num_max=q.num_max,
            unit=q.unit,
        ))
    db.commit()
    db.refresh(session)
    return session


# ---------------------------------------------------------------------------
# Vorlage + Upload (authored elsewhere — typically by an AI from the template's
# `_ai_instructions` — and imported here as one JSON file)
# ---------------------------------------------------------------------------

@router.get("/template", dependencies=[Depends(require_capability("barometer", "host"))])
def download_template(_: Teacher = Depends(get_current_teacher)):
    return {
        "_ai_instructions": (
            "Erstelle eine Umfrage (Meinungsbarometer) im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- title, questions (mindestens eine). "
            "--- MODUS --- mode: 'live' (Standard) zeigt den Schülern eine Frage nach der anderen, die "
            "Lehrkraft steuert den Ablauf; 'self' zeigt allen Schülern sofort alle Fragen, die das ganze "
            "Formular auf einmal abschicken — passend für Fragebögen mit Angaben zur Person und Freitext. "
            "--- FRAGEARTEN (kind) --- 'scale' (Standard): {\"text\", \"scale_min\" (Standard 1), "
            f"\"scale_max\" (Standard 6, Skala höchstens {MAX_SCALE_STEPS} Stufen), \"scale_min_label\", "
            "\"scale_max_label\" — immer beide Enden beschriften, in derselben Richtung wie die Zahlen. "
            "'choice': Dropdown mit festen Antworten, zusätzlich \"options\" (Liste mit 2-20 kurzen Texten, "
            "keine Duplikate) — typische Listen: Geschlecht (männlich/weiblich/divers), Altersgruppe, "
            "Klassenstufe, Ja/Nein/Weiß nicht, Häufigkeit (nie/selten/manchmal/oft/immer), Zustimmung "
            "(stimme zu/teils/stimme nicht zu). 'multi': wie 'choice', aber Mehrfachauswahl (Kästchen), "
            "optional \"max_choices\" begrenzt die Anzahl. 'number': Zahleneingabe, optional \"num_min\", "
            "\"num_max\" und \"unit\" (kurze Einheit, z.B. 'Stunden'). 'text': freie Antwort, bleibt nur bei "
            "der Lehrkraft sichtbar. "
            "--- SKALEN-STIL --- optionales \"scale_style\" bei 'scale': 'zahlen' (Standard), 'smileys_auf' "
            "oder 'smileys_ab' (Smileys statt Zahlen, höchstens 7 Stufen). "
            "--- FOLGEFRAGEN (show_if) --- eine Frage kann nur erscheinen, wenn eine frühere 'choice'/'multi'-"
            "Frage bestimmte Optionen gewählt hat: \"show_if\": {\"question\": <0-basierter Index der "
            "Elternfrage>, \"options\": [<Options-Indizes>]}. Meist zusammen mit \"same_slide\": true, damit "
            "Frage und Folgefrage auf einer Folie erscheinen. "
            "--- FOLIEN (same_slide) --- \"same_slide\": true zeigt eine Frage auf derselben Folie wie die "
            "vorherige (im 'live'-Modus steuert die Lehrkraft dann eine ganze Folie statt einzelner Fragen). "
            "--- AUSSAGEN-BLOCK (block/intro) --- mehrere aufeinanderfolgende 'scale'-Fragen mit derselben "
            "\"block\"-Kennung (kurzer String) und identischer Skala bilden einen Block (z.B. ein Set von "
            "Aussagen zu einem Thema); \"intro\" auf der ersten Aussage des Blocks ist die gemeinsame "
            "Überschrift. Blockmitglieder erlauben nur die Charts likert/mittelwerte. "
            "--- CHART --- optionales \"chart\" pro Frage (Diagrammtyp für die Auswertung): "
            f"scale: {', '.join(CHARTS['scale'])}; choice: {', '.join(CHARTS['choice'])}; "
            f"multi: {', '.join(CHARTS['multi'])}; number: {', '.join(CHARTS['number'])}; "
            f"text: {', '.join(CHARTS['text'])}; Aussagen-Block: {', '.join(BLOCK_CHARTS)}. Weglassen wählt "
            "die Standarddarstellung der Frageart. "
            "--- STIL --- Formuliere kurze, eindeutige Aussagen in der Ich-Form ('Ich habe verstanden, "
            "wie …'), keine Doppelfragen ('… und …'), keine Suggestivfragen. 5-10 Fragen sind eine gute "
            "Länge. Mische nicht mehrere Skalenrichtungen in einer Umfrage — sonst verrutschen die "
            "Antworten. "
            "--- SHARED --- shared: true macht die Umfrage für alle Lehrkräfte im Pool sichtbar (Standard "
            "false)."
        ),
        "title": "Feedback zur Unterrichtsreihe",
        "shared": False,
        "mode": "live",
        "questions": [
            {"text": "Ich habe verstanden, worum es in der Reihe ging.",
             "scale_min": 1, "scale_max": 6, "scale_min_label": "trifft voll zu", "scale_max_label": "trifft gar nicht zu"},
            {"text": "Das Tempo im Unterricht war für mich angenehm.",
             "scale_min": 1, "scale_max": 6, "scale_min_label": "viel zu langsam", "scale_max_label": "viel zu schnell"},
            {"text": "Ich habe mich getraut, Fragen zu stellen.",
             "scale_min": 1, "scale_max": 4, "scale_min_label": "immer", "scale_max_label": "nie"},
            {"text": "Die Gruppenarbeit hat mir beim Lernen geholfen.",
             "scale_min": 1, "scale_max": 6, "scale_min_label": "trifft voll zu", "scale_max_label": "trifft gar nicht zu"},
            {"text": "Wie oft hast du die Hausaufgaben gemacht?", "kind": "choice",
             "options": ["nie", "selten", "manchmal", "oft", "immer"]},
            {"text": "Was sollten wir in der nächsten Reihe anders machen?", "kind": "text"},
            {"text": "Bist du mit dem Kurs insgesamt zufrieden?", "kind": "choice", "options": ["Ja", "Nein"]},
            {"text": "Was genau hat dir nicht gefallen?", "kind": "text",
             "show_if": {"question": 6, "options": [1]}, "same_slide": True},
            {"text": "Ich fühle mich in der Klasse wohl.", "scale_min": 1, "scale_max": 6,
             "block": "klassenklima", "intro": "Wie geht es dir in der Klasse?"},
            {"text": "Ich werde von den anderen ernst genommen.", "scale_min": 1, "scale_max": 6,
             "block": "klassenklima"},
            {"text": "Ich traue mich, meine Meinung zu sagen.", "scale_min": 1, "scale_max": 6,
             "block": "klassenklima"},
            {"text": "Welche Themen fandest du am spannendsten?", "kind": "multi",
             "options": ["Gruppenarbeit", "Referate", "Experimente", "Diskussionen"], "max_choices": 2},
            {"text": "Wie viele Stunden hast du pro Woche für dieses Fach gelernt?", "kind": "number",
             "num_min": 0, "num_max": 20, "unit": "Stunden"},
            {"text": "Wie fühlst du dich gerade?", "scale_min": 1, "scale_max": 5,
             "scale_style": "smileys_auf"},
        ],
    }


@router.post("/upload", response_model=SessionOut, status_code=201, dependencies=[Depends(require_capability("barometer", "host"))])
def upload_session(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    try:
        raw = json.loads(file.file.read())
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Ungültiges JSON: {e}")

    errors = _validate_umfrage(raw)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Umfrage-Format", "errors": errors})

    return create_session(
        SessionCreate(
            title=raw["title"].strip(),
            shared=bool(raw.get("shared", False)),
            mode=raw.get("mode", "live"),
            questions=[QuestionIn(**{k: v for k, v in q.items() if k in QuestionIn.model_fields}) for q in raw["questions"]],
        ),
        db=db, current=current,
    )


@router.post("/{code}/clone", response_model=SessionOut, status_code=201, dependencies=[Depends(require_capability("barometer", "host"))])
def clone_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    return clone_session_impl(db, code, current)


@router.get("/{code}", response_model=SessionOut)
def get_session(
    code: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_optional),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.patch("/{code}", response_model=SessionOut)
def update_session(
    code: str,
    body: SessionCreate,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    """Replace title/questions/shared of an existing session (creator or admin only).
    Existing responses are dropped since they're keyed to the old question rows."""
    if not body.questions:
        raise HTTPException(400, "At least one question required")
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    errors = _validate_umfrage(body.model_dump())
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Umfrage-Format", "errors": errors})

    s.title = body.title
    s.shared = body.shared
    s.mode = body.mode
    for q in list(s.questions):
        db.delete(q)
    db.flush()
    for row in _question_rows(s.id, body.questions):
        db.add(BarometerQuestion(**row))
    s.current_question_idx = -1
    s.results_visible = False
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{code}", status_code=204)
def delete_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404)
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    db.delete(s)
    db.commit()


# ---------------------------------------------------------------------------
# REST: chart / results-public / export / analysis / public-results
# ---------------------------------------------------------------------------

@router.patch("/{code}/questions/{question_id}/chart", response_model=QuestionOut)
def set_question_chart(
    code: str,
    question_id: int,
    body: ChartIn,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    q = next((qq for qq in s.questions if qq.id == question_id), None)
    if not q:
        raise HTTPException(404, "Question not found")
    if q.block:
        if body.chart is not None and body.chart not in BLOCK_CHARTS:
            raise HTTPException(422, f"'{body.chart}' passt nicht zu einem Aussagen-Block — erlaubt: {', '.join(BLOCK_CHARTS)}")
        for member in s.questions:
            if member.block == q.block:
                member.chart = body.chart
    else:
        if body.chart is not None and body.chart not in CHARTS[q.kind]:
            raise HTTPException(422, f"'{body.chart}' passt nicht zu '{q.kind}' — erlaubt: {', '.join(CHARTS[q.kind])}")
        q.chart = body.chart
    db.commit()
    db.refresh(q)
    return q


@router.patch("/{code}/results-public")
def set_results_public(
    code: str,
    body: ResultsPublicIn,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    s.results_public = body.public
    db.commit()
    return {"results_public": s.results_public}


@router.get("/{code}/export")
def export_session(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)

    groups: dict[tuple, list[BarometerResponse]] = defaultdict(list)
    for r in s.responses:
        groups[(r.student_id, r.guest_id)].append(r)
    ordered_keys = sorted(
        groups.keys(),
        key=lambda k: (min(r.answered_at for r in groups[k]), min(r.id for r in groups[k])),
    )
    respondent_num = {key: i + 1 for i, key in enumerate(ordered_keys)}

    slide_of: dict[int, int] = {}
    for idx, slide in enumerate(_slides(s)):
        for q in slide:
            slide_of[q.id] = idx

    questions_out = []
    for q in s.questions:
        entry: dict = {
            "id": q.id, "order": q.order, "kind": q.kind, "text": q.text,
            "scale_min": q.scale_min, "scale_max": q.scale_max,
            "scale_min_label": q.scale_min_label, "scale_max_label": q.scale_max_label,
            "options": q.options, "chart": q.chart,
            "slide": slide_of[q.id], "same_slide": q.same_slide, "block": q.block,
            "intro": q.intro, "show_if": q.show_if, "scale_style": q.scale_style,
            "max_choices": q.max_choices, "num_min": q.num_min, "num_max": q.num_max, "unit": q.unit,
        }
        q_responses = [r for r in s.responses if r.question_id == q.id]
        if q.kind == "scale":
            dist = {str(v): 0 for v in range(q.scale_min, q.scale_max + 1)}
            vals = [r.value for r in q_responses if r.value is not None]
            for v in vals:
                dist[str(v)] = dist.get(str(v), 0) + 1
            entry["distribution"] = dist
            entry["count"] = len(vals)
            entry["mean"] = round(sum(vals) / len(vals), 2) if vals else None
        elif q.kind == "choice":
            dist = {opt: 0 for opt in q.options}
            count = 0
            for r in q_responses:
                if r.value is not None and 0 <= r.value < len(q.options):
                    dist[q.options[r.value]] += 1
                    count += 1
            entry["distribution"] = dist
            entry["count"] = count
        elif q.kind == "multi":
            dist = {opt: 0 for opt in q.options}
            count = 0
            for r in q_responses:
                if r.choices:
                    count += 1
                    for c in r.choices:
                        if 0 <= c < len(q.options):
                            dist[q.options[c]] += 1
            entry["distribution"] = dist
            entry["count"] = count
        elif q.kind == "number":
            nums = [r.number for r in q_responses if r.number is not None]
            entry["answers"] = nums
            entry["count"] = len(nums)
            entry["mean"] = round(sum(nums) / len(nums), 2) if nums else None
            if nums:
                sorted_nums = sorted(nums)
                mid = len(sorted_nums) // 2
                median = sorted_nums[mid] if len(sorted_nums) % 2 == 1 else (sorted_nums[mid - 1] + sorted_nums[mid]) / 2
                entry["median"] = round(median, 2)
                entry["min"] = round(min(nums), 2)
                entry["max"] = round(max(nums), 2)
            else:
                entry["median"] = entry["min"] = entry["max"] = None
        else:
            answers = [r.text for r in sorted(
                (r for r in q_responses if r.text and r.text.strip()),
                key=lambda r: (r.answered_at, r.id),
            )]
            entry["answers"] = answers
            entry["count"] = len(answers)
            entry["analysis"] = q.analysis
        questions_out.append(entry)

    respondents = []
    for key in ordered_keys:
        answers: dict = {}
        for r in groups[key]:
            q = next(qq for qq in s.questions if qq.id == r.question_id)
            if q.kind == "choice":
                answers[str(r.question_id)] = q.options[r.value] if r.value is not None and 0 <= r.value < len(q.options) else None
            elif q.kind == "multi":
                answers[str(r.question_id)] = [q.options[c] for c in (r.choices or []) if 0 <= c < len(q.options)]
            elif q.kind == "number":
                answers[str(r.question_id)] = r.number
            elif q.kind == "text":
                answers[str(r.question_id)] = r.text
            else:
                answers[str(r.question_id)] = r.value
        respondents.append({"respondent": respondent_num[key], "answers": answers})

    return {
        "format": "hauspokal-umfrage-ergebnisse", "version": 1,
        "code": s.code, "title": s.title, "mode": s.mode, "status": s.status,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "respondent_count": len(ordered_keys),
        "questions": questions_out,
        "respondents": respondents,
    }


@router.get("/{code}/analysis-prompt")
def analysis_prompt(
    code: str,
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    text_questions = [q for q in s.questions if q.kind == "text"]
    if not text_questions:
        raise HTTPException(400, "Diese Umfrage hat keine Freitextfragen")

    parts = [
        "Du wertest die Freitextantworten einer anonymen Schüler-Umfrage aus. Lies für jede Frage "
        "unten alle Antworten, gruppiere ähnliche Antworten zu Themen mit Anzahl, fasse in 2-3 "
        "Sätzen zusammen, hebe einzigartige/originelle Ideen hervor (die nur von einem oder wenigen "
        "Schülern genannt wurden), zitiere dabei die Formulierung der Schüler in den Beispielen, "
        "erfinde nichts dazu und rate niemals Identitäten.",
    ]
    for q in text_questions:
        answers = [r.text for r in sorted(
            (r for r in s.responses if r.question_id == q.id and r.text and r.text.strip()),
            key=lambda r: (r.answered_at, r.id),
        )]
        parts.append(f"\nFrage (question_id {q.id}): {q.text}")
        if q.show_if:
            parent = s.questions[q.show_if["question"]]
            labels = ", ".join(
                parent.options[o] for o in q.show_if["options"] if 0 <= o < len(parent.options)
            )
            parts.append(f"Folgefrage — nur beantwortet, wenn bei „{parent.text}“ gewählt wurde: {labels}")
        if answers:
            parts.append("\n".join(f"{i + 1}. {a}" for i, a in enumerate(answers)))
        else:
            parts.append("(noch keine Antworten)")

    template = {
        "survey_code": code,
        "analyses": [
            {
                "question_id": q.id,
                "summary": "2-3 Sätze Zusammenfassung",
                "groups": [{"title": "Thema", "description": "kurze Beschreibung", "count": 0, "examples": ["Beispielzitat"]}],
                "unique_ideas": [{"idea": "einzigartige Idee", "reason": "warum sie auffällt"}],
            }
            for q in text_questions
        ],
    }
    parts.append(
        "\nAntworte AUSSCHLIESSLICH mit dem folgenden JSON (keine weitere Erklärung), damit es als "
        ".json gespeichert und wieder in diese Umfrage hochgeladen werden kann:"
    )
    parts.append("```json\n" + json.dumps(template, ensure_ascii=False, indent=2) + "\n```")

    return {"prompt": "\n".join(parts)}


def _validate_analysis(data, session: BarometerSession) -> list[str]:
    if not isinstance(data, dict):
        return ["Die Datei muss ein JSON-Objekt sein"]
    errors: list[str] = []
    survey_code = data.get("survey_code")
    if survey_code is None:
        errors.append("Pflichtfeld fehlt: 'survey_code'")
    elif survey_code != session.code:
        errors.append(f"Diese Auswertung gehört zur Umfrage '{survey_code}', nicht zu '{session.code}'")

    analyses = data.get("analyses")
    if not isinstance(analyses, list) or not analyses:
        errors.append("'analyses' muss eine nicht-leere Liste sein")
        return errors

    text_qids = {q.id for q in session.questions if q.kind == "text"}
    seen_qids: set[int] = set()
    for i, a in enumerate(analyses):
        where = f"analyses[{i}]"
        if not isinstance(a, dict):
            errors.append(f"{where}: muss ein Objekt sein")
            continue
        qid = a.get("question_id")
        if not isinstance(qid, int) or isinstance(qid, bool) or qid not in text_qids:
            errors.append(f"{where}: question_id {qid} ist keine Freitextfrage dieser Umfrage")
        elif qid in seen_qids:
            errors.append(f"{where}: question_id {qid} ist doppelt")
        else:
            seen_qids.add(qid)

        summary = a.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            errors.append(f"{where}.summary: Pflichtfeld fehlt")

        groups = a.get("groups", [])
        if not isinstance(groups, list):
            errors.append(f"{where}.groups: muss eine Liste sein")
            groups = []
        for j, g in enumerate(groups):
            gwhere = f"{where}.groups[{j}]"
            if not isinstance(g, dict):
                errors.append(f"{gwhere}: muss ein Objekt sein")
                continue
            if not isinstance(g.get("title"), str) or not g["title"].strip():
                errors.append(f"{gwhere}.title: Pflichtfeld fehlt")
            if not isinstance(g.get("count"), int) or isinstance(g.get("count"), bool) or g.get("count") < 0:
                errors.append(f"{gwhere}.count: muss eine ganze Zahl >= 0 sein")
            if g.get("description") is not None and not isinstance(g["description"], str):
                errors.append(f"{gwhere}.description: muss ein Text sein")
            if g.get("examples") is not None and not isinstance(g["examples"], list):
                errors.append(f"{gwhere}.examples: muss eine Liste sein")

        unique_ideas = a.get("unique_ideas", [])
        if not isinstance(unique_ideas, list):
            errors.append(f"{where}.unique_ideas: muss eine Liste sein")
            unique_ideas = []
        for j, u in enumerate(unique_ideas):
            uwhere = f"{where}.unique_ideas[{j}]"
            if not isinstance(u, dict):
                errors.append(f"{uwhere}: muss ein Objekt sein")
                continue
            if not isinstance(u.get("idea"), str) or not u["idea"].strip():
                errors.append(f"{uwhere}.idea: Pflichtfeld fehlt")
            if u.get("reason") is not None and not isinstance(u["reason"], str):
                errors.append(f"{uwhere}.reason: muss ein Text sein")
    return errors


@router.post("/{code}/analysis", response_model=SessionOut)
def upload_analysis(
    code: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)

    try:
        raw = json.loads(file.file.read())
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Ungültiges JSON: {e}")

    errors = _validate_analysis(raw, s)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Auswertungs-Format", "errors": errors})

    now = datetime.now(timezone.utc).isoformat()
    for a in raw["analyses"]:
        q = next(qq for qq in s.questions if qq.id == a["question_id"])
        q.analysis = {
            "summary": a["summary"],
            "groups": [
                {
                    "title": g["title"],
                    "description": g.get("description") or "",
                    "count": g["count"],
                    "examples": g.get("examples") or [],
                }
                for g in a.get("groups", [])
            ],
            "unique_ideas": [
                {"idea": u["idea"], "reason": u.get("reason") or ""}
                for u in a.get("unique_ideas", [])
            ],
            "uploaded_at": now,
        }
    db.commit()
    db.refresh(s)
    return s


@router.get("/{code}/public-results")
def public_results(
    code: str,
    db: Session = Depends(get_db),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        raise HTTPException(404, "Session not found")
    if not s.results_public:
        raise HTTPException(403, "Die Ergebnisse dieser Umfrage sind nicht freigegeben")

    questions = []
    for q in s.questions:
        qr = _question_results(s, q, include_texts=False)
        questions.append({
            "id": q.id, "order": q.order, "kind": q.kind, "text": q.text,
            "scale_min": q.scale_min, "scale_max": q.scale_max,
            "scale_min_label": q.scale_min_label, "scale_max_label": q.scale_max_label,
            "options": q.options, "chart": q.chart,
            "same_slide": q.same_slide, "block": q.block, "intro": q.intro,
            "scale_style": q.scale_style, "max_choices": q.max_choices,
            "num_min": q.num_min, "num_max": q.num_max, "unit": q.unit,
            "count": qr["count"], "distribution": qr["distribution"],
            "analysis": q.analysis if q.kind == "text" else None,
        })
    return {"code": s.code, "title": s.title, "status": s.status, "questions": questions}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@router.websocket("/{code}/ws")
async def barometer_ws(
    code: str,
    websocket: WebSocket,
    role: str = "student",
    db: Session = Depends(get_db),
):
    s = db.query(BarometerSession).filter_by(code=code).first()
    if not s:
        await reject(websocket, 4004)
        return

    # Identity comes from the connection's own session cookie/token, never
    # from client-supplied query params — otherwise a participant could
    # spoof another student_id (or reuse several) to vote more than once.
    identity = ws_identity(websocket, db)
    # Unauthenticated players may vote if they hold a live guest token scoped to
    # this code (only issued when the teacher opted in — enforces opt-in + expiry).
    guest = ws_guest(websocket, code, db) if not identity else None
    if not identity and not guest:
        await reject(websocket, 4001)
        return
    ident_role, ident_id = identity if identity else (None, 0)
    guest_id: str | None = None

    if role == "teacher":
        teacher = db.get(Teacher, ident_id) if ident_role == "teacher" else None
        if not teacher or (s.created_by != teacher.id and teacher.role != "admin"):
            await reject(websocket, 4003)
            return
        student_id = 0
    elif guest:
        student_id = 0
        guest_id = guest.id
    else:
        if ident_role != "student":
            await reject(websocket, 4003)
            return
        student_id = ident_id
    # Gaeste haben keine student_id. Unter dem gemeinsamen Platz 0 verdraengte
    # jeder neue Gast den vorigen im Raum — nur der zuletzt verbundene bekam die
    # Fragen, alle anderen sahen weiter die Lobby.
    player_key = guest_id or student_id

    await websocket.accept()

    if role == "teacher":
        mgr.add_teacher(code, websocket)
        state = _state_msg(s)
        state["results"] = {str(q.id): _question_results(s, q, True) for q in s.questions}
        state["participants"] = mgr.student_count(code)
        await websocket.send_json(state)
    else:
        mgr.add_student(code, player_key, websocket)
        state = _state_msg(s)
        state["my_answers"] = _my_answers(s, student_id, guest_id)
        slides = _slides(s)
        if s.results_visible and 0 <= s.current_question_idx < len(slides):
            slide_qs = slides[s.current_question_idx]
            state["results"] = {str(q.id): _question_results(s, q, False) for q in slide_qs}
        await websocket.send_json(state)
        await mgr.send_teachers(code, {"event": "participant_joined", "count": mgr.student_count(code)})

    try:
        while True:
            data = await receive_json(websocket, db)
            action = data.get("action")

            db.expire_all()
            s = db.query(BarometerSession).filter_by(code=code).first()
            if not s:
                break

            if role == "teacher":
                if action in ("show_slide", "show_question"):
                    idx = int(data.get("index", 0))
                    slides = _slides(s)
                    if 0 <= idx < len(slides):
                        s.current_question_idx = idx
                        s.results_visible = False
                        db.commit()
                        db.refresh(s)
                        slide_qs = _slides(s)[idx]
                        await mgr.broadcast(code, {
                            "event": "slide", "index": idx, "total": len(slides),
                            "questions": [_question_dict(q) for q in slide_qs],
                        })

                elif action == "show_results":
                    slides = _slides(s)
                    idx = s.current_question_idx
                    if 0 <= idx < len(slides):
                        s.results_visible = True
                        db.commit()
                        db.refresh(s)
                        slide_qs = _slides(s)[idx]
                        await mgr.broadcast(code, {
                            "event": "results", "index": idx,
                            "results": {str(q.id): _question_results(s, q, False) for q in slide_qs},
                        })

                elif action == "close":
                    s.status = "closed"
                    db.commit()
                    await mgr.broadcast(code, {"event": "closed"})

                elif action == "restart":
                    s.status = "active"
                    s.current_question_idx = -1
                    s.results_visible = False
                    db.query(BarometerResponse).filter_by(session_id=s.id).delete()
                    for q in s.questions:
                        q.analysis = None
                    db.commit()
                    db.refresh(s)
                    await mgr.broadcast(code, {**_state_msg(s), "reset": True})

            else:
                if action == "respond":
                    qid = int(data.get("question_id", 0))
                    q = next((qq for qq in s.questions if qq.id == qid), None)
                    if not q:
                        continue
                    answer = {"value": data.get("value"), "text": data.get("text"), "choices": data.get("choices")}
                    ack = _save_answer(db, s, q, student_id, guest_id, answer)
                    if ack is None:
                        continue
                    pruned = _prune_followups(db, s, student_id, guest_id)
                    db.commit()
                    db.refresh(s)
                    q = next(qq for qq in s.questions if qq.id == qid)
                    await mgr.send_teachers(code, {
                        "event": "response_update",
                        "question_id": qid,
                        **_question_results(s, q, True),
                    })
                    for pid in pruned:
                        pq = next(qq for qq in s.questions if qq.id == pid)
                        await mgr.send_teachers(code, {
                            "event": "response_update",
                            "question_id": pid,
                            **_question_results(s, pq, True),
                        })
                    await websocket.send_json({
                        "event": "response_ack", "question_id": qid, **ack,
                        "my_answers": _my_answers(s, student_id, guest_id),
                    })

                elif action == "submit":
                    if s.status == "closed":
                        await websocket.send_json({"event": "closed"})
                        continue
                    answers = data.get("answers", [])
                    if s.mode == "live":
                        slides = _slides(s)
                        idx = s.current_question_idx
                        scope_ids = {q.id for q in slides[idx]} if 0 <= idx < len(slides) else set()
                        answers = [a for a in answers if a.get("question_id") in scope_ids]
                    else:
                        scope_ids = {q.id for q in s.questions}
                    order_by_id = {q.id: q.order for q in s.questions}
                    answers = sorted(answers, key=lambda a: order_by_id.get(a.get("question_id"), 0))
                    touched: list[int] = []
                    for a in answers:
                        qid = a.get("question_id")
                        q = next((qq for qq in s.questions if qq.id == qid), None)
                        if not q:
                            continue
                        answer = {"value": a.get("value"), "text": a.get("text"), "choices": a.get("choices")}
                        ack = _save_answer(db, s, q, student_id, guest_id, answer)
                        if ack is not None:
                            touched.append(qid)
                    # Abgesendet wird das ganze Formular bzw. die ganze Folie: was darin nicht
                    # mehr mitkommt, hat die Person geleert — die alte Antwort zieht sie zurueck.
                    cleared: list[int] = []
                    for q in s.questions:
                        if q.id in scope_ids and q.id not in touched:
                            old = _get_response(db, s, q, student_id, guest_id)
                            if old:
                                db.delete(old)
                                cleared.append(q.id)
                    db.flush()
                    pruned = _prune_followups(db, s, student_id, guest_id)
                    db.commit()
                    db.refresh(s)
                    for qid in dict.fromkeys(touched + cleared + pruned):
                        q = next(qq for qq in s.questions if qq.id == qid)
                        await mgr.send_teachers(code, {
                            "event": "response_update",
                            "question_id": qid,
                            **_question_results(s, q, True),
                        })
                    await websocket.send_json({
                        "event": "submitted",
                        "my_answers": _my_answers(s, student_id, guest_id),
                    })

    except WebSocketDisconnect:
        pass
    finally:
        if role == "teacher":
            mgr.remove_teacher(code, websocket)
        else:
            mgr.remove_student(code, player_key, websocket)
