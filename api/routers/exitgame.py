"""
Exitgame — self-paced, session-based exit game.

Unlike Caputh (teacher-paced lockstep quiz over WebSocket), a student plays
an Exitgame entirely on their own timeline: a teacher opens a session
(join_code) nominally attached to a class, and ANY logged-in user with the
code — student, teacher, or admin — can start/resume their own
ExitGameAttempt via plain REST. The link is the only gate: session.class_id
is a reporting label, not a participation check, so a visiting student, a
whole other course, or a teacher trying the game out can all play the same
session. Each attempt steps through explanation/example/task/door slides
authored as one JSON document (ExitGame.data — content shape
ported from the standalone Exitbuilder_text reference: slides of type
explanation|example|task|door, task kinds single|multi|true_false|input,
optional hints[] and an easierAlternative). Every answer is checked
server-side (never trust client-claimed correctness) and logged as an
ExitGameEvent, which is both the audit trail teachers review afterward and
the input history the server-side fuzzy DDA (api/dda.py) reads to decide
the student's current hint budget / easier-alternative eligibility.

A broadcast-only WebSocket (/api/exitgame-sessions/{code}/ws) pushes
progress deltas to the teacher's live host dashboard as students play — no
phase machine, no lockstep, just push-on-change.

Flow:
  1. Teacher POSTs /api/exitgames/{id}/sessions        → join_code
  2. Student POSTs /api/exitgame-sessions/{code}/attempts → attempt (start/resume)
  3. Student POSTs /api/exitgame-attempts/{id}/events   → per-interaction, server-checked
  4. Student POSTs /api/exitgame-attempts/{id}/finish   → final summary
  5. Teacher GETs /api/exitgame-sessions/{code}/report  → per-student results
     Teacher GETs /api/exitgame-attempts/{id}/log       → detailed per-student log
"""
import io
import json
import random
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import dda as dda_engine
from .. import timeline_engine
from ..task_generators import check_input_answer
from ..database import get_db
from ..models import ExitGame, ExitGameSession, ExitGameAttempt, ExitGameEvent, Teacher, Student, Class
from ..auth import get_current_teacher, get_current_user
from ..utils import gen_code
from ..ws_auth import ws_teacher
from ..ws_manager import RoomManager

router = APIRouter(tags=["exitgame"])

EXITGAME_DATA_ROOT = Path(__file__).parent.parent.parent / "data" / "exitgames"

ALLOWED_TASK_KINDS = {"single", "multi", "true_false", "input", "timeline"}
DDA_HISTORY_LIMIT = 50
DDA_RECENT_WINDOW = 10

mgr = RoomManager()


def get_current_player(current=Depends(get_current_user)) -> Teacher | Student:
    """Anyone logged in may play — student or teacher/admin trying it out."""
    return current


def _owner_filter(current: Teacher | Student) -> dict:
    return {"student_id": current.id} if isinstance(current, Student) else {"teacher_id": current.id}


def _attempt_belongs_to(attempt: ExitGameAttempt, current: Teacher | Student) -> bool:
    if isinstance(current, Student):
        return attempt.student_id == current.id
    return attempt.teacher_id == current.id


def _participant_name(attempt: ExitGameAttempt) -> str:
    if attempt.student:
        return f"{attempt.student.vorname} {attempt.student.nachname}"
    return f"{attempt.teacher.first_name} {attempt.teacher.last_name}".strip()


def _participant_class(attempt: ExitGameAttempt) -> str:
    return attempt.student.klasse if attempt.student else "Lehrkraft"


# ---------------------------------------------------------------------------
# Content validation (hand-rolled — mirrors the referential checks from the
# Exitbuilder_text reference validator, no jsonschema dependency, consistent
# with Caputh's own hand-rolled upload validation elsewhere in this codebase)
# ---------------------------------------------------------------------------

def _iter_tasks(slide: dict) -> list[dict]:
    if "tasks" in slide:
        return slide["tasks"] or []
    if "task" in slide and slide["task"] is not None:
        return [slide["task"]]
    return []


def _task_errors(task: dict, where: str) -> list[str]:
    errors = []
    variants = task.get("variants")
    if variants:
        if not isinstance(variants, list) or not variants:
            return [f"{where}: 'variants' muss eine nicht-leere Liste sein"]
        # Validate each variant as the merged task the student would get.
        base = {k: v for k, v in task.items() if k != "variants"}
        for i, v in enumerate(variants):
            errors.extend(_task_errors({**base, **v}, f"{where}.variants[{i}]"))
        return errors
    kind = task.get("kind")
    if kind not in ALLOWED_TASK_KINDS:
        errors.append(f"{where}: unbekannte oder nicht unterstützte task.kind '{kind}' "
                       f"(erlaubt: {', '.join(sorted(ALLOWED_TASK_KINDS))} — 'generated' wird in v1 nicht unterstützt)")
        return errors
    if kind in ("single", "multi", "true_false"):
        answers = task.get("answers") or []
        if not answers:
            errors.append(f"{where}: task.kind '{kind}' braucht 'answers'")
        elif not any(a.get("correct") for a in answers):
            errors.append(f"{where}: task.kind '{kind}' braucht mindestens eine 'correct': true Antwort")
    elif kind == "input":
        if not task.get("accept"):
            errors.append(f"{where}: task.kind 'input' braucht 'accept' (Liste akzeptierter Antworten)")
    elif kind == "timeline":
        errors.extend(timeline_engine.validate_game_spec(task.get("timeline"), f"{where}.timeline"))
    easier = task.get("easierAlternative")
    if easier:
        errors.extend(_task_errors(easier, f"{where}.easierAlternative"))
    return errors


