"""
»Was kann TT?« — die Feature-Liste (features.yml im Repo-Wurzelverzeichnis) als JSON.

features.yml bleibt die einzige Quelle; docker-compose bindet sie schreibgeschützt
nach /workspace/features.yml ein. Die Datei wird bei jeder Änderung neu gelesen.
"""
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException

from ..availability import require_capability

router = APIRouter(prefix="/api/ueberblick", tags=["ueberblick"],
                   dependencies=[Depends(require_capability("ueberblick", "use"))])

FEATURES = Path(__file__).parent.parent.parent / "features.yml"

BEREICHE = [
    ("kern", "Kern"), ("aktivitaeten", "Aktivitäten"), ("simulationen", "Simulationen"),
    ("tools", "Werkzeuge"), ("sport", "Sport"), ("verwaltung", "Schulorganisation"),
    ("admin", "Verwaltung und Admin"),
]
ROLLEN = {"admin": "Admin", "lehrkraft": "Lehrkraft", "klassenlehrkraft": "Klassenlehrkraft",
          "schueler": "Schüler·innen", "gast": "Gast"}

_cache: tuple[float, dict] | None = None


def _zeile(k) -> str:
    """Ein Eintrag aus »kann«: Text, oder {Stichwort: Erklärung} (YAML macht aus »a: b« ein dict)."""
    if isinstance(k, dict):
        return "; ".join(f"{a}: {b}" for a, b in k.items())
    return str(k)


def _aufbereiten(y: dict) -> dict:
    bereiche = [{
        "id": key, "name": name,
        "eintraege": [{
            "id": it["id"], "name": it["name"], "typ": it.get("typ"),
            "kann": [_zeile(k) for k in it.get("kann", [])],
            "faehigkeiten": it.get("faehigkeiten") or {},
        } for it in y.get(key, [])],
    } for key, name in BEREICHE]
    bereiche.append({"id": "datenschutz", "name": "Datenschutz und Sicherheit", "eintraege": [{
        "id": "datenschutz", "name": "Datenschutz und Sicherheit", "typ": None,
        "kann": [_zeile(k) for k in y.get("datenschutz_sicherheit", [])], "faehigkeiten": {},
    }, {
        "id": "rollen", "name": "Rollen", "typ": None,
        "kann": [f"{ROLLEN.get(r, r)}: {t}" for r, t in (y.get("rollen") or {}).items()], "faehigkeiten": {},
    }]})
    p = y.get("projekt", {})
    return {"name": p.get("name", "TT"), "beschreibung": " ".join(str(p.get("beschreibung", "")).split()),
            "bereiche": bereiche}


@router.get("")
def ueberblick() -> dict:
    global _cache
    try:
        stand = FEATURES.stat().st_mtime
    except FileNotFoundError:
        raise HTTPException(503, "features.yml ist nicht eingebunden")
    if _cache is None or _cache[0] != stand:
        _cache = (stand, _aufbereiten(yaml.safe_load(FEATURES.read_text(encoding="utf-8"))))
    return _cache[1]
