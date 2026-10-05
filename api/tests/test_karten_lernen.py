"""Kartenquiz: Lernhelfer (Fuzzy-Bedarf, Ablenker, Üben) und die Erfolgsarten."""
import random
from datetime import datetime, timedelta, timezone

from api import karten_lernen as lernen
from .conftest import auth
from .test_karten_quiz import SATZ, _gast

JETZT = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)


def _eintrag(hist, stunden_her=0.0, **mehr):
    return {"n": len(hist), "r": sum(hist), "f": len(hist) - sum(hist), "hist": hist,
            "zuletzt": (JETZT - timedelta(hours=stunden_her)).isoformat(), **mehr}


# ── Fuzzy-Bedarf ─────────────────────────────────────────────────────

def test_schwaches_kommt_vor_sicherem_und_sicheres_nach_langer_pause_wieder():
    schwach = lernen.bedarf(_eintrag([0, 1, 0]), JETZT)
    sicher_eben = lernen.bedarf(_eintrag([1, 1, 1, 1]), JETZT)
    sicher_lange_her = lernen.bedarf(_eintrag([1, 1, 1, 1], stunden_her=72), JETZT)
    neu = lernen.bedarf(None, JETZT)
    assert schwach > neu > sicher_lange_her > sicher_eben
    assert sicher_eben < 0.15 and schwach > 0.9


def test_sicherheit_gewichtet_neuere_antworten_und_eine_antwort_ist_noch_kein_wissen():
    assert lernen.sicherheit(_eintrag([0, 0, 1, 1])) > lernen.sicherheit(_eintrag([1, 1, 0, 0]))
    assert lernen.sicherheit(_eintrag([1])) < 0.8
    assert lernen.hilfe(_eintrag([1], b=True)) == "frei" and lernen.hilfe(_eintrag([0, 0], b=True)) == "auswahl"
    assert lernen.hilfe(_eintrag([1, 1, 1], b=True), "finden") == "auswahl"  # finden noch nie geklappt


def test_waehle_bevorzugt_schwaches_und_wiederholt_nicht_sofort():
    aufgaben = [{"nr": i, "ebene": "e", "id": str(i), "name": n} for i, n in enumerate(["A", "B", "C", "D"], 1)]
    objekte = {"e:1": _eintrag([0, 0, 0]), "e:2": _eintrag([1, 1, 1, 1]), "e:3": _eintrag([1, 1, 1, 1]), "e:4": _eintrag([1, 1, 1, 1])}
    rng = random.Random(1)
    gezogen = [lernen.waehle(aufgaben, objekte, [], JETZT, rng)["id"] for _ in range(200)]
    assert gezogen.count("1") > 150
    assert all(lernen.waehle(aufgaben, objekte, ["e:1"], JETZT, rng)["id"] != "1" for _ in range(30))


def test_ablenker_frueher_verwechselt_vor_nah_vor_aehnlich():
    ziel = {"ebene": "s", "id": "erfurt", "name": "Erfurt", "anker": [11.03, 50.98]}
    kandidaten = [
        {"ebene": "s", "id": "weimar", "name": "Weimar", "anker": [11.33, 50.98]},
        {"ebene": "s", "id": "kiel", "name": "Kiel", "anker": [10.13, 54.32]},
        {"ebene": "s", "id": "erlangen", "name": "Erlangen", "anker": [11.0, 49.6]},
        {"ebene": "s", "id": "rostock", "name": "Rostock", "anker": [12.1, 54.1]},
        {"ebene": "s", "id": "erfurt2", "name": "Erfurt", "anker": [11.0, 51.0]},  # gleicher Name: nie Ablenker
    ]
    e = _eintrag([0], verwechselt={"s:rostock": 2})
    namen = [c["name"] for c in lernen.ablenker(ziel, kandidaten, e, random.Random(3))]
    assert namen[0] == "Rostock" and set(namen[1:]) == {"Weimar", "Erlangen"}
    # Andere Ebenen nur, wenn die eigene nicht genug hergibt
    mit_land = [*kandidaten, {"ebene": "l", "id": "th", "name": "Thüringen", "anker": [11.0, 50.9]}]
    assert "Thüringen" not in [c["name"] for c in lernen.ablenker(ziel, mit_land, e, random.Random(3))]


def test_verbuche_merkt_richtung_und_verwechslung():
    a = {"ebene": "s", "id": "erfurt"}
    e = lernen.verbuche({}, a, True, "finden", JETZT)
    assert e["fi"] and not e.get("b") and e["hist"] == [1]
    e = lernen.verbuche({"s:erfurt": e}, a, False, "benennen", JETZT, "s:weimar")
    assert e["verwechselt"] == {"s:weimar": 1} and e["hist"] == [1, 0] and e["f"] == 1


# ── Erfolgsarten (rein) ──────────────────────────────────────────────

AUFG = [{"nr": 1, "ebene": "s", "id": "a"}, {"nr": 2, "ebene": "s", "id": "b"}, {"nr": 3, "ebene": "f", "id": "c"}]


