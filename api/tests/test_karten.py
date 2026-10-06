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


def test_alte_ebenen_id_wird_beim_speichern_umgeschrieben(client, teacher_token):
    h = auth(teacher_token)
    r = client.post("/api/karten/saetze", json=_satz(ebenen=["eu-staaten", "de-fluesse"]), headers=h)
    assert r.status_code == 201, r.text
    assert client.get(f"/api/karten/saetze/{r.json()['id']}", headers=h).json()["inhalt"]["ebenen"] == ["welt-staaten", "de-fluesse"]


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


def test_ebene_kommt_gepackt_wenn_der_browser_es_kann(client, teacher_token):
    r = client.get("/api/karten/ebenen/de-laender", headers={**auth(teacher_token), "Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers["content-encoding"] == "gzip"
    assert len(r.json()["features"]) == 16  # httpx entpackt selbst


def test_ortssuche_findet_kleine_orte_und_ortsteile_ueber_die_gemeinde(client, teacher_token):
    h = auth(teacher_token)
    borkwalde = client.get("/api/karten/suche?q=borkwalde", headers=h).json()
    assert borkwalde[0]["name"] == "Borkwalde" and borkwalde[0]["ebene"] == "de-orte" and len(borkwalde[0]["punkt"]) == 2
    trusetal = client.get("/api/karten/suche?q=Trusetal", headers=h).json()
    namen = [t["name"] for t in trusetal]
    assert "Brotterode-Trusetal" in namen and "Trusen" in namen
    assert client.get("/api/karten/suche?q=e", headers=h).json() == []
    welt = client.get("/api/karten/suche?q=new york&bereich=welt", headers=h).json()
    assert welt[0]["name"] == "New York City"


# ── JSON-Vorlage ──

def test_vorlage_export_import_rundreise(client, teacher_token):
    h = auth(teacher_token)
    inhalt = {**_satz()["inhalt"], "ausschnitt": {"west": 9.8, "sued": 50.15, "ost": 12.7, "nord": 51.7}}
    r = client.post("/api/karten/vorlage/export", json={"titel": "Thüringen", "inhalt": inhalt, "ebenen": ["de-fluesse"]}, headers=h)
    assert r.status_code == 200, r.text
    vorlage = r.json()
    liste = vorlage["objekte"]["de-fluesse"]["liste"]
    assert {o["id"] for o in liste if o["aktiv"]} == {"saale-56", "werra-41"}
    assert any(o["name"] == "Ilm" for o in liste)  # Kandidat im Ausschnitt, nicht aktiv
    assert not any(o["name"] == "Isar" for o in liste)  # außerhalb des Ausschnitts
    assert "aktiv" in vorlage["_hinweis"]

    # »LLM« schaltet Ilm dazu und Werra ab, ergänzt einen Erfolg
    for o in liste:
        o["aktiv"] = o["name"] in ("Saale", "Ilm") and o["id"] != "ilm-1368"
    vorlage["erfolge"] = [{"id": "fluesse", "name": "Flussprofi", "icon": "🌊", "ebenen": ["de-fluesse"], "schwelle": 0.5}]
    r = client.post("/api/karten/vorlage/import", json=vorlage, headers=h)
    assert r.status_code == 200, r.text
    neu = r.json()["inhalt"]
    assert neu["auswahl"]["de-fluesse"]["objekte"] == [o["id"] for o in liste if o["aktiv"]]
    assert neu["erfolge"][0]["schwelle"] == 0.5
    assert client.post("/api/karten/saetze", json={"titel": "x", "inhalt": neu}, headers=h).status_code == 201


def test_vorlage_import_lehnt_falsche_ids_und_erfolge_ab(client, teacher_token):
    h = auth(teacher_token)
    falsch = {"objekte": {"de-fluesse": {"liste": [{"id": "amazonas", "aktiv": True}]}}}
    assert client.post("/api/karten/vorlage/import", json=falsch, headers=h).status_code == 422
    erfolg = {"objekte": {"de-fluesse": {"liste": [{"id": "saale-56", "aktiv": True}]}},
              "erfolge": [{"id": "x", "name": "X", "ebenen": ["de-seen"]}]}
    assert client.post("/api/karten/vorlage/import", json=erfolg, headers=h).status_code == 422


def test_flaechennamen_kommen_als_ein_punkt_je_objekt(client, teacher_token):
    """MapLibre beschriftet Flächen je Teilstück — für Namen gibt es darum einen Punkt je Objekt."""
    flaechen = client.get("/api/karten/ebenen/welt-staaten", headers=auth(teacher_token)).json()["features"]
    r = client.get("/api/karten/ebenen/welt-staaten?punkte=1", headers=auth(teacher_token))
    assert r.status_code == 200
    punkte = r.json()["features"]
    assert {f["geometry"]["type"] for f in punkte} == {"Point"}
    assert sorted(f["properties"]["id"] for f in punkte) == sorted(f["properties"]["id"] for f in flaechen)
    kanada = next(f for f in punkte if f["properties"]["id"] == "CAN")["geometry"]["coordinates"]
    assert -141 < kanada[0] < -52 and 42 < kanada[1] < 83


def test_namenspunkte_auch_in_equal_earth(client, teacher_token):
    r = client.get("/api/karten/ebenen/welt-kontinente?punkte=1&projektion=equalearth", headers=auth(teacher_token))
    assert r.status_code == 200
    assert len(r.json()["features"]) == len(
        client.get("/api/karten/ebenen/welt-kontinente", headers=auth(teacher_token)).json()["features"])