def _validate_dda(dda: dict) -> list[str]:
    """The differentiation ladder must be authored in the JSON itself:
    dda.levels (>=3 entries, 5 recommended), ordered from minimal to maximum
    support. Alternatively a full ruleSet + adaptationMatrix override."""
    errors: list[str] = []
    if not dda.get("enabled", False):
        return errors
    if dda.get("ruleSet") and dda.get("adaptationMatrix"):
        return errors  # full expert override, taken as-is
    levels = dda.get("levels")
    if not isinstance(levels, list) or len(levels) < 3:
        errors.append(
            "dda: 'enabled': true braucht 'levels' — eine Liste von mindestens 3 "
            "(empfohlen 5) Differenzierungsstufen, sortiert von wenig zu viel "
            "Unterstützung, z.B. {\"name\": \"selbstständig\", \"hintCount\": 0, "
            "\"timeLimitSeconds\": 60, \"extraExample\": false, \"offerEasier\": false}"
        )
        return errors
    for i, level in enumerate(levels):
        if not isinstance(level, dict) or not isinstance(level.get("hintCount"), int) or level["hintCount"] < 0:
            errors.append(f"dda.levels[{i}]: 'hintCount' (ganze Zahl >= 0) fehlt oder ist ungültig")
    return errors


def _validate_exitgame(data: dict) -> list[str]:
    errors: list[str] = []
    for field in ("title", "subject", "slides"):
        if not data.get(field):
            errors.append(f"Pflichtfeld fehlt: '{field}'")
    errors.extend(_validate_dda(data.get("dda") or {}))
    slides = data.get("slides") or []
    if not isinstance(slides, list) or not slides:
        errors.append("'slides' muss eine nicht-leere Liste sein")
        return errors

    seen_ids: set[str] = set()
    for i, slide in enumerate(slides):
        sid = slide.get("id")
        where = f"slides[{i}]" + (f" ('{sid}')" if sid else "")
        if not sid:
            errors.append(f"{where}: 'id' fehlt")
        elif sid in seen_ids:
            errors.append(f"{where}: doppelte slide-id '{sid}'")
        else:
            seen_ids.add(sid)

        stype = slide.get("type")
        if stype not in ("explanation", "example", "task", "door"):
            errors.append(f"{where}: unbekannter type '{stype}'")
            continue

        if stype == "door" and not (slide.get("task") or slide.get("tasks") or slide.get("code")):
            errors.append(f"{where}: 'door' braucht 'task', 'tasks' oder 'code'")
        if stype == "task" and not (slide.get("task") or slide.get("tasks")):
            errors.append(f"{where}: 'task' braucht 'task' oder 'tasks'")

        for j, task in enumerate(_iter_tasks(slide)):
            errors.extend(_task_errors(task, f"{where}.tasks[{j}]"))

    for i, slide in enumerate(slides):
        for target in slide.get("onFailReview") or []:
            if target not in seen_ids:
                errors.append(f"slides[{i}]: onFailReview verweist auf unbekannte slide-id '{target}'")

    return errors


# ---------------------------------------------------------------------------
# Content: upload / list / template / CRUD
# ---------------------------------------------------------------------------

class ExitGameOut(BaseModel):
    id: int
    title: str
    description: str | None
    subject: str
    grade: str | None
    tags: list
    slide_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


def _to_out(g: ExitGame) -> ExitGameOut:
    return ExitGameOut(
        id=g.id, title=g.title, description=g.description, subject=g.subject,
        grade=g.grade, tags=g.tags, slide_count=len(g.data.get("slides", [])),
        created_at=g.created_at,
    )


