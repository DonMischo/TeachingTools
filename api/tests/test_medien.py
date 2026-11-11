"""Geschichte der Medien: Fortschritt am Konto bzw. am Gast — wie beim
TaskCrawler am Server. Speichern vereinigt, nur »zurücksetzen« ersetzt."""
from api.models import ToolAvailability
from api.tests.conftest import auth
from api.tests.test_maus import als, schueler, _gast, _sitzung


def test_konto_stand_leer_vereinigt_und_zuruecksetzen(client, db):
    ada = schueler(db)
    assert client.get("/api/medien/stand", headers=als(ada)).json() == {"geschafft": [], "erprobt": [], "eilbote": 0, "sortieren": 0}
    r = client.put("/api/medien/stand", json={"geschafft": ["hoehle", "signale"], "erprobt": ["morse"], "eilbote": 300}, headers=als(ada))
    assert r.status_code == 200, r.text
    # Ein älterer Stand (anderer Tab, anderer Browser) löscht nichts.
    r = client.put("/api/medien/stand", json={"geschafft": ["hoehle", "keilschrift"], "erprobt": ["dia", "morse"], "eilbote": 100, "sortieren": 2}, headers=als(ada))
    assert r.json() == {"geschafft": ["hoehle", "signale", "keilschrift"], "erprobt": ["morse", "dia"], "eilbote": 300, "sortieren": 2}
    assert client.get("/api/medien/stand", headers=als(ada)).json()["geschafft"] == ["hoehle", "signale", "keilschrift"]
    r = client.put("/api/medien/stand", json={"zuruecksetzen": True}, headers=als(ada))
    assert r.json() == {"geschafft": [], "erprobt": [], "eilbote": 0, "sortieren": 0}


def test_anonym_und_gesperrt(client, db):
    assert client.get("/api/medien/stand").status_code == 401
    ada = schueler(db)
    db.add(ToolAvailability(tool_slug="medien", capability="use", audience="student", class_id=None, allowed=False))
    db.flush()
    assert client.put("/api/medien/stand", json={"geschafft": ["hoehle"]}, headers=als(ada)).status_code == 403


def test_gast_stand_je_gast_in_medien_sitzung(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="medien")
    mia = _gast(client, teacher_token, code, name="Mia")
    ben = _gast(client, teacher_token, code, name="Ben")
    r = client.put(f"/api/medien/sitzung/{code}/stand", json={"geschafft": ["hoehle"]}, headers=auth(mia))
    assert r.status_code == 200, r.text
    assert client.get(f"/api/medien/sitzung/{code}/stand", headers=auth(mia)).json()["geschafft"] == ["hoehle"]
    assert client.get(f"/api/medien/sitzung/{code}/stand", headers=auth(ben)).json()["geschafft"] == []


def test_gast_nur_in_medien_sitzung(client, db, teacher_token):
    code = _sitzung(client, teacher_token, slug="maus")
    mia = _gast(client, teacher_token, code, name="Mia")
    assert client.get(f"/api/medien/sitzung/{code}/stand", headers=auth(mia)).status_code == 404
