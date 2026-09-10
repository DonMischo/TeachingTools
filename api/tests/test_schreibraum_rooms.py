"""Schreibraum REST surface: room CRUD, access grants, join/kick, document.

Access rules (api/routers/schreibraum/rooms.py `_assert_access`):
  - every teacher may enter every room,
  - a student needs a grant on their own id or on their class,
  - a guest needs the room's `allow_guests` opt-in.
Only the creating teacher (or an admin) may delete a room.

Tokens are minted directly rather than through /api/auth/login, because login
sets the hp_session cookie on the shared TestClient and cookie auth beats the
Bearer header (auth._resolve_token) -- same pattern as test_fragments.py.
"""
from datetime import datetime, timezone, timedelta

import pytest

from api.auth import create_access_token, hash_password
from api.models import (
    Class, SchreibraumAccess, SchreibraumDocument, SchreibraumParticipant,
    SchreibraumRoom, Student, Teacher,
)
from api.tests.conftest import auth

PREFIX = "/api/schreibraum"


def teacher_auth(t: Teacher) -> dict:
    return auth(create_access_token({"sub": str(t.id), "type": "teacher"}))


def student_auth(s: Student) -> dict:
    return auth(create_access_token({"sub": str(s.id), "type": "student"}))


@pytest.fixture()
def teacher2(db) -> Teacher:
    t = Teacher(first_name="Bea", last_name="Schmidt", active=True,
                password_hash=hash_password("secret2"), role="teacher")
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def student(db, klass) -> Student:
    s = Student(nachname="Schueler", vorname="Sam", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def outsider(db) -> Student:
    """A student of another class, with no grant anywhere."""
    c = Class(code="6b", display_name="Klasse 6b")
    db.add(c)
    db.flush()
    s = Student(nachname="Fremd", vorname="Fritz", klasse=c.code,
                class_id=c.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def room(client, db, teacher):
    """A room created through the API, so the teacher participant and the
    document row exist exactly as in production."""
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms", headers=teacher_auth(teacher),
                    json={"title": "Aufsatz 5a"})
    assert r.status_code == 200, r.text
    return r.json()


# ── room CRUD ────────────────────────────────────────────────────────────────

def test_create_room_seeds_code_participant_and_document(client, db, teacher, room):
    assert len(room["code"]) == 6 and room["code"].isupper()
    assert room["title"] == "Aufsatz 5a"
    assert room["mode"] == "next-free-line"
    assert room["is_permanent"] is True
    assert room["creator_name"] == "Anna Müller"
    assert room["access"] == []

    # The creator is already a participant, so they can open the WS right away.
    parts = db.query(SchreibraumParticipant).filter_by(room_id=room["id"]).all()
    assert [(p.is_teacher, p.teacher_id) for p in parts] == [(True, teacher.id)]
    assert db.query(SchreibraumDocument).filter_by(room_id=room["id"]).count() == 1


def test_create_room_requires_authentication(client):
    client.cookies.clear()
    assert client.post(f"{PREFIX}/rooms", json={"title": "X"}).status_code == 401


def test_list_rooms_teacher_sees_all_and_can_filter_by_creator(client, db, teacher, teacher2, room):
    client.cookies.clear()
    other = client.post(f"{PREFIX}/rooms", headers=teacher_auth(teacher2),
                        json={"title": "Bea's Raum"}).json()

    all_ids = {r["id"] for r in client.get(f"{PREFIX}/rooms", headers=teacher_auth(teacher)).json()}
    assert all_ids == {room["id"], other["id"]}

    mine = client.get(f"{PREFIX}/rooms?created_by={teacher2.id}", headers=teacher_auth(teacher)).json()
    assert [r["id"] for r in mine] == [other["id"]]


def test_list_rooms_student_sees_only_granted(client, db, teacher, room, student, outsider):
    client.cookies.clear()
    assert client.get(f"{PREFIX}/rooms", headers=student_auth(student)).json() == []

    db.add(SchreibraumAccess(room_id=room["id"], student_id=student.id))
    db.flush()
    assert [r["id"] for r in client.get(f"{PREFIX}/rooms", headers=student_auth(student)).json()] == [room["id"]]
    # The grant is personal -- a classmate-less outsider still sees nothing.
    assert client.get(f"{PREFIX}/rooms", headers=student_auth(outsider)).json() == []


def test_list_rooms_student_sees_class_grant(client, db, teacher, room, student, klass):
    client.cookies.clear()
    db.add(SchreibraumAccess(room_id=room["id"], class_id=klass.id))
    db.flush()
    assert [r["id"] for r in client.get(f"{PREFIX}/rooms", headers=student_auth(student)).json()] == [room["id"]]


def test_get_room_access_rules(client, db, teacher, teacher2, room, student, klass):
    client.cookies.clear()
    # Any teacher, even one who did not create the room.
    assert client.get(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher2)).status_code == 200
    # A student without a grant is refused.
    r = client.get(f"{PREFIX}/rooms/{room['id']}", headers=student_auth(student))
    assert r.status_code == 403
    db.add(SchreibraumAccess(room_id=room["id"], class_id=klass.id))
    db.flush()
    assert client.get(f"{PREFIX}/rooms/{room['id']}", headers=student_auth(student)).status_code == 200


