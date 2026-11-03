"""Challenge: Lehrkraft teilt einen Satz aus Fakten + Challenges per Code/QR (ToolSession »challenge«,
ref_id → ChallengeSet), Schüler:innen und Gäste spielen selbstständig, Hauspunkte je Klasse.

Der Server prüft und wertet (api/challenge_engine.py); ``solve``, ``decoy`` und ``feedback``
verlassen ihn nur als Ergebnis einer Antwort, nie im Brett.

Einstellungen der Sitzung (ToolSession.settings):
  spiele list (challenge_engine.SPIELE), theme str (THEMES), skin str (Boss-Aussehen), startstufe int (Standard 2),
  startstufen {student_id: stufe}, etappen_mischen bool (Etappen je Lauf in zufälliger Reihenfolge), punkte_vergeben (Zeitstempel, verhindert doppelte Buchung)
"""
import copy
import csv
import io
import json
import statistics
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, load_only

from .. import challenge_engine as eng
from .. import challenge_lauf as lauf_logik
from ..auth import get_current_teacher, get_current_user, get_player
from ..authorship import author_fields, can_modify, is_student, scope_to_student_pool
from ..availability import require_capability
from ..database import get_db
from ..display_names import short_name
from ..challenge_lauf import AntwortIn, DeckIn, SKINS, STANDARD_STARTSTUFE, StartIn
from .. import scoping
from ..models import ChallengeKalibrierung, ChallengeSet, ChallengeStand, Class, Student, StudentGroupMember, Teacher, ToolSession, Transaction
from ..upload_utils import ALLOWED_EXTENSIONS, save_image
from .karten_quiz import _anzeigename, _wer

router = APIRouter(prefix="/api/challenge", tags=["challenge"])

CHALLENGE_DATA_ROOT = Path(__file__).parent.parent.parent / "data" / "challenges"


# ── Sätze: Laden und Prüfen ──────────────────────────────────────────

def _satz_zeile(db: Session, set_id: int, current) -> ChallengeSet:
    g = db.get(ChallengeSet, set_id)
    # Schüler:innen sehen nur den Pool der Schülerautoren
    if g is None or (is_student(current) and g.created_by_student is None):
        raise HTTPException(404, "Satz nicht gefunden")
    return g


def _pruefen(raw, assets: set[str] | None) -> list[str]:
    """Wirft 422 {"message", "errors"}; gibt sonst die Warnungen zurück."""
    fehler, warnungen = eng.pruefe_satz(raw, assets)
    if fehler:
        raise HTTPException(422, {"message": "Ungültiges Challenge-Format", "errors": fehler})
    return warnungen


def _satz_out(g: ChallengeSet, warnungen: list[str] | None = None) -> dict:
    aus = {"id": g.id, "title": g.title, "subject": g.subject,
           "fakten": len(g.data.get("facts", [])), "challenges": len(g.data.get("challenges", [])),
           "created_at": g.created_at}
    if warnungen is not None:
        aus["warnungen"] = warnungen
    return aus


def _assets_im_ordner(set_id: int) -> set[str]:
    ordner = CHALLENGE_DATA_ROOT / str(set_id) / "assets"
    return {p.name for p in ordner.iterdir()} if ordner.is_dir() else set()


def _lies_upload(file: UploadFile) -> tuple[dict, list[tuple[str, bytes]] | None]:
    """(Satz, Assets) — Assets nur aus einem ZIP, sonst None (Asset-Liste unbekannt)."""
    inhalt = file.file.read()
    assets = None
    if (file.filename or "").endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(inhalt))
        except zipfile.BadZipFile:
            raise HTTPException(400, "Ungültige ZIP-Datei")
        namen = zf.namelist()
        json_namen = [n for n in namen if Path(n).name == "challenge.json"]
        if not json_namen:
            raise HTTPException(400, "ZIP muss challenge.json enthalten")
        inhalt = zf.read(json_namen[0])
        assets = [(Path(n).name, zf.read(n)) for n in namen
                  if "assets/" in n and not n.endswith("/") and Path(n).suffix.lower() in ALLOWED_EXTENSIONS]
    try:
        raw = json.loads(inhalt)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(400, f"Ungültiges JSON: {e}")
    if not isinstance(raw, dict):
        raise HTTPException(400, "Der Satz muss ein JSON-Objekt sein")
    return raw, assets


# ── Sätze: Lehrkraft ─────────────────────────────────────────────────

@router.get("/sets")
def saetze(db: Session = Depends(get_db), current=Depends(get_current_user)):
    q = scope_to_student_pool(db.query(ChallengeSet), ChallengeSet, current)
    return [_satz_out(g) for g in q.order_by(ChallengeSet.created_at.desc()).all()]


