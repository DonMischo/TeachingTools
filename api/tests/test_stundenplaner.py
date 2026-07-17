"""
Tests for the Stundenplaner router.

Covers:
  - CRUD (create, read, update, delete)
  - Ownership enforcement (other teacher cannot edit/delete)
  - Shared-access (shared teacher can read, not write)
  - JSON import: valid, oversized, bad JSON, schema violations, HTML injection
  - Sharing: invite, duplicate invite, revoke, self-share guard
  - tool-refs endpoint
  - Student access blocked on all endpoints
"""
import json
import pytest

from api.models import Teacher, LessonPlan, LessonPlanShare
from api.auth import hash_password


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bernd", last_name="Koch", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def teacher2_token(client, teacher2) -> str:
    r = client.post("/api/auth/login", json={"username": "Bernd Koch", "password": "secret2"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def student(db):
    from api.models import Student
    s = Student(nachname="Schüler", vorname="Max", klasse="7a",
                geschlecht="m", username="max_s",
                password_hash=hash_password("pass"))
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def student_token(client, student) -> str:
    r = client.post("/api/auth/login", json={"username": "max_s", "password": "pass"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# Override the shared conftest fixtures so login cookies are always cleared.
# Without this, the TestClient's shared cookie jar means teacher2's login
# cookie overwrites teacher1's, causing bearer-token requests to authenticate
# as the wrong teacher.

@pytest.fixture()
def teacher_token(client, teacher) -> str:
    r = client.post("/api/auth/login", json={"username": "Anna Müller", "password": "secret"})
    client.cookies.clear()
    return r.json()["access_token"]


@pytest.fixture()
def teacher2_token(client, teacher2) -> str:
    r = client.post("/api/auth/login", json={"username": "Bernd Koch", "password": "secret2"})
    assert r.status_code == 200, r.text
    client.cookies.clear()
    return r.json()["access_token"]


MINIMAL_PLAN = {"title": "Einführung Fotosynthese"}

FULL_PLAN = {
    "title": "Einführung Fotosynthese",
    "fach": "Biologie",
    "klasse": "7b",
    "datum": "2026-09-15",
    "dauer_min": 45,
    "lernziele": ["SuS können Fotosynthese erklären"],
    "phasen": [
        {
            "name": "Einstieg",
            "dauer_min": 10,
            "inhalt": "Bildimpuls",
            "sozialform": "Plenum",
            "methode": "Bildbetrachtung",
            "material": "Folie",
            "tool_link": None,
        },
        {
            "name": "Erarbeitung",
            "dauer_min": 25,
            "inhalt": "Lehrbuch lesen",
            "sozialform": "EA",
            "methode": "Lesemethode",
            "material": "Lehrbuch S. 42",
            "tool_link": None,
        },
    ],
    "hausaufgaben": "S. 45 Aufg. 3",
    "notizen": "Differenzierung beachten",
}


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

class TestCreate:
    def test_minimal(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token))
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Einführung Fotosynthese"
        assert data["is_owner"] is True
        assert data["phasen"] == []
        assert data["lernziele"] == []

    def test_full(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json=FULL_PLAN, headers=_auth(teacher_token))
        assert r.status_code == 201
        data = r.json()
        assert data["fach"] == "Biologie"
        assert data["klasse"] == "7b"
        assert data["datum"] == "2026-09-15"
        assert data["dauer_min"] == 45
        assert len(data["phasen"]) == 2
        assert data["phasen"][0]["name"] == "Einstieg"
        assert len(data["lernziele"]) == 1

    def test_requires_auth(self, client):
        r = client.post("/api/stundenplaner", json=MINIMAL_PLAN)
        assert r.status_code == 401

    def test_student_blocked(self, client, student_token):
        r = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(student_token))
        assert r.status_code in (401, 403)

    def test_title_required(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={"fach": "Bio"}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_unknown_field_rejected(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "hacker": "x"}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_title_too_long(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={"title": "x" * 201}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_invalid_datum(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "datum": "not-a-date"}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_datum_year_out_of_range(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "datum": "1990-01-01"}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_too_many_lernziele(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "lernziele": ["ziel"] * 11}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_too_many_phasen(self, client, teacher_token):
        phase = {"name": "P", "dauer_min": 5, "inhalt": "", "sozialform": "Plenum", "methode": "", "material": "", "tool_link": None}
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "phasen": [phase] * 16}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_invalid_sozialform(self, client, teacher_token):
        phase = {"name": "P", "dauer_min": 5, "inhalt": "", "sozialform": "Klasse", "methode": "", "material": "", "tool_link": None}
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "phasen": [phase]}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_html_stripped_from_title(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json={"title": "<script>alert(1)</script>Biologie"}, headers=_auth(teacher_token))
        assert r.status_code == 201
        assert "<script>" not in r.json()["title"]
        assert "Biologie" in r.json()["title"]

    def test_html_stripped_from_phase_inhalt(self, client, teacher_token):
        phase = {"name": "Einstieg", "dauer_min": 5, "inhalt": "<b>bold</b>Text", "sozialform": "Plenum", "methode": "", "material": "", "tool_link": None}
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "phasen": [phase]}, headers=_auth(teacher_token))
        assert r.status_code == 201
        assert "<b>" not in r.json()["phasen"][0]["inhalt"]
        assert "Text" in r.json()["phasen"][0]["inhalt"]

    def test_tool_link_valid(self, client, teacher_token):
        phase = {
            "name": "Einstieg", "dauer_min": 5, "inhalt": "", "sozialform": "Plenum",
            "methode": "", "material": "",
            "tool_link": {"type": "schreibraum", "ref_id": "ABC123", "label": "Mein Raum"},
        }
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "phasen": [phase]}, headers=_auth(teacher_token))
        assert r.status_code == 201
        tl = r.json()["phasen"][0]["tool_link"]
        assert tl["type"] == "schreibraum"
        assert tl["ref_id"] == "ABC123"

    def test_tool_link_invalid_type(self, client, teacher_token):
        phase = {
            "name": "P", "dauer_min": 5, "inhalt": "", "sozialform": "Plenum",
            "methode": "", "material": "",
            "tool_link": {"type": "malicious", "ref_id": "x", "label": ""},
        }
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "phasen": [phase]}, headers=_auth(teacher_token))
        assert r.status_code == 422

    def test_tool_link_bad_ref_id_chars(self, client, teacher_token):
        phase = {
            "name": "P", "dauer_min": 5, "inhalt": "", "sozialform": "Plenum",
            "methode": "", "material": "",
            "tool_link": {"type": "bingo", "ref_id": "../../../etc/passwd", "label": ""},
        }
        r = client.post("/api/stundenplaner", json={**MINIMAL_PLAN, "phasen": [phase]}, headers=_auth(teacher_token))
        assert r.status_code == 422


