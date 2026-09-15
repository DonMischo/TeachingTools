"""Tests for the Startseiten-Slideshow: public feed, calendar-item events,
admin-feature-gated management endpoints, upload, and the pure warnings
computation (incl. overlap detection). See slideshow_spec.md.

SlideshowItem/AdminFeatureGrant rows are inserted directly via `db` (like
CalendarEntry in test_calendar.py) so each test controls exactly the fields
it needs without going through multiple endpoint round-trips.
"""
from datetime import date, timedelta

import pytest

from api.models import AdminFeatureGrant, CalendarEntry, SlideshowItem, Student, Teacher
from api.auth import hash_password
from api.tests.conftest import auth


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _offline_wochenspruch(monkeypatch):
    """The built-in Wochenspruch row exists in every test - keep the network out of it."""
    from api.routers import slideshow

    def offline(day):
        raise OSError("offline in tests")

    monkeypatch.setattr(slideshow, "_load_wochenspruch", offline)
    slideshow._WOCHENSPRUCH_CACHE.clear()
    yield
    slideshow._WOCHENSPRUCH_CACHE.clear()


def _student_login(client, db, klasse: str = "5a", username: str = "m.muster") -> str:
    s = Student(nachname="Muster", vorname="Mia", klasse=klasse, geschlecht="weiblich",
               username=username, password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    r = client.post("/api/auth/login", json={"username": username, "password": "pw"})
    return r.json()["access_token"]


def _item(db, **kwargs) -> SlideshowItem:
    defaults = dict(
        position=0, kind="link", title="Item", active=True, audience="guest",
        duration_seconds=15, media_type=None, stored_filename=None,
        original_filename=None, url="https://example.com", calendar_tags=[],
        calendar_days_ahead=14, slot_days=[], slot_start=None, slot_end=None,
        slot_from=None, slot_until=None,
    )
    defaults.update(kwargs)
    it = SlideshowItem(**defaults)
    db.add(it)
    db.flush()
    return it


def _entry(db, teacher_id: int, **kwargs) -> CalendarEntry:
    defaults = dict(
        title="Termin", category="Schulgemeinschaft",
        start_date=date.today(), end_date=date.today(),
        all_day=True, tags=["Fest"], created_by=teacher_id,
    )
    defaults.update(kwargs)
    e = CalendarEntry(**defaults)
    db.add(e)
    db.flush()
    return e


# ---------------------------------------------------------------------------
# Public feed
# ---------------------------------------------------------------------------

def test_public_guest_sees_only_guest_items(client, db):
    _item(db, position=1, title="Für alle", audience="guest")
    _item(db, position=2, title="Nur Schüler", audience="student")
    _item(db, position=3, title="Nur Lehrer", audience="teacher")

    r = client.get("/api/slideshow/public")
    assert r.status_code == 200
    titles = {i["title"] for i in r.json()}
    assert "Für alle" in titles
    assert "Nur Schüler" not in titles
    assert "Nur Lehrer" not in titles


def test_public_student_sees_guest_and_student_items(client, db):
    _item(db, position=1, title="Für alle", audience="guest")
    _item(db, position=2, title="Nur Schüler", audience="student")
    _item(db, position=3, title="Nur Lehrer", audience="teacher")

    token = _student_login(client, db)
    client.cookies.clear()
    r = client.get("/api/slideshow/public", headers=auth(token))
    titles = {i["title"] for i in r.json()}
    assert {"Für alle", "Nur Schüler"} <= titles
    assert "Nur Lehrer" not in titles


def test_public_teacher_sees_all_items(client, db, teacher_token):
    _item(db, position=1, title="Für alle", audience="guest")
    _item(db, position=2, title="Nur Schüler", audience="student")
    _item(db, position=3, title="Nur Lehrer", audience="teacher")

    client.cookies.clear()
    r = client.get("/api/slideshow/public", headers=auth(teacher_token))
    titles = {i["title"] for i in r.json()}
    assert {"Für alle", "Nur Schüler", "Nur Lehrer"} <= titles


def test_public_hides_inactive_items(client, db):
    _item(db, position=1, title="Aktiv", audience="guest", active=True)
    _item(db, position=2, title="Inaktiv", audience="guest", active=False)

    r = client.get("/api/slideshow/public")
    titles = {i["title"] for i in r.json()}
    assert "Aktiv" in titles
    assert "Inaktiv" not in titles


def test_public_orders_by_position(client, db):
    _item(db, position=5, title="C", audience="guest")
    _item(db, position=1, title="A", audience="guest")
    _item(db, position=3, title="B", audience="guest")

    r = client.get("/api/slideshow/public")
    titles = [i["title"] for i in r.json() if i["title"] in ("A", "B", "C")]
    assert titles == ["A", "B", "C"]


def test_public_hauspunkte_item_auto_exists(client, db):
    r = client.get("/api/slideshow/public")
    assert r.status_code == 200
    items = r.json()
    hauspunkte = [i for i in items if i["kind"] == "hauspunkte"]
    assert len(hauspunkte) == 1
    assert hauspunkte[0]["title"] == "Hauspunkte"
    assert hauspunkte[0]["audience"] == "guest"


# ---------------------------------------------------------------------------
# Calendar item events
# ---------------------------------------------------------------------------

def test_public_calendar_item_filters_events_by_tag(client, db, teacher):
    _item(db, position=1, kind="calendar", audience="guest", calendar_tags=["Fest"])
    _entry(db, teacher.id, title="Schulfest", category="Schulgemeinschaft", tags=["Fest"])
    _entry(db, teacher.id, title="Sportfest", category="Schulgemeinschaft", tags=["Sport"])

    r = client.get("/api/slideshow/public")
    cal = next(i for i in r.json() if i["kind"] == "calendar")
    titles = {e["title"] for e in cal["events"]}
    assert titles == {"Schulfest"}


def test_public_calendar_item_date_window(client, db, teacher):
    _item(db, position=1, kind="calendar", audience="guest",
          calendar_tags=["Fest"], calendar_days_ahead=14)
    today = date.today()
    _entry(db, teacher.id, title="Zu spät vorbei", category="Schulgemeinschaft",
           tags=["Fest"], start_date=today - timedelta(days=10), end_date=today - timedelta(days=1))
    _entry(db, teacher.id, title="Zu weit weg", category="Schulgemeinschaft",
           tags=["Fest"], start_date=today + timedelta(days=15), end_date=today + timedelta(days=16))
    _entry(db, teacher.id, title="Im Fenster", category="Schulgemeinschaft",
           tags=["Fest"], start_date=today, end_date=today + timedelta(days=1))

    r = client.get("/api/slideshow/public")
    cal = next(i for i in r.json() if i["kind"] == "calendar")
    titles = {e["title"] for e in cal["events"]}
    assert titles == {"Im Fenster"}


def test_public_calendar_guest_sees_only_schulgemeinschaft_and_ferien(client, db, teacher):
    _item(db, position=1, kind="calendar", audience="guest", calendar_tags=["Fest"])
    _entry(db, teacher.id, title="Schulfest", category="Schulgemeinschaft", tags=["Fest"])
    _entry(db, teacher.id, title="Ferien", category="Ferien", tags=["Fest"])
    _entry(db, teacher.id, title="Dienstberatung", category="Kollegium", tags=["Fest"])

    r = client.get("/api/slideshow/public")
    cal = next(i for i in r.json() if i["kind"] == "calendar")
    titles = {e["title"] for e in cal["events"]}
    assert titles == {"Schulfest", "Ferien"}


def test_public_calendar_teacher_never_sees_persoenlich(client, db, teacher, teacher_token):
    _item(db, position=1, kind="calendar", audience="guest", calendar_tags=["Fest"])
    _entry(db, teacher.id, title="Zahnarzt", category="Persönlich", tags=["Fest"])
    _entry(db, teacher.id, title="Schulfest", category="Schulgemeinschaft", tags=["Fest"])

    client.cookies.clear()
    r = client.get("/api/slideshow/public", headers=auth(teacher_token))
    cal = next(i for i in r.json() if i["kind"] == "calendar")
    titles = {e["title"] for e in cal["events"]}
    assert titles == {"Schulfest"}


def test_public_calendar_student_stufe_rule(client, db, teacher):
    _item(db, position=1, kind="calendar", audience="guest", calendar_tags=["Fest"])
    _entry(db, teacher.id, title="Zuckertütenfest", category="Primar", tags=["Fest"])
    _entry(db, teacher.id, title="Berufsmesse", category="Sekundar", tags=["Fest"])

    token = _student_login(client, db, klasse="3b", username="p.primar")
    client.cookies.clear()
    r = client.get("/api/slideshow/public", headers=auth(token))
    cal = next(i for i in r.json() if i["kind"] == "calendar")
    titles = {e["title"] for e in cal["events"]}
    assert titles == {"Zuckertütenfest"}


# ---------------------------------------------------------------------------
# Management endpoint access control
# ---------------------------------------------------------------------------

MANAGEMENT_CALLS = [
    ("get", "/api/slideshow/items", None),
    ("post", "/api/slideshow/items", {"kind": "link", "url": "https://example.com"}),
    ("patch", "/api/slideshow/items/1", {"title": "x"}),
    ("put", "/api/slideshow/order", {"ids": [1]}),
    ("post", "/api/slideshow/items/delete", {"ids": [1]}),
]


def _call(client, method, path, body, headers=None):
    kwargs = {"headers": headers} if headers else {}
    if body is not None:
        kwargs["json"] = body
    return getattr(client, method)(path, **kwargs)


@pytest.mark.parametrize("method,path,body", MANAGEMENT_CALLS)
def test_management_endpoints_401_without_auth(client, method, path, body):
    r = _call(client, method, path, body)
    assert r.status_code == 401


@pytest.mark.parametrize("method,path,body", MANAGEMENT_CALLS)
def test_management_endpoints_403_for_student(client, db, method, path, body):
    token = _student_login(client, db)
    client.cookies.clear()
    r = _call(client, method, path, body, headers=auth(token))
    assert r.status_code == 403


@pytest.mark.parametrize("method,path,body", MANAGEMENT_CALLS)
def test_management_endpoints_403_for_plain_teacher(client, teacher_token, method, path, body):
    client.cookies.clear()
    r = _call(client, method, path, body, headers=auth(teacher_token))
    assert r.status_code == 403


@pytest.mark.parametrize("method,path,body", MANAGEMENT_CALLS)
def test_management_endpoints_ok_for_admin(client, admin_token, method, path, body):
    client.cookies.clear()
    r = _call(client, method, path, body, headers=auth(admin_token))
    assert r.status_code not in (401, 403)


def test_teacher_with_individual_grant_reaches_items(client, db, teacher, teacher_token):
    db.add(AdminFeatureGrant(feature_slug="slideshow", teacher_id=teacher.id))
    db.flush()
    client.cookies.clear()
    r = client.get("/api/slideshow/items", headers=auth(teacher_token))
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def test_upload_creates_items_with_correct_media_type(client, admin_token, tmp_path, monkeypatch):
    from api.routers import slideshow as slideshow_router
    monkeypatch.setattr(slideshow_router, "SLIDESHOW_DIR", tmp_path)
    client.cookies.clear()

    files = [
        ("files", ("bild.jpg", b"\xff\xd8\xff-jpegbytes", "image/jpeg")),
        ("files", ("doc.pdf", b"%PDF-1.4", "application/pdf")),
        ("files", ("clip.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4")),
    ]
    r = client.post("/api/slideshow/items/upload", headers=auth(admin_token), files=files)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 3
    media_types = {i["original_filename"]: i["media_type"] for i in items}
    assert media_types == {"bild.jpg": "image", "doc.pdf": "pdf", "clip.mp4": "video"}
    assert all(i["kind"] == "file" for i in items)


def test_upload_rejects_svg_and_creates_nothing_when_mixed(client, admin_token, tmp_path, monkeypatch):
    from api.routers import slideshow as slideshow_router
    monkeypatch.setattr(slideshow_router, "SLIDESHOW_DIR", tmp_path)
    client.cookies.clear()

    files = [
        ("files", ("ok.png", b"\x89PNG-bytes", "image/png")),
        ("files", ("bad.svg", b"<svg></svg>", "image/svg+xml")),
    ]
    r = client.post("/api/slideshow/items/upload", headers=auth(admin_token), files=files)
    assert r.status_code == 400

    client.cookies.clear()
    listed = client.get("/api/slideshow/items", headers=auth(admin_token)).json()
    assert not any(i["kind"] == "file" for i in listed)


def test_upload_oversize_rejected(client, admin_token, tmp_path, monkeypatch):
    from api.routers import slideshow as slideshow_router
    monkeypatch.setattr(slideshow_router, "SLIDESHOW_DIR", tmp_path)
    monkeypatch.setattr(slideshow_router, "MAX_UPLOAD_BYTES", 8)
    client.cookies.clear()

    files = [("files", ("gross.png", b"x" * 100, "image/png"))]
    r = client.post("/api/slideshow/items/upload", headers=auth(admin_token), files=files)
    assert r.status_code == 413


def test_upload_requires_admin_feature(client, db):
    files = [("files", ("ok.png", b"\x89PNG-bytes", "image/png"))]
    r = client.post("/api/slideshow/items/upload", files=files)
    assert r.status_code == 401

    token = _student_login(client, db)
    client.cookies.clear()
    r = client.post("/api/slideshow/items/upload", headers=auth(token), files=files)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Create (link / calendar / file rejected)
# ---------------------------------------------------------------------------

def test_create_link_item(client, admin_token):
    r = client.post("/api/slideshow/items", headers=auth(admin_token),
                    json={"kind": "link", "url": "https://example.com/video"})
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "link"
    assert r.json()["url"] == "https://example.com/video"


def test_create_link_item_invalid_url(client, admin_token):
    r = client.post("/api/slideshow/items", headers=auth(admin_token),
                    json={"kind": "link", "url": "not-a-url"})
    assert r.status_code == 400


@pytest.mark.parametrize("kind", ["calendar", "wochenspruch"])
def test_create_builtin_kinds_rejected(client, admin_token, kind):
    r = client.post("/api/slideshow/items", headers=auth(admin_token), json={"kind": kind})
    assert r.status_code == 400


def test_builtin_rows_exist_once(client, admin_token):
    client.get("/api/slideshow/public")
    client.cookies.clear()
    items = client.get("/api/slideshow/items", headers=auth(admin_token)).json()
    kinds = [i["kind"] for i in items]
    for kind, title in (("hauspunkte", "Hauspunkte"), ("calendar", "Termine"), ("wochenspruch", "Wochenspruch")):
        assert kinds.count(kind) == 1, kind
        assert next(i for i in items if i["kind"] == kind)["title"] == title


def test_create_kind_file_rejected(client, admin_token):
    r = client.post("/api/slideshow/items", headers=auth(admin_token), json={"kind": "file"})
    assert r.status_code == 400


def test_create_kind_hauspunkte_rejected(client, admin_token):
    r = client.post("/api/slideshow/items", headers=auth(admin_token), json={"kind": "hauspunkte"})
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# PATCH validation
# ---------------------------------------------------------------------------

def test_patch_updates_basic_fields(client, db, admin_token):
    it = _item(db, title="Alt")
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"title": "Neu", "active": False, "duration_seconds": 20})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["title"] == "Neu"
    assert body["active"] is False
    assert body["duration_seconds"] == 20


