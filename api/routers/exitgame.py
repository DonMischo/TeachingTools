"""
TaskCrawler — self-paced, session-based exit game.

Unlike Caputh (teacher-paced lockstep quiz over WebSocket), a student plays
a TaskCrawler entirely on their own timeline: a teacher opens a session
(join_code) nominally attached to a class, and ANY logged-in user with the
code — student, teacher, or admin — can start/resume their own
ExitGameAttempt via plain REST. The link is the only gate: session.class_id
is a reporting label, not a participation check, so a visiting student, a
whole other course, or a teacher trying the game out can all play the same
session. Each attempt steps through explanation/example/task/door slides
authored as one JSON document (ExitGame.data — content shape
ported from the standalone Exitbuilder_text reference: slides of type
explanation|example|task|door, task kinds single|multi|true_false|input,
optional hints[] and an easierAlternative). Solving a task hands out its
optional codeFragment; a door's code is the fragments of the section before
it, so a task left open ("Später lösen") shows up as a missing character at
the door and sends the student back. Every answer is checked
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
import copy
import io
import json
import random
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import challenge_engine as challenge_eng
from .. import challenge_lauf
from ..challenge_lauf import AntwortIn, DeckIn, SKINS as BOSS_SKINS, StartIn
from .. import dda as dda_engine
from .. import exitgame_katalog as katalog
from .. import scoping
from .. import timeline_engine
from .. import karten_quiz as karten_engine
from .karten_quiz import karten_aufloesen
from ..task_generators import check_input_answer
from ..database import get_db
from ..models import ExitGame, ExitGameSession, ExitGameAttempt, ExitGameEvent, Teacher, Student, Class
from ..auth import (
    get_current_teacher, get_current_user, get_current_user_optional,
    get_player, guest_from_credentials, bearer, Guest,
    is_session_owner, require_session_owner,
)
from ..availability import require_capability
from ..authorship import author_fields, scope_to_student_pool, can_modify, is_student
from ..upload_utils import save_image
from ..utils import gen_code
from ..ws_auth import ws_teacher
from ..ws_manager import RoomManager, reject, release_db
from ..display_names import NameScope, short_name

router = APIRouter(tags=["exitgame"])

EXITGAME_DATA_ROOT = Path(__file__).parent.parent.parent / "data" / "exitgames"

ALLOWED_TASK_KINDS = {"single", "multi", "true_false", "input", "timeline", "karte"}

# 2.5D: Werkzeuge ("sim": {"tool", "config"}), Objekte im Zimmer ("station"),
# Ansicht und Stil ("gebaeude": {"ansicht", "stil"}) — alle aus exitgame_katalog.
SIM_TOOLS = set(katalog.WERKZEUGE)
STATION_OBJECTS = set(katalog.OBJEKTE)
GEBAEUDE_ANSICHTEN = set(katalog.ANSICHTEN)
GEBAEUDE_STILE = set(katalog.STILE)
DDA_HISTORY_LIMIT = 50
DDA_RECENT_WINDOW = 10

mgr = RoomManager()

# Challenge-Satz der Boss-Folien in den Vorlagen (Format: siehe Anleitung, Abschnitt BOSS)
VORLAGE_BOSS_SATZ = {
    "facts": [
        {"id": "f1", "text": "Kraft mal Kraftarm gleich Last mal Lastarm"},
        {"id": "f2", "text": "Ein langer Kraftarm spart Kraft"},
        {"id": "f3", "text": "Die Wippe ist ein zweiseitiger Hebel"},
        {"id": "f4", "text": "Die Schubkarre ist ein einseitiger Hebel"},
        {"id": "x1", "text": "Schwere Körper fallen schneller", "decoy": True},
        {"id": "x2", "text": "Ein Hebel erzeugt Energie", "decoy": True},
    ],
    "challenges": [
        {"id": "c1", "text": "Warum hebt eine lange Brechstange den Stein?", "solve": {"all": ["f1", "f2"]},
         "strength": 2, "feedback": "Der lange Kraftarm macht die Kraft größer."},
        {"id": "c2", "text": "Welcher Hebel ist eine Wippe?", "solve": {"any": ["f3"]}},
        {"id": "c3", "text": "Welcher Hebel ist eine Schubkarre?", "solve": {"any": ["f4"]}},
        {"id": "c4", "text": "Wie lautet das Hebelgesetz?", "solve": {"any": ["f1"]}},
        {"id": "c5", "text": "Was spart beim Hebeln Kraft?", "solve": {"any": ["f2"]}},
    ],
}


def _identity_for_attempt(
    attempt: ExitGameAttempt,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> Teacher | Student | Guest | None:
    """Resolve who is calling an attempt-scoped endpoint (path has attempt_id, not
    the session code). A logged-in user, or a guest whose token is scoped to this
    attempt's session code."""
    user = get_current_user_optional(request, credentials, db)
    if user is not None:
        return user
    return guest_from_credentials(credentials, attempt.session.join_code, db)


def _owner_filter(current: Teacher | Student | Guest) -> dict:
    if isinstance(current, Student):
        return {"student_id": current.id}
    if isinstance(current, Guest):
        return {"guest_id": current.id}
    return {"teacher_id": current.id}


def _attempt_belongs_to(attempt: ExitGameAttempt, current: Teacher | Student | Guest) -> bool:
    if isinstance(current, Student):
        return attempt.student_id == current.id
    if isinstance(current, Guest):
        return attempt.guest_id == current.id
    return attempt.teacher_id == current.id


def _participant_name(attempt: ExitGameAttempt, scope=None) -> str:
    """Ohne `scope` die Kurzform — nur wo eine Klassenleitung zusieht, der
    volle Name."""
    if attempt.student:
        return scope.name(attempt.student) if scope is not None else short_name(attempt.student)
    if attempt.guest_id:
        return attempt.guest_name or "Gast"
    return f"{attempt.teacher.first_name} {attempt.teacher.last_name}".strip()


def _participant_class(attempt: ExitGameAttempt) -> str:
    if attempt.student:
        return attempt.student.klasse
    if attempt.guest_id:
        return "Gast"
    return "Lehrkraft"


# ---------------------------------------------------------------------------
# Content validation (hand-rolled — mirrors the referential checks from the
# Exitbuilder_text reference validator, no jsonschema dependency, consistent
# with Caputh's own hand-rolled upload validation elsewhere in this codebase)
# ---------------------------------------------------------------------------

def _iter_tasks(slide: dict) -> list[dict]:
    if slide.get("type") == "boss":
        # Ein Boss ist eine Pseudo-Aufgabe: so greifen Fragmente, Tür und »gelöst« unverändert
        return [{"kind": "boss", **({"codeFragment": slide["codeFragment"]} if slide.get("codeFragment") else {})}]
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
    elif kind == "karte":
        errors.extend(karten_engine.pruefe_einbettung(task.get("karte"), f"{where}.karte"))
    sim = task.get("sim")
    if sim is not None:
        if not isinstance(sim, dict) or sim.get("tool") not in SIM_TOOLS:
            tool = sim.get("tool") if isinstance(sim, dict) else sim
            errors.append(f"{where}: 'sim.tool' '{tool}' gibt es nicht (erlaubt: {', '.join(sorted(SIM_TOOLS))})")
        elif sim.get("config") is not None and not isinstance(sim.get("config"), dict):
            errors.append(f"{where}: 'sim.config' muss ein Objekt sein, z.B. {{\"gleichung\": \"3x + 4 = 19\"}}")
    fragment = task.get("codeFragment")
    if fragment is not None and (not isinstance(fragment, str) or not fragment.strip()):
        errors.append(f"{where}: 'codeFragment' muss ein nicht-leerer Text sein")
    easier = task.get("easierAlternative")
    if easier:
        errors.extend(_task_errors(easier, f"{where}.easierAlternative"))
    return errors


def _boss_standards(slide: dict) -> dict:
    """Die Vorgaben einer Boss-Folie mit Standardwerten — die eine Stelle, an der sie stehen."""
    spiel = slide.get("spiel", "boss")
    return {"spiel": spiel, "spiele": slide.get("spiele") or [spiel], "skin": slide.get("skin", "monster"),
            "theme": slide.get("theme", "klassisch"), "startstufe": slide.get("startstufe", challenge_lauf.STANDARD_STARTSTUFE),
            "etappenMischen": slide.get("etappenMischen") is True}


