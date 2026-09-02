"""
Canonical catalog of student/teacher-facing tools for the availability system.

This is the single source of truth for:
  - which tools appear on /games, /simulationen and /tools,
  - which capabilities (use/host/create/upload) each tool actually has, and
  - the default allow/deny per audience (teacher | student) when no admin or
    class-teacher override exists.

Availability overrides (see models.ToolAvailability) supersede these defaults.
Keeping defaults here preserves today's behaviour out of the box: e.g. students
may play games but not host them, and the teacher-only Tools surface stays
teacher-only until an admin opens something up.

To gate a new tool, add one CatalogTool entry — the admin grid, the resolved
`/availability/me` map and the enforcement guards all read from this list.
"""
from dataclasses import dataclass, field

# The four capability kinds. Not every tool has every one; a tool lists only the
# capabilities it really exposes.
CAPABILITIES = ("use", "host", "create", "upload")

CAPABILITY_LABELS = {
    "use": "Öffnen/Beitreten",
    "host": "Hosten",
    "create": "Erstellen",
    "upload": "Hochladen",
}


@dataclass(frozen=True)
class CatalogTool:
    slug: str
    label: str
    icon: str
    surface: str  # "games" | "simulationen" | "tools"
    # capability -> {"teacher": default_allowed, "student": default_allowed}
    capabilities: dict[str, dict[str, bool]] = field(default_factory=dict)


def _cap(teacher: bool, student: bool) -> dict[str, bool]:
    return {"teacher": teacher, "student": student}


# ── the catalog ────────────────────────────────────────────────────────────────
# Defaults mirror current behaviour: games are student-usable, hosting stays
# teacher-only, and the Tools surface is teacher-only across the board.

CATALOG: list[CatalogTool] = [
    # ── Games ──
    # Caputh & Exitgame author via file upload (no separate builder endpoint),
    # so their authoring capability is "upload", not "create".
    CatalogTool("caputh", "🎲 Caputh", "🎲", "games", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "upload": _cap(True, True),
    }),
    CatalogTool("bingo", "🎰 Bingo", "🎰", "games", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "create": _cap(True, True),
    }),
    CatalogTool("exitgame", "🗝️ Exitgame", "🗝️", "games", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "upload": _cap(True, True),
    }),
    CatalogTool("lueckentext", "🧩 Lückentext", "🧩", "games", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "create": _cap(True, True),
        "upload": _cap(True, True),
    }),
    CatalogTool("zeitstrahl", "📏 Zeitstrahl", "📏", "games", {
        "use": _cap(True, True),
        "create": _cap(True, True),
        "upload": _cap(True, True),
    }),
    # Tippen rechnet im Browser: kein Hosten, kein Erstellen — die Sitzung ist
    # nur der Beitritts-Code (siehe routers/tool_sessions.py).
    CatalogTool("tippen", "⌨️ Tippen", "⌨️", "games", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "upload": _cap(True, False),
    }),
    # ── Simulationen (Modelle zum Ausprobieren — wie Spiele für alle offen) ──
    CatalogTool("gleichungswaage", "⚖️ Gleichungswaage", "⚖️", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("abacus", "🧮 Abakus", "🧮", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("bildformate", "🖼️ Bildformate", "🖼️", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("vierecke", "📐 Vierecke", "📐", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("binaerrechner", "◈ Binär-Rechner", "◈", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("funktionen", "📈 Funktionen", "📈", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("rechenregeln", "🍎 Rechenregeln", "🍎", "simulationen", {
        "use": _cap(True, True),
    }),
    # Übung gehört zu den Simulationen: eigenes Tempo, eigener QR, kein Host.
    CatalogTool("uebung", "📚 Übung", "📚", "simulationen", {
        "use": _cap(True, True),
    }),
    # ── Tools (teacher surface — students default off) ──
    CatalogTool("schreibraum", "📝 Schreibraum", "📝", "tools", {
        "use": _cap(True, False),
        "create": _cap(True, False),
    }),
    # Barometer / Exit Ticket / Auktion: a session is the artifact — creating it
    # is the host act, so a single "host" capability covers authoring+hosting.
    CatalogTool("barometer", "🧭 Umfrage", "🧭", "tools", {
        "use": _cap(True, False),
        "host": _cap(True, False),
    }),
    CatalogTool("exit-ticket", "🎫 Exit Ticket", "🎫", "tools", {
        "use": _cap(True, False),
        "host": _cap(True, False),
    }),
    CatalogTool("auktion", "🏷️ Auktion", "🏷️", "tools", {
        "use": _cap(True, False),
        "host": _cap(True, False),
    }),
    CatalogTool("classroom", "🖥️ Classroom Screen", "🖥️", "tools", {
        "use": _cap(True, False),
    }),
    CatalogTool("stundenplaner", "📋 Stundenplaner", "📋", "tools", {
        "use": _cap(True, False),
        "create": _cap(True, False),
    }),
    CatalogTool("wettkampf", "🏆 Wettkämpfe", "🏆", "tools", {
        "use": _cap(True, False),
        "create": _cap(True, False),
    }),
    CatalogTool("sportfest", "🏃 Sportfest", "🏃", "tools", {
        "use": _cap(True, False),
        "create": _cap(True, False),
    }),
    # Fragmente: students may USE boards shared with their class (default on);
    # creating a collection is teacher-only. Per-collection access is further
    # governed by the collection's own ACL grants.
    CatalogTool("fragmente", "🗂️ Fragmente", "🗂️", "tools", {
        "use": _cap(True, True),
        "create": _cap(True, False),
    }),
    # Snap!: der Editor läuft lokal (frontend/public/snap), "create" deckt das
    # Speichern eigener Programme in der Hauspokal-Bibliothek ab.
    CatalogTool("snap", "🧱 Snap!", "🧱", "tools", {
        "use": _cap(True, False),
        "create": _cap(True, False),
    }),
]

BY_SLUG: dict[str, CatalogTool] = {t.slug: t for t in CATALOG}


def default_allowed(slug: str, capability: str, audience: str) -> bool:
    """Catalog default for a (tool, capability, audience) with no override.

    Returns False if the tool doesn't exist or doesn't expose the capability.
    """
    tool = BY_SLUG.get(slug)
    if not tool or capability not in tool.capabilities:
        return False
    return tool.capabilities[capability].get(audience, False)