def test_patch_rejects_unknown_audience(client, db, admin_token):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"audience": "superadmin"})
    assert r.status_code == 400


@pytest.mark.parametrize("value", [2, 3601])
def test_patch_rejects_duration_out_of_bounds(client, db, admin_token, value):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"duration_seconds": value})
    assert r.status_code == 400


def test_patch_accepts_duration_bounds(client, db, admin_token):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"duration_seconds": 3})
    assert r.status_code == 200
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"duration_seconds": 3600})
    assert r.status_code == 200


def test_patch_rejects_slot_days_out_of_range(client, db, admin_token):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"slot_days": [0, 7]})
    assert r.status_code == 400


@pytest.mark.parametrize("bad_time", ["25:00", "12:60", "9:00", "1200", "noon"])
def test_patch_rejects_malformed_slot_times(client, db, admin_token, bad_time):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"slot_start": bad_time})
    assert r.status_code == 400


def test_patch_accepts_valid_slot_time(client, db, admin_token):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"slot_start": "23:59", "slot_end": "00:00"})
    assert r.status_code == 200


def test_patch_allows_logically_inconsistent_slot(client, db, admin_token):
    """end <= start is not rejected at PATCH time — it becomes a warning instead."""
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"slot_days": [0], "slot_start": "14:00", "slot_end": "13:00"})
    assert r.status_code == 200


