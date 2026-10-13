"""TaskCrawler-Boss-Folie: Prüfung, Spielerdaten ohne Lösungen, Lauf (start/antwort/deck) über die Challenge-Logik,
Fragment und Tür, Bericht und Vorlagen."""
import copy

from api import challenge_engine as eng
from api.models import ExitGameEvent
from .test_exitgame import SIMPLE_GAME, _auth, _start_attempt, _student_login, _upload

SATZ = {
    "facts": [
        {"id": "f1", "text": "Kraft mal Kraftarm gleich Last mal Lastarm"},
        {"id": "f2", "text": "Ein langer Kraftarm spart Kraft"},
        {"id": "f3", "text": "Die Wippe ist ein zweiseitiger Hebel"},
        {"id": "f4", "text": "Die Schubkarre ist ein einseitiger Hebel"},
        {"id": "x1", "text": "Schwere Körper fallen schneller", "decoy": True},
        {"id": "x2", "text": "Ein Hebel erzeugt Energie", "decoy": True},
    ],
    "challenges": [
        {"id": "c1", "text": "Warum hebt eine Brechstange den Stein?", "solve": {"all": ["f1", "f2"]}, "strength": 2,
         "feedback": "Langer Kraftarm!"},
        {"id": "c2", "text": "Welcher Hebel ist eine Wippe?", "solve": {"any": ["f3"]}},
        {"id": "c3", "text": "Welcher Hebel ist eine Schubkarre?", "solve": {"any": ["f4"]}},
        {"id": "c4", "text": "Wie lautet das Hebelgesetz?", "solve": {"any": ["f1"]}},
        {"id": "c5", "text": "Was spart Kraft?", "solve": {"any": ["f2"]}},
    ],
    "claims": [{"id": "k1", "text": "Ein Hebel erzeugt Energie.", "refutedBy": ["f1"]}],
}
LOESUNG = {"c1": ["f1", "f2"], "c2": ["f3"], "c3": ["f4"], "c4": ["f1"], "c5": ["f2"]}
BOSS = {"id": "boss1", "type": "boss", "title": "Der Hebel-Drache", "text": "Besiege ihn!", "challenge": SATZ,
        "spiele": ["boss", "karten"], "skin": "rap", "theme": "verlies", "codeFragment": "XY"}


def _spiel(boss=None):
    g = copy.deepcopy(SIMPLE_GAME)
    g["slides"] = [g["slides"][0], {**copy.deepcopy(BOSS), **(boss or {})},
                   {"id": "tuer", "type": "door", "text": "Tür"}]
    return g


def _fehler(client, token, boss):
    r = _upload(client, token, _spiel(boss))
    assert r.status_code == 422
    return r.json()["detail"]["errors"]


def _start(client, db, teacher_token, klass, boss=None):
    token, s, aid = _start_attempt(client, db, teacher_token, klass, _spiel(boss))
    client.cookies.clear()
    return token, s, aid


def _url(aid, was):
    return f"/api/exitgame-attempts/{aid}/boss/boss1/{was}"


def _antwort(client, token, aid, cid, fakten=None):
    return client.post(_url(aid, "antwort"), headers=_auth(token), json={
        "challenge_id": cid, "fakt_ids": LOESUNG[cid] if fakten is None else fakten, "lese_ms": 500, "wahl_ms": 3000})


# ── Prüfung ──────────────────────────────────────────────────────────

def test_upload_valid_boss(client, teacher_token):
    assert _upload(client, teacher_token, _spiel()).status_code == 201


def test_boss_needs_challenge(client, teacher_token):
    g = _spiel()
    del g["slides"][1]["challenge"]
    assert any("boss1" in e and "challenge" in e for e in _upload(client, teacher_token, g).json()["detail"]["errors"])


def test_boss_challenge_errors_are_prefixed(client, teacher_token):
    satz = {**SATZ, "challenges": [{"id": "c1", "text": "?", "solve": {"any": ["gibtsnicht"]}}]}
    assert any(e.startswith("Folie »boss1«: ") for e in _fehler(client, teacher_token, {"challenge": satz}))


def test_boss_invalid_options(client, teacher_token):
    for feld, wert in (("spiel", "quatsch"), ("skin", "drache"), ("theme", "neon"), ("startstufe", 5),
                       ("spiele", ["boss", "quatsch"]), ("codeFragment", " ")):
        assert any(feld in e for e in _fehler(client, teacher_token, {feld: wert})), feld


def test_boss_gericht_needs_claims(client, teacher_token):
    ohne = {k: v for k, v in SATZ.items() if k != "claims"}
    assert any("gericht" in e for e in _fehler(client, teacher_token, {"challenge": ohne, "spiele": ["boss", "gericht"]}))
    assert _upload(client, teacher_token, _spiel({"spiele": ["boss", "gericht"]})).status_code == 201


# ── Spielerdaten ─────────────────────────────────────────────────────

