"""Offline-Dateien: Auflistung, Download und wer sie bekommen darf."""
import pytest  # noqa: F401

from api.models import Student, ToolAvailability
from api.routers import standalone
from api.tests.conftest import auth


@pytest.fixture()
def bundle_dir(tmp_path, monkeypatch):
    """Eigener Ordner je Test — sonst hinge das Ergebnis am echten Build."""
    monkeypatch.setattr(standalone, "STANDALONE_DIR", tmp_path)
    return tmp_path


def _build(bundle_dir, content="<!doctype html><title>Simulationen</title>"):
    path = bundle_dir / "simulationen.html"
    path.write_text(content, encoding="utf-8")
    return path


def _student(db, klass):
    s = Student(nachname="Sch", vorname="Ueler", klasse=klass.code,
                class_id=klass.id, geschlecht="m", active=True)
    db.add(s)
    db.flush()
    return s


# ── Auflistung ───────────────────────────────────────────────────────────────

def test_listing_needs_a_login(client, bundle_dir):
    assert client.get("/api/standalone").status_code in (401, 403)


def test_listing_says_it_is_not_built_yet(client, teacher_token, bundle_dir):
    body = client.get("/api/standalone", headers=auth(teacher_token)).json()
    assert len(body) == 1
    assert body[0]["name"] == "simulationen"
    assert body[0]["available"] is False
    assert body[0]["size_bytes"] is None


def test_listing_reports_size_once_built(client, teacher_token, bundle_dir):
    path = _build(bundle_dir)
    body = client.get("/api/standalone", headers=auth(teacher_token)).json()[0]
    assert body["available"] is True
    assert body["size_bytes"] == path.stat().st_size
    assert body["built_at"]
    assert set(body["tools"]) == {"gleichungswaage", "abacus", "bildformate"}


# ── Download ─────────────────────────────────────────────────────────────────

def test_download_delivers_the_file_as_an_attachment(client, teacher_token, bundle_dir):
    _build(bundle_dir, "<!doctype html><title>Hallo</title>")
    r = client.get("/api/standalone/simulationen", headers=auth(teacher_token))
    assert r.status_code == 200
    assert "Hallo" in r.text
    assert "simulationen.html" in r.headers["content-disposition"]


def test_download_before_the_build_explains_what_to_do(client, teacher_token, bundle_dir):
    r = client.get("/api/standalone/simulationen", headers=auth(teacher_token))
    assert r.status_code == 404
    assert "build:standalone" in r.json()["detail"]


def test_unknown_bundle_is_404(client, teacher_token, bundle_dir):
    assert client.get("/api/standalone/gibtsnicht", headers=auth(teacher_token)).status_code == 404


# ── Freigabe ─────────────────────────────────────────────────────────────────

def test_a_student_may_have_it_too(db, klass, bundle_dir):
    # Die Simulationen sind für Schüler freigegeben — also auch die Offline-Datei.
    student = _student(db, klass)
    assert standalone._allowed(db, student, standalone.BUNDLES["simulationen"]) is True


def test_blocked_tools_mean_no_file(client, db, teacher, teacher_token, bundle_dir):
    _build(bundle_dir)
    for slug in ("gleichungswaage", "abacus", "bildformate"):
        db.add(ToolAvailability(tool_slug=slug, capability="use", audience="teacher",
                                class_id=None, allowed=False))
    db.flush()
    assert client.get("/api/standalone", headers=auth(teacher_token)).json() == []
    assert client.get("/api/standalone/simulationen", headers=auth(teacher_token)).status_code == 403


def test_one_allowed_tool_is_enough(client, db, teacher_token, bundle_dir):
    _build(bundle_dir)
    for slug in ("abacus", "bildformate"):  # die Waage bleibt frei
        db.add(ToolAvailability(tool_slug=slug, capability="use", audience="teacher",
                                class_id=None, allowed=False))
    db.flush()
    assert client.get("/api/standalone/simulationen", headers=auth(teacher_token)).status_code == 200
