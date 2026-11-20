"""Pixel-Studio: Projektbibliothek für Konten und Gäste."""
from api.auth import create_access_token, hash_password
from api.models import Student
from .conftest import auth

PNG = "data:image/png;base64,AAAA"


def _daten(b=4, h=4, n=1) -> dict:
    return {"breite": b, "hoehe": h, "bilder": [[0] * (b * h) for _ in range(n)]}


def _schueler(db, name="Ada") -> str:
    s = Student(vorname=name, nachname="Lovelace", klasse="9b", active=True, username=f"{name.lower()}.l",
                password_hash=hash_password("x"))
    db.add(s)
    db.flush()
    return create_access_token({"sub": str(s.id), "type": "student"})


def _sitzung(client, token, tool="pixel") -> str:
    return client.post("/api/tool-sessions", json={"tool_slug": tool}, headers=auth(token)).json()["code"]


def _gast(client, token, code, name="Mia") -> str:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    gast = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return gast


def _neu(client, tok, name="Bild", **kw):
    return client.post("/api/pixel/projekte", json={"name": name, "daten": _daten(), **kw}, headers=auth(tok))


def test_schueler_crud(client, db, teacher_token):
    tok = _schueler(db)
    client.cookies.clear()
    r = _neu(client, tok, "  Katze ", vorschau=PNG)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["name"] == "Katze" and (p["breite"], p["hoehe"], p["bilder"]) == (4, 4, 1)
    pid = p["id"]
    assert [x["id"] for x in client.get("/api/pixel/projekte", headers=auth(tok)).json()] == [pid]
    assert client.get(f"/api/pixel/projekte/{pid}", headers=auth(tok)).json()["daten"] == _daten()
    r = client.put(f"/api/pixel/projekte/{pid}", json={"name": "Hund", "daten": _daten(8, 8, 3)}, headers=auth(tok))
    assert r.status_code == 200 and r.json()["name"] == "Hund"
    assert (r.json()["breite"], r.json()["bilder"]) == (8, 3)
    assert client.delete(f"/api/pixel/projekte/{pid}", headers=auth(tok)).status_code == 200
    assert client.get(f"/api/pixel/projekte/{pid}", headers=auth(tok)).status_code == 404


def test_fremder_schueler_hat_keinen_zugriff(client, db, teacher_token):
    a, b = _schueler(db, "Ada"), _schueler(db, "Bea")
    client.cookies.clear()
    pid = _neu(client, a).json()["id"]
    assert client.get(f"/api/pixel/projekte/{pid}", headers=auth(b)).status_code == 404
    assert client.put(f"/api/pixel/projekte/{pid}", json={"name": "x"}, headers=auth(b)).status_code == 404
    assert client.delete(f"/api/pixel/projekte/{pid}", headers=auth(b)).status_code == 404
    assert client.get("/api/pixel/projekte", headers=auth(b)).json() == []


def test_validierung(client, db, teacher_token):
    tok = _schueler(db)
    client.cookies.clear()
    url = "/api/pixel/projekte"
    assert client.post(url, json={"name": "x", "daten": _daten(257, 4)}, headers=auth(tok)).status_code == 400
    assert client.post(url, json={"name": "x", "daten": _daten(4, 4, 65)}, headers=auth(tok)).status_code == 400
    assert client.post(url, json={"name": "x", "daten": {"breite": 4}}, headers=auth(tok)).status_code == 400
    assert client.post(url, json={"name": " ", "daten": _daten()}, headers=auth(tok)).status_code == 400
    assert client.post(url, json={"name": "x" * 81, "daten": _daten()}, headers=auth(tok)).status_code == 400
    assert _neu(client, tok, vorschau="http://x/y.png").status_code == 400
    assert _neu(client, tok, vorschau=PNG + "A" * 150_000).status_code == 400
    gross = _daten()
    gross["extra"] = "a" * 1_600_000
    assert client.post(url, json={"name": "x", "daten": gross}, headers=auth(tok)).status_code in (400, 413)