class TestList:
    def test_empty(self, client, teacher_token):
        r = client.get("/api/stundenplaner", headers=_auth(teacher_token))
        assert r.status_code == 200
        assert r.json() == {"own": [], "shared": []}

    def test_own_appears(self, client, teacher_token):
        client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token))
        r = client.get("/api/stundenplaner", headers=_auth(teacher_token))
        assert len(r.json()["own"]) == 1
        assert r.json()["shared"] == []

    def test_other_teacher_sees_nothing(self, client, teacher_token, teacher2_token):
        client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token))
        r = client.get("/api/stundenplaner", headers=_auth(teacher2_token))
        assert r.json() == {"own": [], "shared": []}


class TestGet:
    def test_owner_can_get(self, client, teacher_token):
        created = client.post("/api/stundenplaner", json=FULL_PLAN, headers=_auth(teacher_token)).json()
        r = client.get(f"/api/stundenplaner/{created['id']}", headers=_auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["title"] == FULL_PLAN["title"]

    def test_other_teacher_blocked(self, client, teacher_token, teacher2_token):
        created = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.get(f"/api/stundenplaner/{created['id']}", headers=_auth(teacher2_token))
        assert r.status_code == 403

    def test_404(self, client, teacher_token):
        r = client.get("/api/stundenplaner/99999", headers=_auth(teacher_token))
        assert r.status_code == 404


class TestUpdate:
    def test_owner_can_update(self, client, teacher_token):
        created = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.put(f"/api/stundenplaner/{created['id']}", json={**MINIMAL_PLAN, "title": "Geändert"}, headers=_auth(teacher_token))
        assert r.status_code == 200
        assert r.json()["title"] == "Geändert"

    def test_other_teacher_cannot_update(self, client, teacher_token, teacher2_token):
        created = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.put(f"/api/stundenplaner/{created['id']}", json={**MINIMAL_PLAN, "title": "Hack"}, headers=_auth(teacher2_token))
        assert r.status_code == 403

    def test_shared_teacher_cannot_update(self, client, teacher_token, teacher2, teacher2_token):
        created = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        client.post(f"/api/stundenplaner/{created['id']}/shares", json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        r = client.put(f"/api/stundenplaner/{created['id']}", json={**MINIMAL_PLAN, "title": "Hack"}, headers=_auth(teacher2_token))
        assert r.status_code == 403


class TestDelete:
    def test_owner_can_delete(self, client, teacher_token):
        created = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.delete(f"/api/stundenplaner/{created['id']}", headers=_auth(teacher_token))
        assert r.status_code == 204
        assert client.get(f"/api/stundenplaner/{created['id']}", headers=_auth(teacher_token)).status_code == 404

    def test_other_teacher_cannot_delete(self, client, teacher_token, teacher2_token):
        created = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.delete(f"/api/stundenplaner/{created['id']}", headers=_auth(teacher2_token))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# JSON Import
# ---------------------------------------------------------------------------

VALID_IMPORT = {
    "title": "Import-Stunde",
    "fach": "Chemie",
    "klasse": "9a",
    "dauer_min": 90,
    "lernziele": ["SuS können Säuren beschreiben"],
    "phasen": [
        {"name": "Einstieg", "dauer_min": 10, "inhalt": "Demo", "sozialform": "Plenum", "methode": "Demo", "material": "Säure"},
    ],
    "hausaufgaben": "Seite 12",
    "notizen": "",
}


class TestImport:
    def _post(self, client, token, body):
        return client.post(
            "/api/stundenplaner/import",
            content=json.dumps(body),
            headers={**_auth(token), "Content-Type": "application/json"},
        )

    def test_valid(self, client, teacher_token):
        r = self._post(client, teacher_token, VALID_IMPORT)
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Import-Stunde"
        assert data["fach"] == "Chemie"
        assert len(data["phasen"]) == 1

    def test_tool_links_stripped(self, client, teacher_token):
        body = {**VALID_IMPORT, "phasen": [{
            **VALID_IMPORT["phasen"][0],
            "tool_link": {"type": "bingo", "ref_id": "XY1234", "label": "Test"},
        }]}
        r = self._post(client, teacher_token, body)
        assert r.status_code == 201
        assert r.json()["phasen"][0]["tool_link"] is None

    def test_invalid_json(self, client, teacher_token):
        r = client.post(
            "/api/stundenplaner/import",
            content=b"not json at all }{",
            headers={**_auth(teacher_token), "Content-Type": "application/json"},
        )
        assert r.status_code == 400

    def test_oversized_payload(self, client, teacher_token):
        big = json.dumps({"title": "x", "notizen": "a" * 60_000})
        r = client.post(
            "/api/stundenplaner/import",
            content=big.encode(),
            headers={**_auth(teacher_token), "Content-Type": "application/json"},
        )
        assert r.status_code == 413

    def test_unknown_field_rejected(self, client, teacher_token):
        r = self._post(client, teacher_token, {**VALID_IMPORT, "injected": "evil"})
        assert r.status_code == 422

    def test_html_stripped(self, client, teacher_token):
        body = {**VALID_IMPORT, "title": "<img src=x onerror=alert(1)>Safe Title"}
        r = self._post(client, teacher_token, body)
        assert r.status_code == 201
        assert "<img" not in r.json()["title"]
        assert "Safe Title" in r.json()["title"]

    def test_too_many_phasen(self, client, teacher_token):
        phase = {"name": "P", "dauer_min": 5, "inhalt": "", "sozialform": "Plenum", "methode": "", "material": ""}
        r = self._post(client, teacher_token, {**VALID_IMPORT, "phasen": [phase] * 16})
        assert r.status_code == 422

    def test_invalid_datum(self, client, teacher_token):
        r = self._post(client, teacher_token, {**VALID_IMPORT, "datum": "32-13-2026"})
        assert r.status_code == 422

    def test_requires_auth(self, client):
        r = client.post("/api/stundenplaner/import", content=json.dumps(VALID_IMPORT),
                        headers={"Content-Type": "application/json"})
        assert r.status_code == 401

    def test_student_blocked(self, client, student_token):
        r = client.post("/api/stundenplaner/import", content=json.dumps(VALID_IMPORT),
                        headers={**_auth(student_token), "Content-Type": "application/json"})
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------

class TestSharing:
    def _create(self, client, token) -> int:
        r = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(token))
        assert r.status_code == 201
        return r.json()["id"]

    def test_share_and_shared_teacher_can_read(self, client, teacher_token, teacher2, teacher2_token):
        plan_id = self._create(client, teacher_token)
        r = client.post(f"/api/stundenplaner/{plan_id}/shares",
                        json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        assert r.status_code == 201
        assert r.json()["teacher_id"] == teacher2.id

        # appears in shared list
        lst = client.get("/api/stundenplaner", headers=_auth(teacher2_token)).json()
        assert any(p["id"] == plan_id for p in lst["shared"])
        assert r.json()["name"] == "Bernd Koch"

    def test_shared_teacher_can_read_plan(self, client, teacher_token, teacher2, teacher2_token):
        plan_id = self._create(client, teacher_token)
        client.post(f"/api/stundenplaner/{plan_id}/shares",
                    json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        r = client.get(f"/api/stundenplaner/{plan_id}", headers=_auth(teacher2_token))
        assert r.status_code == 200
        assert r.json()["is_owner"] is False

    def test_shared_in_plan_detail(self, client, teacher_token, teacher2, teacher2_token):
        plan_id = self._create(client, teacher_token)
        client.post(f"/api/stundenplaner/{plan_id}/shares",
                    json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        r = client.get(f"/api/stundenplaner/{plan_id}", headers=_auth(teacher_token))
        assert any(s["teacher_id"] == teacher2.id for s in r.json()["shared_with"])

    def test_duplicate_share_rejected(self, client, teacher_token, teacher2):
        plan_id = self._create(client, teacher_token)
        client.post(f"/api/stundenplaner/{plan_id}/shares",
                    json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        r = client.post(f"/api/stundenplaner/{plan_id}/shares",
                        json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        assert r.status_code == 409

    def test_self_share_rejected(self, client, teacher, teacher_token):
        plan_id = self._create(client, teacher_token)
        r = client.post(f"/api/stundenplaner/{plan_id}/shares",
                        json={"teacher_id": teacher.id}, headers=_auth(teacher_token))
        assert r.status_code == 400

    def test_share_nonexistent_teacher(self, client, teacher_token):
        plan_id = self._create(client, teacher_token)
        r = client.post(f"/api/stundenplaner/{plan_id}/shares",
                        json={"teacher_id": 99999}, headers=_auth(teacher_token))
        assert r.status_code == 404

    def test_only_owner_can_share(self, client, teacher_token, teacher2, teacher2_token):
        plan_id = self._create(client, teacher_token)
        r = client.post(f"/api/stundenplaner/{plan_id}/shares",
                        json={"teacher_id": teacher2.id}, headers=_auth(teacher2_token))
        assert r.status_code == 403

    def test_revoke_share(self, client, teacher_token, teacher2, teacher2_token):
        plan_id = self._create(client, teacher_token)
        client.post(f"/api/stundenplaner/{plan_id}/shares",
                    json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))

        r = client.delete(f"/api/stundenplaner/{plan_id}/shares/{teacher2.id}", headers=_auth(teacher_token))
        assert r.status_code == 204

        # previously shared teacher can no longer access
        r = client.get(f"/api/stundenplaner/{plan_id}", headers=_auth(teacher2_token))
        assert r.status_code == 403

    def test_revoke_nonexistent(self, client, teacher_token, teacher2):
        plan_id = self._create(client, teacher_token)
        r = client.delete(f"/api/stundenplaner/{plan_id}/shares/{teacher2.id}", headers=_auth(teacher_token))
        assert r.status_code == 404

    def test_delete_plan_removes_shares(self, client, db, teacher_token, teacher2):
        plan_id = self._create(client, teacher_token)
        client.post(f"/api/stundenplaner/{plan_id}/shares",
                    json={"teacher_id": teacher2.id}, headers=_auth(teacher_token))
        client.delete(f"/api/stundenplaner/{plan_id}", headers=_auth(teacher_token))
        assert db.query(LessonPlanShare).filter_by(plan_id=plan_id).count() == 0


# ---------------------------------------------------------------------------
# Tool refs
# ---------------------------------------------------------------------------

def _items_for(data: list, tool_type: str) -> list:
    """Extract one tool's items from the self-describing tool-refs list."""
    return next(t for t in data if t["type"] == tool_type)["items"]


class TestToolRefs:
    def test_returns_structure(self, client, teacher_token):
        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(teacher_token))
        assert r.status_code == 200
        data = r.json()
        types = {t["type"] for t in data}
        assert {"schreibraum", "bingo", "barometer", "exit-ticket", "classroom", "caputh", "auction"} <= types
        for t in data:
            assert isinstance(t["label"], str) and t["label"]
            assert isinstance(t["requires_ref"], bool)
            assert isinstance(t["uses_class"], bool)
            assert isinstance(t["items"], list)

    def test_classroom_always_present(self, client, teacher_token):
        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(teacher_token))
        classroom = next(t for t in r.json() if t["type"] == "classroom")
        assert classroom["requires_ref"] is False
        assert len(classroom["items"]) == 1
        assert classroom["items"][0]["label"] == "Classroom Screen"

    def test_requires_auth(self, client):
        r = client.get("/api/stundenplaner/tool-refs")
        assert r.status_code == 401

    def test_student_blocked(self, client, student_token):
        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(student_token))
        assert r.status_code in (401, 403)

    def test_caputh_lists_quiz_library(self, client, db, teacher, teacher2, teacher_token):
        """The pool is the Quiz library (content), open to every teacher —
        not tied to any particular started session."""
        from api.models import Quiz

        quiz = Quiz(title="Bruchrechnen Test")
        db.add(quiz)
        db.flush()

        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(teacher_token))
        assert r.status_code == 200
        caputh = _items_for(r.json(), "caputh")
        assert len(caputh) == 1
        assert caputh[0]["ref_id"] == str(quiz.id)
        assert caputh[0]["label"] == "Bruchrechnen Test"

    def test_bingo_lists_sets_open_to_all_teachers(self, client, db, teacher, teacher2, teacher2_token):
        from api.models import BingoSet

        bset = BingoSet(title="Vokabeln", created_by=teacher.id)
        db.add(bset)
        db.flush()

        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(teacher2_token))
        bingo = _items_for(r.json(), "bingo")
        assert len(bingo) == 1
        assert bingo[0]["ref_id"] == str(bset.id)
        assert bingo[0]["label"] == "Vokabeln"

    def test_barometer_pool_self_and_shared(self, client, db, teacher, teacher2, teacher2_token):
        from api.models import BarometerSession

        own = BarometerSession(code="OWN00001", title="Privat", created_by=teacher2.id, shared=False)
        shared = BarometerSession(code="SHR00001", title="Geteilt", created_by=teacher.id, shared=True)
        unshared_other = BarometerSession(code="OTH00001", title="Fremd", created_by=teacher.id, shared=False)
        db.add_all([own, shared, unshared_other])
        db.flush()

        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(teacher2_token))
        labels = {b["label"] for b in _items_for(r.json(), "barometer")}
        assert labels == {"Privat", "Geteilt"}

    def test_exit_ticket_pool_creator_only(self, client, db, teacher, teacher2, teacher2_token):
        from api.models import ExitTicketSession

        own = ExitTicketSession(code="OWN00002", title="Meins", question="Q?", created_by=teacher2.id)
        other = ExitTicketSession(code="OTH00002", title="Fremd", question="Q?", created_by=teacher.id)
        db.add_all([own, other])
        db.flush()

        r = client.get("/api/stundenplaner/tool-refs", headers=_auth(teacher2_token))
        labels = {t["label"] for t in _items_for(r.json(), "exit-ticket")}
        assert labels == {"Meins"}


