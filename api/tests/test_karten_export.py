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


@pytest.mark.parametrize("seite,w,h", [("a4-hoch", 79, 100), ("frei", 100, 79), ("a4-quer", 100, 79)])
def test_blatt_ist_immer_hochkant_und_die_karte_fuellt_seite_1(client, teacher_token, seite, w, h):
    """Querformat-Karten dreht der Browser vorher (lib/karten/drehen.ts) — das Blatt bleibt hochkant.
    Seite 1 einspaltig mit der Karte, danach zweispaltige Tabellen."""
    import re
    r = client.post("/api/karten/export", json=_body(seite=seite, karte=_png(w, h), variante="aufgabe"), headers=auth(teacher_token))
    assert r.status_code == 200
    xml = _docx_text(r.content)
    assert "landscape" not in xml
    karte, tabellen = _abschnitte(xml)
    assert 'w:num="2"' not in karte and 'w:cols w:num="2"' in tabellen
    breiten = {int(cx) for cx in re.findall(r'<wp:extent cx="(\d+)"', xml)}
    assert len(breiten) == 1
    breite = breiten.pop() / 360000
    assert breite > 15  # füllt die Seite statt pandocs 15-cm-Vorgabe


def test_querformat_karte_zeigt_sueden_nach_links():
    """Gedreht wird im Uhrzeigersinn: der Nordrand der Karte liegt danach rechts."""
    from PIL import Image
    from api.karten_export import hochkant
    bild = Image.new("RGB", (40, 30), "white")
    bild.paste((255, 0, 0), (0, 0, 40, 5))  # roter Nordrand
    puffer = io.BytesIO()
    bild.save(puffer, "PNG")
    with Image.open(io.BytesIO(hochkant(puffer.getvalue()))) as gedreht:
        assert gedreht.size == (30, 40)
        assert gedreht.getpixel((29, 20)) == (255, 0, 0)
        assert gedreht.getpixel((0, 20)) == (255, 255, 255)


@pytest.mark.parametrize("w,h,gedreht", [(100, 79, True), (79, 100, False), (50, 50, False)])
def test_querformat_karte_wird_gedreht(client, teacher_token, w, h, gedreht):
    """Nur echtes Querformat wird gedreht — dann ist das Bild im DOCX hochkant."""
    from PIL import Image
    r = client.post("/api/karten/export", json=_body(karte=_png(w, h)), headers=auth(teacher_token))
    archiv = zipfile.ZipFile(io.BytesIO(r.content))
    bild = next(n for n in archiv.namelist() if n.startswith("word/media/"))
    with Image.open(io.BytesIO(archiv.read(bild))) as b:
        assert b.size == ((h, w) if gedreht else (w, h))


def test_lange_aufgabe_macht_die_karte_kleiner():
    import base64 as b64
    from api.karten_export import kartengroesse
    png = b64.b64decode(_png(79, 100).split(",")[1])
    _, kurz = kartengroesse(png, "Finde die Orte.")
    _, lang = kartengroesse(png, "Finde die Orte. " * 30)
    assert lang < kurz


def test_lange_quellenliste_bleibt_auf_der_kartenseite():
    """Die Quellen stehen unter der Karte — viele Quellen machen die Karte niedriger."""
    import base64 as b64
    from api.karten_export import kartengroesse
    png = b64.b64decode(_png(79, 100).split(",")[1])
    _, kurz = kartengroesse(png, "Finde die Orte.", "BKG")
    _, lang = kartengroesse(png, "Finde die Orte.", "© GeoBasis-DE / BKG (2026) · Natural Earth · " * 15)
    assert lang < kurz


def _thema(n: int) -> dict:
    return {"name": f"Thema {n}", "eintraege": [{"marke": str(i), "name": f"Ort {i}"} for i in range(n)]}


@pytest.mark.parametrize("groessen,plan", [
    ([16, 20], [False, True]),        # zusammen zu lang: jedes Thema in eigene Spalte
    ([16, 26], [False, False]),       # 26 ist länger als eine Spalte: läuft ohne Umbruch weiter
    ([6, 8], [False, False]),         # passen zusammen in eine Spalte
    ([6, 8, 9], [False, False, True]),
    ([30, 4], [False, False]),        # 30 läuft über; 4 passt noch in den Rest der Folgespalte
    ([30, 20], [False, True]),
])
def test_spaltenplan_ein_thema_je_spalte_ausser_es_passt_dazu(groessen, plan):
    from api.karten_export import spaltenplan
    assert spaltenplan([_thema(n) for n in groessen], False) == plan


def test_spaltenumbruch_steht_im_docx(client, teacher_token):
    gruppen = [{"name": "Länder", "eintraege": [{"marke": str(i), "name": f"Land {i}"} for i in range(16)]},
               {"name": "Städte", "eintraege": [{"marke": chr(97 + i), "name": f"Stadt {i}"} for i in range(20)]}]
    r = client.post("/api/karten/export", json=_body(gruppen=gruppen, variante="aufgabe"), headers=auth(teacher_token))
    assert _docx_text(r.content).count('w:type="column"') == 1


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
