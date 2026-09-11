"""Umfrage (barometer) extensions: choice/text questions, live vs. self mode,
public results, export, and AI-assisted free-text analysis.

REST tests build on the create_session/upload JSON conventions from
test_barometer_upload.py. WS tests follow test_barometer_live.py: connections
share one event loop via ws_test_helper so cross-socket broadcasts really
happen; guests join via a signed guest token, students never appear (the
spec keeps everything anonymous).

Several tests write directly to columns (`kind`, `options`, `chart`,
`analysis`, response `text`) that don't exist in the schema yet. Those are
expected to fail with a construction/DB error rather than an assertion —
that is the point of this red phase.
"""
import asyncio
import io
import json

import pytest
from sqlalchemy import text as sql_text

from api.auth import create_access_token, create_guest_token, hash_password
from api.main import app
from api.models import BarometerQuestion, BarometerResponse, BarometerSession, Student, Teacher
import api.routers.barometer as baro
from api.tests.conftest import auth
from api.tests.ws_test_helper import bearer_headers, connect_ws

PREFIX = "/api/barometer"


@pytest.fixture(autouse=True)
def clear_ws_state():
    baro.mgr.clear()
    yield
    baro.mgr.clear()


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Schmidt", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


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


def _analysis_file(payload: dict) -> dict:
    return {"file": ("analyse.json", io.BytesIO(json.dumps(payload).encode()), "application/json")}


def _set_question_analysis(db, qid: int, analysis: dict) -> None:
    """Only usable once the `analysis` column exists — raises otherwise, which
    is the expected red-phase failure for the tests that call it."""
    db.execute(sql_text("UPDATE barometer_questions SET analysis = :a WHERE id = :qid"),
               {"a": json.dumps(analysis), "qid": qid})
    db.flush()


# ---------------------------------------------------------------------------
# REST: create / round-trip / validation
# ---------------------------------------------------------------------------

