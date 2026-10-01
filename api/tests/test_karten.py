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


# ── Kartensätze ──

def _satz(**inhalt):
    return {
        "titel": "Flüsse Thüringens",
        "inhalt": {
            "art": "stumm", "ebenen": ["de-laender", "de-fluesse"], "beschriftung": False,
            "auswahl": {"de-fluesse": {"zeigen": "auswahl", "objekte": ["saale-56", "werra-41"], "nummerierung": "klein"}},
            **inhalt,
        },
    }


def test_satz_anlegen_laden_aendern_loeschen(client, teacher_token):
    h = auth(teacher_token)
    r = client.post("/api/karten/saetze", json=_satz(), headers=h)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert client.get(f"/api/karten/saetze/{sid}", headers=h).json()["inhalt"]["auswahl"]["de-fluesse"]["objekte"] == ["saale-56", "werra-41"]

    neu = _satz()
    neu["titel"] = "Flüsse (neu)"
    assert client.put(f"/api/karten/saetze/{sid}", json=neu, headers=h).json()["titel"] == "Flüsse (neu)"
    assert [s["titel"] for s in client.get("/api/karten/saetze", headers=h).json()] == ["Flüsse (neu)"]

    assert client.delete(f"/api/karten/saetze/{sid}", headers=h).status_code == 204
    assert client.get(f"/api/karten/saetze/{sid}", headers=h).status_code == 404


def test_unbekannte_ebene_oder_objekt_wird_abgelehnt(client, teacher_token):
    h = auth(teacher_token)
    assert client.post("/api/karten/saetze", json=_satz(ebenen=["gibtsnicht"]), headers=h).status_code == 422
    falsch = _satz(auswahl={"de-fluesse": {"objekte": ["amazonas-1"]}})
    assert client.post("/api/karten/saetze", json=falsch, headers=h).status_code == 422
    doppelt = _satz(auswahl={"de-fluesse": {"objekte": ["saale-56", "saale-56"]}})
    assert client.post("/api/karten/saetze", json=doppelt, headers=h).status_code == 422
    raster = _satz(auswahl={"de-hoehen": {"objekte": []}})
    assert client.post("/api/karten/saetze", json=raster, headers=h).status_code == 422


def test_nur_geteilte_saetze_sieht_wer_anders_und_aendern_darf_nur_die_autorin(client, teacher_token, admin_token):
    client.cookies.clear()  # beide Fixtures melden sich an; das Login-Cookie schlüge den Bearer-Header
    privat = client.post("/api/karten/saetze", json=_satz(), headers=auth(teacher_token)).json()["id"]
    geteilt_body = {**_satz(), "titel": "Für alle", "geteilt": True}
    geteilt = client.post("/api/karten/saetze", json=geteilt_body, headers=auth(teacher_token)).json()["id"]

    andere = auth(admin_token)
    liste = client.get("/api/karten/saetze", headers=andere).json()
    assert [(s["titel"], s["eigen"]) for s in liste] == [("Für alle", False)]
    assert client.get(f"/api/karten/saetze/{privat}", headers=andere).status_code == 404
    assert client.get(f"/api/karten/saetze/{geteilt}", headers=andere).status_code == 200
    assert client.put(f"/api/karten/saetze/{geteilt}", json=geteilt_body, headers=andere).status_code == 403
    assert client.delete(f"/api/karten/saetze/{geteilt}", headers=andere).status_code == 403


def test_ebenendatei_bleibt_unveraendert(client, teacher_token):
    from api.routers.karten import DATEN
    vorher = (DATEN / "ebenen" / "de-fluesse.geojson").read_bytes()
    client.post("/api/karten/saetze", json=_satz(), headers=auth(teacher_token))
    assert (DATEN / "ebenen" / "de-fluesse.geojson").read_bytes() == vorher