def _boss_errors(slide: dict, where: str) -> list[str]:
    fehler: list[str] = []
    challenge = slide.get("challenge")
    if not isinstance(challenge, dict):
        return [f"{where}: ein Boss braucht 'challenge' (ein Challenge-Satz)"]
    f, _ = challenge_eng.pruefe_satz({"title": slide.get("title") or "Boss", **challenge})
    fehler += [f"Folie »{slide.get('id')}«: {m}" for m in f]
    spiel = _boss_standards(slide)["spiel"]
    spiele = slide.get("spiele")
    if spiel not in challenge_eng.SPIELE:
        fehler.append(f"{where}: spiel '{spiel}' gibt es nicht (erlaubt: {', '.join(challenge_eng.SPIELE)})")
    if spiele is not None and (not isinstance(spiele, list) or not set(spiele) <= set(challenge_eng.SPIELE)):
        fehler.append(f"{where}: spiele muss eine Liste aus {', '.join(challenge_eng.SPIELE)} sein")
    elif "gericht" in [spiel, *(spiele or [])] and not challenge.get("claims"):
        fehler.append(f"{where}: das Spiel 'gericht' braucht 'claims' im Challenge-Satz")
    if slide.get("skin") is not None and slide["skin"] not in BOSS_SKINS:
        fehler.append(f"{where}: skin '{slide['skin']}' gibt es nicht (erlaubt: {', '.join(BOSS_SKINS)})")
    if slide.get("theme") is not None and slide["theme"] not in challenge_eng.THEMES:
        fehler.append(f"{where}: theme '{slide['theme']}' gibt es nicht (erlaubt: {', '.join(challenge_eng.THEMES)})")
    stufe = slide.get("startstufe")
    if stufe is not None and (type(stufe) is not int or not 1 <= stufe <= 4):
        fehler.append(f"{where}: startstufe muss 1 bis 4 sein")
    if slide.get("etappenMischen") is not None and not isinstance(slide["etappenMischen"], bool):
        fehler.append(f"{where}: etappenMischen muss true oder false sein")
    frag = slide.get("codeFragment")
    if frag is not None and (not isinstance(frag, str) or not frag.strip()):
        fehler.append(f"{where}: codeFragment muss ein nicht-leerer Text sein")
    return fehler


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
    gebaeude = data.get("gebaeude")
    if gebaeude is not None:
        if not isinstance(gebaeude, dict):
            errors.append("'gebaeude' muss ein Objekt sein, z.B. {\"ansicht\": \"verlies\", \"stil\": \"verlies\"}")
        else:
            if gebaeude.get("ansicht") is not None and gebaeude["ansicht"] not in GEBAEUDE_ANSICHTEN:
                errors.append(f"gebaeude.ansicht '{gebaeude['ansicht']}' gibt es nicht (erlaubt: {', '.join(sorted(GEBAEUDE_ANSICHTEN))})")
            if gebaeude.get("stil") is not None and gebaeude["stil"] not in GEBAEUDE_STILE:
                errors.append(f"gebaeude.stil '{gebaeude['stil']}' gibt es nicht (erlaubt: {', '.join(sorted(GEBAEUDE_STILE))})")
            stile = gebaeude.get("stile")
            if stile is not None:
                if not isinstance(stile, list):
                    errors.append("gebaeude.stile muss eine Liste sein, ein Stil je Abschnitt, z.B. [\"steinzeit\", \"gotisch\"]")
                else:
                    for n, s in enumerate(stile, 1):
                        if s not in GEBAEUDE_STILE:
                            errors.append(f"gebaeude.stile[{n}] '{s}' gibt es nicht (erlaubt: {', '.join(sorted(GEBAEUDE_STILE))})")
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
        if stype not in ("explanation", "example", "task", "door", "boss"):
            errors.append(f"{where}: unbekannter type '{stype}'")
            continue

        if stype == "door" and slide.get("code"):
            errors.append(f"{where}: 'code' auf einer Tür wird nicht mehr unterstützt — vergib "
                          f"'codeFragment' an den Aufgaben vor der Tür, der Türcode setzt sich daraus zusammen")
        if stype == "task" and not (slide.get("task") or slide.get("tasks")):
            errors.append(f"{where}: 'task' braucht 'task' oder 'tasks'")
        sicherung = slide.get("ergebnissicherung")
        if sicherung is not None and (not isinstance(sicherung, str) or not sicherung.strip() or len(sicherung) > 3000):
            errors.append(f"{where}: 'ergebnissicherung' muss ein Text sein (höchstens 3000 Zeichen)")
        station = slide.get("station")
        if station is not None and station not in STATION_OBJECTS:
            errors.append(f"{where}: 'station' '{station}' gibt es nicht (erlaubt: {', '.join(sorted(STATION_OBJECTS))})")

        if stype == "boss":
            errors.extend(_boss_errors(slide, where))
            continue
        for j, task in enumerate(_iter_tasks(slide)):
            errors.extend(_task_errors(task, f"{where}.tasks[{j}]"))

    for i, slide in enumerate(slides):
        if not isinstance(slide, dict):
            continue
        if slide.get("type") == "door" and not _iter_tasks(slide) and not _fragment_tasks(slides, i):
            errors.append(f"slides[{i}]: 'door' braucht 'task'/'tasks' oder mindestens ein "
                          f"'codeFragment' an einer Aufgabe davor")
        for target in slide.get("onFailReview") or []:
            if target not in seen_ids:
                errors.append(f"slides[{i}]: onFailReview verweist auf unbekannte slide-id '{target}'")

    return errors


# ---------------------------------------------------------------------------
# Türcodes: jede Aufgabe kann ein 'codeFragment' vergeben, das der Schüler beim
# richtigen Lösen einsammelt. Der Code einer Tür ist die Aneinanderreihung der
# Fragmente des Abschnitts davor (seit der vorigen Tür) — er ist also erst
# vollständig, wenn alle Aufgaben des Abschnitts gelöst sind.
# ---------------------------------------------------------------------------

def _fragment_tasks(slides: list, door_index: int) -> list[tuple[str, int, dict]]:
    """(slide_id, task_index, task) für jede Aufgabe mit 'codeFragment' im
    Abschnitt vor dieser Tür, in Lesereihenfolge."""
    start = 0
    for i in range(door_index - 1, -1, -1):
        if isinstance(slides[i], dict) and slides[i].get("type") == "door":
            start = i + 1
            break
    out: list[tuple[str, int, dict]] = []
    for slide in slides[start:door_index]:
        if not isinstance(slide, dict) or not slide.get("id"):
            continue
        for idx, task in enumerate(_iter_tasks(slide)):
            frag = task.get("codeFragment")
            if isinstance(frag, str) and frag.strip():
                out.append((slide["id"], idx, task))
    return out


def _task_for_player(task: dict) -> dict:
    """Eine Aufgabe ohne Lösung: keine 'correct'-Marken, keine 'accept'-Liste,
    beim Zeitstrahl nur das Brett (wie bei Caputh). Geprüft wird ohnehin auf
    dem Server — der Spieler braucht davon nichts. Gilt auch für 'variants'
    (Teilaufgaben) und 'easierAlternative'. 'codeFragment' bleibt: die Tür
    geht nur mit selbst verdienten Schnipseln auf, der Text allein hilft nicht."""
    out = {k: v for k, v in task.items() if k != "accept"}
    if isinstance(out.get("answers"), list):
        out["answers"] = [{k: v for k, v in a.items() if k != "correct"} if isinstance(a, dict) else a
                          for a in out["answers"]]
    if isinstance(out.get("timeline"), dict):
        out["timeline"] = timeline_engine.sanitized_board(out["timeline"])
    if out.get("kind") == "karte" and isinstance(out.get("karte"), dict):
        # Karte ohne Namen und ohne Geheimnis, Objekte als Token
        out["karte"] = karten_engine.brett_fuer_spieler(out["karte"])
    if isinstance(out.get("variants"), list):
        out["variants"] = [_task_for_player(v) if isinstance(v, dict) else v for v in out["variants"]]
    if isinstance(out.get("easierAlternative"), dict):
        out["easierAlternative"] = _task_for_player(out["easierAlternative"])
    return out


def _data_for_player(data: dict) -> dict:
    """Was Schüler und Gäste beim Start bekommen: das Spiel ohne Lösungen,
    ohne 'completion' (der Exit-Code kommt erst mit /finish) und ohne
    'ergebnissicherung' (die verrät oft die Antwort — sie kommt mit /finish)."""
    slides = []
    for slide in data.get("slides") or []:
        if not isinstance(slide, dict):
            continue
        s = {k: v for k, v in slide.items() if k != "ergebnissicherung"}
        if s.get("type") == "boss":
            standards = _boss_standards(s)
            s = {k: v for k, v in s.items() if k not in ("challenge", "codeFragment")}
            s.update(bossFragment=bool(slide.get("codeFragment")),
                     **{k: v for k, v in standards.items() if k != "startstufe"})
            slides.append(s)
            continue
        if isinstance(s.get("task"), dict):
            s["task"] = _task_for_player(s["task"])
        if isinstance(s.get("tasks"), list):
            s["tasks"] = [_task_for_player(t) if isinstance(t, dict) else t for t in s["tasks"]]
        slides.append(s)
    return {**{k: v for k, v in data.items() if k != "completion"}, "slides": slides}


