"""Challenge Phase 2: Lauf-Logik, Spielarten, Deck, Behauptungen, Startstufen, DDA-Kalibrierung."""
import copy

import pytest

from api import challenge_engine as eng
from api import challenge_lauf as lauf
from api.models import ChallengeKalibrierung
from .test_challenge import LOESUNG, SATZ, _antwort, _h, _schueler, _sitzung, _start, _tok

CLAIMS = [
    {"id": "k1", "text": "Der Hebel erzeugt Energie.", "refutedBy": ["f2"], "stage": 1, "strength": 2, "feedback": "Nein."},
    {"id": "k2", "text": "Eine Wippe ist einseitig.", "refutedBy": ["f3", "f4"]},
]
MIT_CLAIMS = {**SATZ, "claims": CLAIMS}


def _frage(woerter=20, lese_ms=10000, wahl_ms=5000, stufe=2):
    return {"woerter": woerter, "lese_ms": lese_ms, "wahl_ms": wahl_ms, "stufe": stufe}


# ── Lauf-Funktionen ohne Datenbank ───────────────────────────────────

def test_neuer_lauf_form():
    l = lauf.neuer_lauf(SATZ, 2, seed=7)
    assert l == {"stufe": 2, "stufe_start": 2, "seed": 7, "spiel": "normal", "fertig": False, "fragen": [], "verlauf": [],
                 "zustand": {"etappe": 1, "leben": eng.LEBEN, "erledigt": [], "deck": {}}}


def test_antworte_veraendert_lauf_und_wertung():
    l = lauf.neuer_lauf(SATZ, 2, seed=1)
    aus = lauf.antworte(SATZ, l, "c3", LOESUNG["c3"], 8000, 5000, False)
    assert aus["komplett"] and aus["stufe"] == 2 and "c3" in l["zustand"]["erledigt"] and len(l["fragen"]) == 1
    assert lauf.wertung(SATZ, l)["guete"] == 1.0
    assert lauf.brett(SATZ, l)["challenges"]


def test_antworte_fehler():
    l = lauf.neuer_lauf(SATZ, 2, seed=1)
    with pytest.raises(lauf.LaufFehler) as e:
        lauf.antworte(SATZ, l, "gibts-nicht", ["f1"], 1, 1, False)
    assert e.value.status == 404
    with pytest.raises(lauf.LaufFehler) as e:
        lauf.antworte(SATZ, l, "c6", ["f3"], 1, 1, False)  # Etappe 2
    assert e.value.status == 409


def test_deck_nutzung_und_loeschen_bei_zurueck_zur_karte():
    l = lauf.neuer_lauf(SATZ, 4, seed=1)
    with pytest.raises(lauf.LaufFehler) as e:
        lauf.deck_setzen(SATZ, l, [])
    assert e.value.status == 400
    with pytest.raises(lauf.LaufFehler):
        lauf.deck_setzen(SATZ, l, ["gibts-nicht"])
    lauf.deck_setzen(SATZ, l, ["f3", "x1"])
    assert lauf.brett(SATZ, l)["deck"] == ["f3", "x1"]
    assert l["zustand"]["deck_ablenker"] == ["x1"]
    with pytest.raises(lauf.LaufFehler) as e:
        lauf.antworte(SATZ, l, "c3", ["f4"], 8000, 5000, False)
    assert e.value.status == 409
    for _ in range(eng.LEBEN):
        aus = lauf.antworte(SATZ, l, "c3", ["x1"], 8000, 5000, False)
    assert aus["zurueck_zur_karte"] is True
    assert lauf.brett(SATZ, l)["deck"] is None
    assert l["zustand"]["deck_ablenker"] == ["x1"]  # bleibt für die Auswertung


