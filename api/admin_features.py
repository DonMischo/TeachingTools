"""
Catalog of grantable admin features.

Each entry is an admin area that an admin can hand to a teacher group
(TeacherRole) and/or to individually trusted teachers, without making them full
admins. Admins always have every feature. Enforcement lives in api/admin_access.py
(`require_admin_feature`), resolution drives the Sidebar admin icon and which
/admin cards a teacher sees.

Only areas that map cleanly onto their own backend router are grantable — the
availability grid and appearance stay admin-only and are not listed here.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class AdminFeature:
    slug: str
    label: str
    icon: str


FEATURES: list[AdminFeature] = [
    AdminFeature("students", "Schülerdaten", "👥"),
    AdminFeature("teachers", "Lehrerdaten", "🧑‍🏫"),
    AdminFeature("generators", "Aufgaben-Generatoren", "🧮"),
    AdminFeature("style_pack", "Style Pack", "📦"),
    AdminFeature("calendar_settings", "Kalender-Einstellungen", "📅"),
]

SLUGS: set[str] = {f.slug for f in FEATURES}
