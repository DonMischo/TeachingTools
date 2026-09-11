"""Umfrage v2: Folien (Slides), Aussagen-Bloecke, Folgefragen (show_if),
Mehrfachauswahl (multi) und Zahl-Fragen (number), Smiley-Skalen.

Builds on the v1 conventions from test_barometer_features.py /
test_barometer_live.py: bearer headers via create_access_token, guest tokens,
`connect_ws` sharing one event loop, `baro.mgr.clear()` autouse fixture,
seeding sessions/questions directly via the `db` fixture.

None of the new model columns (`same_slide`, `block`, `intro`, `show_if`,
`scale_style`, `max_choices`, `num_min`, `num_max`, `unit`, response
`number`/`choices`) exist yet, so tests that seed them via BarometerQuestion/
BarometerResponse kwargs are expected to fail at construction (TypeError) —
that is the point of this red phase. REST tests fail because the new
QuestionIn/QuestionOut fields and validation rules don't exist yet.
"""
import asyncio
import io
import json

import pytest

from api.auth import create_access_token, create_guest_token
from api.main import app
from api.models import BarometerQuestion, BarometerResponse, BarometerSession, Teacher
import api.routers.barometer as baro
from api.tests.conftest import auth
from api.tests.ws_test_helper import bearer_headers, connect_ws

PREFIX = "/api/barometer"


@pytest.fixture(autouse=True)
def clear_ws_state():
    baro.mgr.clear()
    yield
    baro.mgr.clear()


def head(t: Teacher) -> dict:
    return auth(create_access_token({"sub": str(t.id), "type": "teacher"}))


def _create(client, teacher: Teacher, payload: dict):
    client.cookies.clear()
    return client.post(PREFIX, headers=head(teacher), json=payload)


def _upload(client, teacher: Teacher, payload: dict):
    client.cookies.clear()
    return client.post(
        f"{PREFIX}/upload",
        files={"file": ("umfrage.json", io.BytesIO(json.dumps(payload).encode()), "application/json")},
        headers=head(teacher),
    )


# ---------------------------------------------------------------------------
# REST: create round-trips
# ---------------------------------------------------------------------------

def test_multi_frage_mit_max_choices_kommt_unveraendert_zurueck(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Welche Faecher magst du?", "kind": "multi",
         "options": ["Mathe", "Deutsch", "Sport"], "max_choices": 2},
    ]})
    assert r.status_code == 201, r.text
    q = r.json()["questions"][0]
    assert q["kind"] == "multi"
    assert q["options"] == ["Mathe", "Deutsch", "Sport"]
    assert q["max_choices"] == 2


def test_number_frage_mit_grenzen_und_einheit_kommt_unveraendert_zurueck(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Wie viele Stunden lernst du pro Woche?", "kind": "number",
         "num_min": 0, "num_max": 40, "unit": "Stunden"},
    ]})
    assert r.status_code == 201, r.text
    q = r.json()["questions"][0]
    assert q["kind"] == "number"
    assert q["num_min"] == 0
    assert q["num_max"] == 40
    assert q["unit"] == "Stunden"


def test_skala_mit_smiley_stil_kommt_unveraendert_zurueck(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Wie fühlst du dich?", "kind": "scale", "scale_min": 1, "scale_max": 5,
         "scale_style": "smileys_auf"},
    ]})
    assert r.status_code == 201, r.text
    assert r.json()["questions"][0]["scale_style"] == "smileys_auf"


def test_aussagen_block_setzt_intro_same_slide_und_uebernimmt_chart(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Ich fühle mich wohl.", "kind": "scale", "scale_min": 1, "scale_max": 6,
         "block": "b1", "intro": "Wie geht es dir in der Klasse?", "chart": "likert",
         "same_slide": True},
        {"text": "Ich werde ernst genommen.", "kind": "scale", "scale_min": 1, "scale_max": 6,
         "block": "b1", "same_slide": False},
    ]})
    assert r.status_code == 201, r.text
    q0, q1 = r.json()["questions"]
    # first question is never same_slide (it opens the first slide)
    assert q0["same_slide"] is False
    assert q0["intro"] == "Wie geht es dir in der Klasse?"
    assert q0["block"] == "b1"
    # block members after the first are always on the same slide, regardless of what was sent
    assert q1["same_slide"] is True
    # chart given only on the first member is copied to the rest of the block
    assert q1["chart"] == "likert"
    assert q1["block"] == "b1"