def test_get_room_unknown_id(client, teacher):
    client.cookies.clear()
    assert client.get(f"{PREFIX}/rooms/nope", headers=teacher_auth(teacher)).status_code == 404


def test_get_room_by_code_is_case_insensitive(client, teacher, room):
    client.cookies.clear()
    r = client.get(f"{PREFIX}/rooms/by-code/{room['code'].lower()}", headers=teacher_auth(teacher))
    assert r.status_code == 200 and r.json()["id"] == room["id"]
    assert client.get(f"{PREFIX}/rooms/by-code/ZZZZZZ", headers=teacher_auth(teacher)).status_code == 404


def test_patch_room_updates_only_given_fields(client, teacher, room):
    client.cookies.clear()
    r = client.patch(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher),
                     json={"mode": "add-line"})
    assert r.status_code == 200
    assert r.json()["mode"] == "add-line"
    assert r.json()["title"] == "Aufsatz 5a"       # untouched
    assert r.json()["is_permanent"] is True

    r2 = client.patch(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher),
                      json={"title": "Neu", "is_permanent": False})
    assert (r2.json()["title"], r2.json()["is_permanent"], r2.json()["mode"]) == ("Neu", False, "add-line")

    assert client.patch(f"{PREFIX}/rooms/nope", headers=teacher_auth(teacher),
                        json={"title": "X"}).status_code == 404


def test_delete_room_only_creator_or_admin(client, db, teacher, teacher2, admin, room):
    client.cookies.clear()
    assert client.delete(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher2)).status_code == 403
    assert client.delete(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(admin)).status_code == 204
    assert db.get(SchreibraumRoom, room["id"]) is None
    assert client.delete(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher)).status_code == 404


def test_delete_room_cascades_participants_and_document(client, db, teacher, room):
    client.cookies.clear()
    assert client.delete(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher)).status_code == 204
    assert db.query(SchreibraumParticipant).filter_by(room_id=room["id"]).count() == 0
    assert db.query(SchreibraumDocument).filter_by(room_id=room["id"]).count() == 0


# ── access grants ────────────────────────────────────────────────────────────