@pytest.mark.parametrize("field", ["title", "active", "audience", "duration_seconds", "calendar_tags"])
def test_patch_rejects_null_for_required_fields(client, db, admin_token, field):
    it = _item(db)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token), json={field: None})
    assert r.status_code == 400


@pytest.mark.parametrize("value", [0, 366])
def test_calendar_days_ahead_out_of_bounds(client, db, admin_token, value):
    it = _item(db, kind="calendar", url=None, calendar_tags=["Fest"])
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"calendar_days_ahead": value})
    assert r.status_code == 400


def test_patch_rejects_unknown_calendar_category(client, db, admin_token):
    it = _item(db, kind="calendar", url=None)
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"calendar_categories": ["Primar", "Erfunden"]})
    assert r.status_code == 400
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token),
                     json={"calendar_categories": ["Primar", "Schulgemeinschaft"]})
    assert r.status_code == 200
    assert r.json()["calendar_categories"] == ["Primar", "Schulgemeinschaft"]


def test_patch_null_slot_days_clears_slot(client, db, admin_token):
    it = _item(db, slot_days=[0], slot_start="12:00", slot_end="13:00")
    r = client.patch(f"/api/slideshow/items/{it.id}", headers=auth(admin_token), json={"slot_days": None})
    assert r.status_code == 200
    assert r.json()["slot_days"] == []


