"""Kartentool: Arbeitsblatt-Export als PDF, DOCX, ODT oder LaTeX.

Seite 1 (immer hochkant): Titel, Name/Klasse/Datum, Aufgabe (»Finde und benenne …«), die
Karte — so groß, wie der freie Platz hergibt. Eine Querformat-Karte wird um 90° gegen den
Uhrzeigersinn gedreht (Norden nach links), der Text bleibt aufrecht.
Danach je nummerierter Ebene eine Tabelle, zweispaltig: jedes Thema beginnt in einer eigenen
Spalte — außer zwei passen zusammen in eine Spalte, ohne umzubrechen, oder das Thema ist ohnehin
länger als eine Spalte. Leer zum Ausfüllen oder
mit Lösung; Variante »beide« hängt die Lösung als eigene Seiten an.

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
ZWEISPALTIG = '<w:cols w:num="2" w:space="567"/>'
EINSPALTIG = '<w:cols w:space="567"/>'
KLEIN = '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>'
# Spaltenumbruch in einem 1-Punkt-Absatz, damit oben in der neuen Spalte keine Leerzeile steht
SPALTENUMBRUCH = f'\n```{{=openxml}}\n<w:p><w:pPr>{KLEIN}</w:pPr><w:r><w:br w:type="column"/></w:r></w:p>\n```\n'


def _sect(spalten: int) -> str:
    return f'<w:sectPr>{HOCH}{RAND}{ZWEISPALTIG if spalten == 2 else EINSPALTIG}</w:sectPr>'


def _umbruch(spalten: int) -> str:
    return f'<w:p><w:pPr>{KLEIN}<w:rPr><w:sz w:val="2"/></w:rPr>{_sect(spalten)}</w:pPr></w:p>'


# Serifenlos fürs Arbeitsblatt (Wunsch der Lehrkräfte)
def _schrift(name: str) -> str:
    return f'<w:rFonts w:ascii="{name}" w:hAnsi="{name}" w:eastAsia="{name}" w:cs="{name}"/>'


# Freier Platz für die Karte auf Seite 1 (cm): A4 hochkant minus 1,5-cm-Ränder, minus Titel,
# Name/Klasse, zwei Zeilen Aufgabe und kleine Quellenzeile; 4 mm schmaler, weil LibreOffice den
# Bildabsatz leicht einrückt. lib/karten/seite.ts nimmt dasselbe Verhältnis.
KARTENFLAECHE_CM = (17.6, 22.3)
# Für so viele Aufgabenzeilen ist die Höhe gerechnet; jede weitere kostet die Karte Platz.
# Zeichen je Zeile grob für 12 pt bei 18 cm Satzbreite.
AUFGABE_ZEILEN = 2
ZEICHEN_JE_ZEILE = 85
ZEILE_CM = 0.7
# Ebenso die Quellenzeile (6 pt kursiv): gerechnet für eine Zeile, jede weitere kostet Platz —
# die Quellen müssen auf der Kartenseite bleiben.
QUELLE_ZEILEN = 1
QUELLE_ZEICHEN_JE_ZEILE = 150
QUELLE_ZEILE_CM = 0.3
EMU_JE_CM = 360000


def _png_groesse(png: bytes) -> tuple[int, int]:
    return int.from_bytes(png[16:20], "big"), int.from_bytes(png[20:24], "big")


def hochkant(png: bytes) -> bytes:
    """Querformat-Karte um 90° gegen den Uhrzeigersinn drehen: Man dreht das Blatt nach rechts
    und liest sie quer — so füllt sie die hochkante Seite statt nur ihre obere Hälfte."""
    w, h = _png_groesse(png)
    if w <= h:
        return png
    from PIL import Image
    with Image.open(io.BytesIO(png)) as bild:
        aus = io.BytesIO()
        bild.transpose(Image.Transpose.ROTATE_90).save(aus, "PNG")
    return aus.getvalue()


def kartengroesse(png: bytes, aufgabe: str = "", quelle: str = "") -> tuple[float, float]:
    """(Breite, Höhe) der Karte auf Seite 1 in cm — eingepasst in den freien Platz.
    Lange Aufgaben und Quellenlisten machen die Karte kleiner, statt etwas auf Seite 2 zu schieben."""
    w, h = _png_groesse(png)
    zeilen = math.ceil((len(aufgabe) + 10) / ZEICHEN_JE_ZEILE)
    q_zeilen = math.ceil((len(quelle) + 18) / QUELLE_ZEICHEN_JE_ZEILE)
    fb = KARTENFLAECHE_CM[0]
    fh = (KARTENFLAECHE_CM[1] - ZEILE_CM * max(0, zeilen - AUFGABE_ZEILEN)
          - QUELLE_ZEILE_CM * max(0, q_zeilen - QUELLE_ZEILEN))
    f = min(fb / w, fh / h)
    return w * f, h * f


# Höhen für die Spaltenplanung (cm), an LibreOffice-Ausgaben in Atkinson Hyperlegible abgelesen
SPALTE_CM = 25.0
THEMA_CM = 1.3  # Überschrift des Themas
KOPF_CM = 1.0  # Kopfzeile »Nr. | Name«
TABELLENZEILE_CM = 1.02
FOLGEZEILE_CM = 0.55  # jede weitere Zeile eines langen Namens
NAME_ZEICHEN = 28  # so viel passt in die Namensspalte einer halben Seite


def _themenhoehe(g: dict, loesung: bool) -> float:
    zeilen = sum(max(1, math.ceil(len(e["name"]) / NAME_ZEICHEN)) if loesung else 1 for e in g["eintraege"])
    return THEMA_CM + KOPF_CM + TABELLENZEILE_CM * len(g["eintraege"]) + FOLGEZEILE_CM * (zeilen - len(g["eintraege"]))


def spaltenplan(gruppen: list[dict], loesung: bool) -> list[bool]:
    """Je Thema: beginnt es mit einem Spaltenumbruch? Jedes Thema kommt in eine eigene Spalte,
    es sei denn, es passt noch ganz in die Spalte, in der das vorige endet. Ein Thema, das ohnehin
    länger als eine Spalte ist, fängt ohne Umbruch an und läuft weiter — sonst bliebe sein Rest
    allein auf einer fast leeren Seite."""
    plan, belegt = [], 0.0
    for i, g in enumerate(gruppen):
        h = _themenhoehe(g, loesung)
        umbruch = i > 0 and belegt > 0 and belegt + h > SPALTE_CM and h <= SPALTE_CM
        if umbruch:
            belegt = 0.0
        belegt += h
        while belegt > SPALTE_CM:  # zu lang für eine Spalte: es läuft in die nächste weiter
            belegt -= SPALTE_CM
        plan.append(umbruch)
    return plan


def _anpassen(docx: Path, png: bytes = b"", schrift: str = "Arial", aufgabe: str = "", quelle: str = "") -> None:
    """pandoc schreibt ein leeres <w:sectPr /> (Word nimmt dann US Letter) und Serifenschrift:
    Seite 1 je Teil als eigener Abschnitt (einspaltig, Karte), die Tabellen zweispaltig;
    alles A4 hochkant; Kartengröße aus dem freien Platz; serifenlose Schrift."""
    breite, hoehe = kartengroesse(png, aufgabe, quelle)
    ein = zipfile.ZipFile(io.BytesIO(docx.read_bytes()))
    aus = io.BytesIO()
    with zipfile.ZipFile(aus, "w", zipfile.ZIP_DEFLATED) as z:
        for name in ein.namelist():
            daten = ein.read(name)
            if name == "word/document.xml":
                xml = daten.decode("utf-8")
                xml = re.sub(r"<w:sectPr[^>]*/>|<w:sectPr.*?</w:sectPr>", _sect(2), xml, flags=re.S)
                xml = re.sub(rf"<w:p>(?:(?!<w:p>).)*?{ENDE_KARTE}.*?</w:p>", _umbruch(1), xml, flags=re.S)
                xml = re.sub(rf"<w:p>(?:(?!<w:p>).)*?{ENDE_TABELLEN}.*?</w:p>", _umbruch(2), xml, flags=re.S)
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
    tabellen = "".join(
        (SPALTENUMBRUCH if umbruch else "") + f"\n## {_md_text(g['name'])}\n\n" + _grid_tabelle(g["eintraege"], loesung)
        for g, umbruch in zip(gruppen, spaltenplan(gruppen, loesung)))
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


def _docx(md: str, ordner: Path, schrift: str = "Arial", aufgabe: str = "", quelle: str = "") -> Path:
    ziel = ordner / "arbeitsblatt.docx"
    pypandoc.convert_text(md, "docx", format="markdown", outputfile=str(ziel), extra_args=[f"--resource-path={ordner}"])
    _anpassen(ziel, (ordner / "karte.png").read_bytes(), schrift, aufgabe, quelle)
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
            r"\noindent\includegraphics[width=\linewidth,height=0.8\textheight,keepaspectratio]{karte.png}\par",
            r"{\tiny\itshape Kartengrundlage: " + _tex_text(quelle) + r"}",
            r"\newpage",
            r"\begin{multicols}{2}",
        ]
        for g, umbruch in zip(gruppen, spaltenplan(gruppen, loesung)):
            if umbruch:
                t.append(r"\columnbreak")
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
        r"\usepackage[margin=1.5cm]{geometry}",
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
    """Liefert (Dateiinhalt, Dateiendung) oder None, wenn LibreOffice/pandoc scheitert.
    `seite` bestimmt nur den Ausschnitt im Browser; das Blatt ist immer A4 hochkant."""
    karte_png = hochkant(karte_png)
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
        # Atkinson Hyperlegible nur im PDF — dort ist sie eingebettet; DOCX/ODT bleiben bei Arial
        schrift = "Atkinson Hyperlegible" if format_ == "pdf" else "Arial"
        docx = _docx(_platzhalter(ENDE_TABELLEN).join(teile), ordner, schrift, aufgabe, quelle)
        if format_ == "docx":
            return docx.read_bytes(), "docx"
        ziel = _soffice(docx, format_)
        return (ziel.read_bytes(), format_) if ziel else None