def test_show_if_kommt_unveraendert_zurueck(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Warst du zufrieden?", "kind": "choice", "options": ["Ja", "Nein"]},
        {"text": "Warum nicht?", "kind": "text",
         "show_if": {"question": 0, "options": [1]}},
    ]})
    assert r.status_code == 201, r.text
    q1 = r.json()["questions"][1]
    assert q1["show_if"] == {"question": 0, "options": [1]}


# ---------------------------------------------------------------------------
# REST: validation (422)
# ---------------------------------------------------------------------------

def test_smiley_skala_mit_acht_stufen_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "scale", "scale_min": 1, "scale_max": 8, "scale_style": "smileys_auf"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[0].scale_style") and "Smileys gehen höchstens bis 7 Stufen" in e
               for e in errors)


def test_nicht_zusammenhaengender_block_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Aussage 1", "kind": "scale", "block": "b1"},
        {"text": "Andere Frage", "kind": "scale"},
        {"text": "Aussage 2", "kind": "scale", "block": "b1"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[") and "block" in e and "zusammenhängend" in e for e in errors)


def test_block_mitglied_vom_typ_choice_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Aussage 1", "kind": "scale", "block": "b1"},
        {"text": "Aussage 2", "kind": "choice", "options": ["Ja", "Nein"], "block": "b1"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[1].block") and "Skalenfragen" in e for e in errors)


def test_block_mitglied_mit_anderer_skala_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Aussage 1", "kind": "scale", "scale_min": 1, "scale_max": 6, "block": "b1"},
        {"text": "Aussage 2", "kind": "scale", "scale_min": 1, "scale_max": 5, "block": "b1"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[1].block") and "gleiche Skala wie die erste Aussage nötig" in e
               for e in errors)


def test_show_if_zeigt_auf_sich_selbst_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage 1", "kind": "choice", "options": ["Ja", "Nein"]},
        {"text": "Frage 2", "kind": "text", "show_if": {"question": 1, "options": [0]}},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[1].show_if") for e in errors)


def test_show_if_zeigt_auf_spaetere_frage_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage 1", "kind": "choice", "options": ["Ja", "Nein"], "show_if": {"question": 1, "options": [0]}},
        {"text": "Frage 2", "kind": "choice", "options": ["Ja", "Nein"]},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[0].show_if") for e in errors)


def test_show_if_eltern_frage_ist_text_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage 1", "kind": "text"},
        {"text": "Frage 2", "kind": "text", "show_if": {"question": 0, "options": [0]}},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[1].show_if") for e in errors)


def test_show_if_option_ausserhalb_bereich_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage 1", "kind": "choice", "options": ["Ja", "Nein"]},
        {"text": "Frage 2", "kind": "text", "show_if": {"question": 0, "options": [5]}},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[1].show_if") for e in errors)


def test_multi_max_choices_groesser_als_optionen_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "multi", "options": ["A", "B"], "max_choices": 3},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[0].max_choices") for e in errors)


def test_number_min_groesser_gleich_max_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "number", "num_min": 5, "num_max": 5},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[0].num_min") for e in errors)


def test_einheit_zu_lang_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "number", "unit": "x" * 21},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[0].unit") for e in errors)