def test_patch_unknown_id_404(client, admin_token):
    r = client.patch("/api/slideshow/items/999999", headers=auth(admin_token), json={"title": "x"})
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

def test_order_sets_positions(client, db, admin_token):
    a = _item(db, position=0, title="A")
    b = _item(db, position=1, title="B")
    c = _item(db, position=2, title="C")

    r = client.put("/api/slideshow/order", headers=auth(admin_token),
                   json={"ids": [c.id, a.id, b.id]})
    assert r.status_code == 200, r.text

    client.cookies.clear()
    listed = {i["id"]: i["position"] for i in client.get("/api/slideshow/items", headers=auth(admin_token)).json()}
    assert listed[c.id] == 0
    assert listed[a.id] == 1
    assert listed[b.id] == 2


def test_order_mismatched_ids_400(client, db, admin_token):
    a = _item(db, position=0, title="A")
    b = _item(db, position=1, title="B")

    r = client.put("/api/slideshow/order", headers=auth(admin_token), json={"ids": [a.id]})
    assert r.status_code == 400

    r = client.put("/api/slideshow/order", headers=auth(admin_token), json={"ids": [a.id, b.id, 999999]})
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Bulk delete
# ---------------------------------------------------------------------------

def test_bulk_delete_removes_items_and_files(client, db, admin_token, tmp_path, monkeypatch):
    from api.routers import slideshow as slideshow_router
    monkeypatch.setattr(slideshow_router, "SLIDESHOW_DIR", tmp_path)

    stored = "abc123.png"
    (tmp_path / stored).write_bytes(b"\x89PNG")
    a = _item(db, kind="file", media_type="image", stored_filename=stored, title="Bild")
    b = _item(db, kind="link", title="Link")

    r = client.post("/api/slideshow/items/delete", headers=auth(admin_token), json={"ids": [a.id, b.id]})
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": 2}
    assert not (tmp_path / stored).exists()

    client.cookies.clear()
    remaining = {i["id"] for i in client.get("/api/slideshow/items", headers=auth(admin_token)).json()}
    assert a.id not in remaining
    assert b.id not in remaining


