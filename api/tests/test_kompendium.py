"""Persönliche Markierungen im Methoden-Kompendium."""
from api.tests.conftest import auth


def test_marken_round_trip(client, teacher_token):
    h = auth(teacher_token)
    assert client.get("/api/kompendium/marken", headers=h).json() == {}
    r = client.put("/api/kompendium/marken/d_gruppenpuzzle", json={"marke": "favorit"}, headers=h)
    assert r.status_code == 200 and r.json() == {"d_gruppenpuzzle": "favorit"}
    client.put("/api/kompendium/marken/d_gruppenpuzzle", json={"marke": "unnoetig"}, headers=h)
    assert client.get("/api/kompendium/marken", headers=h).json() == {"d_gruppenpuzzle": "unnoetig"}
    client.put("/api/kompendium/marken/d_gruppenpuzzle", json={"marke": None}, headers=h)
    assert client.get("/api/kompendium/marken", headers=h).json() == {}


def test_ungueltige_marke(client, teacher_token):
    r = client.put("/api/kompendium/marken/x", json={"marke": "egal"}, headers=auth(teacher_token))
    assert r.status_code == 422