@router.get("/template")
def vorlage(_: Teacher = Depends(get_current_teacher)):
    """Beispielsatz zum Herunterladen: Kombo, Ablenker, eine Stufenanpassung, fünf Challenges in einer Etappe."""
    return {
        "title": "Hebelgesetz", "subject": "Physik", "grade": 8, "tags": ["Mechanik"],
        "stages": [{"id": 1, "title": "Der Hebel"}],
        "facts": [
            {"id": "f1", "text": "Kraft mal Kraftarm gleich Last mal Lastarm", "formula": "F_1 \\cdot a_1 = F_2 \\cdot a_2",
             "info": {"text": "Das Hebelgesetz gilt im Gleichgewicht.", "source": {"label": "Lehrbuch", "url": "https://example.org"}}},
            {"id": "f2", "text": "Ein langer Kraftarm spart Kraft"},
            {"id": "f3", "text": "Die Wippe ist ein zweiseitiger Hebel"},
            {"id": "f4", "text": "Die Schubkarre ist ein einseitiger Hebel"},
            {"id": "x1", "text": "Schwere Körper fallen schneller", "decoy": True},
            {"id": "x2", "text": "Ein Hebel erzeugt Energie", "decoy": True},
        ],
        "challenges": [
            {"id": "c1", "text": "Warum hebt eine Brechstange den Stein?", "solve": {"all": ["f1", "f2"]}, "strength": 2,
             "stage": 1, "feedback": "Der lange Kraftarm macht es leicht.", "tip": "Denk an den Kraftarm."},
            {"id": "c2", "text": "Welcher Hebel ist eine Wippe?", "solve": {"any": ["f3"]}, "feedback": "Genau."},
            {"id": "c3", "text": "Welcher Hebel ist eine Schubkarre?", "solve": {"any": ["f4"]}},
            {"id": "c4", "text": "Wie lautet das Hebelgesetz?", "solve": {"any": ["f1"]}},
            {"id": "c5", "text": "Was spart Kraft?", "solve": {"any": ["f2"]}},
        ],
        # Nur für den Gerichtssaal: falsche Behauptungen, widerlegt durch echte Fakten
        "claims": [
            {"id": "k1", "text": "Ein Hebel erzeugt Energie aus dem Nichts.", "refutedBy": ["f1"], "feedback": "Was an Kraft gespart wird, kostet Weg."},
            {"id": "k2", "text": "Ein kurzer Kraftarm spart Kraft.", "refutedBy": ["f2"]},
        ],
        "levels": {
            "1": {"facts": [{"id": "f1", "text": "Kraft mal Kraftarm ist gleich Last mal Lastarm"}],
                  "challenges": [{"id": "c6", "text": "Welcher Hebel ist eine Wippe? (leicht)", "solve": {"any": ["f3"]}}],
                  "omit": ["c2"]},
        },
    }


@router.post("/upload", status_code=201, dependencies=[Depends(require_capability("challenge", "upload"))])
def hochladen(file: UploadFile = File(...), db: Session = Depends(get_db), current=Depends(get_current_user)):
    raw, assets = _lies_upload(file)
    warnungen = _pruefen(raw, {n for n, _ in assets} if assets is not None else None)
    g = ChallengeSet(title=raw["title"].strip()[:200], subject=(raw.get("subject") or None), data=raw, **author_fields(current))
    db.add(g)
    db.commit()
    db.refresh(g)
    if assets:
        ordner = CHALLENGE_DATA_ROOT / str(g.id) / "assets"
        ordner.mkdir(parents=True, exist_ok=True)
        for name, blob in assets:
            (ordner / name).write_bytes(blob)
        g.asset_path = str(CHALLENGE_DATA_ROOT / str(g.id))
        db.commit()
        db.refresh(g)
    return _satz_out(g, warnungen)