def test_access_grants_crud_and_labels(client, db, teacher, room, student, klass):
    client.cookies.clear()
    h = teacher_auth(teacher)

    s_grant = client.post(f"{PREFIX}/rooms/{room['id']}/access", headers=h,
                          json={"student_id": student.id})
    assert s_grant.status_code == 201
    assert s_grant.json()["label"] == "Sam S."

    c_grant = client.post(f"{PREFIX}/rooms/{room['id']}/access", headers=h,
                          json={"class_id": klass.id})
    assert c_grant.status_code == 201
    assert c_grant.json()["label"] == "5a"

    listed = client.get(f"{PREFIX}/rooms/{room['id']}/access", headers=h).json()
    assert {g["label"] for g in listed} == {"Sam S.", "5a"}
    # The room payload carries the same grants.
    assert len(client.get(f"{PREFIX}/rooms/{room['id']}", headers=h).json()["access"]) == 2

    assert client.delete(f"{PREFIX}/rooms/{room['id']}/access/{s_grant.json()['id']}",
                         headers=h).status_code == 204
    assert [g["label"] for g in client.get(f"{PREFIX}/rooms/{room['id']}/access", headers=h).json()] == ["5a"]


def test_add_access_needs_a_grantee(client, teacher, room):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/access", headers=teacher_auth(teacher), json={})
    assert r.status_code == 422


def test_access_endpoints_404_on_unknown_room_or_grant(client, db, teacher, room, student):
    client.cookies.clear()
    h = teacher_auth(teacher)
    assert client.get(f"{PREFIX}/rooms/nope/access", headers=h).status_code == 404
    assert client.post(f"{PREFIX}/rooms/nope/access", headers=h,
                       json={"student_id": student.id}).status_code == 404
    grant = client.post(f"{PREFIX}/rooms/{room['id']}/access", headers=h,
                        json={"student_id": student.id}).json()
    # Right grant id, wrong room -> still 404.
    assert client.delete(f"{PREFIX}/rooms/other/access/{grant['id']}", headers=h).status_code == 404
    assert client.delete(f"{PREFIX}/rooms/{room['id']}/access/9999", headers=h).status_code == 404


def test_access_labels_fall_back_to_ids_for_deleted_rows(client, db, teacher, room):
    """A grant whose student/class row is gone must still render, not 500."""
    client.cookies.clear()
    db.add(SchreibraumAccess(room_id=room["id"], student_id=4242))
    db.add(SchreibraumAccess(room_id=room["id"], class_id=777))
    db.flush()
    labels = {g["label"] for g in client.get(f"{PREFIX}/rooms/{room['id']}/access",
                                             headers=teacher_auth(teacher)).json()}
    assert labels == {"4242", "777"}


# ── join / participants / kick ───────────────────────────────────────────────

def test_join_reuses_the_creator_participant(client, db, teacher, room):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=teacher_auth(teacher))
    assert r.status_code == 200
    assert r.json()["is_teacher"] is True and r.json()["color"] == "#374151"
    # Joining twice must not create a second row.
    r2 = client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=teacher_auth(teacher))
    assert r2.json()["id"] == r.json()["id"]
    assert db.query(SchreibraumParticipant).filter_by(room_id=room["id"]).count() == 1


def test_join_student_requires_a_grant_and_gets_a_color(client, db, teacher, room, student, klass):
    client.cookies.clear()
    assert client.post(f"{PREFIX}/rooms/{room['id']}/join",
                       headers=student_auth(student)).status_code == 403

    db.add(SchreibraumAccess(room_id=room["id"], class_id=klass.id))
    db.flush()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=student_auth(student))
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Sam S."
    assert body["is_teacher"] is False
    assert body["color"] != "#374151"
    assert body["session_token"]


def test_join_unknown_room_and_unauthenticated(client, teacher, room):
    client.cookies.clear()
    assert client.post(f"{PREFIX}/rooms/nope/join", headers=teacher_auth(teacher)).status_code == 404
    assert client.post(f"{PREFIX}/rooms/{room['id']}/join").status_code == 401