def test_gericht_nutzt_behauptungen():
    l = lauf.neuer_lauf(MIT_CLAIMS, 2, "gericht", seed=1)
    b = lauf.brett(MIT_CLAIMS, l)
    assert b["spiel"] == "gericht" and {c["id"] for c in b["challenges"]} == {"k1", "k2"}
    assert lauf.antworte(MIT_CLAIMS, l, "k1", ["f2"], 8000, 5000, False)["feedback"] == "Nein."
    assert lauf.antworte(MIT_CLAIMS, l, "k2", ["f3"], 8000, 5000, False)["komplett"] is True  # any
    assert l["fertig"] is True


def test_spiel_wechseln_gericht_sperre():
    l = lauf.neuer_lauf(MIT_CLAIMS, 2, seed=1)
    lauf.spiel_wechseln(MIT_CLAIMS, l, "gericht")
    assert l["spiel"] == "gericht" and l["zustand"]["etappe"] == 1
    lauf.antworte(MIT_CLAIMS, l, "k1", ["f2"], 8000, 5000, False)
    with pytest.raises(lauf.LaufFehler) as e:
        lauf.spiel_wechseln(MIT_CLAIMS, l, "normal")
    assert e.value.status == 409
    n = lauf.neuer_lauf(MIT_CLAIMS, 2, seed=1)
    lauf.antworte(MIT_CLAIMS, n, "c3", ["f4"], 8000, 5000, False)
    lauf.spiel_wechseln(MIT_CLAIMS, n, "karten")  # normal <-> karten frei
    with pytest.raises(lauf.LaufFehler):
        lauf.spiel_wechseln(MIT_CLAIMS, n, "gericht")


# ── Engine: Claims, Kalibrierung ─────────────────────────────────────

def _claim_fehler(**aenderung):
    satz = copy.deepcopy(MIT_CLAIMS)
    satz["claims"][0].update(aenderung)
    return eng.pruefe_satz(satz)[0]


def test_claims_gueltig():
    assert eng.pruefe_satz(MIT_CLAIMS)[0] == []


@pytest.mark.parametrize("aenderung", [
    {"id": "f1"}, {"id": "c1"}, {"id": "k2"}, {"text": ""}, {"refutedBy": []}, {"refutedBy": ["x1"]},
    {"refutedBy": ["nix"]}, {"strength": 4}, {"stage": 0}])
def test_claims_ungueltig(aenderung):
    assert _claim_fehler(**aenderung)


def test_claims_keine_liste():
    assert eng.pruefe_satz({**SATZ, "claims": "x"})[0]


def test_geraten_mit_kalibrierung():
    # 20 Wörter bei 110 wpm = 10,9 s erwartet, 30 % = 3,3 s
    assert not eng.geraten(20, 4000, 2)
    assert eng.geraten(20, 4000, 2, {"lese_wpm": {"2": 30}})  # erwartet 40 s, 30 % = 12 s
    assert not eng.geraten(20, 4000, 2, {"lese_wpm": {"2": 600}})  # erwartet 2 s, 30 % = 0,6 s


def test_regelwerk_nur_response_time_aendert_sich():
    assert eng._regelwerk(None) is eng.dda.DEFAULT_RULESET
    r = eng._regelwerk({"antwortzeit": {"schnell": 10.0, "langsam": 30.0}})
    zeit = next(i for i in r["inputs"] if i["id"] == "response_time")
    params = {m["name"]: m["params"] for m in zeit["membershipFunctions"]}
    assert params["fast"] == [0, 0, 10.0] and params["slow"] == [30.0, 60, 60]
    assert params["medium"] == pytest.approx([6.7, 20.0, 37.5])
    assert eng.dda.DEFAULT_RULESET["inputs"][0]["membershipFunctions"][0]["params"] == [0, 0, 15]  # Original unberührt


def test_vorschlag_zu_wenig_daten():
    v = eng.vorschlag({2: [_frage() for _ in range(29)]}, eng.STANDARD_KALIBRIERUNG)
    assert v["genug"] is False and v["werte"] == eng.STANDARD_KALIBRIERUNG and v["stichprobe"][2] == 29


