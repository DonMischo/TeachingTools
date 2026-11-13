"""
Tool registry for Stundenplanung.

To add a new tool to Stundenplanung, register one ToolDescriptor here.
No other file needs to change: the picker UI, launch flow, validation and
URLs are all driven by this registry.

A descriptor answers three questions:
  - What reusable content can a lesson phase link to?   (list_refs)
  - What happens when the teacher clicks "Start"?       (launch)
  - Where do teacher and students go?                   (LaunchResult URLs)

Conventions ("uses_class" tools): game-like tools take the class from the
launch context (the lesson plan's `klasse`, or the class picker on the
tool's own page) and bind their session to it, so points earned by
correctness are credited to that class.
"""
import re
from dataclasses import dataclass
from typing import Callable

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .models import (
    Teacher, Class, Quiz, BingoSet, AuctionSet,
    BarometerSession, ExitTicketSession, SchreibraumRoom, SchreibraumAccess, ExitGame,
    TimelineSet, ChallengeSet, FragmentCollection, Fragment, ResearchItem,
)


@dataclass
class LaunchResult:
    host_url: str              # frontend route the teacher opens
    join_url: str | None       # student-facing route (QR etc.), None if n/a
    code: str | None           # session/join code, None for static tools


@dataclass
class ToolDescriptor:
    type: str                  # slug, e.g. "caputh"
    label: str                 # display label incl. icon, e.g. "🏕️ Caputh"
    requires_ref: bool         # False → static tool, picker shows no dropdown
    uses_class: bool           # True → launch binds a class (points/access)
    list_refs: Callable[[Session, Teacher], list[dict]]
    launch: Callable[[Session, Teacher, "str | None", "str | None"], LaunchResult]
    # False → startet noch (alte Verknüpfungen), steht aber nicht mehr in der Auswahl
    waehlbar: bool = True


def _parse_content_id(ref_id: str | None) -> int:
    try:
        return int(ref_id)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise HTTPException(404, "Dieser Tool-Link ist veraltet — bitte im Editor neu verknüpfen.")


def _resolve_class(db: Session, klasse: str | None) -> Class | None:
    if not klasse:
        return None
    return db.query(Class).filter_by(code=klasse).first()


# ── caputh ────────────────────────────────────────────────────────────────────

def _caputh_refs(db: Session, teacher: Teacher) -> list[dict]:
    quizzes = db.query(Quiz).order_by(Quiz.created_at.desc()).all()
    return [{"ref_id": str(q.id), "label": q.title} for q in quizzes]


def _caputh_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .routers.capuths import create_session_for_class

    quiz_id = _parse_content_id(ref_id)
    cls = _resolve_class(db, klasse)
    if not cls:
        raise HTTPException(400, "Keine Klasse zugeordnet — bitte Klasse in der Planung angeben.")
    session = create_session_for_class(db, quiz_id, cls.id, teacher.id)
    return LaunchResult(
        host_url=f"/aktivitaeten/caputh/host/{session.join_code}",
        join_url=f"/play/{session.join_code}",
        code=session.join_code,
    )


# ── bingo ─────────────────────────────────────────────────────────────────────

def _bingo_refs(db: Session, teacher: Teacher) -> list[dict]:
    sets = db.query(BingoSet).order_by(BingoSet.created_at.desc()).all()
    return [{"ref_id": str(s.id), "label": s.title} for s in sets]


def _bingo_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .routers.bingo import create_session_from_set

    set_id = _parse_content_id(ref_id)
    cls = _resolve_class(db, klasse)
    session = create_session_from_set(db, set_id, teacher.id, cls.id if cls else None)
    return LaunchResult(
        host_url=f"/aktivitaeten/bingo/host/{session.code}",
        join_url=f"/play/bingo/{session.code}",
        code=session.code,
    )


# ── auction ───────────────────────────────────────────────────────────────────

def _auction_refs(db: Session, teacher: Teacher) -> list[dict]:
    sets = db.query(AuctionSet).order_by(AuctionSet.created_at.desc()).all()
    return [{"ref_id": str(s.id), "label": s.title} for s in sets]


def _auction_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .routers.auction import create_session_from_set

    set_id = _parse_content_id(ref_id)
    session = create_session_from_set(db, set_id, teacher.id)
    return LaunchResult(
        host_url=f"/tools/auction/host/{session.code}",
        join_url=f"/play/auction/{session.code}",
        code=session.code,
    )