def test_participants_and_log_list_the_join(client, db, teacher, room, student, klass):
    client.cookies.clear()
    db.add(SchreibraumAccess(room_id=room["id"], class_id=klass.id))
    db.flush()
    client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=student_auth(student))

    parts = client.get(f"{PREFIX}/rooms/{room['id']}/participants", headers=teacher_auth(teacher)).json()
    assert {p["name"] for p in parts} == {"Anna Müller", "Sam S."}

    log = client.get(f"{PREFIX}/rooms/{room['id']}/log", headers=teacher_auth(teacher)).json()
    assert [(e["participant_name"], e["action"]) for e in log] == [("Sam S.", "join")]

    assert client.get(f"{PREFIX}/rooms/nope/participants", headers=teacher_auth(teacher)).status_code == 404
    assert client.get(f"{PREFIX}/rooms/nope/log", headers=teacher_auth(teacher)).status_code == 404


def _joined_student(client, db, room, student, klass):
    db.add(SchreibraumAccess(room_id=room["id"], class_id=klass.id))
    db.flush()
    return client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=student_auth(student)).json()


def test_kicked_student_is_blocked_then_allowed_after_rejoin_toggle(client, db, teacher, room, student, klass):
    client.cookies.clear()
    p = _joined_student(client, db, room, student, klass)

    row = db.get(SchreibraumParticipant, p["id"])
    row.is_kicked = True
    row.kicked_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.flush()

    # Cool-down is over, but rejoining is not allowed yet.
    r = client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=student_auth(student))
    assert r.status_code == 403 and "gekickt" in r.json()["detail"]

    assert client.post(f"{PREFIX}/rooms/{room['id']}/participants/{p['id']}/rejoin-toggle",
                       headers=teacher_auth(teacher)).status_code == 204
    r2 = client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=student_auth(student))
    assert r2.status_code == 200
    db.refresh(row)
    assert row.is_kicked is False and row.kicked_at is None


def test_kicked_student_must_wait_out_the_cooldown(client, db, teacher, room, student, klass):
    client.cookies.clear()
    p = _joined_student(client, db, room, student, klass)
    row = db.get(SchreibraumParticipant, p["id"])
    row.is_kicked = True
    row.rejoin_allowed = True          # even so, the 2-minute cool-down wins
    row.kicked_at = datetime.now(timezone.utc) - timedelta(seconds=30)
    db.flush()

    r = client.post(f"{PREFIX}/rooms/{room['id']}/join", headers=student_auth(student))
    assert r.status_code == 403 and "Warte noch" in r.json()["detail"]


def test_kick_marks_the_participant_and_closes_their_socket(client, db, teacher, room, student, klass):
    """Regression: the route used to be sync and called asyncio.create_task,
    which blows up with "no running event loop" in the threadpool worker —
    the kick 500'd and the socket was never closed."""
    client.cookies.clear()
    p = _joined_student(client, db, room, student, klass)

    closed: list[int] = []

    class _FakeWS:
        async def close(self, code: int = 1000):
            closed.append(code)

    from api.routers.schreibraum import collab
    collab._participant_ws[p["id"]] = _FakeWS()
    try:
        r = client.post(f"{PREFIX}/rooms/{room['id']}/participants/{p['id']}/kick",
                        headers=teacher_auth(teacher))
    finally:
        collab._participant_ws.pop(p["id"], None)

    assert r.status_code == 204
    assert closed == [4003]
    row = db.get(SchreibraumParticipant, p["id"])
    assert row.is_kicked is True and row.kicked_at is not None


def test_kick_rejects_teachers_and_unknown_participants(client, db, teacher, room):
    client.cookies.clear()
    teacher_p = db.query(SchreibraumParticipant).filter_by(room_id=room["id"]).one()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/participants/{teacher_p.id}/kick",
                    headers=teacher_auth(teacher))
    assert r.status_code == 400
    assert client.post(f"{PREFIX}/rooms/{room['id']}/participants/nope/kick",
                       headers=teacher_auth(teacher)).status_code == 404
    assert client.post(f"{PREFIX}/rooms/{room['id']}/participants/nope/rejoin-toggle",
                       headers=teacher_auth(teacher)).status_code == 404


# ── document ─────────────────────────────────────────────────────────────────

