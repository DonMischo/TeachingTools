"""Challenge-Engine: Prüfung des Satzes, Stufen-Merge, Bewertung, Wertung, Lesetempo, DDA-Stufe."""
import copy

import pytest

from api import challenge_engine as eng
from api import dda


def _satz():
    return {
        "title": "Hebelgesetz",
        "subject": "Physik",
        "stages": [{"id": 1, "title": "Der Hebel"}],
        "facts": [
            {"id": "f1", "text": "Kraft mal Kraftarm gleich Last mal Lastarm", "formula": "F_1 a_1 = F_2 a_2"},
            {"id": "f2", "text": "Ein langer Kraftarm spart Kraft"},
            {"id": "f3", "text": "Die Wippe ist ein zweiseitiger Hebel"},
            {"id": "f4", "text": "Die Schubkarre ist ein einseitiger Hebel"},
            {"id": "x1", "text": "Schwere Körper fallen schneller", "decoy": True},
            {"id": "x2", "text": "Ein Hebel erzeugt Energie", "decoy": True},
        ],
        "challenges": [
            {"id": "c1", "text": "Warum hebt eine Brechstange den Stein?", "solve": {"all": ["f1", "f2"]},
             "strength": 2, "stage": 1, "feedback": "Langer Kraftarm!", "tip": "Denk an den Kraftarm."},
            {"id": "c2", "text": "Welcher Hebel ist eine Wippe?", "solve": {"any": ["f3"]}},
            {"id": "c3", "text": "Welcher Hebel ist eine Schubkarre?", "solve": {"any": ["f4"]}},
            {"id": "c4", "text": "Wie lautet das Hebelgesetz?", "solve": {"any": ["f1"]}},
            {"id": "c5", "text": "Was spart Kraft?", "solve": {"any": ["f2"]}},
        ],
        "levels": {
            "1": {"facts": [{"id": "f1", "text": "Einfacher Text"}],
                  "challenges": [{"id": "c9", "text": "Neue leichte Frage", "solve": {"any": ["f3"]}}],
                  "omit": ["c2"]},
        },
    }


def _fehler(satz, assets=None):
    return eng.pruefe_satz(satz, assets)[0]


# ── pruefe_satz ──────────────────────────────────────────────────────

def test_gueltiger_satz_ohne_fehler_und_warnungen():
    assert eng.pruefe_satz(_satz()) == ([], [])


def test_titel_fehlt():
    s = _satz()
    s["title"] = "  "
    assert _fehler(s)
    del s["title"]
    assert _fehler(s)


def test_doppelte_ids():
    s = _satz()
    s["facts"].append({"id": "f1", "text": "doppelt"})
    assert _fehler(s)
    s = _satz()
    s["challenges"].append({"id": "c1", "text": "doppelt", "solve": {"any": ["f1"]}})
    assert _fehler(s)


def test_fakt_und_challenge_id_ueberschneiden_sich():
    s = _satz()
    s["facts"].append({"id": "c1", "text": "Kollision"})
    assert _fehler(s)


def test_solve_mit_beiden_oder_keinem_schluessel():
    s = _satz()
    s["challenges"][1]["solve"] = {"all": ["f3"], "any": ["f3"]}
    assert _fehler(s)
    s = _satz()
    s["challenges"][1]["solve"] = {}
    assert _fehler(s)
    s = _satz()
    s["challenges"][1]["solve"] = {"any": []}
    assert _fehler(s)


def test_solve_mit_unbekanntem_oder_ablenker_fakt():
    s = _satz()
    s["challenges"][1]["solve"] = {"any": ["gibtsnicht"]}
    assert _fehler(s)
    s = _satz()
    s["challenges"][1]["solve"] = {"all": ["f3", "x1"]}
    assert _fehler(s)


def test_text_pflicht():
    s = _satz()
    s["challenges"][0]["text"] = ""
    assert _fehler(s)
    s = _satz()
    s["facts"][0]["text"] = ""
    assert _fehler(s)