# ── barometer ─────────────────────────────────────────────────────────────────

def _barometer_refs(db: Session, teacher: Teacher) -> list[dict]:
    sessions = (
        db.query(BarometerSession)
        .filter(or_(BarometerSession.created_by == teacher.id, BarometerSession.shared == True))  # noqa: E712
        .order_by(BarometerSession.created_at.desc())
        .all()
    )
    return [{"ref_id": s.code, "label": s.title} for s in sessions]


def _barometer_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .routers.barometer import clone_session_impl

    if not ref_id:
        raise HTTPException(404, "Kein Barometer verknüpft")
    session = clone_session_impl(db, ref_id, teacher)
    return LaunchResult(
        host_url=f"/tools/barometer/host/{session.code}",
        join_url=f"/play/barometer/{session.code}",
        code=session.code,
    )


# ── exit-ticket ───────────────────────────────────────────────────────────────

def _exit_ticket_refs(db: Session, teacher: Teacher) -> list[dict]:
    sessions = (
        db.query(ExitTicketSession)
        .filter_by(created_by=teacher.id)
        .order_by(ExitTicketSession.created_at.desc())
        .all()
    )
    return [{"ref_id": s.code, "label": s.title} for s in sessions]


def _exit_ticket_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .routers.exit_ticket import clone_session_impl

    if not ref_id:
        raise HTTPException(404, "Kein Exit Ticket verknüpft")
    session = clone_session_impl(db, ref_id, teacher)
    return LaunchResult(
        host_url=f"/tools/exit-ticket/host/{session.code}",
        join_url=f"/play/exit-ticket/{session.code}",
        code=session.code,
    )


# ── schreibraum ───────────────────────────────────────────────────────────────

def _schreibraum_refs(db: Session, teacher: Teacher) -> list[dict]:
    rooms = (
        db.query(SchreibraumRoom)
        .filter_by(created_by=teacher.id)
        .order_by(SchreibraumRoom.created_at.desc())
        .all()
    )
    return [{"ref_id": r.code, "label": r.title} for r in rooms]


def _schreibraum_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    if not ref_id:
        raise HTTPException(404, "Kein Schreibraum verknüpft")
    room = db.query(SchreibraumRoom).filter_by(code=ref_id).first()
    if not room:
        raise HTTPException(404, "Schreibraum nicht gefunden")
    # Auto-grant access for the launch class so its students can join
    # without a manual grant.
    cls = _resolve_class(db, klasse)
    if cls:
        existing = db.query(SchreibraumAccess).filter_by(room_id=room.id, class_id=cls.id).first()
        if not existing:
            db.add(SchreibraumAccess(room_id=room.id, class_id=cls.id))
            db.commit()
    return LaunchResult(
        host_url=f"/schreibraum/{room.code}",
        join_url=f"/schreibraum/{room.code}",
        code=room.code,
    )


# ── exitgame ──────────────────────────────────────────────────────────────────

def _exitgame_refs(db: Session, teacher: Teacher) -> list[dict]:
    games = db.query(ExitGame).order_by(ExitGame.created_at.desc()).all()
    return [{"ref_id": str(g.id), "label": g.title} for g in games]


def _exitgame_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .routers.exitgame import create_or_reuse_open_session

    exitgame_id = _parse_content_id(ref_id)
    cls = _resolve_class(db, klasse)
    if not cls:
        raise HTTPException(400, "Keine Klasse zugeordnet — bitte Klasse in der Planung angeben.")
    session = create_or_reuse_open_session(db, exitgame_id, cls.id, teacher.id)
    return LaunchResult(
        host_url=f"/aktivitaeten/taskcrawler/host/{session.join_code}",
        join_url=f"/play/taskcrawler/{session.join_code}",
        code=session.join_code,
    )


# ── zeitstrahl ────────────────────────────────────────────────────────────────

def _zeitstrahl_refs(db: Session, teacher: Teacher) -> list[dict]:
    sets = db.query(TimelineSet).order_by(TimelineSet.created_at.desc()).all()
    return [{"ref_id": str(s.id), "label": s.title} for s in sets]


def _zeitstrahl_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    set_id = _parse_content_id(ref_id)
    s = db.get(TimelineSet, set_id)
    if not s:
        raise HTTPException(404, "Zeitstrahl nicht gefunden")
    # Static tool: no session/code — students get the same (read-only) viewer.
    return LaunchResult(
        host_url=f"/aktivitaeten/zeitstrahl/{s.id}",
        join_url=f"/aktivitaeten/zeitstrahl/{s.id}",
        code=None,
    )