def test_block_mitglied_mit_balken_chart_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Aussage 1", "kind": "scale", "block": "b1"},
        {"text": "Aussage 2", "kind": "scale", "block": "b1", "chart": "balken"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(".chart" in e for e in errors)


# ---------------------------------------------------------------------------
# REST: PATCH chart on block members
# ---------------------------------------------------------------------------

def test_chart_auf_block_mitglied_aendert_alle_mitglieder(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Aussage 1", "kind": "scale", "block": "b1"},
        {"text": "Aussage 2", "kind": "scale", "block": "b1"},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    q0, q1 = r.json()["questions"]

    ok = client.patch(f"{PREFIX}/{code}/questions/{q0['id']}/chart", headers=head(teacher),
                       json={"chart": "mittelwerte"})
    assert ok.status_code == 200, ok.text

    got = client.get(f"{PREFIX}/{code}", headers=head(teacher))
    for q in got.json()["questions"]:
        assert q["chart"] == "mittelwerte"


def test_balken_chart_auf_block_mitglied_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Aussage 1", "kind": "scale", "block": "b1"},
        {"text": "Aussage 2", "kind": "scale", "block": "b1"},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    q0 = r.json()["questions"][0]
    bad = client.patch(f"{PREFIX}/{code}/questions/{q0['id']}/chart", headers=head(teacher), json={"chart": "balken"})
    assert bad.status_code == 422


# ---------------------------------------------------------------------------
# REST: template
# ---------------------------------------------------------------------------

def test_template_enthaelt_neue_frageareten_und_laedt_sich_selbst_hoch(client, teacher):
    client.cookies.clear()
    tpl_resp = client.get(f"{PREFIX}/template", headers=head(teacher))
    assert tpl_resp.status_code == 200
    tpl = tpl_resp.json()
    kinds = [q.get("kind", "scale") for q in tpl["questions"]]
    assert "multi" in kinds
    assert "number" in kinds
    assert any(q.get("block") for q in tpl["questions"])
    assert any(q.get("show_if") for q in tpl["questions"])

    up = _upload(client, teacher, tpl)
    assert up.status_code == 201, up.text
    assert len(up.json()["questions"]) == len(tpl["questions"])


# ---------------------------------------------------------------------------
# REST: export
# ---------------------------------------------------------------------------

def test_export_slide_indices_fuer_gleiche_folie(client, db, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage 1", "kind": "scale"},
        {"text": "Frage 2", "kind": "multi", "options": ["A", "B", "C"], "same_slide": True},
        {"text": "Frage 3", "kind": "number", "num_min": 0, "num_max": 10},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]

    exp = client.get(f"{PREFIX}/{code}/export", headers=head(teacher))
    assert exp.status_code == 200, exp.text
    by_order = {q["order"]: q for q in exp.json()["questions"]}
    assert by_order[0]["slide"] == 0
    assert by_order[1]["slide"] == 0
    assert by_order[2]["slide"] == 1


def test_export_multi_verteilung_nach_label_zaehlt_teilnehmer(client, db, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Faecher?", "kind": "multi", "options": ["A", "B", "C"]},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    qid = r.json()["questions"][0]["id"]
    s = db.query(BarometerSession).filter_by(code=code).one()
    db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id="g-1", choices=[0, 1]))
    db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id="g-2", choices=[1]))
    db.flush()

    exp = client.get(f"{PREFIX}/{code}/export", headers=head(teacher))
    assert exp.status_code == 200, exp.text
    q = exp.json()["questions"][0]
    assert q["distribution"] == {"A": 1, "B": 2, "C": 0}
    assert q["count"] == 2


def test_export_number_kennzahlen(client, db, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Wie viele Stunden?", "kind": "number", "num_min": 0, "num_max": 20},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    qid = r.json()["questions"][0]["id"]
    s = db.query(BarometerSession).filter_by(code=code).one()
    for i, val in enumerate([2, 4, 6]):
        db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id=f"g-{i}", number=val))
    db.flush()

    exp = client.get(f"{PREFIX}/{code}/export", headers=head(teacher))
    assert exp.status_code == 200, exp.text
    q = exp.json()["questions"][0]
    assert q["count"] == 3
    assert q["mean"] == 4.0
    assert q["median"] == 4
    assert q["min"] == 2
    assert q["max"] == 6
    assert "distribution" not in q


def test_export_respondent_multi_antwort_ist_liste_von_labels(client, db, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Faecher?", "kind": "multi", "options": ["A", "B", "C"]},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    qid = r.json()["questions"][0]["id"]
    s = db.query(BarometerSession).filter_by(code=code).one()
    db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id="g-1", choices=[0, 2]))
    db.flush()

    exp = client.get(f"{PREFIX}/{code}/export", headers=head(teacher))
    assert exp.status_code == 200, exp.text
    respondent = exp.json()["respondents"][0]
    assert respondent["answers"][str(qid)] == ["A", "C"]


# ---------------------------------------------------------------------------
# REST: public-results
# ---------------------------------------------------------------------------