def test_document_round_trip_and_student_may_not_save(client, db, teacher, room, student, klass):
    import base64
    client.cookies.clear()
    db.add(SchreibraumAccess(room_id=room["id"], class_id=klass.id))
    db.flush()

    assert client.get(f"{PREFIX}/rooms/{room['id']}/document",
                      headers=teacher_auth(teacher)).json() == {"ydoc_state": None}

    payload = base64.b64encode(b"\x01\x02yjs").decode()
    assert client.post(f"{PREFIX}/rooms/{room['id']}/document/save?ydoc_state={payload}",
                       headers=student_auth(student)).status_code == 403
    assert client.post(f"{PREFIX}/rooms/{room['id']}/document/save?ydoc_state={payload}",
                       headers=teacher_auth(teacher)).status_code == 204

    got = client.get(f"{PREFIX}/rooms/{room['id']}/document", headers=student_auth(student))
    assert got.status_code == 200
    assert base64.b64decode(got.json()["ydoc_state"]) == payload.encode()


def test_document_endpoints_404_on_unknown_room(client, teacher):
    client.cookies.clear()
    h = teacher_auth(teacher)
    assert client.get(f"{PREFIX}/rooms/nope/document", headers=h).status_code == 404
    assert client.post(f"{PREFIX}/rooms/nope/document/save?ydoc_state=x", headers=h).status_code == 404


# ── upload / export guards ───────────────────────────────────────────────────

def test_upload_stores_the_file_under_a_random_name(client, teacher, room, tmp_path, monkeypatch):
    from api.routers.schreibraum import rooms as rooms_router
    monkeypatch.setattr(rooms_router, "FILES_BASE", tmp_path)
    client.cookies.clear()

    r = client.post(f"{PREFIX}/rooms/{room['id']}/files", headers=teacher_auth(teacher),
                    files={"file": ("tafelbild.png", b"\x89PNG-bytes", "image/png")})
    assert r.status_code == 200
    body = r.json()
    assert body["filename"] == "tafelbild.png"
    assert body["is_image"] is True
    # The stored name must not be the uploaded one.
    stored = list((tmp_path / room["id"]).iterdir())
    assert [p.name for p in stored] != ["tafelbild.png"]
    assert stored[0].suffix == ".png"
    assert stored[0].read_bytes() == b"\x89PNG-bytes"
    assert body["url"] == f"/uploads/schreibraum/{room['id']}/{stored[0].name}"


def test_upload_flags_non_images(client, teacher, room, tmp_path, monkeypatch):
    from api.routers.schreibraum import rooms as rooms_router
    monkeypatch.setattr(rooms_router, "FILES_BASE", tmp_path)
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/files", headers=teacher_auth(teacher),
                    files={"file": ("notiz.txt", b"Hallo", "text/plain")})
    assert r.status_code == 200 and r.json()["is_image"] is False


def test_upload_rejects_disallowed_extension(client, teacher, room):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/files", headers=teacher_auth(teacher),
                    files={"file": ("hack.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400
    assert "exe" in r.json()["detail"]


def test_upload_rejects_a_mismatched_mime_type(client, teacher, room):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/files", headers=teacher_auth(teacher),
                    files={"file": ("bild.png", b"MZ", "application/x-msdownload")})
    assert r.status_code == 400
    assert "MIME" in r.json()["detail"]


def test_upload_rejects_oversized_files(client, teacher, room, tmp_path, monkeypatch):
    from api.routers.schreibraum import rooms as rooms_router
    monkeypatch.setattr(rooms_router, "FILES_BASE", tmp_path)
    monkeypatch.setattr(rooms_router, "MAX_FILE_BYTES", 8)
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/files", headers=teacher_auth(teacher),
                    files={"file": ("gross.txt", b"x" * 20, "text/plain")})
    assert r.status_code == 413