@pytest.mark.parametrize("kind", ["hauspunkte", "calendar", "wochenspruch"])
def test_bulk_delete_builtin_id_rejected(client, db, admin_token, kind):
    client.get("/api/slideshow/public")  # ensures the built-in rows exist
    hauspunkte = db.query(SlideshowItem).filter_by(kind=kind).one()
    other = _item(db, title="Löschbar")

    r = client.post("/api/slideshow/items/delete", headers=auth(admin_token),
                    json={"ids": [hauspunkte.id, other.id]})
    assert r.status_code == 400

    client.cookies.clear()
    remaining = {i["id"] for i in client.get("/api/slideshow/items", headers=auth(admin_token)).json()}
    assert other.id in remaining
    assert hauspunkte.id in remaining


# ---------------------------------------------------------------------------
# Warnings
# ---------------------------------------------------------------------------

def _warnings_for(client, admin_token, item_id) -> list[str]:
    listed = client.get("/api/slideshow/items", headers=auth(admin_token)).json()
    return next(i["warnings"] for i in listed if i["id"] == item_id)


def test_warning_slot_incomplete(client, db, admin_token):
    it = _item(db, slot_days=[0], slot_start=None, slot_end=None)
    assert "Zeitfenster unvollständig" in _warnings_for(client, admin_token, it.id)


def test_warning_end_before_start(client, db, admin_token):
    it = _item(db, slot_days=[0], slot_start="14:00", slot_end="13:00")
    assert "Zeitfenster: Ende liegt vor dem Beginn" in _warnings_for(client, admin_token, it.id)


def test_warning_date_range_inverted(client, db, admin_token):
    it = _item(db, slot_from=date(2026, 9, 20), slot_until=date(2026, 9, 10))
    assert "Zeitraum: Enddatum vor Startdatum" in _warnings_for(client, admin_token, it.id)


def test_warning_expired(client, db, admin_token):
    expired = date.today() - timedelta(days=5)
    it = _item(db, slot_until=expired)
    expected = f"Abgelaufen (Zeitfenster endete am {expired.strftime('%d.%m.%Y')})"
    assert expected in _warnings_for(client, admin_token, it.id)


def test_warning_missing_file(client, db, admin_token, tmp_path, monkeypatch):
    from api.routers import slideshow as slideshow_router
    monkeypatch.setattr(slideshow_router, "SLIDESHOW_DIR", tmp_path)
    it = _item(db, kind="file", media_type="image", stored_filename="nichtvorhanden.png")
    assert "Datei fehlt" in _warnings_for(client, admin_token, it.id)


