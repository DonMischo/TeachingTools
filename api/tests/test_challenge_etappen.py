"""Challenge: Fakten-Auswahl je Etappe (höchstens 12, nötige immer dabei) und gemischte Etappen-Reihenfolge."""
import json
from pathlib import Path

import pytest

from api import challenge_engine as eng
from api import challenge_lauf as lauf_logik
from api.routers.challenge import vorlage

BEISPIEL = json.loads((Path(__file__).resolve().parents[2] / "data/challenge_examples/Geschichte_der_Medien.json")
                      .read_text(encoding="utf-8"))
SAETZE = {"beispiel": BEISPIEL, "vorlage": vorlage(None)}


def _loesung(c):
    return next(iter(c["solve"].values()))


@pytest.mark.parametrize("name", SAETZE)
@pytest.mark.parametrize("stufe", [1, 2, 3, 4])
def test_fakten_hoechstens_zwoelf_nötige_immer_dabei(name, stufe):
    daten = SAETZE[name]
    lauf = lauf_logik.neuer_lauf(daten, stufe, seed=7)
    satz = eng.satz_fuer_stufe(daten, stufe)
    for nr in eng.etappen(satz):
        lauf["zustand"]["etappe"] = nr
        b = lauf_logik.brett(daten, lauf)
        ids = {f["id"] for f in b["fakten"]}
        noetig = set(eng.benoetigte_fakten([c for c in satz["challenges"] if c.get("stage", 1) == nr]))
        assert noetig <= ids
        assert len(ids) == len(b["fakten"]) <= max(eng.MAX_FAKTEN_JE_ETAPPE, len(noetig))


def test_brett_nennt_anzahl_noetiger_fakten():
    """»all« braucht jeden gelisteten Fakt, »any« genau einen."""
    daten = vorlage(None)
    lauf = lauf_logik.neuer_lauf(daten, 2, seed=7)
    satz = {c["id"]: c for c in eng.satz_fuer_stufe(daten, 2)["challenges"]}
    for c in lauf_logik.brett(daten, lauf)["challenges"]:
        solve = satz[c["id"]]["solve"]
        assert c["noetig"] == (len(solve["all"]) if "all" in solve else 1)


def test_ablenker_zuerst_decoys_und_deterministisch():
    daten = BEISPIEL
    b1 = lauf_logik.brett(daten, lauf_logik.neuer_lauf(daten, 2, seed=3))
    b2 = lauf_logik.brett(daten, lauf_logik.neuer_lauf(daten, 2, seed=3))
    assert [f["id"] for f in b1["fakten"]] == [f["id"] for f in b2["fakten"]]
    satz = eng.satz_fuer_stufe(daten, 2)
    noetig = set(eng.benoetigte_fakten([c for c in satz["challenges"] if c.get("stage", 1) == b1["etappe"]]))
    decoys = {f["id"] for f in satz["facts"] if f.get("decoy")}
    extra = {f["id"] for f in b1["fakten"]} - noetig
    assert len(extra) == min(eng.MAX_FAKTEN_JE_ETAPPE - len(noetig), 2)  # Stufe 2: zwei Ablenker
    assert extra <= decoys


def test_zu_viele_nötige_fakten_bleiben_ohne_ablenker():
    fakten = [{"id": f"f{i}", "text": f"Fakt {i}"} for i in range(14)] + [{"id": "x", "text": "x", "decoy": True}]
    daten = {"title": "t", "facts": fakten, "challenges": [
        {"id": "c1", "text": "a", "solve": {"all": [f"f{i}" for i in range(14)]}}]}
    b = lauf_logik.brett(daten, lauf_logik.neuer_lauf(daten, 4, seed=1))
    assert len(b["fakten"]) == 14 and "x" not in {f["id"] for f in b["fakten"]}
    assert any("14 Fakten" in w for w in eng.pruefe_satz(daten)[1])


def _gewinne(daten, lauf):
    satz = lauf_logik._satz(daten, lauf)
    besucht = []
    while not lauf["fertig"]:
        b = lauf_logik.brett(daten, lauf)
        if not besucht or besucht[-1] != b["etappe"]:
            besucht.append(b["etappe"])
        c = next(c for c in b["challenges"] if not c["erledigt"])
        loesung = _loesung(next(x for x in satz["challenges"] if x["id"] == c["id"]))
        lauf_logik.antworte(daten, lauf, c["id"], loesung, 5000, 5000, False)
    return besucht


def test_gemischte_reihenfolge_ist_permutation_stabil_und_gewinn_erst_am_ende():
    daten = BEISPIEL
    lauf = lauf_logik.neuer_lauf(daten, 2, seed=4, mischen=True)
    reihe = lauf["zustand"]["reihenfolge"]
    assert sorted(reihe) == eng.etappen(lauf_logik._satz(daten, lauf)) and reihe != sorted(reihe)
    b = lauf_logik.brett(daten, lauf)
    assert [e["nr"] for e in b["etappen"]] == reihe == [e["nr"] for e in lauf_logik.brett(daten, lauf)["etappen"]]
    assert b["etappe"] == reihe[0] and b["gesamt_etappen"] == len(reihe) and b["geschafft_etappen"] == 0
    assert _gewinne(daten, lauf) == reihe
    assert lauf["fertig"] and lauf_logik.brett(daten, lauf)["geschafft_etappen"] == len(reihe)


def test_ohne_mischen_aufsteigend():
    lauf = lauf_logik.neuer_lauf(BEISPIEL, 2, seed=11)
    assert "reihenfolge" not in lauf["zustand"]
    assert _gewinne(BEISPIEL, lauf) == eng.etappen(BEISPIEL)


def test_nicht_fertig_nach_erster_etappe():
    daten = BEISPIEL
    lauf = lauf_logik.neuer_lauf(daten, 2, seed=4, mischen=True)
    satz = lauf_logik._satz(daten, lauf)
    erste = lauf["zustand"]["reihenfolge"][0]
    for c in [c for c in satz["challenges"] if c.get("stage", 1) == erste]:
        lauf_logik.antworte(daten, lauf, c["id"], _loesung(c), 5000, 5000, False)
    assert not lauf["fertig"]
