"""»Was kann TT?«: features.yml als JSON."""
import pytest

from api.routers import ueberblick as funktionen
from api.tests.conftest import auth

YML = """
projekt:
  name: TT - Teaching Tools
  beschreibung: >-
    Zwei Zeilen
    Text
kern:
  - id: hauspokal
    name: Hauspokal
    kann:
      - Punkte vergeben
      - Ansicht: Balken je Haus
simulationen:
  - id: waage
    name: Gleichungswaage
    faehigkeiten:
      use: [true, true]
    kann: [Umformen]
datenschutz_sicherheit:
  - Keine Anfragen nach außen
rollen:
  gast: Nur die Sitzung
"""


@pytest.fixture()
def features(tmp_path, monkeypatch):
    p = tmp_path / "features.yml"
    p.write_text(YML, encoding="utf-8")
    monkeypatch.setattr(funktionen, "FEATURES", p)
    monkeypatch.setattr(funktionen, "_cache", None)
    return p


def test_liste_aufbereitet(client, teacher_token, features):
    r = client.get("/api/ueberblick", headers=auth(teacher_token))
    assert r.status_code == 200
    d = r.json()
    assert d["beschreibung"] == "Zwei Zeilen Text"
    b = {x["id"]: x for x in d["bereiche"]}
    # »Ansicht: Balken« wird von YAML zum dict, kommt aber als eine Zeile zurück
    assert b["kern"]["eintraege"][0]["kann"] == ["Punkte vergeben", "Ansicht: Balken je Haus"]
    assert b["simulationen"]["eintraege"][0]["faehigkeiten"] == {"use": [True, True]}
    assert b["aktivitaeten"]["eintraege"] == []
    rest = {e["id"]: e["kann"] for e in b["datenschutz"]["eintraege"]}
    assert rest == {"datenschutz": ["Keine Anfragen nach außen"], "rollen": ["Gast: Nur die Sitzung"]}


def test_neu_gelesen_nach_aenderung(client, teacher_token, features):
    client.get("/api/ueberblick", headers=auth(teacher_token))
    features.write_text(YML.replace("Gleichungswaage", "Waage"), encoding="utf-8")
    import os
    os.utime(features, (1, 2))  # mtime sicher anders
    d = client.get("/api/ueberblick", headers=auth(teacher_token)).json()
    sims = next(x for x in d["bereiche"] if x["id"] == "simulationen")
    assert sims["eintraege"][0]["name"] == "Waage"


def test_ohne_anmeldung_gesperrt(client, features):
    assert client.get("/api/ueberblick").status_code in (401, 403)


def test_echte_datei_ist_gueltig():
    """features.yml im Repo muss sich lesen lassen (eine Zeile mit »: « hatte es schon zerlegt)."""
    if not funktionen.FEATURES.exists():
        pytest.skip("features.yml nicht eingebunden")
    import yaml
    funktionen._aufbereiten(yaml.safe_load(funktionen.FEATURES.read_text(encoding="utf-8")))