@pytest.mark.parametrize("strength", [0, 4, "2", 1.5])
def test_strength_ausserhalb_1_bis_3(strength):
    s = _satz()
    s["challenges"][0]["strength"] = strength
    assert _fehler(s)


def test_stage_muss_ganzzahl_ab_1_sein():
    s = _satz()
    s["challenges"][0]["stage"] = 0
    assert _fehler(s)


def test_levels_schluessel_nur_1_bis_4():
    s = _satz()
    s["levels"]["5"] = {}
    assert _fehler(s)
    s = _satz()
    s["levels"]["x"] = {}
    assert _fehler(s)


def test_stufe_mit_ungueltigem_merge_meldet_fehler_mit_praefix():
    s = _satz()
    s["levels"]["2"] = {"challenges": [{"id": "c2", "solve": {"any": ["gibtsnicht"]}}]}
    fehler = _fehler(s)
    assert fehler and all(f.startswith("Stufe 2: ") for f in fehler)


def test_warnung_bei_weniger_als_fuenf_challenges_je_etappe():
    s = _satz()
    s["levels"] = {}
    s["challenges"] = s["challenges"][:4]
    fehler, warnungen = eng.pruefe_satz(s)
    assert fehler == []
    assert warnungen


def test_bildwarnung_nur_mit_asset_liste():
    s = _satz()
    s["facts"][1]["image"] = "wippe.png"
    assert eng.pruefe_satz(s)[1] == []
    assert eng.pruefe_satz(s, set())[1]
    assert eng.pruefe_satz(s, {"wippe.png"})[1] == []


# ── satz_fuer_stufe / etappen ────────────────────────────────────────

def test_satz_fuer_stufe_ueberschreibt_ergaenzt_und_laesst_weg():
    s = _satz()
    original = copy.deepcopy(s)
    r = eng.satz_fuer_stufe(s, 1)
    assert "levels" not in r
    fakt = {f["id"]: f for f in r["facts"]}
    assert fakt["f1"]["text"] == "Einfacher Text"
    assert fakt["f2"]["text"] == s["facts"][1]["text"]
    ids = [c["id"] for c in r["challenges"]]
    assert "c9" in ids and "c2" not in ids
    assert s == original  # Eingabe bleibt unverändert


def test_satz_fuer_stufe_ohne_override_ist_basis():
    r = eng.satz_fuer_stufe(_satz(), 3)
    assert [c["id"] for c in r["challenges"]] == ["c1", "c2", "c3", "c4", "c5"]
    assert "levels" not in r


def test_etappen_sortiert_und_eindeutig():
    s = _satz()
    s["challenges"][0]["stage"] = 3
    s["challenges"][1]["stage"] = 2
    assert eng.etappen(s) == [1, 2, 3]


# ── bewerte ──────────────────────────────────────────────────────────

ALLE = {"id": "c1", "solve": {"all": ["f1", "f2"]}, "strength": 2}
ANY = {"id": "c2", "solve": {"any": ["f3"]}, "strength": 1}


def test_bewerte_kombo_komplett():
    r = eng.bewerte(ALLE, ["f1", "f2"])
    assert r["qualitaet"] == 1 and r["treffer"] and r["komplett"] and r["kombo"]
    assert r["schaden"] == 25 and r["falsch"] == []


def test_bewerte_teilweise():
    r = eng.bewerte(ALLE, ["f1"])
    assert r["qualitaet"] == 0.5 and r["treffer"] and not r["komplett"] and not r["kombo"]


def test_bewerte_malus_fuer_falsche():
    r = eng.bewerte(ALLE, ["f1", "x1"])
    assert r["qualitaet"] == 0.25 and r["falsch"] == ["x1"] and not r["komplett"]


def test_bewerte_nur_falsch():
    r = eng.bewerte(ALLE, ["x1"])
    assert r["qualitaet"] == 0 and not r["treffer"] and not r["komplett"]


def test_bewerte_any():
    r = eng.bewerte(ANY, ["f3"])
    assert r["qualitaet"] == 1 and r["komplett"] and not r["kombo"] and r["schaden"] == 10
    r = eng.bewerte(ANY, ["f3", "x1"])
    assert r["qualitaet"] == 0.5 and r["treffer"] and not r["komplett"]


