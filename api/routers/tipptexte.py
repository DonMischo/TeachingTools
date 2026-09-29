"""Hochgeladenes Tippmaterial für die Schreibübung.

Eine Sammlung ist eine JSON-Datei mit Texten zum Abtippen und optional einer
eigenen Wortliste für den Wortregen. Damit tippt eine Klasse die Fachbegriffe,
die im Unterricht gerade dran sind, statt »fff jjj«.

Bewusst geprüft wird beim Hochladen, ob sich der Text überhaupt tippen lässt
(siehe api/tipp_text.py): Tottasten und AltGr-Zeichen kämen in der Übung nie
an, und die Fehlersperre käme über eine solche Stelle nie hinweg. Lieber die
Datei ablehnen als den Schüler davor sitzen lassen.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user, get_current_teacher
from ..availability import require_capability
from ..models import Teacher, TippSammlung
from ..tipp_text import pruefe_tippbar

router = APIRouter(prefix="/api/tipptexte", tags=["tipptexte"])

MAX_TEXTE = 50
MAX_ZEICHEN = 5000
BEKANNTE_EINSTELLUNGEN = {"lock_on_error"}


class TextOut(BaseModel):
    title: str
    text: str


class SammlungOut(BaseModel):
    id: int
    title: str
    description: str | None
    texts: list[TextOut]
    words: list[str]
    settings: dict
    created_by: int | None


class SammlungKurz(BaseModel):
    id: int
    title: str
    description: str | None
    anzahl_texte: int
    anzahl_woerter: int


def _to_out(s: TippSammlung) -> SammlungOut:
    return SammlungOut(
        id=s.id, title=s.title, description=s.description,
        texts=[TextOut(**t) for t in s.texts], words=list(s.words),
        settings=dict(s.settings), created_by=s.created_by,
    )


def _pruefe_text(text: str, wo: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(400, f"{wo}: »text« fehlt oder ist leer.")
    if len(text) > MAX_ZEICHEN:
        raise HTTPException(400, f"{wo}: Der Text ist länger als {MAX_ZEICHEN} Zeichen.")
    pruefe_tippbar(text, wo)
    return text


def _baue(data: dict, teacher: Teacher) -> TippSammlung:
    if not isinstance(data, dict):
        raise HTTPException(400, "Die Datei muss ein JSON-Objekt enthalten.")

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        raise HTTPException(400, "»title« fehlt.")

    roh_texte = data.get("texts")
    if not isinstance(roh_texte, list) or not roh_texte:
        raise HTTPException(400, "»texts« fehlt oder ist leer — mindestens ein Text wird gebraucht.")
    if len(roh_texte) > MAX_TEXTE:
        raise HTTPException(400, f"Höchstens {MAX_TEXTE} Texte je Sammlung.")

    texte = []
    for i, t in enumerate(roh_texte, start=1):
        if not isinstance(t, dict):
            raise HTTPException(400, f"Text {i}: erwartet wird ein Objekt mit »title« und »text«.")
        text = _pruefe_text(t.get("text"), f"Text {i}")
        titel = t.get("title") if isinstance(t.get("title"), str) and t.get("title").strip() else f"Text {i}"
        texte.append({"title": titel.strip()[:200], "text": text})

    roh_woerter = data.get("words", [])
    if not isinstance(roh_woerter, list):
        raise HTTPException(400, "»words« muss eine Liste sein.")
    woerter = []
    for w in roh_woerter:
        if not isinstance(w, str) or not w.strip():
            continue
        _pruefe_text(w, "Wortliste")
        # Der Wortregen kennt keine Leerzeichen im Wort — es fällt als Einheit.
        woerter.append(w.strip().split()[0][:40])

    einstellungen = data.get("settings", {})
    if not isinstance(einstellungen, dict):
        raise HTTPException(400, "»settings« muss ein Objekt sein.")
    unbekannt = set(einstellungen) - BEKANNTE_EINSTELLUNGEN
    if unbekannt:
        raise HTTPException(400, f"Unbekannte Einstellung: {', '.join(sorted(unbekannt))}.")

    beschreibung = data.get("description")
    return TippSammlung(
        title=title.strip()[:200],
        description=beschreibung.strip() if isinstance(beschreibung, str) else None,
        texts=texte,
        words=woerter,
        settings={"lock_on_error": bool(einstellungen.get("lock_on_error", True))},
        created_by=teacher.id,
    )


@router.get("", response_model=list[SammlungKurz])
def liste(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Die Bibliothek — offen für alle Angemeldeten, wie bei den Lückentexten."""
    return [
        SammlungKurz(
            id=s.id, title=s.title, description=s.description,
            anzahl_texte=len(s.texts), anzahl_woerter=len(s.words),
        )
        for s in db.query(TippSammlung).order_by(TippSammlung.created_at.desc()).all()
    ]


