"""Kartentool: Ebenen-Katalog und GeoJSON nur mit Konto."""
from .conftest import auth


def test_katalog_und_ebene_mit_konto(client, teacher_token):
    kat = client.get("/api/karten/ebenen", headers=auth(teacher_token)).json()
    ids = {e["id"] for e in kat["ebenen"]}
    assert {"de-laender", "de-fluesse", "de-hoehen"} <= ids

    r = client.get("/api/karten/ebenen/de-laender", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/geo+json")
    assert len(r.json()["features"]) == 16


def test_unbekannte_und_raster_ebene_404(client, teacher_token):
    assert client.get("/api/karten/ebenen/gibtsnicht", headers=auth(teacher_token)).status_code == 404
    assert client.get("/api/karten/ebenen/de-hoehen", headers=auth(teacher_token)).status_code == 404
    assert client.get("/api/karten/ebenen/..%2Febenen", headers=auth(teacher_token)).status_code == 404


def test_ohne_konto_kein_zugriff(client):
    client.cookies.clear()
    assert client.get("/api/karten/ebenen").status_code == 401
    assert client.get("/api/karten/ebenen/de-laender").status_code == 401