def test_vorlage_der_lehrkraft(client, db, teacher_token):
    pid = _neu(client, teacher_token, "Vorlage").json()["id"]
    r = client.put(f"/api/pixel/projekte/{pid}", json={"geteilt": True}, headers=auth(teacher_token))
    assert r.status_code == 200 and r.json()["geteilt"] is True
    tok = _schueler(db)
    client.cookies.clear()
    vor = client.get("/api/pixel/vorlagen", headers=auth(tok)).json()
    assert [v["id"] for v in vor] == [pid] and vor[0]["besitzer"]
    assert client.get(f"/api/pixel/projekte/{pid}", headers=auth(tok)).status_code == 200
    assert client.put(f"/api/pixel/projekte/{pid}", json={"name": "x"}, headers=auth(tok)).status_code == 404
    assert client.get("/api/pixel/projekte", headers=auth(tok)).json() == []


def test_schueler_darf_nicht_teilen(client, db, teacher_token):
    tok = _schueler(db)
    client.cookies.clear()
    pid = _neu(client, tok).json()["id"]
    r = client.put(f"/api/pixel/projekte/{pid}", json={"geteilt": True}, headers=auth(tok))
    assert r.status_code == 403


def test_gast_projekte_und_vorlagen(client, teacher_token):
    vorl = _neu(client, teacher_token, "Vorlage").json()["id"]
    client.put(f"/api/pixel/projekte/{vorl}", json={"geteilt": True}, headers=auth(teacher_token))
    code = _sitzung(client, teacher_token)
    g1 = _gast(client, teacher_token, code, "Mia")
    g2 = _gast(client, teacher_token, code, "Noah")
    base = f"/api/pixel/sitzung/{code}"
    r = client.post(f"{base}/projekte", json={"name": "Mias Bild", "daten": _daten()}, headers=auth(g1))
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    assert [p["id"] for p in client.get(f"{base}/projekte", headers=auth(g1)).json()] == [pid]
    assert client.get(f"{base}/projekte", headers=auth(g2)).json() == []
    assert client.get(f"{base}/projekte/{pid}", headers=auth(g2)).status_code == 404
    assert client.put(f"{base}/projekte/{pid}", json={"name": "x"}, headers=auth(g2)).status_code == 404
    assert client.delete(f"{base}/projekte/{pid}", headers=auth(g2)).status_code == 404
    assert [v["id"] for v in client.get(f"{base}/vorlagen", headers=auth(g1)).json()] == [vorl]
    assert client.get(f"{base}/projekte/{vorl}", headers=auth(g1)).status_code == 200
    assert client.put(f"{base}/projekte/{vorl}", json={"name": "x"}, headers=auth(g1)).status_code == 404
    assert client.put(f"{base}/projekte/{pid}", json={"geteilt": True}, headers=auth(g1)).status_code == 403
    assert client.put(f"{base}/projekte/{pid}", json={"name": "Neu"}, headers=auth(g1)).json()["name"] == "Neu"
    assert client.delete(f"{base}/projekte/{pid}", headers=auth(g1)).status_code == 200


def test_gast_in_geschlossener_sitzung(client, db, teacher_token):
    code = _sitzung(client, teacher_token)
    g = _gast(client, teacher_token, code)
    base = f"/api/pixel/sitzung/{code}"
    pid = client.post(f"{base}/projekte", json={"name": "a", "daten": _daten()}, headers=auth(g)).json()["id"]
    from api.models import ToolSession
    db.query(ToolSession).filter_by(code=code).one().status = "closed"
    db.flush()
    client.cookies.clear()
    assert client.post(f"{base}/projekte", json={"name": "b", "daten": _daten()}, headers=auth(g)).status_code == 403
    assert client.put(f"{base}/projekte/{pid}", json={"name": "c"}, headers=auth(g)).status_code == 403
    assert client.delete(f"{base}/projekte/{pid}", headers=auth(g)).status_code == 403


def test_falsches_werkzeug(client, teacher_token):
    code = _sitzung(client, teacher_token, tool="leben")
    r = client.get(f"/api/pixel/sitzung/{code}/projekte", headers=auth(teacher_token))
    assert r.status_code == 400
    assert client.get("/api/pixel/sitzung/ZZZZZZ/projekte", headers=auth(teacher_token)).status_code == 404
