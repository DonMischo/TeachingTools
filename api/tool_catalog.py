"""
Canonical catalog of student/teacher-facing tools for the availability system.

This is the single source of truth for:
  - which tools appear on /aktivitaeten, /simulationen and /tools,
  - which capabilities (use/host/create/upload) each tool actually has, and
  - the default allow/deny per audience (teacher | student) when no admin or
    class-teacher override exists.

Availability overrides (see models.ToolAvailability) supersede these defaults.
Keeping defaults here preserves today's behaviour out of the box: e.g. students
may use activities but not host them, and the teacher-only Tools surface stays
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
    surface: str  # "aktivitaeten" | "simulationen" | "tools"
    # capability -> {"teacher": default_allowed, "student": default_allowed}
    capabilities: dict[str, dict[str, bool]] = field(default_factory=dict)


def _cap(teacher: bool, student: bool) -> dict[str, bool]:
    return {"teacher": teacher, "student": student}


# ── the catalog ────────────────────────────────────────────────────────────────
# Defaults mirror current behaviour: activities are student-usable, hosting stays
# teacher-only, and the Tools surface is teacher-only across the board.

CATALOG: list[CatalogTool] = [
    # ── Aktivitäten ──
    # Caputh & TaskCrawler author via file upload (no separate builder endpoint),
    # so their authoring capability is "upload", not "create".
    CatalogTool("caputh", "🎲 Caputh", "🎲", "aktivitaeten", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "upload": _cap(True, True),
    }),
    # Karten: Atlas mit Themenebenen, Kartensätze, Arbeitsblätter, Kartenquiz per Code.
    # Erscheint auch auf der Tools-Übersicht (Karte dort von Hand eingetragen).
    CatalogTool("karten", "🗺️ Karten", "🗺️", "aktivitaeten", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "create": _cap(True, False),
        "upload": _cap(True, False),
    }),
    CatalogTool("bingo", "🎰 Bingo", "🎰", "aktivitaeten", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "create": _cap(True, True),
    }),
    CatalogTool("exitgame", "🗝️ TaskCrawler", "🗝️", "aktivitaeten", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "upload": _cap(True, True),
    }),
    CatalogTool("lueckentext", "🧩 Lückentext", "🧩", "aktivitaeten", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "create": _cap(True, True),
        "upload": _cap(True, True),
    }),
    CatalogTool("zeitstrahl", "📏 Zeitstrahl", "📏", "aktivitaeten", {
        "use": _cap(True, True),
        "create": _cap(True, True),
        "upload": _cap(True, True),
    }),
    # Übung ist ein Aufgabenformat, kein Modell zum Ausprobieren: eigenes
    # Tempo, eigener QR, kein Host.
    CatalogTool("uebung", "📚 Übung", "📚", "aktivitaeten", {
        "use": _cap(True, True),
    }),
    # ── Simulationen (Modelle zum Ausprobieren — wie die Aktivitäten für alle offen) ──
    # Tippen rechnet im Browser: kein Hosten, kein Erstellen — die Sitzung ist
    # nur der Beitritts-Code (siehe routers/tool_sessions.py).
    CatalogTool("tippen", "⌨️ Tippen", "⌨️", "simulationen", {
        "use": _cap(True, True),
        "host": _cap(True, False),
        "upload": _cap(True, False),
    }),
    # Maus-Führerschein rechnet im Browser: kein Hosten, kein Erstellen — die
    # Sitzung ist nur der Beitritts-Code (siehe routers/tool_sessions.py).
    CatalogTool("maus", "🐭 Maus-Führerschein", "🐭", "simulationen", {"use": _cap(True, True)}),
    # Rechenregeln: eigenes Tempo, eigener QR, kein Host.
    CatalogTool("rechenregeln", "🍎 Rechenregeln", "🍎", "simulationen", {
        "use": _cap(True, True),
    }),
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
    CatalogTool("funktionen", "📈 Funktionen und Koordinatensystem", "📈", "simulationen", {
        "use": _cap(True, True),
    }),
    # Ein Werkzeug mit zwei Reitern (Sprachmodell + Bilder): beide erklaeren
    # dieselbe Sache — dass eine Maschine wuerfelt statt zu denken — und teilen
    # deshalb einen Code, eine Sitzung und den Zufallswert dazwischen.
    CatalogTool("ki", "🤖 KI-Werkstatt", "🤖", "simulationen", {
        "use": _cap(True, True),
    }),
    # 3D-Übersicht, Größen, Entfernungen, Galerie und Flugmodus mit
    # Forschungsaufträgen — rechnet ganz im Browser, Fortschritt bleibt dort.
    CatalogTool("sonnensystem", "🪐 Sonnensystem", "🪐", "simulationen", {
        "use": _cap(True, True),
    }),
    # Verkehrssicherheit zu Fuß auf der echten Karte um die Schule
    # (OpenStreetMap), GTA-artige Draufsicht — rechnet im Browser.
    CatalogTool("verkehr", "🚦 GTA – Ganztagsaufmerksamkeit im Verkehr", "🚦", "simulationen", {
        "use": _cap(True, True),
    }),
    # Lebenssimulation: fünf Jahre nach der 10. Klasse — Job, Wohnung, Geld,
    # Steuern, Anträge. Rechnet im Browser; die Lehrkraft sieht Stand + Protokoll.
    CatalogTool("leben", "🎸 Rock your Life", "🎸", "simulationen", {
        "use": _cap(True, True),
    }),
    CatalogTool("algo", "🔀 Algorithmen-Werkstatt", "🔀", "simulationen", {
        "use": _cap(True, True),
    }),
    # Küstendynamik: Querschnitt mit Erosion und Küstenschutz, Längsstrom
    # in der Draufsicht, Gezeiten — rechnet ganz im Browser.
    CatalogTool("kueste", "🌊 Küstendynamik", "🌊", "simulationen", {
        "use": _cap(True, True),
    }),
    # Aufbau der Erde: Keilschnitt, Tiefenprofil, Erdbebenwellen und
    # Mantelkonvektion — rechnet ganz im Browser.
    CatalogTool("erdaufbau", "🌍 Aufbau der Erde", "🌍", "simulationen", {
        "use": _cap(True, True),
    }),
    # Wilson-Zyklus: ein Ozean öffnet und schließt sich im Querschnitt.
    CatalogTool("wilson", "🌋 Wilson-Zyklus", "🌋", "simulationen", {
        "use": _cap(True, True),
    }),
    # Regel-Labor: Ersetzungsregeln lassen Labyrinthe und Grundrisse wachsen.
    CatalogTool("regeln", "🧬 Regel-Labor", "🧬", "simulationen", {
        "use": _cap(True, True),
    }),
    # Wellenfunktionskollaps (Wave Function Collapse): Kacheln und Vorlagen mit Randbedingungen.
    CatalogTool("wfc", "🧩 Wellenfunktionskollaps", "🧩", "simulationen", {
        "use": _cap(True, True),
    }),
    # Fraktales Wachstum: diffusionsbegrenzte Aggregation in 2D und 3D.
    CatalogTool("dla", "🪸 Fraktales Wachstum", "🪸", "simulationen", {
        "use": _cap(True, True),
    }),
    # Periodensystem: Elemente nachschlagen, typische Reaktionen fuehren in die
    # Gleichungswaage.
    CatalogTool("pse", "🧪 Periodensystem", "🧪", "simulationen", {
        "use": _cap(True, True),
    }),
    # Strukturformeln: IUPAC-Name eintippen, Strukturformel sehen.
    CatalogTool("strukturformeln", "⬡ Strukturformeln", "⬡", "simulationen", {
        "use": _cap(True, True),
    }),
    # Schichtenmodell: ein Foto reist durch OSI/TCP-IP von Erfurt nach Tokio,
    # dazu Mission (ASCII, DNS, Routing) und Fehlersuche.
    CatalogTool("schichten", "📶 Schichtenmodell", "📶", "simulationen", {
        "use": _cap(True, True),
    }),
    # Leviathan – Kunst des Regierens: vernetzte Regierungssimulation (inspiriert
    # von Vesters Vernetztem Denken). Rechnet im Browser; die Lehrkraft legt
    # Krisenstufe, Drehbuch und heikle Ereignisse an der Sitzung fest.
    CatalogTool("leviathan", "🐋 Leviathan", "🐋", "simulationen", {
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