def test_bewerte_leer_und_doppelte():
    assert eng.bewerte(ALLE, [])["qualitaet"] == 0
    assert eng.bewerte(ALLE, [])["treffer"] is False
    r = eng.bewerte(ALLE, ["f1", "f1", "f2", "f2"])
    assert r["qualitaet"] == 1 and r["komplett"]


def test_bewerte_netto_nie_negativ():
    assert eng.bewerte(ANY, ["x1", "x2", "x3"])["qualitaet"] == 0


# ── Wertung ──────────────────────────────────────────────────────────

def test_guete_zaehlt_jede_antwort():
    fragen = [{"c": "c1", "q": 0, "komplett": False}, {"c": "c1", "q": 1, "komplett": True},
              {"c": "c2", "q": 1, "komplett": True}]
    assert eng.guete(fragen) == pytest.approx(2 / 3)


def test_guete_leer_ist_null():
    assert eng.guete([]) == 0.0
    assert eng.ergebnis([], 5) == 0


def test_ergebnis_wiederholung_falsch_dann_zweimal_richtig():
    fragen = [{"c": "c1", "q": 0, "komplett": False}, {"c": "c1", "q": 1, "komplett": True},
              {"c": "c2", "q": 1, "komplett": True}]
    assert eng.ergebnis(fragen, 2) == round(2 / 3, 4)


def test_ergebnis_abdeckung():
    fragen = [{"c": "c1", "q": 1, "komplett": True}, {"c": "c2", "q": 1, "komplett": True}]
    assert eng.ergebnis(fragen, 4) == 0.5
    # verschiedene c zählen, Wiederholung derselben nicht
    fragen = [{"c": "c1", "q": 1, "komplett": True}, {"c": "c1", "q": 1, "komplett": True}]
    assert eng.ergebnis(fragen, 2) == 0.5


# ── Lesetempo ────────────────────────────────────────────────────────

def test_woerter():
    assert eng.woerter("Das ist  ein Test") == 4
    assert eng.woerter("") == 0


def test_lesetempo():
    assert eng.lesetempo(100, 60000) == pytest.approx(100)
    assert eng.lesetempo(50, 30000) == pytest.approx(100)
    assert eng.lesetempo(10, 0) is None


def test_geraten_unter_30_prozent_der_erwarteten_zeit():
    # Stufe 2: 110 Wörter/Min -> 110 Wörter erwarten 60 s; 30 % = 18 s
    assert eng.geraten(110, 17000, 2) is True
    assert eng.geraten(110, 19000, 2) is False
    assert eng.geraten(110, 60000, 2) is False


# ── neue_stufe ───────────────────────────────────────────────────────

def _verlauf(n, erfolg, zeit, stufe):
    return [{**dda.snapshot_from_task_metrics(erfolg, zeit, 0 if erfolg else 1, 0, 0), "stufe": stufe}
            for _ in range(n)]


def test_stufe_bleibt_bei_weniger_als_drei_snapshots():
    assert eng.neue_stufe(2, _verlauf(2, True, 3, 2)) == 2
    assert eng.neue_stufe(2, []) == 2


def test_schnell_und_richtig_wird_schwerer_um_hoechstens_eins():
    assert eng.neue_stufe(2, _verlauf(5, True, 3, 2)) == 3
    assert eng.neue_stufe(1, _verlauf(5, True, 3, 1)) == 2


def test_langsam_und_falsch_wird_leichter_um_hoechstens_eins():
    assert eng.neue_stufe(3, _verlauf(5, False, 40, 3)) == 2
    assert eng.neue_stufe(2, _verlauf(5, False, 40, 2)) == 1


def test_stufe_bleibt_zwischen_1_und_4():
    assert eng.neue_stufe(4, _verlauf(5, True, 3, 4)) == 4
    assert eng.neue_stufe(1, _verlauf(5, False, 40, 1)) == 1