def test_vorschlag_begrenzt_auf_20_prozent():
    # 20 Wörter in 6 s = 200 wpm (Stufe 2: 110) -> Deckel 132; Wahlzeit 1 s / 100 s -> 12 / 48
    fragen = [_frage(lese_ms=6000, wahl_ms=1000 if i % 2 else 100000) for i in range(40)]
    v = eng.vorschlag({2: fragen}, eng.STANDARD_KALIBRIERUNG)
    assert v["genug"] is True
    assert v["werte"]["lese_wpm"]["2"] == 132 and v["werte"]["lese_wpm"]["1"] == 80
    assert v["werte"]["antwortzeit"] == {"schnell": 12.0, "langsam": 48.0}


def test_vorschlag_ignoriert_geratene():
    fragen = [_frage(lese_ms=100) for _ in range(40)]  # alle geraten
    v = eng.vorschlag({2: fragen}, eng.STANDARD_KALIBRIERUNG)
    assert v["stichprobe"][2] == 0 and v["werte"]["lese_wpm"] == eng.STANDARD_KALIBRIERUNG["lese_wpm"]


# ── Endpunkte ────────────────────────────────────────────────────────

def _start_mit(client, code, token, spiel):
    return client.post(f"/api/challenge/{code}/start", json={"spiel": spiel}, headers=_h(client, token))


def test_info_spiele_theme_skin_und_gericht_ohne_claims(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, spiele=["karten", "gericht", "quatsch"], theme="wald", skin="rap")
    tok = _tok(_schueler(db, klass))
    s = client.get(f"/api/challenge/{code}", headers=_h(client, tok)).json()["settings"]
    assert s["spiele"] == ["karten"] and s["theme"] == "wald" and s["skin"] == "rap"
    code2 = _sitzung(client, teacher_token, MIT_CLAIMS, spiele=["gericht"], theme="x")
    s2 = client.get(f"/api/challenge/{code2}", headers=_h(client, tok)).json()["settings"]
    assert s2["spiele"] == ["gericht"] and s2["theme"] == "klassisch" and s2["skin"] == "monster"


def test_start_spielwahl_und_wechsel(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, spiele=["normal", "karten"])
    tok = _tok(_schueler(db, klass))
    assert _start_mit(client, code, tok, None).json()["spiel"] == "normal"
    assert _start_mit(client, code, tok, "karten").json()["spiel"] == "karten"
    assert _start_mit(client, code, tok, "boss").json()["spiel"] == "karten"  # nicht erlaubt: bleibt
    assert client.get(f"/api/challenge/{code}", headers=_h(client, tok)).json()["stand"]["spiel"] == "karten"
    neu = _tok(_schueler(db, klass, "Lu"))
    assert _start_mit(client, code, neu, "karten").json()["spiel"] == "karten"
    dritte = _tok(_schueler(db, klass, "Jo"))
    assert _start_mit(client, code, dritte, "boss").json()["spiel"] == "normal"


def test_gericht_start_ohne_claims_ist_400(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, spiele=["normal", "gericht"])
    assert _start_mit(client, code, _tok(_schueler(db, klass)), "gericht").status_code == 400


def test_gericht_spielen_und_wechselsperre(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, MIT_CLAIMS, spiele=["normal", "gericht"])
    tok = _tok(_schueler(db, klass))
    brett = _start_mit(client, code, tok, "gericht").json()
    assert {c["id"] for c in brett["challenges"]} == {"k1", "k2"}
    r = client.post(f"/api/challenge/{code}/antwort", headers=_h(client, tok), json={
        "challenge_id": "k1", "fakt_ids": ["f2"], "lese_ms": 8000, "wahl_ms": 5000, "tipp": False})
    assert r.status_code == 200 and r.json()["komplett"] is True and r.json()["feedback"] == "Nein."
    assert _start_mit(client, code, tok, "normal").status_code == 409


