"""Kartentool: Arbeitsblatt-Export als PDF, DOCX, ODT oder LaTeX.

Seite 1: Titel, Name/Klasse/Datum, Aufgabe (»Finde und benenne …«), die Karte — so groß,
wie der freie Platz hergibt; bei »frei« im Hoch- oder Querformat, je nachdem was größer wird.
Danach: je nummerierter Ebene eine Tabelle, zweispaltig — leer zum Ausfüllen oder mit Lösung.
Variante »beide« hängt die Lösung als eigene Seiten an.

Schrift: im PDF Atkinson Hyperlegible (im API-Image installiert, siehe Dockerfile), in
DOCX/ODT Arial — die Dateien öffnen Lehrkräfte auf Rechnern ohne Atkinson.

Das Kartenbild rendert der Browser (MapLibre-Canvas) und schickt es als PNG mit;
der Server kennt keine Karte, nur Bild und Tabelleneinträge.

Weg: Markdown → pandoc → DOCX (auf A4 gesetzt) → LibreOffice → ODT/PDF.
LaTeX entsteht direkt und kommt als ZIP mit dem Kartenbild.
"""
import io
import math
import re
import subprocess
import tempfile
import textwrap
import zipfile
from pathlib import Path

import pypandoc

from .doc_convert import convert_to_pdf

SCHREIBLINIE = "." * 40  # gepunktete Linie zum Hineinschreiben — passt in eine halbe Seite

# Abschnittsgrenzen: pandoc kennt keine Abschnitte, darum stehen Platzhalter-Absätze im Text,
# die _anpassen() durch echte Abschnittsumbrüche ersetzt. Ein Abschnitt endet mit dem Absatz,
# der sein <w:sectPr> trägt — dieser Absatz wird 1 Punkt klein, damit er keine Leerseite erzeugt.
ENDE_KARTE = "§§ENDE-KARTE§§"
ENDE_TABELLEN = "§§ENDE-TABELLEN§§"


def _platzhalter(marke: str) -> str:
    return f'\n```{{=openxml}}\n<w:p><w:r><w:t>{marke}</w:t></w:r></w:p>\n```\n'


RAND = '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="425" w:footer="425" w:gutter="0"/>'
HOCH = '<w:pgSz w:w="11906" w:h="16838"/>'
QUER = '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>'
ZWEISPALTIG = '<w:cols w:num="2" w:space="567"/>'
EINSPALTIG = '<w:cols w:space="567"/>'


def _sect(quer: bool, spalten: int) -> str:
    return f'<w:sectPr>{QUER if quer else HOCH}{RAND}{ZWEISPALTIG if spalten == 2 else EINSPALTIG}</w:sectPr>'


def _umbruch(quer: bool, spalten: int) -> str:
    return ('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>'
            f'<w:rPr><w:sz w:val="2"/></w:rPr>{_sect(quer, spalten)}</w:pPr></w:p>')


# Serifenlos fürs Arbeitsblatt (Wunsch der Lehrkräfte)
def _schrift(name: str) -> str:
    return f'<w:rFonts w:ascii="{name}" w:hAnsi="{name}" w:eastAsia="{name}" w:cs="{name}"/>'


# Freier Platz für die Karte auf Seite 1 (cm): A4 minus 1,5-cm-Ränder, minus Titel, Name/Klasse,
# zwei Zeilen Aufgabe und kleine Quellenzeile; 4 mm schmaler, weil LibreOffice den Bildabsatz
# leicht einrückt. lib/karten/seite.ts nimmt dieselben Verhältnisse.
KARTENFLAECHE_CM = {"hoch": (17.6, 22.3), "quer": (26.3, 13.9)}
# Für so viele Aufgabenzeilen ist die Höhe gerechnet; jede weitere kostet die Karte Platz.
# Zeichen je Zeile grob für 12 pt bei 18 bzw. 26,7 cm Satzbreite.
AUFGABE_ZEILEN = {"hoch": 2, "quer": 1}
ZEICHEN_JE_ZEILE = {"hoch": 85, "quer": 125}
ZEILE_CM = 0.7
EMU_JE_CM = 360000


def _png_groesse(png: bytes) -> tuple[int, int]:
    return int.from_bytes(png[16:20], "big"), int.from_bytes(png[20:24], "big")


def _einpassen(w: int, h: int, flaeche: tuple[float, float]) -> tuple[float, float]:
    f = min(flaeche[0] / w, flaeche[1] / h)
    return w * f, h * f