def test_calendar_without_filters_has_no_tag_warning(client, db, admin_token, teacher):
    it = _item(db, kind="calendar", url=None, calendar_tags=[])
    _entry(db, teacher.id, title="Irgendwas", tags=[])
    assert _warnings_for(client, admin_token, it.id) == []


def test_warning_no_upcoming_entries(client, db, admin_token, teacher):
    it = _item(db, kind="calendar", calendar_tags=["Nirgends"], calendar_days_ahead=14)
    _entry(db, teacher.id, title="Anderer Tag", tags=["Anders"])
    assert "Keine anstehenden Termine" in _warnings_for(client, admin_token, it.id)


def test_warning_invalid_link(client, db, admin_token):
    it = _item(db, kind="link", url="ftp://example.com/file")
    assert "Ungültiger Link" in _warnings_for(client, admin_token, it.id)


def test_warning_overlap_true_positive_exact_message(client, db, admin_token):
    # Both Monday, 12:00-12:45 and 12:30-13:00 -> overlap is 12:30-12:45.
    a = _item(db, title="Slide A", slot_days=[0], slot_start="12:00", slot_end="12:45")
    b = _item(db, title="Slide B", slot_days=[0], slot_start="12:30", slot_end="13:00")

    warnings_a = _warnings_for(client, admin_token, a.id)
    warnings_b = _warnings_for(client, admin_token, b.id)
    assert "Überschneidet sich mit „Slide B“ (Mo 12:30–12:45)" in warnings_a
    assert "Überschneidet sich mit „Slide A“ (Mo 12:30–12:45)" in warnings_b


def test_warning_touching_slots_not_overlapping(client, db, admin_token):
    a = _item(db, title="Slide A", slot_days=[0], slot_start="12:00", slot_end="12:45")
    b = _item(db, title="Slide B", slot_days=[0], slot_start="12:45", slot_end="13:00")

    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, a.id))
    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, b.id))


def test_warning_different_weekdays_not_overlapping(client, db, admin_token):
    a = _item(db, title="Slide A", slot_days=[0], slot_start="12:00", slot_end="12:45")
    b = _item(db, title="Slide B", slot_days=[1], slot_start="12:00", slot_end="12:45")

    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, a.id))
    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, b.id))


def test_warning_disjoint_date_ranges_not_overlapping(client, db, admin_token):
    a = _item(db, title="Slide A", slot_days=[0], slot_start="12:00", slot_end="12:45",
              slot_from=date(2026, 1, 1), slot_until=date(2026, 1, 31))
    b = _item(db, title="Slide B", slot_days=[0], slot_start="12:00", slot_end="12:45",
              slot_from=date(2026, 3, 1), slot_until=date(2026, 3, 31))

    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, a.id))
    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, b.id))


def test_warning_inactive_item_does_not_cause_overlap(client, db, admin_token):
    a = _item(db, title="Slide A", active=True, slot_days=[0], slot_start="12:00", slot_end="12:45")
    b = _item(db, title="Slide B", active=False, slot_days=[0], slot_start="12:30", slot_end="13:00")

    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, a.id))
    # Inactive items still get validity warnings, just not overlap ones.
    assert not any("Überschneidet" in w for w in _warnings_for(client, admin_token, b.id))


def test_upload_dir_is_repo_data_dir():
    """Uploads must land in <repo>/data/slideshow — the directory mounted at /uploads/slideshow."""
    from pathlib import Path
    from api.routers import slideshow
    repo_root = Path(__file__).resolve().parent.parent.parent
    assert slideshow.SLIDESHOW_DIR.resolve() == repo_root / "data" / "slideshow"


# ---------------------------------------------------------------------------
# Wochenspruch (pfarr.tools)
# ---------------------------------------------------------------------------

_WS_SAMPLE = [{
    "Titel": "15. Sonntag nach Trinitatis",
    "Festzeit": "Trinitatiszeit",
    "Datum formatiert": "13.09.2026",
    "Wochenspruch": "1. Petr 5,7",
    "Wochenspruch-Text": "Alle eure Sorge werft auf ihn; denn er sorgt für euch.",
    "Wochenpsalm": "Ps 127,1-2",
    "liturgische Farbe": "Grün",
    "Farbcode": "#2d7c31",
    "Hintergrundbild": "https://kirchenjahr-evangelisch.de/bild.jpg",
    "Bildquelle": "© Unsplash / Birte Liu",
    "Wochenlieder": ["EG 369: Wer nur den lieben Gott lässt walten"],
    "Url": "https://kirchenjahr-evangelisch.de/15-sonntag-nach-trinitatis/2026",
}, {
    "Titel": "Zweiter Eintrag", "Wochenspruch-Text": "nicht verwenden",
}]


