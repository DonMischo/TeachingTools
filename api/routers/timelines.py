"""
Zeitstrahl — standalone tool for everything on a continuous line: historische
Zeitleisten (mit parallelen Spuren, z.B. Europa neben Mittelamerika),
Zahlenstrahlen und andere Skalen.

Content lives in TimelineSet (JSON-blob pattern like BingoSet): an axis, a
list of lanes and a list of point/span events. The library is open to every
teacher; students may READ a set (the viewer page is share-/beamerfähig).
There is no live session — the game mechanics (sort/spot) run embedded in
Caputh questions, Exitgame tasks and Übungs-Generatoren, all validated and
scored by api/timeline_engine.py.
"""
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TimelineSet, Teacher
from ..auth import get_current_teacher, get_current_user
from ..timeline_engine import validate_set_payload

router = APIRouter(prefix="/api/timelines", tags=["timelines"])

EXAMPLES_DIR = Path(__file__).parent.parent.parent / "data" / "timeline_examples"


class TimelineSetOut(BaseModel):
    id: int
    title: str
    description: str | None
    tags: list
    grades: list
    axis: dict
    lane_count: int
    event_count: int
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TimelineSetDetail(TimelineSetOut):
    lanes: list
    events: list


def _to_out(s: TimelineSet) -> TimelineSetOut:
    return TimelineSetOut(
        id=s.id, title=s.title, description=s.description, tags=s.tags,
        grades=s.grades, axis=s.axis, lane_count=len(s.lanes),
        event_count=len(s.events), created_by=s.created_by, created_at=s.created_at,
    )


def _to_detail(s: TimelineSet) -> TimelineSetDetail:
    return TimelineSetDetail(**_to_out(s).model_dump(), lanes=s.lanes, events=s.events)


def _build_set(data: dict, teacher_id: int) -> TimelineSet:
    errors = validate_set_payload(data)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Zeitstrahl-Format", "errors": errors})
    return TimelineSet(
        title=data["title"].strip(),
        description=data.get("description"),
        tags=[str(t) for t in data.get("tags") or []],
        grades=[g for g in data.get("grades") or [] if isinstance(g, int)],
        axis=data["axis"],
        lanes=data.get("lanes") or [],
        events=data.get("events") or [],
        created_by=teacher_id,
    )


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------

