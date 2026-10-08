"""Equal Earth: bekannte Werte, Ränder, Auslieferung der Ebenen mit ?projektion=equalearth."""
import gzip
import json
import math

from api import karten_projektion as p
from .conftest import auth


def test_equal_earth_eckpunkte():
    assert p.vor(0, 0) == (0.0, 0.0)
    x, _ = p.vor(180, 0)
    assert math.isclose(x, 180)
    # Pole: die Polkante ist bei Equal Earth gut halb so lang wie der Äquator (≈ 0,59)
    xp, yp = p.vor(180, 90)
    assert 104 < xp < 109 and 60 < yp < 70
    # flächentreu, nicht winkeltreu: 60° N rückt nach Süden (in Mercator bliebe es bei 60)
    assert p.vor(10, 60)[1] < 59


def test_ebene_in_equal_earth(client, teacher_token):
    r = client.get("/api/karten/ebenen/de-laender?projektion=equalearth", headers={**auth(teacher_token), "Accept-Encoding": "gzip"})
    assert r.status_code == 200
    roh = client.get("/api/karten/ebenen/de-laender", headers=auth(teacher_token)).json()
    neu = r.json()
    assert len(neu["features"]) == len(roh["features"])
    a = roh["features"][0]["geometry"]["coordinates"][0][0]
    b = neu["features"][0]["geometry"]["coordinates"][0][0]
    a = a if isinstance(a[0], (int, float)) else a[0]
    b = b if isinstance(b[0], (int, float)) else b[0]
    assert b == [round(v, 5) for v in p.vor(*a)]
    assert neu["features"][0]["properties"] == roh["features"][0]["properties"]


def test_robinson_und_winkel_tripel_ueber_proj():
    # Bei ±180° am Äquator liegt der Kartenrand, wie bei Equal Earth
    for netz in ("robinson", "winkeltripel"):
        assert math.isclose(p.vor(180, 0, netz)[0], 180)
    # Pollinie: Robinson gut halb so lang wie der Äquator, Winkel-Tripel knapp 0,4
    assert 95 < p.vor(180, 90, "robinson")[0] < 97
    assert 69 < p.vor(180, 90, "winkeltripel")[0] < 71
    # gleiche Zahlen wie frontend/src/tests/kartenProjektion.test.ts
    assert [round(v, 4) for v in p.vor(10, 60, "robinson")] == [7.9860, 55.5308]
    assert [round(v, 4) for v in p.vor(10, 60, "winkeltripel")] == [7.5824, 58.9312]


def test_ebene_in_robinson(client, teacher_token):
    r = client.get("/api/karten/ebenen/de-laender?projektion=robinson", headers=auth(teacher_token))
    roh = client.get("/api/karten/ebenen/de-laender", headers=auth(teacher_token)).json()
    a = roh["features"][0]["geometry"]["coordinates"][0][0]
    b = r.json()["features"][0]["geometry"]["coordinates"][0][0]
    a = a if isinstance(a[0], (int, float)) else a[0]
    b = b if isinstance(b[0], (int, float)) else b[0]
    assert b == [round(v, 5) for v in p.vor(*a, "robinson")]