@pytest.fixture()
def ws_api(monkeypatch):
    """Replaces the network call; `calls` counts fetches, `fail` simulates an outage."""
    from api.routers import slideshow
    state = {"calls": 0, "fail": False}

    def fake_load(day):
        state["calls"] += 1
        if state["fail"]:
            raise OSError("offline")
        return _WS_SAMPLE

    monkeypatch.setattr(slideshow, "_load_wochenspruch", fake_load)
    slideshow._WOCHENSPRUCH_CACHE.clear()
    yield state
    slideshow._WOCHENSPRUCH_CACHE.clear()


def test_public_wochenspruch_payload(client, db, ws_api):
    _item(db, position=1, kind="wochenspruch", title="Wochenspruch", url=None)
    r = client.get("/api/slideshow/public")
    ws = next(i for i in r.json() if i["kind"] == "wochenspruch")["wochenspruch"]
    assert ws == {
        "sunday": "15. Sonntag nach Trinitatis",
        "season": "Trinitatiszeit",
        "date_label": "13.09.2026",
        "text": "Alle eure Sorge werft auf ihn; denn er sorgt für euch.",
        "reference": "1. Petr 5,7",
        "psalm": "Ps 127,1-2",
        "color": "#2d7c31",
        "color_name": "Grün",
        "background_url": "https://kirchenjahr-evangelisch.de/bild.jpg",
        "image_credit": "© Unsplash / Birte Liu",
        "hymns": ["EG 369: Wer nur den lieben Gott lässt walten"],
        "source_url": "https://kirchenjahr-evangelisch.de/15-sonntag-nach-trinitatis/2026",
    }


def test_other_kinds_have_no_wochenspruch_payload(client, db, ws_api):
    _item(db, position=1, title="Link")
    r = client.get("/api/slideshow/public")
    assert all(i["wochenspruch"] is None for i in r.json() if i["kind"] != "wochenspruch")


def test_inactive_wochenspruch_is_not_fetched(client, db, ws_api):
    _item(db, position=1, kind="wochenspruch", url=None, active=False)
    client.get("/api/slideshow/public")
    assert ws_api["calls"] == 0


def test_wochenspruch_is_cached(client, db, ws_api):
    _item(db, position=1, kind="wochenspruch", url=None)
    client.get("/api/slideshow/public")
    client.get("/api/slideshow/public")
    assert ws_api["calls"] == 1


def test_wochenspruch_outage_without_cache(client, db, admin_token, ws_api):
    ws_api["fail"] = True
    it = _item(db, position=1, kind="wochenspruch", url=None)
    r = client.get("/api/slideshow/public")
    assert r.status_code == 200
    assert next(i for i in r.json() if i["id"] == it.id)["wochenspruch"] is None
    assert "Wochenspruch nicht abrufbar" in _warnings_for(client, admin_token, it.id)


def test_wochenspruch_outage_keeps_last_good_value(client, db, ws_api, monkeypatch):
    from api.routers import slideshow
    _item(db, position=1, kind="wochenspruch", url=None)
    client.get("/api/slideshow/public")
    # expire the cache entry, then fail the refresh
    monkeypatch.setattr(slideshow, "WOCHENSPRUCH_TTL_SECONDS", -1)
    ws_api["fail"] = True
    r = client.get("/api/slideshow/public")
    ws = next(i for i in r.json() if i["kind"] == "wochenspruch")["wochenspruch"]
    assert ws is not None and ws["reference"] == "1. Petr 5,7"


# ---------------------------------------------------------------------------
# Calendar filters: tags AND categories, empty = no restriction
# ---------------------------------------------------------------------------

def _events(client, headers=None):
    r = client.get("/api/slideshow/public", **({"headers": headers} if headers else {}))
    cal = next(i for i in r.json() if i["kind"] == "calendar")
    return {e["title"] for e in cal["events"]}


def test_calendar_without_filters_shows_all_visible(client, db, teacher, teacher_token):
    _item(db, position=1, kind="calendar", url=None)
    _entry(db, teacher.id, title="Fest", category="Schulgemeinschaft", tags=["Fest"])
    _entry(db, teacher.id, title="Ohne Tag", category="Kollegium", tags=[])
    _entry(db, teacher.id, title="Privat", category="Persönlich", tags=[])
    client.cookies.clear()
    assert _events(client, auth(teacher_token)) == {"Fest", "Ohne Tag"}