def _ok(v, antworten=None, verlauf=None, lern=None, tage=None, erreicht=(), alle=("x",)):
    return lernen.erfolg_erreicht({"id": "x", **v}, AUFG, antworten or {}, verlauf or {}, lern or {}, tage or [], set(erreicht), list(alle))


def test_erfolgsarten():
    zwei_richtig = {"1": {"richtig": True, "versuche": 1, "t": 20}, "2": {"richtig": True, "versuche": 2, "t": 50}}
    assert _ok({"art": "anteil", "ebenen": ["s"], "schwelle": 1.0}, zwei_richtig)
    assert not _ok({"art": "fehlerfrei", "ebenen": ["s"]}, zwei_richtig)  # Nr. 2 brauchte zwei Versuche
    assert _ok({"art": "objekte", "objekte": ["s:a"]}, zwei_richtig)
    assert not _ok({"art": "objekte", "objekte": ["s:a", "f:c"]}, zwei_richtig)
    assert _ok({"art": "serie", "anzahl": 3}, verlauf={"beste_serie": 3}) and not _ok({"art": "serie", "anzahl": 4}, verlauf={"beste_serie": 3})
    assert _ok({"art": "tempo", "ebenen": ["s"], "sekunden": 60}, zwei_richtig)
    assert not _ok({"art": "tempo", "ebenen": ["s"], "sekunden": 30}, zwei_richtig)
    beide = {"s:a": {"b": True, "fi": True}, "s:b": {"b": True}}
    assert not _ok({"art": "beide", "ebenen": ["s"]}, lern=beide)
    assert _ok({"art": "beide", "ebenen": ["s"]}, lern={**beide, "s:b": {"b": True, "fi": True}})
    aufgeholt = {"s:a": {"f": 1, "hist": [0, 1, 1, 1, 1]}, "s:b": {"f": 0, "hist": [1, 1, 1, 1]}}
    assert _ok({"art": "aufgeholt", "anzahl": 1}, lern=aufgeholt) and not _ok({"art": "aufgeholt", "anzahl": 2}, lern=aufgeholt)
    assert _ok({"art": "dranbleiben", "anzahl": 2}, tage=["2026-10-01", "2026-10-03"])
    assert _ok({"art": "komplett"}, erreicht={"y", "z"}, alle=("x", "y", "z"))
    assert not _ok({"art": "komplett"}, erreicht={"y"}, alle=("x", "y", "z"))


# ── Über die API ─────────────────────────────────────────────────────

ERFOLGE = [
    {"id": "serie", "name": "Lauf", "art": "serie", "anzahl": 2},
    {"id": "fehlerfrei", "name": "Sauber", "art": "fehlerfrei", "ebenen": ["de-staedte"]},
    {"id": "erfurt", "name": "Hauptstadt", "art": "objekte", "objekte": ["de-staedte:16051000"]},
    {"id": "alles", "name": "Alles", "art": "komplett"},
]


def _quiz_mit(client, token, erfolge, **einstellungen):
    satz = client.post("/api/karten/saetze", json={**SATZ, "inhalt": {**SATZ["inhalt"], "erfolge": erfolge}}, headers=auth(token))
    assert satz.status_code == 201, satz.text
    code = client.post("/api/tool-sessions", json={"tool_slug": "karten", "ref_id": satz.json()["id"]}, headers=auth(token)).json()["code"]
    if einstellungen:
        client.put(f"/api/tool-sessions/{code}/settings", json=einstellungen, headers=auth(token))
    return code


def test_erfolge_im_spiel_mit_text_und_komplett_zuletzt(client, teacher_token):
    code = _quiz_mit(client, teacher_token, ERFOLGE)
    gast = auth(_gast(client, teacher_token, code))
    spiel = client.get(f"/api/karten/quiz/{code}", headers=gast).json()
    assert next(e for e in spiel["erfolge"] if e["id"] == "serie")["text"] == "2 richtige Antworten hintereinander"
    r = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 1, "antwort": "Erfurt"}, headers=gast).json()
    assert r["neue_erfolge"] == ["erfurt"]
    r = client.post(f"/api/karten/quiz/{code}/antwort", json={"nr": 2, "antwort": "Jena"}, headers=gast).json()
    assert set(r["neue_erfolge"]) == {"serie", "fehlerfrei", "alles"} and r["neue_erfolge"][-1] == "alles"
    assert r["lernen"]["sicherheit"]["1"] > 0


def test_erfolg_ohne_pflichtfelder_wird_abgelehnt(client, teacher_token):
    for falsch in ({"id": "a", "name": "A", "art": "anteil"}, {"id": "a", "name": "A", "art": "objekte"},
                   {"id": "a", "name": "A", "art": "objekte", "objekte": ["de-staedte:99999999"]}):
        r = client.post("/api/karten/saetze", json={**SATZ, "inhalt": {**SATZ["inhalt"], "erfolge": [falsch]}}, headers=auth(teacher_token))
        assert r.status_code == 422, falsch


