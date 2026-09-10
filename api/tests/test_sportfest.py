"""Tests for Sportfest disciplines, results, and auswertung."""
import pytest
from api.models import Student, SportfestDiscipline, SportfestResult


@pytest.fixture()
def disciplines(db):
    discs = [
        SportfestDiscipline(id="sprint", name="Sprint", enabled=True),
        SportfestDiscipline(id="ausdauerlauf", name="Ausdauerlauf", enabled=True),
        SportfestDiscipline(id="weitsprung", name="Weitsprung", enabled=True),
        SportfestDiscipline(id="ballwurf", name="Ballwurf", enabled=True),
    ]
    for d in discs:
        db.add(d)
    db.flush()
    return discs


@pytest.fixture()
def student_male(db) -> Student:
    s = Student(nachname="Tester", vorname="Max", klasse="7a", jahrgang=7, geschlecht="männlich")
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def student_female(db) -> Student:
    s = Student(nachname="Muster", vorname="Lisa", klasse="7a", jahrgang=7, geschlecht="weiblich")
    db.add(s)
    db.flush()
    return s


# ---------------------------------------------------------------------------
# Disciplines
# ---------------------------------------------------------------------------

def test_list_disciplines_requires_login(client, disciplines, teacher_token):
    client.cookies.clear()  # teacher_token login leaves a session cookie behind
    assert client.get("/api/sportfest/disciplines").status_code == 401
    r = client.get("/api/sportfest/disciplines", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r.status_code == 200
    assert len(r.json()) == 4


def test_toggle_discipline_requires_admin(client, teacher_token, disciplines):
    r = client.put(
        "/api/sportfest/disciplines/sprint/enabled?enabled=false",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 403


def test_toggle_discipline_admin(client, admin_token, disciplines, db):
    r = client.put(
        "/api/sportfest/disciplines/sprint/enabled?enabled=false",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["enabled"] is False

    disc = db.get(SportfestDiscipline, "sprint")
    assert disc.enabled is False


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

def test_upsert_result_requires_teacher(client, disciplines, student_male):
    r = client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "9.5"},
    )
    assert r.status_code == 401


def test_upsert_sprint_result(client, teacher_token, disciplines, student_male):
    r = client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "9.5"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["value"] == pytest.approx(9.5)
    assert body["points"] is not None
    assert body["points"] >= 0


def test_upsert_updates_existing(client, teacher_token, disciplines, student_male):
    client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "9.5"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    r2 = client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "8.9"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r2.json()["value"] == pytest.approx(8.9)


def test_upsert_time_format(client, teacher_token, disciplines, student_male):
    r = client.put(
        f"/api/sportfest/results/{student_male.id}/ausdauerlauf",
        json={"value_raw": "4:30.0"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200
    assert r.json()["value"] == pytest.approx(270.0)


def test_upsert_invalid_value(client, teacher_token, disciplines, student_male):
    r = client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "not-a-number"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 422


def test_delete_result(client, teacher_token, disciplines, student_male, db):
    client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "9.5"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    r = client.delete(
        f"/api/sportfest/results/{student_male.id}/sprint",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 204
    assert db.query(SportfestResult).count() == 0


# ---------------------------------------------------------------------------
# Auswertung
# ---------------------------------------------------------------------------

def test_gesamt_ist_nicht_oeffentlich(client, disciplines, student_male, teacher_token):
    """Die Gesamtwertung listet jedes Kind der Schule mit seiner Punktzahl —
    das ist Lehrersache. Oeffentlich bleibt nur die Siegerehrung je Disziplin
    (siehe test_sportfest_auswertung.py)."""
    client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "9.5"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    client.cookies.clear()  # remove auth cookie → simulate unauthenticated browser
    assert client.get("/api/sportfest/auswertung/gesamt").status_code == 401


def test_gesamt_authenticated_shows_name(client, disciplines, student_male, teacher_token):
    client.put(
        f"/api/sportfest/results/{student_male.id}/sprint",
        json={"value_raw": "9.5"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    r = client.get(
        "/api/sportfest/auswertung/gesamt",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert r.status_code == 200
    names = [e["name"] for e in r.json()]
    assert any(names)  # at least one name present


def test_disziplin_ranking(client, disciplines, student_male, student_female, teacher_token):
    client.put(
        f"/api/sportfest/results/{student_male.id}/weitsprung",
        json={"value_raw": "4.50"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    client.put(
        f"/api/sportfest/results/{student_female.id}/weitsprung",
        json={"value_raw": "3.80"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    r = client.get("/api/sportfest/auswertung/disziplin")
    assert r.status_code == 200
    weitsprung_entries = [e for e in r.json() if e["discipline_id"] == "weitsprung"]
    assert len(weitsprung_entries) == 2
    # First entry should have higher points
    assert weitsprung_entries[0]["points"] >= weitsprung_entries[1]["points"]


# ---------------------------------------------------------------------------
# Scoring algorithm sanity checks
# ---------------------------------------------------------------------------

from api.routers.sportfest.scoring import calculate_points, parse_value


def test_parse_value_decimal():
    assert parse_value("9.5") == pytest.approx(9.5)


def test_parse_value_mm_ss():
    assert parse_value("4:30.0") == pytest.approx(270.0)


def test_parse_value_invalid():
    assert parse_value("abc") is None


def test_sprint_scoring_male():
    pts = calculate_points("sprint", 9.5, "7a", "männlich")
    assert pts is not None
    assert pts > 0


def test_sprint_scoring_female():
    pts = calculate_points("sprint", 9.5, "7a", "weiblich")
    assert pts is not None
    assert pts > 0


def test_weitsprung_scoring():
    pts = calculate_points("weitsprung", 4.50, "7a", "männlich")
    assert pts is not None
    assert pts > 0


def test_unknown_discipline_returns_none():
    assert calculate_points("unknown", 10.0, "7a", "männlich") is None