def test_start_sends_boss_without_solutions(client, db, teacher_token, klass):
    token, s, aid = _start(client, db, teacher_token, klass)
    r = client.post(f"/api/exitgame-sessions/{s['join_code']}/attempts", headers=_auth(token))
    boss = next(sl for sl in r.json()["exitgame_data"]["slides"] if sl["id"] == "boss1")
    assert "challenge" not in boss
    assert boss["bossFragment"] is True and boss["spiele"] == ["boss", "karten"]
    assert (boss["spiel"], boss["skin"], boss["theme"]) == ("boss", "rap", "verlies")
    for verboten in ("refutedBy", "claims", "\"solve\"", "decoy", "Langer Kraftarm"):
        assert verboten not in r.text
    assert r.json()["code_fragments"][0]["earned"] is False


# ── Lauf ─────────────────────────────────────────────────────────────

def test_start_antwort_and_finish_solves_slide_and_opens_door(client, db, teacher_token, klass):
    token, s, aid = _start(client, db, teacher_token, klass)
    r = client.post(_url(aid, "start"), headers=_auth(token), json={"spiel": "karten"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert (b["spiel"], b["skin"], b["theme"], b["spiele"]) == ("karten", "rap", "verlies", ["boss", "karten"])
    assert b["stufe"] == 2 and len(b["challenges"]) == 5
    assert "solve" not in str(b)
    assert client.post(_url(aid, "start"), headers=_auth(token), json={"spiel": "turm"}).json()["spiel"] == "karten"  # ungueltige Wahl: bleibt

    r = client.post(_url(aid, "deck"), headers=_auth(token), json={"fakt_ids": ["f1", "f2", "f3", "f4"]})
    assert r.status_code == 200 and r.json()["deck"] == ["f1", "f2", "f3", "f4"]

    for cid in ("c1", "c2", "c3", "c4"):
        r = _antwort(client, token, aid, cid)
        assert r.status_code == 200 and r.json()["komplett"] and not r.json()["fertig"]
    assert not _antwort(client, token, aid, "c5", ["f3"]).json()["komplett"]
    fertig = _antwort(client, token, aid, "c5").json()
    assert fertig["fertig"] and fertig["attempt"]["solved_slide_ids"] == ["boss1"]
    assert fertig["code_fragments"][0]["earned"] and fertig["code_fragments"][0]["fragment"] == "XY"

    r = client.post(f"/api/exitgame-attempts/{aid}/events", headers=_auth(token),
                    json={"slide_id": "tuer", "action": "code", "payload": {"code": "xy"}})
    assert r.json()["correct"] is True
    assert _antwort(client, token, aid, "c1").status_code == 409  # schon fertig
    ev = {e.event_type for e in db.query(ExitGameEvent).filter_by(attempt_id=aid)}
    assert {"boss_answer", "success"} <= ev


def test_wrong_answer_counts_error(client, db, teacher_token, klass):
    token, s, aid = _start(client, db, teacher_token, klass)
    client.post(_url(aid, "start"), headers=_auth(token), json={})
    r = _antwort(client, token, aid, "c2", ["x1"])
    assert r.json()["attempt"]["errors_total"] == 1


def test_boss_rejects_other_players_and_unknown_slides(client, db, teacher_token, klass):
    token, s, aid = _start(client, db, teacher_token, klass)
    fremd = _student_login(client, db, klass, username="s.fremd")
    client.cookies.clear()
    assert client.post(_url(aid, "start"), headers=_auth(fremd), json={}).status_code == 404
    assert client.post(f"/api/exitgame-attempts/{aid}/boss/intro/start", headers=_auth(token), json={}).status_code == 404
    assert client.post(f"/api/exitgame-attempts/{aid}/boss/nix/start", headers=_auth(token), json={}).status_code == 404


def test_boss_slide_rejects_plain_answer(client, db, teacher_token, klass):
    token, s, aid = _start(client, db, teacher_token, klass)
    r = client.post(f"/api/exitgame-attempts/{aid}/events", headers=_auth(token),
                    json={"slide_id": "boss1", "action": "answer", "payload": {"task_index": 0, "answer": "x"}})
    assert r.status_code == 400


# ── Bericht ──────────────────────────────────────────────────────────

def test_report_has_boss_ergebnis(client, db, teacher_token, klass):
    token, s, aid = _start(client, db, teacher_token, klass)
    client.post(_url(aid, "start"), headers=_auth(token), json={})
    for cid in LOESUNG:
        _antwort(client, token, aid, cid)
    client.cookies.clear()
    rows = client.get(f"/api/exitgame-sessions/{s['join_code']}/report", headers=_auth(teacher_token)).json()["attempts"]
    assert 0 < rows[0]["boss_ergebnis"] <= 1
    client.cookies.clear()
    csv = client.get(f"/api/exitgame-sessions/{s['join_code']}/report?fmt=csv", headers=_auth(teacher_token)).text
    assert "Boss-Ergebnis" in csv


# ── Vorlagen ─────────────────────────────────────────────────────────

def test_templates_contain_valid_boss_slides(client, teacher_token):
    for pfad in ("template", "template-interaktiv"):
        tpl = client.get(f"/api/exitgames/{pfad}", headers=_auth(teacher_token)).json()
        bosse = [s for s in tpl["slides"] if s["type"] == "boss"]
        assert bosse, pfad
        for b in bosse:
            fehler, _ = eng.pruefe_satz({"title": "Boss", **b["challenge"]})
            assert not fehler, fehler
        assert "boss" in tpl["_ai_instructions"]
        assert _upload(client, teacher_token, tpl).status_code == 201