def test_upload_and_export_need_room_access(client, db, teacher, room, student):
    client.cookies.clear()
    assert client.post(f"{PREFIX}/rooms/{room['id']}/files", headers=student_auth(student),
                       files={"file": ("a.txt", b"x", "text/plain")}).status_code == 403
    assert client.post(f"{PREFIX}/rooms/{room['id']}/export/docx", headers=student_auth(student),
                       json={"html": "<p>Hallo</p>"}).status_code == 403
    assert client.post(f"{PREFIX}/rooms/nope/files", headers=teacher_auth(teacher),
                       files={"file": ("a.txt", b"x", "text/plain")}).status_code == 404
    assert client.post(f"{PREFIX}/rooms/nope/export/docx", headers=teacher_auth(teacher),
                       json={"html": "<p>Hallo</p>"}).status_code == 404


def test_export_rejects_unknown_format(client, teacher, room):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/export/pdf", headers=teacher_auth(teacher),
                    json={"html": "<p>Hallo</p>"})
    assert r.status_code == 400


@pytest.mark.parametrize("fmt,ext,marker", [
    # docx is a zip; a standalone .tex carries a preamble before \begin{document}
    ("docx", ".docx", b"PK"),
    ("tex", ".tex", b"\\begin{document}"),
    ("latex", ".tex", b"\\begin{document}"),
])
def test_export_streams_a_converted_download(client, teacher, room, fmt, ext, marker):
    """Needs pandoc, which the api image installs (see api/Dockerfile).

    Regression: docx used to be converted without an outputfile, which pypandoc
    rejects for binary targets -- every DOCX export answered 500.
    """
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/export/{fmt}", headers=teacher_auth(teacher),
                    json={"html": "<h1>Titel</h1><p>Text</p>", "title": "Mein Aufsatz!"})
    assert r.status_code == 200, r.text
    assert marker in r.content
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats" if fmt == "docx" else "application/x-tex")
    # Unsafe characters in the title never reach the Content-Disposition filename.
    assert r.headers["content-disposition"] == f'attachment; filename="Mein_Aufsatz_{ext}"'


def test_export_falls_back_to_a_default_filename(client, teacher, room):
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/export/tex", headers=teacher_auth(teacher),
                    json={"html": "<p>Text</p>", "title": ""})
    assert r.headers["content-disposition"] == 'attachment; filename="dokument.tex"'


def test_export_reports_a_conversion_failure_as_500(client, teacher, room, monkeypatch):
    import pypandoc
    monkeypatch.setattr(pypandoc, "convert_text",
                        lambda *a, **kw: (_ for _ in ()).throw(OSError("pandoc missing")))
    client.cookies.clear()
    r = client.post(f"{PREFIX}/rooms/{room['id']}/export/docx", headers=teacher_auth(teacher),
                    json={"html": "<p>Text</p>"})
    assert r.status_code == 500
    assert "Export fehlgeschlagen" in r.json()["detail"]


def test_schueler_bekommt_die_freigabeliste_nicht(client, db, teacher, student):
    """Wer eingeladen ist, geht die Eingeladenen nichts an.

    Zum Betreten braucht ein Schueler die Liste nicht — der Zugang wird
    serverseitig geprueft. Fuer die Lehrkraft bleibt sie sichtbar.
    """
    room = client.post(f"{PREFIX}/rooms", json={"title": "Raum"},
                       headers=teacher_auth(teacher)).json()
    client.post(f"{PREFIX}/rooms/{room['id']}/access",
                json={"student_id": student.id}, headers=teacher_auth(teacher))

    als_lehrkraft = client.get(f"{PREFIX}/rooms/{room['id']}", headers=teacher_auth(teacher)).json()
    assert [g["label"] for g in als_lehrkraft["access"]] == ["Sam S."]

    client.cookies.clear()
    kopf = auth(create_access_token({"sub": str(student.id), "type": "student"}))
    als_schueler = client.get(f"{PREFIX}/rooms/{room['id']}", headers=kopf)
    assert als_schueler.status_code == 200          # reinkommen ja
    assert als_schueler.json()["access"] == []      # die Liste nein

    listing = client.get(f"{PREFIX}/rooms", headers=kopf).json()
    assert all(r["access"] == [] for r in listing)