def test_public_results_enthaelt_multi_und_number_verteilung_und_nie_freitext(client, db, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Faecher?", "kind": "multi", "options": ["A", "B"]},
        {"text": "Stunden?", "kind": "number", "num_min": 0, "num_max": 10},
        {"text": "Kommentar?", "kind": "text"},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    multi_qid, number_qid, text_qid = (q["id"] for q in r.json()["questions"])
    s = db.query(BarometerSession).filter_by(code=code).one()
    db.add(BarometerResponse(session_id=s.id, question_id=multi_qid, student_id=None, guest_id="g-1", choices=[0]))
    db.add(BarometerResponse(session_id=s.id, question_id=number_qid, student_id=None, guest_id="g-1", number=5))
    db.add(BarometerResponse(session_id=s.id, question_id=text_qid, student_id=None, guest_id="g-1",
                              text="Geheimer Freitext"))
    db.flush()

    client.patch(f"{PREFIX}/{code}/results-public", headers=head(teacher), json={"public": True})

    client.cookies.clear()
    pub = client.get(f"{PREFIX}/{code}/public-results")
    assert pub.status_code == 200, pub.text
    assert "Geheimer Freitext" not in pub.text
    by_id = {q["id"]: q for q in pub.json()["questions"]}
    # Wie im Live-Kanal nach Options-Index — die Ergebnisseite beschriftet selbst.
    assert by_id[multi_qid]["distribution"] == {"0": 1}
    assert by_id[number_qid]["distribution"] == {"5": 1}


# ---------------------------------------------------------------------------
# REST: analysis prompt for a follow-up
# ---------------------------------------------------------------------------

def test_analysis_prompt_fuer_folgefrage_enthaelt_elternfragetext(client, db, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Warst du zufrieden?", "kind": "choice", "options": ["Ja", "Nein"]},
        {"text": "Warum nicht?", "kind": "text", "show_if": {"question": 0, "options": [1]}},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]

    resp = client.get(f"{PREFIX}/{code}/analysis-prompt", headers=head(teacher))
    assert resp.status_code == 200, resp.text
    prompt = resp.json()["prompt"]
    assert "Warst du zufrieden?" in prompt
    assert "Folgefrage" in prompt


# ---------------------------------------------------------------------------
# WebSocket helpers
# ---------------------------------------------------------------------------

def _scope(code: str, query: str, headers=None) -> dict:
    path = f"{PREFIX}/{code}/ws"
    return {
        "type": "websocket",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "scheme": "ws",
        "query_string": query.encode(),
        "headers": headers or [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8000),
        "subprotocols": [],
    }


def _gast(code: str, name: str, token: str | None = None) -> dict:
    return _scope(code, f"role=student&guest_token={token or create_guest_token(code, name)}")


def _make_session(db, teacher, code: str, questions: list[dict], mode: str = "live") -> BarometerSession:
    """Seed a session + its v2 questions directly. Any of the new kwargs
    (same_slide, block, intro, show_if, scale_style, max_choices, num_min,
    num_max, unit) raise a TypeError until the model has those columns —
    that is the expected red-phase failure for tests using them."""
    s = BarometerSession(code=code, title="Umfrage", created_by=teacher.id, allow_guests=True, mode=mode)
    db.add(s)
    db.flush()
    for i, kwargs in enumerate(questions):
        db.add(BarometerQuestion(session_id=s.id, order=i, **kwargs))
    db.flush()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# WebSocket: slides
# ---------------------------------------------------------------------------

def test_show_slide_sendet_zwei_fragen_fuer_gemeinsame_folie(client, db, teacher):
    code = "FOL0001"
    s = _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale"},
        {"text": "Frage 2", "kind": "scale", "same_slide": True},
        {"text": "Frage 3", "kind": "scale"},
    ])
    qid0, qid1 = s.questions[0].id, s.questions[1].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined

                await host.send_json({"action": "show_slide", "index": 0})
                msg = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert msg["event"] == "slide"
                assert msg["index"] == 0
                assert msg["total"] == 2
                assert [q["id"] for q in msg["questions"]] == [qid0, qid1]
    asyncio.run(run())


def test_show_results_sendet_ergebnisse_fuer_beide_fragen_der_folie_ohne_texte(client, db, teacher):
    code = "FOL0002"
    s = _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale", "scale_min": 1, "scale_max": 5},
        {"text": "Frage 2", "kind": "scale", "scale_min": 1, "scale_max": 5, "same_slide": True},
    ])
    qid0, qid1 = s.questions[0].id, s.questions[1].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                await host.send_json({"action": "show_slide", "index": 0})
                await ada.receive_json()  # slide
                await host.receive_json()  # slide

                await host.send_json({"action": "show_results"})
                results = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert results["event"] == "results"
                assert set(results["results"].keys()) == {str(qid0), str(qid1)}
                for entry in results["results"].values():
                    assert "texts" not in entry
    asyncio.run(run())