def _flaeche(format_: str, aufgabe: str) -> tuple[float, float]:
    """Freier Platz für die Karte; eine lange Aufgabe schiebt die Karte nicht auf Seite 2."""
    b, h = KARTENFLAECHE_CM[format_]
    zeilen = math.ceil((len(aufgabe) + 10) / ZEICHEN_JE_ZEILE[format_])
    return b, h - ZEILE_CM * max(0, zeilen - AUFGABE_ZEILEN[format_])


def kartenseite(seite: str, png: bytes, aufgabe: str = "") -> tuple[bool, float, float]:
    """(quer?, Breite cm, Höhe cm) der Karte auf Seite 1. »frei«: das Format, in dem sie größer wird.
    Nur Seite 1 dreht sich ins Querformat — die Tabellenseiten bleiben hochkant."""
    w, h = _png_groesse(png)
    if seite in ("a4-hoch", "a4-quer"):
        quer = seite == "a4-quer"
        return (quer, *_einpassen(w, h, _flaeche("quer" if quer else "hoch", aufgabe)))
    hb, hh = _einpassen(w, h, _flaeche("hoch", aufgabe))
    qb, qh = _einpassen(w, h, _flaeche("quer", aufgabe))
    return (True, qb, qh) if qb * qh > hb * hh else (False, hb, hh)


def _anpassen(docx: Path, seite: str = "frei", png: bytes = b"", schrift: str = "Arial", aufgabe: str = "") -> None:
    """pandoc schreibt ein leeres <w:sectPr /> (Word nimmt dann US Letter) und Serifenschrift:
    Seite 1 je Teil als eigener Abschnitt (Karte, hoch oder quer), die Tabellen zweispaltig im
    Hochformat; Kartengröße aus dem freien Platz; serifenlose Schrift."""
    quer, breite, hoehe = kartenseite(seite, png, aufgabe)
    ein = zipfile.ZipFile(io.BytesIO(docx.read_bytes()))
    aus = io.BytesIO()
    with zipfile.ZipFile(aus, "w", zipfile.ZIP_DEFLATED) as z:
        for name in ein.namelist():
            daten = ein.read(name)
            if name == "word/document.xml":
                xml = daten.decode("utf-8")
                xml = re.sub(r"<w:sectPr[^>]*/>|<w:sectPr.*?</w:sectPr>", _sect(False, 2), xml, flags=re.S)
                xml = re.sub(rf"<w:p>(?:(?!<w:p>).)*?{ENDE_KARTE}.*?</w:p>", _umbruch(quer, 1), xml, flags=re.S)
                xml = re.sub(rf"<w:p>(?:(?!<w:p>).)*?{ENDE_TABELLEN}.*?</w:p>", _umbruch(False, 2), xml, flags=re.S)
                cx, cy = round(breite * EMU_JE_CM), round(hoehe * EMU_JE_CM)
                xml = re.sub(r'(<(?:wp:extent|a:ext) )cx="\d+" cy="\d+"', rf'\1cx="{cx}" cy="{cy}"', xml)
                daten = xml.encode("utf-8")
            elif name == "word/styles.xml":
                st = re.sub(r"<w:rFonts[^>]*/>", _schrift(schrift), daten.decode("utf-8"))
                # Tabellenzeilen (Stil »Compact«): Luft über der Schreiblinie statt einer leeren Zeile
                st = re.sub(r'(w:styleId="Compact".*?)<w:spacing [^>]*/>', r'\1<w:spacing w:before="220" w:after="60" />', st, count=1, flags=re.S)
                # Titel ohne Luft darüber — der Platz gehört der Karte
                st = re.sub(r'(w:styleId="Heading1".*?)<w:spacing [^>]*/>', r'\1<w:spacing w:before="0" w:after="120" />', st, count=1, flags=re.S)
                daten = st.encode("utf-8")
            z.writestr(name, daten)
    docx.write_bytes(aus.getvalue())


def _md_text(s: str) -> str:
    """Markdown-Sonderzeichen entschärfen."""
    return re.sub(r"([\\`*_{}\[\]<>#+\-.!|~^$])", r"\\\1", s)