def _normalize_code(value) -> str:
    """Leerzeichen, Bindestriche und Groß/Kleinschreibung sind beim Türcode egal."""
    return re.sub(r"[\s\-_]", "", str(value or "")).lower()


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
def list_exitgames(db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = scope_to_student_pool(db.query(ExitGame), ExitGame, current)
    games = q.order_by(ExitGame.created_at.desc()).all()
    return [_to_out(g) for g in games]


@router.get("/api/exitgames/template")
def download_template(_: Teacher = Depends(get_current_teacher)):
    """The Vorlage a teacher downloads and hands to an AI. It is a feature
    showcase: every element the format supports appears exactly once, so the
    instructions can stay short and the example carries the detail."""
    return {
        "_ai_instructions": (
            "Fülle dieses JSON mit deinem eigenen Thema. Die Vorlage zeigt jeden Baustein des Formats genau "
            "einmal — kopiere, was du brauchst, und lösche den Rest. Pflicht sind nur title, subject, slides; "
            "subject/grade/tags sind Freitext (grade z.B. '7', '5,6,7' oder '5-10'), completion.code ist der "
            "Exit-Code am Ende. Ein Spiel hat meist 8-15 Slides und muss nicht alle Aufgabenarten nutzen. "
            "--- SLIDES --- 'explanation' und 'example': nur lesen, Weiter-Button. 'task': muss gelöst werden "
            "('task' für eine Aufgabe, 'tasks' für mehrere auf einer Slide — dann müssen alle stimmen). "
            "'door': Abschluss eines Abschnitts — schwerere Transferaufgabe und/oder Codeschloss; "
            "'onFailReview' verlinkt nach 2 Fehlversuchen zurück auf frühere Slides. Slide-IDs eindeutig, "
            "Aufbau: erklären -> zeigen -> üben -> Tür. 'boss': Kampf-Folie aus einem Challenge-Satz (siehe BOSS). Schüler dürfen eine Aufgabe mit »Später lösen« offen "
            "lassen — was fehlt, fällt spätestens an der Tür auf. "
            "--- TÜRCODE --- Jede Aufgabe kann ein 'codeFragment' vergeben (z.B. \"HE\"), das der Schüler beim "
            "richtigen Lösen einsammelt. Der Code einer Tür ist die Aneinanderreihung der Fragmente des "
            "Abschnitts davor (seit der vorigen Tür) in Lesereihenfolge; an der Tür tippt der Schüler ihn ein, "
            "geprüft wird serverseitig (Groß/Klein, Leerzeichen und Bindestriche egal). Abschreiben nützt "
            "nichts: die Tür geht nur auf, wenn der Schüler alle Schnipsel des Abschnitts selbst "
            "eingesammelt hat — sonst zeigt sie genau die offenen Aufgaben als Rücksprung-Links. "
            "Sinnvoll sind 3-6 Fragmente pro "
            "Abschnitt. Davon unabhängig ist completion.code: der Code, den die Schüler am Ende der Lehrkraft "
            "zeigen. "
            "--- ERGEBNISSICHERUNG --- Jede Slide kann 'ergebnissicherung' tragen: 1-3 Sätze, was nach dem "
            "Spiel hängen bleiben soll (Merksatz, Regel, Formel in $…$, Stichpunkte mit '- ' am Zeilenanfang). "
            "Am Ende lädt der Schüler alle Merksätze als gestaltetes PDF herunter, nach Abschnitten sortiert. "
            "Sie werden erst nach dem Spiel ausgeliefert, dürfen also die Lösung enthalten. Sinnvoll an jeder "
            "Aufgabe und an wichtigen Erklärungen. "
            "--- AUFGABEN (task.kind) --- 'single' (genau eine Antwort richtig), 'multi' (die Auswahl muss "
            "exakt der Menge der richtigen Antworten entsprechen), 'true_false' (zwei Antworten), 'input' "
            "(accept = Liste akzeptierter Antworten; Groß/Klein und Komma vs. Punkt sind egal, pro Zahl "
            "reicht eine Schreibweise, bei Wörtern alle sinnvollen Formulierungen auflisten), 'timeline' "
            "(Zeit-/Zahlenstrahl), 'karte' (Kartenquiz: \"karte\": {\"satz\": <Kartensatz-Id>, \"modus\": "
            "\"benennen\"|\"finden\", \"wortbank\": true|false, \"mindestens\": 0.5–1.0} — gelöst ab diesem Anteil "
            "richtiger Objekte). Andere Arten gibt es nicht. "
            "--- TIMELINE --- axis: {kind 'year'|'number', min, max, step?, unit?}. mode 'sort': Items an die "
            "richtige Stelle ziehen — scoring 'position' (tolerance = erlaubte Abweichung in Achseneinheiten, "
            "0 = exakt) oder 'order' (nur die Reihenfolge zählt, fair bei unsicheren Jahreszahlen). mode "
            "'spot': Items stehen bei 'value', die falsch platzierten tragen ihren wahren Wert in 'actual' "
            "und sollen markiert werden (mindestens eines). Jahre v. Chr. sind negativ. 'exact_date' "
            "('JJJJ', 'JJJJ-MM' oder 'JJJJ-MM-TT', nur n. Chr., Jahr muss zu 'value' passen) ist nötig, "
            "sobald zwei Items im selben Jahr liegen; bei 'spot' steht das wahre Datum in "
            "'exact_date_actual'. "
            "--- HILFEN --- 'hints': geordnete Liste pro Slide (2-4), vom sanften Schubser bis fast zur "
            "Lösung; der Hinweis-Button erscheint erst nach einem Fehlversuch. 'easierAlternative' (Aufbau "
            "wie 'task'): leichtere Fassung, wird als Ja/Nein-Angebot vorgeschlagen, sobald der Schüler 2x "
            "falsch lag und seine Hinweise verbraucht hat. 'variants': gleichwertige Fassungen derselben "
            "Aufgabe (nur die abweichenden Felder); jeder Schüler bekommt fest eine zugelost — "
            "Abschreibschutz, lohnt sich bei wichtigen Aufgaben. 'extraExample' (Text pro Slide): ein "
            "zweites durchgerechnetes Beispiel für Schüler, deren Stufe es vorsieht. "
            "--- DDA --- dda.levels ist die Differenzierungsleiter dieses Spiels: mindestens 3, empfohlen 5 "
            "Stufen von wenig zu viel Unterstützung. Das Spiel stuft jeden Schüler laufend nach Antwortzeit, "
            "Fehlern und Hinweisnutzung in eine Stufe ein. Jede Stufe steuert: 'hintCount' = wie viele hints "
            "freigegeben werden, 'timeLimitSeconds' = sichtbare Richtzeit pro Aufgabe (kein Abbruch — läuft "
            "sie ab, wird ein Hinweis vorzeitig frei), 'extraExample' = ob das 'extraExample' der Slide nach "
            "einem Fehlversuch eingeblendet wird, 'offerEasier' = ob die easierAlternative überhaupt "
            "angeboten wird. Ohne dda-Feld: feste 2 Hinweise pro Slide, keine Richtzeit. "
            "--- MEDIEN --- media, eine pro Slide: 'image' (Dateiname aus dem assets/-Ordner des ZIPs oder "
            "Bild-URL), 'video' (YouTube-/Vimeo-Link), 'html' (URL einer einbettbaren Simulation). 'height' "
            "in px begrenzt die Höhe (bei Bildern die maximale Höhe — für Piktogramme z.B. 180, sonst füllen "
            "sie die ganze Spalte). "
            "--- STYLE --- theme: 'dark', 'christmas', 'halloween', 'pirate', 'cyberpunk'; font: "
            "CSS-Schriftfamilie; customVars: einzelne Farben ('--accent', '--bg', '--surface', '--text'), "
            "die das theme überschreiben. Gilt nur für die Spielansicht der Schüler. "
            "--- MATHE --- KaTeX: die zu lösende Formel immer abgesetzt ($$...$$), inline ($...$) nur für "
            "einzelne Symbole, Dezimalkomma als $3{,}14$. "
            "--- 2.5D --- Gebäude, Verlies, Ebene, Stationen und Werkzeuge (Simulationen) stehen in der "
            "»Vorlage interaktiv«. "
            "--- BOSS --- Eine Folie 'type': 'boss' hat 'challenge' (Pflicht), optional 'spiel' (Standard 'boss'), "
            "'spiele' (Liste, aus der der Schüler wählt), 'skin' (monster, rap, prinzessin, einhorn), 'theme' "
            "(klassisch, wald, ninja, verlies, antike, weltraum), 'startstufe' (1-4, Standard 2), 'codeFragment' und "
            "'station'. Spielarten: normal, karten, boss, huepfen, turm, detektiv, alchemie, bruecke, gericht, gluecksrad "
            "('gericht' nur mit 'claims'). 'challenge' ist ein Satz aus 'facts' (Wissensbausteine, 'decoy': true = "
            "Ablenker), 'challenges' (Aufgaben mit 'solve': {'all': [fakt-ids]} oder {'any': [...]}, 'strength', "
            "'stage' = Etappe, 'feedback'), optional 'stages', 'levels' (Anpassungen je Stufe) und 'claims' "
            "(Behauptungen mit 'refutedBy' für den Gerichtssaal). Plane mindestens 5 Challenges je Etappe, "
            "einen Kombo (solve 'all') und 2 Ablenker. Der Boss ist besiegt, wenn alle Challenges gelöst sind; "
            "dann gilt sein codeFragment als eingesammelt. "
            "--- UPLOAD --- .json, oder .zip mit taskcrawler.json und einem Ordner assets/ für eigene Bilder. "
            "--- REGELN --- Keine Lösung in Fragen, Antworten oder Bildern verraten. Jede task-Slide braucht "
            "eine Aufgabe, jede Tür eine Aufgabe ODER Codeschnipsel davor (ein Feld 'code' an der Tür gibt es "
            "nicht mehr). onFailReview nur auf vorhandene Slide-IDs."
        ),
        "id": "vorlage-alle-bausteine",
        "title": "Vorlage: alle Bausteine (Hebelgesetz)",
        "description": "Zeigt jeden Baustein des Formats genau einmal.",
        "subject": "physik",
        "grade": "7,8",
        "tags": ["vorlage", "physik", "hebel"],
        "style": {"theme": "dark", "font": "Georgia, serif", "customVars": {"--accent": "#22c55e"}},
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
        "completion": {"message": "Geschafft! Du hast die Werkstatt verlassen.", "code": "WERKSTATT-7"},
        "slides": [
            # explanation + media kind "video"
            {"id": "intro", "type": "explanation", "title": "Willkommen in der Werkstatt",
             "text": "Du bist in der alten Werkstatt eingeschlossen. Sammle bei den Aufgaben die "
                     "Codeschnipsel ein — zusammen öffnen sie die Tür.\n"
                     "(Video-Link ersetzen oder das media-Feld löschen.)",
             "media": {"kind": "video", "src": "https://www.youtube.com/watch?v=DEINE-VIDEO-ID"}},

            # example + media kind "image" (Datei aus assets/ im ZIP) + KaTeX
            {"id": "beispiel", "type": "example", "title": "So funktioniert der Hebel",
             "text": "Ein Hebel ist im Gleichgewicht, wenn Masse mal Abstand auf beiden Seiten gleich ist:\n"
                     "$$m_1 \\cdot a_1 = m_2 \\cdot a_2$$\n"
                     "Dabei ist $a$ der Abstand vom Drehpunkt: $2$ kg bei $30$ cm halten $3$ kg bei "
                     "$20$ cm im Gleichgewicht.",
             "media": {"kind": "image", "src": "hebel.svg",
                       "alt": "Zweiseitiger Hebel mit Drehpunkt in der Mitte"}},

            # task kind "single" + variants (Abschreibschutz) + hints
            {"id": "einfachauswahl", "type": "task", "title": "Aufgabe: eine richtige Antwort",
             "text": "Wähle die richtige Antwort.",
             "extraExample": "Wippe: Ein Kind mit $20$ kg sitzt $2$ m vom Drehpunkt entfernt "
                             "($20 \\cdot 2 = 40$). Ein Kind mit $40$ kg muss dafür bei $1$ m sitzen.",
             "ergebnissicherung": "Hebelgesetz: Je weiter weg vom Drehpunkt du drückst, desto weniger Kraft "
                                  "brauchst du.\n- $\\text{Kraft} \\cdot \\text{Kraftarm} = \\text{Last} \\cdot \\text{Lastarm}$",
             "task": {"kind": "single", "codeFragment": "HE",
                      "variants": [
                          {"question": "Wo musst du drücken, damit es am leichtesten geht?",
                           "answers": [{"text": "weit außen, weit weg vom Drehpunkt", "correct": True},
                                       {"text": "direkt am Drehpunkt", "correct": False},
                                       {"text": "Der Ort spielt keine Rolle.", "correct": False}]},
                          {"question": "Warum ist eine lange Brechstange praktischer als eine kurze?",
                           "answers": [{"text": "Der größere Abstand verstärkt die Kraft.", "correct": True},
                                       {"text": "Sie ist schwerer.", "correct": False},
                                       {"text": "Sie ist aus härterem Stahl.", "correct": False}]},
                          {"question": "Was passiert, wenn du ein Gewicht näher an den Drehpunkt schiebst?",
                           "answers": [{"text": "Seine Wirkung wird kleiner.", "correct": True},
                                       {"text": "Seine Wirkung wird größer.", "correct": False},
                                       {"text": "Nichts ändert sich.", "correct": False}]},
                      ]},
             "hints": ["Denk an eine Wippe: Wo sitzt das leichtere Kind?",
                       "Es zählt nicht die Masse allein, sondern Masse mal Abstand."]},

            # task kind "multi" + media kind "html" (einbettbare Simulation)
            {"id": "mehrfachauswahl", "type": "task", "title": "Aufgabe: mehrere richtige Antworten",
             "text": "Probiere es in der Simulation aus und kreuze ALLE richtigen Aussagen an.",
             "media": {"kind": "html",
                       "src": "https://phet.colorado.edu/sims/html/balancing-act/latest/balancing-act_de.html",
                       "height": 420},
             "task": {"kind": "multi", "codeFragment": "BE",
                      "question": "Welche Aussagen über den Hebel stimmen?",
                      "answers": [
                          {"text": "Je weiter außen ein Gewicht liegt, desto stärker wirkt es.", "correct": True},
                          {"text": "Gleiche Massen im gleichen Abstand halten sich im Gleichgewicht.", "correct": True},
                          {"text": "Nur die Masse zählt, der Abstand ist egal.", "correct": False},
                          {"text": "Ein leichtes Gewicht kann ein schweres nie ausgleichen.", "correct": False},
                      ]},
             "hints": ["Schiebe ein Gewicht nach außen und beobachte die Waage.",
                       "Vergleiche das Produkt aus Masse und Abstand auf beiden Seiten."]},

            # eine Slide mit MEHREREN Aufgaben ("tasks"): true_false + input
            {"id": "arbeitsblatt", "type": "task", "title": "Kurzes Arbeitsblatt",
             "text": "Löse beide Aufgaben — erst dann geht es weiter.",
             "tasks": [
                 {"kind": "true_false",
                  "question": "Ein Gewicht doppelt so weit außen wirkt doppelt so stark.",
                  "answers": [{"text": "Wahr", "correct": True}, {"text": "Falsch", "correct": False}]},
                 {"kind": "input",
                  "question": "Links hängen $3$ kg im Abstand $40$ cm, rechts hängt ein Gewicht bei "
                              "$60$ cm. Wie schwer ist es (in kg)?",
                  "accept": ["2"]},
             ],
             "hints": ["Stelle die Gleichung $$m_1 \\cdot a_1 = m_2 \\cdot a_2$$ auf.",
                       "$3 \\cdot 40 = m_2 \\cdot 60$ — teile durch $60$."]},

            # timeline: mode "sort", scoring "position" — Zahlenstrahl mit Einheit und Toleranz
            {"id": "zahlenstrahl", "type": "task", "title": "Zahlenstrahl",
             "text": "Ziehe die Abstände an die richtige Stelle des Maßbands.",
             "task": {"kind": "timeline", "codeFragment": "L",
                      "timeline": {"mode": "sort", "scoring": "position", "tolerance": 2,
                                   "axis": {"kind": "number", "min": 0, "max": 100, "step": 5, "unit": "cm"},
                                   "items": [{"id": "a", "label": "25 cm", "value": 25},
                                             {"id": "b", "label": "60 cm", "value": 60},
                                             {"id": "c", "label": "85 cm", "value": 85}]}},
             "hints": ["Wo liegt die Mitte des Maßbands?"]},

            # timeline: mode "sort", scoring "order" — Jahresachse mit negativen Jahren (v. Chr.)
            {"id": "zeitstrahl-antike", "type": "task", "title": "Zeitstrahl: nur die Reihenfolge zählt",
             "text": "Bringe die Ereignisse der Antike in die richtige Reihenfolge. "
                     "Die genauen Jahreszahlen musst du nicht kennen.",
             "task": {"kind": "timeline",
                      "timeline": {"mode": "sort", "scoring": "order",
                                   "axis": {"kind": "year", "min": -800, "max": -100},
                                   "items": [
                                       {"id": "rom", "label": "Sagenhafte Gründung Roms", "value": -753},
                                       {"id": "marathon", "label": "Schlacht bei Marathon", "value": -490},
                                       {"id": "archimedes", "label": "Archimedes beschreibt den Hebel", "value": -250}]}},
             "hints": ["Rom wurde der Sage nach im 8. Jahrhundert v. Chr. gegründet.",
                       "Archimedes lebte am Ende dieser Reihe."]},

            # timeline: mode "spot" — falsch platziertes Ereignis finden, taggenaue Daten
            {"id": "fehlersuche", "type": "task", "title": "Zeitstrahl: Fehler finden",
             "text": "Ein Ereignis steht an der falschen Stelle. Markiere es.",
             "task": {"kind": "timeline",
                      "timeline": {"mode": "spot",
                                   "axis": {"kind": "year", "min": 1940, "max": 2000},
                                   "items": [
                                       {"id": "grundgesetz", "label": "Grundgesetz tritt in Kraft",
                                        "value": 1949, "exact_date": "1949-05-23"},
                                       {"id": "mauerfall", "label": "Fall der Berliner Mauer",
                                        "value": 1961, "exact_date": "1961-08-13",
                                        "actual": 1989, "exact_date_actual": "1989-11-09"},
                                       {"id": "mondlandung", "label": "Erste Mondlandung",
                                        "value": 1969, "exact_date": "1969-07-20"}]}},
             "hints": ["1961 wurde die Mauer gebaut — nicht geöffnet."]},

            # boss: Kampf aus einem Challenge-Satz; sein codeFragment gehört zum Türcode
            {"id": "boss", "type": "boss", "title": "Der Hebel-Drache",
             "text": "Besiege den Drachen mit deinem Wissen!",
             "challenge": VORLAGE_BOSS_SATZ, "spiel": "boss", "skin": "monster", "theme": "verlies",
             "startstufe": 2, "codeFragment": "DR"},

            # door: Transferaufgabe + Codeschloss aus den Schnipseln davor
            # (HE + BE + L + DR) + easierAlternative + onFailReview
            {"id": "tuer", "type": "door", "title": "Die Tür",
             "text": "Löse die letzte Aufgabe und gib die eingesammelten Codeschnipsel ein.",
             "task": {"kind": "single",
                      "question": "Links hängen $4$ kg im Abstand $30$ cm, rechts hängt ein Gewicht im "
                                  "Abstand $60$ cm.\n$$4 \\cdot 30 = m_2 \\cdot 60$$\nWie schwer ist es?",
                      "answers": [{"text": "2 kg", "correct": True},
                                  {"text": "4 kg", "correct": False},
                                  {"text": "8 kg", "correct": False}],
                      "easierAlternative": {
                          "kind": "single",
                          "question": "Links hängen $2$ kg im Abstand $20$ cm, rechts hängt ein Gewicht "
                                      "bei $40$ cm. Wie schwer ist es?",
                          "answers": [{"text": "1 kg", "correct": True},
                                      {"text": "2 kg", "correct": False},
                                      {"text": "4 kg", "correct": False}]}},
             "hints": ["Doppelter Abstand bedeutet halbe Masse.",
                       "Rechne $4 \\cdot 30 = 120$ und teile durch $60$."],
             "onFailReview": ["beispiel", "arbeitsblatt"]},
        ],
    }


def _parse_exitgame_json(raw: dict) -> ExitGame:
    errors = _validate_exitgame(raw)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges TaskCrawler-Format", "errors": errors})
    return ExitGame(
        title=raw["title"].strip(),
        description=raw.get("description"),
        subject=(raw.get("subject") or "").strip(),
        grade=raw.get("grade"),
        tags=raw.get("tags") or [],
        data=raw,
    )


@router.post("/api/exitgames/upload", response_model=ExitGameOut, status_code=201, dependencies=[Depends(require_capability("exitgame", "upload"))])
def upload_exitgame(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    content = file.file.read()
    asset_files: list[tuple[str, bytes]] = []

    if file.filename and file.filename.endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(content))
        except zipfile.BadZipFile:
            raise HTTPException(400, "Invalid ZIP file")
        names = zf.namelist()
        # taskcrawler.json (neu) oder exitgame.json (ältere ZIPs)
        json_candidates = [n for n in names if n.endswith(("taskcrawler.json", "exitgame.json"))]
        if not json_candidates:
            raise HTTPException(400, "ZIP muss taskcrawler.json enthalten")
        raw = json.loads(zf.read(json_candidates[0]))
        for name in names:
            if "assets/" in name and not name.endswith("/"):
                asset_files.append((Path(name).name, zf.read(name)))
    else:
        try:
            raw = json.loads(content)
        except json.JSONDecodeError as e:
            raise HTTPException(400, f"Ungültiges JSON: {e}")

    karten_aufloesen(raw, db, current)
    game = _parse_exitgame_json(raw)
    for k, v in author_fields(current).items():
        setattr(game, k, v)
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


ANLEITUNG_25D = (
    "Das ist die interaktive Vorlage: dasselbe Format wie die schlanke »Vorlage«, dazu alles für die "
    "2.5D-Ansicht. Das Beispiel ist ein spielbares Verlies mit zwei Ebenen — ersetze Thema, Aufgaben "
    "und Codes, behalte den Aufbau. Alle erlaubten Werte stehen in '_katalog' direkt unter dieser "
    "Anleitung (Ansichten, Stile, Objekte, Werkzeuge mit ihren config-Schlüsseln). "
    "--- WERKZEUGE --- Eine Aufgabe kann eine Simulation als Werkzeug öffnen: "
    "\"sim\": {\"tool\": …, \"config\": {…}} in der task (Werkzeuge und Schlüssel: _katalog['task.sim']; "
    "'?' = optional, 'a|b' = einer dieser Werte). Die Simulation öffnet sich dann nur mit dieser einen "
    "Vorgabe (keine anderen Aufgaben, kein Reiterwechsel); die Antwort tippt der Schüler danach wie "
    "gewohnt ein — also immer zusätzlich kind 'input' oder 'single' mit Lösung angeben. Beispiele: "
    "{\"tool\": \"gleichungswaage\", \"config\": {\"gleichung\": \"3x + 4 = 19\"}}, "
    "{\"tool\": \"vierecke\", \"config\": {\"form\": \"trapez\", \"masse\": {\"a\": 8, \"c\": 4, \"h\": 3}}}, "
    "{\"tool\": \"sonnensystem\", \"config\": {\"reiter\": \"kepler\"}}. "
    "Für Zeitstrahl-Aufgaben gibt es kein Werkzeug, sondern kind 'timeline' (siehe unten). "
    "--- GEBÄUDE --- Jedes Spiel lässt sich als Folien oder in 2.5D spielen. 'gebaeude' legt fest: "
    "{\"ansicht\": …, \"stil\": …} (Werte: _katalog['gebaeude.ansicht'] und ['gebaeude.stil']). Was hier "
    "steht, ist fest — die Schüler bekommen dafür keine Auswahl. Fehlt ein Feld, wählen die Schüler "
    "selbst (Ansicht: Folien/Gebäude/Verlies/Ebene, Stil: alle Stile). Jeder Abschnitt kann einen eigenen "
    "Stil bekommen: \"stile\": [\"steinzeit\", \"gotisch\", \"viktorianisch\", \"retro\", \"neon\"] "
    "(einer je Abschnitt in Reihenfolge; fehlt einer, gilt 'stil') — z.B. eine Reise durch die Epochen. "
    "Jeder Abschnitt (alles bis einschließlich einer Tür) wird ein Stockwerk/eine Ebene/ein Bereich, "
    "jede Slide davor ein Zimmer, die Tür wird Treppe bzw. Tür — bewacht von einem Boss im Verlies. "
    "Zurück geht es jederzeit. 3-6 Zimmer pro Abschnitt sind gut; die Zimmer sind 1-9 nummeriert "
    "(Zifferntasten laufen hin). 'station' an der Slide wählt das Objekt im Zimmer "
    "(_katalog['slide.station']) — das Objekt spricht dann selbst (»Das Telefon klingelt …«), also passt "
    "es zum Inhalt: Telefon, Radio, Schriftrolle, Smartphone … Ohne Angabe: Werkzeug → passendes Gerät "
    "(Waage, Abakus …), Zeitstrahl → kalender, sonst reihum wechselnde Objekte, im Verlies jede übrige "
    "Aufgabe → monster. Gelöste Monster liegen besiegt am Boden. "
    "Eine Aufgabe ohne 'codeFragment' ist freiwillig: Sie hält keine Tür auf — gut für Zusatzwissen, "
    "etwa »🌍 Weltweit (freiwillig): …« an einem globus. "
)


@router.get("/api/exitgames/katalog")
def get_katalog(_=Depends(get_current_user)):
    """Erlaubte Werte samt Beschreibung — für die Auswahllisten im Formular-Editor."""
    return {
        "ansichten": katalog.ANSICHTEN,
        "stile": katalog.STILE,
        "objekte": katalog.OBJEKTE,
        "werkzeuge": katalog.WERKZEUGE,
    }


@router.get("/api/exitgames/template-interaktiv")
def download_template_interaktiv(teacher: Teacher = Depends(get_current_teacher)):
    """Die Vorlage für die 2.5D-Ansicht: ein spielbares Verlies mit Stationen,
    Monstern, Bossen und Werkzeugen. Die Anleitung besteht aus dem 2.5D-Teil
    und den Grundlagen der schlanken Vorlage."""
    grundlagen = download_template(teacher)["_ai_instructions"]
    return {
        "_ai_instructions": ANLEITUNG_25D + "--- GRUNDLAGEN --- " + grundlagen,
        "_katalog": katalog.KATALOG,
        "id": "vorlage-interaktiv",
        "title": "Vorlage interaktiv: Das Verlies der Rechenkünste",
        "description": "Ein Verlies mit zwei Ebenen: Monster, Bosse, Stationen und Werkzeuge.",
        "subject": "mathe",
        "grade": "7,8",
        "tags": ["vorlage", "interaktiv", "verlies"],
        "gebaeude": {"ansicht": "verlies", "stil": "verlies", "stile": ["verlies", "lava"]},
        "completion": {"message": "Der Endboss ist besiegt — du hast den Schatz gefunden!", "code": "SCHATZ-8"},
        "slides": [
            # ── Ebene 1 ──────────────────────────────────────────────────────────
            {"id": "eingang", "type": "explanation", "title": "Am Eingang des Verlieses",
             "station": "tafel",
             "text": "Jedes Zimmer ist eine Station. Klicke ein Zimmer an oder tippe seine Nummer (1-9). "
                     "Die Monster geben erst auf, wenn du ihre Aufgabe löst — und jede gelöste Aufgabe "
                     "gibt dir einen Codeschnipsel für den Boss an der Treppe."},
            {"id": "waage", "type": "task", "title": "Das Waagen-Monster",
             "station": "monster",
             "text": "Das Monster hält dir eine Waage hin. Bring sie ins Gleichgewicht.",
             "task": {"kind": "input", "codeFragment": "DR",
                      "question": "Löse die Gleichung $3x + 4 = 19$. Wie groß ist $x$?",
                      "sim": {"tool": "gleichungswaage", "config": {"gleichung": "3x + 4 = 19"}},
                      "accept": ["5"]},
             "hints": ["Nimm auf beiden Seiten 4 weg.", "Teile dann beide Seiten durch 3."]},
            {"id": "kalender", "type": "task", "title": "Der Wandkalender",
             "text": "An der Wand hängt ein Kalender mit Rechen-Erfindungen.",
             "task": {"kind": "timeline", "codeFragment": "A",
                      "timeline": {"mode": "sort", "scoring": "order",
                                   "axis": {"kind": "year", "min": -3000, "max": 2000},
                                   "items": [{"id": "abakus", "label": "Abakus in Mesopotamien", "value": -2500},
                                             {"id": "null", "label": "Die Null in Indien", "value": 628},
                                             {"id": "rechner", "label": "Rechenmaschine von Pascal", "value": 1642}]}},
             "hints": ["Der Abakus ist das älteste Rechenwerkzeug."]},
            {"id": "obstkorb", "type": "task", "title": "Die Obstkorb-Rechnung",
             "text": "Ein Abakus steht in der Ecke — und ein Rechenrätsel.",
             "task": {"kind": "single", "codeFragment": "CHE",
                      "question": "Wie viel ist $2 + 3 \\cdot 4$?",
                      "sim": {"tool": "rechenregeln", "config": {"term": "2 + 3 · 4"}},
                      "answers": [{"text": "14", "correct": True}, {"text": "20", "correct": False},
                                  {"text": "9", "correct": False}]},
             "hints": ["Punkt vor Strich: erst die Körbe auskippen."]},
            {"id": "boss1", "type": "door", "title": "Der Wächter der Treppe",
             "text": "Ein Bossmonster versperrt die Treppe hinab. Nenne ihm den Code aus deinen Schnipseln."},

            # ── Ebene 2 ──────────────────────────────────────────────────────────
            {"id": "beispiel", "type": "example", "title": "Ein Blick ins Bücherregal",
             "text": "Beim Graphen von $f(x) = x^2 - 4$ liegen die Nullstellen dort, wo $f(x) = 0$ ist: "
                     "$x^2 = 4$, also $x = 2$ oder $x = -2$."},
            {"id": "graph", "type": "task", "title": "Die Graphen-Tafel",
             "text": "An der Tafel steht ein Funktionsterm.",
             "task": {"kind": "input", "codeFragment": "SCH",
                      "question": "Wo schneidet der Graph von $g(x) = x^2 - 9$ die positive x-Achse?",
                      "sim": {"tool": "funktionen", "config": {"term": "x^2 - 9", "von": -5, "bis": 5}},
                      "accept": ["3"]},
             "hints": ["Suche in der Wertetabelle die Stelle mit $g(x) = 0$."]},
            {"id": "trapez", "type": "task", "title": "Das Trapez-Monster",
             "station": "monster",
             "text": "Das Monster bewacht ein Beet in Trapezform.",
             "task": {"kind": "input", "codeFragment": "A",
                      "question": "Wie groß ist die Fläche des Trapezes (in m²)?",
                      "sim": {"tool": "vierecke", "config": {"form": "trapez", "masse": {"a": 8, "c": 4, "h": 3}}},
                      "accept": ["18"]},
             "hints": ["$A = \\frac{a + c}{2} \\cdot h$"]},
            {"id": "zwischenboss", "type": "boss", "title": "Der Zwischenboss",
             "station": "boss",
             "text": "Ein kleiner Boss fordert dein Wissen heraus.",
             "challenge": VORLAGE_BOSS_SATZ, "spiel": "boss", "skin": "monster", "codeFragment": "TZ"},
            {"id": "endkampf", "type": "boss", "title": "Der Kampf vor dem Endboss",
             "text": "Such dir eine Spielart aus und besiege die Wächterin.",
             "challenge": VORLAGE_BOSS_SATZ, "spiel": "boss", "spiele": ["boss", "karten", "huepfen"],
             "skin": "prinzessin", "theme": "verlies", "codeFragment": "EK"},
            {"id": "endboss", "type": "door", "title": "Der Endboss",
             "text": "Der Endboss bewacht den Ausgang. Nur der richtige Code lässt dich vorbei."},
        ],
    }


@router.get("/api/exitgames/{exitgame_id}")
def get_exitgame(exitgame_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    g = db.get(ExitGame, exitgame_id)
    if not g:
        raise HTTPException(404, "TaskCrawler nicht gefunden")
    # Students may only open games from the shared student pool.
    if is_student(current) and g.created_by_student is None:
        raise HTTPException(404, "TaskCrawler nicht gefunden")
    return {**_to_out(g).model_dump(), "data": g.data}


@router.put("/api/exitgames/{exitgame_id}", response_model=ExitGameOut)
def update_exitgame(exitgame_id: int, raw: dict, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Bearbeiten: dasselbe JSON wie beim Hochladen, derselbe Validator.
    Assets aus einem ZIP bleiben liegen und koennen weiter referenziert werden."""
    g = db.get(ExitGame, exitgame_id)
    if not g:
        raise HTTPException(404, "TaskCrawler nicht gefunden")
    if not can_modify(g, current):
        raise HTTPException(403)
    # Laufende Versuche merken sich ihren Fortschritt an den Slides — die
    # duerfen nicht unter den Fuessen wegbrechen.
    if db.query(ExitGameSession).filter_by(exitgame_id=g.id, status="open").first():
        raise HTTPException(409, "Eine Session ist noch offen — erst schließen, dann bearbeiten.")
    karten_aufloesen(raw, db, current)
    parsed = _parse_exitgame_json(raw)
    g.title, g.description, g.subject = parsed.title, parsed.description, parsed.subject
    g.grade, g.tags, g.data = parsed.grade, parsed.tags, parsed.data
    db.commit()
    db.refresh(g)
    return _to_out(g)


@router.post("/api/exitgames/{exitgame_id}/assets", status_code=201)
def upload_exitgame_asset(exitgame_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                          current=Depends(get_current_user)):
    """Bild für eine Folie hochladen — landet wie beim ZIP-Import unter
    data/exitgames/{id}/assets/. Zurück kommt der Dateiname fürs Feld »media.src«."""
    g = db.get(ExitGame, exitgame_id)
    if not g:
        raise HTTPException(404, "Exitgame nicht gefunden")
    if not can_modify(g, current):
        raise HTTPException(403)
    fname = save_image(file, EXITGAME_DATA_ROOT / str(exitgame_id) / "assets")
    if not g.asset_path:
        g.asset_path = str(EXITGAME_DATA_ROOT / str(exitgame_id))
        db.commit()
    return {"path": fname, "url": f"/uploads/exitgames/{exitgame_id}/assets/{fname}"}


@router.delete("/api/exitgames/{exitgame_id}", status_code=204)
def delete_exitgame(exitgame_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    g = db.get(ExitGame, exitgame_id)
    if not g:
        raise HTTPException(404, "TaskCrawler nicht gefunden")
    if not can_modify(g, current):
        raise HTTPException(403)
    db.delete(g)
    db.commit()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    # Genau eines von beidem: eine Klasse oder ein Kurs/WPF (klassenübergreifend).
    class_id: int | None = None
    group_id: int | None = None


class SessionOut(BaseModel):
    id: int
    join_code: str
    status: str
    exitgame_id: int
    class_id: int | None
    group_id: int | None = None
    # »9a« bzw. »9 NaT«. Beim TaskCrawler reines Etikett — er vergibt keine Punkte.
    scope_label: str = ""
    attempt_count: int
    created_at: datetime
    closed_at: datetime | None

    model_config = {"from_attributes": True}


def _session_out(s: ExitGameSession, db: Session | None = None) -> SessionOut:
    return SessionOut(
        id=s.id, join_code=s.join_code, status=s.status, exitgame_id=s.exitgame_id,
        class_id=s.class_id, group_id=s.group_id,
        scope_label=scoping.scope_label(db, s.class_id, s.group_id) if db is not None else "",
        attempt_count=len(s.attempts), created_at=s.created_at,
        closed_at=s.closed_at,
    )


def create_or_reuse_open_session(db: Session, exitgame_id: int, class_id: int | None, teacher_id: int,
                                 group_id: int | None = None) -> ExitGameSession:
    """Create (or return the existing open) session for an exitgame and one
    scope — either a Klasse or a Kurs/WPF. Shared by the REST endpoint and the
    Stundenplaner tool registry."""
    game = db.get(ExitGame, exitgame_id)
    if not game:
        raise HTTPException(404, "TaskCrawler nicht gefunden")
    scoping.validate_scope(class_id, group_id)
    if group_id is not None:
        scoping.load_group(db, group_id)
    existing = (
        db.query(ExitGameSession)
        .filter_by(exitgame_id=exitgame_id, class_id=class_id, group_id=group_id, status="open")
        .order_by(ExitGameSession.created_at.desc())
        .first()
    )
    if existing:
        return existing
    session = ExitGameSession(
        exitgame_id=exitgame_id, class_id=class_id, group_id=group_id, teacher_id=teacher_id,
        join_code=gen_code(db, ExitGameSession, "join_code"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/api/exitgames/{exitgame_id}/sessions", response_model=SessionOut, status_code=201, dependencies=[Depends(require_capability("exitgame", "host"))])
def create_session(
    exitgame_id: int, body: SessionCreate,
    db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher),
):
    session = create_or_reuse_open_session(db, exitgame_id, body.class_id, current.id, body.group_id)
    return _session_out(session, db)


@router.get("/api/exitgames/{exitgame_id}/sessions", response_model=list[SessionOut])
def list_exitgame_sessions(exitgame_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    """Die eigenen Runden zu diesem TaskCrawler (Admins sehen alle) — siehe
    list_caputh_sessions: gemeinsame Bibliothek, eigene Runden."""
    sessions = db.query(ExitGameSession).filter_by(exitgame_id=exitgame_id).order_by(ExitGameSession.created_at.desc()).all()
    return [_session_out(s, db) for s in sessions if is_session_owner(s, current)]


@router.get("/api/exitgame-sessions/{code}", response_model=SessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    return _session_out(s, db)


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
    return _session_out(s, db)


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
    code: str, db: Session = Depends(get_db),
    current: Teacher | Student | Guest = Depends(get_player),
):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    if s.status != "open":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    # The join link is the only gate — any logged-in student, teacher, admin, or
    # (if the teacher opted in) a QR/join-link guest may start an attempt.
    # session.class_id is a reporting label, not a participation check.

    owner = _owner_filter(current)
    if isinstance(current, Guest):
        owner["guest_name"] = current.name
    attempt = db.query(ExitGameAttempt).filter_by(session_id=s.id, **_owner_filter(current)).first()
    if not attempt:
        attempt = ExitGameAttempt(session_id=s.id, **owner)
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        db.add(ExitGameEvent(attempt_id=attempt.id, slide_id=s.exitgame.data["slides"][0]["id"], event_type="view", payload={"slide_index": 0}))
        db.commit()

    dda_cfg = s.exitgame.data.get("dda") or {}
    return {
        "attempt": _attempt_summary(attempt),
        # Needed to resolve media filenames from the uploaded ZIP's assets/
        # folder against /uploads/exitgames/<id>/assets/.
        "exitgame_id": s.exitgame_id,
        "exitgame_data": _data_for_player(s.exitgame.data),
        "variant_choices": _variant_choices(s.exitgame.data, attempt.id),
        "code_fragments": _fragment_state(db, attempt.id, s.exitgame.data),
        # The level is needed before the first wrong answer too — hint budget,
        # Richtzeit and extra example are read from it on every task.
        "adaptation": dda_engine.adapt(dda_cfg, _recent_dda_history(db, attempt.id))
        if dda_cfg.get("enabled") else None,
    }


class EventIn(BaseModel):
    slide_id: str
    action: str  # view | answer | hint | easier_taken | review_jump | skip | code
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
    if kind == "karte":
        spec = task.get("karte") or {}
        ratio, _ = karten_engine.bewerte(spec, answer)
        return ratio >= spec.get("mindestens", 1.0)
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


def _expected_code(slides: list, door_index: int, attempt_id: int) -> str:
    """The code this door expects from THIS attempt — variants may carry their
    own fragment, so two students can legitimately need different codes."""
    parts = []
    for slide_id, idx, task in _fragment_tasks(slides, door_index):
        merged = _resolve_variant(task, attempt_id, slide_id, idx)
        parts.append(str(merged.get("codeFragment", "")).strip())
    return "".join(parts)


def _fragment_state(db: Session, attempt_id: int, data: dict) -> list[dict]:
    """Every fragment slot of the game, with the fragment filled in only where
    the student actually solved the task — the player renders this as the
    collected-code strip, so an unearned fragment must not be sent."""
    slides = data["slides"]
    solved = {
        (e.slide_id, e.payload.get("task_index", 0))
        for e in db.query(ExitGameEvent).filter_by(attempt_id=attempt_id, event_type="success")
    }
    out = []
    for i, slide in enumerate(slides):
        if slide.get("type") != "door":
            continue
        for slide_id, idx, task in _fragment_tasks(slides, i):
            earned = (slide_id, idx) in solved
            merged = _resolve_variant(task, attempt_id, slide_id, idx)
            out.append({
                "door_id": slide["id"], "slide_id": slide_id, "task_index": idx,
                "earned": earned, "fragment": merged.get("codeFragment") if earned else None,
            })
    return out


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


def _slide_solved(db: Session, attempt: ExitGameAttempt, slide: dict, data: dict) -> bool:
    """A slide is solved once every task index on it has a recorded 'success'
    event — and a door that collects a code additionally needs that code
    accepted ('code_ok')."""
    tasks = _iter_tasks(slide)
    solved_indices = {
        e.payload.get("task_index", 0)
        for e in db.query(ExitGameEvent).filter_by(attempt_id=attempt.id, slide_id=slide["id"], event_type="success")
    }
    if len(solved_indices) < len(tasks):
        return False
    if slide.get("type") == "door":
        idx = next((i for i, sl in enumerate(data["slides"]) if sl["id"] == slide["id"]), None)
        if idx is not None and _fragment_tasks(data["slides"], idx):
            return db.query(ExitGameEvent).filter_by(
                attempt_id=attempt.id, slide_id=slide["id"], event_type="code_ok").first() is not None
    return True


def _seconds_on_task(db: Session, attempt: ExitGameAttempt) -> float:
    """How long the student worked on this answer: time since their previous
    event (viewing the slide, a hint, an earlier wrong try), or since the
    attempt started. Measured here rather than trusted from the client — the
    DDA record has to hold up when a teacher reviews it."""
    last = (
        db.query(ExitGameEvent)
        .filter_by(attempt_id=attempt.id)
        .order_by(ExitGameEvent.created_at.desc(), ExitGameEvent.id.desc())
        .first()
    )
    ref = _aware(last.created_at) if last else _aware(attempt.started_at)
    return max(0.0, min(600.0, (datetime.now(timezone.utc) - ref).total_seconds()))


def _offer_easier_allowed(adaptation: dict | None) -> bool:
    """Without DDA the easier alternative is always on offer; with DDA the
    student's current level decides (authored `offerEasier`)."""
    if not adaptation:
        return True
    return bool(adaptation.get("contentParams", {}).get("scaffolding_level", {}).get("offerEasier", True))


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
    numeric id, so a bare student_id can't key the roster on its own. Gaeste
    tragen weder noch — frueher landeten sie alle unter »tNone«."""
    if attempt.student_id:
        return f"s{attempt.student_id}"
    if attempt.guest_id:
        return f"g{attempt.guest_id}"
    return f"t{attempt.teacher_id}"


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
    attempt_id: int, body: EventIn, request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    attempt = db.get(ExitGameAttempt, attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt nicht gefunden")
    current = _identity_for_attempt(attempt, request, credentials, db)
    if current is None or not _attempt_belongs_to(attempt, current):
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
    door_open_slides: list[str] | None = None
    event_type = body.action

    if body.action == "view":
        attempt.current_slide_idx = body.payload.get("slide_index", attempt.current_slide_idx)

    elif body.action == "answer":
        task_index = body.payload.get("task_index", 0)
        variant = body.payload.get("variant", "normal")
        if slide.get("type") == "boss":
            raise HTTPException(400, "Ein Boss wird über /boss/... gespielt")
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
        body.payload["time_spent_s"] = round(_seconds_on_task(db, attempt), 1)
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
        adaptation = dda_engine.adapt(dda_cfg, _recent_dda_history(db, attempt_id)) if dda_enabled else None
        if not _offer_easier_allowed(adaptation):
            raise HTTPException(409, "Auf dieser Stufe ist keine leichtere Aufgabe vorgesehen")
        attempt.easier_taken_total += 1

    elif body.action == "review_jump":
        pass

    elif body.action == "skip":
        # Leaving a task open is allowed and recorded — the missing code
        # fragment is what stops the student at the door.
        if slide.get("type") != "task":
            raise HTTPException(400, "Nur Aufgaben-Slides können übersprungen werden")

    elif body.action == "code":
        if slide.get("type") != "door":
            raise HTTPException(400, "Nur Türen haben einen Code")
        door_index = next(i for i, sl in enumerate(data["slides"]) if sl["id"] == body.slide_id)
        expected = _expected_code(data["slides"], door_index, attempt_id)
        if not expected:
            raise HTTPException(400, "Diese Tür sammelt keinen Code")
        # The code must match AND be the student's own: a code copied from a
        # neighbour does not open a door whose fragments are still unearned.
        slots = [f for f in _fragment_state(db, attempt_id, data) if f["door_id"] == body.slide_id]
        all_earned = all(f["earned"] for f in slots)
        correct = all_earned and _normalize_code(body.payload.get("code")) == _normalize_code(expected)
        event_type = "code_ok" if correct else "code_fail"
        if not correct:
            attempt.errors_total += 1
            door_open_slides = [f["slide_id"] for f in slots if not f["earned"]]

    else:
        raise HTTPException(400, "Unbekannte action")

    event = ExitGameEvent(attempt_id=attempt_id, slide_id=body.slide_id, event_type=event_type, payload=body.payload)
    db.add(event)
    # SessionLocal has autoflush=False (api/database.py) — without an explicit
    # flush the event just added is invisible to _slide_solved's query, and the
    # slide only counts as solved on the NEXT request (i.e. after a reload).
    db.flush()

    if event_type in ("success", "code_ok") and _slide_solved(db, attempt, slide, data):
        if body.slide_id not in attempt.solved_slide_ids:
            attempt.solved_slide_ids = [*attempt.solved_slide_ids, body.slide_id]

    db.commit()
    db.refresh(attempt)

    adaptation = None
    if dda_enabled:
        adaptation = dda_engine.adapt(dda_cfg, _recent_dda_history(db, attempt_id))

    await _broadcast_progress(session.join_code, attempt, len(data["slides"]), event_type)

    out = {
        "correct": correct, "adaptation": adaptation, "attempt": _attempt_summary(attempt),
        "code_fragments": _fragment_state(db, attempt_id, data),
    }
    if door_open_slides is not None:
        # Which slides still owe a fragment — the player turns these into
        # "back to this task" links so the code can be completed.
        out["open_slides"] = list(dict.fromkeys(door_open_slides))
    return out


# ---------------------------------------------------------------------------
# Boss-Folien: ein Challenge-Lauf je Folie (challenge_lauf), gespeichert im Attempt
# ---------------------------------------------------------------------------

def _boss_kontext(attempt_id: int, slide_id: str, request: Request, credentials, db: Session):
    attempt = db.get(ExitGameAttempt, attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt nicht gefunden")
    current = _identity_for_attempt(attempt, request, credentials, db)
    if current is None or not _attempt_belongs_to(attempt, current):
        raise HTTPException(404, "Attempt nicht gefunden")
    if attempt.status != "in_progress":
        raise HTTPException(409, "Dieser Versuch ist bereits abgeschlossen")
    if attempt.session.status != "open":
        raise HTTPException(403, "Diese Sitzung ist geschlossen")
    data = attempt.session.exitgame.data
    slide = _find_slide(data, slide_id)
    if not slide or slide.get("type") != "boss":
        raise HTTPException(404, "Boss-Folie nicht gefunden")
    return attempt, data, slide


def _boss_lauf(attempt: ExitGameAttempt, slide: dict, pflicht: bool = True) -> dict | None:
    """Kopie des gespeicherten Laufs; ohne Lauf 409 (``pflicht``) oder None."""
    lauf = (attempt.boss_laeufe or {}).get(slide["id"])
    if lauf is None:
        if pflicht:
            raise HTTPException(409, "Der Boss-Kampf wurde noch nicht gestartet")
        return None
    return copy.deepcopy(lauf)


def _boss_speichern(attempt: ExitGameAttempt, slide: dict, lauf: dict) -> None:
    attempt.boss_laeufe = {**(attempt.boss_laeufe or {}), slide["id"]: lauf}


def _boss_bild(attempt: ExitGameAttempt):
    return lambda name: f"/uploads/exitgames/{attempt.session.exitgame_id}/assets/{name}"


def _boss_brett(attempt: ExitGameAttempt, slide: dict, lauf: dict) -> dict:
    return challenge_lauf.brett(slide["challenge"], lauf, _boss_bild(attempt))


@router.post("/api/exitgame-attempts/{attempt_id}/boss/{slide_id}/start")
def boss_start(
    attempt_id: int, slide_id: str, body: StartIn, request: Request,
    db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    attempt, data, slide = _boss_kontext(attempt_id, slide_id, request, credentials, db)
    standards = _boss_standards(slide)
    spiele = standards["spiele"]
    lauf = _boss_lauf(attempt, slide, pflicht=False)
    wahl = body.spiel if body.spiel in spiele else (lauf["spiel"] if lauf else standards["spiel"])
    if lauf is None:
        lauf = challenge_lauf.neuer_lauf(slide["challenge"], standards["startstufe"], wahl, mischen=standards["etappenMischen"])
    else:
        challenge_lauf.spiel_wechseln(slide["challenge"], lauf, wahl)
    _boss_speichern(attempt, slide, lauf)
    db.commit()
    return {**_boss_brett(attempt, slide, lauf), "skin": standards["skin"], "theme": standards["theme"], "spiele": spiele}


@router.post("/api/exitgame-attempts/{attempt_id}/boss/{slide_id}/deck")
def boss_deck(
    attempt_id: int, slide_id: str, body: DeckIn, request: Request,
    db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    attempt, _, slide = _boss_kontext(attempt_id, slide_id, request, credentials, db)
    lauf = _boss_lauf(attempt, slide)
    challenge_lauf.deck_setzen(slide["challenge"], lauf, body.fakt_ids)
    _boss_speichern(attempt, slide, lauf)
    db.commit()
    return _boss_brett(attempt, slide, lauf)


@router.post("/api/exitgame-attempts/{attempt_id}/boss/{slide_id}/antwort")
async def boss_antwort(
    attempt_id: int, slide_id: str, body: AntwortIn, request: Request,
    db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    attempt, data, slide = _boss_kontext(attempt_id, slide_id, request, credentials, db)
    lauf = _boss_lauf(attempt, slide)
    aus, neues_brett, wertung = challenge_lauf.antworte_mit_brett(
        slide["challenge"], lauf, body.challenge_id, body.fakt_ids, body.lese_ms, body.wahl_ms, body.tipp,
        bild=_boss_bild(attempt))
    _boss_speichern(attempt, slide, lauf)
    db.add(ExitGameEvent(attempt_id=attempt_id, slide_id=slide_id, event_type="boss_answer", payload={
        "challenge_id": body.challenge_id, "qualitaet": aus["qualitaet"], "komplett": aus["komplett"]}))
    if not aus["treffer"]:
        attempt.errors_total += 1
    event_type = "boss_answer"
    if aus["fertig"]:
        event_type = "success"
        db.add(ExitGameEvent(attempt_id=attempt_id, slide_id=slide_id, event_type="success", payload={
            "task_index": 0, "boss": wertung}))
        db.flush()
        if _slide_solved(db, attempt, slide, data) and slide_id not in attempt.solved_slide_ids:
            attempt.solved_slide_ids = [*attempt.solved_slide_ids, slide_id]
    db.commit()
    db.refresh(attempt)
    await _broadcast_progress(attempt.session.join_code, attempt, len(data["slides"]), event_type)
    return {**aus, "brett": neues_brett, "attempt": _attempt_summary(attempt), "code_fragments": _fragment_state(db, attempt_id, data)}


def _ergebnissicherung(data: dict) -> list[dict]:
    """Die Merksätze des Spiels in Folienreihenfolge, je Abschnitt (bis zur
    Tür) gruppiert: [{abschnitt, titel, eintraege: [{titel, text}]}]."""
    abschnitte: list[dict] = []
    offen: list[dict] = []
    for slide in data.get("slides") or []:
        if not isinstance(slide, dict):
            continue
        text = slide.get("ergebnissicherung")
        if isinstance(text, str) and text.strip():
            offen.append({"titel": slide.get("title") or "", "text": text.strip()})
        if slide.get("type") == "door":
            if offen:
                abschnitte.append({"abschnitt": len(abschnitte) + 1, "titel": slide.get("title") or "", "eintraege": offen})
            offen = []
    if offen:
        abschnitte.append({"abschnitt": len(abschnitte) + 1, "titel": "", "eintraege": offen})
    return abschnitte


def _abschluss(attempt: ExitGameAttempt) -> dict:
    data = attempt.session.exitgame.data
    return {"attempt": _attempt_summary(attempt), "completion": data.get("completion"),
            "title": data.get("title") or "", "ergebnissicherung": _ergebnissicherung(data)}


@router.post("/api/exitgame-attempts/{attempt_id}/finish")
async def finish_attempt(
    attempt_id: int, request: Request, db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    attempt = db.get(ExitGameAttempt, attempt_id)
    if not attempt:
        raise HTTPException(404, "Attempt nicht gefunden")
    current = _identity_for_attempt(attempt, request, credentials, db)
    if current is None or not _attempt_belongs_to(attempt, current):
        raise HTTPException(404, "Attempt nicht gefunden")
    if attempt.status == "finished":
        return _abschluss(attempt)

    attempt.status = "finished"
    attempt.finished_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(attempt)

    session = attempt.session
    await _broadcast_progress(session.join_code, attempt, len(session.exitgame.data["slides"]), "finished")

    return _abschluss(attempt)


# ---------------------------------------------------------------------------
# Results: report + detailed per-student log
# ---------------------------------------------------------------------------

def _boss_ergebnis(a: ExitGameAttempt, data: dict, anzahl: dict) -> float | None:
    """Mittelwert der Ergebnisse aller Boss-Läufe des Versuchs; None ohne Boss-Lauf.

    ``anzahl``: Challenge-Zahl je (Folie, Stufe, Spiel), vom Bericht über alle Versuche geteilt."""
    def ergebnis(sl: dict) -> float:
        lauf = a.boss_laeufe[sl["id"]]
        schluessel = (sl["id"], lauf["stufe"], lauf["spiel"])
        if schluessel not in anzahl:
            anzahl[schluessel] = challenge_lauf.anzahl_challenges(sl["challenge"], lauf)
        return challenge_eng.ergebnis(lauf["fragen"], anzahl[schluessel])

    werte = [ergebnis(sl) for sl in data["slides"] if sl.get("type") == "boss" and sl["id"] in (a.boss_laeufe or {})]
    return round(sum(werte) / len(werte), 4) if werte else None


@router.get("/api/exitgame-sessions/{code}/report")
def get_session_report(code: str, fmt: str = "json", db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.query(ExitGameSession).filter_by(join_code=code).first()
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    require_session_owner(s, current)

    total_slides = len(s.exitgame.data["slides"])
    rows = []
    # Die Klassenleitung liest ihren eigenen Bericht mit vollen Namen, jede
    # andere Lehrkraft mit »Anna B.«.
    scope = NameScope(db, current)
    boss_anzahl: dict = {}
    for a in sorted(s.attempts, key=lambda a: _participant_name(a, scope)):
        rows.append({
            "attempt_id": a.id, "student_id": a.student_id,
            "student_name": _participant_name(a, scope),
            "student_class": _participant_class(a),
            "status": a.status, "slides_solved": len(a.solved_slide_ids), "slides_total": total_slides,
            "errors_total": a.errors_total, "hints_total": a.hints_total,
            "easier_taken_total": a.easier_taken_total,
            "elapsed_seconds": _attempt_summary(a)["elapsed_seconds"],
            "boss_ergebnis": _boss_ergebnis(a, s.exitgame.data, boss_anzahl),
        })

    if fmt == "csv":
        import csv as csv_mod
        buf = io.StringIO()
        writer = csv_mod.writer(buf)
        writer.writerow(["Name", "Klasse", "Status", "Gelöst", "Gesamt", "Fehler", "Hinweise", "Erleichterte Aufgaben", "Dauer (s)", "Boss-Ergebnis"])
        for r in rows:
            writer.writerow([r["student_name"], r["student_class"], r["status"], r["slides_solved"], r["slides_total"],
                              r["errors_total"], r["hints_total"], r["easier_taken_total"], r["elapsed_seconds"],
                              "" if r["boss_ergebnis"] is None else r["boss_ergebnis"]])
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            iter([buf.getvalue().encode("utf-8-sig")]), media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="taskcrawler_{code}.csv"'},
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
        "student_name": _participant_name(a, NameScope(db, current)),
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
        await reject(websocket, 4004)
        return
    # Die Roster-Ansicht zeigt, wer gerade wo steht und wie viele Fehler er
    # gemacht hat — das ist die Stunde dieser Lehrkraft, nicht die aller.
    teacher = ws_teacher(websocket, db)
    if teacher is None or not is_session_owner(s, teacher):
        await reject(websocket, 4003)
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
            release_db(db)
            await websocket.receive_text()  # host sends nothing meaningful; keep connection alive
    except WebSocketDisconnect:
        pass
    finally:
        mgr.remove_teacher(code, websocket)