@router.get("/template")
def vorlage(_: Teacher = Depends(get_current_teacher)):
    return {
        "_ai_instructions": (
            "Erstelle Tippmaterial für den Zehnfinger-Trainer im vorgegebenen JSON-Format. "
            "--- PFLICHTFELDER --- title, texts. "
            "--- TEXTS --- Liste von Objekten mit title und text. Der text wird Zeichen für "
            "Zeichen abgetippt; er sollte aus vollständigen, sinnvollen Sätzen bestehen und "
            "zwischen 100 und 600 Zeichen lang sein. "
            "--- VERBOTEN --- Nicht vorkommen dürfen: die Tottasten ^ ´ ` (auch nicht in "
            "Zitaten — verwende gerade Anführungszeichen) und alle Zeichen der AltGr-Ebene "
            "@ € [ ] { } \ ~ | ² ³ µ. Schreibe »at« statt @ und »Euro« statt €. "
            "--- WORDS --- optionale Liste einzelner Wörter (ohne Leerzeichen) für das Spiel "
            "»Wortregen«: die Fachbegriffe des Themas, klein geschrieben. "
            "--- SETTINGS --- lock_on_error (Standard true): bei true rückt ein Fehlanschlag "
            "nicht vor, der Schüler muss die richtige Taste finden. Für reine Diktatübungen "
            "mit fortgeschrittenen Klassen kann false sinnvoll sein."
        ),
        "title": "Die Zelle",
        "description": "Fachbegriffe und Merksätze zur Zelle, Biologie Klasse 7.",
        "texts": [
            {
                "title": "Bausteine der Zelle",
                "text": (
                    "Jede Zelle besitzt eine Zellmembran, die sie nach aussen abgrenzt. "
                    "Im Inneren liegt das Zytoplasma, in dem der Zellkern schwimmt. "
                    "Der Zellkern enthaelt die Erbinformation und steuert die Zelle."
                ),
            },
            {
                "title": "Pflanzenzelle",
                "text": (
                    "Die Pflanzenzelle hat zusaetzlich eine feste Zellwand und grosse Vakuolen. "
                    "In den Chloroplasten findet die Fotosynthese statt."
                ),
            },
        ],
        "words": ["zellkern", "zellmembran", "zytoplasma", "vakuole", "chloroplast", "fotosynthese"],
        "settings": {"lock_on_error": True},
    }


@router.post("/upload", response_model=SammlungOut, status_code=201,
             dependencies=[Depends(require_capability("tippen", "upload"))])
def hochladen(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
):
    try:
        roh = json.loads(file.file.read())
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Ungültiges JSON: {e}")
    s = _baue(roh, teacher)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_out(s)


@router.get("/{sammlung_id}", response_model=SammlungOut)
def einzeln(sammlung_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.get(TippSammlung, sammlung_id)
    if not s:
        raise HTTPException(404, "Sammlung nicht gefunden")
    return _to_out(s)


@router.put("/{sammlung_id}", response_model=SammlungOut)
def bearbeiten(sammlung_id: int, roh: dict, db: Session = Depends(get_db),
               teacher: Teacher = Depends(get_current_teacher)):
    """Bearbeiten: dasselbe JSON wie beim Hochladen, dieselben Prüfungen."""
    s = db.get(TippSammlung, sammlung_id)
    if not s:
        raise HTTPException(404, "Sammlung nicht gefunden")
    if s.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Nur wer die Sammlung hochgeladen hat, darf sie bearbeiten.")
    neu = _baue(roh, teacher)
    s.title, s.description = neu.title, neu.description
    s.texts, s.words, s.settings = neu.texts, neu.words, neu.settings
    db.commit()
    db.refresh(s)
    return _to_out(s)


@router.delete("/{sammlung_id}", status_code=204)
def loeschen(sammlung_id: int, db: Session = Depends(get_db),
             teacher: Teacher = Depends(get_current_teacher)):
    s = db.get(TippSammlung, sammlung_id)
    if not s:
        raise HTTPException(404, "Sammlung nicht gefunden")
    if s.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(403, "Nur wer die Sammlung hochgeladen hat, darf sie löschen.")
    db.delete(s)
    db.commit()