def test_calendar_category_filter(client, db, teacher, teacher_token):
    _item(db, position=1, kind="calendar", url=None, calendar_categories=["Primar", "Schulgemeinschaft"])
    _entry(db, teacher.id, title="Primar", category="Primar", tags=[])
    _entry(db, teacher.id, title="Sekundar", category="Sekundar", tags=[])
    _entry(db, teacher.id, title="Alle", category="Schulgemeinschaft", tags=["Fest"])
    client.cookies.clear()
    assert _events(client, auth(teacher_token)) == {"Primar", "Alle"}


def test_calendar_tags_and_categories_combine(client, db, teacher, teacher_token):
    _item(db, position=1, kind="calendar", url=None,
          calendar_tags=["Fest"], calendar_categories=["Schulgemeinschaft"])
    _entry(db, teacher.id, title="Treffer", category="Schulgemeinschaft", tags=["Fest"])
    _entry(db, teacher.id, title="Falsche Kategorie", category="Kollegium", tags=["Fest"])
    _entry(db, teacher.id, title="Falscher Tag", category="Schulgemeinschaft", tags=["Sport"])
    client.cookies.clear()
    assert _events(client, auth(teacher_token)) == {"Treffer"}


def test_calendar_category_filter_still_respects_viewer(client, db, teacher):
    _item(db, position=1, kind="calendar", url=None, calendar_categories=["Kollegium", "Ferien"])
    _entry(db, teacher.id, title="Dienstberatung", category="Kollegium", tags=[])
    _entry(db, teacher.id, title="Herbstferien", category="Ferien", tags=[])
    assert _events(client) == {"Herbstferien"}


def test_event_preview_for_admin(client, db, admin_token, teacher):
    it = _item(db, position=1, kind="calendar", url=None, calendar_categories=["Kollegium"])
    _entry(db, teacher.id, title="Dienstberatung", category="Kollegium", tags=["DB"])
    _entry(db, teacher.id, title="Schulfest", category="Schulgemeinschaft", tags=[])
    _entry(db, teacher.id, title="Privat", category="Persönlich", tags=[])
    client.cookies.clear()
    r = client.get(f"/api/slideshow/items/{it.id}/events", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    assert [(e["title"], e["category"]) for e in r.json()] == [("Dienstberatung", "Kollegium")]


def test_event_preview_requires_calendar_item(client, db, admin_token):
    it = _item(db, position=1)
    r = client.get(f"/api/slideshow/items/{it.id}/events", headers=auth(admin_token))
    assert r.status_code == 400


def test_event_preview_requires_admin_feature(client, db, teacher_token):
    it = _item(db, position=1, kind="calendar", url=None)
    client.cookies.clear()
    r = client.get(f"/api/slideshow/items/{it.id}/events", headers=auth(teacher_token))
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Bulk patch (multi-select edit)
# ---------------------------------------------------------------------------

def test_bulk_patch_applies_to_all(client, db, admin_token):
    a = _item(db, title="A")
    b = _item(db, title="B")
    c = _item(db, title="C")
    r = client.patch("/api/slideshow/items", headers=auth(admin_token), json={
        "ids": [a.id, b.id],
        "patch": {"audience": "teacher", "duration_seconds": 30,
                  "slot_days": [0, 1], "slot_start": "12:00", "slot_end": "12:45"},
    })
    assert r.status_code == 200, r.text
    assert {i["id"] for i in r.json()} == {a.id, b.id}
    client.cookies.clear()
    listed = {i["id"]: i for i in client.get("/api/slideshow/items", headers=auth(admin_token)).json()}
    for it in (a, b):
        assert listed[it.id]["audience"] == "teacher"
        assert listed[it.id]["duration_seconds"] == 30
        assert listed[it.id]["slot_start"] == "12:00"
    assert listed[c.id]["audience"] == "guest"


def test_bulk_patch_validates_before_writing(client, db, admin_token):
    a = _item(db, title="A")
    r = client.patch("/api/slideshow/items", headers=auth(admin_token),
                     json={"ids": [a.id], "patch": {"audience": "guest", "duration_seconds": 1}})
    assert r.status_code == 400
    r = client.patch("/api/slideshow/items", headers=auth(admin_token),
                     json={"ids": [a.id, 999999], "patch": {"active": False}})
    assert r.status_code == 404
    client.cookies.clear()
    listed = {i["id"]: i for i in client.get("/api/slideshow/items", headers=auth(admin_token)).json()}
    assert listed[a.id]["active"] is True


def test_bulk_patch_requires_admin_feature(client, db, teacher_token):
    a = _item(db, title="A")
    client.cookies.clear()
    r = client.patch("/api/slideshow/items", headers=auth(teacher_token),
                     json={"ids": [a.id], "patch": {"active": False}})
    assert r.status_code == 403