def _xml_text(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _markdown(titel: str, aufgabe: str, gruppen: list[dict], loesung: bool, quelle: str) -> str:
    kopf = f"# {_md_text(titel)}{' — Lösung' if loesung else ''}\n\n"
    kopf += "Name: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_ Klasse: \\_\\_\\_\\_\\_\\_ Datum: \\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\n"
    kopf += f"**Aufgabe:** {_md_text(aufgabe)}\n\n"
    kopf += "![](karte.png)\n\n"
    # Quellen klein, damit die Karte den Platz bekommt
    kopf += ('\n```{=openxml}\n<w:p><w:pPr><w:spacing w:before="40" w:after="0"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="12"/></w:rPr>'
             f'<w:t xml:space="preserve">Kartengrundlage: {_xml_text(quelle)}</w:t></w:r></w:p>\n```\n')
    tabellen = "".join(f"\n## {_md_text(g['name'])}\n\n" + _grid_tabelle(g["eintraege"], loesung) for g in gruppen)
    return kopf + _platzhalter(ENDE_KARTE) + tabellen


def _grid_tabelle(eintraege: list[dict], loesung: bool) -> str:
    """Pandoc-Grid-Tabelle über die Spaltenbreite; leere Zeilen mit Schreiblinie und Luft darüber."""
    b1, b2 = 10, 60
    trenner = f"+{'-' * (b1 + 2)}+{'-' * (b2 + 2)}+\n"
    zeile = lambda a, b: f"| {a.ljust(b1)} | {b.ljust(b2)} |\n"  # noqa: E731
    t = trenner + zeile("Nr.", "Name") + trenner.replace("-", "=")
    for e in eintraege:
        # Leer: nur die Schreiblinie; die Höhe kommt vom Absatzabstand (Stil »Compact«)
        rechts = (textwrap.wrap(_md_text(e["name"]), b2) or [""]) if loesung else [SCHREIBLINIE]
        links = [f"**{_md_text(e['marke'])}**"] + [""] * (len(rechts) - 1)
        t += "".join(zeile(a, b) for a, b in zip(links, rechts)) + trenner
    return t + "\n"


def _docx(md: str, ordner: Path, seite: str = "frei", schrift: str = "Arial", aufgabe: str = "") -> Path:
    ziel = ordner / "arbeitsblatt.docx"
    pypandoc.convert_text(md, "docx", format="markdown", outputfile=str(ziel), extra_args=[f"--resource-path={ordner}"])
    _anpassen(ziel, seite, (ordner / "karte.png").read_bytes(), schrift, aufgabe)
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


def _tex(titel: str, aufgabe: str, gruppen: list[dict], variante: str, quelle: str, seite: str = "frei",
         quer: bool = False) -> str:
    def seiten(loesung: bool) -> str:
        t = [
            r"\section*{" + _tex_text(titel) + (" -- Lösung" if loesung else "") + "}",
            r"Name: \rule{6cm}{0.4pt}\hfill Klasse: \rule{2cm}{0.4pt}\hfill Datum: \rule{3cm}{0.4pt}\par\bigskip",
            r"\textbf{Aufgabe:} " + _tex_text(aufgabe) + r"\par\medskip",
            r"\noindent\includegraphics[width=\linewidth,height=0.8\textheight,keepaspectratio]{karte.png}\par",
            r"{\tiny\itshape Kartengrundlage: " + _tex_text(quelle) + r"}",
            r"\newpage",
            r"\begin{multicols}{2}",
        ]
        for g in gruppen:
            t.append(r"\subsection*{" + _tex_text(g["name"]) + "}")
            t.append(r"\begin{tabularx}{\linewidth}{|>{\bfseries}p{1.4cm}|X|}\hline")
            t.append(r"Nr. & Name \\ \hline")
            for e in g["eintraege"]:
                inhalt = _tex_text(e["name"]) if loesung else ""
                t.append(_tex_text(e["marke"]) + " & " + inhalt + r" \rule{0pt}{0.9cm} \\ \hline")
            t.append(r"\end{tabularx}")
        t.append(r"\end{multicols}")
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
        r"\usepackage[margin=1.5cm" + (",landscape" if quer else "") + "]{geometry}",
        r"\usepackage{graphicx}",
        r"\usepackage{tabularx,array,multicol}",
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
               karte_png: bytes, quelle: str, seite: str = "frei") -> tuple[bytes, str] | None:
    """Liefert (Dateiinhalt, Dateiendung) oder None, wenn LibreOffice/pandoc scheitert."""
    if format_ == "tex":
        puffer = io.BytesIO()
        with zipfile.ZipFile(puffer, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("arbeitsblatt.tex", _tex(titel, aufgabe, gruppen, variante, quelle, seite, kartenseite(seite, karte_png, aufgabe)[0]))
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
        # Atkinson Hyperlegible nur im PDF — dort ist sie eingebettet; DOCX/ODT bleiben bei Arial
        schrift = "Atkinson Hyperlegible" if format_ == "pdf" else "Arial"
        docx = _docx(_platzhalter(ENDE_TABELLEN).join(teile), ordner, seite, schrift, aufgabe)
        if format_ == "docx":
            return docx.read_bytes(), "docx"
        ziel = _soffice(docx, format_)
        return (ziel.read_bytes(), format_) if ziel else None
