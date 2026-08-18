"""Tests for the Kalender router: CRUD, category-based visibility, tags,
settings, Feriendaten fetch, ICS export/import."""
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
from api.models import Student
from api.auth import hash_password


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _student_login(client, db) -> str:
    s = Student(nachname="Muster", vorname="Mia", klasse="5a", geschlecht="weiblich",
               username="m.muster", password_hash=hash_password("pw"), active=True)
    db.add(s)
    db.flush()
    r = client.post("/api/auth/login", json={"username": "m.muster", "password": "pw"})
    return r.json()["access_token"]


def test_create_and_list_entry(client, teacher_token):
    r = client.post("/api/calendar", json={
        "title": "Dienstberatung", "category": "Kollegium",
        "start_date": "2026-09-10", "end_date": "2026-09-10", "tags": ["Dienstberatung"],
    }, headers=_auth(teacher_token))
    assert r.status_code == 201
    assert r.json()["tags"] == ["Dienstberatung"]
    assert r.json()["all_day"] is True

    r = client.get("/api/calendar", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_create_requires_teacher(client):
    r = client.post("/api/calendar", json={
        "title": "X", "category": "Kollegium", "start_date": "2026-01-01", "end_date": "2026-01-01",
    })
    assert r.status_code == 401


def test_rejects_unknown_category(client, teacher_token):
    r = client.post("/api/calendar", json={
        "title": "X", "category": "Unbekannt", "start_date": "2026-01-01", "end_date": "2026-01-01",
    }, headers=_auth(teacher_token))
    assert r.status_code == 400


def test_rejects_end_before_start(client, teacher_token):
    r = client.post("/api/calendar", json={
        "title": "X", "category": "Kollegium", "start_date": "2026-01-05", "end_date": "2026-01-01",
    }, headers=_auth(teacher_token))
    assert r.status_code == 400


def test_timed_event_requires_times(client, teacher_token):
    r = client.post("/api/calendar", json={
        "title": "X", "category": "Kollegium", "start_date": "2026-01-01", "end_date": "2026-01-01",
        "all_day": False,
    }, headers=_auth(teacher_token))
    assert r.status_code == 400

    r = client.post("/api/calendar", json={
        "title": "X", "category": "Kollegium", "start_date": "2026-01-01", "end_date": "2026-01-01",
        "all_day": False, "start_time": "14:00", "end_time": "15:30",
    }, headers=_auth(teacher_token))
    assert r.status_code == 201
    assert r.json()["start_time"] == "14:00"


def test_student_only_sees_schulgemeinschaft_and_ferien(client, db, teacher_token):
    client.post("/api/calendar", json={
        "title": "Dienstberatung", "category": "Kollegium",
        "start_date": "2026-02-01", "end_date": "2026-02-01", "tags": [],
    }, headers=_auth(teacher_token))
    client.post("/api/calendar", json={
        "title": "Schulfest", "category": "Schulgemeinschaft",
        "start_date": "2026-06-01", "end_date": "2026-06-01", "tags": [],
    }, headers=_auth(teacher_token))
    client.post("/api/calendar", json={
        "title": "Sommerferien", "category": "Ferien",
        "start_date": "2026-07-01", "end_date": "2026-08-01", "tags": ["Ferien"],
    }, headers=_auth(teacher_token))

    student_token = _student_login(client, db)
    client.cookies.clear()
    r = client.get("/api/calendar", headers=_auth(student_token))
    assert r.status_code == 200
    titles = {e["title"] for e in r.json()}
    assert titles == {"Schulfest", "Sommerferien"}


def test_persoenlich_category_visible_only_to_creator(client, teacher_token, admin_token):
    client.cookies.clear()
    r = client.post("/api/calendar", json={
        "title": "Zahnarzt", "category": "Persönlich",
        "start_date": "2026-03-02", "end_date": "2026-03-02", "tags": [],
    }, headers=_auth(teacher_token))
    assert r.status_code == 201

    client.cookies.clear()
    r = client.get("/api/calendar", headers=_auth(teacher_token))
    assert "Zahnarzt" in {e["title"] for e in r.json()}

    client.cookies.clear()
    r = client.get("/api/calendar", headers=_auth(admin_token))
    assert "Zahnarzt" not in {e["title"] for e in r.json()}


def test_update_and_delete_entry(client, teacher_token):
    r = client.post("/api/calendar", json={
        "title": "Klassenfahrt 8a", "category": "Sekundar",
        "start_date": "2026-05-01", "end_date": "2026-05-05", "tags": [],
    }, headers=_auth(teacher_token))
    entry_id = r.json()["id"]

    r = client.put(f"/api/calendar/{entry_id}", json={
        "title": "Klassenfahrt 8a (verschoben)", "category": "Sekundar",
        "start_date": "2026-05-08", "end_date": "2026-05-12", "tags": ["Klassenfahrt"],
    }, headers=_auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["title"] == "Klassenfahrt 8a (verschoben)"

    r = client.delete(f"/api/calendar/{entry_id}", headers=_auth(teacher_token))
    assert r.status_code == 204
    assert client.get("/api/calendar", headers=_auth(teacher_token)).json() == []


def test_create_and_list_tags(client, teacher_token):
    r = client.post("/api/calendar/tags", json={"name": "Projekttage", "color": "#ff00ff"},
                    headers=_auth(teacher_token))
    assert r.status_code == 201
    assert r.json()["color"] == "#ff00ff"

    r = client.get("/api/calendar/tags", headers=_auth(teacher_token))
    names = [t["name"] for t in r.json()]
    assert "Projekttage" in names


def test_create_tag_updates_color_if_exists(client, teacher_token):
    client.post("/api/calendar/tags", json={"name": "Wichtig", "color": "#111111"}, headers=_auth(teacher_token))
    r = client.post("/api/calendar/tags", json={"name": "Wichtig", "color": "#222222"}, headers=_auth(teacher_token))
    assert r.status_code == 201
    assert r.json()["color"] == "#222222"
    all_tags = client.get("/api/calendar/tags", headers=_auth(teacher_token)).json()
    assert sum(1 for t in all_tags if t["name"] == "Wichtig") == 1


def test_settings_get_default_and_admin_only_update(client, teacher_token, admin_token):
    # teacher_token/admin_token fixtures each log in via `client`, leaving a
    # session cookie behind — cookie auth takes priority over the Bearer
    # header (see auth._resolve_token), so clear it to test each token in isolation.
    client.cookies.clear()
    r = client.get("/api/calendar/settings", headers=_auth(teacher_token))
    assert r.status_code == 200
    assert r.json()["bundesland"] == "TH"

    client.cookies.clear()
    r = client.put("/api/calendar/settings", json={"bundesland": "BY"}, headers=_auth(teacher_token))
    assert r.status_code == 403

    client.cookies.clear()
    r = client.put("/api/calendar/settings", json={"bundesland": "BY"}, headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["bundesland"] == "BY"


def test_settings_rejects_unknown_bundesland(client, admin_token):
    r = client.put("/api/calendar/settings", json={"bundesland": "XX"}, headers=_auth(admin_token))
    assert r.status_code == 400


def test_fetch_holidays_imports_as_ferien(client, admin_token):
    fake_response = MagicMock()
    fake_response.raise_for_status.return_value = None
    fake_response.json.return_value = [
        {"startDate": "2026-07-04", "endDate": "2026-08-14",
         "name": [{"language": "DE", "text": "Sommerferien"}]},
        {"startDate": "2026-10-12", "endDate": "2026-10-24",
         "name": [{"language": "DE", "text": "Herbstferien"}]},
    ]
    with patch("api.routers.calendar.httpx.get", return_value=fake_response) as mock_get:
        r = client.post("/api/calendar/holidays/fetch?school_year_start=2026", headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["created"] == 2
        assert mock_get.call_args.kwargs["params"]["subdivisionCode"] == "DE-TH"

    entries = client.get("/api/calendar", headers=_auth(admin_token)).json()
    assert {e["title"] for e in entries} == {"Sommerferien", "Herbstferien"}
    assert all(e["category"] == "Ferien" for e in entries)

    # Re-fetching the same range should not duplicate entries.
    with patch("api.routers.calendar.httpx.get", return_value=fake_response):
        r = client.post("/api/calendar/holidays/fetch?school_year_start=2026", headers=_auth(admin_token))
        assert r.json()["created"] == 0


def test_fetch_holidays_requires_admin(client, teacher_token):
    r = client.post("/api/calendar/holidays/fetch?school_year_start=2026", headers=_auth(teacher_token))
    assert r.status_code == 403


def test_export_ics_filters_by_category_and_includes_color(client, teacher_token):
    # Dates within the current school-year window (no Sommerferien seeded -> the
    # window is open-ended upward from 1. August, so any future date qualifies).
    d1 = date.today() + timedelta(days=10)
    d2 = d1 + timedelta(days=1)
    client.post("/api/calendar/tags", json={"name": "Dienstberatung", "color": "#8b5cf6"}, headers=_auth(teacher_token))
    client.post("/api/calendar", json={
        "title": "Nur Kollegium", "category": "Kollegium",
        "start_date": d1.isoformat(), "end_date": d1.isoformat(), "tags": ["Dienstberatung"],
    }, headers=_auth(teacher_token))
    client.post("/api/calendar", json={
        "title": "Für alle", "category": "Schulgemeinschaft",
        "start_date": d1.isoformat(), "end_date": d2.isoformat(), "tags": [],
    }, headers=_auth(teacher_token))

    r = client.get("/api/calendar/export.ics?categories=Schulgemeinschaft", headers=_auth(teacher_token))
    assert r.status_code == 200
    body = r.text
    assert "Für alle" in body
    assert "Nur Kollegium" not in body
    assert f"DTSTART;VALUE=DATE:{d1.strftime('%Y%m%d')}" in body
    dtend_excl = d2 + timedelta(days=1)
    assert f"DTEND;VALUE=DATE:{dtend_excl.strftime('%Y%m%d')}" in body  # exclusive end = last day + 1

    r2 = client.get("/api/calendar/export.ics?tags=Dienstberatung", headers=_auth(teacher_token))
    assert "Nur Kollegium" in r2.text
    assert "COLOR:#8b5cf6" in r2.text


def test_export_ics_gated_to_school_year_between_sommerferien(client, teacher_token):
    """Export includes only entries in the current school year, bounded by
    Sommerferien -> next Sommerferien, and names the calendar after that year."""
    today = date.today()
    opens = today - timedelta(days=30)   # this year's Sommerferien (already begun)
    closes = today + timedelta(days=300)  # next year's Sommerferien (in the future)
    for start in (opens, closes):
        client.post("/api/calendar", json={
            "title": "Sommerferien", "category": "Ferien",
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=40)).isoformat(), "tags": ["Ferien"],
        }, headers=_auth(teacher_token))

    # One entry before the window, one inside, one after.
    client.post("/api/calendar", json={
        "title": "Letztes Jahr", "category": "Schulgemeinschaft",
        "start_date": (opens - timedelta(days=10)).isoformat(),
        "end_date": (opens - timedelta(days=10)).isoformat(), "tags": [],
    }, headers=_auth(teacher_token))
    client.post("/api/calendar", json={
        "title": "Dieses Jahr", "category": "Schulgemeinschaft",
        "start_date": today.isoformat(), "end_date": today.isoformat(), "tags": [],
    }, headers=_auth(teacher_token))
    client.post("/api/calendar", json={
        "title": "Nächstes Jahr", "category": "Schulgemeinschaft",
        "start_date": (closes + timedelta(days=10)).isoformat(),
        "end_date": (closes + timedelta(days=10)).isoformat(), "tags": [],
    }, headers=_auth(teacher_token))

    body = client.get("/api/calendar/export.ics", headers=_auth(teacher_token)).text
    assert "Dieses Jahr" in body
    assert "Letztes Jahr" not in body   # before this year's Sommerferien
    assert "Nächstes Jahr" not in body  # at/after next Sommerferien (window flip)
    assert f"X-WR-CALNAME:EGE{opens.year}/{opens.year + 1}" in body


def test_import_ics_roundtrip(client, teacher_token):
    ics = (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"
        "BEGIN:VEVENT\r\n"
        "UID:test-1@example.com\r\n"
        "DTSTART;VALUE=DATE:20260701\r\n"
        "DTEND;VALUE=DATE:20260703\r\n"
        "SUMMARY:Sommerfest\r\n"
        "DESCRIPTION:Grillen und Spiele\r\n"
        "CATEGORIES:Events\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )
    r = client.post(
        "/api/calendar/import.ics",
        files={"file": ("import.ics", ics.encode(), "text/calendar")},
        headers=_auth(teacher_token),
    )
    assert r.status_code == 200
    assert r.json()["created"] == 1

    entries = client.get("/api/calendar", headers=_auth(teacher_token)).json()
    assert len(entries) == 1
    e = entries[0]
    assert e["title"] == "Sommerfest"
    assert e["description"] == "Grillen und Spiele"
    assert e["start_date"] == "2026-07-01"
    assert e["end_date"] == "2026-07-02"  # exclusive DTEND -1 day
    assert e["category"] == "Kollegium"  # safe default, editable afterward
    assert e["tags"] == ["Events"]
