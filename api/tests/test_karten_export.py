"""Kartentool: Arbeitsblatt-Export (pandoc + LibreOffice im API-Container)."""
import base64
import io
import struct
import zipfile
import zlib

import pytest

from .conftest import auth


def _png() -> str:
    """Ein 2×2-PNG, rot — echt genug für pandoc und LibreOffice."""
    def block(art: bytes, daten: bytes) -> bytes:
        return struct.pack(">I", len(daten)) + art + daten + struct.pack(">I", zlib.crc32(art + daten))
    zeilen = b"".join(b"\x00" + b"\xff\x00\x00" * 2 for _ in range(2))
    png = (b"\x89PNG\r\n\x1a\n" + block(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0))
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
