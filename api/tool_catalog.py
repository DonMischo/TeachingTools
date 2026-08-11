"""
Canonical catalog of student/teacher-facing tools for the availability system.

This is the single source of truth for:
  - which tools appear on /games and /tools,
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
    surface: str  # "games" | "tools"
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
    CatalogTool("abacus", "🧮 Abakus", "🧮", "games", {
        "use": _cap(True, True),
    }),
    CatalogTool("uebung", "📚 Übung", "📚", "games", {
        "use": _cap(True, True),
    }),
    # ── Tools (teacher surface — students default off) ──
    CatalogTool("schreibraum", "📝 Schreibraum", "📝", "tools", {
        "use": _cap(True, False),
        "create": _cap(True, False),
    }),
    # Barometer / Exit Ticket / Auktion: a session is the artifact — creating it
    # is the host act, so a single "host" capability covers authoring+hosting.
    CatalogTool("barometer", "🧭 Meinungsbarometer", "🧭", "tools", {
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
