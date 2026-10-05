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