def test_ueben_stellt_mit_ablenkern_merkt_verwechslung_und_verraet_im_finden_keine_namen(client, teacher_token):
    code = _quiz_mit(client, teacher_token, [])
    gast = auth(_gast(client, teacher_token, code))
    a = client.get(f"/api/karten/quiz/{code}/ueben", headers=gast).json()
    assert a["richtung"] == "benennen" and a["hilfe"] == "auswahl"  # neu: erst benennen, mit Auswahl
    assert len(a["optionen"]) == 4 and a["anker"] and a["token"]
    namen = {1: "Erfurt", 2: "Jena", 3: "Saale"}
    falsch = next(o for o in a["optionen"] if o != namen[a["nr"]])
    r = client.post(f"/api/karten/quiz/{code}/ueben", json={"nr": a["nr"], "richtung": "benennen", "antwort": falsch}, headers=gast).json()
    assert not r["richtig"] and r["name"] == namen[a["nr"]]
    # Übung zählt nicht fürs Quiz
    assert r["stand"]["richtig"] == 0 and r["lernen"]["schwach"] == 3


def test_richtung_erst_benennen_dann_finden():
    rng = random.Random(0)
    assert lernen.richtung(None, rng) == "benennen"
    assert lernen.richtung({"b": True}, rng) == "finden"
    assert {lernen.richtung({"b": True, "fi": True}, rng) for _ in range(30)} == {"benennen", "finden"}


def test_ueben_finden_mit_kandidaten_ohne_namen_der_ablenker(client, teacher_token, db):
    from api.models import KartenLernstand
    code = _quiz_mit(client, teacher_token, [])
    gast = auth(_gast(client, teacher_token, code))
    client.get(f"/api/karten/quiz/{code}", headers=gast)
    # Alle drei schon benannt → jetzt kommt »finden«
    for nr, name in ((1, "Erfurt"), (2, "Jena"), (3, "Saale")):
        client.post(f"/api/karten/quiz/{code}/ueben", json={"nr": nr, "richtung": "benennen", "antwort": name}, headers=gast)
    assert db.query(KartenLernstand).count() == 1
    b = client.get(f"/api/karten/quiz/{code}/ueben", headers=gast).json()
    assert b["richtung"] == "finden" and b["hilfe"] == "auswahl" and b["name"] in {"Erfurt", "Jena", "Saale"}
    assert "anker" not in b and "optionen" not in b
    assert 1 <= len(b["kandidaten"]) <= 4


def test_ueben_laesst_sich_ausschalten(client, teacher_token):
    code = _quiz_mit(client, teacher_token, [], ueben=False)
    gast = auth(_gast(client, teacher_token, code))
    assert client.get(f"/api/karten/quiz/{code}/ueben", headers=gast).status_code == 403


# ── Selbst üben (ohne Sitzung) ───────────────────────────────────────

def _schueler(db, klass):
    from api.auth import create_access_token
    from api.models import Student
    s = Student(vorname="Kim", nachname="Test", klasse="5a", class_id=klass.id, active=True)
    db.add(s)
    db.flush()
    return auth(create_access_token({"sub": str(s.id), "type": "student"}))


def test_schueler_ueben_geteilte_saetze_ohne_code(client, db, teacher_token, klass):
    lk = auth(teacher_token)
    erfolge = [{"id": "drei-tage", "name": "Dranbleiben", "art": "dranbleiben", "anzahl": 1},
               {"id": "profi", "name": "Profi", "art": "anteil", "ebenen": ["de-staedte"]}]
    geteilt = client.post("/api/karten/saetze", json={**SATZ, "geteilt": True, "inhalt": {**SATZ["inhalt"], "erfolge": erfolge}}, headers=lk).json()["id"]
    privat = client.post("/api/karten/saetze", json={**SATZ, "titel": "Privat"}, headers=lk).json()["id"]
    client.cookies.clear()
    sch = _schueler(db, klass)

    liste = client.get("/api/karten/quiz/ueben/saetze", headers=sch).json()
    assert [s["id"] for s in liste] == [geteilt] and liste[0]["aufgaben"] == 3
    assert client.get(f"/api/karten/quiz/ueben/{privat}", headers=sch).status_code == 404

    satz = client.get(f"/api/karten/quiz/ueben/{geteilt}", headers=sch).json()
    assert [e["id"] for e in satz["erfolge"]] == ["drei-tage"]  # nur Lern-Erfolge
    ebene = client.get(f"/api/karten/quiz/ueben/{geteilt}/ebene/de-staedte", headers=sch).json()
    assert all("name" not in f["properties"] for f in ebene["features"])

    a = client.get(f"/api/karten/quiz/ueben/{geteilt}/naechste", headers=sch).json()
    namen = {1: "Erfurt", 2: "Jena", 3: "Saale"}
    r = client.post(f"/api/karten/quiz/ueben/{geteilt}", json={"nr": a["nr"], "richtung": a["richtung"],
                    "antwort": namen[a["nr"]] if a["richtung"] == "benennen" else a.get("token", "x")}, headers=sch).json()
    assert r["neue_erfolge"] == ["drei-tage"] and r["erreicht"] == ["drei-tage"]
    assert client.get("/api/karten/quiz/ueben/saetze", headers=sch).json()[0]["geuebt"] == 1
