"""Kartentool: Arbeitsblatt-Export als PDF, DOCX, ODT oder LaTeX.

Seite 1: Titel, Name/Klasse/Datum, Aufgabe (»Finde und benenne …«), die Karte.
Seite 2: je nummerierter Ebene eine Tabelle — leer zum Ausfüllen oder mit Lösung.
Variante »beide« hängt die Lösung als eigene Seiten an.

Das Kartenbild rendert der Browser (MapLibre-Canvas) und schickt es als PNG mit;
der Server kennt keine Karte, nur Bild und Tabelleneinträge.

Weg: Markdown → pandoc → DOCX (auf A4 gesetzt) → LibreOffice → ODT/PDF.
LaTeX entsteht direkt und kommt als ZIP mit dem Kartenbild.
"""
import io
import re
import subprocess
import tempfile
import textwrap
import zipfile
from pathlib import Path

import pypandoc

from .doc_convert import convert_to_pdf

SEITENUMBRUCH_DOCX = '\n```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n'
SCHREIBLINIE = "." * 58  # gepunktete Linie zum Hineinschreiben


SEITE_A4 = ('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>'
            '</w:sectPr>')


# Serifenlos fürs Arbeitsblatt (Wunsch der Lehrkräfte). Im API-Container ersetzt
# LibreOffice Arial beim PDF durch DejaVu Sans — ebenfalls serifenlos.
SCHRIFT = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'


def _anpassen(docx: Path) -> None:
    """pandoc schreibt ein leeres <w:sectPr /> (Word nimmt dann US Letter) und Serifenschrift:
    A4 mit 2-cm-Rändern und Arial setzen."""
    ein = zipfile.ZipFile(io.BytesIO(docx.read_bytes()))
    aus = io.BytesIO()
    with zipfile.ZipFile(aus, "w", zipfile.ZIP_DEFLATED) as z:
        for name in ein.namelist():
            daten = ein.read(name)
            if name == "word/document.xml":
                xml = daten.decode("utf-8")
                daten = re.sub(r"<w:sectPr[^>]*/>|<w:sectPr.*?</w:sectPr>", SEITE_A4, xml, flags=re.S).encode("utf-8")
            elif name == "word/styles.xml":
                daten = re.sub(r"<w:rFonts[^>]*/>", SCHRIFT, daten.decode("utf-8")).encode("utf-8")
            z.writestr(name, daten)
    docx.write_bytes(aus.getvalue())


def _md_text(s: str) -> str:
    """Markdown-Sonderzeichen entschärfen."""
    return re.sub(r"([\\`*_{}\[\]<>#+\-.!|~^$])", r"\\\1", s)


def _markdown(titel: str, aufgabe: str, gruppen: list[dict], loesung: bool, quelle: str) -> str:
    kopf = f"# {_md_text(titel)}{' — Lösung' if loesung else ''}\n\n"
    kopf += "Name: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ Klasse: \\_\\_\\_\\_\\_\\_ Datum: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\n"
    kopf += f"**Aufgabe:** {_md_text(aufgabe)}\n\n"
    kopf += "![](karte.png){width=100%}\n\n"
    kopf += f"*Kartengrundlage: {_md_text(quelle)}*\n"
    tabellen = "".join(f"\n## {_md_text(g['name'])}\n\n" + _grid_tabelle(g["eintraege"], loesung) for g in gruppen)
    return kopf + SEITENUMBRUCH_DOCX + tabellen


def _grid_tabelle(eintraege: list[dict], loesung: bool) -> str:
    """Pandoc-Grid-Tabelle über die volle Breite; leere Zeilen sind zwei Absätze hoch (Platz zum Schreiben)."""
    b1, b2 = 10, 60
    trenner = f"+{'-' * (b1 + 2)}+{'-' * (b2 + 2)}+\n"
    zeile = lambda a, b: f"| {a.ljust(b1)} | {b.ljust(b2)} |\n"  # noqa: E731
    t = trenner + zeile("Nr.", "Name") + trenner.replace("-", "=")
    for e in eintraege:
        # Leer: harter Zeilenumbruch (»\« am Zeilenende) + Schreiblinie → zwei Zeilen hoch
        rechts = (textwrap.wrap(_md_text(e["name"]), b2) or [""]) if loesung else ["\\", SCHREIBLINIE]
        links = [f"**{_md_text(e['marke'])}**"] + [""] * (len(rechts) - 1)
        t += "".join(zeile(a, b) for a, b in zip(links, rechts)) + trenner
    return t + "\n"


