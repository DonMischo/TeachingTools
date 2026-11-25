"""Gemeinsame Bestenliste: Werkzeuge mischen sich nicht, und die alten
Tabellen werden beim Start übernommen (docs/plan-sitzung-dashboard-auswertung.md, Phase 8).

Die werkzeugspezifischen Regeln (Richtung, Grenzen, Gäste, Löschen) prüfen
``test_markieren.py``, ``test_maus.py`` und ``test_bestenliste.py``.
"""
from api.models import Bestenliste
from .conftest import auth
from .test_maus import als, schueler


def test_werkzeuge_mischen_sich_nicht(client, db):
    ada = schueler(db)
    ok_maus = client.post("/api/bestenlisten/maus", headers=als(ada),
                          json={"modus": "klick", "wert": 100, "extra": {"dauer_ms": 500}})
    ok_markieren = client.post("/api/bestenlisten/markieren", headers=als(ada),
                               json={"modus": "markieren", "wert": 40000, "extra": {"aktionen": 12}})
    assert ok_maus.status_code == 200 and ok_markieren.status_code == 200

    maus = client.get("/api/bestenlisten/maus?modus=klick", headers=als(ada)).json()
    assert [e["wert"] for e in maus] == [100]
    # Ein Modus eines anderen Werkzeugs ist hier unbekannt, nicht leer.
    assert client.get("/api/bestenlisten/maus?modus=markieren", headers=als(ada)).status_code == 400
    assert [e["wert"] for e in client.get("/api/bestenlisten/markieren?modus=markieren", headers=als(ada)).json()] == [40000]
    assert db.query(Bestenliste).count() == 2


def test_unbekanntes_werkzeug(client, db):
    ada = schueler(db)
    assert client.get("/api/bestenlisten/quatsch?modus=klick", headers=als(ada)).status_code == 404
    assert client.post("/api/bestenlisten/quatsch", headers=als(ada),
                       json={"modus": "klick", "wert": 1}).status_code == 404


def test_tippen_kennt_keine_gastsitzungen(client, db, teacher_token):
    code = client.post("/api/tool-sessions", json={"tool_slug": "maus"}, headers=auth(teacher_token)).json()["code"]
    r = client.get(f"/api/bestenlisten/tippen/code/{code}?modus=lektionen", headers=auth(teacher_token))
    assert r.status_code == 400


def test_uebernahme_deckt_alle_drei_alten_tabellen_ab():
    """Das SQL selbst ist Postgres (json_build_object) und läuft in der SQLite-Testdatenbank
    nicht; hier nur: je altes Werkzeug eine Anweisung, die genau einmal läuft — sonst
    kämen vom Admin gelöschte Einträge beim nächsten Neustart zurück."""
    from api.main import _bestenlisten_uebernehmen

    sql = _bestenlisten_uebernehmen()
    assert len(sql) == 3
    assert all("INSERT INTO bestenlisten" in s and "WHERE NOT EXISTS" in s for s in sql)
    assert all("FROM datenuebernahmen" in s and "INSERT INTO datenuebernahmen" in s for s in sql)
