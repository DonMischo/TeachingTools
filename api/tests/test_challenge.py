"""Challenge-Router: Sätze hochladen/prüfen, Spiel per Code (ohne Lösungen im Client), Wertung, CSV, Hauspunkte."""
import copy
import io
import json
import zipfile

from api import challenge_engine as eng
from api.auth import create_access_token
from api.models import Student, Transaction
from .conftest import auth

SATZ = {
    "title": "Hebelgesetz",
    "subject": "Physik",
    "stages": [{"id": 1, "title": "Der Hebel"}, {"id": 2, "title": "Die Wippe"}],
    "facts": [
        {"id": "f1", "text": "Kraft mal Kraftarm gleich Last mal Lastarm", "image": "wippe.png"},
        {"id": "f2", "text": "Ein langer Kraftarm spart Kraft"},
        {"id": "f3", "text": "Die Wippe ist ein zweiseitiger Hebel"},
        {"id": "f4", "text": "Die Schubkarre ist ein einseitiger Hebel"},
        {"id": "x1", "text": "Schwere Körper fallen schneller", "decoy": True},
        {"id": "x2", "text": "Ein Hebel erzeugt Energie", "decoy": True},
    ],
    "challenges": [
        {"id": "c1", "text": "Warum hebt eine Brechstange den Stein?", "solve": {"all": ["f1", "f2"]},
         "strength": 2, "stage": 1, "feedback": "Langer Kraftarm!", "tip": "Denk an den Kraftarm."},
        {"id": "c2", "text": "Welcher Hebel ist eine Wippe?", "solve": {"any": ["f3"]}, "feedback": "Genau."},
        {"id": "c3", "text": "Welcher Hebel ist eine Schubkarre?", "solve": {"any": ["f4"]}},
        {"id": "c4", "text": "Wie lautet das Hebelgesetz?", "solve": {"any": ["f1"]}},
        {"id": "c5", "text": "Was spart Kraft?", "solve": {"any": ["f2"]}},
        {"id": "c6", "text": "Wo sitzt das Gewicht der Wippe?", "solve": {"any": ["f3"]}, "stage": 2},
    ],
    "levels": {
        "1": {"facts": [{"id": "f1", "text": "Einfacher Text"}],
              "challenges": [{"id": "c9", "text": "Neue leichte Frage", "solve": {"any": ["f3"]}}],
              "omit": ["c2"]},
    },
}
# Lösungen je Challenge (nur im Test bekannt)
LOESUNG = {"c1": ["f1", "f2"], "c2": ["f3"], "c3": ["f4"], "c4": ["f1"], "c5": ["f2"], "c6": ["f3"], "c9": ["f3"]}
ETAPPE_1 = ["c1", "c2", "c3", "c4", "c5"]


# ── Helfer ───────────────────────────────────────────────────────────

def _h(client, token) -> dict:
    """Cookie-Login gewinnt gegen den Bearer-Header — also vorher leeren."""
    client.cookies.clear()
    return auth(token)


def _upload(client, token, satz=SATZ):
    return client.post("/api/challenge/upload", headers=_h(client, token),
                       files={"file": ("challenge.json", io.BytesIO(json.dumps(satz).encode()), "application/json")})


def _sitzung(client, token, satz=SATZ, **einstellungen):
    sid = _upload(client, token, satz).json()["id"]
    code = client.post("/api/tool-sessions", json={"tool_slug": "challenge", "ref_id": sid},
                       headers=_h(client, token)).json()["code"]
    if einstellungen:
        client.put(f"/api/tool-sessions/{code}/settings", json=einstellungen, headers=auth(token))
    return code


def _schueler(db, klass, vorname="Kim") -> Student:
    s = Student(vorname=vorname, nachname="Test", klasse=klass.code, class_id=klass.id, active=True)
    db.add(s)
    db.flush()
    return s


def _tok(schueler) -> str:
    return create_access_token({"sub": str(schueler.id), "type": "student"})


def _gast(client, token, code, name="Mia") -> str:
    client.patch("/api/guest/allow", json={"code": code, "tool": "simulation", "allow": True}, headers=auth(token))
    gast = client.post("/api/guest/join", json={"code": code, "tool": "simulation", "name": name}).json()["token"]
    client.cookies.clear()
    return gast


