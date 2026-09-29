"""Fächer je Werkzeug: jeder Angemeldete liest, nur ein Admin setzt."""
from .conftest import auth


def test_leer_ohne_eigene_faecher(client, teacher_token):
    r = client.get("/api/school/tool-faecher", headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json() == {"faecher": {}}


def test_admin_setzt_mehrere_faecher_bereinigt(client, admin_token, teacher_token):
    # Beide Logins setzen ein Cookie auf denselben Client; sonst gälte das der Lehrkraft.
    client.cookies.clear()
    r = client.put("/api/school/tool-faecher/erdaufbau", headers=auth(admin_token),
                   json={"faecher": [" Geografie ", "Physik", "physik", "", "Astro  nomie"]})
    assert r.status_code == 200
    assert r.json()["faecher"]["erdaufbau"] == ["Geografie", "Physik", "Astro nomie"]
    # Die Lehrkraft sieht dasselbe.
    r = client.get("/api/school/tool-faecher", headers=auth(teacher_token))
    assert r.json()["faecher"]["erdaufbau"] == ["Geografie", "Physik", "Astro nomie"]


def test_leere_liste_bleibt_leer_none_setzt_zurueck(client, admin_token):
    client.put("/api/school/tool-faecher/wilson", headers=auth(admin_token), json={"faecher": []})
    r = client.get("/api/school/tool-faecher", headers=auth(admin_token))
    assert r.json()["faecher"]["wilson"] == []
    client.put("/api/school/tool-faecher/wilson", headers=auth(admin_token), json={"faecher": None})
    r = client.get("/api/school/tool-faecher", headers=auth(admin_token))
    assert "wilson" not in r.json()["faecher"]


def test_lehrkraft_darf_nicht_setzen(client, teacher_token):
    r = client.put("/api/school/tool-faecher/kueste", headers=auth(teacher_token), json={"faecher": ["Geografie"]})
    assert r.status_code == 403


def test_unbekanntes_werkzeug_und_grenzen(client, admin_token):
    r = client.put("/api/school/tool-faecher/gibtsnicht", headers=auth(admin_token), json={"faecher": ["Mathe"]})
    assert r.status_code == 404
    r = client.put("/api/school/tool-faecher/kueste", headers=auth(admin_token), json={"faecher": ["x" * 31]})
    assert r.status_code == 422
    r = client.put("/api/school/tool-faecher/kueste", headers=auth(admin_token), json={"faecher": [f"F{i}" for i in range(9)]})
    assert r.status_code == 422