# ── challenge ─────────────────────────────────────────────────────────────────

def _challenge_refs(db: Session, teacher: Teacher) -> list[dict]:
    sets = db.query(ChallengeSet).order_by(ChallengeSet.created_at.desc()).all()
    return [{"ref_id": str(s.id), "label": s.title} for s in sets]


def _challenge_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    set_id = _parse_content_id(ref_id)
    if not db.get(ChallengeSet, set_id):
        raise HTTPException(404, "Challenge nicht gefunden")
    # Die Sitzung (Code/QR) legt die Lehrkraft auf der Challenge-Seite an.
    return LaunchResult(host_url=f"/aktivitaeten/challenge/{set_id}", join_url=None, code=None)


# ── classroom ─────────────────────────────────────────────────────────────────

def _classroom_refs(db: Session, teacher: Teacher) -> list[dict]:
    return [{"ref_id": None, "label": "Classroom Screen"}]


def _classroom_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    return LaunchResult(host_url="/classroom", join_url=None, code=None)


# ── bildformate ───────────────────────────────────────────────────────────────

def _bildformate_refs(db: Session, teacher: Teacher) -> list[dict]:
    return [{"ref_id": None, "label": "Bildformate (PBM/PGM/PPM)"}]


def _bildformate_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    # Static tool: no session/code — students open the same page.
    return LaunchResult(host_url="/simulationen/bildformate", join_url="/simulationen/bildformate", code=None)


# ── gleichungswaage ───────────────────────────────────────────────────────────

def _gleichungswaage_refs(db: Session, teacher: Teacher) -> list[dict]:
    return [{"ref_id": None, "label": "Gleichungswaage (Äquivalenzumformung)"}]


def _gleichungswaage_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    # Static tool: no session/code — students open the same page.
    return LaunchResult(host_url="/simulationen/gleichungswaage", join_url="/simulationen/gleichungswaage", code=None)


# ── vierecke ──────────────────────────────────────────────────────────────────

def _vierecke_refs(db: Session, teacher: Teacher) -> list[dict]:
    return [{"ref_id": None, "label": "Vierecke (Formen, Umfang, Fläche)"}]


def _vierecke_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    # Static tool: the join code for students comes from »Zum Mitmachen« on the page.
    return LaunchResult(host_url="/simulationen/vierecke", join_url="/simulationen/vierecke", code=None)


# ── simulation ────────────────────────────────────────────────────────────────
# Alle Simulationen aus dem Katalog; ref_id = Slug, die Seite ist /simulationen/<slug>.

def _simulation_refs(db: Session, teacher: Teacher) -> list[dict]:
    from .tool_catalog import CATALOG
    sims = [t for t in CATALOG if t.surface == "simulationen"]
    # alphabetisch nach Namen, ohne das Emoji davor
    sims.sort(key=lambda t: re.sub(r"^\W+", "", t.label).casefold())
    return [{"ref_id": t.slug, "label": t.label} for t in sims]


def _simulation_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .tool_catalog import CATALOG
    if not any(t.slug == ref_id and t.surface == "simulationen" for t in CATALOG):
        raise HTTPException(404, "Unbekannte Simulation")
    url = f"/simulationen/{ref_id}"
    return LaunchResult(host_url=url, join_url=url, code=None)


# ── fragmente ─────────────────────────────────────────────────────────────────
# Eine Pinnwand ("c<id>") oder ein Eintrag darin: Karte ("c<id>:f<id>") oder
# Clipping ("c<id>:r<id>"). Geöffnet wird die Pinnwand im Tab des Eintrags,
# der dort hervorgehoben wird.

