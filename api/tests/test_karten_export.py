"""Kartentool: Arbeitsblatt-Export (pandoc + LibreOffice im API-Container)."""
import base64
import io
import struct
import zipfile
import zlib

import pytest

from .conftest import auth


def _png(w: int = 2, h: int = 2) -> str:
    """Ein rotes PNG (Standard 2×2) — echt genug für pandoc und LibreOffice."""
    def block(art: bytes, daten: bytes) -> bytes:
        return struct.pack(">I", len(daten)) + art + daten + struct.pack(">I", zlib.crc32(art + daten))
    zeilen = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    png = (b"\x89PNG\r\n\x1a\n" + block(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
           + block(b"IDAT", zlib.compress(zeilen)) + block(b"IEND", b""))
    return "data:image/png;base64," + base64.b64encode(png).decode()


def _body(**anders):
    return {
        "format": "docx", "variante": "beide", "titel": "Flüsse & Städte",
        "aufgabe": "Finde und benenne die nummerierten Flüsse und Städte.",
        "gruppen": [
            {"name": "Städte", "eintraege": [{"marke": "1", "name": "Erfurt"}, {"marke": "2", "name": "Jena"}]},
            {"name": "Flüsse", "eintraege": [{"marke": "a", "name": "Saale"}]},
        ],
        "karte": _png(), **anders,
    }


def _docx_text(inhalt: bytes) -> str:
    return zipfile.ZipFile(io.BytesIO(inhalt)).read("word/document.xml").decode("utf-8")


def test_docx_hat_aufgabe_karte_tabellen_und_loesung(client, teacher_token):
    r = client.post("/api/karten/export", json=_body(), headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert "Flüsse_Städte.docx" in r.headers["content-disposition"].replace("%C3%BC", "ü").replace("%C3%A4", "ä")
    xml = _docx_text(r.content)
    assert "Finde und benenne" in xml
    assert "Lösung" in xml and "Erfurt" in xml and "Saale" in xml  # »beide«: Lösung hängt an
    assert 'w:pgSz w:w="11906" w:h="16838"' in xml  # A4
    assert 'w:cols w:num="2"' in xml  # Tabellen zweispaltig
    archiv = zipfile.ZipFile(io.BytesIO(r.content))
    assert any(n.startswith("word/media/") for n in archiv.namelist())
    stile = archiv.read("word/styles.xml").decode("utf-8")
    assert 'w:ascii="Arial"' in stile and "Cambria" not in stile  # serifenlos


def test_aufgabe_ohne_loesung_verraet_keine_namen(client, teacher_token):
    r = client.post("/api/karten/export", json=_body(variante="aufgabe"), headers=auth(teacher_token))
    xml = _docx_text(r.content)
    assert "Erfurt" not in xml and "Saale" not in xml
    assert "Städte" in xml and "Lösung" not in xml


def test_tex_ist_zip_mit_bild_und_maskierten_zeichen(client, teacher_token):
    r = client.post("/api/karten/export", json=_body(format="tex"), headers=auth(teacher_token))
    assert r.status_code == 200
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert set(z.namelist()) == {"arbeitsblatt.tex", "karte.png"}
    tex = z.read("arbeitsblatt.tex").decode("utf-8")
    assert r"Flüsse \& Städte" in tex
    assert r"\includegraphics" in tex and "Saale" in tex
    assert r"\sfdefault" in tex


@pytest.mark.parametrize("format_,anfang", [("pdf", b"%PDF"), ("odt", b"PK")])
def test_pdf_und_odt_ueber_libreoffice(client, teacher_token, format_, anfang):
    r = client.post("/api/karten/export", json=_body(format=format_), headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    assert r.content.startswith(anfang)


def test_kein_png_wird_abgelehnt(client, teacher_token):
    r = client.post("/api/karten/export", json=_body(karte="data:image/png;base64,AAAA"), headers=auth(teacher_token))
    assert r.status_code == 422


def test_schueler_duerfen_nicht_exportieren(client, db):
    from api.auth import create_access_token
    from api.models import Student
    s = Student(vorname="Kim", nachname="Test", klasse="5a", active=True)
    db.add(s)
    db.flush()
    token = create_access_token({"sub": str(s.id), "type": "student"})
    client.cookies.clear()
    assert client.post("/api/karten/export", json=_body(), headers=auth(token)).status_code == 403


def _abschnitte(xml: str) -> list[str]:
    import re
    return re.findall(r"<w:sectPr>.*?</w:sectPr>", xml, flags=re.S)


@pytest.mark.parametrize("seite,w,h,breite_cm,quer", [("a4-hoch", 79, 100, 17.6, False), ("a4-quer", 189, 100, 26.3, True)])
def test_a4_karte_fuellt_seite_1_und_nur_die_dreht_sich(client, teacher_token, seite, w, h, breite_cm, quer):
    """pandoc begrenzt Bilder auf ~15 cm — die Karte wird auf den freien Platz von Seite 1 gesetzt.
    Querformat gilt nur für Seite 1; die Tabellenseiten bleiben hochkant und zweispaltig."""
    import re
    r = client.post("/api/karten/export", json=_body(seite=seite, karte=_png(w, h), variante="aufgabe"), headers=auth(teacher_token))
    assert r.status_code == 200
    xml = _docx_text(r.content)
    karte, tabellen = _abschnitte(xml)
    assert ('w:orient="landscape"' in karte) is quer
    assert 'w:orient="landscape"' not in tabellen and 'w:cols w:num="2"' in tabellen
    breiten = {int(cx) for cx in re.findall(r'<wp:extent cx="(\d+)"', xml)}
    assert len(breiten) == 1 and abs(breiten.pop() - breite_cm * 360000) < 0.05 * 360000


@pytest.mark.parametrize("w,h,quer", [(300, 200, True), (200, 300, False)])
def test_freies_format_dreht_seite_1_nach_der_karte(client, teacher_token, w, h, quer):
    xml = _docx_text(client.post("/api/karten/export", json=_body(karte=_png(w, h), variante="aufgabe"), headers=auth(teacher_token)).content)
    karte, tabellen = _abschnitte(xml)
    assert ('w:orient="landscape"' in karte) is quer
    assert 'w:orient="landscape"' not in tabellen


def test_lange_aufgabe_macht_die_karte_kleiner():
    import base64 as b64
    from api.karten_export import kartenseite
    png = b64.b64decode(_png(79, 100).split(",")[1])
    _, _, kurz = kartenseite("a4-hoch", png, "Finde die Orte.")
    _, _, lang = kartenseite("a4-hoch", png, "Finde die Orte. " * 30)
    assert lang < kurz


def test_pdf_in_atkinson_hyperlegible(client, teacher_token):
    """Die Schrift ist im API-Image installiert (Dockerfile); ohne sie ersetzt LibreOffice durch Serifen."""
    import re
    import shutil
    import subprocess
    if not shutil.which("fc-list") or "Atkinson" not in subprocess.run(["fc-list"], capture_output=True, text=True).stdout:
        pytest.skip("Atkinson Hyperlegible nicht installiert")
    r = client.post("/api/karten/export", json=_body(format="pdf"), headers=auth(teacher_token))
    schriften = set(re.findall(rb"/BaseFont\s*/[A-Z]+\+([A-Za-z-]+)", r.content))
    assert schriften and all(s.startswith(b"AtkinsonHyperlegible") for s in schriften)
