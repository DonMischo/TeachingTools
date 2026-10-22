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


def test_welt_inhalte_sind_da():
    namen = lambda e: {f["properties"]["name"] for f in _lade(e)["features"]}  # noqa: E731
    assert {"New York City", "Paris", "Tokio", "Kairo"} <= namen("welt-staedte")
    assert {"Donau", "Nil", "Amazonas", "Rhein"} <= namen("welt-fluesse")
    assert {"Alpen", "Himalaya", "Anden", "Ural"} <= namen("welt-gebirge")
    assert {"Mittelmeer", "Nordsee", "Ostsee"} <= namen("welt-meere")
    assert {"Europa", "Afrika", "Asien", "Nordamerika", "Südamerika", "Ozeanien"} <= namen("welt-kontinente")
    # Deutsche Städte kommen vom BKG, nicht doppelt aus Natural Earth
    assert not ({"Berlin", "München"} & namen("welt-staedte"))


def test_thueringer_inhalte_sind_da():
    gebirge = {f["properties"]["name"] for f in _lade("de-gebirge")["features"]}
    assert {"Thüringer Wald", "Harz", "Rhön", "Thüringer Schiefergebirge"} <= gebirge
    staedte = {f["properties"]["name"]: f["properties"]["rang"] for f in _lade("de-staedte")["features"]}
    assert staedte["Erfurt"] == "landeshauptstadt"
    assert staedte["Berlin"] == "hauptstadt"
    gipfel = {f["properties"]["name"] for f in _lade("de-gipfel")["features"]}
    assert {"Großer Beerberg", "Brocken", "Zugspitze"} <= gipfel


def _an_land():
    """Punkt-in-Fläche gegen die Staaten (Natural Earth)."""
    polys = []
    for f in _lade("welt-staaten")["features"]:
        g = f["geometry"]
        polys += [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]

    def im_ring(x, y, ring):
        drin, j = False, len(ring) - 1
        for i in range(len(ring)):
            (xi, yi), (xj, yj) = ring[i][:2], ring[j][:2]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                drin = not drin
            j = i
        return drin

    return lambda x, y: any(im_ring(x, y, p[0]) and not any(im_ring(x, y, h) for h in p[1:]) for p in polys)


# Rücken dürfen auftauchen: der Mittelatlantische Rücken liegt in Island an Land
AN_LAND_ERLAUBT = {"mittelatlantischer-ruecken"}


@pytest.mark.parametrize("ebene_id", ["welt-stroemungen", "welt-meeresboden-formen"])
def test_meereslinien_laufen_nicht_ueber_land(ebene_id):
    an_land = _an_land()
    fehler = []
    for f in _lade(ebene_id)["features"]:
        if f["properties"]["id"] in AN_LAND_ERLAUBT:
            continue
        g = f["geometry"]
        for linie in [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]:
            for (x0, y0), (x1, y1) in zip(linie, linie[1:]):
                n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) / 0.25))
                if any(an_land(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n) for t in range(n + 1)):
                    fehler.append(f["properties"]["id"])
                    break
    assert not fehler, f"über Land: {sorted(set(fehler))}"


def test_europa_endet_am_ural():
    """Natural Earth zählt Russland ganz zu Europa — die Kontinente teilen es am Ural."""
    def laengen(name):
        f = next(f for f in _lade("welt-kontinente")["features"] if f["properties"]["name"] == name)
        g = f["geometry"]
        teile = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        return [p[0] for teil in teile for p in teil[0]]
    assert max(laengen("Europa")) < 70  # Sibirien gehört zu Asien
    assert min(x for x in laengen("Asien") if x > 0) < 62  # Asien reicht bis an den Ural


def test_strassen_und_bodenschaetze_sind_da():
    bundesstrassen = {f["properties"]["name"] for f in _lade("de-bundesstrassen")["features"]}
    assert {"B7", "B4", "B19"} <= bundesstrassen
    abbau = {f["properties"]["name"]: f["properties"]["art"] for f in _lade("de-abbaustellen")["features"]}
    assert abbau["Hambach"] == "braunkohle" and abbau["Zielitz"] == "kali"
    energie = {f["properties"]["art"] for f in _lade("de-energierohstoffe")["features"]}
    assert {"braunkohle", "steinkohle", "erdoel-erdgas"} <= energie
    # Gezeichnet wird in Katalog-Reihenfolge: kleine Straßen unter den großen
    ids = [e["id"] for e in KATALOG]
    assert ids.index("de-kreisstrassen") < ids.index("de-landesstrassen") < ids.index("de-bundesstrassen") < ids.index("de-autobahnen")


def test_genaue_bodennutzung_trennt_waldarten():
    arten = {f["properties"]["art"] for f in _lade("de-bodennutzung-fein")["features"]}
    assert {"laubwald", "nadelwald", "mischwald", "wein", "obst", "stadtkern"} <= arten
    assert "ackerland" not in arten  # Ackerland ist die Grundfarbe