def _fragmente_refs(db: Session, teacher: Teacher) -> list[dict]:
    from .fragment_access import resolve_permission, at_least
    out: list[dict] = []
    for c in db.query(FragmentCollection).order_by(FragmentCollection.name).all():
        if not at_least(resolve_permission(teacher, c), "read"):
            continue
        out.append({"ref_id": f"c{c.id}", "label": f"🗂️ {c.name}"})
        titel_von = {e["id"]: e["titel"] for k in (c.kategorien or []) for e in k.get("einheiten", [])}

        def ort(e) -> str:
            # »Kl. 6 · Brüche › « vor dem Titel, wenn der Eintrag eingeordnet ist
            teile = ([f"Kl. {e.klasse}"] if e.klasse else []) + ([titel_von.get(e.einheit, e.einheit)] if e.einheit else [])
            return " · ".join(teile) + " › " if teile else ""

        for f in db.query(Fragment).filter_by(collection_id=c.id).order_by(Fragment.tab, Fragment.order_index):
            titel = f.title or ((f.content or "").strip().splitlines() or [""])[0][:60] or "(leere Karte)"
            out.append({"ref_id": f"c{c.id}:f{f.id}", "label": f"{c.name} › {ort(f)}{titel}"})
        for r in db.query(ResearchItem).filter_by(collection_id=c.id).order_by(ResearchItem.created_at):
            titel = r.title or r.url_title or r.url or "(Clipping)"
            zeichen = "🔀" if r.art == "workflow" else "✂"
            out.append({"ref_id": f"c{c.id}:r{r.id}", "label": f"{c.name} › {ort(r)}{zeichen} {titel[:60]}"})
    return out


def _fragmente_launch(db: Session, teacher: Teacher, ref_id: str | None, klasse: str | None) -> LaunchResult:
    from .fragment_access import resolve_permission, at_least
    teile = (ref_id or "").split(":")
    try:
        cid = int(teile[0].removeprefix("c"))
    except ValueError:
        raise HTTPException(400, "Ungültige Fragmente-Referenz")
    c = db.get(FragmentCollection, cid)
    if not c or not at_least(resolve_permission(teacher, c), "read"):
        raise HTTPException(404, "Pinnwand nicht gefunden")
    url = f"/fragmente/{cid}"
    if len(teile) > 1 and teile[1][:1] in ("f", "r"):
        modell = Fragment if teile[1][0] == "f" else ResearchItem
        eintrag = db.get(modell, int(teile[1][1:])) if teile[1][1:].isdigit() else None
        if eintrag and eintrag.collection_id == cid:
            url += f"?tab={eintrag.tab}&eintrag={teile[1]}"
    return LaunchResult(host_url=url, join_url=None, code=None)


# ── registry ──────────────────────────────────────────────────────────────────

REGISTRY: dict[str, ToolDescriptor] = {
    d.type: d
    for d in [
        ToolDescriptor("caputh", "🏕️ Caputh", True, True, _caputh_refs, _caputh_launch),
        ToolDescriptor("bingo", "🎯 Bingo", True, True, _bingo_refs, _bingo_launch),
        ToolDescriptor("auction", "🏷️ Auktion", True, False, _auction_refs, _auction_launch),
        ToolDescriptor("barometer", "🧭 Umfrage", True, False, _barometer_refs, _barometer_launch),
        ToolDescriptor("exit-ticket", "🎫 Exit Ticket", True, False, _exit_ticket_refs, _exit_ticket_launch),
        ToolDescriptor("schreibraum", "📝 Schreibraum", True, True, _schreibraum_refs, _schreibraum_launch),
        ToolDescriptor("exitgame", "🗝️ TaskCrawler", True, True, _exitgame_refs, _exitgame_launch),
        ToolDescriptor("zeitstrahl", "📏 Zeitstrahl", True, False, _zeitstrahl_refs, _zeitstrahl_launch),
        ToolDescriptor("challenge", "⚔️ Challenge", True, False, _challenge_refs, _challenge_launch),
        ToolDescriptor("classroom", "🖥️ Classroom", False, False, _classroom_refs, _classroom_launch),
        ToolDescriptor("bildformate", "🖼️ Bildformate", False, False, _bildformate_refs, _bildformate_launch, waehlbar=False),
        ToolDescriptor("gleichungswaage", "⚖️ Gleichungswaage", False, False, _gleichungswaage_refs, _gleichungswaage_launch, waehlbar=False),
        ToolDescriptor("vierecke", "📐 Vierecke", False, False, _vierecke_refs, _vierecke_launch, waehlbar=False),
        # Bildformate, Gleichungswaage und Vierecke stehen dort mit drin; ihre eigenen
        # Einträge oben bleiben nur für ältere Phasen, die sie schon verknüpfen.
        ToolDescriptor("simulation", "🔬 Simulation", True, False, _simulation_refs, _simulation_launch),
        ToolDescriptor("fragmente", "🗂️ Fragmente", True, False, _fragmente_refs, _fragmente_launch),
    ]
}