def _start(client, code, token):
    return client.post(f"/api/challenge/{code}/start", headers=_h(client, token))


def _antwort(client, code, token, cid, fakten=None, lese_ms=8000, wahl_ms=5000, tipp=False):
    return client.post(f"/api/challenge/{code}/antwort", headers=_h(client, token), json={
        "challenge_id": cid, "fakt_ids": LOESUNG[cid] if fakten is None else fakten,
        "lese_ms": lese_ms, "wahl_ms": wahl_ms, "tipp": tipp})


def _alle_schluessel(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _alle_schluessel(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _alle_schluessel(v)


# ── Sätze ────────────────────────────────────────────────────────────

def test_upload_json_ok_mit_warnungen_feld(client, teacher_token):
    r = _upload(client, teacher_token)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert isinstance(body["id"], int) and body["title"] == "Hebelgesetz"
    assert isinstance(body["warnungen"], list)
    sets = client.get("/api/challenge/sets", headers=_h(client, teacher_token)).json()
    eintrag = next(s for s in sets if s["id"] == body["id"])
    assert eintrag["title"] == "Hebelgesetz"


def test_upload_ungueltig_ist_422_mit_fehlerliste(client, teacher_token):
    schlecht = copy.deepcopy(SATZ)
    schlecht["challenges"][1]["solve"] = {"any": ["gibtsnicht"]}
    r = _upload(client, teacher_token, schlecht)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["message"] and isinstance(detail["errors"], list) and detail["errors"]


def test_upload_kein_json_ist_400(client, teacher_token):
    r = client.post("/api/challenge/upload", headers=_h(client, teacher_token),
                    files={"file": ("challenge.json", io.BytesIO(b"{kaputt"), "application/json")})
    assert r.status_code == 400


def test_upload_zip_speichert_assets(client, teacher_token, tmp_path, monkeypatch):
    import api.routers.challenge as ch
    monkeypatch.setattr(ch, "CHALLENGE_DATA_ROOT", tmp_path)
    puffer = io.BytesIO()
    with zipfile.ZipFile(puffer, "w") as z:
        z.writestr("challenge.json", json.dumps(SATZ))
        z.writestr("assets/wippe.png", b"png")
        z.writestr("assets/boese.exe", b"nope")
    r = client.post("/api/challenge/upload", headers=_h(client, teacher_token),
                    files={"file": ("satz.zip", puffer.getvalue(), "application/zip")})
    assert r.status_code in (200, 201), r.text
    sid = r.json()["id"]
    assert (tmp_path / str(sid) / "assets" / "wippe.png").exists()
    assert not (tmp_path / str(sid) / "assets" / "boese.exe").exists()
    assert not any("wippe.png" in w for w in r.json()["warnungen"])


def test_vorlage_ist_selbst_ein_gueltiger_satz(client, teacher_token):
    r = client.get("/api/challenge/template", headers=_h(client, teacher_token))
    assert r.status_code == 200
    fehler, _ = eng.pruefe_satz(r.json())
    assert fehler == []
    assert _upload(client, teacher_token, r.json()).status_code in (200, 201)


def test_satz_lesen_aendern_exportieren_loeschen(client, teacher_token):
    sid = _upload(client, teacher_token).json()["id"]
    lk = _h(client, teacher_token)
    assert client.get(f"/api/challenge/sets/{sid}", headers=lk).json()["challenges"][0]["solve"] == {"all": ["f1", "f2"]}

    neu = {**SATZ, "title": "Neuer Titel"}
    assert client.put(f"/api/challenge/sets/{sid}", json=neu, headers=lk).status_code == 200
    assert client.get(f"/api/challenge/sets/{sid}", headers=lk).json()["title"] == "Neuer Titel"

    kaputt = {**SATZ, "title": ""}
    assert client.put(f"/api/challenge/sets/{sid}", json=kaputt, headers=lk).status_code == 422

    ex = client.get(f"/api/challenge/sets/{sid}/export", headers=lk)
    assert ex.status_code == 200 and json.loads(ex.content)["title"] == "Neuer Titel"

    assert client.delete(f"/api/challenge/sets/{sid}", headers=lk).status_code in (200, 204)
    assert client.get(f"/api/challenge/sets/{sid}", headers=lk).status_code == 404


# ── Spiel: Brett ohne Lösungen ───────────────────────────────────────

def test_start_liefert_brett_ohne_loesungen(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=1)
    sch = _schueler(db, klass)
    r = _start(client, code, _tok(sch))
    assert r.status_code == 200, r.text
    brett = r.json()
    assert not {"solve", "decoy", "feedback"} & set(_alle_schluessel(brett))
    assert brett["stufe"] == 1 and brett["etappe"] == 1 and brett["leben"] == eng.LEBEN
    assert brett["fertig"] is False
    assert [e["nr"] for e in brett["etappen"]] == [1, 2]
    assert brett["etappen"][0]["titel"] == "Der Hebel" and brett["etappen"][0]["erledigt"] is False
    # Stufe 1: aufgelöster Satz (c2 entfällt, c9 neu) und Tipp sichtbar
    assert {c["id"] for c in brett["challenges"]} == {"c1", "c3", "c4", "c5", "c9"}
    assert next(c for c in brett["challenges"] if c["id"] == "c1")["tip"] == "Denk an den Kraftarm."
    assert next(f for f in brett["fakten"] if f["id"] == "f1")["text"] == "Einfacher Text"


def test_start_ab_stufe_2_ohne_tipps(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)  # Standard-Startstufe 2
    brett = _start(client, code, _tok(_schueler(db, klass))).json()
    assert brett["stufe"] == 2
    assert all(not c.get("tip") for c in brett["challenges"])


def test_anzahl_ablenker_je_stufe(client, db, teacher_token, klass):
    erwartet = {1: 5, 2: 6, 4: 6}  # 4 echte Fakten + 1 / 2 / alle (2) Ablenker
    for stufe, anzahl in erwartet.items():
        code = _sitzung(client, teacher_token, startstufe=stufe)
        brett = _start(client, code, _tok(_schueler(db, klass, f"S{stufe}"))).json()
        assert len(brett["fakten"]) == anzahl, stufe


def test_startstufen_der_lehrkraft_gilt_fuer_den_schueler(client, db, teacher_token, klass):
    a, b = _schueler(db, klass, "Anna"), _schueler(db, klass, "Ben")
    code = _sitzung(client, teacher_token, startstufe=2, startstufen={str(a.id): 1})
    assert _start(client, code, _tok(a)).json()["stufe"] == 1
    assert _start(client, code, _tok(b)).json()["stufe"] == 2


def test_start_setzt_fort_statt_neu_anzulegen(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    _antwort(client, code, tok, "c2")
    brett = _start(client, code, tok).json()
    assert next(c for c in brett["challenges"] if c["id"] == "c2")["erledigt"] is True
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()
    assert len(ueb["teilnehmer"]) == 1


def test_info_ohne_startstufen(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufen={"1": 3}, theme="dunkel")
    r = client.get(f"/api/challenge/{code}", headers=_h(client, _tok(_schueler(db, klass))))
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Hebelgesetz" and body["subject"] == "Physik"
    assert "startstufen" not in body["settings"] and body["settings"]["theme"] == "dunkel"
    assert body["stand"] is None


# ── Spiel: Antworten ─────────────────────────────────────────────────

def test_komplette_antwort_markiert_erledigt_und_haelt_loesung_zurueck(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    r = _antwort(client, code, tok, "c1")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["komplett"] and body["treffer"] and body["kombo"] and body["qualitaet"] == 1
    assert body["schaden"] == 25 and body["feedback"] == "Langer Kraftarm!"
    assert body["leben"] == eng.LEBEN and body["zurueck_zur_karte"] is False and body["fertig"] is False
    assert not {"solve", "decoy", "loesung"} & set(_alle_schluessel(body))
    brett = _start(client, code, tok).json()
    assert next(c for c in brett["challenges"] if c["id"] == "c1")["erledigt"] is True


def test_falsche_antwort_kostet_leben_ohne_feedback(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    body = _antwort(client, code, tok, "c2", ["x1"]).json()
    assert body["treffer"] is False and not body["komplett"]
    assert body["leben"] == eng.LEBEN - 1 and body["falsch_gewaehlt"] == 1
    assert "feedback" not in body or body["feedback"] in (None, "")


def test_teilweise_richtig_kostet_kein_leben_und_bleibt_offen(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    body = _antwort(client, code, tok, "c1", ["f1"]).json()
    assert body["treffer"] and not body["komplett"] and body["leben"] == eng.LEBEN
    assert _antwort(client, code, tok, "c1").status_code == 200  # noch nicht erledigt


def test_drei_fehlversuche_zurueck_zur_karte_und_leben_zurueck(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    letzte = None
    for _ in range(eng.LEBEN):
        letzte = _antwort(client, code, tok, "c2", ["x1"]).json()
    assert letzte["zurueck_zur_karte"] is True
    assert letzte["leben"] == eng.LEBEN
    assert _start(client, code, tok).json()["leben"] == eng.LEBEN


def test_erledigte_challenge_nicht_nochmal_409(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    assert _antwort(client, code, tok, "c2").status_code == 200
    assert _antwort(client, code, tok, "c2").status_code == 409


def test_unbekannte_challenge_404_und_andere_etappe_409(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    assert client.post(f"/api/challenge/{code}/antwort", headers=_h(client, tok), json={
        "challenge_id": "gibtsnicht", "fakt_ids": ["f1"], "lese_ms": 0, "wahl_ms": 0, "tipp": False}).status_code == 404
    assert _antwort(client, code, tok, "c6").status_code == 409  # gehört zu Etappe 2


def test_alle_etappen_geschafft_setzt_fertig(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    for cid in ETAPPE_1[:-1]:
        assert _antwort(client, code, tok, cid).json()["etappe_geschafft"] is False
    letzte = _antwort(client, code, tok, ETAPPE_1[-1]).json()
    assert letzte["etappe_geschafft"] is True and letzte["fertig"] is False
    brett = _start(client, code, tok).json()
    assert brett["etappe"] == 2 and brett["leben"] == eng.LEBEN
    assert [e["erledigt"] for e in brett["etappen"]] == [True, False]

    ende = _antwort(client, code, tok, "c6").json()
    assert ende["fertig"] is True
    assert _start(client, code, tok).json()["fertig"] is True
    assert _antwort(client, code, tok, "c6").status_code == 409


def test_gast_kann_spielen(client, teacher_token):
    code = _sitzung(client, teacher_token, startstufe=3)
    gast = _gast(client, teacher_token, code)
    assert _start(client, code, gast).status_code == 200
    assert _antwort(client, code, gast, "c2").json()["komplett"] is True


# ── Auswertung ───────────────────────────────────────────────────────

def _spielen(client, code, tok):
    """Erst falsch (Ablenker), dann richtig bei c2; c1 sofort kombo; ein Ablenker-Text landet im Protokoll."""
    _start(client, code, tok)
    _antwort(client, code, tok, "c2", ["x1"], lese_ms=100)  # geraten
    _antwort(client, code, tok, "c2")
    _antwort(client, code, tok, "c1")


def test_uebersicht_felder_und_punkte(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    sch = _schueler(db, klass)
    _spielen(client, code, _tok(sch))
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()
    t = ueb["teilnehmer"][0]
    for feld in ("name", "klasse", "stufe_start", "stufe", "guete", "ergebnis", "punkte", "fragen",
                 "erstversuch_richtig", "kombos", "ablenker_gewaehlt", "lesetempo_median", "geraten", "fertig"):
        assert feld in t, feld
    assert t["klasse"] == "5a" and t["stufe_start"] == 3 and t["fragen"] == 3
    assert t["erstversuch_richtig"] == 1 and t["kombos"] == 1 and t["fertig"] is False
    assert t["ablenker_gewaehlt"] == ["Schwere Körper fallen schneller"]
    assert t["geraten"] >= 1
    # Güte (0 + 1 + 1) / 3, Abdeckung 2 von 6 Challenges
    assert t["guete"] == round(2 / 3, 4) and t["ergebnis"] == round(2 / 3 * 2 / 6, 4)
    assert t["punkte"] == round(t["ergebnis"] * 100)
    assert ueb["punkte"] == [{"class_id": klass.id, "klasse": "5a", "teilnehmer": 1, "punkte": t["punkte"]}]


def test_csv_export(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    _spielen(client, code, _tok(_schueler(db, klass)))
    r = client.get(f"/api/challenge/{code}/export.csv", headers=_h(client, teacher_token))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    zeilen = r.content.decode("utf-8-sig").splitlines()
    kopf = zeilen[0].split(";")
    assert "name" in kopf and "ergebnis" in kopf and "punkte" in kopf
    assert len(zeilen) == 2 and "5a" in zeilen[1]


def test_hauspunkte_eine_transaction_je_klasse_mit_mittelwert_und_nur_einmal(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    a, b = _schueler(db, klass, "Anna"), _schueler(db, klass, "Ben")
    _spielen(client, code, _tok(a))
    _start(client, code, _tok(b))
    _antwort(client, code, _tok(b), "c2")  # 1 von 6, Güte 1
    lk = _h(client, teacher_token)
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=lk).json()
    punkte = [t["punkte"] for t in ueb["teilnehmer"]]
    erwartet = round(sum(punkte) / len(punkte))
    assert ueb["punkte"][0]["teilnehmer"] == 2 and ueb["punkte"][0]["punkte"] == erwartet

    assert client.post(f"/api/challenge/{code}/punkte", headers=_h(client, teacher_token)).status_code == 200
    assert db.query(Transaction).filter_by(class_id=klass.id).one().points == erwartet
    assert client.post(f"/api/challenge/{code}/punkte", headers=_h(client, teacher_token)).status_code == 409
    assert db.query(Transaction).filter_by(class_id=klass.id).count() == 1


def test_gaeste_zaehlen_nicht_fuer_hauspunkte(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    gast = _gast(client, teacher_token, code)
    _start(client, code, gast)
    _antwort(client, code, gast, "c2")
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()
    assert len(ueb["teilnehmer"]) == 1 and ueb["punkte"] == []
    client.post(f"/api/challenge/{code}/punkte", headers=_h(client, teacher_token))
    assert db.query(Transaction).count() == 0


def test_staende_loeschen_setzt_alles_zurueck(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    _spielen(client, code, _tok(_schueler(db, klass)))
    lk = _h(client, teacher_token)
    client.post(f"/api/challenge/{code}/punkte", headers=lk)
    assert client.delete(f"/api/challenge/{code}/staende", headers=_h(client, teacher_token)).status_code in (200, 204)
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()
    assert ueb["teilnehmer"] == []
    # Punkte dürfen wieder vergeben werden
    assert client.post(f"/api/challenge/{code}/punkte", headers=_h(client, teacher_token)).status_code != 409


def test_fremde_lehrkraft_sieht_keine_auswertung(client, teacher_token, admin_token):
    code = _sitzung(client, teacher_token)
    fremd = _h(client, admin_token)
    assert client.get(f"/api/challenge/{code}/uebersicht", headers=fremd).status_code == 403
    assert client.get(f"/api/challenge/{code}/export.csv", headers=_h(client, admin_token)).status_code == 403
    assert client.post(f"/api/challenge/{code}/punkte", headers=_h(client, admin_token)).status_code == 403
    assert client.delete(f"/api/challenge/{code}/staende", headers=_h(client, admin_token)).status_code == 403


def test_statistik_liefert_nur_summen(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=3)
    _spielen(client, code, _tok(_schueler(db, klass)))
    r = client.get(f"/api/challenge/statistik?class_id={klass.id}", headers=_h(client, teacher_token))
    assert r.status_code == 200, r.text
    zeilen = r.json()
    zeilen = zeilen if isinstance(zeilen, list) else next(v for v in zeilen.values() if isinstance(v, list))
    assert zeilen
    z = zeilen[0]
    for feld in ("stufe", "teilnehmer", "lesetempo_median", "anteil_geraten"):
        assert feld in z, feld
    assert z["teilnehmer"] == 1
    assert "name" not in z


def test_bilder_kommen_als_url_und_content_endpunkt_verraet_nichts(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    tok = _tok(_schueler(db, klass))
    brett = _start(client, code, tok).json()
    f1 = next(f for f in brett["fakten"] if f["id"] == "f1")
    assert f1["image"].startswith("/uploads/challenges/") and f1["image"].endswith("/assets/wippe.png")
    # Der allgemeine Inhalt-Endpunkt der Sitzungen würde den Satz samt Lösungen liefern
    assert client.get(f"/api/tool-sessions/{code}/content", headers=_h(client, tok)).status_code == 404
