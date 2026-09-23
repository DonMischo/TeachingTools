"""Die Schreibübung: Katalog-Eintrag, Beitritts-Sitzung und Gastzugang.

Das Werkzeug selbst rechnet im Browser — hier steht nur, was der Server dafür
hergeben muss: ein Code zum Scannen, das Gast-Opt-in der Lehrkraft und die
Freigabe über die Werkzeug-Verfügbarkeit.

Die Gast-Tests legen die Sitzung direkt über `db` an, damit der TestClient
keinen Login-Cookie trägt: der schlüge sonst den Bearer-Gast-Token.
"""
import json

from api import tool_catalog
from api.models import ToolSession, ToolAvailability, TippSammlung
from .conftest import auth


def _lade_hoch(client, token, daten: dict):
    return client.post(
        "/api/tipptexte/upload",
        files={"file": ("sammlung.json", json.dumps(daten), "application/json")},
        headers=auth(token),
    )


def _gueltig(**abweichung) -> dict:
    daten = {
        "title": "Die Zelle",
        "texts": [{"title": "Bausteine", "text": "Die Zelle hat eine Membran."}],
        "words": ["zellkern", "vakuole"],
        "settings": {"lock_on_error": True},
    }
    daten.update(abweichung)
    return daten


def _sitzung(db, teacher, code="TIPP01", allow=False) -> ToolSession:
    s = ToolSession(code=code, tool_slug="tippen", created_by=teacher.id, allow_guests=allow)
    db.add(s)
    db.flush()
    return s


# ── Katalog ─────────────────────────────────────────────────────────────────

def test_tippen_steht_im_katalog():
    tool = tool_catalog.BY_SLUG["tippen"]
    assert tool.surface == "aktivitaeten"
    # Üben dürfen beide von Haus aus.
    assert tool_catalog.default_allowed("tippen", "use", "student") is True
    assert tool_catalog.default_allowed("tippen", "use", "teacher") is True
    # Ein Rennen hosten und eigene Texte hochladen bleibt der Lehrkraft.
    assert tool_catalog.default_allowed("tippen", "host", "teacher") is True
    assert tool_catalog.default_allowed("tippen", "host", "student") is False
    assert tool_catalog.default_allowed("tippen", "upload", "teacher") is True
    assert tool_catalog.default_allowed("tippen", "upload", "student") is False
    # Es gibt keinen Erstellen-Weg — Material kommt als Datei herein.
    assert tool_catalog.default_allowed("tippen", "create", "teacher") is False


# ── Beitritts-Sitzung ───────────────────────────────────────────────────────

