"""Where a join code can live, in one place.

Every joinable tool keeps its own sessions table with its own code column, so a
code alone does not say which tool it belongs to. This registry is that missing
link: it lets ``/api/play/resolve`` find a session from nothing but the code,
lets :func:`api.utils.gen_code` keep new codes unique across *all* tools, and
gives the guest-join router its tool table.

Codes are only unique per table, so a lookup can in principle match more than
one tool — callers must handle a list, not a single hit.
"""
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from .models import (
    AuctionSession, BarometerSession, BingoSession, ExitGameSession,
    ExitTicketSession, FragmentCollection, LueckentextSession, QuizSession, SchreibraumRoom,
    ToolSession, WettschreibenSession,
)


@dataclass(frozen=True)
class JoinCodeTool:
    key: str            # tool key as the frontend knows it
    model: Any          # SQLAlchemy model holding the sessions
    column: str         # name of the code column on that model
    label: str          # human label, shown when a code matches several tools
    play_path: str      # player URL, "{code}" substituted
    # Wer im Playhub einen Avatar waehlt. Reine Anzeigefrage, steht aber hier,
    # damit /play alles ueber ein Werkzeug aus einer Quelle bekommt:
    #   "none"   - Werkzeug verwirft den Avatar
    #   "guests" - nur Gaeste waehlen ihn, Angemeldete gehen direkt hinein
    #   "always" - auch Angemeldete waehlen ihn (Name bleibt gesperrt)
    avatar: str = "none"
    # Spalte, in der die anlegende Lehrkraft steht — fuer "nur meine Sitzungen".
    owner_column: str = "created_by"
    # Statuswerte fuer Schliessen/Wiederoeffnen. None = das Werkzeug kennt kein
    # einfaches Auf/Zu: entweder gibt es gar keine Statusspalte (Schreibraum),
    # oder der Status ist Spielverlauf und das Schliessen hat Nebenwirkungen
    # (Bingo verteilt dabei Punkte) — solche Sitzungen bleiben ihren eigenen
    # Endpunkten vorbehalten.
    open_status: str | None = None
    closed_status: str | None = None

    @property
    def closable(self) -> bool:
        return self.open_status is not None and self.closed_status is not None

    def join_url(self, code: str) -> str:
        return self.play_path.format(code=code)


JOIN_CODE_TOOLS: tuple[JoinCodeTool, ...] = (
    JoinCodeTool("caputh", QuizSession, "join_code", "🎲 Caputh", "/play/{code}", avatar="always",
                 owner_column="teacher_id"),
    JoinCodeTool("bingo", BingoSession, "code", "🎰 Bingo", "/play/bingo/{code}", avatar="guests"),
    JoinCodeTool("exit-ticket", ExitTicketSession, "code", "🎫 Exit Ticket", "/play/exit-ticket/{code}",
                 open_status="open", closed_status="closed"),
    JoinCodeTool("barometer", BarometerSession, "code", "🧭 Umfrage", "/play/barometer/{code}",
                 open_status="active", closed_status="closed"),
    JoinCodeTool("auction", AuctionSession, "code", "🏷️ Auktion", "/play/auction/{code}"),
    JoinCodeTool("exitgame", ExitGameSession, "join_code", "🗝️ Exitgame", "/play/exitgame/{code}",
                 owner_column="teacher_id", open_status="open", closed_status="closed"),
    JoinCodeTool("lueckentext", LueckentextSession, "join_code", "🧩 Lückentext", "/games/lueckentext/play/{code}",
                 avatar="always", owner_column="teacher_id"),
    JoinCodeTool("schreibraum", SchreibraumRoom, "code", "📝 Schreibraum", "/schreibraum/{code}"),
    JoinCodeTool("wettschreiben", WettschreibenSession, "code", "⌨️ Tipp-Rennen", "/play/wettschreiben/{code}"),
    # Zustandslose Werkzeuge (Abakus, Gleichungswaage, Bildformate) teilen sich ein Modell.
    JoinCodeTool("simulation", ToolSession, "code", "🧮 Simulation", "/play/simulation/{code}",
                 open_status="open", closed_status="closed"),
    # Pinnwaende sind keine Sitzung, sondern eine Sammlung mit dauerhaftem
    # Gastcode; ohne allow_guests weist der Gastbeitritt ab.
    JoinCodeTool("fragmente", FragmentCollection, "guest_code", "🗂️ Pinnwand", "/fragmente/join?code={code}",
                 owner_column="owner_teacher_id"),
)

BY_KEY: dict[str, JoinCodeTool] = {t.key: t for t in JOIN_CODE_TOOLS}


def find_sessions(db: Session, code: str) -> list[tuple[JoinCodeTool, Any]]:
    """Every (tool, session) whose code column equals ``code``."""
    hits = []
    for tool in JOIN_CODE_TOOLS:
        session = db.query(tool.model).filter(getattr(tool.model, tool.column) == code).first()
        if session:
            hits.append((tool, session))
    return hits


def code_taken(db: Session, code: str) -> bool:
    """True if any tool already uses this code — the global uniqueness check."""
    return bool(find_sessions(db, code))