def test_deck_endpunkt(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, spiele=["karten"], startstufe=4)
    tok = _tok(_schueler(db, klass))
    assert client.post(f"/api/challenge/{code}/deck", json={"fakt_ids": ["f3"]}, headers=_h(client, tok)).status_code == 409
    assert _start(client, code, tok).json()["deck"] is None
    assert client.post(f"/api/challenge/{code}/deck", json={"fakt_ids": []}, headers=_h(client, tok)).status_code == 400
    assert client.post(f"/api/challenge/{code}/deck", json={"fakt_ids": ["nix"]}, headers=_h(client, tok)).status_code == 400
    r = client.post(f"/api/challenge/{code}/deck", json={"fakt_ids": ["f4", "x1"]}, headers=_h(client, tok))
    assert r.status_code == 200 and r.json()["deck"] == ["f4", "x1"]
    assert _antwort(client, code, tok, "c2", ["f3"]).status_code == 409
    assert _antwort(client, code, tok, "c3", ["f4"]).status_code == 200
    # Ablenker im Deck zählen in der Auswertung, auch als CSV-Spalte
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()["teilnehmer"][0]
    assert ueb["deck_ablenker"] == ["Schwere Körper fallen schneller"] and ueb["stand_id"] and ueb["student_id"]
    csv = client.get(f"/api/challenge/{code}/export.csv", headers=_h(client, teacher_token)).content.decode("utf-8-sig")
    assert "deck_ablenker" in csv.splitlines()[0] and "Schwere Körper fallen schneller" in csv


def test_deck_wird_bei_zurueck_zur_karte_geloescht(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token, startstufe=4)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    client.post(f"/api/challenge/{code}/deck", json={"fakt_ids": ["x1", "f3"]}, headers=_h(client, tok))
    for _ in range(eng.LEBEN):
        r = _antwort(client, code, tok, "c3", ["x1"])
    assert r.json()["zurueck_zur_karte"] is True
    assert _start(client, code, tok).json()["deck"] is None