def test_legacy_show_question_funktioniert_weiterhin(client, db, teacher):
    code = "FOL0003"
    _make_session(db, teacher, code, [{"text": "Frage 1", "kind": "scale"}])

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                await host.send_json({"action": "show_question", "index": 0})
                msg = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert msg["event"] == "slide"
    asyncio.run(run())


def test_student_state_hat_current_slide_total_slides_my_answers(client, db, teacher):
    code = "FOL0004"
    _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale"},
        {"text": "Frage 2", "kind": "scale", "same_slide": True},
        {"text": "Frage 3", "kind": "scale"},
    ])

    async def run():
        async with connect_ws(app, _gast(code, "Ada")) as ada:
            state = await ada.receive_json()
            assert state["event"] == "state"
            assert state["current_slide"] == -1
            assert state["total_slides"] == 2
            assert state["my_answers"] == {}
    asyncio.run(run())


def test_live_modus_submit_speichert_nur_antworten_der_aktuellen_folie(client, db, teacher):
    code = "FOL0005"
    s = _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale", "scale_min": 1, "scale_max": 5},
        {"text": "Frage 2", "kind": "scale", "scale_min": 1, "scale_max": 5, "same_slide": True},
        {"text": "Frage 3", "kind": "scale", "scale_min": 1, "scale_max": 5},
    ])
    qid0, qid1, qid2 = (q.id for q in s.questions)

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                await host.send_json({"action": "show_slide", "index": 0})
                await ada.receive_json()  # slide
                await host.receive_json()  # slide

                await ada.send_json({"action": "submit", "answers": [
                    {"question_id": qid0, "value": 3},
                    {"question_id": qid1, "value": 4},
                    {"question_id": qid2, "value": 5},
                ]})
                submitted = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert submitted["event"] == "submitted"
                assert submitted["my_answers"] == {str(qid0): 3, str(qid1): 4}
                assert str(qid2) not in submitted["my_answers"]
    asyncio.run(run())


# ---------------------------------------------------------------------------
# WebSocket: multi
# ---------------------------------------------------------------------------

def test_multi_gueltige_auswahl_wird_gespeichert_ungueltige_nicht(client, db, teacher):
    code = "FOL0006"
    s = _make_session(db, teacher, code, [
        {"text": "Faecher?", "kind": "multi", "options": ["A", "B", "C"], "max_choices": 2},
    ])
    qid = s.questions[0].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined

                # too many choices (> max_choices)
                await ada.send_json({"action": "respond", "question_id": qid, "choices": [0, 1, 2]})
                # duplicate choices
                await ada.send_json({"action": "respond", "question_id": qid, "choices": [0, 0]})
                # valid
                await ada.send_json({"action": "respond", "question_id": qid, "choices": [0, 1]})

                update = await asyncio.wait_for(host.receive_json(), timeout=2)
                assert update["event"] == "response_update"
                assert update["distribution"] == {"0": 1, "1": 1}
                assert update["count"] == 1

                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(host.receive_json(), timeout=0.3)
    asyncio.run(run())


# ---------------------------------------------------------------------------
# WebSocket: number
# ---------------------------------------------------------------------------

def test_number_dezimalwert_wird_gespeichert_wert_ausserhalb_grenzen_nicht(client, db, teacher):
    code = "FOL0007"
    s = _make_session(db, teacher, code, [
        {"text": "Wie viele Stunden?", "kind": "number", "num_min": 0, "num_max": 10},
    ])
    qid = s.questions[0].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined

                await ada.send_json({"action": "respond", "question_id": qid, "value": 999})  # outside bounds
                await ada.send_json({"action": "respond", "question_id": qid, "value": 1.5})

                update = await asyncio.wait_for(host.receive_json(), timeout=2)
                assert update["event"] == "response_update"
                assert update["distribution"] == {"1.5": 1}

                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(host.receive_json(), timeout=0.3)
    asyncio.run(run())


