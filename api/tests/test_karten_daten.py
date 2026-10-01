"""Prüft die Kartenebenen aus frontend/scripts/fetch-karten.mjs.

Lösungen und Schülerantworten hängen an der `id` eines Objekts — die muss je
Ebene eindeutig sein, und jedes Quiz-Objekt braucht einen Namen.
"""
import json
from pathlib import Path

import pytest

DATEN = Path(__file__).resolve().parents[2] / "data" / "karten"
KATALOG = json.loads((DATEN / "ebenen.json").read_text(encoding="utf-8"))["ebenen"]
VEKTOR = [e for e in KATALOG if e["geometrie"] != "raster"]
GEOMETRIE = {
    "flaeche": {"Polygon", "MultiPolygon"},
    "linie": {"LineString", "MultiLineString"},
    "punkt": {"Point"},
}


def _lade(ebene_id):
    return json.loads((DATEN / "ebenen" / f"{ebene_id}.geojson").read_text(encoding="utf-8"))


@pytest.mark.parametrize("ebene", VEKTOR, ids=lambda e: e["id"])
def test_ebene_ist_gueltig(ebene):
    sammlung = _lade(ebene["id"])
    assert sammlung["type"] == "FeatureCollection"
    features = sammlung["features"]
    assert len(features) == ebene["anzahl"] > 0

    ids = [f["properties"]["id"] for f in features]
    assert len(ids) == len(set(ids)), "ids doppelt"
    assert all(isinstance(i, str) and i for i in ids)

    erlaubt = GEOMETRIE[ebene["geometrie"]]
    assert {f["geometry"]["type"] for f in features} <= erlaubt

    if ebene["quiz"]:
        assert all(f["properties"]["name"].strip() for f in features), "Quiz-Objekt ohne Namen"


@pytest.mark.parametrize("ebene", KATALOG, ids=lambda e: e["id"])
def test_jede_ebene_nennt_ihre_quelle(ebene):
    assert ebene["quelle"]["name"] and ebene["quelle"]["lizenz"]


def test_hoehenkacheln_liegen_im_frontend():
    hoehen = next(e for e in KATALOG if e["id"] == "de-hoehen")
    ordner = Path(__file__).resolve().parents[2] / "frontend" / "public" / "karten" / "hoehen"
    if not ordner.parent.parent.is_dir():
        pytest.skip("frontend/ ist im API-Container nicht eingehängt")
    for kachel in hoehen["kacheln"]:
        assert (ordner / kachel["datei"]).is_file()
        assert len(kachel["ecken"]) == 4


@pytest.mark.parametrize("name", ["Saale", "Ilm", "Werra", "Unstrut", "Rhein", "Elbe", "Donau"])
def test_grosse_fluesse_sind_je_ein_objekt(name):
    """Seen und Talsperren unterbrechen Flüsse im DLM — das Skript fügt sie wieder zusammen."""
    treffer = [f for f in _lade("de-fluesse")["features"] if f["properties"]["name"] == name]
    assert len(treffer) <= 2  # Ilm: thüringische und bayerische
    assert treffer


def test_thueringer_inhalte_sind_da():
    gebirge = {f["properties"]["name"] for f in _lade("de-gebirge")["features"]}
    assert {"Thüringer Wald", "Harz", "Rhön", "Thüringer Schiefergebirge"} <= gebirge
    staedte = {f["properties"]["name"]: f["properties"]["rang"] for f in _lade("de-staedte")["features"]}
    assert staedte["Erfurt"] == "landeshauptstadt"
    assert staedte["Berlin"] == "hauptstadt"
    gipfel = {f["properties"]["name"] for f in _lade("de-gipfel")["features"]}
    assert {"Großer Beerberg", "Brocken", "Zugspitze"} <= gipfel