@router.get("/sets/{set_id}")
def satz_lesen(set_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    return _satz_zeile(db, set_id, current).data


@router.put("/sets/{set_id}")
def satz_aendern(set_id: int, raw: dict, db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Bearbeiten: dasselbe JSON, dieselbe Prüfung wie beim Hochladen. Hochgeladene Assets bleiben liegen."""
    g = _satz_zeile(db, set_id, current)
    if not can_modify(g, current):
        raise HTTPException(403)
    warnungen = _pruefen(raw, _assets_im_ordner(g.id))
    g.title, g.subject, g.data = raw["title"].strip()[:200], (raw.get("subject") or None), raw
    db.commit()
    db.refresh(g)
    return _satz_out(g, warnungen)


@router.delete("/sets/{set_id}", status_code=204)
def satz_loeschen(set_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    g = _satz_zeile(db, set_id, current)
    if not can_modify(g, current):
        raise HTTPException(403)
    db.delete(g)
    db.commit()


@router.post("/sets/{set_id}/assets", status_code=201)
def asset_hochladen(set_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current=Depends(get_current_user)):
    """Bild für Fakt oder Challenge; zurück kommt der Dateiname fürs Feld »image«."""
    g = _satz_zeile(db, set_id, current)
    if not can_modify(g, current):
        raise HTTPException(403)
    name = save_image(file, CHALLENGE_DATA_ROOT / str(g.id) / "assets")
    if not g.asset_path:
        g.asset_path = str(CHALLENGE_DATA_ROOT / str(g.id))
        db.commit()
    return {"path": name, "url": f"/uploads/challenges/{g.id}/assets/{name}"}


@router.get("/sets/{set_id}/export")
def satz_exportieren(set_id: int, db: Session = Depends(get_db), current=Depends(get_current_user)):
    g = _satz_zeile(db, set_id, current)
    return Response(json.dumps(g.data, ensure_ascii=False, indent=2).encode("utf-8"), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="challenge_{g.id}.json"'})


# ── Sitzung, Teilnehmer, Stand ───────────────────────────────────────

def _sitzung(db: Session, code: str) -> ToolSession:
    s = db.query(ToolSession).filter_by(code=code.upper(), tool_slug="challenge").first()
    if s is None:
        raise HTTPException(404, "Challenge nicht gefunden")
    return s


def _offene_sitzung(db: Session, code: str) -> ToolSession:
    s = _sitzung(db, code)
    if s.status == "closed":
        raise HTTPException(403, "Diese Challenge ist geschlossen")
    return s


def _gebunden(s: ToolSession) -> bool:
    return s.class_id is not None or s.group_id is not None


def _zugang(db: Session, s: ToolSession, spieler) -> None:
    """Eine Klassen- bzw. Kurssitzung lässt angemeldete Schüler:innen nur aus ihrem Geltungsbereich herein; Lehrkräfte und Gäste immer."""
    if not _gebunden(s) or not isinstance(spieler, Student):
        return
    if s.class_id is not None:
        drin = spieler.class_id == s.class_id
    else:
        drin = db.query(StudentGroupMember).filter_by(group_id=s.group_id, student_id=spieler.id).first() is not None
    if not drin:
        raise HTTPException(403, "Diese Challenge läuft für eine andere Klasse")


def _klasse_fuer(db: Session, s: ToolSession, spieler) -> int | None:
    """Wem der Stand zugutekommt: Schüler:innen ihrer Klasse, Gäste der Klasse der Sitzung (bei einem Kurs aus mehreren Klassen niemandem)."""
    if isinstance(spieler, Student):
        return spieler.class_id
    if isinstance(spieler, Teacher) or not _gebunden(s):
        return None
    return scoping.participant_class_id(session_class_id=s.class_id, session_group_id=s.group_id, student_class_id=None,
                                        chosen_class_id=None, allowed_class_ids=scoping.scope_class_ids(db, s.class_id, s.group_id))


def _satz(db: Session, s: ToolSession) -> ChallengeSet:
    g = db.get(ChallengeSet, s.ref_id) if s.ref_id else None
    if g is None:
        raise HTTPException(404, "Der Satz zu dieser Challenge fehlt")
    return g


def _stufe(wert) -> int:
    return wert if wert in eng.STUFEN else STANDARD_STARTSTUFE


def _spiele(s: ToolSession, daten: dict) -> list[str]:
    """Erlaubte Spielarten; der Gerichtssaal nur für Sätze mit Behauptungen."""
    liste = (s.settings or {}).get("spiele")
    spiele = [x for x in liste if x in eng.SPIELE] if isinstance(liste, list) else []
    return [x for x in spiele if x != "gericht" or daten.get("claims")] or ["normal"]


def _einstellungen(s: ToolSession, daten: dict) -> dict:
    e = s.settings or {}
    return {"spiele": _spiele(s, daten), "theme": e["theme"] if e.get("theme") in eng.THEMES else "klassisch",
            "skin": e["skin"] if e.get("skin") in SKINS else "monster",
            "startstufe": _stufe(e.get("startstufe", STANDARD_STARTSTUFE)),
            "etappen_mischen": e.get("etappen_mischen") is True}


def _startstufe(s: ToolSession, spieler) -> int:
    startstufen = (s.settings or {}).get("startstufen")
    if isinstance(spieler, Student) and isinstance(startstufen, dict) and str(spieler.id) in startstufen:
        return _stufe(startstufen[str(spieler.id)])
    return _stufe((s.settings or {}).get("startstufe", STANDARD_STARTSTUFE))


def _stand(db: Session, s: ToolSession, spieler) -> ChallengeStand | None:
    return db.query(ChallengeStand).filter_by(session_id=s.id, **_wer(spieler)).first()


def _stand_oder_409(db: Session, s: ToolSession, spieler) -> ChallengeStand:
    st = _stand(db, s, spieler)
    if st is None:
        raise HTTPException(409, "Erst starten")
    return st


def _lauf(st: ChallengeStand) -> dict:
    """Stand-Spalten als Lauf-dict (api/challenge_lauf.py); ``spiel`` liegt im ``zustand``.

    Flache Kopien genügen: die Lauf-Logik ersetzt Listen und Unter-dicts, statt sie zu verändern."""
    z = dict(st.zustand)
    return {"stufe": st.stufe, "stufe_start": st.stufe_start, "seed": st.seed, "spiel": z.pop("spiel", "normal"),
            "zustand": z, "fragen": list(st.fragen), "verlauf": list(st.verlauf),
            "fertig": st.fertig_am is not None}


def _speichern(st: ChallengeStand, lauf: dict) -> None:
    st.stufe, st.fragen, st.verlauf = lauf["stufe"], lauf["fragen"], lauf["verlauf"]
    st.zustand = {**lauf["zustand"], "spiel": lauf["spiel"]}
    if lauf["fertig"] and st.fertig_am is None:
        st.fertig_am = datetime.now(timezone.utc)


def _neuer_stand(db: Session, s: ToolSession, spieler, daten: dict, spiel: str) -> ChallengeStand:
    lauf = lauf_logik.neuer_lauf(daten, _startstufe(s, spieler), spiel, mischen=_einstellungen(s, daten)["etappen_mischen"])
    st = ChallengeStand(session_id=s.id, name=_anzeigename(spieler)[:100], stufe_start=lauf["stufe"], seed=lauf["seed"],
                        class_id=_klasse_fuer(db, s, spieler), **_wer(spieler))
    _speichern(st, lauf)
    db.add(st)
    db.flush()
    return st


def _bild(set_id: int):
    return lambda name: f"/uploads/challenges/{set_id}/assets/{name}"


def _kalibrierung(db: Session, class_id: int | None) -> dict | None:
    zeile = db.query(ChallengeKalibrierung).filter_by(class_id=class_id).first() if class_id is not None else None
    return zeile.werte if zeile else None


def _kalibrierungen(db: Session, class_ids) -> dict[int, dict]:
    """Kalibrierungen mehrerer Klassen mit einer Abfrage; Klassen ohne eigene fehlen im Ergebnis."""
    ids = {c for c in class_ids if c is not None}
    if not ids:
        return {}
    return {cid: werte for cid, werte in db.query(ChallengeKalibrierung.class_id, ChallengeKalibrierung.werte)
            .filter(ChallengeKalibrierung.class_id.in_(ids)).all() if werte}


# ── Spieler ──────────────────────────────────────────────────────────

@router.get("/statistik")
def statistik(class_id: int | None = None, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    """Nur Summen für die DDA-Feinabstimmung: je Klasse und End-Stufe über alle Sitzungen der Lehrkraft."""
    q = (db.query(ChallengeStand).join(ToolSession, ToolSession.id == ChallengeStand.session_id)
         .filter(ToolSession.created_by == lehrkraft.id, ToolSession.tool_slug == "challenge",
                 ChallengeStand.class_id.isnot(None)))
    if class_id is not None:
        q = q.filter(ChallengeStand.class_id == class_id)
    gruppen: dict[tuple[int, int], list[ChallengeStand]] = {}
    for st in q.all():
        gruppen.setdefault((st.class_id, st.stufe), []).append(st)
    klassen = {c.id: c.code for c in db.query(Class).filter(Class.id.in_({k[0] for k in gruppen})).all()} if gruppen else {}
    kalibrierungen = _kalibrierungen(db, {k[0] for k in gruppen})
    zeilen = []
    for (cid, stufe), staende in sorted(gruppen.items()):
        fragen = [f for st in staende for f in st.fragen]
        tempos = [t for t in (eng.lesetempo(f["woerter"], f["lese_ms"]) for f in fragen) if t is not None]
        zeilen.append({"class_id": cid, "klasse": klassen.get(cid, str(cid)), "stufe": stufe, "teilnehmer": len(staende),
                       "lesetempo_median": round(statistics.median(tempos), 1) if tempos else None,
                       "anteil_geraten": round(sum(_geraten(f, kalibrierungen.get(cid)) for f in fragen) / len(fragen), 3) if fragen else 0})
    return zeilen


def _werte_pruefen(werte) -> dict:
    """422 bei allem, was nicht dem Format von STANDARD_KALIBRIERUNG entspricht."""
    try:
        wpm = {str(s): werte["lese_wpm"][str(s)] for s in eng.STUFEN}
        zeit = {k: float(werte["antwortzeit"][k]) for k in ("schnell", "langsam")}
        ok = (all(isinstance(v, int) and not isinstance(v, bool) and v > 0 for v in wpm.values())
              and 0 < zeit["schnell"] < zeit["langsam"] <= 60)
    except (KeyError, TypeError, ValueError):
        ok = False
    if not ok:
        raise HTTPException(422, "Ungültige Kalibrierung")
    return {"lese_wpm": wpm, "antwortzeit": zeit}


@router.get("/kalibrierung")
def kalibrierung_lesen(class_id: int, db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    """Aktuelle Werte der Klasse und ein Vorschlag aus allen ihren Antworten (nur Summen, nichts wird gespeichert)."""
    aktuell = _kalibrierung(db, class_id) or eng.STANDARD_KALIBRIERUNG
    je_stufe: dict[int, list[dict]] = {}
    for (fragen,) in db.query(ChallengeStand.fragen).filter_by(class_id=class_id).all():
        for f in fragen:
            je_stufe.setdefault(f["stufe"], []).append(f)
    v = eng.vorschlag(je_stufe, aktuell)
    return {"aktuell": aktuell, "vorschlag": v["werte"], "stichprobe": v["stichprobe"], "genug": v["genug"]}


class KalibrierungIn(BaseModel):
    class_id: int
    werte: dict


@router.put("/kalibrierung")
def kalibrierung_speichern(body: KalibrierungIn, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    werte = _werte_pruefen(body.werte)
    if db.get(Class, body.class_id) is None:
        raise HTTPException(404, "Klasse nicht gefunden")
    zeile = db.query(ChallengeKalibrierung).filter_by(class_id=body.class_id).first()
    if zeile is None:
        zeile = ChallengeKalibrierung(class_id=body.class_id)
        db.add(zeile)
    zeile.vorher, zeile.werte = zeile.werte or None, werte
    zeile.bestaetigt_von, zeile.bestaetigt_am = lehrkraft.id, datetime.now(timezone.utc)
    db.commit()
    return {"class_id": body.class_id, "werte": werte}


@router.delete("/kalibrierung/{class_id}", status_code=204)
def kalibrierung_zuruecksetzen(class_id: int, db: Session = Depends(get_db), _: Teacher = Depends(get_current_teacher)):
    db.query(ChallengeKalibrierung).filter_by(class_id=class_id).delete()
    db.commit()


@router.get("/{code}")
def info(code: str, db: Session = Depends(get_db), spieler=Depends(get_player)):
    s = _offene_sitzung(db, code)
    _zugang(db, s, spieler)
    satz = _satz(db, s)
    st = _stand(db, s, spieler)
    return {"title": satz.title, "subject": satz.subject, "settings": _einstellungen(s, satz.data),
            "stand": None if st is None else {"stufe": st.stufe, "spiel": st.zustand.get("spiel", "normal"), "etappe": st.zustand["etappe"], "leben": st.zustand["leben"],
                                              "fragen": len(st.fragen), "ergebnis": st.ergebnis, "fertig": st.fertig_am is not None}}


@router.post("/{code}/start")
def start(code: str, body: StartIn | None = None, db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Stand anlegen oder fortsetzen (optional mit anderer Spielart); zurück kommt das Brett der aktuellen Etappe."""
    s = _offene_sitzung(db, code)
    _zugang(db, s, spieler)
    g = _satz(db, s)
    wunsch = body.spiel if body else None
    erlaubt = _spiele(s, g.data)
    if wunsch == "gericht" and not g.data.get("claims"):
        raise HTTPException(400, "Dieser Satz hat keine Behauptungen für den Gerichtssaal")
    st = _stand(db, s, spieler)
    if st is None:
        st = _neuer_stand(db, s, spieler, g.data, wunsch if wunsch in erlaubt else erlaubt[0])
    elif wunsch in erlaubt:
        lauf = _lauf(st)
        lauf_logik.spiel_wechseln(g.data, lauf, wunsch)
        _speichern(st, lauf)
    db.commit()
    return lauf_logik.brett(g.data, _lauf(st), _bild(g.id))


@router.post("/{code}/deck")
def deck(code: str, body: DeckIn, db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Kartenspiel: Deck der aktuellen Etappe festlegen; zurück kommt das Brett."""
    s = _offene_sitzung(db, code)
    g = _satz(db, s)
    st = _stand_oder_409(db, s, spieler)
    lauf = _lauf(st)
    lauf_logik.deck_setzen(g.data, lauf, body.fakt_ids)
    _speichern(st, lauf)
    db.commit()
    return lauf_logik.brett(g.data, lauf, _bild(g.id))


@router.post("/{code}/antwort")
def antwort(code: str, body: AntwortIn, db: Session = Depends(get_db), spieler=Depends(get_player)):
    s = _offene_sitzung(db, code)
    g = _satz(db, s)
    st = _stand_oder_409(db, s, spieler)
    lauf = _lauf(st)
    aus, neues_brett, w = lauf_logik.antworte_mit_brett(g.data, lauf, body.challenge_id, body.fakt_ids, body.lese_ms,
                                                        body.wahl_ms, body.tipp, _kalibrierung(db, st.class_id), _bild(g.id))
    _speichern(st, lauf)
    st.guete, st.ergebnis = w["guete"], w["ergebnis"]
    db.commit()
    return {**aus, "brett": neues_brett}


# Obergrenze für gemeldete Spielpunkte: Edelsteine zählen zweistellig, Glücksrad-Münzen fünfstellig
SPIELWERT_GRENZE = 100_000


class SpielwertIn(BaseModel):
    spiel: str = Field(max_length=30)
    etappe: int = Field(ge=1, le=1000)
    edelsteine: int = Field(ge=0)
    max: int = Field(ge=1, le=SPIELWERT_GRENZE)


def _summe_spielwerte(zustand: dict, spiel: str) -> tuple[int, int]:
    werte = (zustand.get("spielwerte") or {}).get(spiel) or {}
    return sum(w["edelsteine"] for w in werte.values()), sum(w["max"] for w in werte.values())


@router.post("/{code}/spielwert")
def spielwert(code: str, body: SpielwertIn, db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Edelsteine eines Minispiels (z. B. Hüpfen) je Etappe fürs Brett der Bestenliste.

    Vom Client gemeldet und nur plausibilisiert (edelsteine <= max, max <= SPIELWERT_GRENZE): ein Spielstand ohne Wettbewerbswert,
    wie die Bestenliste der Schreibübung (api/routers/bestenliste.py). Beeinflusst weder Güte noch Ergebnis noch
    Hauspunkte; pro Etappe zählt der beste gemeldete Wert."""
    if body.spiel not in eng.SPIELE:
        raise HTTPException(422, "Unbekannte Spielart")
    if body.edelsteine > body.max:
        raise HTTPException(422, "Mehr Edelsteine als möglich")
    s = _offene_sitzung(db, code)
    st = _stand_oder_409(db, s, spieler)
    z = copy.deepcopy(st.zustand)
    je_spiel = z.setdefault("spielwerte", {}).setdefault(body.spiel, {})
    alt = je_spiel.get(str(body.etappe))
    if alt is None or body.edelsteine > alt["edelsteine"]:
        je_spiel[str(body.etappe)] = {"edelsteine": body.edelsteine, "max": body.max,
                                      "am": datetime.now(timezone.utc).isoformat()}
        st.zustand = z  # neues dict, damit SQLAlchemy die Änderung bemerkt
        db.commit()
    gesamt, maximal = _summe_spielwerte(st.zustand, body.spiel)
    return {"gesamt": gesamt, "max": maximal}


@router.get("/{code}/bestenliste")
def bestenliste(code: str, spiel: str = "huepfen", db: Session = Depends(get_db), spieler=Depends(get_player)):
    """Top 20 nach Edelsteinen; nur Stände mit einem Wert für diese Spielart (Namen wie im Stand, Gäste mit Gastname).
    Eine mitspielende Lehrkraft sieht nur sie selbst darin, nie die Klasse."""
    s = _sitzung(db, code)
    ich = _wer(spieler)
    zeilen = []
    spalten = [ChallengeStand.name, ChallengeStand.zustand, ChallengeStand.teacher_id,
               *(getattr(ChallengeStand, k) for k in ich if k != "teacher_id")]
    for st in db.query(ChallengeStand).options(load_only(*spalten)).filter_by(session_id=s.id).all():
        werte = (st.zustand.get("spielwerte") or {}).get(spiel)
        if not werte:
            continue
        if st.teacher_id is not None and st.teacher_id != ich.get("teacher_id"):
            continue
        gesamt, maximal = _summe_spielwerte(st.zustand, spiel)
        spaet = max((w.get("am") or "" for w in werte.values()), default="")
        zeilen.append((gesamt, spaet, {"name": st.name, "edelsteine": gesamt, "max": maximal,
                                       "ich": all(getattr(st, k) == v for k, v in ich.items())}))
    zeilen.sort(key=lambda z: (-z[0], z[1]))
    return [{"platz": i + 1, **z[2]} for i, z in enumerate(zeilen[:20])]


# ── Auswertung (Lehrkraft) ───────────────────────────────────────────

def _eigene_sitzung(db: Session, code: str, lehrkraft: Teacher) -> ToolSession:
    s = _sitzung(db, code)
    if s.created_by != lehrkraft.id:
        raise HTTPException(403, "Das ist nicht deine Sitzung.")
    return s


def _geraten(f: dict, kalibrierung: dict | None = None) -> bool:
    return eng.geraten(f["woerter"], f["lese_ms"], f["stufe"], kalibrierung)


def _teilnehmer(st: ChallengeStand, klasse: str, ablenker: dict[str, str], kalibrierung: dict | None) -> dict:
    erste = {}
    for f in st.fragen:
        erste.setdefault(f["c"], f["komplett"])
    tempos = [t for t in (eng.lesetempo(f["woerter"], f["lese_ms"]) for f in st.fragen) if t is not None]
    gewaehlt = [ablenker[i] for f in st.fragen for i in f["f"] if i in ablenker]
    deck_ablenker = [ablenker[i] for i in st.zustand.get("deck_ablenker", []) if i in ablenker]
    return {"stand_id": st.id, "student_id": st.student_id, "name": st.name, "klasse": klasse, "stufe_start": st.stufe_start, "stufe": st.stufe,
            "guete": round(st.guete, 4), "ergebnis": round(st.ergebnis, 4), "punkte": round(st.ergebnis * 100),
            "fragen": len(st.fragen), "erstversuch_richtig": sum(erste.values()),
            "kombos": sum(1 for f in st.fragen if f["kombo"]),
            "ablenker_gewaehlt": list(dict.fromkeys(gewaehlt)), "deck_ablenker": deck_ablenker,
            "lesetempo_median": round(statistics.median(tempos), 1) if tempos else None,
            "geraten": sum(_geraten(f, kalibrierung) for f in st.fragen), "fertig": st.fertig_am is not None,
            "edelsteine": _summe_spielwerte(st.zustand, "huepfen")[0] if (st.zustand.get("spielwerte") or {}).get("huepfen") else None}


def _staende(db: Session, s: ToolSession) -> list[ChallengeStand]:
    return db.query(ChallengeStand).filter_by(session_id=s.id).order_by(ChallengeStand.name).all()


def _teilnehmerliste(db: Session, s: ToolSession, staende: list[ChallengeStand] | None = None) -> list[dict]:
    daten = _satz(db, s).data
    ablenker = {f["id"]: f["text"] for f in daten.get("facts", []) if f.get("decoy")}
    staende = _staende(db, s) if staende is None else staende
    class_ids = {st.class_id for st in staende if st.class_id is not None}
    klassen = {cid: code for cid, code in db.query(Class.id, Class.code).filter(Class.id.in_(class_ids)).all()} if class_ids else {}
    kalibrierungen = _kalibrierungen(db, class_ids)
    return [_teilnehmer(st, f"{klassen[st.class_id]} (Gast)" if st.guest_id and st.class_id in klassen
                        else klassen.get(st.class_id, "Gast" if st.guest_id else "Lehrkraft" if st.teacher_id else ""),
                        ablenker, kalibrierungen.get(st.class_id)) for st in staende]


def vorschau_punkte(db: Session, s: ToolSession, staende: list[ChallengeStand] | None = None) -> list[dict]:
    """Je Klasse der Mittelwert der Punkte (Ergebnis × 100) ihrer Schüler:innen; Lehrkräfte zählen nicht.
    Gebundene Sitzung: Gäste zählen für die Klasse der Sitzung mit, und Punkte gibt es nur für deren Klasse(n).

    ``staende``: schon geladene Stände der Sitzung (spart die zweite Abfrage)."""
    je: dict[int, list[int]] = {}
    if staende is None:
        staende = db.query(ChallengeStand).filter(ChallengeStand.session_id == s.id).all()
    erlaubt = set(scoping.scope_class_ids(db, s.class_id, s.group_id)) if _gebunden(s) else None
    for st in staende:
        if st.class_id is not None and (st.student_id is not None or st.guest_id is not None) and (erlaubt is None or st.class_id in erlaubt):
            je.setdefault(st.class_id, []).append(round(st.ergebnis * 100))
    klassen = {c.id: c.code for c in db.query(Class).filter(Class.id.in_(je.keys())).all()} if je else {}
    return sorted(({"class_id": cid, "klasse": klassen.get(cid, str(cid)), "teilnehmer": len(werte),
                    "punkte": round(sum(werte) / len(werte))} for cid, werte in je.items()), key=lambda z: z["klasse"])


@router.get("/{code}/uebersicht")
def uebersicht(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    s = _eigene_sitzung(db, code, lehrkraft)
    staende = _staende(db, s)
    return {"teilnehmer": _teilnehmerliste(db, s, staende), "punkte": vorschau_punkte(db, s, staende)}


@router.get("/{code}/export.csv")
def export_csv(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    s = _eigene_sitzung(db, code, lehrkraft)
    zeilen = _teilnehmerliste(db, s)
    puffer = io.StringIO()
    schreiber = csv.writer(puffer, delimiter=";")
    spalten = ["name", "klasse", "stufe_start", "stufe", "guete", "ergebnis", "punkte", "fragen", "erstversuch_richtig",
               "kombos", "ablenker_gewaehlt", "deck_ablenker", "lesetempo_median", "geraten", "fertig", "edelsteine"]
    schreiber.writerow(spalten)
    for z in zeilen:
        schreiber.writerow([" | ".join(z[k]) if k in ("ablenker_gewaehlt", "deck_ablenker") else ("" if z[k] is None else z[k]) for k in spalten])
    return Response(puffer.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="challenge_{s.code}.csv"'})


@router.post("/{code}/punkte")
def punkte_vergeben(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    s = _eigene_sitzung(db, code, lehrkraft)
    if (s.settings or {}).get("punkte_vergeben"):
        raise HTTPException(409, "Für diese Challenge wurden schon Punkte vergeben.")
    satz = _satz(db, s)
    zeilen = vorschau_punkte(db, s)
    for z in zeilen:
        if z["punkte"] > 0:
            db.add(Transaction(teacher_id=lehrkraft.id, class_id=z["class_id"], points=z["punkte"],
                               reason=f"Challenge: {satz.title}"[:200]))
    s.settings = {**(s.settings or {}), "punkte_vergeben": datetime.now(timezone.utc).isoformat()}
    db.commit()
    return {"vergeben": zeilen}


@router.delete("/{code}/staende", status_code=204)
def zuruecksetzen(code: str, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    """Neue Runde: alle Stände löschen; danach dürfen wieder Punkte vergeben werden."""
    s = _eigene_sitzung(db, code, lehrkraft)
    db.query(ChallengeStand).filter_by(session_id=s.id).delete()
    s.settings = {k: v for k, v in (s.settings or {}).items() if k != "punkte_vergeben"}
    db.commit()


class StufenIn(BaseModel):
    startstufen: dict[str, int | None]


@router.put("/{code}/stufen")
def startstufen_setzen(code: str, body: StufenIn, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    """Startstufe je Schüler:in (null entfernt den Eintrag); gilt für Stände, die noch nicht angelegt sind."""
    s = _eigene_sitzung(db, code, lehrkraft)
    if any(v is not None and v not in eng.STUFEN for v in body.startstufen.values()):
        raise HTTPException(422, "Stufen gehen von 1 bis 4")
    stufen = {**((s.settings or {}).get("startstufen") or {}), **body.startstufen}
    stufen = {k: v for k, v in stufen.items() if v is not None}
    s.settings = {**(s.settings or {}), "startstufen": stufen}
    db.commit()
    return {"startstufen": stufen}


class StandStufeIn(BaseModel):
    stufe: int = Field(ge=1, le=4)


@router.put("/{code}/staende/{stand_id}/stufe")
def stand_stufe(code: str, stand_id: int, body: StandStufeIn, db: Session = Depends(get_db),
                lehrkraft: Teacher = Depends(get_current_teacher)):
    """Aktuelle Stufe eines laufenden Stands setzen; der Verlauf bleibt."""
    s = _eigene_sitzung(db, code, lehrkraft)
    st = db.query(ChallengeStand).filter_by(id=stand_id, session_id=s.id).first()
    if st is None:
        raise HTTPException(404, "Stand nicht gefunden")
    st.stufe = body.stufe
    db.commit()
    return {"stand_id": st.id, "stufe": st.stufe}


@router.get("/{code}/schueler")
def schueler(code: str, class_id: int, db: Session = Depends(get_db), lehrkraft: Teacher = Depends(get_current_teacher)):
    """Schüler:innen der Klasse mit Startstufe und Stand, damit die Lehrkraft vor dem Start Stufen setzen kann."""
    s = _eigene_sitzung(db, code, lehrkraft)
    startstufen = (s.settings or {}).get("startstufen") or {}
    staende = {st.student_id: st for st in db.query(ChallengeStand).filter(
        ChallengeStand.session_id == s.id, ChallengeStand.student_id.isnot(None)).all()}
    kinder = db.query(Student).filter_by(class_id=class_id, active=True).order_by(Student.nachname, Student.vorname).all()
    return [{"id": k.id, "name": short_name(k), "startstufe": startstufen.get(str(k.id)),
             "stand_id": staende[k.id].id if k.id in staende else None,
             "stufe": staende[k.id].stufe if k.id in staende else None} for k in kinder]