# ---------------------------------------------------------------------------
# WebSocket: follow-up (show_if)
# ---------------------------------------------------------------------------

def test_folgefrage_wird_nur_gespeichert_wenn_eltern_passt_und_bei_aenderung_geloescht(client, db, teacher):
    code = "FOL0008"
    s = _make_session(db, teacher, code, [
        {"text": "Warst du zufrieden?", "kind": "choice", "options": ["Ja", "Nein"]},
        {"text": "Warum nicht?", "kind": "text", "show_if": {"question": 0, "options": [1]}},
    ])
    parent_qid, followup_qid = (q.id for q in s.questions)

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined

                # follow-up while parent is still unanswered -> ignored, nothing sent
                await ada.send_json({"action": "respond", "question_id": followup_qid, "text": "Zu langweilig"})
                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(host.receive_json(), timeout=0.3)

                # answer parent with the non-matching option ("Ja", index 0)
                await ada.send_json({"action": "respond", "question_id": parent_qid, "value": 0})
                parent_update = await asyncio.wait_for(host.receive_json(), timeout=2)
                assert parent_update["question_id"] == parent_qid
                await asyncio.wait_for(ada.receive_json(), timeout=2)  # response_ack der Elternfrage

                # follow-up still doesn't match parent -> ignored
                await ada.send_json({"action": "respond", "question_id": followup_qid, "text": "Zu langweilig"})
                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(host.receive_json(), timeout=0.3)

                # answer parent with the matching option ("Nein", index 1)
                await ada.send_json({"action": "respond", "question_id": parent_qid, "value": 1})
                await asyncio.wait_for(host.receive_json(), timeout=2)  # response_update for parent
                await asyncio.wait_for(ada.receive_json(), timeout=2)  # response_ack der Elternfrage

                # follow-up now matches -> saved
                await ada.send_json({"action": "respond", "question_id": followup_qid, "text": "Zu langweilig"})
                followup_update = await asyncio.wait_for(host.receive_json(), timeout=2)
                assert followup_update["question_id"] == followup_qid
                followup_ack = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert followup_ack["event"] == "response_ack"
                assert followup_ack["my_answers"][str(followup_qid)] == "Zu langweilig"

                # re-answer parent with a non-matching option -> prunes the follow-up response
                await ada.send_json({"action": "respond", "question_id": parent_qid, "value": 0})
                prune_ack = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert prune_ack["event"] == "response_ack"
                assert prune_ack["question_id"] == parent_qid
                assert str(followup_qid) not in prune_ack["my_answers"]

                seen = {}
                for _ in range(2):
                    upd = await asyncio.wait_for(host.receive_json(), timeout=2)
                    seen[upd["question_id"]] = upd
                assert parent_qid in seen
                assert followup_qid in seen
                assert seen[followup_qid]["count"] == 0
    asyncio.run(run())


def test_erneutes_absenden_ohne_eine_antwort_zieht_die_alte_zurueck(client, db, teacher):
    """»Antworten ändern«: wer ein Feld leert und neu absendet, hat die alte
    Antwort zurückgezogen — sonst bliebe der gelöschte Freitext gespeichert."""
    code = "FOL0009"
    s = _make_session(db, teacher, code, [
        {"text": "Kommentar?", "kind": "text"},
        {"text": "Note?", "kind": "scale", "scale_min": 1, "scale_max": 6},
    ], mode="self")
    text_qid, scale_qid = (q.id for q in s.questions)

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                await ada.send_json({"action": "submit", "answers": [
                    {"question_id": text_qid, "text": "Alles gut"},
                    {"question_id": scale_qid, "value": 2},
                ]})
                await asyncio.wait_for(ada.receive_json(), timeout=2)  # submitted
                for _ in range(2):
                    await asyncio.wait_for(host.receive_json(), timeout=2)  # response_update

                await ada.send_json({"action": "submit", "answers": [{"question_id": scale_qid, "value": 3}]})
                submitted = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert submitted["my_answers"] == {str(scale_qid): 3}

                seen = {}
                for _ in range(2):
                    upd = await asyncio.wait_for(host.receive_json(), timeout=2)
                    seen[upd["question_id"]] = upd
                assert seen[text_qid]["count"] == 0
                assert seen[scale_qid]["distribution"] == {"3": 1}
    asyncio.run(run())