def test_startstufen_endpunkt(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    sch = _schueler(db, klass)
    r = client.put(f"/api/challenge/{code}/stufen", json={"startstufen": {str(sch.id): 4, "99": 1}}, headers=_h(client, teacher_token))
    assert r.status_code == 200 and r.json()["startstufen"] == {str(sch.id): 4, "99": 1}
    assert client.put(f"/api/challenge/{code}/stufen", json={"startstufen": {"1": 5}}, headers=_h(client, teacher_token)).status_code == 422
    r = client.put(f"/api/challenge/{code}/stufen", json={"startstufen": {"99": None}}, headers=_h(client, teacher_token))
    assert r.json()["startstufen"] == {str(sch.id): 4}
    assert _start(client, code, _tok(sch)).json()["stufe"] == 4
    fremd = _tok(_schueler(db, klass, "Zed"))
    assert client.put(f"/api/challenge/{code}/stufen", json={"startstufen": {}}, headers=_h(client, fremd)).status_code in (401, 403)


def test_stand_stufe_aendern(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    _antwort(client, code, tok, "c3")
    stand_id = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()["teilnehmer"][0]["stand_id"]
    r = client.put(f"/api/challenge/{code}/staende/{stand_id}/stufe", json={"stufe": 3}, headers=_h(client, teacher_token))
    assert r.status_code == 200 and r.json() == {"stand_id": stand_id, "stufe": 3}
    assert client.put(f"/api/challenge/{code}/staende/{stand_id}/stufe", json={"stufe": 5}, headers=_h(client, teacher_token)).status_code == 422
    assert client.put(f"/api/challenge/{code}/staende/999999/stufe", json={"stufe": 1}, headers=_h(client, teacher_token)).status_code == 404
    ueb = client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()["teilnehmer"][0]
    assert ueb["stufe"] == 3 and ueb["fragen"] == 1


def test_schuelerliste(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    a, b = _schueler(db, klass, "Anna"), _schueler(db, klass, "Ben")
    client.put(f"/api/challenge/{code}/stufen", json={"startstufen": {str(a.id): 3}}, headers=_h(client, teacher_token))
    _start(client, code, _tok(b))
    liste = client.get(f"/api/challenge/{code}/schueler", params={"class_id": klass.id}, headers=_h(client, teacher_token)).json()
    je = {z["id"]: z for z in liste}
    assert je[a.id]["startstufe"] == 3 and je[a.id]["stand_id"] is None and je[a.id]["stufe"] is None
    assert je[b.id]["startstufe"] is None and je[b.id]["stand_id"] and je[b.id]["stufe"] == 2
    assert je[a.id]["name"] == "Anna T."


def test_kalibrierung_lesen_speichern_loeschen(client, db, teacher_token, klass):
    r = client.get("/api/challenge/kalibrierung", params={"class_id": klass.id}, headers=_h(client, teacher_token)).json()
    assert r["aktuell"] == eng.STANDARD_KALIBRIERUNG and r["vorschlag"] == r["aktuell"] and r["genug"] is False
    werte = {"lese_wpm": {"1": 70, "2": 100, "3": 130, "4": 160}, "antwortzeit": {"schnell": 12, "langsam": 35}}
    put = lambda w, cid=klass.id: client.put("/api/challenge/kalibrierung", json={"class_id": cid, "werte": w},
                                             headers=_h(client, teacher_token))
    assert put(werte).status_code == 200
    zeile = db.query(ChallengeKalibrierung).filter_by(class_id=klass.id).one()
    assert zeile.werte["lese_wpm"]["2"] == 100 and zeile.vorher is None
    aktuell = client.get("/api/challenge/kalibrierung", params={"class_id": klass.id}, headers=_h(client, teacher_token)).json()["aktuell"]
    assert aktuell["lese_wpm"]["2"] == 100
    put({**werte, "antwortzeit": {"schnell": 10, "langsam": 30}})
    db.refresh(zeile)
    assert zeile.vorher["antwortzeit"]["schnell"] == 12.0
    assert put({"lese_wpm": {"1": 70}, "antwortzeit": {"schnell": 12, "langsam": 35}}).status_code == 422
    assert put(werte, 999999).status_code == 404
    assert client.delete(f"/api/challenge/kalibrierung/{klass.id}", headers=_h(client, teacher_token)).status_code == 204
    assert db.query(ChallengeKalibrierung).filter_by(class_id=klass.id).count() == 0


def test_kalibrierung_wirkt_auf_geraten_in_der_auswertung(client, db, teacher_token, klass):
    code = _sitzung(client, teacher_token)
    tok = _tok(_schueler(db, klass))
    _start(client, code, tok)
    # c3 + f4: wenige Wörter; 4 s Lesen ist bei 110 wpm nicht geraten, bei 20 wpm (erwartet > 20 s) schon
    _antwort(client, code, tok, "c3", lese_ms=4000)
    assert client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()["teilnehmer"][0]["geraten"] == 0
    werte = {"lese_wpm": {"1": 80, "2": 20, "3": 140, "4": 170}, "antwortzeit": {"schnell": 15, "langsam": 40}}
    client.put("/api/challenge/kalibrierung", json={"class_id": klass.id, "werte": werte}, headers=_h(client, teacher_token))
    assert client.get(f"/api/challenge/{code}/uebersicht", headers=_h(client, teacher_token)).json()["teilnehmer"][0]["geraten"] == 1


def test_gluecksrad_ist_spielart_und_waehlbar(client, db, teacher_token, klass):
    from api import challenge_engine
    assert "gluecksrad" in challenge_engine.SPIELE
    code = _sitzung(client, teacher_token, spiele=["normal", "gluecksrad"])
    tok = _tok(_schueler(db, klass))
    s = client.get(f"/api/challenge/{code}", headers=_h(client, tok)).json()["settings"]
    assert s["spiele"] == ["normal", "gluecksrad"]
    assert _start_mit(client, code, tok, "gluecksrad").json()["spiel"] == "gluecksrad"