@router.get("/api/exitgames", response_model=list[ExitGameOut])
def list_exitgames(db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    games = db.query(ExitGame).order_by(ExitGame.created_at.desc()).all()
    return [_to_out(g) for g in games]


@router.get("/api/exitgames/template")
def download_template(_: Teacher = Depends(get_current_teacher)):
    return {
        "_ai_instructions": (
            "Erstelle ein Text-Exitgame im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- id (kleinbuchstaben-mit-bindestrichen), title, subject, slides. "
            "--- HEADER --- subject: Freitext (mathe, physik, deutsch, ...). grade wie Caputh: "
            "'7', '5,6,7' oder '5-10'. tags: Freitextliste. completion: {message, code} - der Exit-Code am Ende. "
            "--- STYLE --- style: {\"theme\": ..., \"font\": ..., \"customVars\": {...}} (alles optional). "
            "theme: eingebaute Presets 'dark', 'christmas', 'halloween', 'pirate', 'cyberpunk' — ohne theme "
            "gilt das normale App-Design. font: CSS-Schriftfamilie, z.B. 'Georgia, serif'. customVars: "
            "gezielte Farb-Overrides der App-Standardvariablen, z.B. {\"--accent\": \"#ff8800\", "
            "\"--bg\": \"#0a0a12\", \"--surface\": \"#12121f\", \"--text\": \"#e0f2fe\"} — customVars gewinnen "
            "über das theme-Preset. Gilt nur für die Spielansicht der Schüler. "
            "--- DDA (Differenzierung) --- dda: {\"enabled\": true, \"levels\": [...]} — 'levels' ist PFLICHT "
            "wenn enabled, und definiert die komplette Differenzierung DIESES Spiels: eine geordnete Liste von "
            "MINDESTENS 3, EMPFOHLEN 5 Stufen, sortiert von wenig zu viel Unterstützung. Jede Stufe: "
            "{\"name\": Freitext, \"hintCount\": ganze Zahl (wie viele der pro Slide angelegten hints maximal "
            "freigegeben werden), \"timeLimitSeconds\": Richtwert Bearbeitungszeit pro Aufgabe, "
            "\"extraExample\": true/false (Zusatzbeispiel zeigen), \"offerEasier\": true/false (leichtere "
            "Alternativaufgabe anbieten)}. Das Spiel stuft jeden Schüler laufend anhand seines "
            "Antwortverhaltens (Tempo, Fehler, Hinweisnutzung) in eine dieser Stufen ein — schnell+richtig -> "
            "niedrige Stufe (wenig Hilfe), viele Fehlversuche -> hohe Stufe (viel Hilfe). Ohne dda-Feld: "
            "statisches Spiel mit festem Budget von 2 Hinweisen pro Slide. "
            "--- SLIDE-TYPEN --- 'explanation' (Erklärung, Weiter-Button), 'example' (Beispiel, Weiter-Button), "
            "'task' (muss gelöst werden; 'task': {...} für eine Aufgabe ODER 'tasks': [{...}] für mehrere Aufgaben "
            "auf einer Slide - alle müssen richtig sein), 'door' (Tür/Gate, schwerere Transferaufgabe; braucht "
            "task/tasks ODER code; onFailReview: Slide-IDs zur Wiederholung nach 2 Fehlversuchen). "
            "--- AUFGABEN-ARTEN (task.kind) --- 'single' (1 richtige Antwort), 'multi' (mehrere richtig, exakte "
            "Auswahl nötig), 'true_false' (2 Antworten Wahr/Falsch), 'input' (Freitext/Zahl; accept = Liste "
            "akzeptierter Antworten, Zahlen mit Komma ODER Punkt, Groß/Klein egal), 'timeline' (Zeitstrahl/"
            "Zahlenstrahl, Feld 'timeline': {mode, axis, items}). timeline mode 'sort': Schüler ziehen die items "
            "an die richtige Stelle der Achse; items [{id, label, value}]; axis {kind: 'year'|'number', min, max, "
            "step?, unit?}; optional tolerance (erlaubte Abweichung) und scoring 'position' (Standard, Toleranz"
            "fenster) oder 'order' (nur Reihenfolge muss stimmen — fair bei Jahreszahlen). timeline mode 'spot': "
            "items werden bei 'value' ANGEZEIGT, falsch platzierte tragen ihren wahren Wert zusätzlich in "
            "'actual' — Schüler markieren die falschen. Jahreszahlen v. Chr. = negativ (-753). "
            "Genaue Daten: ein item darf 'exact_date' tragen (ISO-8601 n. Chr.: 'JJJJ', 'JJJJ-MM' oder "
            "'JJJJ-MM-TT', z.B. '1914-07-28'; das Jahr muss zu 'value' passen). Dann wird taggenau positioniert "
            "und bewertet — nötig, sobald zwei items im selben Jahr liegen, sonst liegen sie übereinander. Bei "
            "'spot' ist 'exact_date' die angezeigte Stelle, die wahre kommt in 'actual' (+ optional "
            "'exact_date_actual'). Nur diese fünf — "
            "prozedural erzeugte Aufgaben gibt es separat auf der Übungsseite. "
            "--- VARIANTEN (Abschreibschutz) --- Jede Aufgabe kann optional 'variants' tragen: eine Liste "
            "gleichwertiger Alternativen derselben Aufgabe (jeweils nur die abweichenden Felder, z.B. "
            "{\"question\": ..., \"accept\": [...]}). Jeder Schüler bekommt pro Versuch fest EINE Variante "
            "zugelost (beim Nachbarn abgucken lohnt nicht); Wiederaufnahme zeigt dieselbe. Schreibe 2-4 "
            "Varianten bei wichtigen Aufgaben. "
            "--- MEDIEN --- media: {kind: image|html|video, src, alt, height}. kind 'video': normaler "
            "YouTube-/Vimeo-Link, wird automatisch eingebettet. kind 'html': absolute URL einer einbettbaren "
            "Simulation (z.B. PhET), height in px. kind 'image': Dateiname einer Datei im assets/-Ordner des "
            "hochgeladenen ZIPs (z.B. 'waage.svg') oder eine absolute Bild-URL. "
            "--- HINWEISE & DIFFERENZIERUNG PRO SLIDE --- hints: geordnete Liste pro Slide, erster Hinweis = "
            "sanfter Schubser, letzter = fast die Lösung; schreibe ruhig 2-4, die dda-Stufe entscheidet, wie "
            "viele freigegeben werden. task.easierAlternative: (optional, gleicher Aufbau wie 'task') eine "
            "leichtere Version derselben Aufgabe; wird als Ja/Nein-Angebot vorgeschlagen, nachdem der Schüler "
            "mehrfach falsch lag und Hinweise aufgebraucht sind - kein automatischer Wechsel. "
            "--- MATHE --- KaTeX: inline $\\frac{a}{b}$, abgesetzt $$u = 2 \\cdot (a+b)$$. Dezimalkomma: $3{,}14$. "
            "WICHTIG: Die zu lösende Gleichung/Formel einer Aufgabe IMMER abgesetzt mit $$...$$ schreiben "
            "(eigene Zeile, besser lesbar); inline $...$ nur für einzelne Symbole im Fließtext wie $x$. "
            "--- REGELN --- Keine Lösungshinweise in Bildern/Fragen/Antwortoptionen. Slide-IDs eindeutig. "
            "Jede door braucht task oder code."
        ),
        "id": "beispiel-exitgame",
        "title": "Beispiel Exitgame",
        "description": "Ein Beispiel-Exitgame mit allen Slide-Typen",
        "subject": "mathe",
        "grade": "5-10",
        "tags": ["mathe", "fun"],
        "style": {"theme": "dark", "customVars": {"--accent": "#22c55e"}},
        "dda": {
            "enabled": True,
            "levels": [
                {"name": "selbstständig", "hintCount": 0, "timeLimitSeconds": 60, "extraExample": False, "offerEasier": False},
                {"name": "leichte Unterstützung", "hintCount": 1, "timeLimitSeconds": 90, "extraExample": False, "offerEasier": False},
                {"name": "mittlere Unterstützung", "hintCount": 2, "timeLimitSeconds": 120, "extraExample": True, "offerEasier": False},
                {"name": "starke Unterstützung", "hintCount": 3, "timeLimitSeconds": 180, "extraExample": True, "offerEasier": True},
                {"name": "maximale Unterstützung", "hintCount": 99, "timeLimitSeconds": 300, "extraExample": True, "offerEasier": True},
            ],
        },
        "completion": {"message": "Geschafft! Du bist entkommen!", "code": "GEHEIM-42"},
        "slides": [
            {"id": "intro", "type": "explanation", "title": "Willkommen",
             "text": "Löse die Aufgaben, um die Tür zu öffnen."},
            {"id": "beispiel", "type": "example", "title": "Beispiel",
             "text": "$$3 + 4 = 7$$"},
            {"id": "aufgabe-1", "type": "task", "title": "Aufgabe 1",
             "text": "Rechne aus:",
             "task": {"kind": "single",
                       "variants": [
                           {"question": "5 + 3 = ?", "answers": [{"text": "8", "correct": True}, {"text": "7", "correct": False}]},
                           {"question": "4 + 5 = ?", "answers": [{"text": "9", "correct": True}, {"text": "8", "correct": False}]},
                           {"question": "6 + 3 = ?", "answers": [{"text": "9", "correct": True}, {"text": "10", "correct": False}]},
                       ]},
             "hints": ["Zähl an den Fingern.", "Zähl von der größeren Zahl aus weiter."]},
            {"id": "zeitstrahl", "type": "task", "title": "Zahlenstrahl",
             "text": "Ziehe die Zahlen an die richtige Stelle.",
             "task": {"kind": "timeline",
                       "timeline": {"mode": "sort",
                                     "axis": {"kind": "number", "min": 0, "max": 100, "step": 5},
                                     "items": [{"id": "a", "label": "25", "value": 25},
                                                {"id": "b", "label": "60", "value": 60},
                                                {"id": "c", "label": "85", "value": 85}]}},
             "hints": ["Wo liegt die Mitte des Strahls?"]},
            {"id": "zeitstrahl-tage", "type": "task", "title": "Zeitstrahl mit genauen Daten",
             "text": "Beide Ereignisse liegen 1914 — ohne exact_date lägen sie übereinander.",
             "task": {"kind": "timeline",
                       "timeline": {"mode": "sort", "scoring": "order",
                                     "axis": {"kind": "year", "min": 1914, "max": 1919},
                                     "items": [
                                         {"id": "sarajevo", "label": "Attentat von Sarajevo",
                                          "value": 1914, "exact_date": "1914-06-28"},
                                         {"id": "kriegserklaerung", "label": "Kriegserklärung an Serbien",
                                          "value": 1914, "exact_date": "1914-07-28"},
                                         {"id": "waffenstillstand", "label": "Waffenstillstand",
                                          "value": 1918, "exact_date": "1918-11-11"}]}},
             "hints": ["Das Attentat war der Auslöser — was kam danach?"]},
            {"id": "tuer", "type": "door", "title": "Die Tür",
             "text": "Löse die letzte Aufgabe.",
             "task": {"kind": "input", "question": "Wie viel ist $12 - 4$?", "accept": ["8"],
                        "easierAlternative": {"kind": "input", "question": "Wie viel ist $10 - 4$?", "accept": ["6"]}},
             "hints": ["Zähl rückwärts von 12."], "onFailReview": ["aufgabe-1"]},
        ],
    }


def _parse_exitgame_json(raw: dict) -> ExitGame:
    errors = _validate_exitgame(raw)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Exitgame-Format", "errors": errors})
    return ExitGame(
        title=raw["title"].strip(),
        description=raw.get("description"),
        subject=(raw.get("subject") or "").strip(),
        grade=raw.get("grade"),
        tags=raw.get("tags") or [],
        data=raw,
    )


@router.post("/api/exitgames/upload", response_model=ExitGameOut, status_code=201)
def upload_exitgame(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    content = file.file.read()
    asset_files: list[tuple[str, bytes]] = []

    if file.filename and file.filename.endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile:
            raise HTTPException(400, "Invalid ZIP file")
        names = zf.namelist()
        json_candidates = [n for n in names if n.endswith("exitgame.json") or n == "exitgame.json"]
        if not json_candidates:
            raise HTTPException(400, "ZIP muss exitgame.json enthalten")
        raw = json.loads(zf.read(json_candidates[0]))
        for name in names:
            if "assets/" in name and not name.endswith("/"):
                asset_files.append((Path(name).name, zf.read(name)))
    else:
        try:
            raw = json.loads(content)
        except json.JSONDecodeError as e:
            raise HTTPException(400, f"Ungültiges JSON: {e}")

    game = _parse_exitgame_json(raw)
    game.created_by = current.id
    db.add(game)
    db.commit()
    db.refresh(game)

    if asset_files:
        asset_dir = EXITGAME_DATA_ROOT / str(game.id) / "assets"
        asset_dir.mkdir(parents=True, exist_ok=True)
        for fname, blob in asset_files:
            (asset_dir / fname).write_bytes(blob)
        game.asset_path = str(EXITGAME_DATA_ROOT / str(game.id))
        db.commit()
        db.refresh(game)

    return _to_out(game)


@router.get("/api/exitgames/{exitgame_id}")
def get_exitgame(exitgame_id: int, db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    g = db.get(ExitGame, exitgame_id)
    if not g:
        raise HTTPException(404, "Exitgame nicht gefunden")
    return {**_to_out(g).model_dump(), "data": g.data}


@router.delete("/api/exitgames/{exitgame_id}", status_code=204)
def delete_exitgame(exitgame_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    g = db.get(ExitGame, exitgame_id)
    if not g:
        raise HTTPException(404, "Exitgame nicht gefunden")
    if g.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    db.delete(g)
    db.commit()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    class_id: int


class SessionOut(BaseModel):
    id: int
    join_code: str
    status: str
    exitgame_id: int
    class_id: int
    attempt_count: int
    created_at: datetime
    closed_at: datetime | None

    model_config = {"from_attributes": True}


def _session_out(s: ExitGameSession) -> SessionOut:
    return SessionOut(
        id=s.id, join_code=s.join_code, status=s.status, exitgame_id=s.exitgame_id,
        class_id=s.class_id, attempt_count=len(s.attempts), created_at=s.created_at,
        closed_at=s.closed_at,
    )


def create_or_reuse_open_session(db: Session, exitgame_id: int, class_id: int, teacher_id: int) -> ExitGameSession:
    """Create (or return the existing open) session for an exitgame+class —
    shared by the REST endpoint and the Stundenplaner tool registry."""
    game = db.get(ExitGame, exitgame_id)
    if not game:
        raise HTTPException(404, "Exitgame nicht gefunden")
    existing = (
        db.query(ExitGameSession)
        .filter_by(exitgame_id=exitgame_id, class_id=class_id, status="open")
        .order_by(ExitGameSession.created_at.desc())
        .first()
    )
    if existing:
        return existing
    session = ExitGameSession(
        exitgame_id=exitgame_id, class_id=class_id, teacher_id=teacher_id,
        join_code=gen_code(db, ExitGameSession, "join_code"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/api/exitgames/{exitgame_id}/sessions", response_model=SessionOut, status_code=201)
def create_session(
    exitgame_id: int, body: SessionCreate,
    db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher),
):
    session = create_or_reuse_open_session(db, exitgame_id, body.class_id, current.id)
    return _session_out(session)


@router.get("/api/exitgames/{exitgame_id}/sessions", response_model=list[SessionOut])
def list_exitgame_sessions(exitgame_id: int, db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    sessions = db.query(ExitGameSession).filter_by(exitgame_id=exitgame_id).order_by(ExitGameSession.created_at.desc()).all()
    return [_session_out(s) for s in sessions]


@router.get("/api/exitgame-sessions/{code}", response_model=SessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    return _session_out(s)


@router.post("/api/exitgame-sessions/{code}/close", response_model=SessionOut)
def close_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    if s.teacher_id != current.id and current.role != "admin":
        raise HTTPException(403)
    s.status = "closed"
    s.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return _session_out(s)


@router.delete("/api/exitgame-sessions/{code}", status_code=204)
def delete_session(code: str, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    if s.teacher_id != current.id and current.role != "admin":
        raise HTTPException(403)
    db.delete(s)
    db.commit()


# ---------------------------------------------------------------------------
# Attempts (self-paced student play)
# ---------------------------------------------------------------------------

def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes for server_default=func.now(); Postgres
    returns aware ones for DateTime(timezone=True). Normalize to aware UTC
    before subtracting so this works under both test (SQLite) and prod."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _attempt_summary(a: ExitGameAttempt) -> dict:
    finished = _aware(a.finished_at) if a.finished_at else datetime.now(timezone.utc)
    elapsed = (finished - _aware(a.started_at)).total_seconds()
    return {
        "id": a.id, "status": a.status, "current_slide_idx": a.current_slide_idx,
        "solved_slide_ids": a.solved_slide_ids, "errors_total": a.errors_total,
        "hints_total": a.hints_total, "easier_taken_total": a.easier_taken_total,
        "elapsed_seconds": round(elapsed), "started_at": a.started_at.isoformat(),
        "finished_at": a.finished_at.isoformat() if a.finished_at else None,
    }


@router.post("/api/exitgame-sessions/{code}/attempts", status_code=201)
def start_or_resume_attempt(
    code: str, db: Session = Depends(get_db), current: Teacher | Student = Depends(get_current_player),
):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    if s.status != "open":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    # The join link is the only gate — any logged-in student, teacher, or
    # admin may start an attempt. session.class_id is a reporting label, not
    # a participation check.

    attempt = db.query(ExitGameAttempt).filter_by(session_id=s.id, **_owner_filter(current)).first()
    if not attempt:
        attempt = ExitGameAttempt(session_id=s.id, **_owner_filter(current))
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        db.add(ExitGameEvent(attempt_id=attempt.id, slide_id=s.exitgame.data["slides"][0]["id"], event_type="view", payload={"slide_index": 0}))
        db.commit()

    return {
        "attempt": _attempt_summary(attempt),
        "exitgame_data": s.exitgame.data,
        "variant_choices": _variant_choices(s.exitgame.data, attempt.id),
    }


class EventIn(BaseModel):
    slide_id: str
    action: str  # view | answer | hint | easier_taken | review_jump
    payload: dict = {}


def _check_task_answer(task: dict, answer) -> bool:
    kind = task.get("kind")
    if kind in ("single", "true_false"):
        correct_texts = {a["text"] for a in task.get("answers", []) if a.get("correct")}
        return str(answer) in correct_texts
    if kind == "multi":
        correct_texts = {a["text"] for a in task.get("answers", []) if a.get("correct")}
        given = set(answer) if isinstance(answer, list) else set()
        return given == correct_texts
    if kind == "input":
        return check_input_answer(task.get("accept", []), answer)
    if kind == "timeline":
        return timeline_engine.check_answer(task.get("timeline") or {}, answer)
    return False


def _resolve_variant(task_def: dict, attempt_id: int, slide_id: str, task_index: int) -> dict:
    """If a task carries a `variants` pool of equivalent alternatives, pick
    one deterministically per attempt (seeded — same student always sees and
    is checked against the same variant; neighbors likely get different ones,
    which makes copying harder). Variant fields override the base task's."""
    variants = task_def.get("variants")
    if not variants:
        return task_def
    idx = random.Random(f"exitgame:{attempt_id}:{slide_id}:{task_index}").randrange(len(variants))
    merged = {**task_def, **variants[idx]}
    merged.pop("variants", None)
    return merged


def _variant_choices(data: dict, attempt_id: int) -> dict[str, int]:
    """The player needs to render the same variant the server will check —
    Python's seeded RNG can't be reproduced in JS, so send the choices."""
    choices: dict[str, int] = {}
    for slide in data["slides"]:
        for i, task in enumerate(_iter_tasks(slide)):
            variants = task.get("variants")
            if variants:
                choices[f"{slide['id']}:{i}"] = random.Random(
                    f"exitgame:{attempt_id}:{slide['id']}:{i}"
                ).randrange(len(variants))
    return choices


def _find_slide(data: dict, slide_id: str) -> dict | None:
    return next((sl for sl in data["slides"] if sl["id"] == slide_id), None)


def _slide_solved(db: Session, attempt: ExitGameAttempt, slide: dict) -> bool:
    """A slide is solved once every task index on it has a recorded 'success' event."""
    tasks = _iter_tasks(slide)
    if not tasks:
        return True
    solved_indices = {
        e.payload.get("task_index", 0)
        for e in db.query(ExitGameEvent).filter_by(attempt_id=attempt.id, slide_id=slide["id"], event_type="success")
    }
    return len(solved_indices) >= len(tasks)


def _hints_shown_for_slide(db: Session, attempt_id: int, slide_id: str) -> int:
    return len({
        e.payload.get("hint_index")
        for e in db.query(ExitGameEvent).filter_by(attempt_id=attempt_id, slide_id=slide_id, event_type="hint")
    })


def _fail_count_for_task(db: Session, attempt_id: int, slide_id: str, task_index: int) -> int:
    # Filtered in Python (per-slide event volume is small) for SQLite/Postgres parity.
    fails = db.query(ExitGameEvent).filter_by(attempt_id=attempt_id, slide_id=slide_id, event_type="fail").all()
    return sum(1 for e in fails if e.payload.get("task_index", 0) == task_index)


def _hint_budget(adaptation: dict | None) -> int:
    if not adaptation:
        return 2  # fixed default when DDA is off, per the reference authoring instructions
    return adaptation.get("contentParams", {}).get("scaffolding_level", {}).get("hintCount", 2)


def _recent_dda_history(db: Session, attempt_id: int) -> list[dict]:
    events = (
        db.query(ExitGameEvent)
        .filter(ExitGameEvent.attempt_id == attempt_id, ExitGameEvent.event_type.in_(["success", "fail"]))
        .order_by(ExitGameEvent.created_at.desc())
        .limit(dda_engine.HISTORY_LIMIT)
        .all()
    )
    history = []
    for e in reversed(events):
        p = e.payload
        history.append(dda_engine.snapshot_from_task_metrics(
            success=e.event_type == "success", time_spent=p.get("time_spent_s", 15),
            errors=p.get("attempt_number", 1) - 1, hints_used=p.get("hints_shown", 0),
            retries=max(0, p.get("attempt_number", 1) - 1),
        ))
    return history


def _participant_key(attempt: ExitGameAttempt) -> str:
    """Unique across both id spaces — a student and a teacher could share a
    numeric id, so a bare student_id can't key the roster on its own."""
    return f"s{attempt.student_id}" if attempt.student_id else f"t{attempt.teacher_id}"


async def _broadcast_progress(code: str, attempt: ExitGameAttempt, total_slides: int, last_event: str):
    await mgr.send_teachers(code, {
        "event": "progress", "participant_key": _participant_key(attempt), "attempt_id": attempt.id,
        "student_name": _participant_name(attempt),
        "student_class": _participant_class(attempt),
        "current_slide_idx": attempt.current_slide_idx, "total_slides": total_slides,
        "status": attempt.status, "last_event_type": last_event,
        "errors_total": attempt.errors_total, "hints_total": attempt.hints_total,
    })


@router.post("/api/exitgame-attempts/{attempt_id}/events")
async def post_event(
    attempt_id: int, body: EventIn,
    db: Session = Depends(get_db), current: Teacher | Student = Depends(get_current_player),
):
    attempt = db.get(ExitGameAttempt, attempt_id)
    if not attempt or not _attempt_belongs_to(attempt, current):
        raise HTTPException(404, "Attempt nicht gefunden")
    if attempt.status != "in_progress":
        raise HTTPException(409, "Dieser Versuch ist bereits abgeschlossen")
    session = attempt.session
    if session.status != "open":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")

    data = session.exitgame.data
    slide = _find_slide(data, body.slide_id)
    if not slide:
        raise HTTPException(404, "Slide nicht gefunden")

    dda_cfg = data.get("dda") or {}
    dda_enabled = bool(dda_cfg.get("enabled", False))
    correct = None
    event_type = body.action

    if body.action == "view":
        attempt.current_slide_idx = body.payload.get("slide_index", attempt.current_slide_idx)

    elif body.action == "answer":
        task_index = body.payload.get("task_index", 0)
        variant = body.payload.get("variant", "normal")
        tasks = _iter_tasks(slide)
        if task_index >= len(tasks):
            raise HTTPException(400, "Ungültiger task_index")
        task_def = _resolve_variant(tasks[task_index], attempt_id, body.slide_id, task_index)
        if variant == "easier":
            task_def = task_def.get("easierAlternative") or task_def
        correct = _check_task_answer(task_def, body.payload.get("answer"))
        prior_fails = _fail_count_for_task(db, attempt_id, body.slide_id, task_index)
        event_type = "success" if correct else "fail"
        body.payload["attempt_number"] = prior_fails + 1
        body.payload["hints_shown"] = _hints_shown_for_slide(db, attempt_id, body.slide_id)
        if not correct:
            attempt.errors_total += 1

    elif body.action == "hint":
        hint_index = body.payload.get("hint_index", 0)
        adaptation = dda_engine.adapt(dda_cfg, _recent_dda_history(db, attempt_id)) if dda_enabled else None
        budget = _hint_budget(adaptation)
        already_shown = _hints_shown_for_slide(db, attempt_id, body.slide_id)
        if hint_index >= budget or hint_index < already_shown:
            raise HTTPException(409, "Hinweisbudget erreicht")
        attempt.hints_total += 1

    elif body.action == "easier_taken":
        attempt.easier_taken_total += 1

    elif body.action == "review_jump":
        pass

    else:
        raise HTTPException(400, "Unbekannte action")

    event = ExitGameEvent(attempt_id=attempt_id, slide_id=body.slide_id, event_type=event_type, payload=body.payload)
    db.add(event)
    # SessionLocal has autoflush=False (api/database.py) — without an explicit
    # flush the event just added is invisible to _slide_solved's query, and the
    # slide only counts as solved on the NEXT request (i.e. after a reload).
    db.flush()

    if event_type == "success" and _slide_solved(db, attempt, slide):
        if body.slide_id not in attempt.solved_slide_ids:
            attempt.solved_slide_ids = [*attempt.solved_slide_ids, body.slide_id]

    db.commit()
    db.refresh(attempt)

    adaptation = None
    if dda_enabled:
        adaptation = dda_engine.adapt(dda_cfg, _recent_dda_history(db, attempt_id))

    await _broadcast_progress(session.join_code, attempt, len(data["slides"]), event_type)

    return {"correct": correct, "adaptation": adaptation, "attempt": _attempt_summary(attempt)}


@router.post("/api/exitgame-attempts/{attempt_id}/finish")
async def finish_attempt(
    attempt_id: int, db: Session = Depends(get_db), current: Teacher | Student = Depends(get_current_player),
):
    attempt = db.get(ExitGameAttempt, attempt_id)
    if not attempt or not _attempt_belongs_to(attempt, current):
        raise HTTPException(404, "Attempt nicht gefunden")
    if attempt.status == "finished":
        return {"attempt": _attempt_summary(attempt), "completion": attempt.session.exitgame.data.get("completion")}

    attempt.status = "finished"
    attempt.finished_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(attempt)

    session = attempt.session
    await _broadcast_progress(session.join_code, attempt, len(session.exitgame.data["slides"]), "finished")

    return {"attempt": _attempt_summary(attempt), "completion": session.exitgame.data.get("completion")}


# ---------------------------------------------------------------------------
# Results: report + detailed per-student log
# ---------------------------------------------------------------------------

@router.get("/api/exitgame-sessions/{code}/report")
def get_session_report(code: str, fmt: str = "json", db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")

    total_slides = len(s.exitgame.data["slides"])
    rows = []
    for a in sorted(s.attempts, key=_participant_name):
        rows.append({
            "attempt_id": a.id, "student_id": a.student_id,
            "student_name": _participant_name(a),
            "student_class": _participant_class(a),
            "status": a.status, "slides_solved": len(a.solved_slide_ids), "slides_total": total_slides,
            "errors_total": a.errors_total, "hints_total": a.hints_total,
            "easier_taken_total": a.easier_taken_total,
            "elapsed_seconds": _attempt_summary(a)["elapsed_seconds"],
        })

    if fmt == "csv":
        import csv as csv_mod
        buf = io.StringIO()
        writer = csv_mod.writer(buf)
        writer.writerow(["Name", "Klasse", "Status", "Gelöst", "Gesamt", "Fehler", "Hinweise", "Erleichterte Aufgaben", "Dauer (s)"])
        for r in rows:
            writer.writerow([r["student_name"], r["student_class"], r["status"], r["slides_solved"], r["slides_total"],
                              r["errors_total"], r["hints_total"], r["easier_taken_total"], r["elapsed_seconds"]])
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            iter([buf.getvalue().encode("utf-8-sig")]), media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="exitgame_{code}.csv"'},
        )

    return {"session_code": code, "exitgame_title": s.exitgame.title, "status": s.status, "attempts": rows}


@router.get("/api/exitgame-attempts/{attempt_id}/log")
def get_attempt_log(attempt_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    a = db.get(ExitGameAttempt, attempt_id)
    if not a:
        raise HTTPException(404, "Attempt nicht gefunden")
    if a.session.teacher_id != current.id and current.role != "admin":
        raise HTTPException(403)
    events = db.query(ExitGameEvent).filter_by(attempt_id=attempt_id).order_by(ExitGameEvent.created_at).all()
    return {
        "attempt": _attempt_summary(a),
        "student_name": _participant_name(a),
        "student_class": _participant_class(a),
        "events": [
            {"slide_id": e.slide_id, "event_type": e.event_type, "payload": e.payload, "created_at": e.created_at.isoformat()}
            for e in events
        ],
    }


# ---------------------------------------------------------------------------
# WebSocket: broadcast-only live teacher dashboard
# ---------------------------------------------------------------------------

@router.websocket("/api/exitgame-sessions/{code}/ws")
async def exitgame_ws(code: str, websocket: WebSocket, db: Session = Depends(get_db)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        await websocket.close(code=4004)
        return
    teacher = ws_teacher(websocket, db)
    if teacher is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    mgr.add_teacher(code, websocket)

    db.expire_all()
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    total_slides = len(s.exitgame.data["slides"])
    await websocket.send_json({
        "event": "roster",
        "status": s.status,
        "attempts": [
            {
                "participant_key": _participant_key(a), "attempt_id": a.id,
                "student_name": _participant_name(a), "student_class": _participant_class(a),
                "current_slide_idx": a.current_slide_idx, "total_slides": total_slides,
                "status": a.status, "errors_total": a.errors_total, "hints_total": a.hints_total,
            }
            for a in s.attempts
        ],
    })

    try:
        while True:
            await websocket.receive_text()  # host sends nothing meaningful; keep connection alive
    except WebSocketDisconnect:
        pass
    finally:
        mgr.remove_teacher(code, websocket)