def test_choice_und_text_frage_und_self_modus_kommen_unveraendert_zurueck(client, teacher):
    payload = {
        "title": "Feedback",
        "mode": "self",
        "questions": [
            {"text": "Wie fandest du die Stunde?", "kind": "choice",
             "options": ["gut", "mittel", "schlecht"], "chart": "balken"},
            {"text": "Was fandest du gut?", "kind": "text"},
        ],
    }
    r = _create(client, teacher, payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mode"] == "self"
    assert body["results_public"] is False
    q0, q1 = body["questions"]
    assert q0["kind"] == "choice"
    assert q0["options"] == ["gut", "mittel", "schlecht"]
    assert q0["chart"] == "balken"
    assert q1["kind"] == "text"
    assert q1["analysis"] is None

    client.cookies.clear()
    got = client.get(f"{PREFIX}/{body['code']}", headers=head(teacher))
    assert got.status_code == 200
    got_body = got.json()
    assert got_body["mode"] == "self"
    assert got_body["results_public"] is False
    assert got_body["questions"][0]["options"] == ["gut", "mittel", "schlecht"]
    assert got_body["questions"][1]["analysis"] is None


def test_choice_frage_mit_nur_einer_option_ist_422(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "choice", "options": ["Nur eine"]},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(e.startswith("questions[0].options") for e in errors)


def test_chart_passend_zur_frageart_wird_geprueft(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "scale", "chart": "kreis"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any(".chart" in e for e in errors)


def test_ungueltige_kind_wird_abgelehnt(client, teacher):
    r = _create(client, teacher, {"title": "T", "questions": [
        {"text": "Frage", "kind": "geheim"},
    ]})
    assert r.status_code == 422
    errors = r.json()["detail"]["errors"]
    assert any("kind" in e for e in errors)


# ---------------------------------------------------------------------------
# REST: upload / template
# ---------------------------------------------------------------------------

def test_upload_gibt_kind_options_chart_mode_unveraendert_zurueck(client, teacher):
    payload = {
        "title": "Upload-Test",
        "mode": "self",
        "questions": [
            {"text": "Frage", "kind": "choice", "options": ["A", "B"], "chart": "donut"},
        ],
    }
    r = _upload(client, teacher, payload)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mode"] == "self"
    assert body["questions"][0]["kind"] == "choice"
    assert body["questions"][0]["options"] == ["A", "B"]
    assert body["questions"][0]["chart"] == "donut"


def test_template_enthaelt_choice_und_text_frage_und_laedt_sich_selbst_hoch(client, teacher):
    client.cookies.clear()
    tpl_resp = client.get(f"{PREFIX}/template", headers=head(teacher))
    assert tpl_resp.status_code == 200
    tpl = tpl_resp.json()
    kinds = [q.get("kind", "scale") for q in tpl["questions"]]
    assert "choice" in kinds
    assert "text" in kinds

    up = _upload(client, teacher, tpl)
    assert up.status_code == 201, up.text
    assert len(up.json()["questions"]) == len(tpl["questions"])


# ---------------------------------------------------------------------------
# REST: clone
# ---------------------------------------------------------------------------

def test_clone_kopiert_mode_kind_options_chart_aber_nicht_analysis(client, db, teacher):
    r = _create(client, teacher, {
        "title": "Original", "mode": "self",
        "questions": [{"text": "Frage", "kind": "choice", "options": ["Ja", "Nein"], "chart": "kreis"}],
    })
    assert r.status_code == 201, r.text
    code, qid = r.json()["code"], r.json()["questions"][0]["id"]

    _set_question_analysis(db, qid, {"summary": "alt", "groups": [], "unique_ideas": []})

    clone = client.post(f"{PREFIX}/{code}/clone", headers=head(teacher))
    assert clone.status_code == 201, clone.text
    clone_body = clone.json()
    assert clone_body["mode"] == "self"
    cq = clone_body["questions"][0]
    assert cq["kind"] == "choice"
    assert cq["options"] == ["Ja", "Nein"]
    assert cq["chart"] == "kreis"
    assert cq["analysis"] is None


# ---------------------------------------------------------------------------
# REST: PATCH chart / results-public / public-results
# ---------------------------------------------------------------------------

def test_chart_aendern_laesst_antworten_unangetastet_und_ist_owner_only(client, db, teacher, teacher2):
    r = _create(client, teacher, {"title": "T", "questions": [{"text": "Frage", "kind": "scale"}]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    qid = r.json()["questions"][0]["id"]
    s = db.query(BarometerSession).filter_by(code=code).one()
    db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id="g-1", value=3))
    db.flush()

    ok = client.patch(f"{PREFIX}/{code}/questions/{qid}/chart", headers=head(teacher), json={"chart": "balken"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["chart"] == "balken"
    assert db.query(BarometerResponse).filter_by(question_id=qid).count() == 1

    bad = client.patch(f"{PREFIX}/{code}/questions/{qid}/chart", headers=head(teacher), json={"chart": "kreis"})
    assert bad.status_code == 422

    other = client.patch(f"{PREFIX}/{code}/questions/{qid}/chart", headers=head(teacher2), json={"chart": "balken"})
    assert other.status_code == 403


def test_results_public_umschalten_und_oeffentliche_ergebnisse(client, db, teacher, teacher2):
    r = _create(client, teacher, {"title": "T", "questions": [{"text": "Wie war's?", "kind": "text"}]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    qid = r.json()["questions"][0]["id"]
    s = db.query(BarometerSession).filter_by(code=code).one()
    db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id="g-1",
                              text="Geheimer Freitext, nur fuer die Lehrkraft"))
    db.flush()

    other = client.patch(f"{PREFIX}/{code}/results-public", headers=head(teacher2), json={"public": True})
    assert other.status_code == 403

    client.cookies.clear()
    off = client.get(f"{PREFIX}/{code}/public-results")
    assert off.status_code == 403

    on = client.patch(f"{PREFIX}/{code}/results-public", headers=head(teacher), json={"public": True})
    assert on.status_code == 200, on.text
    assert on.json()["results_public"] is True

    client.cookies.clear()
    pub = client.get(f"{PREFIX}/{code}/public-results")
    assert pub.status_code == 200, pub.text
    assert "Geheimer Freitext, nur fuer die Lehrkraft" not in pub.text
    body = pub.json()
    q = body["questions"][0]
    assert "distribution" in q
    assert "count" in q
    assert "analysis" in q


# ---------------------------------------------------------------------------
# REST: export
# ---------------------------------------------------------------------------

def test_export_enthaelt_verteilung_mittelwert_texte_und_keine_identitaeten(client, db, teacher, teacher2, klass):
    r = _create(client, teacher, {"title": "Export", "questions": [
        {"text": "Wie zufrieden?", "kind": "scale", "scale_min": 1, "scale_max": 3},
        {"text": "Farbe?", "kind": "choice", "options": ["Rot", "Blau"]},
        {"text": "Kommentar?", "kind": "text"},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    scale_qid, choice_qid, text_qid = (q["id"] for q in r.json()["questions"])

    s = db.query(BarometerSession).filter_by(code=code).one()
    student = Student(nachname="Schueler", vorname="Sam", klasse=klass.code,
                       class_id=klass.id, geschlecht="m", active=True)
    db.add(student)
    db.flush()

    db.add(BarometerResponse(session_id=s.id, question_id=scale_qid, student_id=None, guest_id="g-1", value=2))
    db.add(BarometerResponse(session_id=s.id, question_id=choice_qid, student_id=None, guest_id="g-1", value=0))
    db.add(BarometerResponse(session_id=s.id, question_id=text_qid, student_id=None, guest_id="g-1",
                              text="Mehr Pausen bitte"))
    db.add(BarometerResponse(session_id=s.id, question_id=scale_qid, student_id=student.id, guest_id=None, value=3))
    db.flush()

    other = client.get(f"{PREFIX}/{code}/export", headers=head(teacher2))
    assert other.status_code == 403

    r2 = client.get(f"{PREFIX}/{code}/export", headers=head(teacher))
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["format"] == "hauspokal-umfrage-ergebnisse"
    assert body["version"] == 1
    assert body["respondent_count"] == 2   # one guest (3 answers) + one student (1 answer)

    scale_out = next(q for q in body["questions"] if q["id"] == scale_qid)
    assert scale_out["distribution"] == {"1": 0, "2": 1, "3": 1}
    assert scale_out["mean"] == 2.5

    choice_out = next(q for q in body["questions"] if q["id"] == choice_qid)
    assert choice_out["distribution"] == {"Rot": 1, "Blau": 0}

    text_out = next(q for q in body["questions"] if q["id"] == text_qid)
    assert text_out["answers"] == ["Mehr Pausen bitte"]

    dumped = json.dumps(body)
    assert "Sam" not in dumped
    assert "Schueler" not in dumped
    assert "g-1" not in dumped


# ---------------------------------------------------------------------------
# REST: analysis-prompt / analysis upload
# ---------------------------------------------------------------------------

def test_analysis_prompt_ohne_freitext_ist_400(client, teacher):
    r = _create(client, teacher, {"title": "Nur Skala", "questions": [{"text": "Frage", "kind": "scale"}]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    resp = client.get(f"{PREFIX}/{code}/analysis-prompt", headers=head(teacher))
    assert resp.status_code == 400


def test_analysis_prompt_enthaelt_code_fragen_id_und_antworten(client, db, teacher):
    r = _create(client, teacher, {"title": "Feedback", "questions": [{"text": "Was war gut?", "kind": "text"}]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    qid = r.json()["questions"][0]["id"]
    s = db.query(BarometerSession).filter_by(code=code).one()
    db.add(BarometerResponse(session_id=s.id, question_id=qid, student_id=None, guest_id="g-1",
                              text="Die Gruppenarbeit war klasse"))
    db.flush()

    resp = client.get(f"{PREFIX}/{code}/analysis-prompt", headers=head(teacher))
    assert resp.status_code == 200, resp.text
    prompt = resp.json()["prompt"]
    assert code in prompt
    assert str(qid) in prompt
    assert "Die Gruppenarbeit war klasse" in prompt
    assert "survey_code" in prompt


def test_analyse_hochladen_setzt_analysis_und_prueft_alle_faelle(client, db, teacher, teacher2):
    r = _create(client, teacher, {"title": "Feedback", "questions": [
        {"text": "Was war gut?", "kind": "text"},
        {"text": "Zufriedenheit", "kind": "scale"},
    ]})
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    text_qid, scale_qid = (q["id"] for q in r.json()["questions"])

    good_payload = {
        "survey_code": code,
        "analyses": [{
            "question_id": text_qid,
            "summary": "Gute Stimmung insgesamt.",
            "groups": [{"title": "Mehr Pausen", "count": 2, "examples": ["mehr Pausen bitte"]}],
            "unique_ideas": [{"idea": "Exkursion ins Museum", "reason": "nur einmal genannt"}],
        }],
    }
    client.cookies.clear()
    up = client.post(f"{PREFIX}/{code}/analysis", headers=head(teacher), files=_analysis_file(good_payload))
    assert up.status_code == 200, up.text

    client.cookies.clear()
    got = client.get(f"{PREFIX}/{code}", headers=head(teacher)).json()
    analysis = got["questions"][0]["analysis"]
    assert analysis["summary"] == "Gute Stimmung insgesamt."
    assert analysis["groups"][0]["title"] == "Mehr Pausen"
    assert analysis["unique_ideas"][0]["idea"] == "Exkursion ins Museum"
    assert "uploaded_at" in analysis

    # falscher survey_code
    wrong_code = dict(good_payload, survey_code="XXXXXX")
    client.cookies.clear()
    r2 = client.post(f"{PREFIX}/{code}/analysis", headers=head(teacher), files=_analysis_file(wrong_code))
    assert r2.status_code == 422
    assert any("gehört zur Umfrage" in e for e in r2.json()["detail"]["errors"])

    # question_id einer Skalenfrage statt einer Freitextfrage
    scale_target = {"survey_code": code, "analyses": [{"question_id": scale_qid, "summary": "x", "groups": []}]}
    client.cookies.clear()
    r3 = client.post(f"{PREFIX}/{code}/analysis", headers=head(teacher), files=_analysis_file(scale_target))
    assert r3.status_code == 422

    # mehrere Probleme gleichzeitig: kein survey_code UND eine Skalenfrage als Ziel
    client.cookies.clear()
    r4 = client.post(f"{PREFIX}/{code}/analysis", headers=head(teacher),
                      files=_analysis_file({"analyses": [{"question_id": scale_qid}]}))
    assert r4.status_code == 422
    assert len(r4.json()["detail"]["errors"]) >= 2

    # kaputtes JSON
    client.cookies.clear()
    r5 = client.post(f"{PREFIX}/{code}/analysis", headers=head(teacher),
                      files={"file": ("analyse.json", io.BytesIO(b"{nope"), "application/json")})
    assert r5.status_code == 400

    # andere Lehrkraft
    client.cookies.clear()
    r6 = client.post(f"{PREFIX}/{code}/analysis", headers=head(teacher2), files=_analysis_file(good_payload))
    assert r6.status_code == 403


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
    """Seed a session + its questions directly, matching the model kwargs the
    spec adds (`mode` on the session; `kind`/`options` on each question).
    None of these exist yet, so this raises for tests that rely on them —
    that is the expected red-phase failure."""
    s = BarometerSession(code=code, title="Umfrage", created_by=teacher.id, allow_guests=True, mode=mode)
    db.add(s)
    db.flush()
    for i, kwargs in enumerate(questions):
        db.add(BarometerQuestion(session_id=s.id, order=i, **kwargs))
    db.flush()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# WebSocket: live mode
# ---------------------------------------------------------------------------

def test_choice_antwort_mit_ungueltigem_index_wird_ignoriert(client, db, teacher):
    code = "BAROCH1"
    s = _make_session(db, teacher, code, [
        {"text": "Farbe?", "kind": "choice", "options": ["Rot", "Blau", "Gruen"]},
    ])
    qid = s.questions[0].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                await host.send_json({"action": "show_question", "index": 0})
                await ada.receive_json()  # slide
                await host.receive_json()  # slide — die Lehrkraft bekommt sie auch, ihre Ansicht folgt daraus

                await ada.send_json({"action": "respond", "question_id": qid, "value": 5})   # nur 0..2 gueltig
                await ada.send_json({"action": "respond", "question_id": qid, "value": 1})

                first_update = await asyncio.wait_for(host.receive_json(), timeout=2)
                assert first_update["event"] == "response_update"
                assert first_update["count"] == 1
                assert first_update["distribution"] == {"1": 1}

                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(host.receive_json(), timeout=0.3)
    asyncio.run(run())


def test_freitext_bleibt_bei_der_lehrkraft(client, db, teacher):
    code = "BAROTX1"
    s = _make_session(db, teacher, code, [{"text": "Kommentar?", "kind": "text"}])
    qid = s.questions[0].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined
                await host.send_json({"action": "show_question", "index": 0})
                await ada.receive_json()  # slide
                await host.receive_json()  # slide — die Lehrkraft bekommt sie auch, ihre Ansicht folgt daraus

                await ada.send_json({"action": "respond", "question_id": qid, "text": "Mehr Gruppenarbeit bitte"})
                update = await asyncio.wait_for(host.receive_json(), timeout=2)
                assert update["event"] == "response_update"
                assert update["texts"] == ["Mehr Gruppenarbeit bitte"]

                ack = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert ack == {
                    "event": "response_ack", "question_id": qid, "text": "Mehr Gruppenarbeit bitte",
                    "my_answers": {str(qid): "Mehr Gruppenarbeit bitte"},
                }

                await host.send_json({"action": "show_results"})
                results = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert results == {
                    "event": "results", "index": 0,
                    "results": {str(qid): {"distribution": {}, "count": 1}},
                }
    asyncio.run(run())


def test_lehrkraft_state_zeigt_ergebnisse_zu_jeder_frage(client, db, teacher):
    code = "BAROST1"
    s = _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale"},
        {"text": "Frage 2", "kind": "text"},
    ])
    q1, q2 = s.questions[0].id, s.questions[1].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            state = await host.receive_json()
            assert state["event"] == "state"
            results = state["results"]
            assert set(results.keys()) == {str(q1), str(q2)}
            assert "count" in results[str(q1)]
            assert "distribution" in results[str(q1)]
    asyncio.run(run())


# ---------------------------------------------------------------------------
# WebSocket: self mode
# ---------------------------------------------------------------------------

def test_self_modus_state_hat_alle_fragen_und_leere_my_answers(client, db, teacher):
    code = "BAROSF1"
    _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale"},
        {"text": "Frage 2", "kind": "text"},
    ], mode="self")

    async def run():
        async with connect_ws(app, _gast(code, "Ada")) as ada:
            state = await ada.receive_json()
            assert state["event"] == "state"
            assert len(state["questions"]) == 2
            assert state["my_answers"] == {}
    asyncio.run(run())


def test_self_modus_submit_speichert_und_benachrichtigt_lehrkraft(client, db, teacher):
    code = "BAROSF2"
    s = _make_session(db, teacher, code, [
        {"text": "Frage 1", "kind": "scale", "scale_min": 1, "scale_max": 5},
        {"text": "Frage 2", "kind": "text"},
    ], mode="self")
    q1, q2 = s.questions[0].id, s.questions[1].id

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            async with connect_ws(app, _gast(code, "Ada")) as ada:
                await ada.receive_json()  # state
                await host.receive_json()  # participant_joined

                await ada.send_json({"action": "submit", "answers": [
                    {"question_id": q1, "value": 4},
                    {"question_id": q2, "text": "Toll war's"},
                ]})
                submitted = await asyncio.wait_for(ada.receive_json(), timeout=2)
                assert submitted["event"] == "submitted"
                assert submitted["my_answers"] == {str(q1): 4, str(q2): "Toll war's"}

                seen_qids = set()
                for _ in range(2):
                    upd = await asyncio.wait_for(host.receive_json(), timeout=2)
                    assert upd["event"] == "response_update"
                    seen_qids.add(upd["question_id"])
                assert seen_qids == {q1, q2}
    asyncio.run(run())


def test_self_modus_my_answers_wird_bei_neuer_verbindung_vorausgefuellt(client, db, teacher):
    code = "BAROSF3"
    s = _make_session(db, teacher, code, [
        {"text": "Frage", "kind": "scale", "scale_min": 1, "scale_max": 5},
    ], mode="self")
    qid = s.questions[0].id
    token = create_guest_token(code, "Ada")

    async def run():
        async with connect_ws(app, _gast(code, "Ada", token=token)) as ada:
            await ada.receive_json()  # state
            await ada.send_json({"action": "submit", "answers": [{"question_id": qid, "value": 3}]})
            await ada.receive_json()  # submitted

        async with connect_ws(app, _gast(code, "Ada", token=token)) as ada2:
            state = await ada2.receive_json()
            assert state["my_answers"] == {str(qid): 3}
    asyncio.run(run())


def test_neustart_loescht_die_ki_auswertung_der_fragen(client, db, teacher):
    code = "BARORS1"
    s = _make_session(db, teacher, code, [{"text": "Frage", "kind": "text"}])
    qid = s.questions[0].id
    _set_question_analysis(db, qid, {"summary": "alt", "groups": [], "unique_ideas": []})

    async def run():
        async with connect_ws(app, _scope(code, "role=teacher", bearer_headers(teacher.id))) as host:
            await host.receive_json()  # state
            await host.send_json({"action": "restart"})
            await host.receive_json()  # state (reset)
    asyncio.run(run())

    db.expire_all()
    q = db.query(BarometerQuestion).filter_by(id=qid).one()
    assert q.analysis is None
