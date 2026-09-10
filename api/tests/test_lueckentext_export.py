"""Tests for Lückentext PDF export (Stage 5)."""
import re
import shutil

import pytest

from api.tests.conftest import auth
from api.auth import create_guest_token
from api.tests.test_lueckentexte import sample_payload, token_for
from api.lueckentext_export import build_html


@pytest.fixture()
def teacher_token(teacher):
    return token_for(teacher)


@pytest.fixture()
def set_id(client, teacher_token):
    r = client.post("/api/lueckentexte", json=sample_payload(), headers=auth(teacher_token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


class FakeSet:
    def __init__(self, title, text, gaps):
        self.title = title
        self.text = text
        self.gaps = gaps


def make_fake_set():
    return FakeSet(
        title="Wasserkreislauf",
        text="Es entsteht {{a}} und {{b}}.",
        gaps=[
            {"id": "a", "answer": "Verdunstung"},
            {"id": "b", "answer": "Wolke"},
        ],
    )


class TestBuildHtml:
    def test_blank_version_has_no_answers(self):
        lset = make_fake_set()
        html = build_html(lset, filled=False)
        # Stage 1 intentionally lists the answers in its word bank — but the
        # actual gap text (the blanks in the sentence) must never leak them.
        body_paragraphs = re.findall(r'<p class="body-text">.*?</p>', html)
        assert len(body_paragraphs) == 3  # one per difficulty stage
        for p in body_paragraphs:
            assert "Verdunstung" not in p
            assert "Wolke" not in p
        assert "Wasserkreislauf" in html
        # 2 gaps x 3 difficulty stages = 6 blank spans
        assert html.count('class="gap"') == 6

    def test_blank_version_has_three_stages(self):
        lset = make_fake_set()
        html = build_html(lset, filled=False)
        assert "Wortbank" in html
        assert "Anzahl der Buchstaben" in html
        assert "Ohne Hilfen" in html

    def test_blank_wordbank_stage_lists_answers(self):
        lset = make_fake_set()
        html = build_html(lset, filled=False)
        wordbank_idx = html.index('class="wordbank-table"')
        wordbank_section = html[wordbank_idx:wordbank_idx + 500]
        assert "Verdunstung" in wordbank_section
        assert "Wolke" in wordbank_section

    def test_gap_length_scales_with_answer_length(self):
        lset = make_fake_set()
        html = build_html(lset, filled=False)
        # "Verdunstung" is 11 letters — the length-revealing stages must show 11 underscores.
        assert '<span class="gap">___________</span>' in html
        # "Wolke" is 5 letters.
        assert '<span class="gap">_____</span>' in html
        # The hard stage gives every gap the same single long blank, regardless
        # of the real answer's length — no letter-count cue at all.
        assert html.count('<span class="gap">' + "_" * 16 + '</span>') == 2

    def test_line_breaks_survive(self):
        """HTML collapses newlines — the author's line breaks must be kept."""
        lset = FakeSet(
            title="Gedicht",
            text="Erste Zeile {{a}}\r\nZweite Zeile\n\nNach der Leerzeile {{b}}",
            gaps=[{"id": "a", "answer": "Verdunstung"}, {"id": "b", "answer": "Wolke"}],
        )
        for html in (build_html(lset, filled=False), build_html(lset, filled=True)):
            assert "\n" not in re.search(r'<p class="body-text">(.*?)</p>', html, re.S).group(1)
            assert "Erste Zeile" in html and "Zweite Zeile" in html
        # 3 breaks per stage body: one after "Zeile {{a}}", two around the blank line.
        assert build_html(lset, filled=True).count("<br />") == 3
        assert build_html(lset, filled=False).count("<br />") == 9  # 3 stages

    def test_filled_version_has_answers(self):
        lset = make_fake_set()
        html = build_html(lset, filled=True)
        assert "Verdunstung" in html
        assert "Wolke" in html
        assert 'class="gap filled"' in html

    def test_given_answers_override(self):
        lset = make_fake_set()
        html = build_html(lset, filled=True, given_answers={"a": "Falschantwort"})
        assert "Falschantwort" in html
        assert "Verdunstung" not in html
        assert "Wolke" in html


@pytest.mark.skipif(shutil.which("soffice") is None, reason="LibreOffice not installed")
class TestPdfHttp:
    def test_export_blank_pdf(self, client, teacher_token, set_id):
        r = client.get(f"/api/lueckentexte/{set_id}/export.pdf?filled=0", headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")
        assert len(r.content) > 0

    def test_export_filled_pdf(self, client, teacher_token, set_id):
        r = client.get(f"/api/lueckentexte/{set_id}/export.pdf?filled=1", headers=auth(teacher_token))
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")
        assert len(r.content) > 0

    def test_export_participant_pdf(self, client, teacher_token, set_id):
        r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
        assert r.status_code == 201, r.text
        code = r.json()["join_code"]

        r = client.post(f"/api/lueckentexte/sessions/{code}/join", json={"name": "Max", "avatar": "cat"}, headers={"Authorization": f"Bearer {create_guest_token(code, 'Max')}"})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        token = r.json()["export_token"]

        client.post(f"/api/lueckentexte/sessions/{code}/start", headers=auth(teacher_token))
        client.post(f"/api/lueckentexte/sessions/{code}/gaps/a/attempt", json={"participant_id": pid, "text": "Verdunstung"})
        client.post(f"/api/lueckentexte/sessions/{code}/gaps/b/attempt", json={"participant_id": pid, "text": "Wolke"})

        r = client.get(f"/api/lueckentexte/sessions/{code}/participants/{token}/export.pdf")
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF")
        assert len(r.content) > 0

    def test_export_needs_the_token_not_the_id(self, client, teacher_token, set_id):
        """Das Blatt des Nachbarn darf nicht eine URL-Ziffer weit entfernt liegen:
        die fortlaufende Teilnehmer-Id oeffnet den Download nicht mehr, und der
        Schluessel des einen fuehrt nicht zum Blatt des anderen."""
        r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
        code = r.json()["join_code"]

        def join(name):
            r = client.post(f"/api/lueckentexte/sessions/{code}/join", json={"name": name, "avatar": "cat"},
                            headers={"Authorization": f"Bearer {create_guest_token(code, name)}"})
            assert r.status_code == 201, r.text
            return r.json()

        a, b = join("Anna"), join("Bruno")
        assert a["export_token"] != b["export_token"]

        # Die blosse Id — frueher der ganze Schluessel — reicht nicht mehr.
        r = client.get(f"/api/lueckentexte/sessions/{code}/participants/{b['id']}/export.pdf")
        assert r.status_code == 404

        # Und Annas Schluessel gehoert zu Annas Blatt.
        r = client.get(f"/api/lueckentexte/sessions/{code}/participants/{a['export_token']}/export.pdf")
        assert r.status_code == 200
        assert "Anna" in r.headers["content-disposition"]


class TestNotFound:
    def test_export_unknown_set_404(self, client, teacher_token):
        r = client.get("/api/lueckentexte/999999/export.pdf", headers=auth(teacher_token))
        assert r.status_code == 404

    def test_export_unknown_participant_404(self, client, teacher_token, set_id):
        r = client.post(f"/api/lueckentexte/{set_id}/sessions", headers=auth(teacher_token))
        code = r.json()["join_code"]
        r = client.get(f"/api/lueckentexte/sessions/{code}/participants/999999/export.pdf")
        assert r.status_code == 404

    def test_export_unknown_session_404(self, client):
        r = client.get("/api/lueckentexte/sessions/NOPE1234/participants/1/export.pdf")
        assert r.status_code == 404
