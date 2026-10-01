"""Kartentool: eigene Ebenen hochladen (GeoJSON, KML, KMZ, GPX) — nur Lehrkräfte."""
import io
import json
import zipfile

import pytest

from .conftest import auth

GEOJSON = json.dumps({"type": "FeatureCollection", "features": [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [11.03, 50.98]}, "properties": {"titel": "Schule", "art": "Gymnasium"}},
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [11.32, 50.98]}, "properties": {"titel": "Weimar Bahnhof"}},
]}).encode()

KML = b"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Wartburg</name><Point><coordinates>10.3065,50.9663,0</coordinates></Point></Placemark>
  <Placemark><name>Rennsteig (Stueck)</name><LineString><coordinates>10.4,50.8 10.6,50.7 10.8,50.6</coordinates></LineString></Placemark>
</Document></kml>"""

GPX = b"""<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="50.98" lon="11.03"><name>Start</name></wpt>
  <trk><name>Wandertag</name><trkseg><trkpt lat="50.98" lon="11.03"/><trkpt lat="50.99" lon="11.05"/></trkseg></trk>
</gpx>"""


@pytest.fixture(autouse=True)
def eigener_ordner(tmp_path, monkeypatch):
    """Nie in data/karten/eigene schreiben — dort liegen echte Uploads."""
    monkeypatch.setattr("api.routers.karten.EIGENE", tmp_path)
    return tmp_path


def _hoch(client, token, name, inhalt, titel=""):
    return client.post("/api/karten/eigene", files={"datei": (name, inhalt)}, data={"titel": titel}, headers=auth(token))


def test_geojson_namensfeld_wird_geraten_und_umstellbar(client, teacher_token):
    r = _hoch(client, teacher_token, "orte.geojson", GEOJSON, "Unsere Orte")
    assert r.status_code == 201, r.text
    ebene = r.json()
    assert ebene["id"].startswith("eigen-") and ebene["geometrie"] == "punkt" and ebene["anzahl"] == 2
    assert ebene["eigen"]["namensfeld"] == "titel"
    daten = client.get(f"/api/karten/ebenen/{ebene['id']}", headers=auth(teacher_token)).json()
    assert [f["properties"]["name"] for f in daten["features"]] == ["Schule", "Weimar Bahnhof"]

    r = client.put(f"/api/karten/eigene/{ebene['eigen']['id']}", json={"titel": "Orte", "namensfeld": "art"}, headers=auth(teacher_token))
    assert r.status_code == 200
    daten = client.get(f"/api/karten/ebenen/{ebene['id']}", headers=auth(teacher_token)).json()
    assert [f["properties"]["name"] for f in daten["features"]] == ["Gymnasium", "Objekt 2"]


@pytest.mark.parametrize("name,inhalt,namen,geometrie", [
    ("burgen.kml", KML, ["Wartburg", "Rennsteig (Stueck)"], "gemischt"),
    ("tour.gpx", GPX, ["Start", "Wandertag"], "gemischt"),
])
def test_kml_und_gpx_werden_umgewandelt(client, teacher_token, name, inhalt, namen, geometrie):
    r = _hoch(client, teacher_token, name, inhalt)
    assert r.status_code == 201, r.text
    assert r.json()["geometrie"] == geometrie
    daten = client.get(f"/api/karten/ebenen/{r.json()['id']}", headers=auth(teacher_token)).json()
    assert [f["properties"]["name"] for f in daten["features"]] == namen


def test_kmz_ist_gezippte_kml(client, teacher_token):
    puffer = io.BytesIO()
    with zipfile.ZipFile(puffer, "w") as z:
        z.writestr("doc.kml", KML)
    assert _hoch(client, teacher_token, "burgen.kmz", puffer.getvalue()).status_code == 201


@pytest.mark.parametrize("name,inhalt,meldung", [
    ("x.shp", b"egal", "Erlaubt sind"),
    ("utm.geojson", json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [640000, 5650000]}, "properties": {}}]}).encode(), "WGS84"),
    ("boese.kml", b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><kml>&a;</kml>', "DOCTYPE"),
    ("leer.geojson", b'{"type": "FeatureCollection", "features": []}', "keine Punkte"),
    ("kaputt.geojson", b"{nicht json", "kein gültiges GeoJSON"),
])
def test_ungueltige_dateien_mit_klarer_meldung(client, teacher_token, name, inhalt, meldung):
    r = _hoch(client, teacher_token, name, inhalt)
    assert r.status_code == 422
    assert meldung in r.text


def test_katalog_zeigt_eigene_und_geteilte_aber_keine_fremden(client, teacher_token, admin_token):
    client.cookies.clear()
    privat = _hoch(client, teacher_token, "a.geojson", GEOJSON, "Privat").json()
    geteilt = _hoch(client, teacher_token, "b.geojson", GEOJSON, "Geteilt").json()
    client.put(f"/api/karten/eigene/{geteilt['eigen']['id']}", json={"titel": "Geteilt", "geteilt": True, "namensfeld": "titel"},
               headers=auth(teacher_token))

    namen = lambda t: {e["name"] for e in client.get("/api/karten/ebenen", headers=auth(t)).json()["ebenen"] if e["gruppe"] == "eigen"}  # noqa: E731
    assert namen(teacher_token) == {"Privat", "Geteilt"}
    assert namen(admin_token) == {"Geteilt"}
    assert client.get(f"/api/karten/ebenen/{privat['id']}", headers=auth(admin_token)).status_code == 404
    assert client.delete(f"/api/karten/eigene/{geteilt['eigen']['id']}", headers=auth(admin_token)).status_code == 403


def test_kartensatz_mit_eigener_ebene(client, teacher_token, admin_token):
    client.cookies.clear()
    ebene = _hoch(client, teacher_token, "a.geojson", GEOJSON, "Orte").json()
    satz = {"titel": "Orte-Test", "inhalt": {"art": "stumm", "ebenen": [ebene["id"]],
            "auswahl": {ebene["id"]: {"objekte": ["o1"], "nummerierung": "zahl"}}}}
    assert client.post("/api/karten/saetze", json=satz, headers=auth(teacher_token)).status_code == 201
    falsch = {**satz, "inhalt": {**satz["inhalt"], "auswahl": {ebene["id"]: {"objekte": ["o99"]}}}}
    assert client.post("/api/karten/saetze", json=falsch, headers=auth(teacher_token)).status_code == 422
    # Fremde private Ebene darf niemand in seinen Satz schreiben
    assert client.post("/api/karten/saetze", json=satz, headers=auth(admin_token)).status_code == 422


def test_loeschen_entfernt_datei(client, teacher_token, eigener_ordner):
    ebene = _hoch(client, teacher_token, "a.geojson", GEOJSON).json()
    assert (eigener_ordner / f"{ebene['eigen']['id']}.geojson").exists()
    assert client.delete(f"/api/karten/eigene/{ebene['eigen']['id']}", headers=auth(teacher_token)).status_code == 204
    assert not (eigener_ordner / f"{ebene['eigen']['id']}.geojson").exists()


def test_schueler_duerfen_nicht_hochladen(client, db):
    from api.auth import create_access_token
    from api.models import Student
    s = Student(vorname="Kim", nachname="Test", klasse="5a", active=True)
    db.add(s)
    db.flush()
    client.cookies.clear()
    token = create_access_token({"sub": str(s.id), "type": "student"})
    assert _hoch(client, token, "a.geojson", GEOJSON).status_code == 403