def test_lehrkraft_bekommt_einen_code(client, teacher_token):
    r = client.post("/api/tool-sessions", json={"tool_slug": "tippen"}, headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["tool_slug"] == "tippen"
    assert body["code"]
    assert body["allow_guests"] is False


def test_code_bleibt_derselbe(client, teacher_token):
    """Ein ausgedruckter QR muss weiter gelten."""
    erst = client.post("/api/tool-sessions", json={"tool_slug": "tippen"}, headers=auth(teacher_token)).json()
    wieder = client.post("/api/tool-sessions", json={"tool_slug": "tippen"}, headers=auth(teacher_token)).json()
    assert erst["code"] == wieder["code"]


def test_beitritts_seite_liest_den_code_ohne_login(client, db, teacher):
    _sitzung(db, teacher)
    r = client.get("/api/tool-sessions/TIPP01")
    assert r.status_code == 200
    assert r.json()["tool_slug"] == "tippen"


def test_gesperrtes_werkzeug_gibt_keinen_code(client, db, teacher, teacher_token):
    db.add(ToolAvailability(tool_slug="tippen", capability="use", audience="teacher",
                            class_id=None, allowed=False))
    db.flush()
    r = client.post("/api/tool-sessions", json={"tool_slug": "tippen"}, headers=auth(teacher_token))
    assert r.status_code == 403


# ── Gastzugang ──────────────────────────────────────────────────────────────

def test_gast_darf_nicht_ohne_opt_in(client, db, teacher):
    _sitzung(db, teacher, allow=False)
    r = client.post("/api/guest/join", json={"code": "TIPP01", "tool": "simulation", "name": "Bo"})
    assert r.status_code == 403


def test_gast_bekommt_token_nach_opt_in(client, db, teacher):
    _sitzung(db, teacher, allow=True)
    r = client.post("/api/guest/join", json={"code": "TIPP01", "tool": "simulation", "name": "Bo"})
    assert r.status_code == 200, r.text
    assert r.json()["token"]
    assert r.json()["name"] == "Bo"


def test_lehrkraft_schaltet_gaeste_frei(client, db, teacher, teacher_token):
    s = _sitzung(db, teacher, allow=False)
    r = client.patch("/api/guest/allow", json={"code": "TIPP01", "tool": "simulation", "allow": True},
                     headers=auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["allow_guests"] is True
    assert s.allow_guests is True


# ── Hochgeladenes Tippmaterial ──────────────────────────────────────────────

def test_vorlage_ist_selbst_gueltig(client, teacher_token):
    """Die Vorlage muss durch die eigene Prüfung kommen — sonst schickt sie
    jeden, der sie ausfüllt, in eine Fehlermeldung."""
    vorlage = client.get("/api/tipptexte/template", headers=auth(teacher_token)).json()
    vorlage.pop("_ai_instructions")
    r = _lade_hoch(client, teacher_token, vorlage)
    assert r.status_code == 201, r.text
    assert len(r.json()["texts"]) == 2


def test_sammlung_hochladen_und_wiederfinden(client, teacher_token):
    angelegt = _lade_hoch(client, teacher_token, _gueltig()).json()
    assert angelegt["settings"] == {"lock_on_error": True}

    liste = client.get("/api/tipptexte", headers=auth(teacher_token)).json()
    assert [s["id"] for s in liste] == [angelegt["id"]]
    assert liste[0]["anzahl_texte"] == 1
    assert liste[0]["anzahl_woerter"] == 2

    einzeln = client.get(f"/api/tipptexte/{angelegt['id']}", headers=auth(teacher_token)).json()
    assert einzeln["texts"][0]["text"] == "Die Zelle hat eine Membran."


def test_tottasten_werden_abgelehnt(client, teacher_token):
    """^ und ´ entstehen erst mit dem nächsten Anschlag — die Fehlersperre käme
    nie darüber hinweg."""
    r = _lade_hoch(client, teacher_token, _gueltig(
        texts=[{"title": "T", "text": "Das Dach ist 3^2 Meter breit."}]))
    assert r.status_code == 400
    assert "Tottasten" in r.json()["detail"]


def test_altgr_zeichen_werden_abgelehnt(client, teacher_token):
    """Die Übung nimmt keine Anschläge mit Strg/Alt an — ein @ im Text wäre für
    den Schüler hinter der Fehlersperre unerreichbar."""
    r = _lade_hoch(client, teacher_token, _gueltig(
        texts=[{"title": "T", "text": "Schreib an anna@schule.de"}]))
    assert r.status_code == 400
    assert "AltGr" in r.json()["detail"]


def test_titel_und_texte_sind_pflicht(client, teacher_token):
    assert _lade_hoch(client, teacher_token, _gueltig(title="")).status_code == 400
    assert _lade_hoch(client, teacher_token, _gueltig(texts=[])).status_code == 400
    assert _lade_hoch(client, teacher_token, _gueltig(
        texts=[{"title": "T", "text": "   "}])).status_code == 400


def test_unbekannte_einstellung_wird_abgelehnt(client, teacher_token):
    r = _lade_hoch(client, teacher_token, _gueltig(settings={"tempo": 5}))
    assert r.status_code == 400
    assert "tempo" in r.json()["detail"]


def test_fehlersperre_ist_die_voreinstellung(client, teacher_token):
    r = _lade_hoch(client, teacher_token, _gueltig(settings={}))
    assert r.json()["settings"] == {"lock_on_error": True}


def test_woerter_bleiben_einzelne_woerter(client, teacher_token):
    """Im Wortregen fällt ein Wort als eine Einheit — Wortgruppen würden das Feld sprengen."""
    r = _lade_hoch(client, teacher_token, _gueltig(words=["glatte muskulatur", "  ", "zelle"]))
    assert r.json()["words"] == ["glatte", "zelle"]


def test_kaputtes_json_meldet_sich_verstaendlich(client, teacher_token):
    r = client.post(
        "/api/tipptexte/upload",
        files={"file": ("sammlung.json", "{kein json", "application/json")},
        headers=auth(teacher_token),
    )
    assert r.status_code == 400
    assert "JSON" in r.json()["detail"]


def test_hochladen_folgt_der_freigabe(client, db, teacher, teacher_token):
    db.add(ToolAvailability(tool_slug="tippen", capability="upload", audience="teacher",
                            class_id=None, allowed=False))
    db.flush()
    assert _lade_hoch(client, teacher_token, _gueltig()).status_code == 403


def test_nur_der_ersteller_darf_loeschen(client, db, teacher, teacher_token, admin):
    eigen = _lade_hoch(client, teacher_token, _gueltig()).json()
    fremd = TippSammlung(title="Fremd", texts=[{"title": "T", "text": "abc"}],
                         words=[], settings={}, created_by=admin.id)
    db.add(fremd)
    db.flush()

    assert client.delete(f"/api/tipptexte/{fremd.id}", headers=auth(teacher_token)).status_code == 403
    assert client.delete(f"/api/tipptexte/{eigen['id']}", headers=auth(teacher_token)).status_code == 204
    assert client.get(f"/api/tipptexte/{eigen['id']}", headers=auth(teacher_token)).status_code == 404