def _docx(md: str, ordner: Path) -> Path:
    ziel = ordner / "arbeitsblatt.docx"
    pypandoc.convert_text(md, "docx", format="markdown", outputfile=str(ziel), extra_args=[f"--resource-path={ordner}"])
    _anpassen(ziel)
    return ziel


def _soffice(quelle: Path, format_: str) -> Path | None:
    if format_ == "pdf":
        return convert_to_pdf(quelle, quelle.parent)
    try:
        subprocess.run(["soffice", "--headless", "--convert-to", format_, "--outdir", str(quelle.parent), str(quelle)],
                       capture_output=True, timeout=30, check=True)
    except Exception:
        return None
    ziel = quelle.with_suffix(f".{format_}")
    return ziel if ziel.exists() else None


# ── LaTeX ────────────────────────────────────────────────────────────

_TEX_ZEICHEN = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
                "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}"}


def _tex_text(s: str) -> str:
    return "".join(_TEX_ZEICHEN.get(c, c) for c in s)


def _tex(titel: str, aufgabe: str, gruppen: list[dict], variante: str, quelle: str) -> str:
    def seiten(loesung: bool) -> str:
        t = [
            r"\section*{" + _tex_text(titel) + (" -- Lösung" if loesung else "") + "}",
            r"Name: \rule{6cm}{0.4pt}\hfill Klasse: \rule{2cm}{0.4pt}\hfill Datum: \rule{3cm}{0.4pt}\par\bigskip",
            r"\textbf{Aufgabe:} " + _tex_text(aufgabe) + r"\par\medskip",
            r"\noindent\includegraphics[width=\linewidth,height=0.72\textheight,keepaspectratio]{karte.png}\par",
            r"{\footnotesize\itshape Kartengrundlage: " + _tex_text(quelle) + r"}",
            r"\newpage",
        ]
        for g in gruppen:
            t.append(r"\subsection*{" + _tex_text(g["name"]) + "}")
            t.append(r"\begin{tabularx}{\linewidth}{|>{\bfseries}p{1.4cm}|X|}\hline")
            t.append(r"Nr. & Name \\ \hline")
            for e in g["eintraege"]:
                inhalt = _tex_text(e["name"]) if loesung else ""
                t.append(_tex_text(e["marke"]) + " & " + inhalt + r" \rule{0pt}{0.9cm} \\ \hline")
            t.append(r"\end{tabularx}")
        return "\n".join(t)

    teile = []
    if variante in ("aufgabe", "beide"):
        teile.append(seiten(False))
    if variante in ("loesung", "beide"):
        teile.append(seiten(True))
    return "\n".join([
        r"\documentclass[11pt,a4paper]{article}",
        r"\usepackage[utf8]{inputenc}",
        r"\usepackage[T1]{fontenc}",
        r"\usepackage[ngerman]{babel}",
        r"\usepackage[scaled]{helvet}",
        r"\renewcommand{\familydefault}{\sfdefault}",
        r"\usepackage[margin=2cm]{geometry}",
        r"\usepackage{graphicx}",
        r"\usepackage{tabularx,array}",
        r"\pagestyle{empty}",
        r"\begin{document}",
        "\n\\newpage\n".join(teile),
        r"\end{document}",
        "",
    ])


# ── Einstieg ─────────────────────────────────────────────────────────

MEDIENTYP = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "odt": "application/vnd.oasis.opendocument.text",
    "tex": "application/zip",
}


def exportiere(format_: str, titel: str, aufgabe: str, gruppen: list[dict], variante: str,
               karte_png: bytes, quelle: str) -> tuple[bytes, str] | None:
    """Liefert (Dateiinhalt, Dateiendung) oder None, wenn LibreOffice/pandoc scheitert."""
    if format_ == "tex":
        puffer = io.BytesIO()
        with zipfile.ZipFile(puffer, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("arbeitsblatt.tex", _tex(titel, aufgabe, gruppen, variante, quelle))
            z.writestr("karte.png", karte_png)
        return puffer.getvalue(), "zip"

    with tempfile.TemporaryDirectory() as tmp:
        ordner = Path(tmp)
        (ordner / "karte.png").write_bytes(karte_png)
        teile = []
        if variante in ("aufgabe", "beide"):
            teile.append(_markdown(titel, aufgabe, gruppen, False, quelle))
        if variante in ("loesung", "beide"):
            teile.append(_markdown(titel, aufgabe, gruppen, True, quelle))
        docx = _docx(SEITENUMBRUCH_DOCX.join(teile), ordner)
        if format_ == "docx":
            return docx.read_bytes(), "docx"
        ziel = _soffice(docx, format_)
        return (ziel.read_bytes(), format_) if ziel else None