@router.get("", response_model=list[TimelineSetOut])
def list_sets(db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    sets = db.query(TimelineSet).order_by(TimelineSet.created_at.desc()).all()
    return [_to_out(s) for s in sets]


@router.post("", response_model=TimelineSetDetail, status_code=201)
def create_set(data: dict, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = _build_set(data, current.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_detail(s)


@router.post("/upload", response_model=TimelineSetDetail, status_code=201)
def upload_set(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Teacher = Depends(get_current_teacher),
):
    try:
        raw = json.loads(file.file.read())
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Ungültiges JSON: {e}")
    s = _build_set(raw, current.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_detail(s)


@router.get("/template")
def download_template(_: Teacher = Depends(get_current_teacher)):
    return {
        "_ai_instructions": (
            "Erstelle einen Zeitstrahl-Datensatz im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- title, axis, events. "
            "--- ACHSE --- axis: {kind, min, max, step?, unit?}. kind 'year' für historische "
            "Zeitleisten (Jahreszahlen als ganze Zahlen, v. Chr. = negativ, z.B. -753 für 753 v. Chr.) "
            "oder 'number' für Zahlenstrahlen/Skalen (unit optional, z.B. 'cm', '°C'; step = "
            "Raster-/Einrastschritt). min < max, alle Event-Werte müssen im Bereich liegen. "
            "--- SPUREN (lanes) --- optionale parallele Spuren für den Vergleich (z.B. Regionen: "
            "Europa neben Ostasien neben Amerika, oder Themen: Politik/Kultur, oder eine eigene "
            "Spur 'Epochen' als Zeitleisten-Rückgrat). "
            "lanes: [{id (kurz, eindeutig), label, color? (#rrggbb)}]. "
            "--- EREIGNISSE (events) --- [{id (eindeutig), label, value (Position auf der Achse), "
            "end? (nur für Zeitspannen, sonst weglassen/null), lane? (id einer Spur), "
            "category? (Filter-Schlagwort), info? (Zusatzinfo, erscheint beim Überfahren mit der "
            "Maus und ausführlich beim Anklicken — hier dürfen ruhig 1-2 erklärende Sätze stehen), "
            "exact_date?, exact_date_end? (optionales genaues Datum für Start bzw. Ende einer "
            "Zeitspanne). Zwei Schreibweisen: (1) ISO-8601 'JJJJ-MM-TT', z.B. '1942-01-20' — nur "
            "für n. Chr.-Daten (JJJJ vierstellig, kein Minus) — positioniert das Ereignis exakt auf "
            "diesen Tag (nicht nur das Jahr) und erlaubt Heranzoomen bis auf Tagesebene; das Jahr "
            "in 'value'/'end' muss dabei zum Datum passen (z.B. value: 1942 zu '1942-01-20'). "
            "(2) Freitext, z.B. '15. März 44 v. Chr.' oder '21. April 753 v. Chr. (Überlieferung)' — "
            "für v.-Chr.-Daten oder unsichere/überlieferte Angaben; wird nur als Zusatztext neben "
            "dem Jahr angezeigt, ändert nichts an Position oder Zoom. Nur setzen, wenn Tag/Monat "
            "wirklich belegt oder überliefert ist, sonst weglassen. Beide Schreibweisen dürfen sich "
            "auf derselben Zeitspanne mischen (z.B. Start v. Chr. als Freitext, Ende n. Chr. als "
            "ISO-Datum — siehe 'augustus' im Beispiel unten). color?}]. "
            "--- ZEITSPANNEN & EPOCHEN --- Alles mit Dauer bekommt 'end' und wird als Balken "
            "gezeichnet: Epochen (Antike, Mittelalter, Barock, Absolutismus), Herrschaftszeiten, "
            "Kriege, Kulturen, Lebensspannen. Punktereignisse (ein Datum) lassen 'end' weg. "
            "--- KATEGORIEN & FILTER --- category ist das Filter-Schlagwort, z.B. 'Rom', "
            "'Mittelalter', 'Erster Weltkrieg', 'Klima'. Im Ansehen-Modus sind zunächst alle "
            "Kategorien aktiv; einzelne lassen sich abwählen (oder über 'Keine' + einen Klick "
            "isolieren), und die Ansicht zoomt automatisch auf den Bereich der verbliebenen "
            "Ereignisse. Deshalb: jeder Epoche/jedem Thema, das man einzeln betrachten können soll, "
            "eine eigene category geben (nicht alle Kriege in eine Sammelkategorie werfen). "
            "Dieselbe category darf über mehrere Spuren hinweg vorkommen — dann zeigt der Filter "
            "z.B. die Epoche 'Reformation' und die passenden Deutschland-Ereignisse gemeinsam. "
            "--- SPIELMECHANIKEN --- Aus einem Set lassen sich im Tool Spielvorschauen erzeugen; "
            "für Caputh-Fragen (type 'timeline') und Exitgame-Aufgaben (kind 'timeline') wird das "
            "separate TimelineGameSpec-Format verwendet: {mode: 'sort'|'spot', axis, items, "
            "tolerance?, scoring?}. mode 'sort': items [{id, label, value}] — Schüler ziehen die "
            "Begriffe an die richtige Stelle (scoring 'position' = Toleranzfenster, 'order' = nur "
            "Reihenfolge muss stimmen). mode 'spot': items [{id, label, value, actual?}] — Items "
            "werden bei 'value' angezeigt; falsch platzierte tragen zusätzlich ihren wahren Wert in "
            "'actual'. Schüler markieren die Fehler. "
            "--- REGELN --- ids eindeutig, deutsche Beschriftungen, keine Lösungshinweise in labels."
        ),
        "title": "Römische Geschichte",
        "description": "Wichtige Stationen Roms von der Gründung bis zum Untergang Westroms.",
        "tags": ["geschichte", "rom"],
        "grades": [5, 6, 7],
        "axis": {"kind": "year", "min": -800, "max": 600},
        "lanes": [
            {"id": "epochen", "label": "Epochen", "color": "#c084fc"},
            {"id": "politik", "label": "Politik & Herrschaft", "color": "#60a5fa"},
            {"id": "kultur", "label": "Kultur & Alltag", "color": "#f59e0b"},
        ],
        "events": [
            {"id": "epo-koenigszeit", "label": "Königszeit", "value": -753, "end": -509, "lane": "epochen", "category": "Königszeit", "info": "Der Sage nach sieben Könige — endet mit der Vertreibung des letzten Königs"},
            {"id": "epo-republik", "label": "Republik", "value": -509, "end": -27, "lane": "epochen", "category": "Republik", "info": "Senat und gewählte Beamte regieren Rom"},
            {"id": "epo-kaiserzeit", "label": "Kaiserzeit", "value": -27, "end": 476, "lane": "epochen", "category": "Kaiserzeit", "info": "Alleinherrschaft der Kaiser, beginnend mit Augustus"},
            {"id": "gruendung", "label": "Gründung Roms (Sage)", "value": -753, "end": None, "lane": "politik", "category": "Königszeit", "info": "Romulus und Remus", "exact_date": "21. April 753 v. Chr. (Überlieferung)"},
            {"id": "punische", "label": "Punische Kriege", "value": -264, "end": -146, "lane": "politik", "category": "Republik", "info": "Drei Kriege gegen Karthago — Hannibal überquert mit Elefanten die Alpen"},
            {"id": "caesar", "label": "Julius Caesar", "value": -100, "end": -44, "lane": "politik", "category": "Republik", "info": "Feldherr und Diktator", "exact_date": "Ermordet an den Iden des März, 15. März 44 v. Chr."},
            {"id": "augustus", "label": "Augustus, erster Kaiser", "value": -27, "end": 14, "lane": "politik", "category": "Kaiserzeit", "info": "Beginn der Kaiserzeit", "exact_date": "16. Januar 27 v. Chr. (Titel 'Augustus' verliehen)", "exact_date_end": "0014-08-19"},
            {"id": "colosseum", "label": "Kolosseum eröffnet", "value": 80, "end": None, "lane": "kultur", "category": "Bauwerk", "info": "Platz für rund 50.000 Zuschauer"},
            {"id": "untergang", "label": "Untergang Westroms", "value": 476, "end": None, "lane": "politik", "category": "Kaiserzeit", "info": "Ende der Antike", "exact_date": "0476-09-04"},
        ],
    }


@router.post("/examples", response_model=list[TimelineSetOut], status_code=201)
def import_examples(db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    """Import the bundled example sets (data/timeline_examples/*.json) into the
    library, skipping any whose title already exists."""
    if not EXAMPLES_DIR.exists():
        raise HTTPException(404, "Keine Beispieldaten vorhanden")
    existing_titles = {t for (t,) in db.query(TimelineSet.title).all()}
    created: list[TimelineSet] = []
    for path in sorted(EXAMPLES_DIR.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if raw.get("title") in existing_titles:
            continue
        s = _build_set(raw, current.id)
        db.add(s)
        created.append(s)
    db.commit()
    for s in created:
        db.refresh(s)
    return [_to_out(s) for s in created]


# ---------------------------------------------------------------------------
# Single set
# ---------------------------------------------------------------------------

@router.get("/{set_id}", response_model=TimelineSetDetail)
def get_set(set_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Read access for every logged-in user — students open the viewer when a
    teacher shares/launches a set via Stundenplaner."""
    s = db.get(TimelineSet, set_id)
    if not s:
        raise HTTPException(404, "Zeitstrahl nicht gefunden")
    return _to_detail(s)


@router.put("/{set_id}", response_model=TimelineSetDetail)
def update_set(set_id: int, data: dict, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.get(TimelineSet, set_id)
    if not s:
        raise HTTPException(404, "Zeitstrahl nicht gefunden")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    errors = validate_set_payload(data)
    if errors:
        raise HTTPException(422, {"message": "Ungültiges Zeitstrahl-Format", "errors": errors})
    s.title = data["title"].strip()
    s.description = data.get("description")
    s.tags = [str(t) for t in data.get("tags") or []]
    s.grades = [g for g in data.get("grades") or [] if isinstance(g, int)]
    s.axis = data["axis"]
    s.lanes = data.get("lanes") or []
    s.events = data.get("events") or []
    db.commit()
    db.refresh(s)
    return _to_detail(s)


@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: int, db: Session = Depends(get_db), current: Teacher = Depends(get_current_teacher)):
    s = db.get(TimelineSet, set_id)
    if not s:
        raise HTTPException(404, "Zeitstrahl nicht gefunden")
    if s.created_by != current.id and current.role != "admin":
        raise HTTPException(403)
    db.delete(s)
    db.commit()