# ---------------------------------------------------------------------------
# Live lesson sessions
# ---------------------------------------------------------------------------

class TestLessonSessions:
    def test_start_and_active(self, client, teacher_token):
        plan_id = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()["id"]
        r = client.post(f"/api/stundenplaner/{plan_id}/start", headers=_auth(teacher_token))
        assert r.status_code == 200
        session = r.json()
        assert session["plan_id"] == plan_id
        assert session["ended_at"] is None

        r2 = client.get("/api/stundenplaner/active", headers=_auth(teacher_token))
        assert r2.status_code == 200
        active = r2.json()
        assert active["session"]["id"] == session["id"]
        assert active["plan"]["id"] == plan_id

    def test_no_active_session_returns_null(self, client, teacher_token):
        r = client.get("/api/stundenplaner/active", headers=_auth(teacher_token))
        assert r.status_code == 200
        assert r.json() is None

    def test_starting_new_session_ends_previous(self, client, teacher_token, db):
        from api.models import LessonSession

        plan1 = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()["id"]
        plan2 = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()["id"]

        s1 = client.post(f"/api/stundenplaner/{plan1}/start", headers=_auth(teacher_token)).json()
        client.post(f"/api/stundenplaner/{plan2}/start", headers=_auth(teacher_token))

        db.expire_all()
        old = db.query(LessonSession).filter_by(id=s1["id"]).one()
        assert old.ended_at is not None

        active = client.get("/api/stundenplaner/active", headers=_auth(teacher_token)).json()
        assert active["plan"]["id"] == plan2

    def test_end_session_clears_active(self, client, teacher_token):
        plan_id = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()["id"]
        session = client.post(f"/api/stundenplaner/{plan_id}/start", headers=_auth(teacher_token)).json()

        r = client.post(f"/api/stundenplaner/sessions/{session['id']}/end", headers=_auth(teacher_token))
        assert r.status_code == 200

        active = client.get("/api/stundenplaner/active", headers=_auth(teacher_token)).json()
        assert active is None

    def test_cannot_end_other_teachers_session(self, client, teacher_token, teacher2_token):
        plan_id = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()["id"]
        session = client.post(f"/api/stundenplaner/{plan_id}/start", headers=_auth(teacher_token)).json()

        r = client.post(f"/api/stundenplaner/sessions/{session['id']}/end", headers=_auth(teacher2_token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

class TestMaterials:
    def test_upload_and_list_image(self, client, teacher_token):
        plan = client.post("/api/stundenplaner", json=FULL_PLAN, headers=_auth(teacher_token)).json()
        phase_id = "phase-1"

        png_bytes = bytes.fromhex(
            "89504e470d0a1a0a0000000d4948445200000001000000010802000000907724"
            "2f0000000a49444154789c6360000002000100abf6b6cf0000000049454e44ae426082"
        )
        r = client.post(
            f"/api/stundenplaner/{plan['id']}/materials",
            files={"file": ("pic.png", png_bytes, "image/png")},
            data={"phase_id": phase_id},
            headers=_auth(teacher_token),
        )
        assert r.status_code == 201, r.text
        mat = r.json()
        assert mat["phase_id"] == phase_id
        assert mat["pdf_url"] is None
        assert mat["url"].endswith(".png")

        listed = client.get(f"/api/stundenplaner/{plan['id']}/materials", headers=_auth(teacher_token)).json()
        assert len(listed) == 1
        assert listed[0]["id"] == mat["id"]

    def test_rejects_disallowed_extension(self, client, teacher_token):
        plan = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.post(
            f"/api/stundenplaner/{plan['id']}/materials",
            files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
            data={"phase_id": "p1"},
            headers=_auth(teacher_token),
        )
        assert r.status_code == 400

    def test_non_owner_cannot_upload(self, client, teacher_token, teacher2_token):
        plan = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.post(
            f"/api/stundenplaner/{plan['id']}/materials",
            files={"file": ("note.txt", b"hi", "text/plain")},
            data={"phase_id": "p1"},
            headers=_auth(teacher2_token),
        )
        assert r.status_code == 403

    def test_delete_material(self, client, teacher_token):
        plan = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        mat = client.post(
            f"/api/stundenplaner/{plan['id']}/materials",
            files={"file": ("note.txt", b"hi", "text/plain")},
            data={"phase_id": "p1"},
            headers=_auth(teacher_token),
        ).json()

        r = client.delete(f"/api/stundenplaner/{plan['id']}/materials/{mat['id']}", headers=_auth(teacher_token))
        assert r.status_code == 204

        listed = client.get(f"/api/stundenplaner/{plan['id']}/materials", headers=_auth(teacher_token)).json()
        assert listed == []


# ---------------------------------------------------------------------------
# Class shares
# ---------------------------------------------------------------------------

class TestClassShares:
    def test_add_list_remove(self, client, teacher_token, klass):
        plan = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()

        r = client.post(
            f"/api/stundenplaner/{plan['id']}/class-shares",
            json={"class_id": klass.id},
            headers=_auth(teacher_token),
        )
        assert r.status_code == 201
        assert r.json()["class_id"] == klass.id

        listed = client.get(f"/api/stundenplaner/{plan['id']}/class-shares", headers=_auth(teacher_token)).json()
        assert len(listed) == 1

        r2 = client.delete(f"/api/stundenplaner/{plan['id']}/class-shares/{klass.id}", headers=_auth(teacher_token))
        assert r2.status_code == 204
        assert client.get(f"/api/stundenplaner/{plan['id']}/class-shares", headers=_auth(teacher_token)).json() == []

    def test_duplicate_rejected(self, client, teacher_token, klass):
        plan = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        client.post(f"/api/stundenplaner/{plan['id']}/class-shares", json={"class_id": klass.id}, headers=_auth(teacher_token))
        r = client.post(f"/api/stundenplaner/{plan['id']}/class-shares", json={"class_id": klass.id}, headers=_auth(teacher_token))
        assert r.status_code == 409

    def test_only_owner_can_manage(self, client, teacher_token, teacher2_token, klass):
        plan = client.post("/api/stundenplaner", json=MINIMAL_PLAN, headers=_auth(teacher_token)).json()
        r = client.post(f"/api/stundenplaner/{plan['id']}/class-shares", json={"class_id": klass.id}, headers=_auth(teacher2_token))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Phase id backfill
# ---------------------------------------------------------------------------

class TestPhaseId:
    def test_id_backfilled_on_save(self, client, teacher_token):
        r = client.post("/api/stundenplaner", json=FULL_PLAN, headers=_auth(teacher_token))
        phasen = r.json()["phasen"]
        assert all(p.get("id") for p in phasen)
        assert len({p["id"] for p in phasen}) == len(phasen)

    def test_id_preserved_if_provided(self, client, teacher_token):
        body = {**MINIMAL_PLAN, "phasen": [{**FULL_PLAN["phasen"][0], "id": "custom-id-1"}]}
        r = client.post("/api/stundenplaner", json=body, headers=_auth(teacher_token))
        assert r.json()["phasen"][0]["id"] == "custom-id-1"
